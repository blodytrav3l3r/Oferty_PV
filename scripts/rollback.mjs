#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import core from './deploy-core.cjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LOG_FILE = path.join(ROOT, 'data', 'deploy-log.log');

function log(msg) {
    const line = `[${new Date().toISOString()}] ${msg}`;
    console.log(line);
    try {
        fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
        fs.appendFileSync(LOG_FILE, line + '\n', 'utf8');
    } catch {
        // brak uprawnien do loga nie przerywa rollback
    }
}

function usage() {
    console.error(
        'Uzycie: node scripts/rollback.mjs <windows|linux|docker> <poprzedni_tag> [--dry-run]'
    );
    process.exit(1);
}

function runStep(step) {
    log(`>> ${step.name}`);
    execSync(step.cmd, { cwd: ROOT, stdio: 'inherit', shell: true });
}

function checkCleanTree() {
    const out = execSync('git status --porcelain', {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
    });
    if (out.trim().length > 0) {
        log('[WARN] Katalog roboczy nie jest czysty - kontynuuje (rollback przywraca stan).');
    }
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const positional = args.filter((a) => !a.startsWith('--'));
if (positional.length !== 2) {
    usage();
}
const [target, previousTag] = positional;

try {
    core.validateTag(previousTag);
    core.resolveTarget(target);
    const backupPath = core.planRollback();
    const steps = core.rollbackSteps(target, previousTag, backupPath);

    if (dryRun) {
        log(`[dry-run] Plan rollback ${target} <- ${previousTag}:`);
        steps.forEach((s, i) => log(`  ${i + 1}. ${s.name} :: ${s.cmd}`));
        log('[dry-run] Zakonczono bez zadnych zmian.');
        process.exit(0);
    }

    checkCleanTree();
    log(`=== ROLLBACK ${target} <- ${previousTag} START ===`);
    await core.runSequential(steps, runStep);
    log('=== ROLLBACK ZAKONCZONY SUKCESEM ===');
    process.exit(0);
} catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log(`[BLAD] ${msg}`);
    log('=== ROLLBACK PRZERWANY - wykonaj kroki recznie wg docs/DEPLOY_UPDATE.md ===');
    process.exit(1);
}
