#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const SNAPSHOTS_DIR = path.join(ROOT, '.git', 'safety', 'snapshots');

export function getWorktreeState() {
    let branch = 'unknown';
    let head = 'unknown';
    try {
        branch = execSync('git rev-parse --abbrev-ref HEAD', {
            cwd: ROOT,
            encoding: 'utf8'
        }).trim();
    } catch {}
    try {
        head = execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
    } catch {}
    let statusText = '';
    try {
        statusText = execSync('git status --porcelain --ignored -uall', {
            cwd: ROOT,
            encoding: 'utf8',
            maxBuffer: 10 * 1024 * 1024
        });
    } catch {
        try {
            statusText = execSync('git status --porcelain -uall', {
                cwd: ROOT,
                encoding: 'utf8',
                maxBuffer: 10 * 1024 * 1024
            });
        } catch {}
    }
    const staged = [];
    const unstaged = [];
    const untracked = [];
    const ignored = [];
    for (const line of statusText.split('\n')) {
        if (!line) continue;
        const x = line[0];
        const y = line[1];
        const file = line.slice(3);
        if (x === '?' && y === '?') untracked.push(file);
        else if (x === '!' && y === '!') ignored.push(file);
        else {
            if (x !== ' ' && x !== '?' && x !== '!') staged.push(file);
            if (y !== ' ' && y !== '?' && y !== '!') unstaged.push(file);
        }
    }
    const dirty = staged.length + unstaged.length + untracked.length > 0;
    return { branch, head, staged, unstaged, untracked, ignored, statusText, dirty };
}

function genId() {
    const ts = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z'); // 20260826T194231Z
    const rand = Math.random().toString(36).slice(2, 8);
    return `${ts}-${rand}`;
}

export function createSnapshot(operation, state) {
    const id = genId();
    const dir = path.join(SNAPSHOTS_DIR, id);
    fs.mkdirSync(dir, { recursive: true });

    const timestamp = new Date().toISOString();
    const metadata = {
        id,
        timestamp,
        operation: operation.raw,
        tier: operation.tier,
        kind: operation.kind,
        level: operation.level,
        branch: state.branch,
        head: state.head,
        expectedFiles: state.staged.length + state.unstaged.length + state.untracked.length,
        worktreeState: {
            staged: state.staged,
            unstaged: state.unstaged,
            untracked: state.untracked,
            ignored: state.ignored
        }
    };

    // status.txt
    fs.writeFileSync(path.join(dir, 'status.txt'), state.statusText, 'utf8');
    // metadata.json
    fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf8');

    // diff.patch — binary diff HEAD (staged+unstaged)
    const patchPath = path.join(dir, 'diff.patch');
    try {
        const diff = execSync('git diff --binary HEAD', {
            cwd: ROOT,
            encoding: 'utf8',
            maxBuffer: 100 * 1024 * 1024
        });
        fs.writeFileSync(patchPath, diff, 'utf8');
    } catch (e) {
        // git diff zwraca 1 gdy są zmiany — to nie błąd
        const out = e.stdout ? e.stdout.toString() : '';
        fs.writeFileSync(patchPath, out, 'utf8');
    }

    // untracked.tar — archiwum untracked (jeśli są)
    const tarPath = path.join(dir, 'untracked.tar');
    const untrackedDir = path.join(dir, 'untracked');
    if (state.untracked.length > 0) {
        let tarOk = false;
        try {
            // użyj tar jeśli dostępny (Git Bash na Windows ma tar) — ścieżki POSIX dla MSYS tar
            const tarPathPosix = tarPath.replace(/\\/g, '/');
            execFileSync('tar', ['-cf', tarPathPosix, ...state.untracked], {
                cwd: ROOT,
                stdio: 'pipe'
            });
            tarOk = fs.existsSync(tarPath) && fs.statSync(tarPath).size > 0;
        } catch (e) {
            try {
                fs.writeFileSync(path.join(dir, 'tar-error.txt'), String(e?.message || e), 'utf8');
            } catch {}
        }
        if (!tarOk) {
            // fallback: skopiuj pliki bez tar (obsługa Windows bez tar lub MSYS path issue)
            try {
                fs.mkdirSync(untrackedDir, { recursive: true });
                for (const f of state.untracked) {
                    const src = path.join(ROOT, f);
                    const dest = path.join(untrackedDir, f);
                    if (fs.existsSync(src)) {
                        fs.mkdirSync(path.dirname(dest), { recursive: true });
                        fs.copyFileSync(src, dest);
                    }
                }
                fs.writeFileSync(tarPath + '.list', state.untracked.join('\n'), 'utf8');
            } catch {}
        }
    }
    } else {
        // pusty marker by verify nie wymagał tar gdy 0 untracked
        if (!fs.existsSync(patchPath)) fs.writeFileSync(patchPath, '', 'utf8');
    }

    // weryfikacja od razu
    const verification = verifySnapshot(id);
    return { id, dir, metadata, verification };
}

export function verifySnapshot(id) {
    const dir = path.join(SNAPSHOTS_DIR, id);
    const metaPath = path.join(dir, 'metadata.json');
    const statusPath = path.join(dir, 'status.txt');
    const patchPath = path.join(dir, 'diff.patch');
    const tarPath = path.join(dir, 'untracked.tar');
    const errors = [];
    if (!fs.existsSync(metaPath)) errors.push('brak metadata.json');
    if (!fs.existsSync(statusPath)) errors.push('brak status.txt');
    if (!fs.existsSync(patchPath)) errors.push('brak diff.patch');
    let meta = null;
    try {
        meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch (e) {
        errors.push(`metadata.json uszkodzony: ${e.message}`);
    }
    if (meta) {
        if (meta.expectedFiles == null) errors.push('brak expectedFiles');
        if (
            meta.expectedFiles > 0 &&
            fs.existsSync(patchPath) &&
            fs.statSync(patchPath).size === 0 &&
            meta.worktreeState?.untracked?.length === 0
        ) {
            // może być tylko staged/unstaged w patch, ale patch pusty to błąd gdy expected>0 i są zmiany
            // pozwól jeśli untracked tylko — patch może być pusty
            const hasStagedUnstaged =
                (meta.worktreeState?.staged?.length ?? 0) +
                    (meta.worktreeState?.unstaged?.length ?? 0) >
                0;
            if (hasStagedUnstaged) errors.push('diff.patch pusty mimo staged/unstaged');
        }
        const expectUntracked = meta.worktreeState?.untracked?.length ?? 0;
        if (expectUntracked > 0 && !fs.existsSync(tarPath) && !fs.existsSync(tarPath + '.list')) {
            errors.push('brak untracked.tar mimo untracked>0');
        }
    }
    return { ok: errors.length === 0, errors, meta, dir };
}

export function snapshotsDir() {
    return SNAPSHOTS_DIR;
}
