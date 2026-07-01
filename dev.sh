#!/usr/bin/env bash
# ============================================================
#  dev.sh - Development mode (bash mirror of dev.bat)
# ============================================================

set -e
cd "$(dirname "$0")"

echo "=========================================================="
echo "  WITROS Oferty PV - Development Mode"
echo "=========================================================="
echo

command -v node >/dev/null 2>&1 || { echo "BLAD: Brak Node.js."; exit 1; }

if [ ! -d node_modules ]; then
    echo "[INFO] Brak node_modules - uruchamiam install.sh..."
    bash install.sh
fi

if [ ! -d generated/prisma ]; then
    echo "[INFO] Generate Prisma client..."
    npx prisma generate
fi

echo "[INFO] Sprawdzanie schematu bazy..."
node scripts/check-db.js 2>/dev/null || npx prisma db push --skip-generate --accept-data-loss 2>/dev/null

export PORT="${PORT:-3000}"
echo
echo "[INFO] Uruchamiam backend + frontend (Ctrl+C stop)"
echo "[INFO] Backend:  http://localhost:\$PORT"
echo "[INFO] Frontend: Vite proxy"
echo

npm run dev
