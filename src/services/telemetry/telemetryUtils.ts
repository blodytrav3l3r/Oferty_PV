export function safeDeserialize<T extends Record<string, unknown>>(
    obj: T
): Record<string, unknown> {
    const result: Record<string, unknown> = { ...obj };
    const jsonFields = [
        'ringHeights',
        'appliedReductions',
        'appliedKonus',
        'appliedHatches',
        'appliedSeals',
        'allComponentIds',
        'featureSnapshot',
        'labelSnapshot',
        'predictionSnapshot',
        'original_auto_config',
        'final_user_config',
        'extraMeta'
    ];
    for (const field of jsonFields) {
        const val = result[field];
        if (typeof val === 'string') {
            try {
                result[field] = JSON.parse(val);
            } catch {
                /* zostaw surowy string */
            }
        }
    }
    return result;
}

export function safeJson(value: string | null | undefined): unknown {
    if (!value) return value;
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

export function computeDiff<T extends { productId?: string }>(
    original: T[] | undefined,
    final: T[] | undefined
): { added: string[]; removed: string[]; kept: string[] } {
    const orig = (original || []).map((c) => c.productId || '').filter(Boolean);
    const fin = (final || []).map((c) => c.productId || '').filter(Boolean);
    const origCounts = new Map<string, number>();
    const finCounts = new Map<string, number>();
    orig.forEach((id) => origCounts.set(id, (origCounts.get(id) || 0) + 1));
    fin.forEach((id) => finCounts.set(id, (finCounts.get(id) || 0) + 1));
    const added: string[] = [];
    const removed: string[] = [];
    const kept: string[] = [];
    const all = new Set([...origCounts.keys(), ...finCounts.keys()]);
    for (const id of all) {
        const o = origCounts.get(id) || 0;
        const f = finCounts.get(id) || 0;
        if (f > o) added.push(...Array(f - o).fill(id));
        else if (o > f) removed.push(...Array(o - f).fill(id));
        if (Math.min(o, f) > 0) kept.push(...Array(Math.min(o, f)).fill(id));
    }
    return { added, removed, kept };
}
