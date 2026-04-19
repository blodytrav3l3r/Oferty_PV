import { Request, Response, NextFunction } from 'express';

/**
 * Przekierowuje żądania HTTP na HTTPS w środowisku produkcyjnym.
 */
export function httpsRedirect(req: Request, res: Response, next: NextFunction): void {
    if (process.env.NODE_ENV === 'production' && !(req as any).secure) {
        res.redirect('https://' + req.headers.host + req.url);
        return;
    }
    next();
}

/**
 * Ustawia nagłówki bezpieczeństwa HTTP.
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // X-Frame-Options removed - SPA uses hash routing, blocks own iframes in some browsers
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    next();
}
