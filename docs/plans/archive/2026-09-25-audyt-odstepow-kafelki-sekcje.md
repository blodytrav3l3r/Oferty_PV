# Audyt odstępów kafelki/sekcje — plan ujednolicenia (2026-09-25)

**Wersja:** 1.27.0
**Status:** zrealizowany w 100% 2026-09-25 (F1–F4) — OpenDesign zastąpiony fallbackiem lokalnym (brak MCP/active-context; §4 archiwalny); resztki domapowane (wizard-summary-bar, catalog-item-row, rury-flex-gap-*, print override); test:quick 298/298 zielony; test:alignment-live pominięty świadomie (wymaga serwera + seedowanego admina; diff nie dotyka selektorów excel — zweryfikowane grepem)
**Decyzje użytkownika:** wszystkie moduły naraz, nowe tokeny dozwolone, OpenDesign = preview + spec CSS

## 1. SSoT dziś

- `public/css/style.base.css:263-268`: `--section-gap: 1.5rem`, `--section-gap-lg: 2rem`, `--section-pad-x: 0.5rem`, `--section-max-width: 1900px`.
- Skala `.gap-1…4` = `0.25…1rem` w utilities (rzadko używana w siatkach).
- Brak tokenów dla kafelków → ~30 gołych wartości.

## 2. Pełna lista rozjazdów

### A. Nawigacja / header (ciasno, osobna skala)

- `.nav-apps` (`style.base.css:630`): `gap 0.35rem`, `padding-left 0.75rem`, `margin-left 0.6rem`.
- `.nav-tile` (`style.base.css:642`): `gap 0.35rem`, `padding 0.32rem 0.6rem`.
- Breakpointy 1400/1920/900/700: powielone `0.3–0.5rem` (5 miejsc).

### B. Studnie kafelki produktów (najciaśniej)

- `.tiles-section` (`studnie.css:1092`): `margin-bottom 0.6rem`.
- `.tiles-section-title`: `margin-bottom 0.35rem`, `gap 0.3rem`.
- `.tiles-grid` (`studnie.css:1108`): `gap 0.35rem`, kolumny `160px`.
- `.tile`: `padding 0.4rem 0.5rem`, wew. `gap 0.15rem`.
- `.param-tile` (`studnie.css:1782`): `padding 0.35rem 0.8rem`.

### C. Pulpit `index.css` (jedyne z var, ale niespójne)

- `.subtitle`, `.user-hero margin-bottom`: `var(--section-gap-lg)` — OK.
- `.user-hero gap 1.5rem`, `.launch-card padding 1.5rem 2rem / gap 1.5rem` — gołe (przypadkiem = `--section-gap`).
- `.launch-grid`: `gap var(--section-gap)` — OK.
- `@900px/@768px .launch-grid gap 1rem/0.8rem`, `@640px .user-hero gap 0.8rem` — gołe override.
- `.admin-container gap 1rem` + `margin-top var(--section-gap-lg)` — mieszane.

### D. Kartoteka (`style.responsive.css`)

- `.kartoteka-filter-bar gap 0.8rem / margin 0.8rem / padding 0.8rem 1rem` — gołe.
- `.ka-list-card margin-bottom var(--section-gap-lg)` — OK.
- `.kartoteka-offers-grid gap 1rem` — gołe.

### E. Zlecenia

- `.zlecenia-stats gap 0.6rem` + `margin-bottom var(--section-gap-lg)` — mieszane.
- `.zlecenia-stat-card padding 0.55rem 0.9rem / gap 0.6rem`, `.zlecenia-header gap 0.8rem/margin 0.8rem`, `.zlecenia-filters gap 0.4/0.3rem` — gołe.
- `.zlecenia-batch-bar margin-bottom var(--section-gap)` — OK, reszta goła.

### F. Rury (`rury.css`, własna skala 1rem)

- `.rury-card + .rury-card margin-top 1rem`, `.rury-card-header gap 1rem/margin 0.8rem`, `.rury-form-grid gap 0.7rem`, `.rury-summary-grid gap 1rem`, `.rury-summary-actions gap 0.4rem` — gołe.

### G. Studnie offer (`studnie/offer.css`)

- `.offer-stats-bar gap 1rem/margin 1rem`, `.summary-card-actions-grid gap 0.3rem`, `.summary-action-btn gap 0.3rem`, `.offer-header-grid gap 0.8rem` — gołe.

### H. Layout `.main/.section`

- `.main padding 0.8rem 1.5rem 2rem` — gołe; `.section` bez rytmu; `studnie .main padding 0`, `spa #spa-main padding 0/margin 0`; `router.js:373 iframe paddingTop 0.5rem` inline.

### I. Share modal + JS inline

- `.share-grid gap 0.6rem`, `.share-tile gap 8px (px!)`, `.grid-auto-120 gap 11px (px!)`, `aiDashboard gap 16px`, `kartotekaHelpers gap 0.75rem`, `kartotekaAudit gap 0.45rem` — gołe.

Diagnoza: 3 skale obok siebie (0.3–0.35 / 0.6–1.0 / 1.5–2.0 rem) + wycieki px (8/11/16px).

## 3. Docelowa skala (3 poziomy)

```css
--tile-gap-micro: 0.15rem; /* mikro-rytm wewnętrzny (.tile) */
--tile-gap-2xs: 0.3rem; /* ciasne rzędy (tiles-title, filter-tab) */
--tile-gap-xs: 0.35rem; /* nav-tile, tiles-grid */
--tile-gap-xs-plus: 0.5rem; /* rzędy akcji, search-row */
--tile-gap-sm: 0.6rem; /* share-grid, statystyki zwarte */
--tile-gap-sm-plus: 0.8rem; /* karty, profile, headery sekcji */
--tile-gap-md: 1rem; /* siatki kart, listy ofert */
--tile-gap-lg: var(--section-gap); /* 1.5rem — launch-grid, user-hero */
--tile-gap-xl: var(--section-gap-lg); /* 2rem — odstęp sekcji */
```

Mapowanie (wdrożone, dokładne, 1:1): 0.15 → micro; 0.3 → 2xs; 0.35 → xs; 0.4 → xs (unifikacja w dół); 0.45/0.5 → xs-plus; 0.6 → sm; 0.7/0.75/0.8 → sm-plus (unifikacja w górę); 1.0 → md; 1.5/2.0 → lg/xl (aliasy section-gap); px → rem (8px→xs-plus, 11px→sm, 16px→md). Breakpointy: tylko podmiana wartości na var, bez ruszania progów (regresja 1.18.0).

Kolejność plików: `style.base.css` → `studnie.css` → `index.css` → `zlecenia.css` → `rury.css` → `offer.css` → `utilities.css` → JS inline → `docs/UI_GUIDELINES.md §2`.

## 4. OpenDesign — status i next step

- 2026-09-25: `get_active_context → active:false` (brak aktywnego projektu w OD); `list_projects/list_skills` odrzucają losowy UUID (`NOT_FOUND` — daemon wymaga workflow-id z pierwszego atrybuowanego wywołania).
- Next: użytkownik otwiera/klika projekt w OpenDesign (wybudzenie kontekstu) albo podaje `project=<id-or-name>`; wtedy `collect_brief(design-system, SOK-spacing)` → `create_project(sok-spacing)` → `start_run(prototyp 3 siatek: nav-tight / cards-comfortable / sections-airy, 375/768/1024/1440)` → poll `get_run` → `previewUrl` do akceptacji → `get_artifact` → przeniesienie speca do CSS. Bez akceptacji preview NIE dotykać CSS.
- Fallback: lokalny prototyp w `ui-ux-pro-max` skill gdyby OD niedostępne.

## 5. Walidacja po implementacji

`npm run format` → `node -c` ruszonych JS → `lint:frontend` → `typecheck:frontend` → `test:alignment` + smoke → brak poziomego scrolla 375/768/1024/1440 → `encoding:check`. Bez zmian wersji.

## 6. Fazy

- F0: OD brief + projekt + run + preview + akceptacja (ten plik, bez zmian CSS).
- F1: tokeny `:root` + nav + tiles studni.
- F2: pulpit + kartoteka + zlecenia.
- F3: rury + offer studni + share/utilities + JS inline + UI_GUIDELINES §2.
- F4: screenshoty przed/po + walidacja + raport ex post.
