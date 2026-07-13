import prisma, { Prisma } from '../prismaClient';

export const ALLOWED_SORT_COLS = new Set(['createdAt', 'updatedAt', 'offer_number']);
export const ALLOWED_SORT_DIRS = new Set(['ASC', 'DESC']);

export function parseStudnieDate(raw: unknown): string {
    if (typeof raw === 'number') return new Date(raw).toISOString();
    if (raw instanceof Date) return raw.toISOString();
    if (typeof raw === 'string') {
        if (/^\d{13}$/.test(raw)) return new Date(Number(raw)).toISOString();
        if (/^\d+$/.test(raw)) return new Date(Number(raw)).toISOString();
        return raw;
    }
    return new Date().toISOString();
}

export async function fetchStudnieOffers(
    whereCondition: Prisma.Sql,
    sortCol: string,
    sortDir: string,
    skip: number,
    limit: number
) {
    const offers = await prisma.$queryRaw<
        Array<{
            id: string;
            userId: string | null;
            offer_number: string | null;
            state: string | null;
            data: string | null;
            history: string | null;
            createdAt: string | null;
            updatedAt: string | null;
        }>
    >`SELECT id, "userId", "offer_number", state, data, history,
        CASE WHEN "createdAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
            THEN datetime(CAST("createdAt" AS INTEGER)/1000, 'unixepoch')
            ELSE "createdAt" END as "createdAt",
        CASE WHEN "updatedAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
            THEN datetime(CAST("updatedAt" AS INTEGER)/1000, 'unixepoch')
            ELSE "updatedAt" END as "updatedAt"
     FROM offers_studnie_rel ${whereCondition}
     ORDER BY ${Prisma.raw(sortCol + ' ' + sortDir)}
     LIMIT ${limit} OFFSET ${skip}`;

    const countResult = await prisma.$queryRaw<Array<{ cnt: number }>>`
        SELECT COUNT(*) as cnt FROM offers_studnie_rel ${whereCondition}`;
    const totalCount = Number(countResult[0]?.cnt ?? 0);

    const mapped = offers.map((offer) => {
        let parsedData: Record<string, unknown> = {};
        try {
            if (offer.data) parsedData = JSON.parse(offer.data);
        } catch {}

        let studnieHistory: unknown[] = [];
        try {
            studnieHistory = JSON.parse(offer.history || '[]');
        } catch {}

        let studnieSpread: Record<string, unknown> = {};
        if (offer.data) {
            try {
                studnieSpread = JSON.parse(offer.data);
            } catch {}
        }

        return {
            id: offer.id,
            type: 'studnia_oferta',
            userId: offer.userId,
            title: `Oferta Studnia ${offer.offer_number || offer.id}`,
            price: parsedData.totalPrice || 0,
            status: offer.state === 'final' ? 'active' : 'draft',
            createdAt: offer.createdAt || new Date().toISOString(),
            updatedAt: offer.updatedAt || offer.createdAt || new Date().toISOString(),
            lastEditedBy: offer.userId,
            data: parsedData,
            history: studnieHistory,
            ...studnieSpread
        };
    });

    return { mapped, totalCount };
}
