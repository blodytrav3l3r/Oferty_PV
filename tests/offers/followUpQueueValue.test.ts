/*
 * tests/offers/followUpQueueValue.test.ts
 * REGRESJA: oferty studni z totalPrice=0 w kolumnie pokazywały 0,00 PLN
 * w Kolejce opieki mimo żywego totalBrutto w blobie (FE nie wysyła
 * top-level totalPrice; zapis lądował na 0, a COALESCE brał kolumnę).
 */
import { DatabaseSync } from 'node:sqlite';
import type { Prisma } from '../../generated/prisma';
import { getCareQueue, type CareUser } from '../../src/services/careService';

const NOW = '2026-10-10T12:00:00.000Z';
const U1: CareUser = { id: 'u1', role: 'user', subUsers: [] };

function freshDb(): DatabaseSync {
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE TABLE offers_rel (id TEXT PRIMARY KEY, "userId" TEXT, "createdAt" TEXT, "offer_number" TEXT, "clientName" TEXT, "investName" TEXT, "data" TEXT);
        CREATE TABLE offers_studnie_rel (id TEXT PRIMARY KEY, "userId" TEXT, "createdAt" TEXT, "offer_number" TEXT, "clientName" TEXT, "investName" TEXT, "totalPrice" REAL, "data" TEXT);
        CREATE TABLE document_shares (id TEXT PRIMARY KEY, "sharedWithUserId" TEXT, "documentType" TEXT, "documentId" TEXT);
        CREATE TABLE care_states ("offerKind" TEXT NOT NULL, "offerId" TEXT NOT NULL, "snoozedUntil" TEXT, "doneAt" TEXT, "updatedBy" TEXT, "updatedAt" TEXT NOT NULL,
            CONSTRAINT "care_states_pkey" PRIMARY KEY ("offerKind", "offerId"));
        CREATE TABLE offer_follow_ups (id TEXT PRIMARY KEY, "offerKind" TEXT, "offerId" TEXT, "createdByUserId" TEXT, "contactedAt" TEXT, "createdAt" TEXT, outcome TEXT, "nextContactAt" TEXT, note TEXT);`);
    const ins = db.prepare(
        'INSERT INTO offers_studnie_rel (id, "userId", "createdAt", "totalPrice", "data") VALUES (?,?,?,?,?)'
    );
    // a: kolumna 0 + żywe totalBrutto w blobie (scenariusz ze zgłoszenia).
    ins.run('a', 'u1', '2026-10-01T00:00:00.000Z', 0, JSON.stringify({ totalBrutto: 999.99 }));
    // b: niezerowa kolumna wygrywa z blobem.
    ins.run('b', 'u1', '2026-10-01T00:00:00.000Z', 500, JSON.stringify({ totalBrutto: 999 }));
    // c: kolumna 0 + brak totalBrutto, suma wellsExport.
    ins.run(
        'c',
        'u1',
        '2026-10-01T00:00:00.000Z',
        0,
        JSON.stringify({ wellsExport: [{ totalPrice: 100 }, { totalPrice: 50 }] })
    );
    // d: kolumna 0 + pusty blob = 0.
    ins.run('d', 'u1', '2026-10-01T00:00:00.000Z', 0, JSON.stringify({}));
    return db;
}

function fake(db: DatabaseSync) {
    return {
        $queryRaw: async <T>(...args: any[]): Promise<T> => {
            const q = args[0] as Prisma.Sql;
            const raw = q as unknown as { sql: string; values: unknown[] };
            return db.prepare(raw.sql).all(...(raw.values as never[])) as unknown as T;
        }
    };
}

describe('wartość studni w kolejce (guard 0-kolumny)', () => {
    it('kolumna 0 + blob.totalBrutto → wartość z bloba', async () => {
        const db = freshDb();
        try {
            const { items } = await getCareQueue(fake(db), U1, { nowIso: NOW, limit: 50 });
            const byId = new Map(items.map((r) => [r.offerId, r.value]));
            expect(byId.get('a')).toBeCloseTo(999.99, 2);
            expect(byId.get('b')).toBe(500);
            expect(byId.get('c')).toBe(150);
            expect(byId.get('d')).toBe(0);
            db.close();
        } catch (e) {
            try {
                db.close();
            } catch {
                /* ignore */
            }
            throw e;
        }
    });

    it('obiekt i kontakt: kolumna wygrywa, fallback blob/budowa, braki = null', async () => {
        const db = freshDb();
        try {
            db.prepare(
                'INSERT INTO offers_rel (id, "userId", "createdAt", "investName", "data") VALUES (?,?,?,?,?)'
            ).run(
                'r1',
                'u1',
                '2026-10-01T00:00:00.000Z',
                'Obiekt Kolumna',
                JSON.stringify({
                    investName: 'Obiekt Blob',
                    investAddress: 'ul. Testowa 1',
                    contactPerson: 'Jan Kowalski',
                    clientPhone: '601000111',
                    clientEmail: 'jan@example.com'
                })
            );
            db.prepare(
                'INSERT INTO offers_studnie_rel (id, "userId", "createdAt", "totalPrice", "investName", "data") VALUES (?,?,?,?,?,?)'
            ).run(
                's1',
                'u1',
                '2026-10-01T00:00:00.000Z',
                0,
                null,
                JSON.stringify({
                    budowa: 'Obiekt Budowa',
                    clientContacts: [
                        { name: 'Anna Nowak', phone: '602000222', email: 'anna@example.com' }
                    ]
                })
            );
            const { items } = await getCareQueue(fake(db), U1, { nowIso: NOW, limit: 50 });
            const byId = new Map(items.map((r) => [r.offerId, r]));
            const r1 = byId.get('r1');
            expect(r1?.investName).toBe('Obiekt Kolumna');
            expect(r1?.investAddress).toBe('ul. Testowa 1');
            expect(r1?.contactPerson).toBe('Jan Kowalski');
            expect(r1?.phone).toBe('601000111');
            expect(r1?.email).toBe('jan@example.com');
            const s1 = byId.get('s1');
            expect(s1?.investName).toBe('Obiekt Budowa');
            expect(s1?.investAddress).toBeNull();
            expect(s1?.contactPerson).toBe('Anna Nowak');
            expect(s1?.phone).toBe('602000222');
            expect(s1?.email).toBe('anna@example.com');
            const a = byId.get('a');
            expect(a?.investName).toBeNull();
            expect(a?.investAddress).toBeNull();
            expect(a?.contactPerson).toBeNull();
            expect(a?.email).toBeNull();
            db.close();
        } catch (e) {
            try {
                db.close();
            } catch {
                /* ignore */
            }
            throw e;
        }
    });
});
