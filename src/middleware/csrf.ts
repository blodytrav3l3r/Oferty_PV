import { Request, Response, NextFunction } from 'express';

/**
 * P0.1: same-origin CSRF — mutacje (POST/PUT/PATCH/DELETE) wymagają nagłówka
 * Origin lub Referer zgodnego z Host żądania.
 *
 * Aplikacja serwuje backend i frontend z tego samego serwera (brak CORS),
 * więc każda przeglądarkowa mutacja niesie Origin (fetch/form) albo Referer.
 * Żądanie mutujące bez żadnego z nich albo z niezgodnym originem to
 * cross-site forgery albo błędny klient — odrzucamy 403.
 *
 * Kontrakt:
 * - Origin istnieje → musi dokładnie odpowiadać trusted origin (Host).
 * - Origin brak + Referer istnieje → Referer musi pochodzić z trusted origin.
 * - Oba brak → 403.
 * - GET/HEAD/OPTIONS → middleware nie ingeruje.
 *
 * Trusted origin = Host żądania (same-origin; za reverse proxy Host jest
 * zachowany, `trust proxy` ustawione w src/app.ts). Brak nowego env.
 * Wyjątek: /api/csp-report — raporty przeglądarki bez Origin, bez zmiany stanu.
 */

const EXEMPT_PATHS = new Set(['/api/csp-report']);

function hostOf(value: string | undefined): string | null {
    if (!value) return null;
    try {
        return new URL(value).host.toLowerCase();
    } catch {
        return null;
    }
}

export function isSameOriginRequest(req: Request): boolean {
    const expected = (req.get('host') || '').toLowerCase();
    if (!expected) return false;
    const origin = req.get('origin');
    if (origin) return hostOf(origin) === expected;
    const referer = req.get('referer');
    if (referer) return hostOf(referer) === expected;
    return false;
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
    const method = req.method.toUpperCase();
    if (method !== 'POST' && method !== 'PUT' && method !== 'PATCH' && method !== 'DELETE') {
        next();
        return;
    }
    if (EXEMPT_PATHS.has(req.path)) {
        next();
        return;
    }
    if (isSameOriginRequest(req)) {
        next();
        return;
    }
    res.status(403).json({ error: 'Żądanie odrzucone — niezgodny origin (CSRF)' });
}
