export function fmtInt(val: number): string {
    return val.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
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

export function mapWellsToItems(wells: unknown[]): {
    items: Record<string, unknown>[];
    grandTotal: number;
} {
    const itemsByDN: Record<string, Record<string, unknown>[]> = {};
    let grandTotal = 0;

    for (const w of wells) {
        const well = w as Record<string, unknown>;
        const dn = String(well.dn ?? 'Inne');
        const wellPrice = Number(well.totalPrice ?? well.price ?? 0);
        grandTotal += wellPrice;

        if (!itemsByDN[dn]) itemsByDN[dn] = [];
        itemsByDN[dn].push({
            productName: String(well.name ?? `Studnia DN${dn}`),
            quantity: 1,
            price: wellPrice,
            DN: dn,
            height: Number(well.height ?? 0),
            zwienczenie: String(well.zwienczenie ?? '—'),
            transportCost: Number(well.transportCost ?? 0)
        });
    }

    const items = Object.values(itemsByDN).flat();
    return { items, grandTotal };
}
