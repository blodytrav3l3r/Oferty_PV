# L2 — draft serwerowy (cross-device): review protokołu

**Status:** REVIEW — implementacja ZABLOKOWANA do jawnej akceptacji (NO-GO).
**Data:** 2026-10-25
**Poprzednie etapy:** Etap 0 (pomiary) + L1 (draft lokalny) — commit `73eef61`; Opcja A — commit `edc44a1`.
**Zakres dokumentu:** wyłącznie projekt protokołu i lista testów. Zero zmian w kodzie.

## 1. Cel L2

Draft lokalny (L1) ginie razem z profilem przeglądarki i nie przechodzi na inne
urządzenie. L2 dodaje **serwerowy draft**: ta sama treść, ta sama semantyka
„ostatniej potwierdzonej wersji", ale dostępna po zalogowaniu z dowolnego
urządzenia.

Poza zakresem L2: historia wersji draftu, merge trójstronny, IndexedDB,
współedycja w czasie rzeczywistym, drafty dla cenników i produktów.

## 2. Fakty zweryfikowane (FACT)

| ID    | Twierdzenie                                                                     | Dowód                                                                  |
| ----- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| F-001 | W schemacie nie ma modelu draftu.                                               | `prisma/schema.prisma` — `draft` tylko w komentarzu, linia 972         |
| F-002 | Optimistic locking to `updateMany` z predykatem `version` w `where`.            | `src/utils/versionWrite.ts:39-70`                                      |
| F-003 | Pudło predykatu (`count === 0`) daje 409 `VERSION_CONFLICT` z `serverVersion`.  | `src/utils/versionWrite.ts:57-70`                                      |
| F-004 | Brak `clientVersion` → `blindWrite`; 0 wierszy też daje 409, nie cichy sukces.  | `src/utils/versionWrite.ts:71-80`, `tests/versionInvariant.test.ts:72` |
| F-005 | Kolumna `version` istnieje na ofertach i zamówieniach (rury + studnie).         | `prisma/schema.prisma:330, 488, 506`                                   |
| F-006 | Brak globalnego `express.json`; parsery są per-route (1 MB / 50 MB).            | `src/mountRoutes.ts:72-73`, komentarz `:43-54`, `src/app.ts:300`       |
| F-007 | Oferty i zamówienia dostają `largeJson` (50 MB).                                | `src/mountRoutes.ts:89-93`                                             |
| F-008 | Twarda blokada edycji: `doc_locks`, TTL 180 s, wygaśnięcie leniwe.              | `prisma/schema.prisma:926-937`, `src/utils/docLocks.ts:18`             |
| F-009 | `doc_locks` celowo NIE zastępuje 409 (chroni stare sesje sprzed acquire).       | `src/utils/docLocks.ts:6-10`, `docs/SYSTEM_INVARIANTS.md:96`           |
| F-010 | Ownership: `canWriteDoc`, rekord bez właściciela = fail-closed dla nie-admina.  | `src/utils/ownership.ts:27`, `docs/SYSTEM_INVARIANTS.md:28-37`         |
| F-011 | Idempotencja: `idempotency_keys` z kluczem `(userId, endpoint, key)` + TTL.     | `prisma/schema.prisma:909-922`                                         |
| F-012 | Cron ma `schedule(name, intervalMs, task)` i dzienny `runHousekeeping`.         | `src/utils/cronService.ts:54, 72, 217`                                 |
| F-013 | Mutacje wymagają same-origin (CSRF) — dotyczy też nowych tras draftu.           | `docs/SYSTEM_INVARIANTS.md:100-110`, `src/middleware/csrf.ts`          |
| F-014 | Rate limiting: `WRITE_LIMITER` używany na trasach zapisu telemetrii.            | `src/routes/telemetry.ts:46-57`                                        |
| F-015 | Testy `versionedWrite` pokrywają 6 przypadków sekwencyjnych, brak równoległych. | `tests/versionInvariant.test.ts` — brak `Promise.all`                  |

## 3. Wnioski (INFERENCE)

- **I-1.** Mechanizm CAS da się zbudować bez nowej abstrakcji: ten sam wzorzec co
  `versionedWrite`, ale na tabeli draftów (F-002, F-003).
- **I-2.** Nowa tabela jest konieczna. Alternatywa „draft w `data` oferty" łamie
  I-009 (bump wersji dokumentu przez sam autosave) i zaśmieca audyt.
- **I-3.** `doc_locks` nie rozwiązuje konfliktu draftów (F-009) — blokada dotyczy
  edycji dokumentu, nie zapisu kopii roboczej. Draft musi działać także wtedy, gdy
  dokument jest zablokowany przez innego użytkownika (podgląd / oczekiwanie).
- **I-4.** Limit 256 KB musi być sprawdzany po stronie serwera na
  `JSON.stringify(payload)`, bo `express.json` liczy całe body, nie payload
  (F-006) i domyślny `smallJson` (1 MB) przepuściłby 4× za duży draft.

## 4. Hipotezy wymagające dowodu przed implementacją (HYPOTHESIS)

- **H-1.** `updateMany` + `count === 0` jest bezpiecznym CAS przy równoległych
  żądaniach w SQLite pod Prismą. **Nie jest to fakt** — brak testu równoległego
  (F-015). Wymagany test: dwa `PUT` z tym samym `If-Match`, dokładnie jeden 200,
  jeden 409, wersja w bazie = +1.
- **H-2.** `express.json({ limit: '320kb' })` per-route nie koliduje z niczym w
  łańcuchu middleware (nowy parser tylko dla `/api/drafts`). Do potwierdzenia
  testem 413 + smoke.
- **H-3.** Sweep TTL w `runHousekeeping` (raz na dobę) wystarcza dla draftów
  cross-device; przy 30-dniowym TTL opóźnienie sprzątania jest nieistotne.

## 5. Protokół proponowany (do decyzji)

### 5.1 Model danych

```prisma
model drafts {
  userId     String
  kind       String   // offer_rury | order_rury | offer_studnie | order_studnie
  docId      String
  baseVersion Int?    // wersja dokumentu, na której powstał draft (null = nowy)
  payload    String   // JSON.stringify, limit 256 KB
  bytes      Int      // rozmiar payloadu w bajtach UTF-8 (do limitów i UI)
  version    Int      @default(1) // CAS draftu (nie dokumentu!)
  updatedAt  String
  expiresAt  String

  @@id([userId, kind, docId])
  @@index([expiresAt], map: "idx_drafts_expires")
}
```

Uwagi projektowe:

- Klucz złożony `(userId, kind, docId)` — draft jest zawsze per-user, więc
  cudzy draft jest nieosiągalny na poziomie zapytania, nie tylko guardu.
- `version` dotyczy **draftu**, nie dokumentu. Nie mylić z `offers_rel.version`.
- `baseVersion` jest potrzebny do komunikatu konfliktu („draft powstał na wersji 3,
  dokument jest na 5").
- Migracja: nowa tabela, brak zmian w istniejących → `migrate deploy` bez ryzyka
  dla danych (F-001). Nadal wymaga backupu przed wdrożeniem (I-006).

### 5.2 API

| Metoda | Ścieżka                    | Semantyka                                             |
| ------ | -------------------------- | ----------------------------------------------------- |
| GET    | `/api/drafts`              | lista metadanych użytkownika (bez `payload`)          |
| GET    | `/api/drafts/:kind/:docId` | pełny draft + nagłówek `ETag: "<version>"`            |
| PUT    | `/api/drafts/:kind/:docId` | zapis z `If-Match: "<version>"` (wymagany dla update) |
| DELETE | `/api/drafts/:kind/:docId` | jawne odrzucenie draftu                               |

Kontrakt zapisu:

- `If-Match` brak przy pierwszym zapisie → `create` z `version: 1`.
- `If-Match` obecny → `updateMany where { userId, kind, docId, version }`.
- `count === 0` → **409** `{ code: 'DRAFT_CONFLICT', serverVersion, serverUpdatedAt }`.
- `If-Match: *` → 400 (nie wspieramy — zbyt łatwo nadpisać cudzą pracę).
- Odpowiedź 200 zwraca `{ version, updatedAt, bytes }`.

### 5.3 Konflikt bez tabeli historii

Ustalone wcześniej: **bez tabeli historii wersji draftu**. Konflikt rozstrzyga:

1. serwer ma jedną wersję draftu (`drafts.version`),
2. klient ma własną kopię w `localStorage` (klucz L1) wraz z `baseVersion`.

Przy 409 UI pokazuje trzy jawne wybory (żaden nie jest domyślny):

- **Użyj serwera** — pobierz draft serwera, lokalny nadpisz po potwierdzeniu.
- **Użyj lokalnego** — wyślij lokalny z `If-Match` na nową wersję serwera.
- **Zachowaj oba** — zapisz lokalny pod kluczem `docId + '-konflikt-<timestamp>'`
  (tylko `localStorage`, nie serwer), aby nic nie zginęło.

Czego świadomie NIE robimy: automatycznego merge pól. Merge bez historii wersji
daje cichą utratę danych — sprzeczne z celem L1.

### 5.4 Limity i walidacja

- Payload: **256 KB** liczone serwerowo jako `Buffer.byteLength(JSON.stringify(payload), 'utf8')`.
  Przekroczenie → **413** `{ code: 'DRAFT_TOO_LARGE', bytes, limit }`, draft
  poprzedni **nietknięty**.
- Parser: dedykowany `express.json({ limit: '320kb' })` tylko dla `/api/drafts`
  (H-2). Globalny limit pozostaje bez zmian (wymóg z akceptacji L1).
- Liczba draftów: max **50** na użytkownika; przy przekroczeniu → 409
  `{ code: 'DRAFT_LIMIT' }` z listą do sprzątania (bez cichego usuwania).
- Walidacja wejścia: Zod — `kind` z enuma, `docId` 1–128 znaków `[A-Za-z0-9_-]`,
  `payload` jako `unknown` + limit bajtów, `baseVersion` int ≥ 1 lub null.
- Odpowiedzi błędów bez treści dokumentu (żadnych fragmentów payloadu w logach).

### 5.5 RBAC / ownership

- `requireAuth` na wszystkich trasach draftu.
- `userId` **wyłącznie z sesji** (`authReq.user.id`), nigdy z body/query.
- Izolacja strukturalna: klucz `(userId, kind, docId)` w tabeli — cudzy draft
  jest nieosiągalny na poziomie zapytania, więc trasa zwraca 404 bez ujawniania,
  czy wiersz istnieje (brak wyroczni „403 vs 404").
- **Korekta wobec pierwszej wersji review:** NIE dokładamy `canWriteDoc` do trasy
  draftu. Draft jest prywatną kopią roboczą, nie mutacją dokumentu; blokowanie po
  właścicielu dokumentu łamałoby przypadek udostępnienia (`canReadWithShare`) —
  użytkownik z dostępem do czytania mógłby legalnie pracować na kopii, a dostałby 403. Właściwy guard ownership działa na trasie dokumentu przy przywracaniu.
- Admin nie dostaje domyślnego wglądu w cudze drafty (draft = brudna praca, nie
  zasób firmowy). Ewentualny podgląd administracyjny = osobna decyzja.
- CSRF: trasy objęte globalnym middleware (F-013), brak wyjątków.
- Rate limit: `WRITE_LIMITER` na PUT/DELETE, `READ_LIMITER` na GET (F-014).

### 5.6 TTL i sweep

- `expiresAt = updatedAt + 30 dni`.
- Sprzątanie: `runHousekeeping` (F-012, H-3) usuwa `expiresAt < now` partiami
  (np. 500 wierszy), loguje licznik. Bez crona per-draft.
- Odczyt wygasłego draftu → 404 + usunięcie wiersza (leniwe, jak `doc_locks`).
- Logout NIE usuwa draftów serwerowych (są cross-device); usuwa je dopiero TTL
  albo jawne DELETE.

### 5.7 Telemetria

- Rozszerzenie `recordDraftFailure(reason)` o źródło: `client` / `server`.
- Nowe kody: `conflict`, `too_large`, `limit`, `forbidden`.
- Bez treści, bez `docId` w logach (kardynalność i prywatność).

## 6. Odpowiedzi na 6 punktów z review (stanowisko do akceptacji)

1. **Konflikt bez tabeli historii** — przyjęte; rozstrzygnięcie po stronie klienta
   (5.3). Wersje: serwer (`drafts.version`) + kopia klienta z `baseVersion`.
2. **CAS** — wzorzec `updateMany` + `count === 0` (F-002/F-003), ale **H-1
   wymaga testu równoległego przed uznaniem za bezpieczny**.
3. **Zod na wejściu** — tak, schemat per-trasa; brak `passthrough()`.
4. **Limity parsera** — dedykowany parser 320 KB dla `/api/drafts` + twarde
   256 KB na payloadzie (5.4). Globalny limit nietknięty.
5. **RBAC** — `userId` z sesji, `canWriteDoc`, 403 bez rozróżnienia
   „nie istnieje" / „brak dostępu" (5.5).
6. **Testy współbieżności** — wymagane, lista w sekcji 7.

## 7. Plan testów (bramka przed implementacją)

Testy obowiązkowe (każdy musi paść na starym kodzie = RED, potem GREEN):

1. **CAS równoległy** — dwa `PUT` z tym samym `If-Match` → dokładnie 1×200,
   1×409, `drafts.version` = +1 (dowód dla H-1).
2. **Brak `If-Match` na istniejącym** → 428/400, nigdy cichy nadpis.
3. **413** — payload 257 KB → 413, poprzedni draft nietknięty (bajt w bajt).
4. **403** — cudzy `docId` → 403 i brak ujawnienia istnienia draftu.
5. **Izolacja** — `GET /api/drafts` nie zwraca draftów innego użytkownika.
6. **TTL** — wygasły draft → 404 + wiersz usunięty; sweep w housekeepingu.
7. **Limit 50** — 51. draft → 409 `DRAFT_LIMIT`, żaden nie znika.
8. **CSRF** — PUT z obcym `Origin` → 403 (kontrakt I-010).
9. **Telemetria** — `conflict`/`too_large` rosną w `/metrics`, bez treści.
10. **Regresja L1** — draft lokalny działa identycznie, gdy serwer zwraca 5xx
    (offline-first: lokalny zapis nigdy nie zależy od serwera).

## 8. Definition of Done (L2)

- Wszystkie testy z sekcji 7 zielone, w tym równoległy (H-1 potwierdzona).
- `npm run validate` GREEN + `version:check` EXIT=0 + `encoding:check` bez ERROR.
- Migracja przechodzi `migrate deploy` na kopii bazy; backup przed wdrożeniem.
- Brak zmian w limitach globalnych i w istniejących trasach ofert/zamówień.
- Dokumentacja: `docs/API.md` (nowe trasy), `docs/SYSTEM_INVARIANTS.md`
  (nowy inwariant I-013 „draft nigdy nie nadpisuje cicho" — zatwierdzony 2026-10-25).

## 9. Otwarte pytania (decyzja użytkownika przed GO)

1. **Limit 256 KB** — czy zostaje, czy od razu 1 MB dla draftów cross-device?
   (pomiar L1: max 11,8 KB, p95 6,2 KB — 256 KB to 21× zapas).
2. **Liczba draftów** — 50 na użytkownika OK?
3. **TTL** — 30 dni OK, czy krócej (14 dni)?
4. **Drafty przy wylogowaniu** — zostają na serwerze do TTL (propozycja), czy
   mają być usuwane jawnie?
5. **Podgląd administracyjny cudzych draftów** — potrzebny, czy świadomie nie?
6. **Nowy inwariant I-013** — akceptacja treści i numeru.

## 10. Status

**Zaimplementowane (backend + klient).** GO otrzymane z limitem 256 KB; pozostałe
punkty przyjęte jako defaulty z tego dokumentu (50 draftów, TTL 30 dni, drafty
zostają po wylogowaniu do TTL, brak podglądu admina, I-013 zatwierdzony i dodany).

- **Backend** — commit `feat(api): serwerowy draft l2 z cas i ttl`: model `drafts`,
  migracja `20261025000000_add_drafts` (`migrate deploy` OK, `migrate diff` bez
  driftu), trasy z `If-Match`, limity 256 KB / 50, TTL leniwy + sweep.
  Testy: `tests/drafts/draftsRoutes.test.ts` (15) + `casConcurrency.test.ts` (2).
- **H-1 potwierdzona** — dwa niezależne klienty Prisma, równoległy `updateMany`
  z tą samą wersją → `counts [0,1]`, jeden 409 `VERSION_CONFLICT`; 3/3 przebiegi.
- **Klient** — `public/js/shared/draftSync.js` (offline-first push z CAS, meta
  wersji w `localStorage`, trzy jawne wybory konfliktu, `pull`/`list`/`remove`),
  wpięcie w `draftAutosave.js` (push po potwierdzonym zapisie lokalnym, flush
  `keepalive` przy wyjściu z karty, odzysk z kopii serwerowej gdy lokalnej nie ma).
  Testy: `tests/frontend/draftSync.test.ts` (22) + `draftSyncWiring.test.ts` (5).

Decyzje wykonawcze odbiegające od literału protokołu:

1. **`navigator.sendBeacon` nie jest używany** — beacon nie pozwala ustawić
   `If-Match`, więc omijałby CAS i mógł nadpisać cudzą pracę. Zamiast tego
   `fetch(..., {keepalive: true})`: te same nagłówki, ten sam limit 64 KB.
   Payload > 64 KB jest **jawnie pomijany** (`skipped_keepalive`), nie wysyłany bez CAS.
2. **Kopie konfliktu nie trafiają do „Wznów pracę"** — `docId-konflikt-<ts>` nie jest
   dokumentem, więc deep-link prowadziłby do pustego formularza; lista je filtruje.
3. **`If-Match` bez meta = 412, nie nadpisanie** — po skasowaniu `localStorage`
   pierwszy push dostaje `DRAFT_PRECONDITION_REQUIRED` i konflikt jest jawny.

Otwarte: brak — I-013 dodany do `docs/SYSTEM_INVARIANTS.md` (2026-10-25, po
akceptacji treści i numeru), wpis nowych tras w `docs/API.md` jest w §`Drafty
robocze (/api/drafts)`, a niestabilne testy pod pełnym obciążeniem odnotowano jako
znany problem #63 w `docs/errors-known.md` (status: otwarte, bez potwierdzonej
przyczyny).
