import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';
import { runWithDbCounter, getDbCount } from '../utils/dbQueryCounter';
import { recordRequest } from '../utils/metrics';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
    runWithDbCounter(() => {
        const requestId = randomUUID().slice(0, 8);
        res.setHeader('X-Request-Id', requestId);
        const start = Date.now();
        res.on('finish', () => {
            const ms = Date.now() - start;
            // M: metryki per endpoint (route template gdy znany, inaczej ścieżka).
            const routePath =
                ((req as unknown as { route?: { path?: unknown } }).route?.path as
                    string | undefined) || req.path;
            const fullPath = req.baseUrl && routePath ? req.baseUrl + routePath : req.path;
            recordRequest(req.method, fullPath, res.statusCode, ms);
            const dbQueries = getDbCount();
            const dbPart = dbQueries >= 0 ? `, db=${dbQueries}` : '';
            logger.info(
                'Request',
                `[${requestId}] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms${dbPart}`
            );
        });
        next();
    });
}
