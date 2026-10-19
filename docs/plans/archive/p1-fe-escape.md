# P1-FE-ESCAPE — plan checkpointu: escape danych w `innerHTML` (frontend)

**Status:** PLAN (nie rozpoczęty)
**Data:** 2026-10-03
**HEAD baseline:** `9c627b4`
**Zakres:** wyłącznie dopisanie `escapeHtml`/`escapeHtmlAttr` w miejscach z audytu + testy regresji. Bez refaktoru, bez zmian backendu, bez dotykania pozycji P2/P3.

## 1. Cel

Zamknąć 13 realnych sinków z audytu (dane DB/user w `innerHTML` bez escape), tak aby każdy miał albo fix, albo udowodniony FALSE POSITIVE z testem.

## 2. Kolejność prac (jeden obszar = jeden commit)

### Krok 1 — szybkie wygrane (szac. 8 jednolinijkowców)

| #   | Plik:linia                                                                 | Fix                                                                                                                            |
| --- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `public/js/studnie/orderKartaBudowy.js:661`                                | `escapeHtml(label)` w `<option>`                                                                                               |
| 2   | `public/js/kartoteka/kartotekaHelpers.js:395`                              | `escapeHtmlAttr` na `offer.type`, `order.id`                                                                                   |
| 3–4 | `public/js/rury/pricelistUi.js:58,258`                                     | `escapeHtml(c)` / `escapeHtml(cat)`                                                                                            |
| 6   | `public/js/studnie/popupsTransitionManager.js:704-705`                     | guard liczbowy `dn`/`price` (String(finite))                                                                                   |
| 7–8 | `public/js/rury/transport.js:543`, `public/js/studnie/partialLoader.js:10` | decyzja: zostawić (własne partiale) + test pinujący źródło, albo `trusted-types` — do rozstrzygnięcia w trakcie, udokumentować |

### Krok 2 — audyt wierszy Excel (pozycje 10–11)

- `public/js/studnie/excelTableRenderer.js:277`, `public/js/studnie/actionsConfigRender.js:447`
- Przejść `_excelRenderTbody` i helpery wierszy, wypisać każde pole user/DB bez escape.
- Dopisać brakujące escape w helperach (nie w sinku).

### Krok 3 — zlecenia (pozycja 12)

- `public/js/studnie/orderZleceniaRender.js:202,213,284` — zweryfikować `escHtml`, dopisać braki.

### Krok 4 — modalCore (pozycja 5)

- `public/js/shared/modalCore.js:117` — zaudytować callerów (`audyt`, `share`, `import-export`, `showAddProductModal`); każdy caller z danymi user/DB musi escapować przed wywołaniem.
- Dodać test kontraktu: payload `<img src=x onerror=...>` w danych → brak żywego tagu w DOM.

### Krok 5 — kopiowane DOM (pozycja 9)

- `public/js/rury/orderSummary.js:8,38` — potwierdzić, że źródła (`offerRendering.js`) escapują; dopisać test łańcucha albo escape przy kopiowaniu.

## 3. Testy (obowiązkowe)

- Nowy `tests/frontend/xssSinks.test.ts`: payloady `<script>`, `<img onerror>`, `" autofocus onfocus=` przez każdy naprawiony sink (vm/jsdom, wzorzec `xssContext.test.ts`).
- Istniejące: `xssContext`, `pricelistChrome`, `offerPricelistBanner`, `excelBulkJob`, full `test:quick:lite` przed push.
- RED przed fixem (test na niezałatanej kopii) → GREEN po, zgodnie z `REGRESSION PROOF`.

## 4. Bramy checkpointu

1. `node -c` na zmienionych plikach JS
2. `npm run lint:frontend`
3. `npm run typecheck:frontend`
4. `npx prettier --check` zmienionych plików
5. `npm run test:quick:lite` + `test:git-safety` (pre-push i tak to sprawdzi)
6. diff review (tylko pliki z kroków 1–5)
7. commit przez `node scripts/commit.mjs` (scope z allowlisty, np. `fix(studnie)` / `fix(ui)`)
8. push → CI GREEN + CodeQL GREEN

## 5. Zakazy

- Brak zmian backendu, DB, migracji, API.
- Brak dotykania pozycji P2 (martwy kod, duplikaty SSoT, fetch `res.ok`, onclick) i P3.
- Brak amend/force-push/reset/rebase. Brak sekretów w testach (payloady XSS to stałe, nie dane).
- `HUSKY=0` zakazane bez jawnej zgody.

## 6. Kryterium DONE

Każda z 13 pozycji ma status FIXED (commit+test) lub FALSE POSITIVE (dowód + test pinujący). Raport końcowy w formacie checkpointu P2 (Root cause / Changed / Tests / ... / Remaining).

## 7. WYKONANIE (2026-10-03, commit kodu `c1e250a`)

Baseline: `git status --short` puste, HEAD `66beb4f` — zgodny z zadaniem (planowy `9c627b4` to stan sprzed release 1.37.0; różnica to release + docs, nietknięte).

| #   | Pozycja                                           | Status         | Dowód (1-linijkowy)                                                                                  |
| --- | ------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | `orderKartaBudowy.js:661`                         | FIXED          | `escapeHtml(label)` w `<option>`; orderNumber/id spoza DB trafiały gołe do HTML                      |
| 2   | `kartotekaHelpers.js:395`                         | FIXED          | `escapeHtmlAttr` na `offer.type` i `order.id` w przycisku Wydruk                                     |
| 3   | `pricelistUi.js:58`                               | FIXED          | `escapeHtml(cat)` w nagłówku kategorii (defense-in-depth, stała CATEGORIES)                          |
| 4   | `pricelistUi.js:258`                              | FIXED          | `escapeHtmlAttr(c)` + `escapeHtml(c)` w opcjach selecta kategorii                                    |
| 5   | `modalCore.js:117`                                | FALSE POSITIVE | sink caller-responsibility; callers pinowane (shareModal `escapeHtml(msg)`, audit `escapeHtml`)      |
| 6   | `popupsTransitionManager.js:704`                  | FIXED          | `escapeHtml(String(product.dn))`; `:751` showToast to FALSE POSITIVE (toast.js escapuje callee-side) |
| 7   | `transport.js:543`                                | ZOSTAW + pin   | źródło to własny same-origin partial `partials/rury/transport-modal.html`, brak danych usera         |
| 8   | `partialLoader.js:10`                             | ZOSTAW + pin   | źródło z `data-partial` własnego HTML, brak interpolacji danych usera                                |
| 9   | `orderSummary.js:8,38`                            | FALSE POSITIVE | kopia `src.innerHTML` z `offerRendering.js` (`escapeHtml(item.name)`, `escapeHtml(cat)`)             |
| 10  | `excelTableRenderer.js:277` / `excelTableBody.js` | FIXED + pin    | fallback uwag też przez `escapeHtml`; `well.name` i helper selectów już escapowały                   |
| 11  | `actionsConfigRender.js:447`                      | FIXED          | 11 wstawek: `precoCalc.error`, etykiety, `redukcjaOpis`, labele `_flowLabel` (user), `s.typ`, `d.dn` |
| 12  | `orderZleceniaRender.js:202,213,284`              | FIXED + pin    | `escapeHtml(String(group.wellDn))`; `wellName`/`product.name` już escapowały                         |
| 13  | kontrakt payloadów w `xssSinks.test.ts`           | GREEN          | `<script>`, `<img onerror>`, `" autofocus onfocus=` neutralizowane przez esc                         |

REGRESSION PROOF: nowy `tests/frontend/xssSinks.test.ts` (16 asercji, wzorzec `xssContext.test.ts`) — przed fixem 7 failed / 9 passed (RED na niezałatanych sinkach), po fixie 16/16 GREEN. Jedna korekta testu w trakcie: asercja `DN${product.dn}` zawężona do linii `resultDiv.innerHTML`, bo `:751` to bezpieczny `showToast`.

Bramy: `node -c` 7 plików OK; `lint:frontend` OK; `typecheck:frontend` OK; `test:quick:lite` 4028 passed; `test:git-safety` 23 passed; `version:check` OK. Prettier: 4/8 plików własnych OK; `excelTableBody.js`, `actionsConfigRender.js`, `orderZleceniaRender.js` failują `--check` już na HEAD (udowodnione na blobach z `git show` — pre-existing, nie ruszane `--write` celem minimalnego diffa).

Diff: 7 plików JS (18+/18-, tylko dopiski escape) + nowy test. Bez backendu/DB/API, bez amend/reset, bez sekretów.
