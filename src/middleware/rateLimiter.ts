import { Request, Response } from 'express';
import { recordRateLimited } from '../utils/metrics';

interface RateLimiterOpts {
    windowMs?: number;
    maxHits?: number;
    message?: string;
    /** Nazwa do metryk /metrics (P2.2). Bez nazwy liczone jako 'default'. */
    name?: string;
    /**
     * E4b: własny klucz bucketa. Domyślnie IP. Dla logowania: IP + login,
     * bo user ID nie istnieje przed uwierzytelnieniem.
     */
    keyGenerator?: (req: Request) => string;
}

interface HitRecord {
    count: number;
    resetAt: number;
}

/**
 * Mnożnik progów dla serwerów E2E (izolowane :3198/:3199), gdzie suity robią
 * setki zapisów/logowań w jednym oknie i produkcyjne progi dają im fałszywe 429
 * (limit, nie flake aplikacji). Ustawiany WYŁĄCZNIE przez serwer E2E:
 * webServer playwright.config.ts i krok CI startu :3198.
 * Na produkcji zawsze 1 (guard NODE_ENV), domyślnie 1; clamp 1000 chroni przed
 * `Infinity`/wartością z literówki, która wyłączyłaby limiter.
 */
function limitMultiplier(): number {
    if (process.env.NODE_ENV === 'production') return 1;
    const raw = Math.floor(Number(process.env.RATE_LIMIT_MULT));
    return Number.isFinite(raw) && raw > 1 ? Math.min(1000, raw) : 1;
}

/**
 * Prosty In-Memory Rate Limiter.
 * Ogranicza liczbę żądań z jednego IP w oknie czasowym.
 */
export function createRateLimiter({
    windowMs = 15 * 60 * 1000,
    maxHits = 15,
    message = 'Zbyt wiele prób. Spróbuj ponownie później.',
    name = 'default',
    keyGenerator
}: RateLimiterOpts = {}): (req: Request, res: Response, next: () => void) => void {
    const hits = new Map<string, HitRecord>();
    const effectiveMaxHits = Math.floor(maxHits * limitMultiplier());

    // Automatyczne czyszczenie starych wpisów co interwał
    const cleanupInterval = setInterval(() => {
        const now = Date.now();
        for (const [key, record] of hits) {
            if (now - record.resetAt > 0) {
                hits.delete(key);
            }
        }
    }, windowMs);

    // Pozwól garbage collectorowi posprzątać, jeśli proces się kończy
    if (cleanupInterval.unref) cleanupInterval.unref();

    return (req: Request, res: Response, next: () => void): void => {
        const ip = (req.ip as string) || (req.connection?.remoteAddress as string) || 'unknown';
        const key = keyGenerator ? keyGenerator(req) : ip;
        const now = Date.now();
        let record = hits.get(key);

        if (!record || now > record.resetAt) {
            record = { count: 0, resetAt: now + windowMs };
            hits.set(key, record);
        }

        record.count++;

        // Dodaj nagłówki informacyjne
        res.setHeader('X-RateLimit-Limit', effectiveMaxHits);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, effectiveMaxHits - record.count));

        if (record.count > effectiveMaxHits) {
            const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
            res.setHeader('Retry-After', retryAfterSec);
            recordRateLimited(name);
            res.status(429).json({ error: message, retryAfter: retryAfterSec });
            return;
        }

        next();
    };
}
