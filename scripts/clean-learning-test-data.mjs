/**
 * clean-learning-test-data.mjs
 *
 * Jednorazowe czyszczenie bazy wiedzy AI z danych testowych:
 * - ai_knowledge_base: patternKey zaczynajace sie od `kb_` lub `test_`
 *   (wyciek z tests/telemetryRoutes.test.ts — Real DB tests)
 * - ai_recommendations: patternKey zaczynajace sie od `rec_`
 * - wzorce transition_layout z layout=unknown (szum: rekordy z <2 przejściami,
 *   patrz baza błędów P5 — od naprawy nie powstają nowe)
 *
 * Uruchomienie:
 *   node scripts/clean-learning-test-data.mjs            # podgląd (dry-run)
 *   node scripts/clean-learning-test-data.mjs --apply    # wykonaj usunięcie
 *   node scripts/clean-learning-test-data.mjs --noise    # włącz też szum transition_layout
 *
 * Bezpieczne: domyślnie tylko raportuje, nie usuwa. Szum transition_layout
 * (produkcyjne wzorce z buga P5) jest pomijany, dopóki nie podasz --noise.
 */

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = process.env.DATABASE_URL || 'file:../data/app_database.sqlite';
const m = dbPath.match(/^file:(.+?)(\?|$)/);
const dbFile = m
    ? path.isAbsolute(m[1])
        ? m[1]
        : path.resolve(root, 'prisma', m[1])
    : path.resolve(root, 'data', 'app_database.sqlite');

if (!fs.existsSync(dbFile)) {
    console.error('Brak pliku bazy:', dbFile);
    process.exit(1);
}

const apply = process.argv.includes('--apply');
const withNoise = process.argv.includes('--noise');
const db = new DatabaseSync(dbFile);

function count(sql, params) {
    return db.prepare(sql).get(...(params || [])).c;
}

function clean(countSql, deleteSql, label) {
    const n = count(countSql);
    console.log(`${label}: ${n}`);
    if (apply && n > 0) {
        db.prepare(deleteSql).run();
        console.log(`  -> usunięto`);
    }
    return n;
}

console.log(`Baza: ${dbFile}`);
console.log(`Tryb: ${apply ? 'WYKONAJ (--apply)' : 'podgląd (dry-run)'}`);
console.log('---');

const junkKb = clean(
    `SELECT COUNT(*) c FROM ai_knowledge_base WHERE patternKey LIKE 'kb\\_%' ESCAPE '\\' OR patternKey LIKE 'test\\_%' ESCAPE '\\'`,
    `DELETE FROM ai_knowledge_base WHERE patternKey LIKE 'kb\\_%' ESCAPE '\\' OR patternKey LIKE 'test\\_%' ESCAPE '\\'`,
    'ai_knowledge_base: junk testowe (kb_/test_)'
);

const junkRec = clean(
    `SELECT COUNT(*) c FROM ai_recommendations WHERE patternKey LIKE 'rec\\_%' ESCAPE '\\'`,
    `DELETE FROM ai_recommendations WHERE patternKey LIKE 'rec\\_%' ESCAPE '\\'`,
    'ai_recommendations: junk testowe (rec_)'
);

const noiseTransition = withNoise
    ? clean(
          `SELECT COUNT(*) c FROM ai_knowledge_base WHERE patternType = 'transition_layout' AND patternKey LIKE '%|unknown|%'`,
          `DELETE FROM ai_knowledge_base WHERE patternType = 'transition_layout' AND patternKey LIKE '%|unknown|%'`,
          'ai_knowledge_base: szum transition_layout (unknown)'
      )
    : 0;

if (!withNoise) {
    console.log('(szum transition_layout pominięty — użyj --noise, jeśli też ma zostać usunięty)');
}

console.log('---');
console.log(`RAZEM do usunięcia: ${junkKb + junkRec + noiseTransition}`);

db.close();

if (!apply) {
    console.log('\nUruchom z --apply, aby faktycznie usunąć.');
}
