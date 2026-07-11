const { chromium } = require('C:\\Users\\blody\\AppData\\Roaming\\npm\\node_modules\\omniroute\\node_modules\\playwright');
const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');

async function waitForServer(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch (e) {}
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('Server did not start');
}

async function main() {
  console.log('[crawl] starting...');
  // Clean CSP log
  const logFile = path.join(ROOT, 'logs', 'csp-violations.log');
  if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

  // Kill only port 3000 node process (not self)
  try {
    const portPid = execSync('netstat -ano | findstr :3000 | findstr LISTENING', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    const lines = portPid.trim().split('\n').filter(Boolean);
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0' && parseInt(pid) !== process.pid) {
        try { process.kill(parseInt(pid)); } catch (e) {}
      }
    }
    await new Promise(r => setTimeout(r, 2000));
  } catch (e) {}

  // Start server via npm script
  const env = { ...process.env, CSP_MODE: 'report-only' };
  const server = spawn('cmd', ['/c', 'npx ts-node-dev --respawn ./server.ts'], {
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
    let cspReportCount = 0;
    page.on('request', req => {
      if (req.url().includes('/api/security/csp-report')) {
        cspReportCount++;
      }
    });

    page.on('console', msg => {
      if (msg.type() === 'error') console.log('[BROWSER ERROR]', msg.text());
    });

    // Step 1: Login page
    console.log('1. Loading login page...');
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 15000 }).catch(e => console.log('  timeout, continuing'));
    await page.waitForTimeout(2000);

    // Step 2: Login
    console.log('2. Logging in...');
    try {
      await page.fill('#login-username', 'admin');
      await page.fill('#login-password', 'adnim123456789');
      await page.click('.login-btn');
      await page.waitForTimeout(3000);
    } catch (e) {
      console.log('  login interaction failed:', e.message.substring(0, 80));
    }

    // Step 3: Main dashboard / app.html
    console.log('3. App page...');
    await page.goto('http://localhost:3000/app.html', { waitUntil: 'networkidle', timeout: 15000 }).catch(e => console.log('  timeout, continuing'));
    await page.waitForTimeout(3000);

    // Step 4: Rury module via SPA
    console.log('4. Rury module...');
    await page.goto('http://localhost:3000/app.html#/rury', { waitUntil: 'networkidle', timeout: 15000 }).catch(e => console.log('  timeout, continuing'));
    await page.waitForTimeout(4000);

    // Step 5: Studnie module via SPA
    console.log('5. Studnie module...');
    await page.goto('http://localhost:3000/app.html#/studnie', { waitUntil: 'networkidle', timeout: 15000 }).catch(e => console.log('  timeout, continuing'));
    await page.waitForTimeout(4000);

    // Step 6: Kartoteka via SPA
    console.log('6. Kartoteka module...');
    await page.goto('http://localhost:3000/app.html#/kartoteka', { waitUntil: 'networkidle', timeout: 15000 }).catch(e => console.log('  timeout, continuing'));
    await page.waitForTimeout(3000);

    // Step 7: Direct access to modules
    console.log('7. Direct HTML pages...');
    const pages = ['studnie.html', 'rury.html', 'kartoteka.html', 'zlecenia.html', 'etykieta.html'];
    for (const p of pages) {
      try {
        await page.goto(`http://localhost:3000/public/${p}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await page.waitForTimeout(1500);
      } catch (e) {
        console.log(`  ${p}: timeout`);
      }
    }

    // Step 8: Try PDF endpoint
    console.log('8. API endpoints...');
    try {
      await page.goto('http://localhost:3000/api/offers', { waitUntil: 'domcontentloaded', timeout: 10000 });
      await page.waitForTimeout(1000);
    } catch (e) {}

    await browser.close();

    // Check results
    console.log(`\nCSP POST reports intercepted in browser: ${cspReportCount}`);
    if (fs.existsSync(logFile)) {
      const content = fs.readFileSync(logFile, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      console.log(`CSP violations logged to file: ${lines.length}`);
      if (lines.length > 0) {
        const fingerprints = {};
        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            const key = `${entry.violatedDirective} | ${entry.blockedURI} | ${entry.sourceFile || '-'}`;
            fingerprints[key] = (fingerprints[key] || 0) + 1;
          } catch (e) {}
        }
        console.log('\n=== CSP violation fingerprints ===');
        for (const [key, count] of Object.entries(fingerprints).sort((a, b) => b[1] - a[1])) {
          console.log(`  x${count}  ${key}`);
        }
        console.log('\nFull log content:');
        console.log(content);
      } else {
        console.log('CSP log file is empty.');
      }
    } else {
      console.log('NO csp-violations.log file created.');
    }
  } finally {
    server.kill();
    outStream.end();
  }
}

main().catch(err => {
  console.error('FAILED:', err.message || err);
  process.exit(1);
});
