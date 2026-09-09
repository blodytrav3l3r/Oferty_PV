#!/usr/bin/env node
/**
 * fix-relief-heights.mjs
 *
 * Poprawia wysokosci plyty odciazajacej i pierscienia odciazajacego
 * w istniejacych bazach (ProductsStudnie + ProductsStudnieDefault):
 *   plyta:        150 (DN1000/1200), 200 (DN1500/2000/2500)
 *   pierscien:    150 (DN1000/1200), 200 (DN1500/2000/2500)
 *
 * Idempotentny — rekordy z poprawna wysokoscia sa pomijane.
 *
 * Uzycie:
 *   node scripts/fix-relief-heights.mjs            (podglad + zastosowanie z raportem)
 *   node scripts/fix-relief-heights.mjs --dry-run  (tylko podglad, bez zapisu)
 */

import { createRequire } from 'module';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

import dotenv from 'dotenv';
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const { PrismaClient } = require('../generated/prisma/index.js');

// id -> docelowa wysokosc (mm)
const TARGETS = [
    { id: 'PZE-16-10', height: 150 }, // plyta DN1000
    { id: 'PZE-18-12', height: 150 }, // plyta DN1200
    { id: 'PZE-245-60', height: 200 }, // plyta DN1500
    { id: 'PZE-20-20', height: 200 }, // plyta DN2000
    { id: 'PZE-25-20', height: 200 }, // plyta DN2500
    { id: 'PO-16-10', height: 150 }, // pierscien DN1000
    { id: 'PO-18-12', height: 150 }, // pierscien DN1200
    { id: 'PO-245-188', height: 200 }, // pierscien DN1500
    { id: 'PO-20-20', height: 200 }, // pierscien DN2000
    { id: 'PO-25-20', height: 200 } // pierscien DN2500
];

const TABLES = ['productsStudnie', 'productsStudnieDefault'];

async function main() {
    const dryRun = process.argv.includes('--dry-run');
    const prisma = new PrismaClient();
    let updated = 0;
    let skipped = 0;
    let missing = 0;

    try {
        for (const table of TABLES) {
            const delegate = prisma[table];
            if (!delegate) {
                console.log(`[WARN] brak tabeli ${table} w kliencie Prisma — pomijam`);
                continue;
            }
            for (const t of TARGETS) {
                let row = null;
                try {
                    row = await delegate.findUnique({ where: { id: t.id } });
                } catch (e) {
                    console.log(`[WARN] ${table}.${t.id}: blad odczytu (${e.message})`);
                    missing++;
                    continue;
                }
                if (!row) {
                    console.log(`[SKIP] ${table}.${t.id}: brak rekordu w bazie`);
                    missing++;
                    continue;
                }
                if (row.height === t.height) {
                    skipped++;
                    continue;
                }
                console.log(
                    `[${dryRun ? 'DRY-RUN' : 'UPDATE'}] ${table}.${t.id}: ${row.height} -> ${t.height}`
                );
                if (!dryRun) {
                    await delegate.update({
                        where: { id: t.id },
                        data: { height: t.height }
                    });
                    updated++;
                }
            }
        }
    } finally {
        await prisma.$disconnect();
    }

    console.log(
        `Gotowe (dry-run=${dryRun}): zaktualizowano=${updated}, bez zmian=${skipped}, brak rekordu=${missing}`
    );
}

main().catch((e) => {
    console.error('Blad migracji relief heights:', e.message || e);
    process.exit(1);
});
