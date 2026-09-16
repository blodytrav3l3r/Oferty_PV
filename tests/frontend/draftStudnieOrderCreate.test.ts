// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * REGRESJA: "Znaleziono niezapisany draft" na ZAMÓWIENIU zaraz po dodaniu
 * zamówienia do oferty (studnie). Dokument zamówienia z kreacji nie ma
 * `wizard` ani części pól (validity...), a live dokleja fallbacki UI
 * (tiles, '7 dni', ??100) — komparator musi normalizować braki jak UI.
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

const PAYMENT_DEFAULT = 'Do uzgodnienia lub według indywidualnych warunków handlowych.';
// Live po enterOrderEditMode: inputy wypełnione fallbackami (validity '', transport
// z ordera, reszta z oferty), tiles nietknięte (legacy defaulty).
const LIVE_FIELDS = {
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
    paymentTerms: PAYMENT_DEFAULT,
    validity: '7 dni',
    transportKm: 50,
    transportRate: 8
};
const TILES_DEFAULTS = { nadbudowa: 'betonowa', uszczelka: 'GSG', magazyn: 'Kluczbork' };
// Dokument prosto z createOrderFromOffer: brak wizard, brak validity/paymentTerms.
const ORDER_DOC = {
    id: 'o9',
    version: 1,
    offerId: 'of1',
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
    transportKm: 50,
    transportRate: 8,
    transportMode: 'full',
    wells: [
        {
            id: 'w1',
            name: 'S1',
            dn: '1000',
            config: [{ productId: 'p-krag', quantity: 2 }],
            przejscia: []
        }
    ],
    wellDiscounts: {},
    visiblePrzejsciaTypes: []
};

function orderCtx() {
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
        getOfferFormFields: () => ({ ...LIVE_FIELDS }),
        getWizardGlobalParams: () => ({ ...TILES_DEFAULTS }),
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
    const fresh = JSON.parse(JSON.stringify(ORDER_DOC));
    sandbox.orderEditMode = { orderId: 'o9', order: fresh };
    sandbox.ordersStudnie = [JSON.parse(JSON.stringify(ORDER_DOC))];
    sandbox.wells = JSON.parse(JSON.stringify(ORDER_DOC.wells));
    sandbox.wellDiscounts = {};
    sandbox.visiblePrzejsciaTypes = new Set();
    sandbox.currentTransportMode = 'full';
    sandbox.currentWizardStep = 5;
    vm.createContext(sandbox);
    vm.runInContext(readJs('shared/draftStore.js'), sandbox, { filename: 'draftStore.js' });
    vm.runInContext(readJs('studnie/orderDto.js'), sandbox, { filename: 'orderDto.js' });
    vm.runInContext(readJs('shared/draftAutosave.js'), sandbox, { filename: 'draftAutosave.js' });
    return { sandbox, st, calls, click: () => clickHandler };
}

describe('draft studnie zamowienie — swiezo utworzone bez modala', () => {
    it('live po wejsciu (fallbacki + brak wizard w SAVED) == SAVED', () => {
        const { sandbox } = orderCtx();
        const live = sandbox._draftCollectLive('order_studnie');
        const cur = sandbox._draftCurrentSaved(
            'order_studnie',
            sandbox._draftKindConfig.order_studnie,
            'o9'
        );
        expect(cur.slim).toBe(false);
        expect(
            sandbox.window.draftAutosave.areEquivalent('order_studnie', live, cur.payload, false)
        ).toBe(true);
    });

    it('flush po wejsciu nie pisze ghosta + brak modala', () => {
        const { sandbox, st, calls } = orderCtx();
        expect(sandbox._draftWriteKind('order_studnie', true)).toBe(false);
        expect(st.getItem('sok_draft_v1_u1_order_studnie_o9')).toBeNull();
        sandbox.window.draftAutosave.checkRecovery('order_studnie');
        expect(calls.showModal.length).toBe(0);
    });

    it('kontrola: realna zmiana w zamowieniu → ghost i modal', () => {
        const { sandbox, st, calls } = orderCtx();
        sandbox.wells[0].config[0].quantity = 7;
        expect(sandbox._draftWriteKind('order_studnie', true)).toBe(true);
        expect(st.getItem('sok_draft_v1_u1_order_studnie_o9')).not.toBeNull();
        // Swieze wejscie: live z SAVED, draft z obca zmiana.
        sandbox.wells = JSON.parse(JSON.stringify(ORDER_DOC.wells));
        sandbox.window.draftAutosave.checkRecovery('order_studnie');
        expect(calls.showModal.length).toBe(1);
    });
});
