export {};

/**
 * Brak konfiguracji PRECO nie może być cichym 0 zł.
 * `calcPrecoPricingPure` ustawia `error`, które konsumenci (calcWellStats,
 * badge'y błędu) pokazują użytkownikowi.
 *
 * Regresja: wcześniej `if (!dnStudni || !precoPricing[dnStudni]) return result`
 * oraz `cennik.cenaDnoOsadnika || 0` dawały sumę 0 bez żadnego sygnału.
 */

import { join } from 'path';

const corePath = join(__dirname, '..', '..', 'public', 'js', 'studnie', 'precoCalcCore.js');
// eslint-disable-next-line @typescript-eslint/no-require-imports -- public/js to skrypt, nie moduł ESM
require(corePath);

const calc = () => (global as any).calcPrecoPricingPure;

const FLOW_TYPES = { WYLOT: 'wylot', WLOT: 'wlot', DOLOT: 'dolot' };

function makeWell(dn: number, overrides: Record<string, unknown> = {}): any {
    return {
        dn,
        przejscia: [],
        rzednaDna: 0,
        kineta: 'preco',
        redukcjaKinety: 'nie',
        precoFullHeight: 'nie',
        config: [],
        ...overrides
    };
}

describe('PRECO: brak cennika = błąd, nie 0 zł', () => {
    test('DN bez wpisu w cenniku → error i suma 0', () => {
        const result = calc()(makeWell(900), {
            precoPricing: {
                1000: { kinety: [], uniesienie: [], redukcja: [], spadekKineta: [], spadekMufa: [] }
            },
            studnieProducts: [],
            FLOW_TYPES
        });
        expect(result.suma).toBe(0);
        expect(result.error).toContain('Brak cennika PRECO');
        expect(result.error).toContain('900');
    });

    test('brak precoPricing w helpers → bez wyjątku, suma 0', () => {
        const result = calc()(makeWell(1000), {
            precoPricing: null,
            studnieProducts: [],
            FLOW_TYPES
        });
        expect(result.suma).toBe(0);
    });

    test('osadnik bez cenaDnoOsadnika → error (dawniej ciche 0)', () => {
        const result = calc()(
            makeWell(1000, { wkladkaOsadnikPreco: 'tak', wkladkaOsadnikH: 500 }),
            {
                precoPricing: { 1000: { kinety: [], uniesienie: [], redukcja: [] } },
                studnieProducts: [],
                FLOW_TYPES
            }
        );
        expect(result.suma).toBe(0);
        expect(result.error).toContain('Niepełny cennik PRECO');
    });

    test('osadnik z pełną konfiguracją → brak error', () => {
        const result = calc()(
            makeWell(1000, { wkladkaOsadnikPreco: 'tak', wkladkaOsadnikH: 500 }),
            {
                precoPricing: {
                    1000: {
                        cenaDnoOsadnika: 920,
                        cenaPelnaWysMB: 1000,
                        kinety: [],
                        uniesienie: [],
                        redukcja: []
                    }
                },
                studnieProducts: [],
                FLOW_TYPES
            }
        );
        expect(result.error).toBeUndefined();
        // 920 + 0.5m * 1000 = 1420
        expect(result.suma).toBe(1420);
        expect(result.pelnaWysokosc.cena).toBe(500);
    });
});
