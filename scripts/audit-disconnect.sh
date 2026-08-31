#!/bin/bash
# scripts/audit-disconnect.sh — S.O.K. P0: bezpieczny zbieracz diagnostyki rozlaczen (Linux+Docker)
#
# Cel: zebrac JEDEN pelny incydent do archiwum bez zmian w produkcji (tylko odczyt).
# Uruchomienie (na hoscie Linux z Dockerem):
#   bash scripts/audit-disconnect.sh            # zapisze sok-audit-*.tar.gz w katalogu biezacym
#   bash scripts/audit-disconnect.sh --since 4h # logi z 4h (domyslnie 2h)
#   bash scripts/audit-disconnect.sh --out /tmp # inny katalog wyjsciowy
#
# Wymagania: docker, (opcjonalnie) sqlite3, curl, jq; bez roota zbierze co sie da.
# Bezpieczenstwo: ZERO komend destrukcyjnych, nadpisujacych ani restartujacych kontener/proxy.
# Kodowanie: UTF-8 bez BOM.

set -u

SINCE="2h"
OUT_DIR="."
CONTAINER="sok-oferty"
DOMAIN="${DOMAIN:-}"

while [ $# -gt 0 ]; do
  case "$1" in
    --since) SINCE="${2:-2h}"; shift 2 ;;
    --out) OUT_DIR="${2:-.}"; shift 2 ;;
    --container) CONTAINER="${2:-sok-oferty}"; shift 2 ;;
    --help|-h)
      echo "Uzycie: $0 [--since 2h] [--out DIR] [--container NAME]"
      echo "  Zbiera: docker ps/inspect/logs/stats/events, dmesg, journalctl, caddy/nginx, curl /health*, env, PRAGMA, mount, df, free"
      exit 0
      ;;
    *) echo "[WARN] Nieznany argument: $1" >&2; shift ;;
  esac
done

STAMP="$(date +%Y%m%d-%H%M%S)"
TMPDIR="$(mktemp -d 2>/dev/null || mktemp -d -t sok-audit)"
OUT_FILE="${OUT_DIR}/sok-audit-${STAMP}.tar.gz"
mkdir -p "$OUT_DIR" 2>/dev/null || true

log() { echo "[$(date -Iseconds)] $*"; }
sec() { echo ""; echo "===== $* =====" | tee -a "$TMPDIR/00-meta.txt"; }
cap() {
  # cap "naglowek" "komenda" [plik_wyjsciowy]
  local title="$1"; local cmd="$2"; local out="${3:-}"
  echo "" >> "$TMPDIR/00-meta.txt"
  echo "--- $title ---" >> "$TMPDIR/00-meta.txt"
  echo "\$ $cmd" >> "$TMPDIR/00-meta.txt"
  if [ -n "$out" ]; then
    sh -c "$cmd" > "$TMPDIR/$out" 2>&1 || echo "[exit $?]" >> "$TMPDIR/$out"
    echo "-> $out" >> "$TMPDIR/00-meta.txt"
  else
    sh -c "$cmd" >> "$TMPDIR/00-meta.txt" 2>&1 || true
  fi
}

log "S.O.K. audit-disconnect — start (since=$SINCE, container=$CONTAINER, out=$OUT_FILE)"
{
  echo "S.O.K. audit-disconnect"
  echo "stamp: $STAMP"
  echo "since: $SINCE"
  echo "container: $CONTAINER"
  echo "host: $(hostname 2>/dev/null || echo unknown)"
  echo "uname: $(uname -a 2>/dev/null || true)"
  echo "date: $(date -Iseconds)"
} > "$TMPDIR/00-meta.txt"

# ── 1. Docker: stan kontenera (P0 #2-4) ──────────────────────────────
sec "1. DOCKER — stan kontenera"
cap "docker ps -a" "docker ps -a 2>&1" "01-docker-ps.txt"
cap "docker inspect State/Health" "docker inspect $CONTAINER --format '{{json .State}}' 2>&1 | python3 -m json.tool 2>&1 || docker inspect $CONTAINER --format '{{json .State}}' 2>&1 || docker inspect $CONTAINER 2>&1 | head -n 300" "02-docker-inspect-state.txt"
cap "docker inspect Health (raw)" "docker inspect $CONTAINER --format '{{json .State.Health}}' 2>&1 | python3 -m json.tool 2>&1 || docker inspect $CONTAINER --format '{{json .State.Health}}' 2>&1" "03-docker-health.txt"
cap "docker inspect Config Env/Volumes" "docker inspect $CONTAINER --format 'Env: {{json .Config.Env}} | Mounts: {{json .Mounts}} | RestartPolicy: {{json .HostConfig.RestartPolicy}}' 2>&1" "04-docker-config.txt"
cap "docker stats --no-stream" "docker stats --no-stream 2>&1 | head -n 30" "05-docker-stats.txt"
cap "docker events --since $SINCE" "timeout 5 docker events --since $SINCE --until 0s 2>&1 | head -n 500 || docker events --since $SINCE 2>&1 | head -n 500" "06-docker-events.txt"

# ── 2. Logi kontenera — korelacja A (exit) i B (SQLITE_BUSY) + E (CronService) ──
sec "2. LOGI KONTENERA — korelacja A/B/E"
cap "docker logs --since $SINCE (timestamps, 2000 linii)" "docker logs --since $SINCE --timestamps $CONTAINER 2>&1 | tail -n 2000" "10-docker-logs.txt"
cap "grep UnhandledRejection/UncaughtException/flushSentry" "docker logs --since $SINCE --timestamps $CONTAINER 2>&1 | grep -i -E 'UnhandledRejection|UncaughtException|flushSentry|UnhandledError' | tail -n 200 || echo '(brak dopasowan)'" "11-grep-rejection.txt"
cap "grep SQLITE_BUSY/busy/timeout/PRAGMA" "docker logs --since $SINCE --timestamps $CONTAINER 2>&1 | grep -i -E 'SQLITE_BUSY|busy|timeout|PRAGMA|P1017|Unable to open' | tail -n 200 || echo '(brak dopasowan)'" "12-grep-busy.txt"
cap "grep CronService/mlTraining/429" "docker logs --since $SINCE --timestamps $CONTAINER 2>&1 | grep -i -E 'CronService|mlTraining|fullCycle|Retry-After| 429 ' | tail -n 200 || echo '(brak dopasowan)'" "13-grep-cron-ratelimit.txt"
cap "grep ERROR/WARN" "docker logs --since $SINCE --timestamps $CONTAINER 2>&1 | grep -i -E '\\[ERROR\\]|\\[WARN\\]' | tail -n 300 || echo '(brak dopasowan)'" "14-grep-error-warn.txt"

# ── 3. Host: OOM, zasoby, dysk, mount (różnica Windows vs Linux) ─────
sec "3. HOST — OOM / zasoby / dysk / mount"
cap "dmesg oom/killed" "dmesg 2>&1 | grep -i -E 'oom|killed|out of memory' | tail -n 100 || echo '(brak lub brak uprawnien — sprobuj: sudo dmesg | grep -i oom)'" "20-dmesg-oom.txt"
cap "journalctl -u docker --since $SINCE" "journalctl -u docker --since \"$SINCE ago\" --no-pager 2>&1 | tail -n 300 || journalctl --since \"$SINCE ago\" --no-pager 2>&1 | grep -i docker | tail -n 300 || echo '(brak journalctl lub brak uprawnien)'" "21-journalctl-docker.txt"
cap "free -h; uptime; df -h" "free -h 2>&1; echo '---'; uptime 2>&1; echo '---'; df -h 2>&1" "22-host-resources.txt"
cap "top -b -n1 (head)" "top -b -n1 2>&1 | head -n 40" "23-top.txt"
cap "df -h data + ls -l data + mount" "df -h . 2>&1; echo '---'; ls -l data 2>&1 | head -n 30; echo '---'; ls -lh data/*.sqlite* 2>&1 | head -n 20; echo '---'; mount 2>&1 | grep -i -E 'data|/var' | head -n 20" "24-disk-mount.txt"
cap "iostat (jesli dostepny)" "iostat 2>&1 | head -n 40 || echo '(iostat niedostepny — opcjonalne)'" "25-iostat.txt"

# ── 4. Sieć i proxy: Caddy/Nginx, ss, curl health ─────────────────────
sec "4. SIEC I PROXY — Caddy/Nginx, porty, health"
cap "proxy: caddy/nginx version + config" "caddy --version 2>&1 || caddy version 2>&1 || echo 'caddy: brak'; echo '---'; nginx -T 2>&1 | head -n 150 || echo 'nginx: brak lub brak uprawnien'" "30-proxy-version-config.txt"
cap "proxy journal (caddy/nginx 2h)" "journalctl -u caddy --since \"$SINCE ago\" --no-pager 2>&1 | tail -n 300 || journalctl -u nginx --since \"$SINCE ago\" --no-pager 2>&1 | tail -n 300 || echo '(brak journalctl dla proxy)'" "31-proxy-journal.txt"
cap "ss -tulpn / netstat (port 3000/10000)" "ss -tulpn 2>&1 | head -n 40 || netstat -tulpn 2>&1 | head -n 40 || echo '(ss/netstat niedostepny)'" "32-ports.txt"
cap "curl localhost health (wewnatrz i z hosta)" "echo '== http://localhost:10000/health (kontener) =='; curl -s -w 'HTTP %{http_code} time=%{time_total}s\n' http://localhost:10000/health 2>&1 | tail -n 20; echo '== http://localhost:3000/health (host map) =='; curl -s -w 'HTTP %{http_code} time=%{time_total}s\n' http://localhost:3000/health 2>&1 | tail -n 20" "33-curl-local-health.txt"
cap "curl /health/live vs /health/ready" "echo '== /health/live =='; curl -s -w 'HTTP %{http_code} time=%{time_total}s\n' http://localhost:3000/health/live 2>&1 | tail -n 10; echo '== /health/ready =='; curl -s -w 'HTTP %{http_code} time=%{time_total}s\n' http://localhost:3000/health/ready 2>&1 | tail -n 10" "34-curl-ready-live.txt"
if [ -n "$DOMAIN" ]; then
  cap "curl https://\$DOMAIN/health przez proxy" "curl -s -w 'HTTP %{http_code} time=%{time_total}s\n' https://$DOMAIN/health 2>&1 | tail -n 20; echo '---'; curl -sk -w 'HTTP %{http_code} time=%{time_total}s\n' https://$DOMAIN/health 2>&1 | tail -n 20" "35-curl-external.txt"
else
  echo "(pominieto curl zewnetrzny — ustaw DOMAIN=twoja.domena aby przetestowac proxy)" | tee -a "$TMPDIR/35-curl-external.txt" > /dev/null
  echo "pominieto — brak DOMAIN" >> "$TMPDIR/00-meta.txt"
fi
cap "rate-limit naglowki" "curl -si http://localhost:3000/api/version 2>&1 | grep -i -E 'x-ratelimit|retry-after|429' | head -n 20 || echo '(brak naglowkow rate-limit lub endpoint wymaga auth — sprobuj: curl -i http://localhost:3000/api/version)'" "36-ratelimit-headers.txt"
cap "ufw/iptables (jesli dostepne)" "ufw status 2>&1 | head -n 20 || echo 'ufw: brak'; echo '---'; iptables -L 2>&1 | head -n 30 || echo 'iptables: brak uprawnien'" "37-firewall.txt"

# ── 5. Runtime w kontenerze: DATABASE_URL, PRAGMA, journal_mode ──────
sec "5. RUNTIME W KONTENERZE — DATABASE_URL / PRAGMA"
cap "env DATABASE_URL w kontenerze" "docker exec $CONTAINER env 2>&1 | grep -i -E 'DATABASE_URL|NODE_ENV|PORT|HOST|TRUST_PROXY' | sort || echo '(docker exec nieudany — kontener nie dziala?)'" "40-env-container.txt"
cap "PRAGMA journal_mode/busy_timeout/synchronous (sqlite3)" "docker exec $CONTAINER sh -c 'sqlite3 /var/data/app_database.sqlite \"PRAGMA journal_mode; PRAGMA busy_timeout; PRAGMA synchronous;\" 2>&1' 2>&1 | head -n 20 || echo '(sqlite3 niedostepny w kontenerze lub baza nie istnieje)'" "41-pragma.txt"
cap "PRAGMA przez Node (fallback gdy brak sqlite3)" "docker exec $CONTAINER node -e \"const p=require('./src/prismaClient').default||require('./dist/src/prismaClient').default;Promise.all([p.\\\$queryRawUnsafe('PRAGMA journal_mode'),p.\\\$queryRawUnsafe('PRAGMA busy_timeout'),p.\\\$queryRawUnsafe('PRAGMA synchronous')]).then(r=>console.log(JSON.stringify(r))).catch(e=>console.error(e.message))\" 2>&1 | head -n 30 || echo '(fallback PRAGMA nieudany)'" "42-pragma-node.txt"
cap "ls -l /var/data w kontenerze" "docker exec $CONTAINER ls -lh /var/data 2>&1 | head -n 30 || echo '(docker exec nieudany)'" "43-ls-vardata-container.txt"
cap "node -v + prisma --version w kontenerze" "docker exec $CONTAINER sh -c 'node -v; npx prisma --version 2>&1 | head -n 10' 2>&1 | head -n 20 || true" "44-node-prisma-version.txt"

# ── 6. Pakowanie ──────────────────────────────────────────────────────
sec "6. PAKOWANIE"
log "Pakowanie archiwum: $OUT_FILE"
# Lista plikow do spakowania
FILES="$(cd "$TMPDIR" && ls -1 2>/dev/null | tr '\n' ' ')"
if command -v tar >/dev/null 2>&1; then
  tar -czf "$OUT_FILE" -C "$TMPDIR" . 2>&1 | tee -a "$TMPDIR/00-meta.txt" || {
    echo "[ERROR] tar nieudany" >&2
    cp -r "$TMPDIR" "${OUT_DIR}/sok-audit-${STAMP}.dir" 2>/dev/null || true
    echo "Zapisano katalog: ${OUT_DIR}/sok-audit-${STAMP}.dir" >&2
    exit 1
  }
else
  OUT_FILE="${OUT_DIR}/sok-audit-${STAMP}.dir"
  mkdir -p "$OUT_FILE"
  cp -r "$TMPDIR"/* "$OUT_FILE"/ 2>/dev/null || true
  echo "Brak tar — zapisano katalog: $OUT_FILE" | tee -a "$TMPDIR/00-meta.txt"
fi

# ── 7. Podsumowanie werdyktu P0 (bez zgadywania — tylko wskazowki) ───
SUMMARY="$TMPDIR/99-WERDYKT-P0.txt"
{
  echo "WERDYKT P0 — wskazowki (nie rozstrzygniecie bez logow)"
  echo "======================================================"
  echo ""
  echo "Sprawdz w archiwum:"
  echo "  11-grep-rejection.txt  — jesli zawiera UnhandledRejection/UncaughtException → hipoteza A (exit+restart) WYSOKIE"
  echo "  02-docker-inspect-state.txt — RestartCount, StartedAt, FinishedAt — potwierdza restart Dockera"
  echo "  06-docker-events.txt    — restart/kill/oom"
  echo "  20-dmesg-oom.txt        — OOM killer → infra"
  echo "  40-env-container.txt    — DATABASE_URL bez ?busy_timeout → trop B wymaga PRAGMA (41/42)"
  echo "  41-pragma.txt / 42-pragma-node.txt — busy_timeout per-connection: wartosc z osobnego polaczenia"
  echo "    (sqlite3/Node fallback) NIE dowodzi wartosci w app; brak WARN PRAGMA to dowod posredni,"
  echo "    najmocniej: PRAGMA na tym samym polaczeniu Prisma lub test contention (lock busy)"
  echo "  12-grep-busy.txt        — SQLITE_BUSY → potwierdzenie B"
  echo "  13-grep-cron-ratelimit.txt — korelacja co 15 min (:00/:15/:30/:45) → E; 429 → D"
  echo "  33/34-curl-*.txt        — /health 200 + /health/ready 503 → C (readiness)"
  echo "  30/31-proxy-*.txt       — 502/504 w proxy → proxy/timeout"
  echo ""
  echo "Kolejnosc wg audytu:"
  echo "  1) A (exit) — najlatwiej potwierdzic jednym grepem"
  echo "  2) B (PRAGMA/busy) — wymaga 40+41/42 (nie nazywaj deterministycznym bez tego)"
  echo "  3) E (freeze co 15 min) — korelacja timestampow"
  echo "  4) C (healthcheck) — healthy vs unhealthy bez restartu"
  echo "  5) D (429) — tylko przy wielu klientach/NAT"
  echo ""
  echo "Bezpieczenstwo wdrozeniowe: NIE zmieniaj globalnego handlera unhandledRejection"
  echo "na 'log bez exit' przed znalezieniem zrodla rejection — zamieni kontrolowany restart"
  echo "na dzialanie w uszkodzonym stanie. Najpierw fix zrodla, potem decyzja o handlerze."
} > "$SUMMARY"
cp "$SUMMARY" "$TMPDIR/../99-WERDYKT-P0.txt" 2>/dev/null || true
cat "$SUMMARY"

# Dopakuj werdykt jesli tar juz spakowany — dopisz
if [ -f "$OUT_FILE" ] && command -v tar >/dev/null 2>&1; then
  # tar juz zawiera werdykt (byl w TMPDIR przed pakowaniem) — nic nie rob
  true
fi

log "Gotowe: $OUT_FILE"
log "Wyslij archiwum do analizy. Zawartosc:"
ls -lh "$OUT_FILE" 2>&1 || ls -ld "${OUT_DIR}/sok-audit-${STAMP}.dir" 2>&1 || true
echo ""
echo "Podglad meta:"
cat "$TMPDIR/00-meta.txt" 2>&1 | tail -n 60

# Sprzatanie
rm -rf "$TMPDIR" 2>/dev/null || true
