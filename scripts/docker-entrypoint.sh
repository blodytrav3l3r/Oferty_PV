#!/bin/sh
set -e

echo "[INFO] Starting WITROS Oferty Docker Entrypoint..."
echo "[DEBUG] Node version: $(node -v)"
echo "[DEBUG] Current directory: $(pwd)"

# Ustawiamy domyślną ścieżkę do bazy, jeśli nie została podana
if [ -z "$DATABASE_URL" ]; then
    export DATABASE_URL="file:/app/data/app_database.sqlite"
    echo "[INFO] DATABASE_URL not set, using default: $DATABASE_URL"
fi

# Upewniamy się, że katalog danych istnieje
mkdir -p /app/data

# Jeśli baza danych nie istnieje w wolumenie, kopiujemy tę z obrazu (jeśli istnieje)
DB_FILE="/app/data/app_database.sqlite"
TEMPLATE_FILE="/app/app_database.sqlite.template"

if [ ! -f "$DB_FILE" ]; then
    if [ -f "$TEMPLATE_FILE" ]; then
        echo "[INFO] Initializing database from template..."
        cp "$TEMPLATE_FILE" "$DB_FILE"
    else
        echo "[WARNING] Database file not found and no template available."
    fi
fi

# Synchronizujemy schemat bazy
echo "[INFO] Synchronizing Prisma database schema..."
npx prisma db push --accept-data-loss

echo "[INFO] Starting application server..."
exec npm start


