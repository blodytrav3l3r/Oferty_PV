# Implementation Plan: Excel — nagłówki krag_ot (bug "750 z otworem") + escapeHtml + dane KDB-25-75-OT

> Data: 2026-08-02 | Obszar: public/js/studnie/ (tabela Excel) | Testy: ests/studnie/

## Przegląd

Domykanie poprawki błędu "750 z otworem" w nagłówkach H2 tabeli Excel dla krag_ot.
Regex w _excelShortLabel (excelHelpers.js:100) i _excelWrapDetail (excelHelpers.js:178)
jest już w kodzie — brakuje: (a) testu regresyjnego, (b) escapeHtml na etykietach H1/H2
(wymóg XSS, nazwy produktów pochodzą z importu XLSX), (c) weryfikacji danych KDB-25-75-OT.

## Kontekst — co już działa

- excelHelpers.js:100: detail = detail.replace(/\s*z otwor(?:em|ami)\s*$/i, '') — usuwa suffix z detail.
- excelHelpers.js:178: _excelWrapDetail łamie przed ez stopni|drabinka nierdzewna|z otwor(?:em|ami).
- Dynamiczne produkty (wellConfigRules.js:260 i 384) budują nazwę: aseSub.name + ' z otworem'
  (guard endsWith(' z otworem')), więc wzorzec nazwy pokrywa się z regexem (flaga /i obejmuje
  małą/dużą literę).

## Kolejność i zależności

| Krok                           | Blokuje | Zależności                                |
| ------------------------------ | ------- | ----------------------------------------- |
| 1. Test regresyjny             | —       | brak (testuje obecny, już naprawiony kod) |
| 2. escapeHtml nagłówków        | —       | brak (osobny plik)                        |
| 3. Korekta danych KDB-25-75-OT | —       | brak (dane, nie kod)                      |

Brak twardych zależności między krokami. Logiczna kolejność: **1 → 2 → 3** (test najtańszy
i domyka poprawkę, escape zabezpiecza render, dane czynią zachowanie poprawnym).
Każdy krok = osobny commit ( est(...), ix(...), ix(...)).

---

## Krok 1 — Test regresyjny

### Plik

    ests/studnie/excelHelpers.test.ts (nowy; testMatch **/*.test.ts z jest.config.ts:7).

### Wzorzec ładowania (wg ests/studnie/excelDrilledRings.test.ts)

- // @ts-nocheck na początku pliku.
- m.runInContext całego public/js/studnie/excelHelpers.js — plik zawiera WYŁĄCZNIE deklaracje
  funkcji (brak IIFE/DOM na top-level), więc kontekst minimalny wystarczy:
  `js
const context = {
  window: {},
  document: {},
  logger: { info(){}, warn(){}, error(){} },
  studnieProducts: [],
  console
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../../public/js/studnie/excelHelpers.js'), 'utf8'), context);
`
- Destrukturyzacja: const { _excelShortLabel, _excelWrapDetail } = context; — do testów
  potrzebne tylko te dwie czyste funkcje (globale typu wells,
  esolveEffectiveProduct
  używane są tylko wewnątrz ciał funkcji, nie na top-level — nie rzucają przy załadowaniu).
- eforeAll/(global as any).logger — jak w excelDrilledRings (linie 35-36), na wszelki wypadek.

### Przypadki testowe

**describe('\_excelShortLabel — krag_ot')**

| #   | Nazwa (input)                         | Oczekiwane {short, detail} | Uzasadnienie                                                                                |
| --- | ------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | 'Krąg DN2500/750 z otworem'           | { 'Kr. OT', '750' }        | Sedno regresji — KDB-25-75-OT, forma pojedyncza                                             |
| 2   | 'Krąg DN2500/500 z otworami'          | { 'Kr. OT', '500' }        | Forma mnoga — KDB-25-05-OT                                                                  |
| 3   | 'Krąg żelbetowy DN2500/750 z otworem' | { 'Kr.OT żelb', '750' }    | Odmiana żelbetowa                                                                           |
| 4   | 'Krąg DN2500/750'                     | { 'Kr. OT', '750' }        | Bez sufiksu — brak fałszywych cięć                                                          |
| 5   | 'Krąg DN1000/500 z otworem'           | { 'Kr. OT', '500' }        | **Wzorzec produktu dynamicznego** z wellConfigRules.js:260/384 (aseSub.name + ' z otworem') |
| 6   | 'krąg dn2500/750 z OTWOREM'           | { 'Kr. OT', '750' }        | Flaga /i — wielkość liter                                                                   |
| 7   | 'Krąg DN2500/750' (typ 'krag')        | { 'Krąg', '750' }          | (sanity) regex OT nie ingeruje w krag                                                       |

**describe('\_excelWrapDetail')**

| #   | Input                                                                            | Oczekiwane                                                                      |
| --- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 8   | '750 z otworem'                                                                  | '750<br>z otworem'                                                              |
| 9   | '750 z otworami'                                                                 | '750<br>z otworami'                                                             |
| 10  | '750 bez stopni'                                                                 | '750<br>bez stopni'                                                             |
| 11  | '750 drabinka nierdzewna'                                                        | '750<br>drabinka nierdzewna'                                                    |
| 12  | '750'                                                                            | '750' (bez łamania)                                                             |
| 13  | '' / undefined / '·'                                                             | '·' (wszystkie trzy)                                                            |
| 14  | _excelWrapDetail(_excelShortLabel('Krąg DN2500/750 z otworem','krag_ot').detail) | '750' — **test potoku H2**: suffix usunięty w shortLabel ⇒ wrap nie dodaje <br> |

---

## Krok 2 — escapeHtml w nagłówkach H1/H2

### Plik

public/js/studnie/excelTableRenderer.js, pętla compCols.forEach (linie 126-244).

### Które stringi i w jakiej kolejności

1. **Linia 152**: const colLabel = c.shortLabel || c.label;
   → zmienić na: const colLabel = escapeHtml(c.shortLabel || c.label || '');
   label zawiera p.name (osadnik/styczna/uszczelka/plyta_redukcyjna/avr — excelColumns.js:298, 316, 397, 189, 81) —
   to dane z DB/importu XLSX, potencjalnie niebezpieczne. shortLabel jest wewnętrzny, ale escape całości jest bezpieczny.
2. **Linia 153**: const colDetail = _excelWrapDetail(c.detailLabel) || '·';
   → zmienić na: const colDetail = _excelWrapDetail(escapeHtml(c.detailLabel || '')) || '·';
   **KOLEJNOŚĆ MA ZNACZENIE**: escape PRZED wrap — _excelWrapDetail celowo wstawia literalny <br> (linia 178),
   który musi przetrwać. Escapowanie wyniku wrap zamieniłoby <br> w &lt;br&gt;.
   escapeHtml('') = '' ⇒ nadal trafia w gałąź '·' (linia 176) — fallback zachowany.
3. **Linie 241-242** (interpolacja ${colLabel} / ${colDetail} w <th>) — bez zmian kodu:
   wartości są już zescapowane w punkcie 1-2, a colDetail zawiera tylko bezpieczny tekst + <br> z wrap.
4. **Linia 243 (H3)** — **NIE ruszać**: colDnLabel = 'DN'+liczba/'uniw.'/'Styczne' (wewnętrzne),
   colCode już escapowany (escapeHtml(codeDisp) na linii 220), priceHtml = mtInt(cena)+' PLN'
   (format liczbowy pl-PL, brak HTML), data-* atrybuty to liczby/wewnętrzne ct, allbackAttr już
   escapowany (linia 183).

### Dostępność escapeHtml w module

- Definicja + rejestracja globalna: public/js/shared/ui.js:7-12 (window.escapeHtml).
- Kolejność skryptów w public/studnie.html: shared/ui.js (linia 284) **przed**
  excelHelpers.js (388) i excelTableRenderer.js (400) ⇒ dostępne w runtime.
- Deklaracja dla ypecheck:frontend: public/js/types.d.ts:128 (declare function escapeHtml(str: string): string).
- W pliku już używany (linie 183, 220) — brak nowych importów.

---

## Krok 3 — Dane KDB-25-75-OT

### Werdykt: TO JEST BŁĄD DANYCH

Dowody (data/seed_studnie.json):

- KDB-25-75-D (bazowy, linia 9956): name Krąg DN2500/750, dn: "2500", **height: 750**, weight 2250, area 4.71.
- KDB-25-75-OT (linia 10030): name Krąg DN2500/750 z otworem, dn: "2500", **height: 500**, weight 1500, area 3.95.
- KDB-25-05-OT (linia 9734): name Krąg DN2500/500 z otworami, dn: "2500", **height: 500** — czyli wariant 500 mm OT **już istnieje**.

Wniosek: KDB-25-75-OT został skopiowany z wariantu 500 mm (height/weight/area), zmieniono tylko nazwę.
Nazwa jest autorytatywna ("DN2500/750") ⇒ **height powinno być 750**. weight 1500 / area 3.95 to wartości
kręgu 500 mm — do potwierdzenia z właścicielem domeny (minimalna, funkcjonalna zmiana = samo height).

### Czy kod kompensuje? NIE.

- Grupowanie kolumn krag_ot wg p.height (excelColumns.js:226-248) ⇒ przy height=500 produkt
  trafia do kolumny krag_ot_500 (razem z KDB-25-05-OT), a H2 pokazuje detail z nazwy („750") —
  kolumna o wysokości 500 z etykietą 750.
- _excelGetWellProdCode (excelHelpers.js:262-330) dopasowuje produkty po height — w konfiguracji
  kręgu 750 z otworem solver/enforceOtRings nie znajdzie krag_ot o wysokości 750 (jest tylko 500),
  więc otwór może trafić w zły krąg lub zostać pominięty.

### Co zmienić

1. data/seed_studnie.json:10035 — "height": 500 → 750.
2. data/price_defaults.json:10886 — "height": 500 → 750 (snapshot defaultów;
   estoreDefaultsFromJson
   zapisuje go tylko do tabel *_Default — app.ts:269-278, priceOverrideService.ts:534-599 — ale spójność plików jest wymagana).
3. **Istniejące instalacje — brak automatycznej migracji**: prisma/seed.ts używa createMany
   (bez upsert) i odmawia startu przy istniejących danych (seed.ts:29-38);
   estoreDefaultsFromJson
   nie dotyka żywej tabeli productsStudnie. Wymagana aktualizacja rekordu w żywej bazie:
   UPDATE productsStudnie SET height = 750 WHERE id = 'KDB-25-75-OT';
   (SQLite; jednorazowo na każdej instalacji z danymi, alternatywnie edycja przez admina w UI — PATCH /api/products-studnie/:id).
4. Opcjonalnie po zmianie w DB:
   pm run prisma:seed -- --force tylko na świeżej bazie (destrukcyjne — NIE dla istniejącej).

> Uwaga: scripts/export-settings-to-seed.mjs regeneruje seed_*.json z żywej DB — po zmianie w DB
> można nim odświeżyć pliki zamiast ręcznej edycji (mniejszy risk rozjazdu).

---

## Weryfikacja końcowa (kolejność)

1.

ode -c public/js/studnie/excelHelpers.js (niezmieniany, sanity) 2.
ode -c public/js/studnie/excelTableRenderer.js (po kroku 2) 3.
px jest tests/studnie/excelHelpers.test.ts (krok 1 — 14 przypadków) 4.
pm run lint:frontend 5.
pm run typecheck:frontend 6.
pm run format 7. **Przed commitem**:
pm run validate (wymóg CONTRIBUTING.md — typecheck + lint + testy dymne).
Pełny
pm test (z pokryciem) — opcjonalnie, kroki są małe.

Commit: est(studnie): testy regresyjne _excelShortLabel/_excelWrapDetail dla krag_ot → ix(studnie): escapeHtml w nagłówkach H1/H2 tabeli Excel → ix(data): poprawa height KDB-25-75-OT (500→750).

---

## Ryzyka i wpływ

| Ryzyko                                                                                                            | Wpływ / mitygacja                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| escapeHtml zmieni wyświetlanie nazw z &, <, > w H1/H2                                                             | ZAMIERZONE — to jest fix XSS; normalne nazwy przechodzą bez zmian (identity dla tekstu bez znaków specjalnych). <br> z _excelWrapDetail zachowany dzięki kolejności escape→wrap.                                                                                                                    |
| Zmiana height 500→750 zmienia grupowanie kolumn i rozwiązywanie produktów                                         | ZAMIERZONE — OT 750 pojawi się w kolumnie krag_ot_750, konfiguracje kręgów 750 z otworem zaczną poprawnie znajdować produkt. Istniejące oferty trzymają productId (nie height), więc nie ma uszkodzenia danych; walidacja wysokości studni może zgłosić kręgi, które dotąd były błędnie dopasowane. |
| Re-seed na istniejącej bazie                                                                                      | Zabroniony — seed.ts używa createMany; istniejące instalacje wymagają jednorazowego UPDATE lub edycji w UI.                                                                                                                                                                                         |
| KDB-25-05-OT i KDB-25-75-OT przez chwilę w jednej kolumnie 500                                                    | Znika po fixie danych (krok 3). Przed fixem H2 pokazuje detail z nazwy pierwszego produktu grupy (sort stabilny → KDB-25-05-OT pierwszy ⇒ "500") — to właśnie maskowało/komplikowało pierwotny bug.                                                                                                 |
| weight/area KDB-25-75-OT (1500/3.95) pozostają jak dla 500 mm                                                     | Świadoma decyzja minimalna — do potwierdzenia z właścicielem domeny; zmiana wpływa na wycenę/transport, wykracza poza scope buga.                                                                                                                                                                   |
| Inne powierzchnie XSS z nazw produktów (poza scope): overlay select w excelHelpers.js:543 (opts[i][1] bez escape) | Zgłoszone jako follow-up; nie zmieniane w tym planie (osobny zakres).                                                                                                                                                                                                                               |
