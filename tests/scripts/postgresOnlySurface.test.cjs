const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const sourceExtensions = new Set([
    '.bat',
    '.cjs',
    '.js',
    '.json',
    '.mjs',
    '.prisma',
    '.ps1',
    '.py',
    '.sh',
    '.sql',
    '.ts',
    '.yaml',
    '.yml'
]);
const runtimeRoots = [
    'src',
    'scripts',
    'docker',
    '.github/workflows',
    'prisma/migrations-postgresql',
    'server.ts',
    'prisma.config.ts',
    'prisma/schema.prisma',
    'package.json',
    'Dockerfile',
    'docker-compose.yml'
];
const allowlistedLegacyExporter = 'scripts/export-active-pricelists.py';
const historicalSqliteMigrations = 'prisma/migrations';
const sqliteRuntimeApi =
    /node:sqlite|better-sqlite3|sqlite_master|\bPRAGMA\s+(?:table_info|query_only|foreign_keys|foreign_key_check|integrity_check|busy_timeout|wal_checkpoint|defer_foreign_keys)\b|\bINSERT\s+OR\s+(?:IGNORE|REPLACE)\b/i;

function listSourceFiles(relativePath) {
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath)) {
        return [];
    }

    const stat = fs.lstatSync(absolutePath);
    if (stat.isSymbolicLink()) {
        return [];
    }
    if (stat.isFile()) {
        return sourceExtensions.has(path.extname(relativePath).toLowerCase())
            ? [relativePath.split(path.sep).join('/')]
            : [];
    }
    if (!stat.isDirectory()) {
        return [];
    }

    return fs
        .readdirSync(absolutePath, { withFileTypes: true })
        .flatMap((entry) => listSourceFiles(path.join(relativePath, entry.name)));
}

const scannedFiles = [...new Set(runtimeRoots.flatMap(listSourceFiles))].filter(
    (relativePath) =>
        relativePath !== allowlistedLegacyExporter &&
        !relativePath.startsWith(`${historicalSqliteMigrations}${path.sep}`)
);
const findings = scannedFiles.flatMap((relativePath) => {
    const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
    return sqliteRuntimeApi.test(source) ? [relativePath] : [];
});

assert.ok(fs.existsSync(path.join(root, allowlistedLegacyExporter)));
assert.ok(fs.existsSync(path.join(root, historicalSqliteMigrations)));
assert.match(
    fs.readFileSync(path.join(root, 'prisma.config.ts'), 'utf8'),
    /path:\s*'prisma\/migrations-postgresql'/
);
assert.deepEqual(
    findings,
    [],
    `SQLite-specific APIs found in active runtime files: ${findings.join(', ')}`
);

process.stdout.write(
    `PostgreSQL-only surface check passed (${scannedFiles.length} active source files; legacy exporter and historical SQLite migrations excluded).\n`
);
