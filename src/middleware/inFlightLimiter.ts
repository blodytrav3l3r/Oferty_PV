import type { NextFunction, Request, Response } from 'express';

interface TransferRequest extends Request {
    releaseTransferSlot?: () => void;
}

export function releaseTransferSlot(req: Request): void {
    (req as TransferRequest).releaseTransferSlot?.();
}

export function releaseTransferSlotOnError(
    error: unknown,
    req: Request,
    _res: Response,
    next: NextFunction
): void {
    releaseTransferSlot(req);
    next(error);
}

/** Ogranicza równoległe operacje kosztowne pamięciowo w jednej instancji. */
export function createInFlightLimiter(maxConcurrent: number, message: string) {
    if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
        throw new Error('in_flight_limit_invalid');
    }

    let active = 0;

    return (req: Request, res: Response, next: NextFunction): void => {
        if (active >= maxConcurrent) {
            res.status(429).json({ error: message, code: 'TRANSFER_BUSY' });
            return;
        }

        active += 1;
        let released = false;
        const release = (): void => {
            if (released) return;
            released = true;
            active -= 1;
        };
        (req as TransferRequest).releaseTransferSlot = release;
        res.once('finish', release);
        res.once('close', () => {
            if (!req.complete) release();
        });
        next();
    };
}

export const AI_TRANSFER_IN_FLIGHT_LIMITER = createInFlightLimiter(
    1,
    'Trwa inna operacja transferu AI/ML. Spróbuj ponownie za chwilę.'
);
