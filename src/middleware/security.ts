import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import type { HelmetOptions } from 'helmet';
import { logger } from '../utils/logger';

/**
 * Czy transport HTTPS jest włączony. `HTTPS_ENABLED=false` to jawny tryb
 * awaryjny LAN/VPN (ADR-017): brak przekierowania, brak HSTS i brak
 * `upgrade-insecure-requests`. Bez tego ostatniego przeglądarka przepisuje
 * każde `fetch('/api/...')` ze strony po HTTP na https — żądanie nie ma gdzie
 * trafić i zapis oferty pada z ERR_SSL_PROTOCOL_ERROR.
 * Każda inna wartość (brak zmiennej, `true`) = HTTPS włączone.
 */
export function isHttpsEnabled(): boolean {
    return process.env.HTTPS_ENABLED !== 'false';
}

// Dozwolony Host: hostname (RFC 1123) z opcjonalnym portem. Blokuje wstrzyknięcia
// (np. `evil.com`, `a@b`, CRLF) przy budowaniu adresu przekierowania.
const HOSTNAME_RE =
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*(:[1-9][0-9]{0,4})?$/i;

/**
 * Bazowy origin do przekierowania HTTP→HTTPS.
 * Priorytet: PUBLIC_BASE_URL (jawny, odporny na spoof Host). Fallback: Host
 * zwalidowany regexem. Brak poprawnej wartości → null (fail-safe, brak redirectu).
 */
function resolveHttpsBase(req: Request): string | null {
    const configured = process.env.PUBLIC_BASE_URL;
    if (configured) {
        try {
            return new URL(configured).origin;
        } catch {
            logger.warn('Security', 'PUBLIC_BASE_URL nieprawidłowy — fallback do nagłówka Host');
        }
    }
    const host = req.headers.host;
    if (typeof host === 'string' && HOSTNAME_RE.test(host)) {
        return `https://${host}`;
    }
    return null;
}

/**
 * Przekierowuje żądania HTTP na HTTPS w środowisku produkcyjnym.
 */
export function httpsRedirect(req: Request, res: Response, next: NextFunction): void {
    // Tryb awaryjny HTTP (ADR-017): nie ma dokąd przekierować.
    if (!isHttpsEnabled()) {
        next();
        return;
    }
    // Healthcheck Dockera i endpoint wersji działają po HTTP — nie przekierowuj ich na HTTPS.
    // /health/ready i /health/live muszą być na liście: Docker HEALTHCHECK pyta
    // /health/ready po plain HTTP wewnątrz kontenera (inaczej 302 → wieczne unhealthy).
    if (
        req.path === '/health' ||
        req.path === '/health/ready' ||
        req.path === '/health/live' ||
        req.path === '/health/backup' ||
        req.path === '/api/version' ||
        req.path.startsWith('/health/pdf')
    ) {
        next();
        return;
    }

    // Express uwzględnia X-Forwarded-Proto tylko dla zaufanego proxy.
    if (process.env.NODE_ENV === 'production' && !req.secure) {
        const base = resolveHttpsBase(req);
        if (base === null) {
            // Brak zaufanego originu: nie odbijamy nagłówka Host (open-redirect).
            logger.warn(
                'Security',
                `Brak PUBLIC_BASE_URL i nieprawidłowy Host (${String(req.headers.host)}) — pomijam redirect HTTPS`
            );
            next();
            return;
        }
        res.redirect(302, base + req.url);
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

    if (process.env.NODE_ENV === 'production' && isHttpsEnabled()) {
        // Wartość MUSI się zgadzać z Caddyfile (header HSTS) — jedno źródło prawdy.
        res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    }

    next();
}

/**
 * Dyrektywy CSP (CSP-E: zero `unsafe-inline` dla skryptów — inline `<script>`
 * dostają per-request nonce, handlery wyeliminowane na rzecz dyspozytora
 * `data-csp`; `script-src-attr` celowo bez wpisu). `style-src` zostaje
 * z `unsafe-inline` (`style="..."` nie wykonuje JS — ryzyko szczątkowe).
 */
const CSP_DIRECTIVES = {
    defaultSrc: ["'self'"],
    scriptSrc: [
        "'self'",
        (_req: unknown, res: unknown) =>
            `'nonce-${(res as { locals?: { cspNonce?: string } }).locals?.cspNonce ?? 'missing'}'`
    ],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'blob:'],
    connectSrc: ["'self'"],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'self'"],
    // Clickjacking: obce domeny nie osadzą SPA; własne iframe'y (same-origin)
    // działają (X-Frame-Options zdjęte celowo).
    frameAncestors: ["'self'"]
};

/**
 * Konfiguracja Helmeta. Helmet dokłada `upgrade-insecure-requests` i HSTS
 * **domyślnie**, niezależnie od naszego middleware — w trybie HTTP
 * (`HTTPS_ENABLED=false`) oba muszą zniknąć, a reszta zabezpieczeń zostaje.
 */
export function buildHelmetOptions(): HelmetOptions {
    const httpsEnabled = isHttpsEnabled();
    return {
        contentSecurityPolicy: {
            directives: {
                ...CSP_DIRECTIVES,
                ...(httpsEnabled ? {} : { upgradeInsecureRequests: null })
            }
        },
        // HSTS po HTTP to kłamstwo: przeglądarka i tak go zignoruje, a przy
        // powrocie na nazwę hosta zostaje w cache na 2 lata.
        strictTransportSecurity: httpsEnabled ? undefined : false,
        crossOriginEmbedderPolicy: false
    };
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
 * Generuje nonce CSP per request i przechowuje w res.locals.cspNonce.
 * Używany w Content-Security-Policy-Report-Only do monitorowania violacji
 * przed przejściem na enforce (Faza 4 planu CSP).
 */
export function cspNonceMiddleware(_req: Request, res: Response, next: NextFunction): void {
    res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
    next();
}

/**
 * Ustawia Content-Security-Policy-Report-Only z nonce dla script-src.
 * Nie blokuje niczego — tylko raportuje violacje do /api/csp-report.
 */
export function cspReportOnly(_req: Request, res: Response, next: NextFunction): void {
    const nonce = res.locals.cspNonce as string;
    const reportPolicy = [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}'`,
        "script-src-attr 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "connect-src 'self'",
        "font-src 'self'",
        "object-src 'none'",
        "media-src 'self'",
        "frame-src 'self'",
        'report-uri /api/csp-report'
    ].join('; ');
    res.setHeader('Content-Security-Policy-Report-Only', reportPolicy);
    next();
}
