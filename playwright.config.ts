import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: 'tests/playwright',
    testMatch: ['**/*.cjs', '**/*.spec.ts'],
    timeout: 30_000,
    expect: { timeout: 5_000 },
    fullyParallel: false,
    retries: 0,
    reporter: [['list'], ['html', { open: 'never' }]],
    use: {
        // PLAYWRIGHT_BASE_URL: testy na izolowanym serwerze (np. :3177),
        // żeby nie dotykać deweloperskiego :3000 ani prod DB.
        baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure'
    },
    webServer: {
        command: 'npm run build && node dist/server.js',
        url: 'http://localhost:3000/health',
        reuseExistingServer: true,
        timeout: 60_000,
        env: { NODE_ENV: 'test', PORT: '3000' }
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
