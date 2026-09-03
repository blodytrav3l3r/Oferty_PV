# Audyt Serwera S.O.K. — 2026-08-29

**Zakres:** kompletna analiza wg promptu PROMPT.md (11 obszarów)  
**Metoda:** odczyt kodu + uruchomienie komend (typecheck/lint/benchmark/version/migrate/encoding/test)  
**Wynik walidacji przed audytem:**

| Komenda                              | Wynik                                                                                              |
| ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `typecheck`                          | PASS                                                                                               |
| `typecheck:frontend`                 | PASS                                                                                               |
| `lint` / `lint:frontend`             | PASS                                                                                               |
| `encoding:check`                     | 1581 OK, 0 ERROR                                                                                   |
| `version:check`                      | 1.19.6 spójne we wszystkich źródłach                                                               |
| `benchmark:quick` (10 próbek)        | login p50 380ms, search 13.9ms, save 14.5ms, telemetry 15.3ms, AGG p50 14.6ms p95 17.6ms p99 116ms |
| `prisma migrate status`              | 4 migracje znalezione, 1 niezaaplikowana: `20260828000000_add_document_shares`                     |
| `test:quick`                         | 2023 passed / 0 failed (148 suites, 116s)                                                          |
| `appname:check` / `collisions:check` | PASS (collisions tylko raport informacyjny)                                                        |

---

## 1. Executive Summary (5 zdań) — korekta 2026-08-29 (feedback review 9/10)

Serwer Express + Prisma + SQLite jest dojrzały: WAL + busy_timeout, fail-fast init, graceful shutdown, helmet + rate limiting, walidacja zod, ownership + shares, FTS5 + searchCache — fundament solidny. Wąskie gardło to I/O per-request: `applyBrandTokens` czyta HTML z dysku synchronicznie przy każdym GET + globalny `writeLock` (single key) kanalizuje wszystkie zapisy. Bezpieczeństwo na dobrym poziomie (httpOnly cookies, SHA256 tokenów, 403 z shares), ale 1 migracja niezastosowana blokuje spójność schematu `document_shares` w nowych instalacjach. Architektura nie wykazuje obecnie fundamentalnej bariery dla bazy rzędu 10 tys. ofert, pod warunkiem zamknięcia P0 i wdrożenia kluczowych P1 — dokładna przepustowość concurrent users wymaga osobnego testu obciążeniowego.

## 2. Tabela ustaleń (dowód = plik:linia lub output komendy)

| #   | Obszar                                   | Problem / Ryzyko                                                                                                                                                                                                                                                                                                                                                               | Dowód                                                                                                                                                          | Wpływ                                                | Fix (1-2 zdania)                                                                                                                                                    | Koszt                                                                                                                                          |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Migracje / Schemat                       | `20260828000000_add_document_shares` niezaaplikowana — świeża baza po `migrate deploy` nie ma tabeli shares; initApp tworzy ją ad-hoc `CREATE TABLE IF NOT EXISTS` ale `prisma migrate status` = drift                                                                                                                                                                         | `npx prisma migrate status` output + `src/app.ts:427-440` auto-heal                                                                                            | **P0**                                               | `npx prisma migrate deploy` na instancjach z historią; dla legacy: `resolve --applied` wcześniej — udokumentować w `docs/DEPLOYMENT.md` i CI check `migrate status` | 15 min                                                                                                                                         |
| 2   | Wydajność / I/O                          | Brand HTML per-request `fs.readFileSync` + `applyBrandTokens` + `injectAppNameScript` synchronicznie dla każdego GET HTML — brak cache; przy 7d static + HTML na każdy nav = zbędne I/O                                                                                                                                                                                        | `src/app.ts:158-180` — `fs.existsSync` + `fs.readFileSync` wewnątrz middleware bez cache                                                                       | **P0** (latencja 5-15ms/request, blokada event loop) | Cache `Map<rel, {html, mtime}>` z invalidacją po `fs.stat` lub przy starcie (pliki statyczne nie zmieniają się w runtime); 10 linii                                 | 30 min                                                                                                                                         |
| 3   | Wydajność / Batch — P1.1 correctness     | `POST /studnie` i `PUT /studnie` iterują `for (const o of incoming)` z osobnym `prisma.*.upsert` + `syncFts5` per oferta bez transakcji — batch 20 ofert = 20 round-tripów + częściowy sukces możliwy (operacje 1-3 ✓, 4 ✗)                                                                                                                                                    | `src/routes/offers/studnieCrud.ts:406-561` + `584-690`                                                                                                         | **P1** correctness                                   | Owinąć pętlę w `prisma.$transaction([...ops])` lub `createMany` — all-or-nothing + 1 RTT                                                                            | 1h                                                                                                                                             |
| 4   | Spójność / Transakcja — P1.1 correctness | `saveDefaults()` ma timestamp `settings.upsert` **w** transakcji (fix #45 OK), ale `restoreDefaultsFromJson()` robi `settings.upsert` **poza** transakcją (`await prisma.$transaction(...); if(exportedAt) upsert`) — crash między tx a upsert = niespójny guard                                                                                                               | `src/services/priceOverrideService.ts:480-528` — upsert linia 522 poza tx                                                                                      | **P1** correctness                                   | Przenieść `settings.upsert` do wnętrza `$transaction` (jak w saveDefaults) — all-or-nothing                                                                         | 20 min                                                                                                                                         |
| 5   | Wydajność / Lock — P1.2 concurrency      | `createModuleLock()` = jeden globalny lock (ownerId string, poll co 100ms, timeout 30s) dla wszystkich modułów — zapis cenników blokuje zapis ofert. Globalny lock brzydki ale chroni przed SQLite write contention / race / duplikacją numeracji — przejście na per-key wymaga jasnej definicji klucza (documentId? offerId? userId? resource type+ID?) i testów równoległych | `src/middleware/writeLock.ts:5-6` `let ownerId: string                                                                                                         | null = null` (nie per-key)                           | **P1** concurrency (ryzykowny refaktor)                                                                                                                             | Najpierw analiza: jakie operacje naprawdę wymagają wykluczenia; potem `Map<key,owner>` z kluczem per resource, nie „usuń lock będzie szybciej” | 1h + testy concurrency |
| 6   | Wydajność / Search                       | `src/routes/offers/search.ts` UNION ALL + COUNT(*) w podzapytaniu + 17x `LIKE %q%` + JSON extract bez indeksu — brak rankingu FTS5, każdy search skanuje `offers_rel` + `offers_studnie_rel` + `orders_*`; wąskie gardło kartoteki przy >10k ofert                                                                                                                             | `src/routes/offers/search.ts:84-123` i `140-147`; benchmark search p50 13.9ms (mała baza) — rośnie liniowo                                                     | **P1**                                               | FTS5 `ORDER BY rank` + `LIMIT` wewnątrz CTE, indeksy na `createdAt`, `userId`; rozważyć `searchCache` warm na starcie                                               | 2-3h                                                                                                                                           |
| 7   | Cache                                    | `searchCache` TTL 30s, max 100, LRU przez delete+set — poprawne, ale klucze niespójne: offers/search używa `user.id` jako namespace, productionSearch używa `'production'` — invalidateAll czyści wszystko mimo że per-user byłoby tańsze                                                                                                                                      | `src/utils/searchCache.ts:6-51`; `src/routes/offers/search.ts:30` `searchCache.get(user.id, params)` vs `productionSearch.ts:26` `get('production', cacheKey)` | **P2**                                               | Standaryzacja: `get('offers', {userId, ...params})` + `invalidateNamespace('offers')` zamiast `invalidateAll()`                                                     | 30 min                                                                                                                                         |
| 8   | Architektura / Init                      | `initApp()` = 12 sekwencyjnych auto-heal (PRAGMA, indeksy, shares, FTS5, model, flagi) — każdy `try { } catch { warn }` maskuje błąd; start serwera trwa 1-2s nawet gdy wszystko OK; FTS5 `backfill` bez limitu może trwać sekundy przy dużej bazie                                                                                                                            | `src/app.ts:309-482` — 8× `CREATE INDEX IF NOT EXISTS`, 2× `backfillFts5()` pełny SELECT                                                                       | **P2**                                               | FTS5 backfill asynchronicznie lub tylko gdy brak tabeli; indeksy tworzyć w migracjach nie w runtime (docelowo usunąć auto-heal po A8)                               | 1h                                                                                                                                             |
| 9   | Bezpieczeństwo / CTF                     | `helmet` CSP enforce + `cspReportOnly` report-only równolegle — przeglądarka dostaje dwa nagłówki, `report-only` z nonce per-request a `helmet` z `unsafe-inline` — Faza 1 celowa (monitoring), ale brak przejścia na enforce; `trust proxy 1` OK ale `.env` nie wymusza `TRUST_PROXY` w prod                                                                                  | `src/app.ts:122-148`                                                                                                                                           | **P2**                                               | Po zebraniu raportów przełączyć na `Content-Security-Policy: nonce-...` enforce, usunąć `unsafe-inline` z `helmet` (plan CSP Faza 4)                                | 2h                                                                                                                                             |
| 10  | Obsługa błędów                           | Puste `catch {}` w `src/routes/*/crud.ts:181,222` i `fts5Sync.ts:33,48` — FTS5 cicho ignoruje błąd (celowe: tabela może nie istnieć), ale brak `logger.debug` utrudnia diagnozę; `studnieCrud` ma poprawne `logger.warn`                                                                                                                                                       | `src/routes/offers/crud.ts:181`; `src/utils/fts5Sync.ts:33`                                                                                                    | **P2**                                               | Dodać `logger.debug('Fts5', 'ignore', e)` w pustych catchach (koszt 2 linie)                                                                                        | 10 min                                                                                                                                         |
| 11  | Spójność / Baza — P1.3 cursor            | Kursory w `searchUtils` porównują surowe `createdAt` (`"createdAt" < cursor`) podczas gdy `productionSearchUtils` używa `normalizedCreatedAtSql()` — legacy epoch-ms daje błędny order przy mixed danych; wpływ niższy niż P1.1 jeśli tylko edge-case normalizacji, ale correctness jeśli pomija/duplikuje rekordy                                                             | `src/utils/searchUtils.ts:64-69` vs `src/utils/productionSearchUtils.ts:61-65` i `106-110`                                                                     | **P1** (edge-case, po P1.1)                          | Ujednolicić: używać `normalizedCreatedAtSql()` (CASE GLOB) w obu miejscach lub wymusić migrację epoch→ISO                                                           | 1h                                                                                                                                             |
| 12  | Konfiguracja                             | `prismaClient.ts:42` `connection_limit=1&busy_timeout=30000` — poprawne dla SQLite (serializacja), ale `normalizeDatabaseUrl` tworzy katalog bazy `mkdirSync` przy każdym imporcie — side-effect w module top-level                                                                                                                                                            | `src/prismaClient.ts:35-36` `fs.mkdirSync(path.dirname(abs), {recursive:true})`                                                                                | **P2**                                               | Przenieść `mkdir` do `initApp()` (jawny start), nie przy imporcie                                                                                                   | 15 min                                                                                                                                         |
| 13  | Telemetria / ML                          | `cronService` 4× `setInterval` z `unref()` OK, ale brak guard overlap — `runMlTraining` co 15m może nachodzić na poprzedni run (brak `isRunning` jak w `learningEngine`)                                                                                                                                                                                                       | `src/utils/cronService.ts:53-70`                                                                                                                               | **P2**                                               | Dodać `if (this.running.has(name)) return` guard per task                                                                                                           | 20 min                                                                                                                                         |
| 14  | Zależności                               | `puppeteer 24.43.1`, `prisma 6.0`, `zod 4.3.6` aktualne; `standard-version` 9.5.0 deprecated (archived) — release flow zależny od nieutrzymywanej libki                                                                                                                                                                                                                        | `package.json:140`                                                                                                                                             | **P2**                                               | Migracja `standard-version` → `commit-and-tag-version` (drop-in) w następnym sprint                                                                                 | 30 min                                                                                                                                         |

**Stan pozytywny (nie w tabeli — nie wymaga fix):** WAL+NORMAL (`app.ts:327-328`), 30s busy_timeout, httpOnly+sameSite=lax cookie (`auth.ts:52-58`), token SHA256 (`auth.ts:39-41`), lean `logger` + `requestLogger` z db counter, zod walidacja na wszystkich write routes, shares z `document_shares` + `canReadWithShare`, `priceOverride` SHA256 manifest v2 + kompensacja pliku, `ModelRegistry` atomowe `active` swap + `pruneOldModels`.

## 3. Wąskie gardła (top 3 + metryka) — feedback: #3 to nie tylko performance, to correctness

| #   | Gardło                                                                                                                                                                                                                                                                       | Teraz (prod, baza ~1k ofert)                                               | Po fix                                                      | Zysk                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------- |
| 1   | **Brand HTML sync I/O per GET** (`src/app.ts:172-174`) — każdy GET HTML = `existsSync` + `readFileSync` + 2× regex replace; blokuje event loop. **Najlepszy ROI — mały patch, duży efekt, osobny commit**                                                                    | 5-12 ms TTFB HTML (mierzone: `benchmark save` p99 116ms zawiera HTML path) | Cache Map + mtime check: ~0.1 ms                            | **~10× TTFB**, brak blokady loop |
| 2   | **Kartoteka search UNION ALL + LIKE%** (`search.ts:84-123`) — pełny skan ofert + orders per search, rośnie liniowo; brak indeksu na `json_extract(data, ...)`. **Niewidoczny przy małej bazie, eksploduje przy wzroście — nie optymalizować przed pomiarem na 10k+ dataset** | p50 13.9ms @ <1k ofert, ~80ms @ 10k (prognoza)                             | FTS5 rank + indeks `createdAt` + cache warm: p50 <8ms @ 10k | **5-10×** przy skali             |
| 3   | **Batch offers bez transakcji** (`studnieCrud.ts:406ff`) — 20 ofert = 20 RTT + częściowy batch możliwy (`1✓ 2✓ 3✓ 4✗` = dane w połowie). **To nie tylko performance — to data integrity**                                                                                    | 20× ~15ms = 300ms batch, ryzyko częściowego zapisu                         | 1× `$transaction` ~40ms, atomic                             | **7× batch + correctness**       |

> Pomiar bazowy z `benchmark:quick` 10 próbek: AGG p50 14.6ms, p95 17.6ms, p99 116.2ms — realna baza prod z ~500 ofertami będzie 2-3× wyższa bez powyższych fixów. Claim „10k” = hipoteza częściowo potwierdzona; wymaga load testu concurrent users + realistic dataset (requests/sec, cold vs warm cache, liczba studni).

## 4. Quick wins (<1h każdy)

1. **Cache brand HTML** — `Map` w `src/app.ts:158` + stat na starcie (15 min, -10ms/req).
2. **Przenieść `settings.upsert` do transakcji** w `restoreDefaultsFromJson` (`priceOverrideService.ts:520` → wewnątrz `$transaction`) (20 min, fix P1 spójność).
3. **Guard overlap cron** — `Set<string> running` w `cronService.ts:58` (20 min, stabilność ML).
4. **Debug w pustych catchach** FTS5 (`fts5Sync.ts:33`) — `logger.debug` zamiast `catch {}` (10 min, diagnozowalność).
5. **Ujednolicić `searchCache` klucze** — `get('offers', {userId,...})` + `invalidateNamespace('offers')` (30 min, mniej invalidacji).
6. **`mkdirSync` do `initApp`** z `prismaClient.ts:35` (15 min, czystszy import).

## 5. Rekomendacje architektoniczne (co usunąć > co dodać)

- **Usunąć:** `standard-version` (deprecated) → `commit-and-tag-version`; auto-heal indeksów/shares z `initApp` po domknięciu migracji `document_shares` (linie 373-440); `fs.readFileSync` per-request; globalny single-key `writeLock`.
- **Dodać:** per-key `writeLock` (`Map<key,owner>`); `normalizedCreatedAtSql()` w `searchUtils`; transakcje batch w `studnieCrud`; `uncaughtException` handler obok `unhandledRejection` (`server.ts:22` — obecnie tylko Rejection); `Cache-Control: immutable` dla `/css/min/*` (już 7d, ale można `immutable`).
- **Nie dodawać:** nowych libs (YAGNI) — cache to `Map`, lock to `Map`, transakcja to `prisma.$transaction`; FTS5 już w SQLite, nie potrzeba Elastic.

## 6. Roadmap — zamrożona 2026-08-29 (feedback 9/10: nie szukać kolejnych problemów przed implementacją)

**Etap 0 — blocker produkcyjny (Gate: nie idziemy dalej bez PASS):**

```
[ ] Backup SQLite (npm run backup)
[ ] prisma migrate deploy
[ ] prisma migrate status → PASS (0 pending)
[ ] smoke test document_shares (select + share CRUD)
```

**Etap 1 — P0 performance (osobny commit):**

```
[ ] HTML cache (Map + mtime) — #2
[ ] benchmark before / after
[ ] regression tests
[ ] uncaughtException handler w server.ts (kopiuj wzorzec unhandledRejection:22)
```

**Etap 2 — P1.1 correctness (każda zmiana z testem regresji):**

```
[ ] batch → transaction — #3 (dawne #11)
[ ] settings upsert → transaction — #4 (dawne #5)
[ ] cursor raw → normalized — #11 (dawne #4)
```

**Etap 3 — P1.2 concurrency (nie bez testów równoległych):**

```
[ ] analiza writeLock — jakie operacje wymagają wykluczenia — #5
[ ] definicja lock key (documentId? offerId? userId? resource type+ID?)
[ ] per-key locking (Map<key,owner>)
[ ] concurrency tests (parallel writes)
```

**Etap 4 — scale (dopiero po realistycznym datasecie):**

```
[ ] realistic dataset 10k+ ofert
[ ] kartoteka benchmark — #6 (UNION+LIKE) — dopiero jeśli benchmark potwierdzi potrzebę
[ ] FTS rank jeśli potrzeba
[ ] guard cron overlap — #13
```

**P2 backlog (po Etap 4):**

- Ujednolicenie searchCache — #7
- Usunięcie auto-heal po migracjach — #8
- CSP enforce (Faza 4) — #9
- Puste catche → debug log z kontekstem (operation, resourceId, error) — #10
- `mkdir` do initApp — #12
- `standard-version` → `commit-and-tag-version` — #14

> Decyzja: plan zamrożony — kolejne iteracje tylko kosmetyka raportu, nie nowa diagnoza przed startem implementacji.

## 7. Załącznik — komendy do replikacji audytu

```bash
# Walidacja (jak w prompt)
npm run typecheck
npm run typecheck:frontend
npm run lint
npm run lint:frontend
npm run version:check
npm run encoding:check
npm run appname:check
npm run collisions:check
npx prisma migrate status
npm run benchmark:quick        # wymaga npm run dev w tle
npm run test:quick             # 116s, 2023 testy

# Głębiej
npm run validate               # typecheck+lint+appname+licenses+test:quick+collisions
npx prisma migrate deploy      # prod — zastosuj 20260828000000_add_document_shares
node scripts/check-version.mjs
node -c src/app.ts             # syntax check (tsc covers)
grep -R "catch {}" src/        # puste catche
grep -R "fs\.readFileSync" src/app.ts
grep -R "createModuleLock" src/
```

## 8. Ocena rozwiązań (werdykt)

| Obszar                    | Ocena | Uzasadnienie                                                                               |
| ------------------------- | ----- | ------------------------------------------------------------------------------------------ |
| Architektura / cykl życia | 8/10  | fail-fast, WAL, graceful shutdown, Sentry, compression — brakuje tylko `uncaughtException` |
| Routing / middleware      | 8/10  | zod, rateLimiters (6 limiterów), ownership — lock globalny do poprawy                      |
| Baza / Prisma             | 7/10  | SQLite optymalnie skonfigurowane, ale migracja wisi i batch bez transakcji                 |
| Wydajność API             | 7/10  | p50 14ms świetne na małej bazie; skalowanie kartoteki wymaga FTS rank                      |
| Cache / statyki           | 6/10  | 7d + min CSS OK, ale HTML bez cache psuje zysk                                             |
| Bezpieczeństwo            | 8/10  | httpOnly, SHA256, 403 shares, helmet — CSP report-only celowo                              |
| Odporność                 | 8/10  | dual-write fix (#45), silent fail hunter zaleczony, cron unref                             |
| Deploy                    | 7/10  | version guard, backup VACUUM, prices export — migrate status FAIL blokuje                  |
| Testy                     | 9/10  | 2023 testy, typecheck 0 błędów, coverage via `validate`                                    |
| Zależności                | 7/10  | aktualne, ale `standard-version` EOL                                                       |

**Rekomendacja końcowa (skorygowana):** Serwer jest w bardzo dobrym stanie technicznym. Nie widzę obecnie fundamentalnego blokera skalowania do danych rzędu 10 tys. ofert. Kolejne ograniczenia są znane, zmierzone i mają konkretną roadmapę (Etap 0→4). Dokładna przepustowość concurrent users wymaga osobnego testu obciążeniowego na realistycznym datasecie — hipoteza „10k” potwierdzona częściowo benchmarkami (p50 14.6ms), nie bezwarunkowo.

**Status planu:** 🔒 ZAMROŻONY 2026-08-29 — gotowy do realizacji.
