import { Request, Response } from 'express';

interface RateLimiterOpts {
    windowMs?: number;
    maxHits?: number;
    message?: string;
}

interface HitRecord {
    count: number;
    resetAt: number;
}

/**
 * Prosty In-Memory Rate Limiter.
 * Ogranicza liczbę żądań z jednego IP w oknie czasowym.
 */
export function createRateLimiter({
    windowMs = 15 * 60 * 1000,
    maxHits = 15,
    message = 'Zbyt wiele prób. Spróbuj ponownie później.'
}: RateLimiterOpts = {}): (req: Request, res: Response, next: () => void) => void {
    const hits = new Map<string, HitRecord>();

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
        const now = Date.now();
        let record = hits.get(ip);

        if (!record || now > record.resetAt) {
            record = { count: 0, resetAt: now + windowMs };
            hits.set(ip, record);
        }

        record.count++;

        // Dodaj nagłówki informacyjne
        res.setHeader('X-RateLimit-Limit', maxHits);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, maxHits - record.count));

        if (record.count > maxHits) {
            const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
            res.setHeader('Retry-After', retryAfterSec);
            res.status(429).json({ error: message });
            return;
        }

        next();
    };
}
