import fs from 'fs';
import path from 'path';
import { mapOfferRow } from '../../src/utils/searchUtils';

// Pieczatka pricelistVersionId z wiersza (zamrozona) zamiast aktywnej.
// Bez prefiksu d_ — mapOfferRow kasuje klucze d_*, zwykle przechodza spreadem.
describe('search LIST: pricelistVersionId z wiersza (mapOfferRow)', () => {
    const baseRow = {
        id: 'o1',
        userId: 'u1',
        clientId: null,
        state: 'draft',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        offer_number: 'OF/1',
        clientName: 'C',
        investName: '',
        investAddress: null,
        clientNip: '',
        clientNumber: '',
        transportCost: 0,
        _orderCount: 0,
        history: '[]',
        d_clientName: null,
        d_investName: null,
        d_investAddress: null,
        d_clientNip: null,
        d_clientNumber: null,
        d_totalNetto: null,
        d_totalBrutto: null,
        d_summary: null,
        d_costSummary: null,
        d_wellsExportTotal: null,
        d_wellsCount: null,
        d_itemsCount: null,
        d_userName: null,
        d_creatorName: null,
        d_createdByUserName: null,
        d_budowa: null,
        d_number: null,
        d_offerNumber: null,
        d_transportSeparate: null
    };

    test('rury: pieczatka przechodzi na mapped', () => {
        const mapped = mapOfferRow({
            ...baseRow,
            _type: 'rury',
            pricelistVersionId: 'plv-123'
        } as any);
        expect(mapped.pricelistVersionId).toBe('plv-123');
        expect(mapped.type).toBe('offer');
    });

    test('rury: null zostaje null', () => {
        const mapped = mapOfferRow({
            ...baseRow,
            _type: 'rury',
            pricelistVersionId: null
        } as any);
        expect(mapped.pricelistVersionId).toBeNull();
    });

    test('studnie: pieczatka przechodzi na mapped', () => {
        const mapped = mapOfferRow({
            ...baseRow,
            _type: 'studnie',
            pricelistVersionId: 'plv-456'
        } as any);
        expect(mapped.pricelistVersionId).toBe('plv-456');
        expect(mapped.type).toBe('studnia_oferta');
    });

    test('studnie: null zostaje null', () => {
        const mapped = mapOfferRow({
            ...baseRow,
            _type: 'studnie',
            pricelistVersionId: null
        } as any);
        expect(mapped.pricelistVersionId).toBeNull();
    });
});

describe('search.ts UNION: symetria kolumny pricelistVersionId', () => {
    test('obie galezie niosa kolumne w tej samej pozycji (po d_transportSeparate)', () => {
        const raw = fs.readFileSync(
            path.join(__dirname, '../../src/routes/offers/search.ts'),
            'utf8'
        );
        const src = raw.replaceAll('\r\n', '\n');
        expect(src).toContain('o."pricelistVersionId" AS "pricelistVersionId"');
        expect(src).toContain('s."pricelistVersionId" AS "pricelistVersionId"');
        // Ta sama pozycja: w obu galeziach zaraz po d_transportSeparate.
        expect(src).toContain(
            'AS "d_transportSeparate",\n                    o."pricelistVersionId"'
        );
        expect(src).toContain(
            'AS "d_transportSeparate",\n                    s."pricelistVersionId"'
        );
    });
});
