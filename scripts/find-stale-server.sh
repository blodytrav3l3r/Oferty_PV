#!/usr/bin/env bash
# find-stale-server.sh - wypisuje PID procesow node martwego serwera S.O.K.
# (ts-node-dev / server.ts / dist/server.js, takze bez listenera na :3000).
# Jeden PID na linie, brak outputu gdy czysto. Nie zabija - decyduje caller.
# Uzycie: PIDS=$(bash scripts/find-stale-server.sh)
set -u
PIDS=""
if command -v pgrep >/dev/null 2>&1; then
    # sort -u: supervisor + dziecko moga matchowac jednoczesnie.
    PIDS=$(pgrep -f "ts-node-dev|dist/server\.js|(^|[ /])server\.js|server\.ts" 2>/dev/null | sort -u -n || true)
elif command -v ps >/dev/null 2>&1; then
    PIDS=$(ps -ef 2>/dev/null | grep -E "ts-node-dev|dist/server\.js|(^|[ /])server\.js|server\.ts" | grep -v grep | awk '{print $2}' | sort -u -n || true)
fi
# Self-exclusion: helper nigdy nie matchuje wlasnej linii (nazwa pliku bez wzorca),
# ale odfiltruj wlasny PID i rodzica na wszelki wypadek.
for p in $PIDS; do
    if [ "$p" != "$$" ] && [ "$p" != "$PPID" ]; then
        echo "$p"
    fi
done
