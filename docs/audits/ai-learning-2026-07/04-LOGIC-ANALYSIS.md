# A.4 — Audyt logiczny (10 plików)

**Data:** 2026-07-04

---

## 1. Dial-zero regression — `preferenceWeights = null`

**Sprawdzenie:** czy `scoreLayout()` bez prefs daje identyczny wynik jak stary kod?

| Warunek | Stary kod | Nowy kod (prefs=null) | Zgodny? |
|---------|-----------|----------------------|---------|
| `opts.isKonus = true` | `score -= 500000` | `prefs=null → const cv = -500000 → score += -500000` | ✅ |
| `opts.isKonus = false` | pomijany | pomijany (ten sam if) | ✅ |
| Pozostałe czynniki | niezmienione | niezmienione | ✅ |

**Wniosek:** Dial-zero regression = **NIE**. Kod z `preferenceWeights = null` jest identyczny.

---

## 2. Null safety — wszystkie dostęp do `prefs.*`

| Użycie | Guard | Status |
|--------|-------|--------|
| `prefs.konusBonus` | `prefs && typeof prefs.konusBonus === 'number'` | ✅ |
| `prefs.ringHeightBonus` | `prefs && prefs.ringHeightBonus` | ✅ |
| `prefs.avoidProductIds` | `prefs && Array.isArray(prefs.avoidProductIds)` | ✅ |
| `prefs.preferProductIds` | `prefs && Array.isArray(prefs.preferProductIds)` | ✅ |
| `prefs.profileBonuses` | `prefs && Array.isArray(prefs.profileBonuses)` | ✅ |
| `prefs.confidence` | `prefs && prefs.confidence` | ✅ |

**Wniosek:** Wszystkie dostęp do prefs są chronione. **Brak ryzyka TypeError.**

---

## 3. Edge cases

### 3.1 `konusBonus = 0` (user preference ustawia go na 0)
```javascript
// Linia 622:
const cv = prefs && typeof prefs.konusBonus === 'number' ? prefs.konusBonus : -500000;
// Jeśli konusBonus = 0 → `typeof 0 === 'number'` → true → cv = 0
// Wcześniej: score -= 500000. Teraz: score += 0.
// **Konus przestaje być preferowany.** Może to zmienić wybór solvera.
```
**Wpływ:** Jeśli KB wygeneruje `konusBonus: 0`, konus straci bonus i solver wybierze DIN.
**Stan:** Zamierzony feature (KB może wyłączyć konus bonus), ale może zaskoczyć.

### 3.2 `ringHeightBonus` pusty obiekt
```javascript
if (prefs && prefs.ringHeightBonus && opts.ringCount > 0) {
    for (const [h, bonus] of Object.entries(prefs.ringHeightBonus)) { ... }
    if (rhTotal !== 0) { score += rhTotal; ... }
}
// Pusty obiekt → pętla nic nie dodaje → rhTotal = 0 → pomijane. ✅
```

### 3.3 `profileBonuses` pusta tablica
```javascript
if (prefs && Array.isArray(prefs.profileBonuses) && prefs.profileBonuses.length > 0 && ...)
// Pusta → pomijane. ✅
```

### 3.4 `avoidProductIds` pusta
```javascript
if (prefs && Array.isArray(prefs.avoidProductIds) && prefs.avoidProductIds.length > 0)
// Pusta → pomijane. ✅
```

### 3.5 `productIds` / `diameterProfile` nie przekazane do `scoreLayout()`
```javascript
// Wywołania w wellCfgRules.js nie przekazują:
// opts.productIds → undefined
// opts.diameterProfile → undefined

// avoidProductIds: !opts.productIds → pętla nie wejdzie → OK
// profileBonuses: !opts.diameterProfile → pętla nie wejdzie → OK
```
**Stan:** Bezpieczne, choć profileBonuses i avoid/preferProducts nie działają w JS solver.
Tylko ringHeightBonus i konusBonus są efektywne w JS solver.

---

## 4. Race conditions

### 4.1 `createOrUpdate` w `wellCaseService.ts:52-106`

```
findFirst(dn + totalHeightMm + configHash)
→ istnieje?  → update acceptanceCount
→ nie istnieje? → create
```

**Problem:** Brak transakcji. Dwa równoległe requesty z tym samym configHash:
1. Oba wykonują `findFirst` → oba zwracają `null`
2. Oba wykonują `create` → **dwa duplikaty** (brak `@@unique` constraint)

**Wpływ:** Baza zbierze duplikaty przy szybkim double-click "zapisz ofertę".
**Fix:** Dodać `@@unique([dn, totalHeightMm, configHash])` w Prisma schema + `$transaction`.

### 4.2 `runFullCycle()` — brak blokady
- Brak mutex: dwa równoległe `POST /ai/learning/run` wykonają `runFullCycle()` jednocześnie
- **Wpływ:** Podwójne przetwarzanie, możliwe duplikaty w KB
- **Fix:** Dodać simple lock (`if (this.running) return`)

### 4.3 `autoSelectComponents()` — guard istnieje
✅ `isAutoSelectRunning` i `__MAX_AUTO_SELECT_CALLS` chronią przed rekurencją.

---

## 5. Performance

### 5.1 `runFullCycle()` z 200 rekordami
- Każdy rekord: do 5 detektorów × JSON.parse na `componentSeq`
- `take: 200` → 200 × 5 × 1ms ≈ 1s na JSON.parse + Map operations
- Dodatkowo: `upsertPattern` na każdy wykryty wzorzec (insert/update do SQLite)
- **Oczekiwany czas:** 2-5 sekund przy 200 rekordach

### 5.2 Cron co 1h — CPU impact
- `setInterval(60 * 60 * 1000)` — raz na godzinę
- Nie blokuje event loop (async)
- **Ryzyko:** Niskie. SQLite `WAL mode` + batch `deleteMany` w cleanup.

### 5.3 `getPatternsForDn('all_dn')` — bez limitu DN
- Prisma: `findMany({ take: 50 })` → max 50 rekordów
- **Performance:** Stały czas. ✅

---

## 6. LearningEngine — error handling

| Komponent | Error handling | Status |
|-----------|---------------|--------|
| `.map()` preprocessing | Brak try/catch (rzuca przy throw w callbackach) | ⚠️ Jeśli któryś z callbacków mapy rzuci (np. JSON.parse bez try), cały runFullCycle padnie. Ale detektory mają wewnetrzne try/catch. Bezpieczne. |
| Detektory (ring/closure/product) | Wewnetrzne try/catch wokół JSON.parse | ✅ |
| `persist()` | try/catch w `upsertPattern` przy każdym zapisie | ✅ |
| `cleanupCycle()` | try/catch + zwraca 0 przy błędzie | ✅ |
| Główny catch | `try/catch` na całości → zwraca error w summary | ✅ |

---

## 7. Python generator — edge cases

| Scenariusz | Zachowanie | Status |
|-----------|-----------|--------|
| Brak dennic | Zwraca `[WellConfigResult(is_valid=False)]` | ✅ |
| Brak valid configów | Zwraca `[best_invalid_result]` lub fallback | ✅ |
| Duplikaty | Dedup przez MD5 z product_id | ✅ (tylko jeśli `Set` zaimportowane) |
| >10 unikalnych | `MAX_VARIANTS = 10` — cięcie | ✅ |
| Puste items po dedup | Sprawdzane `result.is_valid` przed dodaniem | ✅ |

---

## 8. Podsumowanie

| # | Problem | Plik:linia | Kategoria | Priorytet |
|---|---------|-----------|-----------|-----------|
| 1 | **Race condition w createOrUpdate** — brak transakcji, możliwe duplikaty | `wellCaseService.ts:58-103` | Concurrency | **P1** |
| 2 | **Brak mutex w runFullCycle** — równoległe wywołania możliwe | `LearningEngine.ts:63-233` | Concurrency | **P2** |
| 3 | **konusBonus=0** — przestaje preferować konus (feature, ale zaskakujący) | `wellConfigRules.js:622` | Edge case | **P2** |
| 4 | **productIds/diameterProfile nie przekazane** — avoid/prefer/profil nieaktywne w JS solver | `wellSolver.js:1114,1284` | Feature gap | **P3** |
| 5 | **Brak dedykowanego error guard na .map() w runFullCycle** — teoretycznie możliwy crash | `LearningEngine.ts:202-235` | Resilience | **P3** |

---

## 9. Rekomendacje

1. **P1**: Dodać `@@unique([dn, totalHeightMm, configHash])` w Prisma schema + `$transaction` w `createOrUpdate`.
2. **P2**: Dodać blokadę w `runFullCycle()` — `if (this.running) return`.
3. **P2**: Dodać komentarz/doc że `konusBonus: 0` wyłącza preferencję konusa.
4. **P3**: Rozważyć przekazanie `productIds` i `diameterProfile` do `scoreLayout()` w JS solver.
