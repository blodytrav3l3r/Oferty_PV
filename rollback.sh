#!/usr/bin/env bash
# ============================================================
#  rollback.sh - Powrot do poprzedniej wersji (rdzen w rollback.mjs)
#  Uzycie: rollback.sh <windows|linux|docker> vX.Y.Z [--dry-run]
#  Przyklad: ./rollback.sh linux v1.15.1
# ============================================================
set -e
cd "$(dirname "$0")"
node scripts/rollback.mjs "$@"