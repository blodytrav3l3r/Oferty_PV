# Plan Naprawy i Poprawy — WITROS Oferty PV

**Data:** 2026-07-12  
**Wersja projektu:** 1.6.0  
**Bazuje na:** `AUDYT-Kompleksowy-2026-07-12.md`  
**Cel:** minimalizacja ryzyka regresji + szybkie podniesienie bezpieczeństwa i jakości kodu

---

## Globalne zasady wykonania

Poniższe reguły obowiązują dla **każdego zadania** w planie. Są bezwzględne — AI i deweloperzy muszą je stosować bez wyjątków.

### Zasada 0 — Backup i czystość repo

Przed rozpoczęciem KAŻDEJ zmiany:

```bash
git status                    # sprawdź czy repo czyste
git branch                    # sprawdź na którym branchu
git stash list                # sprawdź czy nie ma schowanych zmian
```

Jeśli repo nie jest czyste → zatrzymaj się, zgłoś, nie kontynuuj.

### Zasada 1 — Analiza wpływu (Impact Assessment)

Przed każdą modyfikacją pliku wykonaj:

```
[ ] wyszukaj wszystkie importy pliku
[ ] wyszukaj eksporty (co moduł udostępnia)
[ ] wyszukaj miejsca użycia (kto importuje ten plik)
[ ] wyszukaj testy jednostkowe związane z plikiem
[ ] wyszukaj testy e2e / integracyjne
[ ] wyszukaj snapshoty / mocki
[ ] wyszukaj dokumentację (README, ADR, komentarze)
[ ] zidentyfikuj endpointy API zależne od pliku
[ ] zidentyfikuj zależności (importy wewnątrz pliku)
```

Dopiero po pełnej analizie → zmiana.

### Zasada 2 — Minimalny zakres zmian

Wprowadzaj **wyłącznie** zakres wymagany do realizacji bieżącego zadania. Nie wykonuj dodatkowych refaktoryzacji, optymalizacji ani napraw kosmetycznych. Każda linia zmieniona bez potrzeby zwiększa ryzyko regresji.

### Zasada 3 — Checkpoint po każdej zmianie

Po KAŻDEJ modyfikacji (przed przejściem dalej):

```bash
npm run typecheck       # musi przejść
npm run lint            # musi przejść
npm run test:quick      # wszystkie testy muszą przejść
npm run format:check    # musi przejść
node -c public/js/<file>   # dla plików JS frontend
```

Jeśli którakolwiek kontrola FAIL → **zatrzymaj się**, przeanalizuj przyczynę, napraw, dopiero potem kontynuuj.

**Nigdy** nie wykonuj wielu PR na raz. PR1 → checkpoint → PR2 → checkpoint → ...

### Zasada 4 — Blokada przechodzenia dalej

Nie można rozpocząć kolejnego zadania jeśli:

```
build FAIL
LUB
test FAIL
LUB
typecheck FAIL
LUB
lint FAIL
```

Dopiero gdy wszystko ZIELONE → przejdź dalej.

### Zasada 5 — Rollback Plan

Każde zadanie musi mieć sekcję wycofania:

```
ROLLBACK (jeśli testy nie przechodzą):
1. git checkout HEAD -- <zmodyfikowane_pliki>
2. uruchom npm run validate
3. opisz przyczynę błędu
4. nie przechodź dalej
```

### Zasada 6 — Definition of Done

Zadanie uznaje się za wykonane gdy:

```
✓ build OK
✓ lint OK (0 błędów, 0 warningów)
✓ typecheck OK
✓ npm run validate OK
✓ wszystkie testy OK (1272+)
✓ brak nowych warningów ESLint
✓ brak TODO / FIXME / HACK
✓ brak console.log (za wyjątkiem loggera)
✓ brak @ts-ignore / @ts-expect-error (chyba że uzasadnione)
✓ brak any (chyba że uzasadnione)
✓ brak zakomentowanego kodu
✓ API bez zmian (backward compatible)
✓ node -c OK dla plików JS frontend
```

### Zasada 7 — Raport po każdym zadaniu

Po zakończeniu zadania przygotuj raport:

```markdown
## Raport zadania: <nazwa>

- **Zmodyfikowane pliki:** ...
- **Zakres zmian:** ...
- **API backward compatible:** tak/nie
- **Wyniki kontroli:** typecheck ✅ lint ✅ testy ✅ (X/Y)
- **Potencjalne skutki uboczne:** ...
- **Ocena ryzyka regresji:** niskie/średnie/wysokie
- **Rollback:** git checkout HEAD -- <files>
- **Status:** GOTOWY / BLOKADA (powód: ...)
```

---

## Etap 0 — Analiza wstępna (przed wszystkimi zmianami)

**Cel:** zbudowanie pełnej mapy zależności projektu przed rozpoczęciem jakichkolwiek modyfikacji.

**Czynności:**

1. Przeczytaj strukturę katalogów (`src/`, `public/js/`, `tests/`).
2. Znajdź wszystkie cross-importy między modułami (grep `import.*from` w `src/` i `public/js/`).
3. Znajdź dead code (grep dla `export`/`window.` bez `import`/użycia).
4. Znajdź duplikacje (funkcje o podobnej nazwie/logice — np. `fmt`, `escapeHtml`, `formatPrice`).
5. Uruchom wszystkie testy i zapisz wynik:

```bash
npm run validate       # typecheck + lint + testy
npm run test:quick     # liczba = 1272
npm run audit:xss      # Score = 100/100
```

6. Zapisz stan początkowy (commity, zależności) do pliku `docs/audit/STAN-POCZATKOWY.md`.

**Dopiero potem** rozpocznij Etap 1.

---

## Etap 1 — Bezpieczeństwo (Tydzień 1–2)

**Cel:** usunięcie realnych zagrożeń bezpieczeństwa, bez ingerencji w architekturę.

### Zadanie 1.1 — Dodać ochronę CSRF 🔴 WYSOKI

**Problem:** Brak CSRF protection — atakujący może wywołać mutację (np. POST `/api/auth/change-password`) w imieniu zalogowanego użytkownika, jeśli użytkownik odwiedzi złośliwą stronę.

**Podejście:** Double-submit cookie pattern (bezstanowy, bez Redis).

**Impact Analysis:**
- Importy nowego pliku: `src/middleware/csrf.ts` → zaimportowany w `src/app.ts`
- Endpointy chronione: wszystkie `POST/PUT/DELETE` pod `/api/*`
- Testy: `tests/csrf.test.ts` (nowy)
- Frontend: wszystkie `fetch` z `method !== 'GET'` wymagają `withCsrf()`

**Pliki:**

**`src/middleware/csrf.ts`** (nowy):
```typescript
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function setCsrfCookie(_req: Request, res: Response, next: NextFunction): void {
    if (!_req.cookies?.[CSRF_COOKIE_NAME]) {
        const token = crypto.randomBytes(32).toString('hex');
        res.cookie(CSRF_COOKIE_NAME, token, {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/'
        });
    }
    next();
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
    if (SAFE_METHODS.has(req.method)) return next();
    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
    const headerToken = req.headers[CSRF_HEADER_NAME] as string | undefined;
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
        res.status(403).json({ error: 'Invalid CSRF token' });
        return;
    }
    next();
}
```

**`src/app.ts`** — insert po `cookieParser()`:
```typescript
import { setCsrfCookie, csrfProtection } from './middleware/csrf';
app.use('/api', setCsrfCookie);
app.use('/api', csrfProtection);
```

**`public/js/shared/csrf.js`** (nowy):
```javascript
function getCsrfToken() {
    const match = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]+)/);
    return match ? match[1] : '';
}
function withCsrf(fetchOptions = {}) {
    return {
        ...fetchOptions,
        headers: {
            ...(fetchOptions.headers || {}),
            'x-csrf-token': getCsrfToken()
        }
    };
}
window.getCsrfToken = getCsrfToken;
window.withCsrf = withCsrf;
```

**Testy:** `tests/csrf.test.ts` (nowy) — 3 case'y: bez tokena → 403, z tokenem → OK, GET bez → 200.

**Rollback:**
```bash
git checkout HEAD -- src/middleware/csrf.ts public/js/shared/csrf.js src/app.ts tests/csrf.test.ts
```

**Definition of Done:** typecheck ✅ lint ✅ testy ≥1275 ✅ node -c csrf.js ✅

---

### Zadanie 1.2 — Rotacja sesji po zmianie hasła 🔴 WYSOKI

**Problem:** Po `POST /api/auth/change-password` stare sesje użytkownika pozostają aktywne przez 7 dni.

**Plik:** `src/routes/auth.ts:184`

**Impact Analysis:**
- Modyfikacja: `src/routes/auth.ts` (handler change-password)
- Zależne: `src/middleware/auth.ts` (rotateSession, COOKIE_OPTIONS)
- Testy: `tests/auth.test.ts` (dodać case)
- API bez zmian: response nadal `{ ok: true }`

**Poprawka:**
```typescript
const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
await prisma.users.update({
    where: { id: authReq.user!.id },
    data: { password: hash }
});

// Unieważnij wszystkie sesje użytkownika (poza bieżącą)
const currentToken = req.cookies?.authToken;
await prisma.sessions.updateMany({
    where: { userId: authReq.user!.id, token: { not: currentToken }, revokedAt: null },
    data: { revokedAt: Date.now() }
});

// Rotuj bieżącą sesję
const newToken = await rotateSession(currentToken, authReq.user!.id, req);
res.cookie('authToken', newToken, COOKIE_OPTIONS);
res.json({ ok: true });
```

**Rollback:**
```bash
git checkout HEAD -- src/routes/auth.ts
```

---

### Zadanie 1.3 — Ujednolicenie bcrypt do 12 rund 🟠 ŚREDNI

**Plik:** `src/routes/auth.ts:99,184`

```typescript
const BCRYPT_ROUNDS = 12;
// zastąp wszystkie bcrypt.hash(x, 10) → bcrypt.hash(x, BCRYPT_ROUNDS)
```

**Checkpoint:** typecheck ✅ lint ✅ testy auth ✅

---

### Zadanie 1.4 — Usunięcie `X-XSS-Protection` 🟢 NISKI

**Plik:** `src/middleware/security.ts:21`

Usuń linię `res.setHeader('X-XSS-Protection', '1; mode=block');`.

**Checkpoint:** typecheck ✅ testy security ✅

---

### Zadanie 1.5 — Weryfikacja CSP w produkcji 🟠 ŚREDNI

**Plik:** `src/startup/index.ts`

```typescript
if (process.env.NODE_ENV === 'production' && (process.env.CSP_MODE || 'report-only') !== 'enforce') {
    startupLogger.warn('CSP nie jest w trybie enforce w produkcji!');
}
```

**Checkpoint:** typecheck ✅

---

### Podsumowanie Etapu 1

| Zadanie | Priorytet | Czas | PR |
|---------|-----------|------|-----|
| 1.1 CSRF | 🔴 WYSOKI | 2-3 dni | #1 |
| 1.2 Rotacja sesji | 🔴 WYSOKI | 1 dzień | #2 |
| 1.3 bcrypt 12 | 🟠 ŚREDNI | 1h | #3 |
| 1.4 X-XSS-Pol | 🟢 NISKI | 30 min | #3 |
| 1.5 CSP enforce | 🟠 ŚREDNI | 1h | #3 |

**Rezultat:** bezpieczeństwo aplikacji wzrasta bez dużej ingerencji w architekturę.

---

## Etap 2 — Stabilność i poprawność (Tydzień 3)

**Cel:** eliminacja potencjalnych błędów użytkowników.

### Zadanie 2.1 — Stworzyć `parseDecimal` 🟠 ŚREDNI

**Plik nowy:** `public/js/shared/parseDecimal.js`
```javascript
function parseDecimal(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (value == null) return 0;
    const normalized = String(value).trim().replace(',', '.').replace(/[^0-9.\-]/g, '');
    const result = parseFloat(normalized);
    return Number.isFinite(result) ? result : 0;
}
window.parseDecimal = parseDecimal;
```

**Migracja:** `rg "parseFloat\(" public/js/` → zastąp `parseDecimal(...)` w miejscach inputu użytkownika.

**Test:** `tests/parseDecimal.test.ts` (10 case'ów).

**Checkpoint:** node -c parseDecimal.js ✅ testy ✅

---

### Zadanie 2.2 — Testy sortowania Rury 🟠 ŚREDNI

**Plik nowy:** `tests/rurySort.test.ts` (4 testy: category order, diameter asc, bosy+length, no mutation).

**Checkpoint:** `npm run test:quick -- rurySort` ✅

---

### Zadanie 2.3 — Fix N+1 w pdfGenerator 🟠 ŚREDNI

**Plik:** `src/services/pdfGenerator.ts:124`

Weryfikacja czy metoda `buildPdfsForOffers` jest wywoływana w pętli. Jeśli tak → `findMany({ where: { offerId: { in: ids } } })`.

**Checkpoint:** typecheck ✅

---

## Etap 3 — Refaktoryzacja backendu (Tydzień 4–6)

**Zasada:** każdy podzielony plik = osobny PR, z checkpointem po każdym.

### Zadanie 3.1 — Podział `pdfGenerator.ts` (1533 → 5 plików)

| Krok | Plik docelowy | Zakres | PR |
|------|--------------|--------|-----|
| 3.1.1 | `src/services/pdf/pdfStyles.ts` | Stałe stylów | #8 |
| 3.1.2 | `src/services/pdf/pdfHelpers.ts` | Formatery | #9 |
| 3.1.3 | `src/services/pdf/pdfRuryBuilder.ts` | Budowa PDF rury | #10 |
| 3.1.4 | `src/services/pdf/pdfStudnieBuilder.ts` | Budowa PDF studnie | #11 |
| 3.1.5 | `src/services/pdf/pdfGenerator.ts` | Public API (<100 linii) | #12 |

### Zadanie 3.2 — Podział `offerSchemas.ts` (592 → 3 pliki)

```typescript
src/validators/
├── common.ts
├── rury.ts
├── studnie.ts
└── index.ts  // barrel re-export
```

### Zadanie 3.3 — Podział `ruryOrders.ts` + `studnieOrders.ts`

```
src/routes/orders/rury/
├── create.ts
├── update.ts
├── delete.ts
├── history.ts
├── print.ts
└── index.ts
```

---

## Etap 4 — Frontend refaktoryzacja (Tydzień 7–14)

**Zasady dla frontendu:**
1. Najpierw testy ekstrakcji — jeśli nie ma, napisz przed refaktoryzacją.
2. Wydzielenie w obecnym pliku najpierw — potem przenieś.
3. Jeden split = jeden PR, z checkpointem `node -c` + testy UI.
4. Każda zmiana frontendu → 24h obserwacji produkcji przed kolejnym PR.

### Zadanie 4.1 — Split `excelTableManager.js` (5689 → 8 plików)

| Sprint | Plik | Linii | PR |
|--------|------|-------|-----|
| 7.1 | `excel/excelStyles.js` | ~200 | #16 |
| 7.2 | `excel/excelState.js` | ~400 | #17 |
| 8.1 | `excel/excelColumns.js` | ~600 | #18 |
| 8.2 | `excel/excelRenderer.js` | ~1500 | #19 |
| 9.1 | `excel/excelHandlers.js` | ~1000 | #20 |
| 9.2 | `excel/excelModals.js` | ~1000 | #21 |
| 10.1 | `excel/excelValidation.js` | ~500 | #22 |
| 10.2 | `excel/excelTableManager.js` | <200 | #22 |

### Zadanie 4.2 — Split `orderManager.js` (4770 → 7 plików)

```
public/js/studnie/order/
├── orderCrud.js       <300
├── orderRender.js     <800
├── orderSnapshot.js   <500
├── orderHistory.js    <400
├── orderKarta.js      <600
├── orderBanner.js     <200
└── orderManager.js    <100 (barrel)
```

### Zadanie 4.3 — Split `offerManager.js` (3751 → 7 plików)

```
public/js/studnie/offer/
├── offerState.js      <300
├── offerPersist.js    <400
├── offerRender.js     <900
├── offerEdit.js       <500
├── offerHistory.js    <300
├── offerComparison.js <200
└── offerManager.js    <100 (barrel)
```

---

## Etap 5 — Infrastruktura (Tydzień 15–16)

### Zadanie 5.1 — Husky pre-commit naprawa 🟠 ŚREDNI

**Diagnoza:** `npx lint-staged` → znajdź błąd `well.magazyn` → popraw na `well.magazynWL ?? false`.

**Checkpoint:** `git commit -m "fix: husky pre-commit validation"` przechodzi bez `--no-verify`.

### Zadanie 5.2 — Graphify postinstall 🟠 ŚREDNI

**Plik:** `package.json`
```json
{
    "scripts": {
        "postinstall": "graphify update . 2>nul || echo 'graphify not installed — skip'",
        "graphify:update": "graphify update .",
        "graphify:query": "graphify query"
    }
}
```

### Zadanie 5.3 — Redis rate limiter (opcjonalnie) 🟠 ŚREDNI

Tylko jeśli wieloinstancyjne wdrożenie. Fallback: obecny in-memory.

### Zadanie 5.4 — Walidacja `sortCol/sortDir` 🟢 NISKI

**Plik:** `src/routes/offers/studnieCrud.ts:56`
```typescript
const ALLOWED_SORT_COLS = new Set(['createdAt', 'offer_number', 'state', 'updatedAt']);
const ALLOWED_SORT_DIRS = new Set(['ASC', 'DESC']);
```

---

## Etap 6 — Dług techniczny (Tydzień 17+)

| Zadanie | Priorytet | Czas |
|---------|-----------|------|
| 6.1 Debounce na wyszukiwarce | 🟢 NISKI | 1h |
| 6.2 loading="lazy" na iframe | 🟢 NISKI | 1h |
| 6.3 Centralny responsive.css | 🟢 NISKI | 1 dzień |
| 6.4 Chunkowanie seed | 🟢 NISKI | 1h |
| 6.5 Migracja JS→TS | 🟢 NISKI | ciągły |
| 6.6 Globalny apiLimiter | 🟢 NISKI | 2h |

---

## Quality Gates w CI

**Skrypt** `scripts/check-file-size.mjs`:
```javascript
import { globSync } from 'glob';
import { readFileSync } from 'fs';

const MAX_LINES = 500;
const IGNORE = ['node_modules', 'dist', 'generated', 'coverage', 'graphify-out',
                'public/js/shared/xlsx.full.min.js', 'public/js/shared/jspdf'];
const EXEMPT = new Set([]);

const files = [
    ...globSync('src/**/*.ts'),
    ...globSync('public/js/**/*.js')
].filter(f => !IGNORE.some(p => f.includes(p)));

let failed = false;
for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    const lines = content.split('\n').length;
    if (lines > MAX_LINES) {
        console.error(`FAIL: ${file} (${lines} linii > ${MAX_LINES})`);
        failed = true;
    }
}
if (failed) process.exit(1);
console.log('OK: all files within 500-line limit');
```

Dodaj do `.husky/pre-commit`:
```bash
npm run lint:file-size
```

---

## Harmonogram łączny

| Tydzień | Etap | Zakres | PR# |
|---------|------|--------|-----|
| **0** | 0 | Analiza wstępna, stan początkowy | — |
| **1** | 1.1 | CSRF protection | #1 |
| **1** | 1.2 | Rotacja sesji | #2 |
| **2** | 1.3-1.5 | bcrypt 12, X-XSS-Pol, CSP warn | #3 |
| **3** | 2.1 | parseDecimal + migracja | #4-5 |
| **3** | 2.2-2.3 | Testy sortowania + fix N+1 | #6-7 |
| **4** | 3.1.1-3.1.2 | pdfStyles + pdfHelpers | #8-9 |
| **5** | 3.1.3-3.1.5 | pdfBuildery + final | #10-12 |
| **5** | 3.2 | offerSchemas split | #13 |
| **6** | 3.3 | orders split | #14-15 |
| **7** | 4.1.1-4.1.2 | excelStyles + excelState | #16-17 |
| **8** | 4.1.3-4.1.4 | excelColumns + excelRenderer | #18-19 |
| **9** | 4.1.5-4.1.6 | excelHandlers + excelModals | #20-21 |
| **10** | 4.1.7 | excelValidation + final | #22 |
| **11-12** | 4.2 | orderManager split (6 plików) | #23-28 |
| **13-14** | 4.3 | offerManager split (6 plików) | #29-34 |
| **15** | 5.1-5.2 | Husky fix + Graphify | #35-36 |
| **16** | 5.3-5.4 | Redis limiter + sortCol | #37-38 |
| **17+** | 6.x | Dług techniczny | ciągły |

**Suma:** ~38 PR-ów w ~17 tygodni (~4 miesiące)

---

## Prompt wdrożeniowy dla AI

Poniższy prompt należy umieścić w instrukcji systemowej AI wykonującego plan:

> **Jesteś doświadczonym architektem oprogramowania oraz seniorem TypeScript/JavaScript. Twoim celem jest wykonanie planu naprawy krok po kroku z maksymalną ostrożnością i minimalnym ryzykiem regresji.**
>
> Dla każdego zadania wykonuj zawsze następujący proces:
>
> 1. **Przeczytaj** dokładnie opis zadania. Nie wykonuj zmian dopóki nie rozumiesz celu.
> 2. **Przeanalizuj zależności** — importy, eksporty, miejsca użycia, testy, konfigurację, endpointy, mocki, snapshoty.
> 3. **Opisz plan wykonania** przed zmianami, wskaż potencjalne ryzyka.
> 4. **Wprowadź minimalny zakres zmian.** Nie wykonuj dodatkowych refaktoryzacji.
> 5. **Samokontrola** — zgodność z zadaniem, API bez zmian, brak martwego kodu.
> 6. **Uruchom kontrole:** `typecheck` → `lint` → `test:quick` → `node -c` (dla JS frontend). Jeśli FAIL → zatrzymaj się, napraw, nie przechodź dalej.
> 7. **Raport końcowy:** zmodyfikowane pliki, skutki uboczne, wyniki kontroli, ryzyko regresji, rekomendacja przejścia dalej.
>
> **Nigdy nie pomijaj** etapów analizy, weryfikacji i testów. W razie wątpliwości zatrzymaj się i zgłoś problem. Priorytet: poprawność, bezpieczeństwo, stabilność (nie szybkość).

---

## Metryki sukcesu

| Metryka | Przed | Po (cel) |
|---------|-------|----------|
| Security Score (CSRF, sesje, bcrypt) | ⚠️ 8/10 | ✅ 9.5/10 |
| Max plik backend | 1533 linii | ≤500 |
| Max plik frontend | 5689 linii | ≤500 (docelowo) |
| Test count | 1272 | >1400 |
| `lint:file-size` gate | ❌ brak | ✅ aktywne |
| XSS Audit Score | 100/100 | 100/100 |
| `npm run validate` | ✅ | ✅ |
| Husky pre-commit | omijany przez `core.hooksPath` | ✅ obowiązkowy |

---

## Rekomendacje końcowe

1. **Bezpieczeństwo > Wszystko** — Etap 1 ma absolutny priorytet.
2. **Małe PR-y** — każdy krok to osobny PR, checkpoint obowiązkowy.
3. **Backend przed frontendem** — backend łatwiej testować, mniejsze ryzyko.
4. **Obserwacja produkcji** — frontend 24h przed kolejnym PR.
5. **Quality gates** — `typecheck+lint+testy` jako blokada przejścia.
6. **Rollback zawsze gotowy** — `git checkout HEAD -- <files>`.
7. **AI prompt osadzony** — każdy agent ma te same rygorystyczne reguły.

---

**Koniec planu naprawy i poprawy.**
