/**
 * @jest-environment jsdom
 */

// @ts-nocheck
/**
 * A1: baner blokady oferty escapuje wellOrder.id w data-csp-args (kontekst JSON+attr).
 * Ładuje PRAWDZIWY public/js/shared/escapeHtml.js + public/js/studnie/uiLockBanners.js,
 * renderuje baner dla studni zablokowanej zamówieniem o wrogim id i sprawdza,
 * że payload nie wyrywa się z atrybutu data-csp-args.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

type Esc = { escapeHtml: (s: unknown) => string; escapeJsStr: (s: unknown) => string };

function loadBanner() {
    const escSrc = fs
        .readFileSync(path.join(process.cwd(), 'public/js/shared/escapeHtml.js'), 'utf-8')
        .replace(/^export /gm, '');
    const bannerSrc = fs.readFileSync(
        path.join(process.cwd(), 'public/js/studnie/uiLockBanners.js'),
        'utf-8'
    );
    // jawny sandbox: prawdziwy document z jsdom, minimalne window (lucide guardowane)
    const sandbox: Record<string, unknown> = { console, window: {}, document };
    vm.createContext(sandbox);
    vm.runInContext(`${escSrc}\n${bannerSrc}`, sandbox, { filename: 'uiLockBanners.A1.test.js' });
    return {
        sandbox,
        render: sandbox.renderOfferLockBanner as () => void,
        esc: { escapeHtml: sandbox.escapeHtml, escapeJsStr: sandbox.escapeJsStr } as Esc
    };
}

const { sandbox: G, render, esc } = loadBanner();

function stubEnv(orderId: string) {
    document.body.innerHTML = '<div class="well-center-column"></div>';
    G.getCurrentWell = () => ({ id: 'w1', name: 'S1' });
    G.isWellOrdered = () => true;
    G.editingOfferIdStudnie = 'offer1';
    G.getOrdersForOffer = () => [{ id: orderId, orderNumber: 'ZAM/1', wells: [{ id: 'w1' }] }];
    G.getOfferOrderProgress = () => ({ ordered: 1, total: 1, percent: 100 });
    G.wells = [{ id: 'w1' }];
    G.orderEditMode = false;
}

describe('frontend A1: uiLockBanners escapuje id zamówienia', () => {
    it('escapeJsStr neutralizuje cudzysłowy (guard implementacji)', () => {
        expect(esc.escapeJsStr("x'-alert(1)-'y")).toBe("x\\'-alert(1)-\\'y");
    });

    it('baner z wrogim id nie wyrywa się z atrybutu (CSP-B2: JSON+attr)', () => {
        stubEnv("x'-alert(1)-'y");
        render();
        const banner = document.getElementById('offer-lock-banner') as HTMLElement;
        const btn = banner.querySelector('button') as HTMLElement;
        expect(btn).not.toBeNull();
        expect(btn.hasAttribute('onclick')).toBe(false);
        // wartosc odczytana jak w dyspozytorze: getAttribute dekoduje encje
        const raw = btn.getAttribute('data-csp-args') as string;
        expect(JSON.parse(raw)).toEqual(["x'-alert(1)-'y"]);
        expect(btn.getAttribute('data-csp')).toBe('$gotoOrder');
        expect(banner.innerHTML).toContain('Edytuj zamówienie');
    });

    it('zwykłe id przechodzi bez zmian', () => {
        stubEnv('ord-123');
        render();
        const banner = document.getElementById('offer-lock-banner') as HTMLElement;
        expect(banner.innerHTML).toContain('[&quot;ord-123&quot;]');
    });
});
