/* ============================
   Well Config Rules — Reguły walidacji i filtrowania studni
   ============================
   
   ARCHITEKTURA WARSTWOWA:
   ┌─────────────────────────────┐
   │ 1. Requirements Engine      │ calculateConnectionRequirements(), estimateBottomSection()
   │    (ruleEngine.js)          │ → What constraints exist?
   ├─────────────────────────────┤
   │ 2. Layout Engine            │ buildCandidateLayouts(), buildConfigSegmentMap()
   │    (wellConfigRules.js)     │ → What possible configurations exist?
   ├─────────────────────────────┤
   │ 3. Solver                   │ solve(), selectRingVariants(), applyDrilledRings()
   │    (wellSolver.js)          │ → Does this configuration work?
   ├─────────────────────────────┤
   │ 4. Scoring                  │ scoreLayout()
   │    (TBD)                    │ → Which configuration is best?
   └─────────────────────────────┘
   
   TYPY DANYCH (dokumentacja):
   @typedef {Object} SectionRequirements
   @property {number} minBottomH - minimalna wysokość sekcji dennej [mm]
   @property {number} highestTop - najwyższy punkt górnej krawędzi rury [mm]
   @property {boolean} hasNearBottomPipes - czy są rury przy dnie
   @property {boolean} isSettling - czy osadnik (wszystkie rury powyżej dna)
   @property {boolean} needsOTRing - czy wymaga kręgów z otworami
   @property {Array} violations - lista naruszeń
   @property {Array} pipes - przetworzone dane rur [{hcInvert, dnVal, pipeTop, isNearBottom, ...}]
   
   @typedef {Object} CandidateLayout
   @property {number} dennicaId - ID produktu dennicy
   @property {number} dennicaHeight - wysokość dennicy [mm]
   @property {number} bottomSectionH - wysokość sekcji dennej [mm]
   @property {number} clearanceBottom - luz dolny [mm]
   @property {number} clearanceTop - luz górny [mm]
   @property {Array} segments - segmenty konfiguracji
   
   @typedef {Object} ConfigSegment
   @property {Object} itemBase - oryginalny item konfiguracji
   @property {number} start - pozycja startowa [mm]
   @property {number} end - pozycja końcowa [mm]
   @property {number} index - indeks w konfiguracji
   @property {string} type - typ komponentu
   ============================ */

/**
 * Buduje tablicę segmentów z konfiguracji (odwróconej).
 * 
 * WARSTWA 2 (Layout Engine):
 * Używana przez Layout i Solver do dzielenia konfiguracji na segmenty.
 * 
 * @param {Array} configItems - konfiguracja [{productId, quantity}]
 * @param {boolean} psiaBuda - czy jest psia buda
 * @returns {Array<ConfigSegment>} segmenty z start/end
 */
function buildConfigSegmentMap(configItems, psiaBuda) {
    let y = 0;
    let lastWasD = !!psiaBuda;
    if (!configItems) return [];
    return configItems.map((item, idx) => {
        const prod = studnieProducts.find((p) => p.id === item.productId);
        let h = prod ? parseFloat(prod.height) || 0 : 0;
        if (prod && prod.componentType === 'dennica' && lastWasD) {
            h -= 100;
        }
        const seg = {
            itemBase: item,
            start: y,
            end: y + h,
            index: idx,
            type: prod ? prod.componentType : ''
        };
        y += h;
        lastWasD = prod && prod.componentType === 'dennica';
        return seg;
    });
}

/**
 * Filtruje listę produktów na podstawie parametrów studni.
 * 
 * @param {Object} p - produkt z bazy
 * @param {Object} well - aktualnie edytowana studnia
 * @returns {boolean} czy produkt jest dostępny
 */
function filterByWellParams(p, well) {
    if (!well) return true;

    try {
        const id = p.id || '';
        // Strip OT suffix for step checking (both static -OT z cennika and dynamic _OT z solvera)
        let checkId = id;
        if (checkId.endsWith('_OT')) checkId = checkId.slice(0, -3);
        else if (checkId.endsWith('-OT')) checkId = checkId.slice(0, -3);

        // 1. Filtrowanie materiału (Beton / Żelbet)
        // Kręgi
        if (p.componentType === 'krag') {
            const isZelbet = well.nadbudowa === 'zelbetowa';
            // Blokada KDB dla żelbetu i KDZ dla betonu (z wyjątkiem DN2000/2500, które są zawsze żelbetowe)
            if (isZelbet && id.startsWith('KDB') && p.dn !== 2000 && p.dn !== 2500) return false;
            if (!isZelbet && id.startsWith('KDZ') && p.dn !== 2000 && p.dn !== 2500) return false;
        }

        // Kręgi z otworem (krag_ot) - filtrowane beton/żelbet tak samo jak zwykłe kręgi
        if (p.componentType === 'krag_ot') {
            const isZelbet = well.nadbudowa === 'zelbetowa';
            if (isZelbet && id.startsWith('KDB') && p.dn !== 2000 && p.dn !== 2500) return false;
            if (!isZelbet && id.startsWith('KDZ') && p.dn !== 2000 && p.dn !== 2500) return false;
        }

        // Dennice
        if (p.componentType === 'dennica') {
            const isZelbet = well.dennicaMaterial === 'zelbetowa';
            // Dla DN1200 dennice zaczynają się od DDD i są uniwersalne
            // Dla DN2000/2500 też są uniwersalne (wszystko jest żelbetowe w standardzie)
            if (p.dn !== 1200 && p.dn !== 2000 && p.dn !== 2500) {
                if (isZelbet && id.startsWith('DU') && !id.startsWith('DUZ')) return false;
                if (!isZelbet && id.startsWith('DUZ')) return false;
            }
        }

        // 2. Filtrowanie stopni (tylko dla kręgów i konusów)
        // Kręgi z otworem (krag_ot) są zawsze widoczne niezależnie od rodzaju stopni
        if (p.componentType === 'krag' || p.componentType === 'konus') {
            const isNierdzewna = checkId.endsWith('-N-D');
            const isDrabinka = !isNierdzewna && checkId.endsWith('-D');
            const isBrak = checkId.endsWith('-B');
            const hasStepSuffix = isNierdzewna || isDrabinka || isBrak;

            if (well.stopnie === 'brak') {
                // Brak stopni: pokaż tylko warianty -B, odrzuć -D i -N-D
                if (hasStepSuffix && !isBrak) return false;
            } else if (well.stopnie === 'nierdzewna') {
                // Drabinka nierdzewna: pokaż tylko -N-D, odrzuć -D i -B
                if (isBrak || isDrabinka) return false;
                if (!isNierdzewna) return false;
            } else {
                // Drabinka standardowa: pokaż tylko -D, odrzuć -N-D i -B
                if (isBrak || isNierdzewna) return false;
                if (!hasStepSuffix) return false;
            }
        }
        // Kręgi z otworem (krag_ot) są zawsze widoczne niezależnie od rodzaju stopni
        // Rozróżnienie tylko na beton/żelbet (obsługiwane w sekcji 1 powyżej)

        // 3. Płyta redukcyjna - tylko gdy zaznaczona redukcja
        if (p.componentType === 'plyta_redukcyjna' && !well.redukcjaDN1000) {
            return false;
        }

        // 4. Inne elementy (płyty DIN, zamykające, pierścienie odciążające) są uniwersalne
        return true;
    } catch (e) {
        console.error('Błąd w filterByWellParams:', e, p, well);
        return true;
    }
}

function filterSealsByWellType(sealItems, well) {
    if (!well.uszczelka || well.uszczelka === 'brak' || well.uszczelka === 'smar') {
        return [];
    }
    const keyword = well.uszczelka.replace('Uszczelka ', '').toUpperCase();
    return sealItems.filter((p) => {
        const nameUpper = p.name.toUpperCase();
        const idUpper = p.id.toUpperCase();

        if (keyword === 'SDV') {
            return (
                nameUpper.includes('SDV') &&
                !nameUpper.includes('PIERŚCIENIEM') &&
                !nameUpper.includes('PO')
            );
        }
        if (keyword === 'SDV PO') {
            return (
                nameUpper.includes('SDV') &&
                (nameUpper.includes('PIERŚCIENIEM') || nameUpper.includes('PO'))
            );
        }
        if (keyword === 'GSG') {
            return nameUpper.includes('GSG') && !nameUpper.includes('NBR');
        }
        if (keyword === 'NBR') {
            return nameUpper.includes('NBR');
        }
        return nameUpper.includes(keyword) || idUpper.includes(keyword);
    });
}

function getAvailableProducts(well) {
    if (!well || !studnieProducts) return [];
    const mag = well.magazyn || 'Kluczbork';
    const isWl = mag.includes('oc') || mag.includes('Włoc');
    const field = isWl ? 'magazynWL' : 'magazynKLB';

    return studnieProducts.filter((p) => {
        // Luźne porównanie: akceptuje zarówno 1 (number) jak i "1" (string)
        // Produkty bez ustawionego pola magazynu (undefined) również traktujemy jako dostępne
        const val = p[field];
        return val === 1 || val === '1' || val === undefined;
    });
}

function getSortedConfig(config) {
    if (!config) return [];
    return [...config].sort((a, b) => {
        const pA = studnieProducts.find((p) => p.id === a.productId);
        const pB = studnieProducts.find((p) => p.id === b.productId);
        if (!pA || !pB) return 0;

        const order = ['Wlaz', 'Pokrywa', 'Plyta DIN', 'Konus', 'Krąg', 'Dennica'];
        const typeA = pA.componentType;
        const typeB = pB.componentType;

        const idxA = order.findIndex((t) => typeA.toLowerCase().includes(t.toLowerCase()));
        const idxB = order.findIndex((t) => typeB.toLowerCase().includes(t.toLowerCase()));

        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        return 0;
    });
}

/* ===== AKTUALIZACJA KONFIGURACJI PO ZMIANIE PARAMETRÓW ===== */

window.updateConfigToMatchParams = function (well) {
    if (!well || !well.config || well.config.length === 0) return;
    const availProducts = getAvailableProducts(well).filter((p) => filterByWellParams(p, well));
    let anyChanged = false;

    well.config.forEach((item) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        if (!p) return;

        // Upewnij się, że poprawnie obsługujemy dynamicznie generowane kręgi wiercone
        const isDrilled = p.componentType === 'krag_ot' || p.id.endsWith('_OT');

        if (!filterByWellParams(p, well)) {
            // Znajdź zamiennik — użyj String() dla porównania DN (może być number lub string)
            const substitute = availProducts.find(
                (cand) =>
                    cand.componentType === p.componentType &&
                    String(cand.dn) === String(p.dn) &&
                    parseFloat(cand.height) === parseFloat(p.height)
            );
            if (substitute) {
                item.productId = substitute.id;
                anyChanged = true;
            } else if (isDrilled) {
                // Dla dynamicznych kręgów wierconych znajdujemy zamiennik dla kręgu bazowego, a następnie dodajemy _OT
                const baseId = p.id.replace('_OT', '');
                const baseProd = studnieProducts.find((pr) => pr.id === baseId);
                if (baseProd) {
                    const baseSub = availProducts.find(
                        (cand) =>
                            cand.componentType === 'krag' &&
                            String(cand.dn) === String(baseProd.dn) &&
                            parseFloat(cand.height) === parseFloat(baseProd.height)
                    );
                    if (baseSub) {
                        const dynamicOtId = baseSub.id + '_OT';
                        if (!studnieProducts.find((pr) => pr.id === dynamicOtId)) {
                            const dynamicProd = JSON.parse(JSON.stringify(baseSub));
                            dynamicProd.id = dynamicOtId;
                            dynamicProd.componentType = 'krag_ot';
                            if (!dynamicProd.name.endsWith(' z otworem'))
                                dynamicProd.name += ' z otworem';
                            studnieProducts.push(dynamicProd);
                        }
                        item.productId = dynamicOtId;
                        anyChanged = true;
                    }
                }
            }
        }
    });

    if (anyChanged) {
        showToast('Zaktualizowano rodzaje elementów w konfiguracji', 'info');
    }
};

/* ===== AUTOMATYCZNE DODANIE PARY ODCIĄŻAJĄCEJ ===== */
window.ensureReliefRingPair = function (well) {
    if (!well || !well.config) return;

    const hasReliefRing = well.config.some((item) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        return p && p.componentType === 'pierscien_odciazajacy';
    });

    const hasReliefPlate = well.config.some((item) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        return p && (p.componentType === 'plyta_zamykajaca' || p.componentType === 'plyta_najazdowa');
    });

    // Jeśli nie ma żadnego elementu odciążającego, nic nie robimy
    if (!hasReliefRing && !hasReliefPlate) return;

    // Określ docelowe DN dla elementów odciążających
    let targetDn = parseInt(well.dn);
    if (well.dn === 'styczna') {
        targetDn = well.stycznaNadbudowa1200 ? 1200 : 1000;
    } else if (well.redukcjaDN1000) {
        targetDn = well.redukcjaTargetDN || 1000;
    }
    if (isNaN(targetDn)) targetDn = 1000;

    // 1. Jeśli jest pierścień a nie ma płyty -> dodaj płytę
    if (hasReliefRing && !hasReliefPlate) {
        const plate = getAvailableProducts(well).find(
            (p) => (p.componentType === 'plyta_zamykajaca' || p.componentType === 'plyta_najazdowa') && 
                   parseInt(p.dn) === targetDn
        );
        if (plate) {
            well.config.push({ productId: plate.id, quantity: 1, autoAdded: true });
            showToast('Automatycznie dodano płytę do kompletu odciążającego', 'info');
        }
    }

    // 2. Jeśli jest płyta a nie ma pierścienia -> dodaj pierścień
    if (hasReliefPlate && !hasReliefRing) {
        const ring = getAvailableProducts(well).find(
            (p) => p.componentType === 'pierscien_odciazajacy' && 
                   parseInt(p.dn) === targetDn
        );
        if (ring) {
            well.config.push({ productId: ring.id, quantity: 1, autoAdded: true });
            showToast('Automatycznie dodano pierścień odciążający do kompletu', 'info');
        }
    }
};

/* ===== ROZWIĄZYWANIE POPRAWNEGO WARIANTU PRODUKTU ===== */

/**
 * Zwraca poprawny wariant produktu dla bieżących parametrów studni.
 * Jeśli produkt w konfiguracji nie pasuje do aktualnych parametrów (np. KDB zamiast KDZ po zmianie na żelbet),
 * szuka zamiennika w cenniku i opcjonalnie aktualizuje item.productId.
 *
 * @param {Object} well - obiekt studni
 * @param {string} productId - ID produktu z konfiguracji
 * @param {Object} [configItem] - element konfiguracji (jeśli podany, auto-koryguje productId)
 * @returns {Object|null} poprawny produkt
 */
window.resolveEffectiveProduct = function (well, productId, configItem) {
    const p = studnieProducts.find((pr) => pr.id === productId);
    if (!p) return null;

    // Produkt pasuje do parametrów — zwróć bez zmian
    if (filterByWellParams(p, well)) return p;

    // Znajdź poprawny zamiennik
    const availProducts = getAvailableProducts(well).filter((ap) => filterByWellParams(ap, well));
    const isDrilled = p.componentType === 'krag_ot' || p.id.endsWith('_OT');

    // Szukaj bezpośredniego zamiennika (ten sam typ, DN, wysokość)
    const substitute = availProducts.find(
        (cand) =>
            cand.componentType === p.componentType &&
            String(cand.dn) === String(p.dn) &&
            parseFloat(cand.height) === parseFloat(p.height)
    );

    if (substitute) {
        if (configItem) configItem.productId = substitute.id;
        return substitute;
    }

    // Dla kręgów wierconych (_OT) — szukaj zamiennika bazowego kręgu i dodaj _OT
    if (isDrilled) {
        const baseId = p.id.replace('_OT', '');
        const baseProd = studnieProducts.find((pr) => pr.id === baseId);
        if (baseProd) {
            const baseSub = availProducts.find(
                (cand) =>
                    cand.componentType === 'krag' &&
                    String(cand.dn) === String(baseProd.dn) &&
                    parseFloat(cand.height) === parseFloat(baseProd.height)
            );
            if (baseSub) {
                const dynamicOtId = baseSub.id + '_OT';
                let dynamicProd = studnieProducts.find((pr) => pr.id === dynamicOtId);
                if (!dynamicProd) {
                    dynamicProd = JSON.parse(JSON.stringify(baseSub));
                    dynamicProd.id = dynamicOtId;
                    dynamicProd.componentType = 'krag_ot';
                    if (!dynamicProd.name.endsWith(' z otworem'))
                        dynamicProd.name += ' z otworem';
                    studnieProducts.push(dynamicProd);
                }
                if (configItem) configItem.productId = dynamicOtId;
                return dynamicProd;
            }
        }
    }

    // Nie znaleziono zamiennika — zwróć oryginalny
    return p;
};

/* ===== GENERATOR KANDYDATÓW KONFIGURACJI (Layout Engine) ===== */

/**
 * Osadza OT warianty kręgów tam, gdzie przejścia wymagają wiercenia.
 * 
 * WARSTWA 2 (Layout Engine):
 * Zamiast generować kręgi osobno, a później łatać na OT (applyDrilledRings),
 * od razu zwraca layout z odpowiednimi kręgami OT w odpowiednich pozycjach.
 * Używana przez solver wewnątrz pętli solve().
 * 
 * @param {Object} dennicaItem - produkt dennicy (lub obiekt z productId)
 * @param {Array} ringItems - wybrane kręgi z DP [{productId, quantity, _h}]
 * @param {Object} well - obiekt studni
 * @param {Array} availProducts - dostępne produkty
 * @returns {Object} { rings: Array<{productId, quantity}>, needsTallerDennica: boolean }
 */
function buildCandidateLayouts(dennicaItem, ringItems, well, availProducts) {
    const result = { rings: [], needsTallerDennica: false };
    if (!well.przejscia || well.przejscia.length === 0) {
        // Bez przejść: zwróć oryginalne kręgi (quantity zachowane)
        result.rings = (ringItems || []).map(ki => ({
            productId: ki.productId, quantity: ki.quantity || 1
        }));
        return result;
    }

    const rzDna = well.rzednaDna != null ? parseFloat(well.rzednaDna) : 0;
    const denH = dennicaItem && dennicaItem.height
        ? parseFloat(dennicaItem.height) : 0;

    // Zbuduj płaską listę itemów (dennica + kręgi) z pozycjami
    const flatItems = [];
    let y = 0;
    // Dennica
    flatItems.push({
        productId: dennicaItem?.productId || '',
        height: denH,
        start: 0, end: denH,
        origItem: dennicaItem,
        isDennica: true,
        si: 0
    });
    y = denH;
    // Kręgi (rozwiń quantity)
    for (const ki of ringItems || []) {
        const qty = ki.quantity || 1;
        for (let q = 0; q < qty; q++) {
            const h = ki._h || 0;
            flatItems.push({
                productId: ki.productId,
                height: h,
                start: y, end: y + h,
                origItem: ki,
                isDennica: false,
                si: flatItems.length
            });
            y += h;
        }
    }

    // Dla każdego przejścia: sprawdź czy środek otworu jest w kręgu
    const segsToReplace = new Map(); // si → { productId }
    const alreadyNeedsOT = new Set();

    for (const pr of well.przejscia) {
        const pel = parseFloat(pr.rzednaWlaczenia);
        if (isNaN(pel)) continue;
        const mmFromBottom = (pel - rzDna) * 1000;
        const pprod = studnieProducts.find(x => x.id === pr.productId);
        if (!pprod) continue;

        let dnVal = 160;
        if (pprod.dn && typeof pprod.dn === 'string' && pprod.dn.includes('/'))
            dnVal = parseFloat(pprod.dn.split('/')[1]) || 160;
        else if (pprod.dn) dnVal = parseFloat(pprod.dn) || 160;

        const holeCenter = mmFromBottom + dnVal / 2;
        const pipeTop = mmFromBottom + dnVal;

        // Przejście przez połączenie dennica-krąg?
        const crossesJoint = denH > 0 && mmFromBottom < denH && pipeTop > denH;
        if (crossesJoint) {
            result.needsTallerDennica = true;
        }

        // Środek w dennicy → OT niepotrzebny (chyba że rura przechodzi przez złącze)
        if (denH > 0 && holeCenter < denH && !crossesJoint) continue;

        // Znajdź krąg zawierający środek otworu (lub pierwszy krąg gdy rura przechodzi przez złącze)
        for (let si = 1; si < flatItems.length; si++) {
            const fi = flatItems[si];
            if (fi.isDennica) continue;
            if ((holeCenter >= fi.start && holeCenter < fi.end || crossesJoint && si === 1 && holeCenter < fi.start) && !alreadyNeedsOT.has(si)) {
                alreadyNeedsOT.add(si);

                const ringProd = studnieProducts.find(p => p.id === fi.productId);
                if (!ringProd) break;
                // Tylko kręgi mogą być zastąpione OT variantem
                if (ringProd.componentType !== 'krag') break;

                // Znajdź lub utwórz OT variant
                let otProd = availProducts.find(p =>
                    (p.componentType === 'krag_ot' ||
                     String(p.id).toLowerCase().endsWith('ot') ||
                     String(p.name).toLowerCase().includes('wiercony')) &&
                    p.dn === ringProd.dn && p.height === ringProd.height
                );

                if (!otProd) {
                    const dynamicId = ringProd.id + '_OT';
                    otProd = studnieProducts.find(p => p.id === dynamicId);
                    if (!otProd) {
                        otProd = JSON.parse(JSON.stringify(ringProd));
                        otProd.id = dynamicId;
                        otProd.componentType = 'krag_ot';
                        if (!otProd.name.includes('wiercony'))
                            otProd.name += ' wiercony';
                        studnieProducts.push(otProd);
                    }
                }

                // Zastąp productId w flatItems
                fi.productId = otProd.id;
                segsToReplace.set(si, otProd.id);
                break;
            }
        }
    }

    // Zbuduj wynik: płaska lista ring itemów z OT wstawionymi (quantity=1 dla każdego)
    // Używamy płaskiej listy, bo checkConflicts w solverze iteruje po itemach bez uwzględniania quantity
    const flatResult = [];
    for (let si = 1; si < flatItems.length; si++) {
        const fi = flatItems[si];
        if (fi.isDennica) continue;
        flatResult.push({ productId: fi.productId, quantity: 1, _h: fi.height });
    }
    result.rings = flatResult;
    return result;
}

/* ===== SCORING ENGINE (Warstwa 4) ===== */

/**
 * Unifikuje scoring layoutów z obu ścieżek (standardowej i redukcyjnej).
 * 
 * ZASADY (kolejność priorytetów — kara rosnąco):
 *   rings        → 10 × liczba kręgów
 *   diff         → 5 (lub 15 dla redukcji) × |odchyłka|
 *   outOfBounds  → 20000 (lub 50000 dla redukcji)
 *   minimal      → 50000
 *   needsTaller  → 30000
 *   fallbackClos → 100000
 *   bottomSect   → DN/400 × wysokość sekcji (tylko redukcja)
 *   oversizedBtm → 50 × mm nadmiaru (tylko redukcja)
 *   reductions   → 5000000 (gdy redukcja wymagana ale nie użyta)
 * 
 * @param {Object} opts
 * @param {number} opts.ringCount - liczba kręgów
 * @param {number} opts.diff - odchyłka wysokości [mm]
 * @param {boolean} opts.isOutOfBounds - czy odchyłka poza zakresem
 * @param {boolean} opts.isMinimal - czy minimalny zapas
 * @param {boolean} opts.isFallbackClosure - czy zamiennik zakończenia
 * @param {boolean} opts.needsTallerDennica - czy przejście przecina joint
 * @param {boolean} opts.reductionForced - czy redukcja wymagana ale nie użyta
 * @param {boolean} [opts.hasReduction] - czy to ścieżka redukcyjna
 * @param {number} [opts.bottomSectionH] - wysokość sekcji dennej (redukcja)
 * @param {number} [opts.minBottomTotal] - minimalna wysokość sekcji dennej (redukcja)
 * @param {number} [opts.dn] - średnica studni (redukcja)
 * @returns {{ score: number, breakdown: Array<{factor:string,value:number}>, reason: string }}
 */
function scoreLayout(opts = {}) {
    let score = 0;
    const breakdown = [];

    // rings: 10 pkt za krąg
    if (opts.ringCount > 0) {
        const v = opts.ringCount * 10;
        score += v;
        breakdown.push({ factor: 'rings', value: v });
    }

    // diff: kara za odchyłkę
    if (opts.diff !== 0) {
        const mult = opts.hasReduction ? 15 : 5;
        const v = Math.abs(opts.diff) * mult;
        score += v;
        breakdown.push({ factor: 'diff', value: v });
    }

    // outOfBounds: kara za odchyłkę poza tolerancją
    if (opts.isOutOfBounds) {
        const v = opts.hasReduction ? 50000 : 20000;
        score += v;
        breakdown.push({ factor: 'outOfBounds', value: v });
    }

    // minimal: kara za minimalne zapasy
    if (opts.isMinimal) {
        score += 50000;
        breakdown.push({ factor: 'minimal', value: 50000 });
    }

    // otCount: bonus za użycie kręgów wierconych (krag_ot)
    if (opts.otCount > 0) {
        const v = -opts.otCount * 20000;
        score += v;
        breakdown.push({ factor: 'ot_bonus', value: v });
    }

    // fallbackClosure: kara za zamiennik zakończenia
    if (opts.isFallbackClosure) {
        score += 100000;
        breakdown.push({ factor: 'fallbackClosure', value: 100000 });
    }

    // reduction-specific: bottom section height
    if (opts.hasReduction && opts.bottomSectionH > 0) {
        const dnFactor = (parseInt(opts.dn) || 1200) / 400;
        const v = opts.bottomSectionH * dnFactor;
        score += v;
        breakdown.push({ factor: 'bottomSection', value: v });

        if (opts.minBottomTotal > 0 && opts.bottomSectionH > opts.minBottomTotal) {
            const oversized = (opts.bottomSectionH - opts.minBottomTotal) * 50;
            score += oversized;
            breakdown.push({ factor: 'oversizedBottom', value: oversized });
        }
    }

    // reductionForced: ogromna kara gdy redukcja wymagana ale nie użyta
    if (opts.reductionForced) {
        score += 5000000;
        breakdown.push({ factor: 'reductionForced', value: 5000000 });
    }

    // Określ dominujący reason
    let reason = 'ok';
    if (opts.reductionForced) reason = 'reductionForced';
    else if (opts.isFallbackClosure) reason = 'fallbackClosure';
    else if (opts.isMinimal) reason = 'minimal';
    else if (opts.isOutOfBounds) reason = 'outOfBounds';
    else if (opts.diff !== 0) reason = 'diff';

    return { score, breakdown, reason };
}

// Eksportuj do window
window.filterByWellParams = filterByWellParams;
window.getAvailableProducts = getAvailableProducts;
window.getSortedConfig = getSortedConfig;
window.filterSealsByWellType = filterSealsByWellType;
window.buildConfigSegmentMap = buildConfigSegmentMap;
window.buildCandidateLayouts = buildCandidateLayouts;
window.scoreLayout = scoreLayout;
