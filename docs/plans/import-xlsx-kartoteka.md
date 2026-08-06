# Implementation Plan: Przycisk "Import XLSX" w kartotece ofert

> **Stan: ZREALIZOWANE (commit 10b213e).** Przycisk "Import XLSX (zewn.)" i metoda showImportXlsxDialog() w public/js/sales/pvImportExportToolbar.js. Treść ponizżej zachowana jako dokumentacja procesu.

## Overview

Dodanie przycisku "Import XLSX (zewn.)" w toolbarze Import/Eksport kartoteki ofert (`kartoteka.html`). Cała logika importu XLSX (parser `XlsxImportShared.parseExternalXlsx`, import rur `RuryExternalImport.import`, import studni `StudnieExternalImport.import`, modal konfliktu `ConflictModal`) już istnieje i jest załadowana w `kartoteka.html:463-474` — brakuje wyłącznie warstwy UI w `pvImportExportToolbar.js`. Zakres ograniczony do jednego pliku; bez nowych plików, bez zmian HTML.

## Requirements

- Przycisk "Import XLSX (zewn.)" w toolbarze (obok istniejących 3 przycisków).
- Wybór modułu (Rury / Studnie) — wzorzec `_moduleTypeHtml` jak w eksporcie.
- Wybór pliku `.xlsx` — wzorzec file input z `showImportJsonDialog`.
- Import wielu ofert z jednego pliku (grupowanie po NUMER_OFERTY już w parserze).
- Obsługa konfliktu numeru przez istniejący `ConflictModal` (wewnątrz `*.externalImport.import()`).
- Komunikaty po polsku przez `showToast(msg, type)` (dostępne w `js/shared/ui.js:69`).
- Odświeżenie listy ofert po imporcie (`pvSalesUI.loadLocalOffers()`).
- Brak modyfikacji plików rdzenia: `offerCrud.js`, `offerManager.js`, `offerItems.js`, `wizard.js`, `router.js`.

## Architecture Changes

- **Jedyny edytowany plik:** `public/js/sales/pvImportExportToolbar.js` (`window.PvImportExportToolbar`).
- Nowa metoda `showImportXlsxDialog()` + przycisk + handler w `init()`. Reuse: `_createModal`, `_moduleTypeHtml`, `_closeModal`, `XlsxImportShared`, `RuryExternalImport`, `StudnieExternalImport`, `ConflictModal`, `showToast`, `pvSalesUI.loadLocalOffers`.
- HTML `kartoteka.html` — bez zmian (host `#ie-toolbar-host` w linii 392, skrypty w 463-474).

## Implementation Steps

### Phase 1: Przycisk w toolbarze

1. **Dodaj przycisk HTML** (File: `public/js/sales/pvImportExportToolbar.js:20`)
    - Action: w stringu `host.innerHTML` (linie 15-21) dodać po `ie-btn-import-json` (linia 20) kolejny wiersz:
      `<button class="btn btn-sm btn-secondary" id="ie-btn-import-xlsx"><i data-lucide="file-up" style="width:14px;height:14px;"></i>Import XLSX (zewn.)</button>`
    - Why: jeden przycisk dla obu modułów — wybór Rury/Studnie odbywa się w modalu (spójnie z Eksport XLSX).
    - Dependencies: None
    - Risk: Low (ikona lucide renderowana przez istniejący `lucide.createIcons({ root: host })` w linii 27).

2. **Podepnij handler** (File: `public/js/sales/pvImportExportToolbar.js:25`)
    - Action: w `init()` obok linii 23-25 dodać:
      `document.getElementById('ie-btn-import-xlsx').onclick = () => this.showImportXlsxDialog();`
    - Why: spójnie z pozostałymi przyciskami.
    - Dependencies: Step 1
    - Risk: Low

### Phase 2: Metoda `showImportXlsxDialog()`

3. **Dodaj metodę** (File: `public/js/sales/pvImportExportToolbar.js` — wstawić po `showImportJsonDialog()` kończącym się w linii 284, przed `_createModal` w linii 286)
    - Action: nowa metoda `showImportXlsxDialog()` budująca modal przez `this._createModal(...)`:
        - Tytuł: `'Import XLSX (zewn. system)'`.
        - Treść: `<p>` z opisem (wzorować się na linii 229), `this._moduleTypeHtml(uid)` (radio Rury/Studnie, domyślnie `rury`), `<input type="file" id="ie-<uid>-file-input" accept=".xlsx" class="form-input">` (wzorzec linii 231), `<div id="ie-<uid>-progress" style="display:none;...">Importowanie...</div>` (wzorzec linii 232).
        - Label: `'Importuj'`, callback `async () => { ... }`.
    - Why: spójny UX z JSON i Eksport XLSX.
    - Dependencies: Steps 1-2
    - Risk: Low

4. **Logika callbacku (onConfirm)**
    - Action: w callbacku:
      a. `const module = document.querySelector('input[name="' + uid + '-module"]:checked').value;` (wzorzec linii 107-109).
      b. `const input = document.getElementById('ie-' + uid + '-file-input');` — `if (!input.files || !input.files[0]) { showToast('Wybierz plik XLSX', 'error'); return; }`.
      c. `progress.style.display = 'block';` (wzorzec linii 241).
      d. `const parsed = await XlsxImportShared.parseExternalXlsx(input.files[0]);` — walidacja nagłówków i pustego pliku dzieje się w parserze (`xlsxImportShared.js:41-51`), błędy łapie `catch`.
      e. Wybór importera: `const importFn = module === 'studnie' ? StudnieExternalImport.import : RuryExternalImport.import;`
      f. Sekwencyjna pętla `for (const offerGroup of parsed.offers) { const res = await importFn(offerGroup); ... }` — **kolejność sekwencyjna z `await` jest obowiązkowa** (znany błąd #2 SQLITE_BUSY — równoległe zapisy do bazy). Konflikt numeru obsłuży sam `ConflictModal` wewnątrz `import()` (rury `externalImport.js:37`, studnie:49) — **nie pisać własnego modala**.
      g. Zbieranie wyników w lokalne liczniki: `ok`, `skipped`, `errors` (`res.success`, `res.skipped`, `res.error` — kontrakty w `externalImport.js:86-89` i `:103-106`).
      h. `this._closeModal();` po zakończeniu pętli.
      i. Komunikat zbiorczy przez `showToast(...)`: sukces `'Zaimportowano oferty: X, pominięto: Y'` (typ `'success'` gdy `ok > 0`, `'error'` gdy same błędy); błędy indywidualne agregować z `res.message`.
      j. `if (window.pvSalesUI) window.pvSalesUI.loadLocalOffers();` (wzorzec linii 275-277).
      k. `catch (err) { showToast('Błąd importu XLSX: ' + err.message, 'error'); progress.style.display = 'none'; }` (wzorzec linii 278-281).
    - Why: pełne pokrycie happy path + błędów; brak nowej logiki domenowej — wszystko delegowane do istniejących modułów.
    - Dependencies: Step 3
    - Risk: Medium (obsługa wielu ofert — patrz Risks)

## Testing Strategy

- **Ręczne (Playwright/browser, kartoteka ofert z flagą `import_export_enabled`):**
    - Import pliku XLSX z 1+ ofertami rur (kolumny wg `docs/import-export/ARCHITECTURE.md:74-91`) → nowe oferty widoczne na liście po `loadLocalOffers()`.
    - Import studni (`NR_STUDNI` = nazwa studni, `SREDNICA`, `GLEBOKOSC`, `MAGAZYN`, `LP`) → oferta studni z poprawnym `wellMap`.
    - Import z numerem istniejącej oferty → `ConflictModal` (Pomiń / Nadpisz / Kopia -2) działa dla obu modułów.
    - Plik z brakującą kolumną → toast `'Brakujące wymagane kolumny: ...'` (`xlsxImportShared.js:49`).
    - Pusty plik XLSX → toast `'Plik XLSX jest pusty'`.
    - Anulowanie wyboru pliku → toast `'Wybierz plik XLSX'`.
    - Mieszany plik (rury+studnie wg modułu wybranego w radiu).
- **Automatyczne:** brak testów jednostkowych dla tego obszaru (grep: zero testów externalImport) — logika domenowa importu pozostaje nietestowana jak dotąd; nie dodawać nowych testów w tym zakresie (YAGNI, zadanie dotyczy wyłącznie UI).

## Risks & Mitigations

- **Risk:** Wiersze bez `NUMER_OFERTY` grupują się pod klucz `'BRAK_NUMERU'` (`xlsxImportShared.js:76`) → import oferty o takim numerze.
    - Mitigation: opcjonalnie w pętli pominąć grupy `number === 'BRAK_NUMERU'` i dodać do komunikatu `'pominięto wiersze bez numeru'`. Decyzja do potwierdzenia z użytkownikiem biznesowym; domyślnie importujemy (zachowanie parsera bez zmian).
- **Risk:** Sekwencyjny import wielu ofert z pliku może trwać (N zapytań POST) — brak paska postępu per oferta.
    - Mitigation: komunikat `'Importowanie...'` (progress div) wystarczy na skalę kartoteki; w razie potrzeby rozszerzyć o licznik per oferta.
- **Risk:** `showToast` wymaga kontenera `#toast-container` — obecny w `kartoteka.html:439`. Brak ryzyka.
- **Risk:** Zmiana w pliku sprawdzanym przez ESLint frontend — naruszenie reguł (np. długość linii).
    - Mitigation: uruchomić `npm run format` przed walidacją.

## Validation Commands

```bash
node -c public/js/sales/pvImportExportToolbar.js
npm run lint:frontend
npm run typecheck:frontend
npm run format
```

## Success Criteria

- [ ] Przycisk "Import XLSX (zewn.)" widoczny w toolbarze po zalogowaniu do kartoteki (gdy flaga włączona).
- [ ] Modal z radiem Rury/Studnie i wyborem pliku `.xlsx`.
- [ ] Import rur i studni tworzy oferty przez istniejące endpointy (`/api/offers-rury`, `/api/offers-rury/studnie`) z audytem `import.external`.
- [ ] Konflikt numeru obsłużony przez `ConflictModal` (Pomiń/Nadpisz/Kopia).
- [ ] Komunikaty po polsku przez `showToast` (sukces i błędy).
- [ ] Lista ofert odświeżona po imporcie.
- [ ] `npm run lint:frontend`, `npm run typecheck:frontend`, `node -c`, `npm run format` przechodzą.
- [ ] Brak zmian w plikach rdzenia (`offerCrud.js`, `offerManager.js`, `offerItems.js`, `wizard.js`, `router.js`).

## Pliki do edycji / utworzenia

- **Edycja (1 plik):** `public/js/sales/pvImportExportToolbar.js` — przycisk (linia ~20), handler (linia ~25), nowa metoda `showImportXlsxDialog()` (po linii 284).
- **Utworzenie:** brak.
- **HTML:** `public/kartoteka.html` — bez zmian.
