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

`typecheck`, `typecheck:frontend`, `lint`, `lint:frontend`, `format`, `format:check`, `appname:check`, `collisions:check`, `validate` (pełna: typechecki + linty + appname + licenses + testy + collisions + prices:verify).

Testy: `npm test` (wszystkie z pokryciem), `test:quick`, `test:quick:lite` (bez migracji, pre-push), `test:git-safety`, `test:frontend`, `test:e2e` (Playwright), `test:axe`, `test:alignment`, `test:e2e-appname`, `test:watch`.

## AI/ML, benchmark, pomiary

`ai:setup` (diagnostyka modułu AI/ML); `benchmark`, `benchmark:quick`; `measure:telemetry` (wzrost tabel audit/telemetria + progi).

## Baza danych

`prisma:generate`, `prisma:migrate` (dev), `prisma:deploy` (produkcja; `db push` wyłącznie legacy bez `_prisma_migrations`), `prisma:seed`, `prisma:studio`, `prisma:reset` (utrata danych!), `prisma:status`, `cleanup:legacy-pricing`, `export:seed`.

## Backup i cenniki

`backup` (VACUUM INTO), `restore <plik>` (z synchronizacją schematu), `backup:install-cron` / `backup:uninstall-cron` (Windows), `prices:export`, `prices:import`, `audit:integrity`.

## Deploy, licencje, skills

`deploy`, `rollback`, `deploy:check` (szczegóły: `docs/DEPLOY_UPDATE.md`); `licenses:generate`, `licenses:check` (`THIRD-PARTY-NOTICES.md` — nie edytuj ręcznie); `skills:*` (build/stats/validate/cost/deps/capabilities/plan/feedback-record/feedback-show/provider-resolve/utility-recalc).

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
