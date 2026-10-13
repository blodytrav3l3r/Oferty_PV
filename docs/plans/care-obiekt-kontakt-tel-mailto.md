# Opieka — Obiekt/Adres + kontakt z tel:/mailto: na kartach

Status: ZAIMPLEMENTOWANE (karty kolejki i powiadomień).

## Cel

Kafelki Kolejki opieki i Centrum powiadomień pokazują wyłącznie firmę.
Dodano linię Obiekt/Adres (`investName` / `investAddress`) oraz linię
kontaktu (osoba • telefon `tel:` • mail `mailto:`).

## Evidence Ledger

| ID    | Twierdzenie                                           | Dowód                                                   | Status   |
| ----- | ----------------------------------------------------- | ------------------------------------------------------- | -------- |
| E-001 | Queue payload nie miał invest/kontaktu                | `src/services/careService.ts:228-251` (SELECT bez pól)  | VERIFIED |
| E-002 | Notif payload miał tylko clientName/number            | `src/services/careService.ts:1103-1108` (`cols`)        | VERIFIED |
| E-003 | Obiekt = kolumna `investName` (obie tabele)           | `prisma/schema.prisma:326,360` + baseline `investName`  | VERIFIED |
| E-004 | Adres/kontakt tylko w blobie `data`                   | `src/types/offerData.ts:10-15,44-48`                    | VERIFIED |
| E-005 | Mirror `clientContacts[0]` → klucze legacy            | `src/routes/offers/clientContact.ts:114-124`            | VERIFIED |
| E-006 | `layout-grid`/`list` luk nie ma (ikony kart działają) | `public/js/shared/iconsSlim.js` (`list`, `layout-grid`) | VERIFIED |

## Zakres (zero migracji)

- BE: `json_extract` z istniejącej kolumny `data` + kolumna `investName`
  (precedencja: kolumna → `$.investName` → `$.budowa`; kontakt:
  klucz legacy → `$.clientContacts[0]`). Cursor/`count`/sync bez zmian.
- FE: wspólny `buildCareMeta(src, prefix)` (`public/js/care/carePanel.js`),
  `textContent`/DOM only, `tel:`/`mailto:` po allowliście, brak linii przy
  braku danych. Klasy `care-queue-meta/obj/contact`, `care-notif-meta/obj/contact`
  (`public/css/index.css`), tokeny `--fs-*`, selektory `data-care-object/contact` (E2E).
- Testy: kontrakt BE (`followUpQueueValue`, `followUpCareNotif`),
  render/XSS/tel FE (`carePanel.test.ts`), E2E (`carePanelContact.spec.ts`).
- Docs: `OPIEKA.md §Payload`, `API.md §Opieka`, `UI_GUIDELINES §8`,
  `permission-matrix §10`.

## Bramki

`npm run validate` + `npm run version:check` (EXIT=0) + `npm run format`;
commity `feat(care)` / `feat(ui)` / `test(care)` przez `node scripts/commit.mjs`.
Bez pusha (osobne GO).
