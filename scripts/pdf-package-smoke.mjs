#!/usr/bin/env node
// Smoke-test PRAWDZIWEGO pakietu puppeteer — celowo poza Jest (jest.config.ts mapuje
// `puppeteer` na tests/mocks/puppeteer.stub.js, więc testy jednostkowe nie widzą
// zmian API pakietu). Weryfikuje kontrakt, który psuł /health/pdf w Puppeteer 25:
// executablePath() jest asynchroniczne, a wynik da się realnie uruchomić.
// Użycie: npm run pdf:smoke:package (exit 0 = OK, exit 1 = FAIL)
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';

const failures = [];

function check(label, condition, detail = '') {
    if (condition) {
        console.log(`[OK] ${label}${detail ? ` — ${detail}` : ''}`);
        return;
    }
    failures.push(label);
    console.error(`[FAIL] ${label}${detail ? ` — ${detail}` : ''}`);
}

const execPathResult = puppeteer.executablePath();
check(
    'executablePath() zwraca Promise (nie string)',
    execPathResult !== null && typeof execPathResult.then === 'function',
    `typeof=${typeof execPathResult}`
);

const execPath = await execPathResult;
check('executablePath() rozwiązuje się do istniejącego pliku', fs.existsSync(execPath), execPath);
check('basename bez separatorów', !path.basename(execPath.replace(/\\/g, '/')).includes('/'));

let browser;
try {
    browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage();
    await page.setContent('<h1>smoke</h1>');
    const pdf = await page.pdf({ format: 'A4' });
    check('render PDF zwraca bajty', pdf.length > 0, `${pdf.length} B`);
    check('nagłówek %PDF-', Buffer.from(pdf.subarray(0, 5)).toString('latin1') === '%PDF-');
} catch (e) {
    check('launch + render PDF', false, e instanceof Error ? e.message : String(e));
} finally {
    if (browser) await browser.close();
}

if (failures.length > 0) {
    console.error(`[BLAD] Smoke pakietu puppeteer: ${failures.length} niepowodzeń.`);
    process.exit(1);
}
console.log('[OK] Smoke pakietu puppeteer: OK');
