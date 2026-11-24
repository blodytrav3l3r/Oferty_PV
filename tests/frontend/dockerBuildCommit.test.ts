// @ts-nocheck
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
    resolveDockerCommitSha,
    writeDockerCommitSha
} from '../../scripts/docker-build-commit.cjs';

describe('Docker build commit metadata', () => {
    let root: string;
    let gitDir: string;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'sok-docker-git-'));
        gitDir = path.join(root, '.git');
        fs.mkdirSync(path.join(gitDir, 'refs', 'heads'), { recursive: true });
    });

    afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

    test('resolves the current branch SHA from a normal checkout', () => {
        const commitSha = 'a'.repeat(40);
        fs.writeFileSync(path.join(gitDir, 'HEAD'), 'ref: refs/heads/main\n');
        fs.writeFileSync(path.join(gitDir, 'refs', 'heads', 'main'), `${commitSha}\n`);

        expect(resolveDockerCommitSha(gitDir)).toBe(commitSha);
    });

    test('resolves a packed branch reference', () => {
        const commitSha = 'b'.repeat(40);
        fs.writeFileSync(path.join(gitDir, 'HEAD'), 'ref: refs/heads/main\n');
        fs.writeFileSync(
            path.join(gitDir, 'packed-refs'),
            `# pack-refs with: peeled fully-peeled\n${commitSha} refs/heads/main\n`
        );

        expect(resolveDockerCommitSha(gitDir)).toBe(commitSha);
    });

    test('prefers a valid SHA supplied by the deployment workflow', () => {
        const commitSha = 'c'.repeat(64);
        expect(resolveDockerCommitSha(path.join(root, 'missing.git'), commitSha)).toBe(commitSha);
    });

    test('writes the resolved SHA for the runtime entrypoint', () => {
        const commitSha = 'd'.repeat(40);
        const outputPath = path.join(root, 'docker-commit.sha');
        fs.writeFileSync(path.join(gitDir, 'HEAD'), 'ref: refs/heads/main\n');
        fs.writeFileSync(path.join(gitDir, 'refs', 'heads', 'main'), `${commitSha}\n`);

        expect(writeDockerCommitSha(gitDir, outputPath)).toBe(commitSha);
        expect(fs.readFileSync(outputPath, 'utf8')).toBe(`${commitSha}\n`);
    });

    test('rejects a checkout without resolvable Git metadata', () => {
        expect(() => resolveDockerCommitSha(path.join(root, 'missing.git'))).toThrow(
            /Cannot resolve Docker image commit SHA/
        );
    });

    function runArchiveBuild(gitPath: string, override = '') {
        const outputPath = path.join(root, 'docker-commit.sha');
        const cli = path.resolve(__dirname, '../../scripts/docker-build-commit.cjs');
        const result = spawnSync(
            process.execPath,
            [cli, gitPath, outputPath, '--allow-source-archive'],
            { encoding: 'utf8', env: { ...process.env, APP_COMMIT_SHA: override } }
        );
        return { result, outputPath };
    }

    test('allows a source ZIP without recording an invented commit SHA', () => {
        const { result, outputPath } = runArchiveBuild(path.join(root, 'missing.git'));

        expect(result.status).toBe(0);
        expect(result.stdout).toMatch(/commit unknown/);
        expect(fs.existsSync(outputPath)).toBe(false);
    });

    test('still rejects incomplete Git metadata when the Git directory exists', () => {
        const { result, outputPath } = runArchiveBuild(gitDir);

        expect(result.status).toBe(1);
        expect(result.stderr).toMatch(/Cannot resolve Docker image commit SHA/);
        expect(fs.existsSync(outputPath)).toBe(false);
    });

    test('records a supplied commit for a source archive', () => {
        const commitSha = 'e'.repeat(40);
        const { result, outputPath } = runArchiveBuild(path.join(root, 'missing.git'), commitSha);

        expect(result.status).toBe(0);
        expect(fs.readFileSync(outputPath, 'utf8')).toBe(`${commitSha}\n`);
    });
});
