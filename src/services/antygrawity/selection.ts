/**
 * Antygrawity — Component Selection Functions
 *
 * Database query functions for selecting individual manhole components:
 * dennica, rings, cones, DIN plates, reduction plates, and OT rings.
 */

import prisma from '../../prismaClient';
import { WellComponent } from '../../types';

/**
 * Select bottom plate (dennica) — prioritize standard form, lowest height
 */
export async function selectDennica(
    dn: number,
    magazynField: string,
    formaStdField: string
): Promise<WellComponent | null> {
    const dennice = await (prisma as any).products_studnie_rel.findMany({
        where: {
            componentType: 'dennica',
            dn: dn,
            [magazynField]: 1
        },
        orderBy: [{ [formaStdField]: 'desc' }, { height: 'asc' }]
    });

    return dennice.length > 0 ? dennice[0] : null;
}

/**
 * Select ring by DN — prioritize standard form, tallest first
 */
export async function selectKragByDn(
    dn: number,
    magazynField: string,
    formaStdField: string,
    _targetHeight?: number
): Promise<WellComponent | null> {
    const krags = await (prisma as any).products_studnie_rel.findMany({
        where: {
            componentType: 'krag',
            dn: dn,
            [magazynField]: 1
        },
        orderBy: [{ [formaStdField]: 'desc' }, { height: 'desc' }]
    });

    return krags.length > 0 ? krags[0] : null;
}

/**
 * Select ending component (cone or DIN plate)
 */
export async function selectZakonczenie(
    dn: number,
    type: string,
    magazynField: string,
    formaStdField: string
): Promise<WellComponent | null> {
    const componentType = type === 'plyta_din' ? 'plyta_din' : 'konus';

    const items = await (prisma as any).products_studnie_rel.findMany({
        where: {
            componentType,
            dn: dn,
            [magazynField]: 1
        },
        orderBy: [{ [formaStdField]: 'desc' }]
    });

    return items.length > 0 ? items[0] : null;
}

/**
 * Select reduction plate matching source→target DN transition
 */
export async function selectPlytaRedukcyjna(
    fromDn: number,
    toDn: number,
    magazynField: string,
    formaStdField: string
): Promise<WellComponent | null> {
    const plates = await (prisma as any).products_studnie_rel.findMany({
        where: {
            componentType: 'plyta_redukcyjna',
            dn: fromDn,
            [magazynField]: 1
        },
        orderBy: [{ [formaStdField]: 'desc' }]
    });

    for (const plate of plates) {
        if (plate.name?.includes(`DN${toDn}`) || plate.id?.includes(`${toDn}`)) {
            return plate;
        }
    }

    return plates.length > 0 ? plates[0] : null;
}

/**
 * Select buildup rings to fill remaining height — greedy, tallest-first
 */
export async function selectKragiNadbudowy(
    dn: number,
    totalHeight: number,
    magazynField: string,
    formaStdField: string
): Promise<WellComponent[]> {
    const selected: WellComponent[] = [];
    let remainingHeight = totalHeight;

    const availableRings = await (prisma as any).products_studnie_rel.findMany({
        where: {
            componentType: 'krag',
            dn: dn,
            [magazynField]: 1
        },
        orderBy: [{ [formaStdField]: 'desc' }, { height: 'desc' }]
    });

    if (availableRings.length === 0) {
        return selected;
    }

    while (remainingHeight > 0) {
        const bestFit = findBestFitRing(availableRings, remainingHeight);

        if (!bestFit) {
            break;
        }

        selected.push(bestFit);
        remainingHeight -= bestFit.height || 0;
    }

    return selected;
}

/**
 * Find the tallest ring that fits within remainingHeight
 */
function findBestFitRing(
    availableRings: WellComponent[],
    remainingHeight: number
): WellComponent | null {
    for (const ring of availableRings) {
        if ((ring.height || 0) <= remainingHeight) {
            return ring;
        }
    }
    return null;
}

/**
 * Select drilled ring (OT — otwarty) for passage support
 */
export async function selectKragOt(
    dn: number,
    magazynField: string,
    formaStdField: string
): Promise<WellComponent | null> {
    const otRings = await (prisma as any).products_studnie_rel.findMany({
        where: {
            componentType: 'krag_ot',
            dn: dn,
            [magazynField]: 1
        },
        orderBy: [{ [formaStdField]: 'desc' }]
    });

    return otRings.length > 0 ? otRings[0] : null;
}

/**
 * Get all available components for a given DN and warehouse
 */
export async function getAvailableComponents(
    dn: number,
    magazyn: string = 'WL'
): Promise<WellComponent[]> {
    const magazynField = `magazyn${magazyn}`;
    const formaStdField = `formaStandardowa${magazyn}`;

    const components = await (prisma as any).products_studnie_rel.findMany({
        where: {
            dn: dn,
            [magazynField]: 1
        },
        orderBy: [{ componentType: 'asc' }, { [formaStdField]: 'desc' }, { height: 'desc' }]
    });

    return components;
}
