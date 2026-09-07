import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { recordDbBusy } from '../utils/metrics';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
    logger.error('UnhandledError', err.message, err.stack || '');
    // M: licznik SQLITE_BUSY/lock — contention pisarzy na 1 DB.
    if (/locked|busy|timeout/i.test(err.message || '')) recordDbBusy();
    // PayloadTooLargeError z body-parser (przekroczony limit express.json) —
    // jako 413 z jawnym komunikatem zamiast mylącego generycznego 500.
    const status = (err as { status?: unknown }).status;
    const type = (err as { type?: unknown }).type;
    if (status === 413 || type === 'entity.too.large') {
        res.status(413).json({ error: 'Zbyt duży payload żądania (przekroczony limit rozmiaru)' });
        return;
    }
    res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
}
