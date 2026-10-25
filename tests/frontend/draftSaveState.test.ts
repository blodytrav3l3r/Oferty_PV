// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * L1: stan zapisu draftu. Quota i błąd magazynu muszą być WIDOCZNE (trwały pasek
 * statusu), a autosave nie może się wyłączyć do końca sesji po pierwszym błędzie.
 */
function readJs(rel: string): string {
    return fs.readFileSync(path.join(__dirname, '../../public/js', rel), 'utf8');
}

const RURY_FIELDS = { clientName: 'K', validity: '7 dni', transportKm: 100, transportRate: 10 };
const RURY_ITEMS = [{ uid: 'rur_1', productId: 'p', quantity: 2 }];

function fakeDom() {
    const byId = new Map<string, any>();
    const body = {
        appendChild(el: any) {
            el.parentNode = body;
            byId.set(el.id, el);
        },
        removeChild(el: any) {
            byId.delete(el.id);
            el.parentNode = null;
        }
    };
    return {
        body,
        createElement() {
            return {
                id: '',
                className: '',
                textContent: '',
                attrs: {} as Record<string, string>,
                parentNode: null,
                children: [] as any[],
                handlers: {} as Record<string, any>,
                appendChild(child: any) {
                    this.children.push(child);
                },
                setAttribute(k: string, v: string) {
                    this.attrs[k] = v;
                },
                addEventListener(evt: string, fn: any) {
                    this.handlers[evt] = fn;
                }
            };
        },
        getElementById(id: string) {
            return byId.get(id) || null;
        },
        addEventListener() {},
        querySelector() {
            return null;
        }
    };
}

function loadCtx() {
    const store = new Map<string, string>();
    const ctl = { fail: null as null | 'quota' | 'security', intervalMs: 0, cleared: 0 };
    const storage = {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => {
            if (ctl.fail === 'quota') {
                const e: any = new Error('quota');
                e.name = 'QuotaExceededError';
                throw e;
            }
            if (ctl.fail === 'security') {
                const e: any = new Error('denied');
                e.name = 'SecurityError';
                throw e;
            }
            store.set(k, String(v));
        },
        removeItem: (k: string) => void store.delete(k),
        key: (i: number) => Array.from(store.keys())[i] ?? null,
        get length() {
            return store.size;
        }
    };
    const sandbox: any = {
        console,
        currentUser: { id: 'u1' },
        showToast: () => {},
        document: fakeDom(),
        addEventListener: () => {},
        setTimeout: () => 0,
        clearTimeout: () => {},
        setInterval: (_fn: any, ms: number) => {
            ctl.intervalMs = ms;
            return 1;
        },
        clearInterval: () => {
            ctl.cleared++;
        },
        setOfferFormFields: () => {},
        getOfferFormFields: () => ({ ...RURY_FIELDS }),
        window: {} as any
    };
    sandbox.window.localStorage = storage;
    sandbox.window.currentUser = { id: 'u1' };
    sandbox.window.currentRuryTransportMode = 'full';
    sandbox.currentOfferItems = JSON.parse(JSON.stringify(RURY_ITEMS));
    vm.createContext(sandbox);
    vm.runInContext(readJs('shared/draftStore.js'), sandbox, { filename: 'draftStore.js' });
    vm.runInContext(readJs('shared/draftAutosave.js'), sandbox, { filename: 'draftAutosave.js' });
    return { sandbox, store, ctl, storage };
}

/** Aktywna oferta rury z niezapisaną zmianą (dirty wobec SAVED). */
function dirtyRury(sandbox: any) {
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
    sandbox.getOfferFormFields = () => ({ ...RURY_FIELDS, clientName: 'INNA' });
    sandbox.currentOfferItems = [{ uid: 'rur_1', productId: 'p', quantity: 5 }];
}

describe('L1 draftAutosave — widoczny stan zapisu', () => {
    it('quota: stan quota + trwały pasek, draft nie zapisany, zero kasowania', () => {
        const { sandbox, store, ctl } = loadCtx();
        dirtyRury(sandbox);
        ctl.fail = 'quota';
        expect(sandbox._draftWriteKind('offer_rury', true)).toBe(false);
        expect(sandbox.window.draftAutosave.saveState()).toBe('quota');
        const el = sandbox.document.getElementById('draft-save-status');
        expect(el).not.toBeNull();
        expect(el.textContent).toContain('NIE są zabezpieczane');
        expect(store.size).toBe(0);
        expect(ctl.intervalMs).toBe(sandbox.window.draftAutosave.SAVE_RETRY_MS);
    });

    it('błąd magazynu (nie quota) → stan storage, nie quota', () => {
        const { sandbox, ctl } = loadCtx();
        dirtyRury(sandbox);
        ctl.fail = 'security';
        expect(sandbox._draftWriteKind('offer_rury', true)).toBe(false);
        expect(sandbox.window.draftAutosave.saveState()).toBe('storage');
        expect(sandbox.document.getElementById('draft-save-status')).not.toBeNull();
    });

    it('po zwolnieniu miejsca zapis wraca do ok i pasek znika (brak blokady sesji)', () => {
        const { sandbox, store, ctl } = loadCtx();
        dirtyRury(sandbox);
        ctl.fail = 'quota';
        expect(sandbox._draftWriteKind('offer_rury', true)).toBe(false);
        expect(sandbox.window.draftAutosave.saveState()).toBe('quota');
        // Miejsce zwolnione (np. sweep) — kolejny snapshot musi spróbować ponownie.
        ctl.fail = null;
        sandbox.getOfferFormFields = () => ({ ...RURY_FIELDS, clientName: 'KOLEJNA' });
        expect(sandbox._draftWriteKind('offer_rury', true)).toBe(true);
        expect(sandbox.window.draftAutosave.saveState()).toBe('ok');
        expect(sandbox.document.getElementById('draft-save-status')).toBeNull();
        expect(store.size).toBe(1);
        expect(ctl.cleared).toBeGreaterThan(0);
    });

    it('quota: „Zwolnij miejsce" usuwa TYLKO wskazany draft po zgodzie', async () => {
        const { sandbox, store, ctl } = loadCtx();
        const big = sandbox.window.draftStore.buildDraft({
            userId: 'u1',
            kind: 'offer_studnie',
            docId: 'duzy',
            payload: { fields: { validity: 'x'.repeat(2000) } }
        });
        const small = sandbox.window.draftStore.buildDraft({
            userId: 'u1',
            kind: 'offer_rury',
            docId: 'maly',
            payload: { fields: { validity: 'y' } }
        });
        store.set('sok_draft_v1_u1_offer_studnie_duzy', JSON.stringify(big));
        store.set('sok_draft_v1_u1_offer_rury_maly', JSON.stringify(small));
        const asked: string[] = [];
        sandbox.window.appConfirm = (msg: string) => {
            asked.push(msg);
            return Promise.resolve(true);
        };
        dirtyRury(sandbox);
        ctl.fail = 'quota';
        expect(sandbox._draftWriteKind('offer_rury', true)).toBe(false);
        const el = sandbox.document.getElementById('draft-save-status');
        expect(el.children.length).toBe(1);
        expect(el.children[0].textContent).toBe('Zwolnij miejsce');
        el.children[0].handlers.click();
        await Promise.resolve();
        await Promise.resolve();
        expect(asked[0]).toContain('Oferta (Studnie)');
        expect(store.has('sok_draft_v1_u1_offer_studnie_duzy')).toBe(false);
        expect(store.has('sok_draft_v1_u1_offer_rury_maly')).toBe(true);
        expect(sandbox.window.draftAutosave.saveState()).toBe('ok');
    });

    it('quota: brak zgody → żaden draft nie znika', async () => {
        const { sandbox, store, ctl } = loadCtx();
        const big = sandbox.window.draftStore.buildDraft({
            userId: 'u1',
            kind: 'offer_studnie',
            docId: 'duzy',
            payload: { fields: { validity: 'x'.repeat(2000) } }
        });
        store.set('sok_draft_v1_u1_offer_studnie_duzy', JSON.stringify(big));
        sandbox.window.appConfirm = () => Promise.resolve(false);
        dirtyRury(sandbox);
        ctl.fail = 'quota';
        expect(sandbox._draftWriteKind('offer_rury', true)).toBe(false);
        const el = sandbox.document.getElementById('draft-save-status');
        el.children[0].handlers.click();
        await Promise.resolve();
        await Promise.resolve();
        expect(store.has('sok_draft_v1_u1_offer_studnie_duzy')).toBe(true);
        expect(sandbox.window.draftAutosave.saveState()).toBe('quota');
    });
});
