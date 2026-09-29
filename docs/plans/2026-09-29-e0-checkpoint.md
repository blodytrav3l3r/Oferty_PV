# E0 checkpoint — resume / baseline verification (read-only)

Data: 2026-09-29. Plan: `docs/plans/2026-09-29-profesjonalizacja-sok-plan.md` v2.

## Git (FACT, komendy read-only)

- HEAD: `337dedd` na `main`, remote `origin https://github.com/blodytrav3l3r/Oferty_PV.git`.
- `origin/main` = `33cf3e1` → lokalny HEAD **1 commit przed** origin (niepushowany `fix(prisma): auto-ensure…`).
- `git diff` / `git diff --cached`: puste (zero zmian niestagowanych/stagowanych).
- Worktree: jeden plik untracked — sam plan. Poza tym czysto.
- Wniosek: punkt odniesienia audytu (`337dedd`) potwierdzony jako aktualny HEAD. Przed E1: push `337dedd` (osobne GO, Tier 🔴) albo E1 na tym HEAD lokalnie.

## CI / bramy (FACT, agent explore)

- PR blokują: lint, typecheck, test (full `npm test` + git-safety), e2e-appname, axe-a11y, e2e-smoke.
- Tylko push→main: version-check, drift-check, migrate-deploy-verify, docker-build, load-quick, flaky-detect, deploy.
- Rozjazdy: `licenses/collisions/prices:verify` w `validate`, brak w CI; CI testuje full, AGENTS wymaga quick;
  `version:check` nie blokuje PR. E6 (PR gate) potwierdzony jako potrzebny.

## Migracje / DB (FACT, agent explore)

- `prisma/migrations`: 16 katalogów + lock, provider sqlite, schema 954 linie (~47 modeli).
- `check-db.js`: nie sprawdza `_prisma_migrations`; warn-only dla brak `PricelistVersion`.
- Liczba zaaplikowanych migracji w `data/app_database.sqlite`: UNVERIFIED (runtime query nie wykonany w E0;
  do potwierdzenia w E1 przez `check-legacy-db.js` / `migrate status`).
- Ryzyko legacy db-push potwierdzone z kodu (`ensure-db.bat`, `initDatabase.ts` auto-heal, `db-to-migrations.mjs` guardy).

## Decyzja bramki

E0: SUCCESS (warunkowy) — stan znany, audyt odpowiada HEAD. Następny krok E1 wymaga GO.
STOP — nie przechodzę do E1 bez zatwierdzenia.
