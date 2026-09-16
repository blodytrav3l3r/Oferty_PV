// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * P1.1b: jednostkowe logiki draftu (klucz, allowlista, cap, TTL, cleanup).
 * Protokół: docs/plans/e2-draft-review.md. Storage izolowany per test (memStorage).
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
        },
        _keys: () => Array.from(m.keys())
    };
}

function loadStore() {
    const sandbox: any = { window: {}, console, URL };
    vm.createContext(sandbox);
    vm.runInContext(readJs('shared/draftStore.js'), sandbox, { filename: 'draftStore.js' });
    return sandbox.window.draftStore;
}

function quotaStorage(failTimes: number, failFromCall = 1) {
    const base = memStorage();
    let calls = 0;
    return {
        getItem: (k: string) => base.getItem(k),
        removeItem: (k: string) => base.removeItem(k),
        key: (i: number) => base.key(i),
        get length() {
            return base.length;
        },
        setItem: (k: string, v: string) => {
            calls++;
            if (calls >= failFromCall && calls < failFromCall + failTimes) {
                const e: any = new Error('quota');
                e.name = 'QuotaExceededError';
                throw e;
            }
            return base.setItem(k, v);
        }
    };
}

describe('P1.1b draftStore — klucz', () => {
    it('klucz ma format sok_draft_v1_{userId}_{kind}_{docId}', () => {
        const ds = loadStore();
        expect(ds.buildDraftKey('u7', 'offer_studnie', 'offer_studnie_123')).toBe(
            'sok_draft_v1_u7_offer_studnie_offer_studnie_123'
        );
        expect(ds.buildDraftKey('u7', 'order_rury', null)).toBe('sok_draft_v1_u7_order_rury_new');
    });

    it('brak userId lub zły kind → null (brak draftu)', () => {
        const ds = loadStore();
        expect(ds.buildDraftKey('', 'offer_studnie', 'x')).toBeNull();
        expect(ds.buildDraftKey(null, 'offer_studnie', 'x')).toBeNull();
        expect(ds.buildDraftKey('u1', 'offer_kosmos', 'x')).toBeNull();
    });

    it('docId niebezpieczne sanitowane', () => {
        const ds = loadStore();
        expect(ds.buildDraftKey('u1', 'offer_rury', '../../x')).toBe(
            'sok_draft_v1_u1_offer_rury_______x'
        );
    });
});

describe('P1.1b draftStore — allowlista', () => {
    it('obcina pola runtime studni i wyrzuca wellsExport oraz obce klucze', () => {
        const ds = loadStore();
        const payload = ds.pickDraftPayload({
            fields: { number: '1', clientName: 'X', hacker: 'out' },
            wells: [
                {
                    id: 'w1',
                    config: [],
                    _lastAutoConfig: {},
                    _aiRankInfo: {},
                    __resCache: {},
                    _lastSolveInputHash: 'h',
                    _lastAutoTelemetryId: 't'
                }
            ],
            wellsExport: [{ expensive: true }],
            history: [1],
            pz: [2],
            user: { id: 'u' },
            totalNetto: 999
        });
        expect(payload.wells[0]._lastAutoConfig).toBeUndefined();
        expect(payload.wells[0]._aiRankInfo).toBeUndefined();
        expect(payload.wells[0].__resCache).toBeUndefined();
        expect(payload.wells[0]._lastSolveInputHash).toBeUndefined();
        expect(payload.wells[0]._lastAutoTelemetryId).toBeUndefined();
        expect(payload.wellsExport).toBeUndefined();
        expect(payload.history).toBeUndefined();
        expect(payload.pz).toBeUndefined();
        expect(payload.user).toBeUndefined();
        expect(payload.totalNetto).toBeUndefined();
        expect(payload.fields.hacker).toBeUndefined();
        expect(payload.fields.number).toBe('1');
    });

    it('klonuje — mutacja live po pick nie zmienia payloadu', () => {
        const ds = loadStore();
        const live = { wells: [{ id: 'w1', config: [{ productId: 'p', quantity: 1 }] }] };
        const payload = ds.pickDraftPayload(live);
        live.wells[0].config[0].quantity = 999;
        expect(payload.wells[0].config[0].quantity).toBe(1);
    });

    it('koperta ma v:1, TTL 14 dni sliding, baseVersion', () => {
        const ds = loadStore();
        const now = Date.parse('2026-09-01T10:00:00.000Z');
        const d = ds.buildDraft({
            userId: 'u1',
            kind: 'offer_rury',
            docId: 'new',
            baseVersion: 3,
            payload: { items: [] },
            now
        });
        expect(d.v).toBe(1);
        expect(d.baseVersion).toBe(3);
        expect(Date.parse(d.expiresAt) - Date.parse(d.updatedAt)).toBe(14 * 24 * 3600 * 1000);
    });
});

describe('P1.1b draftStore — cap 4 MB', () => {
    it('draft powyżej limitu odrzucany, storage pusty', () => {
        const ds = loadStore();
        const st = memStorage();
        const big = 'x'.repeat(4_000_001);
        const d = ds.buildDraft({
            userId: 'u1',
            kind: 'offer_rury',
            docId: 'new',
            payload: { fields: { notes: big }, items: [] }
        });
        const res = ds.saveDraft(st, d);
        expect(res).toEqual({ ok: false, reason: 'oversize' });
        expect(st._keys()).toEqual([]);
    });

    it('draft pod limitem zapisywany i odczytywany', () => {
        const ds = loadStore();
        const st = memStorage();
        const d = ds.buildDraft({
            userId: 'u1',
            kind: 'offer_studnie',
            docId: 'abc',
            payload: { wells: [{ id: 'w1' }] }
        });
        expect(ds.saveDraft(st, d)).toEqual({ ok: true });
        const loaded = ds.loadDraft(st, 'sok_draft_v1_u1_offer_studnie_abc');
        expect(loaded.status).toBe('ok');
        expect(loaded.draft.payload.wells).toEqual([{ id: 'w1' }]);
    });
});

describe('P1.1b draftStore — TTL i cleanup', () => {
    it('przeterminowany draft usuwany przy odczycie (cicho)', () => {
        const ds = loadStore();
        const st = memStorage();
        const old = Date.now() - 15 * 24 * 3600 * 1000;
        const d = ds.buildDraft({
            userId: 'u1',
            kind: 'offer_rury',
            docId: 'a',
            payload: {},
            now: old
        });
        expect(ds.saveDraft(st, d).ok).toBe(true);
        const key = 'sok_draft_v1_u1_offer_rury_a';
        expect(ds.loadDraft(st, key).status).toBe('expired');
        expect(st.getItem(key)).toBeNull();
    });

    it('uszkodzony JSON i zła wersja usuwane, formularz na SAVED (status, nie throw)', () => {
        const ds = loadStore();
        const st = memStorage();
        st.setItem('sok_draft_v1_u1_offer_rury_a', '{nie json');
        expect(ds.loadDraft(st, 'sok_draft_v1_u1_offer_rury_a').status).toBe('invalid');
        expect(st.getItem('sok_draft_v1_u1_offer_rury_a')).toBeNull();
        st.setItem('sok_draft_v1_u1_offer_rury_b', JSON.stringify({ v: 999, payload: {} }));
        expect(ds.loadDraft(st, 'sok_draft_v1_u1_offer_rury_b').status).toBe('version');
        expect(st.getItem('sok_draft_v1_u1_offer_rury_b')).toBeNull();
    });

    it('sweep usuwa tylko przeterminowane danego usera', () => {
        const ds = loadStore();
        const st = memStorage();
        const old = Date.now() - 20 * 24 * 3600 * 1000;
        const fresh = ds.buildDraft({ userId: 'u1', kind: 'offer_rury', docId: 'f', payload: {} });
        const stale = ds.buildDraft({
            userId: 'u1',
            kind: 'offer_rury',
            docId: 's',
            payload: {},
            now: old
        });
        const other = ds.buildDraft({
            userId: 'u2',
            kind: 'offer_rury',
            docId: 's',
            payload: {},
            now: old
        });
        [fresh, stale, other].forEach((d) => ds.saveDraft(st, d));
        // other zapisany pod kluczem u2 — saveDraft używa userId z koperty
        expect(ds.sweepDrafts(st, 'u1')).toBe(1);
        expect(st.getItem('sok_draft_v1_u1_offer_rury_f')).not.toBeNull();
        expect(st.getItem('sok_draft_v1_u2_offer_rury_s')).not.toBeNull();
    });

    it('removeUserDrafts (logout) kasuje wszystko użytkownika, cudze zostawia', () => {
        const ds = loadStore();
        const st = memStorage();
        ['a', 'b'].forEach((doc) =>
            ds.saveDraft(
                st,
                ds.buildDraft({ userId: 'u1', kind: 'offer_rury', docId: doc, payload: {} })
            )
        );
        ds.saveDraft(
            st,
            ds.buildDraft({ userId: 'u9', kind: 'offer_rury', docId: 'a', payload: {} })
        );
        expect(ds.removeUserDrafts(st, 'u1')).toBe(2);
        expect(st.getItem('sok_draft_v1_u9_offer_rury_a')).not.toBeNull();
    });
});

describe('P1.1b draftStore — quota i last-write-wins', () => {
    it('quota: usuwa największy draft i ponawia raz', () => {
        const ds = loadStore();
        // Pierwszy zapis przechodzi, quota dopiero przy drugim (failFromCall=2).
        const st = quotaStorage(1, 2);
        const victim = ds.buildDraft({
            userId: 'u1',
            kind: 'offer_rury',
            docId: 'big',
            payload: { fields: { notes: 'v'.repeat(1000) } }
        });
        expect(ds.saveDraft(st, victim).ok).toBe(true);
        const next = ds.buildDraft({ userId: 'u1', kind: 'offer_rury', docId: 'new', payload: {} });
        const res = ds.saveDraft(st, next);
        expect(res.ok).toBe(true);
        expect(st.getItem('sok_draft_v1_u1_offer_rury_big')).toBeNull();
    });

    it('trwała quota → reason quota (SAVED nieblokowany — warstwa odrębna)', () => {
        const ds = loadStore();
        const st = quotaStorage(99);
        const d = ds.buildDraft({ userId: 'u1', kind: 'offer_rury', docId: 'new', payload: {} });
        expect(ds.saveDraft(st, d)).toEqual({ ok: false, reason: 'quota' });
    });

    it('last-write-wins: drugi zapis wygrywa', () => {
        const ds = loadStore();
        const st = memStorage();
        const key = 'sok_draft_v1_u1_offer_rury_new';
        ds.saveDraft(
            st,
            ds.buildDraft({
                userId: 'u1',
                kind: 'offer_rury',
                docId: 'new',
                payload: { fields: { notes: 'v1' } }
            })
        );
        ds.saveDraft(
            st,
            ds.buildDraft({
                userId: 'u1',
                kind: 'offer_rury',
                docId: 'new',
                payload: { fields: { notes: 'v2' } }
            })
        );
        expect(ds.loadDraft(st, key).draft.payload.fields.notes).toBe('v2');
    });
});

describe('P1.1b draftStore — różnica vs SAVED', () => {
    it('nowy dokument ignoruje number/date/wizard', () => {
        const ds = loadStore();
        const a = {
            fields: { number: 'X/1', date: '2026-01-01', clientName: 'K' },
            items: [],
            wizardGlobalParams: { x: 1 },
            wizardStep: 3
        };
        const b = { fields: { number: 'Y/9', date: '2026-05-05', clientName: 'K' }, items: [] };
        expect(ds.draftDiffersFromSaved(a, b, true)).toBe(false);
        const c = { fields: { number: 'Y/9', date: '2026-05-05', clientName: 'INNY' }, items: [] };
        expect(ds.draftDiffersFromSaved(a, c, true)).toBe(true);
    });

    it('istniejący dokument: pełne porównanie (kolejność kluczy bez znaczenia)', () => {
        const ds = loadStore();
        const a = { fields: { clientName: 'K', validity: '7 dni' }, wells: [{ id: 'w1' }] };
        const b = { wells: [{ id: 'w1' }], fields: { validity: '7 dni', clientName: 'K' } };
        expect(ds.draftDiffersFromSaved(a, b, false)).toBe(false);
    });

    it('brak payloadu SAVED → różni się (banner dla crash-przed-zapisem)', () => {
        const ds = loadStore();
        expect(ds.draftDiffersFromSaved({ items: [{ a: 1 }] }, null, true)).toBe(true);
        expect(ds.draftDiffersFromSaved(null, { items: [] }, false)).toBe(false);
    });

    it('summarizeDraftCounts liczy wells/items', () => {
        const ds = loadStore();
        expect(ds.summarizeDraftCounts({ wells: [1, 2], items: [1] })).toEqual({
            wells: 2,
            items: 1
        });
        expect(ds.summarizeDraftCounts({})).toEqual({ wells: 0, items: 0 });
    });
});
