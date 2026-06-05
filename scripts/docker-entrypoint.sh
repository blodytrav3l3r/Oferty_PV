#!/bin/sh
set -e

echo "[INFO] Uruchamianie punktu wejścia Docker WITROS Oferty..."
echo "[DEBUG] Wersja Node: $(node -v)"
echo "[DEBUG] Bieżący katalog: $(pwd)"

# Ustawiamy domyślną ścieżkę do bazy, jeśli nie została podana
# Na Render.com Persistent Disk montowany jest w /var/data
if [ -z "$DATABASE_URL" ]; then
    export DATABASE_URL="file:/var/data/app_database.sqlite"
    echo "[INFO] DATABASE_URL nieustawione, użycie domyślnego: $DATABASE_URL"
fi

# Upewniamy się, że katalog danych istnieje
mkdir -p /var/data

# Jeśli baza danych nie istnieje w wolumenie, kopiujemy tę z obrazu (jeśli istnieje)
DB_FILE="/var/data/app_database.sqlite"

if [ ! -f "$DB_FILE" ]; then
    echo "[INFO] Baza danych nie istnieje — zostanie utworzona przez prisma db push."
fi

# Synchronizujemy schemat bazy (skip-generate bo klient Prisma jest już wygenerowany w obrazie)
echo "[INFO] Synchronizacja schematu bazy danych Prisma..."
npx prisma db push --skip-generate

echo "[INFO] Uruchamianie serwera aplikacji..."
exec npm start


