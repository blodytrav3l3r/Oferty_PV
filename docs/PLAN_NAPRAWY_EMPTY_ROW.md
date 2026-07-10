# Plan Naprawy: Przesunięcie pustego wiersza w Excel Configuration Table (studnie)

## Spis treści

1. [Opis problemu](#1-opis-problemu)
2. [Root Cause Analysis](#2-root-cause-analysis)
3. [Szczegółowy opis fixu](#3-szczegółowy-opis-fixu)
4. [Weryfikacja](#4-weryfikacja)
5. [Pliki zmienione](#5-pliki-zmienione)
6. [Audyt — znane błędy](#6-audyt--znane-błędy)

---

## 1. Opis problemu

W Excel Configuration Table (modal tabeli konfiguracyjnej studni) pusty wiersz (`#excel-empty-row`) jest wizualnie przesunięty względem wierszy danych. Różnica widoczna w kolumnach sticky (pierwsze 7 kolumn: checkbox, A/M, Lp., Nr studni, Rz. Włazu, Rz. Dna, Wys.). Przesunięcie powoduje, że komórki pustego wiersza nie pokrywają się z komórkami wierszy danych, co utrudnia wizualne porównanie i nadawanie nowych wpisów.

---

## 2. Root Cause Analysis

### 2.1 Architektura renderowania tabeli

Tabela jest generowana w `_excelRenderTable(dn)` (linia 2081). Funkcja buduje HTML składający się z:

| Sekcja    | Wiersze                           | Odpowiada za            |
| --------- | --------------------------------- | ----------------------- |
| `<thead>` | 3 wiersze (h3, h1, h2)            | Nagłówki kolumn         |
| `<tbody>` | N wierszy danych + 1 pusty wiersz | Dane studni + nowy wpis |

### 2.2 Mechanizm sticky columns

Po wyrenderowaniu całego HTML (linia 2736: `container.innerHTML = html`), funkcja `_excelApplyStickyColumns()` (linia 2791) nadaje pozycjonowanie sticky dla pierwszych 7 kolumn:

1. Pobiera pierwszy wiersz `<thead>` (linia 2797)
2. Mierzy rzeczywistą szerokość (`offsetWidth`) pierwszych 7 komórek (linie 2803–2805)
3. Oblicza skumulowane pozycje `left` (linie 2801–2806)
4. Aplikuje `position: sticky; left: Npx` na **wszystkich** komórkach `th` i `td` w pierwszych 7 kolumnach (linie 2808–2828)

### 2.3 Różnica między data rows a empty row

Wiersze danych używają helpera `_excelOverlaySelectHtml(opts, curVal, onChange, width)` do generowania selektów overlay w kolumnach:

- przejścia — rodzaj (linia 2508)
- przejścia — średnica (linia 2528)
- właz (linia 2563)
- redukcja (linia 2627)
- kineta (linia 2643)

Natomiast pusty wiersz początkowo używał pięciu **gołych `<select disabled>`** zamiast tego helpera:

| Lokalizacja          | Przed (goły select)             | Po (helper)                                                 |
| -------------------- | ------------------------------- | ----------------------------------------------------------- |
| Przejścia — rodzaj   | `<select disabled style="...">` | `_excelOverlaySelectHtml([['', '—']], '', null, 120, true)` |
| Przejścia — średnica | `<select disabled style="...">` | `_excelOverlaySelectHtml([['', '—']], '', null, 110, true)` |
| Właz                 | `<select disabled style="...">` | `_excelOverlaySelectHtml([['', '—']], '', null, 125, true)` |
| Redukcja             | `<select disabled style="...">` | `_excelOverlaySelectHtml([['', '—']], '', null, 105, true)` |
| Kineta               | `<select disabled style="...">` | `_excelOverlaySelectHtml([['', '—']], '', null, 90, true)`  |

### 2.4 Dlaczego to powoduje przesunięcie

Helper `_excelOverlaySelectHtml()` generuje strukturę DIV + SELECT overlay:

```html
<div class="excel-sel-wrap" tabindex="0" style="...width:120px;">
    <select style="position:absolute;inset:0;width:100%;height:100%;opacity:0;...">
        <option value="" selected>—</option>
    </select>
    <div style="...">—</div>
</div>
```

Goły `<select disabled>` to tylko:

```html
<select
    disabled
    style="background:#13151f;border:1px solid rgba(255,255,255,0.08);border-radius:2px;..."
>
    <option>—</option>
</select>
```

Różnice:

| Właściwość        | Helper (`_excelOverlaySelectHtml`) | Goły `<select disabled>` |
| ----------------- | ---------------------------------- | ------------------------ |
| Struktura DOM     | DIV.sel-wrap > SELECT + DIV        | Sam SELECT               |
| Szerokość         | `width: Npx` na wrapperze          | `width: 100%` (od td)    |
| Padding           | `padding:0.2rem 0.3rem` na DIVie   | Brak (padding td)        |
| Border            | `border:1px` na wrapperze          | `border:1px` na select   |
| Wymiar zewnętrzny | padding + border + content         | Sam content + border     |

Te różnice powodują, że kolumny w pustym wierszu mają INNĄ całkowitą szerokość niż te same kolumny w wierszach danych. Funkcja `_excelApplyStickyColumns()` oblicza pozycje `left` na podstawie HEADERA, ale jeśli któraś kolumna ma węższy/ szerszy content w empty row, `table-layout: auto` może zmienić szerokość całej kolumny — co przesuwa sticky.

### 2.5 Dodatkowy problem: brak obsługi `disabled` w helperze

Helper `_excelOverlaySelectHtml()` przed naprawą nie przyjmował parametru `disabled`. Gdyby próbować go użyć dla pustego wiersza, wygenerowałby aktywny select (klikalny, z pełnym overlayem), co jest niepożądane — pusty wiersz ma być nieedytowalny.

---

## 3. Szczegółowy opis fixu

### 3.1 Rozszerzenie `_excelOverlaySelectHtml` o parametr `disabled`

**Plik:** `public/js/studnie/excelTableManager.js`
**Linia:** 1415

**Przed:**

```js
function _excelOverlaySelectHtml(opts, curVal, onChange, width) {
```

**Po:**

```js
function _excelOverlaySelectHtml(opts, curVal, onChange, width, disabled) {
```

Logika warunkowa wewnątrz:

| Element                                      | disabled = false (domyślnie)   | disabled = true                      |
| -------------------------------------------- | ------------------------------ | ------------------------------------ |
| Klasa wrappera                               | `excel-sel-wrap`               | `excel-sel-wrap disabled`            |
| Eventy wrappera (onfocus, onblur, onkeydown) | Dodane                         | Pominięte                            |
| Atrybut selecta                              | `tabindex="-1" onchange="..."` | `disabled`                           |
| Zachowanie                                   | W pełni interaktywny           | Nieaktywny wizualnie i funkcjonalnie |

**Kod:**

```js
function _excelOverlaySelectHtml(opts, curVal, onChange, width, disabled) {
    // ... istniejąca logika (label, optHtml) ...
    var extraClass = disabled ? ' disabled' : '';
    var wrapperEvents = disabled
        ? ''
        : ' onfocus="excelCellFocus(this);_excelSelWrapFocus(this)" onblur="excelCellBlur(this)" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){...}"';
    var selectEvents = disabled
        ? ' disabled'
        : ' tabindex="-1" onchange="' + (onChange || '').replace(/"/g, '&quot;') + ';..."';
    return (
        '<div class="excel-sel-wrap' +
        extraClass +
        '" ...>' +
        '<select style="..."' +
        selectEvents +
        '>' +
        optHtml +
        '</select>' +
        '<div style="...">' +
        (label || '&mdash;') +
        '</div>' +
        '</div>'
    );
}
```

### 3.2 Dodanie reguły CSS dla `.excel-sel-wrap.disabled`

**Plik:** `public/js/studnie/excelTableManager.js`
**Linia:** 1631

Reguła dodana do arkusza stylów inline w modalnym oknie (w struningu template w `openExcelTableModal()`):

```css
#excel-table-container .excel-sel-wrap.disabled {
    opacity: 0.35;
    pointer-events: none;
}
```

- `opacity: .35` — wizualne wskazanie, że element jest nieaktywny (zgodne z wyglądem innych disabled elementów w empty row)
- `pointer-events: none` — zapobiega jakiejkolwiek interakcji (klik, focus), co symuluje zachowanie `disabled` na poziomie wrappera

### 3.3 Wymiana 5 gołych `<select disabled>` na helper

#### 3.3.1 Przejścia — rodzaj (dla każdego i = 0..maxTr-1)

**Plik:** `public/js/studnie/excelTableManager.js`
**Linia:** 2701

**Przed:**

```js
html += `<td style="${tdEmpty}text-align:left;">${_excelOverlaySelectHtml([['', '—']], '', null, 120, true)}</td>`;
```

> Uwaga: to była już poprzednia wersja PO fixie. PRZED fixem:
>
> ```js
> html +=
>     '<td style="' +
>     tdEmpty +
>     'text-align:left;"><select disabled style="background:#13151f;border:1px solid rgba(255,255,255,0.08);border-radius:2px;color:#334155;font-size:0.65rem;font-family:Consolas,Menlo,monospace;padding:0.2rem 0.3rem;width:100%;"><option>&mdash;</option></select></td>';
> ```

#### 3.3.2 Przejścia — średnica (dla każdego i = 0..maxTr-1)

**Plik:** `public/js/studnie/excelTableManager.js`
**Linia:** 2702

Analogiczna zmiana jak 3.3.1, z `width: 110`.

#### 3.3.3 Właz

**Plik:** `public/js/studnie/excelTableManager.js`
**Linia:** 2707

**Przed:**

```html
<select disabled style="...">
    <option>&mdash;</option>
</select>
```

**Po:**

```js
_excelOverlaySelectHtml([['', '—']], '', null, 125, true);
```

#### 3.3.4 Redukcja (tylko gdy `hasReduction === true`)

**Plik:** `public/js/studnie/excelTableManager.js`
**Linia:** 2721

**Przed:**

```html
<select disabled style="...">
    <option>&mdash;</option>
</select>
```

**Po:**

```js
_excelOverlaySelectHtml([['', '—']], '', null, 105, true);
```

#### 3.3.5 Kineta

**Plik:** `public/js/studnie/excelTableManager.js`
**Linia:** 2725

**Przed:**

```html
<select disabled style="...">
    <option>&mdash;</option>
</select>
```

**Po:**

```js
_excelOverlaySelectHtml([['', '—']], '', null, 90, true);
```

### 3.4 Obrazowe porównanie przed/po

```
PRZED (goły select):
┌──────────────────────┐
│ <td style="...">     │
│   <select disabled>  │  ← brak wrappera, inne wymiary
│     <option>—</option│
│   </select>          │
│ </td>                │
└──────────────────────┘

PO (helper z disabled):
┌──────────────────────┐
│ <td style="...">     │
│   <div class="       │
│    excel-sel-wrap    │
│    disabled">        │  ← ten sam wrapper co w data rows
│     <select disabled>│
│     <div>—</div>    │
│   </div>             │
│ </td>                │
└──────────────────────┘
```

---

## 4. Weryfikacja

### 4.1 Weryfikacja składowa

| Komenda                                          | Wynik                                                        |
| ------------------------------------------------ | ------------------------------------------------------------ |
| `node -c public/js/studnie/excelTableManager.js` | ✅ Brak błędów składni                                       |
| `npm run format`                                 | ✅ Prettier — bez zmian                                      |
| `npm run typecheck`                              | ✅ TypeScript — bez błędów                                   |
| `npm run lint`                                   | ✅ ESLint — bez błędów                                       |
| `npm run test:quick`                             | ✅ 1255/1256 (1 pre‑existing failure w sqlInjection.test.ts) |

### 4.2 Weryfikacja regresji wizualnej (Playwright E2E)

Przeprowadzono test w headless Chromium (Playwright):

1. **Logowanie:** POST `/api/auth/login` → token JWT
2. **Nawigacja:** `app.html#/studnie` → SPA ładuje iframe z `studnie.html`
3. **Inicjalizacja:** Oczekiwanie na `studnieProducts` (676 produktów)
4. **Wstrzyknięcie danych:** 3 mock wells (2× DN1000, 1× DN1500)
5. **Otwarcie modal:** `openExcelTableModal()`
6. **Przełączenie zakładek:** `excelSwitchTab('1000')` i `excelSwitchTab('1500')`
7. **Pomiar:** `getBoundingClientRect()` dla każdej komórki data row vs empty row

**Wynik pomiarów:**

| Zakładka | Wiersze                        | Kolumny | Różnica (diffL)  | Status |
| -------- | ------------------------------ | ------- | ---------------- | ------ |
| DN1000   | 6 (3 thead + 2 data + 1 empty) | 51      | 0 dla wszystkich | ✅     |
| DN1500   | 5 (3 thead + 1 data + 1 empty) | 110     | 0 dla wszystkich | ✅     |

**Wniosek:** Pusty wiersz jest idealnie wyrównany z wierszami danych we wszystkich kolumnach.

---

## 5. Pliki zmienione

| Plik                                     | Zakres zmian      | Opis                                                                                                                         |
| ---------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `public/js/studnie/excelTableManager.js` | 1 plik, 3 miejsca | Funkcja `_excelOverlaySelectHtml` (linia 1415), CSS (linia 1631), 5 wywołań w empty row (linie 2701, 2702, 2707, 2721, 2725) |

---

## 6. Audyt — znane błędy

Zaktualizowano wpis w `AGENTS.md` (punkt 5 tabeli znanych błędów). Dotychczasowy wpis #5 dotyczył "Duplikacja stylów przycisku PEHD". Nie znaleziono bezpośredniego związku z obecną poprawką, ale warto odnotować, że podobny wzorzec (inline style z JS vs CSS class) wystąpił również w przypadku selectów w pustym wierszu — preferować helper z klasą CSS zamiast inline `<select disabled>`.

---

_Koniec planu naprawy._
_Data: 2026-07-10_
_Autor: OpenCode AI (DeepSeek V4 Flash)_
