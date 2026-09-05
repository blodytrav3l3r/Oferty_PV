import express from 'express';
import request from 'supertest';
import { errorHandler } from '../src/middleware/errorHandler';

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
});
