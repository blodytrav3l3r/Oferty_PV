import fs from 'fs';
import path from 'path';
import vm from 'vm';

// P1: badge losu oferty na karcie kartoteki (projekcja search `offer.followup`).
describe('kartotekaHelpers buildOfferCardHtml — badge opieki nad ofertą', () => {
    let buildOfferCardHtml: any;

    beforeEach(() => {
        const file = path.join(__dirname, '../../public/js/kartoteka/kartotekaHelpers.js');
        const code = fs.readFileSync(file, 'utf8');
        const esc = (s: unknown) => String(s ?? '');
        const context: any = {
            console,
            escapeHtml: esc,
            escapeHtmlAttr: esc,
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

    const offer = (followup: Record<string, unknown> | null) => ({
        id: 'offer_studnie_1',
        type: 'studnia_oferta',
        number: 'OS/000001/SA/2026',
        createdAt: '2026-10-01T10:00:00.000Z',
        _orderCount: 0,
        followup
    });

    const card = (followup: Record<string, unknown> | null) =>
        buildOfferCardHtml(offer(followup), false, [], null, 'admin', true);

    test('brak follow-up: neutralny „Do kontaktu"', () => {
        const html = card(null);
        expect(html).toContain('Do kontaktu');
        expect(html).toContain('status-badge neutral');
    });

    test('OPEN z przyszłym terminem: „W toku"', () => {
        const html = card({
            outcome: 'OPEN',
            nextContactAt: '2099-01-01T09:00:00.000Z',
            lastContactAt: '2026-10-08T09:00:00.000Z'
        });
        expect(html).toContain('W toku');
        expect(html).toContain('status-badge info');
    });

    test('OPEN z minionym terminem: dni po terminie + danger', () => {
        const html = card({
            outcome: 'OPEN',
            nextContactAt: '2026-10-01T09:00:00.000Z',
            lastContactAt: '2026-09-30T09:00:00.000Z'
        });
        expect(html).toContain('po terminie');
        expect(html).toContain('status-badge danger');
    });

    test('OPEN bez terminu: warn „Do kontaktu"', () => {
        const html = card({ outcome: 'OPEN', nextContactAt: null, lastContactAt: null });
        expect(html).toContain('status-badge warn');
    });

    test('WON: „Wygrana u nas" + success', () => {
        const html = card({ outcome: 'WON', nextContactAt: null, lastContactAt: null });
        expect(html).toContain('Wygrana u nas');
        expect(html).toContain('status-badge success');
    });

    test('LOST_COMPETITION / LOST_OTHER / ABANDONED', () => {
        expect(
            card({ outcome: 'LOST_COMPETITION', nextContactAt: null, lastContactAt: null })
        ).toContain('konkurencja');
        expect(card({ outcome: 'LOST_OTHER', nextContactAt: null, lastContactAt: null })).toContain(
            'Nie zamówił'
        );
        expect(card({ outcome: 'ABANDONED', nextContactAt: null, lastContactAt: null })).toContain(
            'Zamknięta'
        );
    });

    test('przycisk „Zapisz kontakt" na karcie (klasa + atrybuty)', () => {
        const html = card(null);
        expect(html).toContain('btn-followup');
        expect(html).toContain('Zapisz kontakt');
        expect(html).toContain('aria-label="Zapisz kontakt"');
    });
});
