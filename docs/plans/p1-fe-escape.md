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
