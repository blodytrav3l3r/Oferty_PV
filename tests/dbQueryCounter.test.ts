// Testy licznika zapytań DB per request (Faza 5.2)
import express from 'express';
import request from 'supertest';
import { logger } from '../src/utils/logger';
import { runWithDbCounter, countDbQuery, getDbCount } from '../src/utils/dbQueryCounter';
import { requestLogger } from '../src/middleware/requestLogger';

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn() }
}));

describe('dbQueryCounter (Faza 5.2)', () => {
    test('licznik startuje od 0 w kontekście requestu', () => {
        let inside: number | undefined;
        runWithDbCounter(() => {
            inside = getDbCount();
        });
        expect(inside).toBe(0);
    });

    test('countDbQuery inkrementuje licznik bieżącego kontekstu', () => {
        let inside: number | undefined;
        runWithDbCounter(() => {
            countDbQuery();
            countDbQuery();
            inside = getDbCount();
        });
        expect(inside).toBe(2);
    });

    test('poza kontekstem getDbCount zwraca -1', () => {
        expect(getDbCount()).toBe(-1);
    });

    test('konteksty są odizolowane (bez przecieku między requestami)', () => {
        let a: number | undefined;
        let b: number | undefined;
        runWithDbCounter(() => {
            countDbQuery();
            a = getDbCount();
        });
        runWithDbCounter(() => {
            b = getDbCount();
        });
        expect(a).toBe(1);
        expect(b).toBe(0);
    });

    test('requestLogger loguje liczbę zapytań DB w finish', async () => {
        const infoMock = logger.info as unknown as jest.Mock;
        infoMock.mockClear();

        const app = express();
        app.use(requestLogger);
        app.get('/test', (_req, res) => {
            countDbQuery();
            res.json({ ok: true });
        });

        await request(app).get('/test').expect(200);

        expect(infoMock).toHaveBeenCalled();
        const message = infoMock.mock.calls[0][1] as string;
        expect(message).toContain('/test 200');
        expect(message).toMatch(/, db=1$/);
        expect(message).toMatch(/^\[[0-9a-f]{8}\] /);
    });

    test('requestLogger ustawia nagłówek X-Request-Id', async () => {
        const app = express();
        app.use(requestLogger);
        app.get('/reqid', (_req, res) => res.json({ ok: true }));

        const res = await request(app).get('/reqid').expect(200);
        expect(res.headers['x-request-id']).toMatch(/^[0-9a-f]{8}$/);
    });
});
