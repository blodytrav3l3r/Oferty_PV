#!/bin/sh
set -e

# Więcej informacji o środowisku
echo "[DEBUG] OS: $(uname -a || echo 'unknown')"
echo "[DEBUG] Node version: $(node -v)"
echo "[DEBUG] User: $(whoami)"
echo "[DEBUG] Current directory: $(pwd)"

echo "[INFO] Starting WITROS Oferty Docker Entrypoint..."

# Ustawiamy domyślną ścieżkę do bazy, jeśli nie została podana
if [ -z "$DATABASE_URL" ]; then
    export DATABASE_URL="file:/app/data/app_database.sqlite"
    echo "[INFO] DATABASE_URL not set, using default: $DATABASE_URL"
else
    echo "[INFO] Using custom DATABASE_URL: $DATABASE_URL"
fi

# Upewniamy się, że katalog danych istnieje
mkdir -p /app/data

# Jeśli baza danych nie istnieje w wolumenie, kopiujemy tę z obrazu (jeśli istnieje)
DB_FILE="/app/data/app_database.sqlite"
TEMPLATE_FILE="/app/app_database.sqlite.template"

if [ ! -f "$DB_FILE" ]; then
    if [ -f "$TEMPLATE_FILE" ]; then
        echo "[INFO] Database file not found in volume ($DB_FILE). Initializing from template..."
        cp "$TEMPLATE_FILE" "$DB_FILE"
        echo "[OK] Template copied."
    else
        echo "[WARNING] Database file not found and no template available at $TEMPLATE_FILE."
    fi
else
    echo "[INFO] Database file already exists at $DB_FILE."
fi

# Synchronizujemy schemat bazy
echo "[INFO] Synchronizing database schema via Prisma..."
# Używamy npx, upewniając się, że prisma jest zainstalowana w dependencies
npx prisma db push --accept-data-loss

echo "[INFO] Starting application server..."
exec npm start

