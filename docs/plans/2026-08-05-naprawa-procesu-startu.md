# Plan: Naprawa procesu startu aplikacji (dev/prod/Docker) → release 1.11.1

> **Stan: ZATWIERDZONY (plan wdrożenia).** Zakres: pełna naprawa (start + dokumentacja + sprzątanie) + release patch `v1.11.1`.

Data: 2026-08-05 | Status: plan zatwierdzony | Tryb: wdrożenie po akceptacji

## 1. Cel i tło

Przeprowadzono audyt procesu startu aplikacji przez **8 subagentów** (architect, build-error-resolver, code-reviewer, doc-updater, explore, general, planner, refactor-cleaner). Audyt ujawnił **krytyczne usterki blokujące prawidłowy start** w środowiskach dev/prod/Docker:

1. **Kolizja katalogu `dist/`** — backend (tsc) i frontend (Vite) pisały build do tego samego katalogu; jedno nadpisywało drugie, przez co `dist/server.js` bywał niedostępny w produkcji.
2. **Błędny healthcheck `wait-and-start.mjs`** — czekał na `http://localhost:3000/api/health` (endpoint nieistniejący), twardy timeout `60s`, brak kill childa Vite przy wyjściu.
3. **Docker bez seeda i bez `DEFAULT_ADMIN_PASSWORD`** → brak konta admina → crash-loop w produkcji; dodatkowo `npm prune --production` w Dockerfile usuwał pakiety potrzebne przy starcie.
4. **`NODE_ENV` niezdefiniowane w prod** — `prod.bat`/`prod.sh` nie ustawiały `NODE_ENV=production` → kod działał w trybie development (bind `0.0.0.0`, inny logging).
5. **Brak graceful shutdown** — `SIGTERM`/`SIGINT` kończyły proces przez `process.exit(0)` bez zamykania `http.Server`, `cronService` i połączeń Prisma; `unhandledRejection` nie ustawiał kodu wyjścia 1.

Cel: **stabilny, poprawny start** aplikacji w dev, produkcji i Dockerze oraz wydanie wersji **1.11.1**.

## 2. Decyzje

Zatwierdzone przez użytkownika:

| Decyzja                 | Zakres                                                                          |
| ----------------------- | ------------------------------------------------------------------------------- |
| **Pełny zakres napraw** | start + dokumentacja + sprzątanie (etapy 1–8)                                   |
| **Release patch**       | semver patch → **v1.11.1** (`npm run release:patch` + `git push --follow-tags`) |

Wszystkie usterki traktowane jako blokery — wdrażane w jednym przebiegu, po jednym commicie na etap.

## 3. Zakres (9 etapów)

### Etap 1. Kolizja `dist/` (backend vs frontend)

- **Problem:** Vite budował frontend do `dist/` (wspólnego z kompilacją TypeScript backendu przez `tsc`). Buildy nadpisywały się wzajemnie; `dist/server.js` bywał usuwany/nieobecny → prod się nie startował.
- **Rozwiązanie:** frontend → osobny katalog `dist-web/`:
    - `vite.config.js:8` — `outDir: '../dist-web'` (+ `emptyOutDir: true` już ustawione).
    - `.gitignore` + `.dockerignore` — dodać `dist-web/` (oraz usunąć/zweryfikować stare wpisy dla `dist/`).
    - `docs/adr/ADR-003-vite.md` — aktualizacja ADR o docelowym katalogu builda frontendu.
- **Weryfikacja:** `npm run build` (tsc → `dist/server.js` istnieje) **oraz** `npm run build:frontend` (Vite → `dist-web/`), `npm run typecheck`.

### Etap 2. Poprawka `scripts/wait-and-start.mjs`

- **Problem:** `scripts/wait-and-start.mjs:4` czeka na `http://localhost:3000/api/health` — endpoint nie istnieje (healthcheck to `/health`, patrz etap 6); timeout `60s` (wiersz 5), brak przekazania/ubicia procesu Vite.
- **Rozwiązanie:**
    - PORT pobierać z env: `process.env.PORT || '3000'`.
    - Endpoint: `http://localhost:${PORT}/health`.
    - Sprawdzanie przyjazne dev: czekać tylko w trybie, w którym backend ma działać; `npm run dev:frontend` ma być odporny na brak backendu (warn, nie błąd).
    - Kill childa Vite przy sygnale/zamknięciu rodzica (żeby nie zostawiać wiszących procesów na porcie 5173).
- **Weryfikacja:** `node -c scripts/wait-and-start.mjs`; test ręczny: start backendu, `npm run dev:frontend`, Ctrl+C → brak wiszącego `node vite`.

### Etap 3. Docker — seed, hasło admina, healthcheck

- **Problem:** `docker-compose.yml` nie przekazywał `DEFAULT_ADMIN_PASSWORD` → `ensureAdminExists` nie mogło utworzyć konta → crash-loop. `docker-entrypoint.sh` robił tylko `prisma db push --skip-generate`, **bez seeda**. `Dockerfile` miał `npm prune --production` (usuwa pakiety potrzebne w runtime) i healthcheck z twardym `start-period` 10s/15s.
- **Rozwiązanie:**
    - `docker-compose.yml` (sekcja `environment`): `DEFAULT_ADMIN_PASSWORD: ${DEFAULT_ADMIN_PASSWORD:?}` — obowiązkowa zmienna, brak = błąd compose przed startem.
    - `Dockerfile`: **usunąć** `npm prune --production` (linia z komentarzem "Usuwamy zależności deweloperskie").
    - `scripts/docker-entrypoint.sh`: po `npx prisma db push --skip-generate` uruchomić seed **tylko gdy baza jest pusta** — sygnałem ma być exit code 2 ze `scripts/check-db.js` (skrypt zwraca 2, gdy baza nie istnieje/pusta → seed; w innym przypadku seed pomijany).
    - `docker-compose.yml` healthcheck: `start_period: 30s` (był `10s`), test na `/health`.
- **Weryfikacja:** `docker compose config` (walidacja wymaganego env), `docker compose up --build -d` na czystym wolumenie → kontener w stanie _healthy_ po pierwszym starcie, konto admina istnieje.

### Etap 4. `NODE_ENV=production` w produkcji

- **Problem:** `start.bat --prod` / `prod.bat` / `prod.sh` nie ustawiały `NODE_ENV`; Docker ustawiał w `ENV` (OK). W prod bez `NODE_ENV` serwer bindował `0.0.0.0` i działał jak development.
- **Rozwiązanie:**
    - `start.bat` (blok `MODE=prod`): dodać `set "NODE_ENV=production"` przed `call npm start`.
    - `prod.bat`: zamienić na alias → `call start.bat --prod` (jeden punkt prawdy, patrz Etap 8) lub dodać `set "NODE_ENV=production"`.
    - `prod.sh`: `export NODE_ENV=production` przed `npm start`.
    - `scripts/docker-entrypoint.sh`: jawne `export NODE_ENV=production` (bezpiecznik obok `ENV` w Dockerfile).
- **Weryfikacja:** `npm start` z `NODE_ENV=production` → log `Tryb: PRODUKCJA`; bez zmiennej → `Tryb: DEVELOPMENT`.

### Etap 5. `server.ts` — obsługa portu, graceful shutdown, sygnały

- **Problem:** `server.ts` nie obsługiwał `EADDRINUSE` (cichy błąd w `.on('error')`), `SIGTERM` (wiersz 43) i `SIGINT` robiły `process.exit(0)` bez zamknięcia czegokolwiek, `unhandledRejection` (wiersz 33) nie ustawiał `exitCode=1`, `dotenv` nie był importowany jako pierwsza instrukcja (env mógł nie być wczytany przed odczytem `process.env.PORT`).
- **Rozwiązanie (`server.ts`):**
    - `import 'dotenv/config'` jako **pierwsza linia** pliku.
    - Obsługa `app.on('error', ...)` z wykryciem `EADDRINUSE` → czytelny log + `process.exit(1)`.
    - Graceful shutdown: `SIGTERM`/`SIGINT` → `server.close(cb)` → `cronService.shutdown()` → `prisma.$disconnect()` → `process.exit(0)`; **timeout 10s** (jeśli nie zdążono — wymuś `process.exit(1)`).
    - `unhandledRejection` → `process.exitCode = 1` (po zalogowaniu).
- **Weryfikacja:** `npm run typecheck`, `node -c` (ESLint backend), test ręczny: `npm run dev:backend` + drugi proces na tym samym porcie → czytelny błąd; Ctrl+C → logi o zamknięciu serwera/bazy; brak wiszącego procesu.

### Etap 6. `src/middleware/security.ts` + `src/app.ts` — healthcheck bez przekierowania

- **Problem:** `httpsRedirect` (wpięty w `app.ts:141`) przekierowuje wszystko na HTTPS, więc w Dockerze bez TLS kontener nigdy nie osiągnie `200` na `/health`; `cleanupAuditLogs` (app.ts:329) odpalany bez `await`; `resolvePublicDir` względem cwd zamiast `__dirname`; brak `dotenv` na początku.
- **Rozwiązanie:**
    - `src/middleware/security.ts` (`httpsRedirect`): **wyjątek dla `/health` oraz `/api/version`** — te ścieżki nie są przekierowywane (dozwolone też w trybie prod za reverse proxy).
    - `src/app.ts:25,329`: `await cleanupAuditLogs()` w inicjalizacji (z guard try/catch — nie blokować startu, ale kończyć przed `listen`); pierwsza linia pliku `import 'dotenv/config'`.
    - `resolvePublicDir`: względem `__dirname`, nie `process.cwd()` (odporność na uruchamianie z innego katalogu).
- **Weryfikacja:** `npm run typecheck`; test ręczny: `NODE_ENV=production` + `curl http://localhost:3000/health` → `200` (bez 301), `curl http://localhost:3000/api/version` → `200`; dowolna inna ścieżka → `301`.

### Etap 7. Dokumentacja

- **Problem:** instrukcje rozjechały się ze stanem faktycznym — `backup:restore` nie istnieje (jest `restore`), mojibake w `INSTRUKCJA_SERWER.md`, błędne porty, brak wzmianki o `start.bat --prod`, przestarzałe opisy release (stary `postbump`, brak `typecheck:frontend`, brak `--commit-all`), nieistniejący "auto-seed", opis chunków seedu sprzed `createMany`.
- **Rozwiązanie (dokumenty, bez zmian kodu):**
    - Wszystkie wystąpienia `backup:restore` → **`restore`** (12 miejsc w README/docs).
    - `INSTRUKCJA_SERWER.md` — naprawa mojibake (re-encode do UTF-8 bez BOM).
    - Porty: dev frontend `5173`, backend `3000`; Docker mapowanie `3000:10000`.
    - `start.bat --prod` jako sposób startu produkcyjnego na Windows.
    - Instrukcje instalacji Pythona (skrypt `excel-validator.py` wymaga `python`).
    - Release docs: 3 skrypty `postbump` (`auto-cache-bust.mjs`, `auto-bat-version.mjs`, `auto-docs-version.mjs`), `typecheck:frontend` w walidacji, `--commit-all` w release, **brak auto-seeda** (seed tylko w Dockerze / instalatorze), seed `createMany` zamiast chunków po 25.
- **Weryfikacja:** `rg -n "backup:restore" . --glob '!node_modules'` → 0 wyników; `npm run encoding:check`; przegląd README pod kątem portów 3000/10000 i `--prod`.

### Etap 8. Sprzątanie

- **Problem:** martwe skrypty i zależności zwiększają powierzchnię ataku i dezorientują przy utrzymaniu.
- **Rozwiązanie:**
    - Przenieść **13 martwych skryptów** do `scripts/archive/` (ustalić listę z audytu, np. stare wersje bump/version, przestarzałe migracje, nieużywane helpery).
    - Naprawić `scripts/archive/README.md` (spis i opis archiwum).
    - `prod.bat` → alias na `start.bat --prod` (usunięcie zdublowanej logiki).
    - Usunąć z `package.json` (`dependencies`/`devDependencies`): **`rollup-plugin-visualizer`** (^7.0.1) i **`@eslint-community/eslint-utils`** (^4.9.1) — nieużywane.
    - `npm prune` (bez `npm ci` — nie dotykać działającego serwera/node_modules w trakcie pracy).
- **Weryfikacja:** `npm run lint`, `npm run typecheck`, `npm run test:quick`, `rg -n "rollup-plugin-visualizer|@eslint-community/eslint-utils"` → 0 wyników (poza package-lock jeśli `npm prune` go nie usunął — zweryfikować).

### Etap 9. Release patch → v1.11.1

- **Problem:** aktualna wersja `1.11.0`; naprawy wymagają releasu patch. Uwaga: `git push --follow-tags` **nie wypycha tagów lekkich** — trzeba jawnie `git push origin v1.11.1`.
- **Rozwiązanie:**
    - `npm run validate` (typecheck + lint + testy).
    - `npm run release:patch` → semver patch → **1.11.1**, aktualizacja `VERSION`, `package.json`, `CHANGELOG.md`, cache-bust `?v=` (hook `postbump`), commit `chore(release): 1.11.1` + tag `v1.11.1`.
    - `git push --follow-tags` **oraz** `git push origin v1.11.1` (jawnie, bo `--follow-tags` nie pushuje tagów lekkich).
- **Weryfikacja:** `npm run version:check`; `git tag -l "v1.11.1"`; tag widoczny na zdalnym repo (GitHub Release utworzony automatycznie).

## 4. Kolejność wdrożenia

Strictly wg numeracji z sekcji 3 (etapy 1–9). Każdy etap kończy się:

1. `npm run validate` (typecheck backend+frontend, lint backend+frontend, testy)
2. commit wg **Conventional Commits** (PL):
    - Etap 1–6: `fix(start): ...`
    - Etap 7: `docs(...): ...`
    - Etap 8: `chore(...): ...`
    - Etap 9: `chore(release): 1.11.1`

Po et. 1 konieczne jest czyszczenie starych buildów (patrz Ryzyka) — **kolejność ma znaczenie**: najpierw outDir (et. 1), potem healthcheck (et. 2), potem Docker (et. 3).

## 5. Ryzyka / uwagi

| Ryzyko / uwaga                                   | Postępowanie                                                                                                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Działający dev server** (proces na 3000/5173)  | Nie zabijać podczas edycji; testy portu robić na osobnym porcie lub po cichym zatrzymaniu.                                                     |
| **`stash@{0}` w repo**                           | **Nie ruszać** — może zawierać niezapisane zmiany użytkownika.                                                                                 |
| **Stary build w `dist/`/`dist-web/`**            | Po zmianie outDir usunąć stary `dist-web/` jeśli powstał wcześniej (regeneracja), a `dist/` zostaje wyłącznie dla backendu (tsc).              |
| **`npm prune` zamiast `npm ci`**                 | Nie uruchamiać `npm ci` przy działającym serwerze — `npm prune` wystarczy do usunięcia zależności.                                             |
| **Brak CI**                                      | Cała weryfikacja lokalnie: `npm run validate`, `npm run test:quick`, testy ręczne startu.                                                      |
| **Zmiany w `vite.config.js` już w working tree** | Et. 1 częściowo wykonany (uncommitted: vite.config.js, .gitignore, .dockerignore, ADR-003) — etap dokończyć i **zacommitować w ramach et. 1**. |
| **Healthcheck w Dockerze**                       | Po usunięciu `npm prune --production` i seedzie — kontener musi przejść w _healthy_; jeśli seed padnie, sprawdzić `docker logs`.               |
