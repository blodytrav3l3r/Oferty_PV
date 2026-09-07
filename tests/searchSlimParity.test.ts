/**
 * P1-C: parzystość LIST slim vs full — pola kart (ceny, liczniki, nazwy,
 * numery, historia) identyczne, bez pełnego bloba na liście.
 * Projekcja liczona prawdziwym json_extract (node:sqlite), nie mockiem.
 */
import { DatabaseSync } from 'node:sqlite';
import { mapOfferRow, RawOfferRow } from '../src/utils/searchUtils';

function fixtureBlob() {
    const wells = Array.from({ length: 3 }, (_, i) => ({ id: `w${i}`, totalPrice: 100 + i }));
    return {
        clientName: '',
        investName: '',
        investAddress: 'ul. Testowa 1',
        clientNip: '1234567890',
        totalNetto: 111.5,
        totalBrutto: 137.25,
        summary: { totalValue: 999.99, totalNetto: 888.88, totalBrutto: 1077.77, extra: 'drop me' },
        costSummary: { totalValue: 555.55, extra: 'drop me' },
        wells: Array.from({ length: 7 }, (_, i) => ({ id: `w${i}`, config: [{ a: 1 }] })),
        wellsExport: wells,
        items: [{ productId: 'p1' }, { productId: 'p2' }],
        userName: 'Jan',
        creatorName: 'Ewa',
        createdByUserName: 'Ewa K',
        budowa: 'B17',
        number: 'N/1',
        offerNumber: 'O/1',
        huge: 'z'.repeat(50000)
    };
}

// Stary mapper (full blob) — wyciąg z mapOfferRow sprzed P1-C.
function oldMap(row: any) {
    const offer: any = { ...row };
    offer.type = row._type === 'studnie' ? 'studnia_oferta' : 'offer';
    offer.number = row.offer_number || '';
    offer._orderCount = Number(row._orderCount);
    try {
        offer.data = JSON.parse(row.data);
    } catch {
        offer.data = {};
    }
    try {
        offer.history = JSON.parse(row.history);
    } catch {
        offer.history = [];
    }
    if (!offer.clientName && !offer.investName) {
        offer.clientName = offer.data.clientName || '';
        offer.investName = offer.data.investName || '';
        offer.clientNip = offer.data.clientNip || '';
    }
    offer.clientName = offer.clientName || '';
    offer.investName = offer.investName || '';
    offer.clientNip = offer.clientNip || '';
    return offer;
}

const PROJ = `json_extract(data,'$.clientName') AS "d_clientName",
    json_extract(data,'$.investName') AS "d_investName",
    json_extract(data,'$.investAddress') AS "d_investAddress",
    json_extract(data,'$.clientNip') AS "d_clientNip",
    json_extract(data,'$.clientNumber') AS "d_clientNumber",
    json_extract(data,'$.totalNetto') AS "d_totalNetto",
    json_extract(data,'$.totalBrutto') AS "d_totalBrutto",
    json_extract(data,'$.summary') AS "d_summary",
    json_extract(data,'$.costSummary') AS "d_costSummary",
    CASE WHEN json_extract(data,'$.wellsExport') IS NULL THEN NULL
    ELSE (SELECT COALESCE(SUM(value->>'totalPrice'), 0)
          FROM json_each(data, '$.wellsExport'))
    END AS "d_wellsExportTotal",
    json_array_length(data,'$.wells') AS "d_wellsCount",
    json_array_length(data,'$.items') AS "d_itemsCount",
    json_extract(data,'$.userName') AS "d_userName",
    json_extract(data,'$.creatorName') AS "d_creatorName",
    json_extract(data,'$.createdByUserName') AS "d_createdByUserName",
    json_extract(data,'$.budowa') AS "d_budowa",
    json_extract(data,'$.number') AS "d_number",
    json_extract(data,'$.offerNumber') AS "d_offerNumber"`;

function priceOf(offer: any): number {
    // Kopia logiki getOfferPrice (kartotekaHelpers.js) po P1-C.
    const preSum = offer.wellsExportTotal ?? offer.data?.wellsExportTotal;
    if (typeof preSum === 'number') return preSum;
    if (offer.type === 'studnia_oferta') {
        const exp = offer.wellsExport || (offer.data && offer.data.wellsExport);
        if (exp) return exp.reduce((s: number, w: any) => s + (w.totalPrice || 0), 0);
    }
    let v = offer.totalNetto || offer.totalBrutto || 0;
    if (!v && offer.data) {
        if (offer.data.summary)
            v =
                offer.data.summary.totalValue ||
                offer.data.summary.totalNetto ||
                offer.data.summary.totalBrutto ||
                0;
        else if (offer.data.costSummary) v = offer.data.costSummary.totalValue || 0;
        else v = offer.data.totalNetto || offer.data.totalBrutto || 0;
    }
    if (!v && offer.price) v = offer.price;
    return v || 0;
}

describe('P1-C slim LIST parity', () => {
    test('karta z pełnego bloba == karta z projekcji', () => {
        const db = new DatabaseSync(':memory:');
        const blob = JSON.stringify(fixtureBlob());
        db.exec('CREATE TABLE t (id TEXT, data TEXT, history TEXT)');
        db.prepare('INSERT INTO t VALUES (?, ?, ?)').run('o1', blob, JSON.stringify([{ a: 1 }]));
        const full = db.prepare('SELECT id, data, history FROM t').get() as any;
        const slim = db.prepare(`SELECT id, history, ${PROJ} FROM t`).get() as any;
        db.close();

        const base = {
            id: 'o1',
            userId: 'u1',
            clientId: null,
            state: 'draft',
            createdAt: '2026-01-01',
            updatedAt: '2026-01-02',
            offer_number: 'O/1',
            _type: 'studnie',
            transportCost: 0,
            _orderCount: 0,
            clientName: '',
            investName: '',
            clientNip: '',
            clientNumber: ''
        };
        const oldRow = { ...base, data: full.data, history: full.history };
        const newRow = { ...base, history: slim.history } as unknown as RawOfferRow;
        for (const k of Object.keys(slim)) {
            if (k.startsWith('d_')) (newRow as any)[k] = (slim as any)[k];
        }

        const a = oldMap(oldRow);
        const b = mapOfferRow(newRow);

        // Cena karty (kopie logiki getOfferPrice).
        expect(priceOf({ ...b, wellsExport: undefined, data: b.data })).toBe(priceOf(a));
        expect(priceOf(b)).toBe(priceOf(a));
        // Liczniki.
        expect(b.data.wellsCount).toBe(a.data.wells.length);
        expect(b.data.itemsCount).toBe(a.data.items.length);
        // Nazwy / NIP / adres.
        expect(b.clientName).toBe(a.clientName || a.data.clientName);
        expect(b.data.investAddress).toBe(a.data.investAddress);
        expect(b.data.clientNip).toBe(a.data.clientNip);
        // Numery i użytkownicy.
        for (const k of [
            'userName',
            'creatorName',
            'createdByUserName',
            'budowa',
            'number',
            'offerNumber'
        ]) {
            expect(b.data[k]).toBe(a.data[k]);
        }
        // Historia bez zmian, typ/numer/orderCount bez zmian.
        expect(b.history).toEqual(a.history);
        expect(b.type).toBe(a.type);
        expect(b.number).toBe(a.number);
        // Slim nie niesie śmieci ani pełnego bloba.
        expect(JSON.stringify(b).length).toBeLessThan(JSON.stringify(a).length / 5);
        expect(JSON.stringify(b)).not.toContain('drop me');
        expect(JSON.stringify(b)).not.toContain('z'.repeat(100));
    });

    test('wellsExportTotal: suma z SQL, brak tablicy na liście', () => {
        const db = new DatabaseSync(':memory:');
        db.exec('CREATE TABLE w (data TEXT)');
        const blob = JSON.stringify({
            totalNetto: 50,
            wellsExport: [
                {
                    id: 'w1',
                    totalPrice: 100,
                    config: [{ heavy: 'x'.repeat(5000) }],
                    przejscia: [1, 2, 3]
                },
                { id: 'w2', totalPrice: 200, config: [], przejscia: [] }
            ]
        });
        db.prepare('INSERT INTO w VALUES (?)').run(blob);
        db.prepare(`INSERT INTO w VALUES (?)`).run(JSON.stringify({ totalNetto: 50 }));
        const rows = db
            .prepare(
                `SELECT CASE WHEN json_extract(data,'$.wellsExport') IS NULL THEN NULL
                 ELSE (SELECT COALESCE(SUM(value->>'totalPrice'), 0)
                       FROM json_each(data, '$.wellsExport'))
                 END AS "d_wellsExportTotal",
                 json_extract(data,'$.totalNetto') AS "d_totalNetto" FROM w`
            )
            .all() as any[];
        db.close();
        const base: any = {
            id: 'o1',
            userId: null,
            clientId: null,
            state: null,
            createdAt: null,
            updatedAt: null,
            offer_number: null,
            history: null,
            _type: 'studnie',
            transportCost: null,
            _orderCount: 0,
            clientName: null,
            investName: null,
            clientNip: null,
            clientNumber: null
        };
        const withExport = mapOfferRow({ ...base, ...rows[0] });
        expect(withExport.data.wellsExportTotal).toBe(300);
        expect(withExport.data.wellsExport).toBeUndefined();
        expect(JSON.stringify(withExport).length).toBeLessThan(500);
        // Brak wellsExport → skalar, jak pełna (cena ze skalarów, nie 0).
        const withoutExport = mapOfferRow({ ...base, ...rows[1] });
        expect(withoutExport.data.wellsExportTotal).toBeUndefined();
        expect(withoutExport.data.totalNetto).toBe(50);
    });

    test('historia slim: długość + skalary + itemsCount, bez pełnych pozycji', () => {
        const db = new DatabaseSync(':memory:');
        db.exec('CREATE TABLE h (history TEXT)');
        const hist = JSON.stringify([
            {
                updatedAt: '2026-01-01',
                state: 'draft',
                totalBrutto: 100,
                lastEditedBy: 'Ewa',
                userName: 'Jan',
                items: Array.from({ length: 50 }, (_, i) => ({
                    productId: `p${i}`,
                    secret: 'x'.repeat(1000)
                }))
            },
            { updatedAt: '2026-01-02', state: 'final', totalBrutto: 200 }
        ]);
        db.prepare('INSERT INTO h VALUES (?)').run(hist);
        const row = db
            .prepare(
                `SELECT COALESCE((SELECT json_group_array(json_object(
                    'updatedAt', value->>'updatedAt', 'timestamp', value->>'timestamp',
                    'state', value->>'state', 'totalBrutto', value->>'totalBrutto',
                    'lastEditedBy', value->>'lastEditedBy', 'userName', value->>'userName',
                    'itemsCount', json_array_length(value, '$.items')))
                FROM json_each(COALESCE(history, '[]'))), '[]') AS history FROM h`
            )
            .get() as any;
        db.close();
        const slim = JSON.parse(row.history);
        expect(slim).toHaveLength(2);
        expect(slim[0]).toMatchObject({
            updatedAt: '2026-01-01',
            totalBrutto: 100,
            lastEditedBy: 'Ewa',
            itemsCount: 50
        });
        expect(slim[0].items).toBeUndefined();
        expect(JSON.stringify(slim).length).toBeLessThan(hist.length / 10);
        // Popup: długość + licznik jak pełna.
        const full = JSON.parse(hist);
        expect(slim.length).toBe(full.length);
        expect(slim[0].itemsCount).toBe(full[0].items.length);
    });

    test('Prisma zwraca BigInt z funkcji JSON — mapper konwertuje (regresja live)', () => {
        const base: any = {
            id: 'o1',
            userId: null,
            clientId: null,
            state: null,
            createdAt: null,
            updatedAt: null,
            offer_number: null,
            history: '[]',
            _type: 'studnie',
            transportCost: null,
            _orderCount: 0,
            clientName: null,
            investName: null,
            clientNip: null,
            clientNumber: null,
            d_wellsCount: BigInt(2317),
            d_itemsCount: null,
            d_wellsExportTotal: BigInt(0)
        };
        const mapped = mapOfferRow(base);
        expect(mapped.data.wellsCount).toBe(2317);
        expect(mapped.data.itemsCount).toBeUndefined();
        // Wynik serializuje się (żaden BigInt nie dociera do res.json).
        expect(() => JSON.stringify(mapped)).not.toThrow();
    });
});
