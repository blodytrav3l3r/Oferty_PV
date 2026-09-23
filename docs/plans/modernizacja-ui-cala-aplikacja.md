# Modernizacja i ujednolicenie UI — pełny prompt wykonawczy

> Status: PLAN FINAL v6 (FROZEN — READY FOR EXECUTION, ocena 9,9/10). Wszystkie uwagi
> wchłonięte: równorzędność motywów, P0 tokens + P0 GATE, semantyka, subtle hover,
> warstwa kompatybilności, Geometry Lock + Typography Lock, component matrix, D1–Dn,
> Excel high-density + density lock, kontrakt print, parity test, token coverage
> (definicja), DOM Contract Manifest, progi WCAG 2.2, NO CREATIVE REDESIGN, ICON
> CONTRACT, doprecyzowanie „zero logiki”, raport końcowy P0. Oryginały (statyczne
> HTML-e Design Systemu) i repozytorium produkcyjne Oferty_PV — inventory zrobione,
> implementacja paczkami za GO (najpierw P0). Plan zamknięty: nie dodawać faz,
> komponentów ani mechanizmów — ryzyko over-specification.

## 0. Filozofia (nadrzędna wobec wszystkich sekcji)

```
                  DESIGN SYSTEM
                       │
          ┌────────────┴────────────┐
          │                         │
        LIGHT                      DARK
          │                         │
          └────────────┬────────────┘
                       │
               SAME COMPONENTS
                       │
       ┌───────────────┼───────────────┐
       │               │               │
    Buttons          Tiles           Forms
       │               │               │
    Modals           Tables          Excel
       │               │               │
       └───────────────┼───────────────┘
                       │
                 SAME SEMANTICS
                       │
                DIFFERENT TOKENS
                       │
              LIGHT values / DARK values
```

**Dark i Light są równorzędnymi celami redesignu.** Baseline dark/light służy
wyłącznie do pomiaru regresji i identyfikacji istniejących zachowań. Żaden
z motywów nie jest traktowany jako wizualny wzorzec docelowy. Po redesignie oba
motywy korzystają z tego samego systemu komponentów, typografii, spacingu,
stanów interaktywnych, semantyki kolorów, ikon i tokenów. Różnice między dark
i light wynikają wyłącznie z wartości tokenów przeznaczonych dla danego motywu.
Nie robimy „naprawy light + kosmetyki dark" — robimy jeden nowoczesny Design
System z dwiema równorzędnymi implementacjami wizualnymi.

## 1. Cel

Pełna modernizacja i ujednolicenie wyglądu całej aplikacji Oferty_PV
(studnie + rury + kartoteka + zlecenia + admin + Excel): czytelność, kontrast,
spójne kafelki, przyciski i ikony na poziomie standardów produkcyjnych aplikacji
webowych. Bez naruszania logiki biznesowej, API, bazy danych i routingu.

## 2. Decyzje (zatwierdzone, nie negocjować bez nowego GO)

1. **Glassmorphism/gradienty — USUNĄĆ** (karty ofert, nav-glow, logo-gradienty,
   przyciski-gradienty) na rzecz płaskich powierzchni (`bg-secondary` + `border`).
2. **Gęstość — ZACHOWAĆ** (kompakt produkcyjny; wymiary, paddingi,
   `excel-row-height: 32px` bez zmian; ruszane tylko kolory/border/shadow/hover).
3. **Ikony — audyt + ujednolicenie rozmiarów + WYMIANA semantyczna**
   (propozycje wymian do akceptacji przed podmianą).
4. **Geometria — ZACHOWAĆ (Geometry Lock).** Redesign nie zmienia layoutu ani
   gęstości aplikacji. Bez zmian `width`, `height`, `padding`, `margin`, `gap`,
   geometrii grid/flex i kolejności DOM, chyba że zmiana
   jest konieczna dla dostępności i zostanie jawnie zatwierdzona. Żadnego
   „modern UI → większe karty → mniej danych na ekranie”.
5. **Typografia — TYPOGRAPHY LOCK.** Domyślnie `font-size`, `line-height`,
   `font-weight` i `letter-spacing` są objęte Geometry Lock. Wyjątek dopuszczalny
   wyłącznie gdy: (1) wynika z udokumentowanego problemu dostępności/czytelności,
   (2) nie powoduje zmiany geometrii komponentu, (3) nie zmniejsza ilości informacji
   widocznej na ekranie, (4) zmiana wykazana before/after, (5) wymaga jawnego GO.
   Zakaz: `14px → 16px` tłumaczone „modernizacją”.

## 3. Faza 0 — środowisko (bez zmian w repozytorium prod)

1. Zbuduj backend (`npm run build`) i uruchom izolowaną instancję na wolnym porcie
   (np. 3177) na ODDZIELNEJ testowej bazie SQLite (seed + znane hasło admina).
   NIGDY nie podłączaj się do produkcyjnej bazy ani portu deweloperskiego.
   Przed startem potwierdź: absolutną ścieżkę DB, port, PID procesu, environment
   oraz wykonaj kopię seed/test DB. Jeżeli ścieżka DB lub port nie spełnia
   izolacji: STOP.
2. Zaloguj się przez API (`POST /api/auth/login`), wstrzyknij cookie sesji do
   kontekstu Playwright. Używaj WYŁĄCZNIE headless Chromium.

## 4. Faza 1 — inwentaryzacja renderowana (browser)

Screenshoty 1440×900, light + dark, dla: pulpit, rury K1–K5, studnie K1–K5 +
oferta + cennik + PZ, kartoteka (karty + modale), zlecenia (statystyki + tabela +
modale), admin, Excel (toolbar/tabela/modale), UPM/print, toasty. Każdy screenshot
→ tabela (element, tryb, tekst→tło, kontrast WCAG, werdykt). To jest BASELINE;
zapisz screenshoty przed jakąkolwiek zmianą.

### Component matrix (wypełnić po screenshotach — żaden stan nie może zostać bez oceny)

| Component | Light | Dark | Default | Hover | Focus | Active | Disabled | Selected | Loading |
| --------- | ----- | ---- | ------- | ----- | ----- | ------ | -------- | -------- | ------- |
| Button    | ✓     | ✓    | ✓       | ✓     | ✓     | ✓      | ✓        | —        | ✓       |
| Tile      | ✓     | ✓    | ✓       | ✓     | ✓     | —      | ✓        | ✓        | —       |
| Input     | ✓     | ✓    | ✓       | ✓     | ✓     | —      | ✓        | —        | —       |
| Modal     | ✓     | ✓    | ✓       | —     | ✓     | —      | —        | —        | —       |
| Table     | ✓     | ✓    | ✓       | ✓     | —     | —      | —        | ✓        | —       |
| Toast     | ✓     | ✓    | ✓       | —     | —     | —      | —        | —        | —       |
| Dropdown  | ✓     | ✓    | ✓       | ✓     | ✓     | —      | ✓        | ✓        | —       |
| Excel     | ✓     | ✓    | ✓       | ✓     | ✓     | —      | ✓        | ✓        | —       |

## 5. System docelowy (P0–P8, implementacja paczkami, GO per paczkę)

> Kolejność obowiązkowa: najpierw P0 (system), potem komponenty.
> Zaczynanie od P1 bez P0 jest zabronione.

- **P0 Design Tokens / Foundation.** Przed zmianami komponentów zdefiniować
  i zweryfikować wspólny system: `--bg-*`, `--surface-*`, `--text-*`, `--border-*`,
  `--accent-*`, `--success-*`, `--warning-*`, `--danger-*`, `--info-*`, `--shadow-*`,
  `--radius-*`, `--focus-*`, typografia, spacing, rozmiary ikon, stany interaktywne.
  Każdy token posiada wartości `LIGHT` i `DARK`. Komponenty nie mogą posiadać
  własnych przypadkowych kolorów, jeżeli odpowiedni token już istnieje.
  **Token coverage:** przed P1 wykazać listę wszystkich nowych i istniejących
  tokenów używanych przez komponenty oraz potwierdzić, że każdy token semantyczny
  używany w UI posiada poprawną wartość zarówno w `light`, jak i `dark`.
  Brakujący token jest błędem P0, a nie problemem do naprawienia w późniejszej fazie.
  **Definicja 100%:** każdy nowy token semantyczny ma LIGHT + DARK; każdy komponent
  używający roli semantycznej korzysta z tokenu; brak nowych hardcoded literals dla
  istniejących ról; brak gradientów/glass/washe poza jawnie zatwierdzonym wyjątkiem;
  brak tokenów zdefiniowanych lecz nieużywanych bez uzasadnienia; brak komponentu
  korzystającego z legacy color zamiast istniejącego tokenu.

    **P0 GATE — P1–P8 NIE MOGĄ rozpocząć implementacji przed:**
    ✓ token inventory ✓ LIGHT values ✓ DARK values ✓ semantic mapping
    ✓ token coverage = 100% ✓ orphan/hardcoded color audit ✓ focus token
    ✓ status token mapping ✓ typography mapping.
    Jeżeli którykolwiek punkt niespełniony: STOP — brak GO dla P1.
    **P0 kończy się raportem (inventory tokenów, coverage, manifest, screenshoty
    baseline), a nie automatycznym przejściem do P1.** Dopiero raport + jawne GO
    otwierają P1. Ta sama zasada dotyczy każdej paczki: raport paczki → GO → następna.

- **P1 przyciski**: jeden zestaw `primary/secondary/danger/success/warning/ghost/icon`
  × `sm/md`, stany `hover/active/focus-visible/disabled/loading` identyczne wszędzie.
  **Unifikacja wariantów modułowych (nie kasacja):** istniejące klasy modułowe
  (`pehd-btn`, `zt-toggle-btn`, per-modułowe nadpisania) zachować, jeżeli są wymagane
  przez JS/DOM lub mają znaczenie semantyczne. Jeżeli ich wygląd da się w pełni
  oprzeć na globalnym systemie przy zachowaniu kontraktu, sprowadzić je do warstwy
  kompatybilności. Łańcuch: `JS contract → istniejąca klasa → globalny token →
globalny styl komponentu`. Zakaz: `pehd-btn → DELETE` bez sprawdzenia kontraktu.
- **P2 kafelki**: jeden `.tile` (wymiary, padding, radius, ikona 16–20px, typografia
  nazwa/cena, selected, locked, disabled) dla katalogów rur/studni/PZ/admin.
  Hover subtelny: zmiana `background`, `border`, `shadow` lub `outline`;
  `transform`/lift tylko tam, gdzie istnieje uzasadnienie UX i nie powoduje
  przesunięcia layoutu.
- **P3 powierzchnie**: kasacja glass (`--bg-glass` washe, `backdrop-blur`, nav-glow)
  i gradientów dekoracyjnych; elewacja wyłącznie cieniem (`--shadow-*`).
- **P4 formularze/tabele**: unifikacja inputów, `thead sticky` — PRESERVE EXISTING
  BEHAVIOR ONLY (ujednolicenie istniejącego zachowania; NIE dodawać sticky do tabel,
  które go obecnie nie posiadają — to zmiana UX, nie wyglądu), zebra/hover/selected,
  focus ring `--accent`.
- **P5 modale/toasty/dropdowny**: rozmiary S/M/L, overlaye, staged Escape bez zmian logiki.
- **P6 ikony**: mapa funkcja→ikona, propozycje wymian DO AKCEPTACJI, rozmiary ze skali,
  `currentColor`, `aria-label` na icon-only; usunąć resztki emoji/glyfów (`✕`, `🔧`).
  **ICON CONTRACT:** przed wymianą ikony przygotować: obecna ikona → proponowana →
  powód semantyczny → dotknięte pliki → wpływ wizualny → wpływ na dostępność.
  Żadna ikona nie może zostać wymieniona automatycznie tylko dlatego, że „nowa
  wygląda nowocześniej”.
- **P7 Excel / high-density UI**: czyszczenie resztek dark-first w light; kontrakt
  `--excel-*` i testy nienaruszone. Excel jest komponentem wysokiej gęstości, ale
  musi wizualnie należeć do tego samego Design Systemu. Bez zmian geometrii,
  row height i kontraktu tokenów. **EXCEL DENSITY LOCK — zakazane:** zwiększenie
  row height, paddingu komórek, wysokości toolbarów/headerów, font-size tabeli,
  dodawanie dużych odstępów między grupami. Visual modernization ≠ density reduction.
- **P8 admin + print**: spójność z systemem. **Print output jest osobnym kontraktem
  wizualnym.** Redesign UI nie może zmieniać kolorystyki, układu ani semantyki
  dokumentów drukowanych, chyba że zostanie to osobno zatwierdzone.

## 6. Zasady implementacji

- Tylko CSS/tokeny/klasy. **„Zero logiki" oznacza: zero zmian logiki biznesowej
  i zachowania aplikacji.** Zmiany JS są dopuszczalne wyłącznie wtedy, gdy są
  konieczne do przeniesienia istniejącego stylowania inline do theme-aware
  klasy/tokenu, bez zmiany zachowania. Inline style JS → klasy lub wartości
  theme-aware w JS; `!important` tylko z komentarzem uzasadniającym.
- Żadnych losowych kolorów: fix = token semantyczny. Kolory opisują **rolę**,
  nie odcień: `text-primary/secondary/muted`, `surface-primary/secondary/elevated`,
  `border-default/strong`, `accent/accent-strong`, `success/success-strong`,
  `warning/warning-strong`, `danger/danger-strong` (nie: `green-1`, `green-2`,
  `green-dark`). Istniejące `rgba(*-rgb)` nie są automatycznie przepisywane ani
  globalnie usuwane; mogą zostać zmienione lub zastąpione wyłącznie po wykazaniu
  problemu wizualnego/kontrastowego i przypisaniu do odpowiedniego tokenu
  semantycznego. Nowe tokeny tylko z uzasadnieniem.
  Stare nazwy: nie zmieniać automatycznie, najpierw sprawdzić zależności.
- Nie ruszać: klas używanych przez JS, `onclick`, `data-*`, `id`, kontraktu `--excel-*`.

## 6b. NO CREATIVE REDESIGN

Redesign oznacza modernizację VISUAL SYSTEM, a nie wymyślanie nowego UX lub IA.

Zakazane bez osobnego GO: zmiana architektury informacji, kolejności sekcji,
przenoszenie funkcji, tworzenie nowych paneli/sidebarów, łączenie komponentów
w nowe workflow, usuwanie elementów UI, dodawanie nowych interakcji, zmiana
sposobu nawigacji, zmiana tekstów funkcjonalnych, zmiana zachowania komponentów.

Dozwolone: kolor, token, border, shadow, background, icon treatment, visual state,
visual hierarchy, visual consistency.

## 7. Weryfikacja per paczkę

`node -c` dla ruszonych JS → `npm run lint:frontend` → `npm run typecheck:frontend` →
re-screenshoty → tabela visual before/after comparison (element, tryb, tekst, tło,
kontrast przed/po, plik:linia). Baseline służy do pomiaru, nie jest zakazem zmian
w dark — oba motywy są modernizowane równorzędnie (patrz §0).

**Terminologia:** „screenshot regression” oznacza w tym planie wyłącznie
**visual before/after comparison**. Prawdziwa regresja to:
`REGRESSION = niezamierzona zmiana funkcjonalności, geometrii, DOM contract,
interakcji, czytelności, dostępności lub informacji prezentowanej użytkownikowi.`
Duża różnica screenshotów wynikająca z zatwierdzonego redesignu NIE jest regresją.

## 7b. Final acceptance (obie płytki muszą być zielone)

```
✓ test:quick
✓ npm run lint:frontend
✓ npm run typecheck:frontend
✓ WCAG 2.2 AA:
  - normal text ≥ 4.5:1
  - large text ≥ 3:1
  - non-text UI components ≥ 3:1, gdy kryterium ma zastosowanie
  - focus indicator widoczny w obu motywach
  - informacja nie przekazywana wyłącznie kolorem
✓ light component matrix
✓ dark component matrix
✓ light visual before/after comparison
✓ dark visual before/after comparison
✓ DOM contract unchanged (klasy, id, data-*, onclick, kolejność HTML)
✓ JS selectors unchanged
✓ API requests unchanged
✓ --excel-* unchanged
✓ console errors not increased
✓ network errors not increased
✓ production DB untouched
✓ production/dev port untouched
✓ git diff reviewed
```

## 7c. DOM Contract Manifest + console/network baseline (przed P1)

Przed P1 wygenerować baseline zawierający: `id`, klasy, `data-*`, `onclick`,
selektory JS oraz kontrakt `--excel-*`, plus baseline `console errors/warnings`
i failed network requests. Po każdej paczce wykonać diff manifestu i porównać
z baseline błędów. Każda różnica w manifeście wymaga jawnego uzasadnienia i GO;
nowe błędy console/network są blokadą GO. Schemat pracy: `BASELINE → P0 → P1 →
diff → P2 → diff → …`

## 7d. Test dark ↔ light parity (obowiązkowy po zakończeniu)

Każdy komponent posiada odpowiednik w obu motywach. Niedopuszczalne, by komponent
korzystał z nowego tokenu tylko w jednym motywie, a w drugim dziedziczył stary
kolor, gradient, wash lub hardcoded value:

```
BUTTON ├── LIGHT ✓ └── DARK ✓
TILE   ├── LIGHT ✓ └── DARK ✓
MODAL  ├── LIGHT ✓ └── DARK ✓
TABLE  ├── LIGHT ✓ └── DARK ✓
INPUT  ├── LIGHT ✓ └── DARK ✓
EXCEL  ├── LIGHT ✓ └── DARK ✓
```

## 8. Twarde zakazy

- Zakaz operacji na produkcyjnej DB i porcie deweloperskim.
- Zakaz zgadywania kolorów z nazw klas — tylko computed style + screenshot.
- `evaluate()` z funkcją zwracającą Promise (appConfirm i podobne) ZAWSZE
  opakowuj w `setTimeout` (fire-and-forget), inaczej skrypt zawiśnie.
- Selektor iframe: `waitForSelector('#spa-iframe-<moduł>')` + `contentFrame()`
  (NIGDY `frames().find`, bo łapie main frame).

## 9. Kryterium zakończenia

```
audyt → problemy → poprawki → pomiary WCAG → render → screenshoty before/after
→ test:quick zielony → raport → GO na commit
```

## 10. Znane problemy wejściowe

### 10a. Light (z audytu, do pokrycia paczkami)

- L1 `.param-tile.active`: biały tekst na pastelu (fix: `--warn-strong` w light).
- L2 `.wizard-param-label`: muted na mięcie (fix: `text-secondary` w light).
- L3 `.offer-orders-panel` / `.offer-order-row`: granatowe belki w light.
- L4 `.recalc-group`: szare bloki slate w light; puste DN pokazują `.recalc-empty`.
- L5 kafle locked: inline `opacity: 0.5` tonie na bieli (klasa + wartość per motyw).
- L6 `.well-list-item`: slate wash w light; locked `opacity: 0.7` inline do klasy.
- L7 `.config-tile`: gradient slate + biały tekst w light (decyzja: białe karty,
  kolor komponentu na lewej krawędzi, waga lume → `text-primary`).

### 10b. Dark (nie zakładać poprawności — wykryć automatycznie w Fazie 1)

Dla dark utworzyć analogiczną listę `D1, D2, D3…` na podstawie pomiarów, w szczególności:

- zbyt niski kontrast tekstu/grafiki,
- zbyt mocne obramowania, zbyt dużo pure black / pure white,
- pozostałe gradienty, glass/washe, niespójne poziomy surface,
- niespójne hover, focus, selected, disabled,
- niespójne statusy success/warning/danger,
- stare kolory komponentowe spoza tokenów.

Dopiero na tej podstawie planować fixy dark — nie naprawiać wyłącznie tego,
co już znane z light.
