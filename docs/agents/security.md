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
- Helmet CSP ma celowo `unsafe-inline` (błąd #13; ~290 handlerów) + Report-Only z nonce (Faza 1). Nowy kod: `addEventListener`, zero nowych inline. Enforce dopiero po spadku surface.
- Rate limiting in-memory (single-instance): login 10/min IP+login, hasła 5/15min, API 300/15min, writes 60/15min. Bez Redis (decyzja).
- Publiczne endpointy minimalne: `/health` `{status,timestamp}`, `/api/version` `{version}`, `/health/ready` bez klucza `error`; diagnostyka tylko `/api/admin/system-info` (admin). Inwarianty I-010/I-011.
- Ownership fail-closed (`src/utils/ownership.ts`); 409 optimistic locking (`versionWrite.ts`); audit: błąd logowany strukturalnie + metryka, nigdy silent (I-012).

## CSP / DOM / storage

- Nie zmieniaj konfiguracji Helmet bez potrzeby (inline handlers celowe).
- DOM z danych użytkownika tylko przez `escapeHtml`; kalkulator przez `safeEval` (przecinek→kropka, błąd #4); `if (element)` przed listenerami (błąd #10).
- `localStorage` tylko dane nie-wrażliwe, zawsze try/catch + walidacja typu.
