# Plan: Uwagi per-studnia → "Uwagi do oferty (widoczne na wydruku)"

Data: 2026-08-27
Status: **draft** (zatwierdzony do implementacji, nie rozpoczęty)
Branch: `main`
Dotyczy: moduł `studnie` (`public/js/studnie/*`, `public/js/shared/*`, `src/services/pdf/*`, `public/css/*`)

## Cel

Dodać opcjonalne pole `well.uwagi: string` per studnia, edytowalne przez modal z ikony w trzech miejscach UI, z automatycznym doklejeniem do sekcji "Uwagi do oferty (widoczne na wydruku)" na podglądzie oferty i wydruku/PDF.

Potwierdzone decyzje (2026-08-27):

- Nazwa pola: `uwagi` (PL, spójne z `przejscia[].uwagi`, `uwagiOgolne`).
- Lokalizacje przycisku: lista studni, nagłówek edytora studni (karta konfiguracji), Excel — sekcja akcje.
- Zasięg: tylko oferty i wydruk — **nie** Karta Budowy / Zlecenia produkcyjne.

## Kontekst i audyt kodu

- Brak pola dziś: `grep well.uwagi|well.notes == 0` hits.
- Oferta-level `notes` istnieje: `shared/offerCrudCommon.js:173`, `offerPrintManagerHelpers.js:129`, `studnieHtml.ts:173`.
- `wells` global: `globals.js:41` (`{ id, name, dn, config, przejscia, ... }`), tworzone w `actionsWellCrud.js:67 createNewWell()`, duplikowane via `structuredClone` (`actionsWellCrud.js:187`, `excelWellActions.js:264`) — nowe pole auto-kopiowane.
- `migrateWellData()` (`offerHelpers.js:47`) — miejsce na default `uwagi`.
- `wellsExport` / `offerSave.js:79` — `structuredClone(wells)` → JSON `data` w DB, walidacja `offerSchemas.wellDataSchema.passthrough()` przepuszcza nieznane pola, `StudnieWell [key:string]:unknown` (`offerData.ts:90`).
- Modale: `shared/modalCore.js:88 showModal({id,title,html})` + `closeModal`, CSS `.modal-overlay/.modal` (`style.responsive.css:559`). Wzorzec `wellPopups.js:131`.
- Wydruk: `offerPrintManager.js:96/134` → `buildOfferNotesHtml` → `{{SEKCJA_UWAGI}}` w `templates/ofertaStudnie.html:327`, backend mirror `studnieHtml.ts:173` + `ruryHtml.ts:240`.
- Notatki auto-gen: `shared/offerNotesGenerator.js:7 createOfferNotesGenerator()` + `studnie/offerNotesGenerator.js:179` 13 providerów.
- Lista studni: `wellUI.js:174 .well-list-actions` (duplikuj/usuń), brak `has-uwagi`, brak `lucide.createIcons({root})` w tym pliku.
- Excel: brak kolumny uwagi per-well; uwagi to pole karty — nie arkusz.

## Architektura rozwiązania

```
well.uwagi (string, '' default)
    │
    ├─ UI: wellUI.js (lista) + nagłówek edytora (wellUI / wellPopups / actionsWellCrud)
    │       + Excel akcje (excelTableManager / excelWellActions)
    │       └─► wellNotesModal.js (nowy) → showModal + textarea + Zapisz/Anuluj
    │
    ├─ Trwałość: actionsWellCrud.createNewWell + offerHelpers.migrateWellData
    │            + offerSave.structuredClone + StorageService (bez zmian DB migr.)
    │
    └─ Wydruk: offerNotesGenerator (provider getWellUwagiSummary)
               offerPrintManagerHelpers.buildOfferNotesHtml (block per-well)
               offerPrintManager.generateOfferHtml (przekaż wells)
               src/services/pdf/studnieHtml.ts + context.ts (backend PDF)
```

## Fazy

### Faza 1 — Model danych (1 commit, <15 LOC)

Pliki:

- `public/js/studnie/actionsWellCrud.js:74` — w `createNewWell()` dodać `uwagi: ''`
- `public/js/studnie/offerHelpers.js:47` — w `migrateWellData()`:
    ```js
    if (w.uwagi == null) w.uwagi = '';
    // opcjonalnie: if (typeof w.uwagi !== 'string') w.uwagi = String(w.uwagi);
    ```
- `public/js/studnie/globals.js:41` — komentarz typu: `// { id, name, dn, uwagi, config, ... }`

Zachowanie:

- `duplicateWell` (`actionsWellCrud.js:187`) i `excelDuplicateWell` (`excelWellActions.js:273`) via `structuredClone` — zero zmian, pole kopiowane.
- `offerSave.js:84` `structuredClone(wells)` — zero zmian.
- Walidacja: `offerSchemas.ts:89` `.passthrough()` — zero zmian.
- `offerApi.js:55 ensureElemIds` — nie dotyka `uwagi`.

Weryfikacja: `node -c`, `npm run typecheck`, grep `w.uwagi`.

### Faza 2 — UI: ikona + modal (1 commit, ~80 LOC)

Nowy plik:

- `public/js/studnie/wellNotesModal.js` (~45 LOC):
    ```js
    // @ts-check
    function openWellNotesModal(idx){ ... showModal ... escapeHtml ... lucide.createIcons ... save-> wells[idx].uwagi = val; closeModal; renderWellsList(); refreshAll(); markDirty? }
    window.openWellNotesModal = openWellNotesModal;
    ```

Modyfikacje:

1. **Lista studni** — `public/js/studnie/wellUI.js:174` w `.well-list-actions` trzeci przycisk przed duplikuj/usuń:

    ```html
    <button
        class="well-list-action ${hasUwagi?'has-uwagi':''}"
        title="${hasUwagi?'Edytuj uwagi – '+escapeHtmlAttr(w.uwagi.slice(0,60)):'Dodaj uwagi'}"
        onclick="event.stopPropagation(); openWellNotesModal(${i})"
    >
        <i data-lucide="message-square"></i>
    </button>
    ```

    Gdzie `hasUwagi = !!(w.uwagi && w.uwagi.trim())`. Po `innerHTML` dodać `if(window.lucide) lucide.createIcons({root:container})` (dziś brak w wellUI.js).

2. **Nagłówek edytora studni** — `public/js/studnie/wellUIHelpers.js` lub `wellUI.js` / `actionsWellCrud.js` (miejsce gdzie renderowany jest nagłówek karty wybranej studni — tytuł `well.name + DN`). Dodać ten sam przycisk obok nazwy/renomowania. Jeśli nagłówek to `wellPopups.js`/`wellManager.js` — zlokalizować dokładny plik przy implementacji i dodać identyczny `openWellNotesModal(currentWellIndex)`.

3. **Excel — sekcja akcje** — `public/js/studnie/excelTableManager.js` / `excelWellActions.js` / `excelTableBody.js` (pasek akcji nad tabelą Excel, obok "Duplikuj", "Usuń zaznaczone"). Dodać przycisk `Uwagi` dla aktywnego wiersza lub per-wiersz w kolumnie akcji:
    ```html
    <button class="btn btn-sm" onclick="openWellNotesModal(_excelActiveRowIdx)">
        <i data-lucide="message-square"></i> Uwagi
    </button>
    ```
    Has-uwagi variant: klasa `has-uwagi` + `title` z preview.

CSS:

- `public/css/studnie.css:731` dopisać:
    ```css
    .well-list-action.has-uwagi {
        color: var(--warn-hover);
        background: rgba(var(--warn-rgb), 0.15);
        border-color: rgba(var(--warn-rgb), 0.3);
    }
    ```
    (jeśli Excel używa `.btn`, analogiczny modyfikator `.btn.has-uwagi`).

Kolejność skryptów w `public/studnie.html`:

```html
<script src="js/studnie/wellUI.js?v=..."></script>
<script src="js/studnie/wellNotesModal.js?v=..."></script>
<script src="js/studnie/offerPrintManager.js?v=..."></script>
```

Zasady:

- Ikony wyłącznie Lucide + `lucide.createIcons({root})` po renderze.
- XSS: `escapeHtml` w body, `escapeHtmlAttr` w title/aria-label.
- Brak inline styles poza tokenami `var(--*)`.

### Faza 3 — Oferta: "Uwagi do oferty" + wydruk (1 commit, ~50 LOC)

1. `public/js/studnie/offerNotesGenerator.js` — dodać provider:

    ```js
    function getWellUwagiSummary() {
        if (!wells || !wells.length) return null;
        const rows = wells
            .filter((w) => w.uwagi && w.uwagi.trim())
            .map((w) => `• ${w.name} (DN${w.dn}): ${w.uwagi.trim().replace(/\n/g, ' ')}`);
        return rows.length ? `Uwagi do studni:\n${rows.join('\n')}` : null;
    }
    // dopisać do createOfferNotesGenerator([... , getWellUwagiSummary])
    ```

    Generator dokleja do `#offer-tab-notes` po `Parametry techniczne` i przed `Cena franco...`.

2. `public/js/studnie/offerPrintManagerHelpers.js:129 buildOfferNotesHtml(notes, paymentTerms, _validity)` — rozszerzyć:
    - Przyjąć 4. param `wells` lub czytać global `wells`.
    - Po bloku `notes` dodać:
        ```js
        const perWell = (typeof wells !== 'undefined' ? wells : []).filter(
            (w) => w.uwagi && w.uwagi.trim()
        );
        if (perWell.length) {
            html +=
                `<div class="well-notes-section" style="margin-top:8px"><strong>Uwagi do studni:</strong><ul style="margin:4px 0 0 16px">` +
                perWell
                    .map(
                        (w) =>
                            `<li><strong>${escapeHtml(w.name)} (DN${escapeHtml(String(w.dn))}):</strong> ${escapeHtml(w.uwagi).replace(/\n/g, '<br>')}</li>`
                    )
                    .join('') +
                `</ul></div>`;
        }
        ```
    - Dodać `escapeHtml` do istniejącego `notes.replace` (bug XSS #24).

3. `public/js/studnie/offerPrintManager.js:134` — przekazać wells:

    ```js
    const notesHtml = buildOfferNotesHtml(notes, paymentTerms, validity, wells);
    ```

4. Backend PDF — `src/services/pdf/studnieHtml.ts:173` analogiczny blok per-well (z `escapeHtml`), `src/services/pdf/context.ts:180` i `types.ts:31` już przepuszczają `uwagi` przez `wells`.

Template bez zmian: `{{SEKCJA_UWAGI}}` już w `ofertaStudnie.html:327`.

### Faza 4 — Excel kolumna (świadomie pominięte w v1)

Nie dodawać kolumny `Uwagi` w arkuszu Excel w v1 — edycja per-well odbywa się przez modal z listy/nagłówka/akcji Excel. Kolumna = duplikacja + komplikuje `excelCopyPaste._excelHandleCopy` / `_excelSetCellValue` / `_excelBuildFillPlan`. Dodać tylko gdy zażądana edycja hurtowa.

### Faza 5 — Weryfikacja

```bash
node -c public/js/studnie/wellNotesModal.js
node -c public/js/studnie/wellUI.js
node -c public/js/studnie/offerHelpers.js
node -c public/js/studnie/actionsWellCrud.js
npm run typecheck
npm run typecheck:frontend
npm run lint
npm run lint:frontend
npm run format
npm run encoding:check
npm run version:check
npm run test:quick
```

Manualnie:

- Utwórz studnie S1/S2, dodaj uwagi do S1, sprawdź has-uwagi wyróżnienie w 3 miejscach.
- Zapisz ofertę, odczytaj — uwagi preserved.
- Duplikuj studnię — uwagi skopiowane.
- Podgląd oferty / wydruk — blok "Uwagi do studni" widoczny i escapowany.
- XSS: wpisz `<script>alert(1)</script>` w uwagi — ma być wyrenderowane jako tekst.

## Ryzyka i guardy

- XSS #3/#24/#39 — każde `w.uwagi` przez `escapeHtml` / `escapeHtmlAttr`.
- `lucide.createIcons({root})` po każdym `innerHTML` z `data-lucide`.
- `modalCore.showModal` — jedyny dozwolony modal (zakaz inline style).
- `migrateWellData` pokrywa stare oferty bez pola.
- Pre-push: `version:check` + `encoding:check` + `typecheck` + `test:quick` — blokada przy failu.

## Świadomie pominięte (YAGNI)

- Kolumna Excel `Uwagi`.
- Karta Budowy / Zlecenia produkcyjne — nie wyświetlają `well.uwagi` (decyzja: tylko oferty/wydruk).
- Migracja DB (Prisma) — JSON `data` + `.passthrough()` wystarcza.
- Walidacja długości `uwagi` — bez limitu w v1 (dodać gdy potrzebne).

## Kryteria zakończenia

- [ ] `well.uwagi` tworzone, migrowane, kopiowane przy duplikacji.
- [ ] Przycisk `message-square` w liście studni + nagłówku edytora + akcjach Excel, z has-uwagi stanem i modalem `wellNotesModal.js`.
- [ ] `getWellUwagiSummary()` dokleja do `#offer-tab-notes`; `buildOfferNotesHtml` + `studnieHtml.ts` renderują per-well na wydruku/PDF z `escapeHtml`.
- [ ] `npm run validate` + `npm run version:check` EXIT=0, `npm run format` bez diffu.

## Po zakończeniu

Przenieść plan do `docs/plans/archive/` (`git mv`) po wdrożeniu i weryfikacji.
