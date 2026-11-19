import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';
import { runWithDbCounter, getDbCount } from '../utils/dbQueryCounter';
import { recordRequest } from '../utils/metrics';
import { runWithRequestId } from '../utils/requestContext';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
    runWithDbCounter(() => {
        const requestId = randomUUID().slice(0, 8);
        // Podepnij requestId na obiekcie żądania — czyta je errorHandler.
        (req as unknown as { id?: string }).id = requestId;
        res.setHeader('X-Request-Id', requestId);
        const start = Date.now();
        res.on('finish', () => {
            const ms = Date.now() - start;
            const routePath: unknown = req.route?.path;
            const routeTemplate = typeof routePath === 'string' ? req.baseUrl + routePath : null;
            recordRequest(req.method, req.path, res.statusCode, ms, routeTemplate);
            const dbQueries = getDbCount();
            const dbPart = dbQueries >= 0 ? `, db=${dbQueries}` : '';
            const requestPath = req.originalUrl.split('?', 1)[0];
            logger.info(
                'Request',
                `[${requestId}] ${req.method} ${requestPath} ${res.statusCode} ${ms}ms${dbPart}`
            );
        });
        // P2: kontekst requestId dla logow audytu/biznesu (AsyncLocalStorage).
        runWithRequestId(requestId, () => next());
    });
}
