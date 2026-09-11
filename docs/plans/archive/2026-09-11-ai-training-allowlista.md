# AI training allowlista — wybór użytkowników zasilających ML/KB

**Wersja:** 1.1 (zaimplementowany)
**Status:** DONE — wdrożone 2026-09-11 (16 nowych testów, regresja ML zielona)
**Data:** 2026-09-11

## Odchylenia od planu (decyzje implementacyjne)

- `getTrainingUserIds()` jest **fail-open**: błąd odczytu `settings` = `null`
  (wszyscy). Telemetria/ML nie mogą paść przez sam odczyt flagi; naprawia też
  kompatybilność ze starymi mokami (`TrainingPipeline.test.ts` bez `settings`).
- Rekordy bez autora (`userId null`) przy ustawionej allowliście są
  **wykluczane** (strict, spójne z `userId in` — null nigdy nie pasuje).
- Przycisk "Archiwizuj wszystkie + przelicz" **pominięty** (brak endpointu,
  scope creep) — historyczne wzorce wygasają naturalnie (90 dni), baner w UI
  o tym informuje.

## Cel

Admin wybiera w dashboardzie AI/ML, od których użytkowników dane
telemetryczne zasilają uczenie (pipeline ML + KnowledgeBase).
Bez tego model uczy się na danych wszystkich użytkowników (stan obecny).

## Twardy invariant (P0)

> Żaden rekord pochodzący od użytkownika spoza allowlisty nie może zostać
> użyty ani do ekstrakcji nowych cech, ani do treningu, ani do resyncu
> etykiet/cech, ani do LearningEngine.

## Magazyn: `settings.ai_training_user_ids`

- Brak migracji. Wzorzec jak `wells_ai_influence`
  (`src/routes/telemetryAiMl.ts:461-505`).
- `GET/PUT /api/telemetry/ai/training-users`, `requireAuth + requireAdmin`,
  PUT za `requireAiMlEnabled`, audit log, walidacja zod `string[]`.
- Helper `getTrainingUserIds(): string[] | null`
  (nowy plik `src/services/ml/trainingUsers.ts`):
  `null` (brak klucza) = wszyscy (backward compat), `[]` = nikt.
- Semantyka allowlist: tylko wybrani uczą model.

## Backend — punkty filtracji

1. `FeatureExtractor.extractAndStore()` (`src/services/ml/FeatureExtractor.ts:215`)
   — dodać `userId: { in: ids }` do `where` na `ai_telemetry_logs`.
2. `resyncLabels` (kursor `(createdAt, id)`, batch 2000,
   `FeatureExtractor.ts:402-481`) — dodać `userId in` do `where` kwerendy
   telemetry wewnątrz kursora. Kursor paginuje już przefiltrowany zbiór,
   deterministycznie, bez limitu na ids. To jest P0 (etykiety od niewybranych
   nie mogą wyciec do treningu).
3. `resyncFeatures` (`take: 1000` na `aiFeature` + join) — odwrócić kolejność:
   najpierw paginowany `ai_telemetry_logs` po `userId in` (kursor jak
   w resyncLabels), potem `aiFeature where telemetryId in` z tego batcha.
   Nigdy pełny `telemetryIds` z arbitralnym limitem.
4. `TrainingPipeline.ts:309` (okno 2000 najnowszych) — `AiFeature` nie ma
   `userId` (tylko `telemetryId`), więc join dwuetapowy per batch:
   pobrać kandydatów `aiFeature` (okno), do nich
   `ai_telemetry_logs select id, userId where id in`, odrzucić spoza allowlisty.
   Jeśli po odrzuceniu poniżej minimum → dobierać starsze batche
   (kursor po `createdAt`), nie trenować na okrojonym oknie.
   Guard `insufficient_data` liczony PO filtrze.
5. `LearningEngine.fetchTelemetryRecords()` (`src/services/telemetry/learning/LearningEngine.ts:72-80`)
   — dodać `userId in` do `where`. To jedyna ścieżka zasilania KB
   (`runFullCycle → fetchTelemetryRecords → detectAllPatterns → upsertPattern`;
   `KnowledgeBase` to pure storage, zero własnego ingestion), więc jeden filtr
   pokrywa całe KB going forward.

## Historyczne dane (uczciwe ograniczenie)

- Rekordy `ai_telemetry_logs` / `AiFeature` od odznaczonych użytkowników
  zostają w bazie, są ignorowane w treningu (filtr query-time).
- Historyczne wzorce KB sprzed ustawienia allowlisty zostają do naturalnej
  archiwizacji (`archiveStalePatterns`, 90 dni) — bez kolumny proweniencji
  w `ai_knowledge_base` retro-filtracja jest niemożliwa (świadomie bez migracji).
- Opcja dla admina: przycisk "Archiwizuj wszystkie + przelicz"
  (`archiveStalePatterns(0)` + `runFullCycle`) — deterministyczny rebuild
  tylko z dozwolonych.
- Kontrola przed implementacją: semantyka `archiveStalePatterns(0)` —
  ZWERYFIKOWANA w kodzie (`KnowledgeBase.ts:362-380`):
  `cutoff = now - maxAgeDays * ms`, `where lastHitAt < cutoff`.
  Dla `0` cutoff = teraz, więc archiwizuje wszystko z `lastHitAt < now`,
  czyli praktycznie wszystkie wzorce. Semantyka poprawna dla rebuild.

## Frontend

- Sekcja w `public/js/admin/aiDashboardMl.js` (grupa "Dane i operacje",
  ~linie 168-197) + `trainingUsers: '/api/telemetry/ai/training-users'`
  w `ENDPOINTS` (`public/js/admin/aiDashboardCore.js:4-21`).
- Baner trybu nad listą (3 stany):
    - "Tryb: wszyscy użytkownicy (allowlista nieskonfigurowana)" — warn;
    - "Tryb: allowlista (N wybranych)" + info o historycznych wzorcach;
    - "Tryb: nikt (`[]`) — model nie uczy się".
- Lista checkboxów z `GET /api/users` (`src/routes/users.ts:16`),
  zapis debounce PUT jak slider influence (`aiDashboardMl.js:332-355`),
  `escapeHtml` na nazwach, `lucide.createIcons({ root })` po renderze.

## Testy (6)

1. `allowlist = ["A"]` → A trafia do ekstrakcji/treningu.
2. `allowlist = ["A"]` → B nie trafia.
3. `allowlist = []` → nikt nie trafia.
4. Brak klucza → wszyscy trafiają (backward compat).
5. Resync → etykieta/cechy rekordu B nietknięte mimo feedbacku (P0).
6. E2E historyczne KB: `allowlist = ["A"]` + historyczny pattern utworzony
   wcześniej przez B → `runFullCycle` nie tworzy/nie aktualizuje nowych
   wzorców z danych B; osobno `archive all + rebuild` → KB zawiera wyłącznie
   wzorce z aktualnie dozwolonych danych.

## Weryfikacja implementacji

- `npm run typecheck`, `npm run lint:frontend`, `node -c` dla edytowanych JS.
- `npm run version:check` przed commitem.
- Bez nowej migracji Prisma. Bez refaktoru ML/KB poza filtrem.
