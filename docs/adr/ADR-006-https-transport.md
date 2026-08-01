# ADR-006: HTTPS przez reverse proxy

**Status:** Zaakceptowany
**Data:** 2026-07-24
**Autor:** Hermes Agent

## Kontekst

Aplikacja WITROS Oferty PV działała dotychczas na czystym HTTP. Nowoczesne przeglądarki
(Chrome, Edge, Firefox, Safari, Opera, Brave) stopniowo blokują funkcje wymagające
**secure context** (HTTPS) na niebezpiecznych originach — m.in. dostęp do schowka
(clipboard), `window.open()` z iframe oraz szereg API przeglądarki. Skutkowało to
koniecznością ręcznego włączania flagi `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
w niektórych przeglądarkach, co nie jest akceptowalnym rozwiązaniem produkcyjnym.

Wymagania:

- produkcja działa przez HTTPS,
- moduły `rury` i `studnie` działają w iframe (same-origin),
- clipboard, `window.open()`, drukowanie i API działają bez zarzutu,
- brak mixed content,
- zero regresji funkcjonalnej.

## Decyzja

**HTTPS jest terminowany przez zewnętrzny reverse proxy (Caddy lub Nginx)** stoi przed
Node.js/Express. Node.js pozostaje serwerem HTTP i w produkcji binduje się domyślnie do
`127.0.0.1` (nie jest dostępny bezpośrednio z sieci).

```
                     Internet
                        │
                        │ HTTPS :443
                        ▼
               ┌─────────────────┐
               │  Reverse Proxy  │
               │  Caddy / Nginx  │
               │  TLS / Let's Encrypt
               └────────┬────────┘
                        │
                        │ HTTP localhost
                        ▼
               ┌─────────────────┐
               │   Node.js       │
               │   Express :3000 │
               └────────┬────────┘
                        │
                        ▼
              Prisma / SQLite
```

## Uzasadnienie

1. **TLS nie jest odpowiedzialnością aplikacji** — certyfikaty, odnowienie i redirect
   HTTP→HTTPS obsługuje warstwa infrastruktury (reverse proxy).
2. **Caddy** — automatyczne certyfikaty Let's Encrypt, prosty Caddyfile, auto-renew.
   Rekomendowany dla prostej infrastruktury.
3. **Nginx** — wybierany, gdy serwer już używa Nginx (np. z innymi wirtualnymi hostami).
4. **Brak zmian w logice biznesowej** — migracja jest infrastrukturalna, nie biznesowa.
5. **Same-origin iframes pozostają** — architektura SPA nie wymaga przebudowy.

## Konsekwencje

### Pozytywne

- Wszystkie funkcje wymagające secure context działają (clipboard, `window.open()`, itd.).
- `window.isSecureContext === true`, brak mixed content.
- Zero zmian w kalkulacjach, cennikach, Prisma, ML, Excel, kartotece.
- `httpOnly` + `Secure` cookie sesji działa poprawnie.

### Negatywne

- Dodatkowy proces do utrzymania (reverse proxy).
- Lekki narzut latencji.
- Konfiguracja deweloperska wymaga lokalnego HTTPS (mkcert + Caddyfile.dev) albo
  zgody na pracę w trybie dev na HTTP.

## Zmiany w kodzie

- `server.ts` — bind do `127.0.0.1` w produkcji (jawnie ustawiony `HOST` ma priorytet).
- `src/middleware/security.ts` — `httpsRedirect()` uwzględnia listę w `x-forwarded-proto`
  (wiele proxy), HSTS pozostaje aktywny w produkcji.
- `src/app.ts` — `trust proxy = 2`, CSP `connectSrc` bez twardych `http://` (dev-only `ws://`).
- `src/routes/auth.ts` — `Secure` flag na ciastku sesji sterowana `COOKIE_SECURE` lub `NODE_ENV`.
- `Caddyfile` / `Caddyfile.dev` — konfiguracja reverse proxy (produkcja / lokalny dev).
- `.env.example`, `Dockerfile`, `start.bat`, `prod.bat` — dokumentacja i ustawienia HTTPS.

## Rozwiązywanie problemów

| Objaw                  | Przyczyna                                 | Rozwiązanie                                                            |
| ---------------------- | ----------------------------------------- | ---------------------------------------------------------------------- |
| Pętla redirect         | Proxy i Node oba przekierowują HTTP→HTTPS | Ustawić `X-Forwarded-Proto` w proxy; `httpsRedirect` tylko w produkcji |
| Cookie nie ustawiane   | Brak `Secure` flagi przy HTTPS            | Ustawić `COOKIE_SECURE=true` w `.env`                                  |
| Wylogowanie nie działa | `clearCookie` bez `secure`                | `clearCookie` z tymi samymi opcjami co `cookie`                        |

## Referencje

- Plan migracji: `docs/plans/https-migration-plan.md`
- Konfiguracja: `Caddyfile` (produkcja), `Caddyfile.dev` (dev)
- Testy: `tests/security.test.ts`
