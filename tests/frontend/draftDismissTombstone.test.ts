// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * REGRESJA: modal "Znaleziono niezapisany draft" wracal po Odrzuceniu.
 * Odrzucenie kasowalo klucz, ale kazdy pozniejszy flush (klik / wyjscie
 * z modulu / router) zbieral live != SAVED (load-drift) i pisal draft
 * od nowa. Fix: tombstone sesyjny key -> fingerprint comparable-live.
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

const FIELDS = {
    number: 'O/1',
    date: '2026-09-16',
    clientName: 'K',
    clientNumber: '1',
    clientNip: '2',
    clientAddress: 'a',
    clientContact: 'c',
    investName: 'i',
    investAddress: 'ia',
    investContractor: 'ic',
    notes: 'n',
    paymentTerms: 'Do uzgodnienia lub według indywidualnych warunków handlowych.',
    validity: '7 dni',
    transportKm: 100,
    transportRate: 10
};
const WIZARD_DEFAULTS = {
    nadbudowa: 'betonowa',
    dennicaMaterial: 'betonowa',
    uszczelka: 'GSG',
    magazyn: 'Kluczbork'
};
const SAVED_WELLS = [
    {
        id: 'w1',
        name: 'S1',
        dn: '1000',
        rzednaDna: 1,
        rzednaWlazu: 5,
        config: [{ productId: 'p-krag', quantity: 2 }],
        przejscia: []
    }
];
// Live po pipeline load: ensureElemIds (losowe) + recalc/sync.
function liveWells() {
    return [
        {
            id: 'w1',
            name: 'S1',
            dn: '1000',
            rzednaDna: 1,
            rzednaWlazu: 5,
            config: [{ productId: 'p-krag', quantity: 2, _elemId: 'rand-uuid-1' }],
            przejscia: [],
            configStatus: 'OK',
            configErrors: [],
            wellHeight: 4
        }
    ];
}

const DRAFT_KEY = 'sok_draft_v1_u1_offer_studnie_o1';

function ctx() {
    const st = memStorage();
    const calls = { showModal: [] as any[], closeModal: [] as any[], toast: [] as any[] };
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
        getOfferFormFields: () => ({ ...FIELDS }),
        getWizardGlobalParams: () => ({ ...WIZARD_DEFAULTS }),
        window: {} as any
    };
    sandbox.window.localStorage = st;
    sandbox.window.currentUser = { id: 'u1' };
    sandbox.window.logger = { warn: () => {} };
    sandbox.window.showModal = (o: any) => {
        calls.showModal.push(o);
        return overlay;
    };
    sandbox.window.closeModal = (id: string) => void calls.closeModal.push(id);
    sandbox.editingOfferIdStudnie = 'o1';
    sandbox.offersStudnie = [
        {
            id: 'o1',
            version: 1,
            ...FIELDS,
            wells: JSON.parse(JSON.stringify(SAVED_WELLS)),
            wellDiscounts: {},
            visiblePrzejsciaTypes: [],
            transportMode: 'full',
            wizard: { globalParams: { ...WIZARD_DEFAULTS }, currentStep: 3 }
        }
    ];
    sandbox.wells = JSON.parse(JSON.stringify(SAVED_WELLS));
    sandbox.wellDiscounts = {};
    sandbox.visiblePrzejsciaTypes = new Set();
    sandbox.currentTransportMode = 'full';
    sandbox.currentWizardStep = 3;
    vm.createContext(sandbox);
    vm.runInContext(readJs('shared/draftStore.js'), sandbox, { filename: 'draftStore.js' });
    vm.runInContext(readJs('shared/draftAutosave.js'), sandbox, { filename: 'draftAutosave.js' });
    return { sandbox, st, calls, clickHandler: () => clickHandler };
}

function seedForeignDraft(sandbox: any, st: any) {
    const ds = sandbox.window.draftStore;
    const d = ds.buildDraft({
        userId: 'u1',
        kind: 'offer_studnie',
        docId: 'o1',
        payload: {
            fields: { ...FIELDS },
            wells: [
                {
                    id: 'w1',
                    name: 'S1',
                    dn: '1000',
                    config: [{ productId: 'p-krag', quantity: 9 }],
                    przejscia: []
                }
            ],
            wellDiscounts: {},
            visiblePrzejsciaTypes: [],
            transportMode: 'full',
            wizardGlobalParams: { ...WIZARD_DEFAULTS },
            wizardStep: 3
        }
    });
    expect(ds.saveDraft(st, d).ok).toBe(true);
}

function clickDiscard(clickHandler: any) {
    const h = clickHandler();
    expect(typeof h).toBe('function');
    h({ target: { closest: () => ({ getAttribute: () => 'discard' }) } });
}

describe('tombstone Odrzucenia draftu (sesyjny)', () => {
    it('Odrzuc -> flush -> ponowne wejscie: brak recovery', () => {
        const { sandbox, st, calls, clickHandler } = ctx();
        seedForeignDraft(sandbox, st);
        sandbox.window.draftAutosave.checkRecovery('offer_studnie');
        expect(calls.showModal.length).toBe(1);
        clickDiscard(clickHandler);
        expect(st.getItem(DRAFT_KEY)).toBeNull();
        // Flush przy wyjsciu (router/pagehide) nie wskrzesza draftu.
        expect(sandbox._draftWriteKind('offer_studnie', true)).toBe(false);
        expect(st.getItem(DRAFT_KEY)).toBeNull();
        // Ponowne wejscie: brak modala.
        sandbox.window.draftAutosave.checkRecovery('offer_studnie');
        expect(calls.showModal.length).toBe(1);
    });

    it('realna zmiana po Odrzuceniu znowu pisze draft', () => {
        const { sandbox, st, calls, clickHandler } = ctx();
        seedForeignDraft(sandbox, st);
        sandbox.window.draftAutosave.checkRecovery('offer_studnie');
        expect(calls.showModal.length).toBe(1);
        clickDiscard(clickHandler);
        expect(sandbox._draftWriteKind('offer_studnie', true)).toBe(false);
        // Uzytkownik realnie edytuje: fingerprint live sie zmienia.
        sandbox.wells[0].config[0].quantity = 7;
        expect(sandbox._draftWriteKind('offer_studnie', true)).toBe(true);
        expect(st.getItem(DRAFT_KEY)).not.toBeNull();
    });

    it('load-drift (ephemeral load) nie pisze ghosta po Odrzuceniu', () => {
        const { sandbox, st, calls, clickHandler } = ctx();
        // Live zdriftowany przez pipeline load (jak po wejsciu w oferte):
        // pola efemeryczne + auto-dopieta kategoria VPT (offerManager
        // dopina kategorie fizycznych przejsć do widoku przed recovery).
        // Tego ostatniego _draftComparablePayload NIE strypuje — przed
        // tombstone flush przy wyjsciu pisal ghosta mimo Odrzucenia.
        sandbox.wells = liveWells();
        sandbox.visiblePrzejsciaTypes = new Set(['kolano']);
        seedForeignDraft(sandbox, st);
        sandbox.window.draftAutosave.checkRecovery('offer_studnie');
        expect(calls.showModal.length).toBe(1);
        clickDiscard(clickHandler);
        expect(st.getItem(DRAFT_KEY)).toBeNull();
        // Flush z tym samym zdriftowanym live: tombstone blokuje ghosta.
        expect(sandbox._draftWriteKind('offer_studnie', true)).toBe(false);
        expect(st.getItem(DRAFT_KEY)).toBeNull();
        sandbox.window.draftAutosave.checkRecovery('offer_studnie');
        expect(calls.showModal.length).toBe(1);
    });
});
