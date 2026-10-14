#!/usr/bin/env bash
# ============================================================
#  prod.sh - Production server (bash, rewritten 2026-07-01)
# ============================================================

set -e
cd "$(dirname "$0")"

ts() { date +%H:%M:%S; }
log() { printf "\033[1;36m[%s]\033[0m [%s] %b\n" "$(ts)" "$1" "$2"; }

log INIT "========================================================"
log INIT "  S.O.K. - Produkcja"
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

# Stare instancje serwera (DB lock): martwy node bez listenera trzyma
# -shm/-wal i wywala "database is locked" w migracji. Wykryj przed startem.
STALE_PIDS=$(bash scripts/find-stale-server.sh 2>/dev/null || true)
if [ -n "$STALE_PIDS" ]; then
    log WARN "Znaleziono procesy node serwera S.O.K.: $(echo $STALE_PIDS | tr '\n' ' ')"
    log WARN "Stara instancja blokuje baze (blad database is locked)."
    if [ "${SOK_KILL_STALE:-}" = "1" ]; then
        STO="T"
    elif [ ! -t 0 ] || [ -n "${CI:-}" ]; then
        log ERR "Tryb nieinteraktywny - nie zabijam. Zamknij stare procesy recznie (kill PID) i sprobuj ponownie."
        exit 1
    else
        read -p "Zatrzymac te procesy i kontynuowac? [N]: " STO
    fi
    if [ "$STO" = "T" ] || [ "$STO" = "t" ]; then
        # TERM, potem KILL ocalalych (supervisor + dziecko naraz).
        # shellcheck disable=SC2086
        kill $STALE_PIDS 2>/dev/null || true
        sleep 3
        LEFT=$(bash scripts/find-stale-server.sh 2>/dev/null || true)
        if [ -n "$LEFT" ]; then
            # shellcheck disable=SC2086
            kill -9 $LEFT 2>/dev/null || true
            sleep 2
        fi
        log OK "Stare procesy zatrzymane"
    else
        log ERR "Anulowane - zamknij stare procesy recznie i sprobuj ponownie."
        exit 1
    fi
fi

log STEP "Uruchamiam: npm start (Ctrl+C stop)..."
echo "  Endpoint: http://localhost:3000"
echo

# Wymuszenie trybu produkcyjnego (server.ts domyslnie uzywa development; dotenv nie nadpisze ustawionej zmiennej)
export NODE_ENV=production
npm start
