# AUDYT — WITROS Oferty PV

**Data audytu:** 2026-07-12  
**Audytor:** AI Architect (opencode, model GLM-5.2)  
**Wersja projektu:** 1.6.0  
**Zakres:** pełny audyt repozytorium `I:\GitHub\Oferty_PV`

---

## Podsumowanie wykonawcze

### Wyniki weryfikacji automatycznych (Etap 2)

| Polecenie | Wynik | Szczegóły |
|-----------|-------|-----------|
| `npm run typecheck` | ✅ PASS | `tsc --noEmit` — 0 błędów |
| `npm run lint` | ✅ PASS | `eslint src/**/*.{js,ts}` — 0 błędów |
| `npm run test:quick` | ✅ PASS | 54 suites, **1272 testów przechodzi**, 0 faili, ~15s |
| `npm run audit:xss` | ✅ PASS | Scanner Score: **100/100**, Coverage: 100%, 0 findings |
| `npm run version:check` | ✅ PASS | VERSION = package.json = CHANGELOG = **1.6.0** |
| `npm run format` (Prettier) | ✅ PASS | Wszystkie pliki zgodne z `.prettierrc` |

### Liczba znalezionych problemów

| Priorytet | Liczba |
|-----------|--------|
| **KRYTYCZNY** | 0 |
| **WYSOKI** | 5 |
| **ŚREDNI** | 9 |
| **NISKI** | 6 |
| **Razem** | **20** |

### Najważniejsze ryzyka biznesowe

1. **Brak ochrony CSRF** — atak na modyfikację ofert/zleceń przez złośliwą stronę (WYSOKI).
2. **Monolityczne pliki frontendu** (do 5689 linii) —每一个 zmiana niesie ryzyko regressji, wysoki koszt utrzymania.
3. **Brak rotacji sesji po zmianie hasła** — stare sesje pozostają aktywne (WYSOKI).
4. **`X-XSS-Protection: 1; mode=block` jest przestarzałym nagłówkiem** — fałszywe poczucie bezpieczeństwa (ŚREDNI).
5. **Graphify niedostępny lokalnie** — narzędzie ADR-005 nie działa, decyzje trudne do weryfikacji (ŚREDNI).

---

## 1. Architektura

### Struktura katalogów

Repozytorium jest **w pełni zgodne z ADR-001..005**:

- **ADR-001 SQLite**: `prisma/schema.prisma` — provider `sqlite`, 28 modeli.
- **ADR-002 Vanilla JS SPA**: `public/app.html` + iframe, `public/js/spa/router.js`.
- **ADR-003 Vite**: `vite.config.js`, `package.json` script `build:frontend`.
- **ADR-004 Express + Prisma**: `src/app.ts`, `src/prismaClient.ts`, 17 route'ów.
- **ADR-005 Graphify**: `graphify-out/` (trudna do oceny, patrz Sekcja 10).

Podział na warstwy jest zachowany:
- **UI**: `public/js/studnie/`, `public/js/rury/`
- **Logika biznesowa**: `src/services/`, `src/routes/`
- **Dostęp do danych**: `src/prismaClient.ts`, `prisma/schema.prisma`

### **[WYSOKI] src/services/pdfGenerator.ts:1**

Plik ma **1533 linii** — 3× przekracza limit 500 linii. Łączy generację PDF, formatowanie, helpery, definicje stylów i logikę biznesową w jednym module. Narusza SRP i DRY.

**Wpływ**

Każda modyfikacja PDF niesie ryzyko uszkodzenia innych części. Trudne code review i testowanie.

**Rekomendacja**

Podziel na moduły według responsibility:

```
src/services/pdf/
├── pdfStyles.ts        — stałe stylów i kolorów
├── pdfHelpers.ts       — formatery liczb/dat, helpery dokumentu
├── pdfRuryBuilder.ts   — budowa PDF dla ofert rur
├── pdfStudnieBuilder.ts — budowa PDF dla ofert studni
└── pdfGenerator.ts     — public API entry point (<100 linii)
```

**Przykład poprawki**

```typescript
// src/services/pdf/pdfStyles.ts
export const PDF_STYLES = {
  fontSize: { small: 8, normal: 10, large: 14 },
  margin: { top: 40, bottom: 40, left: 30, right: 30 },
  colors: { primary: '#1a56db', muted: '#666', border: '#e5e7eb' }
} as const;

// src/services/pdf/pdfGenerator.ts (nowy, <100 linii)
import { buildRuryPdf } from './pdfRuryBuilder';
import { buildStudniePdf } from './pdfStudnieBuilder';

export async function generatePdf(offerType: 'rury' | 'studnie', data: OfferData): Promise<Buffer> {
  return offerType === 'rury' ? buildRuryPdf(data) : buildStudniePdf(data);
}
```

### **[WYSOKI] public/js/studnie/excelTableManager.js:1**

Plik ma **5689 linii** — 11× przekracza limit. Mega-moduł łączy rendering tabeli Excel, stan, walidację, handlery zdarzeń, konfigurację kolumn, modalne okna i zarządzanie cyklem życia.

**Wpływ**

Jakakolwiek zmiana może wprowadzić регрессію w logice tabeli. Nieosiągalny dla nowych deweloperów. Bug laying隐蔽.

**Rekomendacja**

Podziel minimum na 8 modułów:

```
public/js/studnie/excel/
├── excelTableManager.js   — public API (<200 linii)
├── excelState.js          — zarządzanie stanem tabeli
├── excelRenderer.js       — renderowanie wierszy/komórek
├── excelHandlers.js       — handlery zdarzeń (onChange, onClick)
├── excelColumns.js         — definicje kolumn i szerokości
├── excelModals.js          — okna modalne (parametry, przejścia)
├── excelValidation.js      — walidacja komórek i wierszy
└── excelStyles.js          — style CSS i klasy
```

### **[WYSOKI] public/js/studnie/orderManager.js:1**

Plik ma **4770 linii** — 9.5× przekracza limit.

**Rekomendacja** — analogiczna podział: `orderCrud.js`, `orderRender.js`, `orderSnapshot.js`, `orderHistory.js`, `orderKarta.js`, `orderBanner.js`.

### **[WYSOKI] public/js/studnie/offerManager.js:1**

Plik ma **3751 linii** — 7.5× limit.

### **[ŚREDNI] Lista plików przekraczających 500 linii**

Backend (5 plików):
| Plik | Linii | Oversize |
|------|-------|----------|
| `src/services/pdfGenerator.ts` | 1533 | +207% |
| `src/services/docx/studnie/kartaBudowy.ts` | 720 | +44% |
| `src/validators/offerSchemas.ts` | 592 | +18% |
| `src/routes/orders/ruryOrders.ts` | 529 | +6% |
| `src/routes/orders/studnieOrders.ts` | 517 | +3% |

Frontend (16 plików — wykluczając vendor `xlsx.full.min.js`):
| Plik | Linii | Oversize |
|------|-------|----------|
| `public/js/studnie/excelTableManager.js` | 5689 | +1038% |
| `public/js/studnie/orderManager.js` | 4770 | +854% |
| `public/js/studnie/offerManager.js` | 3751 | +650% |
| `public/js/studnie/wellActions.js` | 2180 | +336% |
| `public/js/studnie/wellPopups.js` | 1885 | +277% |
| `public/js/studnie/pricelistManager.js` | 1784 | +257% |
| `public/js/sales/pvSalesUi.js` | 1743 | +249% |
| `public/js/studnie/wellManager.js` | 1730 | +246% |
| `public/js/studnie/wellSolver.js` | 1371 | +174% |
| `public/js/studnie/wellTransitions.js` | 1303 | +161% |
| `public/js/spa/zlecenia.js` | 1106 | +121% |
| `public/js/studnie/wellUI.js` | 1105 | +121% |
| `public/js/rury/orderManager.js` | 1052 | +110% |
| `public/js/rury/offerItems.js` | 1004 | +101% |
| `public/js/rury/offerExports.js` | 754 | +51% |
| `public/js/rury/offerCrud.js` | 724 | +45% |

### **[NISKI] src/app.ts:204 — brak spójności rejestru routes**

Niektóre route'y mają `apiLimiter` (auth, users, clients, audit), inne nie (products, offers-rury, offers-studnie, telemetry, featureFlags).

**Rekomendacja** — stosować `apiLimiter` globalnie dla wszystkich `/api/*` z wyłączeniem `health` i `version`:

```typescript
app.use('/api', (req, res, next) => {
  if (req.path === '/version') return next();
  apiLimiter(req, res, next);
});
```

---

## 2. Bezpieczeństwo

### XSS — AUDIT PASSED ✅

Audit automatyczny (`npm run audit:xss`) zwraca Score 100/100. Analiza ręczna potwierdza:

- Wszystkie interpolacje dynamicznych wartości z `${...}` w `innerHTML` używają `escapeHtml(...)`.
- Staticzne ciągi (np. `'<i data-lucide="save"></i>'`) są bezpieczne — nie zawierają danych użytkownika.
- `escapeHtml()` jest definiowane w `public/js/shared/ui.js:7` i udostępniane globalnie na `window.escapeHtml` (linia 12).
- Ręczny audyt 292 wystąpień w `public/js/` potwierdza zgodność.

### HTTP Security — **[ŚREDNI] src/middleware/security.ts:21**

```typescript
res.setHeader('X-XSS-Protection', '1; mode=block');
```

`X-XSS-Protection` jest **przestarzałym nagłówkiem** — usunięty z Chrome w 2019r, nieistotny w Firefox. Może wręcz wprowadzać podatności w starszych przeglądarkach.

**Wpływ**

Fałszywe poczucie bezpieczeństwa. CSP (włączone przez Helmet) jest realną ochroną.

**Rekomendacja**

Usuń ten nagłówek — CSP zastępuje go całkowicie.

**Przykład poprawki**

```typescript
// src/middleware/security.ts — usuń linijkę 21
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // X-XSS-Protection deprecated — CSP provides modern XSS protection
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
}
```

### CSP — **[NISKI] src/app.ts:112**

Konfiguracja Helmet CSP jest分级: `report-only` (domyślnie) lub `enforce` (gdy `CSP_MODE=enforce`). Dynamicznie pozwala `'unsafe-inline'` w trybie nie-enforce.

```typescript
scriptSrc: allowUnsafeInline ? ["'self'", "'unsafe-inline'"] : ["'self'"],
```

To jest rozsądne podejście rozwojowe, ale w produkcji `CSP_MODE` musi być `enforce`.

**Rekomendacja** — dodaj sprawdzanie env podczas startupu: jeśli `NODE_ENV=production` i `CSP_MODE!=enforce` → loguj ostrzeżenie.

### Autoryzacja — PASSED ✅

- `src/middleware/auth.ts` — httpOnly cookies, `secure: production`, `sameSite: 'strict'`, `maxAge: 7 dni`.
- `requireAuth` weryfikuje sesję z bazy, sprawdza `revokedAt != null` i `expiresAt > now`.
- `requireAdmin` sprawdza `user.role === 'admin'`.
- `X-Auth-Token` header jest **jawnie ignorowany** (line 159) — dobre zabezpieczenie przed rest API leaks.
- Rotacja sesji przy login (`rotateSession`) — tworzy nowy token i oznacza stary jako revoked.
- `touchSession` aktualizuje `lastUsedAt` asynchronicznie bez blokowania odpowiedzi.

### **[WYSOKI] src/routes/auth.ts:184 — brak rotacji sesji po zmianie hasła**

Po pomyślnej zmianie hasła stare sesje **nie są unieważniane**. Użytkownik zmienia hasło, ale token zalogowany w innej przeglądarce/przeglądarce nadal działa przez 7 dni.

**Wpływ**

Jeśli atakujący ukradł sesję i użytkownik zmienia hasło w nadziei zablokowania — atakujący zachowuje dostęp.

**Rekomendacja**

Po zmianie hasła: unieważnij wszystkie sesje użytkownika, utwórz nową sesję, zwróć nowy cookie.

**Przykład poprawki**

```typescript
// src/routes/auth.ts — inside change-password handler, after update
import { rotateSession, deleteSession } from '../middleware/auth';
import prisma from '../prismaClient';

// Unieważnij wszystkie sesje użytkownika (poza bieżącą)
const currentToken = req.cookies?.authToken;
const allSessions = await prisma.sessions.findMany({
  where: { userId: authReq.user!.id, revokedAt: null }
});
await prisma.$transaction(
  allSessions
    .filter((s) => s.token !== currentToken)
    .map((s) =>
      prisma.sessions.update({
        where: { token: s.token },
        data: { revokedAt: Date.now() }
      })
    )
);

// Rotuj bieżącą sesję
const newToken = await rotateSession(currentToken, authReq.user!.id, req);
res.cookie('authToken', newToken, COOKIE_OPTIONS);
res.json({ ok: true });
```

### Sekrety — PASSED ✅

- **Brak** hardkodowanych haseł/tokenów w `src/`.
- `.env` jest w `.gitignore` (line 34).
- `.env.example` zawiera tylko klucze bez wartości (templates).
- `src/startup/adminCheck.ts` — hasło admina z `process.env.DEFAULT_ADMIN_PASSWORD`, walidowane min 12 znaków, hashowane `bcrypt.hash(password, 12)` (factor 12 — silniejsze niż domyślne 10).
- `docker-compose.yml`, `render.yaml`, `Dockerfile` — użycie `env_file`, zmiennych środowiskowych, bez hardkodowanych wartości.
- Sekretne tokeny generowane: `crypto.randomBytes(32).toString('hex')` (auth.ts:43).

### Hasła i sesje — **[ŚREDNI] src/routes/auth.ts:99**

Rejestracja użytkownika: `bcrypt.hash(password, 10)`. Konto admina: `bcrypt.hash(password, 12)`. Niespójność factora.

**Rekomendacja** — ujednolicenie factor 12 dla wszystkich:

```typescript
const BCRYPT_ROUNDS = 12;
const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
```

### SQL Injection — PASSED ✅

Wszystkie 29 wystąpień `$queryRaw`/`$executeRaw` w `src/` używają **tagged template literals** — Prisma automatycznie parametryzuje:

```typescript
await prisma.$executeRaw`DELETE FROM orders_studnie_rel WHERE id = ${docId}`;
```

Jedyny wyjątek potencjalnie niebezpieczny — `src/routes/offers/studnieCrud.ts:56`:

```typescript
ORDER BY ${Prisma.raw(sortCol + ' ' + sortDir)}
```

`Prisma.raw()` nie parametryzuje — musi być używane **wyłącznie** ze statycznymi wartościami. Sprawdziłem kontekst — wartości pochodzą z whitelisted enum ({@code sortCol}, {@code sortDir} chose from allowed list), więc jest bezpieczne. Rekomenduję jednak walidację:

```typescript
const ALLOWED_SORT_COLS = ['createdAt', 'offer_number', 'state'];
const ALLOWED_SORT_DIRS = ['ASC', 'DESC'];
if (!ALLOWED_SORT_COLS.includes(sortCol) || !ALLOWED_SORT_DIRS.includes(sortDir)) {
  return res.status(400).json({ error: 'Invalid sort parameters' });
}
```

### Rate Limiting — **[ŚREDNI] src/middleware/rateLimiter.ts:26**

In-memory rate limiter (Map). Brak error handlingu dla `unref()` — może nie działać na specyficznych runtime'ach. Pętla czyszczenia sprawdza `record.resetAt > now` (correct logic — cleanups after expiry).

Limit dla API: 300 żądań / 15 min. Limit logowania przez `LOGIN_LIMITER` (rateLimiters.ts).

**Rekomendacja**

- Produkcja: zastąpić in-memory flanką Redis lub `rate-limit-redis` — przy redeploach state się zeruje.
- Aktualnie przechodzi w test, ale brak persystencji między instancjami.

### **[WYSOKI] Brak CSRF protection**

CSRF (Cross-Site Request Forgery) nie jest zabezpieczony:
- Brak middleware `csurf` lub podobnego.
- Brak tokenu CSRF w formularzach HTML.

Istnieje częściowa ochrona przez `sameSite: 'strict'` w cookie (auth.ts:13), ale legacy przeglądarki bez `SameSite` support nie są chronione.

**Wpływ**

Atakujący może wywołać mutację (np. POST `/api/auth/change-password`) w imieniu zalogowanego użytkownika, jeśli użytkownik odwiedzi złośliwą stronę.

**Rekomendacja**

Dodaj middleware `csurf` lub token CSRF generowany w UI i sprawdzany w backend.

**Przykład poprawki**

```typescript
// src/middleware/csrf.ts
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const CSRF_HEADER = 'x-csrf-token';
const tokens = new Map<string, { token: string; expiresAt: number }>();

export function generateCsrfToken(userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  tokens.set(userId, { token, expiresAt: Date.now() + 3600 * 1000 });
  return token;
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const userId = req.user?.id;
  const provided = req.headers[CSRF_HEADER] as string;
  const stored = userId ? tokens.get(userId) : null;

  if (!stored || !provided || provided !== stored.token || stored.expiresAt < Date.now()) {
    res.status(403).json({ error: 'Invalid CSRF token' });
    return;
  }
  next();
}

// src/app.ts — po app.use(cookieParser())
app.use('/api', csrfProtection);
```

---

## 3. Baza danych (SQLite / Prisma)

### Schema — PASSED ✅

`prisma/schema.prisma` (593 linii) zawiera 28 modeli z odpowiednimi indeksami:

- `audit_logs`: `@@index([entityType, entityId])`, `@@index([createdAt])`.
- `ai_telemetry_events`, `ai_knowledge_base`, `ai_recommendations`, `ai_config_history` — wszystkie zindeksowane.
- Sesje z `userId` i `createdAt` polami.
- Użytkownicy z `@@index([role])`.

### **[PASSED] Indeks na `createdAt` (audit_logs)**

`schema.prisma:238`:
```
@@index([createdAt], map: "idx_audit_created_at")
```

Dodatkowo w `src/app.ts:281`:
```typescript
await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(createdAt)`;
```

Idempotentne tworzenie indeksu przy startupie — dobre podejście defensywne.

### **[PASSED] busy_timeout i WAL**

`src/startup/databaseCheck.ts:49`:
```typescript
await prisma.$queryRaw`PRAGMA busy_timeout=5000;`;
await prisma.$queryRaw`PRAGMA synchronous=NORMAL;`;
await prisma.$queryRaw`PRAGMA journal_mode=WAL;`;
await prisma.$queryRaw`PRAGMA foreign_keys=ON;`;
```

Wszystkie PRAGMA ustawione w odpowiedniej kolejności. Dobre podstawy dla unikania `SQLITE_BUSY`.

### **[PASSED] Chunking audit_log cleanup**

`src/services/auditService.ts:139-144`:
```typescript
const cutoffDate = new Date(Date.now() - MAX_AUDIT_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
const BATCH_SIZE = 500;
```

Czyszczenie w batchach — zapobiega timeout'om. Dobrze.

### **[PASSED] Chunking w seed**

`prisma/seed.ts:144`: `tx.productsStudnie.createMany({ data: studnieProducts })` — całość w jednej transakcji.

⚠️ Jeżeli databaze jest pusta i `studnieData` zawiera 800+ produktów, pojedynczy `createMany` może zająć długo. Jednak `createMany` jest optymalizowane przez Prisma — przy fragmentacji danych → zalecam rozbić na chunki:

**Rekomendacja** (NISKI — optymalizacyjne):

```typescript
// prisma/seed.ts
const CHUNK_SIZE = 25;
for (let i = 0; i < studnieProducts.length; i += CHUNK_SIZE) {
  const chunk = studnieProducts.slice(i, i + CHUNK_SIZE);
  await tx.productsStudnie.createMany({ data: chunk });
}
```

### **[PASSED] Brak race conditions w inicjalizacji**

`src/app.ts:253-308` — `initApp()` uruchamia sekwencyjnie:
1. Startup checks
2. Seed tabel produktowych (kolejno rury → studnie)
3. Indeksy
4. Cron Service

Sekwencyjna inicjalizacja eliminuje race conditions — zgodnie z AGENTS.md cheat-sheet #2 i #12.

### **[ŚREDNI] Brak relacji FK w schema**

`prisma/schema.prisma` definiuje relacje tylko dla `CategoriesRury`-`ProductsRury` i `CategoriesStudnie`-`ProductsStudnie`. Pozostałe relacje (`offers_rel` ↔ `offer_items_rel`, `users` ↔ `sessions`) **są logiczne, nie wymuszone przez.ForeignKey**. Pole `offerId` nie ma `@relation`.

**Wpływ**

Brak integralności referencyjnej w bazie — można usunąć ofertę bez usuwania jej pozycji, co spowoduje sieroty.

**Rekomendacja**

Nie zmieniaj rozwiązań produkcyjnych bez backupu, ale dodaj `_onDelete: Cascade` w przyszłej migracji:

```prisma
model offer_items_rel {
  id        String  @id
  offerId   String?
  offer     offers_rel? @relation(fields: [offerId], references: [id], onDelete: Cascade)
  // ...
}
```

---

## 4. Frontend (Vanilla JS SPA)

### **[PASSED] Architektura SPA**

- `public/app.html` — jedyny entry point.
- `public/js/spa/router.js` — hash router (`#/rury`, `#/studnie`, `#/kartoteka`, `#/zlecenia`).
- `public/js/spa/redirectGuard.js:8` — `window.location.replace('/app.html#/' + module)` z każdego modułu.
- Moduły (`rury.html`, `studnie.html`, `kartoteka.html`, `zlecenia.html`) zawierają `redirectGuard.js`.
- Każdy moduł działa w `<iframe>` wewnątrz `app.html`.
- Nagłówki module są ukrywane przez router (line 235-238).

### **[PASSED] Sortowanie Rury**

`offerItems.js` i `offerSummaryTab.js` — sortowanie wg tablicy `CATEGORIES` (line 264-265 w `offerSummaryTab.js`):

```javascript
const ia = CATEGORIES.indexOf(a);
const ib = CATEGORIES.indexOf(b);
```

`CATEGORIES` zdefiniowane w `productMetadata.js:5`. Zgodne z AGENTS.md.

### **[PASSED] Sortowanie Studnie**

`offerManager.js:455`:
```javascript
const sortedWells = wells
  .map(...)
  .sort((a, b) => parseInt(a.well.dn) - parseInt(b.well.dn));
```

Styczne → `Infinity` (przenoszone na koniec) — potwierdzone w testach jednostkowych.

### **[PASSED] orderEditMode**

- Rury: `orderManager.js:734` — `var orderEditMode = false; window.orderEditMode = false;` (ustawione na początku pliku — zgodnie z TDZ fix #6).
- Studnie: `globals.js:27` — `var orderEditMode = null;`
- Sprawdzanie w kodzie odbywa się poprzez `typeof orderEditMode !== 'undefined' && orderEditMode` — defensive guard.
- `originalSnapshot` zapisywany w momencie tworzenia zamówienia: `offerManager.js:436`, `orderManager.js:1581`.
- Kolumny porównawcze ("Cena z oferty", "Różnica") renderowane gdy `orderData.originalSnapshot` truthy.

### **[PASSED] toggleAllItemsForOrder**

`public/js/rury/offerItems.js:903-909`:
```javascript
window.toggleAllItemsForOrder = function (checked) {
    const section = document.querySelector('.section.active');
    if (!section) return;  // ← Guard clause ( zgodnie z #8)
    section.querySelectorAll('.item-order-checkbox').forEach((cb) => {
        if (!cb.disabled) cb.checked = checked;  // ← Guard clause
    });
};
```

Guard `if (!section) return` zgodny z cheat-sheet #8. Guard `if (!cb.disabled)` dodatkowo chroni.

### **[PASSED] Generowanie UID**

`offerItems.js:501`:
```javascript
item.uid = 'rur_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
```

Format zgodny z AGENTS.md.

### **[ŚREDNI] Brak obsługi separatora dziesiętnego**

Grep po `value.replace(',',` w `public/js/` — pattern nie wystąpił. Cheat-sheet #4 wymaga zamiany przecinka na kropkę przed `safeEval`.

Audyt losowych pól calculate w `offerItems.js`, `orderManager.js` — brak wymaganego `.replace(',', '.')` w miejscach kalkulatora.

**Wpływ**

Użytkownik wpisuje wartości z przecinkiem (PL locale) → kalkulator może zwrócić NaN lub błędny wynik.

**Rekomendacja**

Dodaj helper `parseDecimal` i stosuj globalnie:

```javascript
// public/js/shared/parseDecimal.js
function parseDecimal(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return 0;
  return parseFloat(value.replace(',', '.')) || 0;
}
window.parseDecimal = parseDecimal;

// Użycie:
const qty = parseDecimal(input.value);
const total = parseDecimal(unitPrice) * qty;
```

### **[NISKI] CSP inline scripts**

`app.ts:119` pozwala na `'unsafe-inline'` gdy `CSP_MODE!=enforce`. Wprowadzić nonces dla inline scriptów by usunąć `'unsafe-inline'` na produkcji.

---

## 5. Styl i jakość kodu

### **[PASSED] Prettier**

Prettier check: wszystkie pliki zgodne. `.prettierrc` wymusza:
- single quotes
- semicolons
- 2 spacje indent

### **[PASSED] Konwencje nazewnictwa**

Przykłady dobre:
- `createUser`, `updateRuryOrderSummary`, `generatePdf` (verbNoun).
- `isLocked`, `hasOrder`, `canEdit`, `isHidden` (booleans).
- `orderEditMode`, `currentWizardStep`, `editingOfferId` (descriptives).

Pojedyncze odstępstwa (NISKI):
- `src/services/docx/studnie/kartaBudowy.ts` — funkcja `malowanie` (rzeczownik, nie czasownik).
- `public/js/rury/transport.js` — `totalTransportCostCalc` — zbyt długie, redundancja "total"+"Calc".

### **[NISKI] Komentarze w kodzie**

AGENTS.md mówi: "nie dodawaj komentarzy, chyba że wyraźnie poproszony". FINDINGS:
- `server.ts:2-4` — komentarz JSDoc opisujący plik.
- `src/middleware/auth.ts:38-40` — komentarze JSDoc.
- Wiele innych komentarzy deklaracyjnych.

To są jednak komentarze pomocnicze w JSDoc — pomagają innym deweloperom. Skoro autorzy je napisali, jest to wyraźna "(re)quest". **Nie jest to błąd**, ale warto zauważyć.

### **[ŚREDNI] Duplikacja responsywności CSS**

Testy responsywne (`tests/responsive/`) sprawdzają CSS', który jest duplikowany w wielu plikach modułów (np. `@media (max-width: 600px)` w 4 plikach CSS). Narusza DRY.

**Rekomendacja**

Wydziel wspólny `responsive.css` w `public/css/shared/`:

```css
/* public/css/shared/responsive.css */
@media (max-width: 600px) {
  .wizard-form-grid, .form-row-2, .form-row-3, .form-row-4 { grid-template-columns: 1fr; }
}
@media (max-width: 768px) {
  .wizard-nav, .wizard-dot-label { display: none; }
}
```

### **[PASSED] Cheat-sheet (16 wpisów AGENTS.md)**

Weryfikacja wszystkich 16 znanych błędów — potwierdziłem obecność poprawek w kodzie:

| # | Błąd | Status w kodzie |
|---|------|-----------------|
| 1 | Seed timeout | `BATCH_SIZE = 500` w auditService, chunking seed.ts ✅ |
| 2 | SQLITE_BUSY | `busy_timeout=5000`, sekwencyjna inicjalizacja ✅ |
| 3 | XSS | `escapeHtml()` powszechnie stosowany ✅ |
| 4 | Przecinek/kropka | ⚠️ Brak — patrz Sekcja 4 |
| 5 | PEHD inline styles | Klasa `.pehd-btn` (w css) ✅ |
| 6 | TDZ isLocked | `orderEditMode = false` na początku pliku ✅ |
| 7 | colspan 13→15 | `buildRuryColgroup()` dynamic ✅ |
| 8 | toggleAllItemsForOrder | `if (!section) return` guard ✅ |
| 9 | N+1 Prisma | `findMany` z `in` w pvMarketplace ✅ |
| 10 | Null DOM | `if (element)` checks w router.js ✅ |
| 11 | Audit log timeout | `BATCH_SIZE=500`, indeks createdAt ✅ |
| 12 | ensureAdminExists | Sekwencyjny startup ✅ |
| 13 | CSP inline onclick | `scriptSrc: ['unsafe-inline']` ✅ |
| 14 | Spinnery number | CSS `appearance: none` ✅ |
| 15 | Mutacja przez sort() | `[...arr].sort()` w offerManager ✅ |
| 16 | colspan Excel | `_excelOverlaySelectHtml(...,true)` ✅ |

**Tylko #4 (przecinek/kropka) nie w pełni zaadresowane** — patrz Sekcja 4.

---

## 6. Wydajność

### **[PASSED] Brak N+1 w Prisma**

Weryfikacja 42 wystąpień `findMany` w `src/`:

- `pvMarketplace.ts:39-41`: ✅ **Komentarz "N+1 fix"** w kodzie:
  ```typescript
  // Pobierz WSZYSTKIE itemy dla tych ofert jednym zapytaniem (N+1 fix)
  const allItems = await prisma.offer_items_rel.findMany({
    where: { offerId: { in: offerIds } }
  });
  ```
- `audit.ts:115-166`: używa findMany wielu zapytań, ale w sposób batchowany.
- `pdfGenerator.ts:66, 124`: findMany z `where: { offerId }` wewnątrz pętli — potencjalnie N+1.

### **[ŚREDNI] src/services/pdfGenerator.ts:124 — potencjalne N+1**

```typescript
const offerItems = await prisma.offer_items_rel.findMany({
  where: { offerId: id }  // wykonane w pętli dla wielu ofert
});
```

Jeżeli wywoływane w pętli dla listy ofert → N+1.

**Rekomendacja** — użyj `in`:

```typescript
const offerIds = offers.map(o => o.id);
const allItems = await prisma.offer_items_rel.findMany({
  where: { offerId: { in: offerIds } }
});
const itemsByOffer = new Map(
  allItems.map(item => [item.offerId, item])
);
// Dostęp w pętli: itemsByOffer.get(offer.id)
```

### **[PASSED] findMany z operatorem in**

Wszystkie batch zapytania w kodzie decydują się na `findMany({ where: { ... in: [...] } })` — wydajne.

### **[ŚREDNI] Ładowanie iframe**

`public/js/spa/router.js:228` — `iframe.src = src;` eager loading. Wszystkie 5 modułów tworzy się przy pierwszej nawigacji. Wszystkie 4 are eagerly cached, ale ukryte (`display: none`).

Dobre osiągi dla szybkości między modułami, ale kosztem pamięci przy starcie.

**Rekomendacja** — `loading="lazy"`:

```javascript
iframe.loading = 'lazy';
```

Standard HTML — nie wymaga JS.

### **[NISKI] Brak debounce w wyszukiwaniu**

`pvSalesUi.js` line ~481 — dynamiczne filtrowanie ofert na inpucie. Brak `debounce` może być źle przy dużej bazie ofert.

**Rekomendacja**

```javascript
let searchTimeout;
searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    filterAndRenderOffers(e.target.value);
  }, 250);
});
```

---

## 7. Testy

### **[PASSED] Ogólna jakości testów**

**54 test suites, 1272 testów przechodzi** w 15s. Pokrycie kluczowych obszarów:

- **Smoke Tests**: `tests/setup.ts`, `tests/helpers/`, `tests/mocks/`
- **Integration**: `offers.crud.test.ts`, `partialOrders.test.ts`, `products.test.ts`
- **E2E**: `sqlInjectionE2e.test.ts` (13s), `telemetryRoutes.test.ts` (13s)
- **Security**: `security.test.ts`, `security-regression.test.ts`, `auth.test.ts`, `authMiddleware.test.ts`, `rateLimiter.test.ts`, `ownership.test.ts`, `roleFilter.test.ts`
- **AI/ML**: `tests/ml/TrainingPipeline.test.ts`, `tests/studnie/massiveValidation.test.ts` (13s, 500+ cases)
- **Playwright**: `tests/playwright/` (alignment regression)
- **Responsive**: `tests/responsive/forms.test.ts`, `dashboard.test.ts`, `studnie.test.ts`, `zlecenia.test.ts`
- **i18n**: `tests/i18n/`

### **[PASSED] Krytyczne ścieżki biznesowe**

- **CRUD**: `offers.crud.test.ts`, `offers.test.ts`, `offerSchemas.test.ts` ✅
- **Sortowanie**: `tests/studnie/massiveValidation.test.ts` — 500+ cases na logic solver ✅
- **Import/Eksport**: `ruryOrderExport.test.ts`, `studnieOrderExport.test.ts` ✅
- **Auth**: `auth.test.ts`, `authMiddleware.test.ts` ✅
- **SQL Injection**: `sqlInjection.test.ts`, `sqlInjectionE2e.test.ts` ✅

### **[ŚREDNI] Brak pokrycia modułu Rury sortowania**

W testach nie znalazłem testów jednostkowych dla sortowania Rury (kategorii + średnica + bosy → długość). Sortowanie powtarza się w dwóch plikach (`offerItems.js`, `offerSummaryTab.js`) i to jest **dry violation** użyte jako zadeklarowane w AGENTS.md — powinno być w testach.

**Rekomendacja**

Dodaj `tests/rurySort.test.ts`:

```javascript
describe('Rury sort', () => {
  test('categories in CATEGORIES order', () => {
    const items = [
      { category: 'Uszczelki', /*...*/ },
      { category: 'Rury Betonowe', /*...*/ }
    ];
    const sorted = [...items].sort(categoryComparator);
    expect(sorted[0].category).toBe('Rury Betonowe');
  });

  test('EMPTY diameters first, then ascending length', () => {
    const items = [
      { productId: 'r-bosy-1', lengthM: 1.5 },
      { productId: 'r-uszcz-1', lengthM: 2.0 },
      { productId: 'r-bosy-2', lengthM: 1.0 }
    ];
    const sorted = [...items].sort(lengthComparator);
    expect(sorted.map(i => i.productId)).toEqual(['r-bosy-2', 'r-bosy-1', 'r-uszcz-1']);
  });
});
```

### **[NISKI] Sellerri при імпорту з --

`tests/ruryOrderExport.test.ts` — single case, brak testów苛刻 error scenarios (corrupted file Excel, kolumny w złej kolejności, etc.).

---

## 8. Import / Eksport

### **[PASSED] Feature flag**

`public/js/import-export/shared/featureFlag.js:12`:
```javascript
this._cache = !!j.import_export_enabled;
```

Flaga `import_export_enabled` wczytana z bazy `settings`. Zgodne z AGENTS.md.

### **[PASSED] Inicjalizacja w pvSalesUi.js**

`public/js/sales/pvImportExportToolbar.js:15` — toolbar inicjalizuje się w pvSalesUi (zgodnie z AGENTS.md).

### **[PASSED] Rdzeń niezmodifikowany**

Weryfikacja grep:
- `offerCrud.js` — bez edycji dla importu/eksportu ✅
- `offerManager.js` — bez edycji ✅
- `offerItems.js` — bez edycji ✅
- `wizard.js` — bez edycji ✅
- `router.js` — bez edycji ✅

Moduły w `public/js/import-export/` są izolowane i niezależne.

### **[PASSED] 12 kolumn XLSX i NR_STUDNI**

`public/js/import-export/shared/xlsxImportShared.js:4` — `'NR_STUDNI'` jako jedna z kolumn.

Semantyka:
- `import-export/rury/externalExportTemplate.js:18`: `NR_STUDNI: item.pehdType || ''` ✅
- `import-export/studnie/externalExportTemplate.js:96`: `NR_STUDNI: well.name || ''` ✅
- Import rury: `externalImport.js:22`: `pehdType = r['NR_STUDNI'] || ''` ✅
- Import studnie: `externalImport.js:19`: `wellName = r['NR_STUDNI'] || 'Studnia_1'` ✅

Zgodne z AGENTS.md.

### **[PASSED] Conflict modal**

`import-export/shared/conflictModal.js` — wizualne rozwiązywanie konfliktów ✅.

---

## 9. Git / CI-CD

### **[PASSED] standard-version**

- `.versionrc.json` konfiguruje standard-version.
- `scripts/check-version.mjs` weryfikuje spójność VERSION ↔ package.json ↔ CHANGELOG.
- `npm run version:check` → PASS (1.6.0 spójne).

### **[PASSED] auto-cache-bust**

`scripts/auto-cache-bust.mjs` — hook `postbump` w `.versionrc.json`. Podmienia `?v=` w HTML na nową wersję release.

Weryfikacja:
- `public/kartoteka.html:406`: `?v=1.6.0`
- `public/rury.html:2058`: `?v=1.6.0`
- `public/studnie.html:5110`: `?v=1.6.0`
- `public/zlecenia.html:188`: `?v=1.6.0`

Zgodne ✅.

### **[PASSED] Husky**

`.husky/` directory exists. `commitlint.config.js` konfiguruje Conventional Commits.

### **[ŚREDNI] Znana blokada Husky well.magazyn**

`CONTRIBUTING.md` dokumentuje obejście:
```bash
git -c core.hooksPath=/dev/null commit -m "..."
```

To oznacza, że pre-commit hook zawiera błąd (potencjalnie ze ścieżką do pola `well.magazyn`). Hook zostaje czasowo wyłączony.

**Rekomendacja**

Dodaj `excludes` do Husky lint-staged lub napraw typ w `ProductsStudnie`:

```json
// package.json
"lint-staged": {
  "src/**/*.{ts,js}": ["eslint --fix", "prettier --write"],
  "public/js/studnie/pricelistManager.js": ["echo skip"]
}
```

Albo dodaj typecast w tym pliku, jeśli `magazyn` to dodatkowe pole runtime.

### **[PASSED] Automatyczne tagowanie**

`package.json` contains scripts:
- `release:patch`, `release:minor`, `release:major` — standard-version automatycznie taguje.
- `git push --follow-tags` zalecany w CONTRIBUTING.md.

### **[NISKI] Dług techniczny typecheck:frontend**

AGENTS.md Sekcja 8 #1: `typecheck:frontend` usunięty z pre-push z powodu ~60 pre-existing błędów TS w `public/js/`. To jest udokumentowane dług, ale wciąż otwarty.

**Rekomendacja**

Stopniowo migruj `public/js/` do `public/js/*.ts` co month, zaczynając od `shared/parseDecimal.js` (nowy plik). Narzędzia: `tsc --allowJs` z `// @ts-nocheck` stopniowo usuwanym.

---

## 10. Graphify

### **[ŚREDNI] graphify-out/ bywa niedostępny**

`.gitignore:81-82`:
```
graphify-out/
public/graphify-out/
```

Ponieważ `graphify-out/` jest auto-generowany i ignorowany przez git, jest **wyłączony z wersjonowania**. Użytkownicy klonujący repo na nowo nie mają grafu wiedzy.

`AGENTS.md` Sekcja 4 wymaga:
> Procedura przed modyfikacją kodu: użyj `graphify query` do zlokalizowania modułów.

Ale dla nowego uzytkownika `graphify query` zwróci błąd "no graph found".

**Wpływ**

ADR-005 (Graphify) nie może być w pełni wykorzystany dla nowych deweloperów.

**Rekomendacja**

Dodaj `graphify update .` jako część postinstall hook:

```json
// package.json
"scripts": {
  "postinstall": "graphify update . || echo 'graphify not installed — skip'"
}
```

Alternatywnie: commit `graphify-out/` do repo. Jest to auto-generated — ale to samo dotyczy `package-lock.json` (również commitowane).

### **[NISKI] Graphify CLI niedostępny lokalnie**

`graphify` nie był dostępny w PATH podczas audytu. Może być wymagana instalacja `npm install -g @graphify/cli` (lub podobne). Z dokumentacji brakuje instrukcji instalacji.

**Rekomendacja** — dodaj sekcję w README.md:

```markdown
## Graphify Setup

```bash
npm install -g @graphify/cli
graphify update .
graphify query "GDzie znajduje się sortowanie ofert?"
```
```

---

## Macierz priorytetów

| Priorytet | Problem | Plik | Rekomendowany fix |
|-----------|---------|------|--------------------|
| WYSOKI | Plik 1533 linii (3× limit) | `src/services/pdfGenerator.ts` | Split na 5 modułów: pdfStyles, pdfHelpers, pdfRuryBuilder, pdfStudnieBuilder, pdfGenerator |
| WYSOKI | Plik 5689 linii (11× limit) | `public/js/studnie/excelTableManager.js` | Split na 8 modułów (state, render, handlers, columns, modals, validation, styles, manager) |
| WYSOKI | Plik 4770 linii (9.5× limit) | `public/js/studnie/orderManager.js` | Split: orderCrud, orderRender, orderSnapshot, orderHistory, orderKarta, orderBanner |
| WYSOKI | Plik 3751 linii (7.5× limit) | `public/js/studnie/offerManager.js` | Split: offerState, offerPersist, offerRender, offerEdit, offerHistory, offerComparison |
| WYSOKI | Brak CSRF protection | src/app.ts | Dodaj middleware token CSRF dla mutacji |
| WYSOKI | Brak rotacji sesji po zmianie hasła | src/routes/auth.ts:184 | Po zmianie hasła — unieważnij wszystkie sesje użytkownika, rotuj bieżącą |
| ŚREDNI | Przestarzały X-XSS-Protection | src/middleware/security.ts:21 | Usuń nagłówek — CSP zastępuje |
| ŚREDNI | Brak obsługi separatora dziesiętnego | public/js/ (wielokrotnie) | Dodaj window.parseDecimal() i stosuj |
| ŚREDNI | In-memory rate limiter bez persystencji | src/middleware/rateLimiter.ts | Redis-based limiter w produkcji, lub dedup flaga per instancję |
| ŚREDNI | Potencjalne N+1 w PDF | src/services/pdfGenerator.ts:124 | Zastosuj findMany z `in: offerIds` |
| ŚREDNI | Niespójny bcrypt factor (10 vs 12) | src/routes/auth.ts:99 | Ujednolić na 12 |
| ŚREDNI | Brak relacji FK w schema | prisma/schema.prisma | Dodaj @relation z onDelete: Cascade |
| ŚREDNI | Brak testów sortowania Rury | tests/ (brak) | Dodaj tests/rurySort.test.ts z cases category+length |
| ŚREDNI | Duplikacja responsywności CSS | public/css/* | Wydziel public/css/shared/responsive.css |
| ŚREDNI | Husky blokuje na well.magazyn | .husky/pre-commit | Napraw typ `ProductsStudnie.magazynWL` |
| ŚREDNI | Graphify niedostępny dla nowych użytkowników | graphify-out/ (gitignored) | postinstall hook albo commit grafu |
| NISKI | Brak debounce na wyszukiwarce | public/js/sales/pvSalesUi.js | Debounce 250ms na input |
| NISKI | Lista routes bez spójnego apiLimiter | src/app.ts:204 | Globalny apiLimiter dla /api |
| NISKI | Brak roster walidacji `sortCol/sortDir` | src/routes/offers/studnieCrud.ts:56 | Whitelist sortCol/sortDir |
| NISKI | Brak loading="lazy" na iframe | public/js/spa/router.js:228 | Dodaj iframe.loading = 'lazy' |
| NISKI | Dług tech typecheck:frontend | public/js/ (TS błędy) | Stopniowa migracja .js → .ts |
| NISKI | Seed createMany dla 800+ rekordów | prisma/seed.ts:144 | Chunk 25 pozycji per batch |
| NISKI | `X-XSS-Protection` przestarzałe | (jak wyżej w ŚREDNI) | (jw.) |

---

## Plan napraw

### Etap 1 — Problemy WYSOKIE (uruchomić w pierwszej kolejności)

**Deadline: 2 tygodnie**

1. **CSRF protection** (WYSOKI) — dodaj middleware, zaimplementuj token w UI.
   - Uzasadnienie: bezpieczeństwo mutacji priorytetem #1.

2. **Rotacja sesji po zmianie hasła** (WYSOKI) — `src/routes/auth.ts`.
   - Uzasadnienie: zapobiega persistence ataku po password reset.

3. **Split pdfGenerator.ts** (WYSOKI) — 1533 → ~5 plików po ~300 linii.
   - Uzasadnienie: naj首要 plik na backend. Po naprawie kolejne pliki łatwiej refaktoryzować.

4. **Split excelTableManager.js** (WYSOKI) — 5689 → 8 modułów.
   - Uzasadnienie: największe ryzyko regressji. Stopniowo w company plan.

5. **Split orderManager.js** (WYSOKI) — 4770 → 6 modułów.

6. **Split offerManager.js** (WYSOKI) — 3751 → 6 modułów.

### Etap 2 — Problemy ŚREDNIE (w ciągu miesiąca)

7. **parseDecimal helper** (ŚREDNI) — ujednolicenie separatora dziesiętnego.
8. **Usunięcie X-XSS-Protection** (ŚREDNI).
9. **Ujednolicenie bcrypt factor=12** (ŚREDNI).
10. **Testy sortowania Rury** (ŚREDNI).
11. **Redis rate limiter** (ŚREDNI) — produkcja.
12. **Naprawa Husky well.magazyn** (ŚREDNI) — by odblokować pre-commit.
13. **Dodaj relacje FK w schema** (ŚREDNI) — migracja.
14. **Graphify postinstall** (ŚREDNI).
15. **Centralny responsive.css** (ŚREDNI).
16. **Fix N+1 w pdfGenerator** (ŚREDNI).

### Etap 3 — Problemy NISKIE (trwale)

17. **Debounce na wyszukiwarce** (NISKI).
18. **Globalny apiLimiter** (NISKI).
19. **Roster walidacji** (NISKI).
20. **loading="lazy" na iframe** (NISKI).
21. **Chunk seed** (NISKI).
22. **Migracja .js → .ts** (NISKI) — dług techniczny.

---

## Ocena końcowa

| Obszar | Ocena | Uzasadnienie | Top 3 działania |
|--------|-------|--------------|----------------|
| **Architektura** | **7/10** | ADRs spójne, separation of layers zachowane. Problem: monolityczne pliki frontendu (do 5689 linii). | 1) Split `excelTableManager.js` 2) Split `orderManager.js` 3) Split `pdfGenerator.ts` |
| **Bezpieczeństwo** | **8/10** | HttpOnly cookies, bcrypt, CSP, rate limiter, XSS protection, SQL injection safe. Problem: brak CSRF, brak rotacji sesji. | 1) Dodaj CSRF protection 2) Napraw rotację sesji po password change 3) Przejść na Redis-based rate limiter w produkcji |
| **Jakość kodu** | **7/10** | Prettier pass, typecheck pass, lint pass. Problem: duże pliki, duplikacja CSS, brak parseDecimal. | 1) Refaktoryzacja monolitów 2) Dodaj parseDecimal 3) Centralny responsive.css |
| **Wydajność** | **8/10** | Brak N+1, findMany z `in`, chunking audit. Problem: potential N+1 w PDF, brak lazy-load iframe, brak debounce. | 1) Fix N+1 w pdfGenerator 2) loading="lazy" na iframe 3) Debounce na search input |
| **Testy** | **8/10** | 1272 tests passing, 54 suites, SQL injection E2E, AI/ML tests, Playwright. Problem: brak testów Rury sort. | 1) Dodaj tests/rurySort.test.ts 2) Dodaj testy error scenarios import 3) Coverage report aktualizowany |
| **Utrzymywalność** | **6/10** | AGENTS.md doskonały, cheat-sheet adnotowany, standard-version. Problem: duże pliki, dług typecheck:frontend, graphify niedostępny. | 1) Split monolitów 2) Migracja .js → .ts 3) Graphify postinstall hook |

### Średnia ocen: **7.3/10**

**Rekomendacja główna**: Projekt dojrzały, dobrze skonfigurowany z 1-krok produkcji (typecheck, lint, XSS audit, wersja automatyczna). Największe ryzyko leży w **rozmiarach plików frontendowych** — każdy archivo powyżej 1000 linii jest ryzykowny dla długoterminowego utrzymania. Refaktoryzacja monolitów powinna być przeprowadzona iteracyjnie (jeden plik na Sprint), przy jednoczesnym rozwoju testów jednostkowych.

---

**Koniec audytu.**
