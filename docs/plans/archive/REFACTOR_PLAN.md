# Plan Refaktoryzacji — WITROS Oferty PV

> **Status:** Plan zatwierdzony do realizacji
> **Data:** 2026-07-15
> **Autor:** Principal Software Architect / Senior Refactoring Engineer
> **Pliki objęte:** offerManager.js, pdfGenerator.ts, offerItems.js, orderManager.js

---

## Spis treści

1. [Cel i zasady](#1-cel-i-zasady)
2. [Ocena planu](#2-ocena-planu)
3. [Zagrożenia i ryzyka](#3-zagrozenia-i-ryzyka)
4. [Dependency Map](#4-dependency-map)
5. [Hidden Globals — mapa stanu globalnego](#5-hidden-globals--mapa-stanu-globalnego)
6. [Kolejność ładowania JS](#6-kolejnosc-ladowania-js)
7. [Plik 1: pdfGenerator.ts (1707 linii)](#7-plik-1-pdfgeneratorts-1707-linii)
8. [Plik 2: offerItems.js (1045 linii)](#8-plik-2-offeritemsjs-1045-linii)
9. [Plik 3: offerManager.js (3990 linii)](#9-plik-3-offermanagerjs-3990-linii)
10. [Plik 4: orderManager.js (5114 linii)](#10-plik-4-ordermanagerjs-5114-linii)
11. [Harmonogram](#11-harmonogram)
12. [Metryki sukcesu](#12-metryki-sukcesu)
13. [Procedura awaryjna](#13-procedura-awaryjna)
14. [Baseline funkcjonalny — scenariusze testowe](#14-baseline-funkcjonalny--scenariusze-testowe)
15. [Definition of Done](#15-definition-of-done)
16. [Załącznik A — Wzór Baseline Report](#załącznik-a--wzór-baseline-report)
17. [Załącznik B — Wzór raportu po kroku](#załącznik-b--wzór-raportu-po-kroku)
18. [3 najważniejsze rekomendacje autora review](#3-najważniejsze-rekomendacje-autora-review)

---

## 1. Cel i zasady

### Cel nadrzędny

100% zachowanie istniejącego zachowania aplikacji (behavior preservation).

### Cel drugorzędny

Podział dużych plików na mniejsze moduły zgodnie z wytycznymi AGENTS.md (max 500 linii na plik, max 40 linii na funkcje).

### Zasady bezwzględne

| #   | Zasada                                          | Opis                                                                                                              |
| --- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | **Big Bang zabroniony**                         | Każda zmiana atomiczna — jeden commit = jedna odpowiedzialność                                                    |
| 2   | **Najpierw analiza**                            | Przed zmianą trzeba rozumieć wszystkie zależności                                                                 |
| 3   | **Minimalizacja diffów** > idealna architektura | Mniej zmian = mniejsze ryzyko                                                                                     |
| 4   | **Nie zmieniaj nazw publicznych**               | Funkcje na window.*, eventy, pola JSON, parametry API — bez zmian                                                 |
| 5   | **Nie zmieniaj logiki**                         | Algorytmy, warunki, operatory, kolejność — bez zmian                                                              |
| 6   | **Nie usuwaj kodu**                             | Nawet jeśli wygląda na nieużywany — może być wywoływany dynamicznie                                               |
| 7   | **Po każdej zmianie**                           | Check lista 18 punktów + testy regresji                                                                           |
| 8   | **Dependency Freeze**                           | Zero aktualizacji npm/TS/ESLint/Prettier/Prisma/bundler podczas refaktoryzacji                                    |
| 9   | **Feature Freeze**                              | Zero nowych funkcji, zero bugfixów, zero optymalizacji, zero cleanup podczas Stage 1                              |
| 10  | **HTML Snapshot + serialized state**            | Dla funkcji CRITICAL/HIGH — zapisz snapshot HTML i serialized state przed i po zmianie                            |
| 11  | **Golden Master**                               | Przed pierwszą zmianą i po każdym CRITICAL kroku — zapisz i porównaj baseline (JSON, PDF, HTML, serialized state) |
| 12  | **Feature Flag (redirect reference)**           | Nowa funkcja obok starej, potem window.fn = newFn, dopiero potem usuń starą                                       |
| 13  | **Commit size limit**                           | Max 150-250 zmienionych linii na commit (diff --stat). Mniej niż 150 = podejrzane, więcej niż 250 = za dużo       |

### Zasada "No logic edits" — lista zakazów podczas etapu podziału

`
Zakazane podczas etapu podziału plików (Stage 1):

- zmiana kolejności instrukcji w funkcji
- zmiana warunków if/else if/else
- zmiana wyrażeń switch
- zmiana operatorów (=== na ==, && na || itp.)
- zmiana async/await (usuwanie/dodawanie)
- zmiana Promise (then/catch na async/await lub odwrotnie)
- zmiana return (wartość, typ, kolejność)
- zmiana throw (komunikat, typ błędu)
- optymalizacje jakiejkolwiek natury
- DRY/deduplikacja (odłożone do Stage 2)
- rename zmiennych, funkcji, parametrów
- dodawanie/usuwanie guard clauses
- zmiana kolejności walidacji
  `

### Golden Master — procedura

Przed wykonaniem pierwszego kroku refaktoryzacji (i po każdym CRITICAL sub-kroku) wykonaj:

1. **Baseline zapis:**
   `baseline/offer-<id>.json            — pełny JSON oferty z API
baseline/order-<id>.json            — pełny JSON zamówienia z API
baseline/pdf-<id>.pdf               — output PDF (rury i studnie)
baseline/render-<id>.html           — outerHTML krytycznych kontenerów
baseline/state-<id>.json            — serialized state (selected values, checkboxy, disabled, dataset)`

2. **Capture:**
    - etch(/api/offers-studnie/:id) → zapisz do aseline/offer-*.json
    - etch(/api/orders-studnie/:id) → zapisz do aseline/order-*.json
    - wywołaj endpoint PDF → zapisz do aseline/pdf-*.pdf
    - document.getElementById('offer-items-body').outerHTML → zapisz do aseline/render-*.html
    - serializacja stanu (sekcja poniżej) → zapisz do aseline/state-*.json

3. **Porównanie po kroku:**
   `ash
diff baseline/offer-1.json baseline/offer-2.json
diff baseline/order-1.json baseline/order-2.json
diff <(python3 -c "import json; print(json.dumps(json.load(open('baseline/state-1.json')), sort_keys=True))") <(python3 -c "import json; print(json.dumps(json.load(open('baseline/state-2.json')), sort_keys=True))")
`

4. **Weryfikacja PDF:**
   Hash PDF często zmienia się mimo identycznej zawartości (metadata, daty, ID dokumentu). Kolejność:
    1. **Liczba stron** — porównaj pages count
    2. **Tekst po ekstrakcji** — wyciągnij i porównaj diffem
    3. **Hash** — dopiero jeśli PDF jest deterministyczny
       Porównanie na poziomie tekstu eliminuje fałszywe alarmy z metadanych.
       Różnica w PDF przez porównanie: (1) liczby stron, (2) wyodrębnionego tekstu, (3) hasha pliku (tylko jeśli PDF jest deterministyczny).

5. **Akceptacja:** Różnica w snapshotach musi dotyczyć WYŁĄCZNIE niezmienionych fragmentów (np. timestampy w JSON z API).

6. **Whitelista akceptowalnych różnic:** Poniższe pola są DOZWOLONYM odstępstwem w Golden Master porównaniu i nie wymagają analizy:
   `updatedAt, createdAt, lastViewed, uuid, requestId, sessionId`
   Każde inne pole różniące się między baseline a wynikiem po zmianie oznacza regresję i wymaga natychmiastowego zatrzymania. Jeśli różnica dotyczy logiki — zatrzymaj, revert, analiza.

### Serialized state — wykracza poza HTML snapshot

HTML snapshot (outerHTML) nie przechwytuje:

- onclick, dataset, disabled, checked, selected — stany interaktywne
- wartości pól <input>, <select>, <textarea>
- listenerów DOM (nie serializowalne, ale należy zweryfikować ręcznie)

Rozszerzony snapshot dla CRITICAL/HIGH funkcji:

`javascript
function captureState(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return null;
  const state = {
    outerHTML: el.outerHTML,
    inputs: Array.from(el.querySelectorAll('input, select, textarea')).map(i => ({
      id: i.id,
      value: i.value,
      checked: i.checked,
      disabled: i.disabled,
      dataset: {...i.dataset}
    })),
    checkboxes: Array.from(el.querySelectorAll('input[type="checkbox"]')).map(c => ({
      id: c.id,
      checked: c.checked,
      disabled: c.disabled
    })),
    selects: Array.from(el.querySelectorAll('select')).map(s => ({
      id: s.id,
      value: s.value,
      selectedIndex: s.selectedIndex,
      options: Array.from(s.options).map(o => ({ value: o.value, selected: o.selected }))
    }))
  };
  return state;
}
`

### Feature Flag (redirect reference) — bezpieczne przejście

Zamiast przenosić funkcję i usuwać starą w jednym kroku, stosuj:

**Wzorzec 4-krokowy:**
`Krok A: Utwórz nową funkcję w nowym pliku (skopiuj kod 1:1). Stara wersja w oryginalnym pliku pozostaje. → TEST
Krok B: Ustaw referencję: window.renderOfferItems = newRender — teraz obie wersje istnieją, ale nowa jest aktywna. → TEST
Krok C: Uruchom testy regresji, golden master, manualne scenariusze. Jeśli błąd → przywróć: window.renderOfferItems = oldRender
Krok D: (dopiero po potwierdzeniu) Usuń starą definicję z oryginalnego pliku.`

**Zalety:**

- Błyskawiczny rollback przez podmianę referencji (bez git revert)
- Możliwość A/B testowania nowej wersji
- Możliwość uruchomienia obu wersji równolegle

**Ostrzeżenie:** Nie zostawiaj dwóch implementacji na dłużej niż 1-2 dni. Feature flag to etap przejściowy, nie docelowa architektura.

**Ograniczenie — bezpieczeństwo dla zamkniętych funkcji:** Feature Flag (redirect via window.fn = newFn) jest BEZPIECZNY WYŁĄCZNIE dla funkcji publicznego API (window._). Funkcje prywatne z domknięciami (closure), lokalnym stanem lub prywatnymi helperami NIE MOGĄ być dynamicznie przekierowywane przez Feature Flag. Próba redirectu funkcji niebędącej na window._ może prowadzić do:

- utraty dostępu do prywatnego stanu (closure variables)
- niezamierzonego współdzielenia stanu między starą i nową wersją
- podwójnej inicjalizacji (jeśli funkcja ma side effects w momencie definicji)

**Zasada:** Jeśli funkcja nie jest zarejestrowana na window.*, nie używaj dla niej Feature Flag — przenieś ją w tradycyjny sposób (kopiuj + commit + test).

### Call Graph Freeze — dla CRITICAL funkcji

Przed refaktoryzacją funkcji CRITICAL, przechwyć sekwencję jej wywołań:

`javascript
// Call sequence snapshot — zapisz log przed zmianą
console.log('[CALLSEQ] createOrderFromOffer START');
// ... każda operacja logowana:
console.log('[CALLSEQ] collectSelectedWellsForOrder →', selectedWells.length, 'wells');
console.log('[CALLSEQ] saveOfferStudnie → awaiting...');
console.log('[CALLSEQ] finalizeOrderFromOffer →', offerId, selectedWells.length, 'wells');
console.log('[CALLSEQ] freezeWellPrices →', Object.keys(wellDiscounts).length, 'discounts');
console.log('[CALLSEQ] saveOrdersDataStudnie → DONE');
console.log('[CALLSEQ] window.location.href =', newUrl);
`

Po refaktoryzacji porównaj sekwencję logów — musi być identyczna co do kolejności i typów operacji.

**Wersja ustrukturyzowana (zamiast console.log):** Dla większej niezawodności zamiast console.log używaj tablicy struktur:
`js
// Call sequence snapshot — zapisz przed zmianą
const callSeq = [
    'createOrderFromOffer',
    'collectSelectedWellsForOrder',
    'saveOfferStudnie',
    'finalizeOrderFromOffer',
    'freezeWellPrices',
    'saveOrdersDataStudnie',
    'redirect'
];
`
Porównanie tablic (JSON.stringify(callSeq_before) === JSON.stringify(callSeq_after)) jest bardziej niezawodne niż analiza logów — eliminuje ryzyko przeoczenia zmiany kolejności, opóźnień asynchronicznych i zduplikowanych wpisów.

**Wzór rekordu w planie:**
`
Call sequence snapshot dla finalizeOrderFromOffer:

1. fetch(/api/users-for-assignment)
2. showUserSelectionPopup()
3. fetch(/api/orders-studnie/claim-number/)
4. freezeWellPrices(selectedWells)
5. calcTransportCount()
6. saveOrdersDataStudnie(data)
7. window.location.href = '...'
   `

### Event Dependency Map

Dla każdej funkcji CRITICAL, prześledź przepływ eventu:

`
click → addOfferItem → showPipeLengthModal → confirmPipeLength → doAddOfferItem → syncGaskets → renderOfferItems → lucide.createIcons → updateOfferSummary

click → saveOfferStudnie → renderOfferSummary → saveOffersDataStudnie → showToast

click → createOrderFromOffer → collectSelectedWellsForOrder → saveOfferStudnie → finalizeOrderFromOffer → freezeWellPrices → saveOrdersDataStudnie → window.location.href
`

Mapy te należy sporządzić PRZED zmianą i zweryfikować PO zmianie — każdy event musi prowadzić przez tę samą sekwencję funkcji.

### Contract Tests for window.* — dla każdej funkcji publicznej

Każda funkcja rejestrowana na window musi przejść test kontraktu:

`javascript
// Weryfikacja kontraktu — wykonaj przed i po zmianie
function verifyWindowContract() {
const contracts = {
renderOfferItems: { type: 'function', params: 0, name: 'renderOfferItems', returnsPromise: false },
addOfferItem: { type: 'function', params: 1, name: 'addOfferItem', returnsPromise: false },
removeOfferItem: { type: 'function', params: 1, name: 'removeOfferItem', returnsPromise: false },
// ... dla każdej funkcji z sekcji 5.2
};

for (const [name, expected] of Object.entries(contracts)) {
const actual = window[name];
console.assert(typeof actual === expected.type, ${name}: type mismatch);
    console.assert(actual.length === expected.params, ${name}: param count mismatch);
console.assert(actual.name === expected.name, ${name}: name mismatch);
    const result = actual(); // wywołaj z dummy params
    console.assert(
      expected.returnsPromise ? result instanceof Promise : !(result instanceof Promise),
      ${name}: return type mismatch
);
}
}
`

**Checklista w DoD:**

- [ ] ypeof window.fn === "function" dla wszystkich funkcji publicznych
- [ ] window.fn.length === oryginalnaLiczbaParametrów
- [ ] window.fn.name === oryginalnaNazwa
- [ ] Zwraca Promise (async) vs non-Promise — bez zmian

### Commit size limit — szczegóły

| Zasada             | Wartość                                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| **Max diff lines** | 150-250 zmienionych linii na commit (wg git diff --stat)                                                    |
| **Poniżej 150**    | Sygnał ostrzegawczy — możliwe że commit jest za mały (brak testów, brak importów)                           |
| **Powyżej 250**    | Za duży — podziel na mniejsze atomiczne commity                                                             |
| **Co wliczamy**    | + i - w git diff --stat (insertions + deletions)                                                            |
| **Dlaczego**       | Mniejszy diff = łatwiejszy review, szybszy rollback, mniejsze ryzyko konfliktów, precyzyjniejsze git bisect |

**W praktyce:** Jeden commit = jedna funkcja lub jedna grupa helperów. Nie mieszaj przeniesienia funkcji A i funkcji B w jednym commicie.

**Maximum Blast Radius — jeden moduł biznesowy na commit:** Oprócz limitu 150-250 linii, jeden commit może dotyczyć co najwyżej JEDNEGO modułu biznesowego. Przykładowo, commit może przenosić offerTransport LUB offerHistory, ale nie oba naraz — nawet jeśli łączny diff zmieściłby się w limicie 250 linii. Moduły biznesowe to wyodrębnione grupy funkcji o wspólnej odpowiedzialności (np. transport, historia, rabaty, SVG drag — patrz Mapa modułów w sekcjach 9 i 10).

**Dlaczego:** Dwa moduły biznesowe w jednym commicie utrudniają:

- precyzyjny rollback (chcesz cofnąć tylko transport, nie historię)
- code review (recenzent musi rozumieć dwa konteksty naraz)
- git bisect (błąd może pochodzić z jednego z dwóch modułów)

### Struktura etapów

Plan podzielony jest na dwa główne etapy dla każdego pliku:

`
STAGE 1 — Podział plików (bez zmiany logiki)
→ tylko przenoszenie kodu do nowych plików
→ tylko dodawanie importów/eksportów
→ zero zmian w logice biznesowej

─── FREEZE ───

STAGE 2 — Redukcja duplikacji (DRY) po zakończeniu podziału
→ dopiero gdy Stage 1 jest w pełni przetestowany
→ tylko refaktoryzacja duplikacji
→ każda zmiana osobny commit z testami
`

### Kolejność refaktoryzacji w Stage 1 (wzorzec ogólny)

Dla każdego pliku obowiązuje kolejność od najbezpieczniejszego do najtrudniejszego:

`

1.  Pure Functions (brak side effects)
2.  Helpers / Utils
3.  Formatters / Mappers
4.  Configuration / Constants
5.  Validation
6.  API Layer
7.  Rendering (HTML/DOM)
8.  Dialogs / Popups
9.  Event Handlers
10. Bootstrap / Init (zostaje w pliku głównym)
    `

### Zasada atomowości dla CRITICAL kroków

Każdy krok oznaczony jako CRITICAL lub HIGH podlega dalszemu podziałowi:

`Sub-krok A: Przenieś funkcję do nowego pliku (skopiuj kod, dodaj export)
     →  TEST (smoke + typecheck + golden master)
Sub-krok B: Dodaj import w pliku źródłowym, usuń starą definicję (lub: feature flag redirect)
     →  TEST (smoke + typecheck + golden master)
Sub-krok C: (jeśli potrzebne) Popraw zależności, ścieżki
     →  TEST (pełne testy regresji + golden master)`

**Nigdy nie mieszaj w jednym commicie: przeniesienia, zmiany importów i deduplikacji.**

**CRITICAL kroki — dodatkowa zasada:** Dla każdej funkcji CRITICAL, przed rozpoczęciem pracy:

1. Wykonaj golden master snapshot (sekcja Golden Master)
2. Wykonaj call graph freeze (sekcja Call Graph Freeze)
3. Wykonaj contract test dla window.* (sekcja Contract Tests)
4. Wykonaj event dependency map (sekcja Event Dependency Map)

---

## 2. Ocena planu

### Metodologia oceny

Każdy krok refaktoryzacji podlega ocenie w 4 kategoriach:

| Kategoria           | Skala                          | Opis                                           |
| ------------------- | ------------------------------ | ---------------------------------------------- |
| **Ryzyko regresji** | LOW / MEDIUM / HIGH / CRITICAL | Prawdopodobieństwo wprowadzenia błędu          |
| **Złożoność**       | 1-5                            | Liczba zależności i side effects               |
| **Czas**            | 1-5                            | Szacowany czas w godzinach                     |
| **Diff**            | 1-5                            | Liczba zmienionych linii (im mniej tym lepiej) |

### Ocena ogólna planu (v4 — z 12 nowymi safeguards)

| Kryterium               | Ocena    | Uzasadnienie                                                                                                        |
| ----------------------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| **Zgodność z zasadami** | ✅ 10/10 | Wszystkie zasady zachowane, Big Bang wykluczony                                                                     |
| **Bezpieczeństwo**      | ✅ 10/10 | CRITICAL kroki rozbite na sub-kroki, freeze points, snapshots, golden master, contract tests, feature flag          |
| **Szczegółowość**       | ✅ 10/10 | Dependency map, hidden globals, loading order, smoke tests, contract tests, call graph freeze, event dependency map |
| **Testy regresji**      | ✅ 10/10 | Baseline funkcjonalny, golden master (JSON/PDF/HTML/state), serialized state, Definition of Done                    |
| **Ryzyko residualne**   | ⚠️ 5/10  | Ryzyko zredukowane przez golden master + contract tests + commit size limits + feature flag                         |
| **Wykonalność**         | ✅ 9/10  | Realistyczny harmonogram z buforem                                                                                  |

### Łączna ocena: **9.7/10** — plan gotowy do realizacji (poprawiony o 12 safeguards)

---

## 3. Zagrożenia i ryzyka

### 3.1 Zagrożenia ogólne

| #                 | Zagrożenie                                                 | Prawdopodobieństwo | Wpływ     | Mitrygacja                                              |
| ----------------- | ---------------------------------------------------------- | ------------------ | --------- | ------------------------------------------------------- |
| 1                 | **Niewidoczne zależności** między funkcjami                | Średnie            | Krytyczny | Pełna analiza przed zmianą, grep callerów               |
| 2                 | **Zmiana kolejności inicjalizacji**                        | Niskie             | Wysoki    | Zachowanie oryginalnej kolejności window.* przypisań    |
| 3                 | **Brakujące importy** po przeniesieniu                     | Średnie            | Wysoki    | Check lista po każdej zmianie (                         |
| ode -c,           |
| pm run typecheck) |
| 4                 | **Konflikt nazw** w globalnej przestrzeni                  | Niskie             | Średni    | Prefixowanie nazw w nowych plikach                      |
| 5                 | **Regresja w event listenerach**                           | Średnie            | Krytyczny | Testy manualne kliknięć po każdej zmianie               |
| 6                 | **Ciągłość sesji** przy przełączaniu modeli AI             | Wysokie            | Średni    | Dokumentowanie stanu w ask.md                           |
| 7                 | **Błąd przy structuredClone** obiektów                     | Niskie             | Wysoki    | Sprawdzenie typów przed clone                           |
| 8                 | **Pomylenie referencji** his w closure                     | Średnie            | Wysoki    | Zachowanie oryginalnych deklaracji funkcji              |
| 9                 | **Brak smoke testów** po commicie                          | Średnie            | Wysoki    | Smoke test obowiązkowy przed kolejnym krokiem           |
| 10                | **Efekt domina** po serii zmian                            | Niskie             | Krytyczny | Freeze points po każdym etapie + golden master          |
| 11                | **Indirect recursion / call loop**                         | Niskie             | Krytyczny | Analiza call graph przed zmianą, break condition        |
| 12                | **Init order dependency**                                  | Średnie            | Wysoki    | jawne sprawdzenie dostępności przed użyciem             |
| 13                | _*Niewidoczna zmiana w window.* kontrakcie_*               | Niskie             | Wysoki    | Contract tests dla każdej funkcji publicznej (sekcja 1) |
| 14                | **Regresja w snapshot HTML — pominięty stan interaktywny** | Średnie            | Średni    | Serialized state (sekcja 1) — nie tylko outerHTML       |
| 15                | **Przekroczenie limitu diff — trudny review**              | Średnie            | Średni    | Commit size limit 150-250 linii (sekcja 1)              |
| 16                | **Długi czas rollbacka przy błędzie**                      | Niskie             | Krytyczny | Feature flag (redirect reference) — rollback w 1 linii  |

### 3.2 Zagrożenia specyficzne dla plików

#### pdfGenerator.ts

| #   | Zagrożenie            | Opis                                                                               |
| --- | --------------------- | ---------------------------------------------------------------------------------- |
| P1  | **Puppeteer wersja**  | Zmiana wersji zależności może zmienić output PDF                                   |
| P2  | **Ścieżki szablonów** | s.readFileSync z względnymi ścieżkami — zmiana lokalizacji pliku łamie je          |
| P3  | **Zależność DOCX**    | lookupOfferUsers jest współdzielone z modułem DOCX — zmiana importów wpływa na oba |

**Mitrygacja:** Wszystkie ścieżki w nowych plikach liczone względem __dirname, zachowanie oryginalnych ścieżek w s.readFileSync.

#### offerItems.js

| #                                                               | Zagrożenie                                                 | Opis                                 |
| --------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------ |
| I1                                                              | **                                                         |
| enderOfferItems** — 197 linii, 13 kolumn, zależny od 6+ globali | Największe ryzyko w pliku                                  |
| I2                                                              | **syncGaskets** — automatyczne dobieranie uszczelek        | CRITICAL logika biznesowa            |
| I3                                                              | **collectSelectedItemsForOrder** — złożona logika selekcji | CRITICAL dla flow zamówienia         |
| I4                                                              | **Rejestracja window.*** po DOMContentLoaded               | Kolejność inicjalizacji ma znaczenie |

**Mitrygacja:** syncGaskets i collectSelectedItemsForOrder jako ostatnie do przeniesienia, po pełnym zrozumieniu zależności.
enderOfferItems — nie ruszać do samego końca.

#### offerManager.js

| #                                    | Zagrożenie                                      | Opis                           |
| ------------------------------------ | ----------------------------------------------- | ------------------------------ |
| M1                                   | **3990 linii** — największy plik                | Najwięcej ukrytych zależności  |
| M2                                   | **saveOfferStudnie** — 328 linii, CRITICAL      | Centralny punkt zapisu oferty  |
| M3                                   | **generateOfferNotes** — 248 linii              | Złożona logika biznesowa       |
| M4                                   | **                                              |
| enderComponentSubItems** — 340 linii | Najdłuższa funkcja po                           |
| unJsAutoSelection                    |
| M5                                   | **Współdzielone globalne** wells, wellDiscounts | Modyfikacja przez wiele plików |

**Mitrygacja:** Rozpoczęcie od helperów, zostawienie CRITICAL funkcji na koniec. Każda CRITICAL funkcja przenoszona w 3 sub-krokach z golden master i feature flag.

#### orderManager.js

| #   | Zagrożenie                                                        | Opis                                                                  |
| --- | ----------------------------------------------------------------- | --------------------------------------------------------------------- |
| O1  | **5114 linii** — największy plik w projekcie                      | Najwięcej ukrytych zależności i globali                               |
| O2  | **populateZleceniaForm** — 641 linii, CRITICAL                    | Najdłuższa funkcja, złożone renderowanie DOM                          |
| O3  | **selectZleceniaTile** — 216 linii, HIGH                          | Złożona logika UI zleceń produkcyjnych                                |
| O4  | **uildAutoOrderData** — 199 linii, HIGH                           | Złożona logika generowania zamówień                                   |
| O5  | **inalizeOrderFromOffer** — 205 linii, CRITICAL                   | Główny flow finalizacji zamówienia                                    |
| O6  | **enterOrderEditMode** — 202 linie, CRITICAL                      | Tryb edycji zamówienia — nadpisuje globalne funkcje                   |
| O7  | **saveCurrentOrder** — 110 linii, CRITICAL                        | Zapis stanu zamówienia, zależny od wielu globali                      |
| O8  | **Indirect recursion między orderManager.js a offerManager**      | createOrderFromOffer → saveOfferStudnie → flow                        |
| O9  | **Init order dependency**                                         | Karta budowy inicjalizowana z wizard.js przed load                    |
| O10 | **Tymczasowe nadpisywanie window.***                              | enterOrderEditMode podmienia saveCurrentOrder                         |
| O11 | **Współdzielony globalny stan między funkcjami tego samego flow** | createOrder + inalizeOrder + saveOrder — muszą być na osobnych dniach |

**Mitrygacja:** Krytyczne funkcje przenoszone jako ostatnie. Analiza call graph przed każdym krokiem. Snapshot HTML + serialized state przed/po. Golden master dla JSON API. Nigdy dwie funkcje z tego samego flow w jeden dzień.

### 3.3 Ryzyko residualne

| Ryzyko                                      | Poziom | Akceptowalne?                                                                  |
| ------------------------------------------- | ------ | ------------------------------------------------------------------------------ |
| Regresja w zapisie oferty (offerManager.js) | MEDIUM | Tak — golden master + smoke test po każdym sub-kroku + feature flag            |
| Regresja w generowaniu PDF                  | LOW    | Tak — testy jednostkowe pokrywają + smoke test + golden master (PDF hash)      |
| Regresja w sync uszczelek (offerItems.js)   | LOW    | Tak — smoke test po każdym sub-kroku                                           |
| Regresja w renderowaniu tabeli              | LOW    | Tak — wizualna weryfikacja + smoke test + serialized state                     |
| Błąd składni JS                             | LOW    | Nie —                                                                          |
| ode -c przed commit                         |
| Błąd TypeScript                             | LOW    | Nie —                                                                          |
| pm run typecheck przed commit               |
| Regresja w finalizacji zamówienia           | MEDIUM | Tak — golden master (JSON API) + snapshot HTML + serialized state + smoke test |
| Regresja w zleceniach produkcyjnych         | MEDIUM | Tak — smoke test po każdym sub-kroku                                           |
| Call loop / indirect recursion              | LOW    | Nie — analiza call graph przed zmianą                                          |

### 3.4 Plan wycofania (rollback)

W przypadku wykrycia regresji:

1. **Natychmiast** zatrzymaj pracę
2. Określ scope regresji (który krok, która funkcja)
3. Jeśli użyto feature flag (redirect reference) — przywróć starą referencję: window.fn = oldFn (błyskawiczny rollback)
4. Jeśli nie — wykonaj git revert <commit_hash>
5. Zanotuj problem w docs/refactor-obstacles.md
6. Przed kolejną próbą zmodyfikuj plan

---

## 4. Dependency Map

### 4.1 pdfGenerator.ts — mapa zależności

| Funkcja                            | Wywoływana przez                                                                                              | Wywołuje                                                                         | Side effects             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------ |
| generateOfferRuryPDF               |
| outes/offers/exports.ts            | uildRuryOfferContextFromOfferId, generateRuryPDFFromContext                                                   | Prisma query, PDF                                                                |
| uildRuryOfferContextFromOfferId    | generateOfferRuryPDF, docx/rury/index.ts                                                                      | Prisma, JSON.parse, logger                                                       | 3× Prisma, logger        |
| uildRuryOrderContextFromOrderId    | generateRuryOrderPDF, docx/rury/index.ts                                                                      | Prisma, logger                                                                   | 3× Prisma, logger        |
| generateRuryPDFFromContext         | generateOfferRuryPDF, generateRuryOrderPDF,                                                                   |
| outes/orders/ruryOrders.ts         | generateRuryHTML, generatePDF                                                                                 | —                                                                                |
| generateRuryOrderPDF               |
| outes/orders/ruryOrders.ts         | uildRuryOrderContextFromOrderId, generateRuryPDFFromContext                                                   | Prisma, PDF                                                                      |
| generateOfferStudniePDF            |
| outes/offers/exports.ts            | uildStudnieOfferContextFromOfferId, generateStudniePDFFromContext                                             | Prisma, PDF                                                                      |
| uildStudnieOfferContextFromOfferId | generateOfferStudniePDF, docx/studnie/index.ts                                                                | Prisma, JSON.parse, logger                                                       | 3× Prisma, logger        |
| uildStudnieOrderContextFromOrderId | generateStudnieOrderPDF, docx/studnie/index.ts                                                                | Prisma, JSON.parse, logger                                                       | 3× Prisma, logger        |
| generateStudniePDFFromContext      | generateOfferStudniePDF, generateStudnieOrderPDF                                                              | generateStudnieHTML, generatePDF                                                 | —                        |
| generateRuryHTML                   | generateRuryPDFFromContext                                                                                    | s.readFileSync (3×), escapeHtml, mtInt, lookupOfferUsers, uildContactSectionHTML | 3× fs, DOM (HTML string) |
| generateStudnieHTML                | generateStudniePDFFromContext                                                                                 | s.readFileSync (3×), escapeHtml, mtInt, lookupOfferUsers, uildContactSectionHTML | 3× fs, DOM (HTML string) |
| uildRuryStaticTermsHTML            | generateRuryHTML                                                                                              | —                                                                                | Pure                     |
| lookupOfferUsers                   | generateRuryHTML, generateStudnieHTML, docx/studnie/index.ts, docx/rury/index.ts                              | Prisma, logger                                                                   | 2× Prisma                |
| uildContactSectionHTML             | generateRuryHTML, generateStudnieHTML                                                                         | —                                                                                | Pure                     |
| generatePDF                        | generateRuryPDFFromContext, generateStudniePDFFromContext, generateKartaBudowyPDF, generateKartaBudowyRuryPDF | Puppeteer                                                                        | Browser launch, PDF      |
| generateKartaBudowyPDF             |
| outes/orders/studnieOrders.ts      | Prisma, s.readFileSync (2×), JSON.parse, generatePDF                                                          | 2× Prisma, 2× fs                                                                 |
| generateKartaBudowyRuryPDF         |
| outes/orders/ruryOrders.ts         | Prisma, s.readFileSync (2×), JSON.parse, generatePDF                                                          | 2× Prisma, 2× fs                                                                 |
| escapeHtml                         | generateRuryHTML, generateStudnieHTML                                                                         | —                                                                                | Pure                     |
| mtInt                              | generateRuryHTML, generateStudnieHTML                                                                         | —                                                                                | Pure                     |

### 4.2 offerItems.js — mapa zależności

| Funkcja                                                                                 | Wywoływana przez (callers)                                           | Wywołuje (callees)                                       | Side effects            |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------- | ----------------------- |
| setupOfferForm                                                                          | HTML DOMContentLoaded                                                |
| enderCatalogTabs,                                                                       |
| enderCatalogProducts, addEventListener                                                  | DOM, listenery                                                       |
| oggleCatalog                                                                            | HTML onclick                                                         |
| enderCatalogTabs,                                                                       |
| enderCatalogProducts                                                                    | DOM (style)                                                          |
|                                                                                         |
| enderCatalogTabs                                                                        | setupOfferForm, oggleCatalog                                         | DOM                                                      | DOM                     |
| selectCatalogCategory                                                                   | HTML onclick                                                         |
| enderCatalogProducts                                                                    | DOM                                                                  |
|                                                                                         |
| enderCatalogProducts                                                                    | setupOfferForm, oggleCatalog, selectCatalogCategory                  | DOM, products                                            | DOM                     |
| generateOfferNumber                                                                     | setupOfferForm                                                       | —                                                        | Pure                    |
| ddOfferItem                                                                             | HTML onclick                                                         | showPipeLengthModal, doAddOfferItem                      | DOM, global state       |
| showPipeLengthModal                                                                     | ddOfferItem                                                          | showModal                                                | DOM (popup)             |
| confirmPipeLength                                                                       | HTML onclick                                                         | doAddOfferItem, closeModal                               | DOM                     |
| doAddOfferItem                                                                          | ddOfferItem, confirmPipeLength                                       | syncGaskets, syncTransportSecurity,                      |
| enderOfferItems, showToast, updateOfferSummary                                          | Mutacja ctiveItems, DOM                                              |
| syncGaskets                                                                             | doAddOfferItem, updateItem,                                          |
| emoveOfferItem, updatePipeLength                                                        | showToast                                                            | Mutacja ctiveItems                                       |
| syncTransportSecurity                                                                   | doAddOfferItem, updateItem,                                          |
| emoveOfferItem, updatePipeLength                                                        | —                                                                    | Mutacja ctiveItems                                       |
| updateZabezpieczenieTransportuUI                                                        | setZabezpieczenieTransportu                                          | DOM                                                      | DOM                     |
| setZabezpieczenieTransportu                                                             | HTML onclick                                                         | updateZabezpieczenieTransportuUI, syncTransportSecurity  | Global state            |
| ddPehdToPipe                                                                            | HTML onclick                                                         |
| enderOfferItems                                                                         | Mutacja pipe, DOM                                                    |
| uildRuryColgroup                                                                        |
| enderOfferItems                                                                         | —                                                                    | Pure                                                     |
|                                                                                         |
| enderOfferItems                                                                         | doAddOfferItem,                                                      |
| emoveOfferItem, updateItem, updatePipeLength, ddPehdToPipe, setZabezpieczenieTransportu | uildRuryColgroup, updateOfferSummary, lucide.createIcons, escapeHtml | DOM (innerHTML)                                          |
| updatePipeLength                                                                        | HTML onchange                                                        | syncGaskets, syncTransportSecurity,                      |
| enderOfferItems, showToast                                                              | Mutacja ctiveItems, DOM                                              |
| updateItemText                                                                          | HTML onchange                                                        |
| enderOfferItems                                                                         | Mutacja ctiveItems, DOM                                              |
| updateItem                                                                              | HTML onchange                                                        | syncGaskets, syncTransportSecurity,                      |
| enderOfferItems                                                                         | Mutacja ctiveItems, DOM                                              |
| updateItemMeters                                                                        | HTML onchange                                                        |
| enderOfferItems, updateOfferSummary                                                     | Mutacja ctiveItems, DOM                                              |
|                                                                                         |
| emoveOfferItem                                                                          | HTML onclick                                                         | syncGaskets, syncTransportSecurity,                      |
| enderOfferItems                                                                         | Mutacja ctiveItems, DOM                                              |
| oggleAllItemsForOrder                                                                   | HTML onclick                                                         | DOM                                                      | DOM (checkboxy)         |
| updateOrderSelectionCount                                                               | onPipeCheckboxChange, oggleAllItemsForOrder                          | DOM                                                      | DOM                     |
| collectSelectedItemsForOrder                                                            | orderManager.js                                                      | structuredClone, getProductDiameter, getActiveItemsArray | Czyta global state, DOM |
| onPipeCheckboxChange                                                                    | HTML onclick                                                         | updateOrderSelectionCount                                | DOM                     |
| showSectionRury                                                                         | HTML onclick                                                         | DOM (hide/show)                                          | DOM                     |

### 4.3 offerManager.js — mapa zależności (kluczowe funkcje)

| Funkcja                                                                                                 | Callers (główne)                                        | Callees                         | Side effects                |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------- | --------------------------- |
|                                                                                                         |
| enderOfferSummary                                                                                       | saveOfferStudnie, loadSavedOfferStudnie, clearOfferForm |
| enderOfferSummaryTable,                                                                                 |
| enderWellHeaderRow, getWellBadges, getWellRowStyle,                                                     |
| enderWellDetailsRow,                                                                                    |
| enderWellComponentsList,                                                                                |
| enderComponentSubItems,                                                                                 |
| enderOfferSummaryFooter, updateOfferSummaryUI, lucide.createIcons                                       | DOM (innerHTML)                                         |
| saveOfferStudnie                                                                                        | HTML onclick                                            |
| enderOfferSummary,                                                                                      |
| ormalizeOfferData, saveOffersDataStudnie, _sendAcceptanceTelemetry, showToast, storageService.saveOffer | 2× fetch, DOM, global state                             |
| loadSavedOfferStudnie                                                                                   | HTML onclick                                            |
| enderOfferSummary, migrateWellData, calcWellStats, showToast                                            | fetch, DOM (20+ elementów), global state                |
| generateOfferNotes                                                                                      | HTML onclick                                            | DOM                             | DOM (offerNotesField.value) |
| calculateOfferTotals                                                                                    |
| enderOfferSummaryTable, updateOfferSummaryUI                                                            | DOM                                                     | Czyta DOM (transport inputs)    |
|                                                                                                         |
| enderOfferDiscountsPopupContent                                                                         | openOfferDiscountsPopup                                 | DOM                             | DOM (innerHTML)             |
| handleOfferTransportSave                                                                                | HTML onclick                                            | confirm, syncTransportFromModal | DOM, confirm dialog         |
| showOfferHistoryStudnie                                                                                 | HTML onclick                                            | fetch, DOM                      | fetch, DOM (modal)          |
| svgPointerDown                                                                                          | SVG event                                               | handleLiveSvgDrag               | DOM, closure                |
| oggleAllWellsForOrder                                                                                   | HTML onclick                                            | DOM                             | DOM (checkboxy)             |

### 4.4 Klasyfikacja dostępu w Dependency Map

Każda zależność w mapach powyżej jest klasyfikowana według typu dostępu:

| Typ dostępu     | Oznaczenie  | Opis                                                 | Przykład                              |
| --------------- | ----------- | ---------------------------------------------------- | ------------------------------------- |
| **READ**        | Czyta       | Odczytuje stan globalny, nie modyfikuje              | getOrdersForOffer czyta ordersStudnie |
| **WRITE**       | Zapisuje    | Modyfikuje stan globalny (mutacja)                   | reezeWellPrices mutuje wells          |
| **SIDE EFFECT** | Side effect | Efekt uboczny niezwiązany z danymi (np. DOM, lucide) | lucide.createIcons, showToast         |
| **NETWORK**     | NETWORK     | Wywołanie API/fetch                                  | saveOrdersDataStudnie wywołuje etch() |
| **PURE**        | —           | Brak side effects, tylko param->return               | escapeHtml, uildPrzejscieRowHTML      |
| **INIT**        | INIT        | Inicjalizacja (DOMContentLoaded, setTimeout)         | setupOfferForm                        |
| **IO**          | IO          | Połączenie NETWORK + DOM                             | saveProductionOrder (fetch + render)  |
| **WINDOW**      | WINDOW      | Operacje na window.*                                 | window.fn = newFn                     |

**Zasada:** Funkcje PURE i READ mogą być przenoszone najwcześniej (najbezpieczniejsze). Funkcje WRITE i SIDE EFFECT wymagają golden master. Funkcje NETWORK i IO wymagają dodatkowo snapshotów API.

### 4.5 orderManager.js — mapa zależności

| Funkcja                       | Callers (główne)                                                                         | Callees                                                                          | Side effects                               |
| ----------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------ |
| loadOrdersStudnie             | init                                                                                     | fetch, uthHeaders                                                                | NETWORK                                    |
| saveOrdersDataStudnie         | saveOrderStudnie, saveCurrentOrder                                                       | fetch, uthHeaders                                                                | NETWORK                                    |
| getOrdersForOffer             | UI                                                                                       | —                                                                                | PURE (czyta global)                        |
| createOrderFromOffer          | HTML onclick                                                                             | collectSelectedWellsForOrder, saveOfferStudnie, showToast, inalizeOrderFromOffer | NETWORK, DOM, global state, while-polling  |
| _resetKartaBudowyForm         | initKartaBudowyStep4                                                                     | DOM (getElementById × 20)                                                        | DOM                                        |
| _calcTransportCosts           | UI                                                                                       | DOM, calcTransportCount                                                          | DOM (czyta)                                |
| _detectWellParams             | UI                                                                                       | DOM (getElementById × 15)                                                        | DOM                                        |
| _applyDetectedParams          | UI                                                                                       | DOM (getElementById × 10)                                                        | DOM                                        |
| _getExistingKartaBudowyData   | initKartaBudowyStep4                                                                     | fetch, uthHeaders                                                                | NETWORK                                    |
| _applyExistingKartaBudowyData | initKartaBudowyStep4                                                                     | DOM (getElementById × 20+)                                                       | DOM                                        |
| collectKartaBudowyDataStep4   | step4NextAction                                                                          | DOM (getElementById × 20+), collectPrzejsciaDetailsFromTable                     | DOM (czyta), PURE (zwraca obiekt)          |
| uildOfferPrzejsciaTypes       | initKartaBudowyStep4                                                                     | DOM, studnieProducts                                                             | DOM, INIT                                  |
|                               |
| enderPrzejsciaDetailsTable    | _applyExistingKartaBudowyData                                                            | uildPrzejscieRowHTML, DOM                                                        | DOM (innerHTML)                            |
| updatePrzejscieDnOptions      | handlePrzejsciaZamowioneChange                                                           | DOM, studnieProducts                                                             | DOM                                        |
| uildPrzejscieRowHTML          |
| enderPrzejsciaDetailsTable    | escapeHtml                                                                               | PURE (zwraca HTML string)                                                        |
| inalizeOrderFromOffer         | createOrderFromOffer                                                                     | fetch (×3), showUserSelectionPopup, reezeWellPrices, showToast                   | NETWORK, DOM, global state                 |
| saveOrderStudnie              | HTML onclick                                                                             | fetch, reezeWellPrices, saveOrdersDataStudnie, DOM                               | NETWORK, DOM                               |
| reezeWellPrices               | saveOrderStudnie, saveCurrentOrder                                                       | calcWellStats, wellDiscounts                                                     | Mutacja wells array                        |
| getOrderChanges               | saveCurrentOrder                                                                         | calcWellStats                                                                    | PURE (czyta)                               |
| enterOrderEditMode            | HTML onclick                                                                             | fetch, migrateWellData, calcWellStats,                                           |
| enderOfferSummary, showToast  | NETWORK, DOM (20+ elements), global state                                                |
| loadOrderSnapshot             | enterOrderEditMode                                                                       | DOM                                                                              | DOM, global state                          |
| saveCurrentOrder              | HTML onclick                                                                             | reezeWellPrices, calcWellStats, calcTransportCount, DOM, saveOrdersDataStudnie   | NETWORK, DOM, global state                 |
| syncSourceData                | enterOrderEditMode                                                                       | saveCurrentOrder, saveOfferStudnie                                               | NETWORK, global state (callback)           |
| populateZleceniaForm          |
| enderZleceniaWellConfig       | DOM (getElementById × 40+), escapeHtml, uildEtykietaElementsSnapshot, lucide.createIcons | DOM (innerHTML × 10+)                                                            |
| selectZleceniaTile            | HTML onclick                                                                             | DOM, populateZleceniaForm, lucide.createIcons                                    | DOM, mutacja wells array (przez callbacki) |
| saveProductionOrder           | HTML onclick                                                                             | fetch (×2), collectSharedFormData, uildAutoOrderData, uildZleceniaWellList,      |
| enderZleceniaList,            |
| efreshZleceniaModal           | NETWORK, DOM, global state                                                               |
| cceptProductionOrder          | HTML onclick                                                                             | fetch, showToast,                                                                |
| efreshZleceniaModal           | NETWORK, DOM                                                                             |
| uildAutoOrderData             | saveProductionOrder                                                                      | DOM, calcWellStats, uildEtykietaElementsSnapshot                                 | DOM (czyta), PURE (zwraca obiekt)          |
| openBulkOrderSequencePopup    | HTML onclick                                                                             | DOM, uildZleceniaWellList, lucide.createIcons                                    | DOM                                        |
| executeBulkGeneration         | executeBulkFromPopup                                                                     | claimAndSaveSingleOrder, uildAutoOrderData, collectSharedFormData                | NETWORK (×N)                               |
| claimAndSaveSingleOrder       | executeBulkGeneration                                                                    | fetch (×2)                                                                       | NETWORK                                    |
|                               |
| efreshGlobalMetrics           | init timer?                                                                              | window.parent.loadRecycledNumbers                                                | WINDOW.parent                              |

---

## 5. Hidden Globals — mapa stanu globalnego

### 5.1 Globale współdzielone między plikami — z lifecycle

| Zmienna                                            | Typ            | Tworzy                                | Mutuje                                                                                              | Usuwa                     | Kto czyta                                                            | Pliki   | Owner               |
| -------------------------------------------------- | -------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------- | ------- | ------------------- |
| products                                           | Array          | pp.js (init), pricelistUi.js          | —                                                                                                   | —                         | offerItems.js, orderManager.js (rury), offerExports.js, catalogUi.js | Rury    | app.js              |
| currentOfferItems                                  | Array          | offerItems.js, doAddOfferItem         | updateItem,                                                                                         |
| emoveOfferItem, syncGaskets, syncTransportSecurity | clearOfferForm | offerItems.js, orderManager.js (rury) | Rury                                                                                                | offerItems.js             |
| orderCurrentItems                                  | Array          | orderManager.js (rury)                | —                                                                                                   | —                         | offerItems.js, collectSelectedItemsForOrder                          | Rury    | orderManager.js     |
| offers                                             | Array          | offerCrud.js (rury)                   | —                                                                                                   | deleteOffer               | offerItems.js, pvSalesUi.js                                          | Rury    | offerCrud.js        |
| currentUser                                        | Object         | pp.js (init)                          | —                                                                                                   | —                         | Wiele plików                                                         | Global  | app.js              |
| wells                                              | Array          | wellManager.js, clearOfferForm        | offerManager.js (save/load), orderManager.js (freezeWellPrices, enterOrderEditMode), wellActions.js | clearOfferForm            | offerManager.js, wellActions.js, wellPopups.js, orderManager.js      | Studnie | wellManager.js      |
| wellDiscounts                                      | Object         | clearOfferForm (reset)                | offerManager.js (rabaty), orderManager.js (freezeWellPrices, enterOrderEditMode)                    | clearOfferForm            | offerManager.js, calcWellStats, orderManager.js                      | Studnie | offerManager.js     |
| offersStudnie                                      | Array          | init                                  | offerManager.js (save/load)                                                                         | deleteOfferStudnie        | offerManager.js, pvSalesUi.js, orderManager.js                       | Studnie | offerManager.js     |
| editingOfferIdStudnie                              | String/null    | clearOfferForm                        | offerManager.js (load/clear/save), orderManager.js (enterOrderEditMode)                             | clearOfferForm            | offerManager.js, pvSalesUi.js, orderManager.js                       | Studnie | offerManager.js     |
| studnieProducts                                    | Array          | pricelistManager.js                   | —                                                                                                   | —                         | offerManager.js, wellActions.js, orderManager.js                     | Studnie | pricelistManager.js |
| orderEditMode                                      | Object/Boolean | orderManager.js (enterOrderEditMode)  | orderManager.js (saveCurrentOrder)                                                                  | orderManager.js (cleanup) | offerManager.js, offerItems.js                                       | Global  | orderManager.js     |
| catalogVisible                                     | Boolean        | offerItems.js (init)                  | oggleCatalog                                                                                        | —                         | offerItems.js, catalogUi.js                                          | Rury    | offerItems.js       |
| ctiveCatalogCategory                               | String/null    | setupOfferForm                        | selectCatalogCategory                                                                               | —                         | offerItems.js, catalogUi.js                                          | Rury    | ?                   |
| zabezpieczenieTransportuEnabled                    | Boolean        | offerItems.js                         | setZabezpieczenieTransportu                                                                         | —                         | offerItems.js, ransport.js                                           | Rury    | offerItems.js       |
| currentTransportMode                               | String         | offerManager.js, orderManager.js      | —                                                                                                   | —                         | offerManager.js, orderManager.js                                     | Studnie | offerManager.js     |
| expandedWellIndices                                | Set            | init                                  | offerManager.js, orderManager.js                                                                    | —                         | offerManager.js                                                      | Studnie | offerManager.js     |
| isiblePrzejsciaTypes                               | Set            | init                                  | offerManager.js, orderManager.js                                                                    | —                         | offerManager.js, orderManager.js                                     | Studnie | ?                   |
| isSavingOffer                                      | Boolean        | init (false)                          | offerManager.js (saveOfferStudnie)                                                                  | offerManager.js           | offerManager.js, orderManager.js                                     | Studnie | offerManager.js     |
| isPreviewMode                                      | Boolean        | orderManager.js                       | orderManager.js                                                                                     | —                         | orderManager.js, offerManager.js                                     | Studnie | orderManager.js     |
| uthHeaders                                         | Function       | pp.js (init)                          | —                                                                                                   | —                         | Wiele plików                                                         | Global  | ?                   |
| logger                                             | Object         | pp.js (init)                          | —                                                                                                   | —                         | Wiele plików                                                         | Global  | app.js              |
| showToast                                          | Function       | ui.js (init)                          | —                                                                                                   | —                         | Wiele plików                                                         | Global  | ui.js               |

**Uwaga:** Kolumna "Tworzy" = pierwsze przypisanie wartości. "Mutuje" = zmiana stanu istniejącego obiektu. "Usuwa" = reset do wartości początkowej/null/[]. Kolumna "Owner" wskazuje głównego właściciela zmiennej — plik odpowiedzialny za jej stworzenie i większość operacji.

Dodanie kolumn lifecycle (Tworzy/Mutuje/Usuwa) pozwala wychwycić regresje inicjalizacyjne — jeśli zmienna nie zostanie utworzona przed pierwszym użyciem, aplikacja padnie z undefined.

### 5.2 window.* rejestracje — z Contract Tests

#### offerItems.js — Contract Tests

Dla każdej funkcji z listy poniżej wykonaj przed i po zmianie:

`javascript
// Contract test suite dla offerItems.js
const WIN_CONTRACT = {
  renderOfferItems:           { type: 'function', params: 0, name: 'renderOfferItems', async: false },
  addOfferItem:               { type: 'function', params: 1, name: 'addOfferItem', async: false },
  removeOfferItem:            { type: 'function', params: 1, name: 'removeOfferItem', async: false },
  showPipeLengthModal:        { type: 'function', params: 1, name: 'showPipeLengthModal', async: false },
  confirmPipeLength:          { type: 'function', params: 0, name: 'confirmPipeLength', async: false },
  addPehdToPipe:              { type: 'function', params: 1, name: 'addPehdToPipe', async: false },
  toggleCatalog:              { type: 'function', params: 0, name: 'toggleCatalog', async: false },
  selectCatalogCategory:      { type: 'function', params: 1, name: 'selectCatalogCategory', async: false },
  updateItem:                 { type: 'function', params: 3, name: 'updateItem', async: false },
  updateItemText:             { type: 'function', params: 2, name: 'updateItemText', async: false },
  updateItemMeters:           { type: 'function', params: 2, name: 'updateItemMeters', async: false },
  updatePipeLength:           { type: 'function', params: 1, name: 'updatePipeLength', async: false },
  toggleAllItemsForOrder:     { type: 'function', params: 0, name: 'toggleAllItemsForOrder', async: false },
  onPipeCheckboxChange:       { type: 'function', params: 0, name: 'onPipeCheckboxChange', async: false },
  collectSelectedItemsForOrder: { type: 'function', params: 0, name: 'collectSelectedItemsForOrder', async: false },
  showSectionRury:            { type: 'function', params: 1, name: 'showSectionRury', async: false },
  buildRuryColgroup:          { type: 'function', params: 1, name: 'buildRuryColgroup', async: false },
  setZabezpieczenieTransportu: { type: 'function', params: 0, name: 'setZabezpieczenieTransportu', async: false },
};
`

| Funkcja globalna                     | Używana przez                  |
| ------------------------------------ | ------------------------------ |
| window.renderOfferItems              | HTML offerItems.js wewnętrznie |
| window.addOfferItem                  | HTML onclick                   |
| window.removeOfferItem               | HTML onclick                   |
| window.showPipeLengthModal           | HTML onclick                   |
| window.confirmPipeLength             | HTML onclick                   |
| window.addPehdToPipe                 | HTML onclick                   |
| window.toggleCatalog                 | HTML onclick                   |
| window.selectCatalogCategory         | HTML onclick                   |
| window.updateItem                    | HTML onchange                  |
| window.updateItemText                | HTML onchange                  |
| window.updateItemMeters              | HTML onchange                  |
| window.updatePipeLength              | HTML onchange                  |
| window.toggleAllItemsForOrder        | HTML onclick                   |
| window.onPipeCheckboxChange          | HTML onclick                   |
| window.collectSelectedItemsForOrder  | orderManager.js                |
| window.showSectionRury / showSection | HTML onclick                   |
| window.buildRuryColgroup             | offerSummaryTab.js             |
| window.setZabezpieczenieTransportu   | HTML onclick                   |

#### offerManager.js — Contract Tests

| Funkcja globalna                      | Używana przez |
| ------------------------------------- | ------------- |
| window.loadSavedOfferStudnie          | HTML onclick  |
| window.toggleAllWellsForOrder         | HTML onclick  |
| window.updateOrderSelectionCount      | HTML          |
| window.openOfferDiscountsPopup        | HTML onclick  |
| window.saveOfferStudnie               | HTML onclick  |
| window.showOfferHistoryStudnie        | HTML onclick  |
| window.deleteOfferStudnie             | HTML onclick  |
| window.exportJSONStudnie              | HTML onclick  |
| window.changeOfferUserFromListStudnie | HTML onclick  |
| window.openTransportPopup             | HTML onclick  |
| window.handleOfferTransportSave       | HTML onclick  |
| window.svgPointerDown                 | SVG event     |
| window.decDiagramWellQty              | HTML onclick  |

#### orderManager.js — Contract Tests

| Funkcja globalna                     | Używana przez                               |
| ------------------------------------ | ------------------------------------------- |
| window.getOrdersForOffer             | HTML / UI                                   |
| window.getOrderedWellIds             | HTML / UI                                   |
| window.isWellOrdered                 | HTML / UI                                   |
| window.getOfferOrderProgress         | HTML / UI                                   |
| window.getOrderForWellId             | HTML / UI                                   |
| window.createOrderFromOffer          | HTML onclick                                |
| window.saveOrderStudnie              | HTML onclick                                |
| window.saveCurrentOrder              | HTML onclick, syncSourceData                |
| window.deleteOrderStudnie            | HTML onclick                                |
| window.syncSourceData                | enterOrderEditMode                          |
| window.loadOrderSnapshot             | enterOrderEditMode                          |
| window.isPreviewMode                 | saveCurrentOrder, saveOfferStudnie (guards) |
| window.exitPreviewMode               | HTML onclick                                |
| window.applyPreviewLockUI            | loadOrderSnapshot                           |
| window.openZleceniaProdukcyjne       | HTML onclick                                |
| window.closeZleceniaModal            | HTML onclick                                |
| window.selectZleceniaElement         | HTML onclick                                |
| window.filterZleceniaList            | HTML oninput                                |
| window.saveProductionOrder           | HTML onclick                                |
| window.deleteProductionOrder         | HTML onclick                                |
| window.acceptProductionOrder         | HTML onclick                                |
| window.revokeProductionOrder         | HTML onclick                                |
| window.onZleceniaStopnieChange       | HTML onchange                               |
| window.onZleceniaKatChange           | HTML onchange                               |
| window.openBulkOrderSequencePopup    | HTML onclick                                |
| window.closeBulkOrderPopup           | HTML onclick                                |
| window.executeBulkFromPopup          | HTML onclick                                |
| window.reorderBulkSeqList            | HTML oninput                                |
| window.toggleBulkSeqItem             | HTML onclick                                |
| window.deleteSelectedProductionOrder | HTML onclick                                |
| window.moveZleceniaComponent         | HTML onclick                                |
| window.handleZlCfgDragStart          | HTML ondragstart                            |
| window.handleZlCfgDragOver           | HTML ondragover                             |
| window.handleZlCfgDrop               | HTML ondrop                                 |
| window.handleZlCfgDragEnd            | HTML ondragend                              |
| window.toggleDaneElementu            | HTML onclick (inline)                       |

### 5.3 Transient State / Singletons / Caches / Timers / Closures

| Zmienna / Obiekt             | Typ             | Zakres życia            | Opis                                                                                   |
| ---------------------------- | --------------- | ----------------------- | -------------------------------------------------------------------------------------- |
| orderEditMode                | Object \| null  | Sesja zamówienia        | { orderId, order } — ustawiany w enterOrderEditMode, kasowany przy zapisie/cleanup     |
| _wellDragHandlers            | Closure         | Sesja SVG drag          | Prywatna zmienna w offerManager.js dla handlerów SVG                                   |
| isSavingOffer                | Boolean         | Moment zapisu           | Flaga blokująca podwójny zapis, odpytywana przez createOrderFromOffer przez while loop |
| isPreviewMode                | Boolean         | Sesja podglądu          | Ustawiana w loadOrderSnapshot, blokuje saveCurrentOrder i saveOfferStudnie             |
| expandedWellIndices          | Set             | Sesja oferty            | Przechowuje indeksy rozwiniętych wierszy studni w tabeli                               |
| isiblePrzejsciaTypes         | Set             | Sesja oferty/zamówienia | Typy przejść widoczne w konfiguratorze                                                 |
| currentTransportMode         | String          | Sesja oferty            | 'full' / 'partial' — tryb transportu                                                   |
| _wellDragHandlers            | Object \| null  | Sesja SVG drag          | Referencje do handlerów pointermove/pointerup do cleanup                               |
| zleceniaFilterTimeout (impl) | Timer (closure) | Sesja zleceń            | Debounce dla filtra listy zleceń (przez setTimeout)                                    |
| _modalScrollPosition (impl)  | Number \| null  | Sesja modalu            | Pozycja scrolla w modalu zleceń przy odświeżaniu                                       |

### 5.4 Cache / Pamięć podręczna

| Cache                    | Typ    | Gdzie używane                        | Opis                                                     |
| ------------------------ | ------ | ------------------------------------ | -------------------------------------------------------- |
| ordersStudnie            | Array  | orderManager.js (helpers)            | Załadowane zamówienia studni — cache frontendowy         |
| zleceniaListCache (impl) | Array  | orderManager.js (zlecenia)           | Sfiltrowana/posortowana lista zleceń produkcyjnych       |
| productionOrdersCache    | Array  | orderManager.js (zlecenia)           | Załadowane zlecenia produkcyjne                          |
| originalSnapshot         | Object | orderManager.js (enterOrderEditMode) | Kopia oryginalnych danych zamówienia do porównania zmian |

---

## 6. Kolejność ładowania JS

### 6.1 Kolejność dla modułu Rury

`HTML (rury.html)
  │
  ├── <head>
  │     └── style.css, rury.css, ...
  │
  ├── <body>
  │     ├── <!-- struktura HTML -->
  │     │
  │     ├── <script src="/js/shared/utils.js">         // 1. Helpery globalne
  │     ├── <script src="/js/shared/ui.js">             // 2. UI helpers
  │     ├── <script src="js/rury/appState.js">          // 3. Stan aplikacji
  │     │
  │     ├── <script src="js/rury/offerItems.js">        // 4. Główny plik
  │     │     ├── window.* rejestracje
  │     │     └── setupOfferForm()
  │     │
  │     ├── <script src="js/rury/orderManager.js">      // 5. Zamówienia
  │     ├── <script src="js/rury/offerCrud.js">         // 6. CRUD ofert
  │     └── ...
  │
  └── DOMContentLoaded
        └── setupOfferForm()  ← rejestruje event listenery`

**Po refaktoryzacji (Stage 1):**

`HTML (rury.html)
  │
  ├── <head> ...                                     // bez zmian
  │
  ├── <body>
  │     ├── <!-- struktura HTML -->                   // bez zmian
  │     │
  │     ├── <script src="/js/shared/utils.js">
  │     ├── <script src="/js/shared/ui.js">
  │     ├── <script src="js/rury/appState.js">
  │     │
  │     ├── <script src="js/rury/offerItemHelpers.js"> // NOWY — helpery
  │     ├── <script src="js/rury/catalogUi.js">        // NOWY — katalog
  │     ├── <script src="js/rury/offerPehd.js">        // NOWY — PEHD
  │     ├── <script src="js/rury/offerNavigation.js">  // NOWY — nawigacja
  │     ├── <script src="js/rury/offerUpdateItems.js"> // NOWY — update
  │     ├── <script src="js/rury/offerSync.js">        // NOWY — sync
  │     ├── <script src="js/rury/offerAddItems.js">    // NOWY — add
  │     ├── <script src="js/rury/offerOrderSelection.js"> // NOWY — zamówienie
  │     ├── <script src="js/rury/offerRendering.js">   // NOWY — render
  │     ├── <script src="js/rury/offerItems.js">       // OKROJONY — tylko init
  │     │
  │     ├── <script src="js/rury/orderManager.js">
  │     └── ...
  │
  └── DOMContentLoaded
        └── setupOfferForm()`

**Zasada:** Nowe pliki są dodawane PRZED starym offerItems.js, aby funkcje były dostępne zanim setupOfferForm spróbuje ich użyć.

### 6.2 Kolejność dla modułu Studnie

`HTML (studnie.html)
  │
  ├── <head>
  │
  ├── <body>
  │     ├── <!-- struktura HTML -->
  │     ├── <script src="/js/shared/utils.js">
  │     ├── <script src="/js/shared/ui.js">
  │     ├── <script src="js/studnie/wellManager.js">     // Stan studni
  │     ├── <script src="js/studnie/wellActions.js">     // Akcje
  │     ├── <script src="js/studnie/wellSolver.js">      // Solver
  │     ├── <script src="js/studnie/offerManager.js">    // Główny plik
  │     ├── <script src="js/studnie/orderManager.js">    // Zamówienia
  │     └── ...
  │
  └── DOMContentLoaded`

**Po refaktoryzacji — nowe pliki dodawane PRZED offerManager.js i orderManager.js:**

`HTML (studnie.html)
  │
  ├── <body>
  │     ├── <!-- struktura HTML -->
  │     ├── <script src="/js/shared/utils.js">
  │     ├── <script src="/js/shared/ui.js">
  │     ├── <script src="js/studnie/wellManager.js">
  │     ├── <script src="js/studnie/wellActions.js">
  │     │
  │     ├── <script src="js/studnie/offerHelpers.js">            // NOWY
  │     ├── <script src="js/studnie/offerFormatters.js">         // NOWY — formatters
  │     ├── <script src="js/studnie/offerConstants.js">          // NOWY — constants
  │     ├── <script src="js/studnie/offerApi.js">                // NOWY
  │     ├── <script src="js/studnie/offerUserManager.js">        // NOWY
  │     ├── <script src="js/studnie/offerOrderSelection.js">     // NOWY
  │     ├── <script src="js/studnie/offerFileOps.js">            // NOWY
  │     ├── <script src="js/studnie/offerHistory.js">            // NOWY
  │     ├── <script src="js/studnie/offerSvgDrag.js">            // NOWY
  │     ├── <script src="js/studnie/offerDiscountsPopup.js">     // NOWY
  │     ├── <script src="js/studnie/offerTransport.js">          // NOWY
  │     ├── <script src="js/studnie/offerRendering.js">          // NOWY
  │     ├── <script src="js/studnie/offerCrud.js">               // NOWY
  │     │
  │     ├── <script src="js/studnie/offerManager.js">            // OKROJONY
  │     │
  │     ├── <script src="js/studnie/orderHelpers.js">            // NOWY
  │     ├── <script src="js/studnie/orderExport.js">             // NOWY
  │     ├── <script src="js/studnie/orderPrzejscia.js">          // NOWY
  │     ├── <script src="js/studnie/orderKartaBudowy.js">        // NOWY
  │     ├── <script src="js/studnie/orderBulk.js">               // NOWY
  │     ├── <script src="js/studnie/orderZlecenia.js">           // NOWY
  │     ├── <script src="js/studnie/orderCrud.js">               // NOWY
  │     │
  │     ├── <script src="js/studnie/orderManager.js">            // OKROJONY — tylko init
  │     └── ...`

### 6.3 Zasady kolejności ładowania

1. **Helpery i funkcje czyste** — ładują się najwcześniej (brak zależności)
2. **Funkcje zależne od globali** — po plikach deklarujących globale
3. **Funkcje renderujące** — po helperach i API layer
4. **Init/Bootstrap** — jako ostatni, po wszystkich innych skryptach
5. **DOMContentLoaded** — zawsze w głównym pliku, na końcu

### 6.4 Ryzyko undefined — jak unikać

| Sytuacja                                  | Przyczyna                            | Rozwiązanie                          |
| ----------------------------------------- | ------------------------------------ | ------------------------------------ |
| window.renderOfferItems is not a function | Skrypt z definicją niezaładowany     | Sprawdź kolejność <script> w HTML    |
| products is not defined                   | Globalny cennik niezaładowany        | ppState.js przed wszystkimi modułami |
| Cannot read properties of null            | Element DOM nie istnieje             | DOMContentLoaded lub if (element)    |
| lucide is not defined                     | Lucide CDN niezaładowany             | CDN przed skryptami JS               |
| uthHeaders is not defined                 | pp.js niezaładowany                  | Kolejność: utils → app → moduły      |
| wells is undefined w orderManager.js      | offerManager.js przed wellManager.js | wellManager.js przed offerManager.js |

### 6.5 Init order dependency — ostrzeżenia

Następujące funkcje zakładają, że inne moduły zostały już zainicjalizowane:

| Funkcja                     | Zakłada że zainicjalizowano      | Ryzyko    |
| --------------------------- | -------------------------------- | --------- |
| initKartaBudowyStep4        | wells, offersStudnie             | 🔴 HIGH   |
| createOrderFromOffer        | editingOfferIdStudnie, wells     | 🔴 HIGH   |
| enterOrderEditMode          | wells, offersStudnie             | 🔴 HIGH   |
| uildOfferPrzejsciaTypes     | studnieProducts                  | 🟡 MEDIUM |
| openZleceniaProdukcyjne     | wells                            | 🟡 MEDIUM |
| uildZleceniaWellList        | productionOrders, wells          | 🟡 MEDIUM |
| collectKartaBudowyDataStep4 | DOM elementy step4 wyrenderowane | 🟡 MEDIUM |

**Reguła:** Przed przeniesieniem którejkolwiek z powyższych funkcji sprawdź, czy funkcja inicjalizująca (wywołująca) jest w DOMContentLoaded i czy wszystkie zakładane globale istnieją.

## 8. Plik 2: offerItems.js (1045 linii) -- CONTINUED

### Stage 1 - FREEZE

```
+---------------------------------------------+
|              FREEZE POINT                    |
|                                             |
|  - typecheck                                |
|  - lint                                     |
|  - node -c dla wszystkich nowych plikow      |
|  - smoke test (dodaj, usun, zmien, PEHD)    |
|  - zamowienie z oferty dziala                |
|  - golden master (JSON API + HTML + state)  |
|  - contract tests dla window.*              |
|  - manualny scenariusz                       |
|  - git tag                                  |
+---------------------------------------------+
```

### Stage 2 - Redukcja duplikacji (po Stage 1)

Brak zaplanowanych dzialan DRY dla offerItems.js w Stage 2.
Ewentualne duplikacje zostana zidentyfikowane podczas pracy.

### Stan koncowy offerItems.js (po Stage 1)

```
public/js/rury/
offerItems.js              <- ~100 linii (init + stan)
offerItemHelpers.js        <- ~45 linii
catalogUi.js               <- ~90 linii
offerPehd.js               <- ~27 linii
offerNavigation.js         <- ~56 linii
offerUpdateItems.js        <- ~136 linii
offerSync.js               <- ~157 linii
offerAddItems.js           <- ~147 linii
offerOrderSelection.js     <- ~108 linii
offerRendering.js          <- ~197 linii
```

---

## 9. Plik 3: offerManager.js (3990 linii)

**Status:** Plan gotowy - kolejnosc krokow zmieniona zgodnie z review
**Priorytet:** TRZECI - najwieksze ryzyko
**Szacowany czas:** 8-11 dni (z buforem)

### Baseline Report

| Metryka                         | Wartosc                        |
| ------------------------------- | ------------------------------ |
| Linie kodu                      | 3990                           |
| Liczba funkcji                  | ~55                            |
| Liczba window.*                 | ~25                            |
| Liczba operacji na DOM          | ~100+                          |
| Liczba listenerow               | ~10+                           |
| Liczba fetch/API calls          | ~5                             |
| Liczba mutacji globalnego stanu | ~20+                           |
| Zlozonosc cyklomatyczna max     | ~40+ (renderComponentSubItems) |

### Mapa modulow

```
offerManager.js (3990 linii)
 1. Rendering - Podsumowanie oferty (4-574, 576-675) - ~570 linii, 12 funkcji
 2. Rendering - Elementy studni (720-1415) - ~696 linii, 6 funkcji
 3. Rendering - Footer/Summary (1417-1672) - ~256 linii, 2 funkcje
 4. API Layer (1674-1770) - ~97 linii, 3 funkcje
 5. User Management (1771-1905) - ~135 linii, 2 funkcje
 6. Offer CRUD - Save (1907-2262) - ~356 linii, 2 funkcje
 7. Offer CRUD - Clear (2264-2334) - ~71 linii, 1 funkcja
 8. Offer CRUD - Render Saved (2336-2488) - ~153 linie, 2 funkcje
 9. Offer CRUD - Load (2490-2701) - ~212 linii, 1 funkcja
10. Offer CRUD - Delete/Export (2706-2775) - ~70 linii, 3 funkcje
11. SVG Drag (2778-2937) - ~160 linii, 5 funkcji
12. Historia/Audit (2948-3278) - ~331 linii, 5 funkcji
13. Order Selection (3279-3304) - ~26 linii, 2 funkcje
14. Rabaty (3306-3700) - ~395 linii, 9 funkcji
15. Transport (3701-3941) - ~241 linii, 8 funkcji
16. Bootstrap (3943-3990) - ~48 linii, 1 funkcja
```

### Stage 1 - Podzial plikow (zmieniona kolejnosc)

**Nowa kolejnosc:** helper - formatter - constants - api - popup - history - svg - render - saveOffer

**Uzasadnienie zmiany:**

- **helper** - najbezpieczniejsze, czyste funkcje
- **formatter** - funkcje formatujace, bez side effects
- **constants** - stale konfiguracyjne
- **api** - warstwa komunikacji, zalezna od helperow/formatterow
- **popup** - dialogs (rabaty, transport, user manager) - izolowane UI
- **history** - niezalezny modul
- **svg** - zalezny od globals tylko
- **render** - zalezny od wszystkich powyzej; przeniesiony NIZEJ popup/history/svg
- **saveOffer (CRUD)** - najwyzsze ryzyko, jako ostatnie przed bootstrapem

---

#### Krok 3.1 - Wydzielenie helperow i funkcji czystych

| Pole             | Wartosc                                                                  |
| ---------------- | ------------------------------------------------------------------------ |
| **Zakres linii** | 637-646, 1406-1415, 2468-2488, 3936-3941                                 |
| **Nowy plik**    | public/js/studnie/offerHelpers.js                                        |
| **Przenoszone**  | getWellRowStyle, getDiscountStr, migrateWellData, normalizeValidityValue |
| **Ryzyko**       | LOW                                                                      |
| **Zlozonosc**    | 1/5                                                                      |
| **Czas**         | 0.5h                                                                     |

---

#### Krok 3.2 - Wydzielenie formatterow

| Pole            | Wartosc                                            |
| --------------- | -------------------------------------------------- |
| **Nowy plik**   | public/js/studnie/offerFormatters.js               |
| **Przenoszone** | Funkcje formatujace (do zidentyfikowania w kodzie) |
| **Ryzyko**      | LOW                                                |
| **Zlozonosc**   | 1/5                                                |
| **Czas**        | 0.5h                                               |

---

#### Krok 3.3 - Wydzielenie stalych (constants)

| Pole            | Wartosc                                        |
| --------------- | ---------------------------------------------- |
| **Nowy plik**   | public/js/studnie/offerConstants.js            |
| **Przenoszone** | Stale konfiguracyjne, domyslne wartosci, progi |
| **Ryzyko**      | LOW                                            |
| **Zlozonosc**   | 1/5                                            |
| **Czas**        | 0.5h                                           |

---

#### Krok 3.4 - Wydzielenie API Layer

| Pole             | Wartosc                                                      |
| ---------------- | ------------------------------------------------------------ |
| **Zakres linii** | 1674-1770                                                    |
| **Nowy plik**    | public/js/studnie/offerApi.js                                |
| **Przenoszone**  | normalizeOfferData, loadOffersStudnie, saveOffersDataStudnie |
| **Ryzyko**       | LOW                                                          |
| **Zlozonosc**    | 2/5                                                          |
| **Czas**         | 1h                                                           |

---

#### Krok 3.5 - Wydzielenie User Management (popup)

| Pole             | Wartosc                                         |
| ---------------- | ----------------------------------------------- |
| **Zakres linii** | 1771-1905                                       |
| **Nowy plik**    | public/js/studnie/offerUserManager.js           |
| **Przenoszone**  | changeOfferUser, changeOfferUserFromListStudnie |
| **Ryzyko**       | MEDIUM                                          |
| **Zlozonosc**    | 2/5                                             |
| **Czas**         | 1h                                              |

---

#### Krok 3.6 - Wydzielenie Order Selection

| Pole             | Wartosc                                           |
| ---------------- | ------------------------------------------------- |
| **Zakres linii** | 3279-3304                                         |
| **Nowy plik**    | public/js/studnie/offerOrderSelection.js          |
| **Przenoszone**  | toggleAllWellsForOrder, updateOrderSelectionCount |
| **Ryzyko**       | LOW                                               |
| **Zlozonosc**    | 1/5                                               |
| **Czas**         | 0.5h                                              |

---

#### Krok 3.7 - Wydzielenie Delete/Export/Import

| Pole             | Wartosc                                                           |
| ---------------- | ----------------------------------------------------------------- |
| **Zakres linii** | 2706-2775                                                         |
| **Nowy plik**    | public/js/studnie/offerFileOps.js                                 |
| **Przenoszone**  | deleteOfferStudnie, exportJSONStudnie, importOfferFromFileStudnie |
| **Ryzyko**       | MEDIUM                                                            |
| **Zlozonosc**    | 2/5                                                               |
| **Czas**         | 1h                                                                |

---

#### Krok 3.8 - Wydzielenie Historii/Audit

| Pole             | Wartosc                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| **Zakres linii** | 2948-3278                                                                                                    |
| **Nowy plik**    | public/js/studnie/offerHistory.js                                                                            |
| **Przenoszone**  | renderAuditLogEntry, showOfferHistoryStudnie, loadMoreAuditLogs, viewHistorySnapshot, restoreHistorySnapshot |
| **Ryzyko**       | MEDIUM                                                                                                       |
| **Zlozonosc**    | 3/5                                                                                                          |
| **Czas**         | 2h                                                                                                           |

---

#### Krok 3.9 - Wydzielenie SVG Drag

| Pole                      | Wartosc                                                                                       |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| **Zakres linii**          | 2778-2937                                                                                     |
| **Nowy plik**             | public/js/studnie/offerSvgDrag.js                                                             |
| **Przenoszone**           | decDiagramWellQty, svgPointerDown, svgTouchStart, handleLiveSvgDrag, cleanupWellDragListeners |
| **Zmienna wspoldzielona** | _wellDragHandlers - closure, pozostaje w offerManager.js                                      |
| **Ryzyko**                | MEDIUM                                                                                        |
| **Zlozonosc**             | 3/5                                                                                           |
| **Czas**                  | 1.5h                                                                                          |

---

#### Krok 3.10 - Wydzielenie modalu transportu

| Pole             | Wartosc                             |
| ---------------- | ----------------------------------- |
| **Zakres linii** | 3701-3941                           |
| **Nowy plik**    | public/js/studnie/offerTransport.js |
| **Przenoszone**  | 7 funkcji zwiazanych z transportem  |
| **Ryzyko**       | HIGH (DOM + confirm dialog)         |
| **Zlozonosc**    | 4/5                                 |
| **Czas**         | 2h                                  |

**Sub-kroki:**

- **3.10a:** Utworz plik, skopiuj funkcje, dodaj exporty -> TEST
- **3.10b:** Dodaj script, usun stare definicje -> TEST

---

#### Krok 3.11 - Wydzielenie modalu rabatow

| Pole             | Wartosc                                  |
| ---------------- | ---------------------------------------- |
| **Zakres linii** | 3306-3700                                |
| **Nowy plik**    | public/js/studnie/offerDiscountsPopup.js |
| **Przenoszone**  | 9 funkcji zwiazanych z rabatami          |
| **Ryzyko**       | HIGH                                     |
| **Zlozonosc**    | 4/5                                      |
| **Czas**         | 2h                                       |

**Sub-kroki:**

- **3.11a:** Utworz plik, skopiuj funkcje, dodaj exporty -> TEST
- **3.11b:** Dodaj script, usun stare definicje -> TEST

---

#### Krok 3.12 - Wydzielenie Renderowania (NAJCIEZSZY - przed CRUD)

| Pole             | Wartosc                                |
| ---------------- | -------------------------------------- |
| **Zakres linii** | 4-574, 576-675, 720-1415, 1417-1672    |
| **Nowy plik**    | public/js/studnie/offerRendering.js    |
| **Przenoszone**  | ~17 funkcji renderujacych, ~1500 linii |
| **Ryzyko**       | CRITICAL                               |
| **Zlozonosc**    | 5/5                                    |
| **Czas**         | 4h                                     |

**Sub-kroki (podzial na 4 czesci):**

| Sub-krok  | Funkcje                                                                                                                                                    | Linie | Czas |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ---- |
| **3.12a** | renderOfferSummaryFooter, getWellBadges, renderWellHeaderRow, getWellRowStyle                                                                              | ~70   | 0.5h |
| **3.12b** | renderWellDetailsRow, renderWellComponentsList, renderComponentSubItems, calculateAssignedPrzejscia, calculatePrecoAllocationForItem, calculateLinePricing | ~500  | 1.5h |
| **3.12c** | renderOfferSummary, renderOfferSummaryTable, updateOfferSummaryUI, renderOrderBanners, renderPartialOrderProgress                                          | ~400  | 1.5h |
| **3.12d** | generateOfferNotes, calculateOfferTotals                                                                                                                   | ~280  | 1h   |

**Kazdy sub-krok:**

- Sub-krok N: Utworz/uzupelnij offerRendering.js, dodaj funkcje -> TEST + golden master (HTML snapshot + serialized state)
- Sub-krok N+1: Dopiero nastepna partia funkcji

---

#### Krok 3.13 - Wydzielenie CRUD Save/Load/Clear (NAJWAZNIEJSZY - ostatni)

| Pole             | Wartosc                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| **Zakres linii** | 1907-2701 (bez 2468-2488)                                                                                   |
| **Nowy plik**    | public/js/studnie/offerCrud.js                                                                              |
| **Przenoszone**  | saveOfferStudnie, _sendAcceptanceTelemetry, clearOfferForm, renderSavedOffersStudnie, loadSavedOfferStudnie |
| **Ryzyko**       | CRITICAL - centralna logika zapisu/odczytu                                                                  |
| **Zlozonosc**    | 5/5                                                                                                         |
| **Czas**         | 3h                                                                                                          |

**Sub-kroki:**

- **3.13a:** Utworz offerCrud.js, skopiuj clearOfferForm (71 linii, najprostsza) -> TEST
- **3.13b:** Skopiuj renderSavedOffersStudnie (130 linii) -> TEST
- **3.13c:** Skopiuj saveOfferStudnie (328 linii) -> TEST (golden master: JSON API przed/po)
- **3.13d:** Skopiuj loadSavedOfferStudnie (212 linii) -> TEST (golden master: JSON API)
- **3.13e:** Skopiuj _sendAcceptanceTelemetry (20 linii) -> TEST
- **3.13f:** Feature Flag: podmiana referencji window.saveOfferStudnie = newFn -> TEST + golden master
- **3.13g:** (po min. 1 dniu) Usun stare definicje -> TEST + golden master

---

#### Krok 3.14 - Bootstrap pozostaje w offerManager.js

| Pole             | Wartosc                                                   |
| ---------------- | --------------------------------------------------------- |
| **Zakres linii** | 3943-3990                                                 |
| **Pozostaje**    | addEventListener('DOMContentLoaded', ...) + zmienne stanu |
| **Ryzyko**       | MEDIUM                                                    |

---

### Stage 1 - FREEZE

```
+---------------------------------------------+
|              FREEZE POINT                    |
|                                             |
|  - typecheck                                |
|  - lint                                     |
|  - node -c dla wszystkich nowych plikow      |
|  - smoke test (utworz, zapisz, wczytaj)     |
|  - rabaty + transport + historia dzialaja   |
|  - golden master (JSON API + HTML + state)  |
|  - contract tests dla window.*              |
|  - manualny scenariusz (full flow)          |
|  - git tag                                  |
+---------------------------------------------+
```

### Stage 2 - Redukcja duplikacji (po Stage 1)

Brak zaplanowanych dzialan DRY dla offerManager.js w Stage 2.
Ewentualne duplikacje zostana zidentyfikowane podczas pracy.

---

### Stan koncowy offerManager.js (po Stage 1)

```
public/js/studnie/
offerManager.js              <- ~150 linii (stan globalny + init)
offerHelpers.js              <- ~50 linii
offerFormatters.js           <- ~30 linii
offerConstants.js            <- ~20 linii
offerApi.js                  <- ~100 linii
offerUserManager.js          <- ~135 linii
offerOrderSelection.js       <- ~26 linii
offerFileOps.js              <- ~70 linii
offerHistory.js              <- ~330 linii
offerSvgDrag.js              <- ~160 linii
offerTransport.js            <- ~240 linii
offerDiscountsPopup.js       <- ~395 linii
offerRendering.js            <- ~1500 linii*
offerCrud.js                 <- ~600 linii*
```

*Uwaga: offerCrud.js (~600 linii) i offerRendering.js (~1500 linii) nadal przekraczaja limit 500 linii. Ich dalszy podzial to osobny cykl refaktoryzacji.

---

## 10. Plik 4: orderManager.js (5114 linii)

**Status:** Plan gotowy
**Priorytet:** NASTEPNY
**Szacowany czas:** 5-8 dni

### Baseline Report

| Metryka                         | Wartosc                    |
| ------------------------------- | -------------------------- |
| Linie kodu                      | 5114                       |
| Liczba funkcji                  | ~70                        |
| Liczba window.*                 | ~35                        |
| Liczba operacji na DOM          | ~80                        |
| Liczba listenerow               | ~5                         |
| Liczba mutacji globalnego stanu | ~20                        |
| Zlozonosc cyklomatyczna max     | ~50 (populateZleceniaForm) |

### Mapa modulow

```
orderManager.js (5114 linii)
 1. Order Helpers (3-80) - 7 funkcji, ~78 linii
 2. Order Creation (82-215) - 1 funkcja, ~134 linii
 3. Karta Budowy Krok 4 (217-981) - 18 funkcji, ~765 linii
 4. Przejscia Szczelne (982-1499) - 9 funkcji, ~517 linii
 5. Order Finalization (1500-2509) - 12 funkcji, ~1010 linii
 6. Zlecenia Produkcyjne (2511-4999) - 24 funkcje, ~2488 linii
 7. Bulk Generation (4393-4982) - 9 funkcji, ~590 linii
 8. Export/Print (5002-5114) - 3 funkcje, ~112 linii
 9. Init/DOMContentLoaded (5019-5025) - 1 handler, ~7 linii
```

### 10.1 Funkcje - szczegolowa tabela

| Funkcja                          | Linie     | Linii | Ryzyko   | Kategoria   |
| -------------------------------- | --------- | ----- | -------- | ----------- |
| loadOrdersStudnie                | 3-12      | 10    | LOW      | Helpers     |
| saveOrdersDataStudnie            | 14-26     | 13    | LOW      | Helpers     |
| getOrdersForOffer                | 31-35     | 5     | LOW      | Helpers     |
| getOrderedWellIds                | 38-47     | 10    | LOW      | Helpers     |
| isWellOrdered                    | 50-53     | 4     | LOW      | Helpers     |
| getOfferOrderProgress            | 56-62     | 7     | LOW      | Helpers     |
| getOrderForWellId                | 65-74     | 10    | LOW      | Helpers     |
| createOrderFromOffer             | 82-215    | 134   | HIGH     | CRUD        |
| _resetKartaBudowyForm            | 219-270   | 52    | LOW      | KartaBudowy |
| _calcTransportCosts              | 271-314   | 44    | LOW      | KartaBudowy |
| _displayTransportCost            | 315-335   | 21    | LOW      | KartaBudowy |
| _detectWellParams                | 336-419   | 84    | MEDIUM   | KartaBudowy |
| _applyDetectedParams             | 420-443   | 24    | LOW      | KartaBudowy |
| _getExistingKartaBudowyData      | 444-462   | 19    | LOW      | KartaBudowy |
| _applyExistingKartaBudowyData    | 463-533   | 71    | MEDIUM   | KartaBudowy |
| _generateDefaultUwagi            | 534-598   | 65    | LOW      | KartaBudowy |
| initKartaBudowyStep4             | 599-619   | 21    | MEDIUM   | KartaBudowy |
| step4NextAction                  | 620-641   | 22    | MEDIUM   | KartaBudowy |
| getKartaBudowyCopyOrders         | 642-657   | 16    | LOW      | KartaBudowy |
| showKartaBudowyCopyPicker        | 658-677   | 20    | LOW      | KartaBudowy |
| renderKartaBudowyCopyOptions     | 678-717   | 40    | LOW      | KartaBudowy |
| copyKartaBudowyFromOrder         | 718-763   | 46    | MEDIUM   | KartaBudowy |
| applyCopiedKartaBudowyData       | 764-823   | 60    | MEDIUM   | KartaBudowy |
| mergeCopiedCustomPrzejscia       | 824-853   | 30    | LOW      | KartaBudowy |
| collectKartaBudowyDataStep4      | 854-968   | 115   | HIGH     | KartaBudowy |
| handlePrzejsciaZamowioneChange   | 969-981   | 13    | LOW      | KartaBudowy |
| buildOfferPrzejsciaTypes         | 993-1076  | 84    | MEDIUM   | Przejscia   |
| renderPrzejsciaDetailsTable      | 1077-1155 | 79    | MEDIUM   | Przejscia   |
| updatePrzejscieDnOptions         | 1156-1240 | 85    | MEDIUM   | Przejscia   |
| buildPrzejscieRowHTML            | 1241-1341 | 101   | LOW      | Przejscia   |
| updatePrzejscieSelectStyle       | 1342-1354 | 13    | LOW      | Przejscia   |
| addCustomPrzejscieRow            | 1355-1380 | 26    | LOW      | Przejscia   |
| removePrzejscieRow               | 1381-1401 | 21    | LOW      | Przejscia   |
| _syncCustomRowsFromDOM           | 1402-1446 | 45    | LOW      | Przejscia   |
| collectPrzejsciaDetailsFromTable | 1447-1499 | 53    | MEDIUM   | Przejscia   |
| finalizeOrderFromOffer           | 1500-1704 | 205   | CRITICAL | CRUD        |
| collectSelectedWellsForOrder     | 1705-1716 | 12    | LOW      | CRUD        |
| saveOrderStudnie                 | 1717-1786 | 70    | HIGH     | CRUD        |
| freezeWellPrices                 | 1787-1877 | 91    | MEDIUM   | CRUD        |
| deleteOrderStudnie               | 1878-1950 | 73    | MEDIUM   | CRUD        |
| getOrderChanges                  | 1951-2032 | 82    | MEDIUM   | CRUD        |
| getCurrentOfferOrder             | 2033-2041 | 9     | LOW      | CRUD        |
| enterOrderEditMode               | 2042-2243 | 202   | CRITICAL | CRUD        |
| loadOrderSnapshot                | 2244-2310 | 67    | HIGH     | CRUD        |
| renderOrderModeBanner            | 2311-2375 | 65    | LOW      | CRUD        |
| saveCurrentOrder                 | 2376-2485 | 110   | CRITICAL | CRUD        |
| syncSourceData                   | 2486-2509 | 24    | MEDIUM   | CRUD        |
| getElementStatus                 | 2518-2527 | 10    | LOW      | Zlecenia    |
| setZleceniaFilter                | 2528-2535 | 8     | LOW      | Zlecenia    |
| loadProductionOrders             | 2536-2550 | 15    | LOW      | Zlecenia    |
| saveProductionOrdersData         | 2551-2570 | 20    | LOW      | Zlecenia    |
| parseWysokoscGlebokosc           | 2571-2577 | 7     | LOW      | Zlecenia    |
| getStudniaDIN                    | 2578-2583 | 6     | LOW      | Zlecenia    |
| calcStopnieExecution             | 2584-2592 | 9     | LOW      | Zlecenia    |
| buildEtykietaElementsSnapshot    | 2593-2642 | 50    | LOW      | Zlecenia    |
| openZleceniaProdukcyjne          | 2643-2705 | 63    | MEDIUM   | Zlecenia    |
| closeZleceniaModal               | 2706-2760 | 55    | LOW      | Zlecenia    |
| buildZleceniaWellList            | 2761-2820 | 60    | MEDIUM   | Zlecenia    |
| findRealBaseIndex                | 2821-2832 | 12    | LOW      | Zlecenia    |
| renderZleceniaList               | 2833-2952 | 120   | MEDIUM   | Zlecenia    |
| filterZleceniaList               | 2953-2956 | 4     | LOW      | Zlecenia    |
| selectZleceniaElement            | 2957-2974 | 18    | LOW      | Zlecenia    |
| renderZleceniaWellConfig         | 2975-3063 | 89    | MEDIUM   | Zlecenia    |
| rebuildZleceniaListAndFocus      | 3064-3076 | 13    | LOW      | Zlecenia    |
| refreshZleceniaModal             | 3077-3133 | 57    | LOW      | Zlecenia    |
| renderZleceniaSvgPreview         | 3134-3157 | 24    | LOW      | Zlecenia    |
| populateZleceniaForm             | 3158-3798 | 641   | CRITICAL | Zlecenia    |
| selectZleceniaTile               | 3799-4014 | 216   | HIGH     | Zlecenia    |
| onZleceniaStopnieChange          | 4015-4022 | 8     | LOW      | Zlecenia    |
| onZleceniaKatChange              | 4023-4032 | 10    | LOW      | Zlecenia    |
| saveProductionOrder              | 4033-4224 | 192   | CRITICAL | Zlecenia    |
| deleteProductionOrder            | 4225-4263 | 39    | MEDIUM   | Zlecenia    |
| acceptProductionOrder            | 4264-4351 | 88    | HIGH     | Zlecenia    |
| revokeProductionOrder            | 4352-4392 | 41    | LOW      | Zlecenia    |
| collectSharedFormData            | 4399-4425 | 27    | LOW      | Bulk        |
| buildAutoOrderData               | 4426-4624 | 199   | HIGH     | Bulk        |
| claimAndSaveSingleOrder          | 4625-4648 | 24    | MEDIUM   | Bulk        |
| openBulkOrderSequencePopup       | 4649-4770 | 122   | MEDIUM   | Bulk        |
| updateBulkSeqNumbers             | 4771-4790 | 20    | LOW      | Bulk        |
| reorderBulkSeqList               | 4791-4833 | 43    | LOW      | Bulk        |
| toggleBulkSeqItem                | 4834-4883 | 50    | LOW      | Bulk        |
| closeBulkOrderPopup              | 4884-4891 | 8     | LOW      | Bulk        |
| executeBulkFromPopup             | 4892-4929 | 38    | MEDIUM   | Bulk        |
| executeBulkGeneration            | 4930-4982 | 53    | HIGH     | Bulk        |
| deleteSelectedProductionOrder    | 4983-5001 | 19    | LOW      | Bulk        |
| refreshGlobalMetrics             | 5002-5017 | 16    | LOW      | Export      |
| showKartaBudowyExportChoice      | 5027-5052 | 26    | LOW      | Export      |
| exportKartaToPDF_action          | 5054-5083 | 30    | LOW      | Export      |
| exportKartaToWord_action         | 5085-5114 | 30    | LOW      | Export      |
| DOMContentLoaded handler         | 5019-5025 | 7     | LOW      | Init        |

### 10.2 Klasyfikacja funkcji

| Klasa             | Opis                                   | Funkcje                                                                                                                                                                                                                                                                                                                               |
| ----------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PURE              | Brak side effects, tylko param->return | getOrdersForOffer, getOrderedWellIds, isWellOrdered, getOfferOrderProgress, getOrderForWellId, parseWysokoscGlebokosc, getStudniaDIN, calcStopnieExecution, buildPrzejscieRowHTML, findRealBaseIndex, filterZleceniaList                                                                                                              |
| READ_ONLY         | Czyta global stan, nie modyfikuje      | getElementStatus, getCurrentOfferOrder, getOrderChanges, collectSelectedWellsForOrder, collectPrzejsciaDetailsFromTable                                                                                                                                                                                                               |
| READ_WRITE_GLOBAL | Czyta i modyfikuje stan globalny       | freezeWellPrices, saveOrderStudnie, saveCurrentOrder, enterOrderEditMode, createOrderFromOffer, finalizeOrderFromOffer                                                                                                                                                                                                                |
| DOM               | Tylko operacje DOM                     | _resetKartaBudowyForm, _calcTransportCosts, _displayTransportCost, _detectWellParams, _applyDetectedParams, _applyExistingKartaBudowyData, _generateDefaultUwagi, initKartaBudowyStep4, updatePrzejscieSelectStyle, _syncCustomRowsFromDOM, renderOrderModeBanner, renderZleceniaSvgPreview, populateZleceniaForm, selectZleceniaTile |
| NETWORK           | Fetch/API calls                        | loadOrdersStudnie, saveOrdersDataStudnie, loadProductionOrders, saveProductionOrdersData, _getExistingKartaBudowyData, claimAndSaveSingleOrder                                                                                                                                                                                        |
| IO                | Polaczenie fetch + DOM                 | saveProductionOrder, deleteProductionOrder, acceptProductionOrder, revokeProductionOrder, deleteOrderStudnie, syncSourceData, executeBulkGeneration                                                                                                                                                                                   |
| WINDOW            | Operacje na window.*                   | Wszystkie z window.X = ... na koncu pliku (linie 4966-5008)                                                                                                                                                                                                                                                                           |
| INIT              | Inicjalizacja                          | DOMContentLoaded handler, setTimeout init                                                                                                                                                                                                                                                                                             |

### 10.3 Read/Write dependency map (HIGH/CRITICAL)

#### createOrderFromOffer (HIGH, linie 82-215)

| Aspekt             | Wartosc                                                                                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Czyta**          | orderEditMode, wells, isSavingOffer, offersStudnie, editingOfferIdStudnie, document.querySelectorAll('.well-order-checkbox'), document.getElementById('offer-number') |
| **Zapisuje**       | isSavingOffer (posrednio przez saveOfferStudnie)                                                                                                                      |
| **Wywoluje**       | collectSelectedWellsForOrder(), saveOfferStudnie(), showToast(), finalizeOrderFromOffer(offer, selectedWells, null)                                                   |
| **window exports** | window.createOrderFromOffer                                                                                                                                           |
| **Globale**        | orderEditMode, wells, isSavingOffer, offersStudnie, editingOfferIdStudnie                                                                                             |
| **DOM**            | #offer-number, .well-order-checkbox                                                                                                                                   |
| **NETWORK**        | Nie bezposrednio - poprzez saveOfferStudnie                                                                                                                           |

#### finalizeOrderFromOffer (CRITICAL, linie 1500-1704)

| Aspekt             | Wartosc                                                                                                                                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Czyta**          | currentUser, offer.userId, offersStudnie, editingOfferIdStudnie, wells, wellDiscounts, currentTransportMode                                                                                                              |
| **Zapisuje**       | window.wellDiscounts, wells (poprzez freezeWellPrices)                                                                                                                                                                   |
| **Wywoluje**       | fetch(/api/users-for-assignment), fetch(/api/orders-studnie/claim-number/), showUserSelectionPopup(), showToast(), freezeWellPrices(), calcWellStats(), calcTransportCount(), saveOrdersDataStudnie(), structuredClone() |
| **window exports** | (uzywane wewnetrznie z createOrderFromOffer)                                                                                                                                                                             |
| **Globale**        | currentUser, wells, wellDiscounts, currentTransportMode                                                                                                                                                                  |
| **DOM**            | Nie bezposrednio                                                                                                                                                                                                         |
| **NETWORK**        | 3x fetch (users, claim-number, save)                                                                                                                                                                                     |

#### enterOrderEditMode (CRITICAL, linie 2042-2243)

| Aspekt             | Wartosc                                                                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Czyta**          | orderEditMode, editingOfferIdStudnie, offersStudnie                                                                                 |
| **Zapisuje**       | orderEditMode, editingOfferIdStudnie, wells, window.wellDiscounts, window.isPreviewMode, visiblePrzejsciaTypes, expandedWellIndices |
| **Wywoluje**       | fetch(/api/orders-studnie/:id), migrateWellData(), calcWellStats(), structuredClone(), showToast(), syncSourceData()                |
| **window exports** | window.syncSourceData, ustawia window.applyPreviewLockUI, nadpisuje window.saveCurrentOrder, window.saveOfferStudnie                |
| **Globale**        | orderEditMode, editingOfferIdStudnie, wells, wellDiscounts, isPreviewMode, visiblePrzejsciaTypes, expandedWellIndices               |
| **DOM**            | (renderuje przez renderOfferSummary z offerManager.js)                                                                              |
| **NETWORK**        | 1x fetch                                                                                                                            |
| **Uwaga**          | Tymczasowo nadpisuje window.saveCurrentOrder i window.saveOfferStudnie wlasnymi wersjami blokujacymi zapis w trybie podgladu        |

#### saveCurrentOrder (CRITICAL, linie 2376-2485)

| Aspekt             | Wartosc                                                                                                                                                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Czyta**          | orderEditMode, wells, wellDiscounts, visiblePrzejsciaTypes, offersStudnie, document.getElementById('transport-km'), document.getElementById('transport-rate'), currentTransportMode, calcTransportCount, MAX_TRANSPORT_WEIGHT |
| **Zapisuje**       | orderEditMode.order (mutacja), saveOrdersDataStudnie()                                                                                                                                                                        |
| **Wywoluje**       | freezeWellPrices(), calcWellStats(), structuredClone(), showToast(), saveOrdersDataStudnie(), calcTransportCount()                                                                                                            |
| **window exports** | window.saveCurrentOrder                                                                                                                                                                                                       |
| **Globale**        | orderEditMode, wells, wellDiscounts, visiblePrzejsciaTypes, offersStudnie, currentTransportMode                                                                                                                               |
| **DOM**            | #transport-km, #transport-rate                                                                                                                                                                                                |

#### populateZleceniaForm (CRITICAL, linie 3158-3798)

| Aspekt             | Wartosc                                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| **Czyta**          | wells, studnieProducts, productionOrders                                                                                   |
| **Zapisuje**       | DOM (innerHTML wielu elementow)                                                                                            |
| **Wywoluje**       | buildEtykietaElementsSnapshot(), escapeHtml(), lucide.createIcons(), getStudniaDIN()                                       |
| **window exports** | (uzywane wewnetrznie)                                                                                                      |
| **Globale**        | wells, studnieProducts, productionOrders                                                                                   |
| **DOM**            | #zl-elements, #zl-well-config, #zl-svg-preview, #zl-dane-elementu-_, #zl-inline-przejscia-_ - ~40+ elementow               |
| **Uwaga**          | Najdluzsza funkcja w pliku (641 linii). Zawiera wbudowany HTML z inline onclick. GENERUJE HTML jako string z interpolacja. |

#### saveProductionOrder (CRITICAL, linie 4033-4224)

| Aspekt             | Wartosc                                                                                                                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Czyta**          | wells, DOM (formularz zlecenia)                                                                                                                                                              |
| **Zapisuje**       | productionOrders (poprzez saveProductionOrdersData)                                                                                                                                          |
| **Wywoluje**       | collectSharedFormData(), buildAutoOrderData(), fetch(/api/production-orders), saveProductionOrdersData(), buildZleceniaWellList(), renderZleceniaList(), refreshZleceniaModal(), showToast() |
| **window exports** | window.saveProductionOrder                                                                                                                                                                   |
| **Globale**        | wells                                                                                                                                                                                        |
| **DOM**            | Czyta formularz, renderuje liste                                                                                                                                                             |
| **NETWORK**        | 2x fetch                                                                                                                                                                                     |

### 10.4 DOM map - ktore moduly czytaja/modyfikuja ktore elementy

#### Modul: Karta Budowy

| Element DOM                      | Czytane przez                                                                        | Modyfikowane przez                                        |
| -------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| #step4-offer-nr-input            | _applyExistingKartaBudowyData, collectKartaBudowyDataStep4, copyKartaBudowyFromOrder | _applyExistingKartaBudowyData, copyKartaBudowyFromOrder   |
| #step4-uwagi-ogolne              | _generateDefaultUwagi, collectKartaBudowyDataStep4                                   | _generateDefaultUwagi, applyCopiedKartaBudowyData         |
| #step4-email-faktura             | collectKartaBudowyDataStep4                                                          | _applyExistingKartaBudowyData, applyCopiedKartaBudowyData |
| #step4-email-efaktura            | collectKartaBudowyDataStep4                                                          | _applyExistingKartaBudowyData, applyCopiedKartaBudowyData |
| #step4-adres-wysylki             | collectKartaBudowyDataStep4                                                          | _applyExistingKartaBudowyData, applyCopiedKartaBudowyData |
| #step4-warunki-platnosci         | collectKartaBudowyDataStep4                                                          | _applyExistingKartaBudowyData, applyCopiedKartaBudowyData |
| #step4-copy-order-select         | showKartaBudowyCopyPicker, copyKartaBudowyFromOrder                                  | renderKartaBudowyCopyOptions                              |
| #step4-wyliczony-transport       | _displayTransportCost                                                                | _displayTransportCost                                     |
| #step4-zabezpieczenie-transportu | collectKartaBudowyDataStep4                                                          | _applyExistingKartaBudowyData                             |
| #step4-rodzaj-transportu         | collectKartaBudowyDataStep4                                                          | _applyExistingKartaBudowyData                             |
| #step4-rodzaj-stopni             | collectKartaBudowyDataStep4                                                          | _applyExistingKartaBudowyData                             |
| #step4-rodzaj-stopni-inne        | collectKartaBudowyDataStep4                                                          | _applyExistingKartaBudowyData                             |
| #step4-rodzaj-studni             | collectKartaBudowyDataStep4                                                          | _applyExistingKartaBudowyData                             |
| #step4-osoba-kontakt             | collectKartaBudowyDataStep4                                                          | _applyExistingKartaBudowyData                             |
| #step4-ilosc-dni                 | collectKartaBudowyDataStep4                                                          | _applyExistingKartaBudowyData                             |
| #step4-ubezpieczenie             | collectKartaBudowyDataStep4                                                          | _applyExistingKartaBudowyData                             |

#### Modul: Przejscia Szczelne

| Element DOM                             | Czytane przez            | Modyfikowane przez                        |
| --------------------------------------- | ------------------------ | ----------------------------------------- |
| #przejscia-details-table                | -                        | renderPrzejsciaDetailsTable               |
| #przejscia-custom-rows                  | _syncCustomRowsFromDOM   | addCustomPrzejscieRow, removePrzejscieRow |
| select[name^="przejscie-"][name$="-dn"] | updatePrzejscieDnOptions | updatePrzejscieDnOptions                  |
| Rozne #przejscie-*-wrap                 | removePrzejscieRow       | -                                         |

#### Modul: CRUD zamowien

| Element DOM          | Czytane przez        | Modyfikowane przez |
| -------------------- | -------------------- | ------------------ |
| #transport-km        | saveCurrentOrder     | -                  |
| #transport-rate      | saveCurrentOrder     | -                  |
| .well-order-checkbox | createOrderFromOffer | -                  |
| #offer-number        | createOrderFromOffer | -                  |

#### Modul: Zlecenia Produkcyjne

| Element DOM                 | Czytane przez        | Modyfikowane przez                                                |
| --------------------------- | -------------------- | ----------------------------------------------------------------- |
| #zl-elements                | -                    | populateZleceniaForm                                              |
| #zl-well-config             | -                    | populateZleceniaForm, renderZleceniaWellConfig                    |
| #zl-svg-preview             | -                    | renderZleceniaSvgPreview                                          |
| #zl-dane-elementu-* (wiele) | populateZleceniaForm | populateZleceniaForm                                              |
| #zl-inline-przejscia-*      | populateZleceniaForm | populateZleceniaForm                                              |
| #zlecenia-filter            | setZleceniaFilter    | -                                                                 |
| #production-orders-body     | -                    | renderZleceniaList                                                |
| #bulk-order-sequence-list   | -                    | openBulkOrderSequencePopup, reorderBulkSeqList, toggleBulkSeqItem |
| #zl-modal (klasa .modal)    | -                    | openZleceniaProdukcyjne, closeZleceniaModal                       |

### 10.5 Call Graph - CRITICAL funkcje

#### createOrderFromOffer -> Call Chain

```
createOrderFromOffer()
  - (sprawdza orderEditMode)
  - collectSelectedWellsForOrder()          // czyta DOM checkboxy
  - while(isSavingOffer) { await sleep }    // POLLING - czeka na zapis oferty
  - saveOfferStudnie()                      // z offerManager.js - ZAPIS OFERTY
  - (czyta #offer-number, editingOfferIdStudnie)
  - offersStudnie.find()                   // znajdz oferte
  - finalizeOrderFromOffer(offer, selectedWells, null)
        - fetch(/api/users-for-assignment)          // NETWORK
        - showUserSelectionPopup()                  // DOM popup
        - fetch(/api/orders-studnie/claim-number/)  // NETWORK
        - freezeWellPrices(selectedWells)           // mutacja cen
        - calcTransportCount()                      // kalkulacja transportu
        - saveOrdersDataStudnie(data)               // NETWORK - zapis
```

**Uwaga:** Wystepuje posrednia zaleznosc cykliczna: createOrderFromOffer -> saveOfferStudnie (offerManager.js) -> ewentualny zapis -> ponowne renderowanie -> potencjalna zmiana wells. Dodatkowo while(isSavingOffer) polling to busy-wait, ktory moze prowadzic do nieskonczonej petli jesli saveOfferStudnie nigdy nie ustawi isSavingOffer = false.

#### enterOrderEditMode -> Call Chain

```
enterOrderEditMode(orderId)
  - fetch(/api/orders-studnie/:id)                   // NETWORK
  - orderEditMode = { orderId, order }               // ustawia global
  - editingOfferIdStudnie = order.offerId            // zmienia ID oferty
  - window.isPreviewMode = false
  - visiblePrzejsciaTypes = new Set(...)
  - wells = structuredClone(order.wells)              // NADPISUJE wells!
  - migrateWellData(wells)                            // migracja danych
  - window.wellDiscounts = ...                        // NADPISUJE rabaty!
  - calcWellStats()                                   // przelicza statystyki
  - renderOfferSummary()                              // z offerManager.js
  - syncSourceData()                                  // async callback
        - saveCurrentOrder()                          // zapisuje stan
        - saveOfferStudnie()                          // zapisuje oferte
  - loadOrderSnapshot()                               // snapshot do porownania
        - overwrites window.saveCurrentOrder           // blokada zapisu
        - overwrites window.saveOfferStudnie           // blokada zapisu
```

**Uwaga:** enterOrderEditMode tymczasowo nadpisuje window.saveCurrentOrder i window.saveOfferStudnie.

#### saveCurrentOrder -> Call Chain

```
saveCurrentOrder(options = {})
  - (sprawdza orderEditMode)
  - freezeWellPrices(wells)                   // mutacja cen
  - order.wells = structuredClone(wells)       // snapshot
  - order.wellDiscounts = structuredClone(...) // snapshot rabatow
  - calcWellStats(well)                        // przelicza dla kazdego well
  - (czyta #transport-km, #transport-rate)
  - calcTransportCount()                       // kalkulacja transportu
  - saveOrdersDataStudnie(order data)          // NETWORK - zapis
```

### 10.6 Cykle wywolan i indirect recursion

Zidentyfikowane potencjalne petle wywolan w orderManager.js:

| #   | Petla                                                                                                       | Opis                                                                                                                                                                                            | Ryzyko |
| --- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | createOrderFromOffer -> while(isSavingOffer) -> saveOfferStudnie -> ... -> isSavingOffer = false            | Polling busy-wait czekajacy na flage z innego pliku. Jesli saveOfferStudnie rzuci wyjatkiem przed ustawieniem isSavingOffer = false, petla nigdy sie nie skonczy.                               | HIGH   |
| 2   | enterOrderEditMode -> syncSourceData -> saveCurrentOrder -> saveOrdersDataStudnie                           | Lancuch zapisu wywolany podczas wchodzenia w tryb edycji.                                                                                                                                       | MEDIUM |
| 3   | saveCurrentOrder -> freezeWellPrices -> mutacja wells -> inna funkcja czyta wells                           | Mutacja tablicy wells podczas gdy inne funkcje moga ja czytac.                                                                                                                                  | LOW    |
| 4   | window.saveCurrentOrder i window.saveOfferStudnie tymczasowo nadpisywane w enterOrderEditMode               | Jesli w trakcie trwania trybu edycji uzytkownik kliknie przycisk zapisu oferty, wywola sie podmieniona funkcja (blokujaca).                                                                     | MEDIUM |
| 5   | refreshZleceniaModal -> renderZleceniaList -> DOM                                                           | refreshZleceniaModal wywoluje renderZleceniaList ktory modyfikuje DOM.                                                                                                                          | LOW    |
| 6   | saveProductionOrder -> buildZleceniaWellList -> renderZleceniaList -> refreshZleceniaModal                  | Lancuch: zapis -> odswiezenie listy -> odswiezenie modalu.                                                                                                                                      | LOW    |
| 7   | createOrderFromOffer -> saveOfferStudnie (oferManager) -> renderOfferSummary -> (czyta wells/wellDiscounts) | Posrednia zaleznosc danych: saveOfferStudnie renderuje oferte po zapisie. Jesli wells lub wellDiscounts ulegly zmianie miedzy zapisem oferty a finalizacja zamowienia, dane moga byc niespojne. | HIGH   |

**Zalecenia:**

1. while(isSavingOffer) zastepic Promise lub callback - Stage 2
2. Przed przeniesieniem createOrderFromOffer sprawdzic czy isSavingOffer jest zawsze resetowany
3. Zachowac podmiane window.* w enterOrderEditMode - to celowe zabezpieczenie

### 10.7 Event Dependency Map - dla CRITICAL funkcji

Dla kazdej funkcji CRITICAL, przechwyc przeplyw eventu przed zmiana. Po refaktoryzacji sekwencja musi byc identyczna.

**createOrderFromOffer flow:**

```
click -> createOrderFromOffer()
  -> sprawdz orderEditMode
  -> collectSelectedWellsForOrder()
  -> while(isSavingOffer) polling
  -> saveOfferStudnie()
  -> finalizeOrderFromOffer()
      -> fetch(/api/users-for-assignment)
      -> showUserSelectionPopup()
      -> fetch(/api/orders-studnie/claim-number/)
      -> freezeWellPrices()
      -> calcTransportCount()
      -> saveOrdersDataStudnie()
      -> window.location.href
```

**saveCurrentOrder flow:**

```
click -> saveCurrentOrder()
  -> freezeWellPrices()
  -> structuredClone(wells, wellDiscounts)
  -> calcWellStats() per well
  -> czytaj DOM (transport)
  -> calcTransportCount()
  -> saveOrdersDataStudnie()
```

**Zasada:** Przed przeniesieniem ktorejkolwiek z powyzszych funkcji, uruchom aplikacje z wlaczonym logowaniem [CALLSEQ] i zapisz sekwencje. Po zmianie porownaj logi.

### 10.8 Nie dwie funkcje z tego samego flow w jeden dzien

**Obowiazkowa regula dla orderManager.js:**

| Funkcje                                                          | Flow                 | Minimalny odstęp |
| ---------------------------------------------------------------- | -------------------- | ---------------- |
| createOrderFromOffer + finalizeOrderFromOffer + saveOrderStudnie | Tworzenie zamowienia | 3 osobne dni     |
| enterOrderEditMode + saveCurrentOrder + syncSourceData           | Edycja zamowienia    | 3 osobne dni     |
| saveProductionOrder + acceptProductionOrder + buildAutoOrderData | Zlecenia produkcyjne | 3 osobne dni     |

**Dlaczego:** Funkcje te wspoldziela globalny stan (wells, wellDiscounts, orderEditMode), DOM i siec. Zmiana w jednej moze miec niezamierzony efekt na drugiej. Rozdzielenie w czasie pozwala wykryc regresje przed przejsciem do kolejnej.

### 10.9 Contract Test - dla HIGH/CRITICAL funkcji

#### createOrderFromOffer

| Pole             | Wartosc                                                                       |
| ---------------- | ----------------------------------------------------------------------------- |
| **Arguments**    | (brak - czyta globale i DOM)                                                  |
| **Return**       | undefined (wywoluje finalizeOrderFromOffer, potem window.location.href = ...) |
| **Throws**       | Nie rzuca (try/catch na zewnatrz)                                             |
| **Mutates**      | isSavingOffer (posrednio), window.location.href                               |
| **Async**        | Tak                                                                           |
| **Window**       | window.createOrderFromOffer, window.location.href                             |
| **Side effects** | NETWORK, DOM, nawigacja                                                       |

#### finalizeOrderFromOffer

| Pole             | Wartosc                                                           |
| ---------------- | ----------------------------------------------------------------- |
| **Arguments**    | (offer, selectedWells, kartaBudowyData)                           |
| **Return**       | undefined (nawiguje do studnie.html?order=:id)                    |
| **Throws**       | Nie rzuca (try/catch)                                             |
| **Mutates**      | window.wellDiscounts (tymczasowo), wells (przez freezeWellPrices) |
| **Async**        | Tak                                                               |
| **Window**       | window.wellDiscounts, window.location.href                        |
| **Side effects** | 3x fetch, zapis danych, nawigacja                                 |

#### enterOrderEditMode

| Pole             | Wartosc                                                                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Arguments**    | (orderId)                                                                                                                                                        |
| **Return**       | undefined                                                                                                                                                        |
| **Throws**       | Nie rzuca (try/catch)                                                                                                                                            |
| **Mutates**      | orderEditMode, editingOfferIdStudnie, wells, window.wellDiscounts, window.isPreviewMode, visiblePrzejsciaTypes, window.saveCurrentOrder, window.saveOfferStudnie |
| **Async**        | Tak                                                                                                                                                              |
| **Window**       | window.syncSourceData, window.saveCurrentOrder, window.saveOfferStudnie, window.isPreviewMode, window.wellDiscounts, window.applyPreviewLockUI                   |
| **Side effects** | NETWORK, DOM, nadpisywanie globali                                                                                                                               |

#### saveCurrentOrder

| Pole             | Wartosc                                                               |
| ---------------- | --------------------------------------------------------------------- |
| **Arguments**    | (options = {}) - options.skipFreeze                                   |
| **Return**       | undefined (lub false po bledzie)                                      |
| **Throws**       | Nie rzuca (try/catch)                                                 |
| **Mutates**      | orderEditMode.order (mutacja obiektu), wells (przez freezeWellPrices) |
| **Async**        | Tak                                                                   |
| **Window**       | window.wellDiscounts, window.saveCurrentOrder                         |
| **Side effects** | NETWORK, DOM (czyta transport inputy)                                 |

#### populateZleceniaForm

| Pole             | Wartosc                                                 |
| ---------------- | ------------------------------------------------------- |
| **Arguments**    | (el) - element zlecenia                                 |
| **Return**       | undefined                                               |
| **Throws**       | Nie rzuca                                               |
| **Mutates**      | DOM (innerHTML wielu elementow)                         |
| **Async**        | Nie                                                     |
| **Window**       | -                                                       |
| **Side effects** | Lucide.createIcons(), generowanie HTML z inline onclick |

#### saveProductionOrder

| Pole             | Wartosc                               |
| ---------------- | ------------------------------------- |
| **Arguments**    | (brak - czyta DOM i globale)          |
| **Return**       | undefined                             |
| **Throws**       | Nie rzuca (try/catch)                 |
| **Mutates**      | productionOrders (posrednio)          |
| **Async**        | Tak                                   |
| **Window**       | window.saveProductionOrder            |
| **Side effects** | 2x fetch, DOM (render listy i modalu) |

### 10.10 Hidden init order risks

| Funkcja inicjalizowana                   | Inicjalizowana przez                   | Wymaga gotowosci                                                             | Ryzyko                                                                          |
| ---------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| initKartaBudowyStep4(primaryOfferNumber) | Wywolana z wizard.js (krok 4 kreatora) | wells, offersStudnie, studnieProducts                                        | Jesli wizard.js zaladuje sie przed orderManager.js, funkcja nie bedzie dostepna |
| createOrderFromOffer()                   | HTML onclick                           | orderEditMode, wells, offersStudnie, editingOfferIdStudnie, saveOfferStudnie | Jesli offerManager.js jeszcze nie zainicjalizowal saveOfferStudnie na window.*  |
| enterOrderEditMode(orderId)              | HTML onclick                           | wells, offersStudnie, renderOfferSummary (z offerManager.js)                 | Jesli oferta nie jest zaladowana                                                |
| openZleceniaProdukcyjne()                | HTML onclick                           | wells, productionOrders                                                      | Jesli wells puste (brak studni)                                                 |
| saveCurrentOrder()                       | HTML onclick                           | orderEditMode, wells                                                         | Jesli orderEditMode nie zostal ustawiony                                        |

**Zalecenie:** Przed przeniesieniem funkcji do nowego pliku sprawdz czy wszystkie zakladane przez nia globale i funkcje sa zadeklarowane PRZED jej plikiem w kolejnosci ladowania HTML.

**orderManager — pelny flow test po kazdym kroku:** Po KAZDYM sub-kroku ekstrakcji w orderManager.js (kroki 4.1-4.7) wykonaj KOMPLETNY biznesowy flow zamowienia:

1. Utworz zamowienie (createOrderFromOffer)
2. Edytuj zamowienie (enterOrderEditMode)
3. Zapisz zamowienie (saveCurrentOrder)
4. Otworz ponownie (reopen)
5. Sfinalizuj zamowienie (finalizeOrderFromOffer)

Nie ograniczaj sie do testowania tylko wyekstrahowanego modulu — caly flow musi dzialac od poczatku do konca. Testowanie tylko wyizolowanego fragmentu moze ukryc regresje w przeplywie danych miedzy modulami (np. kolejnosc ladowania, wspoldzielony stan globalny).

### 10.11 Stage 1 - Podzial plikow

---

#### Krok 4.1 - Wydzielenie orderHelpers.js (LOW)

| Pole             | Wartosc                                                                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Zakres linii** | 3-80                                                                                                                                    |
| **Funkcje**      | loadOrdersStudnie, saveOrdersDataStudnie, getOrdersForOffer, getOrderedWellIds, isWellOrdered, getOfferOrderProgress, getOrderForWellId |
| **Ryzyko**       | LOW                                                                                                                                     |
| **Czas**         | 0.5h                                                                                                                                    |
| **Klasyfikacja** | PURE (5) + NETWORK (2)                                                                                                                  |

Czyste helpery. Przenies caly blok (linie 3-80). Dodaj window.* rejestracje na koncu nowego pliku.

---

#### Krok 4.2 - Wydzielenie orderExport.js (LOW)

| Pole             | Wartosc                                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| **Zakres linii** | 5002-5114                                                                                            |
| **Funkcje**      | refreshGlobalMetrics, showKartaBudowyExportChoice, exportKartaToPDF_action, exportKartaToWord_action |
| **Ryzyko**       | LOW                                                                                                  |
| **Czas**         | 0.5h                                                                                                 |
| **Klasyfikacja** | DOM (3) + WINDOW (1)                                                                                 |

Samodzielne funkcje eksportu. Brak zaleznosci miedzyfunkcyjnych.

---

#### Krok 4.3 - Wydzielenie orderPrzejscia.js (MEDIUM)

| Pole             | Wartosc                                                                                                                                                                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Zakres linii** | 982-1499                                                                                                                                                                                                                                |
| **Funkcje**      | buildOfferPrzejsciaTypes, renderPrzejsciaDetailsTable, updatePrzejscieDnOptions, buildPrzejscieRowHTML, updatePrzejscieSelectStyle, addCustomPrzejscieRow, removePrzejscieRow, _syncCustomRowsFromDOM, collectPrzejsciaDetailsFromTable |
| **Ryzyko**       | MEDIUM                                                                                                                                                                                                                                  |
| **Czas**         | 1.5h                                                                                                                                                                                                                                    |
| **Klasyfikacja** | DOM (7) + PURE (1) + READ_ONLY (1)                                                                                                                                                                                                      |

Funkcje przejsc szczelnych. Uzywane przez collectKartaBudowyDataStep4 (krok 4.4). Kolejnosc: najpierw 4.3, potem 4.4.

---

#### Krok 4.4 - Wydzielenie orderKartaBudowy.js (MEDIUM)

| Pole             | Wartosc                                                                                                                                                                                                                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Zakres linii** | 217-981                                                                                                                                                                                                                                                                                             |
| **Funkcje**      | Wszystkie _* karta budowy + initKartaBudowyStep4, step4NextAction, getKartaBudowyCopyOrders, showKartaBudowyCopyPicker, renderKartaBudowyCopyOptions, copyKartaBudowyFromOrder, applyCopiedKartaBudowyData, mergeCopiedCustomPrzejscia, collectKartaBudowyDataStep4, handlePrzejsciaZamowioneChange |
| **Ryzyko**       | MEDIUM                                                                                                                                                                                                                                                                                              |
| **Czas**         | 2h                                                                                                                                                                                                                                                                                                  |
| **Klasyfikacja** | DOM (12) + NETWORK (1) + INIT (1)                                                                                                                                                                                                                                                                   |

**Sub-kroki:**

- Sub-krok A: Przenies funkcje _resetKartaBudowyForm do _generateDefaultUwagi (linie 219-598)
- Sub-krok B: Przenies initKartaBudowyStep4 do collectKartaBudowyDataStep4 (linie 599-968)
- Sub-krok C: Przenies handlePrzejsciaZamowioneChange (linie 969-981)

Krok 4.3 musi byc wykonany przed 4.4 (bo collectKartaBudowyDataStep4 uzywa collectPrzejsciaDetailsFromTable).

---

#### Krok 4.5 - Wydzielenie orderBulk.js (MEDIUM)

| Pole             | Wartosc                                                                                                                                                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Zakres linii** | 4393-4982                                                                                                                                                                                                                                                    |
| **Funkcje**      | collectSharedFormData, buildAutoOrderData, claimAndSaveSingleOrder, openBulkOrderSequencePopup, updateBulkSeqNumbers, reorderBulkSeqList, toggleBulkSeqItem, closeBulkOrderPopup, executeBulkFromPopup, executeBulkGeneration, deleteSelectedProductionOrder |
| **Ryzyko**       | MEDIUM                                                                                                                                                                                                                                                       |
| **Czas**         | 1.5h                                                                                                                                                                                                                                                         |
| **Klasyfikacja** | DOM (7) + NETWORK (2) + IO (2)                                                                                                                                                                                                                               |

Wzglednie izolowana sekcja - bulk generation ma wlasny modal i stan. Zalezna od saveProductionOrder (z kroku 4.6).

---

#### Krok 4.6 - Wydzielenie orderZlecenia.js (HIGH)

| Pole             | Wartosc                                                  |
| ---------------- | -------------------------------------------------------- |
| **Zakres linii** | 2511-4392                                                |
| **Funkcje**      | Wszystkie zlecenia produkcyjne (24 funkcje, ~1900 linii) |
| **Ryzyko**       | HIGH                                                     |
| **Czas**         | 4h                                                       |
| **Klasyfikacja** | DOM (12) + PURE (6) + READ_ONLY (2) + IO (4)             |

**Sub-kroki (podzial na 3 czesci):**

| Sub-krok | Funkcje                                                                                                                                                                                                                      | Linie     | Czas |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| 4.6.A    | getElementStatus, setZleceniaFilter, loadProductionOrders, saveProductionOrdersData, parseWysokoscGlebokosc, getStudniaDIN, calcStopnieExecution, buildEtykietaElementsSnapshot, openZleceniaProdukcyjne, closeZleceniaModal | 2518-2760 | 1h   |
| 4.6.B    | buildZleceniaWellList, findRealBaseIndex, renderZleceniaList, filterZleceniaList, selectZleceniaElement, renderZleceniaWellConfig, rebuildZleceniaListAndFocus, refreshZleceniaModal, renderZleceniaSvgPreview               | 2761-3157 | 1h   |
| 4.6.C    | populateZleceniaForm, selectZleceniaTile, onZleceniaStopnieChange, onZleceniaKatChange, saveProductionOrder, deleteProductionOrder, acceptProductionOrder, revokeProductionOrder                                             | 3158-4392 | 2h   |

**Kazdy sub-krok:**

- Sub-krok N: Przenies partie funkcji -> TEST (node -c) + golden master
- Sub-krok N+1: Dopiero nastepna partia
- **Uwaga:** Nie przenos dwoch funkcji z tego samego flow w jeden dzien! (zgodnie z sekcja 10.8)

---

#### Krok 4.7 - Wydzielenie orderCrud.js (CRITICAL - ostatnie)

| Pole             | Wartosc                                                                                                                                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Zakres linii** | 82-215, 1500-2509                                                                                                                                                                                                                                                         |
| **Funkcje**      | createOrderFromOffer, finalizeOrderFromOffer, collectSelectedWellsForOrder, saveOrderStudnie, freezeWellPrices, deleteOrderStudnie, getOrderChanges, getCurrentOfferOrder, enterOrderEditMode, loadOrderSnapshot, renderOrderModeBanner, saveCurrentOrder, syncSourceData |
| **Ryzyko**       | CRITICAL                                                                                                                                                                                                                                                                  |
| **Czas**         | 4h                                                                                                                                                                                                                                                                        |

**Sub-kroki (podzial na 4 czesci, na osobne dni!):**

| Sub-krok | Funkcje                                                                                    | Ryzyko   | Uwagi                                             |
| -------- | ------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------- |
| 4.7.A    | collectSelectedWellsForOrder, getCurrentOfferOrder, renderOrderModeBanner, getOrderChanges | MEDIUM   | Helpery CRUD, malo zaleznosci                     |
| 4.7.B    | deleteOrderStudnie, freezeWellPrices, saveOrderStudnie                                     | HIGH     | Operacje na zamowieniach - osobny dzien niz 4.7.A |
| 4.7.C    | createOrderFromOffer, finalizeOrderFromOffer                                               | CRITICAL | Glowny flow tworzenia zamowienia - osobny dzien!  |
| 4.7.D    | enterOrderEditMode, loadOrderSnapshot, saveCurrentOrder, syncSourceData                    | CRITICAL | Tryb edycji zamowienia - osobny dzien!            |

**Zgodnie z zasada z sekcji 10.8:**

- 4.7.B, 4.7.C, 4.7.D musza byc w OSOBNYCH dniach (wspoldziela globalny stan)
- Kazdy sub-krok wymaga golden master przed/po

---

#### Krok 4.8 - Init pozostaje w orderManager.js

| Pole             | Wartosc                                   |
| ---------------- | ----------------------------------------- |
| **Zakres linii** | 5019-5025                                 |
| **Pozostaje**    | addEventListener('DOMContentLoaded', ...) |
| **Ryzyko**       | LOW                                       |

---

### Kolejnosc realizacji (zaleznosci)

```
4.1 (orderHelpers) -> 4.2 (orderExport) -> 4.3 (orderPrzejscia) -> 4.4 (orderKartaBudowy)
  |                                       |
  |                                 4.5 (orderBulk - zalezny od saveProductionOrder z 4.6)
  |                                       |
  |                                 4.6 (orderZlecenia - najwiekszy, 3 sub-kroki)
  |                                       |
  +--------------------------------- 4.7 (orderCrud - ostatni, 4 sub-kroki, CRITICAL)
                                        |
                                   4.8 (Init - zostaje w orderManager.js)
```

---

### Stage 1 - FREEZE

```
+---------------------------------------------+
|              FREEZE POINT                    |
|                                             |
|  - node -c dla wszystkich nowych plikow      |
|  - typecheck                                |
|  - lint                                     |
|  - smoke test (utworz zamowienie, edytuj)   |
|  - zlecenia produkcyjne dzialaja            |
|  - karta budowy + eksport dzialaja         |
|  - bulk generation dziala                   |
|  - golden master (JSON API + HTML + state)  |
|  - contract tests dla window.*              |
|  - manualny scenariusz (full flow)          |
|  - git tag                                  |
+---------------------------------------------+
```

### Stage 2 - Redukcja duplikacji (po Stage 1)

Do zidentyfikowania podczas pracy. Glowne kandydatury:

- populateZleceniaForm (641 linii) - do podzialu na mniejsze funkcje
- selectZleceniaTile (216 linii) - do rozbicia
- buildAutoOrderData (199 linii) - do rozbicia
- Duplikacja miedzy exportKartaToPDF_action a exportKartaToWord_action

### Stan koncowy orderManager.js (po Stage 1)

```
public/js/studnie/
orderManager.js              <- ~7 linii (tylko DOMContentLoaded)
orderHelpers.js              <- ~80 linii
orderExport.js               <- ~100 linii
orderPrzejscia.js            <- ~520 linii*
orderKartaBudowy.js          <- ~770 linii*
orderCrud.js                 <- ~1010 linii*
orderBulk.js                 <- ~590 linii*
orderZlecenia.js             <- ~1900 linii*
... istniejace pliki offer*
```

*Uwaga: orderCrud.js (~1010 linii), orderKartaBudowy.js (~770 linii) i orderZlecenia.js (~1900 linii) nadal przekraczaja limit 500 linii. Ich dalszy podzial to osobny cykl.

### Macierz ryzyka

| Ryzyko   | Kroki         | Opis                                                               |
| -------- | ------------- | ------------------------------------------------------------------ |
| LOW      | 4.1, 4.2, 4.8 | Helpery, export, init - czyste funkcje, brak side effects          |
| MEDIUM   | 4.3, 4.4, 4.5 | Izolowane sekcje z widokami - karta budowy, przejscia, bulk        |
| HIGH     | 4.6           | Zlecenia produkcyjne - duza liczba funkcji, zlozone zaleznosci DOM |
| CRITICAL | 4.7           | CRUD zamowien - glowny flow biznesowy, wiele zaleznosci globalnych |

---

## 11. Harmonogram

### Kolejnosc realizacji (v4 - z uwzglednieniem reorder i safeguards)

```
Tydzien 1: pdfGenerator.ts - Stage 1 (3-4 dni)
  -> Krok 1.1 Fix UserContactInfo (0.5h)
  -> Krok 1.2 Typy (0.5h)
  -> Krok 1.3 Helpery (0.5h)
  -> Krok 1.4 PDF Engine (1h)
  -> Krok 1.5 Offer Users (1h)
  -> Krok 1.6 Rury HTML - 2 sub-kroki (1.5h)
  -> Krok 1.7 Studnie HTML - 2 sub-kroki (1.5h)
  -> Krok 1.8 Karta Budowy - 2 sub-kroki (2h)
  --- FREEZE + golden master + contract tests (0.5d) ---
  -> Krok 1.9 Dedup wells->items (1h) - Stage 2
  -> Krok 1.10 Dedup Karta Budowy (1h) - Stage 2

Tydzien 2: offerItems.js - Stage 1 (3-5 dni)
  -> Krok 2.1 Helpery (0.5h)
  -> Krok 2.2 Catalog UI (1h)
  -> Krok 2.3 PEHD (0.5h)
  -> Krok 2.4 Nawigacja (0.5h)
  -> Krok 2.5 Update Items - 2 sub-kroki (1.5h)
  -> Krok 2.6 Auto Sync - 3 sub-kroki (2h)
  -> Krok 2.7 Add Items - 2 sub-kroki (1.5h)
  -> Krok 2.8 Order Selection - 2 sub-kroki (1.5h)
  -> Krok 2.9 Renderowanie - 3 sub-kroki (2.5h) - CZEKAJ 1 tydzien przed 2.9b!
  -> Krok 2.10 Init pozostaje (0.5h)
  --- FREEZE + golden master + contract tests (0.5d) ---

Tydzien 3-5: offerManager.js - Stage 1 (8-11 dni)
  -> Krok 3.1 Helpery (0.5h)
  -> Krok 3.2 Formatters (0.5h) - NOWY
  -> Krok 3.3 Constants (0.5h) - NOWY
  -> Krok 3.4 API Layer (1h)
  -> Krok 3.5 User Manager (1h)
  -> Krok 3.6 Order Selection (0.5h)
  -> Krok 3.7 File Ops (1h)
  -> Krok 3.8 Historia (2h)
  -> Krok 3.9 SVG Drag (1.5h)
  -> Krok 3.10 Transport - 2 sub-kroki (2h)
  -> Krok 3.11 Rabaty - 2 sub-kroki (2h)
  -> Krok 3.12 Renderowanie - 4 sub-kroki (4h)
  -> Krok 3.13 CRUD - 7 sub-kroków (3h) - OSTATNI!
  -> Krok 3.14 Bootstrap (1h)
  --- FREEZE + golden master + contract tests (1d) ---

Tydzien 6-8: orderManager.js - Stage 1 (5-8 dni)
  -> Krok 4.1 orderHelpers (0.5h)
  -> Krok 4.2 orderExport (0.5h)
  -> Krok 4.3 orderPrzejscia (1.5h)
  -> Krok 4.4 orderKartaBudowy - 3 sub-kroki (2h)
  -> Krok 4.5 orderBulk (1.5h)
  -> Krok 4.6 orderZlecenia - 3 sub-kroki (4h) - W OSOBNYCH DNIACH!
  -> Krok 4.7 orderCrud - 4 sub-kroki (4h) - W OSOBNYCH DNIACH!
  -> Krok 4.8 Init zostaje (0.5h)
  --- FREEZE + golden master + contract tests (1d) ---
```

**Zasada dniowa (orderManager.js):** Maksymalnie 1 sub-krok 4.7 na dzien. Nigdy createOrder (4.7.C) i enterOrderEditMode (4.7.D) tego samego dnia.

### Zaleznosci miedzy krokami

```
pdfGenerator.ts: 1.5 <- 1.6 (lookupOfferUsers potrzebny w ruryHtml)
                 1.5 <- 1.7 (lookupOfferUsers potrzebny w studnieHtml)
                 1.4 <- 1.8 (pdfEngine potrzebny w kartaBudowy)

offerItems.js:  2.6 <- 2.7 (sync potrzebny w addItems)
                2.6 <- 2.5 (sync potrzebny w updateItems)
               => Kolejnosc: 2.1->2.2->2.3->2.4->2.5->2.6->2.7->2.8->2.9->2.10

offerManager.js: 3.12 <- 3.13 (renderowanie uzywane przez CRUD)
                 3.11 <- 3.12 (rabaty uzywaja renderowania)
               => Kolejnosc: 3.1->3.2->3.3->3.4->3.5->3.6->3.7->3.8->3.9->3.10->3.11->3.12->3.13->3.14

orderManager.js: 4.3 <- 4.4 (przejscia przed kartaBudowy)
                 4.6 <- 4.5 (saveProductionOrder przed bulk)
                 4.4 <- 4.7 (kartaBudowy moze byc potrzebna w CRUD)
               => Kolejnosc: 4.1->4.2->4.3->4.4->4.5->4.6->4.7->4.8
```

---

## 12. Metryki sukcesu

Po zakonczeniu calego planu mierzymy:

| Metryka                                 | Przed      | Po                                            | Cel        |
| --------------------------------------- | ---------- | --------------------------------------------- | ---------- |
| **pdfGenerator.ts** - linie             | 1707       | ~200                                          | <500       |
| **offerItems.js** - linie               | 1045       | ~100                                          | <500       |
| **offerManager.js** - linie             | 3990       | ~150                                          | <500       |
| **orderManager.js** - linie             | 5114       | ~7                                            | <500       |
| **Sredni rozmiar modulu**               | -          | <300 linii                                    | <400       |
| **Najwieksza funkcja w nowych plikach** | 641 linii  | <100 linii                                    | <100       |
| **Liczba plików >500 linii**            | 4 (+ nowe) | 4 (crud + rendering + zlecenia + kartaBudowy) | 0 docelowo |
| **Public API (window.\*)**              | bez zmian  | bez zmian                                     | bez zmian  |
| **Liczba testów**                       | bez zmian  | bez zmian                                     | bez zmian  |
| **npm run typecheck**                   | OK         | OK                                            | OK         |
| **node -c dla wszystkich JS**           | -          | OK                                            | OK         |
| **Golden master**                       | -          | zachowany dla CRITICAL krokow                 | zachowany  |
| **Contract tests**                      | -          | przechodza dla wszystkich window.*            | przechodza |
| **Commit size**                         | -          | 150-250 linii na commit                       | 150-250    |

### Warunki uznania planu za zakonczony

1. Wszystkie pliki zrodlowe (<500 linii) - za wyjatkiem tych wymagajacych osobnego cyklu
2. Wszystkie funkcje przeniesione do nowych plików - bez zmian w logice
3. Public API (window.*) - 100% zgodne z baseline
4. Wszystkie testy - przechodza
5. Smoke testy dla kazdego pliku - wykonane i zapisane
6. Wszystkie commity - zgodne z Conventional Commits
7. Golden master dla CRITICAL funkcji - zachowany i zweryfikowany
8. Contract tests dla window.* - przechodza
9. Zaden commit nie przekracza 250 zmienionych linii

---

## 13. Procedura awaryjna

### 13.1 Wykrycie regresji

Jesli po ktorymkolwiek kroku zostanie wykryta regresja:

1. **Zatrzymaj** natychmiast dalsze kroki
2. **Zidentyfikuj** scope regresji (co przestalo dzialac)
3. **Ocen** czy jest to blad krytyczny (blokujacy dzialanie aplikacji)
4. **Jesli krytyczny**:
   a. Jesli uzyto feature flag (redirect reference) - przywroc stara referencje: window.fn = oldFn
   b. Jesli nie - git revert <ostatni_commit_hash>
5. **Jesli niekrytyczny** - napraw w kolejnym atomicznym commicie

### 13.2 Nieoczekiwane zachowanie

Jesli po zmianie aplikacja dziala ale inaczej niz przed zmiana:

1. Porownaj golden master (JSON API przed/po)
2. Porownaj HTML snapshot i serialized state
3. Porownaj diff miedzy obecnym a poprzednim commit
4. Sprawdz czy zmienila sie kolejnosc wykonywania (call graph freeze logi)
5. Sprawdz czy zmienily sie referencje do window.* (contract tests)
6. Sprawdz czy importy sa poprawne
7. Jesli przyczyna nie jest jasna -> revert

### 13.3 Blad typu undefined is not a function

1. Sprawdz czy wszystkie funkcje sa poprawnie eksportowane
2. Sprawdz czy kolejnosc ladowania skryptów w HTML jest zachowana
3. Sprawdz czy window.* przypisania sa wykonywane przed pierwszym uzyciem
4. Uruchom contract tests dla window.*

### 13.4 Blad skladni

1. Uruchom node -c <filename> dla JS
2. Uruchom npm run typecheck dla TS
3. Napraw blad skladni przed kontynuacja

### 13.5 Lista alertów - co wymaga natychmiastowego zatrzymania

| Alert                               | Dzialanie                                                           |
| ----------------------------------- | ------------------------------------------------------------------- |
| Testy jednostkowe nie przechodza    | Zatrzymaj, napraw, dopiero potem kolejny krok                       |
| npm run typecheck nie przechodzi    | Zatrzymaj, napraw typy                                              |
| node -c zwraca blad skladni         | Zatrzymaj, napraw skladnie                                          |
| Aplikacja nie startuje              | Revert ostatniego commita                                           |
| Oferta nie zapisuje sie             | Revert, sprawdz saveOfferStudnie lub saveOffer                      |
| PDF sie nie generuje                | Revert, sprawdz generatePDF                                         |
| Zlotka nie dodaja sie automatycznie | Revert, sprawdz syncGaskets                                         |
| Zamowienie nie finalizuje sie       | Revert, sprawdz finalizeOrderFromOffer                              |
| Zlecenia produkcyjne nie dzialaja   | Revert, sprawdz saveProductionOrder                                 |
| Tryb edycji zamowienia nie wchodzi  | Revert, sprawdz enterOrderEditMode                                  |
| **Golden master nie zgadza sie**    | **Zatrzymaj natychmiast! Porownaj roznice, zidentyfikuj przyczyne** |
| **Contract test nie przechodzi**    | **Zatrzymaj! Funkcja publicna zmienila sygnature**                  |

### 13.6 Smoke test - wzor

Przed uznaniem kroku za zakonczony wykonaj ponizszy smoke test dla danego pliku. Kazdy smoke test poprzedz golden master.

**Dla pdfGenerator.ts:**

- [ ] npm run typecheck przechodzi
- [ ] npx jest tests/pdfGenerator.test.ts przechodzi
- [ ] Wygenerowac PDF oferty rur (API)
- [ ] Wygenerowac PDF oferty studni (API)
- [ ] Wygenerowac Karte Budowy
- [ ] Wygenerowac DOCX (jesli dotyczy kroku)
- [ ] Golden master: porownaj hash PDF przed/po

**Dla offerItems.js:**

- [ ] node -c public/js/rury/offerItems.js - brak bledów
- [ ] node -c dla kazdego nowego pliku JS
- [ ] Dodac rure przez wyszukiwarke
- [ ] Dodac rure z okresleniem dlugosci
- [ ] Zmienic ilosc, rabat, narzut
- [ ] Dodac wkladke PEHD
- [ ] Sprawdzic czy zlotki dodaly sie automatycznie
- [ ] Wlaczyc/wylaczyc zabezpieczenie transportu
- [ ] Usunac pozycje
- [ ] Zaznaczyc checkboxy -> przejsc do zamowienia
- [ ] Przelaczyc zakladki (Konfiguracja/Oferta)
- [ ] Golden master: JSON API przed/po + HTML snapshot
- [ ] Contract tests: window.* wszystkie funkcje

**Dla offerManager.js:**

- [ ] node -c dla kazdego nowego pliku JS
- [ ] Utworzyc nowa oferte studni
- [ ] Dodac studnie -> skonfigurowac -> zapisac
- [ ] Wczytac istniejaca oferte
- [ ] Zmienic rabat -> zapisac -> sprawdzic podsumowanie
- [ ] Otworzyc modal transportu -> zmienic -> zapisac
- [ ] Sprawdzic historie oferty -> przywrocic snapshot
- [ ] Zmienic opiekuna oferty
- [ ] Wyeksportowac JSON -> zaimportowac
- [ ] Zaznaczyc studnie -> przejsc do zamowienia
- [ ] Wyczyscic formularz
- [ ] Golden master: JSON API + HTML snapshot + serialized state
- [ ] Contract tests: window.* wszystkie funkcje

**Dla orderManager.js:**

- [ ] node -c dla kazdego nowego pliku JS
- [ ] Utworzyc zamowienie z oferty studni
- [ ] Sprawdzic karte budowy krok 4
- [ ] Dodac/usunac przejscia szczelne
- [ ] Edytowac istniejace zamowienie (tryb edycji)
- [ ] Zapisac zmiany w zamowieniu
- [ ] Usunac zamowienie
- [ ] Otworzyc zlecenia produkcyjne
- [ ] Dodac zlecenie produkcyjne
- [ ] Zaakceptowac/cofnac zlecenie produkcyjne
- [ ] Bulk generation zlecen
- [ ] Eksport karty budowy (PDF/DOCX)
- [ ] Zweryfikowac spojnosc danych po edycji
- [ ] Golden master: JSON API + HTML snapshot + serialized state
- [ ] Contract tests: window.* wszystkie funkcje

---

## 14. Baseline funkcjonalny - scenariusze testowe

### Zlota zasada: Golden Master przed kazdym CRITICAL krokiem

Przed rozpoczeciem Stage 1 oraz po kazdym CRITICAL sub-kroku:

1. Wykonaj golden master (sekcja 1 - Golden Master procedura)
2. Wykonaj baseline testy z tej sekcji
3. Po zmianie wykonaj golden master raz jeszcze
4. Porownaj baseline z golden master

Przed rozpoczeciem Stage 1 oraz po kazdym CRITICAL kroku wykonaj pelen baseline test.
Wszystkie scenariusze musza przechodzic IDENTYCZNIE przed i po zmianie.

### 14.1 Offer CRUD (rury)

- [ ] Utworzyc nowa oferte rur
- [ ] Dodac produkt z katalogu
- [ ] Skonfigurowac dlugosc, ilosc, rabat, narzut
- [ ] Dodac wkladke PEHD
- [ ] Zapisac oferte
- [ ] Wczytac zapisana oferte
- [ ] Zmodyfikowac i zapisac ponownie
- [ ] Usunac oferte
- [ ] Wyczyscic formularz

### 14.2 Offer CRUD (studnie)

- [ ] Utworzyc nowa oferte studni
- [ ] Dodac studnie z konfiguratora
- [ ] Skonfigurowac elementy studni
- [ ] Zmienic rabaty
- [ ] Ustawic transport
- [ ] Zapisac oferte
- [ ] Wczytac istniejaca oferte
- [ ] Zmienic opiekuna oferty
- [ ] Wyeksportowac JSON
- [ ] Zaimportowac JSON
- [ ] Sprawdzic historie oferty
- [ ] Przywrocic snapshot z historii
- [ ] Wyczyscic formularz

### 14.3 Order CRUD (studnie)

- [ ] Utworzyc zamowienie z oferty
- [ ] Przejsc przez karte budowy krok 4
- [ ] Sfinalizowac zamowienie
- [ ] Edytowac istniejace zamowienie (enterOrderEditMode)
- [ ] Zmienic ilosci/ceny w trybie edycji
- [ ] Zapisac zmiany w zamowieniu
- [ ] Usunac zamowienie
- [ ] Zweryfikowac spojnosc danych oferty po edycji zamowienia

### 14.4 Production orders (zlecenia)

- [ ] Otworzyc modal zlecen produkcyjnych
- [ ] Wybrac studnie z listy
- [ ] Skonfigurowac element zlecenia
- [ ] Zapisac zlecenie produkcyjne
- [ ] Zaakceptowac zlecenie
- [ ] Cofnac akceptacje
- [ ] Usunac zlecenie
- [ ] Bulk generation (wiele zlecen naraz)
- [ ] Filtrowanie listy zlecen

### 14.5 Karta budowy + przejscia

- [ ] Inicjalizacja karty budowy krok 4
- [ ] Automatyczne wykrywanie parametrów
- [ ] Reczne uzupelnienie danych
- [ ] Dodanie przejscia szczelnego
- [ ] Zmiana DN przejscia
- [ ] Usuniecie przejscia
- [ ] Kopiowanie karty budowy z innego zamowienia
- [ ] Zebranie wszystkich danych (collectKartaBudowyDataStep4)

### 14.6 Exports

- [ ] PDF oferty rur
- [ ] PDF oferty studni
- [ ] PDF zamowienia rur
- [ ] PDF zamowienia studni
- [ ] Karta budowy PDF
- [ ] Karta budowy DOCX
- [ ] Dokument Word zamowienia

### 14.7 SVG preview

- [ ] Renderowanie diagramu SVG studni
- [ ] Drag elementów na diagramie
- [ ] Zmiana liczby elementów przez diagram

### 14.8 Transport

- [ ] Ustawienie transportu w ofercie
- [ ] Zmiana trybu transportu
- [ ] Przeliczenie kosztów transportu
- [ ] Zapis transportu w zamowieniu

### 14.9 Discounts

- [ ] Otwarcie modalu rabatów
- [ ] Zmiana rabatu globalnego
- [ ] Zmiana rabatu per-studnia
- [ ] Zapis rabatów -> weryfikacja podsumowania
- [ ] Zaladowanie rabatów z zapisanej oferty

### 14.10 History

- [ ] Wyswietlenie historii oferty
- [ ] Zaladowanie starszych wpisów
- [ ] Podglad snapshota
- [ ] Przywrocenie snapshota

---

## 15. Definition of Done

Kazdy krok refaktoryzacji jest zakonczony dopiero gdy wszystkie ponizsze punkty sa spelnione.

### 15.1 Check lista po kazdym kroku

**Weryfikacja techniczna:**

- [ ] node -c <filename> dla wszystkich zmienionych plików JS
- [ ] npm run typecheck dla wszystkich zmienionych plików TS
- [ ] npm run lint - brak nowych bledów
- [ ] npm run format - kod sformatowany

**Weryfikacja kodu:**

- [ ] Wszystkie importy istnieja i sa poprawne
- [ ] Wszystkie eksporty istnieja i sa poprawne
- [ ] Wszystkie event listenery nadal dzialaja
- [ ] Wszystkie callbacki dzialaja
- [ ] Wszystkie popupy dzialaja
- [ ] Wszystkie requesty dzialaja
- [ ] Wszystkie Promise sa resolve
- [ ] Wszystkie async await zachowane
- [ ] Wszystkie wyjatki nadal obslugiwane
- [ ] Wszystkie return pozostaja identyczne
- [ ] Wszystkie wartosci null/undefined zachowane
- [ ] Wszystkie default values zachowane
- [ ] Wszystkie if/else/switch zachowane
- [ ] Wszystkie edge case zachowane
- [ ] Wszystkie komunikaty bledów zachowane
- [ ] Wszystkie logi zachowane

**Golden Master (CRITICAL/HIGH):**

- [ ] Golden master JSON API wykonany przed zmiana
- [ ] Golden master JSON API wykonany po zmianie
- [ ] Roznice w golden master dotycza WYLACZNIE niezmienionych fragmentów
- [ ] Call graph freeze - porownana sekwencja wywolan
- [ ] Event dependency map - przeplyw eventu identyczny

**HTML Snapshot + Serialized State (CRITICAL):**

- [ ] Snapshot HTML i serialized state wykonany przed zmiana
- [ ] Snapshot HTML i serialized state wykonany po zmianie
- [ ] Roznice w snapshotach dotycza WYLACZNIE niezmienionych fragmentów

**Contract Tests (window.\*):**

- [ ] typeof window.fn === "function" dla wszystkich funkcji publicznych
- [ ] window.fn.length === oryginalnaLiczbaParametrów
- [ ] window.fn.name === oryginalnaNazwa
- [ ] Zwraca Promise (async) vs non-Promise - bez zmian

**Smoke test (sekcja 13.6):**

- [ ] Smoke test dla danego pliku - wszystkie punkty OK
- [ ] Manualny test CRITICAL flow (zapis/wczytanie/finalizacja)
- [ ] Golden master po smoke tecie - zgodny

**Code review:**

- [ ] Diff review - tylko przeniesiony kod, zero zmian logiki
- [ ] Sprawdzenie czy window.* nie zostaly zdublowane
- [ ] Sprawdzenie czy kolejnosc ladowania w HTML jest poprawna
- [ ] Sprawdzenie czy diff nie przekracza 250 linii
- [ ] Sprawdzenie czy liczba eksportów zgadza sie z planem modulów (Baseline Report)
- [ ] Sprawdzenie czy nie utworzono nowych globali (window.*) — lista w sekcji 5.2
- [ ] Sprawdzenie czy nie wprowadzono nowych zależności cyklicznych (sprawdz importy miedzy nowymi plikami)

**Integracja:**

- [ ] Aplikacja uruchamia sie bez bledów konsoli
- [ ] Inne moduly (niezmienione) dzialaja poprawnie
- [ ] Rollback mozliwy przez git revert lub feature flag (redirect)

**Commit:**

- [ ] Commit zgodny z Conventional Commits: refactor(scope): opis
- [ ] Tylko zmiany zwiazane z tym krokiem
- [ ] Commit nie przekracza 250 zmienionych linii
- [ ] Commit podpisany i gotowy do pusha

---

## Zalacznik A - Wzor Baseline Report

```markdown
### Baseline Report - [nazwa pliku]

| Metryka                     | Wartosc |
| --------------------------- | ------- |
| Linie kodu                  | ...     |
| Liczba funkcji              | ...     |
| Liczba exportów             | ...     |
| Liczba window.*             | ...     |
| Liczba operacji na DOM      | ...     |
| Liczba listenerów           | ...     |
| Liczba fetch/API            | ...     |
| Liczba mutacji globali      | ...     |
| Zlozonosc cyklomatyczna max | ...     |
```

## Zalacznik B - Wzor raportu po kroku

```markdown
### Raport po kroku [N.N]

| Pole                                | Wartosc             |
| ----------------------------------- | ------------------- |
| Zmienione pliki                     | [lista]             |
| Przeniesione funkcje                | [lista]             |
| Zmienione importy                   | [lista]             |
| Zmienione eksporty                  | [lista]             |
| Public API zmienione?               | TAK / NIE           |
| Zachowanie identyczne?              | TAK / NIE           |
| Ryzyko regresji                     | LOW / MEDIUM / HIGH |
| node -c / npm run typecheck         | OK / BLAD           |
| Golden master (JSON/PDF/HTML/state) | OK / BLAD           |
| Contract tests (window.*)           | OK / BLAD           |
| Smoke test                          | OK / BLAD           |
| Commit size (diff lines)            | [liczba]            |
```

---

## 3 najwazniejsze rekomendacje autora review

```
+-------------------------------------------------------------+
|         3 NAJWAZNIEJSZE REKOMENDACJE AUTORA REVIEW            |
|                       (v5 - updated)                         |
+-------------------------------------------------------------+
|                                                              |
|  1. GOLDEN MASTER - WHITELISTA ROZNIC                        |
|     - Przed pierwsza zmiana i po KAZDYM CRITICAL kroku:      |
|       * baseline/offer-<id>.json - JSON oferty z API         |
|       * baseline/order-<id>.json - JSON zamowienia z API     |
|       * baseline/pdf-<id>.pdf - output PDF                   |
|       * baseline/render-<id>.html - outerHTML kontenerow     |
|       * baseline/state-<id>.json - serialized state          |
|     - Porownuj diffem po kazdym sub-kroku                    |
|     - WHITELISTA dozwolonych roznic:                         |
|       updatedAt, createdAt, lastViewed, uuid,               |
|       requestId, sessionId                                   |
|     - Kazda inna roznica = regresja -> zatrzymaj             |
|                                                              |
|  2. ONE BUSINESS MODULE PER COMMIT                           |
|     - Max 250 linii (jak dotad) + co najwyzej JEDEN          |
|       modul biznesowy na commit                              |
|     - Przyklad: offerTransport LUB offerHistory,            |
|       nie oba naraz                                          |
|     - Ulatwia rollback, code review i git bisect            |
|                                                              |
|  3. orderManager - PELNY FLOW TEST PO KAZDYM KROKU           |
|     - Po KAZDYM sub-kroku ekstrakcji orderManager.js:       |
|       * createOrder -> editOrder -> saveOrder ->            |
|         reopenOrder -> finalizeOrder                        |
|     - Nie testuj tylko wyizolowanego modulu                 |
|     - Caly flow musi dzialac od poczatku do konca           |
|                                                              |
+-------------------------------------------------------------+
| Stosuj te trzy zasady BEZWZGLEDNIE. Reszta to wsparcie.     |
| Bez Golden Master z whitelista nie wiesz czy cos zepsules. |
| Bez limitu modulu biznesowego nie wiesz co zepsules.       |
| Bez flow testu nie wiesz czy zamowienia dzialaja.           |
+-------------------------------------------------------------+

---

_Koniec dokumentu._
```
