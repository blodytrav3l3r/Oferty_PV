const assert = require('node:assert/strict');

async function main() {
    const { shouldResetFailedInitialMigration } =
        await import('../../scripts/recover-failed-initial-migration.mjs');
    const { assertNoPublicBusinessData, assertRecoveryTarget } =
        await import('../../scripts/recover-failed-initial-migration.mjs');

    for (const host of ['postgres', 'localhost', '127.0.0.1', '[::1]']) {
        assert.doesNotThrow(() =>
            assertRecoveryTarget(`postgresql://sok_migrator:secret@${host}:5432/sok?schema=public`)
        );
    }
    for (const url of [
        'postgresql://sok_migrator:secret@db.example.test:5432/sok?schema=public',
        'postgresql://sok_migrator:secret@postgres:5432/sok_test?schema=public',
        'postgresql://sok_migrator:secret@postgres:5432/sok?schema=private',
        'file:./sok.sqlite'
    ]) {
        assert.throws(
            () => assertRecoveryTarget(url),
            /Recovery is limited|valid local PostgreSQL/
        );
    }

    const noTables = { query: async () => ({ rows: [] }) };
    await assert.doesNotReject(() => assertNoPublicBusinessData(noTables));

    const emptyTableClient = {
        calls: 0,
        async query(sql) {
            this.calls += 1;
            if (this.calls === 1) {
                return {
                    rows: [
                        { relname: 'offers_rel', relrowsecurity: false, relforcerowsecurity: false }
                    ]
                };
            }
            assert.match(sql, /SELECT EXISTS/);
            return { rows: [{ has_rows: false }] };
        }
    };
    await assert.doesNotReject(() => assertNoPublicBusinessData(emptyTableClient));

    const populatedTableClient = {
        calls: 0,
        async query() {
            this.calls += 1;
            return this.calls === 1
                ? {
                      rows: [
                          {
                              relname: 'offers_rel',
                              relrowsecurity: false,
                              relforcerowsecurity: false
                          }
                      ]
                  }
                : { rows: [{ has_rows: true }] };
        }
    };
    await assert.rejects(
        () => assertNoPublicBusinessData(populatedTableClient),
        /is empty; refusing schema recovery/
    );

    const unverifiableClient = {
        query: async () => ({
            rows: [{ relname: 'offers_rel', relrowsecurity: true, relforcerowsecurity: false }]
        })
    };
    await assert.rejects(
        () => assertNoPublicBusinessData(unverifiableClient),
        /row-secured public table; refusing schema recovery/
    );

    await assert.rejects(
        () => assertNoPublicBusinessData({ query: async () => ({ rows: null }) }),
        /Could not verify public schema tables/
    );

    assert.equal(shouldResetFailedInitialMigration([]), false);
    assert.equal(
        shouldResetFailedInitialMigration([
            {
                migration_name: '0001_initial',
                started_at: new Date(),
                finished_at: null,
                rolled_back_at: null
            }
        ]),
        true
    );
    assert.equal(
        shouldResetFailedInitialMigration([
            {
                migration_name: '0001_initial',
                started_at: new Date(),
                finished_at: null,
                rolled_back_at: new Date()
            }
        ]),
        false
    );
    assert.throws(
        () =>
            shouldResetFailedInitialMigration([
                {
                    migration_name: '0001_initial',
                    started_at: new Date(),
                    finished_at: null,
                    rolled_back_at: null
                },
                {
                    migration_name: '0002_care_latest_followup_triggers',
                    started_at: new Date(),
                    finished_at: null,
                    rolled_back_at: null
                }
            ]),
        /Manual review is required/
    );
    assert.throws(
        () =>
            shouldResetFailedInitialMigration([
                {
                    migration_name: '0001_initial',
                    started_at: new Date(),
                    finished_at: null,
                    rolled_back_at: null
                },
                {
                    migration_name: '0002_care_latest_followup_triggers',
                    started_at: new Date(),
                    finished_at: new Date(),
                    rolled_back_at: null
                }
            ]),
        /Manual review is required/
    );

    const fs = require('node:fs');
    const path = require('node:path');
    const source = fs.readFileSync(
        path.resolve(__dirname, '../../scripts/recover-failed-initial-migration.mjs'),
        'utf8'
    );
    assert.match(source, /Type RESET FAILED SCHEMA to continue/);
    assert.match(source, /DROP SCHEMA public CASCADE/);
    assert.match(source, /pg_stat_activity/);
    assert.match(source, /assertRecoveryTarget\(databaseUrl\)/);
    assert.match(source, /assertNoPublicBusinessData\(client\)/);
    const resetFunctionIndex = source.indexOf('async function resetPublicSchema');
    const resetDataGuardIndex = source.indexOf(
        'await assertNoPublicBusinessData(client);',
        resetFunctionIndex
    );
    const dropSchemaIndex = source.indexOf(
        "await client.query('DROP SCHEMA public CASCADE')",
        resetFunctionIndex
    );
    assert.ok(
        resetFunctionIndex >= 0 && resetDataGuardIndex < dropSchemaIndex,
        'transactional business-data guard must run before schema deletion'
    );
    assert.match(source, /await client\.query\('BEGIN'\)/);
    assert.match(source, /await client\.query\('COMMIT'\)/);
    process.stdout.write('Failed initial migration recovery policy checks passed.\n');
}

main().catch((error) => {
    process.stderr.write(`${error.stack ?? error}\n`);
    process.exitCode = 1;
});
