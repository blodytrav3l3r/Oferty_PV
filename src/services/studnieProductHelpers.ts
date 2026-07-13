import type { ProductsStudnie } from '../../generated/prisma';

export const ALLOWED_FIELDS = [
    'name',
    'category',
    'componentType',
    'dn',
    'height',
    'weight',
    'price',
    'area',
    'areaExt',
    'transport',
    'magazynWL',
    'magazynKLB',
    'formaStandardowa',
    'formaStandardowaKLB',
    'active',
    'zapasDol',
    'zapasGora',
    'zapasDolMin',
    'zapasGoraMin',
    'spocznikH',
    'hMin1',
    'hMax1',
    'cena1',
    'hMin2',
    'hMax2',
    'cena2',
    'hMin3',
    'hMax3',
    'cena3',
    'doplataPEHD',
    'doplataZelbet',
    'doplataDrabNierdzewna',
    'malowanieWewnetrzne',
    'malowanieZewnetrzne'
] as const;

type StudnieProductRaw = ProductsStudnie;

export interface StudnieProductLegacy {
    id: string;
    name: string;
    category: string;
    componentType: string;
    dn: number | string | null;
    height: number | null;
    weight: number | null;
    price: number;
    area: number | null;
    areaExt: number | null;
    transport: number | null;
    magazynWL: number;
    magazynKLB: number;
    formaStandardowa: number;
    formaStandardowaKLB: number;
    active: number;
    zapasDol: number | null;
    zapasGora: number | null;
    zapasDolMin: number | null;
    zapasGoraMin: number | null;
    spocznikH: string | null;
    hMin1: number | null;
    hMax1: number | null;
    cena1: number | null;
    hMin2: number | null;
    hMax2: number | null;
    cena2: number | null;
    hMin3: number | null;
    hMax3: number | null;
    cena3: number | null;
    doplataPEHD: number | null;
    doplataZelbet: number | null;
    doplataDrabNierdzewna: number | null;
    malowanieWewnetrzne: number | null;
    malowanieZewnetrzne: number | null;
}

export function toLegacy(p: StudnieProductRaw): StudnieProductLegacy {
    const dnVal: number | string | null =
        p.dn != null ? (isNaN(Number(p.dn)) ? p.dn : Number(p.dn)) : null;
    return {
        id: p.id,
        name: p.name,
        category: p.category,
        componentType: p.componentType,
        dn: dnVal,
        height: p.height,
        weight: p.weight,
        price: p.price,
        area: p.area,
        areaExt: p.areaExt,
        transport: p.transport,
        magazynWL: p.magazynWL ? 1 : 0,
        magazynKLB: p.magazynKLB ? 1 : 0,
        formaStandardowa: p.formaStandardowa ? 1 : 0,
        formaStandardowaKLB: p.formaStandardowaKLB ? 1 : 0,
        active: p.active ? 1 : 0,
        zapasDol: p.zapasDol,
        zapasGora: p.zapasGora,
        zapasDolMin: p.zapasDolMin,
        zapasGoraMin: p.zapasGoraMin,
        spocznikH: p.spocznikH,
        hMin1: p.hMin1,
        hMax1: p.hMax1,
        cena1: p.cena1,
        hMin2: p.hMin2,
        hMax2: p.hMax2,
        cena2: p.cena2,
        hMin3: p.hMin3,
        hMax3: p.hMax3,
        cena3: p.cena3,
        doplataPEHD: p.doplataPEHD,
        doplataZelbet: p.doplataZelbet,
        doplataDrabNierdzewna: p.doplataDrabNierdzewna,
        malowanieWewnetrzne: p.malowanieWewnetrzne,
        malowanieZewnetrzne: p.malowanieZewnetrzne
    };
}

export const PRICELIST_CONFIG_STUDNIE = {
    keyCurrent: 'pricelist_studnie',
    keyDefault: 'pricelist_studnie_default',
    seedPath: 'data/seed/studnie/01-konstrukcja.json',
    seedDir: 'data/seed/studnie',
    label: 'studnie'
} as const;
