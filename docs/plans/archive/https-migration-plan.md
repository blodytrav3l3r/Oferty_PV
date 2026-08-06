# Plan Migracji HTTPS — WITROS Oferty PV

**Data:** 2026-07-24
**Status:** Zakończony (kod)

> **Zakończenie kodu:** 2026-08-01, commit `dc78506` (`feat(security): migracja HTTPS przez reverse proxy + secure cookie`).
> `npm run validate` przechodzi w 100% (1305 testów). Do potwierdzenia pozostają wyłącznie kryteria manualne (sekcja 10).

---

## 1. Cel

Doprowadzić aplikację do stanu, w którym:

- Produkcja działa przez **HTTPS** (reverse proxy: Caddy/Nginx)
- Nie wymaga `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
- Działa poprawnie we wszystkich głównych przeglądarkach
- Clipboard, `window.open()`, iframe, API działają bez zarzutu
- Brak mixed content
- Zero regresji funkcjonalnej

### Zasada nadrzędna

> **HTTPS jest docelowym środowiskiem. HTTP pozostaje wyłącznie jako wewnętrzny transport Node.js za reverse proxy.**

---

## 2. Architektura docelowa

```
                    UŻYTKOWNIK
                         │
                         ▼
               HTTPS :443 (TLS)
                         │
               ┌─────────────────┐
               │  Caddy / Nginx  │
               │  Let's Encrypt  │
               │  HTTP → HTTPS   │
               └────────┬────────┘
                        │
                        ▼
                  Node / Express
                   127.0.0.1:3000 HTTP
                        │
              ┌─────────┼──────────┐
              ▼         ▼          ▼
            app.html   API       Static
              │
        ┌─────┴─────┐
        ▼           ▼
     rury.html  studnie.html
        │           │
        └─────┬─────┘
              ▼
         Secure Context
              │
      ┌───────┼────────┐
      ▼       ▼        ▼
  Clipboard  Print   Excel
```

---

## 3. Stan wyjściowy — audyt

### Co jest gotowe (80% kodu)

| Obszar                      | Status                                                        | Dowód                                |
| --------------------------- | ------------------------------------------------------------- | ------------------------------------ |
| Wszystkie `fetch()`         | ✅ Ścieżki względne (`/api/...`)                              | Zero absolutnych URL-i w frontendzie |
| Clipboard API               | ✅ Event-based (`e.clipboardData`), nie `navigator.clipboard` | `excelCopyPaste.js:88-92`            |
| Iframe                      | ✅ Same-origin, ścieżki względne                              | `router.js:26,39,52,57`              |
| `httpsRedirect` middleware  | ✅ Działa (sprawdza `req.secure` i `x-forwarded-proto`)       | `security.ts:6-13`                   |
| HSTS                        | ✅ Ustawiony w produkcji                                      | `security.ts:26`                     |
| Helmet CSP                  | ✅ Skonfigurowany                                             | `app.ts:109-131`                     |
| `npm run typecheck`         | ✅ Przechodzi (exit code 0)                                   | —                                    |
| `window.open('', '_blank')` | ✅ Działa przez HTTPS                                         | `offerExports.js:108`                |
| Brak `document.execCommand` | ✅ Nie występuje                                              | —                                    |
| Brak `navigator.clipboard`  | ✅ Nie występuje                                              | —                                    |

### Co wymaga naprawy

| #   | Priorytet   | Problem                                                                | Plik                                |
| --- | ----------- | ---------------------------------------------------------------------- | ----------------------------------- |
| 1   | 🔴 CRITICAL | CSP `connectSrc` z `http://localhost:5000`, `ws://localhost:*`         | `src/app.ts:119-121`                |
| 2   | 🔴 CRITICAL | `clearCookie` bez `secure` — wylogowanie nie działa w produkcji        | `src/routes/auth.ts:156`            |
| 3   | 🟡 HIGH     | `trust proxy = 1` za mało przy wielu proxy (np. Cloudflare → Nginx)    | `src/app.ts:42`                     |
| 4   | 🟡 HIGH     | `x-forwarded-proto` parsowanie `===` nie obsługuje listy               | `src/middleware/security.ts:7`      |
| 5   | 🟡 HIGH     | 5x `http://www.pv-prefabet.com.pl` w template'ach i PDF                | `ofertaStudnie.html`, `ruryHtml.ts` |
| 6   | 🟡 HIGH     | Auth token dualny (localStorage + httpOnly cookie) — zbędne ryzyko XSS | `public/js/shared/auth.js`          |
| 7   | 🟢 LOW      | Log serwera `http://localhost`                                         | `server.ts:26`                      |
| 8   | 🟢 LOW      | HSTS `includeSubDomains` — zweryfikować subdomeny                      | `security.ts:26`                    |
| 9   | 🟢 LOW      | Brak plików konfiguracyjnych reverse proxy                             | (nowe pliki)                        |

---

## 4. Sekwencja commitów

### Commit 1: `refactor(security): usunięcie martwych wpisów CSP`

**Plik:** `src/app.ts`

```diff
 connectSrc: [
     "'self'",
-    'http://localhost:5000',
-    'http://127.0.0.1:5000',
-    'ws://localhost:*'
+    ...(process.env.NODE_ENV !== 'production' ? ['ws://localhost:*'] : []),
 ],
```

**Ryzyko:** Niskie. Tylko usunięcie martwych wpisów CSP.
**Zależności:** Brak.
**Test:** `npm run typecheck && npm test`

---

### Commit 2: `feat(infra): dodanie konfiguracji Caddy reverse proxy`

**Nowe pliki:** `Caddyfile`, `Caddyfile.dev`

```
# Caddyfile (produkcja)
twoja-domena.pl {
    tls twoj@email.com

    header {
        Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
    }

    reverse_proxy 127.0.0.1:3000 {
        header_up X-Forwarded-Proto {scheme}
        header_up X-Forwarded-Host {host}
    }
}
```

**Ryzyko:** Niskie. Nowe pliki, brak zmian w kodzie aplikacji.
**Zależności:** Brak.
**Test:** Ręcznie: `caddy run` → sprawdzić HTTPS, `req.secure === true`

---

### Commit 3: `refactor(config): bind Node do 127.0.0.1 w produkcji`

**Plik:** `server.ts`

```diff
- const HOST = process.env.HOST || '0.0.0.0';
+ const HOST = process.env.NODE_ENV === 'production'
+     ? '127.0.0.1'
+     : (process.env.HOST || '0.0.0.0');
```

**Ryzyko:** Średnie. C2 (reverse proxy) MUSI być wdrożony przed tym commitem.
**Zależności:** Commit 2.
**Test:** `NODE_ENV=production npm start` → sprawdzić `http://127.0.0.1:3000/health`

---

### Commit 4: `feat(security): dodanie COOKIE_SECURE env var, naprawa clearCookie`

**Plik:** `src/routes/auth.ts`

```diff
 res.cookie('authToken', token, {
     httpOnly: true,
     maxAge: SESSION_MAX_AGE_MS,
-    secure: process.env.NODE_ENV === 'production',
+    secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
     sameSite: 'lax',
     path: '/'
 });

-res.clearCookie('authToken');
+res.clearCookie('authToken', {
+    httpOnly: true,
+    secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
+    sameSite: 'lax',
+    path: '/'
+});
```

**Ryzyko:** Niskie. Dodaje override, domyślne zachowanie bez zmian.
**Zależności:** Brak.
**Test:** `npm test` (testy auth przechodzą)

---

### Commit 5: `docs(config): aktualizacja .env.example`

**Plik:** `.env.example`

```ini
# ====================================
# HTTPS / Reverse Proxy
# ====================================
# COOKIE_SECURE=true  # wymusza Secure flag na ciastku auth
```

**Ryzyko:** Brak. Tylko komentarze.
**Zależności:** Commit 4.

---

### Commit 6: `chore(scripts): aktualizacja komunikatów start.bat/prod.bat`

**Plik:** `start.bat`, `prod.bat`

Zmiana URL-i w komunikatach z `http://localhost:3000` na neutralne lub wskazujące na reverse proxy.

**Ryzyko:** Niskie. Kosmetyka.
**Zależności:** Commit 3.

---

### Commit 7: `chore(docker): aktualizacja Dockerfile pod reverse proxy`

**Plik:** `Dockerfile`

- `ENV HOST=127.0.0.1`
- `ENV COOKIE_SECURE=true`
- Healthcheck na `http://127.0.0.1:10000/health`

**Ryzyko:** Średnie. Healthcheck URL change.
**Zależności:** Commity 3, 4.

---

### Commit 8: `fix(security): naprawa trust proxy dla multi-proxy`

**Plik:** `src/app.ts:42`

```diff
-app.set('trust proxy', 1);
+app.set('trust proxy', 2);
```

Oraz w `src/middleware/security.ts:7`:

```diff
- const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
+ const forwardedProto = req.headers['x-forwarded-proto'];
+ const isHttps = req.secure ||
+     (typeof forwardedProto === 'string' && forwardedProto.split(',')[0].trim() === 'https');
```

**Ryzyko:** Niskie. Bardziej poprawne parsowanie.
**Zależności:** Brak.
**Test:** `npm test`

---

### Commit 9: `fix(content): zmiana http:// na https:// w template'ach dokumentów`

**Pliki:**

- `public/templates/ofertaStudnie.html` (linie ~1027, 1050, 1056)
- `src/services/pdf/ruryHtml.ts` (linie ~290, 294)
- `src/services/docx/studnie/content.ts` (linia ~146)
- `src/services/docx/rury/content.ts` (linia ~122)

Zamiana `http://www.pv-prefabet.com.pl` → `https://www.pv-prefabet.com.pl`

**Ryzyko:** Niskie. Strona wspiera HTTPS.
**Zależności:** Brak.

---

### Commit 10: `test(security): dodanie testów regresyjnych dla HTTPS`

**Plik:** `tests/security.test.ts`

Testy:

- HSTS header z `max-age=63072000` i `preload`
- `httpsRedirect` przekierowuje gdy `x-forwarded-proto=http` w produkcji
- `httpsRedirect` przepuszcza gdy `x-forwarded-proto=https`
- Brak przekierowania w development

**Ryzyko:** Niskie. Tylko testy.
**Zależności:** Commity 2, 8.

---

### Commit 11: `docs: ADR-006 HTTPS transport + dokumentacja deploymentu`

**Nowe pliki:**

- `docs/adr/ADR-006-https-transport.md`
- `docs/baseline-https.md`

**Aktualizowane:**

- `docs/SECURITY.md` (sekcja 7 — HTTPS, HSTS, certyfikaty)
- `docs/DEPLOYMENT.md` (sekcje 4-5 — reverse proxy z TLS)
- `docs/INSTRUKCJA_SERWER.md` (sekcje 3-4 — HTTPS jako mandatory)

**Ryzyko:** Brak. Tylko dokumentacja.
**Zależności:** Wszystkie poprzednie commity.

---

## 5. Dependency graph

```
C1 (CSP cleanup) ──────────────────────┐
                                       │
C2 (Caddy config) ──────┐             │
                        ├── C3 (127.0.0.1) ── C6 (scripts) ── C7 (Docker)
                        │             │
C4 (Cookie secure) ─────┘             │
                                       ├── C10 (tests) ── C11 (docs)
C5 (.env.example) ← C4                │
                                       │
C8 (trust proxy fix) ─────────────────┘
                                       │
C9 (http→https links) ────────────────┘
```

**Ścieżka krytyczna:** C2 → C3 → C7. C2 (proxy) MUSI być przed C3 (localhost binding).

---

## 6. Ryzyko i rollback

| Commit         | Ryzyko      | Rollback                 |
| -------------- | ----------- | ------------------------ |
| C1 (CSP)       | Niskie      | Revert pliku             |
| C2 (Caddy)     | Niskie      | Usunąć Caddyfile         |
| C3 (127.0.0.1) | **Średnie** | Revert HOST logic        |
| C4 (Cookie)    | Niskie      | Revert pliku             |
| C5 (.env)      | Brak        | Revert                   |
| C6 (Scripts)   | Niskie      | Revert                   |
| C7 (Docker)    | **Średnie** | Revert HOST w Dockerfile |
| C8 (Trust)     | Niskie      | Revert do `1`            |
| C9 (Links)     | Niskie      | Revert                   |
| C10 (Tests)    | Niskie      | Revert                   |
| C11 (Docs)     | Brak        | Revert                   |

---

## 7. Testing gates

| Po commicie | Gate                                                                                                  |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| C1          | `npm run typecheck && npm test`                                                                       |
| C2          | Ręcznie: `caddy run` → HTTPS działa, `req.secure === true`                                            |
| C3          | `NODE_ENV=production npm start` → `http://127.0.0.1:3000/health` OK; port 3000 niedostępny z zewnątrz |
| C4          | `npm test` (testy auth)                                                                               |
| C5          | Review .env.example                                                                                   |
| C6          | Ręcznie: `start.bat --prod` → poprawne URL-e                                                          |
| C7          | `docker build` + `docker run` → healthcheck OK                                                        |
| C8          | `npm test` (testy middleware)                                                                         |
| C9          | Ręcznie: generowanie PDF/DOCX → linki HTTPS                                                           |
| C10         | `npm test` (nowe testy HTTPS przechodzą)                                                              |
| C11         | Review dokumentacji                                                                                   |

**Gate końcowy:** `npm run validate` + manual E2E: załadować appkę przez Caddy z HTTPS, zalogować się, utworzyć/modyfikować/eksportować ofertę, sprawdzić brak mixed content w konsoli.

---

## 8. Macierz testów przeglądarek

| Funkcja                    | Chrome | Edge | Firefox | Safari | Brave |
| -------------------------- | ------ | ---- | ------- | ------ | ----- |
| Logowanie                  | ☐      | ☐    | ☐       | ☐      | ☐     |
| Iframe (rury, studnie)     | ☐      | ☐    | ☐       | ☐      | ☐     |
| Clipboard Copy (Ctrl+C)    | ☐      | ☐    | ☐       | ☐      | ☐     |
| Clipboard Paste (Ctrl+V)   | ☐      | ☐    | ☐       | ☐      | ☐     |
| Excel — kopiowanie zakresu | ☐      | ☐    | ☐       | ☐      | ☐     |
| Excel — wklejanie zakresu  | ☐      | ☐    | ☐       | ☐      | ☐     |
| Drukowanie oferty          | ☐      | ☐    | ☐       | ☐      | ☐     |
| `window.open` (print)      | ☐      | ☐    | ☐       | ☐      | ☐     |
| PDF — generowanie          | ☐      | ☐    | ☐       | ☐      | ☐     |
| PDF — pobieranie           | ☐      | ☐    | ☐       | ☐      | ☐     |
| Upload (import XLSX)       | ☐      | ☐    | ☐       | ☐      | ☐     |
| localStorage               | ☐      | ☐    | ☐       | ☐      | ☐     |
| Cookies / sesja            | ☐      | ☐    | ☐       | ☐      | ☐     |
| API (`/api/*`)             | ☐      | ☐    | ☐       | ☐      | ☐     |

---

## 9. Czego NIE robić

- ❌ Nie uzależniać aplikacji od `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
- ❌ Nie wyłączać zabezpieczeń przeglądarki
- ❌ Nie przebudowywać iframe (są same-origin — działają)
- ❌ Nie przenosić całego Expressa na HTTPS (TLS = odpowiedzialność reverse proxy)
- ❌ Nie zmieniać logiki biznesowej przy migracji HTTPS
- ❌ Nie zakładać, że każdy problem z window.open/clipboard wynika z HTTP
- ❌ Nie hardkodować `http://localhost:3000` w frontendzie (już nie ma)

---

## 10. Kryteria zakończenia

```
[ ] Produkcja działa przez HTTPS — wymaga deployu (manualne)
[ ] HTTP przekierowuje na HTTPS (301) — wymaga deployu reverse proxy (manualne)
[ ] window.isSecureContext === true — weryfikacja w przeglądarce (manualne)
[ ] Brak Mixed Content w DevTools — weryfikacja w przeglądarce (manualne)
[ ] Brak konieczności Chrome Flags — weryfikacja w przeglądarce (manualne)
[ ] Clipboard: kopiowanie i wklejanie działa — weryfikacja w przeglądarce (manualne)
[ ] Drukowanie oferty działa — weryfikacja w przeglądarce (manualne)
[ ] window.open() działa — weryfikacja w przeglądarce (manualne)
[ ] Iframe (rury, studnie) działają — weryfikacja w przeglądarce (manualne)
[✓] API (/api/*) działa — pokryte testami integracyjnymi (supertest)
[✓] Cookies / sesja działają — pokryte testami auth (flaga Secure, clearCookie)
[ ] localStorage działa — weryfikacja w przeglądarce (manualne)
[ ] Download/Upload działa — weryfikacja w przeglądarce (manualne)
[ ] Chrome, Edge, Firefox, Safari, Brave — wszystkie działają — matryca przeglądarek (manualne)
[✓] npm run typecheck — przechodzi
[✓] npm test — przechodzi (1305 testów)
[✓] npm run validate — przechodzi
[✓] Brak regresji funkcjonalnej — potwierdzone zielonymi testami (1305)
```

> **Legenda:** `[✓]` — kryterium potwierdzone kodem i/lub `npm run validate` (typecheck, testy, validate).
> `[ ]` — kryterium manualne: wymaga wdrożenia produkcyjnego (deploy reverse proxy) i/lub weryfikacji
> w przeglądarce na środowisku HTTPS (`isSecureContext`, mixed content, matryca przeglądarek z sekcji 8).
