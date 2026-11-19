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

const COMMIT_SHA_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i;

function getBuildGitInfo(): { commitHash: string; branch: string } | null {
    const sources = [
        { commitHash: process.env.APP_COMMIT_SHA, branch: process.env.APP_GIT_BRANCH },
        { commitHash: process.env.RENDER_GIT_COMMIT, branch: process.env.RENDER_GIT_BRANCH }
    ];
    for (const source of sources) {
        const commitHash = typeof source.commitHash === 'string' ? source.commitHash.trim() : '';
        if (!COMMIT_SHA_PATTERN.test(commitHash)) continue;
        const branch = typeof source.branch === 'string' ? source.branch.trim() : '';
        return { commitHash: commitHash.toLowerCase(), branch: branch || 'unknown' };
    }
    return null;
}

function getGitInfo(): { commitHash: string; branch: string } {
    const buildInfo = getBuildGitInfo();
    if (buildInfo) return buildInfo;

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
