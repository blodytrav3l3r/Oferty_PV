// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * REGRESJA: ghost-draft oferty studni (popup "Znaleziono niezapisany draft"
 * po kazdym wejsciu mimo zapisanych zmian).
 * Pipeline load (normalize/_elemId/recalc/sync) dokleja do live pola,
 * ktorych SAVED nie ma lub ma w innej postaci — komparator musi je
 * ignorowac, a martwy draft musi sam znikac (self-heal).
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
// SAVED prosto z bloba serwera (legacy: bez _elemId, bez statusow solvera).
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
// Live po pipeline load: ensureElemIds (losowe) + recalc/sync (statusy, height).
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

function studnieCtx() {
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
    sandbox.wells = liveWells();
    sandbox.wellDiscounts = {};
    sandbox.visiblePrzejsciaTypes = new Set();
    sandbox.currentTransportMode = 'full';
    sandbox.currentWizardStep = 3;
    vm.createContext(sandbox);
    vm.runInContext(readJs('shared/draftStore.js'), sandbox, { filename: 'draftStore.js' });
    vm.runInContext(readJs('shared/draftAutosave.js'), sandbox, { filename: 'draftAutosave.js' });
    return { sandbox, st, calls, click: () => clickHandler };
}

function seedDraft(sandbox: any, st: any, payload: any) {
    const ds = sandbox.window.draftStore;
    const d = ds.buildDraft({ userId: 'u1', kind: 'offer_studnie', docId: 'o1', payload });
    expect(ds.saveDraft(st, d).ok).toBe(true);
}

describe('draft studnie oferta — roundtrip load vs SAVED', () => {
    it('live po load (ephemeral _elemId/status/height) == SAVED', () => {
        const { sandbox } = studnieCtx();
        const live = sandbox._draftCollectLive('offer_studnie');
        const cur = sandbox._draftCurrentSaved(
            'offer_studnie',
            sandbox._draftKindConfig.offer_studnie,
            'o1'
        );
        expect(
            sandbox.window.draftAutosave.areEquivalent('offer_studnie', live, cur.payload, false)
        ).toBe(true);
    });

    it('martwy draft znika przy flush gdy draft==SAVED (self-heal)', () => {
        const { sandbox, st } = studnieCtx();
        // Martwy ghost: payload rownowazny SAVED (pola efemeryczne load),
        // live wrocone do SAVED.
        seedDraft(sandbox, st, {
            fields: { ...FIELDS },
            wells: liveWells(),
            wellDiscounts: {},
            visiblePrzejsciaTypes: [],
            transportMode: 'full',
            wizardGlobalParams: { ...WIZARD_DEFAULTS },
            wizardStep: 3
        });
        sandbox.wells = JSON.parse(JSON.stringify(SAVED_WELLS));
        expect(st.getItem('sok_draft_v1_u1_offer_studnie_o1')).not.toBeNull();
        expect(sandbox._draftWriteKind('offer_studnie', true)).toBe(false);
        expect(st.getItem('sok_draft_v1_u1_offer_studnie_o1')).toBeNull();
    });

    it('martwy draft znika przy wejsciu gdy draft==SAVED (self-heal)', () => {
        const { sandbox, st, calls } = studnieCtx();
        seedDraft(sandbox, st, {
            fields: { ...FIELDS },
            wells: liveWells(),
            wellDiscounts: {},
            visiblePrzejsciaTypes: [],
            transportMode: 'full',
            wizardGlobalParams: { ...WIZARD_DEFAULTS },
            wizardStep: 3
        });
        sandbox.wells = JSON.parse(JSON.stringify(SAVED_WELLS));
        sandbox.window.draftAutosave.checkRecovery('offer_studnie');
        expect(calls.showModal.length).toBe(0);
        expect(st.getItem('sok_draft_v1_u1_offer_studnie_o1')).toBeNull();
    });

    it('draft z obca trescia (live==SAVED) NIE jest kasowany przy flush', () => {
        const { sandbox, st } = studnieCtx();
        seedDraft(sandbox, st, {
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
        });
        sandbox.wells = JSON.parse(JSON.stringify(SAVED_WELLS));
        expect(sandbox._draftWriteKind('offer_studnie', true)).toBe(false);
        // Obca tresc zostaje — to nie martwy ghost, tylko porzucona edycja.
        expect(st.getItem('sok_draft_v1_u1_offer_studnie_o1')).not.toBeNull();
    });

    it('kontrola: realna zmiana live vs SAVED → ghost pisze i modal JEST', () => {
        const { sandbox, st, calls } = studnieCtx();
        sandbox.wells[0].config[0].quantity = 7;
        sandbox.getOfferFormFields = () => ({ ...FIELDS });
        expect(sandbox._draftWriteKind('offer_studnie', true)).toBe(true);
        expect(st.getItem('sok_draft_v1_u1_offer_studnie_o1')).not.toBeNull();
        // Swieze wejscie: live z SAVED, draft z obca zmiana (qty 7).
        sandbox.wells = JSON.parse(JSON.stringify(SAVED_WELLS));
        sandbox.window.draftAutosave.checkRecovery('offer_studnie');
        expect(calls.showModal.length).toBe(1);
    });
});
