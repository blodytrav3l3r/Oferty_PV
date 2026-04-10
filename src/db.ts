import prisma from './prismaClient';
import { logger } from './utils/logger';

/**
 * Oblicza diff między dwoma obiektami (shallow, 1. poziom kluczy).
 * Zwraca { changed, old } — tylko zmienione pola.
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

const DEBOUNCE_SECONDS = 30;

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

        // Dla 'update': oblicz diff i debounce
        if (action === 'update' && oldData && newData) {
            const diff = computeDiff(oldData, newData);
            if (!diff) return; // Brak rzeczywistych zmian — nie loguj

            // Debounce: sprawdź czy istnieje wpis z ostatnich 30s
            const recent = await prisma.audit_logs.findFirst({
                where: {
                    entityType,
                    entityId,
                    userId,
                    action: 'update',
                    createdAt: {
                        gt: new Date(
                            new Date(now).getTime() - DEBOUNCE_SECONDS * 1000
                        ).toISOString()
                    }
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
                    id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5),
                    entityType,
                    entityId,
                    userId,
                    action,
                    oldData: JSON.stringify({ ...diff.old, _diffMode: true }),
                    newData: JSON.stringify({ ...diff.changed, _diffMode: true }),
                    createdAt: now
                }
            });
            return;
        }

        // Dla 'create' / 'delete': pełny snapshot
        await prisma.audit_logs.create({
            data: {
                id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5),
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

// Retencja: usuwanie logów starszych niż 180 dni (uruchamiane przy starcie)
const MAX_AUDIT_AGE_DAYS = 180;
export async function cleanupAuditLogs(): Promise<void> {
    try {
        const cutoffDate = new Date(
            Date.now() - MAX_AUDIT_AGE_DAYS * 24 * 60 * 60 * 1000
        ).toISOString();
        const result = await prisma.audit_logs.deleteMany({
            where: {
                createdAt: {
                    lt: cutoffDate
                }
            }
        });
        if (result.count > 0) {
            logger.info('AuditLog', `Wyczyszczono ${result.count} logów starszych niż ${MAX_AUDIT_AGE_DAYS} dni.`);
        }
    } catch (e: any) {
        logger.error('AuditLog', 'Błąd czyszczenia logów', e.message);
    }
}

// Run cleanup on module load
cleanupAuditLogs();

export { prisma } from './prismaClient';
