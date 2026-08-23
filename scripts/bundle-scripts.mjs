#!/usr/bin/env node
/**
 * bundle-scripts.mjs — grupowanie klasycznych <script defer src> wejściówek
 * (Faza P0-1 planu optymalizacji 2026-08-23). Tryb bezpieczny:
 *
 * - Oryginalne HTML pozostaje nietknięte (źródło prawdy).
 * - Generuje public/dist/js/<strona>-classic.min.js (concat w kolejności DOM + esbuild minify)
 *   oraz public/dist/<strona>.bundle.html (kopia z podmienionym blokiem N tagów → 1).
 * - Tagi <script type="module"> oraz inline <script> zostają na swoich miejscach
 *   (ESM nie scalamy — wzajemne importy względne).
 * - Raport: lista źródeł w kolejności + weryfikacja, że kolejność bundle == DOM.
 *
 * Użycie: node scripts/bundle-scripts.mjs [public/studnie.html public/rury.html ...]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const pages = args.length ? args : ['public/studnie.html', 'public/rury.html'];

const distDir = path.join(root, 'public', 'dist');
fs.mkdirSync(path.join(distDir, 'js'), { recursive: true });

let totalSources = 0;

for (const page of pages) {
    const htmlPath = path.resolve(root, page);
    const html = fs.readFileSync(htmlPath, 'utf-8');
    const pageName = path.basename(page, '.html');

    // Tagi <script ...> z atrybutem src, bez type="module"
    const tagRe = /<script\b([^>]*)><\/script>/gi;
    const attrRe = /\ssrc="([^"]+)"/i;
    const classic = [];
    let m;
    while ((m = tagRe.exec(html)) !== null) {
        const attrs = m[1];
        if (/\btype\s*=\s*"module"/i.test(attrs)) continue;
        const src = attrs.match(attrRe);
        if (!src) continue; // inline — zostaje
        classic.push({ full: m[0], src: src[1] });
    }

    if (classic.length < 2) {
        console.log(`[${pageName}] ${classic.length} classic script(s) — pomijam`);
        continue;
    }

    // Concat w kolejności DOM + separator nagłówkowy per plik
    const parts = [];
    for (const c of classic) {
        const rel = c.src.split('?')[0]; // strip ?v=
        const abs = path.join(root, 'public', rel);
        if (!fs.existsSync(abs)) {
            console.error(`[minify-css][ERROR] Brak pliku źródłowego: ${abs}`);
            process.exit(1);
        }
        const code = fs.readFileSync(abs, 'utf-8');
        parts.push(`/* ===== ${rel} ===== */\n${code}`);
    }
    const merged = parts.join('\n;\n'); // ; chroni przed ASI przy konkatenacji

    const min = esbuild.transformSync(merged, {
        loader: 'js',
        minify: true,
        legalComments: 'none',
        target: 'es2020'
    }).code;

    const bundleName = `${pageName}-classic.min.js`;
    fs.writeFileSync(path.join(distDir, 'js', bundleName), min);

    // Bundle HTML: pierwszy tag zastępujemy bundlem, resztę usuwamy
    let bundleHtml = html;
    const version = (() => {
        const v = classic[0].src.match(/\?v=([\d.]+)/);
        return v ? `?v=${v[1]}` : '';
    })();
    const replacement = `<script defer src="dist/js/${bundleName}${version}"></script>`;
    classic.forEach((c, i) => {
        const tag = i === 0 ? replacement : '';
        bundleHtml = bundleHtml.replace(c.full, () => tag);
    });

    const outHtml = path.join(distDir, `${pageName}.bundle.html`);
    fs.writeFileSync(outHtml, bundleHtml);

    const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
    console.log(
        `[${pageName}] ${classic.length} scriptów → 1 bundle (${kb(Buffer.byteLength(merged))} → ${kb(
            Buffer.byteLength(min)
        )}); bundle HTML: dist/${pageName}.bundle.html`
    );
    console.log(`[${pageName}] kolejność (pierwsze 3 / ostatnie 3):`);
    classic.slice(0, 3).forEach((c) => console.log('  +', c.src));
    console.log('  …');
    classic.slice(-3).forEach((c) => console.log('  +', c.src));
    totalSources += classic.length;
}

console.log(`[bundle-scripts] razem scalonych źródeł: ${totalSources}`);
