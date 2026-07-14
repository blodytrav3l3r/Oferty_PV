/**
 * Migruje istniejące dane produktów z settings JSON blob do relacyjnych tabel.
 *
 * Uruchomienie: npx ts-node scripts/migrate-to-tables.ts
 * Backup: tworzy kopię app_database.sqlite.pre-migrate przed operacją.
 */

import fs from 'fs';
import path from 'path';
import prisma from '../src/prismaClient';

const DB_PATH = path.resolve('data/app_database.sqlite');

function backup() {
    const backupPath = DB_PATH + '.pre-migrate';
    if (!fs.existsSync(DB_PATH)) return false;
    fs.copyFileSync(DB_PATH, backupPath);
    console.log('Backup created:', backupPath);
    return true;
}

const CATEGORIES_RURY_ORDER = [
    'Rury Betonowe',
    'Żelbetowe KL. A (II)',
    'Żelbetowe KL. S (I)',
    'Duże Żelbetowe II',
    'Rury Jajowe Betonowe',
    'Rury Jajowe Żelbetowe',
    'Akcesoria PEHD',
    'Uszczelki',
    'Zabezpieczenie transportu'
];

function toBool(v: unknown): boolean {
    return v === 1 || v === true;
}

async function main() {
    console.log('=== Migracja danych produktów z settings → tabele ===\n');

    backup();

    // ── Odczytaj dane z settings ──
    const ruryRow = await prisma.settings.findUnique({ where: { key: 'pricelist_rury' } });
    const studnieRow = await prisma.settings.findUnique({ where: { key: 'pricelist_studnie' } });

    const ruryProducts: Record<string, unknown>[] = ruryRow
        ? JSON.parse(ruryRow.value || '[]')
        : [];
    const studnieProducts: Record<string, unknown>[] = studnieRow
        ? JSON.parse(studnieRow.value || '[]')
        : [];

    console.log(`Rury: ${ruryProducts.length} produktów`);
    console.log(`Studnie: ${studnieProducts.length} produktów\n`);

    // ── Rury ──
    if (ruryProducts.length > 0) {
        // Categories
        for (let i = 0; i < CATEGORIES_RURY_ORDER.length; i++) {
            await prisma.categoriesRury.upsert({
                where: { name: CATEGORIES_RURY_ORDER[i] },
                update: { order: i },
                create: { name: CATEGORIES_RURY_ORDER[i], order: i }
            });
        }

        // Products
        for (const p of ruryProducts) {
            await prisma.productsRury.upsert({
                where: { id: String(p.id) },
                update: {
                    name: String(p.name ?? ''),
                    category: String(p.category ?? ''),
                    price: Number(p.price ?? 0),
                    transport: p.transport != null ? Number(p.transport) : null,
                    weight: p.weight != null ? Number(p.weight) : null,
                    area: p.area != null ? Number(p.area) : null
                },
                create: {
                    id: String(p.id),
                    name: String(p.name ?? ''),
                    category: String(p.category ?? ''),
                    price: Number(p.price ?? 0),
                    transport: p.transport != null ? Number(p.transport) : null,
                    weight: p.weight != null ? Number(p.weight) : null,
                    area: p.area != null ? Number(p.area) : null
                }
            });
        }
        console.log(`Migrowano ${ruryProducts.length} produktów rur`);
    }

    // ── Studnie ──
    if (studnieProducts.length > 0) {
        for (const p of studnieProducts) {
            const catName = String(p.category ?? '');
            if (catName) {
                await prisma.categoriesStudnie.upsert({
                    where: { name: catName },
                    update: { componentType: p.componentType ? String(p.componentType) : null },
                    create: {
                        name: catName,
                        componentType: p.componentType ? String(p.componentType) : null,
                        order: 0
                    }
                });
            }
        }

        for (const p of studnieProducts) {
            const area = p.area;
            const areaExt = p.areaExt;
            const dZelb = p.doplataZelbet;
            const spocznikH = p.spocznikH;
            const hMin1 = p.hMin1;
            const hMax1 = p.hMax1;
            const c1 = p.cena1;
            const hMin2 = p.hMin2;
            const hMax2 = p.hMax2;
            const c2 = p.cena2;
            const hMin3 = p.hMin3;
            const hMax3 = p.hMax3;
            const c3 = p.cena3;

            await prisma.productsStudnie.upsert({
                where: { id: String(p.id) },
                update: {
                    name: String(p.name ?? ''),
                    category: String(p.category ?? ''),
                    componentType: String(p.componentType ?? ''),
                    dn: p.dn != null ? String(p.dn) : null,
                    height: p.height != null ? Number(p.height) : null,
                    weight: p.weight != null ? Number(p.weight) : null,
                    price: Number(p.price ?? 0),
                    area: area != null ? Number(area) : null,
                    areaExt: areaExt != null ? Number(areaExt) : null,
                    transport: p.transport != null ? Number(p.transport) : null,
                    magazynWL: toBool(p.magazynWL),
                    magazynKLB: toBool(p.magazynKLB),
                    formaStandardowa: toBool(p.formaStandardowa),
                    formaStandardowaKLB: toBool(p.formaStandardowaKLB),
                    active: toBool(p.active),
                    zapasDol: p.zapasDol != null ? Number(p.zapasDol) : null,
                    zapasGora: p.zapasGora != null ? Number(p.zapasGora) : null,
                    zapasDolMin: p.zapasDolMin != null ? Number(p.zapasDolMin) : null,
                    zapasGoraMin: p.zapasGoraMin != null ? Number(p.zapasGoraMin) : null,
                    spocznikH: spocznikH != null ? String(spocznikH) : null,
                    hMin1: hMin1 != null ? Number(hMin1) : null,
                    hMax1: hMax1 != null ? Number(hMax1) : null,
                    cena1: c1 != null ? Number(c1) : null,
                    hMin2: hMin2 != null ? Number(hMin2) : null,
                    hMax2: hMax2 != null ? Number(hMax2) : null,
                    cena2: c2 != null ? Number(c2) : null,
                    hMin3: hMin3 != null ? Number(hMin3) : null,
                    hMax3: hMax3 != null ? Number(hMax3) : null,
                    cena3: c3 != null ? Number(c3) : null,
                    doplataPEHD: p.doplataPEHD != null ? Number(p.doplataPEHD) : null,
                    doplataZelbet: dZelb != null ? Number(dZelb) : null,
                    doplataDrabNierdzewna:
                        p.doplataDrabNierdzewna != null ? Number(p.doplataDrabNierdzewna) : null,
                    malowanieWewnetrzne:
                        p.malowanieWewnetrzne != null ? Number(p.malowanieWewnetrzne) : null,
                    malowanieZewnetrzne:
                        p.malowanieZewnetrzne != null ? Number(p.malowanieZewnetrzne) : null
                },
                create: {
                    id: String(p.id),
                    name: String(p.name ?? ''),
                    category: String(p.category ?? ''),
                    componentType: String(p.componentType ?? ''),
                    dn: p.dn != null ? String(p.dn) : null,
                    height: p.height != null ? Number(p.height) : null,
                    weight: p.weight != null ? Number(p.weight) : null,
                    price: Number(p.price ?? 0),
                    area: area != null ? Number(area) : null,
                    areaExt: areaExt != null ? Number(areaExt) : null,
                    transport: p.transport != null ? Number(p.transport) : null,
                    magazynWL: toBool(p.magazynWL),
                    magazynKLB: toBool(p.magazynKLB),
                    formaStandardowa: toBool(p.formaStandardowa),
                    formaStandardowaKLB: toBool(p.formaStandardowaKLB),
                    active: toBool(p.active),
                    zapasDol: p.zapasDol != null ? Number(p.zapasDol) : null,
                    zapasGora: p.zapasGora != null ? Number(p.zapasGora) : null,
                    zapasDolMin: p.zapasDolMin != null ? Number(p.zapasDolMin) : null,
                    zapasGoraMin: p.zapasGoraMin != null ? Number(p.zapasGoraMin) : null,
                    spocznikH: spocznikH != null ? String(spocznikH) : null,
                    hMin1: hMin1 != null ? Number(hMin1) : null,
                    hMax1: hMax1 != null ? Number(hMax1) : null,
                    cena1: c1 != null ? Number(c1) : null,
                    hMin2: hMin2 != null ? Number(hMin2) : null,
                    hMax2: hMax2 != null ? Number(hMax2) : null,
                    cena2: c2 != null ? Number(c2) : null,
                    hMin3: hMin3 != null ? Number(hMin3) : null,
                    hMax3: hMax3 != null ? Number(hMax3) : null,
                    cena3: c3 != null ? Number(c3) : null,
                    doplataPEHD: p.doplataPEHD != null ? Number(p.doplataPEHD) : null,
                    doplataZelbet: dZelb != null ? Number(dZelb) : null,
                    doplataDrabNierdzewna:
                        p.doplataDrabNierdzewna != null ? Number(p.doplataDrabNierdzewna) : null,
                    malowanieWewnetrzne:
                        p.malowanieWewnetrzne != null ? Number(p.malowanieWewnetrzne) : null,
                    malowanieZewnetrzne:
                        p.malowanieZewnetrzne != null ? Number(p.malowanieZewnetrzne) : null
                }
            });
        }
        console.log(`Migrowano ${studnieProducts.length} produktów studni`);
    }

    console.log('\n=== Migracja zakończona ===');
}

main()
    .catch((e) => {
        console.error('Migration failed:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
