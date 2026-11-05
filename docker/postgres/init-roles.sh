#!/bin/sh
set -eu

: "${SOK_MIGRATOR_PASSWORD:?SOK_MIGRATOR_PASSWORD is required}"
: "${SOK_APP_PASSWORD:?SOK_APP_PASSWORD is required}"
: "${SOK_BACKUP_PASSWORD:?SOK_BACKUP_PASSWORD is required}"

psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    --set ON_ERROR_STOP=1 <<'SQL'
\getenv migrator_password SOK_MIGRATOR_PASSWORD
\getenv app_password SOK_APP_PASSWORD
\getenv backup_password SOK_BACKUP_PASSWORD
\getenv database_name POSTGRES_DB

SELECT format('CREATE ROLE sok_migrator LOGIN PASSWORD %L', :'migrator_password') \gexec
SELECT format('CREATE ROLE sok_app LOGIN PASSWORD %L', :'app_password') \gexec
SELECT format('CREATE ROLE sok_backup LOGIN PASSWORD %L', :'backup_password') \gexec

GRANT CONNECT, CREATE ON DATABASE :"database_name" TO sok_migrator;
ALTER SCHEMA public OWNER TO sok_migrator;
GRANT CONNECT ON DATABASE :"database_name" TO sok_app, sok_backup;
GRANT USAGE ON SCHEMA public TO sok_app, sok_backup;

ALTER DEFAULT PRIVILEGES FOR ROLE sok_migrator IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sok_app;
ALTER DEFAULT PRIVILEGES FOR ROLE sok_migrator IN SCHEMA public
    GRANT SELECT ON TABLES TO sok_backup;
ALTER DEFAULT PRIVILEGES FOR ROLE sok_migrator IN SCHEMA public
    GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO sok_app;
ALTER DEFAULT PRIVILEGES FOR ROLE sok_migrator IN SCHEMA public
    GRANT SELECT ON SEQUENCES TO sok_backup;
SQL
