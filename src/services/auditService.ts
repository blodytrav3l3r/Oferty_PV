/**
 * AuditService — Centralized Audit Logging
 *
 * Provides functions for logging entity changes with diff computation,
 * debouncing repeated updates, and cleaning up old audit entries.
 */

import prisma from '../prismaClient';
import { logger } from '../utils/logger';

const DEBOUNCE_SECONDS = 30;
const MAX_AUDIT_AGE_DAYS = 180;

// ─── Diff Computation ───────────────────────────────────────────────

/**
 * Compute shallow diff between two objects (1st-level keys only).
 * Returns { changed, old } with only the modified fields, or null if identical.
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

// ─── Audit Logging ──────────────────────────────────────────────────

/**
 * Generate a unique audit log ID
 */
function generateAuditId(): string {
    return Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);
}

/**
 * Log an audit entry for entity changes.
 * For 'update' actions: computes diff and debounces repeated changes within 30s.
 * For 'create'/'delete' actions: stores full data snapshot.
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

        // Dla 'create' / 'delete': pełny snapshot
        await prisma.audit_logs.create({
            data: {
                id: generateAuditId(),
                entityType,
                entityId,
                userId,
                action,
                oldData: oldData ? JSON.stringify(oldData) : null,
                newData: newData ? JSON.stringify(newData) : null,
                createdAt: now
            }
        });
    } catch (e: any) {
        logger.error('AuditLog', 'Błąd zapisu logu', e.message);
    }
}

/**
 * Log an update with diff computation and debouncing.
 * If an update for the same entity was logged within DEBOUNCE_SECONDS, overwrite it.
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

// ─── Retention Cleanup ──────────────────────────────────────────────

/**
 * Delete audit logs older than MAX_AUDIT_AGE_DAYS.
 * Should be called once at application startup.
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
    } catch (e: any) {
        logger.error('AuditLog', 'Błąd czyszczenia logów', e.message);
    }
}

// Run cleanup on module load
cleanupAuditLogs();
