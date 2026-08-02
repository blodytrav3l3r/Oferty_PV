// @ts-nocheck
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('_excelGetComponentsForDn / _excelBuildComponentColumns — generowanie kolumn Excel', () => {
    let ctx: any;

    beforeAll(() => {
        const context: any = {
            studnieProducts: [],
            wells: [],
            logger: { info: () => {}, warn: () => {}, error: () => {} }
        };
        const base = path.join(__dirname, '../../public/js/studnie');
        vm.createContext(context);
        for (const file of ['excelHelpers.js', 'excelReductionColumns.js', 'excelColumns.js']) {
            const code = fs.readFileSync(path.join(base, file), 'utf8');
            vm.runInContext(code, context);
        }
        ctx = context;
    });

    const PRODUCTS = [
        {
            id: 'den-2500-300',
            name: 'Dennica DN2500 H=300',
            componentType: 'dennica',
            dn: 2500,
            height: 300,
            magazynKLB: 1,
            magazynWL: 1
        },
        {
            id: 'den-2500-400',
            name: 'Dennica DN2500 H=400',
            componentType: 'dennica',
            dn: 2500,
            height: 400,
            magazynKLB: 1,
            magazynWL: 1
        },
        {
            id: 'den-univ-650',
            name: 'Dennica uniwersalna H=650',
            componentType: 'dennica',
            dn: null,
            height: 650,
            magazynKLB: 1,
            magazynWL: 1
        },
        {
            id: 'den-wloc-500',
            name: 'Dennica DN2500 H=500 (WL)',
            componentType: 'dennica',
            dn: 2500,
            height: 500,
            magazynKLB: 0,
            magazynWL: 1
        },
        {
            id: 'krag-2500-500',
            name: 'Krąg DN2500 H=500',
            componentType: 'krag',
            dn: 2500,
            height: 500,
            magazynKLB: 1,
            magazynWL: 1
        },
        {
            id: 'prz-160',
            name: 'Przejście 160',
            componentType: 'przejscie',
            dn: 160,
            height: 0,
            magazynKLB: 1,
            magazynWL: 1
        },
        {
            id: 'kineta-2500',
            name: 'Kineta DN2500',
            componentType: 'kineta',
            dn: 2500,
            height: 0,
            magazynKLB: 1,
            magazynWL: 1
        },
        {
            id: 'xyz-2500-400',
            name: 'Nowy element XYZ',
            componentType: 'xyz',
            dn: 2500,
            height: 400,
            magazynKLB: 1,
            magazynWL: 1
        }
    ];

    function buildColumns(dn: string, well: any) {
        ctx.studnieProducts = [...PRODUCTS];
        return ctx._excelBuildComponentColumns(dn, well);
    }

    test('dennica DN2500 z nową wysokością H=400 dostaje nową kolumnę dennica_400', () => {
        const cols = buildColumns('2500', { dn: '2500', magazyn: 'Kluczbork' });
        const col400 = cols.find((c: any) => c.id === 'dennica_400');
        expect(col400).toBeDefined();
        expect(col400.componentType).toBe('dennica');
        expect(col400.height).toBe(400);
        expect(col400.type).toBe('number');
        expect(cols.some((c: any) => c.id === 'dennica_300')).toBe(true);
    });

    test('dwie dennice o tej samej wysokości → jedna kolumna dennica_300 z dwoma produktami', () => {
        ctx.studnieProducts = [
            PRODUCTS[0],
            {
                id: 'den-2500-300b',
                name: 'Dennica DN2500 H=300 wariant',
                componentType: 'dennica',
                dn: 2500,
                height: 300,
                magazynKLB: 1,
                magazynWL: 1
            }
        ];
        const cols = ctx._excelBuildComponentColumns('2500', { dn: '2500', magazyn: 'Kluczbork' });
        const denCols = cols.filter((c: any) => c.componentType === 'dennica');
        expect(denCols.length).toBe(1);
        expect(denCols[0].id).toBe('dennica_300');
        expect(denCols[0].products.map((p: any) => p.id).sort()).toEqual([
            'den-2500-300',
            'den-2500-300b'
        ]);
    });

    test('dennica dn:null (uniwersalna) tworzy kolumnę na zakładce DN1000', () => {
        const cols = buildColumns('1000', { dn: '1000', magazyn: 'Kluczbork' });
        expect(cols.some((c: any) => c.id === 'dennica_650')).toBe(true);
    });

    test('filtr magazynu: dennica WL=1 ukryta w Kluczborku, widoczna we Włocławku', () => {
        const klb = buildColumns('2500', { dn: '2500', magazyn: 'Kluczbork' });
        expect(klb.some((c: any) => c.id === 'dennica_500')).toBe(false);
        const wl = buildColumns('2500', { dn: '2500', magazyn: 'Włocławek' });
        expect(wl.some((c: any) => c.id === 'dennica_500')).toBe(true);
    });

    test('componentType spoza allowlisty (np. xyz) nie tworzy kolumny (ciche pominięcie)', () => {
        const cols = buildColumns('2500', { dn: '2500', magazyn: 'Kluczbork' });
        expect(cols.every((c: any) => c.componentType !== 'xyz')).toBe(true);
        expect(cols.some((c: any) => c.id === 'krag_500')).toBe(true);
    });

    test('brak studni z redukcją w wells → brak kolumn red_*', () => {
        const cols = buildColumns('2500', { dn: '2500', magazyn: 'Kluczbork' });
        expect(cols.some((c: any) => String(c.id).startsWith('red_'))).toBe(false);
    });

    test('_excelGetComponentsForDn: pomija przejscie i kineta, grupuje po componentType', () => {
        ctx.studnieProducts = [...PRODUCTS];
        const groups = ctx._excelGetComponentsForDn('2500', { dn: '2500', magazyn: 'Kluczbork' });
        expect(groups['przejscie']).toBeUndefined();
        expect(groups['kineta']).toBeUndefined();
        expect(groups['dennica'].map((p: any) => p.id)).toContain('den-2500-300');
        expect(groups['dennica'].map((p: any) => p.id)).toContain('den-univ-650');
        expect(groups['dennica'].map((p: any) => p.id)).not.toContain('den-wloc-500');
    });
});

describe('_excelBuildComponentColumns — pozostałe średnice zakładek', () => {
    let ctx: any;

    beforeAll(() => {
        const context: any = {
            studnieProducts: [],
            wells: [],
            logger: { info: () => {}, warn: () => {}, error: () => {} }
        };
        const base = path.join(__dirname, '../../public/js/studnie');
        vm.createContext(context);
        for (const file of ['excelHelpers.js', 'excelReductionColumns.js', 'excelColumns.js']) {
            const code = fs.readFileSync(path.join(base, file), 'utf8');
            vm.runInContext(code, context);
        }
        ctx = context;
    });

    const DN_SWEEP_PRODUCTS = ['1000', '1200', '1500', '2000', '2500'].map((dn, i) => ({
        id: `krag-${dn}-${300 + i}`,
        name: `Krąg DN${dn} H=${300 + i}`,
        componentType: 'krag',
        dn,
        height: 300 + i,
        magazynKLB: 1,
        magazynWL: 1
    }));

    test.each(['1000', '1200', '1500', '2000', '2500'])(
        'zakładka DN%s: kolumny tylko dla produktów tego DN + uniwersalna dn:null',
        (dn) => {
            ctx.studnieProducts = [
                ...DN_SWEEP_PRODUCTS,
                {
                    id: 'den-univ-650',
                    name: 'Dennica uniwersalna H=650',
                    componentType: 'dennica',
                    dn: null,
                    height: 650,
                    magazynKLB: 1,
                    magazynWL: 1
                }
            ];
            ctx.wells = [];
            const cols = ctx._excelBuildComponentColumns(dn, { dn, magazyn: 'Kluczbork' });
            const idx = ['1000', '1200', '1500', '2000', '2500'].indexOf(dn);
            expect(cols.some((c: any) => c.id === `krag_${300 + idx}`)).toBe(true);
            expect(cols.some((c: any) => c.id === 'dennica_650')).toBe(true);
            for (const other of ['1000', '1200', '1500', '2000', '2500'].filter((d) => d !== dn)) {
                const otherIdx = ['1000', '1200', '1500', '2000', '2500'].indexOf(other);
                expect(cols.some((c: any) => c.id === `krag_${300 + otherIdx}`)).toBe(false);
            }
        }
    );

    test('DN2500 z redukcją: kolumny red_* dla targetów 1000 i 1200, główna plyta_redukcyjna ukryta', () => {
        ctx.studnieProducts = [
            {
                id: 'krag-1000-500',
                name: 'Krąg DN1000 H=500',
                componentType: 'krag',
                dn: 1000,
                height: 500,
                magazynKLB: 1,
                magazynWL: 1
            },
            {
                id: 'krag-1200-500',
                name: 'Krąg DN1200 H=500',
                componentType: 'krag',
                dn: 1200,
                height: 500,
                magazynKLB: 1,
                magazynWL: 1
            },
            {
                id: 'plytaRed-2500-200',
                name: 'Płyta redukcyjna DN2500 H=200',
                componentType: 'plyta_redukcyjna',
                dn: 2500,
                height: 200,
                magazynKLB: 1,
                magazynWL: 1
            }
        ];
        ctx.wells = [{ dn: '2500', magazyn: 'Kluczbork', redukcjaDN1000: true }];
        const cols = ctx._excelBuildComponentColumns('2500', ctx.wells[0]);
        expect(cols.some((c: any) => c.id === 'red_krag_1000_500')).toBe(true);
        expect(cols.some((c: any) => c.id === 'red_krag_1200_500')).toBe(true);
        expect(cols.some((c: any) => c.id === 'red_plyta_red_plytaRed-2500-200')).toBe(true);
        expect(cols.some((c: any) => c.id === 'plyta_redukcyjna_plytaRed-2500-200')).toBe(false);
    });

    test('DN1200 z redukcją: tylko target 1000 (bez prefiksu), brak red_*_1200_*', () => {
        ctx.studnieProducts = [
            {
                id: 'krag-1000-500',
                name: 'Krąg DN1000 H=500',
                componentType: 'krag',
                dn: 1000,
                height: 500,
                magazynKLB: 1,
                magazynWL: 1
            },
            {
                id: 'krag-1200-500',
                name: 'Krąg DN1200 H=500',
                componentType: 'krag',
                dn: 1200,
                height: 500,
                magazynKLB: 1,
                magazynWL: 1
            },
            {
                id: 'plytaRed-1200-200',
                name: 'Płyta redukcyjna DN1200 H=200',
                componentType: 'plyta_redukcyjna',
                dn: 1200,
                height: 200,
                magazynKLB: 1,
                magazynWL: 1
            }
        ];
        ctx.wells = [{ dn: '1200', magazyn: 'Kluczbork', redukcjaDN1000: true }];
        const cols = ctx._excelBuildComponentColumns('1200', ctx.wells[0]);
        expect(cols.some((c: any) => c.id === 'red_krag_500')).toBe(true);
        expect(cols.some((c: any) => c.id === 'red_krag_1000_500')).toBe(false);
        expect(cols.some((c: any) => c.id === 'red_plyta_red_plytaRed-1200-200')).toBe(true);
    });

    test('DN1000: brak kolumn red_* nawet gdy well ma redukcjaDN1000, plyta_redukcyjna w sekcji głównej', () => {
        ctx.studnieProducts = [
            {
                id: 'krag-1000-500',
                name: 'Krąg DN1000 H=500',
                componentType: 'krag',
                dn: 1000,
                height: 500,
                magazynKLB: 1,
                magazynWL: 1
            },
            {
                id: 'plytaRed-1000-200',
                name: 'Płyta redukcyjna DN1000 H=200',
                componentType: 'plyta_redukcyjna',
                dn: 1000,
                height: 200,
                magazynKLB: 1,
                magazynWL: 1
            }
        ];
        ctx.wells = [{ dn: '1000', magazyn: 'Kluczbork', redukcjaDN1000: true }];
        const cols = ctx._excelBuildComponentColumns('1000', ctx.wells[0]);
        expect(cols.some((c: any) => c.id.startsWith('red_'))).toBe(false);
        expect(cols.some((c: any) => c.id === 'plyta_redukcyjna_plytaRed-1000-200')).toBe(true);
    });

    test("zakładka 'styczna': effDn zależny od stycznaNadbudowa1200 + kolumna typu styczna", () => {
        const stycznaProd = {
            id: 'styczna-1',
            name: 'Studnia styczna',
            componentType: 'styczna',
            dn: 'styczna',
            height: 0,
            magazynKLB: 1,
            magazynWL: 1
        };
        const krag1000 = {
            id: 'krag-1000-500',
            name: 'Krąg DN1000 H=500',
            componentType: 'krag',
            dn: '1000',
            height: 500,
            magazynKLB: 1,
            magazynWL: 1
        };
        const krag1200 = {
            id: 'krag-1200-600',
            name: 'Krąg DN1200 H=600',
            componentType: 'krag',
            dn: '1200',
            height: 600,
            magazynKLB: 1,
            magazynWL: 1
        };
        const konus1000 = {
            id: 'konus-1000-500',
            name: 'Konus DN1000 H=500',
            componentType: 'konus',
            dn: '1000',
            height: 500,
            magazynKLB: 1,
            magazynWL: 1
        };
        const plyta1000 = {
            id: 'plyta-1000-100',
            name: 'Płyta zamykająca DN1000 H=100',
            componentType: 'plyta_zamykajaca',
            dn: '1000',
            height: 100,
            magazynKLB: 1,
            magazynWL: 1
        };
        const uszczelka1000 = {
            id: 'uszczelka-1000',
            name: 'Uszczelka DN1000',
            componentType: 'uszczelka',
            dn: '1000',
            height: 0,
            magazynKLB: 1,
            magazynWL: 1
        };
        ctx.studnieProducts = [
            stycznaProd,
            krag1000,
            krag1200,
            konus1000,
            plyta1000,
            uszczelka1000
        ];
        ctx.wells = [];

        const cols1000 = ctx._excelBuildComponentColumns('styczne', {
            dn: 'styczna',
            magazyn: 'Kluczbork',
            stycznaNadbudowa1200: false
        });
        expect(cols1000.some((c: any) => c.id === 'styczna_styczna-1')).toBe(true);
        expect(cols1000.some((c: any) => c.id === 'konus_500')).toBe(true);
        expect(cols1000.some((c: any) => c.id === 'plyta_zamykajaca_100')).toBe(true);
        expect(cols1000.some((c: any) => c.id === 'uszczelka_uszczelka-1000')).toBe(true);
        expect(cols1000.some((c: any) => c.id === 'krag_500')).toBe(false);
        expect(cols1000.some((c: any) => c.id === 'krag_600')).toBe(false);

        const cols1200 = ctx._excelBuildComponentColumns('styczne', {
            dn: 'styczna',
            magazyn: 'Kluczbork',
            stycznaNadbudowa1200: true
        });
        expect(cols1200.some((c: any) => c.id === 'styczna_styczna-1')).toBe(true);
        expect(cols1200.some((c: any) => c.id === 'krag_600')).toBe(false);
        expect(cols1200.some((c: any) => c.id === 'krag_500')).toBe(false);
    });
});
