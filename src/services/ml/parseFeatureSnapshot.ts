import { logger } from '../../utils/logger';

let warnedOnce = false;

export function parseFeatureSnapshot(featureSnapshot: string | null | undefined): {
    totalPrice: number;
    totalWeight: number;
    aiScore: number | null;
    dennicaHeight: number;
} {
    if (!featureSnapshot) return { totalPrice: 0, totalWeight: 0, aiScore: null, dennicaHeight: 0 };
    try {
        const snap = JSON.parse(featureSnapshot);
        return {
            totalPrice: typeof snap.totalPrice === 'number' ? snap.totalPrice : 0,
            totalWeight: typeof snap.totalWeight === 'number' ? snap.totalWeight : 0,
            aiScore: typeof snap.aiScore === 'number' ? snap.aiScore : null,
            dennicaHeight: typeof snap.dennicaHeight === 'number' ? snap.dennicaHeight : 0
        };
    } catch (e) {
        // Zera = fallback, ale nie cicho: uszkodzony snapshot to problem danych.
        // Log raz na proces — funkcja jest wołana per wiersz (bez floodu).
        if (!warnedOnce) {
            warnedOnce = true;
            logger.warn(
                'ML',
                'parseFeatureSnapshot: nieparsowalny JSON — zwracam zera (dalsze ostrzezenia wyciszone)',
                String(e)
            );
        }
        return { totalPrice: 0, totalWeight: 0, aiScore: null, dennicaHeight: 0 };
    }
}
