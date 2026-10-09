// @ts-nocheck
/* Osoby do kontaktu: kontrakt zapis -> otwarcie -> zapis (rury+studnie).
 * Statyka pilnuje, zeby allowlisty i sciezki edycji niosly tablice
 * clientContacts + split-klucze (contactPerson/clientPhone/clientEmail).
 * Bez tego edytor otwiera sie pusty i zapis nadpisuje blob pusta lista. */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('frontend: offer contacts roundtrip', () => {
    test('offerApi (studnie): allowlista niesie tablice + split-klucze', () => {
        const src = read('public/js/studnie/offerApi.js');
        for (const k of ['clientContacts', 'contactPerson', 'clientPhone', 'clientEmail']) {
            expect(src).toContain(`'${k}'`);
        }
    });

    test('StorageService.normalizeOffer: mapuje kontakty z bloba', () => {
        const src = read('public/js/shared/StorageService.js');
        for (const k of [
            'clientContacts',
            'contactPerson',
            'clientPhone',
            'clientEmail',
            'clientContact'
        ]) {
            expect(src).toContain(k);
        }
    });

    test('offerCrudCommon: zapis wyprowadza mirror [0] + doc niesie split-klucze', () => {
        const src = read('public/js/shared/offerCrudCommon.js');
        expect(src).toContain('contactPerson');
        expect(src).toContain('clientPhone');
        expect(src).toContain('clientEmail');
        expect(src).toContain('clientContacts: fields.clientContacts');
    });

    test('sciezki edycji: rury load + restore i studnie load przekazuja kontakty', () => {
        const rury = read('public/js/rury/offerCrud.js');
        const studnie = read('public/js/studnie/offerManager.js');
        for (const src of [rury, studnie]) {
            expect(src).toContain('clientContacts: normalized.clientContacts');
            expect(src).toContain('contactPerson: normalized.contactPerson');
            expect(src).toContain('clientEmail: normalized.clientEmail');
        }
        expect(rury).toContain('clientContacts: snapshot.clientContacts');
    });

    test('draft: FIELD_KEYS niesie kontakty (recovery nie gubi maili)', () => {
        const src = read('public/js/shared/draftStore.js');
        for (const k of ['clientContacts', 'contactPerson', 'clientPhone', 'clientEmail']) {
            expect(src).toContain(`'${k}'`);
        }
    });

    test('popup katalogu: kontakt 2-linie + przycisk Wczytaj + edytor N-osob', () => {
        const src = read('public/js/shared/clientManager.js');
        expect(src).toContain('td-sub');
        expect(src).toContain('selectClientFromDb');
        expect(src).toContain('renderCatalogEditor');
        expect(src).toContain('edit-client-contacts');
        expect(src).toContain('window.selectClientFromDb = selectClientFromDb;');
    });

    test('popup katalogu: search po osobie/telefonie/e-mailu', () => {
        const src = read('public/js/shared/clientManager.js');
        expect(src).toContain('c.phone');
        expect(src).toContain('c.email');
    });

    test('popup katalogu: Wczytaj rozcina legacy "Jan, 600" na pola', () => {
        const src = read('public/js/shared/clientManager.js');
        expect(src).toContain('selectClientFromDbForce');
        const forceIdx = src.indexOf('function selectClientFromDbForce');
        const tail = src.slice(forceIdx);
        expect(tail).toContain('parseLegacyMirror');
    });

    test('popup katalogu: layout auto + kontakt rozbity na linie', () => {
        const src = read('public/js/shared/clientManager.js');
        expect(src).toContain('td-contact');
        expect(src).toContain('parseLegacyMirror');
        const css = read('public/css/style.responsive.css');
        expect(css).toContain('table-layout: auto;');
        expect(css).toContain('.td-contact');
    });

    test('katalog N-osob: cache + sync API + stabilne id', () => {
        const src = read('public/js/shared/clientManager.js');
        expect(src).toContain('fetchClientContacts');
        expect(src).toContain('/contacts/sync');
        expect(src).toContain('ensureContactIds');
        expect(src).toContain('clientUpdatedAt');
        // fetch-fail = blokada, nigdy pusty sync
        expect(src).toContain('ok: false');
    });

    test('katalog N-osob: edytor .ccc-* z ★ i stanowiskiem, bez innerHTML na danych', () => {
        const src = read('public/js/shared/clientManager.js');
        expect(src).toContain('ccc-row');
        expect(src).toContain('data-ccc');
        expect(src).toContain('collectCatalogEditor');
        expect(src).toContain('renderCatalogEditor');
        expect(src).toContain('textContent');
        const css = read('public/css/style.base.css');
        expect(css).toContain('.ccc-row');
        expect(css).toContain('.ccc-picks');
    });

    test('katalog N-osob: edit-fallback rozcina legacy mirror jak display', () => {
        const src = read('public/js/shared/clientManager.js');
        const editIdx = src.indexOf('Edytor N-osób katalogu');
        expect(editIdx).toBeGreaterThan(-1);
        expect(src.slice(editIdx, editIdx + 2000)).toContain('parseLegacyMirror');
    });

    test('katalog N-osob: verbatim z DB rozcinany w display/edycji/Wczytaj', () => {
        const src = read('public/js/shared/clientManager.js');
        expect(src).toContain('splitCachedRow');
        const idx = src.indexOf('function splitCachedRow');
        expect(idx).toBeGreaterThan(-1);
        expect(src).toContain('cached.list.map(splitCachedRow)');
    });

    test('katalog N-osob: picker wyboru do oferty (checkboxy, escape atrybutow)', () => {
        const src = read('public/js/shared/clientManager.js');
        expect(src).toContain('client-contact-picker');
        expect(src).toContain('data-ccc-pick');
        expect(src).toContain('escapeHtmlAttr');
        expect(src).toContain('proceedSelectClient');
    });
});
