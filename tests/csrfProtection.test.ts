/**
 * Testy CSRF Protection (Faza 6)
 *
 * Weryfikują poprawnosć działania csrfProtection middleware.
 */

import { csrfProtection, generateCsrfToken, setCsrfCookie } from '../src/middleware/security';

function makeReq(method: string, opts: {
    cookies?: Record<string, string>;
    headerToken?: string;
}): { method: string; cookies?: Record<string, string>; headers: Record<string, string> } {
    return {
        method,
        cookies: opts.cookies,
        headers: opts.headerToken ? { 'x-csrf-token': opts.headerToken } : {}
    };
}

function makeRes(): {
    status: jest.Mock;
    json: jest.Mock;
    cookie: jest.Mock;
    headersSent: boolean;
} {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        cookie: jest.fn().mockReturnThis(),
        headersSent: false
    };
}

describe('CSRF Protection - csrfProtection middleware', () => {
    let next: jest.Mock;

    beforeEach(() => {
        next = jest.fn();
    });

    it('przepuszcza GET bez tokenu', () => {
        const req = makeReq('GET', {});
        const res = makeRes();
        csrfProtection(req as never, res as never, next);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('przepuszcza HEAD bez tokenu', () => {
        const req = makeReq('HEAD', {});
        const res = makeRes();
        csrfProtection(req as never, res as never, next);
        expect(next).toHaveBeenCalled();
    });

    it('przepuszcza OPTIONS bez tokenu', () => {
        const req = makeReq('OPTIONS', {});
        const res = makeRes();
        csrfProtection(req as never, res as never, next);
        expect(next).toHaveBeenCalled();
    });

    it('odrzuca POST bez cookie csrfToken', () => {
        const req = makeReq('POST', { headerToken: 'abc123' });
        const res = makeRes();
        csrfProtection(req as never, res as never, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
    });

    it('odrzuca POST bez naglowka X-CSRF-Token', () => {
        const req = makeReq('POST', { cookies: { csrfToken: 'abc123' } });
        const res = makeRes();
        csrfProtection(req as never, res as never, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
    });

    it('odrzuca POST z rozniacym sie tokenem (timing-safe)', () => {
        const req = makeReq('POST', {
            cookies: { csrfToken: 'token-1234567890abcdef' },
            headerToken: 'token-XXXXX'
        });
        const res = makeRes();
        csrfProtection(req as never, res as never, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
    });

    it('przepuszcza POST z poprawnym tokenem', () => {
        const token = 'poprawnytoken1234567890abcdef';
        const req = makeReq('POST', {
            cookies: { csrfToken: token },
            headerToken: token
        });
        const res = makeRes();
        csrfProtection(req as never, res as never, next);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('przepuszcza PUT z poprawnym tokenem', () => {
        const token = 'token-dla-put-method';
        const req = makeReq('PUT', {
            cookies: { csrfToken: token },
            headerToken: token
        });
        const res = makeRes();
        csrfProtection(req as never, res as never, next);
        expect(next).toHaveBeenCalled();
    });

    it('przepuszcza DELETE z poprawnym tokenem', () => {
        const token = 'token-dla-delete';
        const req = makeReq('DELETE', {
            cookies: { csrfToken: token },
            headerToken: token
        });
        const res = makeRes();
        csrfProtection(req as never, res as never, next);
        expect(next).toHaveBeenCalled();
    });

    it('odrzuca z proznym cookie i naglowkiem', () => {
        const req = makeReq('POST', {});
        const res = makeRes();
        csrfProtection(req as never, res as never, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ error: expect.stringMatching(/missing/) })
        );
    });
});

describe('CSRF Protection - generateCsrfToken', () => {
    it('generuje unikalne tokeny', () => {
        const tokens = new Set();
        for (let i = 0; i < 100; i++) {
            tokens.add(generateCsrfToken());
        }
        expect(tokens.size).toBe(100);
    });

    it('generuje token o dlugosci 64 znaki (256 bit hex)', () => {
        const token = generateCsrfToken();
        expect(token).toHaveLength(64);
        expect(/^[a-f0-9]+$/.test(token)).toBe(true);
    });
});

describe('CSRF Protection - setCsrfCookie', () => {
    it('ustawia cookie z prawidlowymi parametrami', () => {
        const res = makeRes();
        const token = 'sample-csrf-token-1234567890abcdef';
        setCsrfCookie(res as never, token);
        expect(res.cookie).toHaveBeenCalledWith(
            'csrfToken',
            token,
            expect.objectContaining({
                sameSite: 'strict',
                path: '/',
                httpOnly: false // JS-readable
            })
        );
    });

    it('ustawia secure=true w produkcji', () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        try {
            const res = makeRes();
            setCsrfCookie(res as never, 'token');
            expect(res.cookie).toHaveBeenCalledWith(
                'csrfToken',
                'token',
                expect.objectContaining({
                    secure: true
                })
            );
        } finally {
            process.env.NODE_ENV = originalEnv;
        }
    });
});
