# CSP hardening — plan etapowy (bez rewrite frontendu)

**Status:** CSP-A DONE (inventory 2026-09-28) → CSP-B TODO → CSP-C TODO → CSP-D TODO → CSP-E TODO  
**Reguła legacy surface:** NEW inline handlers / NEW globals = 0 (test `cspInventory`).

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
- Dynamiczne `createElement('script')`: 1 (`xlsxLoader.js` — loader CDN, wymaga `script-src` dla CDN albo bundling lokalny przed CSP-E).

## Kolejne etapy

- **CSP-B:** migracja `onclick` → `addEventListener` moduł po module (najpierw `zlecenia`/`kartoteka`, 10 each), inline `<script>` boot → ESM z nonce. Każdy moduł: test regresji.
- **CSP-C:** nonce na wszystkich skryptach first-party; `xlsxLoader` lokalnie albo hash; `eval` → `safeEval`/whitelist.
- **CSP-D:** testy browser/security: Report-Only violations = 0 na smoke + extended E2E.
- **CSP-E:** dopiero po CSP-D: usunięcie `unsafe-inline` z enforce, 1 commit, rollback = revert.

## Czego NIE robimy

Rewrite Vanilla SPA, React/Vue, zmiana `frame-src`, ruszanie `innerHTML`/`escapeHtml` w tym planie.
