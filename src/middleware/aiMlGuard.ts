import type { Request, Response, NextFunction } from 'express';
import prisma from '../prismaClient';

/**
 * Execution kill-switch modułu AI/ML (flaga `feature_ai_ml_enabled` w settings).
 * Semantyka: OFF blokuje NOWE operacje od momentu zapisu flagi;
 * operacje już rozpoczęte nie są przerywane.
 */
export const AI_ML_FLAG_KEY = 'feature_ai_ml_enabled';

export function isAiMlFlagOn(v: { value: string | null } | null | undefined): boolean {
    if (!v) return true;
    return v.value !== '"0"' && v.value !== '0';
}

export async function isAiMlEnabled(): Promise<boolean> {
    try {
        const s = await prisma.settings.findUnique({
            where: { key: AI_ML_FLAG_KEY }
        });
        return isAiMlFlagOn(s);
    } catch {
        return true;
    }
}

export async function requireAiMlEnabled(
    _req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    if (await isAiMlEnabled()) {
        next();
        return;
    }
    res.status(503).json({ error: 'disabled' });
}
