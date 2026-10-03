/*
 * tests/ci/e2eIsolation.test.ts
 * D-017 (P2-12): izolacja E2E — efemeryczny port + testowa DB + brak reuse.
 * Playwright webServer NIE moze domyslnie startowac na dev :3000 ani
 * dolaczac sie do dzialajacego serwera (reuseExistingServer:true to dziura
 * lokalna: E2E dotyka dev :3000 / live DB). Opt-in tylko przez env.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');
const PW = fs.readFileSync(path.join(ROOT, 'playwright.config.ts'), 'utf8');
const CI = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8');
const SMOKE = fs.readFileSync(
    path.join(ROOT, 'tests', 'playwright', 'smokeOfferFlow.spec.ts'),
    'utf8'
);
const AI_SMOKE = fs.readFileSync(
    path.join(ROOT, 'tests', 'playwright', 'aiDashboardSmoke.spec.ts'),
    'utf8'
);

function e2eJobSection(name: string): string {
    const idx = CI.indexOf(`    ${name}:`);
    expect(idx).toBeGreaterThan(-1);
    const next = CI.indexOf('\n    load-quick:', idx);
    return CI.slice(idx, next === -1 ? idx + 6000 : next);
}

describe('D-017 E2E isolation: playwright webServer', () => {
    it('baseURL default NIE jest :3000 ani :3177', () => {
        expect(PW).not.toMatch(/localhost:3000/);
        expect(PW).not.toMatch(/localhost:3177/);
        expect(PW).toMatch(/PLAYWRIGHT_BASE_URL/);
    });

    it('webServer.url jest na izolowanym porcie (nie :3000)', () => {
        expect(PW).toMatch(/webServer/);
        expect(PW).not.toMatch(/localhost:3000/);
        expect(PW).toMatch(/\/health[`'"]/);
    });

    it('reuseExistingServer default false, opt-in tylko przez env', () => {
        expect(PW).toMatch(/PLAYWRIGHT_REUSE_SERVER/);
        expect(PW).not.toMatch(/reuseExistingServer:\s*true/);
    });

    it('webServer.env wskazuje izolowany plik DB testowej', () => {
        expect(PW).toMatch(/DATABASE_URL/);
        expect(PW).not.toMatch(/app_database\.sqlite/);
        expect(PW).toMatch(/test-playwright\.sqlite|PLAYWRIGHT_DATABASE_URL/);
    });
});

describe('D-017 E2E isolation: specy nie walą w dev :3000', () => {
    it('smokeOfferFlow.spec.ts default NIE jest :3000', () => {
        expect(SMOKE).toMatch(/PLAYWRIGHT_BASE_URL/);
        expect(SMOKE).not.toMatch(/localhost:3000/);
    });

    it('aiDashboardSmoke.spec.ts default NIE jest :3000', () => {
        expect(AI_SMOKE).toMatch(/PLAYWRIGHT_BASE_URL/);
        expect(AI_SMOKE).not.toMatch(/localhost:3000/);
    });
});

describe('D-017 E2E isolation: skrypty .cjs nie walą w dev :3000', () => {
    const CJS = ['excelReliefPair.cjs', 'excelEmptyRowAlignment.cjs', 'partialOrderRury.cjs'].map(
        (f) => fs.readFileSync(path.join(ROOT, 'tests', 'playwright', f), 'utf8')
    );

    it.each([0, 1, 2])('.cjs [%#] honoruje BASE_URL/PLAYWRIGHT_BASE_URL, default :3199', (i) => {
        expect(CJS[i]).toMatch(/PLAYWRIGHT_BASE_URL/);
        expect(CJS[i]).not.toMatch(/localhost:3000/);
        expect(CJS[i]).toMatch(/localhost:3199/);
    });
});

describe('D-017 E2E isolation: CI jobs', () => {
    it('e2e-smoke przygotowuje izolowana DB (nie wspoldzieli dev)', () => {
        const section = e2eJobSection('e2e-smoke');
        expect(section).toMatch(/test-playwright\.sqlite|PLAYWRIGHT_DATABASE_URL/);
        expect(section).not.toMatch(/app_database\.sqlite/);
    });

    it('e2e-extended NIE startuje serwera na :3000', () => {
        const section = e2eJobSection('e2e-extended');
        expect(section).not.toMatch(/PORT=3000/);
        expect(section).not.toMatch(/localhost:3000\/health/);
        expect(section).toMatch(/BASE_URL/);
    });
});
