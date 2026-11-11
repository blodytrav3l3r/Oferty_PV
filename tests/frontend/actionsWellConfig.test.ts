import { createDom, loadStudnieScript } from './helpers/studnieHarness';

interface SetupOptions {
    well?: any;
    softLocked?: boolean;
    wellLocked?: boolean;
    productionOrders?: any[];
    products?: any[];
}

const OFFER_LOCKED_MSG = 'Oferta zablokowana';
const WELL_LOCKED_MSG = 'Studnia zablokowana';

function setup(options: SetupOptions = {}) {
    const dom = createDom();
    const toasts: Array<{ msg: string; type?: string }> = [];
    const closeModal = jest.fn();
    const autoSelectComponents = jest.fn(async (_flag?: boolean) => undefined);
    const refreshAll = jest.fn();
    const updateZakonczenieButton = jest.fn();
    const updateRedukcjaButton = jest.fn();
    const updateRedukcjaZakButton = jest.fn();
    const updatePsiaBudaButton = jest.fn();
    const renderTiles = jest.fn();
    const renderWellsList = jest.fn();
    const renderWellParams = jest.fn();
    const showStycznaPopup = jest.fn();
    const openRedukcjaChoicePopup = jest.fn();
    const ensureReliefRingPair = jest.fn();
    const findClosureForDn = jest.fn();

    const well = options.well ?? null;
    const products = options.products ?? [];

    const { context, exposed } = loadStudnieScript({
        file: 'public/js/studnie/actionsWellConfig.js',
        dom,
        globals: {
            getCurrentWell: () => well,
            isOrderedWellSoftLocked: () => options.softLocked === true,
            isWellLocked: () => options.wellLocked === true,
            productionOrders: options.productionOrders ?? [],
            studnieProducts: products,
            getStudnieProductById: (id: string) => products.find((p) => p.id === id),
            findClosureForDn: (...args: unknown[]) => findClosureForDn(...args),
            autoSelectComponents: (flag?: boolean) => autoSelectComponents(flag),
            refreshAll,
            closeModal,
            updateZakonczenieButton,
            updateRedukcjaButton,
            updateRedukcjaZakButton,
            updatePsiaBudaButton,
            renderTiles,
            renderWellsList,
            renderWellParams,
            showStycznaPopup,
            openRedukcjaChoicePopup,
            ensureReliefRingPair,
            showToast: (msg: string, type?: string) => toasts.push({ msg, type }),
            currentWellIndex: 2,
            OFFER_LOCKED_MSG,
            WELL_LOCKED_MSG,
            offerDefaultZakonczenie: null,
            offerDefaultRedukcja: null,
            offerDefaultRedukcjaZak: null
        },
        expose: '{ selectZakonczenie, toggleRedukcja, togglePsiaBuda, toggleStyczna1200, updateStyczna1200Button, selectRedukcjaZakonczenie, selectDN, doSelectDN, updateDNButtons }'
    });

    return {
        dom,
        context,
        exposed,
        well,
        products,
        toasts,
        closeModal,
        autoSelectComponents,
        refreshAll,
        updateZakonczenieButton,
        updateRedukcjaButton,
        updateRedukcjaZakButton,
        updatePsiaBudaButton,
        renderTiles,
        renderWellsList,
        renderWellParams,
        showStycznaPopup,
        openRedukcjaChoicePopup,
        ensureReliefRingPair,
        findClosureForDn
    };
}

const KONUS = { id: 'k1200', name: 'Konus DN1200 H=500', componentType: 'konus', dn: 1200 };
const KONUS_1500 = { id: 'k1500', name: 'Konus DN1500', componentType: 'konus', dn: 1500 };
const RELIEF = {
    id: 'r1',
    name: 'Pierścień odciążający DN1200',
    componentType: 'pierscien_odciazajacy',
    dn: 1200
};

function baseWell(overrides: Record<string, unknown> = {}) {
    return {
        id: 'w1',
        dn: 1200,
        name: 'Studnia DN1200 (#3)',
        zakonczenie: null,
        autoLocked: false,
        config: [{ id: 'x' }],
        ...overrides
    };
}

describe('actionsWellConfig — selectZakonczenie', () => {
    it('bez studni nie robi nic', async () => {
        const { exposed, toasts } = setup();
        await exposed.selectZakonczenie('k1200');
        expect(toasts).toHaveLength(0);
    });

    it('blokady: oferta i zaakceptowane zlecenie produkcyjne', async () => {
        const soft = setup({ well: baseWell(), softLocked: true });
        await soft.exposed.selectZakonczenie('k1200');
        expect(soft.toasts).toEqual([{ msg: OFFER_LOCKED_MSG, type: 'error' }]);
        expect(soft.well.zakonczenie).toBeNull();

        const po = setup({
            well: baseWell(),
            productionOrders: [{ wellId: 'w1', status: 'accepted' }]
        });
        await po.exposed.selectZakonczenie('k1200');
        expect(po.toasts).toEqual([{ msg: WELL_LOCKED_MSG, type: 'error' }]);
    });

    it('ustawia zakończenie, domyślną wartość i przelicza konfigurację', async () => {
        const { exposed, well, context, toasts, closeModal, autoSelectComponents, refreshAll } =
            setup({
                well: baseWell(),
                products: [KONUS]
            });

        await exposed.selectZakonczenie('k1200');

        expect(well.zakonczenie).toBe('k1200');
        expect(context.offerDefaultZakonczenie).toBe('k1200');
        expect(well.configSource).toBe('AUTO');
        expect(well.config).toEqual([]);
        expect(closeModal).toHaveBeenCalled();
        expect(autoSelectComponents).toHaveBeenCalledWith(true);
        expect(refreshAll).toHaveBeenCalled();
        expect(toasts[0]).toEqual({ msg: 'Zakończenie: Konus DN1200 H=500', type: 'success' });
    });

    it('auto (null) ma własny komunikat', async () => {
        const { exposed, well, toasts } = setup({ well: baseWell(), products: [KONUS] });

        await exposed.selectZakonczenie(null);

        expect(well.zakonczenie).toBeNull();
        expect(toasts[0]).toEqual({ msg: 'Zakończenie: Auto (Konus)', type: 'success' });
    });

    it('studnia styczna zapisuje wybór per średnica nadbudowy', async () => {
        const { exposed, well } = setup({
            well: baseWell({ dn: 'styczna', stycznaNadbudowa1200: true }),
            products: [KONUS]
        });

        await exposed.selectZakonczenie('k1200');

        expect(well.zakonczenieByDn).toEqual({ 1200: 'k1200' });
    });

    it('autoLocked nie nadpisuje ręcznej konfiguracji', async () => {
        const { exposed, autoSelectComponents, well } = setup({
            well: baseWell({ autoLocked: true }),
            products: [KONUS]
        });

        await exposed.selectZakonczenie('k1200');

        expect(well.config).toEqual([{ id: 'x' }]);
        expect(autoSelectComponents).not.toHaveBeenCalled();
    });
});

describe('actionsWellConfig — toggleRedukcja', () => {
    it('waliduje istnienie studni, blokady i średnicę', async () => {
        const noWell = setup();
        await noWell.exposed.toggleRedukcja();
        expect(noWell.toasts[0].msg).toBe('Najpierw dodaj studnię');

        const locked = setup({ well: baseWell(), wellLocked: true });
        await locked.exposed.toggleRedukcja();
        expect(locked.toasts[0]).toEqual({ msg: WELL_LOCKED_MSG, type: 'error' });

        const small = setup({ well: baseWell({ dn: 1000 }) });
        await small.exposed.toggleRedukcja();
        expect(small.toasts[0].msg).toContain('DN ≥ 1200');
    });

    it('DN1200 włącza redukcję i przelicza konfigurację', async () => {
        const { exposed, well, context, toasts, updateRedukcjaButton, autoSelectComponents } =
            setup({
                well: baseWell()
            });

        await exposed.toggleRedukcja();

        expect(well.redukcjaDN1000).toBe(true);
        expect(well.redukcjaTargetDN).toBe(1000);
        expect(context.offerDefaultRedukcja).toBe(true);
        expect(updateRedukcjaButton).toHaveBeenCalled();
        expect(autoSelectComponents).toHaveBeenCalled();
        expect(toasts[0].msg).toContain('WŁĄCZONA');
    });

    it('wyłączenie redukcji czyści zakończenie i przyciski', async () => {
        const { exposed, well, toasts, updateZakonczenieButton, updateRedukcjaZakButton } = setup({
            well: baseWell({
                redukcjaDN1000: true,
                zakonczenie: 'k1200',
                redukcjaZakonczenie: 'r1'
            })
        });

        await exposed.toggleRedukcja();

        expect(well.redukcjaDN1000).toBe(false);
        expect(well.zakonczenie).toBeNull();
        expect(well.redukcjaZakonczenie).toBeNull();
        expect(updateZakonczenieButton).toHaveBeenCalled();
        expect(updateRedukcjaZakButton).toHaveBeenCalled();
        expect(toasts[0].msg).toContain('WYŁĄCZONA');
    });

    it('dla DN2000 otwiera wybór redukcji zamiast przełączać', async () => {
        const { exposed, well, openRedukcjaChoicePopup } = setup({ well: baseWell({ dn: 2000 }) });

        await exposed.toggleRedukcja();

        expect(openRedukcjaChoicePopup).toHaveBeenCalled();
        expect(well.redukcjaDN1000).toBeUndefined();
    });

    it('studnia styczna zawsze otwiera popup wyboru redukcji', async () => {
        const { exposed, openRedukcjaChoicePopup } = setup({
            well: baseWell({ dn: 'styczna' })
        });

        await exposed.toggleRedukcja();

        expect(openRedukcjaChoicePopup).toHaveBeenCalled();
    });
});

describe('actionsWellConfig — togglePsiaBuda', () => {
    it('włączenie zapisuje backup i zeruje kinetę/spocznik', async () => {
        const { exposed, well, toasts, renderWellParams, autoSelectComponents } = setup({
            well: baseWell({ kineta: 'klinkier', spocznik: 'preco', spocznikH: '3/4' })
        });

        await exposed.togglePsiaBuda();

        expect(well.psiaBuda).toBe(true);
        expect(well._psiaBudaBackup).toEqual({
            kineta: 'klinkier',
            spocznik: 'preco',
            spocznikH: '3/4'
        });
        expect(well.kineta).toBe('brak');
        expect(well.spocznik).toBe('brak');
        expect(well.spocznikH).toBe('brak');
        expect(renderWellParams).toHaveBeenCalled();
        expect(autoSelectComponents).toHaveBeenCalled();
        expect(toasts[0].msg).toContain('WŁĄCZONY');
    });

    it('wyłączenie przywraca wartości z backupu i usuwa backup', async () => {
        const { exposed, well, toasts } = setup({
            well: baseWell({
                psiaBuda: true,
                kineta: 'brak',
                spocznik: 'brak',
                spocznikH: 'brak',
                _psiaBudaBackup: { kineta: 'beton', spocznik: 'beton', spocznikH: '1/2' }
            })
        });

        await exposed.togglePsiaBuda();

        expect(well.psiaBuda).toBe(false);
        expect(well.kineta).toBe('beton');
        expect(well.spocznik).toBe('beton');
        expect(well.spocznikH).toBe('1/2');
        expect(well._psiaBudaBackup).toBeUndefined();
        expect(toasts[0].msg).toContain('WYŁĄCZONY');
    });

    it('bez studni i przy zaakceptowanym zleceniu nie zmienia stanu', async () => {
        const noWell = setup();
        await noWell.exposed.togglePsiaBuda();
        expect(noWell.toasts[0].msg).toBe('Najpierw dodaj studnię');

        const po = setup({
            well: baseWell(),
            productionOrders: [{ wellId: 'w1', status: 'accepted' }]
        });
        await po.exposed.togglePsiaBuda();
        expect(po.well.psiaBuda).toBeUndefined();
        expect(po.toasts[0].msg).toBe(WELL_LOCKED_MSG);
    });
});

describe('actionsWellConfig — toggleStyczna1200', () => {
    it('poza studnią styczną nic nie robi', async () => {
        const { exposed, well } = setup({ well: baseWell() });

        await exposed.toggleStyczna1200();

        expect(well.stycznaNadbudowa1200).toBeUndefined();
    });

    it('przełącza nadbudowę i przenosi zakończenie na nową średnicę', async () => {
        const { exposed, well, toasts, updateZakonczenieButton, findClosureForDn } = setup({
            well: baseWell({
                dn: 'styczna',
                stycznaNadbudowa1200: false,
                zakonczenie: 'k1200'
            })
        });
        findClosureForDn.mockReturnValue('k1500');

        await exposed.toggleStyczna1200();

        expect(well.stycznaNadbudowa1200).toBe(true);
        expect(well.zakonczenieByDn[1000]).toBe('k1200');
        expect(findClosureForDn).toHaveBeenCalledWith('k1200', 1200);
        expect(well.zakonczenie).toBe('k1500');
        expect(well.zakonczenieByDn[1200]).toBe('k1500');
        expect(updateZakonczenieButton).toHaveBeenCalled();
        expect(toasts[0].msg).toContain('DN1200');
    });

    it('przenosi też zakończenie redukcji, gdy redukcja jest włączona', async () => {
        const { exposed, well, findClosureForDn, updateRedukcjaZakButton } = setup({
            well: baseWell({
                dn: 'styczna',
                stycznaNadbudowa1200: true,
                redukcjaDN1000: true,
                redukcjaZakonczenie: 'r1'
            })
        });
        findClosureForDn.mockReturnValue('r2');

        await exposed.toggleStyczna1200();

        expect(well.redukcjaTargetDN).toBe(1000);
        expect(well.redukcjaZakonczenieByDn[1200]).toBe('r1');
        expect(well.redukcjaZakonczenie).toBe('r2');
        expect(updateRedukcjaZakButton).toHaveBeenCalled();
    });

    it('blokada studni zatrzymuje przełączenie', async () => {
        const { exposed, well, toasts } = setup({
            well: baseWell({ dn: 'styczna' }),
            wellLocked: true
        });

        await exposed.toggleStyczna1200();

        expect(well.stycznaNadbudowa1200).toBeUndefined();
        expect(toasts[0].msg).toBe(WELL_LOCKED_MSG);
    });
});

describe('actionsWellConfig — updateStyczna1200Button', () => {
    it('ukrywa przycisk poza studnią styczną i zeruje flagę', () => {
        const { exposed, well, dom } = setup({
            well: baseWell({ stycznaNadbudowa1200: true })
        });
        const btn = dom.register('btn-styczna-1200');

        exposed.updateStyczna1200Button();

        expect(btn.style.display).toBe('none');
        expect(well.stycznaNadbudowa1200).toBe(false);
    });

    it('dla stycznej DN1200 pokazuje aktywny przycisk', () => {
        const { exposed, dom } = setup({
            well: baseWell({ dn: 'styczna', stycznaNadbudowa1200: true })
        });
        const btn = dom.register('btn-styczna-1200');

        exposed.updateStyczna1200Button();

        expect(btn.style.display).toBe('inline-block');
        expect(btn.innerHTML).toBe('Nadbudowa DN1200');
        expect(btn.classList.contains('bg-accent-subtle')).toBe(true);
    });

    it('dla stycznej DN1000 zdejmuje klasy akcentu', () => {
        const { exposed, dom } = setup({
            well: baseWell({ dn: 'styczna', stycznaNadbudowa1200: false })
        });
        const btn = dom.register('btn-styczna-1200');

        exposed.updateStyczna1200Button();

        expect(btn.classList.contains('bg-accent-subtle')).toBe(false);
        expect(btn.style.borderColor).toBe('var(--border-glass)');
    });
});

describe('actionsWellConfig — selectRedukcjaZakonczenie', () => {
    it('komplet odciążający ma dedykowany komunikat', async () => {
        const { exposed, well, toasts, ensureReliefRingPair, autoSelectComponents } = setup({
            well: baseWell({ redukcjaDN1000: true }),
            products: [RELIEF]
        });

        await exposed.selectRedukcjaZakonczenie('r1');

        expect(well.redukcjaZakonczenie).toBe('r1');
        expect(ensureReliefRingPair).toHaveBeenCalledWith(well);
        expect(autoSelectComponents).toHaveBeenCalled();
        expect(toasts[0].msg).toContain('komplet odciążający');
    });

    it('zwykłe zakończenie i auto mają własne komunikaty', async () => {
        const plain = setup({ well: baseWell(), products: [KONUS] });
        await plain.exposed.selectRedukcjaZakonczenie('k1200');
        expect(plain.toasts[0].msg).toBe('Zakończenie redukcji: Konus DN1200 H=500');

        const auto = setup({ well: baseWell(), products: [KONUS] });
        await auto.exposed.selectRedukcjaZakonczenie(null);
        expect(auto.toasts[0].msg).toBe('Zakończenie redukcji: Auto');
    });

    it('studnia styczna zapisuje wybór per średnica', async () => {
        const { exposed, well } = setup({
            well: baseWell({ dn: 'styczna', stycznaNadbudowa1200: false }),
            products: [KONUS]
        });

        await exposed.selectRedukcjaZakonczenie('k1200');

        expect(well.redukcjaZakonczenieByDn).toEqual({ 1000: 'k1200' });
    });

    it('blokada oferty i studni zatrzymuje wybór', async () => {
        const soft = setup({ well: baseWell(), softLocked: true });
        await soft.exposed.selectRedukcjaZakonczenie('k1200');
        expect(soft.toasts[0].msg).toBe(OFFER_LOCKED_MSG);

        const locked = setup({ well: baseWell(), wellLocked: true });
        await locked.exposed.selectRedukcjaZakonczenie('k1200');
        expect(locked.toasts[0].msg).toBe(WELL_LOCKED_MSG);
    });
});

describe('actionsWellConfig — selectDN / doSelectDN', () => {
    it('styczna otwiera popup wyboru, bez zmiany DN', () => {
        const { exposed, well, showStycznaPopup } = setup({ well: baseWell() });

        exposed.selectDN('styczna');

        expect(showStycznaPopup).toHaveBeenCalledWith('select');
        expect(well.dn).toBe(1200);
    });

    it('styczna respektuje blokady', () => {
        const soft = setup({ well: baseWell(), softLocked: true });
        soft.exposed.selectDN('styczna');
        expect(soft.toasts[0].msg).toBe(OFFER_LOCKED_MSG);
        expect(soft.showStycznaPopup).not.toHaveBeenCalled();

        const noWell = setup();
        noWell.exposed.selectDN('styczna');
        expect(noWell.toasts[0].msg).toBe('Najpierw dodaj studnię');
    });

    it('zmiana DN aktualizuje nazwę, konfigurację i zakończenie dla nowej średnicy', async () => {
        const {
            exposed,
            well,
            products,
            autoSelectComponents,
            refreshAll,
            renderTiles,
            renderWellsList
        } = setup({
            well: baseWell({ zakonczenie: 'k1200' }),
            products: [KONUS, KONUS_1500]
        });

        exposed.doSelectDN(1500);

        expect(well.dn).toBe(1500);
        expect(well.name).toBe('Studnia DN1500 (#3)');
        expect(well.zakonczenie).toBe('k1500');
        expect(well.config).toEqual([]);
        expect(autoSelectComponents).toHaveBeenCalledWith(true);
        expect(refreshAll).toHaveBeenCalled();
        expect(renderTiles).toHaveBeenCalled();
        expect(renderWellsList).toHaveBeenCalled();
        expect(products).toHaveLength(2);
    });

    it('zachowuje ręczną nazwę studni', () => {
        const { exposed, well } = setup({
            well: baseWell({
                numer: 'P-7',
                name: 'Studnia przy budynku A',
                zakonczenie: null
            })
        });

        exposed.doSelectDN(1500);

        expect(well.name).toBe('Studnia przy budynku A');
    });

    it('nazwa z numerem jest odtwarzana z numeru', () => {
        const { exposed, well } = setup({
            well: baseWell({ numer: 'P-7', name: 'Studnia DN1200 (#3)', zakonczenie: null })
        });

        exposed.doSelectDN(1500);

        expect(well.name).toBe('P-7');
    });

    it('brak odpowiednika zakończenia czyści wybór', () => {
        const { exposed, well } = setup({
            well: baseWell({ zakonczenie: 'k1200' }),
            products: [KONUS]
        });

        exposed.doSelectDN(2000);

        expect(well.zakonczenie).toBeNull();
    });

    it('ta sama średnica nie przelicza konfiguracji', () => {
        const { exposed, well, autoSelectComponents, refreshAll } = setup({ well: baseWell() });

        exposed.doSelectDN(1200);

        expect(well.config).toEqual([{ id: 'x' }]);
        expect(autoSelectComponents).not.toHaveBeenCalled();
        expect(refreshAll).not.toHaveBeenCalled();
    });

    it('doSelectDN pilnuje blokad i zaakceptowanych zleceń', () => {
        const soft = setup({ well: baseWell(), softLocked: true });
        soft.exposed.doSelectDN(1500);
        expect(soft.toasts[0].msg).toBe(OFFER_LOCKED_MSG);
        expect(soft.well.dn).toBe(1200);

        const po = setup({
            well: baseWell(),
            productionOrders: [{ wellId: 'w1', status: 'accepted' }]
        });
        po.exposed.doSelectDN(1500);
        expect(po.toasts[0].msg).toBe(WELL_LOCKED_MSG);
        expect(po.well.dn).toBe(1200);

        const noWell = setup();
        noWell.exposed.doSelectDN(1500);
        expect(noWell.toasts[0].msg).toBe('Najpierw dodaj studnię');
    });
});

describe('actionsWellConfig — updateDNButtons', () => {
    it('podświetla przycisk pasujący do średnicy studni', () => {
        const { exposed, dom } = setup({ well: baseWell({ dn: 1500 }) });
        const b1200 = { textContent: '1200 ', classList: { add: jest.fn(), remove: jest.fn() } };
        const b1500 = { textContent: ' 1500', classList: { add: jest.fn(), remove: jest.fn() } };
        dom.setQueryAll('.dn-btn', [b1200, b1500]);

        exposed.updateDNButtons();

        expect(b1200.classList.remove).toHaveBeenCalledWith('active');
        expect(b1500.classList.add).toHaveBeenCalledWith('active');
    });

    it('bez studni zdejmuje active ze wszystkich przycisków', () => {
        const { exposed, dom } = setup();
        const b = { textContent: '1200', classList: { add: jest.fn(), remove: jest.fn() } };
        dom.setQueryAll('.dn-btn', [b]);

        exposed.updateDNButtons();

        expect(b.classList.remove).toHaveBeenCalledWith('active');
        expect(b.classList.add).not.toHaveBeenCalled();
    });
});
