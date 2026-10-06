// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Regresja: kasowanie oferty jest idempotentne.
 * 404 („oferty nie ma na serwerze") to tez sukces ('already-gone'),
 * nie blad „Nie udało się usunąć oferty z żadnego endpointu".
 * 404 z wlasnego dzialu nie odpytuje drugiego endpointu (mniej szumu 404).
 */
function readJs(rel: string): string {
    return fs.readFileSync(path.join(__dirname, '../../public/js', rel), 'utf8');
}

function resp(status: number, body: any = {}) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body
    };
}

function loadService(calls: string[], script: (url: string) => any) {
    const sandbox: any = {
        console,
        logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() }
    };
    sandbox.fetch = async (url: string, _opts: any) => {
        calls.push(url);
        const r = script(url);
        if (r instanceof Error) throw r;
        return r;
    };
    vm.createContext(sandbox);
    vm.runInContext(
        readJs('shared/StorageService.js')
            .replace(/^export default.*$/gm, '')
            .replace(/^export /gm, '') + '\nthis.StorageServiceCtor = StorageService;',
        sandbox,
        { filename: 'StorageService.js' }
    );
    return new sandbox.StorageServiceCtor();
}

describe('StorageService.deleteOffer — idempotentny 404', () => {
    it('rury: DELETE 200 = true, bez proby endpointu studni', async () => {
        const calls: string[] = [];
        const svc = loadService(calls, () => resp(200, { ok: true }));
        await expect(svc.deleteOffer('offer_1790845390038')).resolves.toBe(true);
        expect(calls).toEqual(['/api/offers-rury/offer_1790845390038']);
    });

    it('rury: DELETE 404 = already-gone, drugi endpoint niepytany', async () => {
        const calls: string[] = [];
        const svc = loadService(calls, () => resp(404, { error: 'Oferta nie istnieje' }));
        await expect(svc.deleteOffer('offer_1790845390038')).resolves.toBe('already-gone');
        expect(calls).toEqual(['/api/offers-rury/offer_1790845390038']);
    });

    it('studnie: DELETE 404 = already-gone, drugi endpoint niepytany', async () => {
        const calls: string[] = [];
        const svc = loadService(calls, () => resp(404, { error: 'Oferta studni nie istnieje' }));
        await expect(svc.deleteOffer('offer_studnie_123')).resolves.toBe('already-gone');
        expect(calls).toEqual(['/api/offers-rury/studnie/offer_studnie_123']);
    });

    it('500 na pierwszym + 200 na drugim = true (fallback zyje)', async () => {
        const calls: string[] = [];
        const svc = loadService(calls, (url) =>
            url.includes('/studnie/') ? resp(200, { ok: true }) : resp(500, {})
        );
        await expect(svc.deleteOffer('offer_1')).resolves.toBe(true);
        expect(calls).toHaveLength(2);
    });

    it('500 na pierwszym + 404 na drugim = already-gone', async () => {
        const calls: string[] = [];
        const svc = loadService(calls, (url) =>
            url.includes('/studnie/') ? resp(404, {}) : resp(500, {})
        );
        await expect(svc.deleteOffer('offer_1')).resolves.toBe('already-gone');
        expect(calls).toHaveLength(2);
    });

    it('403 = blad z komunikatem serwera (blokada zamowien/PZ)', async () => {
        const calls: string[] = [];
        const svc = loadService(calls, () => resp(403, { error: 'Ma przypisane zamowienia' }));
        await expect(svc.deleteOffer('offer_1')).rejects.toThrow('Ma przypisane zamowienia');
        expect(calls).toHaveLength(1);
    });

    it('pad obu endpointow (siec) = blad generyczny', async () => {
        const calls: string[] = [];
        const svc = loadService(calls, () => new Error('sieci nie ma'));
        await expect(svc.deleteOffer('offer_1')).rejects.toThrow(
            'Nie udało się usunąć oferty z żadnego endpointu'
        );
        expect(calls).toHaveLength(2);
    });
});
