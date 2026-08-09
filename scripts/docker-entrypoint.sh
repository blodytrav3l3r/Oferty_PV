#!/bin/sh
set -e
# Wymuszenie trybu produkcyjnego (server.ts domyslnie uzywa development; dotenv nie nadpisze ustawionej zmiennej)
export NODE_ENV=production

echo "[INFO] Uruchamianie punktu wejścia Docker S.O.K..."
echo "[DEBUG] Wersja Node: $(node -v)"
echo "[DEBUG] Bieżący katalog: $(pwd)"

# Ustawiamy domyślną ścieżkę do bazy, jeśli nie została podana
# Dla Dockera: wolumen montowany jest w /var/data
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

# Migracja PRECO z 3 tabel do settings (przed prisma db push usuwa stare tabele)
echo "[INFO] Migracja danych PRECO (jeśli potrzebna)..."
node /app/scripts/migrate-preco-from-tables.cjs

# Synchronizujemy schemat bazy (skip-generate bo klient Prisma jest już wygenerowany w obrazie)
echo "[INFO] Synchronizacja schematu bazy danych Prisma..."
npx prisma db push --skip-generate

# check-db.js szuka bazy w ./data - wskazujemy ja na baze z wolumenu (/var/data).
# seed_*.json pozostaja w /app/data (z obrazu), wiec symlink dotyczy tylko pliku bazy.
if [ -f "$DB_FILE" ] && [ ! -e /app/data/app_database.sqlite ]; then
    ln -s "$DB_FILE" /app/data/app_database.sqlite
fi

# Seedowanie przy pustej bazie (kod 2 = puste tabele produktow).
# --experimental-sqlite: node:sqlite w Node 22 wymaga flagi (w Node 24+ jest domyslna).
if node --experimental-sqlite /app/scripts/check-db.js; then
    echo "[INFO] Baza danych kompletna - seed pominety."
else
    CHECK_EXIT=$?
    if [ "$CHECK_EXIT" -eq 2 ]; then
        echo "[INFO] Pusta baza - uruchamianie seeda (ts-node prisma/seed.ts)..."
        npx ts-node prisma/seed.ts
    elif [ "$CHECK_EXIT" -ne 0 ]; then
        echo "[WARN] check-db zwrocil kod $CHECK_EXIT - seed pominieto."
    fi
fi

echo "[INFO] Uruchamianie serwera aplikacji..."
exec npm start


