import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';
import { runWithDbCounter, getDbCount } from '../utils/dbQueryCounter';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
    runWithDbCounter(() => {
        const requestId = randomUUID().slice(0, 8);
        res.setHeader('X-Request-Id', requestId);
        const start = Date.now();
        res.on('finish', () => {
            const dbQueries = getDbCount();
            const dbPart = dbQueries >= 0 ? `, db=${dbQueries}` : '';
            logger.info(
                'Request',
                `[${requestId}] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms${dbPart}`
            );
        });
        next();
    });
}
