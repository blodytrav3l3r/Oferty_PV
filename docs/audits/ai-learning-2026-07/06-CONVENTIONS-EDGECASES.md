# A.6 — Zgodność z konwencjami (AGENTS.md) + A.7 — Edge cases

**Data:** 2026-07-04

---

## A.6 Zgodność z AGENTS.md

### 1. Język
- Komentarze: ✅ po polsku (np. `// ringHeightBonus: preferuj...`)
- Identyfikatory: ✅ angielskie (`preferenceWeights`, `ringHeightBonus`, `KonusBonus`, `detectRingPattern`)
- Dokumentacja: ✅ po polsku

### 2. Window globals
| Funkcja | Plik | `window.X = X`? | Status |
|---------|------|----------------|--------|
| `aiDashboardRender` | `aiDashboard.js:256` | ✅ `window.aiDashboardRender = async function...` | ✅ |
| `computeDiameterProfile` | `telemetryBridge.js:260` | ✅ | ✅ |
| `applyWellAlternative` | `wellSolver.js:1650` | ✅ | ✅ |
| `scoreLayout` | `wellConfigRules.js:720` | ✅ (pre-existing) | ✅ |

### 3. Cache-busting `?v=N`
| Plik | Zmieniony w | `?v=` po zmianach | Wymaga bump? |
|------|-------------|-------------------|--------------|
| `wellSolver.js` | F2, F3 | `?v=3.0` | **❌ P2 — powinno być `3.1`** |
| `wellConfigRules.js` | F3 | `?v=3.0` | **❌ P2 — powinno być `3.1`** |
| `offerManager.js` | F1 | `?v=3.0` | **❌ P2 — powinno być `3.1`** |
| `studnie.css` | F2 | `?v=8.2` | ✅ |
| `wellSolver.js` (w app.html) | F2, F3 | `?v=3.2` (inna wersja) | **❌ P2 — niespójność** |
| `telemetryBridge.js` | F1 | `?v=3.0` | **❌ P2** |

### 4. `escapeHtml` — użycie
- W `wellConfigRules.js`: kod nie zawiera `innerHTML` (zwraca obiekt `{score, breakdown, reason}`) → ✅
- W `aiDashboard.js`: wszystkie dane z API escape'owane → ✅

### 5. `lucide.createIcons` — po `innerHTML`
- `aiDashboard.js`: **❌ BRAK** `lucide.createIcons({root: container})` po każdym `innerHTML`.
  Dashboard używa stylowanych spanów (nie lucide icons), więc nie ma wizualnego efektu. **P3.**

### 6. VERSION bump
- Zmiany zawierają `feat()` commits (standard-version auto-detekcja)
- Po zmergowaniu: `npm run release` może podbić wersję minor

---

## A.7 Edge cases — najgorsze scenariusze

### 1. Kumulacja danych
| Scenariusz | Wpływ | Mitigacja |
|-----------|-------|-----------|
| 200 records/cykl × 5 cykli/dzień × 30 dni = 30k w telemetry | KB rośnie, ale `take: 50` ogranicza UI | ✅ `cleanupCycle()` archiwizuje niskiej jakości patterny |
| Milion wzorców w KB | `getPatternsForDn()` z limitem 50 — stabilne | ✅ |
| **Brak limitu na `ai_telemetry_logs`** | Tabela telemetry rośnie bez końca | ⚠️ Brak archiwizacji telemetry (cleanup dotyczy tylko KB) |

### 2. Dane zepsute
| Scenariusz | Zachowanie | Status |
|-----------|-----------|--------|
| `dn = "1200 cm"` (z tekstem) | Int w DB → zapisze się jako string w KB → pomijane w getPatternsForDn | ✅ bezpieczne |
| `componentSeq: null` | Detektory sprawdzają `if (!r.componentSeq) continue` | ✅ |
| `recommendation: null` w KB | `rec ? ... : ''` w aiDashboard | ✅ |
| JSON parse error | try/catch w każdym detektorze | ✅ |

### 3. Concurrency
| Scenariusz | Wpływ | Fix |
|-----------|-------|-----|
| 2× save offer → 2× `createOrUpdate` z tym samym hash | Duplikaty w `ai_well_cases` | **P1**: dodać `@@unique` + `$transaction` |
| 2× `POST /ai/learning/run` równolegle | Podwójne przetwarzanie | **P2**: dodać `if (this.running) return` |

### 4. Cold start (nowy DB, 0 records)
| Check | Wynik | Status |
|-------|-------|--------|
| `getPreferences()` | `{confidence: 0, ringHeightBonus: {}, ...}` | ✅ |
| `runFullCycle()` | `records.length === 0` → return `{processed:0, ...}` | ✅ |
| `getPatternsForDn('all_dn')` | `[]` (empty) | ✅ |
| `scoreLayout({preferenceWeights: null})` | Identyczny ze starym kodem | ✅ |
| AI Dashboard | Pokazuje "Brak wzorców. Uruchom Learning cycle." | ✅ |
| **`aiDashboard.js` nie jest podłączony do UI** | Istnieje, ale nie ma przycisku / nie jest wywoływany | **❌ P2** |

### 5. Główny znaleziony problem — AI Dashboard UI

**Problem:** `aiDashboard.js` (z F5) zawiera `window.aiDashboardRender()` ale **NIGDZIE nie jest wywoływany**:
- `mlDashboard.js:30` definiuje `showMLDashboard()` — to stary dashboard
- `router.js:508` wywołuje `showMLDashboard()` — to stary dashboard
- `aiDashboard.js` — NIE jest załączony w `studnie.html`, NIE jest wywoływany
- Jedyna droga dostępu: `window.aiDashboardRender('some-id')` z konsoli DevTools

**Fix:** Podpiąć w `mlDashboard.js` lub dodać osobny przycisk + skrypt.

---

## Podsumowanie P2 — do następnej sesji

| # | Problem | Kategoria | Fix |
|---|---------|-----------|-----|
| 1 | `?v=N` nie zaktualizowane | Cache-busting | Bump dla wellSolver.js, wellConfigRules.js, offerManager.js, telemetryBridge.js |
| 2 | aiDashboard.js nie podłączony do UI | Feature gap | Dodać wywołanie w mlDashboard.js lub nowy przycisk |
| 3 | Brak `lucide.createIcons` po innerHTML | UI kosmetyka | Dodać w renderPrefs/renderStats |
