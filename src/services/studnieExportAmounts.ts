import { roundMoney } from '../utils/money';
import { projectRuryTransportAllocation } from './ruryTransport';

/** Render historic snapshots without losing cents when fractional shares are summed. */
export function projectStudnieExportAmounts(
    wells: unknown[],
    separateTransport: boolean,
    savedTotal?: unknown
) {
    let transportTotal = 0;
    const rows = wells.map((entry) => {
        const well = entry as Record<string, unknown>;
        const transport = Number(
            separateTransport || well.totalPrice != null ? (well.transportCost ?? 0) : 0
        );
        const full = Number(well.totalPrice ?? well.price ?? 0);
        const statedPrice = Number(well.price);
        const hasMatchingPrice =
            well.price != null &&
            Number.isFinite(statedPrice) &&
            Math.abs(full - (statedPrice + transport)) < 1e-9;
        const price = separateTransport
            ? Number(well.price ?? full - transport)
            : hasMatchingPrice
              ? statedPrice
              : full - transport;
        transportTotal += Number.isFinite(transport) ? transport : 0;
        const frozen =
            well.transportFrozen === true && Number.isFinite(transport) && transport >= 0;
        return {
            price: roundMoney(price),
            rawPrice: price,
            weight: frozen ? 0 : transport,
            quantity: frozen ? 0 : 1,
            frozenCost: frozen ? roundMoney(transport) : 0
        };
    });
    const priceTotal = roundMoney(rows.reduce((sum, row) => sum + row.price, 0));
    const saved = typeof savedTotal === 'number' ? savedTotal : NaN;
    const canUseSavedTotal =
        transportTotal > 0 &&
        Number.isFinite(saved) &&
        rows.every((row) => row.price === row.rawPrice) &&
        saved >= priceTotal &&
        Math.abs(saved - (priceTotal + transportTotal)) <= 0.010000001;
    const allocationTotal = canUseSavedTotal
        ? roundMoney(saved - priceTotal)
        : roundMoney(transportTotal);
    const frozenTotal = roundMoney(rows.reduce((sum, row) => sum + row.frozenCost, 0));
    const allocation = projectRuryTransportAllocation(
        rows,
        Math.max(0, roundMoney(allocationTotal - frozenTotal))
    );
    const transportByIndex = new Map(allocation.map((item) => [item.index, item.totalCents / 100]));
    return rows.map((row, index) => {
        const transportCost = row.frozenCost || transportByIndex.get(index) || 0;
        return {
            price: separateTransport ? row.price : roundMoney(row.price + transportCost),
            transportCost: separateTransport ? transportCost : 0
        };
    });
}
