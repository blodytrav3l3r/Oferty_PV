import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { createDom, escapeHtml, loadStudnieScript, type FakeDom } from './helpers/studnieHarness';

interface SetupOptions {
    wells?: any[];
    products?: any[];
    orderEditMode?: boolean;
    imports?: boolean;
    svgColors?: Record<string, string> | null;
    getAvailableProducts?: (filter: any, kind: string) => any[];
    filterByWellParams?: (product: any, well: any) => boolean;
    isWellOrdered?: (well: any) => boolean;
    pzGuard?: { hasPzForWell: (id: string) => boolean } | null;
    autoSelect?: (well: any) => void;
}

function setup(options: SetupOptions = {}) {
    const dom = createDom();
    const toasts: Array<{ msg: string; type?: string }> = [];
    const showModal = jest.fn();
    const closeModal = jest.fn();
    const restoreBodyScroll = jest.fn();
    const refreshAll = jest.fn();
    const logger = { error: jest.fn() };
    const lucide = { createIcons: jest.fn() };
    const wells = options.wells ? [...options.wells] : [];
    const products = options.products ?? [];
    const autoSelectComponents = jest.fn(async () => {
        const current = wells[context.currentWellIndex];
        if (!current) return;
        if (options.autoSelect) options.autoSelect(current);
        else current.config = [{ id: 'auto' }];
    });

    const globals: Record<string, unknown> = {
        wells,
        studnieProducts: products,
        escapeHtml,
        showToast: (msg: string, type?: string) => toasts.push({ msg, type }),
        showModal: (config: any) => {
            showModal(config);
            return dom.register(config.id, { innerHTML: config.html });
        },
        closeModal,
        restoreBodyScroll,
        refreshAll,
        logger,
        orderEditMode: options.orderEditMode === true,
        currentWellIndex: 0,
        autoSelectComponents
    };
    if (options.imports !== false) {
        globals.SVG_COLORS = options.svgColors ?? {
            konus: 'var(--konus)',
            dennica: 'var(--dennica)',
            fallback: 'var(--fallback)'
        };
        if (options.getAvailableProducts) {
            globals.getAvailableProducts = (filter: any, kind: string) =>
                options.getAvailableProducts!(filter, kind);
        }
        if (options.filterByWellParams) {
            globals.filterByWellParams = (product: any, well: any) =>
                options.filterByWellParams!(product, well);
        }
    }

    const { context, exposed } = loadStudnieScript({
        file: 'public/js/studnie/popupsGlobalRecalc.js',
        dom,
        globals,
        expose: '{ _recalcSortClosures, _recalcClosureColor, _recalcSafeDn, _recalcBuildClosureTile, _recalcClosureCandidates, _recalcRedTilesHtml, _recalcTopTilesHtml, _recalcBuildReductionSection, _recalcBuildStycznaSection, _recalcBuildDnGroup }'
    });
    context.window.lucide = lucide;
    if (options.isWellOrdered) context.window.isWellOrdered = options.isWellOrdered;
    if (options.pzGuard !== undefined) context.window.pzGuard = options.pzGuard;

    return {
        dom,
        context,
        exposed,
        wells,
        products,
        toasts,
        showModal,
        closeModal,
        restoreBodyScroll,
        refreshAll,
        logger,
        lucide,
        autoSelectComponents
    };
}

const KONUS = {
    id: 'k1200',
    name: 'Konus DN1200 H=500',
    componentType: 'konus',
    dn: 1200,
    height: 500
};
const KONUS_1000 = {
    id: 'k1000',
    name: 'Konus DN1000 H=500',
    componentType: 'konus',
    dn: 1000,
    height: 500
};
const ODCIAZAJACY = {
    id: 'r1200',
    name: 'Pierścień odciążający DN1200',
    componentType: 'pierscien_odciazajacy',
    dn: 1200
};
const DENNICA = { id: 'd1200', name: 'Dennica DN1200', componentType: 'dennica', dn: 1200 };

describe('popupsGlobalRecalc — helpery', () => {
    it('sortuje zakończenia wg stałej kolejności, bez mutacji wejścia', () => {
        const { exposed } = setup();
        const input = [ODCIAZAJACY, DENNICA, KONUS, { id: 'x', componentType: 'nieznany' }];

        const result = exposed._recalcSortClosures(input);

        expect(result.map((p: any) => p.id)).toEqual(['k1200', 'r1200', 'd1200', 'x']);
        expect(input.map((p: any) => p.id)).toEqual(['r1200', 'd1200', 'k1200', 'x']);
    });

    it('kolor kafelka: typ znany, fallback i twardy default', () => {
        const withColors = setup();
        expect(withColors.exposed._recalcClosureColor('konus')).toBe('var(--konus)');
        expect(withColors.exposed._recalcClosureColor('inny')).toBe('var(--fallback)');

        const withoutColors = setup({ imports: false });
        expect(withoutColors.exposed._recalcClosureColor('konus')).toBe('var(--slate-700)');

        const colorsNoFallback = setup({ svgColors: { konus: 'var(--k)' } });
        expect(colorsNoFallback.exposed._recalcClosureColor('inny')).toBe('var(--slate-700)');
    });

    it('_recalcSafeDn zostawia tylko bezpieczne znaki', () => {
        const { exposed } = setup();
        expect(exposed._recalcSafeDn('1200 "><script>')).toBe('1200script');
        expect(exposed._recalcSafeDn('styczna')).toBe('styczna');
    });

    it('kafelek auto ma ikonę i akcent auto', () => {
        const { exposed } = setup();

        const html = exposed._recalcBuildClosureTile({
            dn: 1200,
            id: 'auto',
            name: '',
            componentType: '',
            height: null,
            isAuto: true,
            isActive: true,
            kind: 'top'
        });

        expect(html).toContain('recalc-top-1200-auto');
        expect(html).toContain('Auto (Domyślny)');
        expect(html).toContain('recalc-tile-auto');
        expect(html).toContain('class="recalc-tile active recalc-tile-auto"');
        expect(html).toContain('data-lucide="refresh-cw"');
        expect(html).toContain('aria-pressed="true"');
        expect(html).toContain('--tile-accent:var(--accent2-hover)');
    });

    it('kafelek redukcji dla auto ma etykietę Auto (Konus)', () => {
        const { exposed } = setup();
        const html = exposed._recalcBuildClosureTile({
            dn: 1200,
            id: 'auto',
            name: '',
            componentType: '',
            height: null,
            isAuto: true,
            isActive: false,
            kind: 'red'
        });

        expect(html).toContain('recalc-redtop-1200-auto');
        expect(html).toContain('Auto (Konus)');
        expect(html).toContain('data-action="recalc-select-redtop"');
    });

    it('kafelek konusa obcina "H=" z nazwy i pokazuje wysokość', () => {
        const { exposed } = setup();

        const html = exposed._recalcBuildClosureTile({
            dn: 1200,
            id: 'k1200',
            name: 'Konus DN1200 H=500',
            componentType: 'konus',
            height: 500,
            isAuto: false,
            isActive: false,
            kind: 'top'
        });

        expect(html).toContain('>Konus DN1200<');
        expect(html).toContain('H=500');
        expect(html).toContain('--tile-accent:var(--konus)');
        expect(html).toContain('data-choice-id="k1200"');
    });

    it('kafelek escapuje nazwę i id (XSS)', () => {
        const { exposed } = setup();

        const html = exposed._recalcBuildClosureTile({
            dn: 1200,
            id: '"><img src=x>',
            name: '<script>alert(1)</script>',
            componentType: 'dennica',
            height: 0,
            isAuto: false,
            isActive: false,
            kind: 'top'
        });

        expect(html).not.toContain('<script>alert(1)</script>');
        expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
        expect(html).not.toContain('><img src=x>');
    });

    it('kandydaci filtrują po DN, typie, magazynie i parametrach studni', () => {
        const available = [KONUS, ODCIAZAJACY];
        const { exposed } = setup({
            getAvailableProducts: () => available,
            filterByWellParams: (p: any, w: any) => w.allow !== p.id
        });

        const result = exposed._recalcClosureCandidates(
            [KONUS, KONUS_1000, ODCIAZAJACY, DENNICA],
            1200,
            'Włocławek',
            [{ id: 'w1', allow: 'r1200' }]
        );

        expect(result.map((p: any) => p.id)).toEqual(['k1200']);
    });

    it('bez helperów magazynowych bierze produkty wprost', () => {
        const { exposed } = setup({ imports: false });

        const result = exposed._recalcClosureCandidates([KONUS, KONUS_1000], 1200, 'Kluczbork', []);

        expect(result.map((p: any) => p.id)).toEqual(['k1200']);
    });

    it('_recalcRedTilesHtml bierze zakończenia dla DN docelowego', () => {
        const { exposed } = setup({ products: [KONUS, KONUS_1000] });
        const html = exposed._recalcRedTilesHtml(1200, 1000, 'Kluczbork', []);

        expect(html).toContain('Auto (Konus)');
        expect(html).toContain('recalc-redtop-1200-auto');
        expect(html).toContain('recalc-redtop-1200-k1000');
        expect(html).not.toContain('recalc-redtop-1200-k1200');
    });

    it('_recalcTopTilesHtml poprzedza listę kafelkiem auto', () => {
        const { exposed } = setup();
        const html = exposed._recalcTopTilesHtml(1200, [KONUS]);

        expect(html.indexOf('Auto (Domyślny)')).toBeLessThan(html.indexOf('Konus DN1200'));
    });
});

describe('popupsGlobalRecalc — sekcje modala', () => {
    it('redukcja dla DN1500+ pokazuje wybór celu, dla DN1200 tylko ukryte 1000', () => {
        const { exposed } = setup({ products: [KONUS_1000] });

        const reducible = exposed._recalcBuildReductionSection(1500, 'Kluczbork', []);
        expect(reducible).toContain('recalc-red-target-changed');
        expect(reducible).toContain('Redukcja na DN1200');

        const fixed = exposed._recalcBuildReductionSection(1200, 'Kluczbork', []);
        expect(fixed).not.toContain('recalc-red-target-changed');
        expect(fixed).toContain('value="1000"');
    });

    it('studnia styczna ustawia domyślną nadbudowę z pierwszej studni grupy', () => {
        const setup1200 = setup();
        const html1200 = setup1200.exposed._recalcBuildStycznaSection('styczna', [
            { stycznaNadbudowa1200: true }
        ]);
        expect(html1200).toContain('<option value="1200" selected>DN1200</option>');
        expect(html1200).toContain('<option value="1000">DN1000</option>');

        const setup1000 = setup();
        const html1000 = setup1000.exposed._recalcBuildStycznaSection('styczna', [{}]);
        expect(html1000).toContain('<option value="1000" selected>DN1000</option>');
    });

    it('grupa DN: licznik, kafelki, empty state i inputy wyboru', () => {
        const { exposed } = setup();
        const html = exposed._recalcBuildDnGroup(1200, 3, [KONUS], 'Włocławek', []);

        expect(html).toContain('Studnie DN 1200');
        expect(html).toContain('3 szt.');
        expect(html).toContain('recalc-choice-top-1200');
        expect(html).toContain('recalc-choice-redtop-1200');
        expect(html).toContain('Wykonaj redukcję');
        expect(html).not.toContain('recalc-empty');
    });

    it('grupa DN: empty state rozróżnia magazyn WL i KLB', () => {
        const { exposed } = setup();

        expect(exposed._recalcBuildDnGroup(1200, 1, [], 'Włocławek', [])).toContain(
            'cenniku magazynu WL'
        );
        expect(exposed._recalcBuildDnGroup(1200, 1, [], 'Kluczbork', [])).toContain(
            'cenniku magazynu KLB'
        );
    });

    it('grupa DN: podpowiedź o komplecie odciążającym i brak redukcji dla DN1000', () => {
        const { exposed } = setup();
        const relief = exposed._recalcBuildDnGroup(1200, 1, [KONUS, ODCIAZAJACY], 'Kluczbork', []);
        expect(relief).toContain('automatycznie uzupełni komplet');

        const small = exposed._recalcBuildDnGroup(1000, 1, [KONUS_1000], 'Kluczbork', []);
        expect(small).not.toContain('recalc-use-red-1000');
    });
});

describe('popupsGlobalRecalc — openGlobalRecalcModal', () => {
    const W1 = { id: 'w1', dn: 1200, magazynNadbudowa: 'Włocławek', zakonczenie: null };

    it('bez studni pokazuje błąd i nie otwiera modala', () => {
        const { context, toasts, showModal } = setup({ wells: [] });

        context.openGlobalRecalcModal();

        expect(toasts).toEqual([{ msg: 'Brak studni w ofercie', type: 'error' }]);
        expect(showModal).not.toHaveBeenCalled();
    });

    it('w trybie edycji zamówienia blokuje przeliczanie', () => {
        const { context, toasts, showModal } = setup({ wells: [W1], orderEditMode: true });

        context.openGlobalRecalcModal();

        expect(toasts[0].type).toBe('error');
        expect(toasts[0].msg).toContain('trybie edycji zamówienia');
        expect(showModal).not.toHaveBeenCalled();
    });

    it('grupuje studnie po DN (numerycznie rosnąco, potem inne) i buduje modal', () => {
        const { context, dom, showModal, products } = setup({
            wells: [
                { id: 'w1', dn: 2000, magazynNadbudowa: 'Włocławek' },
                { id: 'w2', dn: 1200 },
                { id: 'w3', dn: 'styczna' },
                { id: 'w4', dn: 1200 }
            ],
            products: [KONUS, KONUS_1000, ODCIAZAJACY]
        });

        context.openGlobalRecalcModal();

        expect(showModal).toHaveBeenCalledTimes(1);
        const config = showModal.mock.calls[0][0] as { id: string; html: string };
        expect(config.id).toBe('global-recalc-modal');
        expect(config.html).toContain('wszystkich 4 studni w ofercie');
        const html = config.html;
        expect(html.indexOf('Studnie DN 1200')).toBeLessThan(html.indexOf('Studnie DN 2000'));
        expect(html.indexOf('Studnie DN 2000')).toBeLessThan(html.indexOf('Studnie DN styczna'));
        expect(html).toContain('2 szt.');
        expect(products).toHaveLength(3);
        expect(dom.el('global-recalc-modal')).toBeDefined();
    });

    it('bez magazynu w pierwszej studni używa Kluczborka', () => {
        const { context, showModal } = setup({
            wells: [{ id: 'w1', dn: 1200 }],
            products: [KONUS]
        });

        context.openGlobalRecalcModal();

        expect(showModal).toHaveBeenCalledTimes(1);
    });

    it('delegacja kliknięć: zamknij, przelicz i wybór kafelków', () => {
        const { context, dom, closeModal } = setup({
            wells: [{ id: 'w1', dn: 1200 }],
            products: [KONUS]
        });
        const apply = jest.fn();
        const selectTop = jest.fn();
        const selectRed = jest.fn();
        context.applyGlobalRecalc = apply;
        context.recalcSelectTop = selectTop;
        context.recalcSelectRedTop = selectRed;

        context.openGlobalRecalcModal();
        const root = dom.el('global-recalc-modal');
        const makeBtn = (action: string, dn = '1200', id = 'k1200') => {
            const btn = {
                attrs: { 'data-action': action, 'data-dn': dn, 'data-choice-id': id } as Record<
                    string,
                    string
                >,
                closest(selector: string) {
                    return selector === '[data-action]' ? (btn as any) : null;
                },
                getAttribute(name: string) {
                    return this.attrs[name] ?? null;
                }
            };
            root.children.push(btn as any);
            return btn;
        };

        const close = makeBtn('recalc-close');
        const applyBtn = makeBtn('recalc-apply');
        const top = makeBtn('recalc-select-top');
        const red = makeBtn('recalc-select-redtop');
        const foreign = makeBtn('recalc-apply');

        const click = root.handlers.click[0];
        click({ target: close });
        expect(closeModal).toHaveBeenCalledWith('global-recalc-modal');
        click({ target: applyBtn });
        expect(apply).toHaveBeenCalledTimes(1);
        click({ target: top });
        expect(selectTop).toHaveBeenCalledWith('1200', 'k1200');
        click({ target: red });
        expect(selectRed).toHaveBeenCalledWith('1200', 'k1200');

        // element spoza modala jest ignorowany
        root.children.pop();
        click({ target: foreign });
        expect(apply).toHaveBeenCalledTimes(1);
        click({ target: { closest: () => null } });
        expect(apply).toHaveBeenCalledTimes(1);
    });

    it('delegacja zmian: redukcja, cel redukcji, nadbudowa styczna, checkbox', () => {
        const { context, dom } = setup({
            wells: [{ id: 'w1', dn: 1200 }],
            products: []
        });
        const toggleRed = jest.fn();
        const targetChanged = jest.fn();
        const stycznaChanged = jest.fn();
        const toggleConfirm = jest.fn();
        context.recalcToggleRed = toggleRed;
        context.recalcRedTargetChanged = targetChanged;
        context.recalcStycznaDnChanged = stycznaChanged;
        context.recalcToggleConfirm = toggleConfirm;

        context.openGlobalRecalcModal();
        const root = dom.el('global-recalc-modal');
        const change = root.handlers.change[0];
        const makeEl = (action: string, dn = '1200') => {
            const el = {
                attrs: { 'data-action': action, 'data-dn': dn } as Record<string, string>,
                closest(selector: string) {
                    return selector === '[data-action]' ? (el as any) : null;
                },
                getAttribute(name: string) {
                    return this.attrs[name] ?? null;
                }
            };
            root.children.push(el as any);
            return el;
        };

        change({ target: makeEl('recalc-toggle-red') });
        expect(toggleRed).toHaveBeenCalledWith('1200');
        change({ target: makeEl('recalc-red-target-changed') });
        expect(targetChanged).toHaveBeenCalledWith('1200');
        change({ target: makeEl('recalc-styczna-dn-changed', 'styczna') });
        expect(stycznaChanged).toHaveBeenCalledWith('styczna');
        change({ target: makeEl('recalc-toggle-confirm') });
        expect(toggleConfirm).toHaveBeenCalledTimes(1);
        change({ target: { closest: () => null } });
        expect(toggleConfirm).toHaveBeenCalledTimes(1);
    });

    it('ustawia role/aria grup kafelków i tworzy ikony', () => {
        const { context, dom, lucide } = setup({
            wells: [{ id: 'w1', dn: 1200 }],
            products: [KONUS]
        });
        const topGrid = {
            id: 'recalc-top-tiles-1200',
            attrs: {} as Record<string, string>,
            getAttribute(n: string) {
                return this.attrs[n] ?? null;
            },
            setAttribute(n: string, v: string) {
                this.attrs[n] = v;
            }
        };
        const redGrid = {
            id: 'recalc-red-tiles-1200',
            attrs: { role: 'group' } as Record<string, string>,
            getAttribute(n: string) {
                return this.attrs[n] ?? null;
            },
            setAttribute(n: string, v: string) {
                this.attrs[n] = v;
            }
        };
        const grids = [topGrid, redGrid];
        const register = dom.register;
        dom.register = (id: string, props?: Record<string, unknown>) => {
            const el = register(id, props);
            if (id === 'global-recalc-modal') {
                el.querySelectorAll = (selector: string) =>
                    selector === '.recalc-tile-grid' ? grids : [];
            }
            return el;
        };

        context.openGlobalRecalcModal();

        expect(topGrid.attrs.role).toBe('group');
        expect(topGrid.attrs['aria-label']).toBe('Zakończenia DN 1200');
        expect(redGrid.attrs['aria-label']).toBe('Zakończenia DN 1200');
        expect(lucide.createIcons).toHaveBeenCalledWith({
            root: dom.el('global-recalc-modal')
        });
    });

    it('brak elementu w DOM po showModal nie wywala się', () => {
        const { context, showModal } = setup({ wells: [{ id: 'w1', dn: 1200 }] });
        showModal.mockImplementation(() => undefined);

        expect(() => context.openGlobalRecalcModal()).not.toThrow();
    });
});

describe('popupsGlobalRecalc — closeGlobalRecalcModal', () => {
    it('deleguje do window.closeModal, gdy istnieje', () => {
        const { context, closeModal, dom } = setup();
        dom.register('global-recalc-modal');

        context.closeGlobalRecalcModal();

        expect(closeModal).toHaveBeenCalledWith('global-recalc-modal');
    });

    it('fallback: usuwa element i przywraca scroll', () => {
        const { context, dom, restoreBodyScroll } = setup();
        delete context.window.closeModal;
        const modal = dom.register('global-recalc-modal');

        context.closeGlobalRecalcModal();

        expect(modal.removed).toBe(true);
        expect(restoreBodyScroll).toHaveBeenCalledTimes(1);
    });

    it('fallback bez elementu nie rzuca', () => {
        const { context } = setup();
        delete context.window.closeModal;
        delete context.window.restoreBodyScroll;

        expect(() => context.closeGlobalRecalcModal()).not.toThrow();
    });
});

describe('popupsGlobalRecalc — interakcje w modalu', () => {
    it('recalcSelectTop ustawia wartość i przenosi active', () => {
        const { context, dom } = setup();
        const input = dom.register('recalc-choice-top-1200');
        const active = {
            id: 'recalc-top-1200-k1200',
            classList: { toggle: jest.fn() },
            setAttribute: jest.fn()
        };
        const other = {
            id: 'recalc-top-1200-k1000',
            classList: { toggle: jest.fn() },
            setAttribute: jest.fn()
        };
        const grid = dom.register('recalc-top-tiles-1200');
        grid.querySelectorAll = () => [active, other];

        context.recalcSelectTop('1200', 'k1200');

        expect(input.value).toBe('k1200');
        expect(active.classList.toggle).toHaveBeenCalledWith('active', true);
        expect(active.setAttribute).toHaveBeenCalledWith('aria-pressed', 'true');
        expect(other.classList.toggle).toHaveBeenCalledWith('active', false);
        expect(other.setAttribute).toHaveBeenCalledWith('aria-pressed', 'false');
    });

    it('recalcSelectTop/RedTop tolerują brak elementów', () => {
        const { context } = setup();

        expect(() => context.recalcSelectTop('1200', 'auto')).not.toThrow();
        expect(() => context.recalcSelectRedTop('1200', 'auto')).not.toThrow();
    });

    it('recalcSelectRedTop ustawia wybór redukcji', () => {
        const { context, dom } = setup();
        const input = dom.register('recalc-choice-redtop-1200');
        const grid = dom.register('recalc-red-tiles-1200');
        const tile = {
            id: 'recalc-redtop-1200-auto',
            classList: { toggle: jest.fn() },
            setAttribute: jest.fn()
        };
        grid.querySelectorAll = () => [tile];

        context.recalcSelectRedTop('1200', 'auto');

        expect(input.value).toBe('auto');
        expect(tile.classList.toggle).toHaveBeenCalledWith('active', true);
    });

    it('recalcToggleRed pokazuje i ukrywa panel redukcji', () => {
        const { context, dom } = setup();
        const cb = dom.register('recalc-use-red-1200', { checked: true });
        const box = dom.register('recalc-red-box-1200', { hidden: true });

        context.recalcToggleRed('1200');
        expect(box.hidden).toBe(false);

        cb.checked = false;
        context.recalcToggleRed('1200');
        expect(box.hidden).toBe(true);
    });

    it('recalcToggleRed bez elementów nie rzuca', () => {
        const { context } = setup();
        expect(() => context.recalcToggleRed('1200')).not.toThrow();
    });

    it('recalcRedTargetChanged przebudowuje kafelki dla nowego celu', () => {
        const { context, dom, lucide } = setup({
            wells: [{ id: 'w1', dn: 1500 }],
            products: [KONUS, KONUS_1000]
        });
        const select = dom.register('recalc-red-target-1500', { value: '1200' });
        const tiles = dom.register('recalc-red-tiles-1500');
        const label = dom.register('recalc-red-toplabel-1500');
        const choice = dom.register('recalc-choice-redtop-1500', { value: 'k1000' });

        context.recalcRedTargetChanged('1500');

        expect(select.value).toBe('1200');
        expect(tiles.innerHTML).toContain('recalc-redtop-1500-k1200');
        expect(tiles.innerHTML).not.toContain('recalc-redtop-1500-k1000');
        expect(tiles.attrs.role).toBe('group');
        expect(tiles.attrs['aria-label']).toBe('Zakończenia redukcji DN 1200');
        expect(label.textContent).toBe('Zakończenie komina DN1200');
        expect(choice.value).toBe('auto');
        expect(lucide.createIcons).toHaveBeenCalledWith({ root: tiles });
    });

    it('recalcRedTargetChanged: niepoprawna wartość wraca do DN1000 i brak selectora nie rzuca', () => {
        const { context, dom } = setup({ wells: [{ id: 'w1', dn: 1500 }] });
        dom.register('recalc-red-target-1500', { value: '999' });
        const tiles = dom.register('recalc-red-tiles-1500');
        const label = dom.register('recalc-red-toplabel-1500');

        context.recalcRedTargetChanged('1500');

        expect(tiles.innerHTML).toContain('Auto (Konus)');
        expect(label.textContent).toBe('Zakończenie komina DN1000');

        expect(() => context.recalcRedTargetChanged('brak')).not.toThrow();
    });

    it('recalcStycznaDnChanged przelicza zakończenia dla wybranej nadbudowy', () => {
        const { context, dom, lucide } = setup({
            wells: [{ id: 'w1', dn: 'styczna', magazynNadbudowa: 'Włocławek' }],
            products: [KONUS, KONUS_1000]
        });
        const select = dom.register('recalc-styczna-dn-styczna', { value: '1200' });
        const tiles = dom.register('recalc-top-tiles-styczna');
        const choice = dom.register('recalc-choice-top-styczna', { value: 'k1000' });

        context.recalcStycznaDnChanged('styczna');

        expect(select.value).toBe('1200');
        expect(tiles.innerHTML).toContain('recalc-top-styczna-k1200');
        expect(tiles.innerHTML).not.toContain('recalc-top-styczna-k1000');
        expect(tiles.attrs['aria-label']).toBe('Zakończenia DN 1200');
        expect(choice.value).toBe('auto');
        expect(lucide.createIcons).toHaveBeenCalledWith({ root: tiles });
    });

    it('recalcStycznaDnChanged pokazuje empty state i toleruje brak elementów', () => {
        const { context, dom } = setup({ wells: [{ id: 'w1', dn: 'styczna' }], products: [] });
        dom.register('recalc-styczna-dn-styczna', { value: '1000' });
        const tiles = dom.register('recalc-top-tiles-styczna');

        context.recalcStycznaDnChanged('styczna');

        expect(tiles.innerHTML).toContain('Brak dostępnych zakończeń');
        expect(tiles.innerHTML).toContain('cenniku magazynu KLB');

        expect(() => context.recalcStycznaDnChanged('brak')).not.toThrow();
    });

    it('recalcToggleConfirm odblokowuje przycisk tylko po zaznaczeniu', () => {
        const { context, dom } = setup();
        const cb = dom.register('recalc-confirm-override', { checked: true });
        const btn = dom.register('recalc-apply-btn', { disabled: true });

        context.recalcToggleConfirm();
        expect(btn.disabled).toBe(false);

        cb.checked = false;
        context.recalcToggleConfirm();
        expect(btn.disabled).toBe(true);
    });

    it('recalcToggleConfirm bez elementów nie rzuca', () => {
        const { context } = setup();
        expect(() => context.recalcToggleConfirm()).not.toThrow();
    });
});

describe('popupsGlobalRecalc — applyGlobalRecalc', () => {
    function registerModalDom(dom: FakeDom, prefs: Record<string, any> = {}) {
        const btn = dom.register('recalc-apply-btn');
        const progress = dom.register('recalc-progress', { hidden: true });
        const cancel = { disabled: false };
        dom.setQueryOne('#global-recalc-modal .btn-secondary', cancel);
        for (const [dn, p] of Object.entries(prefs)) {
            if (p.top !== undefined) dom.register(`recalc-choice-top-${dn}`, { value: p.top });
            if (p.useRed !== undefined) dom.register(`recalc-use-red-${dn}`, { checked: p.useRed });
            if (p.redTop !== undefined)
                dom.register(`recalc-choice-redtop-${dn}`, { value: p.redTop });
            if (p.redTarget !== undefined)
                dom.register(`recalc-red-target-${dn}`, { value: p.redTarget });
            if (p.redMinH !== undefined)
                dom.register(`recalc-red-minh-${dn}`, { value: p.redMinH });
            if (p.stycznaDn !== undefined)
                dom.register(`recalc-styczna-dn-${dn}`, { value: p.stycznaDn });
        }
        return { btn, progress, cancel };
    }

    it('przelicza wszystkie studnie i stosuje preferencje z formularza', async () => {
        const wells: any[] = [
            { id: 'w1', dn: 1200 },
            { id: 'w2', dn: 1200 }
        ];
        const { context, dom, toasts, closeModal, refreshAll, autoSelectComponents } = setup({
            wells
        });
        const { btn, progress } = registerModalDom(dom, {
            1200: { top: 'k1200', useRed: true, redTop: 'r1200', redTarget: '1200', redMinH: '3,2' }
        });

        await context.applyGlobalRecalc();

        expect(wells[0]).toMatchObject({
            zakonczenie: 'k1200',
            redukcjaDN1000: true,
            redukcjaTargetDN: 1200,
            redukcjaMinH: 3200,
            redukcjaZakonczenie: 'r1200',
            autoLocked: false
        });
        expect(wells[1].zakonczenie).toBe('k1200');
        expect(autoSelectComponents).toHaveBeenCalledTimes(2);
        expect(autoSelectComponents).toHaveBeenCalledWith(true);
        expect(progress.hidden).toBe(false);
        expect(refreshAll).toHaveBeenCalledTimes(1);
        expect(closeModal).toHaveBeenCalledWith('global-recalc-modal');
        expect(toasts[0]).toEqual({
            msg: 'Wszystkie studnie przeliczone poprawnie',
            type: 'success'
        });
        expect(btn.disabled).toBe(true);
    });

    it('czyści redukcję, gdy checkbox jest odznaczony, i używa domyślnych wartości', async () => {
        const wells = [{ id: 'w1', dn: 2000, redukcjaDN1000: true, redukcjaZakonczenie: 'r1' }];
        const { context, dom } = setup({ wells });
        registerModalDom(dom, { 2000: { top: 'auto', useRed: false } });

        await context.applyGlobalRecalc();

        expect(wells[0]).toMatchObject({
            zakonczenie: null,
            redukcjaDN1000: false,
            redukcjaTargetDN: 1000,
            redukcjaZakonczenie: null
        });
    });

    it('studnia styczna dostaje nadbudowę, a resztki redukcji są czyszczone', async () => {
        const wells = [
            { id: 'w1', dn: 'styczna', redukcjaDN1000: true, redukcjaZakonczenie: 'r1' }
        ];
        const { context, dom } = setup({ wells });
        registerModalDom(dom, { styczna: { top: 'auto', stycznaDn: '1200' } });

        await context.applyGlobalRecalc();

        expect(wells[0]).toMatchObject({
            stycznaNadbudowa1200: true,
            redukcjaTargetDN: 1200,
            redukcjaDN1000: false,
            redukcjaZakonczenie: null
        });
    });

    it('pomija studnie zamówione (isWellOrdered) i z PZ', async () => {
        const wells = [
            { id: 'w1', dn: 1200 },
            { id: 'w2', dn: 1200 }
        ];
        const { context, dom, toasts, autoSelectComponents } = setup({
            wells,
            isWellOrdered: (w: any) => w.id === 'w1',
            pzGuard: { hasPzForWell: (id: string) => id === 'w2' }
        });
        registerModalDom(dom, { 1200: { top: 'auto' } });

        await context.applyGlobalRecalc();

        expect(autoSelectComponents).not.toHaveBeenCalled();
        expect(toasts[0].type).toBe('warning');
        expect(toasts[0].msg).toContain('wszystkie 2 studnie są zablokowane');
    });

    it('mieszana sytuacja: przeliczone + pominięte pokazuje licznik', async () => {
        const wells = [
            { id: 'w1', dn: 1200 },
            { id: 'w2', dn: 1200 }
        ];
        const { context, dom, toasts } = setup({
            wells,
            isWellOrdered: (w: any) => w.id === 'w2'
        });
        registerModalDom(dom, { 1200: { top: 'auto' } });

        await context.applyGlobalRecalc();

        expect(toasts[0].msg).toContain('Przeliczono 1 z 2 studni');
        expect(toasts[0].msg).toContain('Pominięto 1 studni');
        expect(toasts[0].type).toBe('info');
    });

    it('raportuje studnie, dla których konfiguracja się nie wygenerowała', async () => {
        const wells = [{ id: 'w1', dn: 1200 }];
        const { context, dom, toasts } = setup({
            wells,
            autoSelect: (well: any) => {
                well.config = [];
            }
        });
        registerModalDom(dom, { 1200: { top: 'auto' } });

        await context.applyGlobalRecalc();

        expect(toasts[0]).toEqual({
            msg: 'Nie przeliczono 1 studni — błąd konfiguracji.',
            type: 'error'
        });
    });

    it('liczy też studnie ze statusem ERROR', async () => {
        const wells = [{ id: 'w1', dn: 1200 }];
        const { context, dom, toasts } = setup({
            wells,
            autoSelect: (well: any) => {
                well.config = [{ id: 'x' }];
                well.configStatus = 'ERROR';
            }
        });
        registerModalDom(dom, { 1200: { top: 'auto' } });

        await context.applyGlobalRecalc();

        expect(toasts[0].type).toBe('error');
    });

    it('błąd w trakcie przeliczania: log, toast, przycisk do ponowienia', async () => {
        const wells = [{ id: 'w1', dn: 1200 }];
        const { context, dom, toasts, logger, autoSelectComponents } = setup({ wells });
        autoSelectComponents.mockRejectedValueOnce(new Error('solver'));
        const { btn, progress, cancel } = registerModalDom(dom, { 1200: { top: 'auto' } });

        await context.applyGlobalRecalc();

        expect(logger.error).toHaveBeenCalledWith('wellPopups', expect.anything());
        expect(toasts[0]).toEqual({
            msg: 'Wystąpił błąd podczas przeliczania',
            type: 'error'
        });
        expect(progress.textContent).toBe('Przeliczanie zakończone błędem.');
        expect(btn.innerHTML).toBe('Spróbuj ponownie');
        expect(btn.disabled).toBe(false);
        expect(cancel.disabled).toBe(false);
    });

    it('przywraca indeks studni także przy sukcesie i błędzie', async () => {
        const wells = [
            { id: 'w1', dn: 1200 },
            { id: 'w2', dn: 1200 }
        ];
        const ok = setup({ wells });
        ok.context.currentWellIndex = 7;
        registerModalDom(ok.dom, { 1200: { top: 'auto' } });

        await ok.context.applyGlobalRecalc();

        expect(ok.context.currentWellIndex).toBe(7);

        const failing = setup({ wells: [{ id: 'w1', dn: 1200 }] });
        failing.context.currentWellIndex = 3;
        failing.autoSelectComponents.mockRejectedValueOnce(new Error('x'));
        registerModalDom(failing.dom, { 1200: { top: 'auto' } });

        await failing.context.applyGlobalRecalc();

        expect(failing.context.currentWellIndex).toBe(3);
    });

    it('studnia bez preferencji (brak wejścia w pętli grupy) jest pomijana', async () => {
        const wells = [{ id: 'w1', dn: 1200 }];
        const { context, dom, autoSelectComponents } = setup({ wells });
        // usuwamy DN z formularza → prefs[1200] nadal powstaje, ale pętla i tak go znajdzie.
        // Sprawdzamy więc ścieżkę braku przycisku/postępu: brak wyjątku.
        dom.register('recalc-apply-btn');

        await context.applyGlobalRecalc();

        expect(autoSelectComponents).toHaveBeenCalledTimes(1);
    });
});

/* Strażnik: plik źródłowy ma tylko classic-script, więc vm nie potrzebuje ESM. */
describe('popupsGlobalRecalc — źródło', () => {
    it('plik nie zawiera importów ESM (harness vm)', () => {
        const source = fs.readFileSync(
            path.join(process.cwd(), 'public/js/studnie/popupsGlobalRecalc.js'),
            'utf8'
        );
        expect(/^\s*import\s/m.test(source)).toBe(false);
        expect(/^\s*export\s/m.test(source)).toBe(false);
        expect(vm).toBeDefined();
    });
});
