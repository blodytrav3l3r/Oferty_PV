#!/usr/bin/env node
// ADR-004 ratchet: bezpośrednie użycia Prisma w src/routes nie mogą rosnąć.
// Nowa logika DB idzie do services; wyjątek = świadome podniesienie BASELINE.
import fs from 'fs';
import path from 'path';

const BASELINE = 273;
const ROOT = path.join(process.cwd(), 'src', 'routes');

function walk(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(full));
        else if (entry.name.endsWith('.ts')) out.push(full);
    }
    return out;
}

let count = 0;
for (const file of walk(ROOT)) {
    const src = fs.readFileSync(file, 'utf8');
    count += (src.match(/\bprisma\./g) || []).length;
}

console.log(`[ratchet] prisma.* w src/routes: ${count} (baseline: ${BASELINE}).`);
if (count > BASELINE) {
    console.error(
        `[ratchet] Przekroczony baseline ADR-004 (+${count - BASELINE}). ` +
            'Przenieś logikę DB do src/services lub świadomie podnieś BASELINE.'
    );
    process.exit(1);
}
