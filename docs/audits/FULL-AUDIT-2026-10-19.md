# S.O.K. — Pełny audyt 18 modułów + Excel (6 person)

Data: 2026-10-19 | Wersja: 1.46.4 | HEAD: `7a9c0d7` | Tryb: read-only (zero zmian kodu)
Metoda: `CLAIM → EVIDENCE → VERIFY`. Poprzedni audyt (`SOK-AUDIT-2026-10-04.md`, 7.7/10) = hipoteza startowa, wszystko re-weryfikowane na HEAD.
Persony: Senior Software Engineer, Software Architect, UI/UX Designer, Product Designer, Security Engineer, QA Engineer.

## Werdykt

**7.4/10** (średnia ważona 18 modułów). Brak P0. **17 P1** (z czego 4 blokują jakość bram, nie produkcję): flake `test:quick`, zepsuty `test:e2e`, race numeracji ofert, brak pieczątki/audytu w `PUT /studnie`.

Delta vs 2026-10-04 (7.7): **nieporównywalna wprost** — zakres urósł z 14 do 18 modułów i doszły 6 podocen. Na wspólnym zakresie wynik ~7.5–7.6 (`INFERENCE`, nie `FACT`).

## Bramy dowodowe (wykonane)

| Komenda                                             | Wynik                                                                         | Status                    |
| --------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------- |
| `git status --short`                                | czysto                                                                        | PASS                      |
| `npm run version:check`                             | 1.46.4 we wszystkich źródłach                                                 | PASS (EXIT 0)             |
| `npm run typecheck`                                 | EXIT 0                                                                        | PASS                      |
| `npm run typecheck:frontend`                        | EXIT 0                                                                        | PASS                      |
| `npm run lint` / `lint:frontend`                    | EXIT 0 / EXIT 0                                                               | PASS                      |
| `npx ts-node scripts/prices-verify.ts`              | LIVE = Default = plik (rury 95, studnie 690, preco 5+54+179)                  | PASS (EXIT 0)             |
| `node scripts/coverage-check.mjs`                   | lines 77.6% / branches 72.3% / functions 76.5% (progi 65/64/61)               | PASS                      |
| `npm run test:quick`                                | **493 suites pass, 1 fail, 1 skip**; 4907 testów pass, 1 fail, 7 skip (279 s) | **FAIL**                  |
| `npx jest tests/pricelistChunk.test.ts --runInBand` | 2/2 pass (20 s)                                                               | PASS (flake potwierdzony) |

**Flake:** `tests/pricelistChunk.test.ts:19` — `2000 wierszy` z timeoutem 60 s przechodzi solo (6.4 s + 2.1 s), pada tylko pod równoległym obciążeniem 494 suitów. To niestabilność testu/gate, nie błąd produktu.

## Oceny modułów (6 podocen + agregat ważony)

Wagi: Security ×3, Architect ×2, SeniorSWE ×2, QA ×2, UI/UX ×1, Product ×1 (suma 11).

| #   | Moduł                                             | SWE | Arch | UI/UX | Product | Security | QA  | **Agregat** | Top-dowód                                                       | Resztkowe ryzyko                                   |
| --- | ------------------------------------------------- | --- | ---- | ----- | ------- | -------- | --- | ----------- | --------------------------------------------------------------- | -------------------------------------------------- |
| 1   | Auth / ownership / CSRF / limity / idempotencja   | 8   | 8    | 7     | 7       | 9        | 9   | **8.3**     | `csrf.ts:40-50`, `ownership.ts:9-34`, `auth.ts:99-138`          | rate-limit in-memory; `trust proxy=1`              |
| 2   | API core (routing, walidacja, błędy)              | 7   | 7    | 8     | 8       | 8        | 8   | **7.6**     | `mountRoutes.ts:65-124`, `app.ts:215-244`, `errorHandler.ts:52` | routes-as-service (213× `prisma.*` w routes)       |
| 3   | Offer Rury                                        | 6   | 6    | 7     | 8       | 8        | 7   | **7.0**     | `ruryCrud.ts:231-268` (read-then-write numer)                   | brak UNIQUE numeru; handler 425 l.                 |
| 4   | Offer Studnie                                     | 5   | 6    | 7     | 8       | 8        | 7   | **6.8**     | `studnieCrud.ts:1136-1176` (PUT bez history/stamp)              | PUT ślepy na audit; 1252 l.                        |
| 5   | Zamówienia (rury+studnie, produkcja, numeracja)   | 7   | 7    | 7     | 7       | 8        | 8   | **7.5**     | `numbering.ts:32-94` (atomowy claim), `production.ts:417-451`   | rury PATCH lost update; GET ciągnie pełne `data`   |
| 6   | Kartoteka / klienci / kontakty                    | 7   | 6    | 7     | 6       | 8        | 7   | **7.0**     | `clientManager.js:486-502` (klienci tylko w kreatorze)          | brak osobnego ekranu klientów                      |
| 7   | Cenniki (LIVE/Default/JSON/F1/preco)              | 8   | 7    | 7     | 7       | 8        | 8   | **7.6**     | `priceOverrideService.ts:270-307`, `validation.ts:76-85`        | race locków między 4 route'ami                     |
| 8   | **Excel — edytor wirtualny**                      | 6   | 5    | 7     | 8       | 7        | 7   | **6.5**     | `excelVirtual.js:348-371` (kill-switch), `:1044` (Ctrl+A bug)   | a11y kolumn 4/10; 2127 l. `excelCopyPaste.js`      |
| 9   | **Excel — import/eksport XLSX**                   | 7   | 6    | 7     | 8       | 7        | 7   | **6.9**     | `xlsxImportShared.js:126-134`, `externalImport.js:57-125`       | round-trip gubi geometrię; duplikat escapeHtml     |
| 10  | Eksport PDF/DOCX + szablony                       | 7   | 7    | 7     | 8       | 7        | 8   | **7.3**     | `pricelist/export.ts:58` (I-008), `kartaBudowy.ts` 39/39 escape | 2 nieescapowane interpolacje PDF                   |
| 11  | DB schema / migracje / backup / seed              | 7   | 7    | 8     | 8       | 8        | 8   | **7.6**     | `backup.ts:70-104`, `restore-db.js:100-113`; 31 migracji        | 56 modeli, tylko 6 `@relation`                     |
| 12  | AI/ML telemetria + transfer                       | 8   | 8    | 8     | 7       | 9        | 8   | **8.2**     | `archiveGate.ts:161-239`, `importModel.ts:114-131`              | ciche fallbacki P3; płytka walidacja typów         |
| 13  | Opieka (care)                                     | 7   | 7    | 8     | 7       | 8        | 7   | **7.4**     | `carePanel.js:1169-1195` (bezpieczny DOM), `care.ts:47-80`      | duży plik; brak runtime ETag                       |
| 14  | Settings / admin / users / shares / locks / flags | 8   | 8    | 7     | 7       | 9        | 8   | **8.1**     | `settings.ts:120-132` (allowlista), `shares.ts:113-146`         | flags bez limitera; `/for-assignment` PII          |
| 15  | Frontend SPA shell / router / iframe              | 7   | 7    | 6     | 7       | 8        | 7   | **7.2**     | `router.js:185-252` (dirty-guard), `style.base.css:969-974`     | mobile nav znika ≤700 px                           |
| 16  | Frontend moduł Rury                               | 7   | 6    | 6     | 7       | 7        | 7   | **6.5**     | `orderPrzejscia.js:24,34` (zepsuty `<thead>`)                   | a11y, PEHD ciche no-op                             |
| 17  | Testy / QA / E2E / bramy                          | 8   | 7    | 8     | 8       | 8        | 7   | **7.8**     | `setupDbIsolation.ts:18-24`, `ci.yml:100-101`                   | `test:e2e` zepsuty; 4/6 spec bez bramy             |
| 18  | DevOps / CI / release / Docker / docs / ADR       | 8   | 8    | 8     | 8       | 8        | 8   | **8.0**     | `ci.yml` 6 workflow, `Dockerfile:31-33`, 16 ADR                 | `spa-guard.cjs` niespięty; docs/plans 49 aktywnych |

**Średnia: 133.3 / 18 = 7.4.**

## Findings — P0

**Brak.** Zweryfikowane czyste: CSRF fail-closed, CSP-E nonce dla skryptów, IDOR/ownership fail-closed, brak hardcoded sekretów, parametryzacja Prisma, restore z integrity check.

## Findings — P1 (17)

### Bezpieczeństwo / dane

1. **`DATABASE_URL` cichy fallback** — `src/prismaClient.ts:42-44`. Brak env → `file:../data/app_database.sqlite`. Narusza „brak fallbacku do domyślnego DATABASE_URL". Fix: `throw new Error('DATABASE_URL required')`.
2. **Race numeru oferty (I-004)** — `ruryCrud.ts:231-268`, `studnieCrud.ts:621-635`; `schema.prisma:340,374` tylko `@@index`, brak UNIQUE. Dwa równoległe POST zapiszą duplikat. Fix: `@@unique` + `P2002 → 409`.
3. **`offers_rel.pricelistVersionId` bez FK** — `schema.prisma:334,368`. Freeze wersji tylko app-level (`lifecycle.ts:583-588`). Fix: migracja wzorcem `20260929000000_fk_pricelist_version`.

### Kontrakt / audyt

4. **`PUT /studnie` bez audit + history + pieczątki** — `studnieCrud.ts:941-1214`; create/update `:1136-1176` bez `history`, bez `pricelistVersionId`, brak `logAudit`. Edycja znika z audytu. Fix: wspólny builder POST/PUT.
5. **`logAudit` poza transakcją i bez `await`** — `ruryCrud.ts:357-375`, `studnieCrud.ts:789-798`. Phantom audit przy rollbacku. Fix: `await logAudit(..., tx)` jak w `production.ts:357-375`.

### Architektura

6. **ADR-004 rozjechany z kodem** — 213× `prisma.*` w `src/routes`, 16 plików route bez importu z `services`. Fix: ratchet w `check-global-collisions.mjs` + amendment ADR + ekstrakcja 3 najgorętszych.
7. **`spa-guard.cjs` niespięty z żadnym gate** — `tests/playwright/spa-guard.cjs` istnieje, 0 referencji w `package.json`/CI. Fix: `test:spa-guard` + krok w `e2e-extended`.
8. **Błędy Prisma klasyfikowane regexem** — `errorHandler.ts:29` (`/locked|busy|timeout/`), 0 użyć `PrismaClientKnownRequestError`. Fix: `mapPrismaError(res, err)` przed regexem + `P2034 → 429`.

### Cenniki

9. **Cross-module race locków** — 4 osobne `createModuleLock()` (`productsV2.ts:28`, `productsStudnieV2.ts:27`, `precoPricingV2.ts:27`, `priceOverrides.ts:9`); `buildPricePackage()` czyta LIVE poza tx → torn snapshot. Fix: jeden współdzielony `pricelistLock`.

### Excel (protected zone)

10. **Ctrl+A >1000 wierszy gubi zaznaczenie po scrollu** — `excelVirtual.js:1044` czyści `_excelSelectedCells`, render `:656-665` nie odtwarza range. Fix: użyć istniejącej `_excelVirtualIsCellSelected(logicalRow, colId)` (`:1083-1089`).
11. **Zarządzanie kolumnami niedostępne z klawiatury** — menu tylko `contextmenu` (`excelSelection.js:33-40`), itemy bez `role=menuitem`/`tabindex` (`excelColumnContextMenu.js:50-62`), resize tylko mysz (`excelColumnResize.js:52-178`). Fix: role + strzałki/Enter + `aria-valuenow`.

### Bramy jakości

12. **`npm run test:quick` niestabilny** — `pricelistChunk.test.ts:19` timeout 60 s pada pod pełnym równoległym suite; solo PASS 20 s. Fix: `--runInBand` dla tego pliku lub timeout 120 s + retry 1.
13. **`npm run test:e2e` zepsuty** — `playwright.config.ts:13` `testMatch: ['**/*.cjs','**/*.spec.ts']` zbiera 30 harnessów. `npx playwright test --list` → `Error: should not import test file`. Fix: `testMatch: ['**/*.spec.ts']`.
14. **4/6 spec E2E bez bramy** — `carePanel*.spec.ts`, `aiDashboardSmoke.spec.ts` nieuruchamiane w CI ani pre-push. Fix: dodać do `e2e-extended`.

### UI/UX / Product

15. **Mobile: znika nawigacja sekcji i nazwy linków** — `style.base.css:944,969-974` (≤700 px chowa `.header-center` i `.nav-tile-text` bez `aria-label`). Fix: `display:flex + overflow-x:auto` + `aria-label`.
16. **Zepsuty markup tabeli przejść** — `orderPrzejscia.js:24` (`<th scope="col"ead>`) i `:34` (`</thead>` bez otwarcia). Fix: poprawny `<thead>`.
17. **Klienci i „produkcja" niedomknięte produktowo** — `router.js:255-285` brak modułu `klienci`; `zleceniaRender.js:23-35` tylko `draft|accepted`. Fix: decyzja produktowa — dodać ekran klientów + `productionStatus` albo zmienić etykiety i usunąć obietnicę.

## Findings — P2 (wybór)

- `PUT` ofert nie bumpuje `updatedAt` — `ruryCrud.ts:761-774`, `studnieCrud.ts:1154-1168`; sortowanie/keyset kłamie.
- `ruryOrders` PATCH bez `baseUpdatedAt` → lost update — `ruryOrders.crud.ts:356-410`.
- `production.ts:129-181` GET `/` ciągnie pełne `data` (blob MB) — `productionSearch.ts:64` już tego unika.
- PDF: nieescapowane `{{NR_OFERTY}}` i `VALIDITY_SECTION` — `ruryHtml.ts:256-257`, `studnieHtml.ts:219-220`.
- PDF: duplikacja math ceny/rabatu — `ruryHtml.ts:126-146`; brak SSoT `computeUnitPriceNetto`.
- `trust proxy` default 1 → spoofowalne IP — `app.ts:61`.
- CSP report-only zawiera `script-src-attr 'unsafe-inline'`, enforce nie — `security.ts:87` vs `app.ts:225-229` (monitoring ślepy).
- `/api/feature-flags` bez limitera — `mountRoutes.ts:102`.
- FE auto-dobór po wklejeniu studni: 4× `catch(function(){})` — `excelTableManager.js:793,798,811,839`; cisza przy zapisanej studni bez komponentów.
- Duplikat `escapeHtml` poza SSoT — `xlsxImportShared.js:126-134`.
- E2E harnessy domyślnie `:3000` — `excelVirtualParity.cjs:17`, `excelDomGolden.cjs:29`, `excelVisualGate.cjs:22`, `excelOpenPerf.cjs:29`, `excelHeapProbe.cjs:15`.
- Flake detection bez egzekucji — `ci.yml:172-179` (`|| true`), `playwright.config.ts:17` (`retries:0`).
- A11y: brak `aria-current` na aktywnej sekcji — `router.js:351-359`; PEHD bez `aria-pressed` — `offerRendering.js:206-207`; pola liczbowe bez `aria-label` — `:189-196`.
- Plan hygiene: 49 aktywnych plików w `docs/plans/`, 6 wersji jednego planu Excel.
- Collisions baseline 45 = zmierzone 45, zero zapasu (`check-global-collisions.mjs`).

## Findings — P3 (wybór)

- `httpsRedirect` z `req.headers.host` (open-redirect) — `security.ts:28`.
- Log surowego CSP report bez escape CRLF — `mountRoutes.ts:60`.
- `/for-assignment` zwraca email/phone wszystkich userów — `users.ts:259-274`.
- Brak account-lockout — `auth.ts:32-42` (tylko in-memory IP+login).
- Płytka walidacja typu importu ML — `dataset.ts:96-124`, `knowledge.ts:62-78`.
- `ensureActiveVersions` catch-all → start z brakiem ACTIVE bez logu — `:191-193`.
- `pricelist/usage.ts` błąd odczytu = „brak wersji" — `:76-83`.
- `parseFeatureSnapshot` zły JSON → `totalPrice:0` bez logu — `:16-17`.
- `trainingUsers` fail-open (błąd allowlisty = wszyscy) — `:20-22`.
- Excel: 342× `window.*`, 79 top-level `let`, `excelCopyPaste.js` 2127 l.
- Excel: localStorage swallow — `excelState.js:167,187,225,280,321,342,445`.
- Docs: liczby legacy w AGENTS.md nieaktualne (window 1731/4025 vs „~1434"); `onclick` inline = 0 (CSP-E wygrał).
- Ikony-glyphy zamiast Lucide — `carePanel.js:1188-1192`, `clientManager.js:544,819`.
- Inline styles w empty states — `kartotekaSearch.js:269`, `orderPrzejscia.js:19,52`.
- Logo SVG bez `<title>/<desc>`, hardcoded hex — `logo-sok.svg`.

## Excel — deep-dive (moduły 8 + 9)

| Podmoduł               | Ocena | Dowód                                                                                                 | Uwaga                                                    |
| ---------------------- | ----- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Wirtualizacja          | 8     | `excelVirtual.js:11` (32 px), `:15` (overscan 20), `:348-371` (kill-switch), `:646-653` (`data-widx`) | double-render + ręczny restore fokusu = kruche           |
| Copy/paste + mismatch  | 8     | `excelVirtual.js:946-1016`, `excelPasteMismatch.js:9-45`                                              | stan w `window._excelVirtualSelectionRange` poza modelem |
| Undo/redo              | 8     | `excelUndo.js:1-75` (patch/batch + structuredClone + ewikcja)                                         | koszt `structuredClone` per komórka                      |
| Nawigacja klawiaturą   | 7     | `excelVirtual.js:186-222`                                                                             | dubluje legacy dla parity                                |
| Zaznaczanie            | 6     | `excelVirtual.js:1042-1052`, `:656-665`                                                               | **P1: Ctrl+A >1000 gubi highlight po scrollu**           |
| Kolumny / DnD / a11y   | 4     | `excelSelection.js:33-40`, `excelColumnContextMenu.js:50-62`, `excelColumnResize.js:52-178`           | tylko mysz; brak DnD kolumn                              |
| I-002 refresh L0/L1/L2 | 8     | `excelChangeHandlers.js:330-339,588-590,638-640,1028-1030,1173-1175`                                  | poprawnie spięte                                         |
| XLSX round-trip + XSS  | 7     | `externalExportTemplate.js:73-87` = `externalImport.js:57-125`, `xlsxImportShared.js:126-178`         | gubi geometrię; duplikat escapeHtml                      |
| Dług techniczny        | 4     | 342× `window.*`, 79 `let`, `excelCopyPaste.js` 2127 l.                                                | lexicals cross-file + sync-hacki                         |

**Moduł Excel: 6.5/10.** Runtime solidny (brak P0), realne luki: a11y kolumn, zaznaczanie >1000, dług cross-file.
**Testy Excel:** parity OFF/ON, bench, golden DOM, 44 unity studnie — mocne, ale parity/bench/golden wymagają serwera i **nie biegną w `test:quick`/pre-push**. Brak E2E XSS payloadu w komórce.

## Evidence Ledger

| ID    | Twierdzenie                                 | Dowód                                              | Status         |
| ----- | ------------------------------------------- | -------------------------------------------------- | -------------- |
| E-001 | Brak P0 (security/auth/data)                | 6 agentów read-only + bramy                        | VERIFIED       |
| E-002 | Worktree czysty, wersja spójna              | `git status`, `version:check` EXIT 0               | VERIFIED       |
| E-003 | `test:quick` = 1 fail (flake)               | 493 pass / 1 fail; solo `pricelistChunk` PASS 20 s | VERIFIED       |
| E-004 | `offer_number` bez UNIQUE                   | `schema.prisma:340,374` tylko `@@index`            | VERIFIED       |
| E-005 | `pricelistVersionId` bez FK                 | `schema.prisma:334,368`; 6 `@relation` / 56 modeli | VERIFIED       |
| E-006 | `pricelistVersionService.ts` = barrel 70 l. | pomiar linii (nie 1594)                            | VERIFIED       |
| E-007 | 31 migracji                                 | `Get-ChildItem prisma/migrations` = 31             | VERIFIED       |
| E-008 | `DATABASE_URL` fallback                     | `src/prismaClient.ts:42-44`                        | VERIFIED       |
| E-009 | `test:e2e` zepsuty                          | `playwright.config.ts:13` + `--list` error         | VERIFIED       |
| E-010 | 4/6 spec E2E bez bramy                      | 0 ref w `.github` i `.husky/pre-push`              | VERIFIED       |
| E-011 | Excel 28 plików, 342× `window.*`            | pomiar `excel*.js`                                 | VERIFIED       |
| E-012 | Ctrl+A bug >1000                            | `excelVirtual.js:1044` + `:656-665`                | VERIFIED (kod) |
| E-013 | CSP-E nonce dla skryptów                    | `app.ts:225-229`                                   | VERIFIED       |
| E-014 | Pricing 4 osobne locki                      | `productsV2.ts:28` i 3 pozostałe                   | VERIFIED       |
| E-015 | Coverage 77.6/72.3/76.5                     | `coverage-summary.json`                            | VERIFIED       |
| E-016 | Mobile nav znika ≤700 px                    | `style.base.css:969-974`                           | VERIFIED (kod) |
| E-017 | PDF 2 nieescapowane interpolacje            | `ruryHtml.ts:256-257`, `studnieHtml.ts:219-220`    | VERIFIED (kod) |
| E-018 | Delta vs 7.7 na wspólnym zakresie ~7.5      | wyliczenie z podocen                               | INFERENCE      |

## Roadmap 90 dni

**Tydzień 1–2 (bramy, ~6 h)**

1. `playwright.config.ts` `testMatch` → tylko `*.spec.ts` (P1-13).
2. `pricelistChunk` → `runInBand`/timeout 120 s (P1-12).
3. 4 brakujące spec E2E do `e2e-extended` (P1-14).
4. `DATABASE_URL` throw (P1-1).
5. `mapPrismaError` w `errorHandler` (P1-8).

**Tydzień 3–4 (dane/kontrakt, ~10 h)** 6. `@@unique(offer_number)` + P2002→409 (P1-2) — migracja + test regresyjny. 7. Wspólny builder POST/PUT studnie: history + `pricelistVersionId` + `logAudit(tx)` (P1-4/5). 8. Jeden `pricelistLock` (P1-9). 9. Migracja FK `offers_rel.pricelistVersionId` (P1-3).

**Tydzień 5–6 (Excel + UI, ~12 h)** 10. Fix zaznaczania >1000 przez `_excelVirtualIsCellSelected` (P1-10). 11. Menu kolumn: `role=menuitem` + klawiatura + `aria-valuenow` (P1-11). 12. Mobile nav `aria-label` + `overflow-x:auto` (P1-15). 13. `orderPrzejscia.js` poprawny `<thead>` (P1-16). 14. PDF: 2× `escapeHtml` + `setJavaScriptEnabled(false)` (P2).

**Tydzień 7–12 (architektura/produkt, ~24 h)** 15. Ratchet ADR-004 + `test:spa-guard` w CI (P1-6/7). 16. Ekstrakcja 3 najgorętszych route'ów do services (inkrementalnie). 17. Decyzja produktowa: ekran klientów + `productionStatus` (P1-17). 18. Higiena: `docs/plans` → archive; docs↔kod liczby legacy.

## Ograniczenia audytu

- Statyczna analiza kodu + bramy; **brak runtime przeglądarki** (375/768/1024/1440, kontrast, overflow) — oceny UI/UX z kodu, oznaczone jako `INFERENCE` tam, gdzie wymagają renderu.
- Nie uruchamiano pełnego `npm run validate` (zawiera `test:quick`, który ma flake); uruchomiono komponenty osobno.
- Oceny podocen to synteza 6 agentów; część wymiarów (np. Product dla modułów backendowych) to `INFERENCE`, nie pomiar.
- Brak dostępu do konfiguracji produkcyjnego deploy (`.env`, Caddy) — `TRUST_PROXY`/`DATABASE_URL` na prod = `UNVERIFIED`.
