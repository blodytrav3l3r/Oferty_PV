/**
 * S4: shadow weryfikacja sum oferty studni — tylko log, nigdy 422.
 * Porównuje zapisany totalPrice z sumą wellsExport[].totalPrice (jak LIST
 * w search.ts). Brak wellsExport = brak porównania (legacy/slim).
 */

export interface ShadowSumMismatch {
    stored: number;
    wellsExportTotal: number;
    delta: number;
}

const CENT = 0.01;

export function shadowStudnieTotal(
    blob: Record<string, unknown>,
    storedTotal: number
): ShadowSumMismatch | null {
    const wellsExport = blob.wellsExport;
    if (!Array.isArray(wellsExport) || wellsExport.length === 0) return null;
    let sum = 0;
    for (const row of wellsExport) {
        if (!row || typeof row !== 'object') continue;
        const value = Number((row as Record<string, unknown>).totalPrice);
        if (Number.isFinite(value)) sum += value;
    }
    const wellsExportTotal = Math.round(sum * 100) / 100;
    const stored = Number.isFinite(storedTotal) ? storedTotal : 0;
    if (Math.abs(wellsExportTotal - stored) <= CENT) return null;
    return {
        stored,
        wellsExportTotal,
        delta: Math.round((stored - wellsExportTotal) * 100) / 100
    };
}
