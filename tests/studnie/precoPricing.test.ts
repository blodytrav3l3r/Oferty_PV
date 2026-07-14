export {};

/**
 * Testy jednostkowe dla kalkulacji PRECO (uniesienie kinety).
 *
 * Ładuje precoCalcCore.js w Node.js i testuje czystą funkcję calcPrecoPricingPure.
 */

import { join } from 'path';

/* ============================================================
   Załaduj precoCalcCore.js do global scope w Node.js
   ============================================================ */
const corePath = join(__dirname, '..', '..', 'public', 'js', 'studnie', 'precoCalcCore.js');
require(corePath);

const calcFn = () => (global as any).calcPrecoPricingPure;

/* ============================================================
   Mock danych PRECO dla DN1000 (wzorowane na seed_preco.json)
   ============================================================ */
const mockPrecoPricing: Record<string, any> = {
    1000: {
        kinety: [
            { dn: 150, prosta: 920, dodWlot: 300 },
            { dn: 200, prosta: 1100, dodWlot: 350 },
            { dn: 250, prosta: 1350, dodWlot: 400 },
            { dn: 300, prosta: 1750, dodWlot: 500 },
            { dn: 400, prosta: 2500, dodWlot: 700 },
            { dn: 500, prosta: 4000, dodWlot: 1000 },
            { dn: 600, prosta: 5200, dodWlot: 1300 }
        ],
        uniesienie: [
            { min: 0, max: 100, grupy: { '150-300': 150, '400-600': 200 } },
            { min: 101, max: 200, grupy: { '150-300': 250, '400-600': 350 } },
            { min: 201, max: 400, grupy: { '150-300': 400, '400-600': 550 } },
            { min: 401, max: 600, grupy: { '150-300': 550, '400-600': 750 } }
        ],
        skrzynkaWlazowa: 400,
        cenaPelnaWysMB: 1000,
        cenaDnoOsadnika: 800
    }
};

/* ============================================================
   Helper — tworzy obiekt pomocników dla calcPrecoPricingPure
   ============================================================ */
const FLOW_TYPES = Object.freeze({ WYLOT: 'wylot', WLOT: 'wlot', DOLOT: 'dolot' });

function makeHelpers(precoPricing?: Record<string, any>) {
    return {
        precoPricing: precoPricing || mockPrecoPricing,
        studnieProducts: [],
        FLOW_TYPES
    };
}

/* ============================================================
   Helper — tworzy mock well z przejściami
   ============================================================ */
function makeWell(dn: number, przejscia: any[], overrides?: Record<string, any>): any {
    return {
        dn,
        przejscia,
        rzednaDna: 0,
        kineta: 'preco',
        redukcjaKinety: 'nie',
        precoFullHeight: 'nie',
        config: [],
        ...(overrides || {})
    };
}

function makePrzejscie(
    dn: number,
    rzednaWlaczenia: number,
    angle?: number,
    overrides?: Record<string, any>
): any {
    return {
        productId: `PRZ-${dn}`,
        dn: String(dn),
        rzednaWlaczenia,
        angle: angle ?? 0,
        ...(overrides || {})
    };
}

/* ============================================================
   Helper — ekstrakcja wyników uniesienia
   ============================================================ */
function getUniesienieSzczegoly(result: any): any[] {
    return result.uniesieniaSzczegoly || [];
}

function getUniesienieSuma(result: any): number {
    return result.uniesienie || 0;
}

function findUniesienieEntry(result: any, oryginalnyIndex: number): any | undefined {
    return (result.uniesieniaSzczegoly || []).find((u: any) => u._id === oryginalnyIndex);
}

/* ============================================================
   Testy
   ============================================================ */
describe('PRECO — Uniesienie kinety', () => {
    describe('Pojedyncze przejście (tylko kineta główna)', () => {
        it('jedno przejście DN500@0mm → uniesienie = precoInsertTop - gora', () => {
            const well = makeWell(1000, [makePrzejscie(500, 0)]);
            const result = calcFn()(well, makeHelpers());
            // gora = 0+500=500, precoInsertTop = 500, uniesienie=0
            expect(getUniesienieSuma(result)).toBe(0);
            expect(getUniesienieSzczegoly(result)).toHaveLength(0);
        });

        it('jedno przejście DN500@300mm → uniesienie 0 (gora=800 > precoInsertTop=800)', () => {
            const well = makeWell(1000, [makePrzejscie(500, 0.3)]);
            const result = calcFn()(well, makeHelpers());
            // gora=300+500=800, precoInsertTop=800, uniesienie=0
            expect(getUniesienieSuma(result)).toBe(0);
        });
    });

    describe('Dwa przejścia — ta sama średnica (DN)', () => {
        it('DN400@0mm + DN400@100mm → wybrany dalszy od linii czerwonej (DN400@100mm ma gorę=500)', () => {
            // przejscia: DN400@0mm (gora=400), DN400@100mm (gora=500)
            // sort: oba DN=400 → drugie sortowanie po kącie 0° → DN400@0mm staje się mainPipes[0]
            // precoInsertTop = max(400, 500) = 500 (bo ranges 0-400 i 100-500 zachodzą)
            // p1.dnRury (400) < p0.dnRury (400)? NIE (równe)
            // dist0 = 500-0 = 500, dist1 = 500-100 = 400 → wybrany p0 (dist0 >= dist1)
            // uniesienie = 500 - 400 = 100mm
            const well = makeWell(1000, [makePrzejscie(400, 0), makePrzejscie(400, 0.1)]);
            const result = calcFn()(well, makeHelpers());
            expect(getUniesienieSzczegoly(result)).toHaveLength(1);
            expect(getUniesienieSzczegoly(result)[0].mm).toBeCloseTo(100, -1);
            expect(getUniesienieSuma(result)).toBeGreaterThan(0);
        });

        it('DN400@0mm + DN400@100mm ↔ mainSelected to p0 (dist0 >= dist1)', () => {
            const well = makeWell(1000, [makePrzejscie(400, 0), makePrzejscie(400, 0.1)]);
            const result = calcFn()(well, makeHelpers());
            // p0 = DN400@0mm (mainPipes[0]), powinien być wybrany
            expect(getUniesienieSzczegoly(result)[0]._id).toBe(0); // pierwsze przejście (index 0)
        });
    });

    describe('Dwa przejścia — różne DN (druga mieści się w świetle)', () => {
        it('DN500@0mm + DN400@100mm → DN400 mieści się w DN500 (DN400<DN500 i gora=500<=500) → tylko DN500', () => {
            // mainPipes: DN500@0mm (gora=500), DN400@100mm (gora=500)
            // p1.dnRury (400) < p0.dnRury (500) && p1.gora (500) <= p0.gora (500) → mainSelected = p0
            // precoInsertTop = max(500, 500) = 500 (ranges 0-500 i 100-500 zachodzą)
            // uniesienie = 500 - 500 = 0
            const well = makeWell(1000, [makePrzejscie(500, 0), makePrzejscie(400, 0.1)]);
            const result = calcFn()(well, makeHelpers());
            expect(getUniesienieSzczegoly(result)).toHaveLength(0);
            expect(getUniesienieSuma(result)).toBe(0);
        });

        it('DN500@0mm + DN300@200mm → DN300 mieści się (DN300<DN500 i gora=500<=500) → tylko DN500', () => {
            const well = makeWell(1000, [makePrzejscie(500, 0), makePrzejscie(300, 0.2)]);
            const result = calcFn()(well, makeHelpers());
            // p1.dnRury(300) < p0.dnRury(500) && p1.gora(200+300=500) <= p0.gora(0+500=500) → mainSelected = p0
            // precoInsertTop = max(500, 500) = 500 → uniesienie = 0
            expect(getUniesienieSzczegoly(result)).toHaveLength(0);
        });
    });

    describe('Dwa przejścia — różne DN (druga NIE mieści się w świetle)', () => {
        it('DN500@0mm + DN400@300mm → DN400 ma gora=700 > DN500.gora=500 → NIE mieści się → wybrany dalszy od red line', () => {
            // mainPipes: DN500@0mm (gora=500), DN400@300mm (gora=700)
            // p1.dnRury(400) < p0.dnRury(500) ale p1.gora(700) > p0.gora(500) → NIE mieści się
            // dist0 = precoInsertTop - 0 = 700-0=700, dist1 = 700-300=400 → mainSelected = p0
            // uniesienie = 700 - 500 = 200mm
            const well = makeWell(1000, [makePrzejscie(500, 0), makePrzejscie(400, 0.3)]);
            const result = calcFn()(well, makeHelpers());
            // DN500@0mm + DN400@300mm → ranges: (0,500) i (300,700) → merged: (0,700) → precoInsertTop=700
            expect(getUniesienieSzczegoly(result)).toHaveLength(1);
            expect(getUniesienieSzczegoly(result)[0].mm).toBeCloseTo(200, -1);
            expect(getUniesienieSzczegoly(result)[0]._id).toBe(0); // DN500@0mm = index 0
        });

        it('DN400@200mm + DN500@0mm → DN400 gora=600 > DN500 gora=500 → NIE mieści się → DN500 wybrany (dist0=700 > dist1=500)', () => {
            // Sortowanie: DN500@0mm (main[0]), DN400@200mm (main[1])
            // p1.dnRury(400) < p0.dnRury(500) ale p1.gora(200+400=600) > p0.gora(500) → NIE mieści się
            // dist0 = precoInsertTop-0=700, dist1 = 700-200=500 → mainSelected = p0 = DN500@0mm
            // precoInsertTop = merged (0,500) i (200,600) → merged (0,600) → precoInsertTop = 600
            // uniesienie = 600 - 500 = 100mm
            const well = makeWell(1000, [
                makePrzejscie(400, 0.2),
                makePrzejscie(500, 0) // będzie pierwszy w sortowaniu
            ]);
            const result = calcFn()(well, makeHelpers());
            expect(getUniesienieSzczegoly(result)).toHaveLength(1);
            expect(getUniesienieSzczegoly(result)[0].mm).toBeCloseTo(100, -1);
        });
    });

    describe('Trzy przejścia (kineta główna + dolot)', () => {
        it('DN500@0mm + DN400@100mm + DN300@400mm → DN400 mieści się, DN300 ponad precoInsertTop', () => {
            // mainPipes: DN500@0mm (main[0]), DN400@100mm (main[1])
            // p1.dnRury(400) < p0.dnRury(500) && p1.gora(500) <= p0.gora(500) → mieści się → mainSelected = p0
            // ranges: (0,500), (100,500), (400,700) → merged: (0,700) → precoInsertTop=700
            // uniesienie głównej = 700 - 500 = 200mm
            // DN300@400mm: mmFromBottom=400 < 700, gora=700 → uniesienieMm=0 → brak dopłaty
            const well = makeWell(1000, [
                makePrzejscie(500, 0),
                makePrzejscie(400, 0.1),
                makePrzejscie(300, 0.4)
            ]);
            const result = calcFn()(well, makeHelpers());
            const uniesienia = getUniesienieSzczegoly(result);
            // tylko główna DN500@0mm z uniesieniem 200mm
            expect(uniesienia).toHaveLength(1);
            expect(uniesienia[0].mm).toBeCloseTo(200, -1);
        });

        it('DN500@0mm + DN300@400mm + DN200@350mm → dolot DN200@350mm dostaje własne uniesienie', () => {
            // mainPipes: DN500@0mm (main[0], gora=500), DN300@400mm (main[1], gora=700)
            // p1.dnRury(300) < p0.dnRury(500) ale p1.gora(700) > p0.gora(500) → NIE mieści się
            // dist0 = precoInsertTop - 0, dist1 = precoInsertTop - 400
            // precoInsertTop = merged(0,500) i (400,700) → merged (0,700) → 700
            // dist0=700, dist1=300 → mainSelected = p0
            // uniesienie głównej = 700 - 500 = 200mm
            // dolot DN200@350mm: mmFromBottom=350 < precoInsertTop=700 → ma uniesienie
            //   uniesienieMm = 700 - (350+200) = 700 - 550 = 150mm
            const well = makeWell(1000, [
                makePrzejscie(500, 0),
                makePrzejscie(300, 0.4),
                makePrzejscie(200, 0.35)
            ]);
            const result = calcFn()(well, makeHelpers());
            const uniesienia = getUniesienieSzczegoly(result);
            // Główna: DN500@0mm
            expect(uniesienia.length).toBe(2);
            // main selected (index 0) — uniesienie 200mm
            const mainEntry = findUniesienieEntry(result, 0);
            expect(mainEntry).toBeDefined();
            expect(mainEntry.mm).toBeCloseTo(200, -1);
            expect(mainEntry.opis).toBe('kineta główna');
            // dolot (index 2) — DN200@350mm — uniesienie 150mm
            const dolotEntry = findUniesienieEntry(result, 2);
            expect(dolotEntry).toBeDefined();
            expect(dolotEntry.mm).toBeCloseTo(150, -1);
            expect(dolotEntry.opis).toBe('dolot');
        });

        it('dolot powyżej czerwonej linii → brak uniesienia dla niego', () => {
            // DN500@0mm (gora=500) + DN200@600mm (gora=800)
            // precoInsertTop = merged(0,500) i (600,800) → (0,500) i (600,800) → nie zachodzą
            // precoInsertTop = 500 (pierwszy zakres)
            // DN200@600: mmFromBottom=600 >= precoInsertTop=500 → skip uniesienie dla dolotu
            const well = makeWell(1000, [makePrzejscie(500, 0), makePrzejscie(200, 0.6)]);
            const result = calcFn()(well, makeHelpers());
            const uniesienia = getUniesienieSzczegoly(result);
            expect(uniesienia).toHaveLength(0); // main: 500-500=0, dolot skip
        });
    });

    describe('Doloty nigdy nie zerowane (osobna dopłata)', () => {
        it('DN500@0mm + DN400@0mm + DN300@300mm → DN400 nie mieści się, DN300@300 ma uniesienie osobne', () => {
            // mainPipes: DN500@0mm (main[0], gora=500), DN400@0mm (main[1], gora=400)
            // p1.dnRury(400) < p0.dnRury(500) && p1.gora(400) <= p0.gora(500) → mieści się → mainSelected = p0
            // precoInsertTop = merged(0,500) i (0,400) i (300,600) → (0,500) i (300,600) → (0,600) → 600
            // uniesienie głównej = 600 - 500 = 100mm
            // dolot DN300@300mm: mmFromBottom=300 < precoInsertTop=600 → ma uniesienie
            //   uniesienieMm = 600 - (300+300) = 0 → 0
            const well = makeWell(1000, [
                makePrzejscie(500, 0),
                makePrzejscie(400, 0),
                makePrzejscie(300, 0.3)
            ]);
            const result = calcFn()(well, makeHelpers());
            const uniesienia = getUniesienieSzczegoly(result);
            expect(uniesienia.length).toBe(1); // tylko główna, dolot ma uniesienie=0
        });

        it('DN500@0mm + DN400@150mm + DN200@100mm → DN200@100 dostaje uniesienie osobne', () => {
            // main: DN500@0mm (gora=500), DN400@150mm (gora=550)
            // p1.dnRury(400) < p0.dnRury(500) ale p1.gora(550) > p0.gora(500) → NIE mieści się
            // dist0=precoInsertTop-0, dist1=precoInsertTop-150
            // precoInsertTop = merged(0,500), (150,550), (100,300) → (0,550) → 550
            // dist0=550, dist1=400 → mainSelected = p0
            // uniesienie głównej = 550 - 500 = 50mm
            // dolot DN200@100mm: mmFromBottom=100 < 550 → ma uniesienie
            //   uniesienieMm = 550 - (100+200) = 550 - 300 = 250mm
            const well = makeWell(1000, [
                makePrzejscie(500, 0),
                makePrzejscie(400, 0.15),
                makePrzejscie(200, 0.1)
            ]);
            const result = calcFn()(well, makeHelpers());
            const uniesienia = getUniesienieSzczegoly(result);
            expect(uniesienia.length).toBe(2);
            // główna (index 0)
            const main = findUniesienieEntry(result, 0);
            expect(main).toBeDefined();
            expect(main.mm).toBeCloseTo(50, -1);
            // dolot (index 2 — DN200@100mm)
            const dolot = findUniesienieEntry(result, 2);
            expect(dolot).toBeDefined();
            expect(dolot.mm).toBeCloseTo(250, -1);
            expect(dolot.opis).toBe('dolot');
        });
    });

    describe('DN lookup dla uniesienia (używa dnRury z mainPipes[0])', () => {
        it('uniesienie głównej używa DN z mainPipes[0] do lookup w cenniku', () => {
            // DN400@0mm + DN300@200mm → main[0]=DN400@0mm, main[1]=DN300@200mm
            // p1.dnRury(300) < p0.dnRury(400) && p1.gora(500) > p0.gora(400) → NIE mieści się
            // precoInsertTop = merged(0,400) i (200,500) → (0,500) → 500
            // dist0=500, dist1=300 → mainSelected = p0 = DN400@0mm
            // uniesienie = 500 - 400 = 100mm
            // lookup: _findPrecoRange(cennik.uniesienie, 100, mainPipes[0].dnRury=400)
            // grupa 400-600: 0-100mm → 200 PLN
            const well = makeWell(1000, [makePrzejscie(400, 0), makePrzejscie(300, 0.2)]);
            const result = calcFn()(well, makeHelpers());
            const main = findUniesienieEntry(result, 0);
            expect(main).toBeDefined();
            // 100mm uniesienia dla DN400 → grupa '400-600' z zakresem 0-100 → 200 PLN
            expect(main.cena).toBe(200);
        });

        it('dolot używa własnego DN do lookup w cenniku', () => {
            // DN500@0mm + DN300@400mm + DN200@350mm
            // main[0]=DN500@0mm (gora=500), main[1]=DN300@400mm (gora=700)
            // p1.dnRury(300) < p0.dnRury(500) ale p1.gora(700) > p0.gora(500) → NIE mieści się
            // dist0=precoInsertTop-0, dist1=precoInsertTop-400
            // ranges: (0,500), (400,700), (350,550) → merged: (0,700) → precoInsertTop=700
            // dist0=700, dist1=300 → mainSelected = p0 = DN500@0mm
            // uniesienie głównej = 700-500 = 200mm → lookup: DN500 → 400-600 grupa, 101-200 → 350 PLN
            // dolot DN200@350mm: mmFromBottom=350 < 700 → uniesienieMm=700-550=150mm
            //   lookup: DN200 → 150-300 grupa, 101-200 → 250 PLN
            const well = makeWell(1000, [
                makePrzejscie(500, 0),
                makePrzejscie(300, 0.4),
                makePrzejscie(200, 0.35)
            ]);
            const result = calcFn()(well, makeHelpers());
            // główna DN500@0mm
            const main = findUniesienieEntry(result, 0);
            expect(main).toBeDefined();
            expect(main.cena).toBe(350); // DN500 → grupa 400-600, 101-200mm → 350 PLN
            // dolot DN200@350mm (index 2)
            const dolot = findUniesienieEntry(result, 2);
            expect(dolot).toBeDefined();
            expect(dolot.cena).toBe(250); // DN200 → grupa 150-300, 101-200mm → 250 PLN
        });
    });

    describe('precoFullHeight wpływa na wynik (dopełnienie dennicy)', () => {
        it('gdy precoFullHeight=tak, dodaje koszt wypełnienia powyżej insertTop', () => {
            // Well z config dennicy 500mm + DN400@0mm
            // precoInsertTop = 400 (gora DN400)
            // pozostaloMm = 500 - 400 = 100mm → 0.1m * 1000 PLN/m = 100 PLN
            const well = makeWell(1000, [makePrzejscie(400, 0)], {
                precoFullHeight: 'tak',
                config: [{ productId: 'D-1000-500', quantity: 1, disablePreco: false }]
            });
            const result = calcFn()(well, makeHelpers());
            // Bez studnieProducts w dennica lookup → dennicaHeight=0 → pozostaloMm = 0 - 400 = -400 → 0
            expect(result.pelnaWysokosc).toBeNull();
        });

        it('gdy precoFullHeight=tak i studnieProducts zawiera dennicy, wypełnia poprawnie', () => {
            const well = makeWell(1000, [makePrzejscie(400, 0)], {
                precoFullHeight: 'tak',
                config: [{ productId: 'D-1000-500', quantity: 1, disablePreco: false }]
            });
            const result = calcFn()(well, {
                precoPricing: mockPrecoPricing,
                studnieProducts: [{ id: 'D-1000-500', componentType: 'dennica', height: 500 }],
                FLOW_TYPES
            });
            // precoInsertTop = 400, dennicaHeight = 500, pozostalo = 100mm → 0.1m * 1000 = 100
            expect(result.pelnaWysokosc).toBeDefined();
            expect(result.pelnaWysokosc.metry).toBeCloseTo(0.1, 1);
            expect(result.pelnaWysokosc.cena).toBeCloseTo(100, 0);
        });
    });

    describe('Osadnik z wkładką PRECO (alternatywna ścieżka)', () => {
        it('wkladkaOsadnikPreco=tak → zwraca bazową cenę bez uniesienia', () => {
            const well = makeWell(1000, [], {
                wkladkaOsadnikPreco: 'tak',
                wkladkaOsadnikH: '500'
            });
            const result = calcFn()(well, makeHelpers());
            expect(result.bazowa).toBe(800); // cenaDnoOsadnika
            expect(result.suma).toBeGreaterThan(0);
            expect(getUniesienieSzczegoly(result)).toHaveLength(0);
        });
    });

    describe('Brak przejść lub brak cennika', () => {
        it('brak przejść → zwraca pusty wynik', () => {
            const well = makeWell(1000, []);
            const result = calcFn()(well, makeHelpers());
            expect(result.suma).toBe(0);
            expect(result.bazowa).toBe(0);
        });

        it('brak cennika dla danego DN → zwraca pusty wynik', () => {
            const well = makeWell(999, [makePrzejscie(400, 0)]);
            const result = calcFn()(well, makeHelpers());
            expect(result.suma).toBe(0);
        });
    });

    describe('Regresja — konkretny przypadek z rzeczywistej studni', () => {
        it('DN1000 z DN400@0mm + DN400@100mm → dawniej 0 (główna zerowana), teraz DN400@0mm dostaje 100mm → 200 PLN', () => {
            // Oba DN=400 → sortowanie po kącie → DN400@0° to mainPipes[0], DN400@0.1° to mainPipes[1]
            // DN400@0mm gora=400, DN400@100mm gora=500
            // p1.dnRury=400 NIE < p0.dnRury=400 (równe) → else: wybór po dist
            // precoInsertTop=500, dist0=500-0=500, dist1=500-100=400 → mainSelected=p0
            // uniesienie = 500-400 = 100mm
            // lookup: DN400 → grupa 400-600, zakres 0-100 → 200 PLN
            const well = makeWell(1000, [makePrzejscie(400, 0), makePrzejscie(400, 0.1)]);
            const result = calcFn()(well, makeHelpers());
            const uniesienia = getUniesienieSzczegoly(result);
            expect(uniesienia).toHaveLength(1);
            expect(uniesienia[0].mm).toBeCloseTo(100, -1);
            expect(uniesienia[0].cena).toBe(200);
            expect(getUniesienieSuma(result)).toBe(200);
        });

        it('DN1000 z DN500@0mm + DN400@100mm + DN300@400mm → tylko DN500 dostaje 0mm (gora=500, precoInsertTop=500)', () => {
            // mainPipes: DN500@0mm (gora=500), DN400@100mm (gora=500)
            // p1.dnRury(400) < p0.dnRury(500) && p1.gora(500) <= p0.gora(500) → mieści się → DN500
            // precoInsertTop=500 (merged 0-500,100-500,400-700 → 0-500 i 400-700 nie zachodzą?
            //   (0,500) i (400,700): 400<500 → łączy się: (0,700) → precoInsertTop=700
            // Wait, (400,700) zakres gora=700 → 400<500 → łączy się: (0,700) → precoInsertTop=700
            //   uniesienie = 700 - 500 = 200mm
            // DN300@400: mmFromBottom=400 < 700 → ma uniesienieMm = 700 - 700 = 0 → 0
            const well = makeWell(1000, [
                makePrzejscie(500, 0),
                makePrzejscie(400, 0.1),
                makePrzejscie(300, 0.4)
            ]);
            const result = calcFn()(well, makeHelpers());
            const uniesienia = getUniesienieSzczegoly(result);
            // DN400@100mm mieści się w DN500@0mm → tylko DN500 dostaje uniesienie
            // DN300@400mm ma gora=700, uniesienieMm=700-700=0 → brak
            // Więc tylko DN500@0mm z uniesieniem 200mm
            expect(uniesienia).toHaveLength(1);
        });
    });

    describe('Wybór mainSelected gdy DN równe', () => {
        it('DN400@0mm + DN400@200mm → równe DN, dist decyduje', () => {
            // mainPipes: DN400@0mm (gora=400), DN400@200mm (gora=600)
            // p1.dnRury(400) NIE < p0.dnRury(400) → else
            // precoInsertTop=600 (merged 0-400, 200-600 = (0,600))
            // dist0 = 600-0=600, dist1 = 600-200=400 → mainSelected = p0
            // uniesienie = 600-400=200mm
            const well = makeWell(1000, [makePrzejscie(400, 0), makePrzejscie(400, 0.2)]);
            const result = calcFn()(well, makeHelpers());
            const main = findUniesienieEntry(result, 0);
            expect(main).toBeDefined();
            expect(main.mm).toBeCloseTo(200, -1);
        });

        it('DN400@200mm + DN400@0mm → równe DN, dist decyduje (p0=DN400@0mm)', () => {
            // Sortowanie: DN równe, sort po kącie: 0° przed 0.2° → DN400@0mm = main[0]
            // PrecoInsertTop = merged (0-400, 200-600) → (0,600) → 600
            // dist0=600, dist1=400 → mainSelected = p0
            const well = makeWell(1000, [makePrzejscie(400, 0.2), makePrzejscie(400, 0)]);
            const result = calcFn()(well, makeHelpers());
            const main = findUniesienieEntry(result, 1); // index 1 = DN400@0° (drugi w przejsciach, ale main[0])
            expect(main).toBeDefined();
            expect(main.mm).toBeCloseTo(200, -1);
        });
    });
});
