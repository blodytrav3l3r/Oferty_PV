# ADR-017: Awaryjny tryb HTTP w LAN za VPN

**Status:** Zaakceptowany
**Data:** 2026-11-02
**Autor:** Agent AI (na wniosek użytkownika)
**Zależy od:** ADR-006 (HTTPS przez reverse proxy)

## Kontekst

Produkcja S.O.K. działa za reverse proxy z TLS (ADR-006). Na serwerze LAN
przeglądarki odrzucały każde żądanie z
`net::ERR_CERT_AUTHORITY_INVALID` — brak zaufanego certyfikatu. Efektem był
`TypeError: Failed to fetch` przy każdej operacji, w tym przy zapisie ofert.

Aplikacja nie daje się w takiej sytuacji naprawić samym wyłączeniem TLS na proxy:
kod dokłada własne mechanizmy wymuszające HTTPS:

1. `httpsRedirect` w `src/middleware/security.ts` — 302 na HTTPS w produkcji,
2. HSTS w `securityHeaders` (i domyślnie w Helmet),
3. `upgrade-insecure-requests` w CSP (domyślna dyrektywa Helmet) — przeglądarka
   przepisuje `fetch('/api/...')` na `https://`, gdzie nic nie nasłuchuje.

Bez zmiany tych trzech miejsc odblokowanie HTTP na proxy daje ten sam objaw.

## Decyzja

Wprowadzamy flagę środowiskową `HTTPS_ENABLED`:

| Wartość       | Tryb                | Zastosowanie                       |
| ------------- | ------------------- | ---------------------------------- |
| brak / `true` | normalny (domyślny) | produkcja z poprawnym certyfikatem |
| `false`       | awaryjny            | tymczasowa praca po HTTP w LAN/VPN |

Przy `HTTPS_ENABLED=false`:

- `httpsRedirect` nie przekierowuje (302 wyłączone),
- HSTS nie jest wysyłany (ani z `securityHeaders`, ani z Helmet),
- CSP nie zawiera `upgrade-insecure-requests`,
- cookie sesji nie dostaje flagi `Secure` (przeglądarka odrzuca takie ciastko po HTTP,
  co daje pętlę logowania),
- **pozostałe zabezpieczenia zostają aktywne**: `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`, CSP `default-src 'self'`, nonce dla skryptów,
  CSRF, rate limiting, httpOnly cookie.

`HTTPS_ENABLED=false` **nie jest** nowym domyślnym trybem produkcyjnym. To świadomy
tryb awaryjny, wymagający jawnego ustawienia w `.env` i odizolowanej sieci (LAN/VPN).

ADR-006 pozostaje decyzją docelową (HTTPS przez reverse proxy). Ten ADR opisuje
wyjątek operacyjny, nie zmianę architektury.

## Uzasadnienie

- Jedna flaga steruje całym łańcuchem transportowym — brak ryzyka, że jeden element
  (np. CSP) zostanie przeoczony i nadal zepsuje zapis ofert.
- Konfiguracja Helmeta przeniesiona do `buildHelmetOptions()` w
  `src/middleware/security.ts`, dzięki czemu tryb awaryjny jest testowalny bez
  bootowania aplikacji i bez bazy danych.
- Wyłączenie transportu nie wyłącza security middleware — to byłoby regresją
  bezpieczeństwa większą niż sam brak TLS.

## Konsekwencje

### Pozytywne

- Aplikacja działa w LAN/VPN mimo braku zaufanego certyfikatu.
- Tryb normalny jest pokryty testem regresji (`HTTPS_ENABLED=true`): redirect, HSTS
  i `upgrade-insecure-requests` nadal działają.

### Negatywne

- Ruch w trybie awaryjnym jest jawny (bez szyfrowania) — dopuszczalny wyłącznie
  w zaufanej sieci lokalnej lub przez VPN.
- Adres aplikacji zmienia się z `https://<host>` na `http://<host>` (dokładny host,
  port i ścieżkę ustala operator serwera) — stare zakładki i linki `https://`
  przestają działać.
- Po powrocie na nazwę hosta z TLS przeglądarki mogą pamiętać wcześniejszy HSTS
  (do 2 lat). Dla gołego adresu IP HSTS jest ignorowany, więc test na IP tego nie ujawni.

## Zmiany w kodzie

- `src/middleware/security.ts` — `isHttpsEnabled()`, gate w `httpsRedirect`,
  gate HSTS w `securityHeaders`, `buildHelmetOptions()` z warunkowym HSTS
  i `upgradeInsecureRequests: null`.
- `src/app.ts` — `helmet(buildHelmetOptions())` zamiast bloku CSP trzymanego lokalnie.
- `src/routes/auth.ts` — `isCookieSecure` respektuje `isHttpsEnabled()`.
- `tests/security.test.ts` — testy trybu awaryjnego i regresji trybu normalnego.
- `.env.example` — opis `HTTPS_ENABLED`.

## Czego ten ADR nie obejmuje

Konfiguracja serwera produkcyjnego (Caddyfile, `.env`, firewall) nie jest częścią
tej zmiany — brak dostępu do maszyny. Po wdrożeniu kodu serwer wymaga:

1. `HTTPS_ENABLED=false` w `.env`,
2. wyłączenia TLS na reverse proxy (albo wystawienia aplikacji bezpośrednio po HTTP),
3. `HOST` i `PUBLIC_BASE_URL` zgodnych z nowym adresem.

## Referencje

- ADR-006: `docs/adr/ADR-006-https-transport.md`
- Testy: `tests/security.test.ts`, `tests/security/headers.test.ts`
- Kod: `src/middleware/security.ts`, `src/app.ts`, `src/routes/auth.ts`
