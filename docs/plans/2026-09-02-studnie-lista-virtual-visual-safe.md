# Plan: Lista studni — virtual jak Excel, bez zmiany wyglądu

Data: 2026-09-02
Status: w realizacji
Dotyczy: `public/js/studnie/wellUI.js`, `wellVirtual.js`, `wellManager.js`, `public/partials/studnie/sidebar.html`, `public/css/studnie.css`
Powiązane: `docs/plans/archive/2026-09-01-architektura-10k.md` (I1 visual freeze), `wellVirtual.js` (`?wellVirtual=1`), `excelVirtual.js`

## Cel

Lista studni w prawym pasku szarpie / skacze / wpada w pętlę przy dużej liczbie studni. Ma działać jak Excel (spokojny scroll, `rAF + OVERSCAN`, spacery, `filteredIndexes`).

**Twardy warunek:** wygląd NIE może się zmienić. I1 z architektura-10k: kolory/typografia/radius/cienie przez `var(--*)` `style.base.css:3`, karta `.well-list-item` `studnie.css:885` identyczna, `wellActivePulse`/`backdrop-filter` bez zmian wizualnych.

## Diagnoza (skrót)

`wellUI.js:6 renderWellsList()` bez virtual: `refreshAllWellErrors()` dla wszystkich studni (`solverValidation.js:306`, clearance O(N)) + `calcWellStats` per karta + `calculateWellTransportMap` + 6× `wells.map+filter` (`dktCap 1000..styczna`) + `html+=10k` + `lucide.createIcons` cały DOM + `oninput="renderWellsList()" sidebar.html:428` bez debounce. `wellVirtual.js` istnieje ale za flagą `?wellVirtual=1` — domyślnie legacy.

## Fazy (minimalny diff, reversybilne flagą)

### Faza 0 — zero CSS

- Debounce search 150ms (jak `excelHelpers` / `wellVirtual:121`) — patch JS, nie HTML.
- Cache per tick `calcWellStats`/`transportMap` + jedno `refreshAllWellErrors` przed pętlą.
- Scheduler rAF dla kaskady `wellManager:27 refreshAll → renderWellsList → updateSummary → renderWellsList wellUI:366` (guard `_renderingWellsList` maskuje, dalej 2× layout).

### Faza 1 — virtual opt-in (`?wellVirtual=1`)

- `wellVirtual.js` używa tego samego HTML co `wellUI.js:178` (template DRY). Spacery transparent (`wellVirtual:296/360`) jak `excelVirtual:212`.
- Container bez `maxHeight:60vh` (`wellVirtual:143`) — zostaje flex `studnie.css:537 #wells-list flex:1 overflow-y:auto`.
- Wysokość: `WELL_CARD_HEIGHT=78 wellVirtual:9` vs real zmienna (rzędne `well-list-elevations`). Visual-safe: pomiar średniej po pierwszym paint, spacery korygowane bez zmiany karty (lock `min-height` tylko w virtual slice).

### Faza 2 — domyślnie włączone

- `wellVirtualIsEnabled() wellVirtual:22` → default `true` (`?wellVirtual=0` opt-out) po zielonym gate (scroll `0→10k→0 ×3`, oracle `wellVirtualOracle.test.ts`).
- Perf: `.wells-list--many` wyłącza `backdrop-filter/animate` gdy `wells.length>200` — różnica niewidoczna przy scroll, FPS +30%.

## Weryfikacja

`npm run typecheck && typecheck:frontend && lint && encoding:check && version:check && test:quick` + oracle + manual 2933/10k, search P95, `filter→sort→scroll`.
