#!/usr/bin/env node
/**
 * add-transport-products.mjs
 *
 * Jednorazowy upsert pozycji transportowych TR-RURY i TR-STUDNIE
 * do produkcyjnych i domyslnych tabel cennikow
 * (ProductsRury, ProductsRuryDefault, ProductsStudnie, ProductsStudnieDefault).
 *
 * Powod: prisma/seed.ts uzywa createMany bez upsert i odmawia pracy
 * na zapełnionej bazie — sam dopisek do data/seed_*.json nie wystarczy
 * na istniejacych instalacjach.
 *
 * Uzycie:
 *   node scripts/add-transport-products.mjs
 */

import { createRequire } from 'module';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

import dotenv from 'dotenv';
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const { PrismaClient } = require('../generated/prisma/index.js');
const prisma = new PrismaClient();

const RURY_ROW = {
    id: 'TR-RURY',
    name: 'Transport rur (kurs)',
    category: 'Transport',
    price: 0,
    transport: null,
    weight: 0,
    area: null
};

const STUDNIE_ROW = {
    id: 'TR-STUDNIE',
    name: 'Transport studni (kurs)',
    category: 'Transport',
    componentType: 'transport',
    dn: null,
    height: null,
    weight: 0,
    price: 0,
    area: null,
    areaExt: null,
    transport: null,
    magazynWL: false,
    magazynKLB: false,
    formaStandardowa: false,
    formaStandardowaKLB: false,
    active: false,
    zapasDol: null,
    zapasGora: null,
    zapasDolMin: null,
    zapasGoraMin: null,
    spocznikH: null,
    hMin1: null,
    hMax1: null,
    cena1: null,
    hMin2: null,
    hMax2: null,
    cena2: null,
    hMin3: null,
    hMax3: null,
    cena3: null,
    doplataPEHD: null,
    doplataZelbet: null,
    doplataDrabNierdzewna: null,
    malowanieWewnetrzne: null,
    malowanieZewnetrzne: null
};

async function main() {
    const ruryTables = [prisma.productsRury, prisma.productsRuryDefault];
    const studnieTables = [prisma.productsStudnie, prisma.productsStudnieDefault];

    for (const table of ruryTables) {
        await table.upsert({ where: { id: RURY_ROW.id }, update: RURY_ROW, create: RURY_ROW });
    }
    console.log('TR-RURY: upsert w ProductsRury + ProductsRuryDefault');

    for (const table of studnieTables) {
        await table.upsert({
            where: { id: STUDNIE_ROW.id },
            update: STUDNIE_ROW,
            create: STUDNIE_ROW
        });
    }
    console.log('TR-STUDNIE: upsert w ProductsStudnie + ProductsStudnieDefault');
}

main()
    .catch((e) => {
        console.error('add-transport-products failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
