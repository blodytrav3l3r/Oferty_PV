import request from 'supertest';
import express from 'express';
import healthPdfRouter from '../src/routes/healthPdf';

jest.mock('../src/services/pdf/pdfEngine', () => {
    const actual = jest.requireActual('../src/services/pdf/pdfEngine');
    return {
        ...actual,
        getChromiumStatus: jest.fn(),
        generatePDF: jest.fn()
    };
});

jest.mock('../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }
}));

/* eslint-disable @typescript-eslint/no-require-imports -- mock (jest.fn) vs implementacja (requireActual) */
const pdfEngine = require('../src/services/pdf/pdfEngine');
const pdfEngineActual = jest.requireActual<typeof import('../src/services/pdf/pdfEngine')>(
    '../src/services/pdf/pdfEngine'
);
/* eslint-enable @typescript-eslint/no-require-imports */

describe('Diagnostyka PDF (GET /health/pdf)', () => {
    let app: express.Application;

    beforeEach(() => {
        jest.clearAllMocks();
        app = express();
        app.use('/health/pdf', healthPdfRouter);
    });

    describe('getChromiumStatus (jednostkowo, bez mocka routera)', () => {
        it('zwraca kontrakt statusu bez pelnej sciezki binarki', () => {
            const status = pdfEngineActual.getChromiumStatus();
            expect(['ok', 'degraded']).toContain(status.status);
            expect(typeof status.found).toBe('boolean');
            expect(status.cacheDir).toContain('puppeteer');
            // W odpowiedzi HTTP nie wycieka pelna sciezka — sam basename.
            if (status.executableName !== null) {
                expect(status.executableName).not.toContain('/');
                expect(status.executableName).not.toContain('\\');
            }
            expect(status.status).toBe(status.found ? 'ok' : 'degraded');
        });
    });

    describe('GET /health/pdf', () => {
        it('200 gdy Chromium znaleziony', async () => {
            pdfEngine.getChromiumStatus.mockReturnValue({
                status: 'ok',
                found: true,
                executableName: 'chrome',
                cacheDir: '/app/.cache/puppeteer',
                user: 'node',
                home: '/home/node',
                shmMb: 512
            });
            const res = await request(app).get('/health/pdf');
            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('status', 'ok');
            expect(res.body).toHaveProperty('found', true);
            expect(pdfEngine.generatePDF).not.toHaveBeenCalled();
        });

        it('503 gdy Chromium niedostepny (klasyczny blad Docker USER node)', async () => {
            pdfEngine.getChromiumStatus.mockReturnValue({
                status: 'degraded',
                found: false,
                executableName: null,
                cacheDir: '/home/node/.cache/puppeteer',
                user: 'node',
                home: '/home/node',
                shmMb: 64
            });
            const res = await request(app).get('/health/pdf');
            expect(res.statusCode).toBe(503);
            expect(res.body).toHaveProperty('status', 'degraded');
        });

        it('?smoke=1 renderuje strone testowa end-to-end', async () => {
            pdfEngine.getChromiumStatus.mockReturnValue({
                status: 'ok',
                found: true,
                executableName: 'chrome',
                cacheDir: '/app/.cache/puppeteer',
                user: 'node',
                home: '/home/node',
                shmMb: 512
            });
            pdfEngine.generatePDF.mockResolvedValue(Buffer.from('%PDF-smoke'));
            const res = await request(app).get('/health/pdf?smoke=1');
            expect(res.statusCode).toBe(200);
            expect(res.body.smoke).toMatchObject({ ok: true });
            expect(res.body.smoke.bytes).toBeGreaterThan(0);
        });

        it('?smoke=1 zwraca 503 z powodem gdy render pada', async () => {
            pdfEngine.getChromiumStatus.mockReturnValue({
                status: 'degraded',
                found: false,
                executableName: null,
                cacheDir: '/home/node/.cache/puppeteer',
                user: 'node',
                home: '/home/node',
                shmMb: 64
            });
            pdfEngine.generatePDF.mockRejectedValue(new Error('Could not find Chrome'));
            const res = await request(app).get('/health/pdf?smoke=1');
            expect(res.statusCode).toBe(503);
            expect(res.body.smoke).toMatchObject({ ok: false });
        });
    });
});
