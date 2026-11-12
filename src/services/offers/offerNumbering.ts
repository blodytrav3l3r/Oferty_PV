import { Prisma } from '../../prismaClient';

type OfferModule = 'rury' | 'studnie';

export function getCurrentOfferNumberYear(date = new Date()): number {
    return Number(
        new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Europe/Warsaw' }).format(date)
    );
}

interface OfferNumberTable {
    tableName: 'offers_rel' | 'offers_studnie_rel';
    prefix: 'OF' | 'OS';
}

const OFFER_NUMBER_TABLES: Record<OfferModule, OfferNumberTable> = {
    rury: { tableName: 'offers_rel', prefix: 'OF' },
    studnie: { tableName: 'offers_studnie_rel', prefix: 'OS' }
};

function organizationUnitCode(organizationUnit: string | null | undefined): 'ASM' | 'WL' {
    return organizationUnit === 'WL_WLOCLAWEK' ? 'WL' : 'ASM';
}

function getNumberPattern(prefix: 'OF' | 'OS', unitCode: 'ASM' | 'WL', year: number): string {
    return `^${prefix}/([0-9]+)/${unitCode}/${year}$`;
}

export async function allocateNextOfferNumber(
    tx: Prisma.TransactionClient,
    module: OfferModule,
    organizationUnit: string | null | undefined,
    year: number = new Date().getFullYear()
): Promise<string> {
    const { tableName, prefix } = OFFER_NUMBER_TABLES[module];
    const unitCode = organizationUnitCode(organizationUnit);
    const pattern = getNumberPattern(prefix, unitCode, year);
    const lockKey = `offer-number:${tableName}:${unitCode}:${year}`;

    await tx.$queryRaw`WITH advisory_lock AS MATERIALIZED (
        SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
    )
    SELECT 1 AS lock_acquired FROM advisory_lock`;

    const rows =
        tableName === 'offers_rel'
            ? await tx.$queryRaw<Array<{ maxNumber: bigint | null }>>`
                  SELECT MAX((regexp_match("offer_number", ${pattern}))[1]::bigint) AS "maxNumber"
                  FROM "offers_rel"
                  WHERE "offer_number" ~ ${pattern}
              `
            : await tx.$queryRaw<Array<{ maxNumber: bigint | null }>>`
                  SELECT MAX((regexp_match("offer_number", ${pattern}))[1]::bigint) AS "maxNumber"
                  FROM "offers_studnie_rel"
                  WHERE "offer_number" ~ ${pattern}
              `;

    const nextNumber = Number(rows[0]?.maxNumber ?? 0n) + 1;
    return `${prefix}/${String(nextNumber).padStart(6, '0')}/${unitCode}/${year}`;
}

export function withOfferNumber(dataJson: string, number: string): string {
    const data = JSON.parse(dataJson) as Record<string, unknown>;
    return JSON.stringify({
        ...data,
        number,
        ...(Object.prototype.hasOwnProperty.call(data, 'offer_number')
            ? { offer_number: number }
            : {})
    });
}

function stableJson(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
    if (!value || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
        .filter((key) => key !== 'createdAt' && key !== 'updatedAt')
        .sort()
        .map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`)
        .join(',')}}`;
}

export function isSameGeneratedOfferRetry(
    existingData: string | null,
    incomingData: Record<string, unknown>,
    assignedNumber: string
): boolean {
    if (!existingData) return false;
    try {
        const existing = JSON.parse(existingData) as Record<string, unknown>;
        const incoming = { ...incomingData };
        delete incoming.generateOfferNumber;
        delete incoming.version;
        delete incoming.pricelistVersionId;
        existing.number = assignedNumber;
        incoming.number = assignedNumber;
        if (Object.prototype.hasOwnProperty.call(existing, 'offer_number'))
            existing.offer_number = assignedNumber;
        if (Object.prototype.hasOwnProperty.call(incoming, 'offer_number'))
            incoming.offer_number = assignedNumber;
        return stableJson(existing) === stableJson(incoming);
    } catch {
        return false;
    }
}
