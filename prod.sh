#!/usr/bin/env bash
# ============================================================
#  prod.sh - Production server (bash mirror of prod.bat)
# ============================================================

set -e
cd "$(dirname "$0")"

command -v node >/dev/null 2>&1 || { echo "BLAD: Brak Node.js."; exit 1; }

if [ ! -f dist/server.js ]; then
    echo "[INFO] Brak dist - budowanie..."
    bash build.sh
fi

mkdir -p data

echo "[INFO] Uruchamiam serwer produkcyjny (Ctrl+C stop)..."
echo "        Init: Express + Prisma + Cron Service + AI Learning Engine"
echo

npm start
