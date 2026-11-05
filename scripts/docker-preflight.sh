#!/bin/sh
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f docker-compose.yml ] || [ ! -f Dockerfile ]; then
    echo '[preflight] Docker Compose or Dockerfile is missing.' >&2
    exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
    echo '[preflight] Docker is required for the PostgreSQL Compose deployment.' >&2
    exit 1
fi

if [ "${1:-}" = '--dry-run' ]; then
    echo '[preflight] Would validate required PostgreSQL Compose configuration.'
    exit 0
fi

if ! docker compose config --quiet; then
    echo '[preflight] Compose configuration is invalid or required environment is missing.' >&2
    exit 1
fi

echo '[preflight] PostgreSQL Compose configuration is valid.'
