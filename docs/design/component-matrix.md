# Component matrix — S.O.K. (P0 audit, 2026-09-23)

## Przyciski

`.btn-primary/secondary/danger/success/warn(ing)/ghost` (base:1215-1313), `.btn-sm`, `.btn-icon(-danger/-sm/-xs)` (utilities:275-300). Wyjątki modułowe: `.pehd-btn` (rury.css:335) vs `.pehd-btn-cancel` (studnie.css:3113) — do ujednolicenia hoverów, bez zmiany geometrii.

## Formularze

`.form-group/label/input/select/textarea`, `.form-input-sm/wide`, `.form-row-2/3/4`, `.edit-input`, `.search-box`. Scoped warianty modułowe zostają (guidelines §10): `.wt-add-cell .form-input`, `.zlecenia-virtual-toolbar .form-input`, `.login-box .form-input` — wyrównywać tylko wartości do tokenów.

## Tabele

Trzy systemy (brak unifikacji geometrii — kontrakt): `.rury-table` + `.rury-col-num` (rury.css:318), `.zlecenia-table(--flat)` (zlecenia.css:153), `.modal--clients table` (responsive:775). Wspólne: `.table-wrap`, sticky `th`, hover `--bg-hover`. Sortowanie: rury SSoT `getSortedRuryItems`, studnie sort DN, zlecenia cursor + sentinel.

## Modale

SSoT `shared/modalCore.js`: `showModal({id,titleId,html,onOpen,onClose})`, focus-trap, Esc/overlay-close, `LAYERS.*`. Klasy: `.modal-overlay/.modal/.modal-header/.modal-footer` (responsive:564-744), rozmiary `.modal--sm/md/lg` (utilities:1070-1078). Warianty szerokie: `--share/--tm/--ie/--clients/--prz-flow` (do migracji na `--sm/md/lg` tam, gdzie bezpieczne).

## Badge / statusy

`.badge-ok/info/muted`, `.role-admin/pro/user` (SSoT utilities), `.pill-tag-blue/danger/nierdz/warn`, `.ka-pill`, `.status-draft/.status-accepted`, `.cat-header/.cat-count`. Statusy błędów studni: `.well-row-error/warning` + ikona + tooltip (nie sam kolor).

## Karty / nawigacja

`.card/.card-sm/.card-compact`, `.modern-offer-card` (cards.css), `.nav-tile--<moduł>` + `.active::after`, `.catalog-tabs/tab`, `.zlecenia-filter-tab`, `.tile/.param-tile/.well-list-item/.offer-list-item`.

## Znane niespójności (do naprawy w P2-P8)

1. 4 twarde hexy w `studnie/offer.css:415,419,425,430` — zamiana na tokeny.
2. Inline `style=` w JS: excelShortcuts, excelTableBody, excelModal, offerSummaryTable, offerDiscountsPopup, toolbar.js, offerAddItems.js, wellUI.js:68, zleceniaRender, rury/offerRendering — zamiana na utility.
3. `el.style.cssText`: clientManager.js:206,223, orderEditMode.js:140, excelModal.js:117, excelHelpers.js:727.
4. Duplikaty utility: `.flex-between` + `.flex-space-between` + `.flex-between-4` (używane 2 pierwsze — NIE ruszać nazw, kontrakt).
5. `.text-xs` = `var(--fs-base)` — nazwa myląca, ale używana w ~15 miejscach — NIE ruszać.
6. Luki escape: offerWellComponents.js:403, offerSummaryBanners.js:23, actionsWellCrud.js:193,236, excelWellActions.js:356, offerUserManager.js:126.
