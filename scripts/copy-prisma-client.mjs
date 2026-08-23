import fs from 'fs';
import path from 'path';

const src = path.resolve('generated/prisma');
const dest = path.resolve('dist/generated/prisma');

if (!fs.existsSync(src)) {
    console.warn(`[copy-prisma-client] skip — src missing: ${src} (run npx prisma generate first)`);
    process.exit(0);
}

try {
    // Jeśli dest to symlink (Dockerfile: ln -sf /app/generated /app/dist/generated) — usuń przed kopiowaniem
    const lst = fs.lstatSync(dest, { throwIfNoEntry: false });
    if (lst?.isSymbolicLink()) fs.unlinkSync(dest);
    // dist/generated może być plikiem/katalogiem — czyść rekurencyjnie przez cp force
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.cpSync(src, dest, { recursive: true, force: true });
    console.log(`[copy-prisma-client] ${src} -> ${dest}`);
} catch (e) {
    console.error('[copy-prisma-client] failed:', e instanceof Error ? e.message : String(e));
    process.exit(1);
}
