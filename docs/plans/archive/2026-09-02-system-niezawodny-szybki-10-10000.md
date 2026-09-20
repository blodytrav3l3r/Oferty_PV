# Plan: Jeden spójny niezawodny i szybki system 10 → 10000 studni

Data: 2026-09-02
Status: w realizacji
Zastępuje: `2026-09-02-studnie-lista-virtual-visual-safe.md`, `2026-09-02-optymalizacja-lookup-zamowien-studni.md`, `2026-08-31-excel-wirtualizacja-10k.md`, `a2-benchmark-10k.md` (przeniesione do `archive/`), konsoliduje `audyt-serwera-2026-08-29.md` P0/P1.
Dotyczy: `public/js/studnie/*`, `public/js/rury/*`, `src/routes/offers/*`, `src/routes/orders/*`, `prisma/schema.prisma`, `jest.config.ts`, `.github/workflows/ci.yml`, `.husky/pre-push`, `scripts/backup.ts`

## Wizja

Ten sam kod, ta sama baza, ten sam UX `I1 style.base.css:3` / `studnie.css:885` od 1 do 10000. Koszt `O(N)` liniowy `1→1, 100→~100, 1000→~1000, 10000→~10000`, nie `1→100`. Jedna ścieżka `wellVirtual.js:54 default true` (`?wellVirtual=0` opt-out) + `excelVirtual.js:26` + `light list wellCount/totalPrice schema.prisma:330` + `Map O(1)`. Kosztowne mechanizmy (scheduler, Worker, pagination E) gated pomiarem `P95>50ms`, nie `virtual OFF <100`.

## Stan obecny (po 88e2868+3a1238e+58c838f)

- DONE: `Map O(1) studnieProducts globals.js:42 / ruryProducts+offers productHelpers.js:128 / offersStudnie globals.js:75 / orderHelpers.js:46`, `wellVirtual default true 54` `WELL_CARD_HEIGHT 78 OVERSCAN 350 rAF`, `excelVirtual 32px/OVERSCAN15 SSoT filteredIndexes excelState.js:279`, `light list wellCount/totalPrice 58c838f+20260902000000_add_totalprice`, `brandHtmlCache Map+mtime app.ts:195`, `FTS5 offers_search_fts fts5Sync.ts:99 + search.ts:118 MATCH`.
- NIestabilne: `CI parallel index.lock etap6:160 + catastrophic:101` `ci.yml:91 npm test` `maxWorkers cpus-1` → `HUSKY=0` bypass, `ruryCrud.ts:199 for loop` bez `prisma.$transaction` (studnie 567 DONE), `backup.ts:32 lex sort` brak `integrity_check` po `VACUUM 26`, `offerSchemas.ts:65 passthrough` + `normalizeDate helpers.ts:75` bez walidacji wartości.
- Progi a2: `100 6ms/1.2MB | 500 ~30ms/6MB borderline | 1000 61ms/11MB >100ms real 500ms | 5000 323ms/58MB | 10000 646ms/120MB 90k cells GC/OOM` `archive/2026-09-01-architektura-10k.md:22` gate `P95<50ms, first usable 10k <1s`.

## Progi decyzyjne (real 400-700, cut 2000+)

| N          | P95 / OOM                                                                                         | Virtual                                                                | Chunk / Pagination                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 10-100     | `<50ms`, no OOM, debounce 150ms `wellUI.js:94` wystarczy                                          | jedna ścieżka `default true` koszt `~0ms` @1                           | OFF                                                                                                          |
| 500        | `~30ms` border                                                                                    | rekomendowany, nie krytyczny                                           | `CHUNK 200` zaczyna pomagać                                                                                  |
| 1000       | `61ms string + layout >100ms FAIL`                                                                | mandatory `wellVirtual.js:339 spacery + 371 slice 30` + `excelVirtual` | `dirtySet CHUNK 200 + isInputPending calculationPipeline.js:72` + `light list` bez `data`                    |
| 2000       | `>300ms` frame, real 700 prod                                                                     | mandatory                                                              | `filteredIndexes` nie `style.display`                                                                        |
| 5000-10000 | `323-646ms` string `250MB` 50× `data` `studnieCrud.ts:282` `500k` undo `excelTableManager.js:394` | mandatory `O(viewport)` `~50×35td` + sticky 7 CSS vars                 | backend pagination `search.ts:84 UNION+COUNT` + `for-await → $transaction` + chunked `PUT 10k ~5MB` poza MVP |

## Roadmap — kolejność ROI, reversybilne `git revert`, gated pomiarem

### P0 — proces niezawodny (0.5 dnia, blocker, zero ryzyka visual)

- `jest.config.ts:16 backend testPathIgnorePatterns += /git-safety/` + `ci.yml:91` + `.husky/pre-push:8` drugie `npx jest tests/git-safety --runInBand --no-coverage` sekwencyjnie. Nie `maxWorkers=1` global.
- `scripts/backup.ts:32 lex→mtime` + `integrity_check` po `VACUUM 26` + `fsync` + checksum. Plik `scripts/restore-db.js:47` już `integrityCheck` — dodać po `VACUUM`.
- DoD: `5× npm run test:quick` bez `fatal index.lock etap6:160`, `gh run 33556391664` green, `npm run backup && npm run restore <plik> --force` green.

### P1 — dane niezawodne (1 dzień, każdy użytkownik)

- `ruryCrud.ts:199,336` + `orders/ruryOrders.crud.ts:121` + `orders/studnieOrders.crud.ts:91` `for loop` → `prisma.$transaction(async tx=> ...)` jak `studnieCrud.ts:567` + `syncFts5` w tx + walidacja `offersBatchSchema passthrough 65→strict` + `DATE value` `2026-02-31` 400 nie 500 `searchUtils.ts:6`, `typecheck+lint` green.
- DoD: `baseline.test.ts:48 no difference` PASS (już `3a1238e`), batch 20 `300ms→40ms` `benchmark.mjs:94`.

### P2 — szybkość 1→10000 gated pomiarem (2h + 0.5 dnia harness, tylko gdy `P95>50ms`)

- Harness `benchmark-excel-a2.html` `PerformanceObserver longtask>50ms + rAF droppedFrames + performance.memory` dla `10/100/500/700/1000/1500/2000/2500/3000/3500/4000/4500/5000/10000` — B0 baseline. Skipped gdy `P95<50ms @500` (ponytail).
- Scheduler `wellManager.js:29 2× renderWellsList` → `globals.js:347 scheduleRender rAF` (już istnieje) — tylko gdy `P95>50ms @500-1000`. Zero `studnie.css:537`/`sidebar.html:428` (już `wellUI.js:90 removeAttribute`).
- Backend `search.ts:84 UNION+COUNT 17× LIKE json_extract searchUtils.ts:81` → `WITH fts AS SELECT id,rank ... ORDER BY rank LIMIT` dopiero gdy `benchmark 80ms @10k vs 13ms @1k`. `brandHtmlCache` już `Map`.
- DoD: `wellVirtualOracle` + `filter→sort→scroll` screenshot `studnie.css:885` 375/768/1024/1440 identyczna, `typecheck+lint+encoding+version+test:quick --runInBand` green.

### P3 — obserwowalność (0.5 dnia, nie blokuje)

- `logger.ts:11` + `AsyncLocalStorage` korelacja `requestId` `requestLogger.ts:8`, `SENTRY_DSN` fallback `server.ts:41`. DoD: JSON log `requestId/userId`.

## Czego nie robić (ponytail YAGNI)

- `per-key writeLock lifecycle writeLock.ts:5` — measure contention first.
- `10k Worker`, `E pagination full` — `add when OOM @5000 or P95>50ms @1000`.
- `virtual OFF <100` — forka ścieżek, koszt `~0ms` @1, jedna ścieżka `default true`.

## Weryfikacja spójna 10→10000

`npm run typecheck && typecheck:frontend && lint:frontend && encoding:check && version:check && test:quick --runInBand` + `benchmark 10…10000 p95<50ms` + `CI green` + `npm run backup/restore`.

## Ryzyka

- Scheduler regresja `2× layout` → rAF opóźnia feedback 16ms.
- FTS `rank` zmienia tokenization/prefix — benchmark UX przed.
- Cache stale `orderHelpers.js:57 ref` — mutacja `order.wells.push` bez nowej ref.

## Powiązane (archiwum)

`2026-09-02-studnie-lista-virtual-visual-safe.md` (PAUSED → tu), `2026-09-02-optymalizacja-lookup-zamowien-studni.md` (DONE → archive), `2026-08-31-excel-wirtualizacja-10k.md` (DONE → archive), `a2-benchmark-10k.md` (harness → archive), `audyt-serwera-2026-08-29.md` P0/P1 → tu.
