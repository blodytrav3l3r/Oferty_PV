import type { User } from '../helpers';
import prisma from '../prismaClient';
import { canReadDoc, canWriteDoc } from './ownership';
import { logger } from './logger';

/**
 * P1.1: ownership gate dla telemetrii pasywnej.
 *
 * Telemetria (ai/config, ai/event, acceptance-full, reward) zapisuje
 * `offerId`/`wellId`/`telemetryId` podane przez klienta. Bez gate'a
 * dowolny user dopisywał sygnały ML do cudzej oferty (label poisoning).
 *
 * Zasada (fail-closed tylko dla istniejących dokumentów):
 * - `offerId` pasuje do istniejącej oferty rury/studni, a caller nie ma
 *   do niej `canReadDoc` → false (403).
 * - `offerId` nieznane (draft, nieutrwolony) → true (telemetria pasywna
 *   nie blokuje UI przed zapisem oferty).
 * - wiersz telemetry ma właściciela (`userId`) → wymagany `canWriteDoc`.
 * - wiersz bez właściciela i bez oferty (legacy) → true (brak atrybucji).
 */

export async function assertOfferReadable(
    user: User | undefined,
    offerId: string | null | undefined
): Promise<boolean> {
    if (!offerId) return true;
    try {
        const [rury, studnie] = await Promise.all([
            prisma.offers_rel.findUnique({
                where: { id: offerId },
                select: { userId: true }
            }),
            prisma.offers_studnie_rel.findUnique({
                where: { id: offerId },
                select: { userId: true }
            })
        ]);
        const owner = rury?.userId ?? studnie?.userId ?? null;
        // Nieznane offerId (draft) — nie blokuj telemetrii pasywnej.
        if (owner === null && !rury && !studnie) return true;
        return canReadDoc(user, owner);
    } catch (e) {
        logger.warn('TelemetryOwnership', 'Błąd sprawdzania oferty (fail-closed)', String(e));
        return false;
    }
}

type TelemetryRowRef = {
    userId: string | null;
    offerId: string | null;
} | null;

export async function assertTelemetryRowWritable(
    user: User | undefined,
    row: TelemetryRowRef
): Promise<boolean> {
    if (!row) return true;
    if (row.userId && !canWriteDoc(user, row.userId)) return false;
    if (!row.userId && row.offerId) {
        return assertOfferReadable(user, row.offerId);
    }
    return true;
}

/** Gate dla `telemetryId` (lub fallback `wellId` → najnowszy rekord studni). */
export async function assertTelemetryIdWritable(
    user: User | undefined,
    telemetryId: string | null | undefined,
    wellId?: string | null
): Promise<boolean> {
    try {
        if (telemetryId) {
            const row = await prisma.ai_telemetry_logs.findUnique({
                where: { id: telemetryId },
                select: { userId: true, offerId: true }
            });
            if (row) return assertTelemetryRowWritable(user, row);
            // Nieznane telemetryId może być ID studni (kontrakt offerSave.js) —
            // sprawdź fallback po wellId zanim odmówisz.
            if (!wellId) return true;
        }
        if (wellId) {
            const latest = await prisma.ai_telemetry_logs.findFirst({
                where: { wellId },
                orderBy: { createdAt: 'desc' },
                select: { userId: true, offerId: true }
            });
            if (latest) return assertTelemetryRowWritable(user, latest);
        }
        return true;
    } catch (e) {
        logger.warn('TelemetryOwnership', 'Błąd sprawdzania wiersza (fail-closed)', String(e));
        return false;
    }
}
