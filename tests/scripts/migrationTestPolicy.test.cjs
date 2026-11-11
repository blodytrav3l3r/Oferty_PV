const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { describe, it, before } = require('node:test');

const projectRoot = path.resolve(__dirname, '..', '..');
const scriptPath = path.join(projectRoot, 'scripts', 'check-migration-tests.mjs');
const MIGRATION = 'prisma/migrations-postgresql/0004_test/migration.sql';

describe('kontrakt testowy commita — guard migracji', () => {
    let decide;
    before(async () => {
        ({ decide } = await import(pathToFileURL(scriptPath).href));
    });

    it('brak migracji w commicie = brak blokady', () => {
        const result = decide(['src/routes/clients/contacts.ts', 'public/css/style.base.css']);
        assert.equal(result.ok, true);
        assert.deepEqual(result.migrations, []);
    });

    it('migracja bez testu = blokada', () => {
        const result = decide([MIGRATION, 'public/css/style.base.css']);
        assert.equal(result.ok, false);
        assert.deepEqual(result.migrations, [MIGRATION]);
    });

    it('migracja z testem w tym samym commicie = OK', () => {
        const result = decide([MIGRATION, 'tests/clients/contacts.test.ts']);
        assert.equal(result.ok, true);
        assert.deepEqual(result.migrations, [MIGRATION]);
    });

    it('test poza katalogiem tests/ nie zwalnia blokady', () => {
        assert.equal(decide([MIGRATION, 'src/foo.test.ts']).ok, false);
    });

    it('pusta lista plików = brak blokady', () => {
        assert.equal(decide([]).ok, true);
    });
});
