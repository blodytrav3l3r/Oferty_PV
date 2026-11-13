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
        // styczna bez korka = rura na bok bez dna — brak wykroju kwadratowego
        if (p.componentType === 'styczna' && !p.id.includes('KOREK')) return p.area;
        const dn = parseInt(p.dn) || 0;
        if (dn > 0) {
            const bottomArea = Math.PI * Math.pow(dn / 2000, 2);
            const wallArea = p.area - bottomArea;
            if (wallArea > 0) return wallArea + bottomArea * (4 / Math.PI);
        }
    }
    return p.area;
}

function getPehdTooltip(p, pricePerM2) {
    if (
        p.area <= 0 ||
        p.componentType === 'przejscie' ||
        p.componentType === 'kineta' ||
        p.componentType === 'konus'
    )
        return '';
    if (PLATE_COMPONENT_TYPES.has(p.componentType)) {
        const sqArea = (p.area * 4) / Math.PI;
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
            fmt(roundMoney(pricePerM2)) +
            ' PLN/m²' +
            ' | Dopłata: ' +
            fmt(roundMoney(getPehdEffectiveArea(p) * pricePerM2)) +
            ' PLN'
        );
    }
    if (p.componentType === 'dennica' || p.componentType === 'styczna') {
        const d2 = parseInt(p.dn) || 0;
        if (p.componentType === 'styczna' && !p.id.includes('KOREK')) {
            return (
                'Ściany (bez dna): ' +
                p.area.toFixed(2) +
                ' m² | Cena: ' +
                fmt(roundMoney(pricePerM2)) +
                ' PLN/m² | Dopłata: ' +
                fmt(roundMoney(getPehdEffectiveArea(p) * pricePerM2)) +
                ' PLN'
            );
        }
        if (d2 > 0) {
            const bArea = Math.PI * Math.pow(d2 / 2000, 2);
            const sqDno = (bArea * 4) / Math.PI;
            const dnoLabel = p.componentType === 'styczna' ? 'Korek' : 'Dno';
            return (
                dnoLabel +
                ' (koło): ' +
                bArea.toFixed(2) +
                ' m²' +
                ' | Wykrój kwadrat (' +
                dnoLabel.toLowerCase() +
                '): ' +
                sqDno.toFixed(2) +
                ' m² (×' +
                (4 / Math.PI).toFixed(3) +
                ')' +
                ' | ' +
                dnoLabel +
                ': ' +
                fmt(roundMoney(sqDno * pricePerM2)) +
                ' PLN' +
                ' | Ściany: ' +
                (p.area - bArea).toFixed(2) +
                ' m² × ' +
                fmt(roundMoney(pricePerM2)) +
                ' = ' +
                fmt(roundMoney((p.area - bArea) * pricePerM2)) +
                ' PLN' +
                ' | Razem: ' +
                fmt(roundMoney(getPehdEffectiveArea(p) * pricePerM2)) +
                ' PLN'
            );
        }
    }
    return (
        'Pow. koła: ' +
        p.area.toFixed(2) +
        ' m² | Cena: ' +
        fmt(roundMoney(pricePerM2)) +
        ' PLN/m² | Dopłata: ' +
        fmt(roundMoney(getPehdEffectiveArea(p) * pricePerM2)) +
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
            const prod =
                typeof getStudnieProductById === 'function'
                    ? getStudnieProductById(pr.productId)
                    : studnieProducts.find((p) => p.id === pr.productId);
            let dnMm = parseInt(pr.dn) || 0;
            if (!dnMm && prod) dnMm = parseInt(prod.dn) || 0;
            if (dnMm <= 0) return null;

            return { dnMm };
        })
        .filter(Boolean);
}

function parseSpocznikFraction(spocznikH) {
    if (spocznikH === 'brak') return 0;
    const fractions = { '1/1': 1, '1/2': 1 / 2, '2/4': 1 / 2, '2/3': 2 / 3, '3/4': 3 / 4 };
    return fractions[spocznikH] || fractions['1/2'];
}

function getSpocznikHeight(well) {
    if (well.spocznikH === 'brak') return 0;
    const pipes = collectPipeGeometry(well);
    if (pipes.length === 0) return 0;
    const maxPipeDn = Math.max(...pipes.map((p) => p.dnMm));
    return (maxPipeDn / 1000) * parseSpocznikFraction(well.spocznikH) || 0;
}

function hasKinetaItem(well) {
    if (!well || !well.config) return false;
    return well.config.some((item) => {
        const pr =
            typeof getStudnieProductById === 'function'
                ? getStudnieProductById(item.productId)
                : studnieProducts.find((x) => x.id === item.productId);
        return pr && pr.componentType === 'kineta';
    });
}

function calcDennicaWallsArea(well, p) {
    if (!p || p.componentType !== 'dennica') return 0;
    const dnStudni = parseInt(well && well.dn);
    if (!dnStudni || isNaN(dnStudni)) return 0;
    const R = dnStudni / 2000;
    const H = (p.height || 0) / 1000;
    if (H <= 0) return 0;
    let hPainted;
    if (well.wkladkaOsadnikPreco === 'tak') {
        hPainted = (parseFloat(well.wkladkaOsadnikH) || 0) / 1000;
    } else {
        const pipes = collectPipeGeometry(well);
        if (pipes.length === 0) return 0;
        hPainted = getSpocznikHeight(well);
    }
    return Math.max(0, 2 * Math.PI * R * (H - hPainted));
}

function calcStandardKinetaPaintingArea(well, R, includeDetails = false) {
    const pipes = [...collectPipeGeometry(well)].sort((a, b) => a.dnMm - b.dnMm);

    if (pipes.length === 0) {
        let dennicaH = 0;
        if (well.config) {
            well.config.forEach((item) => {
                const pr =
                    typeof getStudnieProductById === 'function'
                        ? getStudnieProductById(item.productId)
                        : studnieProducts.find((x) => x.id === item.productId);
                if (pr && (pr.componentType === 'dennica' || pr.componentType === 'styczna')) {
                    dennicaH = Math.max(dennicaH, pr.height || 0);
                }
            });
        }
        const H = dennicaH / 1000;
        const floorArea = Math.PI * R * R;
        const wallArea = 2 * Math.PI * R * H;
        const paintingAreaM2 = floorArea + wallArea;
        return includeDetails
            ? { paintingAreaM2, concreteVolumeM3: null, estimatedWeightKg: null }
            : paintingAreaM2;
    }

    const noEstimate = (paintingAreaM2) => ({
        paintingAreaM2,
        concreteVolumeM3: null,
        estimatedWeightKg: null
    });

    const fraction = parseSpocznikFraction(well.spocznikH);
    const maxPipeDnMm = Math.max(...pipes.map((pipe) => pipe.dnMm));
    const hubDiameterM = maxPipeDnMm / 1000;
    const hubRadiusM = hubDiameterM / 2;
    const branchLengthM = Math.max(0, R - hubRadiusM);
    const getProfile = (dnMm) => {
        const diameterM = dnMm / 1000;
        const radiusM = diameterM / 2;
        const heightM = diameterM * fraction;
        const straightWallM = Math.max(0, heightM - radiusM);
        return {
            diameterM,
            heightM,
            crossSectionM2: (Math.PI * radiusM * radiusM) / 2 + diameterM * straightWallM,
            innerSurfacePerMeterM2: Math.PI * radiusM + 2 * straightWallM
        };
    };
    const profiles = pipes.map((pipe) => getProfile(pipe.dnMm));
    const hubProfile = getProfile(maxPipeDnMm);
    const floorAreaM2 = Math.PI * R * R;
    const hubFootprintM2 = Math.PI * hubRadiusM * hubRadiusM;
    const branchFootprintM2 = profiles.reduce(
        (sum, profile) => sum + profile.diameterM * branchLengthM,
        0
    );
    const flatFloorAreaM2 = Math.max(0, floorAreaM2 - hubFootprintM2 - branchFootprintM2);
    // Orientacyjna aproksymacja: wspólny węzeł ma długość równą DNmax, a ramiona
    // poza nim są traktowane jako rozłączne, niezależnie od kątów przejść.
    const hubChannelSurfaceM2 = hubProfile.innerSurfacePerMeterM2 * hubDiameterM;
    const branchChannelSurfaceM2 = profiles.reduce(
        (sum, profile) => sum + profile.innerSurfacePerMeterM2 * branchLengthM,
        0
    );
    const maxHeightM = hubProfile.heightM;
    const totalPipeWidthM = profiles.reduce((sum, profile) => sum + profile.diameterM, 0);
    const wallPerimeterM = Math.max(0, 2 * Math.PI * R - totalPipeWidthM);
    const wallSurfaceM2 = wallPerimeterM * maxHeightM;
    const paintingAreaM2 =
        hubChannelSurfaceM2 + branchChannelSurfaceM2 + flatFloorAreaM2 + wallSurfaceM2;

    const grossConcreteVolumeM3 = floorAreaM2 * maxHeightM;
    const hubVoidVolumeM3 = hubProfile.crossSectionM2 * hubDiameterM;
    const branchVoidVolumeM3 = profiles.reduce(
        (sum, profile) => sum + profile.crossSectionM2 * branchLengthM,
        0
    );
    const concreteVolumeM3 = grossConcreteVolumeM3 - hubVoidVolumeM3 - branchVoidVolumeM3;
    if (
        !Number.isFinite(paintingAreaM2) ||
        !Number.isFinite(concreteVolumeM3) ||
        concreteVolumeM3 <= 0
    ) {
        const result = noEstimate(Number.isFinite(paintingAreaM2) ? paintingAreaM2 : 0);
        return includeDetails ? result : result.paintingAreaM2;
    }

    const result = {
        paintingAreaM2,
        concreteVolumeM3,
        estimatedWeightKg: concreteVolumeM3 * 2500
    };
    return includeDetails ? result : result.paintingAreaM2;
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

function calcKinetaPaintingArea(well, options = {}) {
    const includeDetails = options && options.details === true;
    const dnStudni = parseInt(well.dn);
    if (!dnStudni || isNaN(dnStudni)) {
        return includeDetails
            ? { paintingAreaM2: 0, concreteVolumeM3: null, estimatedWeightKg: null }
            : 0;
    }

    const R = dnStudni / 2000;

    if (well.wkladkaOsadnikPreco === 'tak') {
        const paintingAreaM2 = calcOsadnikPaintingArea(well, R);
        return includeDetails
            ? { paintingAreaM2, concreteVolumeM3: null, estimatedWeightKg: null }
            : paintingAreaM2;
    }

    return calcStandardKinetaPaintingArea(well, R, includeDetails);
}

function getPehdTypeForComponent(well, componentType) {
    if (['dennica', 'styczna'].includes(componentType)) return well.wkladkaDennica;
    if (
        [
            'plyta',
            'plyta_redukcyjna',
            'plyta_nastudzienna',
            'stozek',
            'zwienczenie',
            'plyta_din',
            'plyta_najazdowa',
            'plyta_zamykajaca',
            'pierscien_odciazajacy'
        ].includes(componentType)
    )
        return well.wkladkaZwienczenie;
    if (['krag', 'krag_ot', 'rura'].includes(componentType)) return well.wkladkaNadbudowa;
    // konus i pozostałe: brak PEHD (konus z wkładką jest zabroniony)
    return null;
}

function getPehdSurcharge(well, p, applyDiscount, item) {
    const pehdType = getPehdTypeForComponent(well, p.componentType);
    if (!pehdType || pehdType === 'brak' || !p.doplataPEHD) return 0;
    if (item && item.disablePehd) return 0;
    const raw = parseFloat(String(p.doplataPEHD).replace(',', '.'));
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    let v = raw;
    if (applyDiscount && well.pehdDiscount) v *= 1 - well.pehdDiscount / 100;
    return v;
}

window.getPehdTypeForComponent = getPehdTypeForComponent;
window.getPehdSurcharge = getPehdSurcharge;

/* ===== Rejestracja globali ===== */
window.getPehdTooltip = getPehdTooltip;
window.isSettlingWell = isSettlingWell;
window.calcKinetaPaintingArea = calcKinetaPaintingArea;
window.calcDennicaWallsArea = calcDennicaWallsArea;
window.hasKinetaItem = hasKinetaItem;
