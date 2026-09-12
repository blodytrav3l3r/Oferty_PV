# Synthetic validation harness — plan (read-only audit, bez implementacji)

**Status:** v1 zaimplementowana (`scripts/synth-harness.mjs`), 27/27 zielonych. Bez commita.
**Precyzyjna nazwa:** HTTP backend telemetry/reward validation harness (NIE pełny „1:1 synthetic offer generator").
**Granica v1:** prawdziwe endpointy + prawdziwy pipeline backendu, ale BEZ wykonania solvera JS i deterministycznego oracle; oferty w raporcie liczone rozłącznie (`offersCreated` / `wellsInOffers` / `telemetryConfigs`, pętla ofert capped do 10 z capu 50 jak frontend). Auth sesyjny = admin (izolacja z osobnego pliku DB, nie z allowlisty — asercje S-id to potwierdzają). Solver-JS w przeglądarce (Playwright) = ewentualne v2.
**Znaleziska v1 (kontrakty potwierdzone testem):** `allComponentIds` to tablica stringów (nie JSON-string); `trainingEligible` wymaga `featureSnapshot.totalPrice>0`; zod odrzuca jawne nulle w optional; MODIFY bez parent oznacza pierwszą sugestię AUTO studni (nigdy REJECT).
**Cel:** kontrolowane 1–10k ofert przez RZECZYWISTY flow (HTTP + solver + telemetria) w celu walidacji pipeline'u ML, nie zasilania produkcyjnego treningu.
**Twarda zasada:** syntetyk testuje mechanikę; nigdy nie trenuje modelu produkcyjnego i nigdy nie dotyka prod DB.

## 1. Ustalenia audytu (fakty, plik:linia)

- Oferta: `POST /api/offers-rury/studnie` body `{data:[offerDoc]}` (`studnieCrud.ts:480-506`, schema `offerSchemas.ts:156-158`); frontend flow `offerSave.js:26-227` (pricing → save → `_sendAcceptanceTelemetry` → ACCEPT batch → `acceptance-full`).
- Telemetria: `POST /api/telemetry/ai/config` wymaga tylko `solverSource` (`telemetrySchemas.ts:103`); `trainingEligible=false` gdy `parentConfigId` lub pusty config (`telemetryService.ts:483-493`).
- Solver: `configSource` z jednego miejsca (`solverAutoSelect.js:150`); `AUTO_AI` tylko gdy `shouldMarkAiSelection` (m.in. `aiWinner!==aiWinner`-referencja `technicalWinner`, `solverAutoSelect.js:1480-1498`); eksploracja jedyne `Math.random()` na ścieżce (`mlDualRanking.js:885-891`); determinizm = `aiInfluencePct=0` (hierarchia `mlDualRanking.js:137-167`).
- Oracle (deterministyczny, niezależny od AI): `recalculateWellErrors` (`solverValidation.js:12-218`, rzędne/luzy 300/300 i 150/150), `checkConflicts` (`solverAutoSelect.js:741-882`, kolizje otworów, strefy z `transitionZones.js`), `validatePrzejsciaForSave` (`solverValidation.js:242-287`). Wersje: `SOLVER_VERSION 1.0.0`, `RULES_VERSION 2026-06-30.1`, `FEATURE_VERSION v7`.
- Reward: batch cap 500, filtr `_lastAutoTelemetryId`, dedup `uq_reward_well_action` (`telemetryAiMl.ts:228-374`); linkage sugestii przez `parentConfigId` (`telemetryBridge.js:539-550`).
- Etykiety: `deriveLabel` SSoT dla extract/resync (`FeatureExtractor.ts:165-192`); `NO_FEEDBACK` odpada w treningu.
- Izolacja (istniejący wzorzec): testy Playwright `.cjs` spawnują serwer z własnym `DATABASE_URL` (`data/e2e.sqlite`) i własnym portem; skrypty migracyjne mają hard guardy na złą bazę (A5). Benchmarki: `scripts/benchmark*.mjs` (p50/p95/p99 przez HTTP).
- Leakage: trening czyta allowlistę (`ai_training_user_ids`) i `trainingEligible`; na izolowanej DB oba są pod kontrolą harnessu, ale sam osobny plik DB jest główną barierą.

## 2. Architektura harnessu (propozycja)

```text
scripts/synth-harness.mjs (przyszłość, NIE teraz)
  1. Załóż izolowaną DB (osobny plik + migrate deploy; hard guard: ODMOWA startu
     gdy DATABASE_URL wskazuje prod-/dev-ścieżkę).
  2. Zaspawnuj serwer (wzorzec playwright .cjs): własny PORT + DATABASE_URL.
  3. Scenariusze z §3 przez RZECZYWISTE endpointy (login → oferta → recordConfig
     → reward/acceptance-full), z seedowanym RNG (SEED jawny w raporcie).
  4. Asercje linkage: event A → telemetryId → AiFeature → etykieta (oracle z §1).
  5. Metryki: czas/kroki (p50/p95), wzrost DB, balans klas, coverage guardów
     (split/class/deploy), wykryte błędy.
  6. Teardown: kill serwera + usunięcie pliku DB. Raport JSON + werdykt.
```

Marker syntetyku: dedykowany `userId synth_*` (nigdy w allowliście) + flaga uruchomienia w raporcie. User syntetyczny nigdy nie istnieje w prod.

## 2a. Fail-closed izolacja (twardy invariant, GO)

Harness przerywa działanie PRZED startem serwera i PRZED pierwszym requestem mutującym, jeśli NIE potwierdzi łącznie: syntetycznej ścieżki DB + syntetycznego `DATABASE_URL` + `userId synth_*` + braku na denyliscie ścieżek produkcyjnych (`app_database.sqlite`, dev-DB) + asercji startowej. Kilka niezależnych zabezpieczeń, nie jedno porównanie. **Żaden fallback do domyślnego `DATABASE_URL`.**

## 2b. Niezależność oracle (twarda zasada)

Oracle (reguły techniczne z §1) NIE może korzystać z etykiety telemetrycznej ani z wyniku AI/ML będącego przedmiotem testu. Kierunek wyłącznie: reguły techniczne → ground truth → AI/telemetria → porównanie. Nigdy `AI → oracle → AI`.

## 3. Matrix scenariuszy (minimum)

Poprawna → ACCEPT; poprawna po modyfikacji → MODIFIED; odrzucenie sugestii → ścieżka negatywna; zwykła zmiana AUTO_JS → NIGDY REJECT; AUTO_AI realne vs `aiWinner===technicalWinner`; `WELL_NOT_FOUND`; duplikaty rewardów; batch >500 (limit endpointu `reward-batch`; 50 to cap chunkowania flow frontendowego, nie mylić); `parentConfigId` linkage; `well_deleted` → event, nigdy auto-negatyw; brak `_lastAutoTelemetryId`; cap/chunki 500; `FEATURE_VERSION_MISMATCH`.

## 4. Non-goals (twarde)

Brak treningu modelu na syntetyku bez osobnej decyzji i markera; brak zmian progów/etykiet/allowlisty/schematu; brak dotyku prod DB; brak generatora w tym planie — tylko jego specyfikacja.
