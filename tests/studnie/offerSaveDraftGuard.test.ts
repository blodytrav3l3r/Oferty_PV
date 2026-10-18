// @ts-nocheck
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * F2.5 — regresja: komunikat „zmiany zachowane w drafcie" musi być PRAWDZIWY.
 * Dla ofert > DRAFT_MAX_BYTES (4 MB) draftu nie ma; wtedy offerSave musi
 * ostrzegać jawnie (utrata pracy), a nie kłamać o drafcie.
 */
describe('offerSave — uczciwość komunikatu o drafcie (F2.5)', () => {
    function loadOfferSave(draftLoadStatus: string | null, userId: string | null = 'u1') {
        const code = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/offerSave.js'),
            'utf8'
        );
        const context: any = {
            window: {
                localStorage: {},
                draftStore:
                    draftLoadStatus === null
                        ? undefined
                        : {
                              buildDraftKey: () => 'k1',
                              loadDraft: () => ({ status: draftLoadStatus })
                          },
                draftAutosave: { currentUserId: () => userId }
            },
            editingOfferIdStudnie: 'offer-1',
            console
        };
        vm.createContext(context);
        vm.runInContext(code, context);
        return context;
    }

    test('draft istnieje → helper true, komunikat mówi o drafcie', () => {
        const ctx = loadOfferSave('ok');
        expect(ctx._draftAvailableForOffer()).toBe(true);
        expect(ctx._lostWorkMessage('Test.')).toMatch(/zachowane w drafcie/);
        expect(ctx._lostWorkMessage('Test.')).not.toMatch(/SKOPIUJ/);
    });

    test('draft nie istnieje (oversize/missing) → helper false, komunikat ostrzega o utracie', () => {
        const ctx = loadOfferSave('missing');
        expect(ctx._draftAvailableForOffer()).toBe(false);
        const msg = ctx._lostWorkMessage('Test.');
        expect(msg).toMatch(/draft NIEDOSTĘPNY/i);
        expect(msg).toMatch(/SKOPIUJ/);
        expect(msg).not.toMatch(/zachowane w drafcie/);
    });

    test('brak draftStore (środowisko bez modułu) → false, bez wyjątku', () => {
        const ctx = loadOfferSave(null);
        expect(ctx._draftAvailableForOffer()).toBe(false);
    });

    test('brak zalogowanego usera → false', () => {
        const ctx = loadOfferSave('ok', null);
        expect(ctx._draftAvailableForOffer()).toBe(false);
    });
});
