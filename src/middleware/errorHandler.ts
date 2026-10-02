import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { recordDbBusy } from '../utils/metrics';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
    // requestId z loggera (req.id) albo z nagłówka X-Request-Id — do korelacji logów z odpowiedzią.
    const fromReq = (req as unknown as { id?: unknown }).id;
    const headerId = req.headers?.['x-request-id'];
    const resHeader =
        typeof res.getHeader === 'function' ? res.getHeader('X-Request-Id') : undefined;
    const rawId =
        (typeof fromReq === 'string' && fromReq) ||
        (typeof headerId === 'string' && headerId) ||
        (Array.isArray(headerId) && typeof headerId[0] === 'string' && headerId[0]) ||
        (typeof resHeader === 'string' && resHeader) ||
        'unknown';
    const requestId = String(rawId).slice(0, 32);
    // Stack trace tylko w logach, nigdy w odpowiedzi do klienta.
    logger.error('UnhandledError', `[${requestId}] ${err.message}`, err.stack || '');
    // Dociągnij nagłówek korelacyjny na odpowiedzi o błędzie.
    try {
        if (!res.getHeader('X-Request-Id')) res.setHeader('X-Request-Id', requestId);
    } catch {
        // Ignoruj — nagłówki mogły już zostać wysłane.
    }
    // M: licznik SQLITE_BUSY/lock — contention pisarzy na 1 DB.
    // Heavy-write: zamiast mylącego 500 zwróć 429 + Retry-After (backpressure,
    // klient/load-100 ponawia po odczekaniu; 5xx==0 w DoD).
    if (/locked|busy|timeout/i.test(err.message || '')) {
        recordDbBusy();
        try {
            res.setHeader('Retry-After', 2);
        } catch {
            // Ignoruj — nagłówki mogły już zostać wysłane.
        }
        if (!res.headersSent) {
            res.status(429).json({ error: 'Baza zajęta — spróbuj ponownie', requestId });
            return;
        }
    }
    // PayloadTooLargeError z body-parser (przekroczony limit express.json) —
    // jako 413 z jawnym komunikatem zamiast mylącego generycznego 500.
    const status = (err as { status?: unknown }).status;
    const type = (err as { type?: unknown }).type;
    if (status === 413 || type === 'entity.too.large') {
        res.status(413).json({
            error: 'Zbyt duży payload żądania (przekroczony limit rozmiaru)',
            requestId
        });
        return;
    }
    res.status(500).json({ error: 'Wewnętrzny błąd serwera', requestId });
}
