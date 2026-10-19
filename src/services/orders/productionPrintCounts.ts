import prisma from '../../prismaClient';
import { parseJsonField, type User } from '../../helpers';
import { canReadDoc } from '../../utils/ownership';

/* ===== LICZNIKI WYDRUKÓW =====
 * Liczniki żyją w blobie JSON `data` (bez migracji): printCountZlecenia,
 * printCountEtykieta, printLastZleceniaAt, printLastEtykietaAt.
 * Inkrementacja odporna na lost update: predykat WHERE id+version
 * (jak PUT batch, P0-D) + retry.
 */
export type PrintCountKind = 'zlecenie' | 'etykieta';

export interface PrintCounts {
    printCountZlecenia: number;
    printCountEtykieta: number;
    printLastZleceniaAt: string | null;
    printLastEtykietaAt: string | null;
}

export function readPrintCounts(data: Record<string, unknown>): PrintCounts {
    const z = data.printCountZlecenia;
    const e = data.printCountEtykieta;
    const lz = data.printLastZleceniaAt;
    const le = data.printLastEtykietaAt;
    return {
        printCountZlecenia: typeof z === 'number' && z >= 0 ? Math.floor(z) : 0,
        printCountEtykieta: typeof e === 'number' && e >= 0 ? Math.floor(e) : 0,
        printLastZleceniaAt: typeof lz === 'string' ? lz : null,
        printLastEtykietaAt: typeof le === 'string' ? le : null
    };
}

/**
 * Ochrona liczników wydruków przed whole-array PUT z chudymi obiektami
 * (np. modal zlecenia, accept-flow — obiekty z `/index` bez pól print*).
 * Zwraca FINALNY obiekt do JSON.stringify — bez drugiego spreadu za nim.
 * Reguła per pole: jawna poprawna wartość (liczba w tym 0 / string daty)
 * wygrywa, brak lub zły typ → zachowaj starą.
 */
export function preservePrintCounts(
    rest: Record<string, unknown>,
    oldData: Record<string, unknown>
): Record<string, unknown> {
    const kept = readPrintCounts(oldData);
    const merged: Record<string, unknown> = { ...rest };
    const z = rest.printCountZlecenia;
    merged.printCountZlecenia =
        typeof z === 'number' && z >= 0 ? Math.floor(z) : kept.printCountZlecenia;
    const e = rest.printCountEtykieta;
    merged.printCountEtykieta =
        typeof e === 'number' && e >= 0 ? Math.floor(e) : kept.printCountEtykieta;
    const lz = rest.printLastZleceniaAt;
    merged.printLastZleceniaAt = typeof lz === 'string' ? lz : kept.printLastZleceniaAt;
    const le = rest.printLastEtykietaAt;
    merged.printLastEtykietaAt = typeof le === 'string' ? le : kept.printLastEtykietaAt;
    return merged;
}

/**
 * Atomowa inkrementacja licznika wydruku (optimistic locking + retry).
 * Zwraca świeże liczniki albo rzuca { status }.
 */
export async function incrementPrintCount(
    docId: string,
    kind: PrintCountKind,
    user: User | undefined
): Promise<PrintCounts> {
    const now = new Date().toISOString();
    for (let attempt = 0; attempt < 3; attempt++) {
        const row = await prisma.production_orders_rel.findUnique({
            where: { id: docId },
            select: { data: true, userId: true, version: true }
        });
        if (!row || !canReadDoc(user, row.userId)) {
            throw { status: 404, message: 'Zlecenie nie znalezione' };
        }
        const data = parseJsonField<Record<string, unknown>>(row.data, {});
        const counts = readPrintCounts(data);
        if (kind === 'zlecenie') {
            counts.printCountZlecenia += 1;
            counts.printLastZleceniaAt = now;
        } else {
            counts.printCountEtykieta += 1;
            counts.printLastEtykietaAt = now;
        }
        const nextData = JSON.stringify({
            ...data,
            printCountZlecenia: counts.printCountZlecenia,
            printCountEtykieta: counts.printCountEtykieta,
            printLastZleceniaAt: counts.printLastZleceniaAt,
            printLastEtykietaAt: counts.printLastEtykietaAt
        });
        const upd = await prisma.production_orders_rel.updateMany({
            where: { id: docId, version: row.version ?? 1 },
            data: { data: nextData, updatedAt: now, version: { increment: 1 } }
        });
        if (upd.count === 1) return counts;
        // version zmieniona równolegle — ponów odczyt
    }
    throw {
        status: 409,
        code: 'VERSION_CONFLICT',
        message: 'Zlecenie zmienione przez innego użytkownika — spróbuj ponownie'
    };
}
