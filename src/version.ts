/**
 * Moduł wersji aplikacji — pojedyncze źródło prawdy.
 *
 * Importuje wersję z pliku VERSION oraz informacje z GIT.
 */
import fs from 'fs';
import { execSync } from 'child_process';
import { resolveVersionFile } from './utils/paths';

export interface AppVersion {
    version: string;
    commitHash: string;
    branch: string;
    buildDate: string;
    environment: string;
    dbVersion: string;
}

// Odczyt przez resolver (odporny na CWD); try/catch — brak pliku VERSION
// (np. obraz Docker bez repozytorium) nie może crashować serwera przy starcie.
const version = (() => {
    try {
        return fs.readFileSync(resolveVersionFile(), 'utf-8').trim();
    } catch {
        return process.env.APP_VERSION || '0.0.0';
    }
})();

function getGitInfo(): { commitHash: string; branch: string } {
    try {
        const commitHash = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
        const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
        return { commitHash, branch };
    } catch {
        return { commitHash: 'unknown', branch: 'unknown' };
    }
}

const gitInfo = getGitInfo();

export function getVersion(): AppVersion {
    return {
        version,
        commitHash: gitInfo.commitHash,
        branch: gitInfo.branch,
        buildDate: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        dbVersion: version
    };
}
