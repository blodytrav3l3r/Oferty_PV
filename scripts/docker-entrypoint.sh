#!/bin/sh
set -e

echo "[INFO] Starting WITROS Oferty Docker Entrypoint..."

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
        echo "[INFO] Database file not found in volume. Initializing from template..."
        cp "$TEMPLATE_FILE" "$DB_FILE"
    else
        echo "[WARNING] Database file not found and no template available. A fresh DB will be created by Prisma."
    fi
fi

# Synchronizujemy schemat bazy (wymaga 'prisma' w dependencies)
echo "[INFO] Synchronizing database schema..."
npx prisma db push --accept-data-loss

echo "[INFO] Starting application..."
exec npm start
