#!/usr/bin/env bash
# ============================================================
#  build.sh - Production build (bash, rewritten 2026-07-01)
# ============================================================

set -e
cd "$(dirname "$0")"

ts() { date +%H:%M:%S; }
log() { printf "\033[1;36m[%s]\033[0m [%s] %b\n" "$(ts)" "$1" "$2"; }

log INIT "========================================================"
log INIT "  WITROS Oferty PV - Budowanie produkcyjne"
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

if [ -f vite.config.js ]; then
    log STEP "Vite build (opcjonalny)..."
    npm run build:frontend || log WARN "Frontend build opcjonalny - pomijam"
else
    log SKIP "Brak vite.config.js"
fi

log OK "Gotowe do produkcji (uruchom prod.bat / prod.sh)"
