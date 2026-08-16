# Plan: Bezpieczny update produkcji S.O.K. (okno serwisowe)

Data: 2026-08-16
Status: **aktywny** (w realizacji)
Docelowe środowiska: Windows, Linux (PM2), Docker

## Cel

Umożliwienie bezpiecznej, wielokrotnej aktualizacji aplikacji produkcyjnej (na której pracują
pracownicy) bez ryzyka utraty danych. Aktualizacje odbywają się w oknie serwisowym —
dłuższa przerwa jest akceptowalna.

## Architektura

- Dev PC -> GitHub (tagi `vX.Y.Z`) -> maszyna produkcyjna (tylko tagowane wydania).
- Kod i dane rozdzielone: baza `data/app_database.sqlite` (Docker: `/var/data` w bind mount).
- Rdzeń logiki deploy jako testowalny moduł Node (`scripts/deploy-core.cjs`),
  cienkie wrappery `.bat`/`.sh`.

## Fazy

### Faza 1 — Rdzeń i skrypty (wykonane)

- `scripts/deploy-core.cjs` — walidacja tagu/targetu, kroki per środowisko, dobór backupu,
  fail-fast, health check.
- `scripts/deploy.mjs` / `scripts/rollback.mjs` — CLI z `--dry-run`, logami do
  `data/deploy-log.log`, kontrolą czystego drzewa roboczego.
- `scripts/post-deploy-check.mjs` — smoke check `/health`.
- `deploy.bat` / `deploy.sh` / `rollback.bat` / `rollback.sh` — wrappery.
- `docker-compose.yml` — bind mount `./data:/var/data` zamiast named volume.
- npm scripts: `deploy`, `rollback`, `deploy:check`.

### Faza 2 — Testy (wykonane)

- `tests/scripts/deployCore.test.ts` (22 testy): validateTag, resolveTarget, resolveSteps
  (kolejność/komendy per środowisko), rollbackSteps, fail-fast, planRollback, checkHealth,
  bind mount w docker-compose.yml.
- Uruchamiane przez `npm run test:quick` i CI.

### Faza 3 — Dokumentacja (wykonane)

- `docs/DEPLOY_UPDATE.md` — runbook operacyjny (okno serwisowe, rollback, pierwszy deploy,
  migracja wolumenu, troubleshooting).

### Faza 4 — Weryfikacja (wykonana lokalnie) i wdrożenie na środowisku (do zrobienia)

- Wykonane: `npm run test:quick` (1889 testów, w tym 22 nowe), `tsc --noEmit`,
  `npm run version:check` (EXIT=0), eslint, prettier --check, podglądy `--dry-run`
  dla windows/linux/docker oraz `npm run deploy:check` (health 200 na działającym serwerze).
- Do zrobienia: pierwszy deploy + rollback na docelowym środowisku wg `docs/DEPLOY_UPDATE.md`.

## Kryteria zakończenia

- [x] `npm run test:quick` przechodzi (w tym nowy test deployCore).
- [x] `npm run version:check` EXIT=0.
- [ ] Deploy `--dry-run` i pełny deploy działają na co najmniej jednym środowisku.
- [ ] Rollback przywraca bazę i poprzedni tag.

## Świadomie pominięte (YAGNI)

- Blue-green, zero-downtime, HA, osobny staging na prod — zbędne przy akceptowalnym
  oknie serwisowym. Dev PC pełni rolę środowiska akceptacyjnego.

## Po zakończeniu

Po weryfikacji fazy 4 plan przenieść do `docs/plans/archive/` (`git mv`).
