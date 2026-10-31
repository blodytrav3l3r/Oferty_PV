/**
 * Naprawa "martwych" zakresow PRECO (min > max albo max = 0).
 *
 * Taki zakres nigdy nie dopasowuje sie w `_findPrecoRange`
 * (public/js/studnie/precoCalcCore.js) i daje cene 0 zl bez sygnalu.
 * Realne przypadki w danych (Pv1 = Pv2 = Pv3 = LIVE = Default):
 *   DN1200 uniesienie           401-0 / 501-0 / 601-0 / 701-0
 *   DN2000 redukcja             901-10
 *   DN2500 redukcja             500-100  (zamierzone 50-100)
 *   DN2500 uniesienie           401-400  (zamierzone 401-500)
 *
 * Uzycie:
 *   npx ts-node --transpile-only scripts/fix-preco-ranges.ts            (dry-run)
 *   npx ts-node --transpile-only scripts/fix-preco-ranges.ts --apply    (Tier 🔴)
 *
 * Zapis idzie przez lifecycle (updateDraft / replaceVersionRows), wiec:
 * walidacja zod, przeliczenie sha256 i wpis w audycie. Wiersze LIVE i DEFAULT
 * sa aktualizowane po id (bez ruszania cen w grupach).
 */
import { prisma } from '../src/prismaClient';
import { getVersionExport } from '../src/services/pricelist/export';
import { replaceVersionRows, updateDraft } from '../src/services/pricelist/lifecycle';

interface RangeFix {
    label: 'uniesienie' | 'redukcja';
    wellDn: number;
    order: number;
    min: number;
    max: number;
}

const FIXES: RangeFix[] = [
    { label: 'uniesienie', wellDn: 1200, order: 37, min: 401, max: 500 },
    { label: 'uniesienie', wellDn: 1200, order: 38, min: 501, max: 600 },
    { label: 'uniesienie', wellDn: 1200, order: 39, min: 601, max: 700 },
    { label: 'uniesienie', wellDn: 1200, order: 40, min: 701, max: 800 },
    { label: 'redukcja', wellDn: 2000, order: 119, min: 901, max: 1000 },
    { label: 'redukcja', wellDn: 2500, order: 158, min: 50, max: 100 },
    { label: 'uniesienie', wellDn: 2500, order: 140, min: 401, max: 500 }
];

const NOTE = 'naprawa martwych zakresow PRECO (max < min / max = 0)';

const apply = process.argv.slice(2).includes('--apply');

function key(label: string, wellDn: number, order: number): string {
    return `${label}|${wellDn}|${order}`;
}

const FIX_BY_KEY = new Map(FIXES.map((f) => [key(f.label, f.wellDn, f.order), f]));

/** Zwraca listę zmian dla wierszy wersji (canonical shape z getVersionExport). */
function patchRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
    return rows.map((row) => {
        const fix = FIX_BY_KEY.get(key(String(row.label), Number(row.wellDn), Number(row.order)));
        if (!fix) return row;
        return { ...row, min: fix.min, max: fix.max };
    });
}

async function fixLiveTable(
    model: { findMany: () => Promise<Array<Record<string, any>>>; update: any },
    name: string
): Promise<void> {
    const rows = await model.findMany();
    const changes = rows.filter(
        (r) =>
            FIX_BY_KEY.has(key(String(r.label), Number(r.wellDn), Number(r.order))) &&
            (r.min !==
                FIX_BY_KEY.get(key(String(r.label), Number(r.wellDn), Number(r.order)))!.min ||
                r.max !==
                    FIX_BY_KEY.get(key(String(r.label), Number(r.wellDn), Number(r.order)))!.max)
    );
    console.log(`\n=== ${name}: ${changes.length} wierszy ===`);
    for (const row of changes) {
        const fix = FIX_BY_KEY.get(key(String(row.label), Number(row.wellDn), Number(row.order)))!;
        console.log(
            `  ${row.label} DN${row.wellDn} order=${row.order}: ${row.min}-${row.max} → ${fix.min}-${fix.max}`
        );
        if (apply) {
            await model.update({ where: { id: row.id }, data: { min: fix.min, max: fix.max } });
        }
    }
}

async function fixVersions(): Promise<void> {
    const versions = await prisma.pricelistVersion.findMany({
        where: { type: 'preco' },
        orderBy: { seq: 'asc' },
        select: { id: true, version: true, status: true }
    });
    for (const v of versions) {
        const { sections } = await getVersionExport(v.id);
        const zakresy = (sections.zakresy ?? []) as Array<Record<string, unknown>>;
        const before = new Map(
            zakresy.map((r) => [
                key(String(r.label), Number(r.wellDn), Number(r.order)),
                `${r.min}-${r.max}`
            ])
        );
        const patched = patchRows(zakresy);
        const changes = patched.filter((r) => {
            const k = key(String(r.label), Number(r.wellDn), Number(r.order));
            return `${r.min}-${r.max}` !== before.get(k);
        });
        console.log(`\n=== ${v.version} (${v.status}): ${changes.length} wierszy ===`);
        for (const r of changes) {
            const k = key(String(r.label), Number(r.wellDn), Number(r.order));
            console.log(
                `  ${r.label} DN${r.wellDn} order=${r.order}: ${before.get(k)} → ${r.min}-${r.max}`
            );
        }
        if (changes.length === 0 || !apply) continue;

        if (v.status === 'APPROVED') {
            const updated = await replaceVersionRows(
                v.id,
                { ...sections, zakresy: patched },
                {
                    userId: 'system:fix-preco-ranges'
                }
            );
            console.log(`  ZAPISANE. sha256: ${updated.sha256}`);
        } else if (v.status === 'DRAFT') {
            const updated = await updateDraft(v.id, { ...sections, zakresy: patched }, NOTE);
            console.log(`  ZAPISANE. sha256: ${updated.sha256}`);
        } else {
            console.log(`  POMINIETE (status ${v.status})`);
        }
    }
}

async function main(): Promise<void> {
    const live = prisma.precoZakresy as any;
    const defaults = prisma.precoZakresyDefault as any;
    await fixLiveTable(live, 'PrecoZakresy (LIVE)');
    await fixLiveTable(defaults, 'PrecoZakresyDefault');
    await fixVersions();
    if (!apply) {
        console.log('\nDRY-RUN: nic nie zapisano. Dodaj --apply po akceptacji listy.');
        console.log('Po --apply: npm run prices:export (odswiezenie data/price_defaults.json).');
    }
}

main()
    .catch((err) => {
        console.error('BLAD:', err instanceof Error ? err.message : err);
        process.exitCode = 1;
    })
    .finally(() => {
        void prisma.$disconnect();
    });
