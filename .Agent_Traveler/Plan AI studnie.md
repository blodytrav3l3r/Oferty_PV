# Plan AI studnie — Kompletny system Machine Learning

## Cel

Zamienic obecny system telemetrii w prawdziwy system ML, ktory uczy sie na rzeczywistych danych historycznych, przewiduje akceptacje uzytkownika i wplywa na ranking generowanych konfiguracji studni.

## Architektura docelowa (prawdziwa petla ML)

Telemetria (konfiguracje + decyzje uzytkownika)
|
V
Feature Extraction (wektor cech per konfiguracja)
|
V
Feature Store (ai_features)
|
V
Training Dataset (z labelami i reward)
|
V
ML Training (Logistic Regression / XGBoost)
|
V
Model Registry (ai_models)
|
V
Prediction API (publiczny endpoint /ai/predict)
|
V
Solver JS + Python (dual-ranking: Technical x AI)
|
V
Decyzja uzytkownika -> Reward Signal
|
V
Nowa telemetria -> zamkniecie petli

## Problem z obecnym systemem

Obecnie system dziala jak adaptacyjny silnik regul (rule engine), a nie ML:

| Problem     | Obecnie                                  | Powinno byc                                        |
| ----------- | ---------------------------------------- | -------------------------------------------------- |
| Dane        | Patterny (substitution, confidence 0.85) | Wektory cech (dn, height, warehouse...)            |
| Model       | Brak modelu, tylko reguly                | Logistic Regression / XGBoost                      |
| Ranking     | score + bonus - kara                     | Dual-ranking: Technical Score x Accept Probability |
| Uczenie     | confidence++                             | Reinforcement: reward = f(decyzja uzytkownika)     |
| Ewaluacja   | Admin patrzy na dashboard                | A/B testing: model Challenger vs Champion          |
| Zapominanie | Brak                                     | Exponential decay                                  |

## Stack technologiczny

| Element     | Technologia                      | Uzasadnienie                         |
| ----------- | -------------------------------- | ------------------------------------ |
| Backend API | Node.js + Express                | Istniejacy stack                     |
| Baza danych | SQLite (Prisma)                  | Istniejaca, wystarczajaca            |
| Model ML v1 | Logistic Regression w TypeScript | Samowystarczalny, dziala bez Pythona |
| Model ML v2 | XGBoost via ONNX (opcjonalny)    | Gdy potrzeba wiekszej mocy           |
| Pipeline    | Cron (node-cron)                 | Co 15 min                            |
| Frontend    | Vanilla JS                       | Istniejacy stack                     |

Dlaczego nie Python?

- Nie chcemy wymuszac uruchomionego serwisu Python (port 8000)
- Express ma dzialac nawet gdy Python jest offline
- Logistic Regression to ~200 linii TypeScript

## Nowa tabela: AiFeature (Feature Store)

model AiFeature {
id String @id @default(cuid())
telemetryId String? // FK -> ai_telemetry_logs
dn Int
heightMm Int
warehouse String // KLB | WL
wellType String // standard | psia_buda | styczna
hasReduction Boolean
hasPsiaBuda Boolean
hasStyczna Boolean
ringCount Int
bottomType String
topType String
connectionCount Int
transitionsAboveDennica Int
totalPrice Float
totalWeight Float
ringVariety Float // Shannon entropy kregow
season String // winter | spring | summer | autumn
label String // ACCEPTED | REJECTED | MODIFIED
reward Float // -1.0 to +1.0
createdAt DateTime @default(now())
@@index([dn, warehouse, wellType])
@@index([createdAt])
}

## Feature Extraction

Kazda konfiguracja (z telemetryRecordConfig) -> wektor cech FeatureVector:

interface FeatureVector {
dn: number; // 1000, 1200, 1500...
heightMm: number; // 2500, 3000...
warehouse: string; // KLB | WL
wellType: string; // standard | psia_buda | styczna
hasReduction: boolean; // czy z redukcja
hasPsiaBuda: boolean;
hasStyczna: boolean;
ringCount: number; // liczba kregow
bottomType: string; // np. D-1200-300
topType: string; // np. KONUS-1200-1500
connectionCount: number; // liczba przejsc szczelnych
transitionsAboveDennica: number;
totalPrice: number; // cena calkowita [PLN]
totalWeight: number; // waga [kg]
ringVariety: number; // Shannon entropy roznorodnosci kregow [0-1]
season: string; // winter | spring | summer | autumn
label: ACCEPTED | REJECTED | MODIFIED;
reward: number; // -1.0 to +1.0
}

## Model ML v1: AcceptancePredictor (Logistic Regression w TypeScript)

class AcceptanceModel {
private weights: number[];
private bias: number;

sigmoid(z: number): number {
return 1 / (1 + Math.exp(-zustr.- Sigmoid
}

predict(features: number[]): number {
const z = features.reduce((sum, f, i) => sum + f * this.weights[i], 0) + this.bias;
return this.sigmoid(z); // zwraca P(accepted | features) w [0, 1]
}

train(dataset: TrainingExample[], learningRate: number, epochs: number): void {
// Batch gradient descent
for (let epoch = 0; epoch < epochs; epoch++) {
for (const example of dataset) {
const prediction = this.predict(example.features);
const error = example.label - prediction;
for (let i = 0; i < this.weights.length; i++) {
this.weights[i] += learningRate * error * example.features[i];
}
this.bias += learningRate * error;
}
}
}
}

### Rejestracja modelu: tabela AiModel

model AiModel {
id String @id @default(cuid())
version String @unique // np. v1.2.0-20260707
weights Float[] // wagi modelu (serializobjsizacja)
bias Float
metrics Json // { accuracy, precision, recall, f1, roc_auf }
features String[] // nazwy cech (kolejnosc)}
isActive Boolean // tylko jeden model moze byc aktywn} createdAt DateTime @default(now())
}

## Training Pipeline

Uruchamiany co 15 minut (cron) lub na zadanie admina.

1. Fetch unlabeled telemetry (rekordy bez feature vector)
2. Extract features -> AiFeature
3. Join z outcome (ACCEPTED / REJECTED / MODIFIED)
4. Calculate reward per example
5. Normalizacja (z-score)
6. Split: train 80% / validation 20%
7. IF train.length < 100 -> SKIP (za malo danych)
8. Train AcceptanceModel (learningRate=0.01, epochs=5000)
9. Validate: accuracy, precision, recall, F1, ROC-AUC
10. Compare with ACTIVE model:
    IF newAUC > oldAUC + 0.05 -> DEPLOY (isActive=true, starego isActive=false)
    ELSE -> LOG, zatrzymaj
11. Save model -> AiModel registry

### Zapominanie (Forgetting)

Podczas training - starsze przyklady maja mniejsza wage:

function applyForgetting(exampleAgeDays: number): number {
const lambda = 0.01; // polowa zycia ~ 69 dni
return Math.exp(-lambda * exampleAgeDays);
}

// W loss function:
const weightedLoss = baseLoss * applyForgetting(ageDays);

## Dual-Ranking: Technical x AI

Technical Score w [0, 100]
(base scoring: completeness, cost, rules, count)
AI Score = P(accepted | features) w [0, 1]
Final Score = alpha * Technical Score + beta * AI Score * 100
Gdzie: alpha = 0.6, beta = 0.4

### Przyklad:

| Wariant | Technical | AI (P) | Final (0.6*T + 0.4*P*100) |
| ------- | --------- | ------ | ------------------------- |
| A       | 95        | 0.94   | 0.6*95 + 0.4*94 = 94.6    |
| B       | 92        | 0.72   | 0.6*92 + 0.4*72 = 84.0    |
| C       | 85        | 0.34   | 0.6*85 + 0.4*34 = 61.6    |

## Reinforcement Learning (Reward Signals)

Kazda decyzja uzytkownika generuje reward (-1.0 do +1.0):

| Decyzja uzytkownika                       | Reward       | Uzasadnienie                    |
| ----------------------------------------- | ------------ | ------------------------------- |
| Zaakceptowal bez zmian                    | +1.0         | Idealne dopasowanie             |
| Zaakceptowal po drobnej edycji (<2 prod.) | +0.2         | Dobra baza, drobne poprawki     |
| Zmodyfikowal istotnie (>=2 produkty)      | -0.3         | Blad w doborze                  |
| Recznie nadpisal (MANUAL)                 | -0.5         | AI nie zrozumialo               |
| Usunal studnie                            | -1.0         | Totalny blad                    |
| Czas < 30s                                | +0.1 bonus   | Szybka akceptacja = zadowolenie |
| Czas > 5min                               | -0.1 penalty | Wahanie = problem               |

## Exploration (Eksploracja vs Eksploatacja)

IF random() < 0.05:
// Eksploracja - losowo z top-3 wariantow
return weightedRandomChoice(top3Variants)
ELSE:
// Eksploatacja - najlepszy znany wariant
return bestVariant

## Hierarchia modeli (Multi-level)

Gdy brakuje danych na konkretnym poziomie, fallback do poziomu wyzszego:
+- GLOBAL (fallback dla wszystkiego)
+- Region / Warehouse
+- Well Type (standard, psia_buda, styczna)
+- DN (1200, 1500, 2000...)
+- Client
+- Project (najbardziej specyficzne)

Prog per poziom: min 30 przykladow treningowych, inaczej fallback.

## API Prediction

### Request

POST /api/telemetry/ai/predict
Content-Type: application/json

{
"variants": [
{
"variantIndex": 0,
"features": {
"dn": 1200,
"heightMm": 2500,
"warehouse": "KLB",
"wellType": "psia_buda",
"hasReduction": true,
"ringCount": 3
}
}
]
}

### Response

{
"predictions": [
{
"variantIndex": 0,
"acceptanceProbability": 0.94,
"technicalScore": 95,
"aiScore": 94.0,
"finalScore": 94.6,
"selected": true
}
],
"modelVersion": "v3.2.1-20260707",
"modelConfidence": 0.82,
"exploration": false,
"fallbackLevel": "dn"
}

## Samoocena (Self-Evaluation)

### A/B Testing per model version

| Model               | Acceptance Rate | Decision   |
| ------------------- | --------------- | ---------- |
| v3.2.0 (champion)   | 73%             | -          |
| v3.2.1 (challenger) | 71%             | X Rollback |
| v3.3.0 (challenger) | 78%             | Y Deploy   |

### Daily Cron (co 24h)

1. Acceptance rate per DN / warehouse / wellType
2. Model drift - czy feature distribution sie zmienilo?
3. Feature importance - ktore cechy maja najwiekszy wplyw?
4. Underperforming segments - ktory DN/warehouse/type ma najnizszy acceptance?
5. Alert thresholds:
    - < 70% acceptance rate -> email/notification do admina
    - < 0.65 ROC-AUC -> auto-rollback do poprzedniego modelu

## Fazy implementacji

### FAZA 1: Feature Store & Feature Extraction (4h)

- prisma/schema.prisma - nowa tabela AiFeature
- src/services/ml/FeatureExtractor.ts - ekstrakcja cech
- Test: kazda telemetryRecordConfig tworzy rekord w AiFeature

### FAZA 2: AcceptancePredictor Model (6h)

- src/services/ml/AcceptanceModel.ts - Logistic Regression
- src/services/ml/ModelRegistry.ts - CRUD dla AiModel
- Test: model przewiduje z 70%+ accuracy

### FAZA 3: Training Pipeline (4h)

- src/services/ml/TrainingPipeline.ts - cron co 15 min
- Normalizacja, train/validation split, gradient descent, validation metrics
- Test: pipeline uruchamia sie bez bledow, model deployuje gdy lepszy

### FAZA 4: Prediction API (2h)

- src/routes/ - POST /api/telemetry/ai/predict
- Cache 15 min
- Test: response < 100ms

### FAZA 5: Dual-Ranking w Solverze (4h)

- public/js/studnie/wellConfigRules.js - scoreLayout() z aiScore
- public/js/studnie/wellSolver.js - batch fetch prediction przy solve()
- 5% exploration (weighted random z top-3)
- Test: solver uwzglednia AI score w rankingu

### FAZA 6: Reward Signals (3h)

- src/services/ml/RewardCalculator.ts - obliczanie reward per action
- Integracja z wellActions.js (add/remove/qty_change/swap)
- Test: kazda decyzja uzytkownika generuje poprawny reward

### FAZA 7: Samoocena (4h)

- src/services/ml/SelfEvaluation.ts - daily cron A/B testing
- Alerting (email/notification) przy degradacji
- Auto-rollback gdy ROC-AUC < 0.65
- Test: system wykrywa gorszy model i rollbackuje

### FAZA 8: Dashboard Admina (2h)

- public/js/admin/2 - statystyki: acceptance rate, top features, model history
- Trigger manualny: retrain model

## Kryteria akceptacji ogolne

1. Zero regressji - system dziala bez ML (fallback do base scoring)
2. Samowystarczalnosc - nie wymaga Pythona (port 8000) do dzialania
3. Performance - prediction < 100ms (batch), cache 15 min
4. Privacy - Prediction API zwraca TYLKO scores, NIE surowe dane
5. Observability - logowanie przy kazdym kroku ML
6. Testowalnosc - unit testy dla AcceptanceModel, FeatureExtractor, RewardCalculator

Dokument stworzony: 2026-07-07
Wersja: 1.0
Autor: AI Assistant
