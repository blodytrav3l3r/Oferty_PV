# Audyt UI/UX, HTML, CSS — S.O.K. — plan naprawy

**Data:** 2026-08-23
**Zakres:** `public/css/*.css`, `public/*.html`, `public/partials/**/*.html`, `public/js/**/*.js`, `tests/**`, `coverage/`, zgodność z `docs/UI_GUIDELINES.md` i `AGENTS.md`
**Tryb:** audit read-only — bez edycji kodu. Dane: static read + `coverage-summary.json` + grep.
**Wersja audytowana:** `1.18.2` (`VERSION`, `package.json`)

---

## 1. Oceny 1-10

| Obszar                        | Ocena  | Uzasadnienie skrót                                                                                                                                                                                                                                                                                        |
| ----------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI/UX                         | 7.5/10 | Tokeny konsekwentne, dark theme spójny, wizard/karty/toasty dopracowane. Minus: sticky/z-index niespójne, modale 2 systemy, brak testu 375px, `* {outline:none}` ryzyko a11y                                                                                                                              |
| HTML                          | 7/10   | Semantyka `header>main>section>card` OK, `app.html:21-91` czyste, `lang=pl`, cache-bust `?v=1.18.2`. Minus: 100+ inline `style=` w `kartoteka.html`, `partials/studnie/modals.html`, brak `title` na iframe SPA, `table` bez `caption/scope` w templates                                                  |
| CSS                           | 6.5/10 | Tokeny `var(--*)` 100% poza `:root` (92 hexy tylko w `style.base.css:5-208`), glass/dark OK, `prefers-reduced-motion` w 6 plikach. Minus: 15 gołych `z-index` poza `LAYERS`, ~190 linii martwe, duplikaty `.mb-0/.flex-row`, pliki >1500 linii (`studnie.css:2496`, `index.css:1963`)                     |
| Testy / pokrycie              | 5.5/10 | Backend 71.23% linii (`coverage-summary.json:1`), 138 testów, VM shims dla Excel/studnie dobre. Minus: `public/js` 0% w lcov (`jest.config.ts:9` tylko `src`), 190/219 JS bez testu, `kartaBudowy.ts:2.77%`, brak `jsdom`, Playwright poza `npm test`, responsive tylko regex, a11y tylko 34 linie        |
| Spójność / profesjonalizm     | 7/10   | SSoT zdefiniowany (`docs/UI_GUIDELINES.md:1-215`), ADR-001..008, `modalCore.js:1-144` wzorzec, `layers.js:8-40` kanon, Prettier/ESLint/Husky. Minus: legacy `shared/ui.js:129` inline modal, 2 overlay systemy, `window` globals 250+ rejestracji                                                         |
| Rozmieszczenie kodu w plikach | 6/10   | ADR-008 częściowo: `wellActions.js:52` shim + 13 `actions*.js` OK, rury 31 plików zbalansowane. Minus: `excelTableManager.js:357` wciąż gruby (cel <150), 23 pliki >500 linii (`aiDashboard.js:1379`, `solverAutoSelect.js:1231`), 18 plików <30 linii szum, `studnie: 137/219` (62%) koncentracja ryzyka |
| Zgodność z wytycznymi         | 6/10   | Kolory/fonts/radius/shadow 95% przez tokeny, Lucide 113 użyć, `escapeHtml` 467 użyć, `LAYERS` 54 użyć. Minus: inline `style=` masowe, z-index twardy w CSS/HTML, modale poza `modalCore`, `typecheck:frontend` `strict:false` pusty guard, `collectCoverageFrom` bez frontendu                            |

**Średnia ważona: 6.5/10** — solidny produkt, baza blisko profesjonalnej. Największe długi: testy frontend/visual + CSS martwe/z-index + pliki >500 linii. Bez P0 ryzyko regresji sticky/modal na 375px i XSS `innerHTML` gap (268 użyć vs 467 escape).

---

## 2. Szczegóły ustaleń

### 2.1 UI/UX

- Plus: `public/css/style.base.css:3-240` tokeny `:root` kompletne (bg/text/accent/success/danger/warn/blue/pink/slate, fs 3xs-8xl, fw 300-900, radius, shadow, blur). `public/css/style.utilities.css:507` + `public/css/style.cards.css:592` single source. Karty, wizard (`public/css/style.responsive.css:1259-1680`), tabele sticky poprawnie. Kontrast 15:1 (slate-100/#0a0e1a), 4.6:1 dla muted — przechodzi 4.5:1.
- Minus P0: `public/css/style.base.css:368` `*:focus{outline:none}` agresywne — ukrywa focus myszy, tylko `:focus-visible` ma zamiennik (`public/css/style.base.css:371`). `public/css/index.css:752` powtarza bez `:focus-visible`. Modal `public/js/shared/ui.js:129` `style="background:var(--bg-tile);min-width:350px"` — inline-styled zamiast `public/js/shared/modalCore.js`. Duplikat overlay `public/css/studnie.css:1294` `.app-confirm-overlay` vs `.modal-overlay` (`public/css/style.responsive.css:461` `z-index:100000` powinno być `var(--z-overlay)`).

### 2.2 HTML

- Plus: `public/app.html:1-117`, `public/index.html`, `public/kartoteka.html`, `public/zlecenia.html`, `public/studnie.html`, `public/rury.html` — `header.inner` + `main` + `section[data-phase]` + `card` + `table-wrap`. `public/app.html:11-16` 6x `?v=1.18.2` synced (`scripts/auto-cache-bust.mjs` postbump). Logo `public/images/logo-sok.svg?v=...` sygnet.
- Minus: grep `style=` >100 w HTML: `public/kartoteka.html:79-486` 25x `display:flex;gap:1rem` zamiast `.flex-wrap-start`/`.flex-gap-*`; `public/partials/studnie/modals.html:6-482` 30x `z-index:10000;display:none` zamiast `.hidden` + `LAYERS.GENERIC_MODAL_BACKDROP` (`public/js/studnie/layers.js:24` 2000); `public/partials/rury/transport-modal.html:3` `z-index:10000`; `public/app.html:71,74` `visibility:hidden`, `min-width:13ch` brak utility; iframe w `public/app.html:94` `#spa-main` bez `title` (a11y). `public/templates/*.html` tabele bez `caption.scope`.

### 2.3 CSS

- Stat: 11 plików, ~14300 linii (bez `public/css/inter.css`), średnia 1100. Rozkład: `public/css/style.base.css:1787`, `public/css/studnie.css:2496` (>1500 limit `AGENTS.md:68`), `public/css/index.css:1963`, `public/css/style.responsive.css:1703`, `public/css/rury.css:1064`, `public/css/zlecenia.css:716`, `public/css/printModal.css:532`, `public/css/style.utilities.css:507`, `public/css/studnie/modal.css:789`, `public/css/studnie/offer.css:390`, `public/css/spa.css:102`.
- Tokeny: grep `#[0-9a-f]` 92 trafienia — wszystkie w `:root`. Reszta `var(--*)`/`rgba(var(--*-rgb),)`. Gołe `px` drobne: `public/css/rury.css:225` `z-index:50`, `public/css/style.responsive.css:749` `z-index:1000000` (toast) zamiast `--z-toast`, `public/css/zlecenia.css:198` `0.2s` zamiast `var(--transition):0.25s`.
- Duplikaty: `.mb-0` `public/css/style.base.css:899` vs `public/css/rury.css:18`, `.text-muted` 3 definicje, `.flex-row` `public/css/style.utilities.css:177` vs `public/css/studnie.css:1646`, `.wizard-nav-fixed` 3 miejsca różne `z-index`. Martwe ~190 linii: `public/css/studnie.css:1586-1720` `.fs-*/.fw-*` (grep 0 użyć), `public/css/style.responsive.css:1167-1203` `.ui-*`, `public/css/style.utilities.css:18` `.flex-1-180-hidden`.
- z-index (P0): `public/css/rury.css:225:50,464:100,542:9999,703:39,795:40,856:99`, `public/css/printModal.css:28:10000`, `public/css/style.base.css:431:100` zamiast `var(--z-header)`, `public/css/style.responsive.css:465:100000,749:1000000` poza skalą `LAYERS` (max 100100). Poprawne: `public/css/studnie/offer.css:120` `z-index:55 /* LAYERS_EXCEL.FOCUS_BORDER */`, `public/css/studnie.css:1303` `z-index:2000 /* GENERIC_MODAL_BACKDROP */`.
- Breakpointy: kanon `docs/UI_GUIDELINES.md:94` 1400/1200/900/768/700/480 — `public/css/studnie.css:99` pełny kanon OK, `public/css/style.base.css:731` używa 1100 zamiast 1200 (rozjazd), `public/css/rury.css:474` `repeat(6,1fr)` na 375px bez bp (overflow risk), `public/css/style.responsive.css:80` ukrywa kolumny 5/8/12 na 768 OK ale brak pixel test 375. `prefers-reduced-motion` w 6 plikach OK.

### 2.4 Rozmieszczenie plików JS

- Stat: 219 plików, 51898 linii, śr 237. `public/js/studnie:137 (62%)`, `public/js/rury:31`, `public/js/shared:22`, `public/js/import-export:11`, `public/js/kartoteka:8`, `public/js/spa:4`.
- ADR-008: `public/js/studnie/wellActions.js:52` shim deleguje do 13 `actions*.js` (`actionsCrud:325`, `actionsConfigRender:361`, `actionsWellPricing:491`) — zgodne. `public/js/studnie/excelTableManager.js:357` wciąż >150 (resize/handles) — niedokończone. `public/js/studnie/wellSolver.js:16` → `solverCore/AutoSelect/Validation` OK.
- > 500 linii (23 pliki, SRP naruszone): `public/js/admin/aiDashboard.js:1379` (69 fns), `public/js/studnie/solverAutoSelect.js:1231`, `public/js/studnie/popupsTransitionManager:863`, `public/js/studnie/excelTableBody:727`, `public/js/studnie/excelHelpers:716`, `public/js/studnie/printManager:694`, `public/js/studnie/wellTransitions:692`, `public/js/spa/zlecenia.js:667` itd. <30 linii (18 plików): `public/js/studnie/offerConstants:5`, `public/js/studnie/orderManager:6`, `public/js/studnie/spaRedirect:9` — shims zawyżają liczbę plików.
- Globals: `public/js/studnie/globals.js:284` proxy 25 `window.*` (`wells`, `studnieProducts`, `currentUser`), 250+ `window.x=` + 934 `typeof window` checks — gwiazda zależności `window.wells` mutowana w 50+ miejscach, cykl `wellManager→excelHelpers→wellConfigRules→solverAutoSelect→telemetryBridge→wellManager`.
- Escape/Lucide/LAYERS: `escapeHtml:467`, `escapeHtmlAttr:47`, `escapeJsStr:36` vs 268 `innerHTML=` (58% escapowane, gap XSS), `lucide.createIcons:113` OK, `LAYERS:54` w `public/js/studnie/excelTableRenderer:20` OK.
- Duplikaty: `mergeOverlappingRanges` 2x, `toggleCard` 2x, `productHelpers` vs `productMetadata`, `public/js/rury/transport:618` vs `public/js/studnie/offerTransport:219` rozwidlone.

### 2.5 Testy — pokrycie

- Jest: `jest.config.ts:7` `testMatch:**/*.test.ts`, `collectCoverageFrom: src/**/*.ts` — frontend wykluczony celowo. 138 testów (root 59, studnie 35+4 selection, ml 14, responsive 7, migrations 5, sales 3, offers 2, orders 2, spa 1, i18n 1, security 1).
- Backend: `coverage/coverage-summary.json:1` `71.23%` lines/statements (14058/19736), `68.17%` branches (1776/2605), `68%` functions (287/422), 104 SF. Najgorzej: `src/services/pdf/kartaBudowy.ts:2.77%` (14/505), `src/services/docx/studnie/kartaBudowy:9.63%` (74/768), `src/services/docx/rury/kartaBudowy:14.35%`, `src/services/docx/rury/builder:16.07%`, `src/routes/offers/exports:23.62%`, `src/routes/telemetry.ts:28.08%`, `src/routes/auth.ts:32.72%`. Najlepiej: `src/validators/*`, `src/utils/ownership`, `src/utils/brandHtml` 100%.
- Frontend: 219 `public/js` → ~25 dotkniętych VM (`fs.readFileSync+vm.runInContext` mock `window/document` w `tests/studnie/excelDrilledRings.test.ts:184` dobry regres #20/#21, `excelColumns`, `dennicaSelection` itd.) — est. 11% behawioralnego. 190 plików bez testu (`rury/wizard` 5 kroków, `offerRendering`, `wellUI`, `actions*` drag, `modalCore` behavior). `typecheck:frontend` `strict:false/checkJs:false` pusty guard.
- Responsive/a11y: 7 `tests/responsive/*.test.ts` (27-39 linii) tylko regex `@media display:none` — nie renderuje, nie złapie #16/#17. `tests/a11y.test.ts:34` tylko regex `toast-container aria-live`, brak axe-core. `tests/brandHtml.test.ts:78`, `tests/encodingMojibake.test.ts:37` dobre unit.
- Playwright: `tests/playwright/*.cjs` 9 plików poza `testMatch` — `tests/playwright/excelEmptyRowAlignment.cjs:196` (getBoundingClientRect 1px tol, 2 taby) jedyny visual, `tests/playwright/appNameConsistency.cjs:308` T1-T6, `tests/playwright/screenshotsBaseline.cjs:7786` 6 PNG baseline niepodpięte. Uruchamiane tylko `test:alignment`, `test:e2e-appname` (wymaga `:3000`), nie w `validate`/CI. `scripts/benchmark.mjs` nie test, bez latency guard.
- Luki krytyczne: brak `jsdom`/`vitest` dla `public/js`, brak `collectCoverageFrom` frontend lub `coverage:frontend`, brak E2E flow oferta→zapis→PDF/DOCX→zamówienie→PZ, brak `import-export` XLSX, brak `z-index/LAYERS` asercji, brak `excelCopyPaste` (Ctrl+C/V/X, fill-down, nawigacja sticky scrollLeft #17).

### 2.6 Zgodność z wytycznymi (`docs/UI_GUIDELINES.md`, `AGENTS.md:147-159`)

| Reguła                                                                             | Status       | Dowód                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tokeny `var(--*)` z `public/css/style.base.css:3-240`                              | ✅ 95%       | Brak hex poza `:root`, `rgba(var(--*-rgb))` konsekwentnie                                                                                                                                        |
| z-index `LAYERS`/`LAYERS_EXCEL` (`public/js/studnie/layers.js`)                    | ⚠️ częściowo | JS 54 użyć OK, CSS 15 gołych poza systemem                                                                                                                                                       |
| Modale `public/js/shared/modalCore.js` (`public/css/style.responsive.css:464-509`) | ⚠️ 50%       | `public/js/import-export/toolbar.js:365` poprawne, `public/js/shared/ui.js:129` + `.app-confirm-overlay` legacy                                                                                  |
| Ikony Lucide                                                                       | ✅           | 113 `lucide.createIcons({root})`, 0 emoji poza `public/css/studnie.css:718` `content:'✔'`                                                                                                        |
| XSS `escapeHtml`/`escapeHtmlAttr` (#3/#24/#39)                                     | ⚠️ 58%       | 467 użyć, ale 268 `innerHTML` — gap 113 miejsc bez escapowania                                                                                                                                   |
| Klasy wspólne SSoT, modifier `--<moduł>`                                           | ✅           | `nav-tile--studnie/rury` OK, rury `rury-*` prefix, brak `.btn` nadpisań                                                                                                                          |
| Inline `style` zakaz gdy utility istnieje                                          | ❌           | 100+ HTML + 60+ JS statyczne powinny być `.flex-*`/`.hidden`                                                                                                                                     |
| A11y `focus-visible`, `aria-label`, `prefers-reduced-motion`                       | ⚠️           | `*:focus-visible` OK, `prefers-reduced-motion` w 6 CSS, ale `aria-label` gap na checkboxach `public/js/rury/offerRendering.js:137`, `role=dialog` brak w ręcznych modalach, `iframe` bez `title` |
| Responsywność 375/768/1024/1440 brak scroll                                        | ⚠️           | `table-wrap:overflow-x:auto` zabezpiecza, ale 6-col grid na 375 ryzyko                                                                                                                           |

---

## 3. Podsumowanie

**Atuty (profesjonalne):** tokenizacja 100% kolorów, SSoT udokumentowany i w 60% egzekwowany, dark/glass design spójny, ADR architektura jasna, backend coverage 71% z regresjami dla critical path (excel rings #20, mojibake #34, ownership 100%), Playwright alignment baseline istnieje, Prettier/ESLint/Husky działają.

**Długi (blokery jakości):**

1. Frontend bez pokrycia (0% lcov) + visual regression nie w CI — obszar z najwięcej bugów #16-#33 ma najmniej testów.
2. CSS 14k linii z duplikatami/martwe 190 linii + z-index poza systemem + pliki >2k linii utrudniają utrzymanie.
3. JS 52k linii, 23 pliki >500 linii, `window` globals cykl — zmiana w `public/js/studnie/globals.js` dotyka 50+ plików.
4. Inline `style` masowe łamie DRY i utrudnia RWD/cache-bust.
5. `kartaBudowy`/docx niskie pokrycie (2-14%) mimo krytyczności wydruków.

**Werdykt:** kod sensownie rozmieszczony domenowo (rury/studnie/spa/shared), ale nierównomiernie — studnie przerost, rury OK. Całość spójna wizualnie, profesjonalna w 70%, do 9/10 wymaga domknięcia długów P0/P1.

---

## 4. Plan naprawy — bez fixusów (roadmap, kolejność, estymacja)

### Faza 0 — Przygotowanie (1 dzień)

- `npm run encoding:check` + `npm run version:check` baseline, snapshot `coverage/lcov.info` + `tests/playwright/screenshots/baseline/*.png` do repo.
- Dodać `scripts/check-global-collisions.mjs` do CI, `tsconfig.frontend.json` → `strict:true` dry-run (raport bez break).
- Weryfikacja: `npm run validate` + `npm run test:quick` zielone przed startem.

### Faza 1 — P0 SSoT krytyczne (2-3 dni) — reuse `LAYERS`/`modalCore`/`.hidden`, nie nowe

- **1a z-index:** `public/partials/studnie/modals.html:6,99` + `public/partials/rury/transport-modal.html:3` `z-index:10000` → `LAYERS.GENERIC_MODAL_BACKDROP` (2000) + `LAYERS.GENERIC_MODAL_CONTENT` (2010); `public/css/style.responsive.css:465` `100000` → `var(--z-overlay)` (dodać `--z-*` do `public/css/style.base.css:3-240` per `docs/UI_GUIDELINES.md:71`), `public/css/style.responsive.css:749` `1000000` → `var(--z-toast)`, `public/css/rury.css:542` `9999` → `LAYERS.STICKY_SUMMARY_BAR` lub `var(--z-sticky)`. Sprawdzić `public/css/rury.css:225/464`, `public/css/printModal.css:28`.
- **1b modale:** `public/js/shared/ui.js:129` inline `background:var(--bg-tile)` → `showModal({id,title,html})` z `public/js/shared/modalCore.js:82`; `public/css/studnie.css:1294` `.app-confirm-overlay` scalić do `modalCore` (usunąć duplikat); `public/js/rury/transport.js:463` `modal.style.display` → `js-modal-overlay` + `trapFocus`, uzupełnić `role=dialog`/`aria-modal`/`aria-labelledby`.
- **1c a11y focus:** `public/css/style.base.css:368` `*:focus{outline:none}` → `*:focus:not(:focus-visible){outline:none}` lub usunąć, dodać `:focus-visible` w `public/css/index.css:752`. Dodać `title` na iframe w `public/app.html:94` + `aria-label` na checkboxy `public/js/rury/offerRendering.js:137` + `public/js/shared/toast.js:54` `role=alert`/`aria-live`.
- Ryzyko: zmiana z-index może odkryć zakryte bugi sticky (test 375/768). Weryfikacja: `rg z-index` 0 gołych poza `public/js/studnie/layers.js`/`--z-*`, manual 375/768/1024/1440 brak poziomego scrolla, `aria` w axe.

### Faza 2 — P1 CSS duplikaty/martwe/inline→klasy (3-4 dni)

- **2a duplikaty:** usunąć `public/css/rury.css:18` `.mb-0/.mb-1` (zostaje `public/css/style.base.css:899`), `public/css/studnie.css:1646` `.flex-row` (zostaje `public/css/style.utilities.css:177`), `public/css/studnie.css:1713` `.text-muted` duplikat. Skonsolidować `.wizard-nav-fixed` 3 definicje.
- **2b martwe 190 linii:** usunąć `public/css/studnie.css:1586-1720` `.fs-*/.fw-*` + `public/css/style.responsive.css:1167-1230` `.ui-*` + `public/css/style.utilities.css:18` `.flex-1-180-hidden` (grep 0 użyć). Potwierdzić `npx purgecss --content public/**/*.html --css public/css/*.css` dry-run.
- **2c inline→klasy:** `public/kartoteka.html:100-486` 25 inline → `.flex-wrap-start`/`.flex-gap-5`/`.hidden`; `public/js/admin/aiDashboard.js:76-1212` 20 inline `font-size:var(--fs-sm)` → `.fs-sm-muted`/`.mono-sm` (dodać 2 utility jeśli brak); `public/js/studnie/actionsConfigRender.js:43-235` 15 inline → `.config-tile`. Dodać divider utility dla `width:1px;height:24px`.
- **2d breakpoint:** `public/css/style.base.css:731` `1100` → `1200` (kanon) lub udokumentować deviation; `public/css/rury.css:474` dodać bp 375 dla `rury-summary-grid` `6col→2col→1col`.
- Weryfikacja: `npm run format` + `npm run lint:frontend` zielone, `rg "style="` w HTML <20 (tylko dynamiczne z `var()`), `rg "^\.mb-0"` 1 wynik, screenshot diff `tests/playwright/screenshotsBaseline.cjs` bez regresji.

### Faza 3 — P1 JS rozmieszczenie >500 linii (5-7 dni) — dziel tylko gdy SRP, nie linia-limit

- **3a rozbić >500:** `public/js/admin/aiDashboard.js:1379` → 3 pliki `admin/aiDashboardCore|Charts|Crud` (~450 ea); `public/js/studnie/solverAutoSelect.js:1231` → `solverCore`+`solverHeuristics`+`telemetryBridge` (już `public/js/studnie/solverHeuristics:12` szkielet); `public/js/studnie/excelHelpers.js:716` + `public/js/studnie/excelTableBody:727` → `excelState/Columns/Selection`; `public/js/rury/transport.js:618` + `public/js/studnie/offerTransport:219` → `public/js/shared/transportCore.js` (DRY).
- **3b scalić <30:** `public/js/studnie/headInit:7`, `public/js/studnie/spaRedirect:9`, `public/js/studnie/registerSolverVersion:6`, `public/js/rury/offerNotesGenerator:18` → `public/js/shared/init.js` lub usunąć shims. Odchudzić `public/js/studnie/excelTableManager.js:357` → <150 (resize do `excelColumnVisibility`).
- **3c globals:** udokumentować kolejność `<script>` w `public/studnie.html:80+` + `public/rury.html:40+` w komentarzu, dodać `eslint no-implicit-globals` dla `public/js`, plan ESM `type="module"` + import map (nie w tej iteracji, odnotować `ponytail:`).
- Weryfikacja: `wc -l public/js/**/*.js` — 0 plików >800, `rg "window\." | wc -l` trend down, `node -c` dla zmienionych + `npm run typecheck:frontend` (strict dry).

### Faza 4 — P1 Testy frontend + luki backend (7-10 dni)

- **4a frontend runner:** `jest.config.ts:9` dodać `projects:[{displayName:backend,collectCoverageFrom:src},{displayName:frontend,testEnvironment:jsdom,collectCoverageFrom:public/js/**/*.js}]` lub osobny `vitest.config.frontend.ts`. Pierwszy rung: reuse VM pattern → rozszerzyć na `public/js/rury/wizard.js`, `public/js/rury/offerRendering.js`, `public/js/shared/modalCore.js` (open/close/Escape/trapFocus), `public/js/spa/zlecenia.js`.
- **4b E2E:** podpiąć `playwright.config.cjs` (`testDir:tests/playwright`, `webServer: npm run dev:backend`), dodać do `validate` i CI: `test:alignment` + `test:e2e-appname` + nowy `e2e:smoke` (utwórz ofertę studnie/rury → zapis → PDF/DOCX → zamówienie → PZ guard 403). Przenieść `tests/playwright/screenshotsBaseline.cjs` do `expect(page).toHaveScreenshot()` z `maxDiffPixels 100`.
- **4c a11y/visual:** dodać `axe-playwright` do `tests/a11y.test.ts` (kontrast, `aria-label` na `.btn-icon`), `tests/responsive` przepisać z regex na `page.viewportSize {375,768,1024,1440}` + `expect(noHorizontalScroll)`.
- **4d backend niskie:** `src/services/pdf/kartaBudowy:2.77%`, `src/services/docx/*kartaBudowy:9-14%`, `src/routes/offers/exports:23%` — dodać 3-5 testów snapshot DOCX/PDF (już `tests/kartaBudowy.test.ts` szkielet).
- Weryfikacja: `npm run test -- --coverage` frontend coverage >30% (pierwszy próg), `coverage-summary.json` `kartaBudowy` >50%, CI zielone, `npx playwright test` 0 flakies 3 runy.

### Faza 5 — P2 Profesjonalizm / spójność (2 dni)

- **5a XSS gap:** audyt `rg "innerHTML\s*=" -n public/js` 268 miejsc — dodać eslint `no-unsanitized/property` + manual review 113 bez `escapeHtml*`, uzupełnić `escapeHtmlAttr` w atrybutach (`public/js/spa/zleceniaHelpers:198` wzorzec).
- **5b style resztki:** `public/js/shared/toast.js:54` `style.cssText` → klasy, `public/js/rury/wizard.js:42` `style.display` → `.hidden`, `public/js/import-export/toolbar.js:16` inline → `.flex-wrap-start.bg-glass-subtle`.
- **5c dokumentacja:** uzupełnić `docs/UI_GUIDELINES.md:235-239` `--z-*` tokeny w `:root` (obecnie brak, mimo zapowiedzi), dodać `docs/adr/ADR-009` dla ESM plan.
- Weryfikacja: `npm run lint:frontend` 0 warn, `rg "style\."` w JS tylko dynamiczne (resize, animacje) <30 wyników.

### Faza 6 — CI / walidacja (1 dzień)

- Dodać do `package.json:17` `validate` → `+ npm run test:alignment` (optional) + `collisions:check` już jest, dodać `licenses:check` OK. Dodać `pre-push` `playwright --version` guard. `scripts/benchmark.mjs` → latency budget assert (p95 <200ms).
- Weryfikacja: świeży `npm run validate` + `npm run version:check` EXIT=0, `npm run encoding:check` 0 mojibake, push na `main` przechodzi Husky.

---

## 5. Kolejność priorytetów (RICE)

| Pri | Zadanie                                      | Effort | Ryzyko            | Zysk                                      |
| --- | -------------------------------------------- | ------ | ----------------- | ----------------------------------------- |
| P0  | Faza 1 (z-index, modalCore, focus)           | S      | Średnie (sticky)  | Wysoki — usuwa SSoT blokery, a11y         |
| P1  | Faza 4a/b (frontend testy + Playwright w CI) | M      | Niskie            | Krytyczny — chroni przed regresją #16-#33 |
| P1  | Faza 3 (rozbicie >500)                       | M      | Średnie (globals) | Wysoki — utrzymanie, SRP                  |
| P1  | Faza 2 (martwe/duplikaty/inline)             | S      | Niskie            | Średni — -190 linii, czytelny diff        |
| P2  | Faza 5 (XSS gap, style resztki)              | S      | Niskie            | Średni — bezpieczeństwo                   |
| P2  | Faza 4d (kartaBudowy/docx)                   | M      | Niskie            | Średni — wydruki krytyczne                |

**Najmniejszy krok do 8/10:** Faza 1 + 4a/b (3 dni) — domyka SSoT i daje guard przed regresją. Reszta iteracyjnie.

**Skipped (YAGNI, add gdy):** pełny design system Chromatic/Percy (add gdy visual diff w CI niestabilny), migracja ESM/bundler (add gdy `window` globals >500 lub kolejność `<script>` pęka), nowy design token `--gap-*` (add gdy spacing 2rem powtarza się >5x).

---

## 6. Weryfikacja po każdej fazie

- `npm run format` + `npm run lint` + `npm run lint:frontend` + `npm run typecheck` + `npm run typecheck:frontend` — 0 error
- `npm run test:quick` — 138 testów zielonych (po Fazie 4: + frontend)
- `npm run version:check` + `npm run encoding:check` — EXIT=0
- Manual: 375/768/1024/1440 brak poziomego scrolla, modale Esc/overlay-click + focus trap, `rg "z-index:\s*\d{4,}"` 0 poza `layers.js`
- `git diff --stat` — fazy 1-2 <15 plików, faza 3 <10 plików, faza 4 tylko `tests/` + `jest.config.ts`

---

_Raport read-only — żadna linia kodu nie zmieniona podczas audytu._
