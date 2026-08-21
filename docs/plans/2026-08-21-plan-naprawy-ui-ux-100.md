# PLAN NAPRAWY 100% — S.O.K. UI/UX + HTML + CSS + TESTY

> Data: 2026-08-21 · Wersja: 1.17.1 → 1.18.0 (minor, zmiany niebreaking) · Baza: `main` @ `914e215`–`1484f9f` (0 inline w `public/partials`, `style.utilities.css` SSoT)
> SSoT: `docs/UI_GUIDELINES.md` · `docs/ARCHITECTURE.md` · `style.base.css:3-240`
> Zasada: każdy krok = osobny commit `node scripts/commit.mjs`, `version:check` + `validate` + `test:quick` + `diff --check` przed push, izolowany rollback.

## Cel

Domknięcie 20 problemów P0-P2 z audytu (invalid HTML, `div button`, `z-index`, `!important`, `style` w `public/*.html`, `aria-current`, `beforeunload`, `auth` 32%, `kartaBudowy` 2%, `telemetry` 28%), regresja 0, pokrycie `auth`/`kartaBudowy` >60%, a11y + responsywność zweryfikowane, inline w partials 0 (już osiągnięte 370→0), `!important`/`z-index` poza SSoT usunięte.

---

## FAZA 0 — P0 BLOKERY (1 commit, 30 min, brak zależności)

### Z-00 P0 invalid HTML — `public/partials/studnie/step4-build-card.html:19,51,65,82` `class="... " class="karta-*"` duplikat + `public/partials/studnie/modals.html:91` `type="button" type="button"`

- **Pliki:** `step4-build-card.html:19` (button copy), `:51`/`65` (input), `:82` (input adres), `modals.html:91`
- **Zakres:** merge `class="wizard-btn wizard-btn-secondary karta-copy-btn"`, `class="form-input karta-input"`, usuń drugi `type`
- **Oczekiwany rezultat:** `npx html-validate` 0 błędów, `prettier --check` pass, `rg 'class="[^"]*" class='` → 0
- **Test akceptacyjny:** `npm run lint:frontend` + `node -c` na `step4` partial (brak JS) + `rg 'class="[^"]*" class='` 0
- **Zależności:** brak

### Z-01 P0 `div[role=button]` → `button` — `public/studnie.html:58-92` `#svg-trash`

- **Pliki:** `studnie.html:58`, `public/css/studnie.css` (dodać `.btn-icon-danger` już istnieje w `style.utilities.css:809` — użyć)
- **Zakres:** zamienić `div role=button tabindex=0 onclick/onkeydown/onmouseenter` na `<button class="btn-icon-danger" aria-label="Usuń studnię">`, przenieść inline `background/border` do CSS `:hover`
- **Oczekiwany rezultat:** klawiatura Enter/Space działa bez JS `onkeydown`, `focus-visible` ring, CSP bez `unsafe-inline` dla tego elementu, `axe` 0 violations na `studnie.html`
- **Test akceptacyjny:** `npx playwright test --grep "trash"` lub manual Tab → Enter, `rg 'role=button' studnie.html` → 0
- **Zależności:** Z-00

---

## FAZA 1 — P1 FUNKCJONALNOŚĆ / UX KRYTYCZNE (3 commity, 2h)

### Z-10 P1 `z-index:9999` poza `LAYERS` — `public/css/rury.css:593` `#rury-order-footer`

- **Pliki:** `rury.css:593`, `public/js/studnie/layers.js` (dodać `RURY_ORDER_FOOTER: 100` lub użyć `z-overlay:2000`)
- **Zakres:** `z-index:9999` → `z-index: var(--z-overlay)` (2000) lub `LAYERS.RURY_FOOTER`
- **Oczekiwany rezultat:** `rg "z-index:\s*9999"` → 0, `rg "z-index:\s*\d{4,}" public/css` → tylko `var(--z-*)`
- **Test akceptacyjny:** `rg "9999" public/css` 0, manual: `rury` order footer nie przykrywa `modal` 10000
- **Zależności:** brak

### Z-11 P1 `!important` poza `print.css` — `studnie.css:30` `width:100% !important`, `rury.css:12` `padding-top:0 !important`

- **Pliki:** `studnie.css:30-34`, `rury.css:12`, `style.base.css:278` (`.hidden !important` zostaje — SSoT)
- **Zakres:** zastąpić stronger selector: `body.studnie-page > .main { width:100% }` bez `!important`, `rury.css .main:has(...)` bez `!important`
- **Oczekiwany rezultat:** `rg "!important" public/css --glob "!print.css"` → tylko `style.base.css:278` + `style.base.css:1218 well-row-error` (dopuszczalne)
- **Test akceptacyjny:** `rg "!important" public/css` count 2, `npm run lint` 0
- **Zależności:** Z-10

### Z-12 P1 inline `style=` w `public/*.html` (main HTML, nie partials) — `kartoteka.html:80-404` 30×, `zlecenia.html:35-80` 15×, `studnie.html:30-110` 15×

- **Pliki:** `kartoteka.html:80`, `zlecenia.html:35`, `studnie.html:30`, `public/css/style.utilities.css` (dodać `ka-filter-btn--*`, `zlecenia-th-*`)
- **Zakres:** przenieść `style="border-radius:var(--radius-lg);padding:0.35rem 0.9rem"` na `.ka-filter-btn`, `style="width:140px"` na `.col-140` (już `w-110-r` w utilities — użyć)
- **Oczekiwany rezultat:** `rg 'style="' public/*.html` → tylko `templates/*.html` (print, dopuszczalne) + `public/*.html` 0
- **Test akceptacyjny:** `rg 'style="' public/*.html --glob "!templates"` 0, `npm run test:quick` 1926 PASS
- **Zależności:** Z-11

### Z-13 P1 brak `aria-current`/`focus` w SPA — `public/js/spa/router.js:79-88,113-125,284-366`

- **Pliki:** `router.js:79`, `public/app.html:37-58` `nav-apps`
- **Zakres:** `nav-apps` `div` → `<nav aria-label="Główna">`, `a.nav-tile` dodać `aria-current="page"` dla `.active`, `navigate()` po `showSection` → `document.getElementById('spa-main')?.focus()`, `iframe#spa-frame` dodać `title="{{module}}"`
- **Oczekiwany rezultat:** SR ogłasza "Strona główna, bieżąca", Tab ląduje w main
- **Test akceptacyjny:** `rg 'aria-current' public/js/spa/router.js` → 1, manual SR, `npm run test:quick` + `playwright` router test
- **Zależności:** Z-12

### Z-14 P1 `wizard-nav.html` aria — `public/partials/shared/wizard-nav.html:4,9,14,19,24`

- **Pliki:** `wizard-nav.html`, `public/css/style.base.css` (dodać `[aria-current="step"]` style)
- **Zakres:** `.wizard-step-dot` dodać `aria-current="step"` dla `.active`, `aria-disabled="true"` dla locked, `role="list"` na kontener + `role="listitem"` na dot, `aria-label="Krok X z 5"`
- **Oczekiwany rezultat:** `axe` 0 violations na wizard
- **Test akceptacyjny:** `rg 'aria-current' wizard-nav.html` → 1, `npm run lint:frontend` 0
- **Zależności:** Z-13

### Z-15 P1 brak `aria-live` na toast w `studnie.html:264` + `app.html:70` `ai-status`

- **Pliki:** `studnie.html:264`, `app.html:70`
- **Zakres:** `div#toast-container` dodać `aria-live="polite"` (jak `app.html:97`/`zlecenia.html:258`), `span#ai-status-indicator` dodać `role="status" aria-live="polite"`
- **Oczekiwany rezultat:** SR ogłasza toast w studnie, `rg 'toast-container' public/*.html` → 4× z `aria-live`
- **Test akceptacyjny:** `rg 'aria-live.*toast' public/*.html` count 4
- **Zależności:** Z-14

### Z-16 P1 `label for` braki — `public/partials/studnie/step4-build-card.html:113,118,128` + `kartoteka.html:327` `select#ka-user-filter`

- **Pliki:** `step4-build-card.html:113`, `kartoteka.html:327`, `zlecenia.html:117`
- **Zakres:** dodać `for="step4-...` + `id` na `select`/`input`, `kartoteka` dodać `<label for="ka-user-filter">Użytkownik</label>` (obecnie `span.toolbar-label`)
- **Oczekiwany rezultat:** `rg '<label'` w `step4` każdy ma `for`, `axe` label 0 violations
- **Test akceptacyjny:** `npx html-validate` + manual click label → focus input
- **Zależności:** Z-15

### Z-17 P1 brak `role=dialog` na statycznych modalach — `public/partials/studnie/modals.html:3,41,160`

- **Pliki:** `modals.html:3`, `public/js/shared/modalCore.js:79` (kanon)
- **Zakres:** dodać `role="dialog" aria-modal="true" aria-labelledby="offer-discounts-title"` na `#offer-discounts-modal` etc, lub przenieść te modale na `modalCore.showModal` (zalecane)
- **Oczekiwany rezultat:** `axe` dialog 0, focus trap działa dla statycznych
- **Test akceptacyjny:** `rg 'role="dialog"' modals.html` → 3
- **Zależności:** Z-16

---

## FAZA 2 — DESIGN SYSTEM (2 commity, 1.5h)

### Z-20 P2 `!important` chain + `@import` duplicate

- **Pliki:** `style.base.css:1` `@import`, `style.responsive.css:216` `!important` border-radius, `index.css:1022`
- **Zakres:** usunąć `@import url('./inter.css')` (zostawić `<link>` w HTML), zastąpić `!important` stronger selector `kartoteka-filter-bar button` bez `!important`
- **Test:** `rg "@import" public/css` → 0, `rg "!important" public/css --glob "!print.css"` → 2 (tylko `.hidden` + `well-row-error`)
- **Zależności:** FAZA 1

### Z-21 P2 tokens magic numbers — `studnie.css:74` `clamp(260px,18vw,420px)`, `rury.css:166` `calc(100vh - 380px)`, `style.base.css:393` `0.3rem 1.5rem`

- **Pliki:** `studnie.css:74`, `rury.css:166`, `style.base.css:393`
- **Zakres:** wprowadzić `--sidebar-min:260px`/`--sidebar-max:420px` w `:root`, `calc(100vh - var(--header-h) - var(--wizard-nav-h) - var(--summary-bar-h))`, `gap:var(--section-gap)` zamiast `1rem`
- **Test:** `rg "380px|260px" public/css` → 0, visual 375/768/1024/1440 no horizontal scroll
- **Zależności:** Z-20

### Z-22 P2 breakpoint rozjazd — kanon `1400/1200/900/768/700/480` vs `860/1100`

- **Pliki:** `style.responsive.css:2` komentarz, `rury.css:848 (768→900)`, `style.base.css:683 (1100→1200)`, `style.responsive.css:399 (860→900)`, `index.css:700 (860→900)`
- **Zakres:** ujednolicić do kanonu, dodać `1100` do kanonu jeśli potrzebny (decyzja: usunąć 1100, zmienić na 1200)
- **Test:** `rg "@media.*max-width: 860|1100" public/css` → 0, `responsive/*.test.ts` regex update + `screenshotsBaseline` 1024
- **Zależności:** Z-21

### Z-23 P2 duplikacja klas `mb-0/mb-1` + `w-*` dead

- **Pliki:** `rury.css:18` `mb-0/mb-1` duplicate `style.base.css:851`, `style.utilities.css:2014` `w-75-c` 2×, `util-single-*` 107×
- **Zakres:** usunąć duplikat `rury.css:18`, `w-75-c` zostawić (używane 2×) ale dodać purge `npx purgecss --content public/**/*.html` i usunąć dead `w-110-r` etc
- **Test:** `rg "w-110-r" public` → 0 → usunąć, `npm run lint` 0
- **Zależności:** Z-22

---

## FAZA 3 — UX / FORMULARZE / FEEDBACK (2 commity, 2h)

### Z-30 P0 brak `beforeunload` ochrony — wizard 5 kroków traci stan

- **Pliki:** `public/js/shared/ui.js`, `rury/wizard.js`, `studnie/wellManager.js`, `excelModal.js:371` (wzór `_excelDirty`)
- **Zakres:** dodać `window.addEventListener('beforeunload', e=>{ if(isDirty()) {e.preventDefault(); e.returnValue='';}})`, `isDirty = ()=> _excelDirty || wizardStep !==1 || formChanged`, `pagehide` dla mobile
- **Test:** manual reload w kroku 3 → `appConfirm` "Masz niezapisane zmiany", `test:quick` mock `isDirty`
- **Zależności:** FAZA 2

### Z-31 P1 brak `required`/`aria-describedby` w wizard

- **Pliki:** `step1-client.html:32`, `clientManager.js:64`
- **Zakres:** dodać `required aria-required="true" aria-describedby="err-client-name"` + `<span id="err-client-name" role="alert" hidden>`, `inputmode="numeric" pattern="[0-9]*" maxlength="10"` dla NIP, `autocomplete="organization"` dla firma
- **Test:** `rg 'required' step1-client.html` → 5, `axe` form 0
- **Zależności:** Z-30

### Z-32 P1 błędy tylko toast, brak inline `role="alert"` + `aria-describedby`

- **Pliki:** `clientManager.js:65,72`, `validatory`, `ui.js:505`
- **Zakres:** przy `showToast` dodać `input.setAttribute('aria-invalid','true')` + `errEl.textContent` + `hidden=false`, `aria-describedby` link
- **Test:** `rg 'aria-invalid' public/js/shared/clientManager.js` → 1
- **Zależności:** Z-31

### Z-33 P2 `autocomplete`/`fieldset`/`save debounce`

- **Pliki:** `step1-client.html:30`, `clientManager.js:99`, `priceDefaults.js:21` (wzór `btn.disabled`)
- **Zakres:** dodać `autocomplete="organization"`/`tel`/`street-address`, `fieldset>legend>Dane klienta`, `saveClientsDbData` z `btn.disabled=true` + `try/finally`, `phaseNext` guard `_isNavigating`
- **Test:** `rg 'autocomplete' step1-client.html` → 5, `rg 'fieldset' step1-client.html` → 3
- **Zależności:** Z-32

### Z-34 P2 `focus-visible` distinct + `prefers-reduced-motion`

- **Pliki:** `style.base.css:320`, `style.responsive.css:1440`
- **Zakres:** zweryfikować `*:focus-visible {outline: var(--focus-ring)}` działa dla `appConfirm-btn` i `batch-btn`, dodać `@media (prefers-reduced-motion: reduce) { *{animation:none} }` już istnieje — tylko test
- **Test:** `rg 'prefers-reduced-motion' public/css` → 5, manual Tab
- **Zależności:** Z-33

### Z-35 P1 `toast` `role` konflikt + 5s za krótko dla error

- **Pliki:** `toast.js:24,45`
- **Zakres:** kontener `aria-live="polite"` (zostaje), toast `role="status"` dla info/success + `role="alert"` tylko dla error, `aria-label="Zamknij"` na closeBtn, `data-duration` 5000 info/8000 error (error wymaga akcji)
- **Test:** `rg 'role="alert"' toast.js` → tylko error, manual SR
- **Zależności:** Z-34

---

## FAZA 4 — TABELE / MODALE — UX (1 commit, 1h)

### Z-40 P1 tabele `aria-sort`/`title`/`nth-child` fragile

- **Pliki:** `zlecenia.html:210`, `style.responsive.css:87`, `zleceniaRender.js:182`
- **Zakres:** dodać `aria-sort="none"` na `th`, `title` na `td` z `ellipsis` via `cell.title = cell.textContent` w `zleceniaRender.js`, zastąpić `nth-child` klasą `col-hidden-mobile` z `index.css: w-*`
- **Test:** `rg 'aria-sort' zlecenia.html` → 1, 375px no horizontal scroll
- **Zależności:** FAZA 3

### Z-41 P1 `zlecenia` sentinel bez `aria-live` + brak licznika

- **Pliki:** `zlecenia.html:251`, `zlecenia.js`, `kartoteka.html:490`
- **Zakres:** `div#zlecenia-sentinel` dodać `aria-live="polite" aria-busy`, `ka-offer-count` usunąć `hidden` → `aria-live="polite"` + `role="status"`
- **Test:** `rg 'aria-live' zlecenia.html` → 1
- **Zależności:** Z-40

### Z-42 P1 `modalCore` `body scroll lock` + `focus trap` luka

- **Pliki:** `modalCore.js:33,94`, `style.responsive.css:464`, `printModal.js:458`
- **Zakres:** `showModal` → `document.body.style.overflow='hidden'`, `closeModal` → `''`, guard `if(!first) return` w `modalCore.js:33`, `printModal` dodać `trapFocus` check `if(!overlay.contains(document.activeElement)) first?.focus()`
- **Test:** `rg 'overflow.*hidden' modalCore.js` → 1, manual ESC + Tab loop z 1 focusable
- **Zależności:** Z-41

### Z-43 P2 `overlay click` bez dirty check w `modalCore`

- **Pliki:** `modalCore.js:94`, `excelModal.js:179`
- **Zakres:** `modalCore` dodać `if(opts.onClose && opts.onClose()===false) return` przed `untrapFocus`, `showClientsDb` przekazać `onClose: ()=> editingClientId ? confirmDirty() : true`
- **Test:** `rg 'onClose' modalCore.js` → 1
- **Zależności:** Z-42

---

## FAZA 5 — ACCESSIBILITY (1 commit, 1h)

### Z-50 P2 `prefers-reduced-motion` + kontrast + `aria-*`

- **Pliki:** `style.base.css:278` `.hidden`, `app.html:24` `nav-apps`, `header.html:8` SVG
- **Zakres:** `nav-apps` → `<nav aria-label="Główna">`, `svg stop id="lg-s"` → unikalne `id="lg-s-{{id}}"`, `header` dodać `aria-label`, `ai-status` dodać `role="status"`, `toast` poprawione w Z-35
- **Test:** `npx axe --include public/app.html` 0 violations, `rg 'aria-label' app.html` → 1
- **Zależności:** FAZA 4

### Z-51 P1 brak `axe` testów — dodać `tests/a11y.test.ts`

- **Pliki:** `tests/a11y.test.ts` (nowy), `package.json` (`axe-core` devDep)
- **Zakres:** `/** @jest-environment jsdom */` + `axe.run(document, {runOnly:['color-contrast','aria']})` dla `app.html`, `studnie.html`, `kartoteka.html`
- **Test:** `npm run test:quick` + `npm run test:a11y` 3× PASS
- **Zależności:** Z-50

---

## FAZA 6 — RESPONSYWNOŚĆ (1 commit, 1h)

### Z-60 P1 `calc(100vh - 380px)` magic + `clamp` magic

- **Pliki:** `rury.css:166`, `studnie.css:74`, `style.base.css:393`
- **Zakres:** wprowadzić `--rury-table-maxh: calc(100vh - var(--header-h) - var(--wizard-nav-h) - var(--summary-bar-h))`, `--sidebar-min/max` w `:root`
- **Test:** `rg "380px|260px" public/css` → 0, `screenshotsBaseline` 375/768/1024/1440 no scroll
- **Zależności:** FAZA 5

### Z-61 P2 `screenshotsBaseline` bez asercji + `excelEmptyRowAlignment` poza CI

- **Pliki:** `tests/playwright/screenshotsBaseline.cjs`, `excelEmptyRowAlignment.cjs`, `.github/workflows/ci.yml`
- **Zakres:** dodać `expect(screenshot).toMatchSnapshot()` + `expect(rect.left).toBeCloseTo(expected,1)` w CI, usunąć hardcode `C:\Users\blody\...` → `process.env.CHROME_PATH || chromium`
- **Test:** `npm run test:e2e -- --grep alignment` PASS w CI
- **Zależności:** Z-60

---

## FAZA 7 — TESTY (2 commity, 3h)

### Z-70 P0 `auth.ts` 32% → >60% — `routes/auth.ts` `bcrypt.compare`/`createSession`/`cookie`

- **Pliki:** `tests/auth.e2e.test.ts` (nowy, `supertest` + real `prisma` test DB), `src/routes/auth.ts`
- **Zakres:** 3× `supertest` happy: `POST /login` 200 + `Set-Cookie` `httpOnly`/`sameSite`, `POST /logout` 200 clear, `GET /me` 200, `POST /change-password` 401/200, `isCookieSecure` `req.secure` vs `COOKIE_SECURE`
- **Test:** `npm run test -- --coverage --collectCoverageFrom=src/routes/auth.ts` → lines >60%
- **Zależności:** FAZA 6

### Z-71 P0 `kartaBudowy` 2–14% → >60% — `docx/*`/`pdf/*`

- **Pliki:** `tests/docx.kartaBudowy.test.ts` (nowy), `src/services/pdf/kartaBudowy.ts`, `src/services/docx/*/kartaBudowy.ts`
- **Zakres:** 2× happy `generateKartaBudowy` z real `order` + `well` + `product` → `expect(docx).toBeInstanceOf(Buffer)` + `expect(launch).toHaveBeenCalledTimes(1)` już istnieje, dodać `expect(docx.length).toBeGreaterThan(1000)` + large payload
- **Test:** `npm run test -- --collectCoverageFrom=src/services/pdf/kartaBudowy.ts` → lines >60%
- **Zależności:** Z-70

### Z-72 P1 `telemetry` 28% + `settings` 40% — `routes/telemetry.ts` `requireAdmin`

- **Pliki:** `tests/featureFlags.e2e.test.ts` (rozszerzyć `featureFlags.test.ts` 6→12), `src/routes/settings.ts`
- **Zakres:** `POST /audit` 403 bez admin, 200 z admin, `GET /settings` 200, `settings.upsert` kompensacja `price_defaults.json` (już w `priceOverrideService.test.ts` — dodać E2E)
- **Test:** `npm run test -- --collectCoverageFrom=src/routes/settings.ts` → >60%
- **Zależności:** Z-71

### Z-73 P1 nawigacja SPA 0% → >60% — `public/js/spa/router.js`

- **Pliki:** `tests/spa.router.test.ts` (nowy, `jsdom` + `history.pushState`), `public/js/spa/router.js`
- **Zakres:** `navigate('#/studnie')` → `iframe.src` + `nav-tile.active` + `aria-current`, `redirect studnie.html → app.html#/studnie`, `logo class` `logo-rury`/`logo-studnie`
- **Test:** `/** @jest-environment jsdom */` + `expect(iframe.src).toContain('studnie.html')`
- **Zależności:** Z-72

### Z-74 P1 `public/js` `vm` → `jsdom` migracja

- **Pliki:** `jest.config.ts` (dodać `testEnvironment: 'jsdom'` per-file), `tests/studnie/excelWellLock.test.ts` (przepisać na `jsdom`)
- **Zakres:** dodać `/** @jest-environment jsdom */` do 5 plików `studnie/*`, helper `createDom(html)` zamiast `vm`, usunąć `// @ts-nocheck` shadowing
- **Test:** `npm run test:quick` 1926 PASS (mniej mocków)
- **Zależności:** Z-73

---

## CHECKPOINTY PLANU (każde zadanie)

- [ ] ID `Z-00` P0 invalid HTML `step4-build-card.html:19` — `rg 'class="[^"]*" class='` 0 — `html-validate` 0 — brak zależności
- [ ] ID `Z-01` P0 `div button` `studnie.html:58` — `rg 'role=button' studnie.html` 0 — `axe` 0 — Z-00
- [ ] ID `Z-10` P1 z-index `rury.css:593` — `rg 9999` 0 — manual modal nad footer — Z-01
- [ ] ID `Z-11` P1 `!important` — `rg "!important" --glob "!print.css"` 2 — Z-10
- [ ] ID `Z-12` P1 inline `public/*.html` — `rg 'style="' public/*.html --glob "!templates"` 0 — Z-11
- [ ] ID `Z-13` P1 SPA `aria-current` — `rg 'aria-current' router.js` 1 — Z-12
- [ ] ID `Z-14` P1 wizard-nav aria — `rg 'aria-current' wizard-nav.html` 1 — Z-13
- [ ] ID `Z-15` P1 toast `aria-live` — `rg 'aria-live.*toast' public/*.html` 4 — Z-14
- [ ] ID `Z-16` P1 label `for` — `rg '<label' step4` każdy z `for` — Z-15
- [ ] ID `Z-17` P1 `role=dialog` — `rg 'role="dialog"' modals.html` 3 — Z-16
- [ ] ID `Z-20` P2 `@import` — `rg "@import" public/css` 0 — FAZA 1
- [ ] ID `Z-21` P2 tokens magic — `rg "380px|260px" public/css` 0 — Z-20
- [ ] ID `Z-22` P2 breakpoint — `rg "860|1100" public/css` 0 — Z-21
- [ ] ID `Z-23` P2 dead `w-110-r` — `rg "w-110-r" public` 0 → usunięte — Z-22
- [ ] ID `Z-30` P0 `beforeunload` — manual reload w kroku 3 → confirm — FAZA 2
- [ ] ID `Z-31` P1 `required` — `rg 'required' step1-client.html` 5 — Z-30
- [ ] ID `Z-32` P1 `aria-invalid` — `rg 'aria-invalid' clientManager.js` 1 — Z-31
- [ ] ID `Z-33` P2 `autocomplete`/`fieldset` — `rg 'autocomplete' step1` 5, `rg 'fieldset' step1` 3 — Z-32
- [ ] ID `Z-34` P2 `prefers-reduced-motion` — `rg 'prefers-reduced-motion' public/css` 5 — Z-33
- [ ] ID `Z-35` P1 toast `role` — `rg 'role="alert"' toast.js` tylko error — Z-34
- [ ] ID `Z-40` P1 tabele `aria-sort` — `rg 'aria-sort' zlecenia.html` 1 — FAZA 3
- [ ] ID `Z-41` P1 sentinel `aria-live` — `rg 'aria-live' zlecenia.html` 1 — Z-40
- [ ] ID `Z-42` P1 modal `body scroll lock` — `rg 'overflow.*hidden' modalCore.js` 1 — Z-41
- [ ] ID `Z-43` P2 overlay dirty — `rg 'onClose' modalCore.js` 1 — Z-42
- [ ] ID `Z-50` P2 `nav` landmark — `rg 'nav.*aria-label' app.html` 1 — FAZA 4
- [ ] ID `Z-51` P1 `axe` test — `npm run test:a11y` 3× PASS — Z-50
- [ ] ID `Z-60` P1 `calc` magic — `rg "380px|260px" public/css` 0 — FAZA 5
- [ ] ID `Z-61` P2 `screenshots` CI — `npm run test:e2e -- --grep alignment` PASS — Z-60
- [ ] ID `Z-70` P0 `auth` 32%→60% — `npm run test -- --collectCoverageFrom=src/routes/auth.ts` lines >60% — FAZA 6
- [ ] ID `Z-71` P0 `kartaBudowy` 2%→60% — `collectCoverageFrom=src/services/pdf/kartaBudowy.ts` >60% — Z-70
- [ ] ID `Z-72` P1 `telemetry` 28%→60% — `collectCoverageFrom=src/routes/settings.ts` >60% — Z-71
- [ ] ID `Z-73` P1 SPA router 0%→60% — `spa.router.test.ts` 5× PASS — Z-72
- [ ] ID `Z-74` P1 `vm`→`jsdom` — `npm run test:quick` 1926 PASS z `jsdom` — Z-73

---

## ZASADA „NIE FIXUJ — ZAPLANUJ”

Każdy problem → `file:line` dowód → wpływ (P0-P4) → rekomendacja (klasa/selector) → weryfikacja (`rg`/`axe`/`npm test`/`manual`). Zero gotowego kodu poza niezbędnym snippetem w rekomendacji.

---

## KOŃCOWA KONKLUZJA (po FAZA 7)

- **Spójny?** CZĘŚCIOWO — tokeny/LAYERS/modalCore SSoT tak, 3 tabele +2 modale +5 breakpointów nie.
- **Profesjonalny?** CZĘŚCIOWO — dark glass + Inter + Lucide tak, `z-index:9999`/`!important`/`util-single` bloat nie.
- **Gotowy produkcyjnie?** CZĘŚCIOWO — 1926 testów, `auth` 32% + `kartaBudowy` 2% nie.
- **Łatwy w utrzymaniu?** CZĘŚCIOWO — Vanilla JS `vm` kruche, `public/js` 29 plików bez `jsdom`, `utilities` 2014 linii.
- **Odpowiednio przetestowany?** CZĘŚCIOWO — 71% lines maskuje dziury, `public/js` 0% coverage, `a11y` 0, `nawigacja` 0.
- **Wystarczająco dobry UX-owo?** CZĘŚCIOWO — wizard 5 kroków OK, ale `div button`, `aria-current` brak, `beforeunload` brak, tabele `nth-child` fragile.

**NAJWAŻNIEJSZE 5 DO NAPRAWY W PIERWSZEJ KOLEJNOŚCI:**

1. **Z-00/Z-01 P0 invalid HTML + `div button`** — 2 linie, `html-validate` + `axe` 0, odblokowuje a11y.
2. **Z-10/Z-11 P1 `z-index`/`!important`** — 2 linie, `rg` 0, odblokowuje SSoT.
3. **Z-30 P0 `beforeunload`** — 10 linii, manual reload → confirm, zapobiega utracie 5 kroków.
4. **Z-70 P0 `auth` 32%→60%** — 3× `supertest` + `prisma` test DB, pokrywa `bcrypt`/`cookie`/`subUsers`.
5. **Z-71 P0 `kartaBudowy` 2%→60%** — 2× `generateKartaBudowy` happy + large, pokrywa produkcyjny export.

> Plan zapisany jako `docs/plans/2026-08-21-plan-naprawy-ui-ux-100.md` — gotowy do wykonania `FAZA 0 → FAZA 7` jedno zadanie po drugim bez utraty kontekstu.
