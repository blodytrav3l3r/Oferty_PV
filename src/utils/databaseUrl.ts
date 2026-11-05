/** Require an explicit PostgreSQL connection string; never fall back to a local database. */
export function requirePostgresDatabaseUrl(raw: string | undefined): string {
    if (!raw) {
        throw new Error('DATABASE_URL is required — PostgreSQL connection is mandatory');
    }

    let parsed: URL;
    try {
        parsed = new URL(raw);
    } catch {
        throw new Error('DATABASE_URL must be a valid PostgreSQL connection string');
    }

    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
        throw new Error('DATABASE_URL must use the PostgreSQL protocol');
    }
    if (!parsed.hostname || parsed.pathname.length < 2) {
        throw new Error('DATABASE_URL must specify a PostgreSQL host and database');
    }

    const localHosts = new Set(['localhost', '127.0.0.1', '::1', 'postgres']);
    const isLocalHost = localHosts.has(parsed.hostname.toLowerCase());
    const sslMode = parsed.searchParams.get('sslmode');
    if (sslMode && !['disable', 'verify-full'].includes(sslMode)) {
        throw new Error('DATABASE_URL has an unsupported sslmode');
    }
    if (!isLocalHost && sslMode !== 'verify-full') {
        throw new Error('Remote PostgreSQL connections require sslmode=verify-full');
    }

    return raw;
}
