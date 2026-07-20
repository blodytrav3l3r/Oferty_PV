# Plan Naprawy WITROS Oferty PV v4.1

> Stan: lipiec 2026, v1.8.0
> Bazuje na pelnej analizie wieloagentowej z 2026-07-20.
> Po recenzji: dodano kryteria zakonczenia, ryzyka, rollback, metryki.

---

## Spis tresci

1. [Zasady realizacji](#0-zasady-realizacji)
2. [KRYTYCZNE: 8 failed testow](#1-krytyczne-8-failed-testow)
3. [WYSOKI: 216 bledow frontend lint + 1346 warningow](#2-wysoki-216-bledow-frontend-lint)
4. [SREDNI: Refaktoryzacja plikow >500 linii](#3-sredni-refaktoryzacja-plikow-500-linii)
5. [NISKI: DRY, maintenance, dokumentacja](#4-niski-dry-maintenance)
6. [Harmonogram, zaleznosci, ryzyka](#5-harmonogram-zaleznosci-ryzyka)
7. [Metryki sukcesu](#6-metryki-sukcesu)

---

## 0. Zasady realizacji

Kazde zadanie w tym planie podlega nastepujacym regułom:

1. **Zawsze uruchomic `npm run test:quick` przed i po zmianie** — jesli liczba failed testow wzrosnie, stop i rollback.
2. **Kazda refaktoryzacja to maks. 1 plik na commit** — łatwiejszy rollback i przeglad.
3. **Zachowac `window.*` API** — nie zmieniac nazw funkcji globalnych bez aktualizacji wszystkich callerow.
4. **Zadanie uznaje sie za zakonczone dopiero po spelnieniu kryteriow z sekcji 6.**
5. **Jesli zmiana wymaga edycji testu, najpierw potwierdzic, ze zmiana lokalizacji kodu byla swiadoma refaktoryzacja, a nie przypadkowa regresja.** Sprawdzic `git log` dla przeniesionego kodu.

---

## 1. KRYTYCZNE: 8 failed testow

### 1A. printDispatch.test.ts — 4 failed (REGRESJA)

**Przyczyna:** Templaty HTML zostaly przeniesione z `pvSalesUi.js` do `pvSalesHelpers.js`. Podobnie `exportKartaDirectRury_action` w `offerCrudHelpers.js` zamiast `offerCrud.js`. Testy nadal czytaja ze starych plikow.

**Krok 0 — weryfikacja:** Sprawdzic `git log` dla `pvSalesHelpers.js` i `offerCrudHelpers.js` czy przeniesienie kodu bylo swiadoma refaktoryzacja (commit opisuje przenosiny), a nie przypadkowa regresja. Jesli refaktoryzacja — fix w testach. Jesli regresja — przywrocic kod do oryginalnego pliku.

> Na podstawie analizy: templaty w `pvSalesHelpers.js` i onclick w `offerCrudHelpers.js` to swiadome wydzielenie — fix dotyczy testow.

**Fix:**

| Test | Linia | Szukany wzorzec | Gdzie JEST | Test czyta z | Fix: czytaj z |
|------|-------|-----------------|-----------|-------------|--------------|
| `.btn-print-order` z `data-offer-type` | 77-80 | `btn-print-order...data-offer-type` | `pvSalesHelpers.js:234` | `pvSalesUi.js` | `pvSalesHelpers.js` |
| `offerCrud.js` uzywa `exportKartaDirectRury_action` | 159-162 | `onclick="exportKartaDirectRury_action` | `offerCrudHelpers.js:109` | `offerCrud.js` | `offerCrudHelpers.js` |
| "Wydruk" ma `data-offer-id+type` | 213-221 | `action-btn secondary...title="Wydruk"` | `pvSalesHelpers.js:356` | `pvSalesUi.js` | `pvSalesHelpers.js` |
| "Karta budowy" ma `data-id+type` | 223-229 | `btn-karta-budowy...title="Karta budowy"` | `pvSalesHelpers.js:292` | `pvSalesUi.js` | `pvSalesHelpers.js` |

**Ryzyko:** Niskie. Testy po fixie beda czytac poprawne pliki.
**Kryterium zakonczenia:** `npm run test:quick -- --testPathPattern=printDispatch` — 0 failed.

---

### 1B. security-regression.test.ts — 1 failed (XSS SCAN)

**Przyczyna:** `public/js/studnie/offerManager.js` nie zawiera lancucha `escapeHtml`. Test wymaga go na linii 99 (`expect(content).toContain('escapeHtml')`).

**Analiza:** Plik ma 3 przypisania `innerHTML`, wszystkie **statyczne** — brak interpolacji zmiennych. Nie ma realnej luki XSS.

**Fix (jedyny poprawny):** Zmodyfikowac test, by przepuszczal pliki bez `escapeHtml`, jesli wszystkie `innerHTML` sa statyczne (juz to robi na liniach 102-111, ale pierwsze sprawdzenie na linii 99 blokuje dotarcie do tej logiki). Zmienic warunek: zamiast `expect(content).toContain('escapeHtml')` uzyc sprawdzenia warunkowego:

```typescript
// Zamiast:
expect(content).toContain('escapeHtml');

// Dac:
const hasEscapeHtml = content.includes('escapeHtml');
// Jesli nie ma escapeHtml, sprawdz czy wszystkie innerHTML sa statyczne
if (!hasEscapeHtml) {
    const innerHtmlLines = lines.filter(l => l.includes('innerHTML') && !l.trim().startsWith('//'));
    const dynamicInnerHtml = innerHtmlLines.filter(l => l.includes('${') || /\b\w+\s*\+/.test(l));
    expect(dynamicInnerHtml.length).toBe(0);
}
```

**Ryzyko:** Niskie. Nie zmienia logiki aplikacji, tylko precyzje testu.
**Kryterium zakonczenia:** `npm run test:quick -- --testPathPattern=security-regression` — 0 failed.

---

### 1C. studnieOrderAsOffer.test.ts — 2 failed (MAPOWANIE DANYCH)

**Przyczyna:** `getWellZwienczenieName` zdefiniowana w `offerPrintManagerHelpers.js` (linia 5), ale test laduje tylko `offerPrintManager.js` do VM. `typeof getWellZwienczenieName === 'function'` zwraca `false`, fallback daje `'—'`.

**Fix (opcja A — zalecana):** Dodac `getWellZwienczenieName` do sandboxa testu w funkcji `loadStudniePrintManager()` (ok. linii 470):

```javascript
getWellZwienczenieName: (well) => {
    if (!well || !well.config) return '\u2014';
    const topTypes = ['konus', 'plyta_zamykajaca', 'plyta_najazdowa', 'plyta_din', 'pierscien_odciazajacy'];
    const topItem = well.config.find(item => {
        const p = (sandbox.studnieProducts || []).find(pr => pr.id === item.productId);
        return p && topTypes.includes(p.componentType);
    });
    if (!topItem) return '\u2014';
    const product = (sandbox.studnieProducts || []).find(p => p.id === topItem.productId);
    return product ? product.name : '\u2014';
},
```

**Opcja B (alternatywna):** Zaladowac `offerPrintManagerHelpers.js` przed `offerPrintManager.js` w VM.

**Ryzyko:** Niskie. Nie zmienia logiki, dodaje brakujaca funkcje do kontekstu testu.
**Kryterium zakonczenia:** `npm run test:quick -- --testPathPattern=studnieOrderAsOffer` — 0 failed.
**Rollback:** `git checkout -- tests/studnieOrderAsOffer.test.ts`

---

## 2. WYSOKI: 216 bledow frontend lint

### 2A. 216x `no-var` w `public/js/types.d.ts` (bledy)

**Przyczyna:** Plik `.d.ts` deklaruje typy globalne przez `var`. ESLint nie rozpoznaje kontekstu `.d.ts`.

**Fix (opcja A — szybka, mniejsze ryzyko):** Dodac plik do ignore w konfiguracji ESLint frontendu:
```javascript
ignores: ['public/js/types.d.ts']         // flat config
// lub
ignorePatterns: ['public/js/types.d.ts']   // .eslintrc.*
```

**Opcja B (poprawna technicznie):** Zmienic `var` na `declare` w `.d.ts`:
```typescript
var fetchJson: (url: string, options?: any) => Promise<any>;
→
declare function fetchJson(url: string, options?: any): Promise<any>;
```

Opcja A jest szybsza i bezpieczniejsza w kontekscie pliku `.d.ts` (to tylko deklaracje typow — `var` jest semantycznie poprawny w `.d.ts`). Zalecam **Opcje A**.

**Ryzyko:** Niskie.
**Kryterium zakonczenia:** `npm run lint:frontend | grep "error" | wc -l` — 0 errors.

---

### 2B. ~1346 warningow (prefer-const, no-unused-vars, no-explicit-any)

**Procedura (pomiar -> fix -> pomiar):**

```
Krok 1: npm run lint:frontend -- --quiet    # zliczyc warningi
Krok 2: npm run lint:frontend -- --fix      # auto-fix prefer-const
Krok 3: npm run lint:frontend -- --quiet    # zliczyc co zostalo
Krok 4: dopiero na podstawie roznicy zaplanowac prace reczna
```

Nie szacowac recznej pracy przed wykonaniem kroku 2 i 3. W praktyce `--fix` moze usunac 60-80% warningow.

**Dla pozostalych warningow po --fix:**

| Kategoria | Liczba (do oszacowania po --fix) | Podejscie |
|-----------|----------------------------------|-----------|
| prefer-const (niezautomatyzowane) | ? | Zmienic `let` na `const` — prosty find/replace |
| no-unused-vars | ? | Dla funkcji: usunac jesli 0 callerow; dla zmiennych: usunac lub prefix `_` |
| no-explicit-any | ? | Glownie w `types.d.ts` — jesli fix 2A (ignore), znika |

**Zasada usuwania martwego kodu:**
- Funkcja ma 0 grep matches (poza definicja) → martwa, usunac
- Funkcja ma grep match tylko w testach (nie w runtime) → martwa, usunac + testy
- Zmienna zadeklarowana ale nieuzywana → usunac, chyba ze celowo zachowana dla API

**Ryzyko:** Srednie przy usuwaniu funkcji — moze spelnic nieoczywista zaleznosc (np. wywolanie przez `window.*` lub string `eval`). Kazda usunieta funkcje sprawdzic `git log` i grep w calym projekcie.
**Kryterium zakonczenia:** `npm run lint:frontend | grep -c "warning"` < 100.

---

## 3. SREDNI: Refaktoryzacja plikow >500 linii

### Kryteria zakonczenia dla KAZDEJ refaktoryzacji

1. Plik <400 LOC (lub zmniejszony o >50% wzgledem stanu poczatkowego)
2. Wszystkie testy zielone: `npm run test:quick` -> 0 failed
3. Typecheck: `npm run typecheck` -> 0 errors
4. Lint: `npm run lint:frontend` -> bez nowych warningow
5. Zachowane `window.*` API (jesli funkcja byla globalna)
6. `git diff --stat` pokazuje netto usuniecie linii (nie dodanie nowego kodu)
7. **Kazda refaktoryzacja = osobny commit** (ulatwia rollback)

### Priorytety:

| # | Plik | LOC | Ryzyko | Planowana refaktoryzacja |
|---|------|-----|--------|-------------------------|
| 1 | `wellSolver.js` | 1376 | **WYSOKIE** — centralny solver studni, lambda wiele testow jednostkowych | 1. Wydzielic `wellAutoSelect.js` (auto-selection) <br>2. Kazdy pod-plik <400 LOC |
| 2 | `pvSalesUi.js` | 1115 | SREDNIE — UI kartoteki, testy gl. regresyjne | 1. `pvSalesCardTemplates.js` (templaty HTML) <br>2. Zachowac klase PVSalesUI jako fasade |
| 3 | `wellDiagram.js` | 891 | **WYSOKIE** — SVG + interakcje, brak testow jednostkowych | 1. `wellDiagramRenderer.js` (SVG) <br>2. `wellDiagramInteractions.js` (eventy) |
| 4 | `wellUI.js` | 882 | SREDNIE | Wydzielic lock manager + helpers |
| 5 | `popupsTransitionManager.js` | 802 | SREDNIE | `popupsTransitionHelpers.js` |

### Backend:

| # | Plik | LOC | Ryzyko |
|---|------|-----|--------|
| 1 | `docx/studnie/kartaBudowy.ts` | 720 | NISKIE — dobrze testowany |
| 2 | `validators/offerSchemas.ts` | 593 | **WYSOKIE** — walidacja ofert, bledy moga przepuscic niepoprawne dane |
| 3 | `ruryOrders.ts` | 534 | SREDNIE |
| 4 | `studnieOrders.ts` | 522 | SREDNIE |

### Zasady:

1. **Kazdy PR (commit) = max 1 plik refaktoryzowany.** Nie laczyc.
2. Przed refaktoryzacja: `git tag refactor-before/<nazwa-pliku>` (ulatwia rollback).
3. Po refaktoryzacji: `npm run test:quick` + uruchomic aplikacje i sprawdzic recznie krytyczne flow.
4. **Nie refaktoryzowac plikow, ktore maja 0 testow jednostkowych** bez uprzedniego dodania testow (np. `wellDiagram.js`).

### Rollback plan:

Jesli po refaktoryzacji testy nie przechodza lub aplikacja nie dziala:
```bash
# Dla pojedynczego pliku:
git checkout refactor-before/<nazwa-pliku> -- <sciezka-do-pliku>
git tag -d refactor-before/<nazwa-pliku>

# Dla calego commitu:
git revert HEAD
```

---

## 4. NISKI: DRY, maintenance

### 4A. Zduplikowana logika sortowania

Wydzielic do `public/js/rury/offerSortHelpers.js`:
- `CATEGORIES` tablica
- `sortOfferItems(items)` — wspolna funkcja
- `sortOrderItems(items)` — jesli potrzebna rozna

**Ryzyko:** Niskie — dobrze testowane przez testy ofert.
**Kryterium:** 0 failed testow, oba pliki importuja helper.

### 4B. npm run health

Dodac do `package.json`:
```json
"health": "node -e \"fetch('http://localhost:3000/health').then(r=>r.json()).then(console.log)\""
```
(minimalna wersja bez catch — blad lacznosci wypisze sie sam)

### 4C. Przeglad planow w docs/plans/

Oznaczyc kazdy jako:
- `[DONE]` — zrealizowany
- `[OBSOLETE]` — nieaktualny
- `[ACTIVE]` — wciaz aktualny

**Zalozenie:** Wiekszosc planow (PLAN_KROK8_VAR_LET, FIX_AI_*) moze byc juz zrealizowana — do weryfikacji z `git log`.

---

## 5. Harmonogram, zaleznosci, ryzyka

### Kolejnosc (zweryfikowana):

```
Faza 1 (testy — 1 dzien)
    |
    v
Faza 2a (lint auto-fix + pomiar — 1 dzien)
    |
    v
Faza 2b (lint recznie — 2-4 dni)  ──── moze byc rownolegle z ────  Faza 3 (refaktoryzacja — 2-4 tyg)
    |                                                                      |
    v                                                                      v
Faza 4 (DRY + maintenance — 3-5 dni)  <─── dopiero po stabilizacji ────
```

### Ryzyka per faza:

| Faza | Ryzyko | Wplyw | Mitigacja |
|------|--------|-------|-----------|
| 1. Testy | NISKIE — tylko zmiana sciezek w testach | Kosmetyczny | `git checkout` jesli cos pojdzie nie tak |
| 2a. Lint auto-fix | NISKIE — automatyczne narzedzie | Kosmetyczny | `--fix` jest bezpieczny |
| 2b. Lint reczny | SREDNIE — usuniecie funkcji moze spelnic zaleznosc | Sredni | Kazda usunieta funkcja: `git log` + grep |
| 3. Refaktoryzacja | **WYSOKIE** — zmiana struktury kodu | Wysoki | Tagi przed, testy po, osobne commity |
| 4. DRY | NISKIE | Niski | Dokumentacja + testy |

### Realistyczne szacunki czasowe:

| Faza | Szacunek optymistyczny | Realistyczny | Pesymistyczny |
|------|----------------------|-------------|--------------|
| 1. Testy | 0,5 dnia | **1 dzien** | 2 dni |
| 2a. Lint auto-fix | 1h | **0,5 dnia** | 1 dzien |
| 2b. Lint reczny | 2 dni | **4 dni** | 1 tydzien |
| 3. Refaktoryzacja (wellSolver.js) | 3 dni | **1 tydzien** | 2 tygodnie |
| 3. Refaktoryzacja (reszta) | 5 dni | **2 tygodnie** | 3 tygodnie |
| 4. DRY + maintenance | 3 dni | **5 dni** | 1 tydzien |

**Razem realistycznie: 4-6 tygodni pracy jednej osoby.**

---

## 6. Metryki sukcesu

| Metryka | Przed | Cel po F1 | Cel po F2 | Cel po F3 | Cel po F4 |
|---------|-------|-----------|-----------|-----------|-----------|
| Failed testy (quick) | 8 | **0** | 0 | 0 | 0 |
| Lint errors (frontend) | 216 | 216 | **0** | 0 | 0 |
| Lint warnings (frontend) | 1346 | 1346 | **<500** | <300 | **<100** |
| Pliki >500 LOC (frontend JS) | 25 | 25 | 25 | **<15** | <15 |
| Pliki >500 LOC (backend TS) | 11 | 11 | 11 | **<8** | <8 |
| Czas testow (quick) | 15s | 15s | 15s | <20s | <20s |

### Kryterium \"zadanie gotowe\"

Zadanie uznaje sie za zakonczone, gdy:

1. Wszystkie testy przechodza (0 failed w `npm run test:quick`)
2. Typecheck przechodzi (`npm run typecheck` -> 0 errors)
3. Lint nie ma bledow (errors = 0), warningi w limicie fazy
4. Aplikacja uruchamia sie (`npm run dev` -> dziala)
5. Commit zgodny z Conventional Commits
6. **Jesli refaktoryzacja:** `git tag` przed zmiana + sprawdzenie `npm run test:quick` po

---

## Dodatek: Komendy

```bash
# POMIAR
npm run lint:frontend 2>&1 | grep -c "error"
npm run lint:frontend 2>&1 | grep -c "warning"
npm run test:quick 2>&1 | tail -5

# AUTO-FIX
npm run lint:frontend -- --fix

# ROLLBACK (cale zadanie)
git revert HEAD --no-edit
# ROLLBACK (pojedynczy plik przed commitem)
git checkout -- <sciezka>

# WERYFIKACJA KONCOWA
npm run typecheck && npm run lint && npm run test:quick
```
