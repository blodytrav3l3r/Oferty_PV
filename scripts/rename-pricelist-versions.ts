#!/usr/bin/env node
/**
 * rename-pricelist-versions.ts — jednorazowa normalizacja etykiet wersji cennika
 * do formatu {R|S|P}v{seq}-{RRRRMMDD} (R = rury, S = studnie, P = preco).
 *
 * URUCHAMIANIE RĘCZNE (najpierw backup: npm run backup):
 *   npx ts-node scripts/rename-pricelist-versions.ts            # dry-run (tylko podgląd)
 *   npx ts-node scripts/rename-pricelist-versions.ts --apply    # zapis
 *
 * Idempotentny: wiersze z etykietą już w formacie docelowym są pomijane.
 * Nie dotyka seq, statusu, effectiveFrom, audytu (append-only) ani wierszy cennika.
 */

import 'dotenv/config';
import prisma from '../src/prismaClient';
import { versionLabel } from '../src/services/pricelist/lifecycle';
import { isPricelistType } from '../src/services/pricelist/validation';

async function main(): Promise<void> {
    const apply = process.argv.includes('--apply');
    const versions = await prisma.pricelistVersion.findMany({
        orderBy: [{ type: 'asc' }, { seq: 'asc' }]
    });

    let planned = 0;
    let written = 0;
    let collisions = 0;

    for (const v of versions) {
        if (!isPricelistType(v.type)) {
            console.log(`[rename] ${v.type} seq=${v.seq}: pomijam (nieznany typ cennika)`);
            continue;
        }
        const want = versionLabel(v.type, v.seq, v.effectiveFrom);
        if (v.version === want) continue;
        planned += 1;
        console.log(`[rename] ${v.type} seq=${v.seq}: ${v.version} → ${want}`);
        if (!apply) continue;
        try {
            await prisma.pricelistVersion.update({ where: { id: v.id }, data: { version: want } });
            written += 1;
        } catch (err) {
            const code = (err as { code?: string }).code;
            if (code === 'P2002') {
                collisions += 1;
                console.log(`[rename] ${v.type} seq=${v.seq}: KOLIZJA etykiety ${want} — pomijam`);
                continue;
            }
            throw err;
        }
    }

    console.log(
        `[rename] ${apply ? `zapisano ${written}` : 'dry-run'} — do zmiany: ${planned}, kolizje: ${collisions}`
    );
    if (!apply) console.log('[rename] zapis: dodaj --apply');
    if (collisions > 0) process.exitCode = 1;
}

main()
    .catch((err: unknown) => {
        console.error('[rename] Błąd:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
