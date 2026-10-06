// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * SSoT dirty (SPA-GUARD-PRO P0.1+P0.2): flaga + diff draft-vs-SAVED w jednym miejscu.
 * REGRESJA: edycja rur bez flag (_excelDirty) przechodzila przez guard bez popupu.
 * Tu: live!=SAVED => dirty mimo braku flag.
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

const CLEAN_FIELDS = {
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
};

function loadCtx() {
    const st = memStorage();
    let fields = { ...CLEAN_FIELDS };
    let iframeList: any[] = [];
    const sandbox: any = {
        console,
        currentUser: { id: 'u1' },
        getOfferFormFields: () => ({ ...fields }),
        setOfferFormFields: (_f: any) => void (fields = { ..._f }),
        currentOfferItems: [],
        setTimeout,
        clearTimeout,
        document: {
            querySelectorAll: (_sel: string) => iframeList,
            addEventListener: () => {},
            getElementById: (_id: string) => null
        },
        addEventListener: () => {},
        window: {} as any
    };
    sandbox.window.localStorage = st;
    sandbox.window.currentUser = { id: 'u1' };
    sandbox.window.currentRuryTransportMode = 'full';
    sandbox.window.logger = { warn: () => {} };
    sandbox.window.location = { pathname: '/rury.html' };
    sandbox.window.addEventListener = () => {};
    vm.createContext(sandbox);
    vm.runInContext(readJs('shared/draftStore.js'), sandbox, { filename: 'draftStore.js' });
    vm.runInContext(readJs('shared/offerNotesGenerator.js'), sandbox, {
        filename: 'offerNotesGenerator.js'
    });
    vm.runInContext(readJs('shared/draftAutosave.js'), sandbox, { filename: 'draftAutosave.js' });
    vm.runInContext(readJs('shared/sokDirty.js'), sandbox, { filename: 'sokDirty.js' });
    sandbox.window.draftAutosave.initKind('offer_rury');
    return {
        sandbox,
        setFields: (f: any) => void (fields = { ...CLEAN_FIELDS, ...f }),
        setIframes: (l: any[]) => void (iframeList = l)
    };
}

describe('sokDirty SSoT — flaga + diff', () => {
    it('czysty nowy dokument: brak flag + live==SAVED => false', () => {
        const { sandbox } = loadCtx();
        expect(sandbox.window.draftAutosave.hasUnsavedChanges()).toBe(false);
        expect(sandbox.window.__sokIsDirty()).toBe(false);
        expect(sandbox.window.__sokDescribeDirty()).toBeNull();
    });

    it('REGRESJA rur: zmiana pola bez flag => dirty (stary guard milczal)', () => {
        const { sandbox, setFields } = loadCtx();
        setFields({ clientName: 'Kowalski' });
        // brak flag celowo — stary _isDirtyNow() na samych flagach dalby false
        expect(sandbox._excelDirty).toBeUndefined();
        expect(sandbox.window.draftAutosave.hasUnsavedChanges()).toBe(true);
        expect(sandbox.window.__sokIsDirty()).toBe(true);
        const d = sandbox.window.__sokDescribeDirty();
        expect(d && d.kind).toBe('offer_rury');
        expect(d && d.docId).toBe('new');
    });

    it('flaga _excelDirty => dirty mimo czystego diffa', () => {
        const { sandbox } = loadCtx();
        sandbox._excelDirty = true;
        sandbox.window._excelDirty = true;
        expect(sandbox.window.__sokIsDirty()).toBe(true);
        sandbox._excelDirty = false;
        sandbox.window._excelDirty = false;
        expect(sandbox.window.__sokIsDirty()).toBe(false);
    });

    it('rodzic skanuje iframe: nowy SSoT + legacy fallback', () => {
        const { sandbox, setIframes } = loadCtx();
        setIframes([{ id: 'spa-iframe-studnie', contentWindow: { __sokIsDirty: () => true } }]);
        expect(sandbox.window.__sokIsDirty()).toBe(true);
        // legacy: iframe bez sokDirty, tylko flaga
        setIframes([{ id: 'spa-iframe-rury', contentWindow: { _excelDirty: true } }]);
        expect(sandbox.window.__sokIsDirty()).toBe(true);
        // legacy: iframe z _isWizardDirty()
        setIframes([{ id: 'spa-iframe-rury', contentWindow: { _isWizardDirty: () => true } }]);
        expect(sandbox.window.__sokIsDirty()).toBe(true);
        setIframes([{ id: 'spa-iframe-rury', contentWindow: {} }]);
        expect(sandbox.window.__sokIsDirty()).toBe(false);
    });

    it('etykiety rodzajow do komunikatu guarda', () => {
        const { sandbox } = loadCtx();
        expect(sandbox.window.__sokKindLabel('offer_studnie')).toBe('Oferta (Studnie)');
        expect(sandbox.window.__sokKindLabel('order_studnie')).toBe('Zamówienie (Studnie)');
        expect(sandbox.window.__sokKindLabel('offer_rury')).toBe('Oferta (Rury)');
        expect(sandbox.window.__sokKindLabel('order_rury')).toBe('Zamówienie (Rury)');
    });

    it('__sokSaveDirty: sukces / wyjatek / brak savera', async () => {
        const { sandbox } = loadCtx();
        const okWin: any = {
            saveOffer: jest.fn(async () => {}),
            __sokIsDirty: () => false
        };
        await expect(sandbox.window.__sokSaveDirty(okWin)).resolves.toBe(true);
        expect(okWin.saveOffer).toHaveBeenCalledTimes(1);
        const failWin: any = {
            saveOffer: jest.fn(async () => {
                throw new Error('net');
            })
        };
        await expect(sandbox.window.__sokSaveDirty(failWin)).resolves.toBe(false);
        await expect(sandbox.window.__sokSaveDirty({})).resolves.toBe(false);
        await expect(sandbox.window.__sokSaveDirty(null)).resolves.toBe(false);
    });

    it('__sokSaveDirty: brak czyszczenia po zapisie => false (walidacja zablokowala)', async () => {
        const { sandbox } = loadCtx();
        const blockedWin: any = {
            saveOffer: jest.fn(async () => {}),
            __sokIsDirty: () => true
        };
        await expect(sandbox.window.__sokSaveDirty(blockedWin)).resolves.toBe(false);
    });

    it('__sokDirtyWindow: lokalny brud => window, czysto => null', () => {
        const { sandbox, setFields } = loadCtx();
        expect(sandbox.window.__sokDirtyWindow('rury')).toBeNull();
        setFields({ clientName: 'Kowalski' });
        expect(sandbox.window.__sokDirtyWindow('rury')).toBe(sandbox.window);
    });

    it('__sokCountDrafts: 0 przed zapisem draftu, 1 po flushu', () => {
        const { sandbox, setFields } = loadCtx();
        expect(sandbox.window.__sokCountDrafts()).toBe(0);
        setFields({ clientName: 'Kowalski' });
        expect(sandbox._draftWriteKind('offer_rury', true)).toBe(true);
        expect(sandbox.window.__sokCountDrafts()).toBe(1);
    });

    it('stripGeneratedNotes: sam blok to nie brud, prefix użytkownika to brud', () => {
        const { sandbox } = loadCtx();
        const gen =
            'Parametry techniczne: Nadbudowa i Dennica: Betonowa.\nCena franco budowa bez rozładunku przy dostawie pełnych transportów 24t.';
        const strip = sandbox.window.stripGeneratedNotes;
        expect(strip(gen)).toBe('');
        expect(strip('Moje uwagi\n\n' + gen)).toBe('Moje uwagi');
        expect(strip('Zwykła notatka')).toBe('Zwykła notatka');
        const da = sandbox.window.draftAutosave;
        const ds = sandbox.window.draftStore;
        const live = (notes: string) =>
            ds.pickDraftPayload({ fields: { ...CLEAN_FIELDS, notes }, wells: [] });
        const empty = ds.pickDraftPayload({ fields: { ...CLEAN_FIELDS, notes: '' }, wells: [] });
        expect(da.areEquivalent('offer_studnie', live(gen), empty, true)).toBe(true);
        expect(da.areEquivalent('offer_studnie', live('Moje uwagi\n\n' + gen), empty, true)).toBe(
            false
        );
        expect(da.areEquivalent('offer_rury', live(gen), empty, true)).toBe(true);
    });

    it('abandon: leave wycisza ten sam stan, nowa edycja uzbraja z powrotem', () => {
        const { sandbox, setFields } = loadCtx();
        setFields({ clientName: 'Kowalski' });
        expect(sandbox.window.__sokIsDirty()).toBe(true);
        sandbox.window.__sokAbandonCurrent();
        expect(sandbox.window.__sokIsDirty()).toBe(false);
        // ten sam stan dalej cichy (drugie przejście bez popupu)
        expect(sandbox.window.__sokIsDirty()).toBe(false);
        // nowa edycja -> re-arm
        setFields({ clientName: 'Kowalski bis' });
        expect(sandbox.window.__sokIsDirty()).toBe(true);
    });

    it('abandon: flaga bez diffa tez podlega porzuceniu', () => {
        const { sandbox } = loadCtx();
        sandbox._excelDirty = true;
        sandbox.window._excelDirty = true;
        expect(sandbox.window.__sokIsDirty()).toBe(true);
        sandbox.window.__sokAbandonCurrent();
        expect(sandbox.window.__sokIsDirty()).toBe(false);
        sandbox._excelDirty = false;
        sandbox.window._excelDirty = false;
        expect(sandbox.window.__sokIsDirty()).toBe(false);
    });

    it('__sokCanSave: saver + wiersze => true; pusto/brak savera => false', () => {
        const { sandbox, setFields } = loadCtx();
        sandbox.window.saveOffer = jest.fn(async () => {});
        setFields({ clientName: 'Kowalski' }); // brud bez pozycji
        expect(sandbox.window.draftAutosave.liveRowCount('offer_rury')).toBe(0);
        expect(sandbox.window.__sokCanSave(sandbox.window)).toBe(false);
        sandbox.currentOfferItems = [
            { uid: 'rur_1', productId: 'p', quantity: 2, unitPrice: 100, discount: 0 }
        ];
        expect(sandbox.window.draftAutosave.liveRowCount('offer_rury')).toBe(1);
        expect(sandbox.window.__sokCanSave(sandbox.window)).toBe(true);
        delete sandbox.window.saveOffer;
        expect(sandbox.window.__sokCanSave(sandbox.window)).toBe(false);
        expect(sandbox.window.__sokCanSave(null)).toBe(false);
    });
});
