import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const SHA_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i;
const OUTPUT_KEYS = [
    'APP_COMMIT_SHA',
    'APP_GIT_BRANCH',
    'APP_WORKTREE_DIRTY',
    'INFO_LOCAL',
    'INFO_REMOTE',
    'INFO_STATE',
    'INFO_DIRTY'
];

function runGit(args, timeout = 5_000, preserveWhitespace = false) {
    try {
        const output = execFileSync('git', args, {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
            timeout,
            env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
        });
        return {
            value: preserveWhitespace ? output.trimEnd() : output.trim(),
            error: ''
        };
    } catch (error) {
        return { value: '', error: error?.code || 'unavailable' };
    }
}

function readAppVersion() {
    try {
        const version = readFileSync(new URL('../VERSION', import.meta.url), 'utf8').trim();
        return /^\d+\.\d+\.\d+$/.test(version) ? version : 'unavailable (invalid VERSION)';
    } catch (error) {
        return `unavailable (${error?.code || 'VERSION read failed'})`;
    }
}

function collectCommitInfo() {
    const appVersion = readAppVersion();
    const headResult = runGit(['rev-parse', '--verify', 'HEAD'], 2_000);
    const localSha = SHA_PATTERN.test(headResult.value) ? headResult.value.toLowerCase() : '';
    const branchResult = runGit(['branch', '--show-current'], 2_000);
    const branch = /^[a-zA-Z0-9._/-]{1,100}$/.test(branchResult.value)
        ? branchResult.value
        : 'unknown';
    const statusResult = localSha
        ? runGit(['status', '--porcelain', '--untracked-files=normal'], 5_000, true)
        : null;
    const changedFiles = statusResult?.value
        ? statusResult.value
              .split(/\r?\n/)
              .filter(Boolean)
              .map((line) =>
                  Array.from(line.slice(3), (character) => {
                      const codePoint = character.codePointAt(0);
                      return codePoint < 32 || codePoint === 127 ? '?' : character;
                  }).join('')
              )
        : [];
    const isDirty = changedFiles.length > 0;
    const dirtyState =
        !localSha || statusResult?.error
            ? 'Working-tree status could not be checked.'
            : isDirty
              ? 'WARNING: working tree has uncommitted changes; SHA identifies HEAD only.'
              : 'Working tree is clean.';

    const remoteResult = localSha
        ? runGit(['ls-remote', '--exit-code', '--heads', 'origin', 'main'], 8_000)
        : { value: '', error: 'no-local-commit' };
    const remoteShaCandidate = remoteResult.value.split(/\s+/)[0] || '';
    const remoteSha = SHA_PATTERN.test(remoteShaCandidate) ? remoteShaCandidate.toLowerCase() : '';
    const sameCommit = Boolean(localSha && remoteSha && localSha === remoteSha);

    return {
        APP_COMMIT_SHA: localSha || 'unknown',
        APP_GIT_BRANCH: branch,
        APP_WORKTREE_DIRTY:
            !localSha || statusResult?.error ? 'unknown' : isDirty ? 'true' : 'false',
        APP_VERSION: appVersion,
        changedFiles,
        INFO_LOCAL: `Local code commit: ${localSha ? localSha.slice(0, 12) : 'unavailable'}`,
        INFO_REMOTE: `Latest origin/main: ${remoteSha ? remoteSha.slice(0, 12) : 'not checked'}`,
        INFO_STATE: sameCommit
            ? 'Local code matches origin/main.'
            : remoteSha
              ? 'Local code differs from origin/main; launcher will use local files.'
              : 'origin/main could not be checked; launcher will use local files.',
        INFO_DIRTY: dirtyState
    };
}

const info = collectCommitInfo();

if (process.argv.includes('--batch')) {
    for (const key of OUTPUT_KEYS) process.stdout.write(`${key}=${info[key]}\n`);
} else {
    process.stdout.write(
        [
            `S.O.K. local version: ${info.APP_VERSION}`,
            `Local branch: ${info.APP_GIT_BRANCH}`,
            info.INFO_LOCAL,
            info.INFO_REMOTE,
            info.INFO_STATE,
            info.INFO_DIRTY
        ]
            .map((line) => `[INFO] ${line}`)
            .join('\n') + '\n'
    );
    if (info.changedFiles.length) {
        const displayedFiles = info.changedFiles.slice(0, 20);
        process.stdout.write('[INFO] Changed files in this folder:\n');
        for (const file of displayedFiles) process.stdout.write(`  ${file}\n`);
        if (info.changedFiles.length > displayedFiles.length) {
            process.stdout.write(
                `  ... and ${info.changedFiles.length - displayedFiles.length} more\n`
            );
        }
    }
}
