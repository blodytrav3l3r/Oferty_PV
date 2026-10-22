import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * M3/M4: warstwa 2 huba cenników — drill-down kafelkowy
 * (oś → sekcje → pozycje), PRECO jako osobna oś, sekcja Transport (info),
 * publikacja przez approve, kontrola przez fetchChecks.
 * Testy BEHAWIORALNE (jsdom): klik w kafelek sekcji, limit renderowania
 * pozycji, publikacja z notą (korekta wsteczna).
 */

const ROOT = path.join(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');

/** DOM jsdom — tsconfig testów ma lib ES2021 (bez DOM), więc dostęp przez `any`. */
const dom = globalThis as any as { document: any; window: any };

/** Wycina źródło funkcji (liczenie klamer) — do asercji per funkcja. */
function functionSource(src: string, name: string): string {
    const start = src.indexOf(`function ${name}(`);
    expect(start).toBeGreaterThan(-1);
    let depth = 0;
    let index = src.indexOf('{', start);
    for (; index < src.length; index++) {
        if (src[index] === '{') depth++;
        else if (src[index] === '}') {
            depth--;
            if (depth === 0) break;
        }
    }
    return src.slice(start, index + 1);
}

/** Ładuje hub w sandboxie (bez importów ESM) i udostępnia funkcje warstwy 2. */
function loadHub(): any {
    const src = read('public/js/cennikiHub.js').replace(/^import .*$/gm, '');
    const noop = () => {};
    const context: any = {
        console,
        setTimeout: () => 0,
        clearTimeout: noop,
        URLSearchParams,
        fetch: async () => ({ ok: false, json: async () => ({ error: 'brak sieci' }) }),
        escapeHtml: (value: unknown) => String(value ?? ''),
        escapeHtmlAttr: (value: unknown) => String(value ?? ''),
        showModal: noop,
        closeModal: noop,
        document: {
            addEventListener: noop,
            getElementById: () => null,
            querySelectorAll: () => []
        }
    };
    context.window = {
        location: { hash: '' },
        addEventListener: noop,
        MAX_TRANSPORT_WEIGHT: 24000
    };
    vm.createContext(context);
    vm.runInContext(`${src}\nglobalThis.__api = { buildSections, compareSheet, layer2 };`, context);
    return context.__api;
}

/* ── Harness behawioralny (jsdom) ──────────────────────────────────────────── */

const HUB_DOM = `
<div id="cenniki-alert" role="status"></div>
<section data-cenniki-view="przeglad"><div id="cenniki-cards"></div></section>
<section data-cenniki-view="cennik">
    <div id="cenniki-axis-tiles"></div>
    <div id="cenniki-state-bar"></div>
    <p id="cenniki-preview-note" hidden></p>
    <div id="cenniki-sections"></div>
    <div id="cenniki-items-note" hidden></div>
    <div id="cenniki-items" hidden></div>
    <div id="cenniki-item-card" hidden></div>
</section>
<section data-cennikan-view="historia">
    <select id="cenniki-history-type"><option value="">Wszystkie</option></select>
    <select id="cenniki-history-state"><option value="">Wszystkie</option></select>
    <span id="cenniki-history-count"></span>
    <table><tbody id="cenniki-history-body"></tbody></table>
</section>
`;

const flush = async (n = 20) => {
    for (let i = 0; i < n; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};

const click = (element: any) => {
    expect(element).not.toBeNull();
    element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
};

interface HubOptions {
    versions?: any[];
    summary?: any;
    previews?: Record<string, any>;
    approveResult?: any;
}

/** Listenerzy `document` z poprzednich instancji huba — muszą zniknąć między testami. */
let hubDocumentListeners: Array<[string, any]> = [];

function loadHubDom(options: HubOptions) {
    for (const [type, handler] of hubDocumentListeners) {
        dom.document.removeEventListener(type, handler);
    }
    hubDocumentListeners = [];
    dom.document.body.innerHTML = HUB_DOM;
    const src = read('public/js/cennikiHub.js').replace(/^import .*$/gm, '');
    const approveVersion = jest.fn(
        async () => options.approveResult ?? { version: { version: 'v2' } }
    );
    const showToast = jest.fn();
    const fetchMock = jest.fn(async (url: string) => {
        const target = String(url);
        const ok = (body: unknown) => ({ ok: true, json: async () => body });
        if (target.endsWith('/summary')) return ok(options.summary);
        const preview = target.match(/\/api\/pricelist-versions\/([^/?]+)\/preview/);
        if (preview) return ok(options.previews?.[preview[1]] ?? { sheets: {}, counts: {} });
        return ok({ versions: options.versions ?? [] });
    });
    const context: any = {
        console,
        setTimeout: (fn: any) => {
            if (typeof fn === 'function') fn();
            return 0;
        },
        clearTimeout: () => {},
        URLSearchParams,
        fetch: fetchMock,
        escapeHtml: (value: unknown) => String(value ?? ''),
        escapeHtmlAttr: (value: unknown) => String(value ?? ''),
        showModal: (opts: any) => {
            const overlay = dom.document.createElement('div');
            overlay.id = opts.id;
            overlay.innerHTML = opts.html;
            dom.document.body.appendChild(overlay);
            return overlay;
        },
        closeModal: (id: string) => {
            const element = dom.document.getElementById(id);
            if (element) element.remove();
        },
        document: dom.document,
        Element: dom.window.Element,
        HTMLSelectElement: dom.window.HTMLSelectElement,
        window: {
            location: { hash: '' },
            addEventListener: () => {},
            showToast,
            MAX_TRANSPORT_WEIGHT: 24000,
            pricelistVersions: {
                displayStatus: (version: any) => String(version?.state || version?.status || ''),
                isPastDate: (iso: string) => Date.parse(iso) < Date.now() - 60000,
                approveVersion,
                statusBadge: () => '<span class="badge"></span>',
                openPreview: () => {},
                openDiff: () => {},
                fetchChecks: async () => null,
                exportVersion: () => {}
            }
        }
    };
    vm.createContext(context);
    const originalAdd = dom.document.addEventListener.bind(dom.document);
    dom.document.addEventListener = (type: string, handler: any, options?: any) => {
        hubDocumentListeners.push([type, handler]);
        originalAdd(type, handler, options);
    };
    try {
        vm.runInContext(src, context);
    } finally {
        dom.document.addEventListener = originalAdd;
    }
    return { context, approveVersion, showToast, fetchMock };
}

/* ── Dane testowe ─────────────────────────────────────────────────────────── */

const ruryRow = (id: string, price: number) => ({
    Indeks: id,
    'Nazwa produktu': `Rura ${id}`,
    'Cena PLN (netto)': price,
    Kategoria: 'Rura',
    'Szt./transport': 12
});

const courseRow = {
    Indeks: 'TR-RURY',
    'Nazwa produktu': 'Transport rur (kurs)',
    'Cena PLN (netto)': 0,
    Kategoria: 'Transport'
};

const DRAFT = {
    id: 'd1',
    version: 'v2',
    seq: 2,
    effectiveFrom: '2026-11-01T00:00:00.000Z',
    status: 'DRAFT',
    state: 'DRAFT'
};

const ACTIVE = {
    id: 'a1',
    version: 'v1',
    seq: 1,
    effectiveFrom: '2026-09-01T00:00:00.000Z',
    status: 'APPROVED',
    state: 'ACTIVE'
};

function summaryWith(draft: any = DRAFT) {
    return {
        generatedAt: '2026-10-20T08:00:00.000Z',
        types: {
            rury: {
                active: ACTIVE,
                nextScheduled: null,
                draft,
                draftCount: 1,
                approvedCount: 1,
                archivedCount: 3,
                collisionCount: 0
            },
            studnie: {
                active: null,
                nextScheduled: null,
                draft: null,
                draftCount: 0,
                approvedCount: 0,
                archivedCount: 0,
                collisionCount: 0
            },
            preco: {
                active: null,
                nextScheduled: null,
                draft: null,
                draftCount: 0,
                approvedCount: 0,
                archivedCount: 0,
                collisionCount: 0
            }
        }
    };
}

const versionsList = [
    { ...DRAFT, type: 'rury' },
    { ...ACTIVE, type: 'rury' }
];

const previewOf = (rows: any[]) => ({
    sheets: { 'Cennik Rury': rows },
    counts: { totalRows: rows.length, bySheet: { 'Cennik Rury': rows.length } },
    totalRows: rows.length,
    truncated: false
});

describe('M3/M4: warstwa 2 huba cenników', () => {
    const hub = read('public/js/cennikiHub.js');
    const html = read('public/cenniki.html');
    const css = read('public/css/cenniki.css');

    it('źródło treści: preview (szkic + obowiązująca), bez /diff w warstwie 2', () => {
        expect(hub).toContain('/preview');
        expect(hub).not.toContain('/diff?against=');
        expect(hub).toContain('summary?.types?.[type]?.draft');
        expect(hub).toContain('summary?.types?.[type]?.active');
    });

    it('publikacja: kanoniczny approve (nie alias publish)', () => {
        expect(hub).toContain('window.pricelistVersions');
        expect(hub).toContain('.approveVersion(');
        expect(hub).not.toContain("'/publish'");
        expect(hub).not.toContain('data-cenniki-publish-version');
    });

    it('kontrola wersji przez wspólny helper fetchChecks', () => {
        expect(hub).toContain('api.fetchChecks(id)');
        expect(hub).toContain('renderChecks(checks)');
    });

    it('warstwa 2 renderuje kafelki, nie tabele', () => {
        const layer2Functions = [
            'renderLayer2',
            'renderAxisTiles',
            'renderStateBar',
            'renderSections',
            'transportTile',
            'renderItems',
            'renderItemCard',
            'buildSections'
        ];
        for (const name of layer2Functions) {
            expect(functionSource(hub, name)).not.toContain('<table');
        }
        // tabela zostaje tylko w historii
        expect(hub).toContain('\'<tr><td colspan="9"');
        expect(html).toContain('<table class="cenniki-table">');
    });

    it('kafelki sekcji i pozycji mają swoje klasy', () => {
        expect(hub).toContain('cenniki-tile--section');
        expect(hub).toContain('cenniki-tile--item');
        expect(css).toContain('.cenniki-tile--section');
        expect(css).toContain('.cenniki-tile--item');
    });

    it('PRECO to osobna oś (nie sekcja studni)', () => {
        expect(hub).toContain('cenniki-tile--preco');
        expect(hub).toContain('osobna oś');
        expect(hub).toContain("'PRECO_Kinety'");
        expect(hub).toContain("'PRECO_Zakresy'");
        expect(hub).toContain("'PRECO_Dodatki'");
    });

    it('sekcja Transport: pozycja kursu TR-* + produkty + fakty poza cennikiem', () => {
        expect(hub).toContain('cenniki-tile--transport');
        expect(hub).toContain('poza cennikiem');
        expect(hub).toContain('transportSeparate');
        expect(hub).toContain('MAX_TRANSPORT_WEIGHT');
        expect(hub).toContain('Ilość/transport');
        // limit kursu ze stałej projektu, nie literał w kodzie
        expect(hub).not.toContain('24 000 kg');
    });

    it('a11y: toggle (aria-pressed) + grupy sekcji/pozycji', () => {
        expect(hub).toContain('aria-label=');
        expect(hub).toContain('aria-pressed=');
        expect(hub).toContain('<button type="button" class="cenniki-tile cenniki-tile--section');
        expect(hub).toContain('<button type="button" class="cenniki-tile cenniki-tile--item');
        expect(html).toMatch(/id="cenniki-sections"[\s\S]{0,200}role="group"/);
        expect(html).toMatch(/id="cenniki-items"[\s\S]{0,200}role="group"/);
    });

    it('brak inline onclick/style w hubie i stronie', () => {
        expect(html).not.toContain('onclick=');
        expect(html).not.toContain('style="');
        expect(hub).not.toContain('onclick=');
        expect(hub).not.toContain('style="');
    });

    it('nowe klasy CSS na tokenach (zero własnych hexów)', () => {
        const start = css.indexOf('.cenniki-state-bar {');
        const end = css.indexOf('.cenniki-toolbar {');
        expect(start).toBeGreaterThan(-1);
        expect(end).toBeGreaterThan(start);
        const block = css.slice(start, end);
        expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}/);
        expect(block).toContain('var(--tile-gap-md)');
    });
});

describe('M3/M4: mapowanie arkuszy → sekcje', () => {
    const ruryRowLocal = (id: string, price: number) => ({
        Indeks: id,
        'Nazwa produktu': `Rura ${id}`,
        'Cena PLN (netto)': price,
        Kategoria: 'Rura'
    });
    const courseRowLocal = {
        Indeks: 'TR-RURY',
        'Nazwa produktu': 'Transport rur (kurs)',
        'Cena PLN (netto)': 0,
        Kategoria: 'Transport'
    };

    it('rury: sekcja Rury + Transport (osobna, poza cennikiem)', () => {
        const api = loadHub();
        const sections = api.buildSections(
            'rury',
            { 'Cennik Rury': [ruryRowLocal('R1', 100), courseRowLocal] },
            { 'Cennik Rury': [ruryRowLocal('R1', 110)] }
        );
        expect(sections.map((section: any) => section.label)).toEqual(['Rury', 'Transport']);
        expect(sections[0].count).toBe(1);
        expect(sections[0].changed).toBe(1);
        expect(sections[0].deltaPct).toBe(-9.1);
        expect(sections[0].rows[0].Indeks).toBe('R1');
        expect(sections[1].isTransport).toBe(true);
        expect(sections[1].course.row.Indeks).toBe('TR-RURY');
    });

    it('studnie: kolejność sekcji 1:1 z edytorem + osobna oś PRECO', () => {
        const api = loadHub();
        const studnieRow = (id: string) => ({
            Indeks: id,
            Nazwa: `Studnia ${id}`,
            Kategoria: 'Studnie',
            'Cena PLN': 500
        });
        const sections = api.buildSections(
            'studnie',
            {
                Kinety: [studnieRow('K1')],
                DN1000: [studnieRow('S1')],
                Inne: [
                    {
                        Indeks: 'TR-STUDNIE',
                        Nazwa: 'Transport studni (kurs)',
                        Kategoria: 'Transport',
                        'Cena PLN': 0
                    }
                ]
            },
            {}
        );
        expect(sections.map((section: any) => section.label)).toEqual([
            'DN1000',
            'Kinety',
            'Transport'
        ]);
        expect(sections[0].id).toBe('dn1000');
        expect(sections[2].isTransport).toBe(true);
        expect(sections[2].course.row.Indeks).toBe('TR-STUDNIE');
    });

    it('preco: sekcje PRECO_Kinety/Zakresy/Dodatki', () => {
        const api = loadHub();
        const sections = api.buildSections(
            'preco',
            {
                PRECO_Kinety: [{ 'DN Studni': 1000, 'DN Rury': 315, 'Cena prosta (PLN)': 100 }]
            },
            {}
        );
        expect(sections.map((section: any) => section.label)).toEqual(['Kinety']);
        expect(sections[0].sheet).toBe('PRECO_Kinety');
        expect(sections[0].rows[0]['DN Studni']).toBe(1000);
    });

    it('Transport: produkty osi z kolumną Ilość/transport (top wg wartości)', () => {
        const api = loadHub();
        const sections = api.buildSections(
            'studnie',
            {
                Kinety: [
                    {
                        Indeks: 'K1',
                        Nazwa: 'Kinety 1',
                        'Cena PLN': 100,
                        'Ilość/transport': 3
                    },
                    {
                        Indeks: 'K2',
                        Nazwa: 'Kinety 2',
                        'Cena PLN': 100,
                        'Ilość/transport': 8
                    }
                ]
            },
            {}
        );
        const transport = sections.find((section: any) => section.isTransport);
        expect(transport.products).toHaveLength(2);
        expect(transport.products[0].name).toBe('Kinety 2');
        expect(transport.products[0].value).toBe(8);
    });
});

describe('M3/M4: warstwa 2 — zachowanie (jsdom)', () => {
    it('klik w kafelek sekcji odsłania kafelki pozycji', async () => {
        loadHubDom({
            versions: versionsList,
            summary: summaryWith(),
            previews: {
                d1: previewOf([ruryRow('R1', 100), courseRow]),
                a1: previewOf([ruryRow('R1', 110)])
            }
        });
        await flush();
        expect(dom.document.querySelectorAll('.cenniki-tile--section').length).toBeGreaterThan(0);
        click(dom.document.querySelector('[data-cenniki-section="cennik-rury"]'));
        expect(dom.document.querySelectorAll('.cenniki-tile--item').length).toBe(1);
        expect(dom.document.getElementById('cenniki-items')?.hasAttribute('hidden')).toBe(false);
    });

    it('limit renderowania: 100 pozycji + „Pokaż kolejne 100"', async () => {
        const rows = Array.from({ length: 690 }, (_value, index) =>
            ruryRow(`R${index}`, 100 + index)
        );
        loadHubDom({
            versions: versionsList,
            summary: summaryWith(),
            previews: {
                d1: previewOf(rows),
                a1: previewOf(rows)
            }
        });
        await flush();
        const tile = dom.document.querySelector('[data-cenniki-section="cennik-rury"]');
        expect(tile?.textContent).toContain('100 z 690');
        click(tile);
        expect(dom.document.querySelectorAll('.cenniki-tile--item').length).toBe(100);
        expect(dom.document.getElementById('cenniki-items-note')?.textContent).toContain(
            'Pokazano 100 z 690 pozycji'
        );
        click(dom.document.querySelector('[data-cenniki-more]'));
        expect(dom.document.querySelectorAll('.cenniki-tile--item').length).toBe(200);
    });

    it('pasek stanu: podgląd wskazuje wersję + liczba zmian z porównania lokalnego', async () => {
        loadHubDom({
            versions: versionsList,
            summary: summaryWith(),
            previews: {
                d1: previewOf([ruryRow('R1', 100), courseRow]),
                a1: previewOf([ruryRow('R1', 110)])
            }
        });
        await flush();
        const bar = dom.document.getElementById('cenniki-state-bar')?.textContent || '';
        expect(bar).toContain('Podgląd: szkic v2');
        expect(bar).toContain('1 zmian');
    });

    it('korekta wsteczna: modal noty, approveVersion dopiero z notą ≥ 10 znaków', async () => {
        const pastDraft = { ...DRAFT, effectiveFrom: '2026-01-01T00:00:00.000Z' };
        const { approveVersion, showToast } = loadHubDom({
            versions: [
                { ...pastDraft, type: 'rury' },
                { ...ACTIVE, type: 'rury' }
            ],
            summary: summaryWith(pastDraft),
            previews: {
                d1: previewOf([ruryRow('R1', 100), courseRow]),
                a1: previewOf([ruryRow('R1', 110)])
            },
            approveResult: { version: { version: 'v2' }, checksStale: true }
        });
        await flush();
        click(dom.document.querySelector('[data-cenniki-publish]'));
        expect(approveVersion).not.toHaveBeenCalled();
        const input = dom.document.getElementById('cenniki-note-input');
        const ok = dom.document.getElementById('cenniki-note-ok');
        expect(input).not.toBeNull();
        expect(ok?.disabled).toBe(true);
        input.value = '0123456789';
        input.dispatchEvent(new dom.window.Event('input'));
        expect(ok?.disabled).toBe(false);
        ok.click();
        await flush();
        expect(approveVersion).toHaveBeenCalledTimes(1);
        expect(approveVersion).toHaveBeenCalledWith('d1', '0123456789');
        expect(showToast).toHaveBeenCalledWith(
            expect.stringContaining('kontrola nieaktualna'),
            'warning'
        );
    });

    it('zwykła publikacja (data przyszła) bez noty i bez modala', async () => {
        const { approveVersion } = loadHubDom({
            versions: versionsList,
            summary: summaryWith(),
            previews: {
                d1: previewOf([ruryRow('R1', 100), courseRow]),
                a1: previewOf([ruryRow('R1', 110)])
            }
        });
        await flush();
        click(dom.document.querySelector('[data-cenniki-publish]'));
        await flush();
        expect(dom.document.getElementById('cenniki-note-input')).toBeNull();
        expect(approveVersion).toHaveBeenCalledTimes(1);
        expect(approveVersion).toHaveBeenCalledWith('d1');
    });
});
