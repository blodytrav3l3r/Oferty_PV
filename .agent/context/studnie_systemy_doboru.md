# Kontekst: Systemy Doboru Elementów Studni

## Dwa systemy dobierania elementów studni

### 1. Backend Python OR-Tools (port 8000)
- **Pliki**: `well_configurator_backend/`
- **Endpoint**: `POST /api/v1/configure`
- **Biblioteka**: Google OR-Tools CP-SAT
- **Wejście**: `WellConfigInput` (dn, target_height_mm, transitions, use_reduction, warehouse, available_products)

#### Znane problemy backendu Python (CZĘŚCIOWO NAPRAWIONE):
1. **Brak uszczelek w wyniku** - Backend nie zwraca uszczelek. Naprawa: dodano `recalcGaskets(well)` i `syncKineta(well)` w `finalizeSuccess()` w `wellSolver.js:357-358`.
2. **Redukcja twardo zakodowana do DN1000** - W `generator.py:547` `reduction_dn = 1000`. **NAPRAWIONE**: dodano `target_dn` do `schemas.py`, poprawiono `get_reduction_plate()` i `get_top_closure()` w `rules.py`, oraz `generator.py` by używał `target_dn` z config.
3. **Kręgi wiercone (OT) w puli zwykłych kręgów** - `RuleEngine.get_kregi_list()` w `rules.py:234` filtruje po `componentType in ["krag", "krag_ot"]`. **NAPRAWIONE**: dodano parametr `include_ot=False` do `get_kregi_list()`, domyślnie wyklucza `krag_ot`.
4. **Brak aliasu dla `redukcja_min_h_mm`** - Frontend wysyła `redukcja_min_h_mm`, ale `WellConfigInput` miał `redukcjaMinH` bez aliasu. **NAPRAWIONE**: dodano `Field(alias="redukcja_min_h_mm")` w `schemas.py:35`.

### 2. Frontend JS Solver (fallback)
- **Plik**: `public/js/studnie/wellSolver.js`
- **Funkcja**: `runJsAutoSelection()`
- **Algorytm**: Greedy + backtracking AVR + walidacja przejść
- **Używa**: `ringOptimizer.js` (DP solver port z CP-SAT)

#### Różnice w stosunku do backendu:
- Poprawnie obsługuje uszczelki przez `recalcGaskets()`
- Obsługuje `targetDn` (docelowy DN redukcji) z konfiguracji studni

### Testy backendu Python
- `tests/test_imports.py` - test importów i aliasu `redukcja_min_h_mm`
- `tests/test_rules.py` - test `get_kregi_list()` (exclude OT), `get_reduction_plate()`, `get_top_closure()`
- `tests/test_generator.py` - test generatora konfiguracji z redukcją
- `tests/test_ot.py` - test zamiany kręgów na wiercone (OT)

### Mapowanie produktów w wellSolver.js
- Frontend wysyła `available_products` z `studnieProducts` przefiltrowanych przez `filterByWellParams()`
- `filterByWellParams()` w `wellConfigRules.js` obsługuje beton/żelbet, stopnie, i widoczność płyt redukcyjnych
- Backend buduje `ProductModel` z tych danych

### Uszczelki
- Logika tylko po stronie frontendu: `wellManager.js:215-312` (`recalcGaskets()`)
- Dodaje uszczelki między elementami: krąg, krag_ot, plyta_din, plyta_redukcyjna, konus, dennica
- Typy: GSG, SDV, SDV PO, NBR
- Backend w ogóle nie wie o uszczelkach

### Redukcja
- Frontend: `well.redukcjaDN1000` + `well.redukcjaTargetDN` (domyślnie 1000, ale może być inne)
- Backend: Tylko `use_reduction` boolean, redukcja zawsze do DN1000

### Kręgi wiercone (OT)
- Backend: `substitute_ot_rings()` w `validator.py:160-251` zamienia kręgi na OT po wygenerowaniu
- Frontend: `applyDrilledRings()` w `wellSolver.js:35-157` i w `runJsAutoSelection` linia 1138-1213
- Problem: backend może dobrać `krag_ot` jako zwykły krąg w `get_kregi_list()`
