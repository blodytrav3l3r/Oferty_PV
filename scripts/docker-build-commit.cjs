'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SHA_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i;

function normalizeSha(value) {
    const sha = typeof value === 'string' ? value.trim() : '';
    return SHA_PATTERN.test(sha) ? sha.toLowerCase() : '';
}

function resolveGitDirectory(gitPath) {
    const stat = fs.statSync(gitPath);
    if (stat.isDirectory()) return gitPath;

    const gitFile = fs.readFileSync(gitPath, 'utf8');
    const match = /^gitdir:\s*(.+)\s*$/i.exec(gitFile);
    if (!match) throw new Error('Cannot resolve Docker image commit SHA from Git metadata.');

    const gitDirectory = path.resolve(path.dirname(gitPath), match[1]);
    if (!fs.statSync(gitDirectory).isDirectory()) {
        throw new Error('Cannot resolve Docker image commit SHA from Git metadata.');
    }
    return gitDirectory;
}

function readSha(filePath) {
    try {
        return normalizeSha(fs.readFileSync(filePath, 'utf8')) || null;
    } catch {
        return null;
    }
}

function resolvePackedRef(gitDirectory, ref) {
    let packedRefs;
    try {
        packedRefs = fs.readFileSync(path.join(gitDirectory, 'packed-refs'), 'utf8');
    } catch {
        return null;
    }

    for (const line of packedRefs.split(/\r?\n/)) {
        if (!line || line.startsWith('#') || line.startsWith('^')) continue;
        const [sha, packedRef] = line.split(/\s+/);
        if (packedRef === ref) return normalizeSha(sha) || null;
    }
    return null;
}

function resolveDockerCommitSha(gitPath, override = '') {
    const configuredSha = normalizeSha(override);
    if (configuredSha) return configuredSha;

    try {
        const gitDirectory = resolveGitDirectory(gitPath);
        const head = fs.readFileSync(path.join(gitDirectory, 'HEAD'), 'utf8').trim();
        const detachedSha = normalizeSha(head);
        if (detachedSha) return detachedSha;

        const match = /^ref:\s*(refs\/(?:heads|tags)\/[A-Za-z0-9._/-]+)$/.exec(head);
        if (!match || match[1].split('/').some((part) => !part || part === '..')) {
            throw new Error('Cannot resolve Docker image commit SHA from Git metadata.');
        }

        const ref = match[1];
        const refPath = path.resolve(gitDirectory, ref);
        if (!refPath.startsWith(path.resolve(gitDirectory) + path.sep)) {
            throw new Error('Cannot resolve Docker image commit SHA from Git metadata.');
        }

        const looseSha = readSha(refPath);
        const commitSha = looseSha || resolvePackedRef(gitDirectory, ref);
        if (commitSha) return commitSha;
    } catch (error) {
        if (
            error instanceof Error &&
            error.message.startsWith('Cannot resolve Docker image commit SHA')
        ) {
            throw error;
        }
    }

    throw new Error('Cannot resolve Docker image commit SHA from Git metadata.');
}

function writeDockerCommitSha(gitPath, outputPath, override = '') {
    const commitSha = resolveDockerCommitSha(gitPath, override);
    fs.writeFileSync(outputPath, `${commitSha}\n`, 'utf8');
    return commitSha;
}

module.exports = { resolveDockerCommitSha, writeDockerCommitSha };

function isSourceArchive(gitPath) {
    try {
        fs.lstatSync(gitPath);
        return false;
    } catch (error) {
        if (error.code === 'ENOENT') return true;
        throw error;
    }
}

function recordBuildCommit(gitPath, outputPath, allowArchive, override) {
    if (allowArchive && !normalizeSha(override) && isSourceArchive(gitPath)) {
        process.stdout.write('[docker-build] commit unknown (source archive)\n');
        return;
    }
    const commitSha = writeDockerCommitSha(gitPath, outputPath, override);
    process.stdout.write(`[docker-build] commit ${commitSha.slice(0, 12)}\n`);
}

if (require.main === module) {
    try {
        const [gitPath = '/tmp/build-context/.git', outputPath = '/app/docker-commit.sha', mode] =
            process.argv.slice(2);
        recordBuildCommit(
            gitPath,
            outputPath,
            mode === '--allow-source-archive',
            process.env.APP_COMMIT_SHA
        );
    } catch (error) {
        process.stderr.write(`[docker-build] ${error.message}\n`);
        process.exitCode = 1;
    }
}
