# CSP hardening — plan etapowy (bez rewrite frontendu)

**Status:** CSP-A DONE → CSP-B-statyczne DONE (sufit 40→0) → CSP-B2 DONE (partials+szablony, dyspozytor data-csp) → CSP-B3 DONE (wszystkie on*, data-csp-on + kompozyty) → CSP-E WYKONANE (enforce, ten batch)
**Reguła legacy surface:** NEW inline handlers / NEW globals = 0 (testy `cspInventory` + `cspEnforce`).

## Stan obecny

- Enforce (Helmet, `src/app.ts`): `script-src 'self' 'unsafe-inline'`, `script-src-attr 'unsafe-inline'`, `style-src 'self' 'unsafe-inline'`.
- Report-Only (`src/middleware/security.ts`): `script-src 'self' 'nonce-<per-request>'`, `script-src-attr 'unsafe-inline'`, raporty → `/api/csp-report` (204, log warn ≤2000 znaków).
- SPA: `app.html` osadza same-origin iframe (`rury.html`, `studnie.html`) — wymagane `frame-src 'self'` + `frameAncestors 'self'`.

## CSP-A inventory (2026-09-28, policzone)

| Plik                | inline `<script>` | `onclick` | `style=` |
| ------------------- | ----------------: | --------: | -------: |
| `app.html`          |                 2 |         1 |        3 |
| `benchmark-tm.html` |                 1 |         0 |        0 |
| `index.html`        |                 3 |         8 |        4 |
| `kartoteka.html`    |                 4 |        10 |        1 |
| `rury.html`         |                 2 |         2 |        1 |
| `studnie.html`      |                 2 |         9 |        6 |
| `zlecenia.html`     |                 3 |        10 |       10 |
| **RAZEM**           |            **17** |    **40** |   **25** |

JS (`public/js`, ~245 plików):

- `eval(`/`new Function`/`document.write`/`insertAdjacentHTML`: 11 trafień w 7 plikach (`kartotekaAudit`, `kartotekaSearch`, `calcInput`, `printModal`, `spa/zlecenia`, `excelPasteMismatch`, `offerHistory`) — do weryfikacji 1:1 przed CSP-C (kalkulacje przez `safeEval`, reszta do eliminacji).
- `innerHTML`: 333 użycia (XSS przez `escapeHtml`, nie CSP — poza zakresem tego planu).
- Dynamiczne `createElement('script')`: 1 (`xlsxLoader.js` — `vendor/xlsx.full.min.js`, same-origin; dozwolone pod `script-src 'self'` także w enforce — brak akcji, zweryfikowano 2026-09-29).

## Kolejne etapy

- **CSP-B-statyczne DONE 2026-09-29:** `zlecenia` (10, `data-zl` + delegacja w `spa/zlecenia.js`), `kartoteka` (9 + header, `bindStaticActions` w `kartotekaInit.js`), `index` (7 + header, `data-idx` w `dashboard.js`), `app` (header), `rury` (2, id w `wizard.js`), `studnie` (7 + trash + 2x mouse, binder w `uiHelpers.js`); header-logout (3, klasa w `auth.js`); guardy vm-sandbox; inline `<script>` boot → ESM z nonce. Każdy moduł: test regresji.
- **CSP-B2 DONE 2026-09-30:** dyspozytor `shared/cspActions.js` (data-csp + JSON args + scope + $el/$event/$checked/$value + kompozyty); partiale rury+studnie (137 onclick → 0); szablony JS (199 onclick → 0); selektory `[onclick]` → `[data-csp]`; `javascript:void(0)` → `#`; print-window onload → addEventListener.
- **CSP-B3 DONE 2026-09-30:** wszystkie pozostałe on* (change/input/keydown/focus/blur/mousedown/scroll/drag/mouse) → data-csp-on + warianty -2..-6; style-hover → $styleSet/$stylePair/$hoverBg/$activeHover/$userBtnLeave/$tileHover; warn/toggle/select-wrap → kompozyty; mouseover/out emulują enter/leave (relatedTarget).
- **CSP-E DONE 2026-09-30:** enforce `script-src 'self' + nonce per-request` (Helmet, nonce przed helmetem), script-src-attr bez unsafe-inline (fallback 'none'); style-src zostaje z unsafe-inline (style="" nie wykonuje JS — ryzyko szczątkowe); Report-Only zostaje jako monitoring; 17 inline `<script>` dostaje nonce w `injectAppNameScript`.
- **CSP-C:** nonce na wszystkich skryptach first-party; `xlsxLoader` — brak akcji (same-origin vendor); `eval` — brak w prod (0), `safeEval` tylko kalkulacje (`shared/calcInput.js`), `insertAdjacentHTML` poza CSP (XSS przez `escapeHtml`, osobny tor).
- **CSP-D:** testy browser/security: Report-Only violations = 0 na smoke + extended E2E.
- **CSP-E:** dopiero po CSP-D: usunięcie `unsafe-inline` z enforce, 1 commit, rollback = revert.

## Czego NIE robimy

Rewrite Vanilla SPA, React/Vue, zmiana `frame-src`, ruszanie `innerHTML`/`escapeHtml` w tym planie.
