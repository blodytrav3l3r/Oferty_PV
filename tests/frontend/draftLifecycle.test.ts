// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Cykl draft→SAVED→reload (regresja: wieczny popup po przywróceniu i zapisie).
 * - SAVE + brak zmian + autosave/flush + reload → BRAK modala (4 ścieżki),
 * - SAVE + realna zmiana → autosave → reload → modal JEST (recovery żyje),
 * - slim SAVED → brak decyzji + warn (defensive, nie ciche return),
 * - DTO zamówienia studni: live full vs SAVED DTO → równoważne,
 * - save → pending debounce → brak wskrzeszenia draftu.
 */
function readJs(rel: string): string {
    return fs.readFileSync(path.join(__dirname, '../../public/js', rel), 'utf8');
}

function memStorage() {
    const m = new Map<string, string>();
    return {
        getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
        setItem: (k: string, v: string) => void m.set(k, String(v)),
        removeItem: (k: string) => void m.delete(k),
        key: (i: number) => Array.from(m.keys())[i] ?? null,
        get length() {
            return m.size;
        }
    };
}

const RURY_FIELDS = { clientName: 'K', validity: '7 dni', transportKm: 100, transportRate: 10 };
const RURY_ITEMS = [{ uid: 'rur_1', productId: 'p', quantity: 2 }];

function loadCtx(opts: { withOrderDto?: boolean } = {}) {
    const st = memStorage();
    const calls = { showModal: [] as any[], closeModal: [] as any[], toast: [] as any[] };
    const warns = [] as any[];
    let clickHandler: any = null;
    const overlay = {
        addEventListener: (evt: string, fn: any) => {
            if (evt === 'click') clickHandler = fn;
        }
    };
    const sandbox: any = {
        console,
        currentUser: { id: 'u1' },
        showToast: (msg: string, type: string) => void calls.toast.push({ msg, type }),
        document: { getElementById: (_id: string) => null, addEventListener: () => {} },
        addEventListener: () => {},
        setTimeout,
        clearTimeout,
        setOfferFormFields: (_f: any) => {},
        getOfferFormFields: () => ({ ...RURY_FIELDS }),
        window: {} as any
    };
    sandbox.window.localStorage = st;
    sandbox.window.currentUser = { id: 'u1' };
    sandbox.window.currentRuryTransportMode = 'full';
    sandbox.window.logger = { warn: (...a: any[]) => void warns.push(a) };
    sandbox.window.showModal = (o: any) => {
        calls.showModal.push(o);
        return overlay;
    };
    sandbox.window.closeModal = (id: string) => void calls.closeModal.push(id);
    sandbox.currentOfferItems = JSON.parse(JSON.stringify(RURY_ITEMS));
    vm.createContext(sandbox);
    vm.runInContext(readJs('shared/draftStore.js'), sandbox, { filename: 'draftStore.js' });
    if (opts.withOrderDto)
        vm.runInContext(readJs('studnie/orderDto.js'), sandbox, { filename: 'orderDto.js' });
    vm.runInContext(readJs('shared/draftAutosave.js'), sandbox, { filename: 'draftAutosave.js' });
    return { sandbox, st, calls, warns, click: () => clickHandler };
}

describe('draft lifecycle — SAVE blokuje draft-ducha', () => {
    it('rury oferta: zapis przy live==SAVED nie pisze draftu (equality gate)', () => {
        const { sandbox, st } = loadCtx();
        sandbox.editingOfferId = 'o1';
        sandbox.offers = [
            {
                id: 'o1',
                version: 3,
                ...RURY_FIELDS,
                items: JSON.parse(JSON.stringify(RURY_ITEMS)),
                transportMode: 'full'
            }
        ];
        expect(sandbox._draftWriteKind('offer_rury', true)).toBe(false);
        expect(st.getItem('sok_draft_v1_u1_offer_rury_o1')).toBeNull();
    });

    it('pełny cykl: edit → autosave → SAVE → flush → reload → BRAK modala', () => {
        const { sandbox, st, calls } = loadCtx();
        sandbox.editingOfferId = 'o1';
        sandbox.offers = [];
        // edit: live różni się od pustej listy → autosave pisze
        expect(sandbox._draftWriteKind('offer_rury', true)).toBe(true);
        expect(st.getItem('sok_draft_v1_u1_offer_rury_o1')).not.toBeNull();
        // SAVE: dokument ląduje w tablicy + clearContext jak w offerCrud
        sandbox.offers.push({
            id: 'o1',
            version: 1,
            ...RURY_FIELDS,
            items: JSON.parse(JSON.stringify(RURY_ITEMS)),
            transportMode: 'full'
        });
        sandbox.window.draftAutosave.clearContext('offer_rury', 'new', 'o1');
        expect(st.getItem('sok_draft_v1_u1_offer_rury_o1')).toBeNull();
        // flush po zapisie (pagehide/router) nie wskrzesza draftu
        expect(sandbox._draftWriteKind('offer_rury', true)).toBe(false);
        expect(st.getItem('sok_draft_v1_u1_offer_rury_o1')).toBeNull();
        // reload: brak draftu → brak modala
        sandbox.window.draftAutosave.checkRecovery('offer_rury');
        expect(calls.showModal.length).toBe(0);
    });

    it('realna zmiana po SAVE → autosave pisze → reload pokazuje modal', () => {
        const { sandbox, st, calls } = loadCtx();
        sandbox.editingOfferId = 'o1';
        sandbox.offers = [
            {
                id: 'o1',
                version: 1,
                ...RURY_FIELDS,
                items: JSON.parse(JSON.stringify(RURY_ITEMS)),
                transportMode: 'full'
            }
        ];
        expect(sandbox._draftWriteKind('offer_rury', true)).toBe(false);
        sandbox.getOfferFormFields = () => ({ ...RURY_FIELDS, clientName: 'INNY' });
        expect(sandbox._draftWriteKind('offer_rury', true)).toBe(true);
        // świeże wejście (reload): live z serwera, draft z poprzedniej sesji
        sandbox.getOfferFormFields = () => ({ ...RURY_FIELDS });
        sandbox.window.draftAutosave.checkRecovery('offer_rury');
        expect(calls.showModal.length).toBe(1);
    });

    it('debounce sprzed SAVE nie pisze po clearContext (wyścig)', () => {
        jest.useFakeTimers();
        try {
            const { sandbox, st } = loadCtx();
            sandbox.window.draftAutosave.initKind('offer_rury');
            sandbox.getOfferFormFields = () => ({ ...RURY_FIELDS, clientName: 'X' });
            sandbox.window.draftAutosave.scheduleSave();
            sandbox.window.draftAutosave.clearContext('offer_rury', 'new');
            jest.advanceTimersByTime(2500);
            expect(st.getItem('sok_draft_v1_u1_offer_rury_new')).toBeNull();
        } finally {
            jest.useRealTimers();
        }
    });

    it('kontrola: debounce bez clear pisze draft', () => {
        jest.useFakeTimers();
        try {
            const { sandbox, st } = loadCtx();
            sandbox.window.draftAutosave.initKind('offer_rury');
            sandbox.getOfferFormFields = () => ({ ...RURY_FIELDS, clientName: 'X' });
            sandbox.window.draftAutosave.scheduleSave();
            jest.advanceTimersByTime(2500);
            expect(st.getItem('sok_draft_v1_u1_offer_rury_new')).not.toBeNull();
        } finally {
            jest.useRealTimers();
        }
    });
});

describe('draft lifecycle — slim SAVED nie decyduje (defensive + warn)', () => {
    function studnieCtx(slim: boolean) {
        const { sandbox, st, calls, warns } = loadCtx();
        sandbox.editingOfferIdStudnie = 's1';
        sandbox.wells = [{ id: 'w1', name: 'S1', dn: '1000', config: [], przejscia: [] }];
        sandbox.wellDiscounts = {};
        sandbox.visiblePrzejsciaTypes = new Set();
        sandbox.currentTransportMode = 'full';
        sandbox.getOfferFormFields = () => ({ clientName: 'K' });
        const full = {
            id: 's1',
            version: 2,
            clientName: 'K',
            wells: JSON.parse(JSON.stringify(sandbox.wells)),
            wellDiscounts: {},
            visiblePrzejsciaTypes: [],
            transportMode: 'full',
            wizard: { globalParams: {}, currentStep: 3 }
        };
        sandbox.getOfferStudnieById = () =>
            slim ? { id: 's1', title: 'Oferta s1', wellCount: 1, version: 2 } : full;
        const ds = sandbox.window.draftStore;
        const d = ds.buildDraft({
            userId: 'u1',
            kind: 'offer_studnie',
            docId: 's1',
            payload: {
                fields: { clientName: 'K' },
                wells: JSON.parse(JSON.stringify(sandbox.wells)),
                wellDiscounts: {},
                visiblePrzejsciaTypes: [],
                transportMode: 'full',
                wizardGlobalParams: {},
                wizardStep: 3
            }
        });
        expect(ds.saveDraft(st, d).ok).toBe(true);
        return { sandbox, st, calls, warns };
    }

    it('slim → brak modala + warn do loggera', () => {
        const { sandbox, calls, warns } = studnieCtx(true);
        sandbox.window.draftAutosave.checkRecovery('offer_studnie');
        expect(calls.showModal.length).toBe(0);
        expect(warns.some((w: any[]) => String(w[1]).includes('slim'))).toBe(true);
    });

    it('full zgodny → brak modala, bez warna', () => {
        const { sandbox, calls, warns } = studnieCtx(false);
        sandbox.window.draftAutosave.checkRecovery('offer_studnie');
        expect(calls.showModal.length).toBe(0);
        expect(warns.length).toBe(0);
    });
});

describe('draft lifecycle — wariant (v): draft == live-at-entry → cicho', () => {
    function liveCtx() {
        const { sandbox, st, calls } = loadCtx();
        sandbox.editingOfferId = 'o1';
        sandbox.offers = [
            {
                id: 'o1',
                version: 2,
                ...RURY_FIELDS,
                items: JSON.parse(JSON.stringify(RURY_ITEMS)),
                transportMode: 'full'
            }
        ];
        return { sandbox, st, calls };
    }
    function seedFromLive(sandbox: any, st: any) {
        const ds = sandbox.window.draftStore;
        const d = ds.buildDraft({
            userId: 'u1',
            kind: 'offer_rury',
            docId: 'o1',
            payload: {
                fields: { ...RURY_FIELDS },
                items: JSON.parse(JSON.stringify(sandbox.currentOfferItems)),
                transportMode: 'full'
            }
        });
        expect(ds.saveDraft(st, d).ok).toBe(true);
    }

    it('ghost solvera (draft≠serwer, draft==live) → BRAK modala', () => {
        const { sandbox, st, calls } = liveCtx();
        // live dokłada klucz UI (jak solver dokłada domyślne) — serwer go nie ma
        sandbox.currentOfferItems[0]._sel = 1;
        sandbox.window.currentOfferItems = sandbox.currentOfferItems;
        seedFromLive(sandbox, st);
        sandbox.window.draftAutosave.checkRecovery('offer_rury');
        expect(calls.showModal.length).toBe(0);
    });

    it('kontrola: draft≠serwer i draft≠live → modal JEST', () => {
        const { sandbox, st, calls } = liveCtx();
        sandbox.currentOfferItems[0]._sel = 1;
        sandbox.window.currentOfferItems = sandbox.currentOfferItems;
        seedFromLive(sandbox, st);
        // świeże wejście: live wraca do serwerowego — draft odstaje od obu
        delete sandbox.currentOfferItems[0]._sel;
        sandbox.window.currentOfferItems = sandbox.currentOfferItems;
        sandbox.window.draftAutosave.checkRecovery('offer_rury');
        expect(calls.showModal.length).toBe(1);
    });
});

describe('draft lifecycle — Odrzuć zabija pending debounce', () => {
    it('schedule → modal → Odrzuć → advance → pusto (brak wskrzeszenia)', () => {
        jest.useFakeTimers();
        try {
            const { sandbox, st, calls, click } = loadCtx();
            sandbox.window.draftAutosave.initKind('offer_rury');
            sandbox.getOfferFormFields = () => ({ ...RURY_FIELDS, clientName: 'X' });
            sandbox.window.draftAutosave.scheduleSave();
            jest.advanceTimersByTime(2500);
            const key = 'sok_draft_v1_u1_offer_rury_new';
            expect(st.getItem(key)).not.toBeNull();
            // świeże wejście: live z serwera, draft z poprzedniej sesji → modal
            sandbox.getOfferFormFields = () => ({ ...RURY_FIELDS });
            sandbox.window.draftAutosave.checkRecovery('offer_rury');
            expect(calls.showModal.length).toBe(1);
            click()({ target: { closest: () => ({ getAttribute: () => 'discard' }) } });
            expect(st.getItem(key)).toBeNull();
            jest.advanceTimersByTime(5000);
            expect(st.getItem(key)).toBeNull();
            expect(calls.toast.some((t: any) => String(t.msg).includes('odrzucony'))).toBe(true);
        } finally {
            jest.useRealTimers();
        }
    });
});
describe('draft lifecycle — REGRESJA SA/ZS: stale ordersStudnie vs świeży detail', () => {
    const STALE_WELLS = [
        {
            id: 'w1',
            name: 'S1',
            dn: '1000',
            config: [{ productId: 'p', quantity: 1 }],
            przejscia: []
        }
    ];
    const FRESH_WELLS = [
        {
            id: 'w1',
            name: 'S1',
            dn: '1000',
            config: [{ productId: 'p', quantity: 2 }],
            przejscia: []
        }
    ];
    function staleCtx() {
        const { sandbox, st, calls } = loadCtx();
        // Tablica listy: STALE full (saveCurrentOrder mutuje orderEditMode.order, nie tablicę).
        sandbox.ordersStudnie = [
            {
                id: 'o1',
                version: 1,
                clientName: 'K',
                wells: JSON.parse(JSON.stringify(STALE_WELLS)),
                wellDiscounts: {},
                visiblePrzejsciaTypes: [],
                transportMode: 'full',
                wizard: { globalParams: {}, currentStep: 5 }
            }
        ];
        // Świeży detail z enterOrderEditMode (fetch po zapisie).
        sandbox.orderEditMode = {
            orderId: 'o1',
            order: {
                id: 'o1',
                version: 5,
                clientName: 'K',
                wells: JSON.parse(JSON.stringify(FRESH_WELLS)),
                wellDiscounts: {},
                visiblePrzejsciaTypes: [],
                transportMode: 'full',
                wizard: { globalParams: {}, currentStep: 5 }
            }
        };
        // Live = świeży detail + klucze runtime solvera.
        sandbox.wells = JSON.parse(JSON.stringify(FRESH_WELLS));
        sandbox.wells[0].configStatus = 'OK';
        sandbox.wells[0].configErrors = [];
        sandbox.wellDiscounts = {};
        sandbox.visiblePrzejsciaTypes = new Set();
        sandbox.currentTransportMode = 'full';
        sandbox.currentWizardStep = 5;
        sandbox.getWizardGlobalParams = () => ({});
        sandbox.getOfferFormFields = () => ({ clientName: 'K' });
        return { sandbox, st, calls };
    }
    function seedLiveDraft(sandbox: any, st: any) {
        const ds = sandbox.window.draftStore;
        const d = ds.buildDraft({
            userId: 'u1',
            kind: 'order_studnie',
            docId: 'o1',
            payload: {
                fields: { clientName: 'K' },
                wells: JSON.parse(JSON.stringify(sandbox.wells)),
                wellDiscounts: {},
                visiblePrzejsciaTypes: [],
                transportMode: 'full',
                wizardGlobalParams: {},
                wizardStep: 5
            }
        });
        expect(ds.saveDraft(st, d).ok).toBe(true);
    }

    it('draft == świeży detail → BRAK modala mimo stale tablicy', () => {
        const { sandbox, st, calls } = staleCtx();
        seedLiveDraft(sandbox, st);
        sandbox.window.draftAutosave.checkRecovery('order_studnie');
        expect(calls.showModal.length).toBe(0);
    });

    it('gate: flush po zapisie nie pisze ghosta (live == świeży detail)', () => {
        const { sandbox, st } = staleCtx();
        expect(sandbox._draftWriteKind('order_studnie', true)).toBe(false);
        expect(st.getItem('sok_draft_v1_u1_order_studnie_o1')).toBeNull();
    });

    it('kontrola: draft różny od świeżego detail → modal JEST', () => {
        const { sandbox, st, calls } = staleCtx();
        sandbox.wells[0].config[0].quantity = 9;
        seedLiveDraft(sandbox, st);
        // świeże wejście: live ze świeżego detail, draft z obcą zmianą
        sandbox.wells = JSON.parse(JSON.stringify(FRESH_WELLS));
        sandbox.window.draftAutosave.checkRecovery('order_studnie');
        expect(calls.showModal.length).toBe(1);
    });
});
describe('draft lifecycle — zamówienie studni: live full vs SAVED DTO', () => {
    const DTO_WELL = {
        id: 'w1',
        name: 'S1',
        dn: '1000',
        config: [{ productId: 'p', quantity: 2 }],
        przejscia: []
    };
    function orderCtx(withOrderDto: boolean, liveExtra: object) {
        const { sandbox, st, calls } = loadCtx({ withOrderDto });
        sandbox.orderEditMode = { orderId: 'o1' };
        sandbox.wells = [{ ...JSON.parse(JSON.stringify(DTO_WELL)), ...liveExtra }];
        sandbox.wellDiscounts = {};
        sandbox.visiblePrzejsciaTypes = new Set();
        sandbox.currentTransportMode = 'full';
        sandbox.currentWizardStep = 5;
        sandbox.getWizardGlobalParams = () => ({});
        sandbox.getOfferFormFields = () => ({ clientName: 'K' });
        sandbox.ordersStudnie = [
            {
                id: 'o1',
                version: 4,
                clientName: 'K',
                wells: JSON.parse(JSON.stringify([DTO_WELL])),
                wellDiscounts: {},
                visiblePrzejsciaTypes: [],
                transportMode: 'full',
                wizard: { globalParams: {}, currentStep: 5 }
            }
        ];
        const ds = sandbox.window.draftStore;
        const d = ds.buildDraft({
            userId: 'u1',
            kind: 'order_studnie',
            docId: 'o1',
            payload: {
                fields: { clientName: 'K' },
                wells: JSON.parse(JSON.stringify(sandbox.wells)),
                wellDiscounts: {},
                visiblePrzejsciaTypes: [],
                transportMode: 'full',
                wizardGlobalParams: {},
                wizardStep: 5
            }
        });
        expect(ds.saveDraft(st, d).ok).toBe(true);
        return { sandbox, st, calls };
    }

    it('fallback (bez orderDto): runtime/configStatus nie triggerują modala', () => {
        const { sandbox, calls } = orderCtx(false, {
            configStatus: 'OK',
            configErrors: [],
            wellHeight: 5,
            warehouse: 'x',
            _lastAutoConfig: '{}'
        });
        expect(
            sandbox.window.draftAutosave.areEquivalent(
                'order_studnie',
                { wells: sandbox.wells },
                { wells: sandbox.ordersStudnie[0].wells },
                false
            )
        ).toBe(true);
        sandbox.window.draftAutosave.checkRecovery('order_studnie');
        expect(calls.showModal.length).toBe(0);
    });

    it('SSoT (z orderDto.js): nadmiarowe klucze pozycji config nie triggerują modala', () => {
        const { sandbox, calls } = orderCtx(true, {
            configStatus: 'WARNING',
            configErrors: ['notka'],
            config: [{ productId: 'p', quantity: 2, price: 99, name: 'X', __resCache: {} }]
        });
        expect(sandbox.window.toOrderWellsDTO).toBeDefined();
        sandbox.window.draftAutosave.checkRecovery('order_studnie');
        expect(calls.showModal.length).toBe(0);
    });

    it('realna zmiana ilości w zamówieniu → modal JEST', () => {
        const { sandbox, calls } = orderCtx(true, {
            config: [{ productId: 'p', quantity: 5 }]
        });
        // świeże wejście: live ze świeżego detail (qty 2), draft z qty 5
        sandbox.wells = JSON.parse(JSON.stringify([DTO_WELL]));
        sandbox.window.draftAutosave.checkRecovery('order_studnie');
        expect(calls.showModal.length).toBe(1);
    });
});
