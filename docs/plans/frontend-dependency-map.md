# Frontend dependency map (P1-5A, read-only, 2026-09-29)

HEAD: `dce990c`. Metoda: `Get-ChildItem public/js` + `Select-String window\.` / `onclick` / `insertAdjacentHTML` / `createElement(script)`. SSoT do powtórzenia jednym skryptem (komendy w planie głównym).

## Liczby SSoT

- Pliki JS (`public/js`): **248**
- Trafienia `window.*`: **3129**
- `addEventListener` w JS: **255** (vs 40 `onclick` w HTML — migracja CSP-B ma bazę)
- `onclick` w HTML: **40** (app 1, index 8, kartoteka 10, rury 2, studnie 9, zlecenia 10)
- Inline `<script>` / `style=`: app 2/3, benchmark-tm 1/0, index 3/4, kartoteka 4/1, rury 2/1, studnie 2/6, zlecenia 3/10 (razem 17/25 — zgodnie z `csp-hardening.md` CSP-A)
- `insertAdjacentHTML`: 9 trafień w 7 plikach (kartotekaAudit ×2, kartotekaSearch, printModal, spa/zlecenia, excelPasteMismatch, offerHistory ×2)
- Prawdziwy `eval(`/`new Function`: **0 w kodzie produkcyjnym** (tylko `safeEval` w `shared/calcInput.js` + komentarz) — klasyfikacja: parser danych / kalkulacja, nie do usuwania, tylko do audytu zasięgu
- Dynamiczny `createElement('script')`: **1** (`shared/xlsxLoader.js:19`, loader CDN)

## TOP coupling (pliki, liczba `window.*`)

1. `studnie/wellTransitions.js` — 100
2. `admin/aiDashboardMl.js` — 79
3. `studnie/orderCrud.js` — 73
4. `kartoteka/kartotekaHelpers.js` — 63
5. `kartoteka/kartotekaActions.js` — 61
6. `studnie/actionsCrud.js` — 59
7. `studnie/popupsTransitionManager.js` — 58
8. `rury/transport.js` — 58
9. `shared/dashboard.js`, `studnie/orderHelpers.js`, `admin/mlPanels.js`, `shared/ui.js` — 52
10. `shared/draftAutosave.js`, `rury/offerCrud.js`, `studnie/excelVirtual.js` — 50
11. `studnie/globals.js` — 49 (jawny hub globali — kandydat na moduł ESM)
12. `shared/printModal.js` — 47, `studnie/excelTableManager.js` — 42, `rury/orderEditMode.js` — 39, `spa/router.js` — 36

## TOP globale (nazwa, użycia)

`lucide` 210, `showToast` 135, `escapeHtml` 95, `location` 76, `parent` 45, `draftAutosave` 40, `draftStore` 39, `orderEditMode` 38, `lockService` 38, `studnieProducts` 36, `kartotekaUI` 35, `refreshPrzejsciaViews` 31, `pzGuard` 30, `appConfirm`/`showModal` 28, `logger` 28, `closeModal` 27, `escapeHtmlAttr` 23, `fetchJson` 23.

## Klasyfikacja eval/insert (korekta planu: nie auto-safeEval)

| Przypadek                                                                | Klasa                  | Działanie                                          |
| ------------------------------------------------------------------------ | ---------------------- | -------------------------------------------------- |
| `shared/calcInput.js safeEval`                                           | kalkulacja / formuła   | zostawić, audyt zasięgu znaków; nie deprecated     |
| 9× `insertAdjacentHTML` (audit/search/print/zlecenia/excel/offerHistory) | sink DOM, nie CSP-eval | poza CSP; XSS przez `escapeHtml` (osobny tor)      |
| `shared/xlsxLoader.js:19` dynamic script CDN                             | loader zewnętrzny      | bundling lokalny albo hash przed CSP-E             |
| `eval/new Function` w prod                                               | brak (0)               | nic do migracji; test `cspInventory` pilnuje NEW=0 |

## Kolejka CSP-B (20% za 80% coupling)

1. `studnie/globals.js` → ESM hub (największy mnożnik).
2. `zlecenia` (10 onclick) + `kartoteka` (10 onclick) — moduły HTML najpierw.
3. `studnie/wellTransitions.js`, `orderCrud.js`, `actionsCrud.js` — translacja `window.*` na importy.
4. `shared` (`ui`, `dashboard`, `printModal`, `draftAutosave`) — kontrakt shared przed feature'ami.
5. `xlsxLoader` — decyzja CDN vs lokalnie (blokuje CSP-E).
