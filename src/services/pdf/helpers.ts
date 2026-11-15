import { roundMoney } from '../../utils/money';
import { projectStudnieExportAmounts } from '../studnieExportAmounts';

export function fmtInt(val: number): string {
    return val.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
export function formatDatePL(dateStr: string): string {
    if (!dateStr) return new Date().toLocaleDateString('pl-PL');
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr + 'T00:00:00' : dateStr;
    try {
        return new Date(normalized).toLocaleDateString('pl-PL');
    } catch {
        return dateStr;
    }
}

export function escapeHtml(input: unknown): string {
    if (input === null || input === undefined) return '';
    return String(input)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * SSoT ceny jednostkowej netto pozycji oferty na wydruku:
 * `unitPrice * (1 - discount/100) + pehd + surcharge + transport/jedn.`
 * Jedno miejsce dla math ceny na PDF (rury/studnie/łączony) — bez duplikacji
 * formuły w rendererach.
 */
export interface UnitPriceNettoInput {
    unitPrice: number;
    discountPct?: number;
    pehdCostPerUnit?: number;
    surcharge?: number;
    transportPerUnit?: number;
}

export function computeUnitPriceNetto(item: UnitPriceNettoInput): number {
    // NaN/Infinity nie może wyciec na wydruk (cena "NaN" na ofercie) → 0.
    const num = (v: unknown): number => {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    };
    const unitPrice = num(item.unitPrice);
    const discountPct = num(item.discountPct);
    return (
        unitPrice * (1 - discountPct / 100) +
        num(item.pehdCostPerUnit) +
        num(item.surcharge) +
        num(item.transportPerUnit)
    );
}

export function mapWellsToItems(
    wells: unknown[],
    separateTransport = false,
    savedTotal?: unknown
): {
    items: Record<string, unknown>[];
    grandTotal: number;
    transportTotal: number;
} {
    const itemsByDN: Record<string, Record<string, unknown>[]> = {};
    let grandTotal = 0;
    let transportTotal = 0;
    const amounts = projectStudnieExportAmounts(wells, separateTransport, savedTotal);

    for (const [index, w] of wells.entries()) {
        const well = w as Record<string, unknown>;
        const dn = String(well.dn ?? 'Inne');
        const { price: wellPrice, transportCost: share } = amounts[index];
        grandTotal += wellPrice;
        transportTotal += share;

        if (!itemsByDN[dn]) itemsByDN[dn] = [];
        itemsByDN[dn].push({
            productName: escapeHtml(String(well.name ?? `Studnia DN${dn}`)),
            quantity: 1,
            price: wellPrice,
            DN: dn,
            height: Number(well.height ?? 0),
            zwienczenie: String(well.zwienczenie ?? '—'),
            transportCost: separateTransport ? share : roundMoney(Number(well.transportCost ?? 0))
        });
    }

    const items = Object.values(itemsByDN).flat();
    return {
        items,
        grandTotal: roundMoney(grandTotal),
        transportTotal: roundMoney(transportTotal)
    };
}
