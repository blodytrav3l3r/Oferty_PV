const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const DEFAULT_POSTGRES_TEST_PORT = 55440;
const POSTGRES_TEST_PORT_SCAN_SIZE = 100;

function getEnvPath() {
    return path.join(__dirname, '..', '.env');
}

function readEnvValues(envPath = getEnvPath(), environment = process.env) {
    const fileValues = fs.existsSync(envPath)
        ? require('dotenv').parse(fs.readFileSync(envPath, 'utf8'))
        : {};
    return { ...fileValues, ...environment };
}

function readPostgresTestUrl() {
    return readEnvValues().POSTGRES_TEST_URL;
}

function parsePostgresTestUrl(rawUrl) {
    if (!rawUrl) throw new Error('POSTGRES_TEST_URL is required for PostgreSQL tests');

    let url;
    let database;
    try {
        url = new URL(rawUrl);
        database = decodeURIComponent(url.pathname.slice(1)).toLowerCase();
    } catch {
        throw new Error('POSTGRES_TEST_URL must be a valid PostgreSQL URL');
    }
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
        throw new Error('POSTGRES_TEST_URL must use PostgreSQL');
    }
    if (
        !['localhost', '127.0.0.1', '[::1]', 'postgres', 'postgres-test'].includes(
            url.hostname.toLowerCase()
        )
    ) {
        throw new Error('POSTGRES_TEST_URL host must be a local test service');
    }
    if (!database.endsWith('_test') && !database.endsWith('_test_db')) {
        throw new Error('POSTGRES_TEST_URL database name must end in _test or _test_db');
    }
    if ([...url.searchParams.keys()].some((key) => key !== 'schema' && key !== 'sslmode')) {
        throw new Error(
            'POSTGRES_TEST_URL supports only schema and sslmode query parameters. ' +
                'Remove extra parameters such as connection_limit. The test runner sets the pool size.'
        );
    }
    url.searchParams.delete('schema');
    return url;
}

function getPostgresTestConfig(envPath = getEnvPath(), environment = process.env) {
    const values = readEnvValues(envPath, environment);
    const url = parsePostgresTestUrl(values.POSTGRES_TEST_URL);
    const port = Number(values.POSTGRES_TEST_PORT || url.port || DEFAULT_POSTGRES_TEST_PORT);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('POSTGRES_TEST_PORT must be an integer between 1 and 65535');
    }
    return { port, url };
}

function withPostgresTestPort(rawUrl, port) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('POSTGRES_TEST_PORT must be an integer between 1 and 65535');
    }
    parsePostgresTestUrl(rawUrl);
    const url = new URL(rawUrl);
    url.port = String(port);
    return url.toString();
}

function canListenOnPort(port) {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', (error) => {
            if (['EADDRINUSE', 'EACCES'].includes(error.code)) {
                resolve(false);
                return;
            }
            reject(error);
        });
        server.listen(port, '127.0.0.1', () => {
            server.close((error) => (error ? reject(error) : resolve(true)));
        });
    });
}

async function findAvailablePostgresTestPort(
    preferredPort,
    scanSize = POSTGRES_TEST_PORT_SCAN_SIZE
) {
    if (!Number.isInteger(preferredPort) || preferredPort < 1 || preferredPort > 65535) {
        throw new Error('POSTGRES_TEST_PORT must be an integer between 1 and 65535');
    }
    const lastPort = Math.min(65535, preferredPort + Math.max(0, scanSize));
    for (let port = preferredPort; port <= lastPort; port += 1) {
        if (await canListenOnPort(port)) return port;
    }
    throw new Error(
        `No free PostgreSQL test port is available between ${preferredPort} and ${lastPort}`
    );
}

function replaceEnvAssignment(lines, key, value) {
    let found = false;
    const updated = lines.map((line) => {
        const match = line.match(new RegExp(`^(\\s*)${key}(\\s*=\\s*)(.*)$`));
        if (!match) return line;
        found = true;
        const tail = match[3];
        const quoted = tail.match(/^(["'])(.*?)(\1)(\s+#.*)?$/);
        if (quoted)
            return `${match[1]}${key}${match[2]}${quoted[1]}${value}${quoted[3]}${quoted[4] || ''}`;
        const comment = tail.match(/(\s+#.*)$/)?.[1] || '';
        return `${match[1]}${key}${match[2]}${value}${comment}`;
    });
    return { lines: updated, found };
}

function writeEnvAtomically(envPath, content, existed, originalContent) {
    const directory = path.dirname(envPath);
    const temporaryDirectory = fs.mkdtempSync(path.join(directory, '.sok-env-'));
    const temporaryPath = path.join(temporaryDirectory, 'updated.env');
    const backupPath = path.join(temporaryDirectory, 'original.env');
    const originalMode = existed ? fs.statSync(envPath).mode : undefined;

    try {
        fs.writeFileSync(temporaryPath, content, {
            encoding: 'utf8',
            mode: originalMode
        });
        if (originalMode !== undefined) fs.chmodSync(temporaryPath, originalMode);

        try {
            fs.renameSync(temporaryPath, envPath);
        } catch (replaceError) {
            if (!existed) throw replaceError;
            try {
                fs.renameSync(envPath, backupPath);
                try {
                    fs.renameSync(temporaryPath, envPath);
                } catch (installError) {
                    fs.renameSync(backupPath, envPath);
                    throw installError;
                }
                fs.rmSync(backupPath, { force: true });
            } catch {
                try {
                    fs.writeFileSync(envPath, content, 'utf8');
                } catch (writeError) {
                    try {
                        fs.writeFileSync(envPath, originalContent, 'utf8');
                    } catch (restoreError) {
                        throw new Error(
                            `write failed (${writeError.message}) and rollback failed (${restoreError.message})`
                        );
                    }
                    throw writeError;
                }
            }
        }
    } finally {
        fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
}

function updatePostgresTestConfigPort(
    port,
    { envPath = getEnvPath(), environment = process.env } = {}
) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('POSTGRES_TEST_PORT must be an integer between 1 and 65535');
    }
    const content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    const bom = content.startsWith('\uFEFF') ? '\uFEFF' : '';
    const body = bom ? content.slice(1) : content;
    const newline = body.match(/\r\n|\n|\r/)?.[0] || os.EOL;
    const hasTrailingNewline = /(?:\r\n|\n|\r)$/.test(body);
    let lines = body.split(/\r\n|\n|\r/);
    if (hasTrailingNewline) lines = lines.slice(0, -1);

    const configured = readEnvValues(envPath, environment);
    const url = withPostgresTestPort(configured.POSTGRES_TEST_URL, port);
    const portUpdate = replaceEnvAssignment(lines, 'POSTGRES_TEST_PORT', String(port));
    const urlUpdate = replaceEnvAssignment(portUpdate.lines, 'POSTGRES_TEST_URL', url);
    lines = urlUpdate.lines;
    if (!portUpdate.found) lines.push(`POSTGRES_TEST_PORT=${port}`);
    if (!urlUpdate.found) lines.push(`POSTGRES_TEST_URL=${url}`);
    const updatedContent = `${bom}${lines.join(newline)}${hasTrailingNewline ? newline : ''}`;
    const unchanged = content === updatedContent;
    if (unchanged) return { changed: false, url };

    const existed = fs.existsSync(envPath);
    try {
        writeEnvAtomically(envPath, updatedContent, existed, content);
    } catch (error) {
        throw new Error(
            `Could not update POSTGRES_TEST_PORT in ${path.basename(envPath)}: ${error.message}`
        );
    }
    return { changed: true, url };
}

async function preparePostgresTestPort(envPath = getEnvPath(), environment = process.env) {
    const current = getPostgresTestConfig(envPath, environment);
    const port = await findAvailablePostgresTestPort(current.port);
    const result = updatePostgresTestConfigPort(port, { envPath, environment });
    return { port, url: result.url, changed: result.changed };
}

module.exports = {
    findAvailablePostgresTestPort,
    getPostgresTestConfig,
    parsePostgresTestUrl,
    preparePostgresTestPort,
    readPostgresTestUrl,
    updatePostgresTestConfigPort,
    withPostgresTestPort
};

async function checkPostgresTestConnection() {
    const url = parsePostgresTestUrl(readPostgresTestUrl());
    const { Client } = require('pg');
    const client = new Client({
        connectionString: url.toString(),
        connectionTimeoutMillis: 5_000
    });
    try {
        await client.connect();
    } catch {
        throw new Error(
            `Cannot connect to PostgreSQL test service at ${url.host}. ` +
                'Check POSTGRES_TEST_URL and start the isolated PostgreSQL test service.'
        );
    } finally {
        await client.end();
    }
}

if (require.main === module && process.argv[2] === '--prepare-port') {
    preparePostgresTestPort()
        .then((config) => process.stdout.write(`${JSON.stringify(config)}\n`))
        .catch((error) => {
            console.error(error.message);
            process.exitCode = 1;
        });
} else if (require.main === module) {
    checkPostgresTestConnection().catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}
