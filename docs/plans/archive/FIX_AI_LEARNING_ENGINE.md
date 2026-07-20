# PLAN NAPRAWY — AI/ML Learning Engine (v3)

## Diagnoza

LearningEngine nie wykrywa wzorców, bo żaden rekord w `ai_telemetry_logs` nie spełnia warunku:

```ts
// LearningEngine.ts:117
if (!rec.wasModified || !rec.final_user_config || !rec.original_auto_config) continue;
```

### 3 niezależne blokady

| #     | Blokada                                                        | Przyczyna                                                                           |
| ----- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **A** | `original_auto_config` i `final_user_config` nie są zapisywane | `recordConfig()` pomija te pola w create telemetry_logs                             |
| **B** | `wasModified` nigdy nie jest `true`                            | Frontend nigdy nie wysyła `wasModified=true`, a `/override` też go nie ustawia      |
| **C** | Frontend nie wysyła danych w formacie `WellComponentSnapshot`  | `telemetryBridge.js` nie buduje pełnych snapshotów — wysyła tylko `allComponentIds` |

---

## Zasada przewodnia

**Nie zmieniamy logiki biznesowej LearningEngine.** Filtr `wasModified` pozostaje — naprawiamy źródło danych, nie modyfikujemy detektora.

`configSource` na obiekcie studni (`well`) już śledzi modyfikacje:

- `AUTO_JS` / `AUTO` — config wygenerowany automatycznie
- `MANUAL` — użytkownik ręcznie zmienił config (ustawiany w `actionsCrud.js`, `actionsDrag.js`, `actionsConfigDrag.js`)
- `MANUAL_SWAP` — użytkownik zamienił komponent (`popupsRedukcjaChoice.js`)

Wykorzystamy to do ustawienia `wasModified=true`.

---

## Plan naprawy

### Krok 1 — Backend: `telemetryService.ts` (4 linie)

**Plik:** `src/services/telemetry/telemetryService.ts`
**Miejsce:** Wewnątrz `recordConfig()`, obiekt `data` w `tx.ai_telemetry_logs.create()`, za `manualOverrideFlag` (linia 97).

**Dodać:**

```typescript
original_auto_config: payload.originalConfig && payload.originalConfig.length > 0
    ? JSON.stringify(payload.originalConfig)
    : null,
final_user_config: payload.finalConfig && payload.finalConfig.length > 0
    ? JSON.stringify(payload.finalConfig)
    : null,
```

**Uzasadnienie:** Pola istnieją w typach (`telemetryTypes.ts:121-122`) i walidacji (`telemetrySchemas.ts:133-134`). `null` zamiast `"[]"` — pusty JSON jest truthy i przechodzi filtr, ale downstream i tak nic z nim nie robi.

---

### Krok 2 — Backend: `routes/telemetry.ts` (1 linia)

**Plik:** `src/routes/telemetry.ts`
**Miejsce:** Endpoint `POST /api/telemetry/override` (linia 26), w obiekcie `data` create.

**Dodać:**

```typescript
wasModified: true,
```

**Uzasadnienie:** Endpoint `/override` jest jedynym miejscem, które otrzymuje RÓŻNE `originalConfig` i `finalConfig`. Bez tej flagi nawet override nie przechodzi filtra LearningEngine.

---

### Krok 3 — Frontend: `telemetryBridge.js` (~6 linii)

**Plik:** `public/js/studnie/telemetryBridge.js`
**Miejsce:** Wewnątrz `telemetryRecordConfig()`, przed `featureSnapshot` (linia 222).

**Dodać:**

```javascript
// Pełna lista komponentów jako WellComponentSnapshot[]
var configSnapshot = [];
for (var _i = 0; _i < configItems.length; _i++) {
    var _snap = buildComponentSnapshot(configItems[_i], studnieProducts);
    if (_snap) configSnapshot.push(_snap);
}

originalConfig: options.originalConfig || configSnapshot,
finalConfig: options.finalConfig || configSnapshot,
wasModified: options.wasModified === true,
```

**Uzasadnienie:** `buildComponentSnapshot()` (linia 59) już robi lookup w `studnieProducts` i zwraca `{productId, productName, componentType, dn, height}` — strukturę wymaganą przez `PatternDetector.detectDennicaSwap()` i `PreferenceEngine.*`. Bez tej zmiany pola `originalConfig`/`finalConfig` nie zawierają `componentType`, przez co detektory nie mogą filtrować po typie komponentu.

---

### Krok 4 — Frontend: `offerSave.js` (2 linie)

**Plik:** `public/js/studnie/offerSave.js`
**Miejsce:** Wewnątrz `_sendAcceptanceTelemetry()`, w obiekcie przekazywanym do `window.telemetryRecordConfig()` (linia 346).

**Dodać:**

```javascript
wasModified: w.configSource === 'MANUAL' || w.configSource === 'MANUAL_SWAP',
```

**Uzasadnienie:** `configSource` jest ustawiany na `MANUAL` przez wszystkie operacje modyfikujące config (`actionsCrud.js:28`, `actionsDrag.js:148`, `actionsConfigDrag.js:26`, itd.). Gdy zapis oferty wysyła telemetrię, wiemy czy config był modyfikowany.

---

### Krok 5 — Weryfikacja eksperymentalna (przed wdrożeniem w środowisku produkcyjnym)

**Cel:** Potwierdzić, że po fixie LearningEngine faktycznie wykrywa wzorce.

**Scenariusz:**

1. Wdrożyć Kroki 1-4 na środowisku testowym
2. Wygenerować kilka konfiguracji studni (Auto)
3. Zmodyfikować ręcznie config, zapisać ofertę
4. Wykonać `curl http://localhost:3000/api/telemetry/ai/learning/run` (admin)
5. Sprawdzić odpowiedź: oczekiwane `patternsDetected > 0`
6. Dashboard admina → statystyki bazy wiedzy powinny pokazać wzorce

**Oczekiwane rezultaty:**

| Typ wzorca                              | Wymagane dane                                     | Pojawi się po fixie?                                               |
| --------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------ |
| `transition_layout`                     | Struktura przejść w configu                       | ✅ Tak (nie wymaga `wasModified`)                                  |
| `reduction_choice`                      | `final_user_config`, `dn`, `wasAccepted`          | ✅ Tak (nie wymaga `wasModified`)                                  |
| `dennica_swap`                          | `originalConfig` ≠ `finalConfig`, min 3 przypadki | ⚠️ Tylko przez override lub gdy `wasModified=true` i configi różne |
| `substitution` / `addition` / `removal` | j.w.                                              | ⚠️ j.w.                                                            |

---

## Testy

### Test 1: `recordConfig()` zapisuje configi

```typescript
it('should save original_auto_config and final_user_config in telemetry_logs', async () => {
    const result = await telemetryService.recordConfig({
        solverSource: 'AUTO_JS',
        originalConfig: [{ productId: 'D-1200', componentType: 'dennica' }],
        finalConfig: [{ productId: 'D-1200', componentType: 'dennica' }]
    });
    const record = await prisma.ai_telemetry_logs.findUnique({
        where: { id: result.telemetryId }
    });
    expect(record?.original_auto_config).not.toBeNull();
    expect(record?.final_user_config).not.toBeNull();
});
```

### Test 2: `LearningEngine.runFullCycle()` wykrywa wzorce

```typescript
it('should detect patterns when records have populated configs', async () => {
    // Arrange: utwórz rekord z kompletem danych
    const telemetryId = crypto.randomUUID();
    await prisma.ai_telemetry_logs.create({
        data: {
            id: telemetryId,
            userId: 'test',
            dn: '1200',
            wellType: 'standard',
            solverSource: 'AUTO_JS',
            wasModified: true,
            original_auto_config: JSON.stringify([
                { productId: 'D-1200', componentType: 'dennica' }
            ]),
            final_user_config: JSON.stringify([
                { productId: 'D-1200-X', componentType: 'dennica' }
            ]),
            trainingEligible: true
        }
    });
    // Act
    const result = await learningEngine.runFullCycle();
    // Assert
    expect(result.processed).toBeGreaterThan(0);
});
```

### Test 3: Regresja — override ustawia `wasModified`

```typescript
it('POST /api/telemetry/override should set wasModified=true', async () => {
    const res = await request(app)
        .post('/api/telemetry/override')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
            originalConfig: [{ productId: 'A' }],
            finalConfig: [{ productId: 'B' }],
            overrideReason: 'test'
        });
    expect(res.status).toBe(200);
    const record = await prisma.ai_telemetry_logs.findUnique({
        where: { id: res.body.id }
    });
    expect(record?.wasModified).toBe(true);
});
```

---

## Podsumowanie zmian

| #   | Plik                                         | Linii   | Typ zmiany                                 |
| --- | -------------------------------------------- | ------- | ------------------------------------------ |
| 1   | `src/services/telemetry/telemetryService.ts` | 4       | Backend — dodanie brakujących pól w create |
| 2   | `src/routes/telemetry.ts`                    | 1       | Backend — `wasModified=true` w override    |
| 3   | `public/js/studnie/telemetryBridge.js`       | ~6      | Frontend — snapshot komponentów            |
| 4   | `public/js/studnie/offerSave.js`             | 2       | Frontend — `wasModified` z `configSource`  |
|     | **Razem**                                    | **~13** | **4 pliki, 0 zmian w LearningEngine**      |

---

## Ryzyka

| Ryzyko                                                                       | P-stwo    | Mitigacja                                                                                     |
| ---------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------- |
| Stare rekordy nie mają configów → pomijane                                   | 100%      | Po fixie nowe rekordy będą kompletne. LearningEngine bezpiecznie je pomija                    |
| `configSource` może być undefined/null                                       | Średnie   | W `offerSave.js` fallback `false` — bezpieczne                                                |
| `buildComponentSnapshot()` zwraca `null` (brak produktu w `studnieProducts`) | Niskie    | Filtr `if (_snap)` w pętli pomija — configSnapshot może być []                                |
| Duplikacja snapshotów w payload (już są `appliedReductions` itd.)            | Kosmetyka | `originalConfig`/`finalConfig` to pełna lista, `appliedReductions` to kategorie — osobne cele |
