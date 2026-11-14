#!/usr/bin/env node
import core from './deploy-core.cjs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const base = (process.env.APP_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const retries = Number(process.env.DEPLOY_CHECK_RETRIES || '12');
const intervalMs = Number(process.env.DEPLOY_CHECK_INTERVAL_MS || '5000');
const timeoutMs = Number(process.env.DEPLOY_CHECK_TIMEOUT_MS || '1500');
const packageJsonPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'package.json'
);
const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
const expectedVersion = packageJson.version;

const ok = await core.checkDeployment(base, expectedVersion, { retries, intervalMs, timeoutMs });
if (!ok) {
    console.error(
        `[BLAD] /health/ready i /api/version=${expectedVersion} niepotwierdzone po ${retries} probach: ${base}`
    );
    process.exit(1);
}
console.log(`[OK] Aplikacja gotowa; /api/version=${expectedVersion}`);
process.exit(0);
