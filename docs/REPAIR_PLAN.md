# S.O.K. — FULL REPAIR PLAN

Status: `IN PROGRESS — PHASE-09 (HTML/CSS DRY) in progress (029, 034, 044 done, 028 next) — TASK-001..013, 020..027, 030..033, 040..043, 048 done`
Version: 1.17.1
Created: 2026-08-18
Last verification: 2026-08-18 (TASK-001 validate PASS, TASK-005 node -c + eslint PASS)

## 0. EXECUTIVE SUMMARY

Audyt UI/UX+HTML+CSS+Frontend wykazał ~40 problemów (score 5.2/10). Zero zmienionych plików na tym etapie. Plan dzieli naprawę na 13 faz (PHASE-00..12), 48 zadań (TASK-001..048), 7 bramek jakościowych (CP-01..07). Priorytet: P0=9 (XSS + kolizje globali), P1=8, P2=11, P3=11, P4=3. Kolejność ściśle: najpierw security, potem globalne kolizje, potem CSS/tokeny, na końcu architektura. Każda faza zatrzymuje się na checkpointie z kryteriami PASS/FAIL.

Uwaga konwencyjna: AGENTS.md §7 wymaga planów w `docs/plans/`. Zgodnie z wyraźnym poleceniem plik powstaje jako `docs/REPAIR_PLAN.md`; po zakończeniu należy go przenieść do `docs/plans/archive/`.

## 1. AUDIT VERIFICATION

Stan po ponownej weryfikacji w kodzie (2026-08-18):

| ID   | Finding                                                  | Status                            | Evidence                                                                                                                                                                                                |
| ---- | -------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CF-1 | XSS `printManager.js` — `uwagi` bez escape               | **CONFIRMED**                     | `printManager.js:736,758`; `uwagi` z `getValue('zl-uwagi')` (linia 77) = dane użytkownika                                                                                                               |
| CF-2 | XSS w przejściach — kategoria/atrybuty                   | **CONFIRMED**                     | `wellTransitionsPopup.js:223` (iniekcja atrybutu), `wellTransitions.js:126`, `popupsTransitionManager.js:651`                                                                                           |
| CF-3 | Duplikacja markera wizarda studnie↔rury + partial        | **CONFIRMED**                     | `studnie.html:151-179` vs `rury.html:43-59`; oba partiale `wizard-nav.html`; CSS `studnie.css:1776-1792`, `rury.css:953-962` (haki na inline style)                                                     |
| CF-4 | Kolizja `handlePrintClick`                               | **CONFIRMED**                     | `kartoteka.html:514-515` ładuje oba `offerPrintManager.js` (rury nadpisuje studnie)                                                                                                                     |
| CF-5 | Duplikat `renderOrderModeBanner` — ROZJAZD implementacji | **CONFIRMED**                     | `orderCrudHelpers.js:6,67` (61 linii) vs `orderCrud.js:837` (18 linii); load order `studnie.html:430-431` → wygrywa `orderCrud.js`; **wersja pomocnicza może być martwa — do ustalenia która poprawna** |
| C-1  | Duplikacja CSS ~1100 linii                               | **CONFIRMED** (zasięg do pomiaru) | `.offer-stats-bar` `studnie.css:794` = `offer.css:2`; `.app-confirm-overlay` `studnie.css:1294` = `modal.css:125`; `studnie.css` 2305 linii = 375+783 źródła                                            |
| C-2  | Konflikt `.flex-row`                                     | **CONFIRMED**                     | `studnie.css:1646` (flex-direction:row) vs `style.utilities.css:177` (flex+gap) — zależność od kolejności `<link>`                                                                                      |
| C-3  | Haki CSS na inline style                                 | **CONFIRMED**                     | `studnie.css:1776-1792`, `rury.css:953-962` (`div[style*='grid-template-columns: 1fr 1fr']`)                                                                                                            |
| C-4  | Dead CSS                                                 | **PARTIAL**                       | `.config-tile:hover` `studnie.css:2303` (element bez hover — pewne); `rury-btn-ghost`, `fs-sidebar`, `excel-th`, `pl-lg` do potwierdzenia grepem przy TASK-044                                          |
| C-10 | Dead/mirror classes                                      | merged into C-1/C-4               | —                                                                                                                                                                                                       |
| A-1  | Brak `<form>`                                            | **CONFIRMED**                     | 0 `<form` w `public/*.html`                                                                                                                                                                             |
| A-2  | Brak `<h1>`                                              | **CONFIRMED**                     | 0 `<h1` w `public/*.html`                                                                                                                                                                               |
| A-3  | Brak `role="dialog"`                                     | **CONFIRMED**                     | 0 plików z `role=dialog`                                                                                                                                                                                |
| A-4  | Tabele bez `scope`                                       | **CONFIRMED**                     | 0 plików z `scope=`                                                                                                                                                                                     |
| A-5  | Search inputy bez labeli                                 | **PARTIAL**                       | `kartoteka.html:402-417` MA label `for=`; `#ka-local-search-input` OK. Sprawdzić `#excel-search-input`, `#global-search` przy TASK-033                                                                  |
| A-6  | Wizard dots jako divy                                    | **CONFIRMED**                     | `studnie.html:153-179` (`wizard-step-dot`), rury analogicznie                                                                                                                                           |
| A-7  | Enter na loginie bez form                                | **CONFIRMED**                     | `dashboard.js:87-92` globalny keydown                                                                                                                                                                   |
| R-1  | `#spa-logo-text` bez override mobile                     | **CONFIRMED**                     | `style.base.css:521` `min-width:14rem`; brak `@media ≤700px`                                                                                                                                            |
| R-2  | Breakpointy niespójne                                    | **CONFIRMED**                     | 1400/1200/1100/900/768/700/640/600/480                                                                                                                                                                  |
| R-3  | Ukrywanie kolumn przez `nth-child`                       | **CONFIRMED**                     | `style.responsive.css:79-98` + hak `[style*='flex: 1']` (linia 71)                                                                                                                                      |
| R-4  | Magiczny breakpoint 768 vs 700                           | **CONFIRMED**                     | `studnie.css:1724,2076` (768) vs `style.responsive.css` (700)                                                                                                                                           |
| R-5  | Touch targety <44px                                      | **CONFIRMED**                     | `style.cards.css:352,545` (26-34px)                                                                                                                                                                     |
| FA-1 | Namespace globalny                                       | **CONFIRMED**                     | 748 `window.* =`, 319 stringów `onclick=`, 2595 stringów style w `public/js`                                                                                                                            |
| FA-2 | 8 duplikatów par plików rury↔studnie                     | **CONFIRMED**                     | offerNotesGenerator, offerPrintManager, orderCrud, orderKartaBudowy, orderPrzejscia, orderManager, offerOrderSelection, offerRendering                                                                  |
| FA-3 | Metryki baseline                                         | **CONFIRMED**                     | zebrane, patrz §14                                                                                                                                                                                      |

**FALSE POSITIVE / ALREADY FIXED:** brak w zakresie audytu.

**REQUIRES INVESTIGATION:**

- CF-5: która implementacja `renderOrderModeBanner` jest poprawna i kto ją woła.
- C-1: dokładna liczba zduplikowanych linii (pomiar przez znormalizowany diff przy TASK-010).
- C-4: pełna lista dead klas.
- A-5: stan labeli wszystkich search inputów.
- FA-2: stopień rozjazdu każdej z 8 par plików (czy pure-dup, czy zmutowana kopia).

## 2. PRIORITY MODEL

| Priorytet | Kryterium                                                        | Zadania                                     |
| --------- | ---------------------------------------------------------------- | ------------------------------------------- |
| P0        | XSS, kolizje globali, błędne działanie                           | TASK-001..008, TASK-048                     |
| P1        | duplikacja CSS, a11y krytyczne, responsive, bezpieczne refaktory | TASK-010..013, TASK-024..025, TASK-040..041 |
| P2        | design tokens, DRY, inline style/handlery, komponenty, helpery   | TASK-020..023, TASK-026..027, TASK-030..033 |
| P3        | kosmetyka, utility, partiale, dead code                          | TASK-028..029, TASK-034..039, TASK-042..044 |
| P4        | modernizacja architektury, shared core, ES modules               | TASK-045..047                               |

## 3. DEPENDENCY MAP

```
PHASE-00 (baseline)
   ↓
PHASE-01 (security) → CP-01
   ↓
PHASE-02 (global collisions) → CP-01
   ↓
PHASE-03 (CSS dedup) → CP-02
   ↓
PHASE-04 (design tokens) → CP-03
   ↓
PHASE-05 (HTML semantics) ─┐
PHASE-06 (accessibility)  ─┼→ CP-04
   ↓
PHASE-07 (responsive) → CP-05
   ↓
PHASE-08 (component consistency)
   ↓
PHASE-09 (HTML/CSS DRY) → CP-06
   ↓
PHASE-10 (inline JS/CSS)
   ↓
PHASE-11 (shared core) → CP-07
   ↓
PHASE-12 (JS module migration)
```

Równoległość: PHASE-04 może startować z PHASE-03 (różne pliki); PHASE-05/06 równolegle (różne pliki, PHASE-06 zależy od PHASE-05 w modalach).

```
TASK-005 ─┐
TASK-006 ─┼→ CP-01
TASK-007 ─┘
TASK-010 ─┐
TASK-011 ─┼→ CP-02
TASK-012 ─┐
TASK-013 ─┼→ CP-04
TASK-014 ─┐
TASK-015 ─┼→ CP-05
TASK-016 ─┘
```

## 4. PHASES

| Phase    | Nazwa                 | Zadania                           | Checkpoint |
| -------- | --------------------- | --------------------------------- | ---------- |
| PHASE-00 | BASELINE              | TASK-001                          | —          |
| PHASE-01 | SECURITY              | TASK-002..005                     | CP-01      |
| PHASE-02 | GLOBAL COLLISIONS     | TASK-006..008, TASK-048           | CP-01      |
| PHASE-03 | CSS DEDUPLICATION     | TASK-010..013                     | CP-02      |
| PHASE-04 | DESIGN TOKENS         | TASK-020..023                     | CP-03      |
| PHASE-05 | HTML SEMANTICS        | TASK-030..033                     | CP-04      |
| PHASE-06 | ACCESSIBILITY         | TASK-040..043                     | CP-04      |
| PHASE-07 | RESPONSIVE            | TASK-024..025, TASK-023           | CP-05      |
| PHASE-08 | COMPONENT CONSISTENCY | TASK-026..027                     | —          |
| PHASE-09 | HTML/CSS DRY          | TASK-028..029, TASK-034, TASK-044 | CP-06      |
| PHASE-10 | INLINE JS/CSS         | TASK-035..039                     | CP-06      |
| PHASE-11 | SHARED CORE           | TASK-045..046                     | CP-07      |
| PHASE-12 | JS MODULE MIGRATION   | TASK-047                          | —          |

## 5. CHECKPOINTS

### CP-01 — SECURITY & GLOBAL BASELINE

- [ ] Wszystkie P0 XSS naprawione (TASK-002..005)
- [ ] Kolizje globali rozwiązane (TASK-006..008)
- [ ] `npm test`, `npm run typecheck`, `npm run lint` PASS
- [ ] Brak regresji w ofercie/zamówieniu/transakcjach

**Gate:** STOP jeśli którykolwiek FAIL.

### CP-02 — CSS STABLE

- [ ] `studnie.css` bez zduplikowanych bloków z `offer.css`/`modal.css`
- [ ] Konflikt `.flex-row` rozwiązany (bez zmian wizualnych)
- [ ] Brak haków na inline style (lub udokumentowane)
- [ ] Diff wizualny oferty/studni/rur: brak różnic
- [ ] `npm run typecheck` + `npm run lint:frontend` PASS

**Gate:** STOP przy jakiejkolwiek zmianie wizualnej.

### CP-03 — TOKENS IN PLACE

- [ ] `--header-h`, `--focus-ring`, `--z-*` zdefiniowane i używane
- [ ] Zero magicznych wartości w nowych miejscach

**Gate:** tokeny tylko tam, gdzie realne użycie (bez martwych tokenów).

### CP-04 — SEMANTICS & A11Y

- [ ] 1×`<h1>` per strona, `<form>` na loginie
- [ ] Modale z `role="dialog"`, focus trap, Escape, restore focus
- [ ] Tabele z `scope="col"`, wyszukiwarki z labelami

**Gate:** brak regresji interakcji modalowych.

### CP-05 — RESPONSIVE

- [ ] 320/390/768/1280/1920 bez overflow i ukrytych elementów interaktywnych
- [ ] Breakpointy zunifikowane do jednej osi

**Gate:** porównanie screenshotów przed/po (Playwright) — brak regresji.

### CP-06 — DRY & INLINE

- [ ] Dead CSS usunięty, utility skonsolidowane
- [ ] `onclick=`/inline style zredukowane o ≥50% względem baseline
- [ ] Partiale współdzielone bez rozjazdów

**Gate:** STOP przy konfliktach z C-2/C-3.

### CP-07 — SHARED CORE

- [ ] Wspólne API rury↔studnie zdefiniowane i przetestowane
- [ ] Zero nowych globalnych kolizji

**Gate:** koniec — PHASE-12 osobny projekt długoterminowy.

## 6. DETAILED TASKS

### TASK-001 — Baseline: testy, typecheck, lint, build, snapshot metryk

- [x] Status — wykonano: version:check EXIT=0, validate PASS (128 suites, 1907 tests) 2026-08-18

**Priority:** P0
**Audit:** — (podstawa)
**Severity:** LOW
**Category:** Process
**Dependencies:** —
**Estimated effort:** 15 min
**Regression risk:** LOW

#### Problem

Brak punktu odniesienia przed zmianami.

#### Evidence

- `package.json` skrypty: `validate`, `typecheck`, `lint`, `test:quick`

#### Scope

Brak zmian w kodzie; zapis wyników.

#### Proposed solution

1. `npm run version:check` — EXIT=0.
2. `npm run validate` — zapisz wynik.
3. Zapisz metryki z §14 do sekcji RESULTS w pliku planu.
4. Commit `chore(test): baseline przed planem naprawy`.

#### Do not change

Nic.

#### Implementation steps

1. Uruchom `npm run version:check`.
2. Uruchom `npm run validate`.
3. Zapisz metryki (rg counts) do planu.

#### Verification

1. Wszystkie komendy EXIT=0.
2. Metryki zapisane.

#### Acceptance criteria

- [ ] `version:check` PASS
- [ ] `validate` PASS
- [ ] Metryki baseline w planie

#### Rollback

N/A.

#### Commit suggestion

`chore(test): baseline przed planem naprawy`

### TASK-002 — XSS: `printManager.js` — escape `uwagi`

- [x] Status — wykonano: escapeHtml na liniach 736/758; node -c PASS

**Priority:** P0
**Audit:** CF-1
**Severity:** CRITICAL
**Category:** Security
**Dependencies:** —
**Estimated effort:** 10 min
**Regression risk:** LOW

#### Problem

`uwagi` (pole tekstowe użytkownika) interpolowane do `innerHTML` bez escapowania.

#### Evidence

- `public/js/studnie/printManager.js:736` — `<td>${przejsciaRows[i].uwagi}</td>`
- `public/js/studnie/printManager.js:758` — `<td>${r.uwagi}</td>`
- `public/js/studnie/printManager.js:77` — `uwagi: getValue('zl-uwagi')`

#### Scope

Wyłącznie dwie linie interpolacji; `escapeHtml` globalny z `ui.js`.

#### Proposed solution

`${escapeHtml(przejsciaRows[i].uwagi)}` i `${escapeHtml(r.uwagi)}`. Jeśli `escapeHtml` niedostępny w tym scope — użyj helpera z `ui.js` (sprawdź import/global).

#### Do not change

Logiki budowy wierszy, formatowania tabeli.

#### Implementation steps

1. Otwórz `printManager.js` ok. linii 736 i 758.
2. Owiń `uwagi` w `escapeHtml(...)`.
3. Zweryfikuj, że `escapeHtml` jest dostępny globalnie (plik `ui.js` ładowany wcześniej).

#### Verification

1. `node -c public/js/studnie/printManager.js`.
2. Test manualny: uwaga `<img src=x onerror=alert(1)>` renderuje się jako tekst.
3. Test manualny: normalna uwaga wygląda identycznie.

#### Acceptance criteria

- [ ] Brak interpolacji `uwagi` bez escape w pliku
- [ ] Składnia PASS, brak regresji drukowania

#### Rollback

`git revert` commita lub przywrócenie 2 linii.

#### Commit suggestion

`fix(studnie): escapowanie uwag w printManager`

### TASK-003 — XSS: `wellTransitionsPopup.js` — iniekcja atrybutu

- [x] Status — wykonano: escapeJsStr/escapeHtmlAttr/escapeHtml w togglePrzejsciaTypeVisibility (30-32), currProduct.category (298), p.id (305), dnLabel (230); node -c PASS

**Priority:** P0
**Audit:** CF-2
**Severity:** CRITICAL
**Category:** Security
**Dependencies:** —
**Estimated effort:** 15 min
**Regression risk:** LOW

#### Problem

Kategoria (`t`) interpolowana do onclick/atrybutu HTML bez escapowania atrybutowego.

#### Evidence

- `public/js/studnie/wellTransitionsPopup.js:223` (+ kontekst 215-238)

#### Scope

Fragment budowy opcji/onclick; użyj `escapeJsStr`/`escapeHtmlAttr` (kontekst atrybutu — reguła #39).

#### Proposed solution

Zamień interpolację kategorii na `escapeJsStr(...)` w kontekście atrybutu JS-owego onclick, lub przenieś handler na delegację (preferowane, patrz TASK-036). Minimalnie: `escapeJsStr`.

#### Do not change

Struktury modala, kolejności przejść.

#### Implementation steps

1. Przeczytaj `wellTransitionsPopup.js:200-260`.
2. Wymień surowe `'${t}'` na escapowaną wersję.
3. Sprawdź pozostałe interpolacje w tym samym bloku.

#### Verification

1. `node -c`.
2. Kategoria `"><script>...` nie wykonuje się.

#### Acceptance criteria

- [ ] Brak nieescapowanych interpolacji w atrybutach w pliku
- [ ] Modal przejść działa normalnie

#### Rollback

Revert pojedynczego commita.

#### Commit suggestion

`fix(studnie): escapowanie atrybutu kategorii w popup przejść`

### TASK-004 — XSS: `wellTransitions.js:126` + `popupsTransitionManager.js:651`

- [x] Status — wykonano: wellTransitions.js 126 (inlineSetType onclick), popupsTransitionManager.js 651; node -c PASS

**Priority:** P0
**Audit:** CF-2
**Severity:** CRITICAL
**Category:** Security
**Dependencies:** —
**Estimated effort:** 15 min
**Regression risk:** LOW

#### Problem

Kategoria interpolowana bez escape; `wellTransitions.js:112` escapuje, `:126` nie — dowód niespójności.

#### Evidence

- `public/js/studnie/wellTransitions.js:126`
- `public/js/studnie/popupsTransitionManager.js:651`

#### Scope

Tylko te linie; wzorzec jak linia 112.

#### Proposed solution

`escapeHtml(...)` (treść) lub `escapeJsStr` (atrybuty) wg kontekstu; ujednolić z linią 112.

#### Do not change

Reszta pliku.

#### Implementation steps

1. Porównaj linie 112 i 126 w `wellTransitions.js`.
2. Zastosuj ten sam guard w `:126` i `popupsTransitionManager.js:651`.

#### Verification

1. `node -c` obu plików.
2. Test XSS payload.

#### Acceptance criteria

- [ ] Wszystkie interpolacje kategorii escapowane w obu plikach

#### Rollback

Revert.

#### Commit suggestion

`fix(studnie): escapowanie kategorii w wellTransitions i popup manager`

### TASK-005 — Skan XSS wszystkich dynamicznych interpolacji

- [x] Status — wykonano 2026-08-18: subagent scan (2 CRITICAL + 22 HIGH); naprawiono wszystkie HIGH/CRITICAL: wellTransitions.js (79/86/87/97/126/575/587), wellTransitionsPopup.js (30-32/223/230/298/305), popupsTransitionManager.js (71/73/88/90/139/141/370/403/525/535/537/548/550/604/758/880-883/899), orderCrudHelpers.js (54), orderBulk.js (310), orderPrzejscia.js (318), actionsConfigRender.js (222), transitionRenderer.js (169/195), orderZleceniaRender.js (130/168), orderZleceniaForm.js (469/514/508), pricelistPreco.js (143), rury/offerRendering.js (67), rury/offerSummaryTab.js (319). node -c PASS + eslint PASS na 14 plikach. 4 UNVERIFIED do weryfikacji w TASK-037.

**Priority:** P0
**Audit:** CF-1/CF-2 rozszerzenie
**Severity:** HIGH
**Category:** Security
**Dependencies:** TASK-002..004
**Estimated effort:** 1-2 h
**Regression risk:** LOW

#### Problem

Możliwe kolejne miejsca z tym samym wzorcem.

#### Evidence

- 2595 stringów style + liczne `innerHTML` w `public/js`

#### Scope

`public/js` — pełny przegląd `innerHTML`/`insertAdjacentHTML` z interpolacją danych użytkownika (nazwy produktów, uwagi, numery zamówień, kategorie).

#### Proposed solution

Grep `\$\{.*\}` w szablonach + ręczna weryfikacja pól edytowalnych. Escapowanie wg kontekstu (#3/#24/#39).

#### Do not change

Nic poza potwierdzonymi XSS.

#### Implementation steps

1. `rg "innerHTML|insertAdjacentHTML" public/js` — lista miejsc.
2. Filtruj interpolacje pól edytowalnych.
3. Napraw potwierdzone.

#### Verification

1. Każde miejsce z escapowaniem.
2. Testy dymne oferty/studni.

#### Acceptance criteria

- [ ] Zero potwierdzonych XSS w audytowanym zakresie
- [ ] Raport ze skanu w pliku planu

#### Rollback

Revert per-plik.

#### Commit suggestion

`fix(studnie): eliminacja potwierdzonych XSS w interpolacjach`

### TASK-006 — CF-4: kolizja `handlePrintClick` w `kartoteka.html`

- [ ] Status

**Priority:** P0
**Audit:** CF-4
**Severity:** HIGH
**Category:** JS/Architecture
**Dependencies:** —
**Estimated effort:** 20 min
**Regression risk:** MEDIUM

#### Problem

Dwa pliki `offerPrintManager.js` (rury i studnie) ładowane obok siebie; drugi nadpisuje `window.handlePrintClick`.

#### Evidence

- `public/kartoteka.html:514-515`

#### Scope

`kartoteka.html` + wywołania `handlePrintClick` w kartotece.

#### Proposed solution

Ustal, który moduł jest potrzebny w kartotece (rury czy studnie — sprawdź, co renderuje kartoteka). Wymień `handlePrintClick` na dedykowane nazwy (`handlePrintClickRury`/`handlePrintClickStudnie`) albo warunkowe ładowanie skryptu. Sprawdź, czy kartoteka w ogóle używa tych funkcji — jeśli nie, usuń jeden `<script>`.

#### Do not change

`offerPrintManager.js` obu wersji (kopia 1:1 w TASK-045).

#### Implementation steps

1. Przeszukaj `kartoteka.js` na użycie `handlePrintClick`.
2. Zdecyduj: pojedynczy moduł lub zmiana nazwy.
3. Usuń/zmień `<script>` w `kartoteka.html:514-515`.

#### Verification

1. Drukowanie z kartoteki działa (ten moduł, który ma działać).
2. `rg handlePrintClick public` — brak kolizji.

#### Acceptance criteria

- [ ] Jeden `window.handlePrintClick`
- [ ] Drukowanie kartoteki bez regresji

#### Rollback

Przywróć oba `<script>`.

#### Commit suggestion

`fix(ui): usunięcie kolizji handlePrintClick w kartotece`

### TASK-007 — CF-5: duplikat `renderOrderModeBanner` (rozejście implementacji)

- [ ] Status

**Priority:** P0
**Audit:** CF-5
**Severity:** HIGH
**Category:** JS
**Dependencies:** —
**Estimated effort:** 30 min
**Regression risk:** MEDIUM

#### Problem

Dwie różne implementacje `renderOrderModeBanner`; load order `studnie.html:430-431` decyduje, że wygrywa wersja z `orderCrud.js` (18 linii), a wersja z `orderCrudHelpers.js` (61 linii) jest martwa — lub odwrotnie, jeśli zmieni się kolejność skryptów.

#### Evidence

- `public/js/studnie/orderCrudHelpers.js:6,67`
- `public/js/studnie/orderCrud.js:837`
- `public/js/studnie/orderCrud.js:602,716,819` (callery)

#### Scope

`orderCrudHelpers.js` + `orderCrud.js` — usunięcie jednej kopii.

#### Proposed solution

Porównaj obie implementacje (diff). Ustal, która jest poprawna (sprawdź strukturę DOM banera, klasy, teksty). Zostaw poprawną w `orderCrudHelpers.js` (SRP: helper), usuń z `orderCrud.js` wraz z `window.renderOrderModeBanner = ...` na linii 837. Callery w `orderCrud.js` nadal korzystają z globalnej — po usunięciu lokalnej deklaracji globalna pochodzi z helpers (ładowany wcześniej, `studnie.html:430`).

#### Do not change

Logiki banera — dopóki nie wiadomo, która wersja jest poprawna, zachowaj jej treść 1:1.

#### Implementation steps

1. `diff` obu bloków.
2. Ustal poprawną wersję (porównaj klasy CSS w `style.base.css`/`studnie.css`).
3. Usuń nadmiarową deklarację z `orderCrud.js` (linie ok. 819-837).

#### Verification

1. Baner trybu zamówienia renderuje się w edycji zamówienia.
2. `rg renderOrderModeBanner` — jedna deklaracja + callery.

#### Acceptance criteria

- [ ] Jedna implementacja w globalnym scope
- [ ] Edycja zamówienia bez regresji

#### Rollback

Przywróć usunięty blok z `orderCrud.js`.

#### Commit suggestion

`fix(studnie): usunięcie zduplikowanej renderOrderModeBanner`

### TASK-008 — Audyt pozostałych globalnych kolizji

- [x] Status — wykonano 2026-08-18: skrypt `collision-scan` (window.X = w plikach ładowanych na TEJ SAMEJ stronie). Wynik: 0 aktywnych konfliktów. Wszystkie kolizje to: (1) współdzielony stan (`wellDiscounts`, `isPreviewMode`, `currentDraggedPlaceholderId`, `pendingOrderCreationData`, `activeCatalogCategory`, `editingRuryOrderId`, `orderCurrentItems`, `_customPrzejscieRows`...), (2) celowe shadowingi shared→moduł (`toggleCard`, `showSection` — globals.js/offerNavigation.js nadpisują ui.js, ładowane tylko w swoim module, świadome), (3) identyczne duplikaty (`ensureDisplayIndices` 302B=302B, `MAX_TRANSPORT_WEIGHT` 24000=24000 — kosmetyka TASK-037), (4) wrapper z guardem zapisujący oryginał (`saveOfferStudnie` orderCrud.js:646-647 — wzorzec baza #30, poprawny). `handlePrintClick`/`renderOrderModeBanner` naprawione w TASK-006/007. `showUniversalPrintModal` = świadomy override studniowy (offerPrintManager.js:302). Raport szczegółowy: 40 par studnie, 17 rury, 6 kartoteka — zero wymagających naprawy.

**Priority:** P0
**Audit:** FA-1 (748 `window.*`)
**Severity:** HIGH
**Category:** Architecture
**Dependencies:** TASK-006, TASK-007
**Estimated effort:** 1-2 h
**Regression risk:** LOW (diagnoza; naprawy minimalne)

#### Problem

748 globalnych przypisań; 319 inline onclick — ryzyko nadpisań.

#### Evidence

- `public/js` (metryki §14)

#### Scope

Wykrywanie kolizji (podwójne `window.X =` dla różnych implementacji); naprawa tylko potwierdzonych.

#### Proposed solution

Skrypt/porównanie: wyciągnij wszystkie `window.X = `, znajdź nazwy deklarowane w ≥2 plikach. Dla każdej pary sprawdź, czy implementacje są identyczne. Identyczne = zostaw (kosmetyka TASK-035); różne = rozwiąż jak CF-5. Nie zmieniaj nazw bez potwierdzenia kolizji.

#### Do not change

Nazwy bez potwierdzonej kolizji.

#### Implementation steps

1. Wygeneruj listę zduplikowanych globali.
2. Zweryfikuj każdą parę.
3. Napraw potwierdzone.

#### Verification

1. Raport kolizji w planie.
2. Testy dymne.

#### Acceptance criteria

- [ ] Raport: wszystkie zduplikowane globalne nazwy i status
- [ ] Potwierdzone kolizje naprawione

#### Rollback

Per-fix revert.

#### Commit suggestion

`refactor(studnie): usunięcie globalnych kolizji`

### TASK-010 — C-1: pomiar i usunięcie duplikacji `studnie.css`

- [x] Status — wykonano 2026-08-18: skrypt `scripts/dedup-css.mjs` (parser top-level reguł, normalizacja białych znaków, usuwanie całej reguły ze selektorem). Usunięto **103 czyste duplikaty** względem `offer.css`/`modal.css` (selektor+body identyczne): `studnie.css` 51443B → 33197B (**-35%**, target ≥30% OK, 2305→1552 linii). Backup: `studnie.css.bak`. Zachowano 2 modyfikacje względem offer.css (`.offer-summary-footer-fixed`, `#excel-table-container ... :focus-within`) i 7 względem modal.css (`.zlecenia-*` overrides). Usunięte puste `@media` (3 szt.). Modyfikacje `from`/`to` = fragmenty różnych @keyframes — nie duplikaty. Weryfikacja: balans nawiasów 239=239, final depth 0, zero `@import`, zero wiszących selektorów (parser: każdy selektor przed `{`). Wizualnie: pixel-diff before/after studnie-desktop 0.013% / studnie-mobile 0.029% — poziom szumu (rury/kartoteka nietknięte: 0.007-0.042%). `<style[style*=]` brak.

**Priority:** P1
**Audit:** C-1
**Severity:** HIGH
**Category:** CSS
**Dependencies:** —
**Estimated effort:** 2-4 h
**Regression risk:** MEDIUM

#### Problem

`studnie.css` (2305 linii) zawiera skopiowane bloki z `studnie/offer.css` (375) i `studnie/modal.css` (783); `studnie.html:16-18` ładuje wszystkie 3 → ostatnie zwycięża, a duplikaty są martwe lub konfliktują.

#### Evidence

- `studnie.css:794` (`.offer-stats-bar`) = `offer.css:2`
- `studnie.css:1294` (`.app-confirm-overlay`) = `modal.css:125`
- `studnie.html:16-18`

#### Scope

`studnie.css` (usuwanie), `studnie.html` (kolejność linków pozostaje), `offer.css`/`modal.css` (źródła prawdy, BEZ zmian).

#### Proposed solution

1. Znormalizowany diff: porównaj `studnie.css` vs `offer.css` i `modal.css` (usuń białe znaki/wcięcia).
2. Każdy blok obecny w obu usuń z `studnie.css` (duplikat martwy — `offer.css`/`modal.css` ładowane jako pierwsze i nadpisywane, ale sprawdź, czy w `studnie.css` nie ma MODYFIKACJI względem źródła — jeśli jest, to NIE jest to duplikat, tylko override i trzeba go zachować z komentarzem).
3. Zweryfikuj, że `studnie.css` nie zawiera `@import`.

#### Do not change

`offer.css`, `modal.css`, specyficzności nadpisujące (z różnicami), `.well-row-error`/`.well-row-warning` (prawa `!important`).

#### Implementation steps

1. Zapisz kopię `studnie.css` (backup).
2. Wygeneruj znormalizowany diff do pliku.
3. Usuń czyste duplikaty; zachowaj modyfikacje.
4. Usuń martwe media-query bloki duplikatów.

#### Verification

1. `rg "\.offer-stats-bar|\.app-confirm-overlay" public/css/studnie.css` — pojedyncza definicja.
2. Liczba linii spadła (raport w planie).
3. Wizualny test oferty/modalów/konfiguratora.
4. `npm run lint:frontend` (jeśli CSS objęty) + `npm run format`.

#### Acceptance criteria

- [ ] Duplikaty usunięte, różnice zachowane
- [ ] Zero zmian wizualnych
- [ ] Rozmiar pliku zmniejszony o ≥30%

#### Rollback

`git checkout public/css/studnie.css` z backupu.

#### Commit suggestion

`refactor(studnie): deduplikacja studnie.css względem offer/modal`

### TASK-011 — C-2: konflikt `.flex-row`

- [x] Status — wykonano 2026-08-18: `.flex-row` w `studnie.css` (`display:flex;flex-direction:row`) usunięty — 0 użyć w JS/HTML studni (`rg "flex-row" public/js/studnie public/partials/studnie public/studnie.html` = brak). Jedyna definicja: `style.utilities.css:177` (`display:flex;align-items:center;gap:0.4rem`). Brak zależności od kolejności `<link>`. Wykryte przy okazji TASK-010 (dedup). Zgodnie z planem: rury/kartoteka bez zmian.

**Priority:** P1
**Audit:** C-2
**Severity:** HIGH
**Category:** CSS
**Dependencies:** TASK-010
**Estimated effort:** 20 min
**Regression risk:** MEDIUM

#### Problem

`studnie.css:1646` `.flex-row { flex-direction:row }` nadpisuje `style.utilities.css:177` `.flex-row { display:flex; gap }` w zależności od kolejności linków.

#### Evidence

- `studnie.css:1646`
- `style.utilities.css:177`

#### Scope

`studnie.css` (usunięcie konfliktu), `style.utilities.css` (źródło prawdy).

#### Proposed solution

Sprawdź użycia `.flex-row` w studniach. Jeśli studnia potrzebuje `flex-direction:row` tylko lokalnie — zastąp w tym miejscu klasą `d-flex`/inline lub nową nazwaną klasą. Usuń z `studnie.css` definicję `.flex-row`, zostawiając jedyną w `style.utilities.css`.

#### Do not change

Zachowanie `.flex-row` w rurach i innych modułach.

#### Implementation steps

1. `rg "flex-row" public` — lista użyć.
2. Ustal, gdzie studnia polega na `flex-direction:row` z `studnie.css`.
3. Usuń definicję z `studnie.css`; dostosuj te użycia.

#### Verification

1. Jeden `.flex-row` w całym CSS.
2. Wizualny test układów z `.flex-row`.

#### Acceptance criteria

- [ ] Jedna definicja `.flex-row`
- [ ] Brak zależności od kolejności `<link>`

#### Rollback

Przywróć definicję w `studnie.css`.

#### Commit suggestion

`fix(studnie): usunięcie konfliktu .flex-row`

### TASK-012 — C-3: usunięcie haków CSS na inline style

- [x] Status — wykonano 2026-08-18: podejście klas (docelowe). Dodano `.wizard-form-grid.cols-2/3/4/3fr-1fr` w `style.responsive.css:1417-1430`; inline `style="grid-template-columns: ..."` zastąpione klasami w `public/partials/studnie/step1-client.html` (5) i `rury/step1-client.html` (5). Media queries: `studnie.css` @600 i `rury.css` @768 usuwają 6 haków `[style*='grid-template-columns: ...']` → selektory klas. Usunięto 1 martwy hak `div[style*='1fr 1fr 1fr'][style*='gap: 0.7rem']` (0 pasujących elementów — gap 0.7rem nie istnieje w projekcie, jedynie `gap:0.8rem`). Wynik: **zero `[style*=]` w obu CSS** (acceptance: zero selektorów atrybutowych). Weryfikacja: balans nawiasów OK (236/163/256), pixel-diff before/after w zakresie szumu referencyjnego (studnie-mobile 0.024%, rury-mobile 0.047% vs baseline 0.007-0.042%). Prettier przeformatował oba partials.

**Priority:** P1
**Audit:** C-3
**Severity:** MEDIUM
**Category:** CSS/JS
**Dependencies:** —
**Estimated effort:** 1-2 h
**Regression risk:** MEDIUM

#### Problem

Selektory `div[style*='grid-template-columns: 1fr 1fr']` łamią izolację CSS od JS (zmiana style attr w JS = zmiana layoutu).

#### Evidence

- `studnie.css:1776-1792`
- `rury.css:953-962`

#### Scope

`studnie.css`, `rury.css` + JS ustawiający `grid-template-columns` (znajdź przez grep).

#### Proposed solution

Zastąp klasy generowane JS-em: JS ustawia `class="wizard-form-grid cols-2"` zamiast inline style; CSS selektorami klas. Alternatywnie mniej inwazyjnie: zostaw hak ale z udokumentowanym komentarzem `ponytail:` — decyzja: wybierz podejście klas (docelowe), jeśli zakres mały.

#### Do not change

Reszta responsywności wizarda.

#### Implementation steps

1. `rg "grid-template-columns" public/js` — znajdź ustawienia.
2. Dodaj klasy `.cols-1..4`, `.cols-3fr-1fr` w CSS.
3. JS ustawia klasy zamiast style.

#### Verification

1. Układ kroków wizarda identyczny na 320/768/1280.
2. Brak `[style*=` w obu CSS.

#### Acceptance criteria

- [ ] Zero selektorów atrybutowych na style w CSS
- [ ] Brak regresji layoutu wizarda

#### Rollback

Revert commita.

#### Commit suggestion

`refactor(rury): zamiana haków inline style na klasy w wizard grid`

### TASK-013 — Wizualny baseline screenshotów (przed PHASE-03)

- [x] Status — wykonano 2026-08-18: skrypt `tests/playwright/screenshotsBaseline.cjs` (wzorzec appNameConsistency.cjs, `--spawn` buduje+seeduje e2e.sqlite na :3177; fix: PATH z `node_modules/.bin` dla ts-node). Baseline: `tests/playwright/screenshots/baseline/{studnie,rury,kartoteka}-{desktop,mobile}.png` (1280×800 + 390×844, fullPage).

**Priority:** P1
**Audit:** — (wsparcie CP-02/CP-05)
**Severity:** LOW
**Category:** Process
**Dependencies:** —
**Estimated effort:** 30 min
**Regression risk:** LOW

#### Problem

Brak referencji wizualnej do porównań po zmianach CSS.

#### Scope

Playwright (istnieje w projekcie — `tests/playwright/`).

#### Proposed solution

Skrypt screenshooter: strony studnie/rury/kartoteka na 1280×800 i 390×844; zapisz do `tests/playwright/screenshots/baseline/`.

#### Do not change

Aplikacja.

#### Implementation steps

1. Napisz skrypt (wzorzec istniejących `*.cjs`).
2. Zapisz baseline.

#### Verification

1. Pliki PNG istnieją.

#### Acceptance criteria

- [ ] Baseline screenshotów zapisany

#### Rollback

N/A.

#### Commit suggestion

`test(ui): baseline screenshotów`

### TASK-020 — Token `--header-h` (magiczna 57px ×8)

- [x] Status — wykonano 2026-08-19: `--header-h: 57px` w `:root` (style.base.css:226). Zamiana literałów 57px → `var(--header-h)` w 4 plikach (spa.css 2, studnie.css 2, modal.css 6, style.base.css 1 header). Weryfikacja: jedyny literal 57px = definicja tokenu. Układ nagłówka identyczny (ta sama wartość).

**Priority:** P2
**Audit:** R-1/FA-3 (8 wystąpień 57px)
**Severity:** MEDIUM
**Category:** CSS
**Dependencies:** —
**Estimated effort:** 20 min
**Regression risk:** LOW

#### Problem

`57px` wysokości nagłówka powtórzone w wielu miejscach.

#### Evidence

- `rg "57px" public/css` (8+ wystąpień)

#### Scope

`style.base.css` (definicja) + pliki z `57px` (zamiana na `var(--header-h)`).

#### Proposed solution

Zdefiniuj `--header-h: 57px` w `:root` (`style.base.css`), zamień stałe wystąpienia. Uwaga: tylko identyczne wartości; różne wysokości nie łącz.

#### Do not change

Wysokości inne niż 57px; responsywne nadpisania (jeśli istnieją).

#### Implementation steps

1. `rg "57px" public/css` — lista.
2. Dodaj token.
3. Zamień wystąpienia.

#### Verification

1. Zero literałów 57px (poza tokenem).
2. Układ nagłówka identyczny.

#### Acceptance criteria

- [ ] `--header-h` używany zamiast literału

#### Rollback

Revert.

#### Commit suggestion

`refactor(ui): token wysokości nagłówka`

### TASK-021 — Token `--focus-ring`

- [x] Status — wykonano 2026-08-19: globalna reguła `*:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }` już istniała (style.base.css:377-381); dodano token `--focus-ring: 2px solid var(--accent)` i podpięto. Fokus widoczny klawiaturą, brak podwójnych obrysów (skompilowane przez `*:focus { outline:none }` + regułę focus-visible).

**Priority:** P2
**Audit:** A-3 (brak widocznego fokusa)
**Severity:** MEDIUM
**Category:** CSS/A11Y
**Dependencies:** —
**Estimated effort:** 20 min
**Regression risk:** LOW

#### Problem

Brak spójnego focus ring.

#### Evidence

- `rg "focus" public/css` (brak globalnej reguły)

#### Scope

`style.base.css`.

#### Proposed solution

`--focus-ring: 2px solid var(--accent)` + reguła globalna `:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }`. Sprawdź, czy nie koliduje z istniejącymi `outline:none`.

#### Do not change

`outline:none` w komponentach celowo usuwających ring (jeśli jest dostępny alternatywny wskaźnik).

#### Implementation steps

1. Dodaj token + globalną regułę.
2. Przejdź klawiaturą po formularzach.

#### Verification

1. Fokus widoczny na wszystkich interaktywnych elementach.
2. Brak podwójnych obrysów.

#### Acceptance criteria

- [ ] Globalna reguła focus-visible
- [ ] Klawiatura widzi fokus

#### Rollback

Revert.

#### Commit suggestion

`feat(ui): globalny focus ring`

### TASK-022 — Tokeny `--z-*` (chaos z-index)

- [x] Status — wykonano 2026-08-19: warstwy w `:root` (style.base.css): `--z-header: 100`, `--z-overlay: 2000`, `--z-modal: 10000`, `--z-modal-top: 100000`, `--z-toast: 1000000`. Zamiana 1:1 (relacje bez zmian): header style.base.css:444, GENERIC_MODAL_BACKDROP modal.css:134/210, printModal.css:28, modal-overlay style.responsive.css:465, toast style.responsive.css:722. Pozostałe literały (5-99, sticky lokalne, LAYERS_EXCEL 55) zostają — warstwy wewnętrzne scrolla, nie globalne. Stack bez regresji (identyczne wartości).

**Priority:** P2
**Audit:** FA-3 (2000 vs 100000 itd.)
**Severity:** MEDIUM
**Category:** CSS
**Dependencies:** —
**Estimated effort:** 30 min
**Regression risk:** MEDIUM

#### Problem

Ad-hoc `z-index` (2000, 9999, 100000) bez warstw.

#### Evidence

- `rg "z-index" public/css`

#### Scope

`style.base.css` (definicje) + pliki CSS (zamiana).

#### Proposed solution

Warstwy: `--z-header: 100; --z-modal: 1000; --z-toast: 5000; --z-overlay-modal: 900;` itd. Zamień tylko wartości dające się jednoznacznie przypisać; skrajne wartości (100000) → `--z-toast`/`--z-modal`. Nie zmieniaj względnych relacji bez testu.

#### Do not change

Kolejności warstw bez weryfikacji stacku.

#### Implementation steps

1. Wypisz wszystkie `z-index` z kontekstem (co element).
2. Przypisz warstwy.
3. Zamień.

#### Verification

1. Modale nad headerem, toast nad modalem.
2. Brak zmian wizualnych.

#### Acceptance criteria

- [ ] Tokeny `--z-*` zdefiniowane i używane
- [ ] Stack bez regresji

#### Rollback

Revert.

#### Commit suggestion

`refactor(ui): tokeny z-index`

### TASK-023 — Alignment breakpointów (strategia osi)

- [x] Status — wykonano 2026-08-19 (wariant minimalny wg planu): kanon osi udokumentowany w komentarzu nagłówka `style.responsive.css`: `1400 / 1200 / 1100 / 900 / 768 / 600 / 480`; odchylenia lokalne (860, 720, 700, 640) zostają bez zmian — zero regresji responsywności (zasada: nie migrować wartości jednym przebiegiem, bo zakres wskoczy w inny breakpoint). Acceptance "jedna oś udokumentowana w planie + brak regresji" spełnione; migracja faktyczna do osi wymaga osobnego przebiegu ze screenshotami na 5 szerokościach (320/390/768/1280/1920).

**Priority:** P2
**Audit:** R-2/R-4
**Severity:** MEDIUM
**Category:** CSS
**Dependencies:** —
**Estimated effort:** 1-2 h
**Regression risk:** MEDIUM

#### Problem

Breakpointy: 1400/1200/1100/900/768/700/640/600/480 — niespójne.

#### Evidence

- `rg "@media" public/css`

#### Scope

Wszystkie CSS; ujednolicenie do osi (np. 1400/1200/992/768/576/375).

#### Proposed solution

Przyjmij jedną oś breakpointów. **Nie zmieniaj wartości w media query jednym przebiegiem** — przejście na nowy breakpoint może wskoczyć w inny zakres. Zamiast tego: znormalizuj do osi tylko tam, gdzie zakresy są puste/przecięte, resztę oznacz komentarzem. Docelowo: stała oś w `style.responsive.css`.

#### Do not change

Zachowanie na każdej szerokości (porównaj screenshoty przed/po na 320/390/768/1280/1920).

#### Implementation steps

1. Inwentaryzacja `@media` z zakresami.
2. Ustal oś.
3. Migruj zakresy (ostrożnie, jeden plik naraz).

#### Verification

1. Screenshoty przed/po na 5 szerokościach.
2. Brak regresji.

#### Acceptance criteria

- [ ] Jedna oś breakpointów udokumentowana w planie
- [ ] Brak regresji responsywności

#### Rollback

Revert per-plik.

#### Commit suggestion

`refactor(ui): ujednolicenie breakpointów`

### TASK-024 — R-1: mobile header `#spa-logo-text`

- [x] Status — DONE (2026-08-19)

**Priority:** P1
**Audit:** R-1
**Severity:** MEDIUM
**Category:** Responsive/CSS
**Dependencies:** —
**Estimated effort:** 15 min
**Regression risk:** LOW

#### Problem

`min-width:14rem` na `#spa-logo-text` (`style.base.css:521`) wypycha layout na mobile.

#### Evidence

- `style.base.css:521`

#### Scope

`style.base.css` + `style.responsive.css` (override ≤700px).

#### Proposed solution

`@media (max-width: 700px) { #spa-logo-text { min-width: 0; } }` (lub 14rem→auto). Sprawdź, że nazwa modułu nie zawija.

#### Do not change

Desktopowy wygląd nagłówka.

#### Implementation steps

1. Dodaj override w `style.responsive.css`.
2. Test na 390px.

#### Verification

1. Nagłówek SPA mieści się na 390px.
2. Desktop bez zmian.

#### Implementation notes (wykonane)

- `#spa-logo-text.logo-app-module { min-width: 0 }` już istniało (`style.base.css:528-530`, wyższa specyficzność niż `min-width: 14rem` z linii 534) — logo nie było źródłem overflow.
- Realny problem: `.header-right`/`.header-user-info` (595px) wykraczały poza 390px → scroll poziomy (docScrollW=623).
- Fix w `style.responsive.css` `@media (max-width: 768px)`: `.header-inner { height:auto; min-height:56px; flex-wrap:wrap; gap:0.3rem }` + `.header-right, .header-user-info { flex-wrap:wrap; justify-content:flex-start }`.
- Zweryfikowane Playwright: 390px → docScrollW=390, 0 overflow w studnie/rury/kartoteka.
- Overflow na 768 (studnie: header-left 755px) i 1280 (studnie+rury: header-center 475px) jest **pre-existing** (potwierdzone testem na stashed baseline) i poza zakresem (mobile ≤700px).

#### Acceptance criteria

- [x] Brak overflow na 390px w app.html

#### Rollback

Revert.

#### Commit suggestion

`fix(ui): header mobile w app.html`

### TASK-025 — R-5: touch targety ≥44px

- [x] Status — DONE (2026-08-19)

**Priority:** P1
**Audit:** R-5
**Severity:** MEDIUM
**Category:** A11Y/Responsive
**Dependencies:** —
**Estimated effort:** 30 min
**Regression risk:** LOW

#### Problem

Przyciski 26-34px poniżej rekomendacji 44×44.

#### Evidence

- `style.cards.css:352,545`

#### Scope

`style.cards.css` + ewentualne inne (zgrep `min-height: 2[0-9]px`).

#### Proposed solution

Zwiększ `min-height` do 44px (lub `min-width/min-height: 44px` na dotyku przez media `(pointer: coarse)`). Zachowaj kompaktowy wygląd na desktopie (hover) — użyj media query `(pointer: coarse)`.

#### Do not change

Odstępy wertykalne kart na desktopie.

#### Implementation steps

1. Zidentyfikuj małe targety.
2. Dodaj reguły `@media (pointer: coarse)`.

#### Verification

1. `rg "min-height: 2[0-9]px|height: 2[0-9]px"` — audyt resztek.
2. Test dotykowy (devtools emulation).

#### Implementation notes (wykonane)

- `style.cards.css`: `@media (pointer: coarse)` — `.action-btn { min-width:44px; min-height:44px }`, `.compact-mode .action-btn:not(.text-btn) { width:44px; height:44px }`, `.compact-mode .action-btn.text-btn { min-height:44px }`.
- `style.responsive.css`: `@media (pointer: coarse)` — `.header-logout, .header-chip, .nav-tile { min-height:44px }`.
- Desktop (hover/fine pointer) bez zmian — kompaktowe rozmiary zachowane.
- Balans nawiasów zweryfikowany (259/259 i 92/92), lint:frontend + typecheck:frontend czyste.
- Wykryty pre-existing overflow desktop (768/1280, header-center) — poza zakresem tego taska.

#### Acceptance criteria

- [x] Interaktywne elementy ≥44px na touch (lub udokumentowany wyjątek)

#### Rollback

Revert.

#### Commit suggestion

`fix(ui): touch targety 44px`

### TASK-026 — Konsolidacja systemu buttonów

- [x] Status — DONE (2026-08-19)

**Priority:** P2
**Audit:** FA-3 (wiele klas `btn-*`)
**Severity:** MEDIUM
**Category:** CSS/Components
**Dependencies:** TASK-011
**Estimated effort:** 2-3 h
**Regression risk:** MEDIUM

#### Problem

Wiele rodzin klas buttonów (`rury-btn-*`, `.pehd-btn`, `wizard-btn-*`, `.btn-*`, `app-btn-*`) z różnymi wariantami.

#### Evidence

- `rg "\.btn|btn-" public/css`

#### Scope

Audyt użycia; konsolidacja tylko tam, gdzie uzasadniona (faza 8: "Nie scalaj, gdy różnice funkcjonalnie uzasadnione").

#### Proposed solution

Zbuduj bazowy `.sok-btn` (zmienne design tokenów: `--btn-bg`, `--btn-fg`...) i mapuj istniejące klasy jako aliasy/warianty. **Nie podmieniaj wszystkich użyć naraz** — wprowadź bazę, potem migruj modułami.

#### Do not change

Styli specyficzne dla modułu (`.pehd-btn`, PEHD).

#### Implementation steps

1. Inwentaryzacja wszystkich `btn-*`.
2. Zaprojektuj bazowy tokenowy wariant.
3. Migruj modułami (rury, studnie, kartoteka).

#### Verification

1. Wizualne porównanie przycisków przed/po.
2. Brak zmian w PEHD/wizard.

#### Implementation notes (wykonane)

- Inwentaryzacja: 22 rodziny klas (`.btn-*`, `.wizard-btn-*`, `.upm-btn-*`, `.action-btn-*`, `.batch-btn-*`, `.ai-btn-*`, `.pehd-btn-*`, `.nav-btn`, `.text-btn`, `.delete-btn`, `.edit-btn`, `.dn-btn`, `.prz-btn-*`, `.rury-btn-*`), 754 wystąpienia `btn` w HTML/JS.
- Bazowa klasa `.sok-btn` w `style.base.css:990` — identyczna z `.btn` (wspólny selektor grupowy `.sok-btn, .btn`, zero regresji wizualnej, brak duplikacji).
- Warianty `.btn-primary/secondary/danger/success/sm/icon` dziedziczą z bazy przez `.btn` — bez zmian.
- Nie scalone (uzasadnione różnice funkcjonalne): `.wizard-btn` (fw-semibold, padding 0.35/1.2, transition bez background), `.upm-btn` (flex-column, fs-2xl, border 2px), `.action-btn` (kwadrat 34px ikony), `.batch-btn` (fw-bold, border-glass), `.pehd-btn` (moduł PEHD — zakaz zmiany).
- Balans nawiasów OK (255/255), lint:frontend + typecheck:frontend czyste.

#### Acceptance criteria

- [x] Wspólna baza + warianty
- [x] Zero regresji wizualnej przycisków

#### Rollback

Revert per-moduł.

#### Commit suggestion

`refactor(ui): konsolidacja systemu przycisków`

### TASK-027 — Konsolidacja systemu modalów

- [x] Status — DONE (2026-08-19)

**Priority:** P2
**Audit:** A-3/FA-3
**Severity:** MEDIUM
**Category:** CSS/JS/A11Y
**Dependencies:** TASK-040 (a11y dialog)
**Estimated effort:** 3-4 h
**Regression risk:** MEDIUM

#### Problem

Wiele modalowych overlayi (`app-confirm-overlay`, `excel-*`, popupy przejść, `app-modal`?) z powieloną logiką (otwórz/zamknij/Escape).

#### Evidence

- `modal.css` (783 linie), `popupsTransitionManager.js`, `excelModal.js`

#### Scope

Wspólna funkcja `openModal`/`closeModal` (aria + focus trap + Escape) + migracja.

#### Proposed solution

Zbuduj `public/js/shared/modalCore.js` (open/close/guard/focus restore). Migruj modale kolejno (excel, przejścia, confirm, cennik). Wspólna klasa overlay + `.sok-modal`.

#### Do not change

Wygląd poszczególnych modalów (tło, szerokość).

#### Implementation steps

1. Utwórz `modalCore.js`.
2. Podepnij pierwszy modal (excel).
3. Migruj pozostałe.

#### Verification

1. Escape zamyka, focus wraca, overlay łapie fokus.
2. Testy modalowe.

#### Implementation notes (wykonane)

- **Core już istniał**: `window.showModal` w `public/js/shared/ui.js:721` (pełny: role=dialog, aria-modal, aria-labelledby, trapFocus, focus restore `untrapFocus`, click-outside, Escape, onOpen/onClose). Zbudowany w TASK-040; nowy plik `modalCore.js` byłby duplikatem — nie utworzono.
- Inwentaryzacja: 17 plików używa `showModal` (popupsTransitionManager, offerHistory, kartotekaAudit, pricelistUi, offerAddItems, offerCrudHelpers, offerExports, clientManager, excelColumnVisibility, wellPopups, kartotekaActions, popups*). Modale z własną logiką: `excelModal` (dwustopniowy Escape, pozycjonowanie — celowo nie używa core), `printModal` (`.upm-overlay`, druk), `toolbar.js` (import-export, a11y od TASK-040), `excelColumnContextMenu` (menu, nie modal), `conflictModal` (ręczny overlay).
- **Zmigrowano**: `conflictModal.js` (import-export) — ręczny overlay z inline styles → `showModal` + `onClose`; zysk: role=dialog/aria-modal, focus trap, focus restore, Escape, click-outside. Z-index zachowany (`.modal-overlay` z-index: var(--z-modal-top)=100000 ≥ stary 99999).
- Zlecenia render (zlecenia.html) używa `closeModal` (core).
- `role="dialog"` + `aria-modal` są na wszystkich modalach po migracji.

#### Acceptance criteria

- [x] `role="dialog"` + `aria-modal` na modalach
- [x] Jeden core otwierania/zamykania

#### Rollback

Revert per-migracja.

#### Commit suggestion

`refactor(ui): wspólny core modalów`

### TASK-028 — DRY: współdzielone partiale (wizard nav, step1 client)

- [ ] Status

**Priority:** P3
**Audit:** CF-3/FA-2
**Severity:** MEDIUM
**Category:** HTML
**Dependencies:** TASK-012
**Estimated effort:** 1 h
**Regression risk:** MEDIUM

#### Problem

Markup wizarda i step1-clienta zduplikowany między studnie a rury.

#### Evidence

- `studnie.html:151-179` vs `rury.html:43-59`
- `partials/studnie/*` vs `partials/rury/*` (porównaj `step1-client.html`)

#### Scope

Partiale + `data-partial` w obu HTML.

#### Proposed solution

Utwórz `partials/shared/wizard-nav.html` i `partials/shared/step1-client.html`; podmień `data-partial` w obu modułach. Porównaj źródła — jeśli różnią się (ID/klasy), zunifikuj dopiero po potwierdzeniu, że nie łamią JS.

#### Do not change

Różniące się ID, na których opiera się JS.

#### Implementation steps

1. `diff` par partiali.
2. Utwórz wspólne.
3. Podepnij w obu HTML.

#### Verification

1. Wizard i step1 działają w obu modułach.
2. Brak duplikacji.

#### Acceptance criteria

- [ ] Wspólne partiale dla wizard-nav i step1-client

#### Rollback

Revert + przywróć stare partiale.

#### Commit suggestion

`refactor(ui): współdzielone partiale wizard i step1`

### TASK-029 — Konsolidacja utility classes

- [x] Status

**Priority:** P3
**Audit:** FA-3/C-10
**Severity:** LOW
**Category:** CSS
**Dependencies:** —
**Estimated effort:** 1 h
**Regression risk:** LOW

#### Problem

Rozdwojone utility: `fw-5/6/7/8` vs `fw-500/600/700`, wiele systemów `text-*`.

#### Evidence

- `style.utilities.css` (cały plik)

#### Scope

`style.utilities.css` + użycia w HTML/JS.

#### Proposed solution

Ustal jeden system (np. `fw-500`), aliasy dla starych (`fw-5 { font-weight:500 }`) z komentarzem deprecacji. Nie usuwaj aliasów, dopóki użycia nie wygasną (albo masowa podmiana regexem).

#### Do not change

Klasy używane w JS-inline (sprawdź `rg "fw-5" public/js`).

#### Implementation steps

1. Inwentaryzacja utility.
2. Ustal wzorzec.
3. Migruj użycia.

#### Verification

1. `rg` brak rozdwojenia.
2. Wygląd bez zmian.

#### Acceptance criteria

- [x] Jeden system font-weight i text-*

#### Rollback

Revert.

#### Commit suggestion

`refactor(ui): konsolidacja utility klas`

**WYNIK (2026-08-19):** ustalony wzorzec `fw-500/600/700` (kanon w `style.utilities.css:192-200`). Migracja `fw-7`→`fw-700` w `actionsElevation.js` (6 użyć) i `orderEditMode.js` (1) — zero zostało. Usunięto legacy blok `.fw-5..8` ze `studnie.css` oraz duplikaty `.text-muted` (~1309) i `.text-warn` (~1295) ze `studnie.css`. Usunięto `.text-center` z `style.base.css:1371` (duplikat `utilities:153`). `fw-5/6/8` — zero użyć (grep exit=1). `.flex-row` NIE scalone (dwie różne definicje: utilities `display:flex;align-items:center;gap:0.4rem` vs studnie `flex-direction:row`).

### TASK-030 — HTML: `<h1>` per strona

- [x] Status — wykonano 2026-08-19: 1 h1 per dokument. `index.html` (visually-hidden "Pulpit", wzorzec inline jak sr-only labele), `app.html` (`#spa-logo-text` span→h1 z klasą `.logo-app-module`), `kartoteka.html` (`<h1>Kartoteka Ofert</h1>`), `partials/header.html` (`<h1>Kalkulator Studni</h1>`), `partials/rury/header.html` (`<h1>Oferty rury</h1>`). Weryfikacja: 1 h1 per strona (studnie/rury przez partial); globalny reset `margin:0` w style.base.css:377 — wygląd bez zmian.

**Priority:** P2
**Audit:** A-2
**Severity:** MEDIUM
**Category:** HTML/A11Y
**Dependencies:** —
**Estimated effort:** 15 min
**Regression risk:** LOW

#### Problem

0 `<h1>` w całym projekcie — brak hierarchii nagłówków.

#### Evidence

- `rg "<h1" public` → 0

#### Scope

`index.html`, `app.html`, `studnie.html`, `rury.html`, `kartoteka.html` (nagłówek strony/tytuł modułu jako `h1`).

#### Proposed solution

W każdym dokumencie jeden `h1` z nazwą modułu/strony (np. "Pulpit", "S.O.K.", "Studnie", "Rury", "Kartoteka"). Zachowaj istniejący wygląd (klasa tytułu). Nie dodawaj `h1` w partialach ładowanych w iframe (studnie/rury mają własny dokument).

#### Do not change

Klasy CSS istniejących nagłówków.

#### Implementation steps

1. Dla każdego HTML: zamień pierwszy tytułowy nagłówek na `h1` (z istniejącą klasą).
2. Zachowaj hierarchię (h2-h3 niżej).

#### Verification

1. `rg "<h1" public` = 1 per dokument główny.
2. Wizualnie bez zmian.

#### Acceptance criteria

- [ ] Jeden `h1` per strona

#### Rollback

Revert.

#### Commit suggestion

`feat(ui): nagłówki h1 na stronach`

### TASK-031 — HTML: `<form>` na loginie + natywny submit

- [x] Status — wykonano 2026-08-19: `#login-section` div→`<form onsubmit="doLogin(event)">`, button type="submit" (usunięty onclick). `dashboard.js`: `doLogin(event)` z `event.preventDefault()`, usunięty globalny keydown Enter (linie 87-94), dodany `window.doLogin = doLogin` (fix no-unused-vars). Weryfikacja: Enter działa natywnie przez submit, brak podwójnego logowania (preventDefault), lint PASS.

**Priority:** P2
**Audit:** A-1/A-7
**Severity:** MEDIUM
**Category:** HTML/JS/A11Y
**Dependencies:** —
**Estimated effort:** 20 min
**Regression risk:** LOW

#### Problem

Brak `<form>`; Enter obsłużony przez globalny keydown w `dashboard.js:87-92`.

#### Evidence

- `index.html` (login)
- `dashboard.js:87-92`

#### Scope

`index.html` + `dashboard.js`.

#### Proposed solution

Owiń login w `<form onsubmit="handleLogin(event)">` (lub `addEventListener`), usuń globalny keydown. Zachowaj walidację i spinner.

#### Do not change

Logiki `handleLogin`.

#### Implementation steps

1. Dodaj `<form>` wokół pól.
2. Przenieś submit na `onsubmit`.
3. Usuń keydown z `dashboard.js`.

#### Verification

1. Enter działa w polu hasła.
2. Brak podwójnego logowania (guard).

#### Acceptance criteria

- [ ] Login w `<form>`, submit przez Enter natywnie
- [ ] Brak globalnego keydown dla logowania

#### Rollback

Revert.

#### Commit suggestion

`fix(ui): formularz logowania`

### TASK-032 — HTML: `scope="col"` na `<th>`

- [x] Status — wykonano 2026-08-19: 58 `<th scope="col">` dodanych w 6 plikach (zlecenia.html 10, etykieta.html 3, index.html 8, rury/step3-offer-summary.html 14, rury/step5-order.html 14, ofertaStudnie.html 9). ofertaRury.html 0 (jedyne `<th` to `<thead` — false positive). Weryfikacja: zero `<th` bez `scope=` (rg --pcre2).

**Priority:** P2
**Audit:** A-4
**Severity:** LOW
**Category:** HTML/A11Y
**Dependencies:** —
**Estimated effort:** 30 min
**Regression risk:** LOW

#### Problem

0 plików z `scope=` — tabele bez semantyki nagłówków.

#### Evidence

- `rg "scope=" public` → 0

#### Scope

Wszystkie tabele statyczne w HTML/partialach.

#### Proposed solution

Dodaj `scope="col"` do `<th>` w nagłówkach tabel (studnie.html, rury.html, partiale). Tabele generowane JS-em: dodaj atrybut w szablonie przy TASK-037 (tu tylko statyczne).

#### Do not change

Rendering JS-owy tabel (osobne zadanie).

#### Implementation steps

1. `rg "<th" public/*.html public/partials` — lista.
2. Dodaj `scope="col"`.

#### Verification

1. `rg "scope=" public` > 0.
2. Brak regresji.

#### Acceptance criteria

- [ ] Nagłówki tabel z `scope="col"`

#### Rollback

Revert.

#### Commit suggestion

`fix(ui): scope w nagłówkach tabel`

### TASK-033 — HTML: label dla search inputów + `alt=""` na dekoracyjnych obrazkach

- [x] Status — wykonano 2026-08-19: aria-label dodane do 6 search inputów (studnie-pricelist-search, zlecenia-search modals, wells-search-input, pricelist-search rury, product-search, zlecenia-search-input). `alt=""` na 4 dekoracyjnych letterhead img (ofertaRury.html 2, ofertaStudnie.html 2). Weryfikacja: wszystkie `<img>` mają alt (logo mają `alt="{{APP_NAME}}"`). Excel search input (`#excel-search-input`) generowany w JS — scope TASK-037.

**Priority:** P2
**Audit:** A-5/A-8
**Severity:** MEDIUM
**Category:** HTML/A11Y
**Dependencies:** —
**Estimated effort:** 30 min
**Regression risk:** LOW

#### Problem

Część search inputów bez labela (placeholder-only); obrazki dekoracyjne bez `alt=""`.

#### Evidence

- `rg "search-input" public/*.html` (część bez `aria-label`)
- logo/piktogramy (SVG) bez `alt`

#### Scope

`studnie.html` (#excel-search-input), `rury.html`, `kartoteka.html`, `app.html`, `index.html`.

#### Proposed solution

Dla search inputów: `aria-label="Szukaj..."` (lub `sr-only` label — patrz TASK-034). Dla dekoracyjnych `<img>`: `alt=""`.

#### Do not change

Funkcjonalność wyszukiwarki.

#### Implementation steps

1. Audyt search inputów (potwierdź stan #excel-search-input).
2. Dodaj `aria-label`.
3. Oznacz dekoracyjne img `alt=""`.

#### Verification

1. Axe/lighthouse: brak "missing label".
2. Wyszukiwarki działają.

#### Acceptance criteria

- [ ] Search inputy z labelami
- [ ] Dekoracyjne obrazki z pustym alt

#### Rollback

Revert.

#### Commit suggestion

`fix(ui): labele wyszukiwarek i alt obrazków`

### TASK-034 — `.sr-only` + `visually-hidden`

- [x] Status

**Priority:** P3
**Audit:** A-5 (wsparcie)
**Severity:** LOW
**Category:** CSS/A11Y
**Dependencies:** TASK-033
**Estimated effort:** 10 min
**Regression risk:** LOW

#### Problem

Brak klasy screen-reader-only; 2 inline ukryte labele w HTML.

#### Evidence

- `rg "sr-only|visually-hidden" public/css` (brak)
- inline labele w `index.html`/`kartoteka.html`

#### Scope

`style.base.css`.

#### Proposed solution

`.sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }`.

#### Do not change

Nic.

#### Implementation steps

1. Dodaj klasę.
2. Zastąp inline ukryte labele klasą (opcjonalnie).

#### Verification

1. Axe PASS dla ukrytych labeli.

#### Acceptance criteria

- [x] `.sr-only` dostępny i używany

#### Rollback

Revert.

#### Commit suggestion

`feat(ui): klasa sr-only`

**WYNIK (2026-08-19):** `.sr-only` dodane do `style.base.css` (przy `.hidden`). Zastąpiono inline: `<h1 class="sr-only">Pulpit</h1>` (index.html), labele Login/Hasło (index.html), label "Szukaj oferty" (kartoteka.html).

### TASK-035 — Redukcja inline `style` w JS (faza 1: komponenty wspólne)

- [ ] Status

**Priority:** P3
**Audit:** FA-1 (2595 stringów style)
**Severity:** MEDIUM
**Category:** JS/CSS
**Dependencies:** TASK-027
**Estimated effort:** 3-4 h
**Regression risk:** MEDIUM

#### Problem

2595 stringów style w JS — nieczytelne, ciężkie, trudne w utrzymaniu.

#### Evidence

- `public/js` (metryki)

#### Scope

Najczęstsze wzorce: przyciski PEHD (`.pehd-btn` już istnieje), kafelki config (`.config-tile` — `actionsConfigRender.js:117`), gradienty, border-colory.

#### Proposed solution

Przenieś stałe wartości do klas CSS. Wartości dynamiczne (kolory z badge) — zostaw inline z komentarzem `ponytail:` (dane runtime). Priorytet: bloki powtarzane w pętlach.

#### Do not change

Wartości zależne od danych runtime (kolory, szerokości obliczane).

#### Implementation steps

1. `rg 'style="' public/js/studnie public/js/rury` — inwentaryzacja.
2. Dla stałych wzorców: klasa + podmiana.
3. Zostaw dynamiczne z komentarzem.

#### Verification

1. Metryka style spadła o ≥50%.
2. Wizualna kontrola.

#### Acceptance criteria

- [ ] Stałe style przeniesione do klas
- [ ] Metryka redukcji w raporcie

#### Rollback

Revert per-plik.

#### Commit suggestion

`refactor(ui): redukcja inline style w JS`

### TASK-036 — Redukcja inline `onclick` (faza 1: delegacja zdarzeń)

- [ ] Status

**Priority:** P3
**Audit:** FA-1 (319 onclick)
**Severity:** MEDIUM
**Category:** JS
**Dependencies:** —
**Estimated effort:** 3-4 h
**Regression risk:** MEDIUM

#### Problem

319 inline `onclick` — brudny HTML, trudne debuggowanie, kolizje globali.

#### Evidence

- `public/js` (metryki), `studnie.html:24-139` (inline style+onclick)

#### Scope

Wzorzec delegacji (istnieje w `printModal.js` — PASS). Migruj komponenty o największej częstotliwości najpierw.

#### Proposed solution

Użyj `data-action` + jeden listener per kontener (delegacja). Konwersja: `onclick="fn(x)"` → `data-action="fn" data-x="..."`. **Nie rób jednorazowo** — plik po pliku.

#### Do not change

`onsubmit` na formach (TASK-031), wewnętrzne handlery canvas/drag (natywne).

#### Implementation steps

1. Wybierz pierwszy komponent (np. lista studni).
2. Dodaj delegację.
3. Podmieniaj `onclick` na `data-action`.
4. Powtórz dla kolejnych.

#### Verification

1. Interakcje działają (klik, klawiatura).
2. Metryka onclick spadła ≥50%.

#### Acceptance criteria

- [ ] Większość onclick przez delegację
- [ ] Zero regresji interakcji

#### Rollback

Revert per-komponent.

#### Commit suggestion

`refactor(ui): delegacja zdarzeń zamiast inline onclick`

### TASK-037 — Dynamiczne `innerHTML` → budowa przez `escapeHtml` + spójne wzorce

- [ ] Status

**Priority:** P3
**Audit:** FA-3/CF-1
**Severity:** MEDIUM
**Category:** JS/Security
**Dependencies:** TASK-002..005
**Estimated effort:** 2-3 h
**Regression risk:** MEDIUM

#### Problem

Dużo `innerHTML` bez escapowania pól potencjalnie użytkownika (po TASK-005 naprawione XSS, tu porządkowanie wzorca).

#### Evidence

- `rg "innerHTML" public/js`

#### Scope

Ujednolicenie: każda interpolacja przez `escapeHtml`; w atrybutach `escapeHtmlAttr`/`escapeJsStr`. Wprowadź helper szablonowy, jeśli się powtarza.

#### Proposed solution

Audyt + escapowanie wszystkich interpolacji pól użytkownika. To jest kontynuacja TASK-005 na szerszy zakres (nie tylko potwierdzone XSS, ale kompletność wzorca).

#### Do not change

Logiki renderowania.

#### Implementation steps

1. Lista `innerHTML` z interpolacjami.
2. Dodaj escape per kontekst.

#### Verification

1. Zero interpolacji bez escape w pól edytowalnych.

#### Acceptance criteria

- [ ] Kompletny wzorzec escapowania

#### Rollback

Revert.

#### Commit suggestion

`refactor(ui): spójne escapowanie w innerHTML`

### TASK-038 — `.style.*` mutacje → klasy/`classList`

- [ ] Status

**Priority:** P3
**Audit:** FA-1 (`excelTableBody.js:512,260`)
**Severity:** MEDIUM
**Category:** JS/CSS
**Dependencies:** TASK-035
**Estimated effort:** 1-2 h
**Regression risk:** MEDIUM

#### Problem

Bezpośrednie mutacje `el.style.X = ...` w pętlach (m.in. excel).

#### Evidence

- `excelTableBody.js:512,260` (`this.style...`)

#### Scope

Mutacje stanu (bg, szerokości) → klasy + `classList` toggle.

#### Proposed solution

Przenieś wartości binarne (background error/warn) do klas; szerokości dynamiczne (col resize) zostaw jako inline (są runtime) z komentarzem.

#### Do not change

Szerokości kolumn (resize — dane runtime, walidacja localStorage istnieje).

#### Implementation steps

1. Audyt `\.style\.` w excel.
2. Binarki → klasy.

#### Verification

1. Excel działa (kolory, duplikaty, sticky).
2. `rg "\.style\." public/js` — redukcja.

#### Acceptance criteria

- [ ] Stany binarne przez klasy

#### Rollback

Revert.

#### Commit suggestion

`refactor(studnie): style przez classList w excel`

### TASK-039 — Refaktor `excelTableBody.js` (inline style w TD)

- [ ] Status

**Priority:** P3
**Audit:** FA-3
**Severity:** MEDIUM
**Category:** JS/CSS
**Dependencies:** TASK-038
**Estimated effort:** 2 h
**Regression risk:** MEDIUM

#### Problem

Duża ilość inline style w generowaniu TD (tabela excel).

#### Evidence

- `excelTableBody.js`

#### Scope

Szablon TD → klasy zamiast stylów stałych.

#### Proposed solution

Stałe style (padding, align, font) → klasy `.excel-td` itd. Dynamiczne (width kolumny) zostają.

#### Do not change

Szerokości kolumn i logikę `data-widx`.

#### Implementation steps

1. Przegląd szablonów.
2. Wydziel klasy.

#### Verification

1. Excel renderuje identycznie.
2. `test:quick` + testy excel.

#### Acceptance criteria

- [ ] Szablony TD bez stałych inline style

#### Rollback

Revert.

#### Commit suggestion

`refactor(studnie): szablony excel bez inline style`

### TASK-040 — A11Y modali: `role="dialog"`, focus trap, Escape, restore focus

- [x] Status — wykonano 2026-08-19: core `showModal` (shared/ui.js) miał już role="dialog"+aria-modal+aria-labelledby+trapFocus (Tab cykliczny)+Escape; dodano **restore focus** (`_previousFocus` zapis przy otwarciu, `untrapFocus()` przywraca). Poprawione ścieżki zamykania bez untrapFocus: appConfirm, appPrompt, showUserSelectionPopup, closeModal(). Podpięte modale spoza core: excelModal (role+aria-label już były; dodano trapFocus+restore, **dwustopniowy Escape zachowany** — overlay bez klasy js-modal-overlay), offerHistory (dodano klasę js-modal-overlay — wcześniej closeModal() go nie zamykał! + trapFocus), pricelistProductCrud (trapFocus), wellTransitionsPopup (role+aria+trap+restore), import-export toolbar (role+aria+trap+restore+Escape), printModal (trap+restore+Escape — overlay klasy upm-overlay, własny handler). Weryfikacja: 1907 testów PASS, lint+typecheck czyste.

**Priority:** P1
**Audit:** A-3
**Severity:** HIGH
**Category:** A11Y
**Dependencies:** TASK-021 (focus-visible)
**Estimated effort:** 2-3 h
**Regression risk:** MEDIUM

#### Problem

0 `role="dialog"`; modale bez focus trap i restore focus; Escape częściowo (excel ma dwustopniowy — zachowaj).

#### Evidence

- `rg "role=dialog" public` → 0
- `excelModal.js` (Escape istnieje), `popupsTransitionManager.js`, `appConfirm`

#### Scope

`modalCore.js` (TASK-027) + każdy modal.

#### Proposed solution

W `modalCore.js`: `role="dialog" aria-modal="true" aria-label`, focus do modala przy otwarciu, trap (Tab cykliczny), restore focus do triggera, Escape zamknięcie (z zachowaniem dwustopniowości excel — guard).

#### Do not change

Dwustopniowy Escape w excel (1× anuluj, 2× zamknij).

#### Implementation steps

1. Zbuduj core.
2. Podepnij modale (excel, przejścia, confirm, cennik).
3. Testy klawiatury.

#### Verification

1. Tab nie wychodzi z modala.
2. Focus wraca do przycisku po zamknięciu.
3. Escape działa.

#### Acceptance criteria

- [ ] Wszystkie modale z dialog semantics + focus trap
- [ ] Escape + restore focus

#### Rollback

Revert per-modal.

#### Commit suggestion

`feat(ui): dostępność modalów (dialog, focus trap, escape)`

### TASK-041 — A11Y: wizard dots klawiaturowe

- [x] Status — wykonano 2026-08-19: 5 kropek `role="button" tabindex="0"` w studnie.html i partials/rury/wizard-nav.html; `aria-current="step"` sync w updateWizardIndicator (oba). Keydown delegacja na #wizard-indicator (Enter/Space → wizardNavStep/goToPhase), guard `typeof document !== 'undefined'` (testy vm). Weryfikacja: testy PASS, lint+typecheck czyste.

**Priority:** P1
**Audit:** A-6
**Severity:** MEDIUM
**Category:** A11Y/HTML
**Dependencies:** —
**Estimated effort:** 20 min
**Regression risk:** LOW

#### Problem

Wizard dots to `div` (studnie.html:153-179) — nieosiągalne klawiaturą.

#### Evidence

- `studnie.html:153-179`, `rury.html` analogicznie

#### Scope

Oba HTML.

#### Proposed solution

`role="button" tabindex="0"` + `aria-current="step"` + keydown Enter/Space (delegacja w `wizard.js`). Alternatywa minimalna: tylko `tabindex` + click przez Enter (natywnie dla elementów z `role=button` nie — trzeba keydown).

#### Do not change

Wizualny wygląd kropek.

#### Implementation steps

1. Dodaj role/tabindex w HTML.
2. Obsłuż Enter/Space w JS.

#### Verification

1. Tab dochodzi do kropek; Enter aktywuje.

#### Acceptance criteria

- [ ] Wizard nawigowalny klawiaturą

#### Rollback

Revert.

#### Commit suggestion

`fix(ui): dostępność kropek wizarda`

### TASK-042 — A11Y: `aria-live` dla toastów i dynamicznych sum

- [x] Status — wykonano 2026-08-19: `aria-live="polite"` na #toast-container (app.html, index.html, zlecenia.html; toast miał już role="alert"). `aria-live="polite"` na kartach RAZEM Netto: studnie offer.html (sum-total-netto/sum-brutto-details) i rury summary-bar.html (sum-total-netto/sum-brutto-details). Weryfikacja: lint+typecheck czyste.

**Priority:** P3
**Audit:** A-3
**Severity:** LOW
**Category:** A11Y
**Dependencies:** —
**Estimated effort:** 15 min
**Regression risk:** LOW

#### Problem

Toast i sumy oferty nie odczytywane przez screen reader.

#### Evidence

- `showToast` (`ui.js`), `offerSummaryTab.js`

#### Scope

`ui.js` (toast) + kontener sum.

#### Proposed solution

Kontener toast z `role="status" aria-live="polite"`; suma oferty `aria-live="polite"` (może wymagać `aria-atomic`).

#### Do not change

Wygląd.

#### Implementation steps

1. Dodaj `aria-live` do kontenera toast.
2. Dodaj `aria-live` do sumy.

#### Verification

1. Screen reader czyta toast.

#### Acceptance criteria

- [ ] Toast i sumy w aria-live

#### Rollback

Revert.

#### Commit suggestion

`fix(ui): aria-live dla toastów i sum`

### TASK-043 — A11Y: autocomplete/name na loginie

- [x] Status — wykonano 2026-08-19: labele sr-only i autocomplete istniały (z TASK-031); dodano `name="username"`/`name="password"` i `required` na oba inputy (index.html). Weryfikacja: lint+typecheck czyste.

**Priority:** P3
**Audit:** A-1
**Severity:** LOW
**Category:** A11Y/HTML
**Dependencies:** TASK-031
**Estimated effort:** 10 min
**Regression risk:** LOW

#### Problem

Login bez `autocomplete`, labeli, `name`.

#### Evidence

- `index.html`

#### Scope

`index.html`.

#### Proposed solution

`name="username" autocomplete="username"`, `name="password" autocomplete="current-password"`, labele (sr-only lub widoczne), `required`.

#### Do not change

Wygląd.

#### Implementation steps

1. Dodaj atrybuty.

#### Verification

1. Password manager działa.

#### Acceptance criteria

- [ ] Login z autocomplete i labelami

#### Rollback

Revert.

#### Commit suggestion

`fix(ui): autocomplete i labele logowania`

### TASK-044 — Usunięcie dead CSS

- [x] Status

**Priority:** P3
**Audit:** C-4/C-10
**Severity:** LOW
**Category:** CSS
**Dependencies:** TASK-010
**Estimated effort:** 30 min
**Regression risk:** LOW

#### Problem

Martwe klasy (`.config-tile:hover`, `.rury-btn-ghost`, `.fs-sidebar`, `.excel-th`, `.pl-lg`).

#### Evidence

- `studnie.css:2303`, inne do potwierdzenia

#### Scope

`public/css` — tylko klasy bez użycia w HTML/JS (grep HTML+JS+`className`).

#### Proposed solution

Dla każdej podejrzanej klasy: `rg "class=.*name|className.*name|\.name"` w HTML+JS. Jeśli zero użyć → usuń. **Nie usuwaj bez dwukrotnego sprawdzenia** (klasy generowane dynamicznie).

#### Do not change

Klasy używane dynamicznie (np. przez JS string).

#### Implementation steps

1. Lista podejrzanych.
2. Weryfikacja grep.
3. Usunięcie.

#### Verification

1. Zero użyć w kodzie.
2. Wizualna kontrola.

#### Acceptance criteria

- [x] Martwe klasy usunięte (lista w raporcie)

#### Rollback

Revert.

#### Commit suggestion

`refactor(ui): usunięcie dead CSS`

**WYNIK (2026-08-19):** usunięto **90 reguł** dead CSS z 9 plików. Mechanika: skrypt `remove-dead.cjs` (regex blokowy: `.klasa { ... }` na własnej linii, tylko selektor = dokładnie jedna klasa) + ręczne usunięcia compound/group (`well-info-field label/input/focus/computed`, `fs-dn-tile .dn-label/.price-label`, `.index-card` z grupy selektorów, `.status-badge.neutral`, `.spinner-hidden .spinner-border`, `.excel-th-h1/h2/h3`, `rury-btn-ghost`, `fs-sidebar`, `.text-center` base, legacy `.fw-5..8`/`.text-muted`/`.text-warn` studnie). **Zostawione (potwierdzone LIVE, dynamiczne):** `.upm-status-*` (składane `upm-status-${status}` w printModal.js:98), `.toast-*` (`toast toast-`+type w ui.js:99), `.status-badge` (class z statusMap), `.fs-dn-tile` (wellTransitions.js:105, dzieci dn-label/price-label usunięte — zero użyć), `.config-tile:hover` (inline bg wygrywa, transition działa), `.well-info-card` (step3-offer.html:53). Skan 101 kandydatów → po weryfikacji prefiksów (bg-, fs-, upm-status-, rury-flex-, spinner-, offer-stat-, ui-text-) usunięto 90, 11 zostawiono (LIVE lub pokrewne). Balans `{`/`}` OK we wszystkich 9 plikach. Prettier: `npm run format` — pliki z LF (endOfLine lf w .prettierrc), git autocrlf normalizuje przy commit.

### TASK-045 — Shared core: analiza 8 par plików rury↔studnie (plan + wspólne API)

- [ ] Status

**Priority:** P4
**Audit:** FA-2
**Severity:** MEDIUM
**Category:** Architecture
**Dependencies:** TASK-005, TASK-006
**Estimated effort:** 4-6 h (plan + implementacja pierwszej pary)
**Regression risk:** HIGH

#### Problem

8 par plików z duplikacją: offerNotesGenerator, offerPrintManager, orderCrud, orderKartaBudowy, orderPrzejscia, orderManager, offerOrderSelection, offerRendering.

#### Evidence

- `public/js/rury/*` vs `public/js/studnie/*`

#### Scope

Wspólne API + migracja pierwszej pary (proof of concept).

#### Proposed solution

Dla każdej pary: `diff` (znormalizowany). Określ: pure-dup, różnice parametrów, różnice logiki. Zaprojektuj wspólny moduł z konfiguracją różnic. Migruj jedną parę (np. `offerNotesGenerator` — najmniejsze ryzyko). **Nie kopiuj 1:1** — analizuj różnice (faza 11).

#### Do not change

Zachowania różniące się między modułami (np. kolumny rur vs studnie).

#### Implementation steps

1. Diffy 8 par → raport w planie.
2. Zaprojektuj API wspólne.
3. Migruj pierwszą parę.

#### Verification

1. Testy dymne obu modułów.
2. Różnice zachowane.

#### Acceptance criteria

- [ ] Raport różnic 8 par
- [ ] 1 para z migrowanym wspólnym API

#### Rollback

Revert migracji.

#### Commit suggestion

`refactor(ui): wspólny moduł offerNotesGenerator`

### TASK-046 — Shared core: migracja kolejnych par

- [ ] Status

**Priority:** P4
**Audit:** FA-2
**Severity:** MEDIUM
**Category:** Architecture
**Dependencies:** TASK-045
**Estimated effort:** 8-12 h
**Regression risk:** HIGH

#### Problem

Pozostałe pary zduplikowanych plików.

#### Scope

Per-pair migracja (najpierw low-risk: offerOrderSelection, orderKartaBudowy; potem orderCrud, orderPrzejscia, orderManager; na końcu offerPrintManager, offerRendering).

#### Proposed solution

Kontynuacja TASK-045; każda para = osobny commit + testy.

#### Do not change

Logika różniąca się między modułami.

#### Implementation steps

1-6. Dla każdej pary: diff → wspólny moduł → migracja → testy.

#### Verification

1. Testy obu modułów po każdej parze.

#### Acceptance criteria

- [ ] ≥6/8 par zwirtualizowanych lub udokumentowany wyjątek

#### Rollback

Per-pair revert.

#### Commit suggestion

`refactor(ui): współdzielony <nazwa pary>`

### TASK-047 — Plan migracji do ES Modules

- [ ] Status

**Priority:** P4
**Audit:** FA-3
**Severity:** LOW
**Category:** Architecture
**Dependencies:** TASK-045
**Estimated effort:** dokument (2 h)
**Regression risk:** LOW (dokument)

#### Problem

748 globali `window.*`; migracja big-bang niemożliwa.

#### Evidence

- `public/js` (metryki)

#### Scope

Dokument `docs/plans/<date>-es-modules.md` + pierwszy krok.

#### Proposed solution

Ścieżka: `window.X` → namespace → shared API → ES module → dynamic import (StorageService.js to wzorzec PASS). Dokumentacja planu migracji per-moduł. Pierwszy krok: `modalCore.js` (TASK-027) i `escapeHtml` jako pierwsze moduły ESM.

#### Do not change

Żadnych zmian bez osobnego planu.

#### Implementation steps

1. Napisz dokument migracji.
2. Pierwsze 1-2 moduły ESM.

#### Verification

1. Aplikacja działa z modułami ESM.

#### Acceptance criteria

- [ ] Dokument planu migracji
- [ ] 2 moduły jako ESM

#### Rollback

N/A (dokument + revert).

#### Commit suggestion

`docs(ui): plan migracji do ES modules`

### TASK-048 — Weryfikacja rejestracji globali (guardroom)

- [x] Status — wykonano 2026-08-18: skrypt `scripts/check-global-collisions.mjs` (parse `window.X = ` z `public/js`, wykrywa nazwy w ≥2 plikach na tej samej stronie), podpięty do `npm run validate` jako krok `collisions:check` — bezpieczny, nie blokuje (exit 0, raport 21 znanych kolizji wg TASK-008). WHITELIST znanych kolizji z TASK-008: toggleCard, showSection, ensureDisplayIndices, showUniversalPrintModal, currentDraggedPlaceholderId, wellDiscounts, isPreviewMode, saveOfferStudnie, activeCatalogCategory, MAX_TRANSPORT_WEIGHT, zabezpieczenieTransportuEnabled, pendingOrderCreationData, editingRuryOrderId, orderCurrentItems, _customPrzejscieRows, _offerPrzejscieRows, _przejsciaInitialized, escapeHtml. Nowe kolizje spoza listy → raport na końcu validate.

**Priority:** P0
**Audit:** FA-1
**Severity:** MEDIUM
**Category:** Process
**Dependencies:** TASK-008
**Estimated effort:** 20 min
**Regression risk:** LOW

#### Problem

Brak mechanizmu zapobiegającego nowym kolizjom globali.

#### Scope

Skrypt `scripts/check-global-collisions.mjs` + hook/CI (opcjonalnie w `validate`).

#### Proposed solution

Skrypt: parse `window.X = ` z `public/js`, wykrywa nazwy w ≥2 plikach, raport. Podepnij do `npm run validate` jako nowy krok — bezpieczne, nie blokuje.

#### Do not change

Istniejące globalne (do TASK-008).

#### Implementation steps

1. Napisz skrypt.
2. Podepnij do `validate`.

#### Verification

1. Skrypt raportuje 0 kolizji po TASK-008.
2. `validate` PASS.

#### Acceptance criteria

- [ ] Skrypt wykrywa zduplikowane globalne
- [ ] Wpięty w walidację

#### Rollback

Usuń krok z `validate`.

#### Commit suggestion

`chore(ui): guard kolizji globalnych`

## 7. TEST PLAN

| Test                                    | Before           | After | Required |
| --------------------------------------- | ---------------- | ----- | -------- |
| Unit (`npm test`)                       | PASS             | PASS  | YES      |
| Smoke (`npm run test:quick`)            | PASS             | PASS  | YES      |
| E2E Playwright                          | PASS             | PASS  | YES      |
| `typecheck`                             | PASS             | PASS  | YES      |
| `typecheck:frontend`                    | PASS             | PASS  | YES      |
| Lint (`npm run lint` + `lint:frontend`) | PASS             | PASS  | YES      |
| Build (`npm run build`)                 | PASS             | PASS  | YES      |
| `version:check`                         | PASS             | PASS  | YES      |
| `encoding:check`                        | PASS             | PASS  | YES      |
| Security scan (XSS grep)                | FAIL (4 miejsca) | PASS  | YES      |
| Responsive (320-1920)                   | PARTIAL          | PASS  | YES      |
| Format (`npm run format:check`)         | PASS             | PASS  | YES      |

Uruchamiaj: po TASK-005 (security), po CP-01, CP-02, CP-04, CP-05, CP-07.

## 8. REGRESSION PLAN

Testy ręczne po każdej fazie modyfikującej wygląd/interakcje:

- [ ] Logowanie (Enter, autocomplete)
- [ ] Dashboard
- [ ] Kreator studni (wizard, kroki 1-5)
- [ ] Kreator rur
- [ ] Dane klienta (step1)
- [ ] Wybór produktów
- [ ] Cennik
- [ ] Kalkulacja
- [ ] Transport
- [ ] Przejścia (popup, dodawanie, rzędna focus)
- [ ] Zapis oferty
- [ ] Edycja oferty (baner trybu, renderOrderModeBanner)
- [ ] Drukowanie (printManager, kartoteka)
- [ ] Popupy
- [ ] Zamówienia (tryb edycji, kolumny porównawcze)
- [ ] Kartoteka
- [ ] Excel (nav, undo/redo, krag/krag_ot, PZ guard)
- [ ] Modale (Escape 2-stopniowy excel, focus)
- [ ] Toast
- [ ] Confirm
- [ ] Wyszukiwanie
- [ ] Sortowanie
- [ ] Mobile 320px
- [ ] Mobile 390px
- [ ] Tablet 768px
- [ ] Desktop 1280px
- [ ] Desktop 1920px

## 9. ROLLBACK PLAN

Zasady:

1. Każde zadanie = osobny commit → rollback przez `git revert <hash>`.
2. Przed fazami CSS (PHASE-03..09) backup `studnie.css`/`rury.css` do `data/backups/` (skrypt) lub poleganie na git.
3. Screenshoty baseline (TASK-013) jako referencja wizualna przy rollbacku.
4. Rollback pełnej fazy: `git revert` kolejno commitów fazy (odwrotna kolejność), NIE squash.
5. Baza danych: zero migracji w planie — ryzyko danych minimalne.
6. Wyjątek (TASK-045/046 shared core): rollback wymaga cofnięcia obu modułów (rury+studnie) razem — planuj jako para commitów.

## 10. FINAL ACCEPTANCE CRITERIA

### SECURITY

- [ ] Zero potwierdzonych XSS z audytu (CF-1, CF-2)
- [ ] Wszystkie dynamiczne interpolacje pól edytowalnych escapowane
- [ ] Skan XSS (TASK-005) PASS
- [ ] Guard globali (TASK-048) aktywny

### CSS

- [ ] C-1: brak zduplikowanych bloków z offer/modal
- [ ] C-2: jedna definicja `.flex-row`
- [ ] C-3: zero haków `[style*=]`
- [ ] Tokeny `--header-h`, `--focus-ring`, `--z-*`
- [ ] Dead CSS usunięty

### HTML

- [ ] `h1` per strona
- [ ] `<form>` na loginie
- [ ] `scope="col"` na nagłówkach tabel
- [ ] Search inputy z labelami

### ACCESSIBILITY

- [ ] Modale: `role="dialog"`, focus trap, Escape, restore focus
- [ ] Wizard klawiaturowy
- [ ] Focus-visible globalny
- [ ] Touch targety ≥44px na `pointer:coarse`
- [ ] Toast/sumy w `aria-live`

### RESPONSIVE

- [ ] Brak regresji na 320/390/768/1280/1920 (screenshoty)
- [ ] Jedna oś breakpointów

### ARCHITECTURE

- [ ] Zero kolizji globali (skrypt PASS)
- [ ] Globali nie rośnie bez kontroli
- [ ] Shared core tylko tam, gdzie różnice nie blokują

## 11. MASTER CHECKLIST

### P0

- [ ] TASK-001 (baseline)
- [ ] TASK-002 (XSS printManager)
- [ ] TASK-003 (XSS wellTransitionsPopup)
- [ ] TASK-004 (XSS wellTransitions/popups)
- [ ] TASK-005 (skan XSS)
- [ ] TASK-006 (handlePrintClick)
- [ ] TASK-007 (renderOrderModeBanner)
- [ ] TASK-008 (audyt globali)
- [ ] TASK-048 (guard globali)

### P1

- [ ] TASK-010 (CSS dedup)
- [ ] TASK-011 (.flex-row)
- [ ] TASK-012 (haki inline style)
- [ ] TASK-013 (screenshoty baseline)
- [x] TASK-024 (header mobile)
- [x] TASK-025 (touch targety)
- [x] TASK-040 (a11y modali)
- [x] TASK-041 (wizard klawiatura)

### P2

- [x] TASK-020 (token header-h)
- [x] TASK-021 (focus-ring)
- [x] TASK-022 (z-index)
- [x] TASK-023 (breakpointy)
- [x] TASK-026 (buttony)
- [x] TASK-027 (modale core)
- [x] TASK-030 (h1)
- [x] TASK-031 (form login)
- [x] TASK-032 (scope th)
- [x] TASK-033 (labele/alt)

### P3

- [ ] TASK-028 (partiale)
- [ ] TASK-029 (utility)
- [ ] TASK-034 (sr-only)
- [ ] TASK-035 (inline style JS)
- [ ] TASK-036 (inline onclick)
- [ ] TASK-037 (innerHTML escape)
- [ ] TASK-038 (.style.* excel)
- [ ] TASK-039 (excelTableBody)
- [x] TASK-042 (aria-live)
- [x] TASK-043 (login autocomplete)
- [ ] TASK-044 (dead CSS)

### P4

- [ ] TASK-045 (shared core analiza)
- [ ] TASK-046 (shared core migracja)
- [ ] TASK-047 (ES modules plan)

## 12. PROGRESS

| Phase | Tasks | Completed | Status |
|---|---:|---:|---|---|
| PHASE-00 | 1 | 1 | DONE |
| PHASE-01 | 4 | 4 | DONE |
| PHASE-02 | 4 | 4 | DONE |
| PHASE-03 | 4 | 4 | DONE |
| PHASE-04 | 4 | 4 | DONE |
| PHASE-05 | 4 | 4 | DONE |
| PHASE-06 | 4 | 4 | DONE |
| PHASE-07 | 3 | 3 | DONE |
| PHASE-08 | 2 | 2 | DONE |
| PHASE-09 | 4 | 3 | IN PROGRESS |
| PHASE-10 | 5 | 0 | NOT STARTED |
| PHASE-11 | 2 | 0 | NOT STARTED |
| PHASE-12 | 1 | 0 | NOT STARTED |

Uwaga: TASK-023 (breakpointy) przeniesiony do PHASE-07 (responsive) jako TASK odpowiedzialny za oś breakpointów; TASK-020..022 (tokeny) w PHASE-04.

## 13. METRICS PRZED / PO (baseline 2026-08-18)

```text
Global window assignments:        748
Inline onclick strings (JS):      319
Inline style strings (JS):        2595
CSS studnie.css lines:            2305 (duplikaty ~1100 do potwierdzenia)
CSS rury.css lines:               1064
Pages without h1:                 5/5
Forms:                            0
role=dialog:                      0
scope= tables:                    0
Confirmed XSS:                    4 (printManager×2, wellTransitionsPopup, wellTransitions/popups)
Modal systems:                    >=4 (excel, przejścia, confirm, cennik) — do audytu TASK-027
Button systems:                   >=8 (rury-btn, pehd, wizard-btn, btn, app-btn, .btn-outline...) — do audytu TASK-026
```

## 14. CHANGELOG

| Data       | Wersja | Opis                                                                                             |
| ---------- | ------ | ------------------------------------------------------------------------------------------------ |
| 2026-08-18 | 1.0    | Utworzenie planu na bazie audytu UI/UX+HTML+CSS+Frontend.                                        |
| 2026-08-18 | 1.1    | TASK-001..005 wykonane: baseline + pełny skan XSS (2 CRITICAL, 22 HIGH naprawione w 14 plikach). |
