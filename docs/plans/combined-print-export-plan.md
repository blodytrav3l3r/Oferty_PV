# Implementation Plan: Wydruk Laczny Oferty (Rury + Studnie -> PDF/DOCX)
> **Stan: ZREALIZOWANE (commit cbb2e73; wcześniejsze commity z serii feat(print)).** Treść ponizżej zachowana jako dokumentacja procesu. Odchylenia od planu: endpoint w src/routes/exportCombined.ts (nie src/routes/offers/exportsCombined.ts), ścieżka /api/export-combined (nie /api/offers-combined), frontend przez upmCombinedPrepare (printModal.js + oba offerPrintManager.js), testy jako tests/combinedDocument.test.ts i tests/exportCombined.test.ts. Funkcjonalność rozszerzona później o filtry/kategorie i wpisywalne pola.

Status: do akceptacji
Zakres: eksport dwoch ofert (rur i studni) do JEDNEGO pliku PDF oraz DOCX/Word

## 1. Cel

Uzytkownik z modala "Wydruk Dokumentow" (printModal.js) wybiera oferte rur, oferte studni
oraz format (PDF/Word) i pobiera jeden plik zawierajacy obie oferty (sekcja rur -> page break
-> sekcja studni).

## 2. Weryfikacja kodu (fakty, na ktorych stoi plan)

- `src/routes/offers/exports.ts` - wzorzec endpointu: `requireAuth` + `EXPORT_LIMITER` +
  `canReadDoc` + sanitized `Content-Disposition`. Router montowany w `src/app.ts` pod
  `/api/offers-rury` i `/api/offers-studnie` (rewrite `/studnie` prefix).
- `generateRuryHTML()` / `generateStudnieHTML()` (pdf/ruryHtml.ts, pdf/studnieHtml.ts)
  zwracaja PELNE dokumenty HTML (szablon `public/templates/ofertaRury.html` /
  `ofertaStudnie.html` + `PRINT_TOKENS_CSS` + letterhead jako base64 w `<body>`).
  Sklejenie dwoch pelnych dokumentow -> wyciagniecie `<body>` i `<style>` z obu
  i zlozenie jednego dokumentu (DRY: 0 duplikacji logiki HTML).
- `generatePDF(html)` (pdf/pdfEngine.ts) - puppeteer, A4, renderuje dowolny pelny HTML.
- `buildRuryDocument()` / `buildStudnieDocument()` (docx/*/builder.ts) zwracaja
  `new Document({ sections: [jeden] })`. Biblioteka `docx` wspiera `sections: [...]` -
  KAZDA sekcja zaczyna sie od nowej strony (page break wbudowany w OOXML sectPr).
  -> Najprosciej: wyodrebnic budowe `children` do `buildRuryChildren()` /
  `buildStudnieChildren()` (eksport), a dokument laczny zlozyc z 2 sekcji. API builderow
  pozostaje bez zmian (wrappery).
- Frontend: `printModal.js` renderuje sekcje i dispatchuje przez event delegation
  `window[action](id, format)` (jeden `data-id`). Sekcja laczna wymaga DWUCH id
  -> nowe atrybuty `data-combined="1"` + odczyt wartosci z dwoch `<select>`.
- `paginationQuerySchema` (validators/offerSchemas.ts): limit max 200 -> listy ofert do
  selectow pobierane z `?limit=200&sort=createdAt`.
- Testy: `tests/pdfGenerator.test.ts` (mock fs/puppeteer/prisma), `tests/printModal.test.ts`
  (vm sandbox), `tests/printDispatch.test.ts` (statyczne assercje HTML/JS).

## 3. Architektura zmian

Nowe pliki:

- `src/services/pdf/combinedHtml.ts` - sklejanie HTML rur+studni (1 dokument).
- `src/services/docx/combined.ts` - dokument DOCX z 2 sekcjami.
- `src/routes/offers/exportsCombined.ts` - endpointy `/api/offers-combined/export-*`.
- `public/js/shared/printCombined.js` - fetch list ofert + akcja eksportu lacznego.
- `tests/docxCombined.test.ts`, `tests/exportsCombined.test.ts`, `tests/printCombined.test.ts`.

Modyfikowane:

- `src/services/pdfGenerator.ts` (re-export + `generateOfferCombinedPDF`).
- `src/services/docx/rury/builder.ts`, `src/services/docx/studnie/builder.ts` (refaktor children).
- `src/services/docx/index.ts` (re-export `generateOfferCombinedDOCX`).
- `src/validators/offerSchemas.ts` (`combinedExportBodySchema`).
- `src/app.ts` (montaz routera).
- `public/js/shared/printModal.js` (sekcja combined + dispatcher).
- `public/js/rury/offerPrintManager.js`, `public/js/studnie/offerPrintManager.js`
  (config combinedSection przez `upmCombinedPrepare`).
- `public/css/printModal.css` (style `.upm-combined-*`, `.upm-title-combined`, `.upm-select`).
- `public/kartoteka.html`, `public/rury.html`, `public/studnie.html` (script tag printCombined.js).
- `tests/pdfGenerator.test.ts`, `tests/printModal.test.ts`, `tests/printDispatch.test.ts`.

## 4. Implementacja - kroki

### Faza A: Backend PDF (sekcja laczna HTML)

1. **`src/services/pdf/combinedHtml.ts` (nowy)** - pomocnik sklejania:
    - `extractBody(html: string): string` - regex `<body[^>]*>([\s\S]*?)<\/body>` (grupa 1).
    - `extractStyles(html: string): string` - zbiera wszystkie `<style[^>]*>([\s\S]*?)<\/style>`.
    - `generateCombinedHTML(ruryCtx: RuryOfferData, studnieCtx: StudnieOfferData): Promise<string>`:
        - `const ruryHtml = await generateRuryHTML(ruryCtx);`
        - `const studnieHtml = await generateStudnieHTML(studnieCtx);`
        - zwraca: doctype + head z `extractStyles(ruryHtml) + extractStyles(studnieHtml)`
            - dodatkowym `<style>.combined-section-break{page-break-before:always;}</style>`
            - body = `extractBody(ruryHtml)` + `<div class="combined-section-break">` + `extractBody(studnieHtml)` + `</div>`.
        - Komentarz PL wyjasniajacy page-break miedzy sekcjami.
    - Uwaga: klasy CSS rur (`.cat-*`) i studni (`.dn-*`) nie koliduja (zweryfikowane),
      wspolne klasy (`.offer-table`, `.summary-table`, `.info-*`, `.letterhead-*`) sa identyczne.

2. **`src/services/pdfGenerator.ts` (modyfikacja)** - dodac:
    - `export async function generateOfferCombinedPDF(offerRuryId: string, offerStudnieId: string): Promise<Buffer>`
        - `const ruryCtx = await buildRuryOfferContextFromOfferId(offerRuryId);`
        - `const studnieCtx = await buildStudnieOfferContextFromOfferId(offerStudnieId);`
        - `const html = await generateCombinedHTML(ruryCtx, studnieCtx);`
        - `return generatePDF(html);`

### Faza B: Backend DOCX (2 sekcje)

3. **`src/services/docx/rury/builder.ts` (refaktor, API bez zmian)**:
    - Wydzielic cialo budujace tablice `children` (linie ~46-94) do eksportowanej:
      `export function buildRuryChildren(offer, offerData, client, items, authorUser, guardianUser, documentType): (Paragraph | Table)[]`
    - `buildRuryDocument(...)` -> `return new Document({ sections: [{ ...props, children: buildRuryChildren(...) }] });`
    - Dodatkowo wyeksportowac stala `RURY_SECTION_PROPERTIES` (marginesy 60/280/570/570 + header/footer margins)
      uzywana przez combined.ts (DRY).

4. **`src/services/docx/studnie/builder.ts` (refaktor, API bez zmian)**:
    - Analogicznie:
      `export function buildStudnieChildren(offer, offerData, client, wells, authorUser, guardianUser, documentType): (Paragraph | Table)[]`
      oraz `STUDNIE_SECTION_PROPERTIES`.
    - `buildStudnieDocument(...)` -> wrapper jak wyzej.

5. **`src/services/docx/combined.ts` (nowy)**:
    - `export function buildCombinedDocument(...)`:
      `new Document({ sections: [
{ properties: RURY_SECTION_PROPERTIES, headers: { default: buildImageHeader() }, footers: { default: buildImageFooter() }, children: buildRuryChildren(...) },
{ properties: STUDNIE_SECTION_PROPERTIES, headers: ..., footers: ..., children: buildStudnieChildren(...) }
] })` - sekcje zaczynaja sie od nowej strony (wbudowany page break sekcji DOCX).
    - `export async function generateOfferCombinedDOCX(offerRuryId: string, offerStudnieId: string): Promise<Buffer>`
        - buduje oba konteksty (`buildRuryOfferContextFromOfferId`, `buildStudnieOfferContextFromOfferId`),
        - pobiera `client` dla kazdej oferty (wzor z `generateOfferRuryDOCX` / `generateOfferStudnieDOCX`),
        - `buildCombinedDocument(...)`, `return Packer.toBuffer(doc)`.

6. **`src/services/docx/index.ts` (modyfikacja)** - `export { generateOfferCombinedDOCX } from './combined';`

### Faza C: Endpoint

7. **`src/validators/offerSchemas.ts` (modyfikacja)** - dodac:
    - `export const combinedExportBodySchema = z.object({ offerRuryId: z.string().min(1), offerStudnieId: z.string().min(1) }).strict();`

8. **`src/routes/offers/exportsCombined.ts` (nowy)** - wzorzec z exports.ts:
    - `const router = express.Router();`
    - Prywatny helper `async function resolveOffersForExport(offerRuryId, offerStudnieId, user)`:
        - `findUnique offers_rel` (rury) i `offers_studnie_rel` (studnie) z `select: { userId: true, offer_number: true }`;
        - brak ktorejkolwiek lub `!canReadDoc(user, offer.userId)` -> `null` (404);
        - zwraca `{ rury: { id, number }, studnie: { id, number } }`.
    - `buildSafeFilename(ruryNumber, studnieNumber, ext)` - skleja numery ofert,
      `replace(/[^a-z0-9_-]/gi, '_')` + `slice(0, 40)` kazdy, wynik: `oferta_laczna_<rury>_<studnie>.<ext>`.
    - **`POST /export-pdf`** (`requireAuth, EXPORT_LIMITER`):
        - `const body = combinedExportBodySchema.parse(req.body)` (blad walidacji -> 400 `{ error }`);
        - `const resolved = await resolveOffersForExport(...)`; brak -> 404 `{ error: 'Not found' }`;
        - `const buffer = await generateOfferCombinedPDF(body.offerRuryId, body.offerStudnieId);`
        - `Content-Type: application/pdf`;
        - `Content-Disposition: attachment; filename="<buildSafeFilename(...).pdf>"`;
        - `res.send(buffer)`.
    - **`POST /export-docx`** - analogicznie, `generateOfferCombinedDOCX`,
      `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
    - `try/catch` + `logger.error('ExportCombined', 'Blad eksportu lacznego', message)` -> 500.

9. **`src/app.ts` (modyfikacja)** - po linii 212 (obok pozostalych ofert):
    - `app.use('/api/offers-combined', apiLimiter, combinedExportRoutes);` + import.

### Faza D: Frontend - nowy modul printCombined.js

10. **`public/js/shared/printCombined.js` (nowy)** - naglowek PL, `// @ts-check`:
    - `function fetchOfferLists()` - `Promise.all` dwoch fetchy:
      `/api/offers-rury?limit=200&sort=createdAt` i `/api/offers-rury/studnie?limit=200&sort=createdAt`
      z `headers: authHeaders()` (fallback `{}`); mapowanie `data` -> `{ id, label: offer.offer_number || offer.title || offer.id }`;
      blad -> `throw` (lapane w `upmCombinedPrepare`).
    - `function upmCombinedPrepare(config)` - async:
        - proba `fetchOfferLists()`; na sukces ustawia
          `config.combinedSection = { ruryOffers, studnieOffers, defaultRuryId, defaultStudnieId, actionPdf: 'exportCombined_action', actionDocx: 'exportCombined_action' }`
          gdzie `defaultRuryId`/`defaultStudnieId` czytane z `config._combinedDefaults`;
        - na blad: `logger.warn('printCombined', ...)` i kontynuacja bez sekcji lacznej;
        - zawsze konczy `window.__upmHelperShow(config)` (fallback showToast gdy brak helpera).
    - `async function exportCombined_action(ruryId, studnieId, format)`:
        - walidacja obu ID i formatu (`pdf`/`docx`) -> `showToast('...', 'error')` + return;
        - `showToast('Generowanie wydruku lacznego (PDF)...')`;
        - `fetch('/api/offers-combined/export-' + endpoint, { method: 'POST', headers: {'Content-Type':'application/json', ...authHeaders()}, body: JSON.stringify({ offerRuryId, offerStudnieId }) })`;
        - `!res.ok` -> tekst bledu w throw; `res.blob()` -> download `oferta_laczna_*` przez
          `URL.createObjectURL` + `<a download>` (wzor z `exportOfferDirect_action`);
        - `showToast('Pobrano wydruk laczny (PDF)', 'success')`; catch -> `logger.error` + toast.
    - Rejestracja globalna na koncu pliku:
      `window.upmCombinedPrepare = upmCombinedPrepare; window.exportCombined_action = exportCombined_action;`
    - Kazda interpolacja do innerHTML przez `window.escapeHtml(...)` (XSS, regula AGENTS.md).
    - Weryfikacja skladni: `node -c public/js/shared/printCombined.js`.

11. **`public/js/shared/printModal.js` (modyfikacja)**:
    - `renderCombinedSection(cfg)` - zwraca `''` gdy brak `ruryOffers`/`studnieOffers` lub puste tablice;
      HTML: `.upm-section[data-section="combined"]`, header z `upm-title-combined`,
      grid `.upm-combined-grid` z dwoma `<select class="upm-select" data-role="upm-combined-rury-select"|"upm-combined-studnie-select">`
      (opcja `selected` gdy `o.id === cfg.defaultRuryId` / `defaultStudnieId`),
      `.upm-actions` z dwoma przyciskami `data-action="..." data-combined="1" data-format="pdf"|"docx"`;
      wszystkie interpolacje przez `escapeHtml`.
    - `handleClick` - przed `window[action](id, format)`:
        - `if (btn.getAttribute('data-combined') === '1')` -> odczyt
          `modal.querySelector('[data-role="upm-combined-rury-select"]')?.value` i studnie;
          oba obecne -> `window[action](ruryId, studnieId, format)`,
          inaczej `showToast('Wybierz obie oferty do wydruku lacznego', 'error')`; `return`.
    - `showUniversalPrintModal` - dodac `renderCombinedSection(config.combinedSection)` do `sectionsHtml`
      (po `renderOfferSection`, przed `renderOrderCurrentSection`).
    - Rozszerzyc naglowek PL pliku o sekcje "WYDRUK LACZNY (rury+studnie)".

12. **`public/js/rury/offerPrintManager.js` (modyfikacja)** - `showUniversalPrintModalRury`:
    - zamiast bezposredniego `window.__upmHelperShow(config)` -> gdy istnieje `window.upmCombinedPrepare`:
      `window.upmCombinedPrepare({ ...config, _combinedDefaults: { ruryId: targetOfferId || null, studnieId: null } })`;
      else stary fallback (`__upmHelperShow`).

13. **`public/js/studnie/offerPrintManager.js` (modyfikacja)** - `showUniversalPrintModal`:
    - analogicznie: `window.upmCombinedPrepare({ ...config, _combinedDefaults: { ruryId: null, studnieId: finalOfferId || null } })`.

14. **`public/css/printModal.css` (modyfikacja)** - dodac:
    - `.upm-title-combined { color: var(--upm-accent); }`
    - `.upm-combined-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }`
        - `@media (max-width: 480px) { .upm-combined-grid { grid-template-columns: 1fr; } }`
    - `.upm-select { width: 100%; padding: 6px 8px; ... }` (ciemna tonacja jak `.upm-row`).

15. **`public/kartoteka.html`, `public/rury.html`, `public/studnie.html` (modyfikacja)**:
    - po `<script src="js/shared/printModal.js?...">` dodac
      `<script src="js/shared/printCombined.js?v=1.10.0"></script>` (ta sama wersja co printModal;
      NIE edytowac recznie `?v=` poza aktualna wartoscia - cache-bust nadpisze przy release).

### Faza E: Testy

16. **`tests/pdfGenerator.test.ts` (rozszerzenie)** - opis "generateOfferCombinedPDF":
    - mock `offers_rel.findUnique` i `offers_studnie_rel.findUnique` -> istnieja oferty;
      `expect(result).toBeInstanceOf(Buffer)`; `puppeteer.launch` wywolany;
    - brak oferty studni -> `rejects.toThrow('Oferta studni nie znaleziona')`;
    - (opcjonalnie) `generateCombinedHTML` zawiera oba numery ofert i `page-break-before`.

17. **`tests/docxCombined.test.ts` (nowy)** - mock `prismaClient` (oferty+klienci), mock `Packer.toBuffer`:
    - `buildCombinedDocument(...)` zwraca obiekt z `sections.length === 2`;
    - `generateOfferCombinedDOCX('r1','s1')` zwraca Buffer, `buildRuryChildren`/`buildStudnieChildren` wywolane;
    - regresja: `buildRuryDocument` / `buildStudnieDocument` nadal `sections.length === 1` (API bez zmian).

18. **`tests/exportsCombined.test.ts` (nowy)** - wzorzec `tests/ruryOrderExport.test.ts` (supertest + mock prisma):
    - POST bez `offerStudnieId` -> 400;
    - POST z nieistniejaca oferta -> 404;
    - POST z oferta innego usera (brak `canReadDoc`) -> 404;
    - POST poprawne -> 200, content-type application/pdf / docx, `Content-Disposition` zawiera `oferta_laczna_`.

19. **`tests/printModal.test.ts` (rozszerzenie)** - vm sandbox:
    - render sekcji combined (dwa selecty, przyciski `data-combined="1"`, opcje z labelami);
    - pominiecie sekcji gdy `ruryOffers`/`studnieOffers` puste;
    - dispatcher: click na btn `data-combined="1"` wywoluje `window[action](ruryId, studnieId, format)`
      (mock `documentMock.getElementById('universal-print-modal')` z `querySelector` zwracajacym selecty);
    - escapeHtml tytulow sekcji combined.

20. **`tests/printCombined.test.ts` (nowy)** - vm sandbox dla `printCombined.js` (wzorzec printModal.test.ts):
    - mock globalny `fetch` (lista ofert) -> `upmCombinedPrepare` ustawia `config.combinedSection` z listami;
    - `exportCombined_action` robi POST do `/api/offers-combined/export-pdf` z body `{ offerRuryId, offerStudnieId }`
      i nazwa pobieranego pliku `oferta_laczna_*`;
    - blad fetch list -> `upmCombinedPrepare` nadal wywoluje `__upmHelperShow` (bez sekcji lacznej).

21. **`tests/printDispatch.test.ts` (rozszerzenie)** - statyczne assercje:
    - `kartoteka.html` / `rury.html` / `studnie.html` laduja `js/shared/printCombined.js`;
    - `rury/offerPrintManager.js` i `studnie/offerPrintManager.js` zawieraja `upmCombinedPrepare`.

## 5. Kolejnosc implementacji

1. Faza A (PDF backend) + test 16 - niezalezna, szybka weryfikacja.
2. Faza B (DOCX backend) + test 17 - wymaga refaktoru builderow (ryzyko regresji -> istniejace `docxStudnieTables.test.ts`).
3. Faza C (endpoint) + test 18 - zalezna od A i B.
4. Faza D (frontend: printCombined.js -> printModal.js -> menedzery -> CSS -> HTML) + testy 19-21.
5. `npm run validate` + `npm run format` + `node -c` dla nowych plikow JS.

## 6. Ryzyka i mitigacje

- **Ryzyko**: wyodrebnienie `buildRuryChildren`/`buildStudnieChildren` zmieni zachowanie istniejacych
  dokumentow. -> Wrappery builderow bez zmiany sygnatur; testy regresyjne `docxStudnieTables.test.ts`
    - nowy test `sections.length === 1` w kroku 17.
- **Ryzyko**: CSS rur i studni koliduja po sklejeniu (np. `.offer-table` rozne font-size).
  -> Zweryfikowano recznie - klasy wspolne sa identyczne, specyficzne nie nakladaja sie.
  Test w kroku 16 sprawdza obecnosc `page-break-before` i obu naglowkow.
- **Ryzyko**: duplikat dyrektywy `@page` z dwoch `<style>`. -> Identyczne wartosci - scalenie bezpieczne;
  w razie problemu `extractStyles` moze zwrocic tylko pierwsza dyrektywe `@page` (komentarz PL w combinedHtml.ts).
- **Ryzyko**: modal bez list ofert (bledy sieci/uprawnienia) - sekcja laczna znika, reszta dziala.
  -> Fallback w `upmCombinedPrepare` (log warn + kontynuacja).
- **Ryzyko**: domyslny limit paginacji (50) - za malo ofert w selectach. -> `?limit=200&sort=createdAt`.

## 7. Kryteria sukcesu

- [ ] `POST /api/offers-combined/export-pdf` zwraca jeden PDF: oferta rur -> page break -> oferta studni.
- [ ] `POST /api/offers-combined/export-docx` zwraca jeden DOCX z 2 sekcjami (page break).
- [ ] Autoryzacja: 404 dla braku oferty/uprawnien, 400 dla zlego body.
- [ ] Sekcja "Wydruk laczny" w modalu (kartoteka + edytory rur i studni) z wyborem obu ofert i formatu.
- [ ] Wszystkie nowe/rozszerzone testy przechodza; `npm run validate` i `npm run format` czyste.

## 8. Konwencje commitow (sugerowane)

- `feat(export): laczny wydruk oferty rur i studni do PDF/DOCX`
- `refactor(docx): wyodrebnienie build*Children z builderow ofert`
- `test(export): testy endpointu i modala wydruku lacznego`
