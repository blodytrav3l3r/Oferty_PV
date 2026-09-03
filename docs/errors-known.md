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
**Fix** (`style.base.css`): `::-webkit-inner-spin-button { appearance: none }` + `-moz-appearance: textfield`.

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

## 24. Duplikaty telemetrii AUTO_JS (ten sam snapshot studni)

**Problem**: Każdy render solvera zapisywał nowy rekord `ai_telemetry_logs` nawet dla identycznej konfiguracji — baza puchła od powtórek, `usageCount` nie odzwierciedlał rzeczywistego użycia.
**Objaw**: Setki rekordów o identycznym `featureSnapshot` dla jednej studni; zafałszowane statystyki wzorców.
**Fix** (`c905934`): deduplikacja w `telemetryService.ts` — dla źródła `AUTO_JS` przed INSERT liczona jest kanoniczna para kluczy (`_canonicalize` rekurencyjnie sortuje klucze JSON, `_dedupKey` = kanoniczny `featureSnapshot` + `||` + posortowane `allComponentIds`). Identyczny klucz → UPDATE istniejącego rekordu (inkrementacja `usageCount`, odświeżenie `lastUsedAt`, aktualizacja `offerId`/`clientId`/`projectId`/`warehouse`). Źródła `MANUAL`/`AI_SUGGEST` zawsze tworzą nowy rekord. Testy: describe „telemetryService - deduplikacja AUTO_JS" w `tests/telemetryRoutes.test.ts` (6 testów).

## 25. Pełne skanowanie ai_telemetry_logs przy dedup (brak indeksów)

**Problem**: Dedup AUTO_JS wymaga wyszukania najnowszego rekordu po `(wellId, solverSource)` — bez indeksu SQLite wykonywał pełny skan tabeli przy każdym zapisie.
**Objaw**: Rosnący czas zapisu telemetrii wraz z rozmiarem tabeli (O(n) na rekord).
**Fix** (`fe1679f`): migracja `20260805100000_telemetry_well_dedup` dodaje indeksy `idx_logs_well` (`wellId`) i `idx_logs_source_well` (`solverSource, wellId`). Auto-heal: `src/app.ts` tworzy indeksy idempotentnie (`CREATE INDEX IF NOT EXISTS`) przy starcie, a `scripts/check-db.js` wymienia je w `REQUIRED_INDEXES` i ostrzega przed brakiem.

## 26. Brak indeksu FTS5 (full-text search) po aktualizacji

**Problem**: Wyszukiwarka produktów oparta o FTS5 wymaga wirtualnej tabeli i indeksu; bazy przed migracją nie miały wymaganego schematu FTS5.
**Objaw**: Błędy wyszukiwania lub powolne zapytania LIKE po aktualizacji istniejącej instalacji.
**Fix** (`fe1679f`): `ensureFts5Schema` (`src/utils/fts5Sync.ts`) uruchamiane przy starcie serwera (`src/app.ts`) — idempotentne tworzenie/uzupełnianie schematu FTS5 z backfillem danych.

## 27. Rzędna przejścia jako string zamiast liczby (Excel)

**Problem**: `excelOnPrzejscieChange` zapisywał `rzednaWlaczenia` jako surowy `value` z inputa (string) — `'10'` trafiało do configu jako tekst.
**Objaw**: Zepsute porównania numeryczne (`>=`, `!== 0`), sortowanie i renderowanie.
**Fix**: Konwersja do liczby z obsługą przecinka: `field === 'rzednaWlaczenia' ? (value !== '' && !isNaN(parseFloat(String(value).replace(',', '.'))) ? parseFloat(...) : null) : value`. Rzędna w configu studni jest zawsze **liczbą lub `null`**, nigdy stringiem (excelChangeHandlers.js).

## 28. `p.kat` zamiast `p.angle` — kasowanie kolumny przejścia z ustawionym samym kątem (Excel)

**Problem**: Właściwe pole kąta nazywa się `angle` (ang.), a `excelRemoveTransitionColumn()` i `_excelCleanEmptyPrzejscia()` sprawdzały nieistniejącą właściwość `p.kat`.
**Objaw**: Kolumna z samym kątem (bez produktu/rzędnej) wyglądała na pustą i była usuwana.
**Fix**: Sprawdzać `(p.angle && p.angle !== 0)` obok `productId` i `rzednaWlaczenia` w obu miejscach. Uwaga: w logice przejść używaj `angle`/`angleExecution`/`angleGony` — `kat` nie istnieje.

## 29. Brak snapshotów undo dla części mutacji + przepełnienie stacku przy wklejaniu (Excel)

**Problem**: `_excelSaveUndoSnapshot()` wołano tylko w `excelOnCompChange` i wklejaniu — zmiany rzędnej, przejść, typu przejścia, kinety i psiej budy nie były cofalne. Przy wklejaniu wielokomórkowym snapshot per komórka przepełniał stack (limit `_EXCEL_UNDO_LIMIT = 20`).
**Objaw**: Ctrl+Z bez efektu dla części mutacji; Ctrl+Z nie cofał wklejenia.
**Fix**: Snapshot na początku **każdego** mutującego handlera (`excelOnRzednaChange`, `excelOnWlazChange`, `excelOnPrzejscieChange`, `excelOnPrzejscieTypeChange`, `excelOnKinetaChange`, `excelOnPsiaBudaChange`, `excelOnReductionSelectChange`). Wklejanie: **jeden** snapshot w `_excelHandlePaste` + flaga `_excelPasteInProgress` — handler pomija snapshot gdy flaga ustawiona. Fill (Ctrl+Enter) i duplikacja (Ctrl+D) także robią **jeden** snapshot. Batch (>100 wierszy) resetuje flagę w `doneCallback`, nie w `finally`.

## 30. Shadowing `_excelSyncAutoManualUI` — realna synchronizacja nigdy nie działała (Excel)

**Problem**: Wrapper nadpisujący `window._excelSyncAutoManualUI` wołał wewnątrz globalną (już nadpisaną) funkcję o tej samej nazwie — przy `_inProgress = true` następował early-return i oryginał z `excelPolling.js` nigdy się nie wykonywał.
**Objaw**: Synchronizacja AUTO/MANUAL z głównego panelu nie działała.
**Fix**: Przechwycić oryginał **przed** nadpisaniem: `const _excelSyncAutoManualUIReal = _excelSyncAutoManualUI;` i wołać `_excelSyncAutoManualUIReal()` wewnątrz wrappera (excelTableManager.js). Kolejność ładowania: `excelPolling.js` PRZED `excelTableManager.js`.

## 31. Tła sticky nieaktualizowane przy duplikatach nazw (Excel)

**Problem**: `_excelRefreshDupColors()` ustawiał `row.style.background`, ale kolumny sticky (pierwsze 7 td: Lp, nazwa, rzędne) mają osobne tło z `_excelStickyCellBg()` — część wiersza zostawała w starej barwie.
**Objaw**: Wiersze z duplikatami nazw miały niespójne tło.
**Fix**: Po zmianie tła wiersza zaktualizuj komórki sticky: `row.querySelectorAll('td:nth-child(-n+7)').forEach(td => td.style.background = _excelStickyCellBg(rowBg, solidBg))`.

## 32. Wyjątek w `excelSaveAll` blokował modal na stałe (Excel)

**Problem**: `_excelCloseOverlay()` wołany po `refreshAll()` — jeśli `refreshAll()` rzucił wyjątek, overlay nie był zamykany, a guard `_excelClosing` zostawał `true` na stałe.
**Objaw**: Kolejne otwarcia modala kończyły się early-return (modal nieodwracalnie zablokowany).
**Fix**: `try { ... } catch { toast błędu } finally { _excelCloseOverlay(); }` — overlay zawsze usuwany, guard resetowany (excelWellActions.js).

## 33. `select()` po re-renderze uniemożliwiał wpisanie wielocyfrowej ilości (Excel)

**Problem**: Restore fokusa po `_excelRenderTable` używał `restoreEl.select()` — zaznaczenie całej wartości powodowało, że kolejny klawisz zastępował całość.
**Objaw**: Wpisanie „12" dawało „2".
**Fix**: Kursor na koniec zamiast zaznaczenia: `restoreEl.setSelectionRange(len, len)` (excelTableRenderer.js). Powiązane z #21 — bezwarunkowy pełny re-render potęgował objaw.

## 34. Mojibake (podwójne kodowanie UTF-8) w plikach źródłowych

**Problem**: Polskie znaki UTF-8 zapisane ponownie przez edytor/narzędzie interpretujące CP1250/Windows-1250 (np. `Ć` C4 86 → C3 84 E2 80 A0). Bajty są poprawnym UTF-8, więc dotychczasowa walidacja (sekwencje/BOM/ASCII) ich nie wykrywała.
**Objaw**: Zniekształcone polskie znaki w kodzie i dokumentacji.
**Fix**: `scripts/encoding-integrity.js` ma warstwę semantyczną `detectMojibake`/`fixMojibake` (mapa sygnatur CP1250/CP1252, wykrywanie par/tripletów). Polityka: `public/`/`src/`/`docs/`/`tests/`/`scripts/`/`prisma/` → ERROR; `npm run encoding:fix` naprawia automatycznie. Trzy warstwy guarda: lint-staged (pre-commit) → pre-push → CI. Test regresyjny: `tests/encodingMojibake.test.ts`.

## 35. `typecheck:frontend` TS2339 na `event.target.classList`/`dataset` (zlecenia)

**Problem**: Przy delegacji zdarzeń `event.target` ma typ `EventTarget`, który nie posiada `classList`/`dataset` — TS2339 w `zlecenia.js:375,378`. Blokował `npm run typecheck:frontend` (pre-push/`validate`).
**Objaw**: Błędy typowania w checku frontendowym.
**Fix**: Guard typowania: `if (!(target instanceof HTMLElement) || !target.classList.contains(...)) return;` przed dostępem do `classList`/`dataset`. W testach vm/jsdom bez okna używać `target && target.dataset` z optional chaining.

## 36. Batch-delete 400 przy >200 zaznaczonych (zlecenia)

**Problem**: Endpoint `POST /batch-delete` ma limit 200 ids/request (ochrona payloadu + rate limiter 60/min); zaznaczenie wszystkich wierszy (tri-state `all`) przekraczało limit → 400.
**Objaw**: Batch-delete wszystkich wierszy kończył się błędem 400.
**Fix**: Frontend `deleteSelectedOrders` chunkuje ids po 200 i wysyła sekwencyjnie (z `await`), zlicza `{ deleted, skipped }` i pokazuje toast „Usunięto X, pominięto Y". Nie podnosić limitu serwera.

## 37. Sentinel infinite scroll odpala eager-load w pętli (zlecenia)

**Problem**: Po dodaniu kontenera scrolla (`.zlecenia-table-container`, `height: min(480px, 60vh)`) sentinel bez `root: kontener` w `IntersectionObserver` jest zawsze w viewport (kontener 480px < iframe) → doładowywanie w pętli aż do `MAX_LOADED`.
**Objaw**: Eager-load wszystkich stron przy otwarciu listy zleceń.
**Fix**: `new IntersectionObserver(cb, { root: kontener, rootMargin: '300px 0px' })` — sentinel przeniesiony do środka kontenera (za `</table>`); bez tego eager-load w pętli. Sticky `th` z nieprzezroczystym tłem `var(--bg-card)`.

## 38. Cursor paginacji mieszał surowe/znormalizowane createdAt (zlecenia)

**Problem**: Klauzula kursora (`productionSearchUtils.ts:64-71`) porównywała **surowe** `createdAt` z kursorem ze **znormalizowanej** wartości SELECT → przy danych mieszanych (epoch-ms legacy + ISO) pomijała/duplikowała wiersze.
**Objaw**: Pomijane lub duplikowane wiersze przy paginacji nieskończonej.
**Fix**: Używać `normalizedCreatedAtSql()` w gałęzi `cursor && cursorId` — porównanie zawsze na znormalizowanej wartości, spójnej z SELECT.

## 39. `escapeHtml` nie escapuje `"` w atrybutach HTML

**Problem**: `escapeHtml` (wzorzec z #3) nie zamienia `"`, więc interpolacja do atrybutów (`aria-label`, `title` itd.) przez `escapeHtml` jest podatna na iniekcję atrybutu — cudzysłów może zamknąć atrybut.
**Objaw**: Potencjalna iniekcja atrybutu przy interpolacji danych do `aria-label`/`title`.
**Fix**: W atrybutach używać `escapeJsStr` (jest w `zleceniaHelpers.js`) lub istniejącego `escapeHtmlAttr` — nigdy `escapeHtml` dla kontekstu atrybutu; `escapeHtml` tylko dla treści tekstowej (innerHTML).

## 40. Ownership legacy NULL — nie-admin nadpisywał rekordy bez właściciela

**Problem**: `canWriteDoc` zwracał `true` także dla rekordu z `docUserId = null` (legacy rekord bez właściciela) — nie-admin mógł nadpisać cudzy/czyj legacy rekord.
**Objaw**: A-…: brak własności = brak prawa zapisu; IDOR na legacy danych.
**Fix** (`9ff2254`): `canWriteDoc` (i `canReadDoc`) zwracają `false` dla `docUserId = null` u nie-admina (`src/utils/ownership.ts`); guardy w zamówieniach na surowym `old.userId` przed fallbackiem.

## 41. Rekurencja escapa w globalnych deklaracjach (regresja)

**Problem**: Guard `typeof window.x === 'function'` w globalnych deklaracjach wywoływał sam siebie — globalna funkcja tworzy `window.x`, więc warunek był zawsze prawdziwy.
**Objaw**: Stack overflow (RangeError) przy każdym wywołaniu `escapeHtmlAttr`/`escapeJsStr`.
**Fix** (`78b88ee`): identity-check `window.x !== x` — delegacja do centralnej tylko gdy `window.x` jest **inną** funkcją. Regresja wykryta przez E2E alignment.

## 42. Atomowy claim numeru rur + writeLock (TOCTOU)

**Problem**: Claim numeru zamówienia rur robiony read-then-write — dwie równoczesne operacje mogły dostać ten sam numer (race condition TOCTOU).
**Objaw**: Zduplikowane numery zamówień rur przy współbieżnym zapisie.
**Fix** (`2f6f05b`, `fc4d027`): claim przez **atomic increment** (wzorzec `numbering.ts`); blokada zapisu przez `src/middleware/writeLock.ts` (`createModuleLock()` → `{ acquireLock, runWithLock }`) — per-klucz, timeout 30 s, mutual exclusion, zastosowana w 4 trasach zapisu cenników. DRY: wzorzec locka (acquire + 429 + finally release) wydzielony do helpera.

## 43. Feature flags POST /audit bez requireAdmin

**Problem**: `POST /audit` (i wpisy audytu) dostępny dla każdego zalogowanego użytkownika — możliwość poisoning logów audytu.
**Objaw**: A-17: zwykły user mógł pisać dowolny wpis audytu.
**Fix** (`621dbb2`): `requireAdmin` na trasach zapisu; `driftPct` catch loguje warn zamiast cichego null. Testy featureFlags (403/200/400/GET).

## 44. Silent fail w telemetrii i ML

**Problem**: Wyjątki w pipeline ML/telemetrii były połykane po cichu: nieznana akcja dawała `reward=0`, GET studnie order ciche 404, uszkodzony JSON w ModelRegistry pomijany, kursor `resyncLabels` pomijał rekordy o równych timestampach.
**Objaw**: Błędne metryki, brak sygnału błędu, utracone rekordy telemetrii.
**Fix** (`1e3b0c9`, `05fc0ab`): nieznana akcja rzuca zamiast cichego reward=0; GET studnie order zwraca 500 z logiem; `loadOrdersStudnie` rzuca przy `!res.ok`; `updateLabelByTelemetry` loguje warn gdy count=0; ModelRegistry loguje uszkodzony JSON; `resyncLabels` kursor po `(createdAt, id)`; dedup `AUTO_JS` pod module lockiem (TOCTOU). Testy: studnieOrdersError, orderHelpersError, rewardDedup, restoreRoundtrip.

## 45. Okno niespójności dual-write w `saveDefaults()`

**Problem**: Zapis domyślnych cenników dwufazowy (plik JSON `data/price_defaults.json` → transakcja DB `*_Default`): upadek transakcji = plik nowszy niż baza (niespójność do restartu); dodatkowo `settings.upsert` (timestamp) poza transakcją.
**Objaw**: Crash/ błąd walidacji między zapisem pliku a commitem DB — plik i baza rozjechane; timestamp poza all-or-nothing.
**Fix** (`commit kompensacji`): `saveDefaults()` przechwytuje poprzednią treść pliku, na błąd transakcji rollback pliku (lub `rmSync` gdy brak oldContent); `settings.upsert` przeniesiony DO `$transaction` (plik+`*_Default`+timestamp all-or-nothing). Crash po zapisie pliku pokrywa startowy `restoreDefaultsFromJson()`.

## 46. XSS przy edytowalnych nazwach produktów (odpowiednik AGENTS #24)

**Problem**: `p.name` (nazwa produktu edytowalna przez użytkownika) interpolowana do `innerHTML` bez `escapeHtml()` (`offerWellComponents.js`, `wellUI.js` — `wellOrder.orderNumber`, `wellOrder.id`).
**Objaw**: XSS przez pola edytowalne (nazwy produktów, numery zamówień).
**Fix**: `escapeHtml()` przy KAŻDEJ interpolacji danych użytkownika do `innerHTML`; przy przeglądzie kodu szukaj interpolacji pól edytowalnych bez escapowania (rozszerzenie ogólnej reguły z #3).

## 47. Brak walidacji dat w wyszukiwarce (odpowiednik AGENTS #26)

**Problem**: `dateFrom`/`dateTo` w `src/utils/searchUtils.ts` przyjmowały dowolne ciągi — nieprawidłowy format przechodził do zapytań Prisma.
**Objaw**: Błędy zapytań lub mylące wyniki wyszukiwania.
**Fix**: Walidacja formatu ISO dla `dateFrom`/`dateTo` przed zbudowaniem filtra; nieprawidłowe wartości odrzucane (zapytanie wykonuje się bez filtra dat).

## 48. Map produktów studni nieaktualna po bezpośrednim przypisaniu (odpowiednik AGENTS #46)

**Problem**: `studnieProductsById Map` rebuildowana tylko w setterze `window.studnieProducts` (`globals.js`); bezpośrednie przypisanie (`studnieProducts = ...`) omijało rebuild → pusta Map → `getStudnieProductById` zwracał `null` (pusta lista, cena 0, brak przejść). Dodatkowo błąd precedence `?.componentType` zwracał obiekt zamiast boolean.
**Objaw**: Pusta lista produktów, cena 0, brak przejść w diagramie.
**Fix**: Hybryda: jawny kontrakt `window.studnieProducts =` + lazy `size` detector + `find` fallback w `getStudnieProductById`; formalny `__assertStudnieMapFresh()`; poprawka nawiasów przy `resolve(...)?.componentType === 'wlaz'`. Test: `globalsMapStale.test.ts`.
