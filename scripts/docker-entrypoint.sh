#!/bin/sh
set -e

echo "[INFO] Uruchamianie punktu wejścia Docker WITROS Oferty..."
echo "[DEBUG] Wersja Node: $(node -v)"
echo "[DEBUG] Bieżący katalog: $(pwd)"

# Ustawiamy domyślną ścieżkę do bazy, jeśli nie została podana
if [ -z "$DATABASE_URL" ]; then
    export DATABASE_URL="file:/app/data/app_database.sqlite"
    echo "[INFO] DATABASE_URL nieustawione, użycie domyślnego: $DATABASE_URL"
fi

# Upewniamy się, że katalog danych istnieje
mkdir -p /app/data

# Jeśli baza danych nie istnieje w wolumenie, kopiujemy tę z obrazu (jeśli istnieje)
DB_FILE="/app/data/app_database.sqlite"
TEMPLATE_FILE="/app/app_database.sqlite.template"

if [ ! -f "$DB_FILE" ]; then
    if [ -f "$TEMPLATE_FILE" ]; then
        echo "[INFO] Inicjalizacja bazy danych z szablonu..."
        cp "$TEMPLATE_FILE" "$DB_FILE"
    else
        echo "[OSTRZEŻENIE] Plik bazy danych nie został znaleziony i brak dostępnego szablonu."
    fi
fi

# Synchronizujemy schemat bazy (skip-generate bo klient Prisma jest już wygenerowany w obrazie)
echo "[INFO] Synchronizacja schematu bazy danych Prisma..."
npx prisma db push --accept-data-loss --skip-generate

echo "[INFO] Uruchamianie serwera aplikacji..."
exec npm start


