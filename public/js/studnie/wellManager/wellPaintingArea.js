/* ===== OBLICZANIE POWIERZCHNI MALOWANIA KINETY ===== */

/**
 * Zbiera geometrię rur z przejść studni.
 * @param {Object} well - obiekt studni
 * @returns {Array<{dnMm: number, angle: number}>}
 */
function collectPipeGeometry(well) {
    if (!well.przejscia || well.przejscia.length === 0) return [];

    return well.przejscia
        .map((pr) => {
            const prod = studnieProducts.find((p) => p.id === pr.productId);
            let dnMm = parseInt(pr.dn) || 0;
            if (!dnMm && prod) dnMm = parseInt(prod.dn) || 0;
            if (dnMm <= 0) return null;

            return {
                dnMm,
                angle: parseFloat(pr.angle) || 0
            };
        })
        .filter(Boolean);
}

/**
 * Konwertuje string spocznikH ('1/2', '2/3', '3/4', '1/1') na ułamek.
 * @param {string} spocznikH
 * @returns {number}
 */
function parseSpocznikFraction(spocznikH) {
    const fractions = { '1/2': 0.5, '2/3': 0.667, '3/4': 0.75, '1/1': 1.0 };
    return fractions[spocznikH] || 0.5;
}

/**
 * Identyfikuje kinetę główną (wylot + przelot) i dopływy.
 * Reużywa algorytm z calcPrecoPricing:
 * - Główna = max DN, potem najbliżej kąta 0°
 * - Przelot = max DN z reszty, potem najbliżej 180°
 * - Pozostałe = dopływy
 *
 * @param {Array} pipes - wynik collectPipeGeometry()
 * @returns {{ mainPair: Array, tributaries: Array }}
 */
function identifyMainChannelAndTributaries(pipes) {
    if (pipes.length === 0) return { mainPair: [], tributaries: [] };
    if (pipes.length === 1) return { mainPair: [pipes[0]], tributaries: [] };

    const candidates = [...pipes];

    // GŁÓWNA (WYLOT): max DN, potem najbliżej kąta 0°
    const getZeroScore = (kat) => Math.min(Math.abs(kat), Math.abs(kat - 360));
    candidates.sort((a, b) => {
        if (b.dnMm !== a.dnMm) return b.dnMm - a.dnMm;
        return getZeroScore(a.angle) - getZeroScore(b.angle);
    });
    const glowne = candidates.shift();

    // PRZELOT: max DN z reszty, potem najbliżej 180°
    const get180Score = (kat) => Math.abs(kat - 180);
    candidates.sort((a, b) => {
        if (b.dnMm !== a.dnMm) return b.dnMm - a.dnMm;
        return get180Score(a.angle) - get180Score(b.angle);
    });
    const przelot = candidates.shift();

    return {
        mainPair: [glowne, przelot],
        tributaries: candidates
    };
}

/**
 * Oblicza powierzchnię malowania standardowej kinety [m²].
 * Składniki: korytka kanałów + spocznik płaski + ścianka pionowa spocznika.
 *
 * @param {Object} well - obiekt studni
 * @param {number} R - promień studni [m]
 * @returns {number} powierzchnia [m²]
 */
function calcStandardKinetaPaintingArea(well, R) {
    const pipes = collectPipeGeometry(well);

    // Brak przejść → dno + ścianki dennicy (cylinder)
    if (pipes.length === 0) {
        let dennicaH = 0;
        if (well.config) {
            well.config.forEach((item) => {
                const pr = studnieProducts.find((x) => x.id === item.productId);
                if (pr && (pr.componentType === 'dennica' || pr.componentType === 'styczna')) {
                    dennicaH = Math.max(dennicaH, pr.height || 0);
                }
            });
        }
        const H = dennicaH / 1000; // [m]
        const floorArea = Math.PI * R * R;
        const wallArea = 2 * Math.PI * R * H;
        return floorArea + wallArea;
    }

    const spocznikFrac = parseSpocznikFraction(well.spocznikH);
    const { mainPair, tributaries } = identifyMainChannelAndTributaries(pipes);

    // Największa rura wyznacza głębokość koryta
    const maxPipeDn = Math.max(...pipes.map((p) => p.dnMm));
    const channelDepth = maxPipeDn / 2 / 1000; // [m]
    const spocznikHeight = channelDepth * spocznikFrac; // wys. ścianki nad kanałem [m]

    let channelArea = 0;
    let channelFootprint = 0;

    // Kanał główny — przebiega przez całą studnię (2R)
    const mainR = (mainPair[0] ? mainPair[0].dnMm : 0) / 2000;
    if (mainPair.length >= 2 && mainPair[1]) {
        // Para: kanał ciągły, użyj większego promienia
        const przelotR = mainPair[1].dnMm / 2000;
        const bigR = Math.max(mainR, przelotR);
        const channelLen = 2 * R;
        channelArea += Math.PI * bigR * channelLen;
        channelFootprint += 2 * bigR * channelLen;
    } else if (mainPair[0]) {
        // Pojedyncza rura — kanał od ściany do osi
        const channelLen = R;
        channelArea += Math.PI * mainR * channelLen;
        channelFootprint += 2 * mainR * channelLen;
    }

    // Dopływy — od ściany do kanału głównego (≈ R)
    tributaries.forEach((trib) => {
        const r = trib.dnMm / 2000;
        const channelLen = R;
        channelArea += Math.PI * r * channelLen;
        channelFootprint += 2 * r * channelLen;
    });

    // Spocznik płaski (dno koła minus rzuty korytek)
    const totalFloor = Math.PI * R * R;
    const spocznikFlat = Math.max(0, totalFloor - channelFootprint);

    // Ścianka pionowa spocznika
    const totalPipeWidth = pipes.reduce((sum, p) => sum + p.dnMm / 1000, 0);
    const wallPerimeter = Math.max(0, 2 * Math.PI * R - totalPipeWidth);
    const wallArea = wallPerimeter * spocznikHeight;

    return channelArea + spocznikFlat + wallArea;
}

/**
 * Oblicza powierzchnię malowania osadnika [m²].
 * Składniki: dno płaskie + ścianki cylindryczne - otwory rur.
 *
 * @param {Object} well - obiekt studni
 * @param {number} R - promień studni [m]
 * @returns {number} powierzchnia [m²]
 */
function calcOsadnikPaintingArea(well, R) {
    const heightMm = parseFloat(well.wkladkaOsadnikH) || 0;
    if (heightMm <= 0) return Math.PI * R * R;

    const H = heightMm / 1000; // [m]
    const floorArea = Math.PI * R * R;
    const wallArea = 2 * Math.PI * R * H;

    // Odjęcie otworów rur (pół-elipsy w ściance)
    const pipes = collectPipeGeometry(well);
    let holeArea = 0;
    pipes.forEach((pipe) => {
        const r = pipe.dnMm / 2000;
        holeArea += (Math.PI * r * r) / 2;
    });

    return floorArea + Math.max(0, wallArea - holeArea);
}

/**
 * Oblicza rzeczywistą powierzchnię wewnętrzną kinety do malowania [m²].
 * Uwzględnia: DN studni, przejścia (DN, kąty), wysokość spocznika, typ osadnikowy.
 *
 * @param {Object} well - obiekt studni
 * @returns {number} powierzchnia [m²]
 */
function calcKinetaPaintingArea(well) {
    const dnStudni = parseInt(well.dn);
    if (!dnStudni || isNaN(dnStudni)) return 0;

    const R = dnStudni / 2000; // promień studni [m]

    if (well.wkladkaOsadnikPreco === 'tak') {
        return calcOsadnikPaintingArea(well, R);
    }

    return calcStandardKinetaPaintingArea(well, R);
}
