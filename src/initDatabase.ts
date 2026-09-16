/**
 * initDatabase.ts — BE-01 (plan modernizacji F5): kroki bazodanowe initApp
 * wydzielone z src/app.ts. Kolejność wywołań w initApp NIE zmieniona.
 */
import prisma from './prismaClient';
import { logger } from './utils/logger';

/**
 * PRAGMA połączenia: WAL + synchronous + busy_timeout + user_version + FK.
 * connection_limit=1: pula ma jedno połączenie, pragma trzyma się go na stałe.
 */
export async function initDatabasePragmas(): Promise<void> {
    try {
        // Sekwencyjnie na jednym połączeniu (connection_limit=1) — Promise.all
        // na współdzielonym połączeniu SQLite dawał SQLITE_BUSY / race.
        await prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL');
        await prisma.$queryRawUnsafe('PRAGMA synchronous=NORMAL');
        await prisma.$queryRawUnsafe('PRAGMA busy_timeout=30000');
        await prisma.$executeRawUnsafe('PRAGMA user_version = 20000');
        await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON');
        logger.info(
            'Server',
            'PRAGMA WAL/synchronous/busy_timeout/user_version/foreign_keys ustawione'
        );
        // P1-E self-check: FK musi być realnie egzekwowane na połączeniu aplikacji.
        const fkOn = (await prisma.$queryRawUnsafe('PRAGMA foreign_keys')) as Array<{
            foreign_keys: number;
        }>;
        if (!fkOn?.[0]?.foreign_keys) {
            logger.warn(
                'Server',
                'PRAGMA foreign_keys=OFF na połączeniu — FK uśpione, działa tylko straż kodowa'
            );
        }
    } catch (err) {
        logger.warn(
            'Server',
            'Nie udało się ustawić PRAGMA WAL/synchronous/busy_timeout/user_version/foreign_keys:',
            err instanceof Error ? err.message : err
        );
    }
}

/**
 * Auto-heal schematu: indeksy i tabele dla instalacji bez migrate deploy
 * (legacy prisma db push). Idempotentne (IF NOT EXISTS). UWAGA: można wyciąć
 * po pełnym przejściu na migracje (A8) — baseline zawiera te indeksy.
 */
export async function ensureDatabaseIndexes(): Promise<void> {
    // Indeks na createdAt dla audit_logs (jeśli nie istnieje)
    try {
        await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(createdAt)`;
    } catch (err) {
        logger.warn(
            'Server',
            'Nie udało się utworzyć indeksu idx_audit_created_at:',
            err instanceof Error ? err.message : String(err)
        );
    }

    // Indeksy deduplikacji telemetrii AI
    try {
        await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "idx_logs_well" ON "ai_telemetry_logs"("wellId")`;
        await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "idx_logs_source_well" ON "ai_telemetry_logs"("solverSource", "wellId")`;
    } catch (err) {
        logger.warn(
            'Server',
            'Nie udało się utworzyć indeksów deduplikacji telemetrii AI:',
            err instanceof Error ? err.message : String(err)
        );
    }

    // Auto-heal: tabela shares (instalacje bez migrate deploy — legacy db push)
    try {
        await prisma.$executeRaw`CREATE TABLE IF NOT EXISTS "document_shares" ("id" TEXT NOT NULL PRIMARY KEY, "documentType" TEXT NOT NULL, "documentId" TEXT NOT NULL, "ownerId" TEXT NOT NULL, "sharedWithUserId" TEXT NOT NULL, "permission" TEXT NOT NULL DEFAULT 'read', "createdAt" TEXT NOT NULL, "createdBy" TEXT NOT NULL)`;
        await prisma.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "uq_share_doc_user" ON "document_shares"("documentType", "documentId", "sharedWithUserId")`;
        await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "idx_shares_sharedwith" ON "document_shares"("sharedWithUserId")`;
        await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "idx_shares_docid" ON "document_shares"("documentId")`;
        await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "idx_shares_doctype_docid" ON "document_shares"("documentType", "documentId")`;
        await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "idx_shares_owner" ON "document_shares"("ownerId")`;
    } catch (e) {
        logger.warn(
            'Server',
            'Nie udało się upewnić schematu document_shares:',
            e instanceof Error ? e.message : String(e)
        );
    }

    // Pełny schemat FTS5 (m.in. kolumna clientNumber) — idempotentne
    try {
        const { ensureFts5Schema } = await import('./utils/fts5Sync');
        await ensureFts5Schema();
    } catch (e) {
        logger.warn(
            'Server',
            'Nie udało się upewnić schematu FTS5:',
            e instanceof Error ? e.message : String(e)
        );
    }
}
