// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Regresja twardej blokady edycji (frontend).
 * - detekcja 423 wylacznie strukturalna (nigdy tekst),
 * - tryOpen przy 423 NIE otwiera formularza (modal zamiast danych),
 * - nieudany acquire NIE zrywa poprzedniej blokady,
 * - holder escapowany w modalu (XSS).
 */
describe('lockService (doc_locks frontend)', () => {
    let ctx: any;
    let fetchCalls: any[];
    let fetchHandler: ((url: string, opts: any) => any) | null;
    let modalOpts: any;
    let toasts: any[];

    const okJson = (body: any) => ({ ok: true, status: 200, json: async () => body });
    const errJson = (status: number, body: any) => ({
        ok: false,
        status,
        json: async () => body
    });

    beforeEach(() => {
        fetchCalls = [];
        toasts = [];
        modalOpts = null;
        fetchHandler = null;
        const code = fs.readFileSync(
            path.join(__dirname, '../../public/js/shared/lockService.js'),
            'utf8'
        );
        const fakeOverlay = { addEventListener: () => {}, remove: () => {} };
        ctx = {
            window: {
                authHeaders: () => ({ 'Content-Type': 'application/json' }),
                showToast: (msg: string) => toasts.push(String(msg)),
                showModal: (opts: any) => {
                    modalOpts = opts;
                    return fakeOverlay;
                },
                closeModal: () => {},
                escapeHtml: (s: any) =>
                    String(s ?? '')
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;'),
                addEventListener: () => {}
            },
            console: { warn: () => {} },
            setInterval: () => 1,
            clearInterval: () => {}
        };
        ctx.window.window = ctx.window;
        vm.createContext(ctx);
        vm.runInContext(code, ctx);
        ctx.fetch = async (url: string, opts: any) => {
            fetchCalls.push({ url, opts });
            if (fetchHandler) return fetchHandler(url, opts);
            return okJson({ ok: true });
        };
    });

    test('isLocked: tylko status/code, nigdy tekst', () => {
        expect(ctx.window.lockService.isLocked({ status: 423 })).toBe(true);
        expect(ctx.window.lockService.isLocked({ code: 'DOC_LOCKED' })).toBe(true);
        expect(ctx.window.lockService.isLocked({ status: 409 })).toBe(false);
        expect(ctx.window.lockService.isLocked(new Error('Dokument jest edytowany'))).toBe(false);
        expect(ctx.window.lockService.isLocked(null)).toBe(false);
    });

    test('describeHolder: fallback bez danych', () => {
        expect(ctx.window.lockService.describeHolder({ userName: 'Ewa' }).name).toBe('Ewa');
        expect(ctx.window.lockService.describeHolder({}).name).toBe('inny użytkownik');
        expect(ctx.window.lockService.describeHolder(null).name).toBe('inny użytkownik');
    });

    test('tryOpen przy wolnym dokumencie → true + held', async () => {
        fetchHandler = () => okJson({ ok: true, lock: { userId: 'u1' } });
        const res = await ctx.window.lockService.tryOpen('offer', 'o1', () => {});
        expect(res).toBe(true);
        expect(ctx.window.lockService.current()).toEqual({ docType: 'offer', docId: 'o1' });
        expect(fetchCalls[0].url).toBe('/api/locks/acquire');
    });

    test('tryOpen przy 423 → false + modal, formularz nietkniety', async () => {
        let opened = false;
        fetchHandler = () =>
            errJson(423, {
                error: 'x',
                code: 'DOC_LOCKED',
                holder: { userId: 'u2', userName: 'Ewa', lockedAt: '2026-01-01T10:00:00.000Z' }
            });
        const res = await ctx.window.lockService.tryOpen('offer', 'o1', () => {
            opened = true;
        });
        expect(res).toBe(false);
        expect(opened).toBe(false);
        expect(ctx.window.lockService.current()).toBe(null);
        expect(modalOpts && modalOpts.id).toBe('doc-locked-modal');
        expect(modalOpts.html).toContain('Ewa');
    });

    test('nieudany acquire NIE zrywa poprzedniej blokady', async () => {
        fetchHandler = () => okJson({ ok: true });
        await ctx.window.lockService.tryOpen('offer', 'o1', () => {});
        expect(ctx.window.lockService.current()).toEqual({ docType: 'offer', docId: 'o1' });
        fetchHandler = () => errJson(423, { code: 'DOC_LOCKED', holder: { userName: 'Ewa' } });
        const res = await ctx.window.lockService.tryOpen('offer', 'o2', () => {});
        expect(res).toBe(false);
        expect(ctx.window.lockService.current()).toEqual({ docType: 'offer', docId: 'o1' });
    });

    test('holder escapowany w modalu (XSS)', async () => {
        fetchHandler = () =>
            errJson(423, {
                code: 'DOC_LOCKED',
                holder: { userName: '<img src=x onerror=alert(1)>' }
            });
        await ctx.window.lockService.tryOpen('offer', 'o1', () => {});
        expect(modalOpts.html).not.toContain('<img src=x');
        expect(modalOpts.html).toContain('&lt;img');
    });
});
