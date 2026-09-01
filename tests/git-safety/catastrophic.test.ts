// @ts-nocheck
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync, spawnSync } from 'node:child_process';

const ROOT = path.resolve(__dirname, '../..');
const SNAPSHOTS_DIR = path.join(ROOT, '.git', 'safety', 'snapshots');

function runNode(code: string) {
    const r = spawnSync('node', ['--input-type=module', '-e', code], {
        cwd: ROOT,
        encoding: 'utf8'
    });
    if (r.status !== 0)
        throw new Error(`runNode failed: ${r.stderr}\n${r.stdout}\ncode: ${r.status}`);
    return r.stdout.trim();
}

function hashFile(p: string): string {
    const data = fs.readFileSync(p);
    const norm = data.toString('utf8').replace(/\r\n/g, '\n');
    return crypto.createHash('sha256').update(norm).digest('hex');
}

function captureState(files: string[]) {
    const out: Record<string, { exists: boolean; hash: string | null; status: string }> = {};
    const status = execSync('git status --porcelain', {
        cwd: ROOT,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024
    });
    for (const f of files) {
        const abs = path.join(ROOT, f);
        const exists = fs.existsSync(abs);
        out[f] = {
            exists,
            hash: exists ? hashFile(abs) : null,
            status: status.split('\n').find((l) => l.includes(f)) || ''
        };
    }
    return { files: out, status };
}

describe('Etap 7 — katastroficzny recovery', () => {
    const createdSnapshots: string[] = [];
    const tmpPrefix = 'tmp_cata_';

    afterEach(() => {
        for (const id of createdSnapshots.splice(0)) {
            try {
                fs.rmSync(path.join(SNAPSHOTS_DIR, id), { recursive: true, force: true });
            } catch {}
        }
        try {
            const entries = fs.readdirSync(ROOT);
            for (const e of entries) {
                if (e.startsWith(tmpPrefix)) {
                    try {
                        fs.unlinkSync(path.join(ROOT, e));
                    } catch {}
                    try {
                        execSync(`git reset -- ${e}`, { cwd: ROOT, stdio: 'ignore' });
                    } catch {}
                }
            }
            // no global reset
            for (const e of fs.readdirSync(ROOT)) {
                if (e.startsWith(tmpPrefix)) {
                    try {
                        fs.unlinkSync(path.join(ROOT, e));
                    } catch {}
                }
            }
        } catch {}
        try {
            const snaps = fs.readdirSync(SNAPSHOTS_DIR);
            for (const id of snaps) {
                const mPath = path.join(SNAPSHOTS_DIR, id, 'metadata.json');
                try {
                    const m = JSON.parse(fs.readFileSync(mPath, 'utf8'));
                    if (m.operation && m.operation.includes('tmp_cata')) {
                        fs.rmSync(path.join(SNAPSHOTS_DIR, id), { recursive: true, force: true });
                    }
                } catch {}
            }
        } catch {}
    });

    it('BEFORE == AFTER dla 10 plikow staged/unstaged/untracked', () => {
        const files: string[] = [];
        for (let i = 0; i < 10; i++) {
            const name = `${tmpPrefix}${i}.txt`;
            const content = `cata-${i}-` + 'x'.repeat(i * 100) + `-end-${i}`;
            fs.writeFileSync(path.join(ROOT, name), content, 'utf8');
            files.push(name);
        }
        fs.writeFileSync(path.join(ROOT, `${tmpPrefix}large.txt`), 'L'.repeat(150 * 1024));
        files.push(`${tmpPrefix}large.txt`);

        execSync(`git add ${tmpPrefix}0.txt ${tmpPrefix}1.txt ${tmpPrefix}2.txt`, { cwd: ROOT });
        fs.appendFileSync(path.join(ROOT, `${tmpPrefix}1.txt`), '\nmod-unstaged');
        fs.appendFileSync(path.join(ROOT, `${tmpPrefix}2.txt`), '\nmod-unstaged2');

        const before = captureState(files);
        expect(Object.keys(before.files).length).toBe(files.length);
        const beforeStatus = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' });
        expect(beforeStatus).toMatch(/tmp_cata/);

        const id = runNode(
            `import {getWorktreeState,createSnapshot} from './scripts/git-safety/snapshot.mjs'; import {parseOperation} from './scripts/git-safety/operations.mjs'; const s=getWorktreeState(); const op=parseOperation(['restore','.']); const {id,verification}=createSnapshot(op,s); if(!verification.ok) { console.error(JSON.stringify(verification)); process.exit(1); } console.log(id)`
        )
            .split('\n')
            .pop()!
            .trim();
        createdSnapshots.push(id);
        const verify = spawnSync('node', ['scripts/git-safety/cli.mjs', 'verify', id], {
            cwd: ROOT,
            encoding: 'utf8'
        });
        expect(verify.status).toBe(0);

        // no global reset
        for (const f of files) {
            try {
                fs.unlinkSync(path.join(ROOT, f));
            } catch {}
        }
        execSync(`git reset -- ${files.join(' ')}`, { cwd: ROOT, stdio: 'ignore' });

        const afterDestruct = captureState(files);
        const goneCount = files.filter((f) => !fs.existsSync(path.join(ROOT, f))).length;
        expect(goneCount).toBeGreaterThan(5);

        const restore = spawnSync(
            'node',
            ['scripts/git-safety/cli.mjs', 'restore', id, '--force'],
            { cwd: ROOT, encoding: 'utf8' }
        );
        expect(restore.status).toBe(0);

        const after = captureState(files);
        for (const f of files) {
            const b = before.files[f];
            const a = after.files[f];
            expect(a.exists).toBe(b.exists);
            if (b.exists) {
                expect(a.hash).toBe(b.hash);
            }
        }
        const beforeCount = (before.status.match(/tmp_cata/g) || []).length;
        const afterCount = (after.status.match(/tmp_cata/g) || []).length;
        expect(afterCount).toBe(beforeCount);
    });
});
