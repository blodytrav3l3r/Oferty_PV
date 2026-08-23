# Plan napraw po audycie v1.18.3 — S.O.K. (wykonanie krok po kroku)

**Data:** 2026-08-23  
**Wersja audytowana:** `1.18.3` (`VERSION`, `package.json`, tag `v1.18.3` `2de63c8`)  
**Audyt:** `docs/plans/archive/2026-08-23-audyt-ui-ux-plan-naprawy.md` (7.6/10, 6 faz; 5 commitów `e9dfae9`→`26b035e` wypchnięte)  
**Cel:** 7.6 → 9.0/10 — domknięcie 5 luk krytycznych bez regresji, każdy krok 1-2 pliki, `validate` + `version:check` po każdym.

---

## 0. Stan po audycie (skrót)

| Obszar         | Po audycie | Luka do 9.0                                                                      |
| -------------- | ---------- | -------------------------------------------------------------------------------- |
| UI/UX          | 8.2        | `modals.html` 30+ inline → `modalCore`                                           |
| HTML           | 7.8        | `modals.html` + `kartoteka` filter-bar/search/card (12 inline)                   |
| CSS            | 7.5        | Martwe `~150` linii `fs-*/ui-*`, sticky `z-index` literale                       |
| Testy          | 6.5        | `public/js` 0% (fs read, nie import), `pdf/kartaBudowy 2.77%`, `e2e/axe` poza CI |
| Spójność       | 8.0        | OK — `1.18.3` SSoT, `commitlint` 8/8                                             |
| Rozmieszczenie | 7.5        | `23` pliki >500, `ponytail:` dla `solverAutoSelect`/`excelHelpers`               |
| Zgodność       | 7.5        | Tokeny/LAYERS/Lucide/escape 100%, `modals.html` poza SSoT                        |

`validate` (`typecheck` + `lint` + `test:quick` 142 testy) ✓, `version:check` ✓, `encoding:check` 1527 OK ✓.

---

## 1. Fazy napraw (kolejność RICE, każda 1-2 pliki)

### Faza A — `modals.html` → `modalCore.js` (P0, 1 dzień, 2 pliki)

**Pliki:** `public/partials/studnie/modals.html:6,99` + `public/js/studnie/*` (np. `popupsTransitionManager.js` lub `wellTransitions.js` caller) + `public/css/style.responsive.css:464` (`.modal-overlay/.modal`)

**Stan:** `modals.html:6` `style="display:none;justify-content:center;align-items:center"` + `10` `background:var(--bg-secondary);border:1px...max-width:820px` + `20` header `display:flex...background:linear-gradient` + `33` title + `46` button + `54` body + `60` footer — łącznie `30+ style=`; `display:none` zamiast `.hidden`; `z-index:10000` już usunięte w `e9dfae9` (teraz `display:none` bez `z-index`), ale nadal inline i bez `role=dialog`/`aria-modal`/`LAYERS.GENERIC_MODAL_*`.

**Docelowo:** każdy modal otwierany wyłącznie przez `public/js/shared/modalCore.js:82` `showModal({id,titleId,html,onClose})` → `<div class="modal-overlay js-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="...">` + `<div class="modal">` (`style.responsive.css:473` `max-width:550px`). Zamknięcie `Esc` + `overlay click` + `trapFocus` + `focusRestore` z `modalCore.js:35-69`.

**Kroki:**

1. W `public/partials/studnie/modals.html` usunąć `2` overlaye `offer-discounts-modal`/`offer-transport-modal` (linie `3-450`): zastąpić pustym `<div id="partial-modals"></div>` (ładuje `partialLoader.js`), a treść przenieść do JS callerów jako `html` string dla `showModal`.
2. W callerach (np. `public/js/studnie/offerDiscountsPopup.js` + `public/js/studnie/offerTransport.js`) zamienić `overlay.style.display='flex'`/`'none'` + `z-index` na `showModal({id:'offer-discounts-modal', titleId:'...', html: '<div class=modal>...'})` + `closeModal(id)` + `LAYERS.GENERIC_MODAL_BACKDROP` (2000) jeśli potrzebny custom `z-index`.
3. Usunąć inline `style=` z wnętrz (przenieść do `public/css/studnie/modal.css:1-789` jako `.offer-discounts-header/body/footer` lub użyć istniejących `.modal-header/.modal-body/.modal-footer` z `style.responsive.css:483-499`).
4. Dodać `role="dialog"` + `aria-modal="true"` + `aria-labelledby` na overlay (robi `modalCore.js:88-91`).

**Weryfikacja:** `rg "style=" public/partials/studnie/modals.html` → 0 (poza `var(--*)` w CSS), `rg "z-index: 10000"` → 0, `npm run lint:frontend` 2 warnings, manual `Esc` + `overlay click` + `Tab` trap + `axe` 0 violations, `375/768/1024/1440` brak poziomego scrolla.

**Ryzyko:** średnie — `zlecenia` modal (`#zlecenia-modal:453`) ma własny `zlecenia-overlay` z `z-index:10` header + `540` buttony inline `background:rgba(...)` — nie ruszać w tej fazie (osobny overlay, nie `modalCore`).

**Effort:** S (1 dzień, 2 pliki: `modals.html` + `offerDiscountsPopup.js`).

---

### Faza B — Martwe CSS `~150` linii → `purgecss` (P1, 0.5 dnia, 2 pliki)

**Pliki:** `public/css/studnie.css:1586-1643` (`.fs-085/.fs-075/.fs-065/.fs-09/.fs-08/.fs-078/.fs-07/.fs-072/.fs-06/.fs-055/.fs-058/.fs-1/.fs-115/.fs-14` + `.fw-5/.fw-6/.fw-7/.fw-8` + `gap-1` duplikat) + `public/css/style.responsive.css:1179-1249` (`.ui-text-muted-sm/.ui-badge/.ui-col-5/6/8/.ui-row-gap/.ui-center-min` + `wizard` duplikaty) + `public/css/style.utilities.css:18` (`.flex-1-180-hidden`).

**Stan:** `rg "fs-085"` 0 poza definicją, `rg "ui-text-muted-sm"` 0 — martwe, nie blokują, ale `+150` linii bloat.

**Kroki:**

1. `npx purgecss --content "public/**/*.html" --css "public/css/studnie.css" "public/css/style.responsive.css" "public/css/style.utilities.css" --rejected` dry-run → lista `rejected` (oczekiwane: `fs-085` 14×, `ui-*` 12×, `flex-1-180-hidden`).
2. Skasować `studnie.css:1586-1643` (58 linii) + `style.responsive.css:1179-1249` (70 linii) + `style.utilities.css:18-22` (5 linii) — łącznie `~133` linii. Zostawić `gap-1..gap-4` + `flex-center` (używane).
3. Sprawdzić `rg "flex-1-180-hidden"` przed kasowaniem — jeśli 0, usunąć; jeśli 1 (np. `step4-build-card.html` — nie, `flex-1-180` bez `-hidden`), usunąć.

**Weryfikacja:** `npm run format` + `npm run lint:frontend` ✓, `npx purgecss` `rejected` 0 po kasowaniu, `screenshotsBaseline.cjs` brak regresji.

**Ryzyko:** niskie — `purgecss` dry-run chroni przed fałszywym kasowaniem; `wizard` `gap-1` używany w `studnie.html:38`.

**Effort:** S (0.5 dnia, 2 pliki CSS).

---

### Faza C — `public/js` coverage `0%` → `30%` (P1, 2 dni, 3 pliki)

**Stan:** `jest.config.ts:16-32` `projects backend(node)/frontend(jsdom)` + `jest-environment-jsdom:30.4.1` + `tests/frontend:3` (`modalCore:3`, `modalCoreDom:4`, `ruryOfferRendering:2`) — `14` tests, ale `collectCoverageFrom` tylko `src/**/*.ts` → `public/js` 0%. Testy `fs.readFileSync` + regex lub syntetyczny `div.modal-overlay` — nie importują `public/js/shared/modalCore.js` ani `public/js/rury/wizard.js:1-267` (`goToPhase`, `getSortedRuryItems`).

**Kroki:**

1. Rozszerzyć `jest.config.ts:9` `collectCoverageFrom` na `['src/**/*.ts', 'public/js/**/*.js']` + `coverageDirectory: 'coverage/frontend'` dla projektu `frontend` (osobny `coverageReporters`).
2. Dodać `tests/frontend/ruryWizard.test.ts` (jsdom, `vm` + `fs` — wzorzec `tests/studnie/excelDrilledRings.test.ts:1-184`): `goToPhase(3)` → `document.getElementById('wizard-step-3').classList.contains('active')`, `getSortedRuryItems` z `public/js/rury/productHelpers.js:73` (już `window.getSortedRuryItems`).
3. Dodać `tests/frontend/modalCoreReal.test.ts` (jsdom, `import { showModal } from '../../public/js/shared/modalCore.js'` — `type: module` + `tsconfig.frontend.json: allowJs`): `showModal({id:'test', titleId:'t', html:'<div class=modal>...'})` → `document.querySelector('.js-modal-overlay[role=dialog]')` + `trapFocus` `Tab` + `Escape` close.
4. Przenieść `modalCoreDom.test.ts` z syntetycznego `div` na realny `import`.

**Weryfikacja:** `npm run test -- --coverage` `public/js` `30%` (pierwszy próg), `npx jest tests/frontend --no-coverage` 18 tests, `npm run lint:frontend` 2 warnings, `npm run typecheck:frontend` ✓.

**Ryzyko:** średnie — `public/js` `window.*` globals 737, kolejność `studnie.html:298` `shared/* → globals.js → ...` — `import` ESM wymaga `type: module` + `tsconfig.frontend.json: checkJs:false` (już `strict:false`).

**Effort:** M (2 dni, 3 pliki: `jest.config.ts`, `tests/frontend/ruryWizard.test.ts`, `tests/frontend/modalCoreReal.test.ts`).

---

### Faza D — `src/services/pdf/kartaBudowy:2.77%` → `40%` (P1, 1 dzień, 2 pliki)

**Pliki:** `src/services/pdf/kartaBudowy.ts:1-505` (`buildKartaBudowyBaseHtml:11-129` 14× `escapeHtml` + `przejsciaDetails` tabela + `generateKartaBudowyPDF:131-425` `prisma.orders_studnie_rel.findUnique` + `productsStudnieDefault.findMany` + `generatePDF` + `generateKartaBudowyRuryPDF:427-505`) + analogicznie `src/services/docx/studnie/kartaBudowy.ts:9.63%` + `rury/kartaBudowy:14.35%` + `builder:16%`.

**Stan:** `tests/kartaBudowy.test.ts:1-57` 3 testy (`generuje PDF`, `duży payload`, `rzuca gdy brak`) + `tests/kartaBudowyCoverage.test.ts:1-22` `fs.readFileSync` placeholder — `coverage-summary.json:74` `14/505` linii.

**Kroki:**

1. Rozszerzyć `tests/kartaBudowy.test.ts` o 3 testy: `przejsciaDetails` tabela (mock `prisma.orders_studnie_rel.findUnique` z `kartaBudowy: { przejsciaDetails: [{rodzaj:'A', dnOd:'100', dnDo:'200', uwagi:'test'}] }` + `productsStudnieDefault.findMany` z 2 produktami `krag` + `dennica`), `Rzeczywista ilość przejść` (`wells: [{config:[{productId:'KREG-1000-500', quantity:2}], przejscia:[{productId:'PRZEJSCIE-160', rzednaWlaczenia:'10'}], rzednaDna:'0', rzednaWlazu:'3'}]`), `generateKartaBudowyRuryPDF` z `orders_rury_rel` + `items: [{name:'Rura DN300', productId:'RURA-300', quantity:5, orderedQuantity:3}]`.
2. Dodać `tests/docxKartaBudowy.test.ts` dla `src/services/docx/studnie/kartaBudowy.ts` + `rury/kartaBudowy.ts` — mock `fs.readFileSync` template + `prisma` + `docx` `Packer.toBuffer` (już `docx:9.6.1`).
3. Sprawdzić `coverage-summary.json` `pdf/kartaBudowy` `>40%` (pierwszy próg), `docx/*kartaBudowy` `>30%`.

**Weryfikacja:** `npm run test -- --coverage` `pdf/kartaBudowy` `>40%`, `npx jest tests/kartaBudowy --no-coverage` 6 tests, `npm run lint` ✓.

**Ryzyko:** niskie — `pdf/kartaBudowy` `buildKartaBudowyBaseHtml` `fs.readFileSync` template `public/templates/kartaBudowy.html` — mock `fs` + `resolvePublicDir`.

**Effort:** M (1 dzień, 2 pliki: `tests/kartaBudowy.test.ts`, `tests/docxKartaBudowy.test.ts`).

---

### Faza E — CI `e2e`/`axe` (P2, 0.5 dnia, 1 plik)

**Stan:** `playwright.config.ts:5` `['**/*.cjs','**/*.spec.ts']` + `tests/playwright/a11yAxe.spec.ts:1-24` `2` testy `wcag2a/aa` + `@axe-core/playwright:4.13` + `package.json:17-18` `test:e2e`/`test:axe` — nie w `validate` (108s timeout), nie w `pre-push` (Husky `pre-push` uruchamia `version:check` + `encoding:check` + `typecheck` + `test:quick` — `playwright` poza).

**Kroki:**

1. Dodać job `e2e` w `.github/workflows/ci.yml` (jeśli istnieje) lub `docs/DEPLOYMENT.md` wzmiankę: `npm run test:e2e` + `npm run test:axe` jako osobny job `needs: lint` (nie blokuje `validate`).
2. W `package.json:19` `validate` zostawić bez `test:e2e` (ponytail: `validate` <2min), dodać `validate:full` z `test:e2e` dla release.
3. Sprawdzić `npx playwright test tests/playwright/a11yAxe.spec.ts --project=chromium` lokalnie (wymaga `npx playwright install`).

**Weryfikacja:** `npx playwright test --list` 2 testy, `npm run test:axe` exit 0.

**Ryzyko:** niskie — `webServer` `reuseExistingServer:true` + `url: /health`.

**Effort:** S (0.5 dnia, 1 plik: `.github/workflows/ci.yml` lub `package.json`).

---

## 2. Kolejność RICE

| Pri | Faza                          | Effort | Ryzyko  | Zysk                                     |
| --- | ----------------------------- | ------ | ------- | ---------------------------------------- |
| P0  | A `modals.html` → `modalCore` | S      | średnie | wysoki — usuwa 30+ inline, SSoT          |
| P1  | C `public/js` 0%→30%          | M      | średnie | krytyczny — guard przed regresją #16-#33 |
| P1  | D `kartaBudowy` 2%→40%        | M      | niskie  | wysoki — wydruki                         |
| P1  | B martwe `~150` linii         | S      | niskie  | średni — `-133` linii                    |
| P2  | E CI `e2e`/`axe`              | S      | niskie  | średni — a11y                            |

**Najmniejszy krok do 8.5/10:** A + C (1.5 dnia).

---

## 3. Weryfikacja po każdej fazie

- `npm run format` + `npm run lint` + `npm run lint:frontend` + `npm run typecheck` + `npm run typecheck:frontend` — 0 error, 2 warnings pre-existing
- `npm run test:quick` — 142→148 tests (po C: 18, po D: 24)
- `npm run version:check` + `npm run encoding:check` — EXIT 0
- Manual `375/768/1024/1440` brak poziomego scrolla, `Esc`/`overlay click`/`Tab` trap, `rg "z-index: 10000"` 0, `rg "style=" public/partials/studnie/modals.html` 0

---

## 4. Skipped (YAGNI, add gdy)

- Pełny `Chromatic`/`Percy` visual diff — add gdy `purgecss` + `screenshotsBaseline.cjs` niestabilne
- ESM `type: module` + `import map` dla `window.*` 737 — add gdy `studnie.html:157` kolejność pęka
- Token `--gap-*` — add gdy `gap: 2rem` powtarza się >5×

---

## 5. Aktywacja

```bash
npm run validate
# Faza A
# ... edytuj 2 pliki, sprawdź ...
npm run version:check && npm run encoding:check
git add -A && node scripts/commit.mjs "refactor(studnie): przenies modals do modalcore" "30+ inline -> modal-overlay/modal, LAYERS"
# Faza B, C, D, E — analogicznie, każdy commit 1-2 pliki
npm run release:patch
git push --follow-tags
```

Plan archiwizowany po wykonaniu wszystkich faz: `git mv docs/plans/2026-08-23-plan-napraw-po-audycie-v1.18.3.md docs/plans/archive/`
