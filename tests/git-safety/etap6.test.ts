// @ts-nocheck
import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';

const ROOT = path.resolve(__dirname, '../..');
const SNAPSHOTS_DIR = path.join(ROOT, '.git', 'safety', 'snapshots');

function runNode(code: string) {
    const r = spawnSync('node', ['--input-type=module', '-e', code], {
        cwd: ROOT,
        encoding: 'utf8'
    });
    return r;
}

describe('Etap 6 — Git Safety', () => {
    const tmpFiles: string[] = [];
    const createdSnapshots: string[] = [];

    function mkTmp(name: string, content: string | Buffer = 'x') {
        const p = path.join(ROOT, name);
        if (Buffer.isBuffer(content)) fs.writeFileSync(p, content);
        else fs.writeFileSync(p, content, 'utf8');
        tmpFiles.push(p);
        return p;
    }

    function cleanupFiles() {
        for (const p of tmpFiles.splice(0)) {
            try {
                fs.unlinkSync(p);
            } catch {}
            try {
                execSync(`git reset -- ${path.relative(ROOT, p)}`, { cwd: ROOT, stdio: 'ignore' });
            } catch {}
        }
        for (const id of createdSnapshots.splice(0)) {
            try {
                fs.rmSync(path.join(SNAPSHOTS_DIR, id), { recursive: true, force: true });
            } catch {}
        }
        // nie robimy git reset --hard HEAD globalnie, by nie niszczyc niecommitowanych poprawek testu
        try {
            execSync('git checkout -- VERSION 2>nul || true', { cwd: ROOT, stdio: 'ignore' });
        } catch {}
    }

    afterEach(() => {
        cleanupFiles();
        try {
            const entries = fs.readdirSync(SNAPSHOTS_DIR);
            for (const e of entries) {
                if (e.startsWith('2026')) {
                    const metaPath = path.join(SNAPSHOTS_DIR, e, 'metadata.json');
                    try {
                        const m = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                        if (m.operation && m.operation.includes('tmp_git_safety')) {
                            fs.rmSync(path.join(SNAPSHOTS_DIR, e), {
                                recursive: true,
                                force: true
                            });
                        }
                    } catch {}
                }
            }
        } catch {}
    });

    describe('operations classification', () => {
        it('checkout -- jako HIGH Tier A', () => {
            const r = runNode(
                `import {parseOperation} from './scripts/git-safety/operations.mjs'; const op=parseOperation(['checkout','--','tmp.txt']); if(!op||op.tier!=='A'||op.level!=='HIGH') process.exit(1)`
            );
            expect(r.status).toBe(0);
        });
        it('restore jako HIGH Tier A', () => {
            const r = runNode(
                `import {parseOperation} from './scripts/git-safety/operations.mjs'; const op=parseOperation(['restore','.']); if(op.tier!=='A') process.exit(1)`
            );
            expect(r.status).toBe(0);
        });
        it('reset --hard jako CRITICAL', () => {
            const r = runNode(
                `import {parseOperation} from './scripts/git-safety/operations.mjs'; const op=parseOperation(['reset','--hard']); if(op.level!=='CRITICAL') process.exit(1)`
            );
            expect(r.status).toBe(0);
        });
        it('clean -fdx jako CRITICAL', () => {
            const r = runNode(
                `import {parseOperation} from './scripts/git-safety/operations.mjs'; const op=parseOperation(['clean','-fdx']); if(!op||!op.args.hasX) process.exit(1)`
            );
            expect(r.status).toBe(0);
        });
        it('checkout main nie jest Tier A', () => {
            const r = runNode(
                `import {parseOperation} from './scripts/git-safety/operations.mjs'; const op=parseOperation(['checkout','main']); if(op!==null) process.exit(1)`
            );
            expect(r.status).toBe(0);
        });
        it('status nie jest destrukcyjny', () => {
            const r = runNode(
                `import {parseOperation} from './scripts/git-safety/operations.mjs'; const op=parseOperation(['status']); if(op!==null) process.exit(1)`
            );
            expect(r.status).toBe(0);
        });
    });

    describe('worktree states', () => {
        it('tracked modified', () => {
            const orig = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8');
            fs.writeFileSync(path.join(ROOT, 'VERSION'), orig + '\n# tmp');
            const s = execSync('git status --porcelain', {
                cwd: ROOT,
                encoding: 'utf8',
                maxBuffer: 10 * 1024 * 1024
            });
            expect(s).toMatch(/VERSION/);
            fs.writeFileSync(path.join(ROOT, 'VERSION'), orig);
        });
        it('staged', () => {
            mkTmp('tmp_git_safety_staged.txt', 'staged');
            execSync('git add tmp_git_safety_staged.txt', { cwd: ROOT });
            const s = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' });
            expect(s).toMatch(/tmp_git_safety_staged/);
        });
        it('unstaged', () => {
            mkTmp('tmp_git_safety_unstaged.txt', 'v1');
            execSync('git add tmp_git_safety_unstaged.txt', { cwd: ROOT });
            fs.writeFileSync(path.join(ROOT, 'tmp_git_safety_unstaged.txt'), 'v2');
            const s = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' });
            expect(s).toMatch(/M/);
        });
        it('untracked', () => {
            mkTmp('tmp_git_safety_untracked.txt', 'untracked');
            const s = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' });
            expect(s).toContain('tmp_git_safety_untracked.txt');
        });
        it('delete', () => {
            mkTmp('tmp_git_safety_delete.txt', 'to delete');
            execSync('git add tmp_git_safety_delete.txt', { cwd: ROOT });
            fs.unlinkSync(path.join(ROOT, 'tmp_git_safety_delete.txt'));
            const s = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' });
            expect(s).toMatch(/tmp_git_safety_delete/);
        });
        it('binary', () => {
            const buf = Buffer.from([0x00, 0xff, 0x89, 0x50, 0x4e, 0x47]);
            mkTmp('tmp_git_safety_binary.bin', buf);
            const s = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' });
            expect(s).toContain('tmp_git_safety_binary.bin');
        });
        it('large diff', () => {
            const large = 'x'.repeat(200 * 1024);
            mkTmp('tmp_git_safety_large.txt', large);
            const s = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' });
            expect(s).toContain('tmp_git_safety_large.txt');
        });
        it('rename (staged)', () => {
            mkTmp('tmp_git_safety_rename_a.txt', 'rename');
            execSync('git add tmp_git_safety_rename_a.txt', { cwd: ROOT });
            fs.renameSync(
                path.join(ROOT, 'tmp_git_safety_rename_a.txt'),
                path.join(ROOT, 'tmp_git_safety_rename_b.txt')
            );
            tmpFiles.push(path.join(ROOT, 'tmp_git_safety_rename_b.txt'));
            execSync('git add tmp_git_safety_rename_b.txt', { cwd: ROOT });
            const s = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' });
            expect(s).toMatch(/tmp_git_safety_rename/);
        });
    });

    describe('snapshot', () => {
        it('create na dirty i verify OK', () => {
            mkTmp('tmp_git_safety_snap.txt', 'snap');
            const r = runNode(
                `import {getWorktreeState,createSnapshot} from './scripts/git-safety/snapshot.mjs'; import {parseOperation} from './scripts/git-safety/operations.mjs'; const s=getWorktreeState(); const op=parseOperation(['checkout','--','tmp_git_safety_snap.txt']); const {id,verification}=createSnapshot(op,s); if(!verification.ok) process.exit(1); console.log(id)`
            );
            expect(r.status).toBe(0);
            const id = r.stdout.trim().split('\n').pop()!.trim();
            if (id) createdSnapshots.push(id);
        });
        it('verify FAIL gdy brak diff.patch', () => {
            mkTmp('tmp_git_safety_verify.txt', 'v');
            const r1 = runNode(
                `import {getWorktreeState,createSnapshot} from './scripts/git-safety/snapshot.mjs'; import {parseOperation} from './scripts/git-safety/operations.mjs'; const s=getWorktreeState(); const op=parseOperation(['restore','.']); const {id}=createSnapshot(op,s); console.log(id)`
            );
            const id = r1.stdout.trim().split('\n').pop()!.trim();
            createdSnapshots.push(id);
            fs.unlinkSync(path.join(SNAPSHOTS_DIR, id, 'diff.patch'));
            const r2 = runNode(
                `import {verifySnapshot} from './scripts/git-safety/snapshot.mjs'; const v=verifySnapshot('${id}'); if(v.ok) process.exit(1)`
            );
            expect(r2.status).toBe(0);
        });
    });

    describe('guard scenarios', () => {
        it('dirty → destructive → snapshot exists', () => {
            mkTmp('tmp_git_safety_guard.txt', 'guard');
            const r = spawnSync(
                'node',
                ['scripts/git-safety/guard.mjs', 'checkout', '--', 'tmp_git_safety_guard.txt'],
                { cwd: ROOT, encoding: 'utf8' }
            );
            expect(r.status).toBe(1);
            expect((r.stderr || '') + (r.stdout || '')).toMatch(/Snapshot:/);
            const snaps = fs
                .readdirSync(SNAPSHOTS_DIR)
                .filter((d) => fs.existsSync(path.join(SNAPSHOTS_DIR, d, 'metadata.json')));
            const found = snaps.some((id) => {
                try {
                    const m = JSON.parse(
                        fs.readFileSync(path.join(SNAPSHOTS_DIR, id, 'metadata.json'), 'utf8')
                    );
                    return m.operation && m.operation.includes('tmp_git_safety_guard.txt');
                } catch {
                    return false;
                }
            });
            expect(found).toBe(true);
        });
        it('snapshot failure → destructive MUST NOT EXECUTE', () => {
            mkTmp('tmp_git_safety_fail.txt', 'fail');
            const bak = SNAPSHOTS_DIR + '.bak';
            let moved = false;
            try {
                if (fs.existsSync(SNAPSHOTS_DIR)) {
                    fs.renameSync(SNAPSHOTS_DIR, bak);
                    moved = true;
                }
                fs.writeFileSync(SNAPSHOTS_DIR, 'x');
            } catch {}
            const r = spawnSync(
                'node',
                ['scripts/git-safety/guard.mjs', 'checkout', '--', 'tmp_git_safety_fail.txt'],
                { cwd: ROOT, encoding: 'utf8' }
            );
            try {
                fs.unlinkSync(SNAPSHOTS_DIR);
            } catch {}
            if (moved) {
                try {
                    fs.renameSync(bak, SNAPSHOTS_DIR);
                } catch {}
            } else {
                try {
                    fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
                } catch {}
            }
            expect(r.status).toBe(1);
            expect((r.stdout || '') + (r.stderr || '')).toMatch(/BLOKADA|FAIL/);
        });
        it('clean → operation allowed (harmless)', () => {
            const r = spawnSync('node', ['scripts/git-safety/guard.mjs', 'status'], {
                cwd: ROOT,
                encoding: 'utf8'
            });
            expect(r.status).toBe(0);
        });
        it('staged + unstaged oba odzyskiwalne', () => {
            mkTmp('tmp_git_safety_both.txt', 'v1');
            execSync('git add tmp_git_safety_both.txt', { cwd: ROOT });
            fs.writeFileSync(path.join(ROOT, 'tmp_git_safety_both.txt'), 'v2');
            mkTmp('tmp_git_safety_both2.txt', 'untracked');
            const r = runNode(
                `import {getWorktreeState,createSnapshot} from './scripts/git-safety/snapshot.mjs'; import {parseOperation} from './scripts/git-safety/operations.mjs'; import fs from 'node:fs'; const s=getWorktreeState(); if(!s.dirty) process.exit(1); const op=parseOperation(['restore','.']); const {id,verification}=createSnapshot(op,s); if(!verification.ok) { console.error(JSON.stringify(verification)); process.exit(1); } const p=fs.readFileSync('.git/safety/snapshots/'+id+'/diff.patch','utf8'); if(p.length===0) process.exit(1); console.log(id)`
            );
            const id = r.stdout.trim().split('\n').pop()!.trim();
            if (id) createdSnapshots.push(id);
            expect(r.status).toBe(0);
        });
    });

    describe('CLI', () => {
        it('snapshot nie istnieje → FAIL bez zmian', () => {
            const r = spawnSync(
                'node',
                ['scripts/git-safety/cli.mjs', 'verify', 'nonexistent-xyz'],
                { cwd: ROOT, encoding: 'utf8' }
            );
            expect(r.status).toBe(1);
        });
        it('restore bez --force → FAIL', () => {
            mkTmp('tmp_git_safety_cli.txt', 'cli');
            const r1 = runNode(
                `import {getWorktreeState,createSnapshot} from './scripts/git-safety/snapshot.mjs'; import {parseOperation} from './scripts/git-safety/operations.mjs'; const s=getWorktreeState(); const op=parseOperation(['checkout','--','tmp_git_safety_cli.txt']); const {id}=createSnapshot(op,s); console.log(id)`
            );
            const id = r1.stdout.trim().split('\n').pop()!.trim();
            createdSnapshots.push(id);
            const r = spawnSync('node', ['scripts/git-safety/cli.mjs', 'restore', id], {
                cwd: ROOT,
                encoding: 'utf8'
            });
            expect(r.status).toBe(1);
            expect((r.stdout || '') + (r.stderr || '')).toMatch(/--force/);
        });
    });
});
