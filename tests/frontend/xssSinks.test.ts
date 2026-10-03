import fs from 'fs';
import path from 'path';

// P1-FE-ESCAPE: pinning sinkow XSS (dane DB/user -> innerHTML).
// FIXED = asercja wymaga escape; FALSE POSITIVE = asercja pinuje bezpieczne zrodlo.
// Decyzje 7-8 (transport.js, partialLoader.js): ZOSTAWIC — zrodlem jest wlasny
// same-origin partial (nie dane usera); test pinuje statyczny URL / data-partial.
// modalCore: sink caller-responsibility — callers escapuja przed wywolaniem.
// orderSummary: kopia innerHTML z juz zescapowanego zrodla (offerRendering).
function read(rel: string): string {
    return fs.readFileSync(path.join(process.cwd(), rel), 'utf-8');
}

// Lokalna replika implementacji z public/js/shared/escapeHtml.js (pin kontraktu).
function escHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escAttr(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

const PAYLOADS = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '" autofocus onfocus="alert(1)'
];

describe('P1-FE-ESCAPE: szybkie wygrane (krok 1)', () => {
    it('1. orderKartaBudowy: label escapowany w <option>', () => {
        const c = read('public/js/studnie/orderKartaBudowy.js');
        expect(c).toMatch(/escapeHtml\(label\)/);
    });

    it('2. kartotekaHelpers: offer.type i order.id przez escapeHtmlAttr', () => {
        const c = read('public/js/kartoteka/kartotekaHelpers.js');
        expect(c).toMatch(/data-offer-type="\$\{escapeHtmlAttr\(offer\.type\)\}"/);
        expect(c).toMatch(/data-order-id="\$\{escapeHtmlAttr\(hasOrder/);
        expect(c).not.toMatch(/data-offer-type="\$\{offer\.type\}"/);
        expect(c).not.toMatch(/data-order-id="\$\{hasOrder \? order\?\.id/);
    });

    it('3-4. pricelistUi: kategoria i opcje selecta escapowane', () => {
        const c = read('public/js/rury/pricelistUi.js');
        expect(c).toMatch(/\$\{escapeHtml\(cat\)\}/);
        expect(c).toMatch(/escapeHtmlAttr\(c\)/);
        expect(c).toMatch(/\$\{escapeHtml\(c\)\}<\/option>/);
        expect(c).not.toMatch(/<option value="\$\{c\}">\$\{c\}<\/option>/);
    });

    it('6. popupsTransitionManager: product.dn escapowany w innerHTML', () => {
        const c = read('public/js/studnie/popupsTransitionManager.js');
        expect(c).toMatch(/resultDiv\.innerHTML.*escapeHtml\(String\(product\.dn/);
        // Linia 751 (showToast z DN${product.dn}) to FALSE POSITIVE — showToast
        // escapuje callee-side (toast.js:41 escapeHtml(safe)).
    });

    it('7-8. transport/partialLoader: ZOSTAWIC — zrodlo to wlasny partial (pin)', () => {
        const t = read('public/js/rury/transport.js');
        expect(t).toMatch(/partials\/rury\/transport-modal\.html/);
        expect(t).toMatch(/host\.innerHTML = await res\.text\(\)/);
        const p = read('public/js/studnie/partialLoader.js');
        expect(p).toMatch(/getAttribute\('data-partial'\)/);
        expect(p).toMatch(/el\.innerHTML = html/);
    });
});

describe('P1-FE-ESCAPE: excel, zlecenia, modal, kopie DOM (kroki 2-5)', () => {
    it('10. excel: well.name escapowany, fallback uwagi tez escapuje', () => {
        const c = read('public/js/studnie/excelTableBody.js');
        expect(c).toMatch(/escapeHtmlAttr\(well\.name\)/);
        expect(c).toMatch(/escapeHtml\(String\(well\.uwagi\)/);
        const h = read('public/js/studnie/excelHelpers.js');
        expect(h).toMatch(/escapeHtml\(opts\[i\]\[1\]\)/);
    });

    it('11. actionsConfigRender: labele PRECO i error escapowane', () => {
        const c = read('public/js/studnie/actionsConfigRender.js');
        expect(c).toMatch(/escapeHtml\(precoCalc\.error\)/);
        expect(c).toMatch(/escapeHtml\(s\.label/);
        expect(c).toMatch(/escapeHtml\(u\.label/);
        expect(c).toMatch(/escapeHtml\(d\.label/);
    });

    it('12. orderZleceniaRender: wellDn escapowany', () => {
        const c = read('public/js/studnie/orderZleceniaRender.js');
        expect(c).toMatch(/escapeHtml\(String\(group\.wellDn/);
        expect(c).toMatch(/escapeHtml\(group\.wellName\)/);
    });

    it('5. modalCore: kontrakt caller-escapuje (pin + callers)', () => {
        const m = read('public/js/shared/modalCore.js');
        expect(m).toMatch(/overlay\.innerHTML = opts\.html/);
        const s = read('public/js/shared/shareModal.js');
        expect(s).toMatch(/escapeHtml\(msg\)/);
        const a = read('public/js/kartoteka/kartotekaAudit.js');
        expect(a).toMatch(/return escapeHtml\(value\)/);
    });

    it('9. orderSummary: kopia z zescapowanego zrodla (pin lancucha)', () => {
        const o = read('public/js/rury/orderSummary.js');
        expect(o).toMatch(/dst\.innerHTML = src\.innerHTML/);
        const r = read('public/js/rury/offerRendering.js');
        expect(r).toMatch(/escapeHtml\(item\.name\)/);
        expect(r).toMatch(/escapeHtml\(cat\)/);
    });
});

describe('P1-FE-ESCAPE: payloady neutralizowane przez escape', () => {
    it.each(PAYLOADS)('escHtml neutralizuje %s', (p) => {
        const out = escHtml(p);
        expect(out).not.toMatch(/<script|<img/);
    });

    it.each(PAYLOADS)('escAttr neutralizuje %s', (p) => {
        const out = escAttr(p);
        expect(out).not.toContain('" autofocus');
        expect(out).not.toMatch(/<script|<img/);
    });
});
