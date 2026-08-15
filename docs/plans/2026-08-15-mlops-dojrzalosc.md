# Plan: Dojrzałość MLOps — dane, metryki, guardraile, drift (2026-08-15)

Status: **ZAMKNIĘTY (feature freeze)**. Plan zweryfikowany i zatwierdzony do implementacji. Nie dodaje się nowych funkcji ani zabezpieczeń do planu, chyba że w trakcie implementacji zostanie wykryty konkretny błąd blokujący, sprzeczność architektoniczna albo problem bezpieczeństwa.

Cel: domknąć luki z audytu architektury ML. Zero nowych bibliotek, czysty TypeScript.

## Weryfikacja stanu — co JUŻ istnieje (nie budować od nowa)

| Obszar                                             | Stan w kodzie                                                                                                                 |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Chronologiczny split train/val (80/20)             | `src/services/ml/TrainingPipeline.ts:218-222` — okno 2000, train=starsze. Brak osobnego TEST.                                 |
| ROC-AUC + accuracy/precision/recall/F1             | `ModelMetrics` (`src/services/ml/ModelRegistry.ts:9-17`)                                                                      |
| Wersjonowanie cech                                 | `FEATURE_VERSION='v7'` (`src/config/mlConstants.ts`), `featureVersion` w `AiModel`, guard mismatch przy predict/activate      |
| Normalizacja min-max z modelem                     | `featureMins/featureMaxs` w `AiModel`, używane przy serve (`src/routes/telemetryAiMl.ts:68-72,139`)                           |
| Leakage — etykiety etykietują sugestię             | `deriveLabel` przez `parentConfigId` (`src/services/ml/FeatureExtractor.ts:164-183`)                                          |
| Immutable feature snapshot                         | `featureSnapshot` w telemetrii + `parseFeatureSnapshot`                                                                       |
| Atomic rollback/promote/deploy                     | `$transaction` (`ModelRegistry.ts:83,196,230,268`), `clearPredictionCache()`                                                  |
| Drift podstawowy (out-of-range price/weight)       | `driftPct` (`src/routes/telemetryAiMl.ts:539-571`)                                                                            |
| Training lock (mutex 5 min + flaga running)        | `TrainingPipeline.ts:154-167`                                                                                                 |
| Guard balansu klas (label diversity)               | `insufficient_label_diversity` (`TrainingPipeline.ts:228-239`)                                                                |
| Min nowych danych przed treningiem                 | `minNewRecordsForTraining=50` (`trainingConfig.ts`)                                                                           |
| Explainability (feature importance)                | `computeFeatureImportance` + `/ai/feature-importance` + rendering                                                             |
| Cache prediction — inwalidacja przy zmianie modelu | `clearPredictionCache()` na każdej zmianie (wersja w kluczu zbędna)                                                           |
| Endpointy admin                                    | `/ai/health`, `/ai/models`, `/ai/train`, `/ai/rollback`, `/ai/models/:id/activate`, `/ai/feature-importance`, `/ai/ml-status` |
| XSS frontend                                       | `escapeHtml`/`escapeHtmlAttr` w obu dashboardach                                                                              |
| Stabilny numerycznie sigmoid                       | clamp `z>20/z<-20` (`AcceptanceModel.ts:18-22`)                                                                               |

## Statusy treningu

```
RUNNING | SUCCESS | SKIPPED | FAILED_NUMERICAL | FAILED_VALIDATION | FAILED_TIMEOUT | FAILED_ERROR
```

- `SKIPPED` — normalny stan: za mało danych / za mało nowych danych / za mało klas / za mały test. To NIE jest błąd danych.
- `FAILED_ERROR` — prawdziwy wyjątek (dawniej `FAILED_DATA`; `insufficient_*` przeniesione do `SKIPPED`).
- `FAILED_VALIDATION` — **trening zakończony sukcesem, model POWSTAŁ**, ale kandydat nie spełnił kryteriów walidacji/deploy. To NIE jest porażka procesu uczenia — proces się udał, odrzucono wynik. Model zostaje `AiModel.state = REJECTED`.
- `FAILED_TIMEOUT` — przekroczony limit czasu treningu.

## Faza 1 — P0: Dane i kontrola uczenia

### 1.1 Nowa tabela `AiTrainingRun` (kręgosłup audytu "czy model faktycznie się uczy")

`prisma/schema.prisma` + migracja `20260816000000_ai_training_run`:

```prisma
model AiTrainingRun {
  id                     String   @id
  startedAt              String
  finishedAt             String?
  status                 String   // RUNNING | SUCCESS | SKIPPED | FAILED_NUMERICAL | FAILED_VALIDATION | FAILED_TIMEOUT | FAILED_ERROR
  datasetSize            Int
  trainSize              Int
  validationSize         Int
  testSize               Int
  featureVersion         String
  seed                   Int
  candidateModelVersion  String?  // model wyprodukowany przez ten run (jeśli powstał)
  comparedAgainstVersion String?  // model PRODUCTION, z którym porównywano kandydata
  datasetStartAt         String?  // pierwszy rekord datasetu (time-based split)
  datasetEndAt           String?  // ostatni rekord datasetu
  datasetFingerprint     String?  // SHA-256(sorted(recordId + timestamp + label + featureVersion))
  metrics                String?  // JSON: rozszerzony ModelMetrics (val + test)
  baselineAccuracy       Float?   // accuracy klasyfikatora majority-class = max(positiveRate, 1 - positiveRate)
  positiveRate           Float?   // częstotliwość klasy pozytywnej w train (osobno — przydatna w label drift)
  deployed               Boolean
  deploymentReason       String?
  error                  String?

  @@index([startedAt], map: "idx_aitrainingrun_started")
  @@index([status], map: "idx_aitrainingrun_status")
}
```

`AiModel` dodać: `state String?` (state machine — wartości z centralnej stałej `AiModelState`, guard przy zapisie), `seed Int?`, `featureDistributions String?` (JSON histogramów cech do PSI — baseline rozkładów zapisany przy treningu).

Format `featureDistributions` **wersjonowany** (kompatybilność przy zmianie algorytmu PSI — stary zapis nie psuje nowych modeli):

```json
{
    "version": 1,
    "features": {
        "<cecha>": { "bins": [0, 1, 2], "counts": [12, 34, 5] }
    }
}
```

Parser z guardem `version`: nieznana wersja → pomiń/ignoruj (nie rzucaj).

`datasetFingerprint` — algorytm:

```
fingerprint = SHA-256( sorted( recordId + timestamp + label + featureVersion ) )
```

Sortowanie PRZED hashowaniem — ten sam dataset daje ten sam fingerprint niezależnie od kolejności zwróconej przez DB. `crypto` (Node, już używane w `ModelRegistry`) — bez nowych zależności.

### 1.2 Split 70/15/15 time-based + guardy rozmiarów (P0)

`TrainingPipeline.ts:220-222` — zamiast 80/20: `train=0.70`, `val=0.15`, `test=0.15` chronologicznie. `evaluateModel` liczy metryki także na **test** (testRocAuc — osobno od val). Test widoczny w dashboardzie.

**Zasada TEST:** TEST używany **wyłącznie** do końcowej, niezależnej oceny modelu. NIE wpływa na hyperparametry, thresholdy, wybór modelu ani decyzję o treningu/deploy.

```
TRAIN       → trening
VALIDATION  → guardraile / tuning / decyzje
TEST        → tylko końcowa, niezależna ocena
```

Guardy minimalnych rozmiarów (`trainingConfig.ts`):

- `minDatasetForSplit=300`,
- `minTrain=200`,
- `minVal=50`,
- `minTest=50`,
- `minTestPositive>=5`, `minTestNegative>=5`.

Niespełnienie → `SKIPPED` z powodem. Mały test (np. 15 rekordów z 1 pozytywem) daje bezwartościowy `testRocAuc`.

### 1.3 Status enum zamiast stringów reason

`TrainingPipeline.run` → `{ status: 'SUCCESS'|'SKIPPED'|'FAILED_*', reason }` + zapis `AiTrainingRun` w każdym zakończeniu (także pominięcia — `SKIPPED`).

### 1.4 Guardraile numeryczne

`AcceptanceModel.train` + `TrainingPipeline`:

- check `NaN/Infinity` wag po każdym kroku → `FAILED_NUMERICAL`;
- loss divergence (`bestLoss + patience + divergenceThreshold`, NIE "N epoch z rzędu" — SGD ma chwilowe oscylacje np. 0.51/0.49/0.50, na nie nie reagować):
    ```
    loss > bestLoss * (1 + divergenceThreshold) przez N kolejnych epok → early stop + FAILED_NUMERICAL
    ```
- `FAILED_TIMEOUT` = **cooperative cancellation**, nie hard cut:
    ```
    deadline = startedAt + maxDuration
    per epoch: if (Date.now() > deadline) → TrainingTimeout → FAILED_TIMEOUT
    ```
    (JavaScript nie przerywa operacji nagle — trening musi sam sprawdzać deadline co epokę.)

### 1.5 Determinizm (seed = metadata/audyt + test)

`trainingConfig.ts`/`mlConstants.ts`: jawne `SEED=42`. Zapisywany w `AiTrainingRun` i `AiModel`.

**Semantyka seed:** to **reproducibility metadata / przyszły punkt kontroli RNG**. Algorytm obecnie nie używa RNG (wagi od 0, bez shuffle) — seed nie zmienia wyniku. Nie udawać, że seed zapewnia determinizm; determinizm wynika z braku RNG. Test determinizmu pozostaje obowiązkowy.

Test determinizmu: ten sam dataset + ta sama kolejność + te same hyperparametry + ta sama normalizacja + ten sam seed → **identyczne weights**.

### 1.6 Leakage — dokument + test regresyjny

Audyt dokumentacyjny: wszystkie 29 cech (`FEATURE_NAMES`) to dane znane **przed** decyzją (price/weight = koszt configu, brak flag `wasAccepted` w cechach). `deriveLabel` etykietuje sugestię przez `parentConfigId`, nie finalny config. Nie dodawać `FeatureDefinition { availableAt }` per-feature — brak konsumenta = YAGNI.

Nowy test `tests/ml/featureLeakage.test.ts`:

- `FEATURE_NAMES` nie zawiera: `wasAccepted`, `accepted`, `finalConfig`, `decision`, `reward`, `label`;
- `oneHotEncode` (train) i `buildFeatureVector` (serve) nie wyprowadzają label/reward — parytet cech train/serve pozostaje bez sygnału decyzji.

## Faza 2 — P1: Metryki, baseline, drift, state, shadow

### 2.1 Rozszerzone metryki — nowy `src/services/ml/metrics.ts`

Czyste funkcje bez zależności: `computePrAuc`, `computeLogLoss`, `computeBrier`, `computeEce` (calibration error), `computeConfusion`. `ModelMetrics` rozszerzyć: `prAuc, logLoss, brierScore, ece, confusion{tp,fp,fn,tn}, testRocAuc`. Parsowanie backward-compat (stare modele bez nowych pól → domyślne).

**Edge cases:** metryka matematycznie nieokreślona (np. PR-AUC przy jednej klasie, empty, length mismatch) → **`null` w API/JSON, nigdy NaN/Infinity**. Testy: empty, one class, perfect, worst, all-0, all-1, NaN, Infinity, length mismatch.

### 2.2 Baseline

`baselineAccuracy = max(positiveRate, 1 - positiveRate)` (accuracy klasyfikatora majority-class). `positiveRate` — osobna metryka zapisywana w `AiTrainingRun` (przydatna w label drift). Porównanie `model vs baseline` w `/ai/ml-status`. Dashboard: `Baseline X% / Model Y% / +Z pp`.

### 2.3 Guardrail deploy — porównanie z aktualnym PRODUCTION, nie z best

`TrainingPipeline.ts:256-258` + `trainingConfig.ts`. Nowy `getProductionModel()`.

**Pierwszy model (brak PRODUCTION):** jeśli absolutne progi spełnione (`minAuc`, `minPrAuc`, `maxLogLoss`, `maxEce`) → `APPROVED`. Wymagane, bo `production.rocAuc + 0.01` przy `production = null` nie ma sensu.

**Kolejne modele (jest PRODUCTION):**

```
Gate: candidate.rocAuc  >= production.rocAuc + deployAucImprovement(0.01)
      AND candidate.prAuc   >= minPrAuc
      AND candidate.logLoss <= maxLogLoss
      AND candidate.ece     <= maxEce
```

**Progi absolutne i relatywne (dwa poziomy):**

```
Absolutne:  candidate.logLoss <= maxLogLoss
            candidate.ece     <= maxEce

Relatywne:  candidate.logLoss <= production.logLoss + maxLogLossRegression (0.02)
            candidate.ece     <= production.ece     + maxEceRegression     (0.02)
```

Chroni przed: `production logLoss=0.20/ECE=0.03`, `candidate 0.30/0.04` z `AUC +0.02` → przy samych progach absolutnych (max 0.40/0.10) kandydat przeszedłby mimo wyraźnej regresji.

**ZASADA braku regresji:** NIE wdrażać, jeśli dowolna krytyczna metryka istotnie się pogorszyła, nawet gdy ROC-AUC wzrósł:

```
AUC +0.015 ✓ | PR-AUC +0.020 ✓ | LogLoss +0.001 ✓ | ECE +0.08 ✗  →  brak deploy
```

`bestAuc` historyczny tylko jako kontekst w runie (`comparedAgainstVersion` = aktualny PRODUCTION). Antychatter: margines 0.01 — niewielkie wahania nie wywołują deploy/rollback.

Niespełnienie → `FAILED_VALIDATION` + model zostaje REJECTED bez wdrożenia (spójnie z sekcją Statusy treningu i 2.5).

### 2.4 Drift — monitoring wszystkich 29 cech, top-5 tylko prezentacja

- **Monitoring**: wszystkie 29 cech — PSI lub Δśrednich vs baseline modelu. Baseline rozkładów = histogramy liczone z datasetu treningowego przy treningu, zapisane w `AiModel.featureDistributions` (JSON bins+counts). Żadna cecha nie wypada z monitoringu przy zmianie top-features.

**Źródło baseline:** histogramy `featureDistributions` liczone **wyłącznie z TRAIN**, nigdy z validation/test — baseline driftu nie może być skażony danymi spoza treningu.

**Polityka PSI per typ cechy:**

```
numeric                   → fixed bins + PSI
categorical/binary/one-hot → category frequency PSI
invalid/NaN                → osobna kategoria (albo rekord odrzucony — zapisane w metryce)
```

- **Prezentacja**: top-5 najbardziej zmienionych cech (lub top-5 z `computeFeatureImportance`) w dashboardzie.
- **Prediction drift**: dzienny mean score w oknie.
- **Label drift**: delta acceptance rate (poprzedni vs bieżący okres).

Endpoint `GET /ai/drift` + sekcja w dashboardzie.

### 2.5 State machine (jasna semantyka)

**Rozróżnienie dwóch osi (nie mylić):**

- `TrainingRun.status` = wynik **procesu treningowego** (`RUNNING/SUCCESS/SKIPPED/FAILED_*`).
- `AiModel.state` = **cykl życia modelu** (`CANDIDATE/APPROVED/PRODUCTION/REJECTED/ROLLED_BACK`).

```
TrainingRun.status = FAILED_VALIDATION ──► AiModel.state = REJECTED
```

`ModelRegistry.ts` + `AiModel.state`:

```
CANDIDATE  → (przeszedł walidację)  →  APPROVED  → (promote)  →  PRODUCTION
    │                                                                  │
    └── REJECTED  (nie przeszedł walidacji)                    ROLLED_BACK
```

- `CANDIDATE` — wyprodukowany przez trening, NIE wpływa na ranking.
- `APPROVED` — przeszedł walidację/guardraile, może być wdrożony.
- `PRODUCTION` — aktywny, `active=true`, służy do predict/rank.
- `REJECTED` — nie spełnił guardrail.
- `ROLLED_BACK` — był PRODUCTION, zdegradowany.

**Implementacja:** `state` jako `String` + centralna stała TS `AiModelState` (zgodnie z konwencją schema — projekt celowo nie używa Prisma enum; pola statusowe to `String`: `AiFeature.label`, `aiRewardLog.action` itd.). Guard walidacji wartości przy zapisie (nieznana wartość → odrzuć/błąd).

Legacy `active=true` → `PRODUCTION`. Auto-deploy tworzy CANDIDATE; przejście do PRODUCTION przez `POST /ai/models/:id/promote` (ręczne) lub automat po przejściu threshold. `rollbackToPrevious` ustawia `ROLLED_BACK`.

**Ręczny override = jawna operacja admina (audytowalna):** `REJECTED` → `APPROVED` wyłącznie przez `POST /ai/models/:id/approve`, z `deploymentReason` + admin action + timestamp zapisanymi w `AiTrainingRun`/`AiModel.notes` i audit logu. Żadnego cichego "albo CANDIDATE do ręcznej oceny" — każda zmiana stanu ma ślad.

**Globalny invariant — nigdy więcej niż jeden PRODUCTION:**

```
COUNT(AiModel WHERE state = 'PRODUCTION') <= 1
COUNT(AiModel WHERE active = true)        <= 1
```

Przejście `APPROVED → PRODUCTION` **atomowe** (istniejący wzorzec `$transaction` w `ModelRegistry` — rozszerzyć o `state`):

```
BEGIN TRANSACTION
  old PRODUCTION → ROLLED_BACK (active=false)
  candidate      → PRODUCTION  (active=true)
  pozostałe active → false (synchronizacja)
COMMIT
```

### 2.6 Shadow mode

Candidate może liczyć score w `predict/batch` bez wpływu na ranking. `wells_ai_influence=0` już działa jako shadow. Statystyki shadow (shadowAuc/logLoss candidate vs production) w `/ai/drift`. `AiTrainingRun` opisuje **trening**, shadow opisuje **predykcje produkcyjne** — to osobne zakresy; pełny shadow tracker dopiero gdy pojawią się dane (YAGNI teraz).

## Faza 3 — P2: API, UX, docs

### 3.1 Endpointy (`telemetryAiMl.ts`)

`GET /ai/training/runs`, `GET /ai/training/runs/:id`, `GET /ai/models/:id`, `POST /ai/models/:id/promote`, `POST /ai/models/:id/approve` (ręczny override REJECTED→APPROVED), `GET /ai/drift`, `GET /ai/predictions/stats`. Wszystkie admin-only + `READ_LIMITER`/`WRITE_LIMITER`.

### 3.2 Dashboard

`mlHealthDashboard.js` + `aiDashboard.js`:

- karty PR-AUC / F1 / LogLoss / ECE (Calibration);
- baseline `Baseline vs Model +X.X pp`;
- tabela ostatnich `AiTrainingRun` (20) ze statusem SKIPPED (bez szumu "FAILED_DATA") + zakres datasetu (`datasetStartAt`→`datasetEndAt`) i `datasetFingerprint`;
- sekcja drift: feature (top-5 zmienionych) / prediction / label;
- przyciski promote / rollback per model.

### 3.3 Docs

`SelfEvaluation + RewardCalculator` → **feedback-based learning**, nie reinforcement learning (brak state/action/policy/update rule). Poprawić w `docs/ARCHITECTURE.md`, `README.md`, `CLAUDE.md`.

### 3.4 Ograniczenia `POST /ai/train`

Min-interval + max-duration (config). Administrator nie może uruchomić serii treningów w kilka sekund.

## Etapy implementacji (małe kroki, testy między etapami)

1. **ETAP 1** — `AiTrainingRun` + migracja + testy zapisu runu; typecheck.
2. **ETAP 2** — split 70/15/15 + guardy rozmiarów + testy determinizmu i leakage (`featureLeakage.test.ts`).
3. **ETAP 3** — guardraile numeryczne (NaN/Inf/loss divergence) + timeout + lock; testy.
4. **ETAP 4** — `metrics.ts` (PR-AUC/LogLoss/Brier/ECE/confusion) + testy matematyczne (edge cases: empty, one class, perfect, worst, all-0, all-1, NaN, Infinity, length mismatch — zwłaszcza PR-AUC/ECE/LogLoss).
5. **ETAP 5** — baseline + guardrail deploy (porównanie z PRODUCTION).
6. **ETAP 6** — drift: feature baseline (histogramy w AiModel), prediction drift, label drift.
7. **ETAP 7A** — state machine (lifecycle/deployment control) + **7B** — shadow (production evaluation). Dwa osobne problemy, osobne testy/rollback.
8. **ETAP 8** — API + dashboard + docs.

## Pliki dotknięte

- `prisma/schema.prisma` + migracja `20260816000000_ai_training_run`
- `src/services/ml/TrainingPipeline.ts`, `ModelRegistry.ts`, `AcceptanceModel.ts`
- `src/services/ml/metrics.ts` (nowy)
- `src/services/ml/trainingConfig.ts`, `src/config/mlConstants.ts`
- `src/services/ml/SelfEvaluation.ts`, `predictionCache.ts`
- `src/routes/telemetryAiMl.ts`
- `src/utils/cronService.ts`
- `public/js/admin/aiDashboard.js`, `mlHealthDashboard.js`
- Testy: `tests/ml/metrics.test.ts` (nowy), `tests/ml/featureLeakage.test.ts` (nowy), rozszerzenia `tests/ml/TrainingPipeline.test.ts`, `tests/ml/ModelRegistryPrune.test.ts`
- Docs: `docs/ARCHITECTURE.md`, `README.md`, `CLAUDE.md`

## Weryfikacja

- `npm run typecheck`, `npm run typecheck:frontend`
- `npm run lint`, `npm run lint:frontend`
- `npm test` (testy ML: `tests/ml/*`)
- `npm run format`
- `npm run version:check` (obowiązkowo przed commit/push)
- `node -c` dla zmienionych plików w `public/js/`
- `npm run ai:setup` po migracji (diagnostyka modułu AI/ML)
- Migracja: `npm run prisma:migrate` (dev) / `npm run prisma:deploy` (prod)

## Świadome uproszczenia (`ponytail:`)

- **Cache prediction — bez zmiany**: inwalidacja przy każdej zmianie modelu jest prostsza i poprawna niż `modelVersion` w kluczu.
- **Leakage — dokument + 1 test regresyjny**, bez metadanych `FeatureDefinition` per-feature (29 definicji bez konsumenta = YAGNI).
- **PSI baseline — histogramy w `AiModel`** (jedna kolumna JSON z wersją formatu), nie osobna tabela.
- **Shadow — minimalny** oparty o istniejące `state` + `wells_ai_influence=0`; pełny champion/challenger dopiero gdy pojawią się dane.
