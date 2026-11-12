// @ts-nocheck -- VM sandbox for the browser-only StorageService.
import fs from 'fs';
import path from 'path';
import vm from 'vm';

function loadService(fetch: typeof globalThis.fetch) {
    const sandbox: Record<string, unknown> = {
        AbortController,
        clearTimeout,
        fetch,
        logger: { error: jest.fn(), info: jest.fn() },
        setTimeout
    };
    const source = fs
        .readFileSync(path.join(__dirname, '../../public/js/shared/StorageService.js'), 'utf8')
        .replace(/^export default.*$/gm, '')
        .replace(/^export /gm, '');

    vm.createContext(sandbox);
    vm.runInContext(`${source}\nthis.StorageServiceCtor = StorageService;`, sandbox);
    return new (
        sandbox.StorageServiceCtor as new () => {
            saveOffer: (
                offer: Record<string, unknown>,
                options?: Record<string, boolean>
            ) => Promise<{
                number?: string;
            }>;
        }
    )();
}

describe('StorageService.saveOffer — numer przydzielony przez backend', () => {
    test('przesyła marker nowej oferty i zwraca numer z odpowiedzi serwera', async () => {
        let requestBody: Record<string, unknown> | null = null;
        const service = loadService(async (_input, init) => {
            requestBody = JSON.parse(String(init?.body));
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    ok: true,
                    results: [{ id: 'offer-new', ok: true, number: 'OF/000008/ASM/2026' }]
                })
            } as Response;
        });

        const saved = await service.saveOffer(
            { id: 'offer-new', type: 'offer', number: 'OF/000001/ASM/2026' },
            { generateOfferNumber: true }
        );

        expect((requestBody as any).data[0].generateOfferNumber).toBe(true);
        expect(saved.number).toBe('OF/000008/ASM/2026');
    });
});
