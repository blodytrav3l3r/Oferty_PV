/** @jest-environment node */

import { parsePostgresTestUrl } from '../scripts/postgres-test-url.cjs';

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
});
