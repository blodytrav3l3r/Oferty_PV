// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
// Regresja: wiersz "Transport bez rozładunku" tylko jako osobna pozycja.
// Przy transporcie wliczonym w ceny studni (transportSeparate = false)
// stopka nie renderuje wiersza transportu — koszt siedzi w cenach pozycji.
import fs from 'fs';
import path from 'path';
import vm from 'vm';

function loadFooter() {
    const sandbox: any = {
        window: {},
        fmt: (v: any) =>
            Number(v)
                .toFixed(2)
                .replace('.', ',')
                .replace(/\B(?=(\d{3})+(?!\d))/g, ' '),
        fmtInt: (v: any) => String(Math.round(Number(v) || 0)),
        escapeHtmlAttr: (v: any) => String(v)
    };
    vm.createContext(sandbox);
    vm.runInContext(
        fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/offerSummaryTable.js'),
            'utf8'
        ),
        sandbox,
        { filename: 'offerSummaryTable.js' }
    );
    return sandbox;
}

function renderFooter(
    ctx: any,
    opts: {
        showPriceComparison: boolean;
        transportInfo: any;
        separateTransport: boolean;
    }
) {
    vm.runInContext(
        `__html = renderOfferSummaryFooter(1, 1000, 5000, false, {}, ${opts.showPriceComparison}, __ti, ${opts.separateTransport})`,
        Object.assign(ctx, { __ti: opts.transportInfo })
    );
    return (ctx as any).__html as string;
}

describe('offerTransportRow — brak wiersza przy transporcie wliczonym', () => {
    let ctx: any;
    beforeAll(() => {
        ctx = loadFooter();
    });

    test('porównanie zamówienia, wliczony: brak wiersza transportu', () => {
        const html = renderFooter(ctx, {
            showPriceComparison: true,
            transportInfo: null,
            separateTransport: false
        });
        expect(html).not.toContain('offer-transport-row');
        expect(html).not.toContain('Transport bez rozładunku');
        expect(html).toContain('RAZEM');
    });

    test('porównanie zamówienia, osobna pozycja: wiersz widoczny, transport w RAZEM', () => {
        const html = renderFooter(ctx, {
            showPriceComparison: true,
            transportInfo: { origTotal: 1000, sumFrozen: 3000, theoretical: 3000 },
            separateTransport: true
        });
        expect(html).toContain('offer-transport-row');
        expect(html).toContain('Transport bez rozładunku');
        // dnGroups puste: RAZEM oferty = sam transport oferty, różnica = zam - oferty.
        expect(html).toContain('1 000,00');
        expect(html).toContain('+2 000,00');
    });

    test('czysta oferta, osobna pozycja: wiersz widoczny', () => {
        const html = renderFooter(ctx, {
            showPriceComparison: false,
            transportInfo: { separate: true, total: 1000, trips: 1, perTrip: 1000 },
            separateTransport: true
        });
        expect(html).toContain('offer-transport-row');
        expect(html).toContain('Transport bez rozładunku');
    });

    test('czysta oferta, wliczony: brak wiersza', () => {
        const html = renderFooter(ctx, {
            showPriceComparison: false,
            transportInfo: null,
            separateTransport: false
        });
        expect(html).not.toContain('offer-transport-row');
    });
});
