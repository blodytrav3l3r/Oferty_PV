import express from 'express';
import request from 'supertest';
import { errorHandler } from '../src/middleware/errorHandler';
import { requestLogger } from '../src/middleware/requestLogger';
import { logger } from '../src/utils/logger';

/**
 * Mapowanie PayloadTooLargeError (przekroczony limit express.json)
 * na 413 z jawnym komunikatem — zamiast mylącego generycznego 500.
 */
describe('errorHandler', () => {
    function testApp(err: unknown): express.Application {
        const app = express();
        app.get(
            '/boom',
            (_req: unknown, _res: unknown, next: (e: unknown) => void) => {
                next(err);
            },
            errorHandler
        );
        app.use(errorHandler);
        return app;
    }

    it('PayloadTooLargeError (status 413) daje 413 z jawnym komunikatem', async () => {
        const err = Object.assign(new Error('request entity too large'), {
            status: 413,
            type: 'entity.too.large'
        });
        const res = await request(testApp(err)).get('/boom');
        expect(res.statusCode).toBe(413);
        expect(res.body.error).toContain('Zbyt duży payload');
    });

    it('zwykły błąd nadal daje generyczne 500', async () => {
        const res = await request(testApp(new Error('coś padło'))).get('/boom');
        expect(res.statusCode).toBe(500);
        expect(res.body.error).toBe('Wewnętrzny błąd serwera');
    });

    it('P1.2: 500 zawiera requestId zgodny z nagłówkiem i logiem (bez stacka w odpowiedzi)', async () => {
        const logged: string[] = [];
        const spy = jest.spyOn(logger, 'error').mockImplementation((_tag: string, msg: string) => {
            logged.push(msg);
        });
        try {
            const app = express();
            app.use(requestLogger);
            app.get('/boom', (_req, _res, next) => {
                next(new Error('boom-tajny-stack'));
            });
            app.use(errorHandler);
            const res = await request(app).get('/boom');
            expect(res.statusCode).toBe(500);
            // requestId w body i w nagłówku muszą być zgodne.
            expect(typeof res.body.requestId).toBe('string');
            expect(res.body.requestId).toHaveLength(8);
            expect(res.headers['x-request-id']).toBe(res.body.requestId);
            // Ten sam requestId w logu UnhandledError.
            expect(logged.some((m) => m.includes(`[${res.body.requestId}]`))).toBe(true);
            // Stack trace nigdy w odpowiedzi.
            expect(JSON.stringify(res.body)).not.toContain('boom-tajny-stack');
            expect(JSON.stringify(res.body)).not.toContain('at ');
        } finally {
            spy.mockRestore();
        }
    });

    it('P1.2: 413 też zawiera requestId', async () => {
        const err = Object.assign(new Error('request entity too large'), {
            status: 413,
            type: 'entity.too.large'
        });
        const res = await request(testApp(err)).get('/boom').set('X-Request-Id', 'abc12345');
        expect(res.statusCode).toBe(413);
        expect(res.body.requestId).toBe('abc12345');
    });
});
