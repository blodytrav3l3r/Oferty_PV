// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import vm from 'vm';

describe('etykieta PZ używa zapisanej migawki elementów', () => {
    test('nie odtwarza elementów z aktualnej konfiguracji studni', () => {
        const context: Record<string, any> = { window: {}, Map };
        vm.createContext(context);
        vm.runInContext(
            fs.readFileSync('public/js/studnie/printEtykietaHelpers.js', 'utf8'),
            context
        );

        const snapshot = [
            { ilosc: '2 szt.', indeks: 'DDD-10-075', nazwa: 'Dennica zapisana w PZ' }
        ];
        const actual = context.buildEtykietaElements({
            etykietaElementy: snapshot,
            well: { config: [{ productId: 'CURRENT-OFFER-ONLY' }] }
        });

        expect(actual).toEqual(snapshot);
        expect(actual).not.toBe(snapshot);
    });
});
