# Znane błędy — Oferty_PV

## 1. Seed timeout na Render (productsStudnie)

**Problem**: 824 produktów × 35 pól = 28k wartości w jednej `$transaction` timeoutuje.
**Objaw**: `Operations timed out after N/A` — SQLite busy_timeout (5000ms default).
**Kontekst**: Render Persistent Disk (sieciowy) + SQLite 1 writer = wolne zapisy.

**Fix** (v2, `2418394`):

- chunk 25 produktów na transakcję (33 transakcje zamiast 1)
- `PRAGMA busy_timeout = 30000` w prismaClient.ts
- sekwencyjne init: rury → studnie → admin → listen

**Powiązane**: productsRury (94 prod) działa z timeout 120s.

## 2. Concurrent IIFE race condition

**Problem**: IIFE w `productsV2.ts` i `productsStudnieV2.ts` startowały równolegle przy `import`.
**Objaw**: SQLITE_BUSY — obie transakcje walczą o write lock.
**Fix** (`2418394`): IIFE → wyeksportowane funkcje, `server.ts` `await` sekwencyjnie.

## 3. XSS w innerHTML

**Problem**: Stringi użytkownika w `innerHTML` bez `escapeHtml()`.
**Objaw**: Podatność na XSS przy nazwach produktów/ofert.
**Fix** (`6cf8871`): zawsze `escapeHtml(str)` przy interpolacji HTML.

## 4. Kalkulator comma/dot (calcInput.ts)

**Problem**: Użytkownicy wprowadzają przecinek `,` zamiast kropki `.`.
**Objaw**: `safeEval()` zwraca NaN.
**Fix** (`9858c6f`): `value.replace(',', '.')` przed parsowaniem.

## 5. PEHD button — duplikacja stylów

**Problem**: `style="color:var(--warn)"` + `.pehd-btn { color:var(--warn) }` na tym samym elemencie.
**Objaw**: Konflikt CSS, zależnie od specyficzności.
**Fix** (`d08e8fc`): usunięto inline style, CSS klasa `pehd-btn` kontroluje wszystko.

## 6. isLocked TDZ (Temporal Dead Zone)

**Problem**: Zmienna `isLocked` używana przed deklaracją w `offerItems.js`.
**Objaw**: `ReferenceError: Cannot access 'isLocked' before initialization`.
**Fix** (`16a86d8`): hoist deklaracji przed użyciem.

## 7. colspan 13→15 w trybie porównania

**Problem**: Tabela ma 13 kolumn standard, 15 w trybie porównania — brak dynamicznego colspan.
**Objaw**: Tabela się rozjeżdża.
**Fix** (`16a86d8`): dynamiczny colspan w `updateRuryOrderSummary`.

## 8. toggleAllItemsForOrder guard

**Problem**: Brak sprawdzenia `data-uid` przed toggle.
**Objaw**: `TypeError: Cannot read properties of null`.
**Fix** (`16a86d8`): dodano guard `if (checkbox)`.

## 9. N+1 queries (Prisma)

**Problem**: Pętla `for` z `findUnique` wewnątrz zamiast batch `findMany` + Map lookup.
**Objaw**: Wolne endpointy, dużo SQLite queries.
**Fix** (`1bd859c`): Map lookup + `findMany` z `{ in: [...] }`.

## 10. Null guards na DOM queries

**Problem**: `document.querySelector()` zwraca null, brak sprawdzenia przed `.addEventListener`.
**Objaw**: `TypeError: Cannot read properties of null`.
**Fix** (`18a76b9`): `if (el) el.addEventListener(...)`.

## 11. Audit log cleanup timeout

**Problem**: `audit_logs.deleteMany` dla starych rekordów timeoutuje (dużo danych).
**Objaw**: `Operations timed out`.
**Fix** (planowany): chunkowane `deleteMany` z limitem + indeks na `createdAt`.

## 12. ensureAdminExists timeout

**Problem**: ensureAdminExists uruchamiany równolegle z seed produktów → SQLite busy.
**Objaw**: `Operations timed out after N/A`.
**Fix** (`2418394`): sekwencyjne init — produkty → admin → listen.

## 13. CSP violation z 'unsafe-inline'

**Problem**: Helmet CSP blokuje inline event handlers (`onclick="..."`).
**Fix** (`server.ts`): `scriptSrc: ["'self'", "'unsafe-inline'"]`.
**Uwaga**: Konieczne dla vanilla JS legacy patternów. Docelowo: migracja do `addEventListener`.

## 14. Spinner w input[type=number]

**Problem**: Chrome/FF pokazuje strzałki increment/decrement na polach liczbowych.
**Objaw**: Szpeci UI, user może przypadkowo zmienić wartość.
**Fix** (`style.css`): `::-webkit-inner-spin-button { appearance: none }` + `-moz-appearance: textfield`.

## 15. sort() mutacja oryginalnej tablicy

**Problem**: `.sort()` w JS jest in-place — mutuje oryginalną tablicę.
**Objaw**: Kolejność `products` zmienia się po renderowaniu.
**Fix** (`1bd859c`): `[...array].sort(...)` — kopia przed sortowaniem.

## 16. Wyrównanie kolumn w pustym wierszu Excel

**Problem**: 5 gołych `<select disabled>` w pustym wierszu vs `_excelOverlaySelectHtml` w wierszach danych — różnica w box modelu / intrinsic sizing powoduje przesunięcie sticky kolumn.
**Objaw**: Rozjeżdżanie się kolumn w Excel Table Manager w pustym wierszu.
**Fix** (v1.5.0): Używać `_excelOverlaySelectHtml(productId, null, null, null, null, true)` dla wyłączonych selectów w pustym wierszu oraz CSS `.excel-sel-wrap.disabled`.

## 17. Scroll poziomy kryje aktywną komórkę (Excel)

**Problem**: Brak korekty `scrollLeft` w `_excelFocusNavEl` przy nawigacji strzałkami — aktywne pole chowało się pod zablokowanymi/sticky kolumnami (Lp, Nazwa, DN).
**Objaw**: Nawigacja strzałkami do komórki poza widocznym obszarem pozostawia focus pod sticky kolumnami.
**Fix** (`9cc5956`): Pomiar szerokości kolumn sticky (`_excelGetStickyColumnsWidth`) i korekta pozioma scrolla w `_excelFocusNavEl`.

## 18. Delete/Ctrl+X czyści złą komórkę (Excel)

**Problem**: Czyszczenie oparte o indeks z listy inputów w wierszu zamiast o indeks komórki TD — przy różnej liczbie edytowalnych elementów w komórkach czyściło sąsiednie pole.
**Objaw**: Delete/Ctrl+X na jednej komórce czyści wartość w innej (sąsiedniej).
**Fix** (`cbd2f02`): Indeksować komórki przez TD (`tr.children[indexOf(td)]`), czyścić przez `_excelSetCellValue(target, '')` i zapisywać `wIdx` z `data-widx`.

## 19. Nawigacja wchodzi w ukryte wiersze (Excel)

**Problem**: Filtr wyszukiwarki ukrywa wiersze przez `display:none`, ale nawigacja strzałkami (góra/dół) trafiała również w ukryte wiersze.
**Objaw**: Strzałki przenoszą focus do wierszy niewidocznych po przefiltrowaniu listy studni.
**Fix** (`cbd2f02`): Filtrować wiersze docelowe przez `r.style.display !== 'none'` (także w `_excelHandleEmptyRowArrow`); nawigacja pionowa przekazuje `_excelFocusNavEl` listę elementów wiersza docelowego (`_excelGetNavElements`). Ta sama zasada w copy/paste (`_excelGetVisibleRows` w `excelCopyPaste.js`) — kopiowanie/wklejanie pomija wiersze ukryte filtrem.

## 20. Duplikacja kręgów krag/krag_ot (Excel)

**Problem**: W bloku konwersji `excelOnCompChange` sumowano `totalQty = totalExistingQty + newQty` zamiast zastąpienia; filtr usuwał tylko wpisany typ, zostawiając bratni typ (krag/krag_ot) o tym samym dn+height.
**Objaw**: Wpisanie w Excelu kręgu z otworem (`krag_ot`) w studni bez otworu dodaje DWA kręgi zamiast zamiany na zwykły krąg (`krag`) — analogicznie dla zwykłego kręgu.
**Fix** (`74e9f49`, doprecyzowane; przywrócone po regresji z `ee41c0c`): Filtr w `excelOnCompChange` usuwa **tylko wpisany typ** (`krag` LUB `krag_ot`) o danym dn+height — bez sumowania `totalExistingQty + newQty`. Krąg bratni zostaje nietknięty. Następnie wstawiany jest element wpisanego typu z ilością = wpisana (`newQty`), a finalny typ (krag vs krag_ot) ustala `enforceOtRings()` (`diagramOtRings.js`) wg geometrii otworów. Test regresyjny: `tests/studnie/excelDrilledRings.test.ts`.

> **Regresja `ee41c0c`**: eksperyment z usuwaniem OBA typów (`isRingType`) złamał realny przypadek — przy 3 kręgach zwykłych + 1 wierconym wpisanie `3` w kolumnę `krag` kasowało krąg wiercony (wynik 4 zamiast 3+1). Semantyka sibling-preserving jest właściwa: kolumny `krag`/`krag_ot` są niezależne, wpisanie w jedną nie rusza drugiej.

> **Uwaga (katalog/seed):** `krag_ot` nie występuje w katalogu dla H250 (`data/seed_studnie.json`) — konwersja krag↔krag_ot dla wysokości 250 nie ma produktu docelowego w seedzie (dostępne wysokości krag_ot: 500/750/1000).

## 21. Brak odświeżenia komórek krag/krag_ot po konwersji (Excel)

**Problem**: `_excelMarkManual(well)` (pełny `_excelRenderTable`) był wywoływany PRZED blokiem konwersji krag↔krag_ot w `excelOnCompChange` (`public/js/studnie/excelChangeHandlers.js`); po konwersji następowały tylko `_excelRefreshAutoCells` (nie obejmuje inputów kręgów) i `_excelDebouncedRefresh` (aktualizuje diagram, nie tabelę).
**Objaw**: Wpisanie ilości kręgu w Excelu poprawnie konwertuje typ w configu (np. `krag_ot` → `krag`), ale komórki w tabeli nadal pokazują starą wartość/typ — odświeżają się dopiero po wpisaniu innego kręgu.
**Fix** (`74e9f49`, `excelChangeHandlers.js`): przeniesiono `_excelMarkManual(well)` PO blok konwersji — pełny re-render (`_excelRenderTable`) pokazuje finalny config (`krag=0`, `krag_ot=N`) natychmiast.

**Odróżnienie od #20:** #20 = duplikacja kręgów (sumowanie `totalExistingQty + newQty` zostawiało bratni typ w tabeli — błąd logiki konwersji); #21 = brak odświeżenia widoku PO poprawnej konwersji (błąd kolejności re-renderu).

## 22. Edycja rzędnej i auto-dobór w Excelu nie ustawiały flagi niezapisanych zmian

**Problem**: `_excelDirty` był ustawiany wyłącznie przez `_excelDebouncedRefresh()` (excelPolling.js:84). `excelOnRzednaChange` (excelChangeHandlers.js) nie wołał żadnego refreshu, a `_excelAutoSelectForWell` / `_excelRunAutoSelectForWell` (excelAutoSelect.js) nadpisywały `well.config` bez flagi — przycisk Run (▶) i edycja rzędnych były całkowicie poza mechanizmem dirty.
**Objaw**: `closeExcelTableModal()` nie pokazywało popupu "Niezapisane zmiany" po edycji rzędnej lub auto-doborze z Excela.
**Fix** (`5db8dd3`): `_excelMarkDirty()` w warstwie modala (caller): `excelOnRzednaChange` (po `well.rzednaDna = rzDna;`) oraz na początku `try` w `_excelAutoSelectForWell` i `_excelRunAutoSelectForWell` (przed `await autoSelectComponents`). Nigdy w solverze `autoSelectComponents` (współdzielony z głównym panelem). Dodatkowo dirty w `_excelToggleWellAutoMode`, `_excelBulkSetMode`, `_excelUndo`/`_excelRedo`. Paste/Delete na rzędnych pokryte przez `_excelSetCellValue` (dispatch `change` → inline `onchange`). Przy okazji usunięto martwe `_excelMarkClean`, `_excelGetWellConfigHash`, `_excelGetColumnStructureHash` (excelHelpers.js) i `_excelEnsureRowCount` (excelTabs.js).

## 23. Podwójne zamknięcie modala Excel (race condition przy dirty) i rekurencja Zapisz→Zamknij

**Problem**: `closeExcelTableModal()` był asynchroniczny (dialog `appConfirm`). Podwójne Esc / podwójne kliknięcie ✕ przy `_excelDirty=true` otwierało dwa nakładające się dialogy — możliwy podwójny `excelSaveAll()` lub wyciek nierozwiązanego Promise. Dodatkowo `excelSaveAll()` sam wołał `closeExcelTableModal()`, tworząc kruche sprzężenie "Zapisz i zamknij" → `excelSaveAll` → rekurencyjne zamknięcie.
**Objaw**: Migający przycisk "Zapisywanie...", podwójny `refreshAll`, podwójny toast przy próbie zapisu i zamknięcia z popupu "Niezapisane zmiany".
**Fix**: Wydzielono `_excelCloseOverlay()` (fizyczne zamknięcie overlayu) i dodano guard `_excelClosing` w `closeExcelTableModal()` (`excelModal.js`). `excelSaveAll()` woła `_excelCloseOverlay()` zamiast `closeExcelTableModal()` (`excelWellActions.js`) — koniec rekurencji.
