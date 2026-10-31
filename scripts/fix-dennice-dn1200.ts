/**
 * Naprawa cen 5 dennic DN1200 w wersjach cennika studni.
 *
 * Rozjazd (wykryty przez `prices:verify`, sekcja ACTIVE vs LIVE):
 *   dane historyczne (LIVE) = 1150,
 *   Sv1..Sv4 = 1050.
 * Oferty licza z ACTIVE, wiec klient dostawal 1050, a eksport pokazywal 1150.
 *
 * Zgodnie z I-001 NIE edytujemy zatwierdzonej wersji w miejscu (oferty ze
 * stampem Sv4 zmienilyby cene). Zamiast tego: klon ACTIVE -> poprawa 5 cen ->
 * zatwierdzenie jako nowa ACTIVE.
 *
 * Uzycie:
 *   npx ts-node --transpile-only scripts/fix-dennice-dn1200.ts            (dry-run)
 *   npx ts-node --transpile-only scripts/fix-dennice-dn1200.ts --apply    (Tier 🔴)
 *
 * Zapis idzie przez lifecycle (cloneAsDraft / replaceVersionRows /
 * approveVersion), wiec: walidacja zod, przeliczenie sha256 i wpis w audycie.
 */
import { prisma } from '../src/prismaClient';
import { getVersionExport } from '../src/services/pricelist/export';
import { approveVersion, cloneAsDraft, updateDraft } from '../src/services/pricelist/lifecycle';
import { findLatestDraft } from '../src/services/pricelist/writeTarget';
import { resolveActive } from '../src/services/pricelist/usage';

/** Docelowa cena dennicy = zrodlo prawdy (LIVE/Default/JSON). */
const TARGET_PRICE = 1150;

const DENNICE = ['DDD-12-115', 'DDD-12-120', 'DDD-12-125', 'DDD-12-130', 'DDD-12-135'];

const USER_ID = 'system:fix-dennice-dn1200';
const NOTE = 'naprawa ceny dennic DN1200: 1050 -> 1150 (zgodnie z LIVE/Default/JSON)';

const apply = process.argv.slice(2).includes('--apply');

type Row = Record<string, unknown>;

function priceOf(row: Row): unknown {
    return row.price;
}

async function main(): Promise<void> {
    const active = await resolveActive('studnie');
    if (!active) {
        console.error('[dennice] Brak aktywnej wersji cennika studni — przerywam.');
        process.exitCode = 1;
        return;
    }
    console.log(`[dennice] ACTIVE: ${active.version} (${active.id})`);

    const { sections } = await getVersionExport(active.id);
    const rows = (sections.studnie ?? []) as Row[];
    const byId = new Map(rows.map((r) => [String(r.id), r]));

    const changes: Array<{ id: string; from: unknown }> = [];
    for (const id of DENNICE) {
        const row = byId.get(id);
        if (!row) {
            console.error(`[dennice] Brak wiersza ${id} w ACTIVE — przerywam.`);
            process.exitCode = 1;
            return;
        }
        if (Number(priceOf(row)) !== TARGET_PRICE) {
            changes.push({ id, from: priceOf(row) });
        }
    }

    if (changes.length === 0) {
        console.log(
            `[dennice] ACTIVE ${active.version} ma juz ${TARGET_PRICE} na wszystkich ${DENNICE.length} dennicach — nic do zrobienia.`
        );
        return;
    }

    console.log('[dennice] Zmiany (ACTIVE -> nowa wersja):');
    for (const c of changes) {
        console.log(`  ${c.id}: ${String(c.from)} -> ${TARGET_PRICE}`);
    }

    if (!apply) {
        console.log(
            '[dennice] DRY-RUN. Plan: klon ACTIVE -> poprawa cen -> zatwierdzenie nowej wersji.'
        );
        console.log('[dennice] Dodaj --apply, by wykonac (Tier 🔴, wpis w audycie).');
        return;
    }

    const strayDraft = await findLatestDraft('studnie');
    if (strayDraft) {
        console.error(
            `[dennice] Istnieje szkic ${strayDraft.version} (${strayDraft.id}) — dokończ go albo usuń przed ponownym uruchomieniem.`
        );
        process.exitCode = 1;
        return;
    }

    const draft = await cloneAsDraft(active.id, { userId: USER_ID, note: NOTE });
    console.log(`[dennice] Utworzono szkic ${draft.version} (${draft.id})`);

    const patched = rows.map((row) =>
        DENNICE.includes(String(row.id)) ? { ...row, price: TARGET_PRICE } : row
    );
    const saved = await updateDraft(draft.id, patched, NOTE, {
        userId: USER_ID
    });
    console.log(`[dennice] Poprawiono ceny. sha256: ${saved.sha256}`);

    const approved = await approveVersion(draft.id, {
        userId: USER_ID,
        note: NOTE,
        effectiveFrom: new Date().toISOString()
    });
    console.log(`[dennice] Zatwierdzono ${approved.version} jako ACTIVE.`);
    console.log('[dennice] Sprawdz: npm run prices:verify (ACTIVE spójne, ceny dodatnie).');
}

main()
    .catch((err: unknown) => {
        console.error('[dennice] Blad:', err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
