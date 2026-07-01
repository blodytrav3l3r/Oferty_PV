#!/usr/bin/env bash
# ============================================================
#  build.sh - Production build (bash mirror of build.bat)
# ============================================================

set -e
cd "$(dirname "$0")"

command -v node >/dev/null 2>&1 || { echo "BLAD: Brak Node.js."; exit 1; }

[ -d node_modules ] || { echo "[INFO] Brak node_modules - npm ci..."; npm ci --no-audit --no-fund; }

echo "[INFO] Prisma generate..."
npx prisma generate

echo "[INFO] TypeScript compile (backend)..."
npx tsc

if [ -f vite.config.js ]; then
    echo "[INFO] Budowanie frontendu z Vite (opcja)..."
    npm run build:frontend || echo "[UWAGA] Frontend build opcjonalny - pomijam"
fi

echo "[OK] Gotowe do produkcji."
