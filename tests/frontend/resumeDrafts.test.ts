// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * L1: „Wznów pracę" — kafelek pulpitu + popup (szkice lokalne i ostatnia trasa).
 * Wymagania: kafelek zawsze widoczny (bez danych wyszarzony), lista szkiców,
 * usuwanie pojedyncze i zbiorcze, usuwanie zapisu trasy, escapowanie danych.
 */
function readJs(rel: string): string {
    return fs.readFileSync(path.join(__dirname, '../../public/js', rel), 'utf8');
}

function makeDom() {
    const registry = new Map<string, any>();
    const document = {
        getElementById: (id: string) => registry.get(id) || null,
        querySelector: () => null,
        addEventListener: () => {}
    };
    function makeEl(id: string) {
        const el: any = {
            id,
            innerHTML: '',
            listeners: [] as Array<{ type: string; fn: (e: any) => void }>,
            openBtn: null as any,
            contains: () => false,
            addEventListener(type: string, fn: (e: any) => void) {
                el.listeners.push({ type, fn });
            },
            querySelector(sel: string) {
                if (sel !== '[data-resume-action="open"]') return null;
                if (/disabled/.test(el.innerHTML)) return null;
                if (!el.openBtn) {
                    el.openBtn = {
                        handlers: [] as Array<() => void>,
                        addEventListener(_type: string, fn: () => void) {
                            el.openBtn.handlers.push(fn);
                        }
                    };
                }
                return el.openBtn;
            }
        };
        registry.set(id, el);
        return el;
    }
    return { registry, document, makeEl };
}

function loadCtx() {
    const store = new Map<string, string>();
    const dom = makeDom();
    dom.makeEl('resume-drafts');
    const sandbox: any = {
        console,
        document: dom.document,
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
    sandbox.window.confirm = () => true;
    sandbox.window.showModal = (opts: any) => {
        const el = dom.makeEl(opts.id);
        el.innerHTML = opts.html;
        return el;
    };
    sandbox.window.closeModal = (id: string) => void dom.registry.delete(id);
    vm.createContext(sandbox);
    vm.runInContext(readJs('shared/draftStore.js'), sandbox, { filename: 'draftStore.js' });
    vm.runInContext(readJs('shared/resumeDrafts.js'), sandbox, { filename: 'resumeDrafts.js' });
    return { sandbox, store, dom, rd: sandbox.window.resumeDrafts };
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

function setRoute(sandbox: any, record: any) {
    let cleared = false;
    let current = record;
    sandbox.window.lastRoute = {
        get: () => current,
        clear: () => {
            cleared = true;
            current = null;
        }
    };
    return () => cleared;
}

function tile(dom: any) {
    return dom.registry.get('resume-drafts');
}

function fire(overlay: any, action: string, key?: string) {
    const el = {
        getAttribute: (name: string) =>
            name === 'data-resume-action' ? action : name === 'data-key' ? (key ?? null) : null
    };
    const handler = overlay.listeners.find((l: any) => l.type === 'click');
    handler.fn({ target: { closest: () => el } });
}

describe('L1 resumeDrafts — kafelek i popup „Wznów pracę"', () => {
    it('brak danych → kafelek widoczny, wyszarzony, bez akcji', () => {
        const { sandbox, dom, rd } = loadCtx();
        rd.render({ id: 'u1' });
        const box = tile(dom);
        expect(box.innerHTML).toContain('Wznów pracę');
        expect(box.innerHTML).toContain('Brak szkiców do wznowienia');
        expect(box.innerHTML).toContain('disabled');
        expect(box.querySelector('[data-resume-action="open"]')).toBeNull();
        void sandbox;
    });

    it('brak użytkownika → nie czyta cudzych szkiców (kafelek pusty)', () => {
        const { store, dom, rd } = loadCtx();
        putDraft(store, { userId: 'u2', kind: 'offer_rury', docId: 'o1' });
        rd.render(null);
        expect(tile(dom).innerHTML).toContain('Brak szkiców do wznowienia');
    });

    it('szkice → licznik, podtytuł i popup z deep linkami', () => {
        const { store, dom, sandbox, rd } = loadCtx();
        putDraft(store, { userId: 'u1', kind: 'offer_rury', docId: 'o1' });
        putDraft(store, { userId: 'u1', kind: 'order_studnie', docId: 'z9' });
        rd.render({ id: 'u1' });
        const box = tile(dom);
        expect(box.innerHTML).toContain('2 szkice');
        expect(box.innerHTML).toContain('Kopie lokalne w tej przeglądarce');
        expect(box.innerHTML).not.toContain('disabled');

        rd.openPopup({ id: 'u1' });
        const overlay = sandbox.document.getElementById('resume-modal');
        expect(overlay.innerHTML).toContain('Oferta (Rury)');
        expect(overlay.innerHTML).toContain('Zamówienie (Studnie)');
        expect(overlay.innerHTML).toContain('href="app.html#/rury?edit=o1"');
        expect(overlay.innerHTML).toContain('href="app.html#/studnie?order=z9"');
        expect(overlay.innerHTML).toContain('Usuń wszystkie kopie lokalne (2)');
    });

    it('klik w kafelek otwiera popup (jedyna ścieżka produkcyjna)', () => {
        const { store, sandbox, dom, rd } = loadCtx();
        putDraft(store, { userId: 'u1', kind: 'offer_rury', docId: 'o1' });
        rd.render({ id: 'u1' });
        const btn = tile(dom).openBtn;
        expect(btn).not.toBeNull();
        expect(btn.handlers.length).toBe(1);
        expect(sandbox.document.getElementById('resume-modal')).toBeNull();
        btn.handlers[0]();
        const overlay = sandbox.document.getElementById('resume-modal');
        expect(overlay).not.toBeNull();
        expect(overlay.innerHTML).toContain('Oferta (Rury)');
    });

    it('nowy dokument bez docId → sam moduł, bez edit=new', () => {
        const { store, sandbox, rd } = loadCtx();
        putDraft(store, { userId: 'u1', kind: 'offer_studnie', docId: 'new' });
        rd.openPopup({ id: 'u1' });
        const overlay = sandbox.document.getElementById('resume-modal');
        expect(overlay.innerHTML).toContain('href="app.html#/studnie"');
        expect(overlay.innerHTML).not.toContain('edit=new');
    });

    it('uszkodzony JSON nie wywala renderu (kafelek pusty)', () => {
        const { store, dom, rd } = loadCtx();
        store.set('sok_draft_v1_u1_offer_rury_bad', '{nie-json');
        expect(() => rd.render({ id: 'u1' })).not.toThrow();
        expect(tile(dom).innerHTML).toContain('Brak szkiców do wznowienia');
    });

    it('docId z HTML jest escapowany w href', () => {
        const { store, sandbox, rd } = loadCtx();
        putDraft(store, { userId: 'u1', kind: 'offer_rury', docId: '<x>' });
        rd.openPopup({ id: 'u1' });
        const html = sandbox.document.getElementById('resume-modal').innerHTML;
        expect(html).not.toContain('<x>');
        expect(html).toContain('%3Cx%3E');
    });

    it('usunięcie pojedynczego szkicu kasuje klucz i odświeża kafelek', () => {
        const { store, sandbox, dom, rd } = loadCtx();
        putDraft(store, { userId: 'u1', kind: 'offer_rury', docId: 'o1' });
        putDraft(store, { userId: 'u1', kind: 'offer_studnie', docId: 's1' });
        rd.openPopup({ id: 'u1' });
        fire(
            sandbox.document.getElementById('resume-modal'),
            'delete',
            'sok_draft_v1_u1_offer_rury_o1'
        );
        expect(store.has('sok_draft_v1_u1_offer_rury_o1')).toBe(false);
        expect(store.has('sok_draft_v1_u1_offer_studnie_s1')).toBe(true);
        expect(tile(dom).innerHTML).toContain('1 szkic');
        expect(sandbox.document.getElementById('resume-modal').innerHTML).toContain(
            'Usuń wszystkie kopie lokalne (1)'
        );
    });

    it('„usuń wszystkie" czyści też ukryte kopie konfliktów', () => {
        const { store, sandbox, dom, rd } = loadCtx();
        putDraft(store, { userId: 'u1', kind: 'offer_rury', docId: 'o1' });
        putDraft(store, { userId: 'u1', kind: 'offer_rury', docId: 'o1-konflikt-1700000000000' });
        rd.openPopup({ id: 'u1' });
        const overlay = sandbox.document.getElementById('resume-modal');
        expect(overlay.innerHTML).toContain('Usuń wszystkie kopie lokalne (2)');
        fire(overlay, 'delete-all');
        expect(Array.from(store.keys())).toEqual([]);
        expect(tile(dom).innerHTML).toContain('Brak szkiców do wznowienia');
    });

    it('usunięcie wszystkich szkiców nie rusza innych użytkowników', () => {
        const { store, sandbox, dom, rd } = loadCtx();
        putDraft(store, { userId: 'u1', kind: 'offer_rury', docId: 'o1' });
        putDraft(store, { userId: 'u1', kind: 'offer_studnie', docId: 's1' });
        putDraft(store, { userId: 'u2', kind: 'offer_rury', docId: 'x1' });
        rd.openPopup({ id: 'u1' });
        fire(sandbox.document.getElementById('resume-modal'), 'delete-all');
        expect(Array.from(store.keys())).toEqual(['sok_draft_v1_u2_offer_rury_x1']);
        expect(sandbox.document.getElementById('resume-modal')).toBeNull();
        expect(tile(dom).innerHTML).toContain('Brak szkiców do wznowienia');
    });

    it('anulowanie confirm nie usuwa szkicu', () => {
        const { store, sandbox, rd } = loadCtx();
        sandbox.window.confirm = () => false;
        putDraft(store, { userId: 'u1', kind: 'offer_rury', docId: 'o1' });
        rd.openPopup({ id: 'u1' });
        fire(
            sandbox.document.getElementById('resume-modal'),
            'delete',
            'sok_draft_v1_u1_offer_rury_o1'
        );
        expect(store.has('sok_draft_v1_u1_offer_rury_o1')).toBe(true);
    });

    it('ostatnia trasa: kafelek, sekcja w popupie i usuwanie zapisu', () => {
        const { sandbox, dom, rd } = loadCtx();
        const wasCleared = setRoute(sandbox, {
            hash: '#/kartoteka',
            label: 'Kartoteka',
            updatedAt: new Date().toISOString()
        });
        rd.render({ id: 'u1' });
        expect(tile(dom).innerHTML).toContain('Ostatnia trasa');
        expect(tile(dom).innerHTML).toContain('Ostatnia trasa: Kartoteka');
        expect(tile(dom).innerHTML).not.toContain('disabled');

        rd.openPopup({ id: 'u1' });
        const overlay = sandbox.document.getElementById('resume-modal');
        expect(overlay.innerHTML).toContain('Wróć do: Kartoteka');
        expect(overlay.innerHTML).toContain('href="app.html#/kartoteka"');
        fire(overlay, 'forget-route');
        expect(wasCleared()).toBe(true);
        expect(sandbox.document.getElementById('resume-modal')).toBeNull();
        expect(tile(dom).innerHTML).toContain('Brak szkiców do wznowienia');
    });

    it('buildHref mapuje wszystkie cztery rodzaje', () => {
        const { rd } = loadCtx();
        expect(rd.buildHref({ kind: 'offer_rury', docId: 'a' })).toBe('app.html#/rury?edit=a');
        expect(rd.buildHref({ kind: 'order_rury', docId: 'a' })).toBe('app.html#/rury?order=a');
        expect(rd.buildHref({ kind: 'offer_studnie', docId: 'a' })).toBe(
            'app.html#/studnie?edit=a'
        );
        expect(rd.buildHref({ kind: 'order_studnie', docId: 'a' })).toBe(
            'app.html#/studnie?order=a'
        );
        expect(rd.buildHref({ kind: 'nieznany', docId: 'a' })).toBe('app.html');
    });
});
