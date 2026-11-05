import { defineConfig, devices } from '@playwright/test';

// D-017: E2E używa osobnego procesu, portu i schematu PostgreSQL.
// reuseExistingServer jest domyślnie wyłączone; opt-in tylko przez env.
const E2E_PORT = process.env.PLAYWRIGHT_PORT || '3199';
if (!process.env.PLAYWRIGHT_DATABASE_URL) {
    throw new Error('PLAYWRIGHT_DATABASE_URL is required; SQLite is unsupported');
}

export default defineConfig({
    testDir: 'tests/playwright',
    testMatch: ['**/*.spec.ts'],
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
        command: 'npm run build && node tests/playwright/postgresServer.cjs',
        url: `http://localhost:${E2E_PORT}/health`,
        reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === '1',
        timeout: 60_000,
        env: {
            NODE_ENV: 'test',
            PORT: E2E_PORT,
            PLAYWRIGHT_DATABASE_URL: process.env.PLAYWRIGHT_DATABASE_URL,
            TEST_ADMIN_PASSWORD: process.env.TEST_ADMIN_PASSWORD,
            DEFAULT_ADMIN_PASSWORD: process.env.TEST_ADMIN_PASSWORD,
            // Suity care/AI robią setki zapisów i logowań w jednym oknie limiterów.
            RATE_LIMIT_MULT: '100',
            // Determinizm unreadCount: bez throttle każdy GET syncuje powiadomienia.
            CARE_SYNC_THROTTLE_MS: '0'
        }
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
