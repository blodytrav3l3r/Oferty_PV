# P1.4a — Auth flow audit (research, bez kodu)

Status: audit only. Zero zmian kodu. Bez rekomendacji implementacyjnej (to P1.4b).
Data: 2026-09-16. Zakres: E2 z `docs/plans/2026-09-16-e2-e5-roadmap.md:92-100`.

Powiązane: ADR-006 (`docs/adr/ADR-006-https-transport.md:91-109`, dual-auth jako
świadomy dług), macierz uprawnień (`docs/security/permission-matrix.md`), SECURITY.md.

## 1. Mapa przepływu (sekwencja kroków z plik:linia)

### 1.1 Login

1. `public/js/shared/dashboard.js:200-204` — `POST /api/auth/login` z `{username, password}`,
   BEZ nagłówka auth (słusznie: brak sesji).
2. `src/routes/auth.ts:32-79` — weryfikacja bcrypt (`401` przy złym haśle,
   `src/routes/auth.ts:41`), `createSession(user.id)` (`src/routes/auth.ts:44`).
3. `src/routes/auth.ts:53-59` — serwer stawia cookie `authToken`:
   `httpOnly: true`, `maxAge: SESSION_MAX_AGE_MS` (7 dni, `src/middleware/auth.ts:8`),
   `secure: isCookieSecure(req)` (`req.secure || COOKIE_SECURE === 'true'`,
   `src/routes/auth.ts:29`), `sameSite: 'lax'`, `path: '/'`.
4. `src/routes/auth.ts:60-73` — ODPOWIEDŹ ZAWIERA SUROWY TOKEN w JSON (`token`),
   front zapisuje go do JS-storage: `public/js/shared/dashboard.js:210`
   (`localStorage.setItem('authToken', data.token)`).
5. `public/js/shared/dashboard.js:211` — `sessionStorage.setItem('user', ...)` (dane
   użytkownika, nie token).

### 1.2 Weryfikacja sesji / guardy wejścia

Każdy punkt wejścia robi ten sam schemat: `getAuthToken()` z localStorage → brak
tokenu = redirect `index.html` → `GET /api/auth/me` z `authHeaders()` → brak
`data.user` = redirect `index.html`:

- `public/js/spa/router.js:520-524` (SPA `app.html`: `getAuthToken()`, redirect).
- `public/js/spa/router.js:527-532` (`GET /api/auth/me` z `authHeaders()`, redirect
  gdy brak `authData.user`; catch → redirect `router.js:545-548`).
- `public/js/shared/dashboard.js:60-72` (`index.html`: ten sam schemat + `authTimer`
  1500 ms, `dashboard.js:54-59`).
- `public/js/app.js:103-128` (rury standalone), `public/js/appStudnie.js:15-35`
  (studnie standalone), `public/js/kartoteka/kartotekaInit.js:5-28` (kartoteka),
  `public/js/spa/zlecenia.js:48-52` (zlecenia), `public/js/studnie/pricelistInit.js:7-23`
  (standalone pricelist, tylko gdy NIE orchestrator).

### 1.3 Cookie / session po stronie backendu

- Token: `crypto.randomBytes(32).hex` (`src/middleware/auth.ts:51`); w DB TYLKO hash
  SHA-256 (`hashToken`, `src/middleware/auth.ts:42-44`, zapis `src/middleware/auth.ts:54-60`).
- `requireAuth` (`src/middleware/auth.ts:144-150`): czyta
  `req.headers['x-auth-token'] || req.cookies?.authToken` — **header ma priorytet**.
  Brak sesji → `401 { error }` (`auth.ts:148`); brak usera w DB → `401` (`auth.ts:157`);
  błąd DB → `500` (`auth.ts:165`).
- `requireAdmin` (`src/middleware/auth.ts:172-178`): brak roli admin → `403`.
- Wygaśnięcie: lazy — przy odczycie (`getSession`, `src/middleware/auth.ts:93-96`:
  `createdAt + SESSION_MAX_AGE_MS < Date.now()` → `deleteSession` → `null` → `401`).
- Rotacja: max 10 sesji/user, kasowanie najstarszych (`SESSION_MAX_PER_USER`,
  `src/middleware/auth.ts:11,62-77`).
- Zmiana hasła unieważnia inne sesje (`src/routes/auth.ts:209-211`,
  `deleteUserSessions` z `exceptToken`, `src/middleware/auth.ts:122-139`).

### 1.4 Iframe → SPA

- Router tworzy jeden iframe per moduł, same-origin (`public/js/spa/router.js:343-389`).
- Iframe ładuje `rury.html` / `studnie.html` / `kartoteka.html` / `zlecenia.html`
  jako pełne dokumenty — każdy ma WŁASNY kontekst JS i WŁASNY `localStorage`
  (same-origin = współdzielony `localStorage`, współdzielone cookie).
- Cross-context: parent → iframe TYLKO przez `contentWindow.showSection()` /
  `AppZlecenia.loadOrders()` / `AppKartoteka.loadOffers()` (`router.js:393-409`,
  `router.js:590-614`); iframe → parent przez `window.parent.SpaRouter.openOfferInModule`
  (`router.js:579-585`). Brak przekazywania tokenu między kontekstami — każdy kontekst
  czyta `localStorage` / cookie samodzielnie.
- Redirect do SPA: moduły przy bezpośrednim otwarciu przekierowują do
  `app.html#/<moduł>` (konwencja z AGENTS.md; guardy wejścia jak w §1.2).

### 1.5 API (nagłówki X-Auth-Token vs cookie)

- Definicja: `authHeaders()` w `public/js/shared/auth.js:30-35` — czyta
  `localStorage.authToken`, dokleja `X-Auth-Token`.
- Fallback cookie→header po stronie JS (czyta `document.cookie`, wymaga cookie
  NIE-httpOnly — dziś nieskuteczne, bo cookie JEST httpOnly):
  `public/js/shared/StorageService.js:30-48`, `public/js/shared/shareService.js:7-26`.
- Centralny fetch: `fetchJson()` w `public/js/shared/fetchJson.js:18-37` —
  `credentials: 'same-origin'` (cookie wysyłane) + merge `authHeaders()`; mapuje
  `401 → {error:'unauthorized'}`, `403 → {error:'forbidden'}`.
- Hybrydy (cookie + header): `public/js/studnie/pzGuard.js:30-33`,
  `public/js/studnie/telemetryBridge.js:214-219`,
  `public/js/aiStatusIndicator.js:94,129` (`credentials: 'same-origin'` + header),
  `public/js/import-export/shared/featureFlag.js:6-11`,
  `public/js/import-export/studnie/transferJson.js:16,73,96,104,137,176,187`
  (`credentials: 'include'`), `public/js/import-export/studnie/externalImport.js:74,86`,
  `public/js/import-export/shared/jsonOfferTransfer.js:6` (TYLKO `credentials:
'include'`, bez headera — działa na samym cookie).
- `navigator.sendBeacon('/api/locks/release')` w `public/js/shared/lockService.js:95-98`
  — beacon NIE niesie `X-Auth-Token` (brak możliwości custom headers); auth wyłącznie
  przez cookie (beacon same-origin wysyła cookie). Fallback fetch z `_headers()`
  (`lockService.js:104-109`).

### 1.6 Refresh (token refresh / rotacja)

Brak. Fakty:

- Brak endpointu refresh (`src/routes/auth.ts` ma tylko login/register/logout/me/
  change-password; grep `refresh` w `src/routes/auth.ts` i `src/middleware/auth.ts` —
  trafienia dotyczą wyłącznie heartbeat locków / UI, nie sesji).
- Brak sliding expiration — sesja ma sztywny TTL 7 dni od `createdAt`
  (`src/middleware/auth.ts:8,93-96`); każde użycie NIE przedłuża sesji.
- Jedyna „rotacja": limit 10 sesji/user (`src/middleware/auth.ts:11,62-77`) oraz
  unieważnienie przy zmianie hasła (`src/routes/auth.ts:209-211`).
- Frontend nie ma logiki odświeżania — po wygaśnięciu: `401` → guardy wejścia robią
  redirect `index.html`, a operacje w locie dostają `401` bez globalnego handlera
  (poza `dataService.js:101-104` i `fetchJson` mappingiem).

### 1.7 Logout

Dwie implementacje (niespójne):

- A — `appLogout()` w `public/js/shared/auth.js:41-94`: dirty-guard (popup),
  `POST /api/auth/logout` z `authHeaders()` + `credentials: 'include'`
  (`auth.js:83-87`), potem `localStorage.removeItem('authToken')` (`auth.js:91`),
  próba czyszczenia cookie przez JS (`auth.js:92` — nieskuteczna dla httpOnly,
  czyści co najwyżej cień nie-httpOnly), redirect `index.html` (`auth.js:93`).
- B — `doLogout()` w `public/js/shared/dashboard.js:218-226`: `POST
/api/auth/logout` z SAMYM `authHeaders()` (bez `credentials` — cookie sesji może
  nie dotrzeć, backend kasuje sesję z headera), `localStorage.removeItem`,
  BEZ czyszczenia cookie, BEZ redirectu (przełącza widok `showLogin()`).
- Backend (`src/routes/auth.ts:159-175`): token z headera LUB cookie, `deleteSession`,
  `clearCookie('authToken', {httpOnly, secure, sameSite:'lax', path:'/'})` — poprawne
  czyszczenie httpOnly po stronie serwera.

### 1.8 Multi-tab

Brak mechanizmu. Fakty:

- Brak `storage`-event listenera, brak `BroadcastChannel` dla auth (grep
  `storage.*event|BroadcastChannel` w `public/js/` — trafienia tylko w prototypie
  draftu `docs/plans/e2-draft-review.md:148-150`, nie w kodzie auth).
- Logout w karcie A nie wylogowuje karty B: karta B ma token w swoim `localStorage`
  (współdzielony origin — `removeItem` w A propaguje się do B przez storage, ale B
  tego nie nasłuchuje i nie reaguje); sesja serwerowa skasowana → następny request
  z B dostaje `401`.
- Limit 10 sesji (`src/middleware/auth.ts:11`): N kart × ponowne loginy zużywają
  sloty; najstarsze kasowane po cichu → inna karta dostaje `401` bez wyjaśnienia.

### 1.9 401 / 403 (frontend)

- `401`:
    - Guardy wejścia → redirect `index.html` (§1.2).
    - `public/js/rury/dataService.js:101-104` — `loadOffers`: `401` → redirect `index.html`.
    - `fetchJson` (`public/js/shared/fetchJson.js:29`) — mapuje na
      `{error:'unauthorized'}`; callerzy (AI dashboard: `aiDashboardCore.js:50`,
      `mlHealthDashboard.js:92`) pokazują stan, nie redirect.
    - `updateConnectionDot` (`public/js/shared/auth.js:112`) traktuje `401` z `/health`
      jako „online" (serwer żyje, sesja martwa).
    - Poza tym: brak globalnego interceptora 401 — większość callerów ignoruje status
      (pusty `catch`, fallback `[]`).
- `403`:
    - `fetchJson` → `{error:'forbidden'}` (`fetchJson.js:30`).
    - `StorageService.saveOffer` propaguje `409/423` strukturalnie (`StorageService.js:76-80`);
      403 z ownership/PZ leci jako generyczny błąd (komunikat serwera).
    - Locki: `lockService.js:63-67` (`isDocLocked`: `423`/`DOC_LOCKED`); modal 423
      (`lockService.js:206-273`).

## 2. Miejsca wymagające tokenu JS (X-Auth-Token / getAuthToken / localStorage.authToken)

45 plików w `public/js/` zawiera odwołania `authHeaders() | X-Auth-Token |
getAuthToken` (pomiar `rg -l`, 2026-09-16). Poniżej miejsca FUNKCJONALNIE zależne
od tokenu dostępnego dla JS (nie same definicje typów / testy).

| #   | Plik:linia                                                       | Po co token JS                                                                                                          |
| --- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | `shared/auth.js:14-16,22-24`                                     | Definicja SSoT: odczyt/zapis `localStorage.authToken`                                                                   |
| 2   | `shared/auth.js:30-35`                                           | Definicja SSoT: `authHeaders()` dokleja `X-Auth-Token`                                                                  |
| 3   | `shared/auth.js:85,91-92`                                        | Logout: header + `removeItem` + próba czyszczenia cookie                                                                |
| 4   | `shared/auth.js:520-521` (via router)                            | — (patrz 28)                                                                                                            |
| 5   | `shared/dashboard.js:60,66`                                      | Guard `index.html` + `GET /api/auth/me` z headerem                                                                      |
| 6   | `shared/dashboard.js:80,220,230,441,460,486,578,601`             | `loadRecycledNumbers`, logout, CRUD users/admin, AI — wszystko z headerem                                               |
| 7   | `shared/dashboard.js:210`                                        | Zapis `localStorage.authToken` po loginie (jedyne miejsce zapisu poza testami)                                          |
| 8   | `shared/StorageService.js:30-48,68-73`                           | `getHeaders()` (localStorage→cookie→header) + `saveOffer` POST                                                          |
| 9   | `shared/shareService.js:17-24,29-73`                             | Share API (`/api/users/shareable`, `/api/shares*`) z headerem; fallback cookie→header                                   |
| 10  | `shared/shareModal.js:321`                                       | Otwiera modal (wołania przez `shareService`)                                                                            |
| 11  | `shared/fetchJson.js:22`                                         | Merge `authHeaders()` do każdego requestu                                                                               |
| 12  | `shared/ui.js:202-205`                                           | `fetchGlobalUsers` (`/api/users-for-assignment`) z headerem                                                             |
| 13  | `shared/lockService.js:24-27,48-52,104-109`                      | Locki acquire/heartbeat/release/force z headerem                                                                        |
| 14  | `shared/lockService.js:95-98`                                    | `sendBeacon` release BEZ headera (tylko cookie) — wyjątek                                                               |
| 15  | `shared/printModal.js:238,269,361-373`                           | Lista ofert + export combined (`/api/offers/search`, `/api/offers-combined/export-*`) z headerem; `a.download` lokalnie |
| 16  | `shared/priceDefaults.js:26,45`                                  | Odczyt/zapis defaultów cenników z headerem                                                                              |
| 17  | `shared/clientManager.js:23,43`                                  | CRUD `/api/clients` z headerem                                                                                          |
| 18  | `shared/offerCrudCommon.js:113`                                  | `/api/users-for-assignment` z headerem                                                                                  |
| 19  | `spa/router.js:520,527`                                          | Guard SPA + `GET /api/auth/me` z headerem                                                                               |
| 20  | `spa/zlecenia.js:48,219,385,679,748`                             | Guard + search/CRUD zleceń z headerem                                                                                   |
| 21  | `app.js:28,109`                                                  | `/api/users-for-assignment`, `/api/auth/me` z headerem; guard `app.js:103-105`                                          |
| 22  | `appStudnie.js:15,21`                                            | Guard + `/api/auth/me` z headerem                                                                                       |
| 23  | `kartoteka/kartotekaInit.js:5,12`                                | Guard + `/api/auth/me` z headerem                                                                                       |
| 24  | `kartoteka/kartotekaActions.js:24,136,402,618`                   | CRUD/operacje kartoteki z headerem (w tym `openShareModal`, `kartotekaActions.js:363`)                                  |
| 25  | `kartoteka/kartotekaAudit.js:204,266,381`                        | Audit API z headerem                                                                                                    |
| 26  | `kartoteka/kartotekaSearch.js:119`                               | Search API z headerem                                                                                                   |
| 27  | `kartoteka/kartotekaHelpers.js:554`                              | `openPrintModal` (pośrednio `printModal`)                                                                               |
| 28  | `rury/dataService.js:10,20,32,44,54,100`                         | load/save `/api/products`, load/save offers z headerem; `401`→redirect (`dataService.js:101-104`)                       |
| 29  | `rury/offerCrud.js:410,427-433`                                  | Zapis ofert + `downloadExistingOffer` (JSON lokalnie)                                                                   |
| 30  | `rury/offerPrintManager.js:130,147,182,229,305`                  | Dane do wydruku (PDF/DOCX generowane lokalnie, `a.download`)                                                            |
| 31  | `rury/orderCrud.js:9,23,187`                                     | CRUD `/api/orders-rury` z headerem                                                                                      |
| 32  | `rury/offerExports.js:110`                                       | `window.open('', '_blank')` — print do nowego okna BEZ auth (treść wstrzyknięta lokalnie)                               |
| 33  | `studnie/offerApi.js:67,90`                                      | load/save `/api/offers-studnie` z headerem                                                                              |
| 34  | `studnie/offerHistory.js:100,225,267`                            | Historia ofert z headerem                                                                                               |
| 35  | `studnie/offerFileOps.js:22`                                     | Operacje plikowe ofert (JSON `a.download`, `offerFileOps.js:51`)                                                        |
| 36  | `studnie/offerUserManager.js:10,51,85,119`                       | Przypisywanie opiekunów z headerem                                                                                      |
| 37  | `studnie/offerPrintManager.js:153,444,504,549,667`               | Dane do wydruku z headerem; pliki lokalnie (`link.download`)                                                            |
| 38  | `studnie/orderHelpers.js:9,77,215,254`                           | load/save `/api/orders-studnie` z headerem                                                                              |
| 39  | `studnie/orderCrud.js:162,188,598,708,1165`                      | CRUD zamówień + users-for-assignment z headerem                                                                         |
| 40  | `studnie/orderBulk.js:812,827,849`                               | Bulk orders z headerem                                                                                                  |
| 41  | `studnie/orderExport.js:25-26,56-57`                             | Dane karty budowy z headerem; plik lokalnie                                                                             |
| 42  | `studnie/orderZleceniaData.js:11,239,276,321,394`                | CRUD PZ (`/api/production-orders*`) z headerem                                                                          |
| 43  | `studnie/orderZleceniaModal.js:155`                              | Modal PZ z headerem                                                                                                     |
| 44  | `studnie/uiHelpers.js:518,562,601`                               | Różne fetch'e UI z headerem                                                                                             |
| 45  | `studnie/pricelistInit.js:7,13`                                  | Guard standalone z headerem                                                                                             |
| 46  | `studnie/pricelistSaveReset.js:16,71`                            | Save/reset `/api/products-studnie` z headerem                                                                           |
| 47  | `studnie/pzGuard.js:30-33`                                       | `GET /api/feature-flags` z headerem + cookie                                                                            |
| 48  | `studnie/telemetryBridge.js:214-219`                             | AI telemetry (`/ai/*`) z headerem + cookie                                                                              |
| 49  | `studnie/mlDualRanking.js:92,124,534`                            | AI ranking z headerem                                                                                                   |
| 50  | `studnie/mlRewardHooks.js:140,235`                               | AI reward z headerem                                                                                                    |
| 51  | `aiStatusIndicator.js:94,129`                                    | AI status/knowledge z headerem + cookie                                                                                 |
| 52  | `import-export/shared/featureFlag.js:6-11`                       | Feature flag z headerem + cookie, fallback `getAuthToken`                                                               |
| 53  | `import-export/studnie/transferJson.js:16,73,96,104,137,176,187` | Import/export JSON z `credentials:'include'`                                                                            |
| 54  | `import-export/studnie/externalImport.js:74,86`                  | Import z `credentials:'include'`                                                                                        |
| 55  | `import-export/studnie/externalExportTemplate.js:72`             | Export template `/api/products-studnie` z headerem                                                                      |
| 56  | `import-export/shared/jsonOfferTransfer.js:6`                    | GET oferty TYLKO cookie (`credentials:'include'`, bez headera) — wyjątek                                                |
| 57  | `studnie/globals.js:330`                                         | Komentarz (zależność od `auth.js`, nie wywołanie)                                                                       |

Liczba miejsc funkcjonalnie wymagających tokenu JS: **~50 wywołań w 44 plikach**
(45. plik to `studnie/globals.js:330` — sam komentarz; `types.d.ts:151` — deklaracja
typu). Guardy wejścia (redirect na brak `getAuthToken()`): 7 miejsc — `router.js:520`,
`dashboard.js:60`, `app.js:103`, `appStudnie.js:15`, `kartotekaInit.js:5`,
`zlecenia.js:48`, `pricelistInit.js:7`.

## 3. Cookie — stan faktyczny

- Stawia: wyłącznie backend, `POST /api/auth/login` (`src/routes/auth.ts:53-59`).
- `httpOnly: true` — TAK (`auth.ts:54`). JS NIE czyta wartości (fallbacki
  `StorageService.js:36` / `shareService.js:20` czytające `document.cookie` są
  martwe dla tego cookie — `match` zawsze `null` dla httpOnly).
- `Secure`: warunkowe — `isCookieSecure(req)` = `req.secure || COOKIE_SECURE==='true'`
  (`auth.ts:29,56`). Po HTTP na LAN flaga ZDJĘTA (Chrome przyjmuje); za proxy HTTPS
  wymaga `TRUST_PROXY` + `X-Forwarded-Proto` (ADR-006: `src/app.ts` trust proxy,
  `Caddyfile`). `COOKIE_SECURE=true` wymusza także po HTTP (edge case).
- `SameSite: 'lax'` (`auth.ts:57`) — wysyłane przy nawigacji top-level GET i
  same-origin fetch; blokuje CSRF POST z obcego origina (brak CORS na API).
- Czyści: backend `clearCookie` z tymi samymi opcjami (`auth.ts:163-168`); JS próbuje
  `document.cookie='authToken=; expires=...'` (`auth.js:92`) — nieskuteczne dla httpOnly.
- Kto mógłby jeść wyłącznie cookie: requesty fetch z `credentials: 'same-origin'`
  (same-origin, default `same-origin`? nie — default fetch to `same-origin` TYLKO dla
  `credentials` w trybie... faktycznie default to `same-origin`) lub jawne
  `credentials: 'include'` — dziś jawnie ustawiają je: `auth.js:86,109`,
  `fetchJson.js:21`, `aiStatusIndicator.js:94,129`, `pzGuard.js:30`, `featureFlag.js:6`,
  `transferJson.js`, `externalImport.js`, `jsonOfferTransfer.js:6`. Reszta fetchy
  (StorageService, shareService, lockService, wszystkie CRUD) NIE ustawia
  `credentials` — polegają wyłącznie na headerze `X-Auth-Token`.
- Backend już wspiera czyste cookie: `requireAuth` czyta `req.cookies?.authToken`
  (`src/middleware/auth.ts:145`) — wymaga `cookie-parser` (do weryfikacji) oraz
  `credentials` po stronie fetchy.

## 4. Ryzyka przejścia na httpOnly-first (co pęknie — fakty, nie plan)

1. **Guardy wejścia (7 miejsc, §2):** każde woła `getAuthToken()` PRZED jakimkolwiek
   requestem. Bez tokenu w JS wszystkie przekierują do `index.html` mimo ważnego
   cookie. Lista: `router.js:520`, `dashboard.js:60`, `app.js:103`, `appStudnie.js:15`,
   `kartotekaInit.js:5`, `zlecenia.js:48`, `pricelistInit.js:7`.
2. **~50 wywołań `authHeaders()` (§2):** bez headera requesty bez jawnego
   `credentials` nie wyślą cookie → `401` wszędzie (CRUD ofert/zamówień, cenniki,
   klienci, locki, share, AI/ML, kartoteka, zlecenia).
3. **ShareModal / share linki:** `shareService.js:7-26` buduje header z JS-tokenu;
   same linki udostępnień (`/api/shares`) wymagają authodbiorcy — mechanizm linków
   „bez logowania" nie istnieje w kodzie (weryfikacja: `shareService` zawsze z headerem).
4. **Export:** pliki generowane lokalnie (`a.download`, blob) — `offerPrintManager`
   (rury `130-305`, studnie `153-667`), `orderExport.js`, `offerExports.js:110`
   (`window.open` z lokalną treścią). Pęknie TYLKO pobranie danych do exportu
   (fetch z headerem), nie sam zapis pliku. Import/export JSON (`transferJson.js`,
   `externalImport.js`, `jsonOfferTransfer.js:6`) już używa `credentials:'include'` —
   najmniej wrażliwe.
5. **Multi-tab:** dziś brak sync; po migracji problem NIE znika sam — `401` w karcie B
   po wygaśnięciu/unieważnieniu nadal bez handlera (brak `storage`-listenera, §1.8).
6. **Iframe/SPA:** same-origin — cookie dociera do iframe bez zmian; `sendBeacon`
   (`lockService.js:95-98`) już dziś działa na cookie. Ryzyko: guardy w KAŻDYM
   iframe (app.js/appStudnie/kartotekaInit) patrzą na `localStorage`, nie na cookie.
7. **Testy E2E/Playwright:** ~15 skryptów wstrzykuje `localStorage.setItem('authToken', t)`
   (`tests/playwright/*.cjs`, `scripts/test-app-views.cjs`, `smokeOfferFlow.spec.ts:36`) —
   po usunięciu tokenu z JS cały harness auth w testach pęknie.
8. **Rozjazd logout:** `dashboard.js:218-226` nie wysyła cookie i nie czyści go;
   `auth.js:92` nie wyczyści httpOnly — po migracji jedyne skuteczne czyszczenie to
   serwerowe `clearCookie` (działa już dziś).
9. **Priorytet header-first w `requireAuth`** (`src/middleware/auth.ts:145`): dopóki
   header istnieje, cookie jest redundantne — migracja wymaga odwrócenia priorytetu
   (fakt, nie rekomendacja; por. ADR-006 § „Plan migracji").
10. **Beacon bez auth-headera** (`lockService.js:95-98`): dziś działa TYLKO dzięki cookie
    — dowód, że ścieżka cookie-only jest już częściowo używana na produkcji.

## 5. Pytania otwarte (UNVERIFIED)

- UNVERIFIED-1: Czy `cookie-parser` jest wpięty w `src/app.ts` (czy `req.cookies`
  w `requireAuth`/`logout` faktycznie działa na prod, czy tylko w testach z mockiem)?
- UNVERIFIED-2: Czy `TRUST_PROXY` + `X-Forwarded-Proto` są ustawione na prod, tj. czy
  `req.secure` jest `true` za Caddy i cookie dostaje flagę `Secure`?
- UNVERIFIED-3: Czy fetch BEZ jawnego `credentials` (default `same-origin`) wysyła
  cookie we wszystkich wspieranych przeglądarkach w tym projekcie (Chrome/Edge/FF)?
- UNVERIFIED-4: Zachowanie `SameSite=lax` w iframe SPA po reloadzie z `params.edit /
params.order` (top-level nawigacja vs subresource) — czy cookie dociera przy
  każdym `navigate()` z `router.js:411-516`?
- UNVERIFIED-5: Czy sesje serwerowe (`sessions` w SQLite) mają indeks na `userId`
  (rotacja `findMany`, `auth.ts:63-67`) — istotne przy limicie 10/kasowaniu?
- UNVERIFIED-6: Czy `SESSION_MAX_AGE_MS` 7 dni jest zamierzone dla E2, czy też P1.4
  ma je skrócić (akceptacja mówi o „krótkim TTL + rotacji" — decyzja w P1.4b)?
- UNVERIFIED-7: Czy `sessionStorage.user` (`dashboard.js:211,145`, `app.js:121`,
  `appStudnie.js:28`, `kartotekaInit.js:20`) jest używany do decyzji autoryzacyjnych
  (nie tylko wyświetlania) — grep `sessionStorage.getItem('user')` callerzy?
- UNVERIFIED-8: Czy share-linki mają istnieć jako „publiczne bez logowania"
  (brak kodu) — czy odbiorca zawsze musi być zalogowany?
- UNVERIFIED-9: Skąd bierze się `document.cookie.match(authToken)` fallback
  (`StorageService.js:36`, `shareService.js:20`) — czy istniało kiedyś cookie
  nie-httpOnly, czy to martwy kod od początku?
- UNVERIFIED-10: Czy `POST /api/auth/logout` bez `credentials` (`dashboard.js:220`)
  faktycznie kasuje sesję serwerową po cookie, czy tylko po headerze?
