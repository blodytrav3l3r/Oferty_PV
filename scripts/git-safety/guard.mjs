#!/usr/bin/env node
/**
 * Etap 4 — Safety Gate (Tier A)
 * dirty → snapshot → verify → authorization → exec
 * snapshot FAIL → MUST NOT EXECUTE
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseOperation, hasForceFlag, stripForceFlag } from './operations.mjs';
import { getWorktreeState, createSnapshot, verifySnapshot } from './snapshot.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const AUDIT_LOG = path.join(ROOT, '.git', 'safety', 'audit.log');

function audit(entry) {
    try {
        fs.mkdirSync(path.dirname(AUDIT_LOG), { recursive: true });
        fs.appendFileSync(
            AUDIT_LOG,
            JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n',
            'utf8'
        );
    } catch {}
}

function findRealGit() {
    // wrapper jest w <ROOT>/.git/safety/bin lub scripts/git-safety/wrapper — znajdź prawdziwy git
    const wrapperDir = path.resolve(__dirname);
    const binDir = path.join(ROOT, '.git', 'safety', 'bin');
    const candidates = [];
    try {
        // Windows: `where git` zwraca wszystkie ścieżki
        const out = execFileSync('where', ['git'], { encoding: 'utf8' });
        for (const line of out.split('\n')) {
            const p = line.trim();
            if (!p) continue;
            const norm = path.normalize(p).toLowerCase();
            if (norm.includes(path.normalize(wrapperDir).toLowerCase())) continue;
            if (norm.includes(path.normalize(binDir).toLowerCase())) continue;
            candidates.push(p);
        }
    } catch {
        try {
            const out = execFileSync('which', ['-a', 'git'], { encoding: 'utf8' });
            for (const line of out.split('\n')) {
                const p = line.trim();
                if (!p) continue;
                if (p.includes(wrapperDir) || p.includes(binDir)) continue;
                candidates.push(p);
            }
        } catch {}
    }
    if (candidates.length > 0) return candidates[0];
    // fallback — liczymy że PATH ma git
    return 'git';
}

function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        // `git` bez args — pozwól (np. git status bez wrappera)
        const real = findRealGit();
        const r = spawnSync(real, args, { stdio: 'inherit' });
        process.exit(r.status ?? 0);
    }

    const op = parseOperation(args);
    // harmless lub Tier B — pozwól bez gate (Etap 4 tylko Tier A)
    if (!op || op.tier !== 'A') {
        const real = findRealGit();
        const cleanArgs = stripForceFlag(args);
        // jeśli to Tier B i był --force, usuń przed przekazaniem
        const r = spawnSync(real, cleanArgs, { stdio: 'inherit' });
        process.exit(r.status ?? 0);
    }

    // Tier A — sprawdź dirty
    const state = getWorktreeState();
    if (!state.dirty) {
        // clean → pozwól
        const real = findRealGit();
        const cleanArgs = stripForceFlag(args);
        audit({
            operation: op.raw,
            tier: op.tier,
            level: op.level,
            decision: 'allow-clean',
            branch: state.branch,
            head: state.head
        });
        const r = spawnSync(real, cleanArgs, { stdio: 'inherit' });
        process.exit(r.status ?? 0);
    }

    // dirty + Tier A → snapshot → verify → authorization → exec
    console.log(`[Git Safety] Wykryto destrukcyjną operację Tier A: ${op.raw} (${op.level})`);
    console.log(
        `[Git Safety] Worktree dirty: staged=${state.staged.length} unstaged=${state.unstaged.length} untracked=${state.untracked.length}`
    );

    let snapshot;
    try {
        const res = createSnapshot(op, state);
        snapshot = res;
        console.log(`[Git Safety] Snapshot: ${res.id}`);
    } catch (e) {
        audit({
            operation: op.raw,
            tier: op.tier,
            level: op.level,
            decision: 'block-snapshot-fail',
            error: e.message
        });
        console.error(`[Git Safety] BLOKADA — nie udało się utworzyć snapshotu: ${e.message}`);
        console.error(
            `[Git Safety] Operacja destrukcyjna WSTRZYMANA. Napraw błąd snapshotu i spróbuj ponownie.`
        );
        process.exit(1);
    }

    const verification = snapshot.verification ?? verifySnapshot(snapshot.id);
    if (!verification.ok) {
        audit({
            operation: op.raw,
            tier: op.tier,
            level: op.level,
            snapshotId: snapshot.id,
            decision: 'block-verify-fail',
            errors: verification.errors
        });
        console.error(
            `[Git Safety] BLOKADA — weryfikacja snapshotu FAIL: ${verification.errors.join('; ')}`
        );
        console.error(
            `[Git Safety] Operacja destrukcyjna MUST NOT EXECUTE. Snapshot: ${snapshot.id}`
        );
        process.exit(1);
    }
    console.log(`[Git Safety] Verify OK — snapshot zweryfikowany`);

    if (!hasForceFlag(args)) {
        audit({
            operation: op.raw,
            tier: op.tier,
            level: op.level,
            snapshotId: snapshot.id,
            decision: 'block-needs-auth'
        });
        console.error(
            `[Git Safety] BLOKADA — wymagana jawna autoryzacja dla ${op.level} na dirty worktree.`
        );
        console.error(
            `[Git Safety] Snapshot: ${snapshot.id}  (.git/safety/snapshots/${snapshot.id}/)`
        );
        console.error(`[Git Safety] Aby wykonać destrukcję, uruchom ponownie z --force:`);
        console.error(`[Git Safety]   git ${stripForceFlag(args).join(' ')} --force`);
        console.error(`[Git Safety] Lub: GIT_SAFETY_FORCE=1 git ${stripForceFlag(args).join(' ')}`);
        console.error(`[Git Safety] Odzysk: npm run git:safety:restore -- ${snapshot.id} --force`);
        process.exit(1);
    }

    // autoryzacja OK → wykonaj
    const real = findRealGit();
    const cleanArgs = stripForceFlag(args);
    audit({
        operation: op.raw,
        tier: op.tier,
        level: op.level,
        snapshotId: snapshot.id,
        decision: 'allow-after-snapshot',
        branch: state.branch,
        head: state.head
    });
    console.log(
        `[Git Safety] Autoryzacja OK — wykonuję: git ${cleanArgs.join(' ')} (snapshot ${snapshot.id})`
    );
    const r = spawnSync(real, cleanArgs, { stdio: 'inherit' });
    process.exit(r.status ?? 0);
}

main();
