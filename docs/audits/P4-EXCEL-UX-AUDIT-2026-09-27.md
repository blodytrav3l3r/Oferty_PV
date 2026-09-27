# P4 — Audyt UX Excel studni (read-only, 2026-09-27)

Status: AUDIT ONLY. Implementacja wyłącznie po USER GO (brama P4).
3 subagenty explore: selekcja/klawiatura/fokus, layout/scroll/resize, walidacja/błędy/autosave/motyw/testy.

## 1. Architektura obecna

- Modal overlay `#excel-table-container.excel-table-holder` (`excelModal.js:326,390`); skrypty `defer` w `studnie.html:460,489` (kolejność w `excelState.js:3-9`, wrapper polling-przed-manager błąd #30).
- Render: `_excelRenderTable(dn)` — save focus/scroll → `_excelGetFilteredIndexes()` (SSoT) → string `table>thead(3× sticky)+tbody` → `innerHTML` wipe → restore scroll/widths/sticky/locked/sort → restore focus → lucide scoped (`excelTableRenderer.js:5,271-333`).
- Virtual ON domyślnie (kill `?virtual=0`): patch `_excelRenderTable`, slice `filtered[start:end]` (`EXCEL_ROW_HEIGHT=32, OVERSCAN=10`), spacery + `data-logical-row` (`excelVirtual.js:738-841`).
- Polling 1000 ms snapshot (`configSource/config.length/configStatus`) + debounce 800 ms (`excelPolling.js`); skip przy `_excelUserEditing`/`document.hidden`.
- Stan: `_excelSelectedCells:[{wIdx,colIdx}]`, `_excelSelectedCols`, `_excelLastClicked*`, `_excelDragState` (`excelState.js:16-30`); `colIdx` = TD-index, kanon nagłówka h1 (drugi `tr`), h3 ma `colspan=4`. Trzy rozłączne modele: komórki, kolumny (ignorują cells gdy `cols>0`), wiersze-checkboxy.
- Zapis: `excelSaveAll` (`excelWellActions.js:5-62`): clean empty → `validatePrzejsciaForSave` (twardy gate + modal) → `refreshAll()` → `saveCurrentOrder`/`saveOfferStudnie` → dirty=false + close. Fail zostawia modal otwarty.
- Draft: osobna warstwa `window.draftAutosave` (localStorage); `_excelDirty` (modal) ≠ draft. Autosave wewnątrz Excela nie istnieje — tylko flaga + confirm/restore przy zamknięciu.
- Undo: patch-per-well, cap 50 wpisów / 12 MB / 1 MB-wpis, FIFO (`excelUndo.js:115-133`).
- Motyw: tylko `var(--*)` (`diagramTheme.js`), kontrakt `excelThemeTokens.test.ts`; boost alfy w light (`excelTableBody.js:26-40`).
- Testy: ~30 `tests/studnie/excel*.test.ts` + 10 `tests/playwright/excel*.cjs` (undo, D1/D2, theme, relief, paste, lock, parity/bench, visual gate).

## 2. Przepływ użytkownika

Otwórz tabelę → filtr DN/zakładka → edycja komórek (rzędne/ilości/przejścia) → auto-dobór per wiersz → błędy live (tint + tooltip) → Ctrl+S / "Gotowe" → gate przejść → zapis oferty → zamknięcie. Równolegle: sortowanie, resize, ukrywanie kolumn, kopiuj/wklej, undo, duplikaty nazw.

## 3. Zachowania istniejące (dobre)

- SSoT: `data-widx`, `isEmptyPrzejscie`, `clampRzednaWlaczenia`, `enforceOtRings`, `_excelGetFilteredIndexes`, klucze `data-excel-col`/`tab-colId`, `_excelResetLayoutDependentState` przy każdej zmianie layoutu, cursor-na-koniec (błąd #33), `Ctrl+X` pass-through, kanon h1 + `STICKY_COLS=7`, kill-switch virtual, LS `sok_excel_*` + migracja `witros_*`.

## 4. Konkretne problemy UX

### A. Małe defekty (zachowanie intencji, AUTO-FIX kandydaci)

1. `Ctrl+A` bez guarda INPUT (`excelCellNavigation.js:633`) — w edytowanym polu zaznacza tabelę zamiast tekstu (por. guardy `Ctrl+Z:563`, `Del:581`).
2. `Ctrl+F` kradnie find także w `excel-search-input` (`:551`).
3. Zablokowany wiersz: `title=` nadpisuje `statusTitle` błędu (`excelTableBody.js:259-262`) — tooltip ERROR ginie.
4. Snapshot undo przed early-return błędu rzędnych (`excelChangeHandlers.js:16 vs 25-29`) — Ctrl+Z no-op zaśmieca stos.
5. `excelOnNameChange` snapshot+dirty przed `if(!name)return` (`excelWellActions.js:283-288`) — pusta nazwa brudzi undo.
6. Podwójne tworzenie z pustego wiersza: `Enter→create` + `blur→create` (`excelTableBody.js:646`).
7. `_excelApplyStickyColumns`: pomiar po `thead tr[0]` (h3 z colspan) + pętla `rAF` bez limitu (`excelTableRenderer.js:389-408`).
8. `_excelSelectRange`: N×`_excelUpdateSelectionSummary` w pętli (O(n·m) DOM, `excelCellSelection.js:292-306`).

### B. Średnie (REQUIRES USER GO — zmiana interakcji)

9. `table-layout:auto` + dziesiątki `min-width` = jitter przy resize/dodaniu PRZ (`excelTableRenderer.js:54`) — fix (`fixed`) zmienia zachowanie szerokości.
10. Sztywne `top:0/1.4rem/3.2rem` sticky header (`:268-270`) — rozjazd przy zoom/FS.
11. Multi-resize nadaje tę samą absolutną szerokość wszystkim zaznaczonym (`excelColumnResize.js:88`) zamiast delty.
12. Brak touch/pointer w resize (`:45,126`) — brak resize na dotyk.
13. Tooltip ucina do 1 błędu (`(+N)`, `excelTableBody.js:18-22`) — brak listy/linku.
14. Esc czyści selekcję bez potwierdzenia i bez restore fokusa (`excelModal.js:416-418,502-507`).
15. Dwa znaczenia Shift+klik (wiersze vs komórki, `excelModal.js:17-27`) — nieudokumentowane w skrótach.
16. Paste-quiet tłumi podsumowanie batch (`excelChangeHandlers.js:39-43`).
17. Podwójna notyfikacja clamp (toast + modal, `solverValidation.js:424-432,387-419`).
18. Odrzut undo N>100 bez Ctrl+Z, tylko throttled toast (`excelUndo.js:86-91,108-112`).
19. Virtual: `colCount` z `tr:nth-child(2)` kruche przy ukrytych kolumnach; uproszczony empty-row gubi PRZ (`excelVirtual.js:572-577,631-633`); `removeEventListener` nie trafia w debounced handler (`:822-830`); podwójne `_excelRefreshDupColors` (poll + debounce).
20. Selektor `tr[data-widx]` globalny, nie w kontenerze (`excelCellSelection.js:169,300`) — kolizja przy 2 tabelach.
21. Preview drag tylko `mode==='new'` (`:172`) — Ctrl+drag bez podglądu.
22. Stale status bez `configSource` (`solverValidation.js:317-323`).

## 5. Dobre zachowania do zachowania

Pkt 3 +: gate `validatePrzejsciaForSave`, `shouldClose=false` przy fail, open-snapshot restore, guardy PZ (`_excelGuardWellLocked`), `_excelSnapshot/RestoreLockedWells`, `USE_PATCH_UNDO` fallback, kolejność skryptów, SSoT filtrów i indeksów.

## 6. Ograniczenia techniczne

- `colIdx===3` (nazwa) nigdy delete/cut/fill; `STICKY_COLS=7`; `table-layout` tylko z parity/bench; brak zmiany kolejności HTML/ID/klas/`data-*`; logika cen/solvera/DB/API nietknięta.

## 7. Proponowane poprawki

- **Pakiet S (auto, 8× A1–A8):** guardy INPUT dla Ctrl+A/Ctrl+F; `statusTitle` nie nadpisywany; snapshot po walidacji (nie przed); early-return pustej nazwy przed dirty; debounce `excelCreateFromEmpty` (flaga w trakcie); limit pętli rAF + pomiar po h1; batch summary po range-select.
- **Pakiet M (po GO, wg decyzji):** B9–B22 pojedynczo, każdy z testem regresyjnym + E2E + screenshoty.

## 8. Pliki do zmian (szacunek)

- S: `excelCellNavigation.js`, `excelTableBody.js`, `excelChangeHandlers.js`, `excelWellActions.js`, `excelTableRenderer.js`, `excelCellSelection.js`.
- M: + `excelColumnResize.js`, `excelModal.js`, `excelVirtual.js`, `excelShortcuts.js`, `solverValidation.js`, `excelUndo.js`, CSS sticky/header.

## 9. Ryzyka regresji

- Selekcja: 3 rozłączne modele + summary (`cols>0` ignoruje cells) — każda zmiana summary psuje Ctrl+A/copy.
- Render: `innerHTML` wipe + restore focus/scroll — regresja = gubiony fokus (błąd #33).
- Virtual vs legacy dual-path — poprawka w jednym torze rozjeżdża parity (`excelVirtualParity`).
- Paste/undo stack — snapshoty per handler; zmiana kolejności = utrata cofania (błąd #29).
- PZ-locked wells — mutacje zablokowanych = cichy błąd danych.

## 10. Strategia testów

- Unit (vm z prawdziwych plików): guardy klawiatury, kolejność snapshot/walidacja, debounce create, merge tytułów, batch summary.
- Istniejące: `excelUndoLifecycle`, `excelDrilledRings`, parity/bench virtual, theme tokens, D1/D2, relief pair, paste invariants.
- E2E (wybrane): align pustego wiersza, relief pair, smoke oferty. Axe critical bez zmian.
- Luki do załatania przy okazji: brak `*save*.test.ts` (excelSaveAll), brak testu `draft × _excelDirty`, brak testu podwójnego clamp.

## 11. CZEGO NIE ZMIENIAĆ

Logiki biznesowej/cen/solvera/semantyki zapisu; modelu DB; kontraktów API; kolejności kolumn i HTML; ID/klas/`onclick`/`data-*`; modelu danych; SSoT z pkt 3; kanonu h1/STICKY_COLS=7; kluczy LS; kill-switcha virtual; semantyki skrótów (bez GO); zachowania Ctrl+X pass-through; cursor-na-koniec (#33).
