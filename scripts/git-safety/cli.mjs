#!/usr/bin/env node
/**
 * Etap 3 — CLI Safety (bez enforcement, bez guarda globalnego)
 * Komendy: list, inspect, verify, restore
 * `restore` = odzysk snapshotu, nie `git restore`
 * Kryterium: żadne polecenie nie może utracić dirty worktree
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const SNAPSHOTS_DIR = path.join(ROOT, '.git', 'safety', 'snapshots');

function snapshotsDir() {
    return SNAPSHOTS_DIR;
}

function listSnapshots() {
    if (!fs.existsSync(snapshotsDir())) return [];
    const entries = fs.readdirSync(snapshotsDir(), { withFileTypes: true });
    const dirs = entries.filter((d) => d.isDirectory()).map((d) => d.name);
    const snaps = [];
    for (const id of dirs) {
        const metaPath = path.join(snapshotsDir(), id, 'metadata.json');
        try {
            const raw = fs.readFileSync(metaPath, 'utf8');
            const meta = JSON.parse(raw);
            snaps.push({ id, meta });
        } catch {
            snaps.push({ id, meta: null });
        }
    }
    snaps.sort((a, b) => (b.meta?.timestamp || b.id).localeCompare(a.meta?.timestamp || a.id));
    return snaps;
}

function printHelp() {
    console.log(`Git Safety CLI — Etap 3 (bez enforcement)
Użycie:
  npm run git:safety              # help
  npm run git:safety:list
  npm run git:safety:inspect <id>
  npm run git:safety:verify <id>
  npm run git:safety:restore <id> [--force]

Komendy:
  list              — lista snapshotów L1
  inspect <id>      — szczegóły snapshotu
  verify <id>       — weryfikacja kompletności
  restore <id>      — odzysk snapshotu (nie git restore)

Żadne polecenie nie usunie dirty worktree poza jawnym restore snapshotu.
`);
}

function cmdList() {
    const snaps = listSnapshots();
    if (snaps.length === 0) {
        console.log('Brak snapshotów L1 (.git/safety/snapshots/).');
        console.log('Snapshoty powstaną w Etapie 4 przed destrukcją.');
        return;
    }
    console.log(`Znaleziono ${snaps.length} snapshot(ów):`);
    for (const { id, meta } of snaps) {
        if (!meta) {
            console.log(`  ${id}  — uszkodzony (brak metadata.json)`);
            continue;
        }
        console.log(
            `  ${id}  ${meta.timestamp || ''}  ${meta.branch || ''}@${(meta.head || '').slice(0, 7)}  ${meta.operation || ''}  (${meta.level || ''})`
        );
    }
}

function loadSnapshot(id) {
    const dir = path.join(snapshotsDir(), id);
    const metaPath = path.join(dir, 'metadata.json');
    if (!fs.existsSync(dir)) {
        console.error(`Snapshot nie istnieje: ${id}`);
        process.exit(1);
    }
    let meta = null;
    try {
        meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch (e) {
        console.error(`Snapshot uszkodzony (metadata.json): ${e.message}`);
        process.exit(1);
    }
    return { dir, meta, metaPath };
}

function cmdInspect(id) {
    if (!id) {
        console.error('Użycie: npm run git:safety:inspect <snapshot-id>');
        process.exit(1);
    }
    const { dir, meta } = loadSnapshot(id);
    console.log(`Snapshot: ${id}`);
    console.log(`  timestamp: ${meta.timestamp}`);
    console.log(`  branch: ${meta.branch}`);
    console.log(`  head: ${meta.head}`);
    console.log(`  operation: ${meta.operation}`);
    console.log(`  level: ${meta.level}`);
    console.log(`  tier/kind: ${meta.tier}/${meta.kind}`);
    console.log(`  expectedFiles: ${meta.expectedFiles}`);
    const statusPath = path.join(dir, 'status.txt');
    const patchPath = path.join(dir, 'diff.patch');
    const tarPath = path.join(dir, 'untracked.tar');
    console.log(`  status.txt: ${fs.existsSync(statusPath) ? 'OK' : 'BRAK'}`);
    console.log(
        `  diff.patch: ${fs.existsSync(patchPath) ? `${fs.statSync(patchPath).size} B` : 'BRAK'}`
    );
    console.log(
        `  untracked.tar: ${fs.existsSync(tarPath) ? `${fs.statSync(tarPath).size} B` : 'BRAK'}`
    );
    if (meta.worktreeState) {
        console.log(
            `  worktree: staged=${meta.worktreeState.staged?.length ?? 0} unstaged=${meta.worktreeState.unstaged?.length ?? 0} untracked=${meta.worktreeState.untracked?.length ?? 0}`
        );
    }
}

function verifySnapshot(id) {
    const { dir, meta } = loadSnapshot(id);
    const statusPath = path.join(dir, 'status.txt');
    const patchPath = path.join(dir, 'diff.patch');
    const tarPath = path.join(dir, 'untracked.tar');
    const errors = [];
    if (!fs.existsSync(statusPath)) errors.push('brak status.txt');
    if (!fs.existsSync(patchPath)) errors.push('brak diff.patch');
    else if (fs.statSync(patchPath).size === 0 && (meta.expectedFiles ?? 0) > 0)
        errors.push('diff.patch pusty mimo expectedFiles>0');
    const expectUntracked = meta.worktreeState?.untracked?.length ?? 0;
    if (expectUntracked > 0 && !fs.existsSync(tarPath))
        errors.push('brak untracked.tar mimo untracked>0');
    if (meta.expectedFiles == null) errors.push('brak expectedFiles w metadata');
    const ok = errors.length === 0;
    return { ok, errors, meta, dir };
}

function cmdVerify(id) {
    if (!id) {
        console.error('Użycie: npm run git:safety:verify <snapshot-id>');
        process.exit(1);
    }
    const { ok, errors, meta } = verifySnapshot(id);
    if (ok) {
        console.log(`VERIFY OK — ${id} (${meta.expectedFiles} plików oczekiwanych)`);
        process.exit(0);
    }
    console.error(`VERIFY FAIL — ${id}: ${errors.join('; ')}`);
    process.exit(1);
}

function doRestoreSync(id) {
    const { ok, errors } = verifySnapshot(id);
    if (!ok) {
        console.error(`Nie można przywrócić — snapshot uszkodzony: ${errors.join('; ')}`);
        process.exit(1);
    }
    const dir = path.join(snapshotsDir(), id);
    const patchPath = path.join(dir, 'diff.patch');
    const tarPath = path.join(dir, 'untracked.tar');
    try {
        if (fs.existsSync(patchPath) && fs.statSync(patchPath).size > 0) {
            try {
                execFileSync('git', ['apply', '--check', '--whitespace=nowarn', patchPath], {
                    cwd: ROOT,
                    stdio: 'pipe'
                });
            } catch (e) {
                const msg = e.stderr ? e.stderr.toString() : e.message;
                console.error(`Restore niepełny — git apply --check FAIL: ${msg}`);
                process.exit(1);
            }
            execFileSync('git', ['apply', '--whitespace=nowarn', patchPath], {
                cwd: ROOT,
                stdio: 'inherit'
            });
        }
        if (fs.existsSync(tarPath) && fs.statSync(tarPath).size > 0) {
            try {
                execFileSync('tar', ['-tf', tarPath], { stdio: 'pipe' });
                execFileSync('tar', ['-xf', tarPath, '-C', ROOT], { stdio: 'inherit' });
            } catch (e) {
                console.error(`Restore niepełny — tar FAIL: ${e.message}`);
                process.exit(1);
            }
        }
        console.log(`Restore OK — ${id}`);
    } catch (e) {
        console.error(`Restore FAIL — ${e.message}`);
        process.exit(1);
    }
}

const [, , cmd, arg] = process.argv;
switch (cmd) {
    case undefined:
    case 'help':
    case '--help':
    case '-h':
        printHelp();
        break;
    case 'list':
        cmdList();
        break;
    case 'inspect':
        cmdInspect(arg);
        break;
    case 'verify':
        cmdVerify(arg);
        break;
    case 'restore':
        if (!process.argv.includes('--force')) {
            console.log('UWAGA: restore nadpisze pliki worktree stanem snapshotu.');
            console.log(`Snapshot: ${arg}`);
            console.log('Uruchom ponownie z --force aby potwierdzić.');
            process.exit(1);
        }
        doRestoreSync(arg);
        break;
    default:
        console.error(`Nieznana komenda: ${cmd}`);
        printHelp();
        process.exit(1);
}
