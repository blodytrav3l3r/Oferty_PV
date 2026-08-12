# Plan napraw AI/ML (po audycie 2026-08-12)

Audyt wykazał poprawne zbieranie/zapis danych i brak wycieków (leakage) w pipeline ML.
Poniżej plan napraw zdiagnozowanych wad logiki, wraz z testami.

## Zasady wykonania (wspólne)

- Kod, komentarze, commity po polsku; identyfikatory po angielsku; Prettier (pojedyncze cudzysłowy, średniki).
- Po każdej zmianie JS: `node -c <plik.js>`; na końcu: `npm run format`, `npm run typecheck`, `npm run lint:frontend`, `npm run test:quick`.
- Commit przez `node scripts/commit.mjs "typ(scope): opis"` (UTF-8, scope zezwolony, subject <= 72 zn.).
- Finalna sanity: `npm run version:check`.

## FAZA A — poprawki niskiego ryzyka

- [x] **A1. Reward ACCEPT gubiony przy multi-studniowych zapisach + bindowanie właściwej studni**
    - Przyczyna: globalny single-flight `_rewardInFlight` (mlRewardHooks.js:22,35,40) + `sendReward` używa `getCurrentWell()` zamiast studni z pętli (offerSave.js:130-139, orderCrud.js:309-318).
    - Zmiany: `_rewardInFlight` -> `_rewardInFlightByWell: Set`, `sendReward(params)` przyjmuje `params.well` (fallback `getCurrentWell()`), callerzy przekazują `well: w`.
    - Testy: nowy `tests/studnie/mlRewardHooks.test.ts` (regresja single-flight, bindowanie well, wasAiRanked). Wykonano.

- [x] **A2. Stale fallback `FEATURE_VERSION = 'v6'` przy 29 cechach (v7)**
    - Miejsce: mlDualRanking.js:37.
    - Zmiany: `FEATURE_VERSION_FALLBACK = 'v7'` + eksport testowy `window.getFeatureVersionFallback`.
    - Testy: asercja fallbacku w `mlDualRanking.test.ts`; `featureParity.test.ts` pilnuje wymiaru 29. Wykonano.

- [x] **A3. `acceptance-full` tworzy niepotrzebny duplikat rekordu MANUAL**
    - Miejsce: src/routes/telemetryAi.ts:134-180.
    - Zmiany: pomiń dodatkowy `recordConfig`, gdy rekord telemetrii dla wellId już istnieje; zostaw, gdy studnia nie przeszła przez solver.
    - Testy: nowy `tests/telemetryAcceptanceFull.test.ts` (router + supertest, mock prisma). Wykonano.

- [x] **A4. (kosmetyka) Martwa gałąź `normalizeWellType`**
    - Miejsce: src/services/ml/FeatureExtractor.ts:323-324 (`=== 'styczna_1200'` nieosiągalne).
    - Zmiany: usunąć nieosiągalną gałąź; bity pilnuje istniejący `featureParity.test.ts`. Wykonano.

## FAZA B — naprawa pogłębiona (opcjonalna)

- [x] **B1. `original_auto_config` nigdy nie wypełniany -> martwe wzorce korekt w Learning Engine**
    - Zmiany: `window.buildOriginalConfigFromWell(well)` w telemetryBridge.js, zapamiętanie `well._lastAutoConfig` w solverAutoSelect.js, użycie w offerSave `_sendAcceptanceTelemetry`.
    - Testy: nowy `tests/studnie/telemetryBridgeCorrections.test.ts` (6 przypadków). Wykonano.

## Weryfikacja

1. A1 -> `npx jest tests/studnie/mlRewardHooks.test.ts tests/studnie/telemetryAuthHeaders.test.ts`
2. A2 -> `npx jest tests/studnie/mlDualRanking.test.ts tests/ml/featureParity.test.ts`
3. A3 -> `npx jest tests/telemetryAcceptanceFull.test.ts tests/ml/telemetryAiMl.test.ts tests/telemetryRoutes.test.ts`
4. A4 -> `npm run typecheck`
5. B1 -> `npx jest tests/studnie/telemetryBridgeCorrections.test.ts tests/studnie/telemetryAuthHeaders.test.ts`
6. Pełna walidacja: `npm run format`, `npm run typecheck`, `npm run lint:frontend`, `npm run test:quick`, sanity `npm run version:check`.

## Celowo POMINIĘTE (wymaga zgody)

- `featureCount` w `/ai/ml-status`/`/ai/health` = liczba wierszy, nie liczba cech — dashboardy już interpretują poprawnie (health: „rekordów", aiDashboard nie używa pola). Rename bez wartości -> zostaje.
- `_aiRankInfo.scoreBefore` (sprzężenie zwrotne model <-> sliding AUC) — zamierzone, nie leakage.
