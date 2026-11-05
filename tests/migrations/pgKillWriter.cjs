const { Client } = require('pg');

async function main() {
    const [connectionString, schemaName, prefix, shouldCommit] = process.argv.slice(2);
    if (!connectionString || !/^sok_mig_[a-z0-9_]+$/.test(schemaName || '') || !prefix) {
        throw new Error('Invalid isolated PostgreSQL writer arguments');
    }

    const client = new Client({ connectionString });
    await client.connect();
    await client.query(`SET search_path TO "${schemaName}"`);
    const backend = await client.query('SELECT pg_backend_pid() AS pid');
    await client.query('BEGIN');
    process.stdout.write(`backend:${backend.rows[0].pid}\n`);
    for (let index = 1; index <= 100; index += 1) {
        await client.query('INSERT INTO "settings" ("key", "value") VALUES ($1, $2)', [
            `${prefix}-${index}`,
            String(index)
        ]);
        if (index % 10 === 0) {
            process.stdout.write(`progress:${index}\n`);
            await new Promise((resolve) => setTimeout(resolve, 30));
        }
    }

    if (shouldCommit === 'commit') {
        await client.query('COMMIT');
        process.stdout.write('committed\n');
        await client.end();
        return;
    }

    await new Promise((resolve) => setTimeout(resolve, 60_000));
}

main().catch(() => {
    process.stderr.write('PostgreSQL transaction writer failed.\n');
    process.exitCode = 1;
});
