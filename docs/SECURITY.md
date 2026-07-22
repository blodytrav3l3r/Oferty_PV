# Bezpieczeństwo — WITROS Oferty PV

**Wersja:** 1.9.0  
**Ostatnia aktualizacja:** 2026-07-22

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

---

## 6. Ochrona przed SQL Injection

- **Prisma ORM** automatycznie parametryzuje zapytania SQL
- Wszystkie zapytania do bazy przechodzą przez Prisma Client
- Jedyny wyjątek: `VACUUM INTO` w backupie — ale ścieżka jest kontrolowana przez aplikację

---

## 7. HTTPS

- W środowisku produkcyjnym (`NODE_ENV=production`) włączone jest przekierowanie HTTP → HTTPS
- Wykrywanie przez nagłówek `x-forwarded-proto` (dla reverse proxy)
- Nagłówek HSTS (Strict-Transport-Security) ustawiony na 1 rok

```typescript
export function httpsRedirect(req: Request, res: Response, next: NextFunction): void {
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    if (process.env.NODE_ENV === 'production' && !isHttps) {
        res.redirect('https://' + req.headers.host + req.url);
        return;
    }
    next();
}
```

---

## 8. CORS

- Aplikacja serwuje backend i frontend z tego samego serwera (brak CORS)
- CSP (Content Security Policy) kontroluje dozwolone źródła:
    - Skrypty: `'self'` + `'unsafe-inline'` (dla Vanilla JS event handlerów)
    - Style: `'self'` + `'unsafe-inline'`
    - Połączenia: localhost na porcie 5000 (dla narzędzi deweloperskich)

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
- Jeśli schemat bazy uległ zmianie, uruchom `npx prisma db push --skip-generate`

### Co NIE jest przenoszone

Plik `.env` zawierający sekrety (SENTRY_DSN, hasła) **nie podlega backupowi** i musi być skonfigurowany ręcznie na nowym urządzeniu.
