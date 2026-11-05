const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..', '..');
const linuxInstallerPath = path.join(root, 'install-linux-server.sh');
const linuxInstaller = fs.readFileSync(linuxInstallerPath, 'utf8');
const windowsInstaller = fs.readFileSync(path.join(root, 'scripts', 'setup-new-pc.ps1'), 'utf8');
const windowsLauncher = fs.readFileSync(path.join(root, 'start-postgres.bat'), 'utf8');
const gitIgnore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
const migrationSql = fs.readFileSync(
    path.join(root, 'prisma', 'migrations-postgresql', '0001_initial', 'migration.sql'),
    'utf8'
);
const searchUtils = fs.readFileSync(path.join(root, 'src', 'utils', 'searchUtils.ts'), 'utf8');
const dockerIgnore = fs.readFileSync(path.join(root, '.dockerignore'), 'utf8');

assert.match(
    linuxInstaller,
    /docker-ce docker-ce-cli containerd\.io docker-buildx-plugin docker-compose-plugin/
);
assert.match(linuxInstaller, /--volume "\$mount"/);
assert.match(
    linuxInstaller,
    /source=\$ARTIFACT_PATH|\$ARTIFACT_PATH:\/tmp\/active-pricelists\.json:ro/
);
assert.match(linuxInstaller, /MIGRATE AND SEED/);
assert.match(linuxInstaller, /compose run --rm --no-deps db-bootstrap/);
assert.match(linuxInstaller, /isUnsafeDefaultAdminPassword/);
assert.match(linuxInstaller, /SOK_ADMIN_SECRET_UNSAFE/);
assert.match(linuxInstaller, /RESET_ADMIN_PASSWORD_ON_BOOTSTRAP true/);
assert.match(linuxInstaller, /admin_match=.*SOK_ADMIN_CREDENTIAL_MATCH=/);
assert.match(linuxInstaller, /replace_env_value_from_stdin DEFAULT_ADMIN_PASSWORD/);
assert.match(linuxInstaller, /install-admin-password\.pending\.txt/);
assert.match(linuxInstaller, /mktemp "\$ROOT\/\.env\.XXXXXX"/);
assert.match(linuxInstaller, /mv -T -- "\$ENV_TEMP" "\$ROOT\/\.env"/);
const passwordMoveIndex = linuxInstaller.indexOf('mv -T -- "$PASSWORD_TEMP" "$password_file"');
const envMoveIndex = linuxInstaller.indexOf('mv -T -- "$ENV_TEMP" "$ROOT/.env"');
assert.ok(passwordMoveIndex >= 0, 'the password temp must be moved into place');
assert.ok(envMoveIndex >= 0, 'the environment temp must be moved into place');
assert.ok(
    passwordMoveIndex < envMoveIndex,
    'the recoverable admin password file must be committed before .env'
);
assert.doesNotMatch(
    linuxInstaller,
    /docker\s+compose\s+down\s+-v|docker\s+volume\s+(?:rm|prune)|curl[^\n]*\|\s*(?:sudo\s+)?(?:bash|sh)/i
);
assert.match(windowsInstaller, /--volume', \$mount/);
assert.match(windowsInstaller, /MIGRATE AND SEED/);
assert.match(windowsInstaller, /volume ls --quiet/);
assert.match(windowsInstaller, /-ceq 'sok_postgres-data'/);
assert.match(windowsInstaller, /volume inspect 'sok_postgres-data'/);
assert.match(windowsInstaller, /ConvertFrom-Json/);
assert.match(windowsInstaller, /Labels\.'com\.docker\.compose\.project'/);
assert.doesNotMatch(windowsInstaller, /volume inspect --format/);
assert.match(windowsInstaller, /param\(\[switch\]\$FreshPostgresDatabase\)/);
assert.match(windowsInstaller, /-and \$FreshPostgresDatabase\) \{/);
assert.match(windowsInstaller, /DATABASE_URL\s+= "postgresql:\/\/sok_app:/);
assert.match(
    windowsInstaller,
    /if \(\$volumeExists\) \{\s+Initialize-LocalEnvironment\s+\} else \{\s+Initialize-LocalEnvironment -FreshPostgresDatabase\s+\}/
);
assert.match(
    windowsInstaller,
    /invalidDatabaseSetting = @\(\$invalid \| Where-Object \{ \$_ -ne 'DEFAULT_ADMIN_PASSWORD' \}\)/
);
assert.match(windowsInstaller, /SOK_ADMIN_CREDENTIAL_MATCH=false/);
assert.match(windowsInstaller, /SOK_ADMIN_CREDENTIAL_MATCH=true/);
assert.match(windowsInstaller, /isUnsafeDefaultAdminPassword/);
assert.match(windowsInstaller, /SOK_ADMIN_SECRET_UNSAFE/);
assert.doesNotMatch(windowsInstaller, /anim123456/);
assert.match(windowsInstaller, /install-admin-password\.pending\.txt/);
assert.doesNotMatch(windowsInstaller, /Remove-Item -LiteralPath \$passwordPath -Force/);
const repairCredentialIndex = windowsInstaller.indexOf(
    '$tempPasswordPath -Destination $pendingPasswordPath'
);
const repairEnvironmentIndex = windowsInstaller.lastIndexOf('$tempEnvPath -Destination $envPath');
assert.ok(
    repairCredentialIndex >= 0 && repairEnvironmentIndex > repairCredentialIndex,
    'generated admin credential must be persisted before replacing the Compose environment'
);
const adminMatchCheckIndex = windowsInstaller.indexOf(
    "$bootstrapText -match 'SOK_ADMIN_CREDENTIAL_MATCH=true'"
);
const pendingPromotionIndex = windowsInstaller.indexOf(
    '$pendingPasswordPath -Destination $passwordPath'
);
assert.ok(
    adminMatchCheckIndex >= 0 && pendingPromotionIndex > adminMatchCheckIndex,
    'only a credential confirmed against the admin hash may replace the install credential file'
);
const envTempCreateIndex = windowsInstaller.indexOf(
    'New-Item -ItemType File -Path $tempEnvPath -Force'
);
const envTempAclIndex = windowsInstaller.indexOf('Set-PrivateFileAcl -Path $tempEnvPath');
const envTempWriteIndex = windowsInstaller.indexOf('WriteAllText($tempEnvPath, $content');
assert.ok(envTempCreateIndex >= 0, 'temporary environment file must be created');
assert.ok(
    envTempAclIndex > envTempCreateIndex,
    'temporary environment ACL must be set after creation'
);
assert.ok(
    envTempWriteIndex > envTempAclIndex,
    'secrets must be written only after the temporary environment ACL is restricted'
);
assert.doesNotMatch(windowsInstaller, /target=\/cutover|\$artifactDirectory/);
assert.match(dockerIgnore, /^assets\/$/m);
assert.match(dockerIgnore, new RegExp('^data/price_' + 'defaults\\.json$', 'm'));
assert.match(windowsInstaller, /'run', '--rm', '--no-deps', 'db-bootstrap'/);
assert.match(windowsInstaller, /Write-PostgresInstallMarker/);
assert.match(linuxInstaller, /mv -T -- "\$MARKER_TEMP" "\$INSTALL_MARKER"/);
assert.match(windowsLauncher, /\.sok-postgres-installed/);
assert.match(windowsLauncher, /resources\\bin\\docker\.exe/);
assert.match(windowsLauncher, /docker info/);
assert.match(windowsLauncher, /docker compose .* config --quiet/);
assert.match(windowsLauncher, /start "" "http:\/\/127\.0\.0\.1:3000"/);
assert.match(windowsLauncher, /pause\s+exit \/b 0$/m);
assert.match(
    windowsLauncher,
    /docker compose .* up --detach --build --wait --wait-timeout 300 postgres app/
);
assert.doesNotMatch(
    windowsLauncher,
    /docker\s+compose\s+down\s+-v|docker\s+volume\s+(?:rm|prune)|import-active-pricelists|migrate\s+(?:resolve|deploy|reset)|db\s+seed|RESET FAILED SCHEMA/i
);
const windowsImportIndex = windowsInstaller.indexOf(
    "Invoke-Compose -Arguments @('run', '--rm', '--no-deps', '--volume', $mount, '--entrypoint', 'sh', 'app', '-ec', $apply)"
);
const windowsMarkerIndex = windowsInstaller.lastIndexOf('Write-PostgresInstallMarker');
const windowsReadinessIndex = windowsInstaller.indexOf(
    "Invoke-Compose -Arguments @('up', '--detach', '--wait', '--wait-timeout', '300', 'app')"
);
const windowsMarkerClearIndex = windowsInstaller.indexOf(
    'Remove-Item -LiteralPath $markerPath -Force'
);
const windowsDatabaseSetupIndex = windowsInstaller.indexOf(
    'Invoke-DatabaseSetup -ArtifactPath $artifactPath'
);
assert.ok(windowsImportIndex >= 0, 'Windows installer must import active pricelists');
assert.ok(
    windowsMarkerClearIndex < windowsDatabaseSetupIndex,
    'Windows installer must invalidate stale marker before database work'
);
assert.ok(
    windowsReadinessIndex > windowsImportIndex,
    'Windows app must become ready after active pricelist import'
);
assert.ok(
    windowsMarkerIndex > windowsReadinessIndex,
    'Windows readiness marker must follow app readiness'
);
const linuxImportIndex = linuxInstaller.indexOf(
    'compose run --rm --no-deps --volume "$mount" --entrypoint sh app -ec "$apply_import"'
);
const linuxMarkerIndex = linuxInstaller.indexOf('mv -T -- "$MARKER_TEMP" "$INSTALL_MARKER"');
const linuxReadinessIndex = linuxInstaller.indexOf(
    'compose up --detach --wait --wait-timeout 300 app'
);
const linuxMarkerClearIndex = linuxInstaller.indexOf('rm -f -- "$INSTALL_MARKER"');
const linuxBuildIndex = linuxInstaller.indexOf('compose build app');
assert.ok(linuxImportIndex >= 0, 'Linux installer must import active pricelists');
assert.ok(
    linuxMarkerClearIndex >= 0 && linuxMarkerClearIndex < linuxBuildIndex,
    'Linux installer must invalidate stale marker before database work'
);
assert.ok(
    linuxReadinessIndex > linuxImportIndex,
    'Linux app must become ready after active pricelist import'
);
assert.ok(
    linuxMarkerIndex > linuxReadinessIndex,
    'Linux readiness marker must follow app readiness'
);
assert.match(gitIgnore, /^\.sok-postgres-installed$/m);
assert.match(gitIgnore, /^\.sok-postgres-installed\.\*$/m);
assert.match(dockerIgnore, /^\.sok-postgres-installed(?:\.\*)?$/m);
assert.doesNotMatch(migrationSql, /concat_ws/);
assert.match(migrationSql, /COALESCE\("data", ''\) \|\| ' ' \|\| COALESCE\("clientName", ''\)/);
assert.doesNotMatch(searchUtils, /concat_ws/);
assert.match(
    searchUtils,
    /COALESCE\(\$\{offerAlias\}\.data, ''\) \|\| ' ' \|\| COALESCE\(\$\{offerAlias\}\."clientName", ''\)/
);

const bashCandidates =
    process.platform === 'win32'
        ? [
              process.env.ProgramFiles &&
                  path.join(process.env.ProgramFiles, 'Git', 'bin', 'bash.exe'),
              process.env['ProgramFiles(x86)'] &&
                  path.join(process.env['ProgramFiles(x86)'], 'Git', 'bin', 'bash.exe'),
              'bash.exe',
              'bash'
          ].filter(Boolean)
        : ['bash'];
const bashCommand = bashCandidates.find((candidate) => {
    const result = spawnSync(candidate, ['--version'], { stdio: 'ignore' });
    return !result.error && result.status === 0;
});

if (!bashCommand) {
    process.stdout.write(
        'SKIP: Bash syntax/help checks require Bash; static installer policy checks passed.\n'
    );
} else {
    const syntax = spawnSync(bashCommand, ['-n', 'install-linux-server.sh'], {
        cwd: root,
        encoding: 'utf8'
    });
    assert.equal(syntax.status, 0, `Bash syntax error: ${syntax.stderr}`);

    const help = spawnSync(bashCommand, ['install-linux-server.sh', '--help'], {
        cwd: root,
        encoding: 'utf8'
    });
    assert.equal(help.status, 0, `Installer help failed: ${help.stderr}`);
    assert.match(help.stdout, /Ubuntu\/Debian/);
    assert.match(help.stdout, /active-pricelists\.json/);
}

process.stdout.write('Linux and Windows installer policy checks passed.\n');
