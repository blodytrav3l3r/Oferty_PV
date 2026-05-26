/**
 * Antygrawity — Funkcje doboru elementów
 *
 * Funkcje zapytań do bazy danych służące do doboru poszczególnych elementów studni:
 * dennic, kręgów, konusów, płyt DIN, płyt redukcyjnych oraz kręgów OT.
 */

import prisma from '../../prismaClient';
import { WellComponent } from '../../types';

/**
 * Dobiera dennicę — priorytet dla formy standardowej, najniższa (najmniejsza wysokość) jako pierwsza
 */
export async function selectDennica(
    dn: number,
    magazynField: string,
    formaStdField: string
): Promise<WellComponent | null> {
    const dennice = await (prisma as unknown as Record<string, { findMany: (args: unknown) => Promise<Array<Record<string, unknown>>> }>)['products_studnie_rel'].findMany({
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
 * Dobiera krąg według DN — priorytet dla formy standardowej, najwyższy jako pierwszy
 */
export async function selectKragByDn(
    dn: number,
    magazynField: string,
    formaStdField: string,
    _targetHeight?: number
): Promise<WellComponent | null> {
    const krags = await (prisma as unknown as Record<string, { findMany: (args: unknown) => Promise<Array<Record<string, unknown>>> }>)['products_studnie_rel'].findMany({
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
 * Dobiera element zakończenia (konus lub płyta DIN)
 */
export async function selectZakonczenie(
    dn: number,
    type: string,
    magazynField: string,
    formaStdField: string
): Promise<WellComponent | null> {
    const componentType = type === 'plyta_din' ? 'plyta_din' : 'konus';

    const items = await (prisma as unknown as Record<string, { findMany: (args: unknown) => Promise<Array<Record<string, unknown>>> }>)['products_studnie_rel'].findMany({
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
 * Dobiera płytę redukcyjną pasującą do przejścia DN źródłowe → docelowe
 */
export async function selectPlytaRedukcyjna(
    fromDn: number,
    toDn: number,
    magazynField: string,
    formaStdField: string
): Promise<WellComponent | null> {
    const plates = await (prisma as unknown as Record<string, { findMany: (args: unknown) => Promise<Array<Record<string, unknown>>> }>)['products_studnie_rel'].findMany({
        where: {
            componentType: 'plyta_redukcyjna',
            dn: fromDn,
            [magazynField]: 1
        },
        orderBy: [{ [formaStdField]: 'desc' }]
    });

    for (const plate of plates) {
        const p = plate as { name?: string; id?: string };
        if (p.name?.includes(`DN${toDn}`) || p.id?.includes(`${toDn}`)) {
            return plate;
        }
    }

    return plates.length > 0 ? plates[0] : null;
}

/**
 * Dobierz kręgi nadbudowy, aby wypełnić pozostałą wysokość — wybiera najwyższe dopasowane elementy (greedy)
 */
export async function selectKragiNadbudowy(
    dn: number,
    totalHeight: number,
    magazynField: string,
    formaStdField: string
): Promise<WellComponent[]> {
    const selected: WellComponent[] = [];
    let remainingHeight = totalHeight;

    const availableRings = await (prisma as unknown as Record<string, { findMany: (args: unknown) => Promise<Array<Record<string, unknown>>> }>)['products_studnie_rel'].findMany({
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
 * Znajduje najwyższy krąg, który mieści się w pozostałej wysokości (remainingHeight)
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
 * Dobierz krąg wiercony (OT — otwarty) dla obsługi przejść szczelnych
 */
export async function selectKragOt(
    dn: number,
    magazynField: string,
    formaStdField: string
): Promise<WellComponent | null> {
    const otRings = await (prisma as unknown as Record<string, { findMany: (args: unknown) => Promise<Array<Record<string, unknown>>> }>)['products_studnie_rel'].findMany({
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
 * Pobierz wszystkie dostępne elementy dla danego DN i magazynu
 */
export async function getAvailableComponents(
    dn: number,
    magazyn: string = 'WL'
): Promise<WellComponent[]> {
    const magazynField = `magazyn${magazyn}`;
    const formaStdField = `formaStandardowa${magazyn}`;

    const components = await (prisma as unknown as Record<string, { findMany: (args: unknown) => Promise<Array<Record<string, unknown>>> }>)['products_studnie_rel'].findMany({
        where: {
            dn: dn,
            [magazynField]: 1
        },
        orderBy: [{ componentType: 'asc' }, { [formaStdField]: 'desc' }, { height: 'desc' }]
    });

    return components;
}
