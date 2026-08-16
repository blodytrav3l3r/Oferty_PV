#!/usr/bin/env bash
# ============================================================
#  deploy.sh - Uruchamia deploy aplikacji (rdzen w deploy.mjs)
#  Uzycie: deploy.sh <windows|linux|docker> vX.Y.Z [--dry-run]
#  Przyklad: ./deploy.sh linux v1.16.0
#  Podglad:  ./deploy.sh linux v1.16.0 --dry-run
# ============================================================
set -e
cd "$(dirname "$0")"
node scripts/deploy.mjs "$@"