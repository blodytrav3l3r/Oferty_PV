import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    res.on('finish', () => {
        logger.info(
            'Request',
            `${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`
        );
    });
    next();
}
