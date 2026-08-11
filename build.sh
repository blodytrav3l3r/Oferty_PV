#!/usr/bin/env bash
# ============================================================
#  build.sh - Production build (bash, rewritten 2026-07-01)
# ============================================================

set -e
cd "$(dirname "$0")"

ts() { date +%H:%M:%S; }
log() { printf "\033[1;36m[%s]\033[0m [%s] %b\n" "$(ts)" "$1" "$2"; }

log INIT "========================================================"
log INIT "  S.O.K. - Budowanie produkcyjne"
log INIT "========================================================"

command -v node >/dev/null || { log ERR "Brak Node.js"; exit 1; }
log OK "Node.js $(node --version)"

# npm ci jesli brak node_modules
if [ ! -d node_modules ]; then
    log STEP "npm ci..."
    npm ci --no-audit --no-fund
else
    log SKIP "node_modules istnieje"
fi

log STEP "Prisma generate..."
npx prisma generate

log STEP "TypeScript compile..."
npx tsc

log STEP "Kopiowanie Prisma Client do dist..."
mkdir -p dist/generated
cp -r generated/prisma dist/generated/

log OK "Gotowe do produkcji (uruchom prod.bat / prod.sh)"
