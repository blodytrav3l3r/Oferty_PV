# Plan: Tokenizacja kolorów (jeden spójny system var(--...))

> **Stan: ZREALIZOWANE (commit 54aa33a i dalsze).** PRINT_TOKENS_CSS / printTokens.ts wdrożone, legacy public/css/style.css i configurator.css usunięte. Treść ponizżej zachowana jako dokumentacja procesu; szczegóły w sekcji "Domknięcie".

Data: 2026-08-03 | Status: zakończono | Tryb: READ-ONLY → edycja po akceptacji

## Cel

- Jeden SSOT kolorów: `public/css/style.base.css` `:root` (uzupełniony o brakujące stopnie).
- Druk (5 szablonów + JS + backend PDF) pobiera tokeny z `{{PRINT_TOKENS}}` (frontend: `PRINT_TOKENS_CSS` w formatters.js; backend: `src/services/pdf/printTokens.ts`).
- Usunięcie legacy `public/css/style.css` (nieładowany, 143 hexy).

## Nowe tokeny (11) w :root

--slate-600 #475569; --slate-50 #f8fafc; --brand-navy #2d3561; --warn-bg-light #fffbeb;
--success-strong #006600; --danger-strong #cc0000; --warn-strong #996600;
--success-bg-soft #e6f7e6; --danger-bg-soft #fce8e8; --warn-bg-soft #fff3e0; --cmp-uszczelka #84cc16.

## Kluczowe odkrycia (audyt)

1. Backend renderuje szablony sam (ruryHtml.ts:36, kartaBudowy.ts:14) — wymaga podmiany {{PRINT_TOKENS}} server-side.
2. Batch print wycina <head> bez renderTemplate (zlecenia.js:513/561, printManager.js:797) — potrzebny applyPrintTokens().
3. configurator.css/offer.css w public/css/studnie/ — duplikaty reguł studnie.css (osobny refaktor scalenia).
4. xlsxImportShared.js:104 '&#039;' to encja apostrofu, nie kolor — nie ruszać.
5. printManager.js:683 goły `color:red` → var(--danger).
6. style.css nie jest ładowany nigdzie — bezpieczny do usunięcia.

## Fazy

0. Tokeny w style.base.css (11 nowych).
1. formatters.js: PRINT_TOKENS_CSS + rozszerzenie renderTemplate + applyPrintTokens + window.*.
2. Backend: printTokens.ts (nowy) + podmiana w ruryHtml.ts i kartaBudowy.ts.
3. 5 szablonów: usunąć zdublowany :root → {{PRINT_TOKENS}}, hexy → var(--slate-*).
4. JS druk: printManager.js (SVG+osadnik+red), zleceniaHelpers.js (SVG), offerExports.js (wstrzyknięcie + tokeny).
5. Batch print: applyPrintTokens w zlecenia.js ×2 i printManager.js printEtykietaAll.
6. CSS UI: style.responsive.css (print override), studnie.css, configurator.css, offer.css, printModal.css.
7. JS UI: wellUI, excelColumnVisibility, excelCopyPaste, ui, conflictModal.
8. Usunięcie public/css/style.css.
9. Walidacja końcowa (rg hexów, typecheck, lint, format, validate, testy + testy ręczne druku).

## Mapowanie hex→token (pełne)

- #1a1a2e→slate-950 | #1a1e25→slate-950 | #1a1d27→bg-card | #222→slate-950 | #2d3561→brand-navy
- #2d3e5a→slate-700 | #301515→danger-bg | #333→slate-700 | #3b3b9b→accent-border | #3f4356→slate-700
- #444→slate-700 | #475569→slate-600 | #555→slate-600 | #6060d0→accent-border | #666→slate-500
- #777→slate-500 | #888→slate-400 | #999→slate-400 | #aaa→slate-400 | #ccc→slate-300 | #ddd→slate-200
- #e0e0e0→slate-200 | #e8e8e8→slate-200 | #eee→slate-200 | #f4f6fb→slate-100 | #f5f5f5→slate-100
- #f8fafc→slate-50 | #f9fafb→slate-50 | #fafafa→slate-50 | #f0f9ff→slate-100 | #ffedd5→slate-100
- #000→black | #fff/ffffff→white | #059669→success | #06b6d4→cyan | #84cc16→cmp-uszczelka
- #f59e0b→warn | #fffbeb→warn-bg-light | #ffd8e1→warn-bg-soft (conflictModal #fff8e1)
- #006600→success-strong | #cc0000→danger-strong | #996600→warn-strong
- #e6f7e6/#d0f0d0→success-bg-soft | #fce8e8/#f8d0d0→danger-bg-soft | #fff3e0→warn-bg-soft
- printModal: #2563eb→blue | #fca5a5→danger-hover | #93c5fd→accent-text | #fcd34d→warn-hover
- #c4b5fd→accent-text | #6ee7b7→success-hover

## Walidacja po krokach

- JS: node -c; CSS/HTML: npx prettier --write; TS: npm run typecheck; UI: npm run lint:frontend
- Final: rg hexów (tylko style.base.css + vendor), npm run validate, npm test, testy ręczne 5 druków + batch + PDF.

## Domknięcie (2026-08-03)

Wykonane po commicie 54aa33a (zatwierdzone przez użytkownika):

1. **`--shadow-navy: #2e2b6e`** dodany do `:root`; gołe `#fff` (btn-primary) → `var(--white)`, `#2e2b6e` ×3 (cienie, focus ring) → `var(--shadow-navy)`. Zero hexów poza `:root` w style.base.css.
2. **Niezdefiniowane `--text`/`--bg`** (13 wystąpień w 7 plikach: clientManager, offerAddItems, offerExports, orderEditMode, orderSummary, popupsTransitionManager) → podmiana na istniejące tokeny `--text-primary`/`--bg-input`. Decyzja: mapowanie per-wystąpienie (bez aliasów w :root).
3. **Test spójności 3 SSoT** — nowy `tests/printTokensConsistency.test.ts` (frontend/backend `PRINT_TOKENS_CSS` identyczne, 16 tokenów, wartości zgodne z `:root`).
4. **Scalenie `configurator.css` → `studnie.css`** — analiza wykazała, że configurator.css (1505 linii) był w 99% duplikatem studnie.css (223/226 reguł identycznych). 3 unikalne reguły (`[data-partial]`, `.config-tile`, `.config-tile:hover`) przeniesione na koniec studnie.css, link usunięty z studnie.html, plik skasowany. Nowe testy regresyjne w `tests/responsive/studnie.test.ts`.
5. **Do weryfikacji ręcznej przez użytkownika**: wygląd 5 szablonów druku + batch + PDF (backend), cienie `--shadow-navy`, kontrast modali po podmianie `--text`/`--bg`.
