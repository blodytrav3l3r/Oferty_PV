import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const SHA_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i;
const IMAGE_LABELS = {
    version: 'org.opencontainers.image.version',
    commit: 'org.opencontainers.image.revision',
    dirty: 'com.sok.build.worktree-dirty'
};

export function compareBuildMetadata(expected, actual) {
    const expectedVersion = normalizeText(expected?.version);
    const actualVersion = normalizeText(actual?.version);
    const expectedCommit = normalizeSha(expected?.commit);
    const actualCommit = normalizeSha(actual?.commit);

    if (!expectedCommit || !expectedVersion) {
        return { status: 'unverified', reason: 'Local version or commit is unavailable.' };
    }

    if (!actualCommit || !actualVersion) {
        return {
            status: 'mismatch',
            reason: 'Docker image is missing build version or commit metadata.'
        };
    }

    if (expectedVersion !== actualVersion || expectedCommit !== actualCommit) {
        return {
            status: 'mismatch',
            expectedVersion,
            actualVersion,
            expectedCommit,
            actualCommit
        };
    }

    const expectedDirty = parseDirtyState(expected?.dirty);
    const actualDirty = parseDirtyState(actual?.dirty);
    if (expectedDirty !== null && actualDirty === null) {
        return {
            status: 'mismatch',
            reason: 'Docker image is missing the local working-tree state label.',
            expectedVersion,
            actualVersion,
            expectedCommit,
            actualCommit,
            expectedDirty,
            actualDirty
        };
    }
    if (expectedDirty !== null && actualDirty !== null && expectedDirty !== actualDirty) {
        return {
            status: 'mismatch',
            reason: 'Local working-tree state differs from the Docker image build state.',
            expectedVersion,
            actualVersion,
            expectedCommit,
            actualCommit,
            expectedDirty,
            actualDirty
        };
    }

    return {
        status: 'match',
        version: expectedVersion,
        commit: expectedCommit,
        dirty: expectedDirty,
        dirtyVerified: expectedDirty !== null && actualDirty !== null
    };
}

function normalizeText(value) {
    const text = typeof value === 'string' ? value.trim() : '';
    return text && text !== 'unknown' ? text : '';
}

function normalizeSha(value) {
    const text = normalizeText(value);
    return SHA_PATTERN.test(text) ? text.toLowerCase() : '';
}

function parseDirtyState(value) {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return null;
}

export function readDockerBuildMetadata(runCommand = execFileSync) {
    const output = runCommand(
        'docker',
        ['inspect', '--format', '{{json .Config.Labels}}', 'sok-oferty'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10_000 }
    );
    const labels = JSON.parse(output);

    return Object.fromEntries(
        Object.entries(IMAGE_LABELS).map(([key, label]) => [key, labels?.[label] || ''])
    );
}

function reportBuildCheck(expected, actual) {
    const result = compareBuildMetadata(expected, actual);
    if (result.status === 'unverified') {
        process.stdout.write(`[UWAGA] Nie moge potwierdzic commita Dockera: ${result.reason}\n`);
        return 0;
    }

    if (result.status === 'mismatch') {
        if (result.expectedCommit && result.actualCommit) {
            process.stderr.write(
                `[BLAD] Docker ma v${result.actualVersion} / ${result.actualCommit.slice(0, 12)}, ` +
                    `lokalny kod v${result.expectedVersion} / ${result.expectedCommit.slice(0, 12)}.\n`
            );
        } else {
            process.stderr.write(`[BLAD] Nie mozna potwierdzic buildu Dockera: ${result.reason}\n`);
        }
        if (result.expectedDirty !== undefined && result.actualDirty !== undefined) {
            process.stderr.write(
                `[BLAD] Lokalny katalog ${result.expectedDirty ? 'ma' : 'nie ma'} zmian niezapisanych; ` +
                    `obraz ${result.actualDirty ? 'zbudowano z' : 'nie oznacza'} takiego stanu.\n`
            );
        }
        process.stderr.write(
            '[BLAD] Sprawdz start-postgres.bat i przebuduj obraz z lokalnego folderu.\n'
        );
        return 1;
    }

    process.stdout.write(
        `[OK] Docker zgodny z lokalnym kodem: v${result.version}, commit ${result.commit.slice(0, 12)}.\n`
    );
    if (result.dirty && result.dirtyVerified) {
        process.stdout.write(
            '[UWAGA] Build zawiera lokalne zmiany niezapisane w Git; hash wskazuje bazowy commit HEAD.\n'
        );
    } else if (result.dirty) {
        process.stdout.write(
            '[UWAGA] Lokalny katalog ma niezapisane zmiany; hash zgodny, ale ich obecnosci w obrazie nie potwierdzono.\n'
        );
    } else if (!result.dirtyVerified) {
        process.stdout.write(
            '[UWAGA] Nie udalo sie potwierdzic stanu niezapisanych zmian w obrazie.\n'
        );
    } else {
        process.stdout.write('[OK] Lokalny katalog i build Dockera sa czyste.\n');
    }
    return 0;
}

function main() {
    const expected = {
        version: process.env.APP_VERSION,
        commit: process.env.APP_COMMIT_SHA,
        dirty: process.env.APP_WORKTREE_DIRTY
    };

    if (!normalizeSha(expected.commit)) {
        return reportBuildCheck(expected, {});
    }

    try {
        return reportBuildCheck(expected, readDockerBuildMetadata());
    } catch {
        process.stderr.write(
            '[BLAD] Nie mozna odczytac metadanych uruchomionego kontenera sok-oferty.\n'
        );
        return 1;
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exitCode = main();
}
