#!/usr/bin/env bash
# ============================================================
#  prod.sh - Production server (bash, rewritten 2026-07-01)
# ============================================================

set -e
cd "$(dirname "$0")"

ts() { date +%H:%M:%S; }
log() { printf "\033[1;36m[%s]\033[0m [%s] %b\n" "$(ts)" "$1" "$2"; }

log INIT "========================================================"
log INIT "  WITROS Oferty PV - Produkcja"
log INIT "========================================================"

# Walidacja
command -v node >/dev/null || { log ERR "Brak Node.js"; exit 1; }
log OK "Node.js $(node --version)"

# Sprawdzenie dist
if [ ! -f "dist/server.js" ]; then
    log WARN "Brak dist/server.js - budowanie..."
    bash build.sh
else
    log OK "dist/server.js istnieje"
fi

# Port check
log STEP "Sprawdzanie portu 3000..."
if command -v lsof >/dev/null; then
    PID=$(lsof -t -i:3000 -sTCP:LISTEN 2>/dev/null || true)
    if [ -n "$PID" ]; then
        log WARN "Port 3000 zajety przez PID $PID"
        read -p "Zatrzymac i uruchomic? [T/N] " STO
        if [ "$STO" = "T" ] || [ "$STO" = "t" ]; then
            kill -9 "$PID" 2>/dev/null
            sleep 2
        else
            log ERR "Anulowane"; exit 1
        fi
    fi
fi

mkdir -p data

log STEP "Uruchamiam: npm start (Ctrl+C stop)..."
echo "  Endpoint: http://localhost:3000"
echo

npm start
