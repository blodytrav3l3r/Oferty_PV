const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, it } = require('node:test');

const projectRoot = path.resolve(__dirname, '..', '..');
const launcherPath = path.join(projectRoot, 'start-native.bat');
const startupScriptPath = path.join(projectRoot, 'scripts', 'start-native.ps1');
const commitInfoPath = path.join(projectRoot, 'scripts', 'commit-info.mjs');

describe('native Windows launcher contract', () => {
    it('shows the local build commit beside origin/main and marks dirty files', () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sok-commit-info-'));
        const localRepo = path.join(tempRoot, 'checkout');
        const remoteRepo = path.join(tempRoot, 'origin.git');
        fs.mkdirSync(localRepo);

        try {
            execFileSync('git', ['init', '--bare', '--initial-branch=main', remoteRepo]);
            execFileSync('git', ['init', '--initial-branch=main'], { cwd: localRepo });
            execFileSync('git', ['config', 'user.name', 'SOK test'], { cwd: localRepo });
            execFileSync('git', ['config', 'user.email', 'sok-test@example.invalid'], {
                cwd: localRepo
            });
            fs.writeFileSync(path.join(localRepo, 'tracked.txt'), 'initial');
            execFileSync('git', ['add', 'tracked.txt'], { cwd: localRepo });
            execFileSync('git', ['commit', '-m', 'initial'], { cwd: localRepo });
            execFileSync('git', ['remote', 'add', 'origin', remoteRepo], { cwd: localRepo });
            execFileSync('git', ['push', '-u', 'origin', 'main'], { cwd: localRepo });

            const localSha = execFileSync('git', ['rev-parse', 'HEAD'], {
                cwd: localRepo,
                encoding: 'utf8'
            }).trim();
            const initialOutput = execFileSync(process.execPath, [commitInfoPath, '--batch'], {
                cwd: localRepo,
                encoding: 'utf8'
            });

            assert.match(initialOutput, new RegExp(`^APP_COMMIT_SHA=${localSha}$`, 'm'));
            assert.match(
                initialOutput,
                new RegExp(`^INFO_REMOTE=Latest origin/main: ${localSha.slice(0, 12)}$`, 'm')
            );
            assert.match(initialOutput, /^INFO_STATE=Local code matches origin\/main\.$/m);
            assert.match(initialOutput, /^INFO_DIRTY=Working tree is clean\.$/m);

            const updaterRepo = path.join(tempRoot, 'updater');
            execFileSync('git', ['clone', remoteRepo, updaterRepo]);
            execFileSync('git', ['config', 'user.name', 'SOK updater'], { cwd: updaterRepo });
            execFileSync('git', ['config', 'user.email', 'sok-updater@example.invalid'], {
                cwd: updaterRepo
            });
            fs.writeFileSync(path.join(updaterRepo, 'tracked.txt'), 'remote update');
            execFileSync('git', ['commit', '-am', 'remote update'], { cwd: updaterRepo });
            execFileSync('git', ['push', 'origin', 'main'], { cwd: updaterRepo });

            const remoteAheadOutput = execFileSync(process.execPath, [commitInfoPath, '--batch'], {
                cwd: localRepo,
                encoding: 'utf8'
            });
            assert.match(
                remoteAheadOutput,
                /^INFO_STATE=Local code differs from origin\/main; launcher will use local files\.$/m
            );

            fs.writeFileSync(path.join(localRepo, 'uncommitted.txt'), 'local-only');
            fs.writeFileSync(path.join(localRepo, 'tracked.txt'), 'locally modified');
            const dirtyOutput = execFileSync(process.execPath, [commitInfoPath, '--batch'], {
                cwd: localRepo,
                encoding: 'utf8'
            });

            assert.match(
                dirtyOutput,
                /^INFO_DIRTY=WARNING: working tree has uncommitted changes; SHA identifies HEAD only\.$/m
            );
            const statusOutput = execFileSync(process.execPath, [commitInfoPath], {
                cwd: localRepo,
                encoding: 'utf8'
            });
            assert.match(statusOutput, /  tracked\.txt\n/);
            assert.match(statusOutput, /  uncommitted\.txt\n/);
        } finally {
            fs.rmSync(tempRoot, { recursive: true, force: true });
        }
    });

    it('keeps the local commit usable when origin/main cannot be checked', () => {
        const localRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'sok-no-origin-'));
        try {
            execFileSync('git', ['init', '--initial-branch=main'], { cwd: localRepo });
            execFileSync('git', ['config', 'user.name', 'SOK test'], { cwd: localRepo });
            execFileSync('git', ['config', 'user.email', 'sok-test@example.invalid'], {
                cwd: localRepo
            });
            fs.writeFileSync(path.join(localRepo, 'tracked.txt'), 'initial');
            execFileSync('git', ['add', 'tracked.txt'], { cwd: localRepo });
            execFileSync('git', ['commit', '-m', 'initial'], { cwd: localRepo });

            const output = execFileSync(process.execPath, [commitInfoPath, '--batch'], {
                cwd: localRepo,
                encoding: 'utf8'
            });

            assert.match(output, /^APP_COMMIT_SHA=[0-9a-f]{40}$/m);
            assert.match(output, /^INFO_REMOTE=Latest origin\/main: not checked$/m);
            assert.match(
                output,
                /^INFO_STATE=origin\/main could not be checked; launcher will use local files\.$/m
            );
        } finally {
            fs.rmSync(localRepo, { recursive: true, force: true });
        }
    });

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

    it('shows the S.O.K. name and version in native and Docker launch banners', () => {
        const appVersion = fs.readFileSync(path.join(projectRoot, 'VERSION'), 'utf8').trim();
        for (const launcherName of ['start-native.bat', 'start-postgres.bat']) {
            const launcher = fs.readFileSync(path.join(projectRoot, launcherName), 'utf8');

            assert.match(
                launcher,
                new RegExp(`set "APP_VERSION=${appVersion}"`, 'i'),
                `${launcherName} APP_VERSION`
            );
            assert.match(
                launcher,
                /echo\s+S\.O\.K\..*v%APP_VERSION%/i,
                `${launcherName} visible S.O.K. version banner`
            );
        }
    });

    it('injects the local commit into Docker and native runtime metadata', () => {
        const dockerLauncher = fs.readFileSync(
            path.join(projectRoot, 'start-postgres.bat'),
            'utf8'
        );
        const appLauncher = fs.readFileSync(path.join(projectRoot, 'start.bat'), 'utf8');
        const nativeScript = fs.readFileSync(startupScriptPath, 'utf8');

        assert.match(dockerLauncher, /commit-info\.mjs --batch/i);
        assert.match(dockerLauncher, /set "APP_COMMIT_SHA=%%B"/i);
        assert.match(dockerLauncher, /lokalny folder tego pliku BAT/i);
        assert.match(dockerLauncher, /GitHub nie jest zrodlem kodu/i);
        assert.match(appLauncher, /commit-info\.mjs --batch/i);
        assert.match(appLauncher, /set "APP_COMMIT_SHA=%%B"/i);
        assert.match(nativeScript, /commit-info\.mjs/);
        assert.match(nativeScript, /\$env:APP_COMMIT_SHA = \$commitInfo\['APP_COMMIT_SHA'\]/);
        assert.match(dockerLauncher, /docker compose .* up --detach --build/);
    });

    it('keeps documented shortcut names forwarding to their canonical launchers', () => {
        const readLauncher = (name) => fs.readFileSync(path.join(projectRoot, name), 'utf8');

        assert.match(readLauncher('dev.bat'), /start\.bat" --dev %\*/i);
        assert.match(readLauncher('prod.bat'), /start\.bat" --prod %\*/i);
        assert.match(readLauncher('start-docker.bat'), /start-postgres\.bat"/i);
    });

    it('builds through the canonical npm build script', () => {
        const launcher = fs.readFileSync(path.join(projectRoot, 'build.bat'), 'utf8');

        assert.match(launcher, /call npm run build/i);
        assert.doesNotMatch(launcher, /xcopy\s+\/e\s+\/i\s+\/y\s+"generated/i);
        assert.doesNotMatch(launcher, /npx tsc/i);
    });

    it('describes every BAT entry point in README', () => {
        const readme = fs.readFileSync(path.join(projectRoot, 'README.md'), 'utf8');
        const batFiles = [
            ...fs
                .readdirSync(projectRoot, { withFileTypes: true })
                .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.bat'))
                .map((entry) => entry.name),
            ...fs
                .readdirSync(path.join(projectRoot, 'scripts'), { withFileTypes: true })
                .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.bat'))
                .map((entry) => `scripts/${entry.name}`)
        ];

        for (const batFile of batFiles) {
            assert.ok(readme.includes(path.basename(batFile)), `${batFile} missing in README`);
        }
    });

    it('provides a read-only Windows status entry point', () => {
        const launcher = fs.readFileSync(path.join(projectRoot, 'status.bat'), 'utf8');
        const helper = fs.readFileSync(commitInfoPath, 'utf8');
        const readme = fs.readFileSync(path.join(projectRoot, 'README.md'), 'utf8');

        assert.match(launcher, /node scripts\\commit-info\.mjs/i);
        assert.match(launcher, /nie uruchamia aplikacji/i);
        assert.doesNotMatch(launcher, /git\s+(?:pull|fetch|checkout|reset)/i);
        assert.match(helper, /S\.O\.K\. local version/);
        assert.match(helper, /Changed files in this folder/);
        assert.match(readme, /Szybki przegl[aą]d wersji i zmian.*`status\.bat`/);
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

    it('allows enough time for native PostgreSQL crash recovery', () => {
        const startupScript = fs.readFileSync(startupScriptPath, 'utf8');

        assert.match(startupScript, /\$postgresStartupTimeoutSeconds\s*=\s*300/);
        assert.match(startupScript, /--timeout=\$postgresStartupTimeoutSeconds/);
        assert.match(
            startupScript,
            /for \(\$attempt = 0; \$attempt -lt \(\$TimeoutSeconds \* 2\); \$attempt\+\+\)/
        );
        assert.match(startupScript, /\[int\]\$TimeoutSeconds\s*=\s*60/);
        const nativeWaits = startupScript.match(
            /Wait-PostgresReady -PgIsReady \$pgIsReady -TimeoutSeconds \$postgresStartupTimeoutSeconds/g
        );
        assert.equal(nativeWaits?.length, 2);
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
