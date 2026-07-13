/**
 * Skrypt naprawczy: uzupełnia brakujące pole `area` w seed studni
 * dla produktów w grupach PEHD (wkladkaZwienczenie), które mają area = 0.
 *
 * Działa na katalogu data/seed/studnie/ (4 pliki).
 *
 * Uruchomienie: node scripts/fix-studnie-seed-area.mjs
 */

import fs from 'fs';
import path from 'path';
import { readSeedProducts, writeSeedProducts, SEED_DIR } from './seed-studnie-utils.mjs';

const seedData = readSeedProducts();
let fixes = [];

// ================================================================
// 1. plyta_din — area = areaExt (wzór z DN1200 gdzie area === areaExt)
// ================================================================
seedData
    .filter((p) => p.componentType === 'plyta_din' && (!p.area || p.area <= 0) && p.areaExt > 0)
    .forEach((p) => {
        fixes.push({ id: p.id, field: 'area', old: p.area, new: p.areaExt });
        p.area = p.areaExt;
    });

// ================================================================
// 2. plyta_zamykajaca DN1000 — proporcja z DN1200 (area/areaExt = 1.13/1.81)
// ================================================================
seedData.filter((p) => p.id === 'PZE-16-10').forEach((p) => {
    const ratio = 1.13 / 1.81;
    const newArea = Math.round(p.areaExt * ratio * 1000) / 1000;
    fixes.push({ id: p.id, field: 'area', old: p.area, new: newArea });
    p.area = newArea;
});

// ================================================================
// 3. pierscien_odciazajacy — area = π × DN(m) × H(m)
// ================================================================
seedData
    .filter(
        (p) =>
            p.componentType === 'pierscien_odciazajacy' && (!p.area || p.area <= 0) && p.dn > 0
    )
    .forEach((p) => {
        const dnM = p.dn / 1000;
        const hM = (p.height || 50) / 1000;
        const newArea = Math.round(Math.PI * dnM * hM * 1000) / 1000;
        fixes.push({ id: p.id, field: 'area', old: p.area, new: newArea });
        p.area = newArea;
    });

// ================================================================
// 4. plyta_redukcyjna warianty 08/10 — area = areaExt (wzór z DN1200)
// ================================================================
seedData
    .filter(
        (p) =>
            p.componentType === 'plyta_redukcyjna' &&
            (!p.area || p.area <= 0) &&
            p.areaExt > 0
    )
    .forEach((p) => {
        fixes.push({ id: p.id, field: 'area', old: p.area, new: p.areaExt });
        p.area = p.areaExt;
    });

// ================================================================
// 5. plyta_din DN2500 — areaExt jest podejrzane (DN2000 też = 5.03)
// ================================================================
seedData
    .filter(
        (p) =>
            p.componentType === 'plyta_din' &&
            p.dn === 2500 &&
            p.areaExt === 5.03
    )
    .forEach((p) => {
        fixes.push({
            id: p.id,
            field: 'areaExt',
            old: p.areaExt,
            new: '? (możliwy błąd: DN2500 areaExt = DN2000 areaExt)',
            warn: true
        });
    });

// ================================================================
// 6. plyta_zamykajaca DN2500 — areaExt też = DN2000 (7.06)
// ================================================================
seedData
    .filter(
        (p) =>
            p.componentType === 'plyta_zamykajaca' &&
            p.dn === 2500 &&
            p.areaExt === 7.06
    )
    .forEach((p) => {
        fixes.push({
            id: p.id,
            field: 'areaExt',
            old: p.areaExt,
            new: '? (możliwy błąd: DN2500 areaExt = DN2000 areaExt)',
            warn: true
        });
    });

// ================================================================
// Zastosuj poprawki
// ================================================================
const applied = fixes.filter((f) => !f.warn);
const warnings = fixes.filter((f) => f.warn);

console.log(`\n=== Zastosowane poprawki (${applied.length}) ===`);
applied.forEach((f) => console.log(`  ${f.id}: ${f.field} ${f.old} → ${f.new}`));

console.log(`\n=== Ostrzeżenia (${warnings.length}) — nie naprawiono automatycznie ===`);
warnings.forEach((f) => console.log(`  ${f.id}: ${f.field} = ${f.old} — ${f.new}`));

// Backup
fs.writeFileSync(path.join(SEED_DIR, '..', 'seed_studnie.json.bak'), JSON.stringify(seedData, null, 2), 'utf8');

// Zapisz do katalogu
writeSeedProducts(seedData);
console.log(`\n✅ Zapisano ${seedData.length} produktów do ${SEED_DIR}`);
console.log(`📦 Backup: data/seed/studnie/../seed_studnie.json.bak`);
