// @ts-check
/* ===== POLA POWERZCHNI MALOWANIA / PEHD — pure helpers ===== */

// ponytail: 4/π waste factor for plate elements cut as squares from PEHD sheet
const PLATE_COMPONENT_TYPES = new Set([
    'plyta',
    'plyta_din',
    'plyta_najazdowa',
    'plyta_zamykajaca',
    'plyta_redukcyjna',
    'plyta_nastudzienna'
]);

function getPehdEffectiveArea(p) {
    if (p.area == null || p.area <= 0) return 0;
    if (PLATE_COMPONENT_TYPES.has(p.componentType)) return p.area * (4 / Math.PI);
    if (p.componentType === 'dennica' || p.componentType === 'styczna') {
        let dn = parseInt(p.dn) || 0;
        if (dn > 0) {
            let bottomArea = Math.PI * Math.pow(dn / 2000, 2);
            let wallArea = p.area - bottomArea;
            if (wallArea > 0) return wallArea + bottomArea * (4 / Math.PI);
        }
    }
    return p.area;
}

function getPehdTooltip(p, pricePerM2) {
    if (p.area <= 0 || p.componentType === 'przejscie' || p.componentType === 'kineta') return '';
    if (PLATE_COMPONENT_TYPES.has(p.componentType)) {
        let sqArea = (p.area * 4) / Math.PI;
        return (
            'Pow. koła: ' +
            p.area.toFixed(2) +
            ' m²' +
            ' | Wykrój kwadrat: ' +
            sqArea.toFixed(2) +
            ' m²' +
            ' | Wsp. odpadu: ×' +
            (4 / Math.PI).toFixed(3) +
            ' | Cena: ' +
            pricePerM2 +
            ' PLN/m²' +
            ' | Dopłata: ' +
            Math.round(getPehdEffectiveArea(p) * pricePerM2) +
            ' PLN'
        );
    }
    if (p.componentType === 'dennica' || p.componentType === 'styczna') {
        let d2 = parseInt(p.dn) || 0;
        if (d2 > 0) {
            let bArea = Math.PI * Math.pow(d2 / 2000, 2);
            return (
                'Dno (koło): ' +
                bArea.toFixed(2) +
                ' m² × ' +
                pricePerM2 +
                ' = ' +
                Math.round(bArea * (4 / Math.PI) * pricePerM2) +
                ' PLN' +
                ' | Ściany: ' +
                (p.area - bArea).toFixed(2) +
                ' m² × ' +
                pricePerM2 +
                ' = ' +
                Math.round((p.area - bArea) * pricePerM2) +
                ' PLN' +
                ' | Razem: ' +
                Math.round(getPehdEffectiveArea(p) * pricePerM2) +
                ' PLN'
            );
        }
    }
    return (
        'Pow. koła: ' +
        p.area.toFixed(2) +
        ' m² | Cena: ' +
        pricePerM2 +
        ' PLN/m² | Dopłata: ' +
        Math.round(getPehdEffectiveArea(p) * pricePerM2) +
        ' PLN'
    );
}

function isSettlingWell(well) {
    if (!well || !well.przejscia || well.przejscia.length === 0) return false;
    const rzDna = parseFloat(well.rzednaDna) || 0;
    for (const p of well.przejscia) {
        const rzWl = parseFloat(p.rzednaWlaczenia) || rzDna;
        const diff = (rzWl - rzDna) * 1000;
        if (diff <= 1) return false;
    }
    return true;
}

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

function parseSpocznikFraction(spocznikH) {
    const fractions = { '1/2': 0.5, '2/3': 0.667, '3/4': 0.75, '1/1': 1.0 };
    return fractions[spocznikH] || 0.5;
}

function identifyMainChannelAndTributaries(pipes) {
    if (pipes.length === 0) return { mainPair: [], tributaries: [] };
    if (pipes.length === 1) return { mainPair: [pipes[0]], tributaries: [] };

    const candidates = [...pipes];

    const getZeroScore = (kat) => Math.min(Math.abs(kat), Math.abs(kat - 360));
    candidates.sort((a, b) => {
        if (b.dnMm !== a.dnMm) return b.dnMm - a.dnMm;
        return getZeroScore(a.angle) - getZeroScore(b.angle);
    });
    const glowne = candidates.shift();

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

function calcStandardKinetaPaintingArea(well, R) {
    const pipes = collectPipeGeometry(well);

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
        const H = dennicaH / 1000;
        const floorArea = Math.PI * R * R;
        const wallArea = 2 * Math.PI * R * H;
        return floorArea + wallArea;
    }

    const spocznikFrac = parseSpocznikFraction(well.spocznikH);
    const { mainPair, tributaries } = identifyMainChannelAndTributaries(pipes);

    const maxPipeDn = Math.max(...pipes.map((p) => p.dnMm));
    const channelDepth = maxPipeDn / 2 / 1000;
    const spocznikHeight = channelDepth * spocznikFrac;

    let channelArea = 0;
    let channelFootprint = 0;

    const mainR = (mainPair[0] ? mainPair[0].dnMm : 0) / 2000;
    if (mainPair.length >= 2 && mainPair[1]) {
        const przelotR = mainPair[1].dnMm / 2000;
        const bigR = Math.max(mainR, przelotR);
        const channelLen = 2 * R;
        channelArea += Math.PI * bigR * channelLen;
        channelFootprint += 2 * bigR * channelLen;
    } else if (mainPair[0]) {
        const channelLen = R;
        channelArea += Math.PI * mainR * channelLen;
        channelFootprint += 2 * mainR * channelLen;
    }

    tributaries.forEach((trib) => {
        const r = trib.dnMm / 2000;
        const channelLen = R;
        channelArea += Math.PI * r * channelLen;
        channelFootprint += 2 * r * channelLen;
    });

    const totalFloor = Math.PI * R * R;
    const spocznikFlat = Math.max(0, totalFloor - channelFootprint);

    const totalPipeWidth = pipes.reduce((sum, p) => sum + p.dnMm / 1000, 0);
    const wallPerimeter = Math.max(0, 2 * Math.PI * R - totalPipeWidth);
    const wallArea = wallPerimeter * spocznikHeight;

    return channelArea + spocznikFlat + wallArea;
}

function calcOsadnikPaintingArea(well, R) {
    const heightMm = parseFloat(well.wkladkaOsadnikH) || 0;
    if (heightMm <= 0) return Math.PI * R * R;

    const H = heightMm / 1000;
    const floorArea = Math.PI * R * R;
    const wallArea = 2 * Math.PI * R * H;

    const pipes = collectPipeGeometry(well);
    let holeArea = 0;
    pipes.forEach((pipe) => {
        const r = pipe.dnMm / 2000;
        holeArea += (Math.PI * r * r) / 2;
    });

    return floorArea + Math.max(0, wallArea - holeArea);
}

function calcKinetaPaintingArea(well) {
    const dnStudni = parseInt(well.dn);
    if (!dnStudni || isNaN(dnStudni)) return 0;

    const R = dnStudni / 2000;

    if (well.wkladkaOsadnikPreco === 'tak') {
        return calcOsadnikPaintingArea(well, R);
    }

    return calcStandardKinetaPaintingArea(well, R);
}
