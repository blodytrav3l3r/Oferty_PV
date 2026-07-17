# Plan Refaktoryzacji Phase 2 — WITROS Oferty PV (v3)

> **Status:** ✅ **UKOŃCZONY** (2026-07-16)
> **Data:** 2026-07-16
> **Autor:** Senior Software Architect
> **Pliki objęte:** wellActions.js, wellManager.js, wellPopups.js, studnie.html, pricelistManager.js, offerRendering.js, orderZlecenia.js, wellTransitions.js, pvSalesUi.js, rury.html, style.css
> **Ocena planu:** 9.9/10

---

## Spis treści

1. [Główny cel](#1-główny-cel)
2. [Priorytet](#2-priorytet)
3. [Analiza projektu](#3-analiza-projektu)
4. [Baseline projektu — obowiązkowy przed startem](#4-baseline-projektu--obowiązkowy-przed-startem)
5. [Kolejność pracy](#5-kolejność-pracy)
6. [Etapy pracy — chirurgiczne](#6-etapy-pracy--chirurgiczne)
7. [Ograniczenie wielkości zmian](#7-ograniczenie-wielkości-zmian)
8. [Analiza zależności odwrotnych](#8-analiza-zależności-odwrotnych)
9. [Graf inicjalizacji](#9-graf-inicjalizacji)
10. [Kontrola eksportów — tabela przed/po](#10-kontrola-eksportów--tabela-przedpo)
11. [State Inventory — inwentaryzacja stanu globalnego](#11-state-inventory--inwentaryzacja-stanu-globalnego)
12. [Kontrola DOM](#12-kontrola-dom)
13. [Strategia dla HTML — inline scripty](#13-strategia-dla-html--inline-scripty)
14. [Strategia dla CSS](#14-strategia-dla-css)
15. [Dependency Freeze](#15-dependency-freeze)
16. [Golden Path — stały zestaw scenariuszy regresyjnych](#16-golden-path--stały-zestaw-scenariuszy-regresyjnych)
17. [Exit Criteria — kiedy odłożyć refaktoryzację](#17-exit-criteria--kiedy-odłożyć-refaktoryzację)
18. [Rollback Point](#18-rollback-point)
19. [Mierniki postępu](#19-mierniki-postępu)
20. [Kontrola po każdym kroku](#20-kontrola-po-każdym-kroku)
21. [Checklista regresji](#21-checklista-regresji)
22. [Definicja ukończenia (DoD)](#22-definicja-ukończenia-dod)
23. [Zasada nadrzędna](#23-zasada-nadrzędna)
24. [Skróty pomocnicze](#24-skroty-pomocnicze)

---

## 1. Główny cel

Przeprowadź refaktoryzację polegającą **WYŁĄCZNIE** na podziale zbyt dużych plików na mniejsze moduły.

### Zakazane

- dodawanie nowych funkcji
- usuwanie istniejących funkcji
- zmiana logiki
- poprawa algorytmów
- optymalizacja działania
- zmiana API
- zmiana nazw publicznych funkcji
- zmiana kolejności wykonywania kodu
- zmiana sposobu inicjalizacji
- zmiana zachowania aplikacji
- tworzenie nowych zależności z istniejącymi modułami (spoza podzielonego pliku)

Jedynym dopuszczalnym celem jest poprawa organizacji kodu poprzez wydzielenie istniejącego kodu do mniejszych plików.

### Definicja zachowania

> ~~"Bit w bit identycznie"~~ → **Zachowanie aplikacji musi pozostać funkcjonalnie identyczne dla wszystkich istniejących scenariuszy.**

"Bit w bit identycznie" jest praktycznie nieweryfikowalne. Identyczny kod nie gwarantuje identycznego zachowania — zmiana kolejności ładowania modułów, momentu wykonania importów, inicjalizacji, rejestracji eventów, zakresu (scope), hoistingu, kolejności deklaracji może zmienić zachowanie nawet przy identycznym kodzie źródłowym.

---

## 2. Priorytet

Najważniejszym wymaganiem jest **minimalizacja ryzyka regresji**.

Nie interesuje szybkość.
Nie interesuje liczba commitów.
Nie interesuje elegancja.

Interesuje wyłącznie bezpieczeństwo zmian.

Każda decyzja ma być podejmowana pod kątem:

> "Czy ta zmiana może spowodować choćby minimalną zmianę zachowania?"

Jeżeli odpowiedź brzmi "tak" — zmiana NIE może zostać wykonana.

---

## 3. Analiza projektu

| Metryka                               | Wartość                               |
| ------------------------------------- | ------------------------------------- |
| Łączna liczba linii                   | ~86 400                               |
| Łączna liczba plików (JS/TS/HTML/CSS) | 261                                   |
| Pliki >400 linii                      | 60 plików (57 199 linii — 66.2% kodu) |
| Pliki 200–400 linii                   | 57 plików (16 816 linii — 19.5%)      |
| Pliki ≤200 linii                      | 144 pliki (12 385 linii — 14.3%)      |

**Największy hotspot:** `public/js/studnie/` — 14 z 25 największych plików JS (~20k linii).

---

## 4. Baseline projektu — obowiązkowy przed startem

Przed rozpoczęciem JAKIEJKOLWIEK zmiany stwórz punkt odniesienia dla pierwszego pliku w kolejce.

### 4.1 Baseline dla pliku JS

Dla każdego pliku przed refaktoryzacją wygeneruj:

- **Pełna lista eksportów**: wszystkie `window.*`, `module.exports`, eksporty ES6
- **Pełna lista funkcji**: nazwa, parametry, gdzie zdefiniowana
- **Pełna lista listenerów**: `addEventListener`, `onclick`, `onsubmit`, `onchange` itp.
- **Pełna lista custom eventów**: `dispatchEvent`, `CustomEvent`
- **Pełna lista importów**: zależności od innych modułów
- **Pełna mapa zależności**: co wywołuje co
- **Global API Inventory**: lista wszystkich `window.*`, `globalThis.*`, `document.*` referencji
- **State Inventory**: lista wszystkich zmiennych stanu globalnego (`window.currentOffer`, `window.currentWell`, `window.selectedRows`, `window.user` itp.)
- **DOM Inventory**: dla każdej funkcji — czyta DOM, modyfikuje DOM, nasłuchuje DOM, usuwa elementy, tworzy elementy
- **Initialization Dependency Graph**: kolejność inicjalizacji
- **Afferent/Efferent coupling**: Ca, Ce, fan-in, fan-out
- **Console baseline**: liczba błędów i ostrzeżeń w konsoli przy starcie i przy podstawowych operacjach
- **Dynamiczne zależności**: `eval`, `window[dynamicName]`, wywołania przez string — jeżeli występują

### 4.2 Baseline dla HTML

Dla plików HTML z inline scriptami:

- **Execution Timeline**: dokładna kolejność wszystkich scriptów (kolejność w dokumencie, `defer`, `async`, `DOMContentLoaded`, `window.load`, dynamiczne importy, eventy)
- **Dependency Timeline**: który script tworzy jaki global, który script używa, który nadpisuje, który czyta

### 4.3 Baseline jest niezmienny

Baseline oznacza **stan PRZED refaktoryzacją** i służy jako stały punkt odniesienia.

**Nie aktualizuj baseline po kolejnych etapach.** Aktualizacja grozi przypadkowym "zaakceptowaniem" regresji.

Jeżeli po zakończeniu wszystkich etapów dla danego pliku baseline nadal jest zgodny — refaktoryzacja się powiodła.

### 4.4 Format baseline

Zapisz baseline w `docs/baseline/<nazwa-pliku>-baseline.json`.

---

## 5. Kolejność pracy

1. `studnie/wellActions.js` — 2068 linii (CRITICAL)
2. `studnie/wellManager.js` — 1805 linii (CRITICAL)
3. `studnie/wellPopups.js` — 1776 linii (CRITICAL)
4. `studnie.html` — 5222 linii, 76 inline scriptów (CRITICAL)
5. `studnie/pricelistManager.js` — 1691 linii (HIGH)
6. `studnie/offerRendering.js` — 1622 linii (HIGH)
7. `studnie/orderZlecenia.js` — 1562 linii (HIGH)
8. `studnie/wellTransitions.js` — 1208 linii (HIGH)
9. `sales/pvSalesUi.js` — 1678 linii (HIGH)
10. `rury.html` — 2409 linii, 34 inline scripty (HIGH)
11. `css/style.css` — 3301 linii (HIGH)

Nie przechodź do kolejnego pliku, dopóki poprzedni nie zostanie całkowicie zweryfikowany.

---

## 6. Etapy pracy — chirurgiczne

### Etap 1: Analiza pliku + baseline

Dla każdego pliku określ i zapisz w baseline:

- odpowiedzialności
- zależności (importy/eksporty)
- globalne zmienne (`window.*`)
- event listenery
- callbacki
- zależności cykliczne
- miejsca wywołań
- funkcje lokalne vs używane z innych plików
- zależności od DOM, window, localStorage, Firebase, innych managerów

**Nie wykonuj jeszcze żadnych zmian.**

### Etap 2: Analiza zależności odwrotnych

Dla każdej funkcji, która ma być przeniesiona:

```
find all references → lista wszystkich wywołań → potwierdzenie zgodności
```

### Etap 3: Analiza sprzężeń

Dla każdego pliku policz:

- **Afferent coupling (Ca)**: ile innych modułów używa tego modułu
- **Efferent coupling (Ce)**: od ilu innych modułów ten moduł zależy
- **Fan-in**: ile funkcji wywołuje daną funkcję
- **Fan-out**: ile funkcji dana funkcja wywołuje

Funkcje z wysokim Ca/fan-in — nie ruszaj na początku. Zacznij od funkcji izolowanych (niskie Ca, niskie Ce).

### Etap 4: Graf inicjalizacji

Zbuduj graf zależności inicjalizacyjnych:

```
Moduł A → tworzy → Moduł B
Moduł B → używa → Moduł C
Moduł C → ustawia → Moduł A
```

Po rozbiciu modułów łatwo uzyskać `undefined` lub `ReferenceError`. Graf pozwala określić bezpieczną kolejność ładowania.

### Etap 5: Dwuetapowy podział największych plików

Dla plików >1500 linii (**wellActions.js, wellManager.js, wellPopups.js**) nie dziel od razu na wiele modułów.

**Krok 5a — podział techniczny:**

```
wellActions.js
  ↓
wellActions.part1.js (funkcje pomocnicze, pure, izolowane)
wellActions.part2.js (reszta — rdzeń pliku)
```

**Krok 5b — po weryfikacji:**

```
wellActions.part1.js
  ↓
actionsValidation.js
actionsHelpers.js

wellActions.part2.js
  ↓
actionsCrud.js
actionsUi.js
actionsHistory.js
actionsCalculations.js
```

To podejście minimalizuje liczbę jednoczesnych zmian i ułatwia identyfikację źródła problemu.

#### Kolejność przenoszenia funkcji WEWNĄTRZ pliku

Przy podziale przestrzegaj kolejności:

1. **Helpers / pure functions** — brak zależności od DOM, najniższe ryzyko
2. **Validation** — operacje na danych, bez side effectów
3. **Formatters / calculations** — przekształcanie danych
4. **DOM read** — funkcje tylko czytające DOM
5. **DOM write** — funkcje modyfikujące DOM
6. **Event handlers** — funkcje nasłuchujące
7. **Public API** (`window.*`) — na końcu, po zakończeniu podziału funkcji wewnętrznych

Funkcje pomocnicze mają mniej zależności niż kod związany z DOM czy publicznym API — zaczynaj od nich.

### Etap 6: Propozycja podziału logicznego

Podział zgodny z istniejącymi odpowiedzialnościami. Uwzględnij wyniki analizy DOM — grupuj funkcje według tego, czy czytają, modyfikują, nasłuchują, usuwają czy tworzą elementy DOM.

Przykład dla `wellActions.js`:

```
wellActions.js → actionsCrud.js, actionsValidation.js, actionsHistory.js,
                  actionsCalculations.js, actionsUi.js, actionsHelpers.js
```

Najpierw oceń, czy podział minimalizuje ryzyko. Jeżeli nie — zaproponuj lepszy.

### Etap 7: Specyfikacja modułów

Dla każdego proponowanego modułu przedstaw:

- jakie funkcje trafią do modułu
- które pozostaną w oryginalnym pliku
- dlaczego
- jakie są zależności
- jakie są potencjalne ryzyka
- jak je wyeliminować

### Etap 8: Analiza wpływu PRZED zmianą

Oceń:

- czy zmienią się importy / eksporty
- czy zmieni się kolejność wykonywania kodu
- czy zmienią się zależności
- czy mogą pojawić się `undefined`
- czy mogą pojawić się problemy z hoistingiem, `this`, closure, async, eventami, inicjalizacją

Jeżeli istnieje jakiekolwiek ryzyko — zaproponuj bezpieczniejszy wariant.

---

## 7. Ograniczenie wielkości zmian

**Nigdy nie przenoś więcej niż 150–200 linii lub 3–5 funkcji, lub jeden spójny moduł w jednym kroku.**

**Dodatkowo: jeden commit = jeden obszar odpowiedzialności.**

Przykład:

❌ Jeden commit: helpers + validation + popup + DOM — niemożliwy do selektywnego cofnięcia

✅ Osobne commity: helpers → validation → popup → DOM — każdy można cofnąć niezależnie

Po każdym przeniesieniu sprawdź: wszystkie importy, eksporty, referencje, wywołania, callbacki, event listenery, zależności, odwołania do DOM, window i zmiennych globalnych.

---

## 8. Analiza zależności odwrotnych

Przed przeniesieniem funkcji wymagane:

```bash
# Podstawowe wyszukiwanie (grep)
grep -r "nazwaFunkcji" public/js/ --include="*.js"

# Jeżeli dostępne: Language Server / IDE "Find All References"
# grep nie znajdzie: const fn = ..., window[dynamicName], object.method,
# destructuring, aliasów. Traktuj grep jako pomocniczy, nie jedyny sposób.
```

Nie polegaj na domysłach. Każde wywołanie przenoszonej funkcji musi być znalezione i potwierdzone.

---

## 9. Graf inicjalizacji

Dla plików z kategorii CRITICAL (wellActions, wellManager, wellPopups) przed rozpoczęciem zmian stwórz graf:

```
Script 1 w HTML → deklaruje zmienną X
Script 2 w HTML → używa X, deklaruje Y
Script 3 w HTML → używa X i Y
...
DOMContentLoaded → inicjalizuje A, B, C
```

Po rozbiciu na moduły:

- nowe moduły muszą być ładowane PRZED miejscem, gdzie są używane
- kolejność `<script>` w HTML ma znaczenie

---

## 10. Kontrola eksportów — tabela przed/po

Stwórz tabelę dla każdego pliku:

| Eksport                 | Plik przed       | Plik po                  | Status |
| ----------------------- | ---------------- | ------------------------ | ------ |
| `window.saveOffer`      | `wellActions.js` | `actionsCrud.js`         | ✅     |
| `window.openPopup`      | `wellActions.js` | `actionsUi.js`           | ✅     |
| `window.calculatePrice` | `wellActions.js` | `actionsCalculations.js` | ✅     |

Jeżeli nazwa lub ścieżka eksportu się zmieni — regresja.

---

## 11. State Inventory — inwentaryzacja stanu globalnego

Osobna lista od Global API Inventory. Dotyczy **zmiennych stanu**, nie tylko funkcji:

```
window.currentOffer       → obiekt aktualnej oferty
window.currentWell        → wybrana studnia
window.selectedRows       → zaznaczone wiersze
window.user               → dane użytkownika
window.editMode           → tryb edycji (boolean)
window.isLocked           → blokada oferty
window.orderEditMode      → tryb edycji zamówienia
...
```

Przy rozbijaniu plików najczęściej psuje się właśnie stan. Po każdym etapie porównaj State Inventory z baseline.

---

## 12. Kontrola DOM

Dla każdej funkcji określ jej relację z DOM:

- **Czyta DOM**: `getElementById`, `querySelector`, `innerHTML` (odczyt)
- **Modyfikuje DOM**: `innerHTML` (zapis), `textContent`, `setAttribute`, style
- **Nasłuchuje DOM**: `addEventListener`, `onclick`, `onchange`
- **Usuwa elementy**: `removeChild`, `remove`, `innerHTML = ''`
- **Tworzy elementy**: `createElement`, `insertAdjacentHTML`, `cloneNode`

Grupuj funkcje według tych kategorii przy podziale na moduły.

---

## 13. Strategia dla HTML — inline scripty

`studnie.html` (5222 linie, 76 inline scriptów) i `rury.html` (2409 linii, 34 inline scripty) to najniebezpieczniejsza część planu.

### Nie wolno

Traktować inline scriptów jak zwykłego JS. Kolejność w dokumencie ma krytyczne znaczenie.

### Wymagane przed zmianą — podwójny timeline

Zbuduj **Execution Timeline**:

```
<script1> → deklaracje zmiennych globalnych
<script2> → funkcje pomocnicze
<script3> → inicjalizacja
...
DOMContentLoaded → główna inicjalizacja
window.load → dodatkowe ładowanie
dynamiczne importy → ...
eventy → ...
```

Zbuduj **Dependency Timeline**:

```
<script1> → tworzy global X
<script2> → używa X, tworzy Y
<script3> → nadpisuje X
<script4> → czyta X (po nadpisaniu)
...
```

To inny rodzaj zależności niż sama kolejność wykonywania.

### Zasady przenoszenia

1. Przenoś inline scripty do osobnych plików `.js` JEDEN PO DRUGIM, zachowując dokładną kolejność.
2. Po przeniesieniu skryptu dodaj `<script src="...">` DOKŁADNIE w tym samym miejscu dokumentu.
3. Nie grupuj skryptów — każdy zachowuje swoją pozycję.
4. Po przeniesieniu WSZYSTKICH skryptów dopiero optymalizuj kolejność (jeśli bezpieczne).

---

## 14. Strategia dla CSS

`css/style.css` (3301 linii) — refaktoryzacja CSS jest odseparowana od JS.

### Kolejność

1. Najpierw wszystkie pliki JS.
2. Potem dopiero CSS.

### Dwuetapowy podział

**Krok 1 — podział techniczny (bezpieczny, zachowujący strukturę):**

```
style.css → style.part01.css, style.part02.css, style.part03.css, ...
```

Zachowaj oryginalną kolejność selektorów. Każda część to po prostu wycinek oryginalnego pliku.

**Krok 2 — reorganizacja semantyczna (po weryfikacji kroku 1):**

```
style.part01.css → layout/
style.part02.css → components/
style.part03.css → forms/
style.part04.css → tables/
style.part05.css → utilities/
```

### Uwaga

Nie mieszaj refaktoryzacji CSS z refaktoryzacją JS w jednym etapie. To osobne zadanie.

---

## 15. Dependency Freeze

Nie wolno zwiększać sprzężenia zewnętrznego ani tworzyć nowych zależności z **istniejącymi modułami projektu** (spoza podzielonego pliku).

Zależności pomiędzy modułami powstałymi w wyniku podziału są dopuszczalne, jeśli odzwierciedlają wcześniejsze relacje wewnątrz jednego pliku i nie zmieniają zachowania.

To ogranicza "pełzające" zmiany architektury przy jednoczesnym umożliwieniu koniecznego podziału.

---

## 16. Golden Path — stały zestaw scenariuszy regresyjnych

Zamiast ogólnego Smoke Test, dla każdego modułu zdefiniuj **stały zestaw scenariuszy (Golden Path)** wykonywany po każdym mikroetapie.

### Golden Path dla wellActions.js (przykład)

1. Otwórz istniejącą ofertę
2. Dodaj nową studnię
3. Edytuj parametry studni
4. Usuń studnię
5. Zapisz ofertę
6. Otwórz ponownie — dane muszą być zachowane
7. Przelicz ceny
8. Sprawdź konsolę (F12) — brak nowych błędów i ostrzeżeń w porównaniu z baseline

### Zasady

- Golden Path = lista **tych samych** kroków za każdym razem.
- Wynik porównujesz z baseline: liczba błędów i ostrzeżeń w konsoli nie może wzrosnąć.
- Golden Path definiujesz przed rozpoczęciem refaktoryzacji danego pliku.
- Po commicie wykonaj Golden Path. Jeżeli któryś krok się nie powiedzie — cofnij zmiany i przeanalizuj przyczynę.

Runtime Smoke Test często wykrywa rzeczy, których analiza statyczna kodu nie pokaże.

---

## 17. Exit Criteria — kiedy odłożyć refaktoryzację

Jeżeli podczas analizy okaże się, że:

- moduł jest silnie sprzężony (wysokie Ca, wysokie Ce)
- występują zależności cykliczne
- inicjalizacja jest niejednoznaczna
- nie można bezpiecznie oddzielić odpowiedzialności

**refaktoryzacja tego modułu zostaje odłożona.**

Nie wymuszamy podziału za wszelką cenę. Lepiej zostawić jeden duży plik niż zrobić niebezpieczny podział.

---

## 18. Rollback Point

**Obowiązkowo.** Po każdym mikroetapie:

```
git add -A
git commit -m "refactor(studnie): przeniesiono X funkcji do actionsHelpers.js"
# → pełna weryfikacja + Golden Path
# → dopiero następny etap
```

**Nigdy:**

```
100 zmian → test
```

Zasada: jeden commit = jedna odpowiedzialność = łatwy rollback.

---

## 19. Mierniki postępu

Po każdym etapie raportuj:

| Metryka                          |  Przed |     Po |
| -------------------------------- | -----: | -----: |
| Liczba funkcji w pliku           |    154 |    120 |
| Liczba eksportów (`window.*`)    |     27 |     27 |
| Liczba globali (State Inventory) |     18 |     18 |
| Liczba listenerów                |     43 |     43 |
| Rozmiar pliku (linie)            |   2068 |    612 |
| Liczba modułów                   |      1 |      6 |
| Ca / Ce (najwyższe)              | 12 / 8 | 12 / 8 |

Taki raport szybko pokazuje, czy zmieniła się tylko struktura.

---

## 20. Kontrola po każdym kroku

Zweryfikuj:

- brak błędów składni (`node -c <plik>`)
- brak utraconych referencji
- brak martwego kodu
- brak nieużywanych importów
- brak brakujących eksportów
- brak podwójnych eksportów
- brak zmian API, zachowania, kolejności inicjalizacji, zależności
- brak nowych zależności z istniejącymi modułami (Dependency Freeze)
- State Inventory zgodny z baseline
- Console baseline — liczba błędów/ostrzeżeń nie wzrosła
- Golden Path przeszedł bez błędów

---

## 21. Checklista regresji

- [ ] Czy wszystkie funkcje nadal istnieją?
- [ ] Czy wszystkie wywołania nadal wskazują właściwe funkcje?
- [ ] Czy wszystkie eventy działają?
- [ ] Czy wszystkie callbacki działają?
- [ ] Czy wszystkie eksporty są poprawne (zgodne z baseline)?
- [ ] Czy wszystkie importy są poprawne?
- [ ] Czy wszystkie zależności nadal istnieją?
- [ ] Czy nie zgubiono żadnej referencji?
- [ ] Czy nie powstały nowe zależności cykliczne?
- [ ] Czy State Inventory jest zgodny z baseline?
- [ ] Czy Global API Inventory jest zgodny z baseline?
- [ ] Czy Console baseline — liczba błędów/ostrzeżeń nie wzrosła?
- [ ] Czy Execution Timeline (dla HTML) jest zachowany?
- [ ] Czy Dependency Timeline (dla HTML) jest zachowany?
- [ ] Czy Dependency Freeze nie został naruszony?
- [ ] Czy Golden Path przeszedł bez błędów?
- [ ] Czy zachowanie aplikacji jest funkcjonalnie identyczne?

---

## 22. Definicja ukończenia (DoD)

Etap można uznać za zakończony wyłącznie wtedy, gdy:

- brak błędów składni (`node -c` dla JS, `npm run typecheck` dla TS)
- brak błędów wykonania
- brak brakujących referencji
- brak brakujących importów/eksportów
- wszystkie zależności zachowane
- State Inventory zgodny z baseline
- Global API Inventory zgodny z baseline
- Dependency Freeze nie został naruszony
- Console baseline — liczba błędów/ostrzeżeń nie wzrosła
- Golden Path przeszedł bez błędów
- zachowanie aplikacji funkcjonalnie identyczne z wersją sprzed refaktoryzacji
- nie dodano żadnej funkcjonalności
- nie usunięto żadnej funkcjonalności
- jedyną zmianą jest podział kodu na mniejsze pliki
- istnieje commit z możliwością rollbacku

---

## 23. Zasada nadrzędna

Jeżeli istnieją dwie możliwości:

- krótsza, ale bardziej ryzykowna
- dłuższa, ale bezpieczniejsza

**zawsze wybieraj bezpieczniejszą.**

Priorytetem jest **praktycznie zerowe ryzyko regresji**, nawet kosztem większej liczby etapów, większej liczby plików i wolniejszego tempa prac. Przed każdym etapem wykonuj analizę wpływu, a po każdym etapie pełną weryfikację integralności projektu. Nie przechodź dalej, dopóki bieżący etap nie zostanie uznany za w pełni bezpieczny.

Jeżeli podczas analizy okaże się, że modułu nie można bezpiecznie podzielić — **odłóż refaktoryzację**. Nie wymuszaj podziału za wszelką cenę.

---

## 24. Skróty pomocnicze

| Polecenie                                                       | Opis                      |
| --------------------------------------------------------------- | ------------------------- |
| `node -c public/js/studnie/<plik>.js`                           | Sprawdzenie składni JS    |
| `npm run format`                                                | Formatowanie Prettier     |
| `npm run typecheck`                                             | Sprawdzenie typów TS      |
| `git diff --stat`                                               | Podgląd rozmiaru zmian    |
| `git checkout -- <plik>`                                        | Cofnięcie zmian w pliku   |
| `grep -rn "window\.nazwa" public/js/`                           | Znajdź referencje globala |
| `grep -rn "function nazwa" public/js/`                          | Znajdź definicję funkcji  |
| `grep -rn "currentOffer\|currentWell\|selectedRows" public/js/` | Znajdź użycia stanu       |

### Generowanie baseline — przepis

```bash
# Lista globali (window.*)
rg "window\.[a-zA-Z]" public/js/studnie/wellActions.js --only-matching --sort path

# Lista funkcji
rg "^function " public/js/studnie/wellActions.js

# Lista addEventListener
rg "addEventListener" public/js/studnie/wellActions.js

# State Inventory — zmienne stanu
rg "window\.(current|selected|is|edit|order)" public/js/studnie/wellActions.js

# Liczba linii
(Get-Content public/js/studnie/wellActions.js | Measure-Object -Line).Lines
```
