#!/usr/bin/env bash
# ============================================================
#  install.sh - Setup środowiska devs (bash, rewritten 2026-07-01)
# ============================================================

set -e
cd "$(dirname "$0")"

ts() { date +%H:%M:%S; }
log() { printf "\033[1;36m[%s]\033[0m [%s] %b\n" "$(ts)" "$1" "$2"; }
err() { printf "\033[1;31m[%s] [ERR] %b\033[0m\n" "$(ts)" "$*"; exit 1; }
warn() { printf "\033[1;33m[%s] [WARN] %b\033[0m\n" "$(ts)" "$*"; }

log INIT "========================================================"
log INIT "  WITROS Oferty PV - Instalator (bash)"
log INIT "========================================================"

# 1. Node.js
log STEP "Krok 1/8 - Node.js 20+..."
command -v node >/dev/null 2>&1 || err "Brak Node.js"
NODE_VER=$(node --version)
NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1 | tr -d 'v')
[ "$NODE_MAJOR" -ge 20 ] || err "Wymagane Node.js >=20 (masz $NODE_VER)"
log OK "Node.js $NODE_VER"

# 2. npm
log STEP "Krok 2/8 - npm..."
command -v npm >/dev/null 2>&1 || err "Brak npm"
log OK "npm $(npm --version)"

# 3. Git (opcjonalny)
log STEP "Krok 3/8 - Git..."
if command -v git >/dev/null 2>&1; then
    log OK "Git OK"
else
    warn "Brak Git - husky hooks nie beda dzialac"
fi

# 4. Struktura
log STEP "Krok 4/8 - Struktura (src/public/tests/prisma)..."
for d in src public tests prisma; do
    [ -d "$d" ] || err "Brak katalogu $d/"
done
log OK "Struktura OK"

# 5. npm install
log STEP "Krok 5/8 - npm install (moze potrwac kilka minut)..."
if [ -f package-lock.json ]; then
    npm ci --no-audit --no-fund
else
    npm install --no-audit --no-fund
fi
log OK "node_modules zainstalowane"

# 6. Prisma
log STEP "Krok 6/8 - Prisma generate + migrate..."
npx prisma generate
log OK "Prisma client"

if [ -f "migrations/migration_lock.toml" ]; then
    log STEP "  prisma migrate deploy..."
    npx prisma migrate deploy || {
        warn "migrate deploy nie powiodl sie - fallback db push"
        npx prisma db push --skip-generate --accept-data-loss
    }
else
    log STEP "  brak migrations - db push"
    npx prisma db push --skip-generate --accept-data-loss
fi
log OK "Schema bazy aktualny"

# 7. Seed
log STEP "Krok 7/8 - Seed (opcjonalny)..."
if [ -f "prisma/seed.ts" ]; then
    if npx ts-node prisma/seed.ts; then
        log OK "Seed OK"
    else
        warn "Seed nie powiodl sie - pomijam"
    fi
else
    log SKIP "Brak prisma/seed.ts"
fi

# 8. Typecheck
log STEP "Krok 8/8 - TypeScript typecheck..."
if npx tsc --noEmit; then
    log OK "Brak bledow typow"
else
    warn "Typecheck wykryl problemy - sprawdz przed startem"
fi

log OK "========================================================"
log OK "  INSTALACJA ZAKONCZONA"
log OK "========================================================"
echo
echo "Nastepne kroki:"
echo "  bash dev.sh  / bash prod.sh"
echo "  URL: http://localhost:3000"
