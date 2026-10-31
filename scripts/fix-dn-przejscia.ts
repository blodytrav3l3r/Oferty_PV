/**
 * Naprawa średnic przejść jajowych (dn "1000/1500" -> "1000").
 *
 * Wersje Sv3/Sv4 utraciły drugą średnicę przy edycji publikowanej wersji
 * w miejscu (round-trip XLSX): w LIVE i w Sv1/Sv2 jest `1000/1500`, a w
 * Sv3/Sv4 zostaje `1000`. Wycena używa parseInt, więc ceny się nie zmieniają,
 * ale PDF/karta budowy tracą drugą średnicę.
 *
 * Reguła: dla każdego wiersza, gdzie LIVE ma dn z "/" a ACTIVE nie, przywróć
 * wartość z LIVE. Nowa wersja (klon ACTIVE -> poprawka -> publikacja), bez
 * edycji zatwierdzonej wersji (I-001).
 *
 * Uzycie:
 *   npx ts-node --transpile-only scripts/fix-dn-przejscia.ts            (dry-run)
 *   npx ts-node --transpile-only scripts/fix-dn-przejscia.ts --apply    (Tier 🔴)
 */
import { prisma } from '../src/prismaClient';
import { getVersionExport } from '../src/services/pricelist/export';
import { approveVersion, cloneAsDraft, updateDraft } from '../src/services/pricelist/lifecycle';
import { resolveActive } from '../src/services/pricelist/usage';
import { findLatestDraft } from '../src/services/pricelist/writeTarget';

const USER_ID = 'system:fix-dn-przejscia';
const NOTE = 'przywrocenie drugiej srednicy przejsc (dn "x/y") utraconej przy edycji w miejscu';

/** Tylko kształt "liczba/liczba" — nie zgadujemy innych formatów. */
const MULTI_DN = /^\d+\/\d+$/;

const apply = process.argv.slice(2).includes('--apply');

type Row = Record<string, unknown>;

async function main(): Promise<void> {
    const active = await resolveActive('studnie');
    if (!active) {
        console.error('[dn] Brak aktywnej wersji cennika studni — przerywam.');
        process.exitCode = 1;
        return;
    }
    console.log(`[dn] ACTIVE: ${active.version} (${active.id})`);

    const live = (await prisma.productsStudnie.findMany()) as unknown as Row[];
    const liveDn = new Map<string, string>();
    for (const row of live) {
        const dn = typeof row.dn === 'string' ? row.dn : '';
        if (MULTI_DN.test(dn)) liveDn.set(String(row.id), dn);
    }

    const { sections } = await getVersionExport(active.id);
    const rows = (sections.studnie ?? []) as Row[];
    const changes: Array<{ id: string; from: unknown; to: string }> = [];
    for (const row of rows) {
        const target = liveDn.get(String(row.id));
        if (target && String(row.dn ?? '') !== target) {
            changes.push({ id: String(row.id), from: row.dn, to: target });
        }
    }

    if (changes.length === 0) {
        console.log(`[dn] ACTIVE ${active.version} ma już pełne średnice — nic do zrobienia.`);
        return;
    }

    console.log('[dn] Zmiany (ACTIVE -> nowa wersja):');
    for (const c of changes) console.log(`  ${c.id}: ${String(c.from)} -> ${c.to}`);

    if (!apply) {
        console.log('[dn] DRY-RUN. Plan: klon ACTIVE -> poprawka dn -> zatwierdzenie.');
        console.log('[dn] Dodaj --apply, by wykonac (Tier 🔴, wpis w audycie).');
        return;
    }

    const strayDraft = await findLatestDraft('studnie');
    if (strayDraft) {
        console.error(
            `[dn] Istnieje szkic ${strayDraft.version} (${strayDraft.id}) — dokończ go albo usuń przed ponownym uruchomieniem.`
        );
        process.exitCode = 1;
        return;
    }

    const draft = await cloneAsDraft(active.id, { userId: USER_ID, note: NOTE });
    console.log(`[dn] Utworzono szkic ${draft.version} (${draft.id})`);

    const byId = new Map(changes.map((c) => [c.id, c.to]));
    const patched = rows.map((row) => {
        const target = byId.get(String(row.id));
        return target ? { ...row, dn: target } : row;
    });
    const saved = await updateDraft(draft.id, patched, NOTE, { userId: USER_ID });
    console.log(`[dn] Poprawiono dn. sha256: ${saved.sha256}`);

    const approved = await approveVersion(draft.id, {
        userId: USER_ID,
        note: NOTE,
        effectiveFrom: new Date().toISOString()
    });
    console.log(`[dn] Zatwierdzono ${approved.version} jako ACTIVE.`);
    console.log('[dn] Sprawdz: npm run prices:verify (oczekiwane: pola dn=0).');
}

main()
    .catch((err: unknown) => {
        console.error('[dn] Blad:', err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
