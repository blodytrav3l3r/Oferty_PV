/**
 * initDatabase.ts — BE-01 (plan modernizacji F5): kroki bazodanowe initApp
 * wydzielone z src/app.ts. Kolejność wywołań w initApp NIE zmieniona.
 */
import prisma from './prismaClient';
import { logger } from './utils/logger';
import crypto from 'crypto';

/**
 * PRAGMA połączenia: WAL + synchronous + busy_timeout + user_version + FK.
 * Dev/test: connection_limit=1; prod Docker: connection_limit=3 (równoległe
 * odczyty WAL, pisarz nadal serializowany przez SQLite + busy_timeout).
 */
export async function initDatabasePragmas(): Promise<void> {
    try {
        // Sekwencyjnie (Promise.all na współdzielonym połączeniu SQLite
        // dawał SQLITE_BUSY / race).
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

    // Auto-heal: kolumna sessions.lastActivity (idle timeout 1h).
    // Instalacje bez migrate deploy (legacy db push) nie maja kolumny —
    // dolozenie + backfill lastActivity = createdAt. Idempotentne.
    // UWAGA: wylacznie statyczny DDL bez parametrow uzytkownika, forma
    // $executeRaw z literalem (kontrakt tests/sqlInjection.test.ts).
    // Bez nowego indeksu (celowo): max 10 sesji na usera, drift migracji 0.
    try {
        const cols = (await prisma.$queryRawUnsafe('PRAGMA table_info("sessions")')) as Array<{
            name: string;
        }>;
        if (Array.isArray(cols) && !cols.some((c) => c?.name === 'lastActivity')) {
            await prisma.$executeRaw`ALTER TABLE "sessions" ADD COLUMN "lastActivity" BIGINT`;
            await prisma.$executeRaw`UPDATE "sessions" SET "lastActivity" = "createdAt" WHERE "lastActivity" IS NULL`;
            logger.info('Server', 'Auto-heal: dodano kolumnę sessions.lastActivity');
        }
    } catch (e) {
        logger.warn(
            'Server',
            'Nie udało się upewnić schematu sessions.lastActivity:',
            e instanceof Error ? e.message : String(e)
        );
    }

    await ensureClientContactsTable();
}

/**
 * Auto-heal katalogu kontaktów klienta (Paczka 2): CREATE TABLE IF NOT EXISTS
 * + backfill legacy (clients_rel.contact/phone/email → 1 wiersz
 * isPrimary=1, tylko gdy któryś niepusty i klient nie ma jeszcze kontaktów).
 * Idempotentne. Backfill w JS (id = crypto.randomUUID — SQLite nie ma UUID).
 */
export async function ensureClientContactsTable(): Promise<void> {
    try {
        await prisma.$executeRaw`CREATE TABLE IF NOT EXISTS "client_contacts_rel" ("id" TEXT NOT NULL PRIMARY KEY, "clientId" TEXT NOT NULL, "name" TEXT NOT NULL, "phone" TEXT, "email" TEXT, "position" TEXT DEFAULT '', "isPrimary" INTEGER NOT NULL DEFAULT 0, "createdByUserId" TEXT, "createdAt" TEXT, "updatedAt" TEXT)`;
        await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "idx_client_contacts_client" ON "client_contacts_rel"("clientId")`;
    } catch (e) {
        logger.warn(
            'Server',
            'Nie udało się upewnić schematu client_contacts_rel:',
            e instanceof Error ? e.message : String(e)
        );
        return;
    }
    try {
        // UWAGA: wyłącznie statyczny DDL/DML bez parametrów użytkownika,
        // forma $queryRaw z literalem (kontrakt tests/sqlInjection.test.ts).
        const legacy =
            (await prisma.$queryRaw`SELECT c."id", c."userId", c."contact", c."phone", c."email" FROM "clients_rel" AS "c" LEFT JOIN "client_contacts_rel" AS "cc" ON "cc"."clientId" = "c"."id" WHERE "cc"."id" IS NULL`) as Array<{
                id: string;
                userId: string | null;
                contact: string | null;
                phone: string | null;
                email: string | null;
            }>;
        if (!Array.isArray(legacy) || legacy.length === 0) return;
        const now = new Date().toISOString();
        const rows = [];
        for (const r of legacy) {
            const name = (r.contact ?? '').trim();
            const phone = (r.phone ?? '').trim();
            const email = (r.email ?? '').trim();
            if (!name && !phone && !email) continue;
            rows.push({
                id: crypto.randomUUID(),
                clientId: r.id,
                name,
                phone: phone || null,
                email: email || null,
                position: '',
                isPrimary: 1,
                createdByUserId: r.userId ?? null,
                createdAt: now,
                updatedAt: now
            });
        }
        if (rows.length > 0) {
            await prisma.client_contacts_rel.createMany({ data: rows });
            logger.info(
                'Server',
                `Auto-heal: backfill katalogu kontaktów (${rows.length} wierszy)`
            );
        }
    } catch (e) {
        logger.warn(
            'Server',
            'Nie udało się wykonać backfillu client_contacts_rel:',
            e instanceof Error ? e.message : String(e)
        );
    }
}
