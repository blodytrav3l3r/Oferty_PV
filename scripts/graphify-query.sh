#!/bin/sh
# graphify-query.sh — query graph z cache
# Usage: sh scripts/graphify-query.sh "pytanie"
# Zwraca: wynik z cache/ lub nowy query, zapisuje do cache

QUESTION="$1"
HASH=$(echo "$QUESTION" | md5sum 2>/dev/null | cut -d' ' -f1 || echo "$QUESTION" | certutil -hashfile - MD5 2>/dev/null | head -1 | tr -d ' ')

CACHE_FILE="graphify-out/query-cache/$HASH.json"
if [ -f "$CACHE_FILE" ]; then
    echo "[graphify-query] CACHE HIT: $QUESTION"
    cat "$CACHE_FILE"
    exit 0
fi

echo "[graphify-query] CACHE MISS: $QUESTION"

# Run graphify query with budget 1500 for minimal tokens
RESULT=$(python3 -m graphify query "$QUESTION" --budget 1500 2>&1)

echo "$RESULT"
echo "$RESULT" > "$CACHE_FILE"
echo "[graphify-query] Saved to cache/$HASH.json"
