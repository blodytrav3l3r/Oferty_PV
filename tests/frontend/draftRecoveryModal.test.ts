// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Popup recovery draftu (sok-draft-modal przez window.showModal):
 * - modal zamiast paska, style projektu (.modal + .btn),
 * - Przywróć / Pobierz JSON / Odrzuć, Escape/zamknięcie nie kasuje draftu.
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

function loadCtx() {
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
        document: { getElementById: (_id: string) => null },
        setOfferFormFields: (_f: any) => {},
        window: {} as any
    };
    sandbox.window.draftStore = undefined;
    sandbox.window.localStorage = st;
    sandbox.window.showModal = (opts: any) => {
        calls.showModal.push(opts);
        return overlay;
    };
    sandbox.window.closeModal = (id: string) => void calls.closeModal.push(id);
    sandbox.window.currentUser = { id: 'u1' };
    vm.createContext(sandbox);
    vm.runInContext(readJs('shared/draftStore.js'), sandbox, { filename: 'draftStore.js' });
    vm.runInContext(readJs('shared/draftAutosave.js'), sandbox, { filename: 'draftAutosave.js' });
    return { sandbox, st, calls, click: () => clickHandler };
}

function seedDraft(sandbox: any, st: any, payload = { items: [{ productId: 'p', quantity: 2 }] }) {
    const ds = sandbox.window.draftStore;
    const d = ds.buildDraft({ userId: 'u1', kind: 'offer_rury', docId: 'new', payload });
    expect(ds.saveDraft(st, d).ok).toBe(true);
}

function fireClick(handler: any, act: string) {
    handler({ target: { closest: () => ({ getAttribute: () => act }) } });
}

describe('draft recovery popup — showModal zamiast paska', () => {
    it('pokazuje modal z tytułem i trzema akcjami, bez styli paska', () => {
        const { sandbox, st, calls } = loadCtx();
        seedDraft(sandbox, st);
        sandbox.window.draftAutosave.checkRecovery('offer_rury');
        expect(calls.showModal.length).toBe(1);
        const opts = calls.showModal[0];
        expect(opts.id).toBe('sok-draft-modal');
        expect(opts.titleId).toBe('sok-draft-modal-title');
        expect(opts.html).toContain('Znaleziono niezapisany draft');
        expect(opts.html).toContain('data-draft-act="restore"');
        expect(opts.html).toContain('data-draft-act="download"');
        expect(opts.html).toContain('data-draft-act="discard"');
        expect(opts.html).toContain('class="modal"');
        expect(opts.html).toContain('btn btn-primary');
        expect(opts.html).not.toContain('sok-draft-banner');
        expect(opts.html).not.toContain('sticky');
    });

    it('brak modala gdy draft zgodny z SAVED i gdy brak draftu', () => {
        const { sandbox, st, calls } = loadCtx();
        sandbox.window.draftAutosave.checkRecovery('offer_rury');
        expect(calls.showModal.length).toBe(0);
        // draft identyczny z pustym SAVED (domyślne pola + items []) → brak modala
        seedDraft(sandbox, st, {
            fields: {
                number: '',
                date: '',
                clientName: '',
                clientNumber: '',
                clientNip: '',
                clientAddress: '',
                clientContact: '',
                investName: '',
                investAddress: '',
                investContractor: '',
                notes: '',
                paymentTerms: 'Do uzgodnienia lub według indywidualnych warunków handlowych.',
                validity: '7 dni',
                transportKm: 100,
                transportRate: 10
            },
            wellDiscounts: {},
            visiblePrzejsciaTypes: [],
            transportMode: 'full',
            items: []
        });
        sandbox.window.draftAutosave.checkRecovery('offer_rury');
        expect(calls.showModal.length).toBe(0);
    });

    it('Odrzuć kasuje draft, zamyka modal, SAVED nietknięty', () => {
        const { sandbox, st, calls, click } = loadCtx();
        seedDraft(sandbox, st);
        sandbox.window.draftAutosave.checkRecovery('offer_rury');
        fireClick(click(), 'discard');
        expect(st.getItem('sok_draft_v1_u1_offer_rury_new')).toBeNull();
        expect(calls.closeModal).toContain('sok-draft-modal');
        expect(calls.toast.some((t: any) => String(t.msg).includes('odrzucony'))).toBe(true);
    });

    it('Przywróć zamyka modal i wczytuje pozycje jako niezapisane', () => {
        const { sandbox, st, calls, click } = loadCtx();
        seedDraft(sandbox, st);
        sandbox.window.draftAutosave.checkRecovery('offer_rury');
        fireClick(click(), 'restore');
        expect(calls.closeModal).toContain('sok-draft-modal');
        const items = sandbox.window.currentOfferItems || sandbox.currentOfferItems;
        expect(items).toEqual([{ productId: 'p', quantity: 2 }]);
        // draft zostaje do jawnego SAVED (nie kasowany przy restore)
        expect(st.getItem('sok_draft_v1_u1_offer_rury_new')).not.toBeNull();
    });

    it('Escape / onClose nie kasuje draftu', () => {
        const { sandbox, st, calls } = loadCtx();
        seedDraft(sandbox, st);
        sandbox.window.draftAutosave.checkRecovery('offer_rury');
        const onClose = calls.showModal[0].onClose;
        expect(typeof onClose).toBe('function');
        onClose();
        expect(st.getItem('sok_draft_v1_u1_offer_rury_new')).not.toBeNull();
    });

    it('fallback toast gdy brak window.showModal', () => {
        const { sandbox, st, calls } = loadCtx();
        delete sandbox.window.showModal;
        seedDraft(sandbox, st);
        sandbox.window.draftAutosave.checkRecovery('offer_rury');
        expect(calls.toast.some((t: any) => String(t.msg).includes('niezapisany draft'))).toBe(
            true
        );
    });
});
