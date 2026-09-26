import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { DatabaseSync } from 'node:sqlite';
// @ts-ignore - skrypt .cjs bez deklaracji typow
import { backfillOfferCounts } from '../../scripts/backfill-offer-counts.cjs';

// Regresja: kartoteka pokazywala "0 poz. / 0 studni" mimo zywych pozycji.
// Dwa zrodla: (1) search.ts bral stale wellCount=0 znad bloba (COALESCE widzi
// 0 jako wartosc), (2) slim-write czyscil offer_items_rel, (3) frontend nie
// czytal top-level wellsCount/itemsCount z ksztaltow light.
describe('kartotekaHelpers getOfferItemCount (prawdziwa funkcja z vm)', () => {
    let getOfferItemCount: any;

    beforeEach(() => {
        const file = path.join(__dirname, '../../public/js/kartoteka/kartotekaHelpers.js');
        const code = fs.readFileSync(file, 'utf8');
        const esc = (s: unknown) => String(s ?? '');
        const context: any = { console, escapeHtml: esc, window: null as any };
        context.window = { escapeHtml: esc };
        vm.createContext(context);
        vm.runInContext(code, context);
        getOfferItemCount = context.window.getOfferItemCount;
    });

    test('studnie LIST: data.wellsCount', () => {
        expect(getOfferItemCount({ type: 'studnia_oferta', data: { wellsCount: 4 } })).toBe(4);
    });

    test('rury LIST: data.itemsCount', () => {
        expect(getOfferItemCount({ type: 'offer', data: { itemsCount: 5 } })).toBe(5);
    });

    test('ksztalt light: top-level wellsCount/itemsCount', () => {
        expect(getOfferItemCount({ type: 'studnia_oferta', wellsCount: 2 })).toBe(2);
        expect(getOfferItemCount({ type: 'offer', itemsCount: 3 })).toBe(3);
    });

    test('pelne tablice wciaz wygrywaja z licznikami', () => {
        expect(
            getOfferItemCount({
                type: 'studnia_oferta',
                wells: [{}, {}],
                data: { wellsCount: 9 }
            })
        ).toBe(2);
    });

    test('brak danych: 0, nie undefined/NaN', () => {
        expect(getOfferItemCount({ type: 'offer', data: {} })).toBe(0);
        expect(getOfferItemCount({ type: 'studnia_oferta' })).toBe(0);
    });
});

describe('search.ts d_wellsCount: kolumna 0/NULL nie maskuje bloba', () => {
    const CASE_SQL = `CASE WHEN s."wellCount" IS NULL OR s."wellCount" = 0
        THEN json_array_length(s.data, '$.wells')
        ELSE s."wellCount" END AS "d_wellsCount"`;

    test('semantyka CASE na zywych danych', () => {
        const db = new DatabaseSync(':memory:');
        db.exec('CREATE TABLE t ("wellCount" INTEGER, data TEXT)');
        const ins = db.prepare('INSERT INTO t VALUES (?, ?)');
        ins.run(0, JSON.stringify({ wells: [{ id: 'a' }, { id: 'b' }] }));
        ins.run(null, JSON.stringify({ wells: [{ id: 'a' }] }));
        ins.run(7, JSON.stringify({ wells: [{ id: 'a' }] }));
        ins.run(0, JSON.stringify({}));
        const rows = db
            .prepare(
                `SELECT ${CASE_SQL.replaceAll('s.', 't.').replaceAll('s."wellCount"', 't."wellCount"')} FROM t`
            )
            .all() as Array<{ d_wellsCount: number | null }>;
        db.close();
        expect(rows.map((r) => r.d_wellsCount)).toEqual([2, 1, 7, null]);
    });

    test('search.ts nie zawiera blednego COALESCE dla wellCount', () => {
        const src = fs.readFileSync(
            path.join(__dirname, '../../src/routes/offers/search.ts'),
            'utf8'
        );
        expect(src).not.toContain('COALESCE(s."wellCount"');
        expect(src).toContain('"wellCount" = 0');
    });
});

describe('backfill-offer-counts (mock prisma)', () => {
    const mockPrisma = (studnie: any[], rury: any[], relCounts: Record<string, number>) => {
        const calls: any = { studnieUpdate: [], ruryCreate: [] };
        return {
            calls,
            prisma: {
                offers_studnie_rel: {
                    findMany: async () => studnie,
                    update: async (q: any) => {
                        calls.studnieUpdate.push(q);
                        return {};
                    }
                },
                offers_rel: { findMany: async () => rury },
                offer_items_rel: {
                    count: async (q: any) => relCounts[q.where.offerId] ?? 0,
                    createMany: async (q: any) => {
                        calls.ruryCreate.push(q);
                        return { count: q.data.length };
                    }
                }
            }
        };
    };

    test('dry-run nic nie zapisuje, raportuje stale wiersze', async () => {
        const { calls, prisma } = mockPrisma(
            [
                {
                    id: 's1',
                    offer_number: 'OS/1',
                    wellCount: 0,
                    data: JSON.stringify({ wells: [{}, {}] })
                }
            ],
            [
                {
                    id: 'o1',
                    offer_number: 'OF/1',
                    data: JSON.stringify({ items: [{ productId: 'p1', quantity: 2 }] })
                }
            ],
            {}
        );
        const rep = await backfillOfferCounts(prisma as any, { apply: false });
        expect(rep.studnieRows).toHaveLength(1);
        expect(rep.studnieRows[0].to).toBe(2);
        expect(rep.ruryRows).toHaveLength(1);
        expect(calls.studnieUpdate).toHaveLength(0);
        expect(calls.ruryCreate).toHaveLength(0);
    });

    test('apply naprawia i pomija pozycje bez productId', async () => {
        const { calls, prisma } = mockPrisma(
            [
                {
                    id: 's1',
                    offer_number: 'OS/1',
                    wellCount: null,
                    data: JSON.stringify({ wells: [{}] })
                }
            ],
            [
                {
                    id: 'o1',
                    offer_number: 'OF/1',
                    data: JSON.stringify({ items: [{ productId: 'p1' }, { nope: 1 }] })
                }
            ],
            {}
        );
        const rep = await backfillOfferCounts(prisma as any, { apply: true });
        expect(rep.studnieFixed).toBe(1);
        expect(rep.ruryFixed).toBe(1);
        expect(rep.rurySkipped).toBe(1);
        expect(calls.studnieUpdate[0]).toEqual({
            where: { id: 's1' },
            data: { wellCount: 1 }
        });
        expect(calls.ruryCreate[0].data).toHaveLength(1);
        expect(calls.ruryCreate[0].data[0].offerId).toBe('o1');
    });

    test('zdrowe wiersze nietkniete', async () => {
        const { calls, prisma } = mockPrisma(
            [
                {
                    id: 's1',
                    offer_number: 'OS/1',
                    wellCount: 3,
                    data: JSON.stringify({ wells: [{}, {}, {}] })
                }
            ],
            [
                {
                    id: 'o1',
                    offer_number: 'OF/1',
                    data: JSON.stringify({ items: [{ productId: 'p1' }] })
                }
            ],
            { o1: 1 }
        );
        const rep = await backfillOfferCounts(prisma as any, { apply: true });
        expect(rep.studnieRows).toHaveLength(0);
        expect(rep.ruryRows).toHaveLength(0);
        expect(calls.studnieUpdate).toHaveLength(0);
        expect(calls.ruryCreate).toHaveLength(0);
    });
});
