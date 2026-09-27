# P1.4b — Protokół decyzji auth (httpOnly-first)

Status: decyzja wiążąca. Zero zmian kodu w tym kroku.
Data: 2026-09-16. Podstawa: `docs/plans/e2-auth-audit.md` (P1.4a) + weryfikacja kodu 2026-09-16.
Zakres: E2 z `docs/plans/2026-09-16-e2-e5-roadmap.md:92-100`.

Powiązane: ADR-006 (dual-auth jako świadomy dług), `docs/security/permission-matrix.md`, `SECURITY.md`.

## 1. Decyzja: wariant A — pełne httpOnly-first

Wybrano **wariant A: pełne httpOnly-first**. Warianty B (hybryda) i C (odstępstwo) odrzucono.

### Co oznacza wariant A (normatywnie)

1. Serwer stawia `authToken` jako `httpOnly`, `SameSite=lax`, `Secure` warunkowe — bez zmian
   (`src/routes/auth.ts:53-59`, `src/middleware/auth.ts:8`).
2. Odpowiedź `POST /api/auth/login` **przestaje zwracać surowy token w JSON**
   (usunięcie `token` z `src/routes/auth.ts:60-73`; zostaje tylko `user`).
3. Frontend **nie zapisuje i nie odczytuje tokenu**: usunięcie `localStorage.setItem('authToken')`
   (`public/js/shared/dashboard.js:210`), całego `getAuthToken`/`setAuthToken`/`authHeaders`
   (`public/js/shared/auth.js:14-35`) oraz martwych fallbacków czytających `document.cookie`
   (`public/js/shared/StorageService.js:30-48`, `public/js/shared/shareService.js:7-26`).
4. Każdy `fetch` do API wysyła cookie: centralnie `credentials: 'same-origin'` (już jest
   w `public/js/shared/fetchJson.js:21`) + jawne `credentials` w każdym miejscu, które dziś
   polega wyłącznie na headerze (lista w §2).
5. Guardy wejścia nie czytają `localStorage`; jedynym testem sesji jest `GET /api/auth/me`
   na cookie (lista w §2).
6. Backend odwraca priorytet odczytu na cookie-first:
   `req.cookies?.authToken || req.headers['x-auth-token']` w `src/middleware/auth.ts:145`,
   `src/routes/auth.ts:161`, `src/routes/auth.ts:210`; nagłówek `X-Auth-Token` zostaje
   wyłącznie jako tymczasowy shim wstecznej kompatybilności usuwany w tym samym kroku
   po migracji call sites (nie jako drugi mechanizm docelowy).
7. Logout jest jeden: `appLogout` (`public/js/shared/auth.js:41-94`) z `credentials: 'include'`;
   `doLogout` (`public/js/shared/dashboard.js:218-226`) zostaje usunięty lub staje się
   cienkim wrapperem nad `appLogout`. Czyszczenie cookie wyłącznie serwerowe
   (`clearCookie`, `src/routes/auth.ts:163-168`); linia `document.cookie = ...`
   (`auth.js:92`) zostaje usunięta jako nieskuteczna dla httpOnly.

### Uzasadnienie (twarde)

1. **Zysk XSS jest realny, ryzyko iframe jest pozorne.** Historia projektu to powtarzalne
   błędy XSS przy `innerHTML` (baza #3, #24, #39); CSP celowo dopuszcza `unsafe-inline`
   (`src/app.ts`, baza #13), więc skradziony token z `localStorage` jest w zasięgu każdego
   wstrzykniętego skryptu. Cookie jest już `httpOnly` i już niesie beacon
   (`public/js/shared/lockService.js:95-98`) oraz ścieżkę `jsonOfferTransfer.js:6` —
   dowód produkcyjny, że cookie-only działa. Iframe'y są same-origin
   (`public/js/spa/router.js:343-389`), dzielą cookie z parentem; cross-context nie
   przekazuje tokenu (`router.js:393-409, 579-585, 590-614`), więc nie ma miejsca, do
   którego cookie „nie dociera".
2. **Hybryda (B) nie ma przedmiotu.** Audyt nie znalazł ani jednego fetchu, który
   wymagałby fallbacku localStorage: wszystkie API są same-origin, `fetchJson` już
   ustawia `credentials: 'same-origin'`, a fallbacki `document.cookie` są martwe dla
   cookie httpOnly. Utrzymywanie dwóch mechanizmów to dwa miejsca kradzieży tokenu
   zamiast zera, plus rozjazd priorytetu header-first (`src/middleware/auth.ts:145`).
3. **Odstępstwo (C) utrwala dług z ADR-006 bez daty spłaty.** Kompensacje (krótki TTL,
   rotacja) nie usuwają wektora kradzieży tokenu przez XSS — skracają jedynie okno.
   Skoro transport cookie jest już zaimplementowany po obu stronach (stawianie,
   odczyt w `requireAuth`, `clearCookie`, `credentials` w `fetchJson`), koszt migracji
   to mechaniczna zamiana call sites, a nie nowa infrastruktura.

### Odrzucenie B i C (jednoznacznie)

- B odrzucono: brak dowodu na istnienie miejsca, gdzie cookie same-origin nie dociera;
  sekcja „miejsca iframe z fallbackiem" jest celowo pusta.
- C odrzucono: nie będzie listy kompensacji ani daty re-review; ten dokument jej nie zawiera.

## 2. Zakres implementacji (wariant A)

### 2.1 Guardy wejścia (7 miejsc) — przepisać na cookie/me

| #   | Plik:linia                                  | Zmiana                                                                                                                                    |
| --- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | `public/js/spa/router.js:520-524,527-532`   | Usunąć `getAuthToken()` przed requestem; `GET /api/auth/me` z `credentials`; redirect `index.html` tylko gdy brak `authData.user` lub 401 |
| G2  | `public/js/shared/dashboard.js:60-72`       | Jak G1 (razem z `authTimer`, `dashboard.js:54-59`)                                                                                        |
| G3  | `public/js/app.js:103-128`                  | Jak G1 (guard rury standalone)                                                                                                            |
| G4  | `public/js/appStudnie.js:15-35`             | Jak G1 (guard studnie standalone)                                                                                                         |
| G5  | `public/js/kartoteka/kartotekaInit.js:5-28` | Jak G1 (guard kartoteka)                                                                                                                  |
| G6  | `public/js/spa/zlecenia.js:48-52`           | Jak G1 (guard zlecenia)                                                                                                                   |
| G7  | `public/js/studnie/pricelistInit.js:7-23`   | Jak G1 (guard pricelist standalone, gałąź nie-orchestrator)                                                                               |

### 2.2 Fetch wrapper centralny (najpierw, przed call sites)

| #   | Plik:linia                                                  | Zmiana                                                                                                                                                               |
| --- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W1  | `public/js/shared/fetchJson.js:18-37`                       | Usunąć merge `authHeaders()`; wymusić `credentials: 'same-origin'` jako nienadpisywalny default (jawne `include` callerów ma pierwszeństwo); zostaje mapping 401/403 |
| W2  | `public/js/shared/StorageService.js:30-48,68-73`            | Usunąć `getHeaders()` (localStorage→cookie→header) i fallback `document.cookie`; requesty z `credentials: 'same-origin'`                                             |
| W3  | `public/js/shared/shareService.js:7-26,29-73`               | Jak W2; share API wyłącznie na cookie                                                                                                                                |
| W4  | `public/js/shared/lockService.js:24-27,48-52,104-109`       | Usunąć `_headers()` z tokenem; `credentials` + `keepalive`; `sendBeacon` bez zmian (już cookie-only)                                                                 |
| W5  | `public/js/shared/auth.js:14-35,83-92`                      | Usunąć `getAuthToken`/`setAuthToken`/`authHeaders`, zapis/odczyt `localStorage.authToken`, czyszczenie cookie przez JS; logout z `credentials: 'include'`            |
| W6  | `public/js/shared/dashboard.js:210,218-226`                 | Usunąć zapis tokenu po loginie; `doLogout` usunąć lub sprowadzić do wrappera `appLogout`                                                                             |
| W7  | `src/middleware/auth.ts:145` + `src/routes/auth.ts:161,210` | Odwrócenie priorytetu na cookie-first; `X-Auth-Token` tylko jako shim usuwany w tym kroku                                                                            |

### 2.3 Call sites (po W1–W7, mechanicznie, pełna lista z audytu §2)

`shared/dashboard.js:80,220,230,441,460,486,578,601`, `shared/ui.js:202-205`,
`shared/printModal.js:238,269,361-373`, `shared/priceDefaults.js:26,45`,
`shared/clientManager.js:23,43`, `shared/offerCrudCommon.js:113`,
`spa/zlecenia.js:219,385,679,748`, `app.js:28,109`, `rury/dataService.js:10,20,32,44,54,100`,
`rury/offerCrud.js:410,427-433`, `rury/offerPrintManager.js:130,147,182,229,305`,
`rury/orderCrud.js:9,23,187`, `studnie/offerApi.js:67,90`, `studnie/offerHistory.js:100,225,267`,
`studnie/offerFileOps.js:22`, `studnie/offerUserManager.js:10,51,85,119`,
`studnie/offerPrintManager.js:153,444,504,549,667`, `studnie/orderHelpers.js:9,77,215,254`,
`studnie/orderCrud.js:162,188,598,708,1165`, `studnie/orderBulk.js:812,827,849`,
`studnie/orderExport.js:25-26,56-57`, `studnie/orderZleceniaData.js:11,239,276,321,394`,
`studnie/orderZleceniaModal.js:155`, `studnie/uiHelpers.js:518,562,601`,
`studnie/pricelistSaveReset.js:16,71`, `studnie/pzGuard.js:30-33`,
`studnie/telemetryBridge.js:214-219`, `studnie/mlDualRanking.js:92,124,534`,
`studnie/mlRewardHooks.js:140,235`, `aiStatusIndicator.js:94,129`,
`kartoteka/kartotekaActions.js:24,136,402,618`, `kartoteka/kartotekaAudit.js:204,266,381`,
`kartoteka/kartotekaSearch.js:119`,
`import-export/shared/featureFlag.js:6-11`, `import-export/studnie/transferJson.js:16,73,96,104,137,176,187`,
`import-export/studnie/externalImport.js:74,86`,
`import-export/studnie/externalExportTemplate.js:72`.
Wyjątki bez zmian logiki (już cookie-only lub lokalne): `import-export/shared/jsonOfferTransfer.js:6`,
`rury/offerExports.js:110` (treść lokalna — zmienia się tylko fetch danych),
pliki generowane lokalnie (`a.download`, blob) — zmienia się tylko pobranie danych.

### 2.4 Harness Playwright (15+ skryptów)

Wszystkie wstrzykujące `localStorage.setItem('authToken', t)` przechodzą na login przez
formularz lub ustawianie cookie przez context (`context.addCookies`):
`appNameConsistency.cjs:178`, `debugContent.cjs:40`, `debugEmpty.cjs:63`,
`diagnosePages.cjs:95`, `excelDomGolden.cjs:58`, `excelEmptyRowAlignment.cjs:263`,
`excelOpenPerf.cjs:142`, `excelVirtualParity.cjs:378`, `excelReliefPair.cjs:86`,
`excelVirtualBench.cjs:130`, `partialOrderRury.cjs:40`, `excelVisualGate.cjs:115`,
`screenshotsBaseline.cjs:147`, `smokeOfferFlow.spec.ts:36`, `spocznikVerification.cjs:50`,
plus `scripts/test-app-views.cjs`. Bez tego cały harness auth pęknie w dniu migracji.

### 2.5 Kolejność (obowiązkowa)

1. Guardy G1–G7 (bez nich każda strona przekieruje mimo ważnego cookie).
2. Wrapper centralny W1–W7 (backend cookie-first + usunięcie tokenu z JSON loginu).
3. Call sites §2.3 (mechaniczne usunięcie `authHeaders()`, dopięcie `credentials`).
4. Harness Playwright §2.4 (inaczej brak regresji).
5. Multi-tab sync (minimalny: `storage`-event lub `BroadcastChannel` na wylogowanie
    - globalny handler 401 → redirect; dziś brak sync, §1.8 audytu — po migracji problem
      nie znika sam).

### 2.6 Testy regresji (definicja gotowości)

- Login: `POST /api/auth/login` stawia httpOnly cookie, JSON nie zawiera `token`,
  `GET /api/auth/me` działa na samym cookie bez nagłówka.
- Logout: jeden przepływ `appLogout` czyści sesję serwerową i cookie (serwerowe
  `clearCookie`); druga karta/kontekst po reloadzie ląduje na `index.html`.
- 401: wygasła/unieważniona sesja → guardy przekierowują; operacja w locie dostaje
  sygnał przez globalny handler (koniec cichych `401` z pustym `catch`).
- Multi-tab: logout w karcie A → karta B reaguje (sync) zamiast cichego `401` przy
  następnym requeście; limit 10 sesji nie wyrzuca cicho drugiej karty.
- Iframe/share: moduły w SPA ładują dane bez tokenu w JS; `sendBeacon` release locka
  działa; share API działa na cookie; export pobiera dane na cookie (zapis pliku lokalnie).
- Harness: zero odwołań do `localStorage.authToken` w `tests/playwright/*.cjs`.

## 3. Kompensacje wariantu C

Nie dotyczy — wybrano wariant A. Brak listy kompensacji, brak daty re-review.

## 4. Refresh / sliding expiration — osobny task

Refresh i sliding expiration **nie wchodzą do kroku migracji**; to osobny task po niej.
Uzasadnienie: migracja zmienia transport uwierzytelnienia (header → cookie), a refresh
zmienia semantykę czasu życia sesji (sztywne 7 dni od `createdAt`,
`src/middleware/auth.ts:8,93-96`, na odnawialne). Mieszanie obu w jednym diffie uniemożliwia
przypisanie regresji (401 po migracji: błąd transportu czy nowa semantyka TTL?).
Kolejność jest też technicznie wymuszona: sliding wymaga decyzji o TTL
(UNVERIFIED-6: czy 7 dni zostaje, czy akceptacja „krótki TTL + rotacja" je skraca),
rotacji przy użyciu (dziś tylko limit 10 sesji i unieważnienie przy zmianie hasła,
`src/middleware/auth.ts:62-77`, `src/routes/auth.ts:209-211`) oraz endpointu refresh —
żadna z tych decyzji nie jest potrzebna do samego przejścia na cookie.

## 5. UNVERIFIED z audytu — blokery vs odroczone

### 5.1 Blokery (wyjaśnić przed implementacją)

- UNVERIFIED-1 — ROZSTRZYGNIĘTE na TAK przy weryfikacji: `cookie-parser` jest wpięty
  (`src/app.ts:211`), więc `req.cookies?.authToken` w `requireAuth` i `logout` działa
  na produkcji. Implementacja dopisuje asercję (test integracyjny login→me na samym cookie).
- UNVERIFIED-2 — bloker: potwierdzić na prod, że `TRUST_PROXY` + `X-Forwarded-Proto`
  dają `req.secure === true` za Caddy (`src/app.ts:58`, `src/routes/auth.ts:29`);
  inaczej cookie nie dostanie flagi `Secure` na HTTPS. Dowód: nagłówek `Set-Cookie`
  z odpowiedzi produkcyjnej.
- UNVERIFIED-3 — bloker: potwierdzić, że fetch bez jawnego `credentials` (default
  `same-origin`) wysyła cookie w Chrome/Edge/FF używanych w projekcie; implementacja
  i tak ustawia jawne `credentials`, ale dowód zamyka ryzyko „cichych 401".
- UNVERIFIED-4 — bloker: przetestować `SameSite=lax` przy `router.js:411-516`
  (`navigate()`, `params.edit`/`params.order`, reload iframe) — czy cookie dociera
  przy każdej nawigacji SPA.

### 5.2 Mogą poczekać (po implementacji lub w osobnych taskach)

- UNVERIFIED-5 — po: `sessions` nie ma indeksu na `userId` (`prisma/schema.prisma:452-456`,
  tylko `@id token`); rotacja `findMany` to pełny skan przy logowaniu. Osobna migracja
  z indeksem, nie warunek transportu.
- UNVERIFIED-6 — osobny task refresh (§4): czy 7 dni zostaje, czy skrócenie TTL.
- UNVERIFIED-7 — ROZSTRZYGNIĘTE: `sessionStorage.user` służy wyświetlaniu/wyszukiwarce
  (`dashboard.js:211,145`, `app.js:121`, `appStudnie.js:28`, `kartotekaInit.js:20`,
  `kartotekaSearch.js:10`), nie decyzjom autoryzacyjnym. Bez zmian.
- UNVERIFIED-8 — po: brak linków publicznych „bez logowania" w kodzie; odbiorca share
  zawsze zalogowany. Decyzja produktowa, ortogonalna do transportu.
- UNVERIFIED-9 — nigdy (archeologia): pochodzenie martwego fallbacku `document.cookie`
  nie wpływa na migrację; fallback zostaje usunięty.
- UNVERIFIED-10 — ROZSTRZYGNIĘTE: `doLogout` bez `credentials` kasuje tę samą sesję,
  bo cookie i JSON niosą tę samą wartość tokenu (`src/routes/auth.ts:53-61`), a serwer
  czyta header LUB cookie (`src/routes/auth.ts:161`) i odpowiada `clearCookie`.
  Niespójność i tak znika w §2 (jeden logout).
