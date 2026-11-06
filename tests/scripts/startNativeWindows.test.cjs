const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');

const projectRoot = path.resolve(__dirname, '..', '..');
const launcherPath = path.join(projectRoot, 'start-native.bat');
const startupScriptPath = path.join(projectRoot, 'scripts', 'start-native.ps1');

describe('native Windows launcher contract', () => {
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

    it('routes developer and Docker startup through the matching launchers', () => {
        const readLauncher = (name) => fs.readFileSync(path.join(projectRoot, name), 'utf8');

        assert.match(readLauncher('start-dev.bat'), /start-native\.bat" -Watch/i);
        assert.match(readLauncher('start-docker.bat'), /start-postgres\.bat"/i);
        assert.match(readLauncher('start-native.bat'), /start-native\.ps1" %\*/i);
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
