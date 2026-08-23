# Plan optymalizacji wydajności i jakości — S.O.K. (po v1.18.4)

**Data:** 2026-08-23
**Stan wyjściowy:** v1.18.4 (`82b6474`), średnia audytu ~8.5/10, working tree czysty
**Cel:** skrócenie czasu ładowania modułów, domknięcie SSoT HTML, smoke E2E w CI

---

## 0. Zmierzone fakty (read-only, 2026-08-23)

| Metryka                               | Wartość                                                         | Ocena                                   |
| ------------------------------------- | --------------------------------------------------------------- | --------------------------------------- |
| Linie JS frontend                     | 52 248 (221 plików)                                             | duży monolit bez bundlera               |
| `<script>` w studnie.html / rury.html | **157 / 51**                                                    | 200+ żądań HTTP na start modułu         |
| Linie CSS                             | ~13 500 (13 plików)                                             | brak minifikacji                        |
| Pliki JS >500 linii                   | 23 (max solverAutoSelect 1233)                                  | SRP ok (`ponytail:`), churn przy edycji |
| Inline `style=` kartoteka / modals    | 12 / 33 (#zlecenia-modal)                                       | ostatnia enklawa przed SSoT             |
| CI e2e/axe                            | axe job jest (`continue-on-error`), brak blokującego smoke flow | regresje UI wykrywane ręcznie           |

---

## Faza P0-1 — Grupowanie scriptów studnie.html/rury.html (concat w prebuild)

**Problem:** 157+51 tagów `<script defer>` = 200+ żądań; przeglądarka pobiera je równolegle (h2 przez reverse proxy per ADR-006), ale parsowanie 52k linii powtarza się przy każdym wejściu; kolejność ładowania jest krytyczna (SSoT komentarz w studnie.html:298).

**Rozwiązanie minimalne (bez zmiany architektury ADR-002/008):**

1. Nowy skrypt `scripts/bundle-scripts.mjs`: czyta listę `<script src>` z HTML w kolejności występowania, scala do paczek (np. `studnie-core.js`, `studnie-excel.js`, `rury-core.js`), minifikuje (esbuild `--minify`, zero-config, zachowuje IIFE/window).
2. Tryb bezpieczny: skrypt generuje **równoległe** pliki `*.bundle.html` obok oryginałów + raport różnic kolejności; przełączenie na bundle tylko po zielonym smoke teście.
3. Cache-bust: paczki wersjonowane `?v=` przez istniejący `auto-cache-bust.mjs` (dopisać wzorzec).
4. Oryginalne HTML zostaje źródłem prawdy — bundle regenerowany w `prebuild`.

**Weryfikacja:** `npm run validate` + test:e2e-appname + ręczny smoke studnie/rury (auto-dobór, excel, modal rabatów); porównanie liczby żądań w DevTools (200 → <10).

**Effort:** M (1–2 dni). **Ryzyko:** średnie (kolejność + `document.currentScript` jeśli gdzieś używany — sprawdzić grepem).

---

## Faza P0-2 — Minifikacja CSS

**Kroki:**

1. esbuild/lightningcss w pipeline buildu: `public/css/*.css` → `public/dist/css/*.min.css` (mapa nazw stabilna).
2. Wejściówki wskazują `.min.css` gdy `NODE_ENV=production`; dev zostaje na źródłach (czytelny diff).
3. `?v=` cache-bust obejmuje nowe ścieżki (rozszerzyć `auto-cache-bust.mjs`).

**Weryfikacja:** `format:check` nietknięty (źródła), rozmiar transferu -50%+, smoke wizualny 375/768/1440.

**Effort:** S (pół dnia). **Ryzyko:** niskie.

---

## Faza P1-1 — modals.html #zlecenia-modal → klasy (domknięcie SSoT)

**Zakres:** 8 buttonów headera z inline `background:rgba(var(--*-rgb),...)` → modyfikatory `.zl-btn--generate/--accept/--revoke/--delete/--print/--label` w `studnie.css` (wzorzec modyfikatora jak `.nav-tile--<moduł>`); overlay `.zlecenia-overlay` zostaje własnym systemem (świadoma decyzja, nie modalCore); literal `z-index: 2000` → `var(--z-overlay)`.

**Weryfikacja:** grep `style=` w partials/studnie/modals.html spada 33→<6 (dynamiczne SVG), lint:frontend, smoke zleceń (akceptacja/cofnij/druk).

**Effort:** S (pół dnia). **Ryzyko:** niskie.

---

## Faza P1-2 — kartoteka.html pozostałe 12 inline

**Zakres:** skeleton `.kartoteka-filter-bar` (flex column) → klasa w `style.responsive.css:166` rozszerzona o layout; search-box wrapper + svg pozycjonowanie → `.search-inline`; empty-state loading → `.empty-state` z base + modyfikator.

**Weryfikacja:** grep `style=` kartoteka ≤3 (tylko dynamiczne szerokości), responsywność 768 bez regresji (testy responsive przechodzą).

**Effort:** S (pół dnia). **Ryzyko:** niskie.

---

## Faza P2-1 — Smoke E2E flow jako blokujący job CI

**Kroki:**

1. `tests/playwright/smokeOfferFlow.spec.ts`: login admin → studnie → dodaj studnię → auto-dobór → zapis oferty → otwórz zakładkę oferta (asercja sumy netto >0); analogicznie rury skrótowo.
2. Job CI `e2e-smoke` (blokujący na push main, needs test), webServer z playwright.config.
3. axe job pozostaje informacyjny do czasu wyzerowania naruszeń.

**Weryfikacja:** 3 przebiegi lokalnie bez flaky; CI zielone.

**Effort:** M (1–1,5 dnia). **Ryzyko:** średnie (auth w teście, dane seed).

---

## Kolejność i release

| Krok | Faza                      | Effort | Ryzyko  |
| ---- | ------------------------- | ------ | ------- |
| 1    | P0-2 minifikacja CSS      | S      | niskie  |
| 2    | P1-1 zlecenia-modal klasy | S      | niskie  |
| 3    | P1-2 kartoteka inline     | S      | niskie  |
| 4    | P0-1 bundling scriptów    | M      | średnie |
| 5    | P2-1 smoke E2E CI         | M      | średnie |

Po każdej fazie: `validate` + `version:check` + `encoding:check` + commit helperem. Release `minor` po całym planie (zmiany build pipeline = funkcjonalne dla deploy).

## Skipped (YAGNI)

- ESM/import map dla 737 window.* — add gdy kolejność scriptów pęknie lub bundling wymusi moduły.
- Split 23 plików >500 linii — tylko przy edycji feature'owej danego pliku.
- Chromatic/Percy visual diff — add gdy smoke E2E niestabilny.
- babel-plugin-istanbul dla coverage public/js — add gdy % coverage stanie wymaganiem.
