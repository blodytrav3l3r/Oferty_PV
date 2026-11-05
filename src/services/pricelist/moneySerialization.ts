import type { Prisma } from '../../../generated/prisma-postgres/client';

function isPrismaDecimal(value: unknown): value is Prisma.Decimal {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as { toNumber?: unknown };
    return typeof candidate.toNumber === 'function';
}

export function decimalMoneyValueToNumber(
    value: Prisma.Decimal | number | null | undefined
): number | null {
    if (value === null || value === undefined) return null;
    const normalized = isPrismaDecimal(value) ? value.toNumber() : value;
    if (!Number.isFinite(normalized)) throw new TypeError('Expected a finite monetary value');
    return normalized;
}

/** Convert only explicitly identified money columns at JSON/API boundaries. */
export function decimalMoneyRowsToNumbers<
    T extends Record<string, unknown>,
    K extends keyof T & string
>(rows: readonly T[], fields: readonly K[]): Array<Omit<T, K> & { [P in K]: number | null }> {
    return rows.map((row) => {
        const normalized: Record<string, unknown> = { ...row };
        for (const field of fields) {
            const value = normalized[field];
            if (value === null || value === undefined) continue;
            if (isPrismaDecimal(value)) normalized[field] = value.toNumber();
            else if (typeof value !== 'number' || !Number.isFinite(value)) {
                throw new TypeError(`Expected a finite monetary value for ${field}`);
            }
        }
        return normalized as Omit<T, K> & { [P in K]: number | null };
    });
}
