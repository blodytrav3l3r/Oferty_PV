const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');

const projectRoot = path.resolve(__dirname, '..', '..');
const launcherPath = path.join(projectRoot, 'start-native.bat');
const startupScriptPath = path.join(projectRoot, 'scripts', 'start-native.ps1');

describe('native Windows launcher contract', () => {
    it('documents the role and impact of every Windows BAT entry point', () => {
        const batFiles = [
            ...fs
                .readdirSync(projectRoot, { withFileTypes: true })
                .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.bat'))
                .map((entry) => path.join(projectRoot, entry.name)),
            ...fs
                .readdirSync(path.join(projectRoot, 'scripts'), { withFileTypes: true })
                .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.bat'))
                .map((entry) => path.join(projectRoot, 'scripts', entry.name))
        ];

        assert.equal(batFiles.length, 15);
        const appVersion = fs.readFileSync(path.join(projectRoot, 'VERSION'), 'utf8').trim();
        for (const batFile of batFiles) {
            const launcher = fs.readFileSync(batFile, 'utf8');
            const versionMarkers = launcher.match(/^REM  Wersja: \d+\.\d+\.\d+$/gm) ?? [];
            assert.match(
                launcher,
                /^REM Rola: .+$/m,
                `${path.relative(projectRoot, batFile)} role`
            );
            assert.match(
                launcher,
                /^REM Uzycie: .+$/m,
                `${path.relative(projectRoot, batFile)} usage`
            );
            assert.match(
                launcher,
                /^REM Wplyw: .+$/m,
                `${path.relative(projectRoot, batFile)} impact`
            );
            assert.match(
                launcher,
                /^REM Uruchamia: .+$/m,
                `${path.relative(projectRoot, batFile)} delegate`
            );
            assert.deepEqual(
                versionMarkers,
                [`REM  Wersja: ${appVersion}`],
                `${path.relative(projectRoot, batFile)} S.O.K. version`
            );
            assert.equal(
                [...Buffer.from(launcher)].every((byte) => byte < 128),
                true,
                `${path.relative(projectRoot, batFile)} ASCII encoding`
            );
        }
    });

    it('keeps documented shortcut names forwarding to their canonical launchers', () => {
        const readLauncher = (name) => fs.readFileSync(path.join(projectRoot, name), 'utf8');

        assert.match(readLauncher('dev.bat'), /start\.bat" --dev %\*/i);
        assert.match(readLauncher('prod.bat'), /start\.bat --prod %\*/i);
        assert.match(readLauncher('start-docker.bat'), /start-postgres\.bat"/i);
    });

    it('documents the separate local database startup flows', () => {
        const start = fs.readFileSync(path.join(projectRoot, 'start.bat'), 'utf8');
        const ensureDatabase = fs.readFileSync(
            path.join(projectRoot, 'scripts', 'ensure-db.bat'),
            'utf8'
        );
        const native = fs.readFileSync(startupScriptPath, 'utf8');
        const readme = fs.readFileSync(path.join(projectRoot, 'README.md'), 'utf8');

        assert.match(start, /call scripts\\ensure-db\.bat/i);
        assert.match(ensureDatabase, /prisma migrate deploy/i);
        assert.match(ensureDatabase, /prisma[\\/]seed\.ts/i);
        assert.match(native, /scripts[\/]check-db\.js/);
        assert.doesNotMatch(native, /migrate\s+deploy|prisma[\\/]seed/i);
        assert.match(
            readme,
            /`start\.bat` jest osobnym, r[eę]cznym trybem: u[zż]ywa `DATABASE_URL` z `\.env`, a `ensure-db\.bat` mo[zż]e wykona[cć] migracje lub seed\./i
        );
        assert.match(readme, /start-native\.bat.*przygotowanej lokalnej bazie/is);
        assert.match(readme, /start-dev\.bat.*testow.*baz/is);
        assert.match(readme, /Kolejny start z Dockerem.*`start-docker\.bat`/);
        assert.match(
            fs.readFileSync(
                path.join(projectRoot, 'docs', 'instalacja-krok-po-kroku-dla-laika.md'),
                'utf8'
            ),
            /Po poprawnej instalacji uruchamiaj `start-docker\.bat`/
        );
    });

    it('uses the versioned BAT entry point and PowerShell helper without Docker', () => {
        const launcher = fs.readFileSync(launcherPath, 'utf8');
        const appVersion = fs.readFileSync(path.join(projectRoot, 'VERSION'), 'utf8').trim();

        assert.ok(launcher.includes(`REM  Wersja: ${appVersion}`));
        assert.match(launcher, /scripts\\start-native\.ps1/i);
        assert.doesNotMatch(launcher, /docker\s+(?:compose|run)/i);
        assert.equal(
            [...Buffer.from(launcher)].every((byte) => byte < 128),
            true
        );
    });

    it('checks the existing local database before starting the app', () => {
        const startupScript = fs.readFileSync(startupScriptPath, 'utf8');

        assert.match(startupScript, /127\.0\.0\.1:55432\/sok_dev/);
        assert.match(startupScript, /scripts[\\/]check-db\.js/);
        assert.match(
            startupScript,
            /if \(\$Watch\) \{\s+& npm\.cmd run dev\s+\} else \{\s+& node\.exe -r ts-node\/register\/transpile-only server\.ts/
        );
    });

    it('selects the first available port when the default app port is busy', () => {
        const startupScript = fs.readFileSync(startupScriptPath, 'utf8');

        assert.match(startupScript, /function Find-AvailableAppPort/);
        assert.match(startupScript, /for \(\$port = 3000; \$port -le 3100; \$port\+\+\)/);
        assert.match(startupScript, /\$appPort = Find-AvailableAppPort/);
        assert.match(startupScript, /PORT = \[string\]\$appPort/);
        assert.match(startupScript, /localhost:\$appPort/);
        assert.match(startupScript, /Port 3000 is occupied; using/);
        assert.match(startupScript, /No free application port is available between 3000 and 3100/);
        assert.doesNotMatch(startupScript, /Port 3000 is already in use/);
    });

    it('routes developer startup through the test database launcher', () => {
        const readLauncher = (name) => fs.readFileSync(path.join(projectRoot, name), 'utf8');
        const developerLauncher = readLauncher('start-dev.bat');

        assert.match(developerLauncher, /start-native\.bat" -Watch -StartTestDatabase/i);
        assert.equal(
            [...Buffer.from(developerLauncher)].every((byte) => byte < 128),
            true
        );
        assert.match(readLauncher('start-docker.bat'), /start-postgres\.bat"/i);
        assert.match(readLauncher('start-native.bat'), /start-native\.ps1" %\*/i);
    });

    it('starts and verifies the isolated test database before the development server', () => {
        const startupScript = fs.readFileSync(startupScriptPath, 'utf8');
        const testDatabaseStart = startupScript.indexOf('function Start-TestDatabase');
        const testDatabaseEnd = startupScript.indexOf('\ntry {', testDatabaseStart);
        const testDatabaseScript = startupScript.slice(testDatabaseStart, testDatabaseEnd);
        const composeStart = startupScript.indexOf('docker.exe compose');
        const databaseCheck = startupScript.indexOf('scripts/postgres-test-url.cjs');
        const appStart = startupScript.indexOf('& npm.cmd run dev');

        assert.match(startupScript, /\[switch\]\$StartTestDatabase/);
        assert.match(testDatabaseScript, /Get-Command docker\.exe/);
        assert.match(
            testDatabaseScript,
            /docker\.exe compose -f docker-compose\.postgres-test\.yml config --quiet/
        );
        assert.match(
            testDatabaseScript,
            /docker\.exe compose -f docker-compose\.postgres-test\.yml up -d --wait/
        );
        assert.ok(composeStart >= 0);
        assert.ok(databaseCheck > composeStart);
        assert.ok(appStart > databaseCheck);
        assert.match(
            testDatabaseScript,
            /docker\.exe info \*> \$null\s+if \(\$LASTEXITCODE -ne 0\) \{\s+throw/
        );
        assert.match(testDatabaseScript, /config --quiet\s+if \(\$LASTEXITCODE -ne 0\) \{\s+throw/);
        assert.match(testDatabaseScript, /up -d --wait\s+if \(\$LASTEXITCODE -eq 0\)/);
        assert.match(
            testDatabaseScript,
            /ps --status running --quiet postgres-test\s+if \(\$LASTEXITCODE -eq 0 -and \$runningContainer\)/
        );
        assert.ok(
            testDatabaseScript.indexOf('ps --status running --quiet postgres-test') <
                testDatabaseScript.indexOf('scripts/postgres-test-url.cjs --prepare-port'),
            'an already-running Compose test service is checked before selecting another port'
        );
        assert.match(testDatabaseScript, /scripts\/postgres-test-url\.cjs --prepare-port/);
        assert.match(testDatabaseScript, /\$env:POSTGRES_TEST_PORT = \[string\]\$portConfig\.port/);
        assert.match(testDatabaseScript, /\$env:POSTGRES_TEST_URL = \[string\]\$portConfig\.url/);
        assert.match(testDatabaseScript, /for \(\$attempt = 0; \$attempt -lt 5; \$attempt\+\+\)/);
        assert.match(startupScript, /POSTGRES_TEST_PORT = \[Environment\]::GetEnvironmentVariable/);
        assert.match(startupScript, /POSTGRES_TEST_URL = \[Environment\]::GetEnvironmentVariable/);
        assert.match(
            testDatabaseScript,
            /scripts\/postgres-test-url\.cjs\s+if \(\$LASTEXITCODE -ne 0\) \{\s+throw/
        );
        assert.doesNotMatch(startupScript, /docker\.exe compose[^\r\n]*down/i);
    });

    it('gives the isolated Compose database its own port by default', () => {
        const compose = fs.readFileSync(
            path.join(projectRoot, 'docker-compose.postgres-test.yml'),
            'utf8'
        );
        const example = fs.readFileSync(path.join(projectRoot, '.env.example'), 'utf8');
        const startupScript = fs.readFileSync(startupScriptPath, 'utf8');
        const testPort = compose.match(/POSTGRES_TEST_PORT:-(\d+)/)?.[1];
        const devPort = startupScript.match(/127\.0\.0\.1:(\d+)\/sok_dev/)?.[1];

        assert.ok(testPort && devPort);
        assert.notEqual(testPort, devPort);
        assert.match(example, new RegExp(`^POSTGRES_TEST_PORT=${testPort}\\r?$`, 'm'));
        assert.ok(example.includes(`@127.0.0.1:${testPort}/sok_test`));
        assert.match(
            fs.readFileSync(path.join(projectRoot, 'docs', 'agents', 'testing.md'), 'utf8'),
            /domy[sś]lnie na `55440`.*port testowy jest zaj[eę]ty.*POSTGRES_TEST_PORT.*POSTGRES_TEST_URL/is
        );
    });

    it('does not migrate, seed, or terminate unrelated processes', () => {
        const startupScript = fs.readFileSync(startupScriptPath, 'utf8');

        assert.doesNotMatch(
            startupScript,
            /migrate\s+deploy|prisma\s+migrate|prisma[\\/]seed|npm\s+run\s+prisma:seed/i
        );
        assert.doesNotMatch(startupScript, /Stop-Process|taskkill/i);
    });
});
