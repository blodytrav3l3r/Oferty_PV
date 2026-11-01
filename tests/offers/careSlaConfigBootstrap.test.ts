/*
 * tests/offers/careSlaConfigBootstrap.test.ts
 * Auto-heal startu: wiersz `care_sla_config.global` powstaje raz, a nieczytelne
 * wartości (te same, które odrzuca odczyt = INVALID_SLA_CONFIG) są naprawiane
 * do defaultu 24/7/72. Poprawne wartości admina zostają nietknięte.
 */
import { DatabaseSync } from 'node:sqlite';
import type { Prisma } from '../../generated/prisma';
import { ensureSlaConfigRow, DEFAULT_SLA } from '../../src/services/careService';

const NOW = '2026-10-10T12:00:00.000Z';

function freshDb(): DatabaseSync {
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE TABLE care_sla_config (id TEXT PRIMARY KEY, "firstContactH" INTEGER, "staleD" INTEGER, "escalationH" INTEGER, "updatedBy" TEXT, "updatedAt" TEXT);
        CREATE TABLE care_sla_scopes ("scopeType" TEXT NOT NULL, "scopeId" TEXT NOT NULL, "firstContactH" INTEGER NOT NULL, "staleD" INTEGER NOT NULL, "escalationH" INTEGER NOT NULL, "updatedBy" TEXT, "updatedAt" TEXT,
            CONSTRAINT "care_sla_scopes_pkey" PRIMARY KEY ("scopeType", "scopeId"));`);
    return db;
}

function fake(db: DatabaseSync) {
    const run = (q: Prisma.Sql) => {
        const raw = q as unknown as { sql: string; values: unknown[] };
        return { sql: raw.sql, values: raw.values };
    };
    return {
        $queryRaw: async <T>(...args: any[]): Promise<T> => {
            const { sql, values } = run(args[0] as Prisma.Sql);
            return db.prepare(sql).all(...(values as never[])) as unknown as T;
        },
        $executeRaw: async (...args: any[]): Promise<number> => {
            const { sql, values } = run(args[0] as Prisma.Sql);
            const info = db.prepare(sql).run(...(values as never[]));
            return Number(info.changes);
        }
    };
}

type SlaRow = {
    firstContactH: unknown;
    staleD: unknown;
    escalationH: unknown;
    updatedBy: string | null;
    updatedAt: string | null;
};

function readGlobal(db: DatabaseSync): SlaRow | undefined {
    return db
        .prepare(
            `SELECT "firstContactH", "staleD", "escalationH", "updatedBy", "updatedAt" FROM care_sla_config WHERE id = 'global'`
        )
        .get() as SlaRow | undefined;
}

function readScoped(db: DatabaseSync, scopeType: string, scopeId: string): SlaRow | undefined {
    return db
        .prepare(
            `SELECT "firstContactH", "staleD", "escalationH", "updatedBy", "updatedAt" FROM care_sla_scopes WHERE "scopeType" = ? AND "scopeId" = ?`
        )
        .get(scopeType, scopeId) as SlaRow | undefined;
}

describe('ensureSlaConfigRow (auto-heal startu)', () => {
    it('tworzy wiersz global z domyślnymi progami 24/7/72', async () => {
        const db = freshDb();
        try {
            expect(await ensureSlaConfigRow(fake(db), NOW)).toEqual({
                created: true,
                globalRepaired: false,
                scopedRepaired: 0
            });
            expect(readGlobal(db)).toEqual({
                firstContactH: DEFAULT_SLA.firstContactH,
                staleD: DEFAULT_SLA.staleD,
                escalationH: DEFAULT_SLA.escalationH,
                updatedBy: 'bootstrap',
                updatedAt: NOW
            });
        } finally {
            db.close();
        }
    });

    it('jest idempotentny — drugie wywołanie nic nie zmienia', async () => {
        const db = freshDb();
        try {
            await ensureSlaConfigRow(fake(db), NOW);
            expect(await ensureSlaConfigRow(fake(db), '2027-01-01T00:00:00.000Z')).toEqual({
                created: false,
                globalRepaired: false,
                scopedRepaired: 0
            });
            expect(readGlobal(db)?.updatedAt).toBe(NOW);
        } finally {
            db.close();
        }
    });

    it('nie nadpisuje progów ustawionych przez admina', async () => {
        const db = freshDb();
        try {
            db.prepare(
                `INSERT INTO care_sla_config (id, "firstContactH", "staleD", "escalationH", "updatedBy", "updatedAt")
                 VALUES ('global', 12, 3, 36, 'admin', '2026-09-01T00:00:00.000Z')`
            ).run();
            expect(await ensureSlaConfigRow(fake(db), NOW)).toEqual({
                created: false,
                globalRepaired: false,
                scopedRepaired: 0
            });
            expect(readGlobal(db)).toEqual({
                firstContactH: 12,
                staleD: 3,
                escalationH: 36,
                updatedBy: 'admin',
                updatedAt: '2026-09-01T00:00:00.000Z'
            });
        } finally {
            db.close();
        }
    });

    it('naprawia nieczytelne wartości wiersza global (tekst, 0, ujemna)', async () => {
        const db = freshDb();
        try {
            db.prepare(
                `INSERT INTO care_sla_config (id, "firstContactH", "staleD", "escalationH", "updatedBy", "updatedAt")
                 VALUES ('global', 'abc', 0, -5, 'admin', '2026-09-01T00:00:00.000Z')`
            ).run();
            expect(await ensureSlaConfigRow(fake(db), NOW)).toEqual({
                created: false,
                globalRepaired: true,
                scopedRepaired: 0
            });
            expect(readGlobal(db)).toEqual({
                firstContactH: DEFAULT_SLA.firstContactH,
                staleD: DEFAULT_SLA.staleD,
                escalationH: DEFAULT_SLA.escalationH,
                updatedBy: 'bootstrap',
                updatedAt: NOW
            });
        } finally {
            db.close();
        }
    });

    it('naprawia tylko nieczytelne pola, resztę zostawia', async () => {
        const db = freshDb();
        try {
            db.prepare(
                `INSERT INTO care_sla_config (id, "firstContactH", "staleD", "escalationH", "updatedBy", "updatedAt")
                 VALUES ('global', 12, 'abc', 36, 'admin', '2026-09-01T00:00:00.000Z')`
            ).run();
            await ensureSlaConfigRow(fake(db), NOW);
            expect(readGlobal(db)).toEqual({
                firstContactH: 12,
                staleD: DEFAULT_SLA.staleD,
                escalationH: 36,
                updatedBy: 'bootstrap',
                updatedAt: NOW
            });
        } finally {
            db.close();
        }
    });

    it('naprawia nieczytelne progi per zespół/user, poprawne zostawia', async () => {
        const db = freshDb();
        try {
            db.prepare(
                `INSERT INTO care_sla_scopes ("scopeType", "scopeId", "firstContactH", "staleD", "escalationH", "updatedBy", "updatedAt")
                 VALUES ('team', 'p1', 0, 3, 36, 'p1', '2026-09-01T00:00:00.000Z'),
                        ('user', 'u1', 12, 3, 36, 'u1', '2026-09-01T00:00:00.000Z')`
            ).run();
            expect(await ensureSlaConfigRow(fake(db), NOW)).toEqual({
                created: true,
                globalRepaired: false,
                scopedRepaired: 1
            });
            expect(readScoped(db, 'team', 'p1')).toEqual({
                firstContactH: DEFAULT_SLA.firstContactH,
                staleD: 3,
                escalationH: 36,
                updatedBy: 'bootstrap',
                updatedAt: NOW
            });
            expect(readScoped(db, 'user', 'u1')).toEqual({
                firstContactH: 12,
                staleD: 3,
                escalationH: 36,
                updatedBy: 'u1',
                updatedAt: '2026-09-01T00:00:00.000Z'
            });
        } finally {
            db.close();
        }
    });
});
