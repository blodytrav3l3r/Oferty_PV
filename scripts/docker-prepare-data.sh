#!/usr/bin/env bash
# ============================================================
#  docker-prepare-data.sh - Host-side ownership prep dla Docker
#  P0.3-B: bind mount ./data:/var/data + container USER=node
#
#  Problem: swiezy ./data tworzy Docker jako root (albo nalezy do
#  host-UID != UID node) i proces node nie moze pisac do /var/data
#  (migrate deploy: "unable to open database file").
#  Build-time `chown /var/data` z Dockerfile jest pod bind mountem
#  nieskuteczny, wiec katalog HOSTA trzeba przygotowac przed compose.
#
#  Model (chirurgiczny, bez chown -R):
#    ./data                  -> node UID:GID (kontener tworzy tu DB/WAL)
#    app_database.sqlite*    -> node UID:GID (WAL wymaga zapisu do pliku)
#    ./data/backups          -> wywolujacy uzytkownik (hostowy backup cron)
#    seed_*.json, backups/*  -> NIETYKANE
#
#  UID/GID wykrywane dynamicznie z GOTOWEGO obrazu (zero zalozen o 1000).
#  Idempotentne: wielokrotny start nie zmienia stanu ani danych.
#  Uzycie: sudo bash scripts/docker-prepare-data.sh [--dry-run]
# ============================================================

set -euo pipefail

DRY_RUN=false
if [ "${1:-}" = "--dry-run" ]; then
    DRY_RUN=true
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

log() { printf '[prepare-data] %s\n' "$*"; }
die() { printf '[prepare-data] [BLAD] %s\n' "$*" >&2; exit 1; }

# Guard 1: pracujemy w repo S.O.K. (pin katalogu, brak parametrow sciezki).
[ -f docker-compose.yml ] || die "brak docker-compose.yml w $ROOT - uruchom z katalogu projektu"
[ -f Dockerfile ] || die "brak Dockerfile w $ROOT - uruchom z katalogu projektu"
grep -q '\./data:/var/data' docker-compose.yml || die "compose nie montuje ./data:/var/data - przerwano"

DATA_DIR="$ROOT/data"
BACKUPS_DIR="$DATA_DIR/backups"
DB_FILES=(app_database.sqlite app_database.sqlite-wal app_database.sqlite-shm)

# UID/GID wywolujacego (wlasciciel hostowego backupu). Pod sudo bierzemy
# faktycznego uzytkownika, nie roota.
if [ -n "${SUDO_USER:-}" ]; then
    CALLER_UID="$(id -u "$SUDO_USER")"
    CALLER_GID="$(id -g "$SUDO_USER")"
else
    CALLER_UID="$(id -u)"
    CALLER_GID="$(id -g)"
fi

if [ "$DRY_RUN" = true ]; then
    log "[dry-run] zbudowalbym obraz: docker compose build -q app"
    log "[dry-run] odczytalbym id -u/-g node z obrazu"
    log "[dry-run] mkdir -p $DATA_DIR $BACKUPS_DIR"
    log "[dry-run] chown <nodeUID>:<nodeGID> na: $DATA_DIR + app_database.sqlite*"
    log "[dry-run] chown $CALLER_UID:$CALLER_GID na NOWY $BACKUPS_DIR (istniejacy nietkniety)"
    exit 0
fi

command -v docker >/dev/null 2>&1 || die "brak dockera w PATH"

# Deterministyczny odczyt ID: `docker compose build -q` na niektorych
# wersjach Compose konczy sie kodem 0 bez ID na stdout (CI 35762836155).
# `docker build -q` gwarantuje samo ID na stdout; Dockerfile i kontekst
# sa te same, ktorych uzywa pozniej `docker compose up --build`.
log "Buduje obraz app (cache)..."
IMG="$(docker build -q -f Dockerfile .)"
case "$IMG" in
    sha256:[0-9a-f][0-9a-f]*) ;;
    *) die "nie ustalono ID obrazu app (pusty/nieprawidlowy stdout budowania)" ;;
esac
log "Obraz app: ${IMG:0:19}..."

log "Odczytuje UID/GID node z obrazu $IMG..."
PUID="$(docker run --rm --entrypoint sh "$IMG" -c 'id -u node')"
PGID="$(docker run --rm --entrypoint sh "$IMG" -c 'id -g node')"
case "$PUID/$PGID" in
    [0-9]*'/'[0-9]*) ;;
    *) die "nieprawidlowy UID/GID z obrazu: '$PUID/$PGID'" ;;
esac
log "node w obrazie: $PUID:$PGID (wywolujacy: $CALLER_UID:$CALLER_GID)"

mkdir -p "$DATA_DIR"

# backups/ dla hostowego backupu: nowo utworzony dostaje wlasciciela
# wywolujacego; istniejacy zostaje NIETKNIETY (nadal jego).
BACKUPS_CREATED=false
if [ ! -e "$BACKUPS_DIR" ]; then
    mkdir -p "$BACKUPS_DIR"
    BACKUPS_CREATED=true
fi

# Chirurgiczny chown: katalog + pliki DB. Bez -R: seedy (read-only dla
# aplikacji) i zawartosc backups/* zostaja przy dotychczasowym wlascicielu.
TARGETS=("$DATA_DIR")
for f in "${DB_FILES[@]}"; do
    if [ -e "$DATA_DIR/$f" ]; then
        TARGETS+=("$DATA_DIR/$f")
    fi
done
if ! chown "$PUID:$PGID" "${TARGETS[@]}" 2>/dev/null; then
    die "chown wymaga roota - uruchom: sudo bash scripts/docker-prepare-data.sh"
fi
if [ "$BACKUPS_CREATED" = true ]; then
    chown "$CALLER_UID:$CALLER_GID" "$BACKUPS_DIR" || die "nie ustawiono wlasciciela $BACKUPS_DIR"
fi

log "[OK] $DATA_DIR -> $PUID:$PGID (+ DB jesli istniala); backups dla $CALLER_UID:$CALLER_GID"
log "Dalej: docker compose up -d --build"
