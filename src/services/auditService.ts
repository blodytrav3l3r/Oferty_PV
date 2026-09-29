/**
 * AuditService — Centralizowane logowanie audytu
 *
 * Dostarcza funkcje do logowania zmian encji wraz z obliczaniem różnic (diff),
 * debouncingiem powtarzających się aktualizacji oraz czyszczeniem starych wpisów.
 */

import prisma from '../prismaClient';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { recordAuditFailure } from '../utils/metrics';

const DEBOUNCE_SECONDS = 30;
const MAX_AUDIT_AGE_DAYS = 180;

// ─── Obliczanie różnic (Diff Computation) ───────────────────────────

/**
 * Oblicza płytką różnicę między dwoma obiektami (tylko klucze pierwszego poziomu).
 * Zwraca { changed, old } tylko ze zmodyfikowanymi polami lub null, jeśli są identyczne.
 */
export function computeDiff(
    oldObj: Record<string, unknown> | null,
    newObj: Record<string, unknown> | null
): { changed: Record<string, unknown>; old: Record<string, unknown> } | null {
    if (!oldObj || !newObj) return { changed: newObj || {}, old: oldObj || {} };

    const changed: Record<string, unknown> = {};
    const old: Record<string, unknown> = {};
    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

    for (const key of allKeys) {
        const oldVal = JSON.stringify(oldObj[key]);
        const newVal = JSON.stringify(newObj[key]);
        if (oldVal !== newVal) {
            changed[key] = newObj[key];
            old[key] = oldObj[key];
        }
    }

    // Jeśli brak zmian — zwróć null
    if (Object.keys(changed).length === 0) return null;
    return { changed, old };
}

// ─── Logowanie Audytu (Audit Logging) ───────────────────────────────

/**
 * Minimalny kontrakt bazy dla audytu: globalny prisma albo klient transakcji.
 * Przekazanie `tx` z `$transaction` wpina wpis w transakcję biznesową —
 * rollback biznesu cofa też audit (koniec phantom audit). Bez `tx` zapis
 * jest warn-only poza transakcją (jak dotąd).
 */
type RawFn = (...args: any[]) => Promise<any>;
export interface AuditDb {
    $executeRaw: RawFn;
    $queryRaw: <T>(...args: any[]) => Promise<T>;
}

/**
 * Generuje unikalny identyfikator logu audytu.
 */
function generateAuditId(): string {
    return crypto.randomUUID();
}

/**
 * Loguje wpis audytu dla zmian encji.
 * Dla akcji 'update': oblicza różnicę (diff) i stosuje debouncing (pomija zmiany w ciągu 30s).
 * Dla akcji 'create'/'delete': przechowuje pełną migawkę danych.
 * @param db opcjonalny klient transakcji — wpis w tej samej tx co biznes (atomowość).
 *   Błąd audytu NIGDY nie rzuca (warn-only): nie cofa biznesu, tylko log + metryka.
 */
export async function logAudit(
    entityType: string,
    entityId: string,
    userId: string,
    action: string,
    newData: Record<string, unknown> | null,
    oldData: Record<string, unknown> | null = null,
    db: AuditDb = prisma
): Promise<void> {
    try {
        const now = new Date().toISOString();

        if (action === 'update' && oldData && newData) {
            await logUpdateWithDebounce(entityType, entityId, userId, oldData, newData, now, db);
            return;
        }

        // Dla 'create' / 'delete': pełna migawka (snapshot)
        // Użyj raw query aby uniknąć problemów z konwersją dat
        const auditId = generateAuditId();
        const oldDataStr = oldData ? JSON.stringify(oldData) : null;
        const newDataStr = newData ? JSON.stringify(newData) : null;
        await db.$executeRaw`
            INSERT INTO audit_logs (id, entityType, entityId, userId, action, oldData, newData, createdAt)
            VALUES (${auditId}, ${entityType}, ${entityId}, ${userId}, ${action}, ${oldDataStr}, ${newDataStr}, ${now})
        `;
    } catch (e: unknown) {
        // P0.4: audit failure nie blokuje operacji biznesowej (void), ale nigdy
        // nie znika — strukturalny log z kontekstem + licznik w /metrics.
        const message = e instanceof Error ? e.message : 'Unknown error';
        recordAuditFailure();
        logger.error('AuditLog', 'Błąd zapisu logu', {
            entityType,
            entityId,
            userId,
            action,
            error: message
        });
    }
}

/**
 * Loguje aktualizację z obliczeniem różnic i debouncingiem.
 * Jeśli aktualizacja dla tej samej encji została zalogowana w ciągu DEBOUNCE_SECONDS,
 * scala diff z istniejącym wpisem (P0.4: brak utraty wcześniejszych kluczy).
 */
async function logUpdateWithDebounce(
    entityType: string,
    entityId: string,
    userId: string,
    oldData: Record<string, unknown>,
    newData: Record<string, unknown>,
    now: string,
    db: AuditDb
): Promise<void> {
    const diff = computeDiff(oldData, newData);
    if (!diff) return; // Brak rzeczywistych zmian — nie loguj

    const cutoff = new Date(new Date(now).getTime() - DEBOUNCE_SECONDS * 1000).toISOString();

    // Użyj raw query dla find (obsługa błędnych dat w bazie)
    const recentRows = await db.$queryRaw<Array<{ id: string; newData: string | null }>>`
        SELECT id, newData FROM audit_logs WHERE entityType = ${entityType} AND entityId = ${entityId}
        AND userId = ${userId} AND action = 'update' AND createdAt > ${cutoff}
        ORDER BY createdAt DESC LIMIT 1
    `;
    const recent = recentRows[0];

    if (recent) {
        // P0.4: debounce scala zamiast nadpisywać — wcześniejsze klucze diffu
        // (np. key1 z poprzedniego zapisu w oknie) nie mogą zniknąć.
        let merged: Record<string, unknown> = {};
        try {
            const prev = recent.newData ? JSON.parse(recent.newData) : {};
            if (prev && typeof prev === 'object' && !Array.isArray(prev)) merged = prev;
        } catch {
            // uszkodzony poprzedni wpis — bierzemy tylko bieżący diff
        }
        const newDataStr = JSON.stringify({ ...merged, ...diff.changed, _diffMode: true });
        await db.$executeRaw`
            UPDATE audit_logs SET newData = ${newDataStr}, createdAt = ${now} WHERE id = ${recent.id}
        `;
        return;
    }

    // Nowy wpis z diffem
    const newDataStr = JSON.stringify({ ...diff.changed, _diffMode: true });
    const auditId = generateAuditId();
    const oldDataStr = JSON.stringify({ ...diff.old, _diffMode: true });
    await db.$executeRaw`
        INSERT INTO audit_logs (id, entityType, entityId, userId, action, oldData, newData, createdAt)
        VALUES (${auditId}, ${entityType}, ${entityId}, ${userId}, 'update', ${oldDataStr}, ${newDataStr}, ${now})
    `;
}

// ─── Czyszczenie logów (Retention Cleanup) ──────────────────────────

/**
 * Usuwa logi audytu starsze niż MAX_AUDIT_AGE_DAYS.
 * Powinno być wywołane raz przy starcie aplikacji.
 */
export async function cleanupAuditLogs(): Promise<void> {
    try {
        const cutoffDate = new Date(
            Date.now() - MAX_AUDIT_AGE_DAYS * 24 * 60 * 60 * 1000
        ).toISOString();
        const BATCH_SIZE = 500;
        let totalDeleted = 0;
        let batchCount = 0;

        while (true) {
            const batch = await prisma.audit_logs.findMany({
                where: { createdAt: { lt: cutoffDate } },
                take: BATCH_SIZE,
                select: { id: true },
                orderBy: { createdAt: 'asc' }
            });

            if (batch.length === 0) break;

            await prisma.audit_logs.deleteMany({
                where: { id: { in: batch.map((r) => r.id) } }
            });

            totalDeleted += batch.length;
            batchCount++;
        }

        if (totalDeleted > 0) {
            logger.info(
                'AuditLog',
                `Wyczyszczono ${totalDeleted} logów (${batchCount} batchy) starszych niż ${MAX_AUDIT_AGE_DAYS} dni.`
            );
        }
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('AuditLog', 'Błąd czyszczenia logów', message);
    }
}
