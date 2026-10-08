// @ts-nocheck
/**
 * Regresja false-positive dirty: wczytanie oferty bez edycji + refresh
 * nie smeie stawiac brudu (natywny dialog beforeunload mimo braku zmian).
 * Krok 1: load czyści stale flagi z poprzedniego dokumentu i (rury) odświeża
 * baseline SAVED w cache offers — reset PRZED checkRecovery, który stawia
 * flagi na nowo tylko gdy realnie odtworzy draft.
 */
import fs from 'fs';
import path from 'path';

function readJs(p) {
    return fs.readFileSync(path.join(process.cwd(), p), 'utf-8');
}

describe('frontend: load czyści stale flagi brudu (false-positive guard)', () => {
    it('rury loadOffer: reset flag przed checkRecovery', () => {
        const src = readJs('public/js/rury/offerCrud.js');
        const reset = src.indexOf('_excelDirty = false');
        const check = src.indexOf("checkRecovery('offer_rury')");
        expect(reset).toBeGreaterThan(-1);
        expect(check).toBeGreaterThan(-1);
        expect(reset).toBeLessThan(check);
        expect(src).toContain('resetWizardDirty');
    });

    it('rury loadOffer: baseline SAVED z wczytanego dokumentu', () => {
        const src = readJs('public/js/rury/offerCrud.js');
        expect(src).toContain('offers[_li] = normalized');
        expect(src).toContain('_rebuildRuryOffersMap');
    });

    it('studnie loadSavedOfferStudnie: reset flag przed checkRecovery', () => {
        const src = readJs('public/js/studnie/offerManager.js');
        const reset = src.indexOf('_excelDirty = false');
        const check = src.indexOf("checkRecovery('offer_studnie')");
        expect(reset).toBeGreaterThan(-1);
        expect(check).toBeGreaterThan(-1);
        expect(reset).toBeLessThan(check);
        expect(src).toContain('resetWizardDirty');
    });
});
