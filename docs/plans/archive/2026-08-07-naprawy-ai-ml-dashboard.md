# Plan: Naprawy AI/ML — parytet cech, bezpieczeństwo, dead code (2026-08-07)

## Overview

Cel: usunąć znalezione w audycie wady blokujące budowę **poprawnego** pierwszego modelu AI/ML
(telemetry → FeatureExtractor → TrainingPipeline → AiModel → mlDualRanking) i zabezpieczyć go
przed regresją. W przeciwieństwie do planu nadrzędnego (`2026-08-07-pierwszy-model-ai-ml.md`),
który opisuje operacyjne etapy zbierania danych, ten plan dokumentuje zmiany KODU wykonane
poza jego zakresem: parytet cech train/serve (test regresyjny), nagłówki auth we fetch'ach,
usunięcie dead code i single-endpointu bez konsumenta.

## Status

Wszystkie fazy **wdrożone i przetestowane** (commit `b84b240` + dalsze). Testy: `test:quick`
1481/1481, typecheck i lint czyste, Prettier czysty.

## Faza 1 — Nagłówki autoryzacji (H1) i guardy jakości telemetrii (P0)

**H1 — fetch'e AI/ML bez `authHeaders`:** cztery moduły frontendu wołały endpointy AI/ML bez
nagłówka `X-Auth-Token`, więc przy włączonej autoryzacji wszystkie wywołania dostawały 401.
Fix w komicie `b84b240`:

| Plik                                     | Zmiana                                                             |
| ---------------------------------------- | ------------------------------------------------------------------ |
| `public/js/studnie/telemetryBridge.js`   | `safeFetch` dodaje `authHeaders()` (EVENT_URL)                     |
| `public/js/studnie/mlDualRanking.js`     | `ML_STATUS_URL`/`SETTINGS_URL`/`BATCH_PREDICT_URL` z `authHeaders` |
| `public/js/studnie/mlRewardHooks.js`     | `REWARD_URL` z `authHeaders`                                       |
| `public/js/studnie/aiStatusIndicator.js` | `STATUS_URL`/`KNOWLEDGE_URL` z `authHeaders`                       |
| `public/js/shared/ui.js`                 | helper `fetchJson` (dodaje `authHeaders`, gdy brak `headers`)      |

Test regresyjny: `tests/studnie/telemetryAuthHeaders.test.ts` (vm sandbox, 3 testy).

**P0 — dead code w backendzie ML:** usunięto nieużywane ścieżki, które nie miały konsumenta:

- `FeedbackProcessor.ts` (plik + re-eksport w `learning/index.ts` + testy)
- `LearningEngine.getComponents()` + pole `kb` + `recommend`
- `RecommendationEngine.persistRecommendation` / `applyDecision`
- duplikat `normalizeWarehouse` w `TrainingPipeline.ts` (import z `FeatureExtractor.ts`)

**Faza 1 guardy — `trainingEligible` warunkowy:** `src/services/telemetry/telemetryService.ts`
`_isTrainingEligible(payload)` — rekord bez `allComponentIds` lub z `totalPrice <= 0`
(empty featureSnapshot) nie przechodzi do ekstrakcji. Testy w `telemetryRoutes.test.ts`.

## Faza 2 — Test parytetu cech train/serve (ten commit)

Ryzyko: frontend (`mlDualRanking.js buildFeatureVector`) i backend (`TrainingPipeline.ts
oneHotEncode`) liczą 24-wymiarowy wektor cech v6 **osobno**. Każda zmiana kolejności/semantyki
cech po jednej stronie = model trenowany na wektorach backendu dostaje na serve inne bity
(skew). Do tej pory poprawność wiązano tylko z `FEATURE_NAMES` + `FEATURE_VERSION` + guardem
`FEATURE_VERSION_MISMATCH` — żaden test nie porównywał faktycznych wektorów.

**Zmiany:**

- `src/services/ml/TrainingPipeline.ts`: eksport `oneHotEncode` i `seasonToNum` (były prywatne).
- `tests/ml/featureParity.test.ts` (NOWY): ładuje prawdziwy `mlDualRanking.js` w sandboxie vm,
  buduje wektor frontendu (`buildFeatureVector`) i wektor backendu (`oneHotEncode` z raw
  odpowiednika `FeatureExtractor.extract`) dla tej samej studni i porównuje pozycyjnie.

Przypadki testowe (7): wymiar 24; studnia standard KLB bez uszczelek; uszczelki GSG
(connectionCount + cena/waga z uszczelkami); psia buda (bity wellType/hasPsiaBuda); kineta
preco (one-hot 1-z-3); magazyn Włocławek (bity warehouse); mapowanie `seasonToNum` ↔
`getSeasonNum`.

**Ważne:** test nie zakłada poprawności żadnej strony — zakotwicza, że OBU stronom dobiega
ta sama transformacja. Jeśli jedna strona się zmieni, test pada z różnicą wektorów.

## Faza 3 — Usunięcie `POST /api/telemetry/ai/predict` (singiel)

Endpoint pojedynczej predykcji nie miał żadnego konsumenta (frontend używa wyłącznie
`/ai/predict/batch` przez `mlDualRanking.js:22`). Usunięto:

- `src/routes/telemetryAiMl.ts`: route `POST /ai/predict`, `predictSchema`, helper `runPrediction`
  (helper `normalizeFeatures` pozostaje — używany przez batch).
- `tests/ml/telemetryAiMl.test.ts`: describe `POST /ai/predict` (5 testów) → przekwalifikowany
  na `POST /ai/predict/batch` (zostają testy batch; usunięto nieużywane `FEATURES_24`/`MIN_24`/`MAX_24`).
- `docs/API.md`: wpis o single predict.

## Weryfikacja

| Krok                    | Komenda                          | Wynik     |
| ----------------------- | -------------------------------- | --------- |
| typecheck backend       | `npm run typecheck`              | czyste    |
| typecheck frontend      | `npm run typecheck:frontend`     | czyste    |
| lint backend + frontend | `npm run lint` / `lint:frontend` | 0 błędów  |
| testy dymne             | `npm run test:quick`             | 1481/1481 |
| formatowanie            | `npm run format`                 | czyste    |

## Pliki

- `src/services/ml/TrainingPipeline.ts` — eksport `oneHotEncode`/`seasonToNum`
- `src/routes/telemetryAiMl.ts` — usunięty single predict
- `tests/ml/featureParity.test.ts` — NOWY test parytetu (Faza 2)
- `tests/ml/telemetryAiMl.test.ts` — testy batch predict
- `public/js/studnie/mlDualRanking.js`, `telemetryBridge.js`, `mlRewardHooks.js`,
  `aiStatusIndicator.js`, `public/js/shared/ui.js` — authHeaders (commit `b84b240`)
- `src/services/telemetry/telemetryService.ts` — guardy `trainingEligible` (commit `b84b240`)
- `src/services/telemetry/learning/FeedbackProcessor.ts` — usunięty (commit `b84b240`)
- `docs/plans/2026-08-07-pierwszy-model-ai-ml.md` — plan nadrzędny (niezmieniony zakres operacyjny)
