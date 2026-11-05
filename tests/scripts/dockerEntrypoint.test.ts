import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');

describe('PostgreSQL Docker startup and bootstrap', () => {
    it('includes only expected application files in the Docker context and image', () => {
        const dockerfile = fs.readFileSync(path.join(ROOT, 'Dockerfile'), 'utf8');
        const dockerignore = fs.readFileSync(path.join(ROOT, '.dockerignore'), 'utf8');
        const allowlist = [
            '!package.json',
            '!package-lock.json',
            '!tsconfig.json',
            '!prisma.config.ts',
            '!server.ts',
            '!VERSION',
            '!LICENSE',
            '!THIRD-PARTY-NOTICES.md',
            '!src/',
            '!src/**',
            '!public/',
            '!public/**',
            '!prisma/',
            '!prisma/**',
            '!scripts/',
            '!scripts/**',
            '!data/',
            '!data/seed_preco.json',
            '!data/seed_rury.json',
            '!data/seed_studnie.json',
            '!data/pricelists/',
            '!data/pricelists/active-pricelists.json'
        ];
        const rules = dockerignore
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith('#'));

        expect(rules[0]).toBe('**');
        expect(rules.filter((line) => line.startsWith('!'))).toEqual(allowlist);
        expect(rules.indexOf('data/**')).toBeGreaterThan(rules.indexOf('!data/'));
        expect(rules.indexOf('data/**')).toBeLessThan(rules.indexOf('!data/seed_preco.json'));
        expect(rules.indexOf('data/pricelists/**')).toBeGreaterThan(
            rules.indexOf('!data/pricelists/')
        );
        expect(rules.indexOf('data/pricelists/**')).toBeLessThan(
            rules.indexOf('!data/pricelists/active-pricelists.json')
        );
        expect(dockerfile).not.toMatch(/^COPY\s+\.\s/m);
        expect(dockerfile).toContain(
            'COPY data/pricelists/active-pricelists.json ./data/pricelists/'
        );
        for (const excluded of ['**/.env*', '**/.claude/', '**/.codex/', '**/graphify-out/']) {
            expect(rules.indexOf(excluded)).toBeGreaterThan(
                rules.indexOf('!data/pricelists/active-pricelists.json')
            );
        }
    });

    it('installs the Puppeteer Chrome build in a cache readable by the runtime user', () => {
        const dockerfile = fs.readFileSync(path.join(ROOT, 'Dockerfile'), 'utf8');
        const dockerignore = fs.readFileSync(path.join(ROOT, '.dockerignore'), 'utf8');

        expect(dockerfile).toContain('unzip');
        expect(dockerfile).toContain('rm -rf /app/.cache/puppeteer/chrome');
        expect(dockerfile).toContain('./node_modules/.bin/puppeteer browsers install chrome');
        expect(dockerfile).toContain('chown -R node:node /app/.cache/puppeteer');
        expect(dockerignore).toContain('/.cache/');
    });

    it('keeps the runtime entrypoint free of migration credentials and DDL', () => {
        const source = fs.readFileSync(path.join(ROOT, 'scripts', 'docker-entrypoint.sh'), 'utf8');

        expect(source).toContain('DATABASE_URL');
        expect(source).toContain('exec node dist/server.js');

        const dockerfile = fs.readFileSync(path.join(ROOT, 'Dockerfile'), 'utf8');
        expect(dockerfile).toContain('npm run minify:css');
        expect(source).not.toContain('MIGRATION_DATABASE_URL');
        expect(source).not.toMatch(/migrate deploy|db seed|grant-postgres-roles/i);
        expect(source).not.toMatch(/sqlite|check-db\.js|experimental-sqlite|file:/i);
    });

    it('runs recovery, migrations, grants, and seed in the one-shot bootstrap', () => {
        const source = fs.readFileSync(
            path.join(ROOT, 'scripts', 'docker-db-bootstrap.sh'),
            'utf8'
        );

        expect(source).toContain('MIGRATION_DATABASE_URL');
        expect(source).toContain('recover-failed-initial-migration.mjs');
        expect(source).toContain('npx prisma migrate deploy');
        expect(source).toContain('grant-postgres-roles.mjs');
        expect(source).toContain('npx prisma db seed');
        expect(source).toContain('npx ts-node scripts/bootstrap-admin.ts');
        expect(source.indexOf('migrate deploy')).toBeLessThan(source.indexOf('db seed'));
        expect(source.indexOf('db seed')).toBeLessThan(
            source.indexOf('scripts/bootstrap-admin.ts')
        );
    });

    it('exposes migration and initial-admin credentials only to the one-shot bootstrap service', () => {
        const compose = fs.readFileSync(path.join(ROOT, 'docker-compose.yml'), 'utf8');
        const app = compose.split('    app:\n')[1].split('    db-bootstrap:\n')[0];
        const bootstrap = compose.split('    db-bootstrap:\n')[1].split('\nnetworks:')[0];

        expect(app).not.toContain('MIGRATION_DATABASE_URL');
        expect(app).not.toContain('DEFAULT_ADMIN_PASSWORD');
        expect(app).not.toContain('RESET_ADMIN_PASSWORD_ON_BOOTSTRAP');
        expect(bootstrap).toContain('MIGRATION_DATABASE_URL');
        expect(bootstrap).toContain('DEFAULT_ADMIN_PASSWORD');
        expect(bootstrap).toContain('RESET_ADMIN_PASSWORD_ON_BOOTSTRAP');
        expect(compose).toContain("profiles: ['ops']");
    });

    it('checks the initial admin through the existing idempotent helper and disconnects Prisma', () => {
        const source = fs.readFileSync(path.join(ROOT, 'scripts', 'bootstrap-admin.ts'), 'utf8');

        expect(source).toContain('ensureAdminExists()');
        expect(source).toContain('RESET_ADMIN_PASSWORD_ON_BOOTSTRAP');
        expect(source).toContain('sessions.deleteMany');
        expect(source).toContain('prisma.$disconnect()');
        expect(source).not.toMatch(/console\.(?:info|log|error).*DEFAULT_ADMIN_PASSWORD/i);
        expect(source).not.toMatch(/console\.(?:info|log|error).*password/i);
    });

    it('keeps runtime and backup roles at least-privilege', () => {
        const compose = fs.readFileSync(path.join(ROOT, 'docker-compose.yml'), 'utf8');
        const roles = fs.readFileSync(
            path.join(ROOT, 'docker', 'postgres', 'init-roles.sh'),
            'utf8'
        );

        expect(compose).toContain('BACKUP_DATABASE_URL');
        expect(compose).toContain('sok-backups:/app/data/backups');
        expect(roles).toContain('CREATE ROLE sok_app');
        expect(roles).toContain('CREATE ROLE sok_migrator');
        expect(roles).toContain('CREATE ROLE sok_backup');
        expect(roles).toContain('\\getenv migrator_password SOK_MIGRATOR_PASSWORD');
        expect(roles).not.toMatch(/--set\s+(?:migrator|app|backup)_password=/i);
        expect(roles).not.toMatch(/ALTER ROLE sok_app .*SUPERUSER/i);
    });
});
