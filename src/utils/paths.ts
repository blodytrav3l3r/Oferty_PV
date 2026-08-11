import fs from 'fs';
import path from 'path';

/**
 * Wspólny resolver ścieżek projektu — odporny na zmianę katalogu roboczego (CWD).
 *
 * Wzorzec jak resolvePublicDir() w src/app.ts: ścieżki budowane od __dirname,
 * a nie od process.cwd(), z wyborem faktycznie istniejącego katalogu.
 *
 * Układ katalogów:
 *  - dev (ts-node-dev):  __dirname = <root>/src/utils       → root = ../../   (marker: <root>/public)
 *  - prod (tsc → dist):  __dirname = <root>/dist/src/utils  → root = ../../.. (marker: <root>/public)
 */
function resolveProjectRoot(): string {
    const devRoot = path.resolve(__dirname, '../..');
    if (fs.existsSync(path.join(devRoot, 'public'))) {
        return devRoot;
    }
    return path.resolve(__dirname, '../../..');
}

function resolvePublicDir(): string {
    return path.join(resolveProjectRoot(), 'public');
}

function resolveDataDir(): string {
    return path.join(resolveProjectRoot(), 'data');
}

function resolveVersionFile(): string {
    return path.join(resolveProjectRoot(), 'VERSION');
}

export { resolveProjectRoot, resolvePublicDir, resolveDataDir, resolveVersionFile };
