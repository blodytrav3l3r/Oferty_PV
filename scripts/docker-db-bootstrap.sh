#!/bin/sh
set -eu

export NODE_ENV=production
BOOTSTRAP_MODE="${1:-bootstrap}"

if [ "$BOOTSTRAP_MODE" != 'bootstrap' ] && [ "$BOOTSTRAP_MODE" != 'migrate-only' ]; then
    echo '[ERROR] Unsupported PostgreSQL bootstrap mode.' >&2
    exit 1
fi

validate_database_url() {
    value="$1"
    node -e '
try {
    const databaseUrl = new URL(process.argv[1] || "");
    const hasPostgresProtocol = ["postgres:", "postgresql:"].includes(databaseUrl.protocol);
    const hasDatabase = databaseUrl.pathname.length > 1;
    if (!hasPostgresProtocol || !databaseUrl.hostname || !hasDatabase) process.exit(1);
} catch {
    process.exit(1);
}
' "$value"
}

if [ -z "${MIGRATION_DATABASE_URL:-}" ] || \
    { [ "$BOOTSTRAP_MODE" = 'bootstrap' ] && { [ -z "${DATABASE_URL:-}" ] || [ -z "${DEFAULT_ADMIN_PASSWORD:-}" ]; }; }; then
    echo '[ERROR] MIGRATION_DATABASE_URL is required; bootstrap mode also requires DATABASE_URL and DEFAULT_ADMIN_PASSWORD.' >&2
    exit 1
fi

if ! validate_database_url "$MIGRATION_DATABASE_URL" || \
    { [ "$BOOTSTRAP_MODE" = 'bootstrap' ] && ! validate_database_url "$DATABASE_URL"; }; then
    echo '[ERROR] PostgreSQL URLs must be valid and include a host and database.' >&2
    exit 1
fi

run_database_command() {
    command_log="$(mktemp)"
    if "$@" >"$command_log" 2>&1; then
        node /app/scripts/redact-db-log.mjs "$command_log"
        rm -f "$command_log"
        return 0
    else
        command_status=$?
    fi

    node /app/scripts/redact-db-log.mjs "$command_log" >&2
    rm -f "$command_log"
    return "$command_status"
}

echo '[INFO] Checking for a failed initial PostgreSQL migration.'
DATABASE_URL="$MIGRATION_DATABASE_URL" node scripts/recover-failed-initial-migration.mjs

echo '[INFO] Applying PostgreSQL migrations with the migration role.'
if ! run_database_command env DATABASE_URL="$MIGRATION_DATABASE_URL" npx prisma migrate deploy; then
    echo '[ERROR] PostgreSQL migrations failed; see redacted details above.' >&2
    exit 1
fi

if [ "$BOOTSTRAP_MODE" = 'migrate-only' ]; then
    echo '[INFO] PostgreSQL migrations completed; bootstrap data steps were skipped.'
    exit 0
fi

echo '[INFO] Applying least-privilege PostgreSQL grants.'
if ! run_database_command node scripts/grant-postgres-roles.mjs; then
    echo '[ERROR] PostgreSQL role grants failed; see redacted details above.' >&2
    exit 1
fi

echo '[INFO] Applying idempotent application seed with the runtime role.'
if ! run_database_command npx prisma db seed; then
    echo '[ERROR] PostgreSQL seed failed; see redacted details above.' >&2
    exit 1
fi

echo '[INFO] Ensuring the initial administrator with the runtime role.'
if ! run_database_command npx ts-node scripts/bootstrap-admin.ts; then
    echo '[ERROR] Initial administrator setup failed; see redacted details above.' >&2
    exit 1
fi
