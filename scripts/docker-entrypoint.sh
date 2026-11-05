#!/bin/sh
set -eu

export NODE_ENV=production

echo '[INFO] Starting S.O.K. container.'

if [ -z "${DATABASE_URL:-}" ]; then
    echo '[ERROR] DATABASE_URL is required.' >&2
    exit 1
fi

if ! node -e '
try {
    const databaseUrl = new URL(process.argv[1] || "");
    const hasPostgresProtocol = ["postgres:", "postgresql:"].includes(databaseUrl.protocol);
    const hasDatabase = databaseUrl.pathname.length > 1;
    if (!hasPostgresProtocol || !databaseUrl.hostname || !hasDatabase) process.exit(1);
} catch {
    process.exit(1);
}
' "$DATABASE_URL"; then
    echo '[ERROR] DATABASE_URL must be a valid PostgreSQL URL with a host and database.' >&2
    exit 1
fi

echo '[INFO] Starting application server.'
exec node dist/server.js
