export function parseFeatureSnapshot(featureSnapshot: string | null | undefined): {
    totalPrice: number;
    totalWeight: number;
    aiScore: number | null;
} {
    if (!featureSnapshot) return { totalPrice: 0, totalWeight: 0, aiScore: null };
    try {
        const snap = JSON.parse(featureSnapshot);
        return {
            totalPrice: typeof snap.totalPrice === 'number' ? snap.totalPrice : 0,
            totalWeight: typeof snap.totalWeight === 'number' ? snap.totalWeight : 0,
            aiScore: typeof snap.aiScore === 'number' ? snap.aiScore : null
        };
    } catch {
        return { totalPrice: 0, totalWeight: 0, aiScore: null };
    }
}
