// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * L1: „Wznów pracę" na pulpicie — lista lokalnych draftów i deep linki.
 * Wymagania: pusta lista ukrywa sekcję, wybór otwiera właściwy moduł,
 * uszkodzone dane i brak użytkownika nie wywalają pulpitu.
 */
function readJs(rel: string): string {
    return fs.readFileSync(path.join(__dirname, '../../public/js', rel), 'utf8');
}

function loadCtx() {
    const store = new Map<string, string>();
    const box = {
        classes: new Set<string>(['resume-drafts', 'hidden']),
        innerHTML: '',
        classList: {
            add(c: string) {
                box.classes.add(c);
            },
            remove(c: string) {
                box.classes.delete(c);
            }
        }
    };
    const sandbox: any = {
        console,
        document: {
            getElementById: (id: string) => (id === 'resume-drafts' ? box : null)
        },
        window: {} as any
    };
    sandbox.window.localStorage = {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => void store.set(k, String(v)),
        removeItem: (k: string) => void store.delete(k),
        key: (i: number) => Array.from(store.keys())[i] ?? null,
        get length() {
            return store.size;
        }
    };
    vm.createContext(sandbox);
    vm.runInContext(readJs('shared/draftStore.js'), sandbox, { filename: 'draftStore.js' });
    vm.runInContext(readJs('shared/resumeDrafts.js'), sandbox, { filename: 'resumeDrafts.js' });
    return { sandbox, store, box };
}

function putDraft(store: Map<string, string>, spec: any) {
    const now = Date.now();
    store.set(
        `sok_draft_v1_${spec.userId}_${spec.kind}_${spec.docId}`,
        JSON.stringify({
            v: 1,
            kind: spec.kind,
            userId: String(spec.userId),
            docId: spec.docId,
            baseVersion: null,
            updatedAt: new Date(now - (spec.ageMs || 0)).toISOString(),
            expiresAt: new Date(now + 14 * 24 * 3600 * 1000).toISOString(),
            payload: { fields: { validity: 'x' } }
        })
    );
}

describe('L1 resumeDrafts — Wznów pracę', () => {
    it('brak draftów → sekcja ukryta, brak treści', () => {
        const { sandbox, box } = loadCtx();
        sandbox.window.resumeDrafts.render({ id: 'u1' });
        expect(box.classes.has('hidden')).toBe(true);
        expect(box.innerHTML).toBe('');
    });

    it('brak użytkownika → sekcja ukryta (nie czyta cudzych draftów)', () => {
        const { sandbox, store, box } = loadCtx();
        putDraft(store, { userId: 'u2', kind: 'offer_rury', docId: 'o1' });
        sandbox.window.resumeDrafts.render(null);
        expect(box.classes.has('hidden')).toBe(true);
    });

    it('lista pokazuje rodzaj, czas i poprawne deep linki', () => {
        const { sandbox, store, box } = loadCtx();
        putDraft(store, { userId: 'u1', kind: 'offer_rury', docId: 'o1', ageMs: 5000 });
        putDraft(store, { userId: 'u1', kind: 'order_studnie', docId: 'z9', ageMs: 1000 });
        putDraft(store, { userId: 'u1', kind: 'offer_studnie', docId: 'new', ageMs: 9000 });
        sandbox.window.resumeDrafts.render({ id: 'u1' });
        expect(box.classes.has('hidden')).toBe(false);
        expect(box.innerHTML).toContain('Wznów pracę');
        expect(box.innerHTML).toContain('Oferta (Rury)');
        expect(box.innerHTML).toContain('app.html#/rury?edit=o1');
        expect(box.innerHTML).toContain('app.html#/studnie?order=z9');
        // Nowy dokument bez id → sam moduł.
        expect(box.innerHTML).toContain('href="app.html#/studnie"');
        expect(box.innerHTML).not.toContain('edit=new');
    });

    it('uszkodzony JSON nie wywala renderu', () => {
        const { sandbox, store, box } = loadCtx();
        store.set('sok_draft_v1_u1_offer_rury_bad', '{nie-json');
        expect(() => sandbox.window.resumeDrafts.render({ id: 'u1' })).not.toThrow();
        expect(box.classes.has('hidden')).toBe(true);
    });

    it('docId z HTML jest escapowany w href', () => {
        const { sandbox, store, box } = loadCtx();
        putDraft(store, { userId: 'u1', kind: 'offer_rury', docId: '<x>', ageMs: 0 });
        sandbox.window.resumeDrafts.render({ id: 'u1' });
        expect(box.innerHTML).not.toContain('<x>');
        expect(box.innerHTML).toContain('%3Cx%3E');
    });

    it('buildHref mapuje wszystkie cztery rodzaje', () => {
        const { sandbox } = loadCtx();
        const h = sandbox.window.resumeDrafts.buildHref;
        expect(h({ kind: 'offer_rury', docId: 'a' })).toBe('app.html#/rury?edit=a');
        expect(h({ kind: 'order_rury', docId: 'a' })).toBe('app.html#/rury?order=a');
        expect(h({ kind: 'offer_studnie', docId: 'a' })).toBe('app.html#/studnie?edit=a');
        expect(h({ kind: 'order_studnie', docId: 'a' })).toBe('app.html#/studnie?order=a');
        expect(h({ kind: 'nieznany', docId: 'a' })).toBe('app.html');
    });
});
