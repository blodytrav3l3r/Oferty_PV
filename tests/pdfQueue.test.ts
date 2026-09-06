/**
 * P0-G: kolejka PDF — concurrency 2, overflow 429, metryki. Chromium mockowane.
 */
const deferreds: Array<{ resolve: (v: unknown) => void }> = [];
let livePages = 0;
let maxLivePages = 0;

jest.mock('puppeteer', () => ({
    __esModule: true,
    default: {
        launch: jest.fn(async () => ({
            newPage: jest.fn(async () => {
                livePages++;
                maxLivePages = Math.max(maxLivePages, livePages);
                return {
                    setContent: jest.fn(async () => {}),
                    pdf: jest.fn(
                        () =>
                            new Promise((resolve) => {
                                deferreds.push({ resolve });
                            })
                    )
                };
            }),
            close: jest.fn(async () => {
                livePages--;
            })
        }))
    }
}));

import { generatePDF, getPdfMetrics, mapPdfError } from '../src/services/pdf/pdfEngine';

function flush() {
    return new Promise((r) => setTimeout(r, 10));
}

beforeEach(() => {
    deferreds.length = 0;
    livePages = 0;
    maxLivePages = 0;
});

describe('P0-G kolejka PDF', () => {
    test('max 2 współbieżne rendery, reszta czeka w kolejce', async () => {
        const jobs = [
            generatePDF('<h1>a</h1>'),
            generatePDF('<h1>b</h1>'),
            generatePDF('<h1>c</h1>')
        ];
        await flush();
        await flush();
        expect(maxLivePages).toBe(2);
        expect(getPdfMetrics().queueDepth).toBe(1);
        // Zwolnij wszystko.
        while (deferreds.length > 0) {
            const d = deferreds.splice(0, deferreds.length);
            for (const x of d) x.resolve(Buffer.from('pdf'));
            await flush();
        }
        const out = await Promise.all(jobs);
        expect(out).toHaveLength(3);
        expect(getPdfMetrics().done).toBeGreaterThanOrEqual(3);
    });

    test('przepełnienie kolejki (2 aktywne + 10) → 429 PDF_BUSY', async () => {
        const jobs: Array<Promise<Buffer>> = [];
        for (let i = 0; i < 12; i++) jobs.push(generatePDF(`<h1>${i}</h1>`));
        await flush();
        await flush();
        await expect(generatePDF('<h1>overflow</h1>')).rejects.toMatchObject({
            status: 429,
            code: 'PDF_BUSY'
        });
        expect(getPdfMetrics().failed429).toBeGreaterThanOrEqual(1);
        while (deferreds.length > 0) {
            const d = deferreds.splice(0, deferreds.length);
            for (const x of d) x.resolve(Buffer.from('pdf'));
            await flush();
        }
        await Promise.all(jobs);
    });

    test('mapPdfError: 429/504/500 → status, reszta false', () => {
        const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const err: any = new Error('zajęte');
        err.status = 429;
        err.code = 'PDF_BUSY';
        expect(mapPdfError(res, err, 'test')).toBe(true);
        expect(res.status).toHaveBeenCalledWith(429);
        expect(mapPdfError({ status: () => ({ json: () => {} }) }, new Error('x'), 't')).toBe(
            false
        );
    });
});
