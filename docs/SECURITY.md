# Bezpieczeństwo — S.O.K. — System Ofert i Kalkulacji

**Wersja:** 1.19.2  
**Ostatnia aktualizacja:** 2026-08-16

---

## 1. Autoryzacja i uwierzytelnianie

### Sesje (token-based)

System używa tokenów sesji do uwierzytelniania użytkowników.

| Parametr       | Wartość                                                |
| -------------- | ------------------------------------------------------ |
| Długość tokena | 64 znaki hex (32 bajty)                                |
| Generator      | `crypto.randomBytes(32)`                               |
| Czas życia     | 7 dni (`SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000`) |
| Przechowywanie | Baza danych (`sessions`), HttpOnly cookie + nagłówek   |

```typescript
// src/middleware/auth.ts
const token = crypto.randomBytes(32).toString('hex');
// Token zapisany w bazie i zwrócony w ciasteczku
res.cookie('authToken', token, {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_MS,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
});
```

### Przekazywanie tokena

Token można przekazać na dwa sposoby:

1. **Ciasteczko `authToken`** (HttpOnly, Secure w produkcji, SameSite=Lax)
2. **Nagłówek `x-auth-token`** — dla zapytań AJAX

### Role

| Rola    | Uprawnienia                                                                   |
| ------- | ----------------------------------------------------------------------------- |
| `admin` | Pełny dostęp — zarządzanie użytkownikami, ustawienia, audyt, wszystkie oferty |
| `user`  | Dostęp do własnych ofert, klientów, zamówień                                  |

Middleware autoryzacji:

- `requireAuth` — wymaga ważnej sesji (kod 401 w razie braku)
- `requireAdmin` — wymaga roli `admin` (kod 403 w razie braku)

---

## 2. Haszowanie haseł

Do haszowania haseł używana jest biblioteka **bcryptjs**.

```typescript
const hash = await bcrypt.hash(password, 10); // 10 rund soli
const valid = await bcrypt.compare(password, hash);
```

---

## 3. Ochrona HTTP — Helmet

Aplikacja używa **Helmet.js** do ustawienia nagłówków bezpieczeństwa HTTP.

```typescript
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:', 'blob:'],
                connectSrc: ["'self'"],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"]
            }
        },
        crossOriginEmbedderPolicy: false
    })
);
```

### Dodatkowe nagłówki (securityHeaders)

```typescript
res.setHeader('X-Content-Type-Options', 'nosniff');
res.setHeader('X-XSS-Protection', '1; mode=block');
res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}
```

---

## 4. Rate Limiting

Prosty, in-memory rate limiter ogranicza liczbę żądań z jednego adresu IP.

| Limiter                 | Okno   | Max prób | Endpointy                      |
| ----------------------- | ------ | -------- | ------------------------------ |
| LOGIN_LIMITER           | 15 min | 15       | `/api/auth/login`              |
| API_LIMITER             | 15 min | 300      | Wszystkie `/api/*`             |
| WRITE_LIMITER           | 15 min | 60       | Zapis danych (POST/PUT/DELETE) |
| PRICELIST_WRITE_LIMITER | 1 godz | 30       | Aktualizacja cenników          |

Rate limiter dodaje nagłówki odpowiedzi:

- `X-RateLimit-Limit` — maksymalna liczba żądań
- `X-RateLimit-Remaining` — pozostałe żądania w oknie
- `Retry-After` — czas do resetu (przy przekroczeniu limitu)

---

## 5. Walidacja danych — Zod

Wszystkie dane wejściowe są walidowane za pomocą biblioteki **Zod**.

```typescript
// Przykład: loginSchema
export const loginSchema = z.object({
    username: z.string().min(1, 'Nazwa użytkownika jest wymagana'),
    password: z.string().min(1, 'Hasło jest wymagane')
});
```

Walidacja chroni przed:

- Wstrzykiwaniem danych (injection)
- Brakującymi polami
- Nieprawidłowymi typami danych
- Zbyt długimi danymi

### Ochrona przed XSS przy renderowaniu HTML

Dynamicznie wstrzykiwany HTML nigdy nie interpoluje danych bezpośrednio do `innerHTML` —
wszystkie wartości tekstowe przechodzą przez funkcję `escapeHtml(str)` (globalna na `window`).
Dotyczy to również dashboardu AI (`public/js/admin/aiDashboard.js`), gdzie dane z bazy wiedzy,
wzorce i metryki ML są renderowane wyłącznie przez `escapeHtml`. Po dynamicznym wstrzyknięciu
fragmentów z ikonami Lucide wywoływana jest inicjalizacja `lucide.createIcons({ root: container })`.

---

## 6. Ochrona przed SQL Injection

- **Prisma ORM** automatycznie parametryzuje zapytania SQL
- Wszystkie zapytania do bazy przechodzą przez Prisma Client
- Jedyny wyjątek: `VACUUM INTO` w backupie — ale ścieżka jest kontrolowana przez aplikację

---

## 7. HTTPS

**HTTPS jest docelowym środowiskiem aplikacji w produkcji.** TLS terminuje reverse proxy
(Caddy/Nginx) — Node.js pozostaje serwerem HTTP i w produkcji binduje się do `127.0.0.1`.
Zobacz [ADR-006](adr/ADR-006-https-transport.md).

- W środowisku produkcyjnym (`NODE_ENV=production`) włączone jest przekierowanie HTTP → HTTPS
- Wykrywanie przez nagłówek `x-forwarded-proto` (dla reverse proxy); obsługiwana lista
  wartości przy wielu proxy (np. `https, http` — brany jest pierwszy wpis)
- Nagłówek HSTS (Strict-Transport-Security) ustawiony na 1 rok w produkcji
- Ciastko sesji `authToken` ma flagę `Secure` (wymuszaną przez `COOKIE_SECURE=true`
  lub `NODE_ENV=production`); `clearCookie` używa tych samych opcji

```typescript
export function httpsRedirect(req: Request, res: Response, next: NextFunction): void {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const isHttps =
        req.secure ||
        (typeof forwardedProto === 'string' && forwardedProto.split(',')[0].trim() === 'https');
    if (process.env.NODE_ENV === 'production' && !isHttps) {
        res.redirect('https://' + req.headers.host + req.url);
        return;
    }
    next();
}
```

### Konfiguracja reverse proxy

| Proxy | Plik konfiguracji    | Uwagi                             |
| ----- | -------------------- | --------------------------------- |
| Caddy | `Caddyfile`          | Auto-Let's Encrypt, auto-renew    |
| Caddy | `Caddyfile.dev`      | Lokalny HTTPS (mkcert), port 3443 |
| Nginx | `docs/DEPLOYMENT.md` | + certbot Let's Encrypt           |

---

## 8. CORS

- Aplikacja serwuje backend i frontend z tego samego serwera (brak CORS)
- CSP (Content Security Policy) kontroluje dozwolone źródła:
    - Skrypty: `'self'` + `'unsafe-inline'` (dla Vanilla JS event handlerów)
    - Style: `'self'` + `'unsafe-inline'`
    - Połączenia: `'self'`

---

## 9. .env i sekrety

- Plik `.env` jest w `.gitignore` — nie trafia do repozytorium
- Wzór konfiguracji: `.env.example` — bezpieczny do commitu
- W produkcji (VPS, Docker, Render): sekrety ustawiane przez zmienne środowiskowe
- Kluczowe sekrety:
    - `DEFAULT_ADMIN_PASSWORD` — hasło admina przy pierwszym uruchomieniu
    - `SENTRY_DSN` — klucz do monitoringu błędów

---

## 10. Audit log

System rejestruje wszystkie znaczące operacje w tabeli `audit_logs`.

| Pole       | Opis                                       |
| ---------- | ------------------------------------------ |
| entityType | Typ encji: `offer`, `client`, `user`, itp. |
| entityId   | ID encji                                   |
| userId     | ID użytkownika wykonującego operację       |
| action     | Akcja: `CREATE`, `UPDATE`, `DELETE`        |
| oldData    | JSON — stan przed zmianą                   |
| newData    | JSON — stan po zmianie                     |

Audit log jest automatycznie czyszczony przy starcie serwera (archiwizacja starych wpisów).

---

## 11. Sentry — monitoring błędów

Opcjonalna integracja z Sentry:

```typescript
if (process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
        integrations: [Sentry.expressIntegration()]
    });
}
```

---

## 12. Podsumowanie zabezpieczeń

| Mechanizm                       | Status                 |
| ------------------------------- | ---------------------- |
| HttpOnly cookies                | ✔                      |
| Secure flag (HTTPS)             | ✔ (w produkcji)        |
| SameSite=Lax                    | ✔                      |
| Helmet (CSP, HSTS)              | ✔                      |
| Rate limiting                   | ✔                      |
| Bcrypt hashing                  | ✔ (10 rund)            |
| Zod validation                  | ✔                      |
| Prisma ORM (SQL injection safe) | ✔                      |
| HTTPS redirect                  | ✔ (w produkcji)        |
| Permissions-Policy              | ✔                      |
| Referrer-Policy                 | ✔                      |
| X-Content-Type-Options          | ✔                      |
| Audit log                       | ✔                      |
| Sentry monitoring               | ✔ (opcjonalny)         |
| CSRF                            | ⚠ (planowane)          |
| npm audit                       | ⚠ (wykonywać okresowo) |

---

## 13. Bezpieczeństwo przy przenoszeniu bazy danych

Podczas przenoszenia bazy SQLite między urządzeniami należy zachować środki ostrożności:

### Przed transportem

- Wykonaj backup za pomocą `npm run backup` (skrypt używa `VACUUM INTO`, który jest bezpieczny nawet podczas działania serwera, ale dla pewności zatrzymaj serwer)
- Upewnij się, że backup nie zawiera danych wrażliwych, które nie powinny opuszczać urządzenia
- W przypadku transportu przez sieć rozważ zaszyfrowanie pliku backupu (np. 7-Zip z hasłem)

### Po przywróceniu na nowym urządzeniu

- Zweryfikuj integralność bazy: sprawdź czy endpoint `/health` działa
- Upewnij się, że hasło `DEFAULT_ADMIN_PASSWORD` w `.env` jest zgodne z poprzednią instalacją
- Jeśli schemat bazy uległ zmianie, uruchom `npx prisma migrate deploy`
  (legacy: `npx prisma db push --skip-generate`)

### Co NIE jest przenoszone

Plik `.env` zawierający sekrety (SENTRY_DSN, hasła) **nie podlega backupowi** i musi być skonfigurowany ręcznie na nowym urządzeniu.

---

## 14. Naprawy bezpieczeństwa (2026-08-16)

Fala napraw z audytu v1.15.1 (A-01…A-60) — plan i status w `docs/plans/archive/2026-08-16-plan-naprawy-audyt.md`:

| Naprawa                                                       | Zakres                                                                                                                                                                                                                                                |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **IDOR w ofertach i zamówieniach** (A-01/A-02/A-03/A-23/A-50) | `canWriteDoc` przed upsertem oferty studni, guard `userId` w upsercie klientów (`DO UPDATE ... WHERE userId = target`), filtr roli w `GET /orders`, `GET /:id` i eksporty zamówień na `canReadDoc`                                                    |
| **Ujednolicone escapowanie XSS** (A-06…A-10)                  | centralne `escapeHtmlAttr`/`escapeJsStr` w `public/js/shared/ui.js`; delegacja duplikatów do `window`; `escapeJsStr` w `onclick` (offerSavedList, pricelistUi, popupsStyczna); `escapeHtml` dla nazw i numerów (offerSavedList, excelTableBody)       |
| **writeLock z ownership** (A-05)                              | `src/middleware/writeLock.ts` — `createModuleLock()` → `{ acquireLock, runWithLock }`, per-klucz, timeout 30 s bez wycieku, mutual exclusion; zastosowany w 4 trasach zapisu cenników (productsV2, productsStudnieV2, precoPricingV2, priceOverrides) |
| **Atomowy claim numeru rur** (A-04)                           | claim przez atomic increment zamiast read-then-write (TOCTOU)                                                                                                                                                                                         |
| **Ownership legacy NULL**                                     | `canWriteDoc` nie zwraca już `true` dla rekordu bez właściciela (`docUserId = null`) — nie-admin nie może nadpisać legacy rekordu (`src/utils/ownership.ts`)                                                                                          |
| **Feature flags admin-only** (A-17)                           | `POST /audit` (wpisy audytu — poisoning) tylko dla admina przez `requireAdmin`                                                                                                                                                                        |
| **Rekurencja escapa**                                         | regresja guarda w globalnych deklaracjach (`typeof window.x === 'function'` wywoływał sam siebie → stack overflow); naprawa przez identity-check delegujący do centralnej tylko dla obcej funkcji (`escapeHtmlAttr`/`escapeJsStr`)                    |

**Zasady frontendu** (baza błędów #39, #40-44 w `AGENTS.md`): interpolacja do `innerHTML`
zawsze przez `escapeHtml(str)`; do atrybutów (`aria-label`, `title`, `onclick`) — `escapeHtmlAttr`/`escapeJsStr`, nigdy `escapeHtml` (nie escapuje `"`).
