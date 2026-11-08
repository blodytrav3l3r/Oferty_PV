/** @jest-environment node */

import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';
import {
    findAvailablePostgresTestPort,
    parsePostgresTestUrl,
    updatePostgresTestConfigPort
} from '../scripts/postgres-test-url.cjs';

function getListeningPort(server: net.Server): number {
    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('Test server is not listening on a TCP port');
    }
    return address.port;
}

describe('POSTGRES_TEST_URL contract', () => {
    test.each(['127.0.0.1:55432', '[::1]:55432', 'postgres-test:5432'])(
        'accepts the isolated service at %s and removes the input schema',
        (host) => {
            const url = parsePostgresTestUrl(
                `postgresql://${host}/sok_test?schema=public&sslmode=disable`
            );

            expect(url.search).toBe('?sslmode=disable');
        }
    );

    test.each([
        'postgresql://localhost/sok_test?connection_limit=2',
        'postgresql://localhost/sok_test?options=-csearch_path=public',
        'postgresql://localhost/sok_dev',
        'postgresql://db.example.test/sok_test'
    ])('rejects unsafe or unsupported test configuration (%s)', (rawUrl) => {
        expect(() => parsePostgresTestUrl(rawUrl)).toThrow(/POSTGRES_TEST_URL/);
    });

    test('moves a busy default port to a free port and persists both local settings', async () => {
        const server = net.createServer();
        await new Promise<void>((resolve, reject) =>
            server.listen(0, '127.0.0.1', (error?: Error) => (error ? reject(error) : resolve()))
        );
        const occupiedPort = getListeningPort(server);
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sok-test-port-'));
        const envPath = path.join(directory, '.env');
        const original = [
            '# preserve comment',
            'OTHER_LOCAL_SETTING=keep-me',
            `POSTGRES_TEST_PORT=${occupiedPort}`,
            `POSTGRES_TEST_URL="postgresql://sok_test:secret@127.0.0.1:${occupiedPort}/sok_test?schema=public"`,
            ''
        ].join('\r\n');
        fs.writeFileSync(envPath, original, 'utf8');

        try {
            const selectedPort = await findAvailablePostgresTestPort(occupiedPort, 10);
            const result = updatePostgresTestConfigPort(selectedPort, {
                envPath,
                environment: {}
            });
            const updated = fs.readFileSync(envPath, 'utf8');
            const url = parsePostgresTestUrl(dotenv.parse(updated).POSTGRES_TEST_URL);

            expect(selectedPort).not.toBe(occupiedPort);
            expect(result.changed).toBe(true);
            expect(url.port).toBe(String(selectedPort));
            expect(updated).toContain('# preserve comment');
            expect(updated).toContain('OTHER_LOCAL_SETTING=keep-me');
            expect(updated).toContain(`POSTGRES_TEST_PORT=${selectedPort}`);
            expect(updated).toContain('secret');
            expect(updated.replace(/\r\n/g, '')).not.toContain('\n');
            expect(updated).toContain('\r\n');
            expect(fs.readdirSync(directory)).toEqual(['.env']);
        } finally {
            server.close();
            fs.rmSync(directory, { recursive: true, force: true });
        }
    });

    test('does not rewrite the environment file when the configured port is available', async () => {
        const server = net.createServer();
        await new Promise<void>((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', () => resolve());
        });
        const availablePort = getListeningPort(server);
        await new Promise<void>((resolve, reject) =>
            server.close((error?: Error) => (error ? reject(error) : resolve()))
        );
        expect(await findAvailablePostgresTestPort(availablePort, 0)).toBe(availablePort);

        const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sok-test-port-'));
        const envPath = path.join(directory, '.env');
        const config = [
            `POSTGRES_TEST_PORT=${availablePort}`,
            `POSTGRES_TEST_URL=postgresql://sok_test:secret@127.0.0.1:${availablePort}/sok_test`
        ].join('\n');
        fs.writeFileSync(envPath, config, 'utf8');
        const before = fs.statSync(envPath).mtimeMs;

        try {
            const result = updatePostgresTestConfigPort(availablePort, {
                envPath,
                environment: {}
            });

            expect(result.changed).toBe(false);
            expect(fs.readFileSync(envPath, 'utf8')).toBe(config);
            expect(fs.statSync(envPath).mtimeMs).toBe(before);
        } finally {
            fs.rmSync(directory, { recursive: true, force: true });
        }
    });
});
