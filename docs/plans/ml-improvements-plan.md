# Plan ulepszeń systemu ML — Oferty PV

## Cel

6 ulepszeń systemu ML eliminujących błędy i dodających funkcjonalności bez regresji.

## Kolejność implementacji

1. Seed startowego modelu ML
2. Cache na batch predict
3. Natychmiastowy rollback AUC (sliding window)
4. Feature importance raport
5. Fallback technical score na froncie
6. Badge AI status w UI

---

## Zmiana 1: Seed startowego modelu ML

**Plik:** `prisma/seed.ts` (227 linii)

**Problem:** Po `npm run seed` brak modelu w AiModel → endpoint predict zwraca 503 "No active model".

**Rozwiązanie:** Dodaj insert do AiModel z domyślnymi wagami (wszystkie 0, bias 0, aktywowany).

**Miejsce w kodzie:** Po linii 210 (za `});` kończącym transakcję), przed logami końcowymi (L212-217). Dodaj import crypto na górze pliku (L1-3).

**Kod do dodania (L210-211, przed `console.log(\`Seed: zakonczono...\`)`):**

```typescript
// ── AiModel (startowy model ML) ──
console.log('  -> AiModel (startowy model ML)...');
const existingAiModel = await prisma.aiModel.count();
if (existingAiModel === 0) {
    const FEATURE_NAMES_SEED = [
        'dn',
        'heightMm',
        'warehouse_KLB',
        'warehouse_WL',
        'wellType_standard',
        'wellType_psia_buda',
        'wellType_styczna',
        'hasReduction',
        'hasPsiaBuda',
        'ringCount',
        'connectionCount',
        'transitionsAboveDennica',
        'totalPrice',
        'totalWeight',
        'ringVariety',
        'season_num',
        'hasKnownBottom',
        'hasKnownTop',
        'dn_x_ringCount',
        'isKLBstandard'
    ];
    const zeros20 = Array(20).fill(0);
    const ones20 = Array(20).fill(1);
    await prisma.aiModel.create({
        data: {
            id: 'seed_' + Date.now(),
            version: 'v0.1.0-starter',
            weights: JSON.stringify(zeros20),
            bias: 0,
            metrics: JSON.stringify({
                accuracy: 0.5,
                precision: 0.5,
                recall: 0.5,
                f1: 0.5,
                rocAuc: 0.5,
                trainSize: 0,
                valSize: 0
            }),
            features: JSON.stringify(FEATURE_NAMES_SEED),
            featureMins: JSON.stringify(zeros20),
            featureMaxs: JSON.stringify(ones20),
            trainingRows: 0,
            active: true,
            notes: 'Model startowy — domyślne wagi (neutralne). Wytrenuj właściwy model przez API /ai/train.',
            createdAt: new Date().toISOString()
        }
    });
}
```

**Log końcowy (po L217 `console.log(\` PrecoZakresy...\`)`):**

```typescript
console.log(`  AiModel: ${existingAiModel === 0 ? '1 (startowy)' : existingAiModel}`);
```

**Ryzyko:** Niskie. Sprawdzamy `existingAiModel === 0` — nie zduplikuje się. `id: 'seed_' + Date.now()` nie wymaga crypto.

---

## Zmiana 2: Cache na batch predict

**Plik:** `src/routes/telemetryAiMl.ts` (454 linie)

**Problem:** Batch predict (L146-207) nie używa serwerowego cache. Single predict (L109-144) używa `predictionCache`.

**Rozwiązanie:** W handlerze batch predict, dla każdego kandydata sprawdź cache przed predykcją.

**Miejsce w kodzie:** Handler POST /ai/predict/batch, linie 182-198 (tworzenie modelu + mapowanie wyników).

**Zastąpić L182-198:**

```typescript
const model = new AcceptanceModel(
    activeModel.weights.length,
    activeModel.weights,
    activeModel.bias
);

const scores = candidates.map((c) => {
    const key = cacheKey(c.features, c.wellType, c.warehouse, c.dn);
    const cached = predictionCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return {
            id: c.id,
            score: cached.result[0].score,
            version: cached.result[0].version,
            featureVersion: featureVersion || 'unknown',
            cached: true
        };
    }

    const score = model.predict(
        normalizeFeatures(c.features, activeModel.featureMins, activeModel.featureMaxs)
    );
    const result = {
        id: c.id,
        score: parseFloat(score.toFixed(4)),
        version: activeModel.version,
        featureVersion: featureVersion || 'unknown'
    };
    setCache(key, {
        result: [{ score: result.score, version: result.version }],
        timestamp: Date.now()
    });
    return result;
});

res.json({ scores });
```

**Ryzyko:** Średnie. Odpowiedź cache hita zawiera dodatkowe pole `cached: true` — frontend je ignoruje. `cached.result[0]` ma `{score, version}`, więc `featureVersion` jest dodawane osobno.

---

## Zmiana 3: Natychmiastowy rollback AUC (sliding window)

**Pliki:** `src/services/ml/SelfEvaluation.ts`, `src/routes/telemetryAiMl.ts`

**Problem:** SelfEvaluation sprawdza AUC raz dziennie (L46-59) → 24h zanim zły model zostanie wycofany.

**Rozwiązanie:** Sliding window ostatnich 200 predykcji, sprawdzany po każdym batchu.

### SelfEvaluation.ts (65 linii)

**Dodać po L7 (importy), przed klasą:**

```typescript
// ponytail: duplicate of TrainingPipeline.computeRocAuc
function computeSlidingRocAuc(scores: number[], labels: number[]): number {
    const n = scores.length;
    if (n < 2) return 0.5;
    const pairs = scores.map((s, i) => ({ score: s, label: labels[i] }));
    pairs.sort((a, b) => b.score - a.score);
    let pos = 0,
        neg = 0;
    for (const p of pairs) {
        if (p.label === 1) pos++;
        else neg++;
    }
    if (pos === 0 || neg === 0) return 0.5;
    let rankSum = 0;
    for (let i = 0; i < n; i++) {
        if (pairs[i].label === 1) rankSum += i + 1;
    }
    return (rankSum - (pos * (pos + 1)) / 2) / (pos * neg);
}
```

**Dodać pola w klasie SelfEvaluation (po L9 `private lastRunAt: number = 0;`):**

```typescript
private slidingWindow: Array<{ label: number; score: number }> = [];
private readonly SLIDING_WINDOW_SIZE = 200;
```

**Dodać metody (przed L65 `export const selfEvaluation...`):**

```typescript
recordPredictionResult(actualLabel: number, predictedScore: number): void {
    this.slidingWindow.push({ label: actualLabel, score: predictedScore });
    if (this.slidingWindow.length > this.SLIDING_WINDOW_SIZE) {
        this.slidingWindow.shift();
    }
}

async checkAndRollbackIfNeeded(): Promise<{ rolledBack: boolean; slidingAuc: number | null }> {
    const window = this.slidingWindow;
    if (window.length < 10) {
        return { rolledBack: false, slidingAuc: null };
    }

    const scores = window.map((w) => w.score);
    const labels = window.map((w) => w.label);
    const slidingAuc = computeSlidingRocAuc(scores, labels);

    if (slidingAuc < ML_CONFIG.rollbackAucThreshold) {
        logger.warn(
            'SelfEvaluation',
            `Sliding AUC=${slidingAuc.toFixed(4)} < ${ML_CONFIG.rollbackAucThreshold} — auto-rollback`
        );
        const previous = await modelRegistry.rollbackToPrevious();
        if (previous) {
            logger.info('SelfEvaluation', `Auto-rollback do ${previous.version}`);
            this.slidingWindow = [];
            return { rolledBack: true, slidingAuc };
        }
    }
    return { rolledBack: false, slidingAuc };
}
```

### telemetryAiMl.ts

**Dodać import (przy L6-7):**

```typescript
import { selfEvaluation } from '../services/ml/SelfEvaluation';
```

**W handlerze batch predict, PO L200 `res.json({ scores });` dodać:**

```typescript
// Fire-and-forget — nie blokuje odpowiedzi
selfEvaluation.checkAndRollbackIfNeeded().catch((e) => {
    logger.error(
        'AiPredictBatchRoute',
        `Sliding AUC check failed: ${e instanceof Error ? e.message : String(e)}`
    );
});
```

**W handlerze POST /ai/reward, PO L234 `await rewardCalculator.processAction(...)` dodać:**

```typescript
// Rejestruj wynik predykcji dla sliding AUC
if (data.wasAiRanked && data.scoreBefore !== undefined) {
    const label = data.action === 'ACCEPT' ? 1 : 0;
    selfEvaluation.recordPredictionResult(label, data.scoreBefore);
}
```

**Ryzyko:** Niskie. `checkAndRollbackIfNeeded()` jest fire-and-forget. Sliding window resetuje się przy restarcie serwera (OK).

---

## Zmiana 4: Feature importance raport

**Pliki:** `src/services/ml/ModelRegistry.ts`, `src/routes/telemetryAiMl.ts`

**Problem:** Brak informacji które cechy (cena? waga?) mają największy wpływ na decyzje AI.

**Rozwiązanie:** importance = |weight[i]| * (featureMaxs[i] - featureMins[i]), endpoint GET.

### ModelRegistry.ts

**Dodać metodę w klasie (po L120 `getModelCount()`, przed L122 `private recordToModel`):**

```typescript
computeFeatureImportance(activeModel: StoredModel): Array<{ featureName: string; importance: number }> {
    const importances = activeModel.weights.map((w, i) => ({
        featureName: activeModel.features[i] || `feature_${i}`,
        importance: Math.abs(w) * (activeModel.featureMaxs[i] - activeModel.featureMins[i])
    }));
    importances.sort((a, b) => b.importance - a.importance);
    return importances;
}
```

### telemetryAiMl.ts

**Dodać handler przed GET /ai/feature-schema (przed L431):**

```typescript
router.get('/ai/feature-importance', requireAuth, async (_req: Request, res: Response) => {
    try {
        const activeModel = await modelRegistry.getActiveModel();
        if (!activeModel) {
            res.status(503).json({ error: 'No active model' });
            return;
        }
        const importances = modelRegistry.computeFeatureImportance(activeModel);
        res.json({
            modelVersion: activeModel.version,
            features: importances
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        res.status(500).json({ error: msg });
    }
});
```

**Ryzyko:** Bardzo niskie. Czysto dodawczy kod. Jeśli features[i] nie istnieje → fallback `feature_${i}`.

---

## Zmiana 5: Fallback technical score

**Plik:** `public/js/studnie/mlDualRanking.js` (808 linii)

**Problem:** Przy timeout/error AI (L338-379), wszystkie wyniki = -1 → shadow mode. Zamiast tego użyj technicalScore jako fallback.

**Rozwiązanie:** W `fetchAiScoresBatch()` (L290-383), zamiast setować -1, normalizuj technicalScore do [0,1].

**Miejsce w kodzie:** Funkcja `fetchAiScoresBatch`, linie 290-383.

**Po L293 (`await resolveFeatureVersion();`) dodać:**

```javascript
var maxTechScore = 0;
for (var ti = 0; ti < candidates.length; ti++) {
    if (candidates[ti].technicalScore > maxTechScore) {
        maxTechScore = candidates[ti].technicalScore;
    }
}
if (maxTechScore === 0) maxTechScore = 1;
```

**Zamienić 4 bloki `-1` na fallback:**

Blok 1 (L340-344, response !ok):

```javascript
if (!res.ok) {
    mlOnline = false;
    for (var j = 0; j < toFetch.length; j++) {
        var ts = candidates.find(function (c) {
            return c.id === toFetch[j].id;
        });
        var fallbackScore = ts ? 1 - ts.technicalScore / maxTechScore : -1;
        resultMap.set(toFetch[j].id, fallbackScore);
    }
    return resultMap;
}
```

Blok 2 (L364-368, fill missing):

```javascript
for (var l = 0; l < toFetch.length; l++) {
    if (!resultMap.has(toFetch[l].id)) {
        var ts = candidates.find(function (c) {
            return c.id === toFetch[l].id;
        });
        var fallbackScore = ts ? 1 - ts.technicalScore / maxTechScore : -1;
        resultMap.set(toFetch[l].id, fallbackScore);
    }
}
```

Blok 3 (L370-373, no scores):

```javascript
} else {
    mlOnline = false;
    for (var m = 0; m < toFetch.length; m++) {
        var ts = candidates.find(function (c) { return c.id === toFetch[m].id; });
        var fallbackScore = ts ? 1 - (ts.technicalScore / maxTechScore) : -1;
        resultMap.set(toFetch[m].id, fallbackScore);
    }
}
```

Blok 4 (L375-379, catch):

```javascript
} catch (e) {
    mlOnline = false;
    for (var n = 0; n < toFetch.length; n++) {
        var ts = candidates.find(function (c) { return c.id === toFetch[n].id; });
        var fallbackScore = ts ? 1 - (ts.technicalScore / maxTechScore) : -1;
        resultMap.set(toFetch[n].id, fallbackScore);
    }
}
```

**Ryzyko:** Średnie. Zmiana semantyki błędu: z -1 na score. Frontend w `rankCandidates` (L480-482) sprawdza `aiScore < 0` — fallback score jest zawsze >= 0, więc wejdzie w gałąź AI zamiast czystego technical.

---

## Zmiana 6: Badge AI status

**Plik:** `public/js/studnie/mlDualRanking.js` (808 linii)

**Problem:** User nie wie czy ML działa. Obecny badge (L670-712) pokazuje "AI X%" lub "AI Shadow" lub "AI Offline".

**Rozwiązanie:** W `updateAiStatusIndicator()` (L670-712) zmień kolory i tekst.

**Zastąpić L677-706:**

```javascript
if (status.online) {
    dot.style.background = '#10b981';
    dot.style.boxShadow = '0 0 4px #10b981';
    text.textContent = 'AI v' + (status.modelVersion || '?');
    title =
        'AI online — model ' +
        (status.modelVersion || '?') +
        ' | wplyw ' +
        status.aiInfluencePct +
        '%' +
        ' | ranking ' +
        status.rankingVersion +
        ' | feat ' +
        status.featureVersion;
} else {
    dot.style.background = '#ef4444';
    dot.style.boxShadow = 'none';
    text.textContent = 'AI offline';
    title = 'Brak wytrenowanego modelu ML — ranking techniczny';
}
```

**Tooltip (zawsze ten sam suffix):**

```javascript
text.title = title + '\nKliknij Auto, aby uruchomic solver z AI rankingiem';
```

**Ryzyko:** Niskie. Zmiana wizualna. `fetchLearningStatusAsync()` jest wołany poza if/else (L711), więc działa zawsze.

---

## Ryzyka regresji

| Ryzyko                                                                | Prawdopodobieństwo | Mitigacja                                                                                  |
| --------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------ |
| Seed tworzy model startowy z active:true, ale kod zakłada brak modelu | Niskie             | getActiveModel() już obsługuje null (L79-83 ModelRegistry)                                 |
| Batch predict cache dodaje `cached: true` w odpowiedzi                | Niskie             | Frontend ignoruje nieznane pola JSON                                                       |
| Duplicate computeRocAuc w SelfEvaluation i TrainingPipeline           | Niskie             | Oznaczono `// ponytail: duplicate`                                                         |
| Fallback technical score zmienia semantykę błędu z -1 na score        | Średnie            | rankCandidates L480-482: `aiScore < 0` → fallback. Z fallback score >=0 wejdzie w gałąź AI |
| Badge zmienia "AI Shadow" na "AI v{version}"                          | Niskie             | Tooltip nadal pokazuje influence%                                                          |

## Testy (sugerowane)

| Zmiana | Test                                                               |
| ------ | ------------------------------------------------------------------ |
| 1      | Sprawdź że `prisma.aiModel.count() === 1` po seedzie               |
| 2      | Dwa razy ten sam batch predict — drugi ma `cached: true`           |
| 3      | `checkAndRollbackIfNeeded` wywołuje rollback gdy AUC < 0.65        |
| 4      | GET /ai/feature-importance zwraca 200 z listą, importance malejąco |
| 5      | Mock fetch z błędem → sprawdź że score !== -1                      |
| 6      | Wizualna weryfikacja kolorów i tekstu w UI                         |
| -      | `node -c public/js/studnie/mlDualRanking.js` po zmianach frontendu |
