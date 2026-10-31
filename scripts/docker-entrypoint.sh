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
    export DATABASE_URL="file:/var/data/app_database.sqlite?connection_limit=3&busy_timeout=30000"
    echo "[INFO] DATABASE_URL nieustawione, użycie domyślnego: $DATABASE_URL"
fi

# Upewniamy się, że katalog danych istnieje
mkdir -p /var/data

# Jeśli baza danych nie istnieje w wolumenie, kopiujemy tę z obrazu (jeśli istnieje)
DB_FILE="/var/data/app_database.sqlite"

if [ ! -f "$DB_FILE" ]; then
    echo "[INFO] Baza danych nie istnieje — zostanie utworzona przez prisma migrate deploy."
fi

# Stosujemy migracje (klient Prisma jest już wygenerowany w obrazie).
# Retry: krótki lock przy równoległym starcie nie może wywracać kontenera.
echo "[INFO] Synchronizacja schematu bazy danych Prisma (migrate deploy)..."
for i in 1 2 3; do
    if npx prisma migrate deploy; then
        break
    fi
    if [ "$i" -eq 3 ]; then
        echo "[BLAD] migrate deploy nie powiodl sie 3x - sprawdz logi i lock DB."
        exit 1
    fi
    echo "[WARN] migrate deploy nieudany (proba $i/3) - ponawiam za 5 s..."
    sleep 5
done

# check-db.js czyta DATABASE_URL wprost (jak backend) - koniec z symlinkiem
# pojedynczego pliku (WAL ladowal w ephemeral /app/data zamiast w wolumenie).

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


