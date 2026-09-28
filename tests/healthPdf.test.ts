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

// Domyslnie: brak sesji (anon). Poszczegolne testy nadpisuja implementacje.
jest.mock('../src/middleware/auth', () => ({
    requireAuth: jest.fn((_req: any, res: any, _next: any) => {
        res.status(401).json({ error: 'Nieautoryzowany — zaloguj się' });
    }),
    requireAdmin: jest.fn((_req: any, res: any, _next: any) => {
        res.status(403).json({ error: 'Brak uprawnień — wymagany administrator' });
    })
}));

/* eslint-disable @typescript-eslint/no-require-imports -- mock (jest.fn) vs implementacja (requireActual) */
const pdfEngine = require('../src/services/pdf/pdfEngine');
const pdfEngineActual = jest.requireActual<typeof import('../src/services/pdf/pdfEngine')>(
    '../src/services/pdf/pdfEngine'
);
const auth = require('../src/middleware/auth');
/* eslint-enable @typescript-eslint/no-require-imports */

const LEAK_KEYS = [
    'user',
    'home',
    'cacheDir',
    'executableName',
    'shmMb',
    'found',
    'stack',
    'error'
];

function expectNoLeak(body: Record<string, unknown>): void {
    for (const k of LEAK_KEYS) expect(body).not.toHaveProperty(k);
    expect(Object.keys(body).sort()).toEqual(['status']);
}

describe('Diagnostyka PDF (GET /health/pdf)', () => {
    let app: express.Application;

    beforeEach(() => {
        jest.clearAllMocks();
        // Po clearAllMocks mocki auth wracaja do domyslnej (anon 401 / 403).
        auth.requireAuth.mockImplementation((_req: any, res: any) => {
            res.status(401).json({ error: 'Nieautoryzowany — zaloguj się' });
        });
        auth.requireAdmin.mockImplementation((_req: any, res: any) => {
            res.status(403).json({ error: 'Brak uprawnień — wymagany administrator' });
        });
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

    describe('GET /health/pdf (publiczny, minimalny — I-011)', () => {
        it('200 z wylacznie {status} gdy Chromium znaleziony', async () => {
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
            expectNoLeak(res.body);
            expect(res.body).toEqual({ status: 'ok' });
            expect(pdfEngine.generatePDF).not.toHaveBeenCalled();
        });

        it('503 z wylacznie {status} gdy Chromium niedostepny', async () => {
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
            expectNoLeak(res.body);
            expect(res.body).toEqual({ status: 'degraded' });
            expect(pdfEngine.generatePDF).not.toHaveBeenCalled();
        });

        it('anon ?smoke=1 nie uruchamia Chromium (401)', async () => {
            const res = await request(app).get('/health/pdf?smoke=1');
            expect(res.statusCode).toBe(401);
            expect(pdfEngine.generatePDF).not.toHaveBeenCalled();
        });

        it('non-admin ?smoke=1 dostaje 403 bez renderu', async () => {
            auth.requireAuth.mockImplementation((_req: any, _res: any, next: any) => next());
            const res = await request(app).get('/health/pdf?smoke=1');
            expect(res.statusCode).toBe(403);
            expect(pdfEngine.generatePDF).not.toHaveBeenCalled();
        });

        it('admin ?smoke=1 renderuje i zwraca minimalny kontrakt', async () => {
            auth.requireAuth.mockImplementation((_req: any, _res: any, next: any) => next());
            auth.requireAdmin.mockImplementation((_req: any, _res: any, next: any) => next());
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
            expect(res.body.status).toBe('ok');
            expect(res.body.smoke).toMatchObject({ ok: true });
            expect(res.body.smoke.bytes).toBeGreaterThan(0);
            for (const k of LEAK_KEYS) expect(res.body).not.toHaveProperty(k);
            expect(res.body.smoke).not.toHaveProperty('error');
        });

        it('admin ?smoke=1 blad Chromium to generyczne 503 bez szczegolow', async () => {
            auth.requireAuth.mockImplementation((_req: any, _res: any, next: any) => next());
            auth.requireAdmin.mockImplementation((_req: any, _res: any, next: any) => next());
            pdfEngine.getChromiumStatus.mockReturnValue({
                status: 'degraded',
                found: false,
                executableName: null,
                cacheDir: '/home/node/.cache/puppeteer',
                user: 'node',
                home: '/home/node',
                shmMb: 64
            });
            pdfEngine.generatePDF.mockRejectedValue(
                new Error('Could not find Chrome at /secret/path/chrome')
            );
            const res = await request(app).get('/health/pdf?smoke=1');
            expect(res.statusCode).toBe(503);
            expect(res.body).toEqual({ status: 'degraded', smoke: { ok: false } });
            for (const k of LEAK_KEYS) expect(res.body).not.toHaveProperty(k);
        });
    });
});
