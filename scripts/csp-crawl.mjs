import { chromium } from 'playwright';
import { execSync, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

async function waitForServer(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch { }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('Server did not start');
}

async function main() {
  // Clean CSP log
  const logFile = path.join(ROOT, 'logs', 'csp-violations.log');
  if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

  // Kill any existing node processes on our port
  try {
    execSync('taskkill /f /im node.exe /t 2>nul', { stdio: 'ignore' });
    await new Promise(r => setTimeout(r, 2000));
  } catch { }

  // Start server
  const env = { ...process.env, CSP_MODE: 'report-only' };
  const server = spawn('npx', ['ts-node-dev', '--respawn', './server.ts'], {
    cwd: ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true
  });

  const outPath = path.join(ROOT, 'logs', 'crawl-server.log');
  const outStream = fs.createWriteStream(outPath);
  server.stdout.pipe(outStream);
  server.stderr.pipe(outStream);

  try {
    console.log('Waiting for server...');
    await waitForServer('http://localhost:3000/health');
    console.log('Server is up.');

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();

    // Listen for CSP report POSTs
    const cspReports = [];
    page.on('request', req => {
      if (req.url().includes('/api/security/csp-report')) {
        cspReports.push({ url: req.url(), method: req.method() });
      }
    });

    page.on('console', msg => {
      if (msg.type() === 'error') console.log('[BROWSER ERROR]', msg.text());
    });

    // Step 1: Login page
    console.log('1. Loading login page...');
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);

    // Step 2: Login
    console.log('2. Logging in...');
    await page.fill('#login-username', 'admin');
    await page.fill('#login-password', 'adnim123456789');
    await page.click('.login-btn');
    await page.waitForTimeout(2000);

    // Step 3: Main dashboard (app.html)
    console.log('3. Dashboard...');
    await page.goto('http://localhost:3000/app.html', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Step 4: Rury module
    console.log('4. Rury module...');
    await page.goto('http://localhost:3000/app.html#/rury', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(3000);
    // Try clicking some buttons
    try { await page.click('#btn-new-offer', { timeout: 3000 }); await page.waitForTimeout(3000); } catch { }
    try { await page.click('#offers-tab', { timeout: 3000 }); await page.waitForTimeout(2000); } catch { }

    // Step 5: Studnie module
    console.log('5. Studnie module...');
    await page.goto('http://localhost:3000/app.html#/studnie', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(3000);

    // Step 6: Well configuration interactions
    console.log('6. Well interactions...');
    try { await page.click('#btn-add-well', { timeout: 3000 }); await page.waitForTimeout(2000); } catch { }
    try { await page.click('.config-tile', { timeout: 3000 }); await page.waitForTimeout(2000); } catch { }

    // Step 7: Kartoteka
    console.log('7. Kartoteka...');
    await page.goto('http://localhost:3000/app.html#/kartoteka', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(3000);

    // Step 8: Import/Export
    console.log('8. Import/Export...');
    await page.goto('http://localhost:3000/app.html#/import-export', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(3000);

    // Step 9: Try direct module access (bypass SPA)
    console.log('9. Direct module access...');
    await page.goto('http://localhost:3000/public/studnie.html', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.goto('http://localhost:3000/public/rury.html', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.goto('http://localhost:3000/public/kartoteka.html', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.goto('http://localhost:3000/public/zlecenia.html', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.goto('http://localhost:3000/public/etykieta.html', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Step 10: Logout
    console.log('10. Logout...');
    try { await page.click('#logout-btn', { timeout: 3000 }); await page.waitForTimeout(2000); } catch { }

    await browser.close();

    // Check results
    console.log(`\nCSP reports intercepted: ${cspReports.length}`);
    if (fs.existsSync(logFile)) {
      const content = fs.readFileSync(logFile, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      console.log(`CSP violations logged: ${lines.length}`);
      const fingerprints = {};
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          const key = `${entry.violatedDirective} | ${entry.blockedURI} | ${entry.sourceFile}`;
          fingerprints[key] = (fingerprints[key] || 0) + 1;
        } catch {}
      }
      console.log('\n=== CSP violation fingerprints ===');
      for (const [key, count] of Object.entries(fingerprints).sort((a, b) => b[1] - a[1])) {
        console.log(`  x${count} ${key}`);
      }
    } else {
      console.log('NO CSP violations logged.');
    }
  } finally {
    server.kill();
    outStream.end();
  }
}

main().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
