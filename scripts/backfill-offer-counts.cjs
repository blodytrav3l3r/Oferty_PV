#!/usr/bin/env node
/**
 * backfill-offer-counts.cjs
 *
 * Naprawia rozjechane liczniki pozycji ofert na liscie kartoteki ("0 poz." /
 * "0 studni" mimo zywych pozycji). Zrodlem prawdy jest blob `data` i tabela
 * `offer_items_rel`:
 *
 * 1. Studnie: wiersze `offers_studnie_rel` z `wellCount` NULL/0 i niepustym
 *    `data.wells` dostaja `wellCount` = dlugosc bloba.
 * 2. Rury: oferty bez wierszy w `offer_items_rel`, ale z niepustym
 *    `data.items` w blobie, dostaja odtworzone wiersze relacji (mapowanie
 *    jak w ruryCrud createMany).
 *
 * Uzycie:
 *   node scripts/backfill-offer-counts.cjs            # podglad (dry-run)
 *   node scripts/backfill-offer-counts.cjs --apply    # zapis
 *
 * Bezpieczniki:
 *   - domyslnie dry-run (podglad, bez zapisu),
 *   - nigdy nie usuwa ani nie nadpisuje istniejacych wierszy relacji,
 *   - pomija pozycje bloba bez productId (relacja wymaga productId),
 *   - raportuje kazdy ruszony wiersz.
 */

const { randomUUID } = require('crypto');

/** Wyciaga wells z bloba (te same ksztalty co extractWellsFromOfferData). */
function wellsFromBlob(dataStr) {
    if (!dataStr) return [];
    try {
        const parsed = JSON.parse(dataStr);
        const wells =
            parsed.wells || parsed.data?.wells || parsed.data?.data?.wells || [];
        return Array.isArray(wells) ? wells : [];
    } catch {
        return [];
    }
}

/** Wyciaga items z bloba oferty rur. */
function itemsFromBlob(dataStr) {
    if (!dataStr) return [];
    try {
        const parsed = JSON.parse(dataStr);
        const items = parsed.items || parsed.data?.items || [];
        return Array.isArray(items) ? items : [];
    } catch {
        return [];
    }
}

/**
 * Rdzen backfillu (testowalny, bez twardego klienta).
 *
 * @param prisma - klient Prisma (lub mock)
 * @param {{apply:boolean}} opts
 * @returns raport { studnieFixed, studnieRows, ruryFixed, ruryRows, rurySkipped }
 */
async function backfillOfferCounts(prisma, { apply = false } = {}) {
    const report = { studnieFixed: 0, studnieRows: [], ruryFixed: 0, ruryRows: [], rurySkipped: 0 };

    // --- 1. Studnie: wellCount NULL/0 przy pelnym blobie ---
    const studnie = await prisma.offers_studnie_rel.findMany({
        where: { OR: [{ wellCount: null }, { wellCount: 0 }] },
        select: { id: true, offer_number: true, wellCount: true, data: true }
    });
    for (const row of studnie) {
        const n = wellsFromBlob(row.data).length;
        if (n === 0 || n === row.wellCount) continue;
        report.studnieRows.push({ id: row.id, number: row.offer_number, from: row.wellCount, to: n });
        if (apply) {
            await prisma.offers_studnie_rel.update({
                where: { id: row.id },
                data: { wellCount: n }
            });
            report.studnieFixed++;
        }
    }

    // --- 2. Rury: pusta relacja przy pelnym blobie ---
    const rury = await prisma.offers_rel.findMany({
        select: { id: true, offer_number: true, data: true }
    });
    for (const row of rury) {
        const relCount = await prisma.offer_items_rel.count({ where: { offerId: row.id } });
        if (relCount > 0) continue;
        const blobItems = itemsFromBlob(row.data);
        if (blobItems.length === 0) continue;
        const valid = blobItems.filter((i) => i && typeof i.productId === 'string' && i.productId);
        report.rurySkipped += blobItems.length - valid.length;
        if (valid.length === 0) continue;
        report.ruryRows.push({ id: row.id, number: row.offer_number, items: valid.length });
        if (apply) {
            await prisma.offer_items_rel.createMany({
                data: valid.map((item) => ({
                    id: item.id || randomUUID(),
                    offerId: row.id,
                    productId: item.productId,
                    quantity: Number(item.quantity) || 0,
                    discount: Number(item.discount) || 0,
                    price: item.unitPrice !== undefined ? item.unitPrice : Number(item.price) || 0
                }))
            });
            report.ruryFixed++;
        }
    }

    return report;
}

async function main() {
    const args = process.argv.slice(2);
    const apply = args.includes('--apply');

    console.log('=== BACKFILL OFFER COUNTS ===');
    console.log(apply ? '  [APPLY] Naprawiam liczniki' : '  [DRY RUN] Podglad, bez zapisu');
    console.log('');

    const { PrismaClient } = require('../generated/prisma/index.js');
    const prisma = new PrismaClient();
    const report = await backfillOfferCounts(prisma, { apply });

    console.log(`  Studnie do naprawy: ${report.studnieRows.length}`);
    for (const r of report.studnieRows) {
        console.log(`    ${r.number || r.id}: wellCount ${r.from} -> ${r.to}`);
    }
    console.log(`  Rury do naprawy: ${report.ruryRows.length}`);
    for (const r of report.ruryRows) {
        console.log(`    ${r.number || r.id}: +${r.items} pozycji w relacji`);
    }
    if (report.rurySkipped > 0) {
        console.log(`  Pominięto pozycji bez productId: ${report.rurySkipped}`);
    }
    console.log('');
    if (!apply) {
        console.log('  Uruchom z --apply aby wykonac naprawe.');
    } else {
        console.log(
            `  Naprawiono ofert studni: ${report.studnieFixed}, ofert rur: ${report.ruryFixed}.`
        );
    }
    await prisma.$disconnect();
}

if (require.main === module) {
    main().catch((err) => {
        console.error('Fatal:', err.message || err);
        process.exit(1);
    });
}

module.exports = { backfillOfferCounts, wellsFromBlob, itemsFromBlob };
