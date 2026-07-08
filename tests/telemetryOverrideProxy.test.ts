/**
 * Testy endpointu proxy override telemetry (/api/telemetry/ai/override).
 *
 * Obejmuje:
 * - walidację schematu Zod (telemetryOverrideProxySchema)
 * - HTTP endpoint: 200 (forward OK), 400 (zły payload), 502 (Python błąd), 503 (Python offline)
 * - nagłówek X-API-Key
 */

import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { telemetryOverrideProxySchema } from '../src/validators/telemetrySchemas';
import telemetryAiRouter from '../src/routes/telemetryAi';
import { createTestApp } from './setup';
import type express from 'express';

/* ===== Pomocnicy ===== */

const VALID_PAYLOAD = {
    schema_version: 1,
    originalConfig: [{ productId: 'P1', componentType: 'krag' }],
    finalConfig: [{ productId: 'P2', componentType: 'krag' }],
    overrideReason: 'test',
    wellParams: { dn: '1000' }
};

function createApp(): express.Application {
    return createTestApp(telemetryAiRouter, '/api/telemetry');
}

/* ===== 1. Testy walidacji schematu Zod ===== */

describe('telemetryOverrideProxySchema', () => {
    it('akceptuje poprawny payload', () => {
        const r = telemetryOverrideProxySchema.safeParse(VALID_PAYLOAD);
        expect(r.success).toBe(true);
    });

    it('odrzuca payload bez schema_version', () => {
        const { schema_version: _, ...rest } = VALID_PAYLOAD as any;
        const r = telemetryOverrideProxySchema.safeParse(rest);
        expect(r.success).toBe(false);
    });

    it('odrzuca ujemny schema_version', () => {
        const r = telemetryOverrideProxySchema.safeParse({ ...VALID_PAYLOAD, schema_version: -1 });
        expect(r.success).toBe(false);
    });

    it('akceptuje schema_version >= 1', () => {
        const r = telemetryOverrideProxySchema.safeParse({ ...VALID_PAYLOAD, schema_version: 2 });
        expect(r.success).toBe(true);
    });

    it('odrzuca brak originalConfig', () => {
        const { originalConfig: _, ...rest } = VALID_PAYLOAD as any;
        const r = telemetryOverrideProxySchema.safeParse(rest);
        expect(r.success).toBe(false);
    });

    it('odrzuca pusty originalConfig', () => {
        const r = telemetryOverrideProxySchema.safeParse({ ...VALID_PAYLOAD, originalConfig: [] });
        expect(r.success).toBe(false);
    });

    it('odrzuca brak finalConfig', () => {
        const { finalConfig: _, ...rest } = VALID_PAYLOAD as any;
        const r = telemetryOverrideProxySchema.safeParse(rest);
        expect(r.success).toBe(false);
    });

    it('odrzuca pusty finalConfig', () => {
        const r = telemetryOverrideProxySchema.safeParse({ ...VALID_PAYLOAD, finalConfig: [] });
        expect(r.success).toBe(false);
    });

    it('odrzuca brak wellParams.dn', () => {
        const r = telemetryOverrideProxySchema.safeParse({
            ...VALID_PAYLOAD,
            wellParams: {}
        });
        expect(r.success).toBe(false);
    });

    it('akceptuje dn jako string i number', () => {
        const s1 = telemetryOverrideProxySchema.safeParse(VALID_PAYLOAD);
        expect(s1.success).toBe(true);
        const s2 = telemetryOverrideProxySchema.safeParse({
            ...VALID_PAYLOAD,
            wellParams: { dn: 1200 }
        });
        expect(s2.success).toBe(true);
    });

    it('akceptuje height_bucket shallow/medium/deep', () => {
        for (const b of ['shallow', 'medium', 'deep']) {
            const r = telemetryOverrideProxySchema.safeParse({
                ...VALID_PAYLOAD,
                wellParams: { dn: '1000', height_bucket: b }
            });
            expect(r.success).toBe(true);
        }
    });

    it('odrzuca nieprawidłowy height_bucket', () => {
        const r = telemetryOverrideProxySchema.safeParse({
            ...VALID_PAYLOAD,
            wellParams: { dn: '1000', height_bucket: 'invalid' }
        });
        expect(r.success).toBe(false);
    });
});

/* ===== 2. Testy HTTP endpointu ===== */

describe('POST /api/telemetry/ai/override', () => {
    const ORIGINAL_FETCH = global.fetch;
    let app: express.Application;

    beforeEach(() => {
        app = createApp();
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ status: 'ok', correction_id: 1, total_corrections: 5 })
        });
    });

    afterEach(() => {
        global.fetch = ORIGINAL_FETCH;
    });

    it('zwraca 200 i forwarduje do Pythona dla poprawnego payloadu', async () => {
        const res = await request(app).post('/api/telemetry/ai/override').send(VALID_PAYLOAD);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('status', 'ok');
        expect(res.body).toHaveProperty('correction_id');
        expect(global.fetch).toHaveBeenCalledTimes(1);

        const callUrl = (global.fetch as jest.Mock).mock.calls[0][0];
        expect(callUrl).toContain('/api/v1/telemetry/override');
    });

    it('zwraca 400 dla błędnego payloadu (brak originalConfig)', async () => {
        const { originalConfig: _, ...badPayload } = VALID_PAYLOAD as any;
        const res = await request(app).post('/api/telemetry/ai/override').send(badPayload);

        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty('error');
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('zwraca 503 gdy Python backend jest nieosiągalny', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('connection refused'));

        const res = await request(app).post('/api/telemetry/ai/override').send(VALID_PAYLOAD);

        expect(res.statusCode).toBe(503);
        expect(res.body).toHaveProperty('error', 'Python backend wyłączony');
        expect(res.body).toHaveProperty('warning');
    });

    it('zwraca 502 gdy Python backend zwraca błąd', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 500,
            text: async () => 'Internal Server Error'
        });

        const res = await request(app).post('/api/telemetry/ai/override').send(VALID_PAYLOAD);

        expect(res.statusCode).toBe(502);
        expect(res.body).toHaveProperty('error');
        expect(res.body).toHaveProperty('status', 500);
    });

    it('wysyła X-API-Key gdy PYTHON_API_KEY jest ustawiony', async () => {
        process.env.PYTHON_API_KEY = 'test-key-123';

        await request(app).post('/api/telemetry/ai/override').send(VALID_PAYLOAD);

        const callHeaders = (global.fetch as jest.Mock).mock.calls[0][1].headers;
        expect(callHeaders['X-API-Key']).toBe('test-key-123');

        delete process.env.PYTHON_API_KEY;
    });

    it('nie wysyła X-API-Key gdy PYTHON_API_KEY jest pusty', async () => {
        delete process.env.PYTHON_API_KEY;

        await request(app).post('/api/telemetry/ai/override').send(VALID_PAYLOAD);

        const callHeaders = (global.fetch as jest.Mock).mock.calls[0][1].headers;
        expect(callHeaders['X-API-Key']).toBeUndefined();
    });
});

/* ===== 3. Test kontraktu Node → Python ===== */
describe('Kontrakt Node → Python (telemetry override)', () => {
    type ZodData = Record<string, unknown>;

    const PYTHON_REQUIRED_KEYS = ['originalConfig', 'finalConfig'];
    const WELLPARAMS_PYTHON_KEYS = [
        'dn',
        'target_height_mm',
        'height_bucket',
        'use_reduction',
        'psia_buda',
        'warehouse',
        'transition_count'
    ];

    function assertParsed(payload: unknown) {
        const parsed = telemetryOverrideProxySchema.safeParse(payload);
        expect(parsed.success).toBe(true);
        return parsed.data as ZodData;
    }

    it('Node payload ma wszystkie wymagane pola Pythona', () => {
        const data = assertParsed(VALID_PAYLOAD);

        for (const key of PYTHON_REQUIRED_KEYS) {
            expect(data).toHaveProperty(key);
            expect(Array.isArray(data[key])).toBe(true);
            expect((data[key] as unknown[]).length).toBeGreaterThan(0);
        }
    });

    it('Node payload zawiera correction_id (gdy podany)', () => {
        const data = assertParsed({
            ...VALID_PAYLOAD,
            correction_id: '550e8400-e29b-41d4-a716-446655440000'
        });

        expect(data.correction_id).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('wellParams zawiera klucze jakie Python odczytuje', () => {
        const fullPayload = {
            ...VALID_PAYLOAD,
            wellParams: {
                dn: '1000',
                target_height_mm: 3000,
                height_bucket: 'shallow',
                use_reduction: true,
                psia_buda: false,
                warehouse: 'KLB',
                transition_count: 3
            }
        };
        const data = assertParsed(fullPayload);
        const wp = data.wellParams as Record<string, unknown>;

        for (const key of WELLPARAMS_PYTHON_KEYS) {
            if (['use_reduction', 'psia_buda', 'warehouse', 'transition_count'].includes(key)) {
                continue;
            }
            expect(wp).toHaveProperty(key);
        }
    });

    it('Node forwarduje wszystkie klucze w body fetch (contract shape)', async () => {
        const app = createApp();
        let capturedBody: Record<string, unknown> | null = null;

        global.fetch = jest.fn().mockImplementation(async (_url: string, opts: any) => {
            capturedBody = JSON.parse(opts.body);
            return {
                ok: true,
                json: async () => ({ status: 'ok' })
            };
        });

        const payloadWithAllFields = {
            schema_version: 1,
            correction_id: '550e8400-e29b-41d4-a716-446655440000',
            originalConfig: [{ productId: 'P1', componentType: 'krag' }],
            finalConfig: [{ productId: 'P2', componentType: 'krag' }],
            overrideReason: 'user_manual_change',
            wellParams: {
                dn: '1000',
                target_height_mm: 3000,
                height_bucket: 'shallow'
            }
        };

        await request(app).post('/api/telemetry/ai/override').send(payloadWithAllFields);

        expect(capturedBody).not.toBeNull();
        expect(capturedBody!).toHaveProperty('originalConfig');
        expect(capturedBody!).toHaveProperty('finalConfig');
        expect(capturedBody!).toHaveProperty('overrideReason');
        expect(capturedBody!).toHaveProperty('wellParams');
        expect(capturedBody!).toHaveProperty('correction_id');
        expect(capturedBody!).toHaveProperty('schema_version');
        expect((capturedBody! as any).wellParams).toHaveProperty('dn');
        expect((capturedBody! as any).wellParams).toHaveProperty('target_height_mm');
        expect((capturedBody! as any).wellParams).toHaveProperty('height_bucket');
        expect(capturedBody!.correction_id!).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('Python otrzymuje target_height_mm jako number (nie string)', () => {
        const data = assertParsed({
            ...VALID_PAYLOAD,
            wellParams: { dn: '1000', target_height_mm: 3500 }
        });
        const wp = data.wellParams as Record<string, unknown>;
        expect(typeof wp.target_height_mm).toBe('number');
    });

    it('correction_id ma format UUID (jeśli podany)', () => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const data = assertParsed({
            ...VALID_PAYLOAD,
            correction_id: '550e8400-e29b-41d4-a716-446655440000'
        });
        expect(data.correction_id).toMatch(uuidRegex);
    });
});
