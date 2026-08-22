/**
 * Debug v3 runner — startuje serwer, odpala diagnostykę zawartości, zabija serwer.
 */
const { spawn, execFileSync } = require('child_process');
const { join, resolve } = require('path');
const ROOT = resolve(__dirname, '..', '..');
const BASE = 'http://localhost:3177';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'anim123456';
const { rmSync, existsSync, symlinkSync } = require('fs');

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
async function pollHealth(url, tries = 30) {
    for (let i = 0; i < tries; i++) {
        try { const r = await fetch(url); if (r.status === 200) return true; } catch (_) {}
        await sleep(1000);
    }
    return false;
}

(async () => {
    const dbUrl = 'file:./data/e2e.sqlite';
    const dbFile = join(ROOT, 'prisma', 'data', 'e2e.sqlite');
    for (const f of [dbFile, dbFile + '-wal', dbFile + '-shm']) { if (existsSync(f)) rmSync(f); }
    const distGen = join(ROOT, 'dist', 'generated');
    if (!existsSync(distGen)) symlinkSync(join(ROOT, 'generated'), distGen, 'junction');
    const env = { ...process.env, DATABASE_URL: dbUrl, PATH: join(ROOT, 'node_modules', '.bin') + ';' + process.env.PATH };
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push', '--skip-generate', '--accept-data-loss'], { cwd: ROOT, env, stdio: 'pipe' });
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'seed'], { cwd: ROOT, env, stdio: 'pipe' });
    const server = spawn(process.execPath, [join(ROOT, 'dist', 'server.js')], { cwd: ROOT, env: { ...env, PORT: '3177', DEFAULT_ADMIN_PASSWORD: ADMIN_PASSWORD, NODE_ENV: 'development' }, stdio: 'pipe' });
    const ok = await pollHealth(`${BASE}/health`);
    if (!ok) { server.kill(); console.error('SERWER NIE WSTAŁ'); process.exit(1); }

    // przekazujemy sterowanie do debugContent jako child (dziedziczy stdout)
    const { execFileSync: ex } = require('child_process');
    try {
        ex(process.execPath, [join(ROOT, 'tests', 'playwright', 'debugContent.cjs')], { cwd: ROOT, env: { ...process.env, BASE }, stdio: 'inherit' });
    } finally {
        server.kill();
    }
})();
