#!/usr/bin/env bash
# ============================================================
#  install.sh - Linux/macOS/git-bash (Mirror of install.bat)
#  Architektura: Node.js + Express + Prisma + AI Learning Engine
# ============================================================

set -e
cd "$(dirname "$0")"

echo "=========================================================="
echo "  WITROS Oferty PV - instalator (Node + AI + Telemetry)"
echo "=========================================================="
echo

# 1. Node.js
echo "[1/8] Sprawdzanie Node.js..."
if ! command -v node >/dev/null 2>&1; then
    echo "BLAD: Node.js nie jest zainstalowany."
    echo "Zainstaluj LTS 20+ z https://nodejs.org/"
    exit 1
fi
NODE_VER=$(node --version)
NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1 | tr -d 'v')
if [ "$NODE_MAJOR" -lt 20 ]; then
    echo "BLAD: Wymagane Node.js >= 20. Wykryto $NODE_VER"
    exit 1
fi
echo "     [OK] Node.js $NODE_VER"
echo

# 2. npm
echo "[2/8] Sprawdzanie npm..."
if ! command -v npm >/dev/null 2>&1; then
    echo "BLAD: npm nie jest dostepny."
    exit 1
fi
echo "     [OK] npm $(npm --version)"
echo

# 3. Git
echo "[3/8] Sprawdzanie Git (dla husky)..."
if ! command -v git >/dev/null 2>&1; then
    echo "UWAGA: Git nie jest zainstalowany, hooki husky moga nie dzialac."
else
    echo "     [OK] Git jest zainstalowany."
fi
echo

# 4. Struktura
echo "[4/8] Sprawdzanie struktury katalogow..."
for d in src public tests prisma; do
    if [ ! -d "$d" ]; then
        echo "BLAD: Brak katalogu $d/"
        exit 1
    fi
done
echo "     [OK] Struktura repo poprawna."
echo

# 5. npm install
echo "[5/8] npm install..."
if [ -f "package-lock.json" ]; then
    npm ci --no-audit --no-fund
else
    npm install --no-audit --no-fund
fi
echo "     [OK] Zaleznosci zainstalowane."
echo

# 6. Prisma
echo "[6/8] Prisma generate + migracja..."
npx prisma generate || { echo "BLAD: prisma generate"; exit 1; }
echo "     [OK] Prisma client wygenerowany."

if [ -d "migrations" ] && [ -f "migrations/migration_lock.toml" ]; then
    npx prisma migrate deploy || npx prisma db push --skip-generate --accept-data-loss
else
    npx prisma db push --skip-generate --accept-data-loss
fi
echo "     [OK] Schemat bazy aktualny."
echo

# 7. Seed (opcja)
echo "[7/8] Seed (opcjonalny)..."
if [ -f "prisma/seed.ts" ]; then
    npx ts-node prisma/seed.ts || echo "     [UWAGA] Seed nie powiodl sie - pomijam."
else
    echo "     [INFO] Brak prisma/seed.ts — pomijam."
fi
echo

# 8. Typecheck
echo "[8/8] TypeScript typecheck..."
npx tsc --noEmit || echo "     [UWAGA] Typecheck wykryl problemy."
echo

echo "=========================================================="
echo "  GOTOWE - instalacja zakonczona"
echo "=========================================================="
echo
echo "Nastepne kroki:"
echo "  bash dev.sh    — development z hot reload"
echo "  bash build.sh  — produkcyjny build"
echo "  bash prod.sh   — server produkcyjny (Ctrl+C)"
echo
echo "Cron Service uruchamiany automatycznie przez server.ts"
echo "Aplikacja: http://localhost:3000"
