// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
// Regresja: SA/ZS/000043/2026 — kolumna "Cena z oferty" pokazywala cene
// BEZ transportu (slim.price), podczas gdy widok oferty dolicza udzial
// wagowy. Oferta OS/000002/SA/2026: masa 27705 kg, 100 km x 10 PLN, full.
// Transport = ceil(27705/24000) * 1000 = 2000; suma slim 27405 + 2000 = 29405.
import fs from 'fs';
import path from 'path';
import vm from 'vm';

function loadTable() {
    const context: any = { window: {} };
    vm.createContext(context);
    // Kolejnosc jak studnie.html: stale/wspolne przed tabela.
    vm.runInContext(
        fs.readFileSync(path.join(__dirname, '../../public/js/shared/constants.js'), 'utf8'),
        context
    );
    const code = fs.readFileSync(
        path.join(__dirname, '../../public/js/studnie/offerSummaryTable.js'),
        'utf8'
    );
    vm.runInContext(code, context);
    // Przegladarka: window.X jest widoczne jako gole X; w vm kopiujemy jawnie.
    context.calcTransportCount = context.window.calcTransportCount;
    context.MAX_TRANSPORT_WEIGHT = context.window.MAX_TRANSPORT_WEIGHT;
    return context.window;
}

describe('orderTransportDisplay — Cena z oferty z transportem', () => {
    let t: any;
    beforeAll(() => {
        t = loadTable();
    });

    test('caly transport oferty OS/000002: 27705 kg full 100x10 = 2000', () => {
        expect(t.calcSnapshotTransportTotal(27705, 100, 10, 'full')).toBe(2000);
    });

    test('udzial s1: 2000 * 4349/27705 = 313.95 (jak wellsExport)', () => {
        expect(t.calcTransportShare(2000, 27705, 4349)).toBeCloseTo(313.9506, 3);
    });

    test('cena s1 z transportem: 4136.5 + udzial = 4450.45 (jak w ofercie)', () => {
        const total = t.calcSnapshotTransportTotal(27705, 100, 10, 'full');
        const share = t.calcTransportShare(total, 27705, 4349);
        expect(4136.5 + share).toBeCloseTo(4450.4506, 3);
    });

    test('suma 4 studni z transportem = 29405 (totalNetto oferty i zamowienia)', () => {
        const slim = [
            { price: 4136.5, weight: 4349 },
            { price: 6709, weight: 6369 },
            { price: 6776.25, weight: 5572 },
            { price: 9783.25, weight: 11415 }
        ];
        const wTotal = slim.reduce((s, w) => s + w.weight, 0);
        expect(wTotal).toBe(27705);
        const total = t.calcSnapshotTransportTotal(wTotal, 100, 10, 'full');
        const incl = slim.reduce(
            (s, w) => s + w.price + t.calcTransportShare(total, wTotal, w.weight),
            0
        );
        expect(incl).toBeCloseTo(29405, 2);
    });

    test('guardy: brak masy / km / stawki → 0, tryb fractional liczy ulamkowo', () => {
        expect(t.calcSnapshotTransportTotal(0, 100, 10, 'full')).toBe(0);
        expect(t.calcSnapshotTransportTotal(27705, 0, 10, 'full')).toBe(0);
        expect(t.calcSnapshotTransportTotal(27705, 100, 0, 'full')).toBe(0);
        expect(t.calcTransportShare(0, 27705, 4349)).toBe(0);
        expect(t.calcTransportShare(2000, 0, 4349)).toBe(0);
        expect(t.calcSnapshotTransportTotal(27705, 100, 10, 'fractional')).toBeCloseTo(1154, 0);
    });
});
