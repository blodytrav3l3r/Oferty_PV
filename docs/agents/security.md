# S.O.K. — Agent: bezpieczeństwo

> Szczegółowy przewodnik domenowy. Root: `AGENTS.md` (mapa + bramy).
> Przy znalezieniu luki: STOP → agent security-reviewer → napraw CRITICAL przed kontynuacją → rotuj sekrety → przeskanuj podobne wzorce.

## Obowiązkowe checki przed commitem

- Brak sekretów w kodzie (env only); wszystkie wejścia zwalidowane (Zod); Prisma (brak SQL injection); CSRF (same-origin); auth/autoryzacja zweryfikowana; rate limiting; błędy bez wycieków.

## XSS (najwyższy priorytet na frontendzie)

- Każda interpolacja do `innerHTML` przez `escapeHtml(str)` (błąd #3); pola edytowalne (nazwy produktów, numery zamówień) zawsze (błąd #24).
- Atrybuty (`aria-label`, `title`): `escapeHtmlAttr`/`escapeJsStr`, NIGDY `escapeHtml` (błąd #39).
- Guard `window.x !== x` (identity-check), nie `typeof window.x === 'function'` (błąd #41 — rekurencja escapa).
- Po wstrzyknięciu HTML z ikonami Lucide: `lucide.createIcons({root})`.

## Auth / CSRF / nagłówki

- Cookie `authToken`: HttpOnly + SameSite=Lax (+ Secure na HTTPS). Legacy shim `x-auth-token` usunięty — nie przywracaj.
- CSRF: `src/middleware/csrf.ts` — mutacje wymagają Origin/Referer zgodnego z Host (403 w p.p.); GET/HEAD/OPTIONS nietknięte; `/api/csp-report` zwolniony. Skrypty nie-przeglądarkowe wysyłają `Origin: BASE`.
- Helmet CSP enforce AKTYWNE: `script-src 'self'` + nonce per-request, zero `unsafe-inline` dla skryptów (kontrakt `tests/security/headers.test.ts`); `style-src` zostaje z `unsafe-inline` (ryzyko szczątkowe, ADR w komentarzu `src/app.ts`). Równolegle Report-Only z nonce (monitoring). Nowy kod: `addEventListener`, zero nowych inline.
- Sonda CSP dashboardu Operacje czyta enforce z `/api/telemetry/ai/ml-status` (za Helmet); `/api/version` i `/api/admin/system-info` są przed Helmet i nie niosą CSP (celowo publiczne).
- Rate limiting in-memory (single-instance): login 10/min IP+login, hasła 5/15min, API 300/15min, writes 60/15min. Bez Redis (decyzja).
- Publiczne endpointy minimalne: `/health` `{status,timestamp}`, `/api/version` `{version}`, `/health/ready` bez klucza `error`; diagnostyka tylko `/api/admin/system-info` (admin). Inwarianty I-010/I-011.
- Ownership fail-closed (`src/utils/ownership.ts`); 409 optimistic locking (`versionWrite.ts`); audit: błąd logowany strukturalnie + metryka, nigdy silent (I-012).

## CSP / DOM / storage

- Nie zmieniaj konfiguracji Helmet bez potrzeby. Eventy TYLKO przez dyspozytor `data-csp` (`public/js/shared/cspActions.js`) — zero nowych inline `on*` (błąd #55); eventy `mouseup`/`touchstart`/`touchend` obsługiwane.
- `data-csp-args` to JSON w atrybucie HTML: cudzysłowy TYLKO jako `&quot;` albo konkatenacja poza stringiem (`"[' + wIdx + ']"`); surowy `"` ucina atrybut → martwy handler (błędy #56, #57). Bramki w `tests/security/cspInventory.test.ts`.
- DOM z danych użytkownika tylko przez `escapeHtml`; kalkulator przez `safeEval` (przecinek→kropka, błąd #4); `if (element)` przed listenerami (błąd #10).
- `localStorage` tylko dane nie-wrażliwe, zawsze try/catch + walidacja typu.
