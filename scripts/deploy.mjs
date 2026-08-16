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
        // brak uprawnien do loga nie przerywa deploy
    }
}

function usage() {
    console.error('Uzycie: node scripts/deploy.mjs <windows|linux|docker> <tag> [--dry-run]');
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
        throw new Error(
            'Katalog roboczy NIE jest czysty. Na produkcji nie powinno byc lokalnych zmian. Usun lub commituj zmiany przed deploy.'
        );
    }
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const positional = args.filter((a) => !a.startsWith('--'));
if (positional.length !== 2) {
    usage();
}
const [target, tag] = positional;

try {
    core.validateTag(tag);
    core.resolveTarget(target);
    const steps = core.resolveSteps(target, tag);

    if (dryRun) {
        log(`[dry-run] Plan deploy ${target} -> ${tag}:`);
        steps.forEach((s, i) => log(`  ${i + 1}. ${s.name} :: ${s.cmd}`));
        log('[dry-run] Zakonczono bez zadnych zmian. Uruchom bez --dry-run, aby wykonac.');
        process.exit(0);
    }

    checkCleanTree();
    log(`=== DEPLOY ${target} ${tag} START ===`);
    await core.runSequential(steps, runStep);
    log('=== DEPLOY ZAKONCZONY SUKCESEM ===');
    process.exit(0);
} catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log(`[BLAD] ${msg}`);
    log(
        '=== DEPLOY PRZERWANY - wykonaj rollback: node scripts/rollback.mjs <target> <poprzedni_tag> ==='
    );
    process.exit(1);
}
