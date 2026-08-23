#!/usr/bin/env node
/**
 * minify-css.mjs — minifikacja CSS do public/css/min (Faza P0-2 planu 2026-08-23).
 *
 * - Rekurencyjnie: public/css dowolna głębokość → lustrzana struktura w podkatalogu "min"
 * - Idempotentny: pomija pliki nowsze niż ich min-wersja (incremental)
 * - Uruchamiany automatycznie przez hook "prestart" (npm start, docker-entrypoint.sh)
 * - Prod serwuje /css/X.css z /css/min/X.css przez middleware w src/app.ts
 *
 * Użycie: node scripts/minify-css.mjs [--force]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'public', 'css');
const outDir = path.join(srcDir, 'min');
const force = process.argv.includes('--force');

if (!fs.existsSync(srcDir)) {
    console.error('[minify-css] Brak katalogu', srcDir);
    process.exit(1);
}

function walkCss(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'min') continue; // nie rekursuj wyjścia
            out.push(...walkCss(full));
        } else if (entry.name.endsWith('.css')) {
            out.push(full);
        }
    }
    return out;
}

const files = walkCss(srcDir);
let savedBytes = 0;
let written = 0;
let skipped = 0;

for (const src of files) {
    const rel = path.relative(srcDir, src);
    const dest = path.join(outDir, rel);
    const srcStat = fs.statSync(src);

    if (!force && fs.existsSync(dest)) {
        // Incremental: pomiń gdy min nowszy lub równy źródłu
        if (fs.statSync(dest).mtimeMs >= srcStat.mtimeMs) {
            skipped++;
            continue;
        }
    }

    const css = fs.readFileSync(src, 'utf-8');
    const result = esbuild.transformSync(css, {
        loader: 'css',
        minify: true,
        legalComments: 'none'
    });
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, result.outputFiles ? result.outputFiles[0].text : result.code);
    savedBytes += Buffer.byteLength(css) - Buffer.byteLength(result.code);
    written++;
}

const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
console.log(
    `[minify-css] zapisano: ${written}, pominięto (aktualne): ${skipped}, oszczędność: ${kb(savedBytes)}`
);
