# S.O.K. — Agent: referencja komend i kodowanie

> Szczegółowy przewodnik domenowy. Root: `AGENTS.md` (mapa + bramy).

## Dewelopment i build

| Polecenie             | Opis                                                    |
| --------------------- | ------------------------------------------------------- |
| `npm run dev`         | Backend (ts-node-dev); Express serwuje też frontend.    |
| `npm run dev:backend` | Serwer backendowy w trybie deweloperskim (auto-reload). |
| `npm run build`       | Kompilacja TypeScript backendu.                         |
| `npm run build:watch` | Kompilacja w trybie watch (`tsc --watch`).              |

## Walidacja i testy

`typecheck`, `typecheck:frontend`, `lint`, `lint:frontend`, `format`, `format:check`, `appname:check`, `collisions:check`, `ratchet:check` (ratchet tras → zapytań DB), `licenses:check`, `validate` (pełna: version:check + typechecki + linty + appname + licenses + testy + collisions + ratchet + prices:verify).

Testy: `npm test` (wszystkie z pokryciem), `test:quick`, `test:quick:lite` (bez migracji i git-safety, pre-push), `test:git-safety`, `test:frontend`, `test:e2e` (Playwright), `test:axe`, `test:alignment`, `test:parity`, `test:golden`, `test:excel-visual`, `test:excel-slo`, `test:openperf`, `test:e2e-appname`, `test:spa-guard`, `test:e2e-qe-switch`, `test:e2e-pricelist-preview`, `test:watch`, `perf:baseline` (initial-load SPA, spawn :3178; `PERF_ONLY=a,b` filtruje strony).

E2E na izolacji: PostgreSQL testowy przez jawny `PLAYWRIGHT_DATABASE_URL` lub `DATABASE_URL` (izolowany schemat testowy) i `PLAYWRIGHT_BASE_URL=http://localhost:PORT` — nigdy default :3000 (dev-serwer/prod DB).

## AI/ML, benchmark, pomiary

`ai:setup` (diagnostyka modułu AI/ML); `benchmark`, `benchmark:quick`, `benchmark:autoselect[:quick]`; `measure:telemetry` (odczyt PostgreSQL: wzrost tabel audit/telemetria + progi); `load`, `load:quick`, `load:sustained`; `alerts` (progi metryk).

## Baza danych

`prisma:generate`, `prisma:migrate` (izolowana PostgreSQL dev DB), `prisma:deploy` (wersjonowane migracje PostgreSQL), `prisma:seed`, `prisma:studio`, `prisma:reset` (utrata danych!), `prisma:status`, `export:seed`, `pricelist:preflight`, `pricelist:health`, `import:offers`, `backfill:offer-counts`.

## Backup i cenniki

`backup` (`pg_dump` custom archive), `restore <plik.dump>` (cel przez `RESTORE_DB_URL`, nigdy connection URL w argv; checksum/archiwum weryfikowane), `backup:install-cron` / `backup:uninstall-cron` (Windows), `prices:verify`, `audit:integrity`.

## Deploy, licencje, skills

`deploy`, `rollback`, `deploy:check`, `deploy:check:pdf`, `pdf:smoke:package` (szczegóły: `docs/DEPLOY_UPDATE.md`); `licenses:generate`, `licenses:check` (`THIRD-PARTY-NOTICES.md` — pakiety npm `[prod]`/`[dev]` + zasoby vendored; nie edytuj ręcznie); `git:safety*` (list/inspect/verify/restore); `skills:*` (build, stats, validate, cost, deps, capabilities, plan, feedback-record, feedback-show, provider-resolve, utility-recalc).

## PowerShell 5.1 (Windows) — fałszywy „exit 1" z natywnych komend

PS 5.1 zamienia każdą linię **stderr** natywnego procesu (`git`, `node`, `npm`) na
`ErrorRecord` (`NativeCommandError`). Przy `2>&1` w pipeline ostatnie polecenie ma
`$? = False`, więc narzędzie/agent raportuje „Exited with code 1", mimo że proces
zwrócił `0`. Git pisze komunikaty informacyjne na stderr (`To https://...`,
`Everything up-to-date`, postęp), stąd push i commit wyglądają na nieudane.

- Wynik oceniaj po `$LASTEXITCODE` i stanie repo, nie po `$?` ani treści błędu:
  `git push; "exit=$LASTEXITCODE"`, `git status -sb` (brak `[ahead N]` = push doszedł).
- Nie doklejaj `2>&1` do natywnych komend. Gdy stderr trzeba połączyć:
  `cmd /c "git push 2>&1"` albo `git push 2>$null; $LASTEXITCODE`.
- PS 7 nie ma tego problemu (stderr nie jest domyślnie `ErrorRecord`).

## Kodowanie polskich znaków (encoding policy)

| Typ pliku                          | Kodowanie           | Uwagi                                              |
| ---------------------------------- | ------------------- | -------------------------------------------------- |
| `.ts`, `.js`, `.mjs`, `.cjs`       | **UTF-8 (bez BOM)** | Standard dla Node.js/TypeScript                    |
| `.html`, `.css`, `.json`           | **UTF-8 (bez BOM)** | Standard webowy                                    |
| `.md`, `.txt`                      | **UTF-8 (bez BOM)** | Dokumentacja                                       |
| `.sh`, `.ps1`                      | **UTF-8 (bez BOM)** | Skrypty powłoki                                    |
| `.bat`, `.cmd`                     | **ASCII-only**      | Brak polskich znaków — cmd.exe nie obsługuje UTF-8 |
| `.yaml`, `.yml`, `.sql`, `.prisma` | **UTF-8 (bez BOM)** | Pliki konfiguracyjne i migracje                    |

Zasady: w `.bat` brak znaków spoza ASCII (zamienniki: `-` za `—`, `l` za `ł` itd.); bez BOM; zakaz mojibake (sygnatury: `C4 85` ą, `C5 82` ł, `C5 84` ń, `C3 B3` ó, `C5 9B` ś, `C5 BC` ż, `E2 80 94` —). Guardy: `.editorconfig` (utf-8), lint-staged (`encoding-integrity.js`), Husky pre-commit/pre-push, CI job `lint`. Naprawa: `npm run encoding:fix`; sprawdzenie: `encoding:check` / `encoding:staged`. `encoding:check` ignoruje `ECC/`.

## Skrypty BAT (kontrakt)

Lista plików podlegających wersjonowaniu: `scripts/bat-files.mjs` (14 plików). Kontrakt wymusza `tests/scripts/startNativeWindows.test.cjs`.

| Warstwa | Znaczenie                                | Zasady                                                             |
| ------- | ---------------------------------------- | ------------------------------------------------------------------ |
| L1      | plik uruchamiany przez użytkownika       | banner, preflight, `pause` na błędzie i na końcu, `exit /b 1`      |
| L2      | skrót do L1                              | maks. 8 linii, tylko `call "%~dp0<plik>.bat"`, zero logiki         |
| L3      | helper wołany przez L1 (`scripts/*.bat`) | brak bannera i `pause`, kod wyjścia jest kontraktem dla wołającego |

Wymagany nagłówek każdego pliku: `REM  Wersja: X.Y.Z` (dokładnie jeden), `REM Rola:`, `REM Uzycie:`, `REM Uruchamia:`, `REM Wplyw:`.

Zasady wykonania:

- wywołanie innego `.bat` zawsze przez `call "%~dp0..."` — nigdy zależnie od CWD/PATH;
- każda komenda zewnętrzna sprawdzana `if errorlevel 1`, komunikat `[BLAD]` mówi, co uruchomić dalej;
- kody wyjścia: `0` = OK, `1` = błąd (kody `check-db.js` są wewnętrzne dla `scripts/ensure-db.bat`);
- prefiksy komunikatów: `[INFO]`, `[OK]`, `[UWAGA]`, `[BLAD]`;
- build wyłącznie przez `npm run build` (`build.bat` tylko deleguje, nie powiela `tsc`/kopiowania klienta Prisma);
- nowy `.bat` wymaga wpisu w `scripts/bat-files.mjs`, wiersza w tabeli „Skrypty startowe (.bat)" w `README.md` i aktualizacji licznika w teście kontraktu;
- `docs/DELETION_LOG.md` pilnuje `npm run test:docs`: każde wpis ma poprawną datę i treść, a tabele usunięć nie mogą wskazywać plików, które nadal istnieją.
