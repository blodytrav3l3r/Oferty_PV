/**
 * Moduł wersji aplikacji — pojedyncze źródło prawdy.
 *
 * Importuje wersję z pliku VERSION oraz informacje z GIT.
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export interface AppVersion {
    version: string;
    commitHash: string;
    branch: string;
    buildDate: string;
    environment: string;
    dbVersion: string;
}

const version = fs.readFileSync(path.resolve('VERSION'), 'utf-8').trim();

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
