#!/usr/bin/env node
import core from './deploy-core.cjs';

const base = (process.env.APP_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const url = `${base}/health`;
const retries = Number(process.env.DEPLOY_CHECK_RETRIES || '12');
const intervalMs = Number(process.env.DEPLOY_CHECK_INTERVAL_MS || '5000');

const ok = await core.checkHealth(url, { retries, intervalMs });
if (!ok) {
    console.error(`[BLAD] /health nie odpowiada 200 po ${retries} probach: ${url}`);
    process.exit(1);
}
console.log(`[OK] Health ${url} -> 200`);
process.exit(0);
