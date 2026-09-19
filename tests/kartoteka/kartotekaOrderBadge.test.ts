import fs from 'fs';
import path from 'path';
import vm from 'vm';

// Regresja: oferta z _orderCount > 0 i pustą ordersMap (tło jeszcze nie dograło
// szczegółów) pokazywała goły badge „Zamówienia" bez licznika i pusty panel.
describe('kartotekaHelpers buildOfferCardHtml — badge przy pustej mapie', () => {
    let buildOfferCardHtml: any;

    beforeEach(() => {
        const file = path.join(__dirname, '../../public/js/kartoteka/kartotekaHelpers.js');
        const code = fs.readFileSync(file, 'utf8');
        const esc = (s: unknown) => String(s ?? '');
        const context: any = {
            console,
            escapeHtml: esc,
            escapeJsStr: esc,
            logger: { info() {}, warn() {}, error() {} },
            window: null as any
        };
        context.window = {
            escapeHtml: esc,
            escapeHtmlAttr: esc,
            escapeJsStr: esc,
            getOrderChangeInfo: () => ({ changed: false }),
            computeOrderValueWithTransport: () => 100,
            getOfferPrice: () => 200,
            getOfferItemCount: () => 2,
            getOfferDisplayData: () => ({
                clientNumber: '',
                clientInfo: 'Klient',
                investInfo: '',
                userName: '',
                creatorName: ''
            })
        };
        vm.createContext(context);
        vm.runInContext(code, context);
        buildOfferCardHtml = context.window.buildOfferCardHtml;
    });

    const offer = (over: Record<string, unknown> = {}) => ({
        id: 'offer_studnie_1',
        type: 'studnia_oferta',
        number: 'OS/000001/SA/2026',
        createdAt: '2026-08-13T10:00:00.000Z',
        _orderCount: 1,
        ...over
    });

    test('hasOrder + pusta lista: badge z licznikiem z _orderCount, bez pustego panelu', () => {
        const html = buildOfferCardHtml(offer(), true, [], null, 'admin', true);
        expect(html).toContain('Zamówienia (1)');
        expect(html).not.toContain('offer-orders-panel');
        expect(html).toContain('has-order');
    });

    test('hasOrder + lista: panel z wierszem i licznik z listy', () => {
        const ord = {
            id: 'ord-1',
            orderNumber: 'LKZ/1',
            createdAt: '2026-09-01T10:00:00.000Z',
            totalNetto: 100
        };
        const html = buildOfferCardHtml(offer(), true, [ord], ord, 'admin', true);
        expect(html).toContain('Zamówienia (1)');
        expect(html).toContain('offer-orders-panel');
        expect(html).toContain('LKZ/1');
    });

    test('bez zamówienia: badge „Brak zamówienia"', () => {
        const html = buildOfferCardHtml(offer({ _orderCount: 0 }), false, [], null, 'admin', true);
        expect(html).toContain('Brak zam');
        expect(html).not.toContain('Zamówienia (');
    });
});
