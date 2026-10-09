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

    test('popup katalogu: kontakt 2-linie + przycisk Wczytaj + phone/email w edycji', () => {
        const src = read('public/js/shared/clientManager.js');
        expect(src).toContain('td-sub');
        expect(src).toContain('selectClientFromDb');
        expect(src).toContain('edit-client-phone');
        expect(src).toContain('edit-client-email');
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
});
