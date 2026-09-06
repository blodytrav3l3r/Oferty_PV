import puppeteer from 'puppeteer';
import { logger } from '../../utils/logger';

/**
 * P0-G: kolejka generowania PDF (in-process, bez Redis/BullMQ).
 * Jeden Chromium to ~200–500 MB RAM — N równoległych PDF zabija 1 serwer.
 * concurrency 2, kolejka 10, timeout joba 60 s.
 * Kody: kolejka pełna → 429, timeout generowania → 504, błąd Chromium → 500.
 */

const PDF_CONCURRENCY = 2;
const PDF_MAX_QUEUE = 10;
const PDF_JOB_TIMEOUT_MS = 60_000;

interface PdfJob {
    html: string;
    resolve: (buf: Buffer) => void;
    reject: (err: unknown) => void;
    timer: NodeJS.Timeout;
    settled: boolean;
}

const queue: PdfJob[] = [];
let active = 0;

export const pdfMetrics = {
    activeJobs: 0,
    queueDepth: 0,
    done: 0,
    failed429: 0,
    failed504: 0,
    failed500: 0,
    totalMs: 0
};

export function getPdfMetrics() {
    return { ...pdfMetrics, concurrency: PDF_CONCURRENCY, maxQueue: PDF_MAX_QUEUE };
}

export class PdfError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

function pump() {
    while (active < PDF_CONCURRENCY && queue.length > 0) {
        const job = queue.shift() as PdfJob;
        active++;
        pdfMetrics.activeJobs = active;
        pdfMetrics.queueDepth = queue.length;
        void runJob(job).finally(() => {
            active--;
            pdfMetrics.activeJobs = active;
            pdfMetrics.queueDepth = queue.length;
            pump();
        });
    }
}

async function runJob(job: PdfJob) {
    const start = Date.now();
    try {
        const buf = await renderPdf(job.html);
        clearTimeout(job.timer);
        if (job.settled) return;
        job.settled = true;
        pdfMetrics.done++;
        pdfMetrics.totalMs += Date.now() - start;
        job.resolve(buf);
    } catch (e) {
        clearTimeout(job.timer);
        if (job.settled) return;
        job.settled = true;
        pdfMetrics.failed500++;
        const message = e instanceof Error ? e.message : String(e);
        logger.error('Pdf', 'Błąd generowania PDF (Chromium)', message);
        job.reject(new PdfError(500, 'PDF_FAILED', 'Nie udało się wygenerować PDF'));
    }
}

async function renderPdf(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            // ponytail: --no-sandbox niezbędny w kontenerze Docker (proces jako root;
            // slim obrazy nie maja user namespaces, ktorych Chromium uzywa dla sandboxa).
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ]
    });

    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '10mm',
                right: '15mm',
                bottom: '10mm',
                left: '15mm'
            }
        });

        return Buffer.from(pdfBuffer);
    } finally {
        await browser.close();
    }
}

export function generatePDF(html: string): Promise<Buffer> {
    if (active >= PDF_CONCURRENCY && queue.length >= PDF_MAX_QUEUE) {
        pdfMetrics.failed429++;
        return Promise.reject(
            new PdfError(429, 'PDF_BUSY', 'Generowanie PDF zajęte — spróbuj ponownie za chwilę')
        );
    }
    return new Promise<Buffer>((resolve, reject) => {
        const job: PdfJob = { html, resolve, reject, timer: undefined as never, settled: false };
        const timer = setTimeout(() => {
            const idx = queue.indexOf(job);
            if (idx >= 0) queue.splice(idx, 1);
            pdfMetrics.queueDepth = queue.length;
            if (job.settled) return;
            job.settled = true;
            pdfMetrics.failed504++;
            reject(new PdfError(504, 'PDF_TIMEOUT', 'Generowanie PDF przekroczyło limit czasu'));
        }, PDF_JOB_TIMEOUT_MS);
        // Timeout nie trzyma procesu przy życiu.
        timer.unref?.();
        job.timer = timer;
        queue.push(job);
        pdfMetrics.queueDepth = queue.length;
        pump();
    });
}

/** Mapuje błąd PDF na odpowiedź HTTP. Zwraca true gdy obsłużony. */
export function mapPdfError(
    res: { status(code: number): { json(body: unknown): unknown } },
    e: unknown,
    context: string
): boolean {
    const status = (e as { status?: number }).status;
    if (status === 429 || status === 504 || status === 500) {
        const message = e instanceof Error ? e.message : 'Błąd generowania PDF';
        logger.error('Pdf', `Błąd eksportu PDF (${context})`, message);
        res.status(status).json({
            error: message,
            code: (e as { code?: string }).code || 'PDF_FAILED'
        });
        return true;
    }
    return false;
}
