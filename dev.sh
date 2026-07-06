#!/usr/bin/env bash
# ============================================================
#  dev.sh - Development mode (rewritten 2026-07-01)
#  Backend (ts-node-dev) + Frontend (Vite)
#  Poprawki:
#    - timestamps w logach
#    - kolory ANSI w stdout
#    - lepsze error reporting
#    - bezpieczny port-check
# ============================================================

set -e
cd "$(dirname "$0")"

# Funkcja log
log() {
    local type=$1
    local color="\033[1;36m"
    local ts=$(date +%H:%M:%S)
    case "$type" in
        ERROR) color="\033[1;31m" ;;
        WARN)  color="\033[1;33m" ;;
        OK)    color="\033[1;32m" ;;
        STEP)  color="\033[1;34m" ;;
    esac
    shift
    printf "${color}[%s] [%s]${NC} %b\n" "$ts" "$type" "$*"
}

NC="\033[0m"

log INIT "========================================================"
log INIT "  WITROS Oferty PV - Development Mode (bash)"
log INIT "========================================================"

# 1. Walidacja Node.js
log STEP "Krok 1/6 - Sprawdzanie Node.js 20+..."
command -v node >/dev/null 2>&1 || { log ERROR "Brak Node.js"; exit 1; }
NODE_VER=$(node --version)
NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1 | tr -d 'v')
[ "$NODE_MAJOR" -ge 20 ] || { log ERROR "Wymagane Node.js >=20. Wykryto $NODE_VER"; exit 1; }
log OK "Node.js $NODE_VER"

# 2. node_modules
log STEP "Krok 2/6 - Sprawdzanie node_modules..."
if [ ! -d node_modules ]; then
    log WARN "Brak node_modules - uruchamiam install.sh..."
    bash install.sh
else
    log OK "node_modules istnieje"
fi

# 3. Prisma Client
log STEP "Krok 3/6 - Generowanie Prisma Client..."
if [ ! -f generated/prisma/index.d.ts ]; then
    npx prisma generate
    log OK "Prisma Client wygenerowany"
else
    log OK "Prisma Client OK"
fi

# 4. Schema DB
log STEP "Krok 4/6 - Sprawdzanie schematu (7 tabel telemetry/AI)..."
if ! node scripts/check-db.js >/dev/null 2>&1; then
    log WARN "Schema niezgodny - db push --accept-data-loss"
    npx prisma db push --skip-generate --accept-data-loss
else
    log OK "Schema OK"
fi

# 5. Port 3000 - bezpieczny check (nie netstat, a lsof jeśli dostępne)
log STEP "Krok 5/6 - Sprawdzanie portu 3000..."
PORT_PID=""
if command -v lsof >/dev/null 2>&1; then
    PORT_PID=$(lsof -t -i:3000 -sTCP:LISTEN 2>/dev/null || true)
elif command -v fuser >/dev/null 2>&1; then
    PORT_PID=$(fuser 3000/tcp 2>/dev/null || true)
elif command -v ss >/dev/null 2>&1; then
    PORT_PID=$(ss -ltnp 2>/dev/null | grep ':3000 ' | grep -oP 'pid=\K\d+' || true)
fi

if [ -n "$PORT_PID" ]; then
    log WARN "Port 3000 uzywany przez PID $PORT_PID"
    read -p "Zatrzymac proces i uruchomic WITROS? [T/N] " STO
    if [ "$STO" = "T" ] || [ "$STO" = "t" ]; then
        kill -9 "$PORT_PID" 2>/dev/null
        sleep 2
        log OK "Port zwolniony"
    else
        log ERROR "Anulowane"
        exit 1
    fi
else
    log OK "Port 3000 wolny"
fi

# 6. Start aplikacji
log STEP "Krok 6/6 - Uruchamiam npm run dev (Ctrl+C stop)"
echo
echo "  Backend:  http://localhost:3000"
echo "  Frontend: Vite proxy (3000)"
echo
echo "Nacisnij Ctrl+C aby zatrzymac"
echo

npm run dev
