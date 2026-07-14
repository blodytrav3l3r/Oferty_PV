import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
    logger.error('UnhandledError', err.message, err.stack || '');
    res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
}
