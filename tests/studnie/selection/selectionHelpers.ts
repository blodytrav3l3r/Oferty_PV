export interface MockProduct {
    id: string;
    name: string;
    componentType: string;
    dn: number | string | null;
    height: number;
    formaStandardowaKLB?: number;
    formaStandardowa?: number;
    magazynKLB?: number;
    magazynWL?: number;
    zapasDol?: number;
    zapasGora?: number;
    zapasDolMin?: number;
    zapasGoraMin?: number;
    [key: string]: unknown;
}

export function getFormaField(warehouse: string): string {
    return (warehouse || '').includes('oc') || (warehouse || '').includes('Włoc')
        ? 'formaStandardowa'
        : 'formaStandardowaKLB';
}

export function getTopClosure(
    products: MockProduct[],
    topDn: number | string,
    forcedId: string | null,
    fallbackToDin: boolean,
    warehouse: string
): MockProduct | null {
    const ff = getFormaField(warehouse);
    const dn = parseInt(String(topDn));
    const blockKonus = fallbackToDin;

    if (forcedId) {
        const forced = products.find((p) => p.id === forcedId);
        if (forced && (parseInt(String(forced.dn)) === dn || forced.dn === null)) {
            // Konus z wkładką PEHD zabroniony — nawet wymuszony
            if (blockKonus && forced.componentType === 'konus') return null;
            return forced;
        }
    }

    const konusy = blockKonus
        ? []
        : products
              .filter((p) => p.componentType === 'konus' && parseInt(String(p.dn)) === dn)
              .sort((a, b) => (parseInt(String(b[ff])) || 0) - (parseInt(String(a[ff])) || 0));

    const dinPlates = products
        .filter((p) => p.componentType === 'plyta_din' && parseInt(String(p.dn)) === dn)
        .sort((a, b) => (parseInt(String(b[ff])) || 0) - (parseInt(String(a[ff])) || 0));

    if (fallbackToDin) {
        if (dinPlates.length > 0) return dinPlates[0];
        if (konusy.length > 0) return konusy[0];
        return null;
    }

    if (konusy.length > 0) return konusy[0];
    if (dinPlates.length > 0) return dinPlates[0];
    return null;
}

export function getReductionPlate(
    products: MockProduct[],
    dn: number | string,
    useReduction: boolean,
    targetDn = 1000
): MockProduct | null {
    if (!useReduction || parseInt(String(dn)) <= 1000) return null;

    const plates = products.filter((p) => {
        if (p.componentType !== 'plyta_redukcyjna') return false;
        if (parseInt(String(p.dn)) !== parseInt(String(dn))) return false;
        const nameUpper = (p.name || '').toUpperCase();
        return (
            nameUpper.includes('/' + targetDn) ||
            nameUpper.includes(' DN' + targetDn) ||
            nameUpper.includes('X' + targetDn) ||
            nameUpper.includes(' NA ' + targetDn) ||
            nameUpper.includes('→DN' + targetDn) ||
            nameUpper.includes('→' + targetDn) ||
            nameUpper.includes('->DN' + targetDn) ||
            nameUpper.includes('->' + targetDn)
        );
    });
    return plates.length > 0 ? plates[0] : null;
}

export function filterByWellParams(
    p: MockProduct,
    well: {
        nadbudowa?: string;
        dennicaMaterial?: string;
        stopnie?: string;
        redukcjaDN1000?: boolean;
    }
): boolean {
    if (!well) return true;
    const id = p.id || '';
    let checkId = id;
    if (checkId.endsWith('_OT')) checkId = checkId.slice(0, -3);
    else if (checkId.endsWith('-OT')) checkId = checkId.slice(0, -3);

    // Kregi
    if (p.componentType === 'krag') {
        const isZelbet = well.nadbudowa === 'zelbetowa';
        if (isZelbet && id.startsWith('KDB') && p.dn !== 2000 && p.dn !== 2500) return false;
        if (!isZelbet && id.startsWith('KDZ') && p.dn !== 2000 && p.dn !== 2500) return false;
    }

    // Kregi OT
    if (p.componentType === 'krag_ot') {
        const isZelbet = well.nadbudowa === 'zelbetowa';
        if (isZelbet && id.startsWith('KDB') && p.dn !== 2000 && p.dn !== 2500) return false;
        if (!isZelbet && id.startsWith('KDZ') && p.dn !== 2000 && p.dn !== 2500) return false;
    }

    // Stopnie (tylko kręg i konus)
    if (p.componentType === 'krag' || p.componentType === 'konus') {
        const isNierdzewna = checkId.endsWith('-N-D');
        const isDrabinka = !isNierdzewna && checkId.endsWith('-D');
        const isBrak = checkId.endsWith('-B');
        const hasStepSuffix = isNierdzewna || isDrabinka || isBrak;

        if (well.stopnie === 'brak') {
            if (hasStepSuffix && !isBrak) return false;
        } else if (well.stopnie === 'nierdzewna') {
            if (isBrak || isDrabinka) return false;
            if (!isNierdzewna) return false;
        } else {
            if (isBrak || isNierdzewna) return false;
            if (!hasStepSuffix) return false;
        }
    }

    // Plyta redukcyjna
    if (p.componentType === 'plyta_redukcyjna' && !well.redukcjaDN1000) return false;

    return true;
}
