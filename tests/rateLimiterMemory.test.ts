/**
 * Testy rate limitera z hardened memory protection (Faza 8)
 */

import { createRateLimiter } from '../src/middleware/rateLimiter';
import type { Request, Response } from 'express';

function makeReq(overrides: Record<string, unknown> = {}): Request {
    return { ip: '1.2.3.4', ...overrides } as unknown as Request;
}

function makeRes(): Response {
    const headers: Record<string, number> = {};
    const res: Record<string, unknown> = {
        headers,
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        setHeader: jest.fn().mockImplementation((key: string, value: number) => {
            headers[key] = value;
            return res;
        })
    };
    return res as unknown as Response;
}

describe('RateLimiter - memory protection (Faza 8)', () => {
    let limiter: ReturnType<typeof createRateLimiter>;
    let next: jest.Mock;

    beforeEach(() => {
        jest.useFakeTimers();
        next = jest.fn();
        limiter = createRateLimiter({
            windowMs: 1000,
            maxHits: 5,
            maxMapSize: 100
        });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('przepuszcza pierwsze 5 żądań z tego samego IP w oknie', () => {
        for (let i = 0; i < 5; i++) {
            limiter(makeReq(), makeRes(), next);
        }
        expect(next).toHaveBeenCalledTimes(5);
    });

    it('odrzuca 6. żądanie z tego samego IP', () => {
        for (let i = 0; i < 5; i++) {
            limiter(makeReq(), makeRes(), next);
        }
        const res6 = makeRes();
        const next6 = jest.fn();
        limiter(makeReq(), res6, next6);
        expect(next6).not.toHaveBeenCalled();
        expect(res6.status as unknown as jest.Mock).toHaveBeenCalledWith(429);
    });

    it('limit nie dotyczy różnych IP', () => {
        for (let i = 0; i < 5; i++) {
            limiter(makeReq({ ip: '1.2.3.4' }), makeRes(), next);
        }
        for (let i = 0; i < 5; i++) {
            limiter(makeReq({ ip: '5.6.7.8' }), makeRes(), next);
        }
        expect(next).toHaveBeenCalledTimes(10);
    });

    it('ustawia naglowki X-RateLimit-Limit/Remaining/Retry-After', () => {
        const res = makeRes();
        limiter(makeReq(), res, next);
        expect(res.setHeader as unknown as jest.Mock).toHaveBeenCalledWith('X-RateLimit-Limit', 5);
        expect(res.setHeader as unknown as jest.Mock).toHaveBeenCalledWith(
            'X-RateLimit-Remaining',
            4
        );
    });

    it('awaryjne zachowanie dla niedefiniowanego IP (fallback)', () => {
        const reqWithoutIp = {
            ip: undefined,
            socket: { remoteAddress: '9.9.9.9' }
        };
        limiter(reqWithoutIp as unknown as Request, makeRes(), next);
        expect(next).toHaveBeenCalled();
    });
});
