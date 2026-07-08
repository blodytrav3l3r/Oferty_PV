import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Przekierowuje żądania HTTP na HTTPS w środowisku produkcyjnym.
 */
export function httpsRedirect(req: Request, res: Response, next: NextFunction): void {
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    if (process.env.NODE_ENV === 'production' && !isHttps) {
        res.redirect('https://' + req.headers.host + req.url);
        return;
    }
    next();
}

/**
 * Ustawia nagłówki bezpieczeństwa HTTP i wymusza charset=utf-8.
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // X-Frame-Options usunięte — SPA używa routowania hash, blokuje własne iframe'y w niektórych przeglądarkach
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    next();
}

/**
 * Wymusza charset=utf-8 w nagłówku Content-Type dla odpowiedzi tekstowych.
 * Zapobiega nieprawidłowemu dekodowaniu polskich znaków przez przeglądarkę.
 */
export function charsetMiddleware(_req: Request, res: Response, next: NextFunction): void {
    const originalSend = res.send.bind(res);
    res.send = function (body?: unknown): Response {
        const ct = res.getHeader('Content-Type');
        if (ct && typeof ct === 'string' && !ct.includes('charset')) {
            res.setHeader('Content-Type', ct + '; charset=utf-8');
        }
        return originalSend(body);
    };
    next();
}

/**
 * Generuje token CSRF (double submit cookie pattern).
 * Powinien być wywolywany przy udanym logowaniu, aby ustawic cookie z tokenem.
 * Klient frontendu musi czytac cookie (JS readable - nie httpOnly) i odsylac
 * token w naglowku X-CSRF-Token dla kazdego mutujacego requestu (POST/PUT/PATCH/DELETE).
 */
export function generateCsrfToken(): string {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Ustawia cookie CSRF w odpowiedzi. Cookie jest JS-readable (nie httpOnly),
 * aby frontend mógł odczytać token i odesłać go w nagłówku X-CSRF-Token.
 */
export function setCsrfCookie(res: Response, token: string): void {
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('csrfToken', token, {
        httpOnly: false, // JS-readable - frontend potrzebuje odczytać token
        secure: isProduction,
        sameSite: 'strict',
        path: '/',
        maxAge: 24 * 60 * 60 * 1000 // 24h
    });
}

/**
 * Middleware CSRF - waliduje token dla mutujacych metod (POST/PUT/PATCH/DELETE).
 *
 * Strategia "double submit cookie":
 * - Cookie csrfToken (JS-readable) jest ustawiane przy logowaniu
 * - Frontend wklada ten sam token w naglowek X-CSRF-Token
 * - Server porównuje oba -- atakujacy z zewnatrz nie odczyta cookie (SameSite strict)
 *
 * Bezpieczne metody (GET/HEAD/OPTIONS) pomijamy -- sa idempotentne.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
    const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];
    if (SAFE_METHODS.includes(req.method)) {
        next();
        return;
    }

    const cookieToken = req.cookies?.csrfToken;
    const headerToken = req.headers['x-csrf-token'];

    // Brak cookie lub naglowka
    if (!cookieToken || !headerToken) {
        res.status(403).json({ error: 'CSRF token missing' });
        return;
    }

    // Porownanie odporne na timing attack
    const cookieBuf = Buffer.from(String(cookieToken));
    const headerBuf = Buffer.from(
        Array.isArray(headerToken) ? headerToken[0] : String(headerToken)
    );

    if (cookieBuf.length !== headerBuf.length || !crypto.timingSafeEqual(cookieBuf, headerBuf)) {
        res.status(403).json({ error: 'CSRF token mismatch' });
        return;
    }

    next();
}
