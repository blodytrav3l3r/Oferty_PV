/**
 * AuditService — Centralizowane logowanie audytu
 *
 * Dostarcza funkcje do logowania zmian encji wraz z obliczaniem różnic (diff),
 * debouncingiem powtarzających się aktualizacji oraz czyszczeniem starych wpisów.
 */

import prisma from '../prismaClient';
import { logger } from '../utils/logger';

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
 * Generuje unikalny identyfikator logu audytu.
 */
function generateAuditId(): string {
    return Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);
}

/**
 * Loguje wpis audytu dla zmian encji.
 * Dla akcji 'update': oblicza różnicę (diff) i stosuje debouncing (pomija zmiany w ciągu 30s).
 * Dla akcji 'create'/'delete': przechowuje pełną migawkę danych.
 */
export async function logAudit(
    entityType: string,
    entityId: string,
    userId: string,
    action: string,
    newData: Record<string, unknown> | null,
    oldData: Record<string, unknown> | null = null
): Promise<void> {
    try {
        const now = new Date().toISOString();

        if (action === 'update' && oldData && newData) {
            await logUpdateWithDebounce(entityType, entityId, userId, oldData, newData, now);
            return;
        }

        // Dla 'create' / 'delete': pełna migawka (snapshot)
        // Użyj raw query aby uniknąć problemów z konwersją dat
        const auditId = generateAuditId();
        const oldDataStr = oldData ? JSON.stringify(oldData).replace(/'/g, "''") : null;
        const newDataStr = newData ? JSON.stringify(newData).replace(/'/g, "''") : null;
        await prisma.$executeRawUnsafe(
            `INSERT INTO audit_logs (id, entityType, entityId, userId, action, oldData, newData, createdAt) ` +
            `VALUES ('${auditId}', '${entityType}', '${entityId}', '${userId}', '${action}', ` +
            `${oldDataStr ? `'${oldDataStr}'` : 'NULL'}, ${newDataStr ? `'${newDataStr}'` : 'NULL'}, '${now}')`
        );
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('AuditLog', 'Błąd zapisu logu', message);
    }
}

/**
 * Loguje aktualizację z obliczeniem różnic i debouncingiem.
 * Jeśli aktualizacja dla tej samej encji została zalogowana w ciągu DEBOUNCE_SECONDS, nadpisuje ją.
 */
async function logUpdateWithDebounce(
    entityType: string,
    entityId: string,
    userId: string,
    oldData: Record<string, unknown>,
    newData: Record<string, unknown>,
    now: string
): Promise<void> {
    const diff = computeDiff(oldData, newData);
    if (!diff) return; // Brak rzeczywistych zmian — nie loguj

    const cutoff = new Date(new Date(now).getTime() - DEBOUNCE_SECONDS * 1000).toISOString();

    const recent = await prisma.audit_logs.findFirst({
        where: {
            entityType,
            entityId,
            userId,
            action: 'update',
            createdAt: { gt: cutoff }
        },
        orderBy: { createdAt: 'desc' }
    });

    if (recent) {
        // Nadpisz istniejący wpis
        await prisma.audit_logs.update({
            where: { id: recent.id },
            data: {
                newData: JSON.stringify({ ...diff.changed, _diffMode: true }),
                createdAt: now
            }
        });
        return;
    }

    // Nowy wpis z diffem
    await prisma.audit_logs.create({
        data: {
            id: generateAuditId(),
            entityType,
            entityId,
            userId,
            action: 'update',
            oldData: JSON.stringify({ ...diff.old, _diffMode: true }),
            newData: JSON.stringify({ ...diff.changed, _diffMode: true }),
            createdAt: now
        }
    });
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
        const result = await prisma.audit_logs.deleteMany({
            where: {
                createdAt: { lt: cutoffDate }
            }
        });
        if (result.count > 0) {
            logger.info(
                'AuditLog',
                `Wyczyszczono ${result.count} logów starszych niż ${MAX_AUDIT_AGE_DAYS} dni.`
            );
        }
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('AuditLog', 'Błąd czyszczenia logów', message);
    }
}

// Uruchom czyszczenie przy ładowaniu modułu
cleanupAuditLogs();
