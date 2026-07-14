import { Request, Response, NextFunction } from 'express';

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
