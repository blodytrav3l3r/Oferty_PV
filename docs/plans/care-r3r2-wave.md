# Fala care R3+R2A - rejestr (2026-10-12, start)

HEAD: 48c29d4 | tree: clean | diff HEAD: pusty (dowod: git status/diff 2026-10-12)

## Cel fali

R3 + R2A + coverage + E2E + docs opieki. Tylko ten plik, zero innych. Bez commit/push.

## Przydzial -> status (z git, nie zgadywane)

| Agent    | Pliki                                                 | Status | Dowod                                   |
| -------- | ----------------------------------------------------- | ------ | --------------------------------------- |
| R3       | src/services/careService.ts, src/routes/care.ts       | OPEN   | diff pusty, brak zmian w tree           |
| R2A      | src/services/followUpStats.ts, src/utils/ownership.ts | OPEN   | diff pusty, brak zmian w tree           |
| coverage | tests/care*.test.ts                                   | OPEN   | diff pusty                              |
| E2E      | tests/playwright/*.cjs                                | OPEN   | diff pusty                              |
| docs     | docs/OPIEKA.md, docs/plans/opieka-*.md                | OPEN   | diff pusty, ten rejestr to jedyny write |

DONE: fala F0/F1 (ledger _active-evidence.md E-001-E-012 VERIFIED) + fala 3 offers (log 48c29d4..b630863). BLOCKED: brak (tree clean).

## Bramki do commita

1. npm run version:check 2. npm run validate 3. npm run format 4. node scripts/commit.mjs "typ(scope): opis" 5. push tylko za osobnym GO (zakaz teraz).

## Blokery

- Migracja: do zaaplikowania na deploy (migrate deploy vs db push legacy) - nie ruszac bez GO.
- Decyzje: GO na plan != GO na kod; zakres R3 vs R2A; progi coverage.

## Koniec okna (2026-10-12) - do dopisania drugim update

Status koncowy + diff stat + COMMIT (brak - zakaz).

## Update 2 - koniec okna (2026-10-12)

Dowody: git status/diff 2026-10-12, branch main...origin/main.

| Agent    | Pliki (diff HEAD)                              | Status                         | Dowod                        |
| -------- | ---------------------------------------------- | ------------------------------ | ---------------------------- |
| R3       | src/routes/care.ts (M, 4++)                    | OPEN (dirty, bez commit)       | git status M                 |
| R2A      | followUpStats.ts, ownership.ts                 | OPEN (brak diff)               | git diff: brak tych plikow   |
| coverage | tests/sales/followUpStatusSla.test.ts (M, 29+) | OPEN (dirty, bez commit)       | git status M                 |
| E2E      | tests/playwright/*.cjs                         | OPEN (brak diff)               | git diff: brak               |
| FE-extra | public/js/care/carePanel.js (M, 5+-)           | OPEN (dirty, poza przydzialem) | git status M                 |
| docs     | ten rejestr (?? untracked)                     | OPEN                           | jedyny write agenta-rejestru |

DONE: brak nowych (zero commitow w oknie). BLOCKED: brak. COMMIT/PUSH: brak (zakaz).

Blokery aktualne: migracja do zaaplikowania na deploy (bez GO nie ruszac); dirty tree 3xM - przed commitem bramki version:check + validate + format + commit.mjs.
