#!/bin/bash
# WITROS Oferty PV - instalator (bash / git-bash / Linux / macOS)

set -e
cd "$(dirname "$0")"

echo "===================================================="
echo "  WITROS Oferty PV - instalator"
echo "===================================================="
echo

# 1. Node.js
echo "[1/6] Sprawdzenie Node.js..."
if ! command -v node >/dev/null 2>&1; then
    echo "BLAD: Node.js nie jest zainstalowany."
    echo "Zainstaluj LTS 18+ ze strony https://nodejs.org/"
    read -p "Enter..."
    exit 1
fi
node --version
echo "OK"
echo

# 2. npm
echo "[2/6] Sprawdzenie npm..."
if ! command -v npm >/dev/null 2>&1; then
    echo "BLAD: npm nie jest dostepny."
    read -p "Enter..."
    exit 1
fi
npm --version
echo "OK"
echo

# 3. zależności
echo "[3/6] npm install..."
if [ ! -f "package.json" ]; then
    echo "BLAD: brak package.json w $(pwd)"
    read -p "Enter..."
    exit 1
fi
npm install --no-audit --no-fund
echo "OK"
echo

# 4. Prisma generate
echo "[4/6] prisma generate..."
npx prisma generate
echo "OK"
echo

# 5. Prisma db push
echo "[5/6] prisma db push --accept-data-loss..."
npx prisma db push --accept-data-loss
echo "OK"
echo

# 6. Seed (opcja)
echo "[6/6] Seed danych (opcja)..."
if [ -f "prisma/seed.js" ] || [ -f "prisma/seed.ts" ] || [ -f "prisma/seed.mjs" ]; then
    npx prisma db seed || echo "(seed pominiety - brak skryptu seed)"
else
    echo "(brak pliku seed - pomijam)"
fi
echo

echo "===================================================="
echo "  GOTOWE"
echo "===================================================="
echo
echo "Uruchomienie:"
echo "  - produkcja:  npm start"
echo "  - dev:        npm run dev"
echo
echo "Aplikacja: http://localhost:3000"
echo "Konto: admin / admin123"
echo

read -p "Uruchomic serwer teraz? (T/N): " RUN
if [[ "$RUN" =~ ^[TtYy]$ ]]; then
    echo
    echo "Uruchamiam server..."
    echo "(Zatrzymanie: Ctrl+C)"
    echo
    npm start
fi
