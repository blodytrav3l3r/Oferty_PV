# Plan Naprawy v2 — WITROS Oferty PV

**Data:** 2026-07-12
**Wersja projektu:** 1.6.0
**Bazuje na:** `AUDYT-Kompleksowy-2026-07-12.md`, `PLAN-NAPRAWY-2026-07-12.md`
**Cel:** realizacja pozostałych zadań po wykonaniu Etapów 1–4

---

## Status wykonania (Etapy 1–4 ✅)

| Etap | Zakres                                                        | Commit    | Status |
| ---- | ------------------------------------------------------------- | --------- | ------ |
| 1    | CSRF, rotacja sesji, bcrypt 12, X-XSS-Protection, CSP enforce | `bfb5187` | ✅     |
| 2    | parseDecimal, testy sortowania, fix N+1                       | `3a198e9` | ✅     |
| 3    | Split pdfGenerator, validators, orders                        | `53e4d37` | ✅     |
| 4    | Split excelTableManager, offerManager, orderManager           | `7e1af99` | ✅     |
| —    | Testy + narzędzia                                             | `3a198e9` | ✅     |
| —    | Dokumentacja + zależności                                     | `5249252` | ✅     |

---

## Globalne zasady wykonania

### Zasada 1 — Quality Gates po każdym zadaniu

Po KAŻDEJ modyfikacji (przed przejściem dalej):

```bash
npm run typecheck       # musi przejść
npm run lint            # musi przejść
npm run test:quick      # wszystkie testy muszą przejść
npm run format:check    # musi przejść
node -c public/js/<file>   # dla plików JS frontend
git commit              # commit przed następnym zadaniem
```

### Zasada 2 — Blokada przechodzenia dalej

Nie można rozpocząć kolejnego zadania jeśli:

```
build FAIL LUB test FAIL LUB typecheck FAIL LUB lint FAIL
```

### Zasada 3 — Rollback Plan

Każde zadanie musi mieć zdefiniowany sposób wycofania:

```
ROLLBACK: git checkout HEAD -- <zmodyfikowane_pliki>
```

### Zasada 4 — Kolejność: walidator → kod → testy

Przed modyfikacją kodu aplikacji zawsze najpierw sprawdź czy istniejące testy i walidatory są aktualne. Nie usuwaj narzędzi walidacyjnych bez analizy ich wartości.

### Zasada 5 — Stop criteria dla refaktoryzacji

Dla każdego zadania refaktoryzacyjnego (T5, T6) obowiązują kryteria przerwania:

```
Jeżeli:

- liczba zmodyfikowanych plików przekroczy 25
- liczba błędów lint przekroczy 10
- coverage spadnie względem baseline

→ zakończyć bieżący etap
→ commit
→ kontynuować w kolejnej iteracji
```

Zapobiega to kumulowaniu zbyt dużych zmian w jednym PR.

### Zasada 6 — Refactoring = move-only, potem cleanup

Podczas splitu dużego modułu obowiązuje reguła:

```
Krok 1: move only   — przenieś kod, NIE zmieniaj logiki
Krok 2: cleanup     — dopiero w osobnej iteracji poprawiaj API, typy, nazwy
```

Nigdy nie łączyć tych dwóch kroków w jednym zadaniu.

---

## Etap 5 — Infrastruktura

### T1 — sortCol/sortDir validation 🟢 1.5h

**Priorytet:** 10/10

**Problem:** `studnieCrud.ts` używa `validSortMap` (whitelista), ale `ruryCrud.ts` używa dynamicznego `orderBy` Prisma bez whitelisty. Brak jawnej walidacji dozwolonych wartości sortCol/sortDir.

**Pliki:**

- `src/routes/offers/studnieCrud.ts` — dodać `ALLOWED_SORT_COLS` + `ALLOWED_SORT_DIRS`
- `src/routes/offers/ruryCrud.ts` — dodać whitelistę dla spójności

**Zakres zmian:**

- Dodać `ALLOWED_SORT_COLS = new Set([...])` i `ALLOWED_SORT_DIRS = new Set(['ASC', 'DESC'])`
- Walidacja przed `ORDER BY` / `orderBy`
- Testy: wystarczą istniejące (regresja CRUD)

**Ryzyko:** 🟢 Niskie — whitelista już istnieje w studnieCrud jako `validSortMap`, to tylko jawny guard.

**Rollback:** `git checkout HEAD -- src/routes/offers/studnieCrud.ts src/routes/offers/ruryCrud.ts`

**Def. Done:** typecheck ✅ lint ✅ testy offer CRUD ✅ commit ✅

---

### T3 — Graphify postinstall 🟢 30min

**Priorytet:** 7/10

**Problem:** Graphify był używany wcześniej (dane w `graphify-out/` istnieją), ale nie ma skryptów npm ani `postinstall`.

**Plik:** `package.json`

**Zakres zmian:**

```json
"postinstall": "graphify update . 2>nul || echo 'graphify not installed — skip'",
"graphify:update": "graphify update .",
"graphify:query": "graphify query"
```

**Ryzyko:** 🟢 Minimalne — tylko package.json scripts.

**Rollback:** `git checkout HEAD -- package.json package-lock.json`

**Def. Done:** typecheck ✅ commit ✅

---

### T8 — loading="lazy" on iframe 🟢 30min

**Priorytet:** 10/10

**Problem:** `router.js:215` tworzy iframe dynamicznie, brak `loading="lazy"`.

**Plik:** `public/js/spa/router.js`

**Zakres zmian:**

```javascript
const iframe = document.createElement('iframe');
iframe.loading = 'lazy'; // ← dodać
```

**Ryzyko:** 🟢 Minimalne — jeden atrybut HTML5, wspierany przez wszystkie nowoczesne przeglądarki.

**Rollback:** `git checkout HEAD -- public/js/spa/router.js`

**Def. Done:** typecheck ✅ node -c router.js ✅ commit ✅

---

### T11 — Global apiLimiter 🟠 1h

**Priorytet:** 8/10

**Problem:** Każdy route używa dedykowanego limitera, brak globalnego ograniczenia na `/api/*`. Atakujący może przeciążyć serwer przez wiele różnych endpointów naraz.

**Plik:** `src/app.ts`

**Zakres zmian:**

```typescript
import { createRateLimiter } from './middleware/rateLimiter';
// Global limit: 600 requests/min na całe API
app.use('/api', createRateLimiter({ maxHits: 600, windowMs: 60_000 }));
```

Uwaga: istniejące dedykowane limitery (WRITE_LIMITER: 60/min, EXPORT_LIMITER: 20/min) są bardziej restrykcyjne niż globalny, więc nie będą kolidować.

**Ryzyko:** 🟠 Średnie — zbyt niski limit może zablokować legalne żądania. Wrapper musi być dodany PRZED bardziej restrykcyjnymi limiterami.

**Warunek wdrożenia:** Przed dodaniem globalnego limitera należy zmierzyć rzeczywiste obciążenie:

```
1. Sprawdzić logi backendu — ile requestów/min generuje frontend?
2. Czy eksport PDF generuje wiele wywołań naraz?
3. Czy upload plików (XLSX) nie będzie blokowany?
4. Ustawić limit z zapasem 2x względem zmierzonego peak-u
```

**Rollback:** `git checkout HEAD -- src/app.ts`

**Def. Done:** typecheck ✅ test:quick ✅ commit ✅

---

## Etap 5b — Husky Fix (Tydzień 2)

### T2 — Husky fix: excel-validator.py 🟠 2h

**Priorytet:** 9/10
**Krytyczne ustalenie:** Problem NIE leży w `well.magazyn`! To pole (string: 'Włocławek'/'Kluczbork') i `product.magazynWL` (boolean: 0/1) to dwa różne pola na różnych modelach. Zmiana spowodowałaby regresję.

**Rzeczywista przyczyna:** `scripts/excel-validator.py`:

1. Regexy nie dopasowują kodu po formatowaniu przez Prettier (wielolinijkowe wyrażenia)
2. Sprawdza tylko `excelTableManager.js`, ale kod po spliście jest w 8 plikach w `excel/`
3. W efekcie 20/20 checków failuje — ale nie oznacza to błędu w kodzie

**Strategia (3 kroki):**

#### Krok 1 — Audyt (30 min)

Sprawdzić każdą regułę w `excel-validator.py` (linie 54–84):

- Które reguły dotyczą nadal istniejącego kodu (tylko w innym pliku)
- Które reguły są już nieaktualne (feature nie istnieje)
- Które reguły chronią rzeczywiste reguły biznesowe

#### Krok 2 — Aktualizacja (1h)

- Zaktualizować regex patterny na wielolinijkowe (`re.DOTALL` już jest)
- Zmienić ścieżki: tam gdzie logika przeniesiona do `excel/*.js`, sprawdzać wszystkie 8 plików
- Dodać testy dla validatora (`tests/excelValidator.test.ts`) aby wychwycić przyszłe regresje

#### Krok 3 — Decyzja (30 min)

- Jeśli >50% reguł jest nieaktualna → zastąpić validator prostszym skryptem sprawdzającym tylko to, co ma znaczenie
- Jeśli <50% → zostawić zaktualizowany

**WAŻNE:** Nie usuwać validatora dopóki nie zostanie zweryfikowane, że nie chroni żadnych aktywnych reguł biznesowych.

**Pliki:**

- `scripts/excel-validator.py` — aktualizacja regexów i ścieżek
- `.husky/pre-commit` — pozostaje bez zmian (nadal wywołuje ten sam skrypt)
- `tests/excelValidator.test.ts` — nowy test regresji dla validatora

**Ryzyko:** 🟠 Średnie — zmiana w skrypcie walidacyjnym, nie w kodzie aplikacji.

**Rollback:** `git checkout HEAD -- scripts/excel-validator.py tests/excelValidator.test.ts`

**Def. Done:** `git commit` przechodzi bez `--no-verify` ✅ lint ✅ test:quick ✅

---

## Quality Gates (Tydzień 3)

### T4 — check-file-size + lint:file-size 🟠 2.5h

**Priorytet:** 9/10

#### 4a — Skrypt (1h)

**Plik:** `scripts/check-file-size.mjs` (nowy)

Skrypt sprawdza wszystkie pliki `src/**/*.ts` i `public/js/**/*.js` (z pominięciem `node_modules`, `dist`, `xlsx.full.min.js` itp.) czy nie przekraczają 500 linii.

**Tryb ostrzegawczy (pierwsze 2 tygodnie):** Skrypt startuje jako **warning** (exit 0), nie blokuje commita. Pozwala to zespołowi przyzwyczaić się do metryki bez blokad. Po 2 tygodniach → zmienić na **error** (exit 1, blokada commita).

**Wyjątki (EXEMPT) — zarówno w trybie warning jak i error:**

- `public/js/studnie/orderManager.js` — tymczasowo do czasu splitu (T5)
- `public/js/studnie/order/orderZlecenia.js` — tymczasowo do czasu splitu (T5)
- `public/js/studnie/wellActions.js` — tymczasowo do czasu splitu (T6)
- `public/js/studnie/wellPopups.js` — tymczasowo (następny w kolejce)

#### 4b — Skrypt npm (30 min)

**Plik:** `package.json`

```json
"lint:file-size": "node scripts/check-file-size.mjs"
```

#### 4c — Husky (30 min)

**Plik:** `.husky/pre-commit`
Dodać `npm run lint:file-size` PRZED `npx lint-staged`.

#### 4d — Test (30 min)

**Plik:** `tests/fileSize.test.ts`
Test sprawdza, że skrypt uruchamia się bez błędów na znanych plikach.

**Ryzyko:** 🟢 Niskie — skrypt tylko ostrzega, nie zmienia kodu. EXEMPT zapobiega blokadzie.

**Rollback:** `git checkout HEAD -- scripts/check-file-size.mjs package.json .husky/pre-commit tests/fileSize.test.ts`

**Def. Done:** typecheck ✅ test:quick ✅ commit bez `--no-verify` ✅

---

## Refactoring: orderManager.js (Tydzień 4–5)

### T4.5 — Baseline przed splitem 🟠 2h

**Priorytet:** 10/10 — warunek konieczny przed T5

**Cel:** Zamrożenie stanu obecnego przed refaktoryzacją.

**Scope:**

1. **Snapshot obecnego zachowania** — uruchomić wszystkie testy, zapisać wynik (1300)
2. **Dependency graph** — sprawdzić kto importuje z `orderManager.js`:
    - `rg "orderManager" public/js/studnie/ --include="*.js"` — wszystkie importy
    - `rg "window\." public/js/studnie/orderManager.js` — lista 26 eksportów
3. **Lista window exports (checklista):**
    ```
    [ ] window.getOrdersForOffer
    [ ] window.getOrderedWellIds
    [ ] window.isWellOrdered
    [ ] window.getOfferOrderProgress
    [ ] window.getOrderForWellId
    [ ] window.applyPreviewLockUI
    [ ] window.saveCurrentOrder
    [ ] window.saveOfferStudnie
    [ ] window.exitPreviewMode
    [ ] window.loadOrderSnapshot
    [ ] window.createOrderFromOffer
    [ ] window.saveOrderStudnie
    [ ] window.deleteOrderStudnie
    [ ] window.syncSourceData
    [ ] window.showKartaBudowyExportChoice
    [ ] window.exportKartaToPDF_action
    [ ] window.exportKartaToWord_action
    [ ] window.toggleDaneElementu
    [ ] window.toggleCard
    [ ] window.isPreviewMode
    ```
4. **Smoke test** — ręczne sprawdzenie krytycznych ścieżek (krok 5 kreatora studni)

**Output:** Plik `docs/audit/baseline-orderManager-2026-07-12.md`

---

### T5 — orderManager.js split 🔴🟠 6-8h

**Priorytet:** 10/10

**Stan obecny:** `orderManager.js` — 2739 linii, 75 funkcji, 26 `window.*` eksportów.

**Cel:** <900 linii w głównym pliku, reszta w dedykowanych modułach.

**Planowany podział:**

```
public/js/studnie/order/
├── orderZlecenia.js       ← istnieje (2203 linie, ale docelowo po dalszym spliście ~900)
├── orderKartaBudowy.js    ← NOWY: ~800 linii
│   ├── collectKartaBudowyDataStep4
│   ├── renderPrzejsciaDetailsTable
│   ├── buildPrzejscieRowHTML
│   ├── _calcTransportCosts
│   ├── _detectWellParams / _applyDetectedParams
│   ├── addCustomPrzejscieRow / _syncCustomRowsFromDOM
│   ├── buildOfferPrzejsciaTypes
│   └── ~15 mniejszych helperów
├── orderCrud.js           ← NOWY: ~400 linii
│   ├── saveCurrentOrder / loadOrderSnapshot / deleteOrderStudnie
│   ├── createOrderFromOffer / saveOrderStudnie
│   └── freezeWellPrices
├── orderState.js          ← NOWY: ~300 linii
│   ├── getOrdersForOffer / getOrderedWellIds / isWellOrdered
│   ├── getOfferOrderProgress / getOrderForWellId
│   └── getOrderChanges / getCurrentOfferOrder
└── orderManager.js        ← <200 linii (barrel + delegacja)
```

**Dlaczego cel to <900, nie <500:**

- Sztuczne dzielenie <500 prowadzi do nadmiernej liczby plików
- 700-900 linii na moduł to rozsądny kompromis dla złożonej domeny
- Docelowo po dalszych splitach można zejść do <500

**Checklista kompatybilności (przed/po spliście):**

```
before split:
  [ ] window.getOrdersForOffer — istnieje
  [ ] window.saveCurrentOrder — istnieje
  [ ] window.createOrderFromOffer — istnieje
  ... (26 pozycji)
```

```
after split:
  [✓] window.getOrdersForOffer — nadal istnieje, ta sama sygnatura
  [✓] window.saveCurrentOrder — nadal istnieje, ta sama sygnatura
  ... (sprawdzić wszystkie 26)
```

**Kroki wykonania:**

| Krok | Opis                                                                                                     | Czas  |
| ---- | -------------------------------------------------------------------------------------------------------- | ----- |
| 5a   | Wyodrębnić `orderKartaBudowy.js` — logika step4 + przejścia                                              | 3h    |
| 5b   | Zaktualizować `orderManager.js` — usunąć przeniesione funkcje, dodać importy i re-exporty przez `window` | 1h    |
| 5c   | Zaktualizować `studnie.html` — dodać script tag dla nowego pliku                                         | 10min |
| 5d   | Typecheck + test:quick + node -c dla wszystkich plików                                                   | 30min |
| 5e   | Weryfikacja checklisty kompatybilności (26 window exportów)                                              | 30min |
| 5f   | Testy dla przeniesionych funkcji (priorytet: czyste funkcje)                                             | 2h    |

**Ryzyko:** 🔴 WYSOKIE. orderManager to krytyczny moduł dla kroku 5 (zamówienie). Wymaga:

- Dokładnej analizy zależności przed zmianą
- Testów po każdej przeniesionej funkcji
- Weryfikacji wszystkich `window.*` eksportów po spliście
- Smoke testu ścieżki zamówienia

**Mitigacja:** Stosować zasadę **move-only** (Zasada 6): przenieś kod bez zmiany logiki, zachowaj sygnatury funkcji. Cleanup (refaktoryzacja API, typów, nazw) dopiero w osobnej iteracji po spliście. Przed splitem wykonać T4.5 (baseline).

**Test priority:**

1. 🥇 **Czyste funkcje** (parsowanie, walidacje, mapowanie danych) — najłatwiej testować
2. 🥈 **Funkcje z DOM** (renderowanie, event handlery) — testy przez `jsdom` lub mocki
3. 🥉 **Funkcje z API** (save, load, delete) — testy integracyjne

**Rollback:** `git checkout HEAD -- public/js/studnie/order/ public/js/studnie/orderManager.js public/studnie.html`

**Def. Done:** wszystkie 26 window exportów działa ✅ typecheck ✅ test:quick ✅ node -c ✅ commit ✅

---

## Testy (Tydzień 6)

### T7 — Testy dla krytycznych modułów 🟠 4-6h

**Priorytet:** 10/10

**Cel (zmieniony):** NIE "1400 testów" (arbitralna liczba). Zamiast tego: testy dla modułów o najwyższym ryzyku regresji.

**Luki:**

| Obszar            | Plik                          | Rozmiar             | Obecne testy |
| ----------------- | ----------------------------- | ------------------- | ------------ |
| Zamówienia studni | `orderManager.js` + `order/*` | >5000 linii łącznie | ❌ 0         |
| Akcje studni      | `wellActions.js`              | 2458 linii          | ❌ 0         |
| Popupy studni     | `wellPopups.js`               | 2087 linii          | ❌ 0         |

**Priorytety testów (według wartości za pracę):**

| Priorytet | Co testować                | Przykłady                                                                 | Szac. |
| --------- | -------------------------- | ------------------------------------------------------------------------- | ----- |
| 🥇 1      | Czyste funkcje + walidacje | `collectKartaBudowyDataStep4`, `getOrderChanges`, `getOfferOrderProgress` | 1.5h  |
| 🥇 2      | Funkcje mapowania danych   | `buildOfferPrzejsciaTypes`, `_calcTransportCosts`                         | 1h    |
| 🥈 3      | Funkcje z API/mockami      | `saveCurrentOrder`, `createOrderFromOffer` (mock Prisma)                  | 1.5h  |
| 🥉 4      | Funkcje DOM/UI             | renderowanie, eventy (jsdom)                                              | 2h+   |

**Nie pisać testów dla:** Popupów, modali, złożonych interakcji DOM — ryzyko fałszywych negatywów.

**Def. Done:** typecheck ✅ test:quick ≥ obecna liczba ✅ commit ✅

---

## Deferred (warunkowe)

### T6 — wellActions.js split 🟠 5h

**Priorytet:** 8/10
**Stan:** 2458 linii, 26 window exportów.
**Warunek startu:** Dopiero po T5 (orderManager split) + stabilizacji.
**Szacowany czas:** 5h (na bazie doświadczeń z T5).

### T9 — responsive.css 🟠⚠️ 2-3 dni

**Priorytet:** 6/10
**Stan:** 42 @media queries w 5 plikach CSS (3355+1995+1807+816+440 linii).
**Status:** DEFERRED

**Warunek rozpoczęcia:**

- [ ] Playwright visual regression tests (screenshot diff)
- [ ] LUB manualna lista kontrolna widoków do sprawdzenia
- [ ] Pokrycie testami wszystkich breakpointów

**Bez tych zabezpieczeń ryzyko regresji jest nieakceptowalne.**

### T10 — JS→TS migracja 🟢 ciągły

**Priorytet:** 8/10
**Stan:** 90 plików .js, `checkJs: false` w `tsconfig.frontend.json`.
**Podejście:** Migracja stopniowa — zmienić `checkJs: true` i dodawać `// @ts-check` + JSDoc w miarę edycji plików.
**Nie robić jako osobny task** — integrować z innymi refactoringami.

---

## Podsumowanie

### Kolejność wykonania — Sprinty (rekomendowane)

```
Sprint | Zadanie | Czas | Ryzyko
-------|---------|------|-------
1      | T1 sortCol validation       | 1.5h | 🟢
1      | T8 loading="lazy"           | 0.5h | 🟢
1      | T2 Husky (audyt + update)   | 2h   | 🟠
1      | T11 apiLimiter (pomiary)    | 1h   | 🟠
       | ▶️ commit                   |      |
-------|------------------------------|------|-------
2      | T4 Quality gates (warning)  | 2.5h | 🟢
2      | T4.5 Baseline orderManager  | 2h   | 🟢
       | ▶️ commit                   |      |
-------|------------------------------|------|-------
3      | T5 orderManager split       | 6-8h | 🔴
       | ▶️ commit                   |      |
-------|------------------------------|------|-------
4      | T7 Testy krytyczne          | 4-6h | 🟢
       | ▶️ commit                   |      |
-------|------------------------------|------|-------
5      | T6 wellActions split        | 5h   | 🟠
       | ▶️ commit                   |      |
-------|------------------------------|------|-------
future | T3 Graphify postinstall     | 0.5h | 🟢
future | T9 responsive.css (DEFERRED)| —    | ⚠️
future | T10 JS→TS (ciągły)          | —    | 🟢
```

### Priorytety końcowe

| Zadanie         | Priorytet | Uzasadnienie                                      |
| --------------- | --------- | ------------------------------------------------- |
| T1 sortCol      | 10/10     | Bezpieczeństwo, niskie ryzyko, szybkie            |
| T2 Husky        | 9/10      | Developer experience, odblokowanie commitów       |
| T4 file-size    | 10/10     | Quality gate, chroni przed rozrostem plików       |
| T4.5 Baseline   | 10/10     | Warunek konieczny dla T5                          |
| T5 orderManager | 10/10     | Krytyczny refactoring, wysokie ryzyko             |
| T7 testy        | 10/10     | Zabezpieczenie przed regresją                     |
| T8 lazy iframe  | 9/10      | Performance, 1 linia zmiany                       |
| T11 apiLimiter  | 8/10      | Wymaga pomiarów przed wdrożeniem                  |
| T6 wellActions  | 8/10      | Wartościowy, ale niższy priorytet                 |
| T3 Graphify     | 7/10      | Nie wpływa na bezpieczeństwo/wydajność/stabilność |
| T10 JS→TS       | 7/10      | Proces ciągły                                     |
| T9 responsive   | 6/10      | Odłożony do czasu testów wizualnych               |

### Metryki sukcesu

| Metryka                             | Obecnie                 | Cel                                                           |
| ----------------------------------- | ----------------------- | ------------------------------------------------------------- |
| Security score                      | 9/10                    | 9.5/10                                                        |
| Max plik backend                    | 759 (pdfStudnieBuilder) | ≤500                                                          |
| Max plik frontend                   | 2739 (orderManager)     | <900 (po T5), <500 (docelowo)                                 |
| Husky commit bez `--no-verify`      | ❌                      | ✅                                                            |
| `lint:file-size` gate               | ❌                      | ✅                                                            |
| Test count                          | 1300                    | ≥1300 (testy tam gdzie ryzyko)                                |
| orderManager coverage (nowe moduły) | 0%                      | >80% nowych modułów (orderKartaBudowy, orderCrud, orderState) |
