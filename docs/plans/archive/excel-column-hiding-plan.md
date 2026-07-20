# Plan: Konfigurowalne ukrywanie kolumn w tabelach Excel (wersja 2)

## 0. Audyt nawigacji — indeksy full-index vs visible-index

Wynik audytu plików pod kątem twardych indeksów kolumn:

| Plik                         | Funkcja                    | Mechanizm                                          | Typ indeksu    | Ryzyko                                                                                                                                                    |
| ---------------------------- | -------------------------- | -------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `excelSelection.js:124`      | `_excelGetNavElements()`   | `row.querySelectorAll('td')` → iteracja `cells[i]` | **full-index** | OK — hidden cols nie ma w DOM, iteracja je pomija                                                                                                         |
| `excelSelection.js:12`       | `_excelInitColumnSelect()` | `headers.forEach((th, colIdx))`                    | **full-index** | OK — po filtrze nagłówki to tylko visible                                                                                                                 |
| `excelSelection.js:34`       | `_excelSelectCol(colIdx)`  | `row.children[colIdx]`                             | **full-index** | OK — DOM zawiera tylko visible cols                                                                                                                       |
| `excelSelection.js:80`       | `_excelToggleColClass()`   | `row.children[colIdx]`                             | **full-index** | OK — j.w.                                                                                                                                                 |
| `excelCellNavigation.js:41`  | `_excelHandleTab()`        | `navEls.indexOf(target)`                           | **full-index** | OK — `navEls` z `_excelGetNavElements`                                                                                                                    |
| `excelCellNavigation.js:138` | `_excelHandleArrow()`      | `rowEls.indexOf(target)`                           | **full-index** | OK                                                                                                                                                        |
| `excelCellNavigation.js:225` | `_excelSkipDisabled()`     | operuje na tablicy elementów                       | **full-index** | OK                                                                                                                                                        |
| `excelCellSelection.js:5`    | `_excelToggleCellClass()`  | `:nth-child(colIdx + 1)`                           | **full-index** | OK — po filtrze nth-child = visible-index                                                                                                                 |
| `excelCellSelection.js:25`   | `_excelSelectCell()`       | `_excelSelectedCells` z `colIdx`                   | **full-index** | OK — selekcja czyszczona na re-render                                                                                                                     |
| `excelCellSelection.js:58`   | `_excelOnMouseDown()`      | `Array.indexOf(tr.children, td)`                   | **full-index** | OK                                                                                                                                                        |
| `excelCellSelection.js:269`  | `_excelSelectRange()`      | `row.children[c]`                                  | **full-index** | OK                                                                                                                                                        |
| `excelCopyPaste.js:16`       | `_excelHandleCopy()`       | `row.children[c]`                                  | **full-index** | OK — tylko visible w DOM                                                                                                                                  |
| `excelCopyPaste.js:96`       | `_excelHandlePaste()`      | `row.children[colIdx]`                             | **full-index** | OK                                                                                                                                                        |
| `excelCopyPaste.js:4`        | `_excelGetPasteColIdx()`   | `Array.from(row.children).indexOf(td)`             | **full-index** | OK                                                                                                                                                        |
| `excelTableManager.js:45`    | `_excelInitColumnResize()` | `Array.from(headers).indexOf(th)` → `ci`           | **full-index** | **UWAGA** — `_excelColWidths[key]` uzywa indeksu fizycznego; po zmianie widocznosci ten sam klucz moze wskazywac inna kolumne. Pre-existing, nie w scope. |

**Wniosek:** Wszystkie operacje uzywaja fizycznych indeksow DOM. Poniewaz ukryte kolumny sa **usuwane z DOM** (nie CSS-hidden), fizyczny indeks = widoczny indeks. Zaden kod nie wymaga refaktoryzacji na visible-index. Nalezy jedynie dodac `_excelDeselectAllCols()` przed re-renderem w pipeline widocznosci, by zapobiec dryfowi indeksow w `_excelSelectedCols`.

---

## 1. Stan ukrycia kolumn — `_excelState.hiddenColumnIds`

Przeniesc stan z osobnego Seta do `_excelState.js`. Wszystkie stany excela w jednym miejscu.

**Plik:** `excelState.js` — dodac:

```js
// Stan widocznosci kolumn — tablica ID ukrytych kolumn
let _excelHiddenColumnIds = [];

const _EXCEL_STORAGE_KEY = 'witros_excel_hidden_columns';
```

Funkcje:

| Funkcja                               | Opis                                                                               |
| ------------------------------------- | ---------------------------------------------------------------------------------- |
| `_excelLoadColumnVisibility()`        | Odczyt z `localStorage`, parsowanie JSON, przypisanie do `_excelHiddenColumnIds`   |
| `_excelSaveColumnVisibility()`        | Zapis `JSON.stringify(_excelHiddenColumnIds)` do `localStorage`                    |
| `_excelToggleColumnVisibility(colId)` | Toggle ID w tablicy + `_excelSaveColumnVisibility()` + `_excelRenderTable()`       |
| `_excelResetColumnVisibility()`       | Czyści `_excelHiddenColumnIds = []` + zapis + re-render                            |
| `_excelIsColumnHidden(colId)`         | `_excelHiddenColumnIds.includes(colId)`                                            |
| `_excelSetAllColumnsVisible(visible)` | Jesli `visible=false` → ukryj wszystkie komponenty; jesli `true` → pokaz wszystkie |

Decyzja: **`localStorage`** — trwalosc miedzy reloadami. Klucz: `'witros_excel_hidden_columns'`. Format: prosta JSON tablica ID kolumn.

`_excelDeselectAllCols()` wywolac przed kazdym re-renderem wywolanym przez zmiane widocznosci (w `_excelToggleColumnVisibility` i `_excelResetColumnVisibility`).

---

## 2. System ID kolumn — kazda kolumna ma unikalne `id`

**Plik:** `excelColumns.js` — w `_excelBuildComponentColumns()` dodac pole `id` do kazdego obiektu kolumny.

Schemat ID: `{componentType}-{sufiks}`

| Typ kolumny       | Wzorzec ID                                              | Przykład                    |
| ----------------- | ------------------------------------------------------- | --------------------------- |
| Właz              | `wlaz-{height}`                                         | `wlaz-150`                  |
| AVR               | `avr-{productId}`                                       | `avr-AVR-100`               |
| Konus             | `konus-{height}`                                        | `konus-500`                 |
| Płyta DIN         | `plyta_din-{height}`                                    | `plyta_din-200`             |
| Płyta najazdowa   | `plyta_najazdowa-{height}`                              | `plyta_najazdowa-200`       |
| Płyta zamykająca  | `plyta_zamykajaca-{height}`                             | `plyta_zamykajaca-150`      |
| Pierścień odciąż. | `pierscien_odciazajacy-{height}`                        | `pierscien_odciazajacy-300` |
| Płyta redukcyjna  | `plyta_redukcyjna-{productId}`                          | `plyta_redukcyjna-PR-1000`  |
| Krąg              | `krag-{height}`                                         | `krag-500`                  |
| Krąg OT           | `krag_ot-{height}`                                      | `krag_ot-500`               |
| Dennica           | `dennica-{height}` lub `dennica-{productId}`            | `dennica-500`               |
| Osadnik           | `osadnik-{productId}`                                   | `osadnik-OS-1000`           |
| Styczna           | `styczna-{productId}`                                   | `styczna-SS-1200`           |
| Uszczelka         | `uszczelka-{productId}` lub `red_uszczelka-{productId}` | `uszczelka-GSG-DN1000`      |
| Red. AVR          | `red_avr-{targetDn}-{productId}`                        | `red_avr-1000-AVR-80`       |
| Red. Konus        | `red_konus-{targetDn}-{height}`                         | `red_konus-1000-500`        |
| Red. Krąg         | `red_krag-{targetDn}-{height}`                          | `red_krag-1000-500`         |
| Red. Dennica      | `red_dennica-{targetDn}-{height}`                       | `red_dennica-1000-300`      |
| Red. Płyty        | `red_{ct}-{targetDn}-{height}`                          | `red_plyta_din-1000-200`    |
| Red. Osadnik      | `red_osadnik-{targetDn}-{productId}`                    | `red_osadnik-1000-OS-800`   |
| Red. Krąg OT      | `red_krag_ot-{targetDn}-{height}`                       | `red_krag_ot-1000-400`      |
| Red. Płyta red.   | `red_plyta_red-{productId}`                             | `red_plyta_red-PR-DN1000`   |

**Wazne:** `componentType` pozostaje jako pole do grupowania UI. To `id` jest uzywane do przechowywania stanu widocznosci.

---

## 3. Pojedyncza funkcja filtrujaca — `_excelGetVisibleComponentColumns()`

Zamiast filtrowac w dwoch miejscach (`excelTableRenderer.js` i `excelTableBody.js`), stworzyc jedna funkcje:

**Nowy plik:** `excelColumnVisibility.js` (LUB dodac do `excelHelpers.js` — wybor nizej)

```js
function _excelGetVisibleComponentColumns(dn, well) {
    const compCols = _excelBuildComponentColumns(dn, well);
    return _excelFilterVisibleColumns(compCols);
}

function _excelFilterVisibleColumns(compCols) {
    if (_excelHiddenColumnIds.length === 0) return compCols;
    return compCols.filter(function (col) {
        return !_excelHiddenColumnIds.includes(col.id);
    });
}
```

**Decyzja (YAGNI):** Dodac do `excelHelpers.js` zamiast nowego pliku. Oszczedza jeden plik, a logika jest trywialna. Jesli UI dropdown rozrosnie sie > 50 linii, wydzielic do osobnego pliku.

Oba renderery (`excelTableRenderer.js:45` i `excelTableBody.js:5`) uzywaja `_excelGetVisibleComponentColumns()` zamiast `_excelBuildComponentColumns()`.

---

## 4. Pipeline widocznosci — klarowny przeplyw danych

```
_excelToggleColumnVisibility(colId)
  → _excelDeselectAllCols()           // czysci stare indeksy
  → _excelHiddenColumnIds toggle
  → _excelSaveColumnVisibility()
  → _excelRenderTable(_excelActiveTab)

_excelRenderTable(dn)
  → zapisz scrollLeft, scrollTop
  → zapisz focus (juz istnieje)
  → const compCols = _excelGetVisibleComponentColumns(dn, refWell)  // NOWE
  → ... reszta renderowania ...
  → przywroc focus (juz istnieje)
  → przywroc scrollLeft, scrollTop     // NOWE
```

**W `_excelRenderTable()` dodac:**

```js
// Przed container.innerHTML = html:
const scrollLeft = container.scrollLeft;
const scrollTop = container.scrollTop;

// Po lucide.createIcons, przed restore focus:
container.scrollLeft = scrollLeft;
container.scrollTop = scrollTop;
```

Restore focus juz istnieje (linie 306-324 w `excelTableRenderer.js`). Nalezy go zachowac bez zmian.

---

## 5. UI — dropdown "Kolumny" w toolbarze

**Plik:** `excelModal.js` — dodac przycisk w toolbarze (obok przycisku "Pełny"):

```
<button onclick="_excelToggleColumnDropdown()" title="Pokaż/ukryj kolumny">
  <i data-lucide="columns"></i> Kolumny
</button>
```

**Nowy plik:** `excelColumnVisibility.js` (jesli UI przekroczy ~50 linii — wydzielic)

Zawartosc dropdown:

1. **"Select All"** checkbox — zaznacza/odznacza wszystkie grupy komponentow
2. Lista grup wg `componentType` z checkboxami:
    - Pobrac liste unikalnych `componentType` z `_excelBuildComponentColumns(dn)`
    - Grupowac kolumny (Właz, AVR, Konus, Kręgi, Płyty, Dennica, Osadnik, Uszczelki, Styczne, Redukcja)
    - Kazda grupa: checkbox + nazwa + liczba kolumn
    - Stan checkboxa: odznaczony jesli WSZYSTKIE kolumny w grupie sa ukryte, zaznaczony jesli WSZYSTKIE widoczne, indeterminate jesli mieszane
3. **"Reset do domyślnych"** button — wywoluje `_excelResetColumnVisibility()`
4. Klikniecie checkboxa grupy: pokazuje/ukrywa WSZYSTKIE kolumny w tej grupie
5. `lucide.createIcons({root: dropdown})` po kazdym otwarciu

Pozycjonowanie: absolutne pod przyciskiem, z-index: 100, max-height z scroll, ciemne tlo.

**Obsluga grupy `_reduction`** (wirtualna): jesli kolumna ma `fromReduction: true`, nalezy ja grupowac jako "Redukcja" w UI, niezaleznie od `componentType`. W dropdown checkbox "Redukcja" kontroluje wszystkie kolumny z `fromReduction=true`.

---

## 6. Inicjalizacja przy starcie

**Plik:** `excelModal.js` — w `openExcelTableModal()`, po utworzeniu overlay, przed `_excelRenderTable()`:

```js
_excelLoadColumnVisibility();
```

**Plik:** `excelTabs.js` — w `excelSwitchTab()`, po zmianie zakladki, przed `_excelRenderTable()`: stan juz zaladowany, nie trzeba ponownie.

---

## 7. Kolejnosc implementacji

| Krok | Plik(i)                    | Zmiana                                                                                                                                                                                     | Szac. linii |
| ---- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| 1    | `excelState.js`            | Dodac `_excelHiddenColumnIds`, `_excelLoadColumnVisibility()`, `_excelSaveColumnVisibility()`, `_excelToggleColumnVisibility()`, `_excelResetColumnVisibility()`, `_excelIsColumnHidden()` | ~30         |
| 2    | `excelColumns.js`          | Dodac pole `id` do kazdego obiektu kolumny w `_excelBuildComponentColumns()`                                                                                                               | ~20         |
| 3    | `excelHelpers.js`          | Dodac `_excelFilterVisibleColumns()` i `_excelGetVisibleComponentColumns()`                                                                                                                | ~10         |
| 4    | `excelTableRenderer.js`    | Uzyc `_excelGetVisibleComponentColumns()` zamiast `_excelBuildComponentColumns()`. Dodac save/restore `scrollLeft`, `scrollTop`.                                                           | ~8          |
| 5    | `excelTableBody.js`        | Zmienic parametr z `compCols` na `visibleCols` (juz przekazany z renderera)                                                                                                                | ~2          |
| 6    | `excelModal.js`            | Dodac przycisk "Kolumny" w toolbarze. Dodac `_excelLoadColumnVisibility()` w `openExcelTableModal()`.                                                                                      | ~10         |
| 7    | `excelColumnVisibility.js` | NOWY — UI dropdown: "Select All", lista grup checkboxow, "Reset do domyslnych", `_excelToggleColumnDropdown()`                                                                             | ~80         |
| 8    | `excelModal.js`            | Import/wczytanie `excelColumnVisibility.js` (jako script w `studnie.html`)                                                                                                                 | ~1          |

Lacznie: ~160 linii, 8 plikow (1 nowy, 7 modyfikowanych).

---

## 8. Testy

### 8.1. Switch aktywnej zakladki (zmiana DN) → widocznosc zachowana

1. Otworz Excel, ukryj grupe "Kregi" na DN1000
2. Przelacz na DN1200 → kolumny DN1200 renderuja sie, ale "Kregi" pozostaja ukryte
3. Przelacz z powrotem na DN1000 → "Kregi" nadal ukryte
4. **Asercja:** `_excelHiddenColumnIds` niezmienione, UI dropdown pokazuje poprawne stany

### 8.2. Toggle DN gdzie pojawiaja sie nowe typy komponentow → mapowanie ID dziala

1. Ukryj "Wlaz" na DN1000 (ID: `wlaz-150`)
2. Przelacz na DN2000 (inne produkty WLaz, np. `wlaz-200`)
3. Wlaz na DN2000 powinien byc WIDOCZNY (bo `wlaz-200` nie jest na liscie ukrytych)
4. **Asercja:** `_excelIsColumnHidden('wlaz-200') === false`, `_excelIsColumnHidden('wlaz-150') === true`

### 8.3. Ukryj WSZYSTKIE grupy komponentow → tylko kolumny bazowe + przejscia

1. Ukryj wszystkie grupy (Wlaz, AVR, Konus, Płyty, Kregi, Dennica, Osadnik, Uszczelki, Styczne, Redukcja)
2. **Asercja:** Tabela zawiera tylko: checkbox, A/M, Lp, NrStudni, RzWlazu, RzDna, Wys, przejscia (0..N), H denn, Uszcz, Redukcja, Kineta, P.Buda, Akcje
3. Zaden input/select z komponentow nie istnieje w DOM

### 8.4. Kopiuj zakres obejmujacy ukryte kolumny → tylko widoczne komorki

1. Zaznacz zakres komorek od kolumny 2 do 10 (lub jakis zakres)
2. Ukryj kolumny 4-6
3. Ctrl+C → schowek zawiera tylko wartosci z widocznych kolumn (kolumny 2,3,7,8,9,10)
4. Wklej w nowe miejsce → dane trafiaja w poprawne kolumny

**Uwaga:** Poniewaz selekcja komorek jest czyszczona na re-render, test wymaga: zaznacz → odswiez dane (nie re-render, tylko `_excelRefreshAutoCells`) → lub najpierw ukryj, potem zaznacz, potem kopiuj.

### 8.5. Resize kolumn po ukryciu → obsluga

1. Zmien szerokosc kolumny "Kregi H=500" na 200px
2. Ukryj "Kregi H=500", pokaz ponownie
3. **Asercja:** Szerokosc przywrocona z `_excelColWidths` (o ile `_excelInitColumnResize()` dziala poprawnie)
4. **Uwaga:** Pre-existing znany bug: `_excelColWidths` indeksowany fizycznie, moze wskazywac inna kolumne po zmianie widocznosci. Dokumentowac, nie fixowac w tym tasku.

### 8.6. Sticky kolumny po ekstremalnym scrollu → poprawne left offset

1. Ukryj wszystkie komponenty (tylko bazowe + przejscia)
2. Scroll w prawo do konca
3. **Asercja:** Sticky kolumny 0-6 (checkbox, A/M, Lp, NrStudni, RzWlazu, RzDna, Wys) maja poprawne `left` — `_excelApplyStickyColumns()` dziala na `:nth-child(-n+7)` ktore nie ulegly zmianie
4. Scroll w dol → sticky header (3 rzedy) nadal na gorze

### 8.7. Page refresh (localStorage) → widocznosc przywrocona

1. Ukryj 2 grupy komponentow
2. Odswiez strone (F5)
3. Otworz Excel
4. **Asercja:** Te same grupy sa ukryte, `_excelHiddenColumnIds` zawiera oczekiwane ID
5. **Asercja:** UI dropdown pokazuje poprawne stany checkboxow

### 8.8. Select All / Reset do domyslnych

1. Ukryj kilka grup
2. Kliknij "Select All" w dropdown → wszystkie kolumny widoczne
3. Kliknij "Select All" ponownie → wszystkie komponenty ukryte
4. Kliknij "Reset do domyslnych" → wszystkie kolumny widoczne, `_excelHiddenColumnIds === []`

---

## 9. Ryzyka i mitigacje

| Ryzyko                                              | S   | Mitigacja                                                                    |
| --------------------------------------------------- | --- | ---------------------------------------------------------------------------- |
| `_excelSelectedCols` dryf indeksow po re-renderze   | MED | `_excelDeselectAllCols()` przed kazdym re-renderem z visibility              |
| `_excelColWidths` fizyczny indeks zmienia znaczenie | LOW | Pre-existing; dokumentowac, nie fixowac                                      |
| Ukrycie wszystkich kolumn → pusta tabela            | LOW | Nie dotyczy — kolumny bazowe + przejscia + kineta + akcje sa zawsze widoczne |
| XSS przez nazwy produktow w dropdown                | MED | Uzyc `escapeHtml()` w UI dropdown                                            |
| localStorage pelny (5MB limit)                      | LOW | Kilka bajtow na ID kolumny, setki ID ~ 10KB max                              |

---

## 10. Pliki do modyfikacji — podsumowanie

| Plik                                         | Operacja                                                                         |
| -------------------------------------------- | -------------------------------------------------------------------------------- |
| `public/js/studnie/excelState.js`            | + stan, + load/save/toggle/reset                                                 |
| `public/js/studnie/excelColumns.js`          | + `id` w kazdym `cols.push()`                                                    |
| `public/js/studnie/excelHelpers.js`          | + `_excelFilterVisibleColumns()`, + `_excelGetVisibleComponentColumns()`         |
| `public/js/studnie/excelTableRenderer.js`    | uzyc `_excelGetVisibleComponentColumns()`, + scroll save/restore                 |
| `public/js/studnie/excelTableBody.js`        | parametr `compCols` → `visibleCols` (juz z renderera)                            |
| `public/js/studnie/excelModal.js`            | + przycisk "Kolumny", + `_excelLoadColumnVisibility()` w `openExcelTableModal()` |
| `public/js/studnie/excelColumnVisibility.js` | NOWY — UI dropdown                                                               |
| `public/js/studnie/studnie.html`             | + `<script src="excelColumnVisibility.js?v=VERSION">`                            |
