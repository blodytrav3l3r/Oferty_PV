// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Regresja blokady optimistic concurrency (409 VERSION_CONFLICT).
 * buildBaseOfferDoc musi nieść version z existingDoc do zapisu —
 * bez tego backend traktuje zapis jako "stary klient" i cicho nadpisuje.
 * Detekcja konfliktu wyłącznie strukturalna (status/code), nigdy tekst.
 */
describe('offer version roundtrip (P0-D2)', () => {
    let ctx: any;

    beforeAll(() => {
        const code = fs.readFileSync(
            path.join(__dirname, '../../public/js/shared/offerCrudCommon.js'),
            'utf8'
        );
        ctx = {
            window: {},
            document: { addEventListener: () => {}, getElementById: () => null },
            logger: { info: () => {}, warn: () => {}, error: () => {} }
        };
        vm.createContext(ctx);
        vm.runInContext(code, ctx);
    });

    function base(over: any = {}) {
        return {
            id: 'offer_1',
            type: 'offer',
            fields: {
                number: 'OF/1',
                date: '2026-01-01',
                clientName: 'ACME',
                clientNumber: '',
                clientNip: '',
                clientAddress: '',
                clientContact: '',
                investName: '',
                investAddress: '',
                investContractor: '',
                notes: '',
                paymentTerms: 'x',
                validity: '7 dni',
                transportKm: 100,
                transportRate: 10
            },
            currentUser: { id: 'u1', username: 'jan' },
            ...over
        };
    }

    test('existingDoc.version jest przenoszony do zapisu', () => {
        const doc = ctx.buildBaseOfferDoc(base({ existingDoc: { version: 5 } }));
        expect(doc.version).toBe(5);
    });

    test('brak version -> brak pola (ścieżka create, bez ślepego 1)', () => {
        const doc = ctx.buildBaseOfferDoc(base({ existingDoc: null }));
        expect('version' in doc).toBe(false);
    });

    test('spec.version działa jako fallback', () => {
        const doc = ctx.buildBaseOfferDoc(base({ existingDoc: null, version: 3 }));
        expect(doc.version).toBe(3);
    });

    test('existingDoc wygrywa ze spec.version', () => {
        const doc = ctx.buildBaseOfferDoc(base({ existingDoc: { version: 7 }, version: 2 }));
        expect(doc.version).toBe(7);
    });

    test('string nie jest traktowany jako version', () => {
        const doc = ctx.buildBaseOfferDoc(base({ existingDoc: { version: '5' } }));
        expect('version' in doc).toBe(false);
    });

    test('isVersionConflict: tylko status/code, nigdy tekst', () => {
        expect(ctx.isVersionConflict({ status: 409 })).toBe(true);
        expect(ctx.isVersionConflict({ code: 'VERSION_CONFLICT' })).toBe(true);
        expect(
            ctx.isVersionConflict({
                status: 409,
                code: 'VERSION_CONFLICT',
                serverVersion: 8
            })
        ).toBe(true);
        expect(ctx.isVersionConflict({ status: 500 })).toBe(false);
        expect(ctx.isVersionConflict(new Error('Błąd zapisu oferty'))).toBe(false);
        expect(ctx.isVersionConflict(new Error('Oferta zmieniona przez innego użytkownika'))).toBe(
            false
        );
        expect(ctx.isVersionConflict(null)).toBe(false);
        expect(ctx.isVersionConflict(undefined)).toBe(false);
    });
});
