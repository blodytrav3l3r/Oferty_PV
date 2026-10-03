import { defineConfig, devices } from '@playwright/test';

// D-017: E2E na izolowanym porcie :3199 (nie dev :3000, nie --spawn :3177/:3178)
// + izolowany plik DB. reuseExistingServer default false (dziura lokalna);
// opt-in tylko przez PLAYWRIGHT_REUSE_SERVER=1.
const E2E_PORT = process.env.PLAYWRIGHT_PORT || '3199';
const E2E_DB =
    process.env.PLAYWRIGHT_DATABASE_URL ||
    'file:./test-playwright.sqlite?connection_limit=1&busy_timeout=30000';

export default defineConfig({
    testDir: 'tests/playwright',
    testMatch: ['**/*.cjs', '**/*.spec.ts'],
    timeout: 30_000,
    expect: { timeout: 5_000 },
    fullyParallel: false,
    retries: 0,
    reporter: [['list'], ['html', { open: 'never' }]],
    use: {
        // PLAYWRIGHT_BASE_URL: testy na izolowanym serwerze :3199,
        // żeby nie dotykać deweloperskiego :3000 ani prod DB.
        baseURL: process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${E2E_PORT}`,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure'
    },
    webServer: {
        command: 'npm run build && node dist/server.js',
        url: `http://localhost:${E2E_PORT}/health`,
        reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === '1',
        timeout: 60_000,
        env: { NODE_ENV: 'test', PORT: E2E_PORT, DATABASE_URL: E2E_DB }
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
