# Follow-up: usunięcie shim `authHeaders` (tokenless, tylko Content-Type)

**Status:** plan — NIE realizować bez spełnienia kryteriów startu z §4.
**Kontekst:** `public/js/shared/auth.js:43-45` definiuje `authHeaders()` jako
tokenless shim (zwraca wyłącznie `{ 'Content-Type': 'application/json' }`).
Sesję niesie cookie `authToken` (httpOnly, SameSite=lax) + `credentials`.
Model autoryzacji DZIAŁA — ten task dotyczy wyłącznie nazwy i martwego
plumbingu, nie mechanizmu sesji.

## 1. Zakres (audyt 2026-09-16, Agent AUTH)

- **158 wystąpień** `authHeaders` (rg): **130 w `public/js`** (39 plików),
  **27 w `tests`** (15 plików), **1 w `scripts`** (`benchmark-autoselect.mjs:138`).
- Top pliki prod: `studnie/offerPrintManager.js` (8), `kartoteka/kartotekaActions.js` (8),
  `rury/dataService.js` (7), `rury/offerPrintManager.js` (6), `kartoteka/kartotekaAudit.js` (6),
  `studnie/orderCrud.js` (5), `studnie/orderZleceniaData.js` (5), `studnie/offerUserManager.js` (4).
- Skan tokenu w JS prod: **zero wycieku**. `setItem('authToken')` nie występuje nigdzie;
  `getItem('authToken')` tylko `public/index.html:75` (legacy flicker-guard, martwy po migracji);
  `removeItem('authToken')` tylko sprzątanie migracyjne (`shared/auth.js:32,107`,
  `shared/dashboard.js:234`); `X-Auth-Token` w prod tylko strip w `shared/fetchJson.js:38-39`
  oraz martwy fallback `import-export/shared/featureFlag.js:9-12`
  (`getAuthToken()` zawsze `null`, gałąź `if (t)` nigdy nie wchodzi).
  `X-Auth-Token` w `scripts/*.mjs` (benchmark, load-100) i mocki w testach — poza prod.
- Wrappery: `fetchJson` merguje shim + odcina `X-Auth-Token` + wymusza `credentials`
  (`shared/fetchJson.js:18-40`); `fetchWithTimeout` wymusza `credentials`, NIE merguje
  (`shared/ui.js:183-198`); `StorageService.getHeaders()` i `shareService.getHeaders()`
  to niezależne źródła Content-Type (nie używają shim). Brak jednego punktu headers.

## 2. Plan migracji (§2.3)

1. Wprowadzić SSoT `jsonHeaders()` (lub stała) w jednym module; `fetchJson`,
   `fetchWithTimeout`, `StorageService`, `shareService` używają go wewnętrznie.
2. Mechanicznie zamienić ~130 call sites `authHeaders()` → SSoT / usunąć jawne
   `headers` tam, gdzie wrapper dokłada je sam (moduł po module, z testami po każdym).
3. Usunąć `authHeaders`/`getAuthToken`/`setAuthToken` z `shared/auth.js`,
   deklarację z `public/js/types.d.ts:151` oraz merge/strip w `fetchJson.js:29-40`.
4. Przepisać testy: `telemetryAuthHeaders.test.ts` (asercja nazwy w 9 plikach),
   `loadStudnieProductsAuth.test.ts` (mock z tokenem), `authCookieHttpOnly.test.ts:92`
   (asercja kształtu shim); usunąć stub `authHeaders: () => ({})` z ~12 testów vm.
5. Posprzątać resztki: `index.html:75` (`getItem`), `featureFlag.js:9-12` (martwy fallback),
   `removeItem('authToken')` po potwierdzeniu braku legacy tokenów na produkcji.

## 3. Ryzyko

- Skala (~40 plików prod) wyklucza atomowy commit bez regresji; migracja modułami.
- Test statyczny `telemetryAuthHeaders.test.ts:75-92` celowo blokuje ciche usunięcie
  nazwy — jego przepisanie musi iść w parze z krokiem 2, inaczej fałszywa czerwień.
- `fetchWithTimeout` nie merguje headers — usunięcie jawnych `headers` przy call sites
  na tej ścieżce wymaga dopięcia SSoT w wrapperze NAJPIERW (kolejność: krok 1 → 2).
- Zakaz ruszania modelu sesji (cookie/credentials/logout) — tylko plumbing nagłówków.

## 4. Kryteria startu

- Zielony `npm run validate` na `main` w dniu startu.
- Decyzja o docelowym SSoT (nazwa/lokalizacja) zatwierdzona z maintainerem.
- Okno bez równoległych zmian w `public/js/{rury,studnie,kartoteka,shared}/` (unika konfliktów).

## 5. Weryfikacja po migracji

`rg "authHeaders" public/js tests scripts` → 0 trafień;
`rg "X-Auth-Token" public/js` → 0 trafień (poza ewentualnym komentarzem historycznym);
`npm run validate` + `npm run test:frontend` zielone.
