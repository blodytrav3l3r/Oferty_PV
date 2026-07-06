# A.3 — Spójność typów między warstwami

**Data:** 2026-07-04

---

## 1. Preferencje: TS Interface ↔ JSDoc ↔ użycie

### Źródło: `PreferenceWeights` (TS backend, `wellCaseService.ts:335-347`)

```typescript
interface PreferenceWeights {
    dn: number;
    warehouse: string | null;
    confidence: number;
    ringHeightBonus: Record<string, number>;
    dennicaBonus: Record<string, number>;
    konusBonus: number;
    profileBonuses: Array<{ pattern: number[]; bonus: number }>;
    avoidProductIds: string[];
    preferProductIds: string[];
    warnings: string[];
    timeApplied: string;
}
```

### Konsumpcja 1: `scoreLayout()` w `wellConfigRules.js` (JSDoc)

JSDoc: `@param {Object} [opts.preferenceWeights] - wyuczone preferencje (Phase 3)`

Brak dokumentacji pól. Rzeczywiste użycie pól w `scoreLayout()`:

| Pole | Użycie | Guard | Status |
|------|--------|-------|--------|
| `ringHeightBonus` | `prefs.ringHeightBonus` iterowany | `if (prefs && prefs.ringHeightBonus)` | ✅ |
| `dennicaBonus` | **NIGDY** | — | ❌ **DEAD CODE** |
| `konusBonus` | `prefs.konusBonus` | `typeof prefs.konusBonus === 'number'` | ✅ |
| `profileBonuses` | `prefs.profileBonuses` | `Array.isArray(prefs.profileBonuses)` | ✅ |
| `avoidProductIds` | `prefs.avoidProductIds` | `Array.isArray(prefs.avoidProductIds)` | ✅ |
| `preferProductIds` | `prefs.preferProductIds` | `Array.isArray(prefs.preferProductIds)` | ✅ |
| `dn`, `warehouse`, `confidence`, `warnings`, `timeApplied` | **NIGDY** w scoreLayout | — | ✅ (meta) |

### Konsumpcja 2: `wellSolver.js:378-394`

| Pole | Użycie | Guard | Status |
|------|--------|-------|--------|
| `confidence` | `prefs.confidence > 0.1` | `prefs && prefs.confidence` | ✅ |

---

## 2. `scoreLayout()` calls — sprawdzenie wszystkich wywołań

### Call 1: standard flow (line ~1114)
```javascript
scoreLayout({
    ringCount: otKItems.length,
    diff, isOutOfBounds, isMinimal,
    isFallbackClosure, isKonus,
    reductionForced, hasReduction: false,
    otCount,
    preferenceWeights          // ← przekazane
});
```

### Call 2: reduction flow (line ~1284)
```javascript
scoreLayout({
    ringCount: ..., diff, isOutOfBounds,
    isMinimal, isFallbackClosure: false,
    reductionForced: false, hasReduction: true,
    bottomSectionH, minBottomTotal, dn,
    otCount,
    preferenceWeights          // ← przekazane
});
```

Oba wywołania zawierają `preferenceWeights`. **Spójne.**
Brak przekazania `productIds` i `diameterProfile` — te optymalizacje są nieaktywne w JS solver (działają tylko gdy wywołujący poda dane).

---

## 3. API kontrakt: endpoint ↔ frontend fetch

### Endpoint: `GET /api/learning/preferences?dn=1200&warehouse=KL`
**Źródło:** `learningRoutes.ts:96-111` → `wellCaseService.getPreferences()`
**Response:** obiekt `PreferenceWeights` (JSON serializowany przez Express)

### Frontend: `wellSolver.js:378-394`
```javascript
const prefsResp = await fetch(
    `/api/learning/preferences?dn=${parseInt(effectiveDn)}&warehouse=${encodeURIComponent(well.magazyn || '')}`,
    { credentials: 'same-origin' }
);
if (prefsResp.ok) {
    const prefs = await prefsResp.json();
    if (prefs && prefs.confidence > 0.1) { ... }
}
```

**Zgodność pól:** ✅ Wszystkie używane pola istnieją w obu stronach.

---

## 4. Python generator ↔ Node API

**Generator output** (`generator.py`):
```python
return [
    {
        "items": [{ product_id, name, quantity, height_mm, ... }],
        "total_height": int,
        "score": float,
        "is_valid": bool,
        # ...
    }
]
```

**Konsumpcja w `wellSolver.js`** — przez `applyBackendConfig()` który parsuje ten sam JSON.
Brak bezpośredniego mapowania typów (Python dict ↔ JS obiekt). Poleganie na runtime.

**Ryzyko:** Jeśli Python zmieni strukturę (np. doda `error` pole zamiast `is_valid: false`), JS nie ma guarda. ⚠️

---

## 5. Podsumowanie

| Problem | Poziom | Opis |
|---------|--------|------|
| `dennicaBonus` nie używany | MINOR | Dead code: backend generuje, frontend ignoruje |
| JSDoc `preferenceWeights` gołe | MINOR | Brak dokumentacji pól w JSDoc |
| `productIds`/`diameterProfile` nie przekazane | INFO | Oczekiwane — będą działać gdy backend AI solver przekaże dane |
| Python→JS brak guard na zmianę struktury | MINOR | Jeśli Python zmieni format response, JS może się wysypać |
