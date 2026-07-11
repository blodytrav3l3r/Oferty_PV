# Batch C — Assessment Report

> Sprint 3.4.2 — 52 STRING_TEMPLATE_ONLY entries
> Baseline: `csp-batch-c-before.json` (frozen snapshot przed zmianami)

## Podsumowanie

| Decyzja                 | Liczba | Akcja                                               |
| ----------------------- | -----: | --------------------------------------------------- |
| FALSE_POSITIVE → IGNORE |      2 | `classification: FALSE_POSITIVE`, `status: IGNORED` |
| CSS hover → IGNORE      |      1 | `classification: CSS_HOVER`, `status: IGNORED`      |
| DOM property → IGNORE   |     16 | `classification: DOM_PROPERTY`, `status: IGNORED`   |
| SIMPLE (→ Batch A)      |      8 | Przenieść do Batch A — Pattern 4                    |
| PARAMS (→ Batch B)      |     25 | Przenieść do Batch B — Pattern 2 z data-*           |
| **Razem**               | **52** |                                                     |

| #   | Plik:linia                  | Handler     | Body                                                                    | Decyzja           | Nowe sub           |
| --- | --------------------------- | ----------- | ----------------------------------------------------------------------- | ----------------- | ------------------ |
| 1   | `orderManager.js:581`       | `onclick`   | `toggleOrderTransportBreakdown()`                                       | Batch A           | `REAL_CSP_HANDLER` |
| 2   | `clientManager.js:125`      | `oninput`   | `filterClientsDb(this.value)`                                           | Batch B           | `REAL_CSP_HANDLER` |
| 3   | `clientManager.js:127`      | `onfocus`   | `this.style.borderColor='var(--accent)'`                                | CSS_HOVER         | `CSS_HOVER`        |
| 4   | `excelTableManager.js:1437` | `onfocus`   | `\"excelCellFocus(this)`                                                | FRAGMENT          | `FALSE_POSITIVE`   |
| 5   | `excelTableManager.js:1440` | `onchange`  | `"''`                                                                   | FRAGMENT          | `FALSE_POSITIVE`   |
| 6   | `excelTableManager.js:1653` | `oninput`   | `excelFilterWells(this.value)`                                          | Batch B           | `REAL_CSP_HANDLER` |
| 7   | `offerManager.js:629`       | `onclick`   | `event.stopPropagation()`                                               | Batch B           | `REAL_CSP_HANDLER` |
| 8   | `offerManager.js:3502`      | `onfocus`   | `this.dataset.oldValue=this.value; this.value=''`                       | DOM_PROPERTY      | `DOM_PROPERTY`     |
| 9   | `offerManager.js:3504`      | `onkeydown` | `if(event.key==='Enter') this.blur()`                                   | DOM_PROPERTY      | `DOM_PROPERTY`     |
| 10  | `offerManager.js:3597`      | `onclick`   | `this.select()`                                                         | DOM_PROPERTY      | `DOM_PROPERTY`     |
| 11  | `offerManager.js:3598`      | `oninput`   | `handleOfferPehdDiscountChange(this.value)`                             | Batch B           | `REAL_CSP_HANDLER` |
| 12  | `offerManager.js:3599`      | `onkeydown` | `if(event.key==='Enter') this.blur()`                                   | DOM_PROPERTY      | `DOM_PROPERTY`     |
| 13  | `offerManager.js:3636`      | `onclick`   | `this.select()`                                                         | DOM_PROPERTY      | `DOM_PROPERTY`     |
| 14  | `offerManager.js:3637`      | `oninput`   | `handleOfferPaintingCostChange('malowanieWewCena', this.value)`         | Batch B           | `REAL_CSP_HANDLER` |
| 15  | `offerManager.js:3638`      | `onkeydown` | `if(event.key==='Enter') this.blur()`                                   | DOM_PROPERTY      | `DOM_PROPERTY`     |
| 16  | `offerManager.js:3653`      | `onclick`   | `this.select()`                                                         | DOM_PROPERTY      | `DOM_PROPERTY`     |
| 17  | `offerManager.js:3654`      | `oninput`   | `handleOfferPaintingCostChange('malowanieZewCena', this.value)`         | Batch B           | `REAL_CSP_HANDLER` |
| 18  | `offerManager.js:3655`      | `onkeydown` | `if(event.key==='Enter') this.blur()`                                   | DOM_PROPERTY      | `DOM_PROPERTY`     |
| 19  | `orderManager.js:3605`      | `onclick`   | `window.toggleCard(...)`                                                | Batch B (wrapper) | `REAL_CSP_HANDLER` |
| 20  | `orderManager.js:4692`      | `onfocus`   | `this.dataset.old = this.value; this.value = ''`                        | DOM_PROPERTY      | `DOM_PROPERTY`     |
| 21  | `orderManager.js:4693`      | `onblur`    | `reorderBulkSeqList(this)`                                              | Batch B           | `REAL_CSP_HANDLER` |
| 22  | `orderManager.js:4694`      | `onkeydown` | `if(event.key === 'Enter') this.blur()`                                 | DOM_PROPERTY      | `DOM_PROPERTY`     |
| 23  | `orderManager.js:4729`      | `onclick`   | `closeBulkOrderPopup()`                                                 | Batch A           | `REAL_CSP_HANDLER` |
| 24  | `orderManager.js:4734`      | `onclick`   | `executeBulkFromPopup()`                                                | Batch A           | `REAL_CSP_HANDLER` |
| 25  | `pricelistManager.js:1567`  | `onclick`   | `loadPrecoDefaults()`                                                   | Batch A           | `REAL_CSP_HANDLER` |
| 26  | `pricelistManager.js:1570`  | `onclick`   | `savePrecoFromUI()`                                                     | Batch A           | `REAL_CSP_HANDLER` |
| 27  | `wellPopups.js:924`         | `onclick`   | `selectRedukcjaChoice(1000)`                                            | Batch B           | `REAL_CSP_HANDLER` |
| 28  | `wellPopups.js:937`         | `onclick`   | `selectRedukcjaChoice(1200)`                                            | Batch B           | `REAL_CSP_HANDLER` |
| 29  | `wellPopups.js:950`         | `onclick`   | `selectRedukcjaChoice(null)`                                            | Batch B           | `REAL_CSP_HANDLER` |
| 30  | `wellPopups.js:1127`        | `onclick`   | `tmSelectFilterMaterial('')`                                            | Batch B           | `REAL_CSP_HANDLER` |
| 31  | `wellPopups.js:1144`        | `onclick`   | `tmSelectFilterDn('')`                                                  | Batch B           | `REAL_CSP_HANDLER` |
| 32  | `wellPopups.js:1160`        | `oninput`   | `tmApplyFilters()`                                                      | Batch A           | `REAL_CSP_HANDLER` |
| 33  | `wellPopups.js:1167`        | `onchange`  | `tmToggleSelectAll()`                                                   | Batch A           | `REAL_CSP_HANDLER` |
| 34  | `wellPopups.js:1174`        | `onclick`   | `tmSortBy('wellName')`                                                  | Batch B           | `REAL_CSP_HANDLER` |
| 35  | `wellPopups.js:1196`        | `onclick`   | `tmSelectTargetCat('')`                                                 | Batch B           | `REAL_CSP_HANDLER` |
| 36  | `wellPopups.js:1210`        | `onclick`   | `tmApplyChanges()`                                                      | Batch A           | `REAL_CSP_HANDLER` |
| 37  | `wellPopups.js:1967`        | `onclick`   | `closeModal(); window.activatePreviewPanel()`                           | Batch B           | `REAL_CSP_HANDLER` |
| 38  | `wellTransitions.js:1150`   | `onclick`   | `document.getElementById('flow-type-modal').style.display='none'`       | Batch B           | `REAL_CSP_HANDLER` |
| 39  | `wellTransitions.js:1151`   | `onclick`   | `event.stopPropagation()`                                               | Batch B           | `REAL_CSP_HANDLER` |
| 40  | `wellTransitions.js:1220`   | `onclick`   | `document.getElementById('change-prz-type-modal').style.display='none'` | Batch B           | `REAL_CSP_HANDLER` |
| 41  | `wellTransitions.js:1221`   | `onclick`   | `event.stopPropagation()`                                               | Batch B           | `REAL_CSP_HANDLER` |
| 42  | `wellTransitions.js:1300`   | `onclick`   | `document.getElementById('change-prz-dn-modal').style.display='none'`   | Batch B           | `REAL_CSP_HANDLER` |
| 43  | `wellTransitions.js:1301`   | `onclick`   | `event.stopPropagation()`                                               | Batch B           | `REAL_CSP_HANDLER` |
| 44  | `wellUI.js:645`             | `onclick`   | `this.select()`                                                         | DOM_PROPERTY      | `DOM_PROPERTY`     |
| 45  | `wellUI.js:654`             | `onclick`   | `this.select()`                                                         | DOM_PROPERTY      | `DOM_PROPERTY`     |
| 46  | `wellUI.js:665`             | `onclick`   | `this.select()`                                                         | DOM_PROPERTY      | `DOM_PROPERTY`     |
| 47  | `wellUI.js:718`             | `onclick`   | `this.select()`                                                         | DOM_PROPERTY      | `DOM_PROPERTY`     |
| 48  | `wellUI.js:719`             | `onchange`  | `updateGlobalPehdDiscount(this.value)`                                  | Batch B           | `REAL_CSP_HANDLER` |
| 49  | `wellUI.js:748`             | `onclick`   | `this.select()`                                                         | DOM_PROPERTY      | `DOM_PROPERTY`     |
| 50  | `wellUI.js:749`             | `onchange`  | `updateGlobalPaintingCost('malowanieWewCena', this.value)`              | Batch B           | `REAL_CSP_HANDLER` |
| 51  | `wellUI.js:760`             | `onclick`   | `this.select()`                                                         | DOM_PROPERTY      | `DOM_PROPERTY`     |
| 52  | `wellUI.js:761`             | `onchange`  | `updateGlobalPaintingCost('malowanieZewCena', this.value)`              | Batch B           | `REAL_CSP_HANDLER` |

## Efekt po reklasyfikacji

| Batch                    | Przed | Zmiana | Po  |
| ------------------------ | ----- | ------ | --- |
| Batch A                  | 0     | +8     | 8   |
| Batch B                  | 297   | +25    | 322 |
| IGNORED (FALSE_POSITIVE) | 1     | +2     | 3   |
| IGNORED (CSS_HOVER)      | 0     | +1     | 1   |
| IGNORED (DOM_PROPERTY)   | 0     | +16    | 16  |
| STRING_TEMPLATE_ONLY     | 52    | -52    | 0   |
