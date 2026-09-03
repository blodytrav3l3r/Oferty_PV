# UI/UX Guidelines — S.O.K. — System Ofert i Kalkulacji

Jedno źródło prawdy (Single Source of Truth) dla UI/UX, HTML i CSS. Wszelkie zmiany
wizualne i nowe moduły muszą być zgodne z tym dokumentem. Reguła nadrzędna:

> **Nie wymyślaj nowych klas, kolorów, rozmiarów ani warstw — użyj tego, co już istnieje.**

---

## 1. Architektura CSS (gdzie co żyje)

Kolejność ładowania w każdej wejściówce (index, app, rury, studnie, kartoteka, zlecenia):

| Plik                       | Rola                                                                                                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `css/inter.css`            | Font Inter (importowany przez `style.base.css`)                                                                                                                              |
| `css/style.base.css`       | **Tokeny `:root` + base layout + komponenty wspólne** (header, karty, przyciski, formularze, tabele, badge)                                                                  |
| `css/style.cards.css`      | Karty ofert, status-badge, komponenty wariantowe                                                                                                                             |
| `css/style.responsive.css` | Breakpointy, modale (`.modal-overlay`/`.modal`), toasty, wizard                                                                                                              |
| `css/style.utilities.css`  | Utility classes (zastępują inline style)                                                                                                                                     |
| `css/<moduł>.css`          | Style modułowe: `rury.css`, `studnie.css` (+ `studnie/offer.css`, `studnie/modal.css`), `zlecenia.css`, `index.css`, `spa.css`. Kartoteka używa wyłącznie arkuszy wspólnych. |

> **Zasada:** wspólne klasy NIE mogą być nadpisywane per moduł. Warianty modułowe
> tworzymy przez klasy modyfikatorów (np. `.nav-tile--studnie`), nie przez nadpisania bazowych.

## 2. Design Tokens (SSoT: `public/css/style.base.css:3-239`)

Wszystkie wartości (kolory, fonty, rozmiary, radius, shadow, z-index) wyłącznie przez
zmienne `var(--...)`. **Zakaz gołych hexów/kolorów poza `:root`** (wyjątek: pliki vendor).

### Kolory (kluczowe)

| Token                                                                            | Wartość                                                   | Użycie                                                     |
| -------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------- |
| `--bg-primary` / `--bg-secondary` / `--bg-card` / `--bg-glass` / `--bg-tertiary` | `#0a0e1a` / `#111827` / …                                 | Tła: strona, header, karty, glass                          |
| `--text-primary` / `--text-secondary` / `--text-muted`                           | `--slate-100` / `--slate-400` / `--slate-500`             | Hierarchia tekstu                                          |
| `--accent` / `--accent2`                                                         | `#6366f1` / `#8b5cf6`                                     | Główny akcent (indigo)                                     |
| `--success` / `--danger` / `--warn` / `--blue` / `--pink`                        | `#10b981` / `#ef4444` / `#f59e0b` / `#3b82f6` / `#ec4899` | Statusy i akcenty modułów                                  |
| `--*-rgb` (np. `--accent-rgb: 99,102,241`)                                       | —                                                         | `rgba(var(--danger-rgb), 0.1)` do tintów                   |
| `--cmp-*`                                                                        | —                                                         | Paleta identyfikacyjna komponentów studni (fill diagramów) |

### Kolory akcentów per moduł

| Moduł     | Klasa             | `--logo-start` → `--logo-end`   |
| --------- | ----------------- | ------------------------------- |
| Rury      | `.logo-rury`      | `--accent` → `--accent2`        |
| Studnie   | `.logo-studnie`   | `--success` → `--success-hover` |
| Kartoteka | `.logo-kartoteka` | `--warn` → `--warn-hover`       |
| Zlecenia  | `.logo-zlecenia`  | `--pink` → `--pink-hover`       |

### Typografia

- Fonty: `--font-sans` (Inter), `--font-mono` (dla ID, numerów, cen mono).
- Skala rozmiarów: `--fs-3xs`…`--fs-8xl` (`0.55rem`…`2.5rem`).
- Wagi: `--fw-light`…`--fw-black` (300–900).
- Używaj tokenów `--fs-*`/`--fw-*` — nigdy gołych `px`/`rem`/wag dla tekstu.

### Spacing i rytm pionowy

- `--section-gap: 1.5rem` (rytm wewnętrzny), `--section-gap-lg: 2rem` (główny odstęp sekcji).
- `--section-max-width: 1900px`, `--section-pad-x: 0.5rem`.
- Skala gap: `.gap-1`…`.gap-4` (`0.25rem`…`1rem`).
- Marginesy: `.mb-0`/`.mb-1`; `--header-h: 57px`.

### Radius, cienie, przejścia

- `--radius-2xs: 4px`, `--radius-sm: 8px`, `--radius: 12px` (główny), `--radius-md: 16px`, `--radius-lg: 20px`, `--radius-pill: 999px`.
- `--shadow-sm` / `--shadow-md` / `--shadow-lg` / `--shadow-navy`.
- `--transition` (0.25s) — hover/aktywne przejścia 150–300ms.

## 3. Z-index — jeden system (SSoT: `public/js/studnie/layers.js`)

**Kanonem warstw jest `LAYERS` / `LAYERS_EXCEL` w `public/js/studnie/layers.js`.**
Popupy, modale i nakładki tworzone w JS MUSZĄ używać stałych `LAYERS.*` — zakaz twardych
liczb. Klasy CSS używają zmiennych `--z-*` z `style.base.css:218-222` (`--z-header: 100`, `--z-sticky-th: 5`, `--z-sticky-dropdown: 50`, `--z-overlay: 2000`, `--z-toast: 5000`).

| Warstwa                                     | Źródło (JS)                          | CSS var                                          |
| ------------------------------------------- | ------------------------------------ | ------------------------------------------------ |
| Sticky (header, tabele, filtry)             | `LAYERS.STICKY_*`                    | `--z-header: 100`                                |
| Local overlay (selecty, popupy kontekstowe) | `LAYERS.OVERLAY_*`                   | —                                                |
| Modal Excel (backdrop/container/focus)      | `LAYERS_EXCEL.*`                     | —                                                |
| Modal generyczny                            | `LAYERS.GENERIC_MODAL_*`             | `--z-overlay: 2000` (backdrop), `.modal-overlay` |
| Toast / banner / preview                    | `LAYERS.TOAST/BANNER/PREVIEW_BANNER` | `--z-toast: 5000` (`.toast-container`)           |
| Bulk order / edycja przejścia               | `LAYERS.BULK_ORDER/TRANSITION_EDIT`  | —                                                |

**Zasady:**

- Nie dodawaj nowych `--z-*` ani wartości w `LAYERS` — użyj istniejących grup.
- Popup JS → `LAYERS.*`; klasa CSS → istniejący var. Nigdy inline `z-index: 9999`.

## 4. Layout i breakpointy

- Trójkolumnowy grid studni: `.well-app-layout` (`350px 1fr 350px`).
- Breakpointy (kanon): **1400px** (sidebar 350→300), **1200px** (ukryj diagram),
  **900px** (1 kolumna), **768px** (form-row), **700px** (header wrap, ukryj teksty kafelków),
  **480px** (centrowanie, ukryj logo text).
- Responsywność bez poziomego scrolla; test: 375 / 768 / 1024 / 1440.

## 5. Komponenty wspólne (SSoT klas: `style.base.css`)

| Komponent         | Klasa                                                                                                           | Uwagi                                                   |
| ----------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Header            | `.header` / `.header-inner` / `.header-left/center/right`                                                       | Sticky, `--z-header`                                    |
| Dane użytkownika  | `.header-user-info` / `.header-username` / `.header-role-badge` / `.header-version` / `.header-logout`          | Renderuje wyłącznie `headerUser.js`                     |
| Logo              | `.logo` + `.logo-<moduł>`; SPA: `.logo.logo-app` + `#spa-logo-text.logo-app-module`                             | Gradient przez `--logo-start/--logo-end`                |
| Nawigacja         | `.nav-tile` / `.nav-tile--<moduł>` (aktywny: `.active` + podkreślenie `::after`)                                | Ikona + tekst; ikony Lucide                             |
| Karta             | `.card` / `.card-sm` / `.card-compact` / `.card-title` / `.card-title-sm` / `.card-header-row`                  | Padding `0.8rem 1rem` / `0.6rem 0.8rem` / `0.7rem 1rem` |
| Przycisk          | `.btn` + `.btn-primary` / `.btn-secondary` / `.btn-danger` / `.btn-success` / `.btn-sm` / `.btn-icon`           | Warianty modułowe przez modyfikatory `--<moduł>`        |
| Formularz         | `.form-group` / `.form-label(-sm)` / `.form-input` / `.form-select` / `.form-textarea` / `.form-input-sm`       | Gridy: `.form-row-2/3/4`                                |
| Edycja inline     | `.edit-input`                                                                                                   | Bez spinnerów number (globalnie ukryte)                 |
| Wyszukiwarka      | `.search-box`                                                                                                   | Ikona + input z lewym paddingiem                        |
| Tabela            | `.table-wrap` + natywne `<table>`                                                                               | Sticky `th`, uppercase, hover `--bg-hover`              |
| Badge             | `.badge` (card-title), `.status-badge` + `.status-draft/.status-accepted`, `.badge-ok/.badge-info/.badge-muted` | Status: ikona + kolor (nie sam kolor)                   |
| Kategoria         | `.cat-header` + `.cat-count`                                                                                    | Lewy border accent                                      |
| Kafelek studni    | `.tile` / `.param-tile` / `.well-list-item` / `.offer-list-item`                                                | —                                                       |
| Zakładki          | `.catalog-tabs` / `.catalog-tab` (active), `.zlecenia-filter-tab`                                               | —                                                       |
| Katalog produktów | `.product-catalog` / `.catalog-list` / `.catalog-item-row` / `.catalog-diam-header`                             | —                                                       |

## 6. Modale — jeden wzorzec (`modalCore.js`)

- Modal tworzymy **wyłącznie** przez `public/js/shared/modalCore.js` (klasa
  `.modal-overlay.js-modal-overlay` + `.modal` zdefiniowane w `style.responsive.css:559+`, `showModal` w `modalCore.js:88`).
- **Zakaz** budowania modalów inline-styled w JS (stary wzorzec z `ui.js`/`clientManager.js`).
- Zamknięcie Esc/overlay; focus wewnątrz modala; `aria-label` na overlayu i przyciskach.
- Warstwy przez `LAYERS.*`, szerokości przez `.modal` (max 550px) / warianty szerokie.

## 7. Utility classes (SSoT: `style.utilities.css`)

Zamiast inline style używaj istniejących utility. Najczęściej używane:

- Flex/grid: `.flex-wrap-start`, `.flex-1-180`, `.flex-1-240`, `.flex-2-240`, `.flex-between`, `.flex-gap-2/3/4/5`, `.grid-1auto`, `.grid-auto-120/230`.
- Spacing: `.p-02`, `.p-6-12`, `.m-0`, `.ml-3/4`, `.mt-3`, `.mb-5`, `.pad-sm`.
- Szerokości: `.w-100p-base`, `.w-*pct`, `.w-75-c`, `.min-w-0`.
- Tekst: `.text-center`, `.text-left`, `.text-muted`, `.text-primary`, `.text-xs`, `.text-right-600`, `.fs-*` warianty (np. `.fs-xs-muted`, `.fs-base-sec`).
- Kolory: `.color-accent`, `.color-success`, `.color-danger`, `.color-warn`, `.color-info`, `.color-purple`, `.text-warn`, `.text-danger`.
- Tła/bordery subtelne: `.bg-accent-subtle`, `.border-accent-subtle`, `.border-success`, `.border-danger-subtle`.
- Hover: `.hover-accent`, `.hover-danger`, `.hover-lift`, `.hover-bright`, `.cursor-pointer`.
- Ikony: `.icon-14`, `.icon-sm`, `.icon-md`, `.icon-xs`, `.icon-xxs`.
- Badge/pill: `.badge-ok`, `.badge-info`, `.badge-muted`, `.pill-sm`, `.pill-tag(-blue/-warn/-danger/-nierdz)`.
- Role: `.role-admin` / `.role-pro` / `.role-user` (tylko `style.utilities.css` — tu jest SSoT).
- Inne: `.empty-state`, `.disabled-fade`, `.ellipsis-center`, `.sr-only`, `.hidden`.

> **Zasada DRY dla klas:** utility występujące >2 razy wydziel do `style.utilities.css`,
> nigdy nie duplikuj w pliku modułowym.

## 8. Ikony i bezpieczeństwo

- Ikony **wyłącznie** Lucide (`<i data-lucide="...">`). Po dynamicznym wstrzyknięciu HTML:
  `lucide.createIcons({root: container})`.
- **Zakaz emoji jako ikon UI.**
- Każda interpolacja danych do `innerHTML` przez `escapeHtml(str)`; atrybuty
  (`title`, `aria-label`) przez `escapeHtmlAttr`/`escapeJsStr`.
- Przyciski ikonowe bez tekstu MUSZĄ mieć `aria-label`.

## 9. Dostępność (a11y) — checklista obowiązkowa

- Kontrast ≥ 4.5:1 (dark tokens z `style.base.css`).
- Kolor to nie jedyny wskaźnik: status ERROR/WARNING = ikona + kolor + tooltip.
- Widoczny focus ring (`:focus-visible`, `--focus-ring`); nigdy `outline: none` bez zamiennika.
- `<label for>` lub wrap; placeholder nie jest etykietą.
- Semantyczny HTML (`button`, `label`, `table`, `nav`) — nie divy-kliki.
- Błędy formularzy przy polu + `role="alert"`/`aria-live`.
- `prefers-reduced-motion: reduce` wyłącza animacje.
- Jeden `h1` na widok; sekwencyjna hierarchia nagłówków.
- Toast: auto-dismiss 3–5s (`showToast`).

## 10. Konwencje HTML i nazewnictwo klas

- Struktura strony: `<header class="header">` → `<main class="main">` → sekcje
  `.section[data-phase]` → karty `.card`.
- Klasy: kebab-case (`card-header-row`, `well-app-layout`); modyfikatory `--`
  (`nav-tile--studnie`); warianty stanu: `.active`, `.selected`, `.hidden`, `.disabled`.
- Globalne helpery JS: `window.nazwa = funkcja;`.
- Nie twórz klas per strona dla rzeczy wspólnych (nagłówek, logo, przyciski, formularze).

### Scoped variant vs modifier (Faza 3 — SSoT §6)

Scoped selector `.parent .klasa` w pliku modułowym jest **akceptowalny**, gdy dotyczy
wyłącznie danego modułu. Wspólne komponenty używają **modyfikatorów** `--<moduł>`
(np. `.modal--clients`) zamiast scoped nadpisań.

| Klasa         | Scoped w module (zostaje)                                                                                                                                                       | Goła w `style.base.css` (nie rób)               |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `.form-input` | `.wt-add-cell .form-input` (`studnie.css:3204`), `.zlecenia-virtual-toolbar .form-input` (`zlecenia.css:604`), `.login-box .form-input` (`index.css:185`)                       | Nie przenoś — zmiana globalna (regresja > zysk) |
| `.search-box` | `.zlecenia-header .search-box` (`zlecenia.css:132,488`), `.offer-product-search .search-box` (`style.base.css:1434`), `.kartoteka-filter-bar .search-box` (`responsive.css:78`) | Nie przenoś — scoped zostaje                    |

Zasada: **scoped w module = OK gdy dotyczy tylko modułu**; wspólne warianty =
modyfikator `--<moduł>`. Przy scoped wyrównuj jedynie wartości do tokenów
(`padding`/`border-radius`/`font-size` → `var(--*)`), bez zmiany selektorów ani geometrii.

## 11. Anti-patterny (zakazane)

| Anti-pattern                        | Zamiast                                    |
| ----------------------------------- | ------------------------------------------ |
| Goły kolor/hex poza `:root`         | `var(--*)`                                 |
| Inline style dla rzeczy z klasą     | istniejąca klasa / utility                 |
| Nowy `z-index` inline               | `LAYERS.*` (JS) lub `--z-*` (CSS)          |
| Modal inline-styled                 | `modalCore.js` + `.modal-overlay`/`.modal` |
| Emoji jako ikona                    | Lucide SVG                                 |
| Duplikacja klasy między plikami CSS | jedna definicja w SSoT                     |
| Nadpisanie klasy bazowej w module   | klasa modyfikatora `--<moduł>`             |
| `hover { transform: scale }`        | przejście kolor/cien/translateY (-2px)     |

## 12. Pre-Delivery Checklist (każda zmiana UI)

- [ ] Tokeny `var(--*)` zamiast gołych wartości.
- [ ] Wspólne klasy współdzielone, bez duplikatów per moduł.
- [ ] `escapeHtml` / `escapeHtmlAttr` / `escapeJsStr` przy interpolacjach.
- [ ] `lucide.createIcons` po dynamicznym HTML; brak emoji-ikon.
- [ ] `aria-label` na przyciskach ikonowych; widoczne focus ringi.
- [ ] Modale przez `modalCore.js` + `LAYERS.*`.
- [ ] `prefers-reduced-motion` respektowane; transition 150–300ms.
- [ ] Brak poziomego scrolla w 375/768/1024/1440.
- [ ] Toasty z auto-dismiss; empty states z komunikatem i akcją.
- [ ] `npm run format` + `npm run lint:frontend` + `node -c <plik.js>`.
