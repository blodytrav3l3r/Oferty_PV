import request from 'supertest';
import express from 'express';
import { TransferError } from '../../src/services/ml/transfer/transferErrors';

const buildExportPreview = jest.fn();
const buildModelPackage = jest.fn();
const runDryRun = jest.fn();
const importPackage = jest.fn();
const listTransferHistory = jest.fn();
const getTransferDetail = jest.fn();
const logAudit = jest.fn();

jest.mock('../../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: 'admin-id', role: 'admin', subUsers: [] };
        next();
    },
    requireAdmin: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../../src/middleware/aiMlGuard', () => ({
    requireAiMlEnabled: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../../src/middleware/rateLimiters', () => ({
    READ_LIMITER: (_req: any, _res: any, next: any) => next(),
    WRITE_LIMITER: (_req: any, _res: any, next: any) => next(),
    EXPORT_LIMITER: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../../src/services/ml/transfer/exportModel', () => ({
    buildExportPreview: (...args: unknown[]) => buildExportPreview(...args),
    buildModelPackage: (...args: unknown[]) => buildModelPackage(...args)
}));

jest.mock('../../src/services/ml/transfer/dryRun', () => ({
    runDryRun: (...args: unknown[]) => runDryRun(...args)
}));

jest.mock('../../src/services/ml/transfer/importModel', () => ({
    importPackage: (...args: unknown[]) => importPackage(...args)
}));

jest.mock('../../src/services/ml/transfer/transferHistory', () => ({
    listTransferHistory: (...args: unknown[]) => listTransferHistory(...args),
    getTransferDetail: (...args: unknown[]) => getTransferDetail(...args)
}));

jest.mock('../../src/services/auditService', () => ({
    logAudit: (...args: unknown[]) => logAudit(...args)
}));

jest.mock('../../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

import aiTransferRouter from '../../src/routes/aiTransfer';
import { logger } from '../../src/utils/logger';

const app = express();
app.use(express.json());
app.use('/api/telemetry', aiTransferRouter);

beforeEach(() => {
    jest.clearAllMocks();
    logAudit.mockResolvedValue(undefined);
});

describe('GET /ai/transfer/preview-export', () => {
    it('400 bez modelId', async () => {
        const res = await request(app).get('/api/telemetry/ai/transfer/preview-export');
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'Brak modelId', code: 'MODEL_NOT_FOUND' });
        expect(buildExportPreview).not.toHaveBeenCalled();
    });

    it('przekazuje zakres eksportu z query', async () => {
        buildExportPreview.mockResolvedValueOnce({ model: { version: 'v1' } });

        const res = await request(app).get(
            '/api/telemetry/ai/transfer/preview-export?modelId=m1&dataset=full&knowledge=1&telemetry=true'
        );

        expect(res.status).toBe(200);
        expect(buildExportPreview).toHaveBeenCalledWith('m1', {
            dataset: 'full',
            knowledge: true,
            telemetry: true
        });
    });

    it('mapuje TransferError MODEL_NOT_FOUND na 404', async () => {
        buildExportPreview.mockRejectedValueOnce(
            new TransferError('MODEL_NOT_FOUND', 'brak modelu')
        );

        const res = await request(app).get(
            '/api/telemetry/ai/transfer/preview-export?modelId=missing'
        );

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'brak modelu', code: 'MODEL_NOT_FOUND' });
    });

    it('błąd nieznany: 500 bez wycieku treści wyjątku', async () => {
        buildExportPreview.mockRejectedValueOnce(new Error('secret stack'));

        const res = await request(app).get('/api/telemetry/ai/transfer/preview-export?modelId=m1');

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Wewnetrzny blad serwera' });
        expect(logger.error).toHaveBeenCalledWith(
            'AiTransferRoute',
            'Blad wewnetrzny: secret stack'
        );
    });
});

describe('POST /ai/transfer/export', () => {
    it('400 INVALID_BODY dla złego body', async () => {
        const res = await request(app).post('/api/telemetry/ai/transfer/export').send({});

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_BODY');
    });

    it('zwraca plik z nagłówkami i zapisuje audyt', async () => {
        const buffer = Buffer.from('sokml');
        buildModelPackage.mockResolvedValueOnce({
            transferId: 'tr-1',
            packageFingerprint: 'fp',
            buffer,
            manifest: { model: { version: '1.2.3' }, sourceSokVersion: '1.56.18' }
        });

        const res = await request(app)
            .post('/api/telemetry/ai/transfer/export')
            .send({ modelId: 'm1', dataset: 'fingerprint-only' });

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('application/octet-stream');
        expect(res.headers['content-disposition']).toBe(
            'attachment; filename="sok-ai-ml-1.2.3.sokml"'
        );
        expect(buildModelPackage).toHaveBeenCalledWith('m1', 'admin-id', {
            dataset: 'fingerprint-only',
            knowledge: undefined,
            telemetry: undefined
        });
        expect(logAudit).toHaveBeenCalledWith(
            'ai_transfer',
            'tr-1',
            'admin-id',
            'TRANSFER_EXPORT_COMPLETED',
            expect.objectContaining({ result: 'MODEL_ONLY' })
        );
    });

    it('mapuje MODEL_DUPLICATE na 409', async () => {
        buildModelPackage.mockRejectedValueOnce(new TransferError('MODEL_DUPLICATE', 'duplikat'));

        const res = await request(app)
            .post('/api/telemetry/ai/transfer/export')
            .send({ modelId: 'm1' });

        expect(res.status).toBe(409);
        expect(res.body.code).toBe('MODEL_DUPLICATE');
    });
});

describe('POST /ai/transfer/dry-run', () => {
    it('400 ARCHIVE_EMPTY bez pakietu', async () => {
        const res = await request(app)
            .post('/api/telemetry/ai/transfer/dry-run')
            .set('Content-Type', 'application/octet-stream')
            .send(Buffer.alloc(0));

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('ARCHIVE_EMPTY');
    });

    it('zwraca raport i podgląd z dry-runu', async () => {
        runDryRun.mockResolvedValueOnce({
            record: {
                id: 'dry-1',
                report: { status: 'PASS', checks: [{ name: 'zip', ok: true }] }
            },
            preview: { model: 'm1' }
        });

        const res = await request(app)
            .post('/api/telemetry/ai/transfer/dry-run')
            .set('Content-Type', 'application/octet-stream')
            .send(Buffer.from('pkg'));

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            dryRunId: 'dry-1',
            status: 'PASS',
            checks: [{ name: 'zip', ok: true }],
            preview: { model: 'm1' },
            result: 'CANDIDATE'
        });
        expect(runDryRun).toHaveBeenCalledWith(expect.any(Buffer), 'admin-id');
    });

    it.each([
        ['DRY_RUN_USER_MISMATCH', 403],
        ['UPLOAD_TOO_LARGE', 413],
        ['ARTIFACT_TOO_LARGE', 413],
        ['UNPACKED_TOO_LARGE', 413],
        ['DRY_RUN_PACKAGE_MISMATCH', 409],
        ['INVALID_ARCHIVE', 400]
    ])('mapuje %s na %i', async (code, status) => {
        runDryRun.mockRejectedValueOnce(new TransferError(code as never, 'err'));

        const res = await request(app)
            .post('/api/telemetry/ai/transfer/dry-run')
            .set('Content-Type', 'application/octet-stream')
            .send(Buffer.from('pkg'));

        expect(res.status).toBe(status);
        expect(res.body.code).toBe(code);
    });
});

describe('POST /ai/transfer/import', () => {
    it('400 bez pakietu', async () => {
        const res = await request(app)
            .post('/api/telemetry/ai/transfer/import?dryRunId=dry-1')
            .set('Content-Type', 'application/octet-stream')
            .send(Buffer.alloc(0));

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('ARCHIVE_EMPTY');
    });

    it('400 bez dryRunId', async () => {
        const res = await request(app)
            .post('/api/telemetry/ai/transfer/import')
            .set('Content-Type', 'application/octet-stream')
            .send(Buffer.from('pkg'));

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('DRY_RUN_NOT_FOUND');
        expect(importPackage).not.toHaveBeenCalled();
    });

    it('importuje pakiet z dryRunId', async () => {
        importPackage.mockResolvedValueOnce({ status: 'CANDIDATE', modelVersion: '1.2.3' });

        const res = await request(app)
            .post('/api/telemetry/ai/transfer/import?dryRunId=dry-1')
            .set('Content-Type', 'application/octet-stream')
            .send(Buffer.from('pkg'));

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: 'CANDIDATE', modelVersion: '1.2.3' });
        expect(importPackage).toHaveBeenCalledWith(expect.any(Buffer), 'dry-1', 'admin-id');
    });
});

describe('historia transferów', () => {
    it('GET /ai/transfer/history zwraca listę', async () => {
        listTransferHistory.mockResolvedValueOnce([{ id: 'tr-1' }]);

        const res = await request(app).get('/api/telemetry/ai/transfer/history');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ data: [{ id: 'tr-1' }] });
    });

    it('GET /ai/transfer/:id zwraca 404 dla nieistniejącego', async () => {
        getTransferDetail.mockResolvedValueOnce(null);

        const res = await request(app).get('/api/telemetry/ai/transfer/tr-x');

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'Transfer nie istnieje' });
    });

    it('GET /ai/transfer/:id zwraca szczegóły', async () => {
        getTransferDetail.mockResolvedValueOnce({ id: 'tr-1', modelVersion: '1.2.3' });

        const res = await request(app).get('/api/telemetry/ai/transfer/tr-1');

        expect(res.status).toBe(200);
        expect(res.body.id).toBe('tr-1');
    });

    it('błąd historii: 500', async () => {
        listTransferHistory.mockRejectedValueOnce(new Error('db down'));

        const res = await request(app).get('/api/telemetry/ai/transfer/history');

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Wewnetrzny blad serwera' });
    });
});
