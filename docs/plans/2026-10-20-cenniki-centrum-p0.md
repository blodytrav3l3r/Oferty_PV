# Cenniki — centrum wersji: plan P0

- **Data:** 2026-10-20
- **Status:** W REALIZACJI — S0–S3 kod gotowy; migracja S2a niewdrożona (czeka na backup + preflight EXIT 0 + osobny GO). Bramki S3 zielone: `test:quick` (1 flaky timeout w `claimIdempotencyHttp`, solo PASS), `test:e2e-pricelist-preview:spawn` PASS, `test:axe` 5/5 PASS (w tym nowy test huba/historii z deep-linkiem).
- **Wersja aplikacji (repo):** 1.47.0
- **Właściciel:** właściciel produktu S.O.K. (decyzje wiążące) + agent implementujący (wykonanie)
- **Zakres:** model wersji cenników (Rury / Studnie / PRECO), hub „Cenniki", statusy, kontrakty API, roadmapa S0–S6
- **Poza zakresem:** patrz sekcja 10 (Non-goals)

## 1. Cel

Jeden spójny model cen i wersji dla trzech osi (Rury, Studnie, PRECO) bez nowego edytora, bez drugiego dashboardu i bez zmian schematu w pierwszej paczce. Admin ma w jednym module zobaczyć: co obowiązuje, co czeka, co jest archiwalne, czym różnią się wersje i czy publikacja jest bezpieczna. Oferty i zamówienia zachowują dotychczasowe pieczątki `pricelistVersionId` + snapshoty — to jest nienaruszalny kontrakt historii.

Kryterium sukcesu planu: S0+S1a+S1b da się wdrożyć bez migracji, a każda kolejna faza ma jawną bramkę, rollback i dowód regresji.

## 2. Executive summary

**Brief „jeden generyczny PriceItem + PRECO w studniach + nowy edytor + drop LIVE" zostaje odrzucony.** Trzy z czterech filarów briefu przeczą architekturze, która już działa: typy cenników są rozdzielone świadomie, PRECO ma własny resolver historyczny, a edytory iframe są jedynym miejscem, gdzie Excel i walidacja per-komórka są spójne z backendem. Przepisanie tego to koszt bez zysku funkcjonalnego.

**Stan docelowy w trzech zdaniach:**

1. Zostają dwa statusy zapisane (`DRAFT`, `APPROVED`) + stan wyliczany z `effectiveFrom` (`SCHEDULED` / `ACTIVE` / `ARCHIVED`), więc znika cron aktywacji i auto-heal, a oś czasu jest funkcją danych, nie zegara.
2. Admin dostaje jeden moduł „Cenniki" z trzema widokami (Przegląd / Cennik / Historia), który reużywa istniejących edytorów i panelu wersji, a publikacja przechodzi przez read-only preflight `GET /:id/checks` z uczciwym ostrzeżeniem o bazie wersji.
3. PRECO pozostaje niezależną osią z pełnym parytetem, oferty i zamówienia dalej pieczętują wersję i snapshot, `LIVE`/`*_Default` wygaszamy w S6 po dowodzie zera użycia i osobnym GO, a `prices:*`/`price_defaults.json` zostają jako kontrakt instalacji i transferu cen (z nową semantyką, nie jako część LIVE).

## 3. Oceny i werdykty (1–10, 10 = najlepiej)

| #   | Propozycja                                          | Ocena | Werdykt     | Uzasadnienie                                                                                                                                                                                          |
| --- | --------------------------------------------------- | ----- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Zachowanie pieczątek/snapshotów ofert               | 10    | ADOPT       | Historia oferty musi być odporna na zmianę cennika; `pricelistVersionId` + snapshot to jedyny działający dowód ceny w momencie sprzedaży.                                                             |
| 2   | Hub „Cenniki" z 3 widokami                          | 9     | ADOPT       | Reużywa istniejące edytory i panel wersji; jeden punkt wejścia bez drugiego dashboardu i bez nowego edytora.                                                                                          |
| 3   | Dwa statusy zapisane + resolver po dacie, bez crona | 8     | ADOPT       | Stan wersji wynika z `effectiveFrom`, nie z kolejności zadziałań crona; usuwa całą klasę błędów auto-heal i zadań zaległych.                                                                          |
| 4   | Import XLSX → draft + błędy per-komórka             | 8     | ADOPT       | Walidacja już istnieje po obu stronach (`priceDefaultsSchemas.ts`, `pricelistXlsx.js`); import do DRAFT nie dotyka ACTIVE.                                                                            |
| 5   | Korekta wsteczna przez przeszły `validFrom`         | 7     | ADAPT       | Działa bez nowego statusu, ale wymaga noty ≥10 znaków i jawnego copy „korekta wsteczna"; bez `BACKDATE_REQUESTED`.                                                                                    |
| 6   | Four-eyes (flaga OFF)                               | 6     | ADAPT       | Pola `approvedBy/approvedAt/approvalStatus` istnieją i są nieużywane; w v1 tylko zapis „kto zatwierdził", bez blokady drugiej osoby.                                                                  |
| 7   | Jeden DRAFT na sekcję                               | 5     | ADAPT       | Dziś nie ma „sekcji" w schemacie, a `POST /:type/drafts` zawsze tworzy nowy szkic; tylko PRECO dedupuje identyczny. v1: licznik szkiców + ostrzeżenie UI, bez indeksu DB (unique DRAFT blokuje klon). |
| 8   | Serwerowa weryfikacja sum ofert                     | 5     | ADAPT       | Tylko shadow/total-only: brak twardego 422, bo `offers_rel` nie ma `totalPrice` i nie da się wiarygodnie porównać sumy.                                                                               |
| 9   | Usunięcie LIVE / `*_Default` / `prices:*`           | 4     | REJECT w v1 | `LIVE`/`*_Default` to S6 z bramką dowodową; `prices:*` i `price_defaults.json` są kontraktem instalacji/transferu (`install.bat`, `prices:export/import`, `prices:verify` w `validate`) i zostają.    |
| 10  | Nowy `cenniki.html` / nowy edytor                   | 3     | REJECT      | Duplikuje iframe `rury.html`/`studnie.html` i logikę Excel; nowy edytor = drugi SSoT cen i nowa klasa rozjazdów.                                                                                      |
| 11  | Merge PRECO do studni                               | 2     | REJECT      | PRECO jest niezależną osią z własną historią i resolverem; merge łamie historyczny eksport studni i parytet.                                                                                          |
| 12  | Generyczny `PriceItem` + `attrs`                    | 2     | REJECT      | Trzy różne kształty danych (produkty / konfig+kinety+zakresy) w jednej tabeli = utrata walidacji typów i migracja bez zysku.                                                                          |

**Nota o sporze agentów:** architect dopuszczał pozostawienie `ARCHIVED` jako statusu zapisywanego, planner optował za trzema statusami zapisywanymi. Przyjęto **dwa statusy zapisane**, bo „ARCHIVED jako draft" wyciekłby jako kandydat do referencji PRECO — `PRECO_REFERENCE_STATUSES` w `src/services/pricelist/validation.ts:49` wprost dopuszcza `ARCHIVED` w historycznym eksporcie. Status archiwalny musi być wyliczany, żeby nie mógł stać się źródłem referencji.

## 4. Docelowy model

### 4.1 Diagram

```
                      ┌─────────────────────────────────────────┐
                      │ PricelistVersion                        │
                      │  type: rury | studnie | preco           │
                      │  status: DRAFT | APPROVED  (2 zapisane) │
                      │  effectiveFrom (oś czasu)               │
                      │  seq / version / note / createdAt       │
                      │  approvedBy / approvedAt (S4)           │
                      └───────────────┬─────────────────────────┘
                                      │ 1:N (FK istnieje tylko tutaj)
                      ┌───────────────┴─────────────────────────┐
                      │ PricelistItem* — snapshot wersji        │
                      │  rury:     ProductsRuryItem*            │
                      │  studnie:  ProductsStudnieItem*         │
                      │  preco:    PrecoKonfig/Kinety/Zakresy*  │
                      └─────────────────────────────────────────┘

  OŚ CZASU (wyliczana, bez zapisu statusu przejściowego):

    APPROVED + effectiveFrom >  now   →  SCHEDULED  (Zaplanowany)
    APPROVED + effectiveFrom <= now   →  ACTIVE     (Obowiązuje, najnowsza)
    APPROVED + wyparta przez nowszą   →  ARCHIVED   (Archiwalny)
    DRAFT                             →  DRAFT      (Szkic)

  OFERTA / ZAMÓWIENIE (pieczątka + snapshot, bez FK):

    offers_rel.pricelistVersionId               → TEXT (bez FK)
    offers_studnie_rel.pricelistVersionId       → TEXT (bez FK)
    orders/...                                  → TEXT (bez FK)
    + snapshot wierszy z chwili wystawienia
```

### 4.2 Rury

- Oś: `type='rury'`, wersje `DRAFT`/`APPROVED`, `effectiveFrom` decyduje o stanie.
- Edycja: istniejący edytor `public/rury.html` + `public/js/rury/*`; zapis idzie przez istniejące `PUT` (do S5 na `LIVE`, po S5 na draft — kontrakt w sekcji 6).
- Publikacja: `POST /:id/approve` → `APPROVED` + `effectiveFrom`; preflight `GET /:id/checks` przed potwierdzeniem.
- Oferty rur pieczętują `pricelistVersionId` + snapshot; resolver ofert czyta najnowszą `APPROVED` z `effectiveFrom <= data oferty`.
- Brak nowych tabel, brak zmian w `products` (globalne produkty zostają jak są).

### 4.3 Studnie

- Oś: `type='studnie'`, identyczny model statusów i resolvera jak rury.
- Edytor: `public/studnie.html` + `public/js/studnie/*`; PRECO **nie** jest kopiowane do studni — studnia referencjonuje wersję PRECO przez resolver po dacie.
- Legacy standalone `public/js/studnie/pricelistInit.js:37` (wejście bez przełączenia LIVE/ACTIVE) zostaje naprawione w S1a przez wspólny helper wejścia, nie przez nowy moduł (F8).
- Migracja S2 mapuje `Studnie`-owe `ARCHIVED → APPROVED` z zachowaniem `effectiveFrom` — bez tego archiwum stałoby się aktywne po zmianie resolvera.

### 4.4 PRECO

- PRECO pozostaje **niezależną osią**: własne wersje `type='preco'`, własna historia, własny resolver.
- Pełny parytet operacji: zapis, publikacja, korekta wsteczna, klon, diff, eksport, usuwanie, podgląd.
- Resolver PRECO filtruje wyłącznie `APPROVED` po `effectiveFrom` i dacie eksportu studni; `ARCHIVED` zapisany znika z modelu (staje się wyliczany), ale historyczny eksport nadal widzi wersję obowiązującą w danej dacie.
- S2: `PRECO_REFERENCE_STATUSES` zmienia się z `['ACTIVE', 'BACKDATE', 'ARCHIVED']` na `['APPROVED']`; stare wiersze `ARCHIVED` są mapowane na `APPROVED` (nie usuwane), więc eksport historyczny działa bez wyjątków.
- Dedup identycznych wierszy PRECO → `PUT` istniejącej wersji zamiast tworzenia duplikatu (F5 dotyczy hasha — patrz backlog).
- Brak merge do studni, brak kopiowania wierszy PRECO do wersji studni.

### 4.5 Oferty i zamówienia

- Pieczątka `pricelistVersionId` pozostaje plain `TEXT` bez FK — świadoma decyzja: historia oferty nie może zniknąć ani zmienić się przez kaskadę.
- Snapshot wierszy zostaje bez zmian; resolver nie nadpisuje historii oferty.
- Weryfikacja sum: tylko shadow/total-only (S4) — log różnicy, brak 422, bo `offers_rel` nie ma `totalPrice` (jest tylko w `offers_studnie_rel`).
- `ARCHIVED` nie może być kandydatem referencji dla nowych ofert; wyliczanie stanu to gwarantuje.

## 5. Docelowy UX

### 5.1 Hub „Cenniki" — trzy widoki, zero nowych dashboardów

Jeden moduł w nawigacji (`Cenniki`) z trzema widokami, przełączanymi bez przeładowania strony:

| Widok        | Zawartość                                                                                                       | Deep-link                                   |
| ------------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **Przegląd** | 3 karty osi (Rury / Studnie / PRECO): co obowiązuje, co zaplanowane, ile szkiców, CTA (checks tylko w Historii) | `#/cenniki/przeglad`                        |
| **Cennik**   | istniejący edytor iframe (`rury.html` / `studnie.html`); PRECO przez istniejący panel, nie nowy edytor          | `#/cenniki/cennik?type=studnie&section=...` |
| **Historia** | lista wersji + modal podglądu / diff / checks; bez nowego edytora i bez edycji historii                         | `#/cenniki/historia?type=preco&id=...`      |

Zasady:

- Karty na Przeglądzie to nie „drugi dashboard": pokazują wyłącznie stan osi cennika i linkują do istniejących widoków.
- Deep-linki są jedynym mechanizmem wejścia z pulpitu (`dashboard.js`) i z panelu wersji; router (`public/js/spa/router.js:257-294`, `MODULES`) dostaje wpis modułu, nie nowy plik HTML.
- Wejście w cennik zawsze przełącza LIVE/ACTIVE przez istniejące helpery (`public/js/rury/offerNavigation.js:41-57`, `public/js/studnie/globals.js:429-444`); legacy standalone naprawiamy w S1a (F8).

### 5.2 Cennik — istniejące edytory, nowy tylko kontener widoku

- Rury i Studnie: bez zmian w edytorze; zmienia się wyłącznie skorupa widoku i CTA „Opublikuj" / „Zapisz szkic". **Do S2 CTA „Opublikuj" woła istniejące trasy** `publish`/`activate`/`backdate`; po S2 CTA **zostaje na `publish`** (alias na `approveVersion`, 6.5) — przełączenie na `/approve` dopiero przy usuwaniu aliasu w kolejnym release. S1b nie dodaje CTA publikacji — tylko badge checks w Historii (brak martwego UI).
- PRECO: istniejący panel i `pricelistXlsx.js`; bez duplikowania logiki Excel.
- Copy rozróżnia **LIVE** (bufor roboczy, widoczny tylko adminowi, nie jest wersją historyczną) od **DRAFT** (wersja szkicowa z osią czasu). Komunikat wprost: „LIVE to bufor edycji, nie wersja cennika — nie trafi do historii ofert".
- **Semantyka LIVE (jawnie w UI i API):** zapis LIVE trafia do tabel `Products*`/`Preco*` i jest natychmiast widoczny dla odczytów `?source=live` oraz dla `?source=active` **tylko wtedy**, gdy nie ma resolvowalnej wersji `APPROVED` — wtedy odpowiedź niesie `X-Pricelist-Fallback: live` (`src/routes/productsV2.ts:37-48`). Gdy istnieje `APPROVED`, oferty i eksporty czytają wersję, a zmiany LIVE są dla nich **niewidoczne do publikacji**. Komunikat w hubie: „Zmiany w buforze nie zmieniają ofert, dopóki nie opublikujesz wersji".
- Zapis LIVE pozostaje do S5; po S5 domyślnym celem zapisu jest draft, a LIVE jest read-only fallbackiem.

### 5.3 Historia — modal, nie nowa strona

- Lista wersji z kolumnami: stan wyliczany, `effectiveFrom`, `seq`, autor, nota, checks.
- Modal podglądu i diffu reużywa `public/js/shared/pricelistVersionPreview.js` (już istnieje po planie z 2026-10-20).
- `GET /:id/checks` zasila badge bezpieczeństwa publikacji (użycie, kolizja daty, ostrzeżenie o bazie wersji). Checks są **doradcze**: publikacja ponawia walidację w transakcji.
- Badge stanu zawsze pokazuje `effectiveFrom` („Obowiązuje od 2026-11-01"), bo stan wyliczany nie zostawia zdarzenia w audycie; wpis w audycie powstaje przy `approve`.

### 5.4 Statusy wyliczane — jeden helper w FE

Cztery etykiety widoczne dla użytkownika:

| Etykieta UI     | Stan wyliczany | Warunek                                                |
| --------------- | -------------- | ------------------------------------------------------ |
| **Szkic**       | `DRAFT`        | status zapisany `DRAFT`                                |
| **Zaplanowany** | `SCHEDULED`    | `APPROVED` + `effectiveFrom > now`                     |
| **Obowiązuje**  | `ACTIVE`       | `APPROVED` + `effectiveFrom <= now` i najnowsza na osi |
| **Archiwalny**  | `ARCHIVED`     | `APPROVED` + wyparta przez nowszą `APPROVED`           |

- Jedno źródło mapowania w FE: `displayStatus(state)` w `public/js/shared/pricelistVersions.js`; nowe porównania surowych statusów w innych plikach zabronione. Zakres: **1 plik**, nie 21 (reszta `.status` dotyczy ofert/zamówień).
- **Kolejność wdrożenia helpera (korekta po ocenach):** `displayStatus` wchodzi w **S1a**, w **jednym pliku** `public/js/shared/pricelistVersions.js` (wszystkie porównania statusów cennika; nie 21 plików — reszta to `.status` ofert/zamówień). Helper obsługuje **6 obecnych statusów** (`DRAFT`, `SCHEDULED`, `ACTIVE`, `ARCHIVED`, `BACKDATE_REQUESTED`, `BACKDATE`) **oraz `APPROVED`** (forward-compatible), mapując je na 4 etykiety. Dzięki temu S2 nie zmienia widoków FE.
- **SSoT stanu:** backend zwraca `status` (zapisany) + **`state`** (wyliczony, jedna nazwa w `GET /`, `/summary`, `/checks`); FE **preferuje `state`**, a `displayStatus(state)` mapuje stan na etykietę. Capability helpery (`canPublish(state)`, `canDelete(state, effectiveFrom)`, `canActivate(state, effectiveFrom)`) działają na `state`, nie na surowym `status` — dzięki temu S2 nie zmienia widoków. Fallback na surowy `status` tylko dla starych odpowiedzi. FE nie liczy dat samodzielnie — unika rozjazdu stref czasowych.
- **Mapowanie etykiet (S1a, testowane):** `DRAFT`→„Szkic", `SCHEDULED`→„Zaplanowana", `ACTIVE`→„Obowiązuje", `ARCHIVED`→„Archiwalna"; legacy `BACKDATE_REQUESTED`→„Szkic (korekta)", `BACKDATE`→„Obowiązuje (korekta)", `APPROVED`→etykieta z daty (`effectiveFrom > now` → „Zaplanowana"). Backend `state` jest nadrzędny; helper nie zgaduje dat, gdy `state` istnieje.
- **S1a przepisuje istniejące porównania w tym pliku na `state`/capability:** `isDeletable`/`isEditableStatus` (`:560-566`), `deleteReason` (`:585-591`), `renderRows` (`:611-627`), `isDraftish` (`:651-654`, `:1247-1250`), `pickActiveLabel` (`:264-272`) oraz `STATUS_LABELS`/`STATUS_ICONS` (`:413-455`) z wpisem `APPROVED`. Bez tego po S2 UI pokaże surowy `APPROVED` i włączy kasowanie historii.
- Mapowanie migracyjne (S2): `ACTIVE → APPROVED`, `SCHEDULED → APPROVED`, `ARCHIVED → APPROVED`, `BACKDATE → APPROVED`, `BACKDATE_REQUESTED → DRAFT` (z zachowaniem noty), `DRAFT → DRAFT`. Po S2 helper mapuje już tylko `DRAFT`/`APPROVED` + datę.

### 5.5 Diff — limit 100 zmian jawnie opisany

- Panel diffu pokazuje maksymalnie 100 zmian i **zawsze** komunikat: „Pokazano 100 z N zmian — pełny diff dostępny w eksporcie XLSX".
- Limit jest stały w v1 (bez paginacji w modalu); payload diffu bez zmian poza licznikiem `truncated` / `totalChanges`.
- Eksport pozostaje pełny — limit dotyczy wyłącznie widoku.

### 5.6 Import / eksport

- Import XLSX → **DRAFT** (nigdy prosto do APPROVED), błędy per-komórka z numerem wiersza i kolumny, bez częściowego zapisu przy błędach blokujących.
- Import nie kasuje istniejącego draftu bez potwierdzenia; UI pokazuje liczbę szkiców i ostrzega, a dedup identycznych wierszy działa dziś tylko dla PRECO. Wymuszanie jednego DRAFT nie jest celem v1 (O6).
- Eksport bez zmian; PRECO eksport historyczny przez resolver po dacie, nie po ostatnim `seq`.

### 5.7 A11y i higiena frontendu

- Zero inline handlerów (`onclick=`) — nowy kod wyłącznie `addEventListener`; dyspozytor `data-csp*` dla istniejących akcji.
- Zero nowych globali `window.X`; nowe funkcje dopinane do istniejących namespace (np. `window.pricelistVersions`).
- Każdy nowy widok: focus trap w modalu, `aria-label` przez `escapeHtmlAttr`, nawigacja klawiaturą, kontrast zgodny z `docs/UI_GUIDELINES.md`.
- Test `test:axe` dla trzech widoków huba i modala historii.

## 6. Kontrakty API

Wszystkie trasy pod `/api/pricelist-versions` (montowane bez `-v2`, `src/mountRoutes.ts:111`). Walidacja wejścia Zod, odpowiedzi jako DTO, brak surowych encji Prisma.

### 6.1 `GET /api/pricelist-versions`

- Query: `type` (`rury|studnie|preco`), `status` (zapisany lub wyliczony), `limit`, `cursor`.
- Odpowiedź: lista wersji z `status` + `state` + `effectiveFrom` + `seq`; **bez** N+1 (F1: dziś 4 county na wersję, `usage.ts:33-44`).
- `READ_LIMITER` dodany także na `GET /`, `/labels`, `/:id/export` (F3) — spójnie z `/summary`.

### 6.2 `GET /api/pricelist-versions/summary`

- **Addytywnie**: istniejące pola zostają (w tym `nextScheduled`); dochodzą `state` (wyliczony), `draftCount`, `approvedCount`, `collisionCount`. `nextScheduled` po S2 oznacza najbliższą przyszłą `APPROVED` — bez zmiany nazwy, żeby nie ruszać `dashboard.js:309`.
- Brak zmiany kształtu starych pól = brak regresji w `dashboard.js` i testach panelu.

### 6.3 `GET /api/pricelist-versions/:id/checks` (NOWE, read-only)

- Middleware: `requireAuth`, `requireAdmin`, `READ_LIMITER`, `Cache-Control: no-store`.
- Zero mutacji, zero zapisu audytu, zero locków zapisu.
- Odpowiedź:

```json
{
    "id": "…",
    "type": "studnie",
    "state": "SCHEDULED",
    "usage": { "offers": 12, "orders": 0, "total": 12 },
    "collision": { "hasCollision": false, "effectiveFrom": "2026-11-01" },
    "liveDiff": { "changedRows": 4 },
    "baseVersion": {
        "status": "UNVERIFIABLE",
        "reason": "brak baseVersionId — nie można potwierdzić, z której wersji powstał szkic"
    },
    "comparisonToCurrentApproved": { "status": "DIFFERS", "currentVersionId": "…" },
    "warnings": ["…"]
}
```

- `baseVersion.status` to **zawsze `UNVERIFIABLE`** bez `baseVersionId` — żadnego fałszywego „bez zmian". Porównanie zawartości jest osobnym polem `comparisonToCurrentApproved.status` = `MATCH` / `DIFFERS` / `NO_CURRENT` (to nie jest „baza wersji", tylko różnica do aktualnie obowiązującej).
- **Co checks może faktycznie wykryć bez `baseVersionId`:** (a) czy istnieje aktualny `APPROVED` dla typu, (b) `sha256` draftu vs `sha256` aktualnego `APPROVED` (`comparisonToCurrentApproved`), (c) kolizję `(type, effectiveFrom)`, (d) użycie wersji, (e) `liveDiff.changedRows`. **Czego nie może:** potwierdzić, z której wersji powstał szkic, ani że publikacja się powiedzie.
- **Checks są doradcze, nie gwarancyjne.** Stan może zmienić się między `GET /checks` a `POST /approve`; `approve` **musi** ponowić warunki krytyczne w transakcji (patrz 6.4). Odpowiedź niesie `checkedAt` i `advisory: true`.
- Allowlista audytu `KNOWN_ENTITY_TYPES` (`src/routes/audit.ts:17-27`) bez zmian — checks nie tworzy wpisów.

### 6.4 `POST /api/pricelist-versions/:id/approve` (NOWE)

- Body: `{ effectiveFrom?: ISO, note?: string, checksCheckedAt?: ISO }`; `effectiveFrom` domyślnie = zapisany w wersji (FE `publish` nie wysyła daty); `note` wymagane ≥10 znaków, gdy data jest w przeszłości (korekta wsteczna). `checksCheckedAt` służy tylko do wyliczenia `checksStale` (porównanie z `updatedAt` wersji), nie do walidacji.
- `requireAuth` + `requireAdmin` + `PRICELIST_WRITE_LIMITER`.
- Kody: `200` publikacja; `400` walidacja; `403` brak admina; `409` kolizja `(type, effectiveFrom)` albo wersja nie jest `DRAFT`; `404` brak wersji. Nieaktualność checks nie jest błędem: `200` + pole `checksStale: true` (bez `409`); `checksStale` wynika z `checksCheckedAt` w body i `updatedAt` wersji, brak pola = `false`.
- **Re-walidacja w transakcji (nie ufa checks):** ponowne sprawdzenie `status='DRAFT'`, braku kolizji `(type, effectiveFrom)`, niezmienionego `sha256` wersji i jej wierszy oraz guardów użycia. Wynik checks jest tylko podpowiedzią UI.
- Zapis: `status='APPROVED'`, `approvedBy`, `approvedAt`; `approvalStatus` pozostaje deprecated (komentarz w schemacie, zero zapisów; DROP COLUMN w SQLite = rebuild tabeli, poza v1 — O5).
- Four-eyes: flaga OFF w v1 — approve nie blokuje, gdy ta sama osoba utworzyła draft; tylko log „kto zatwierdził".

### 6.5 Aliasy przejściowe (`publish`, `activate`, `backdate`, `activate-due`)

- Stare endpointy `publish`, `activate` i `backdate` zostają jako aliasy na **jeden release**: mapują na ten sam `approveVersion` (jedna transakcja) i zwracają `Deprecation` + `Sunset` w nagłówkach.
- **Wszystkie aliasy biorą `effectiveFrom` zapisany w wersji**, nie `now` (FE `publish` nie wysyła body, `backdate` wysyła tylko `note`): `publish` → data z wersji, `note` opcjonalne; `activate` → data z wersji + guard `effectiveFrom <= now` (409, jak dziś); `backdate` → data z wersji + `note` ≥10 znaków (400 bez noty). Wszystkie ustawiają `APPROVED`; przyszła data = `state=SCHEDULED`, przeszła = `state=BACKDATE`.
- `activate-due` **w S2a** zwraca `410 Gone` (funkcja `activateDue` jest usuwana razem z cronem), po jednym release usunięty; S2a usuwa też route i re-export w `pricelistVersionService.ts:41`, żeby `typecheck` był zielony.
- **FE nie wymaga zmiany w S2:** CTA `publish` działa przez alias (`public/js/shared/pricelistVersions.js:1428-1429`). Aliasy nie tworzą nowej logiki; to cienka warstwa translacji na `approveVersion`.

### 6.6 `PUT` / zapis LIVE

- Do S5: `PUT` zapisuje do `LIVE` (bufor), publikacja przez `approve`.
- **Widoczność zapisu LIVE:** natychmiast dla `?source=live` i dla admina w edytorze; dla ofert tylko przy braku `APPROVED` (fallback + `X-Pricelist-Fallback: live`). Gdy `APPROVED` istnieje, LIVE nie wpływa na oferty do publikacji.
- Po S5: domyślnym celem zapisu jest draft; `LIVE` zostaje tylko odczytowo jako fallback.
- S6 (poza v1): usunięcie wyłącznie tabel `LIVE` i `*_Default` — po bramce dowodowej O3 i osobnym GO. `prices:*` / `price_defaults.json` **nie** są usuwane: to kontrakt instalacji i transferu, który w S6 przechodzi na odczyt aktywnej wersji (`APPROVED`) zamiast LIVE.

### 6.7 `pricelistVersionId` bez FK

- Zostaje `String?` (plain TEXT) w ofertach i zamówieniach; brak `REFERENCES` i brak kaskad.
- FK istnieje wyłącznie `PricelistItem* → PricelistVersion` (migracja `20260929000000_fk_pricelist_version`).
- Indeksy na `pricelistVersionId` w 4 tabelach to osobna, addytywna zmiana (F2, S4) — bez FK, bez zmiany typu.

### 6.8 Macierz przejść po S2 (jedno źródło prawdy dla guardów)

| Operacja                                                     | Wejście                                                     | Wynik / guard                                                                                          |
| ------------------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `createDraft` / `cloneAsDraft` / import                      | dowolna wersja                                              | nowy `DRAFT`; brak zmian w wersji źródłowej                                                            |
| edycja wierszy                                               | tylko `DRAFT`                                               | `APPROVED` = `409 IMMUTABLE` (`EDITABLE_STATUSES=['DRAFT']`)                                           |
| `approveVersion` (`approve`/`publish`/`activate`/`backdate`) | `DRAFT` + `effectiveFrom`                                   | `APPROVED`; kolizja `(type,effectiveFrom)`, zmiana `sha256`, użycie i status re-walidowane w tx        |
| `deleteVersion`                                              | `DRAFT` albo `APPROVED` z `effectiveFrom > now` i `usage=0` | usunięcie; `APPROVED` historyczny lub użyty = `409 NOT_DELETABLE`; aktywny/resolwowalny = zawsze `409` |
| resolver odczytu                                             | `APPROVED`                                                  | najnowsza `effectiveFrom <= now`; wyparte = `ARCHIVED` **wyliczone**, nigdy zapisane                   |
| cron / `activateDue` / `ensureActiveVersions`                | —                                                           | usunięte; `GET` nie mutuje stanu; brak auto-heal                                                       |

**Konsekwencja:** `SCHEDULED`, `ACTIVE`, `BACKDATE`, `BACKDATE_REQUESTED` i zapisany `ARCHIVED` znikają z runtime; zostają tylko `DRAFT` i `APPROVED` (+ `ARCHIVED` wyliczony). Każde przejście ma test RED→GREEN na starym kodzie (S2a).

- **S2a deleguje do wspólnego rdzenia:** `publishDraft`, `activate` i `applyBackdate` stają się cienkimi wrapperami `approveVersion` (żadnych zapisów legacy statusów w oknie S2a→S2b); S2b dokłada tylko `Deprecation`/`Sunset` i testy aliasów.
- **`/labels` bez `ids`** zwraca wyłącznie `APPROVED` z `effectiveFrom <= now` (banner `pickActiveLabel` wybiera max `seq`, czyli obowiązujący); z `ids` bez filtra statusu, żeby historyczne pieczątki dalej działały.

## 7. Roadmapa S0–S6

| Faza    | Zakres                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Schemat             | Bramka wyjścia                                                                                                                                                                                                                                                                           | Rollback                                                                                      | Estymata |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------- |
| **S0**  | Preflight przed migracją: `scripts/pricelist-preflight.ts` (kolizje `(type, effectiveFrom)` po mapowaniu, inwentarz statusów, **liczba `BACKDATE`/`BACKDATE_REQUESTED` w bazie**, daty niepoprawne), baseline testów                                                                                                                                                                                                                                                                                                                                                                                                                                                    | BRAK                | `typecheck`, `test:quick`, `npm run pricelist:preflight` EXIT 0 + raport w `docs/plans/`                                                                                                                                                                                                 | nie dotyczy (read-only)                                                                       | 1 d      |
| **S1a** | Hub „Cenniki" (3 widoki, deep-linki), `state` + `displayStatus`/`canPublish`/`canDelete`/`canActivate` w **jednym pliku FE** (`shared/pricelistVersions.js`) na 6 statusach + `APPROVED`, przepisanie istniejących porównań/predykatów na `state` (5.4), addytywne `state`/`draftCount`/`approvedCount`/`collisionCount` w `/summary`, naprawa F8, `READ_LIMITER` (F3)                                                                                                                                                                                                                                                                                                  | BRAK                | `typecheck`, `typecheck:frontend`, `lint:frontend`, `test:quick`, `test:axe`                                                                                                                                                                                                             | revert commita (bez migracji)                                                                 | 3 d      |
| **S1b** | `GET /:id/checks` (read-only, doradczy) + badge checks **tylko w Historii**; **bez** CTA publikacji i bez `approve` (wchodzą w S2)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | BRAK                | `test:quick`, `test:e2e-pricelist-preview:spawn`, test braku zapisu audytu, `test:axe`                                                                                                                                                                                                   | revert commita                                                                                | 2 d      |
| **S2a** | Model 2 statusów + resolver: migracja danych (`ACTIVE/SCHEDULED/ARCHIVED/BACKDATE → APPROVED`, `BACKDATE_REQUESTED → DRAFT`), guard kolizji, partial unique `(type, effectiveFrom) WHERE status='APPROVED'`, `PRECO_REFERENCE_STATUSES`/`RESOLVABLE_STATUSES` → `['APPROVED']`, **rewrite guardów wg 6.8** (`PricelistStatus`, `EDITABLE_STATUSES`, `IMMUTABLE_STATUSES`, `DELETABLE_STATUSES`, `assertEditable`, `createDraft`, `publishDraft`, `activate`, `applyBackdate`, `deleteVersion`, filtr `/labels`, `nextScheduledFor`/`getVersionsSummary`), usunięcie crona/`activateDue`/`ensureActiveVersions` + re-exportu, `app.ts:424`, route `activate-due` → `410` | TAK (dane + indeks) | backup → `preflight` EXIT 0 → GO → `migrate deploy/status`, test resolvera, **wszystkie dotknięte testy w S2a RED→GREEN**: `f1`/`f2`/`f3`/`summary`/`labels`/`delete`/`ensureActiveVersions`/`precoResolver`/`activeSource`/`cloneDraft`/`publish`/`exportShape`/`e55gate`, `test:quick` | `npm run restore` + revert kodu                                                               | 6 d      |
| **S2b** | `POST /:id/approve` z re-walidacją w tx, aliasy `publish`/`activate`/`backdate` (mapowanie 6.5) + `Deprecation`/`Sunset`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | BRAK                | `test:quick`, `test:e2e`, testy aliasów (w tym `publish` z FE), test `checksStale` (200)                                                                                                                                                                                                 | revert commita S2b (S2a zostaje)                                                              | 2 d      |
| **S3**  | Historia i diff: modal, limit 100 jawnie, import XLSX→draft z błędami per-komórka, eksport                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | BRAK                | `test:quick`, `test:e2e-pricelist-preview:spawn`, `test:axe`                                                                                                                                                                                                                             | revert release + wyłączenie importu; drafty z importu zostają jako szkice (bez auto-usuwania) | 2 d      |
| **S4**  | Shadow weryfikacja sum (total-only), four-eyes zapis pól, indeksy `pricelistVersionId` (F2), N+1 (F1) + **budżety wydajności** (8.2)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | TAK (indeksy)       | `test:quick`, `test:e2e`, EXPLAIN + pomiar na fixture 8.2 w granicach budżetu                                                                                                                                                                                                            | drop indeksów (migracja odwrotna) + revert                                                    | 3 d      |
| **S5**  | Wygaszenie LIVE: zapis domyślnie do draftu, trwały licznik `LIVE_WRITE` + licznik fallbacków, aliasy API na jeden release, flaga `PRICELIST_WRITE_TARGET` = `live` albo `draft`, rozszerzenie `KNOWN_ENTITY_TYPES` o `pricelist_live`                                                                                                                                                                                                                                                                                                                                                                                                                                   | BRAK                | liczniki O3 działają (audit `pricelist_live`, `/metrics`, dzienny check „1 aktywna/typ") + test audytu `pricelist_live`, `test:quick`, `test:e2e`; **okno 14 dni startuje po S5**                                                                                                        | `PRICELIST_WRITE_TARGET=live` (flaga) lub revert release                                      | 4 d      |
| **S6**  | Usunięcie tabel `LIVE`/`*_Default`; przepisanie `prices:export/import/verify` na `APPROVED` (kontrakt transferu zostaje)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | TAK                 | **poza v1**: osobny GO, bramka O3 (**14 kolejnych dni po S5 i min. 2 wydania**: 0 `LIVE_WRITE`, 0 fallbacków, 0 naruszeń „1 aktywna/typ" + podpis admina), pełny `validate` + drill backupu + test świeżej instalacji z `price_defaults.json`                                            | restore backupu + revert release                                                              | poza v1  |

**Zależności:** S0 → S1a → S1b → S2a → S2b → S3 → S5 → (S6); S4 po S2b (potrzebuje `displayStatus` i checks). S0+S1a+S1b stanowią **pierwszą paczkę** (bez zmian schematu). S2a startuje wyłącznie po `npm run pricelist:preflight` EXIT 0 na kopii backupu i osobnym GO na migrację (O1).

**Zasady fazowania:**

- Bramka P0: S0+S1a+S1b muszą być zielone i wdrożone, zanim ruszy S2 (żadnego łączenia migracji z UI w jednym commicie).
- S1a dowozi wartość UX wcześniej; S1b (checks) nie blokuje huba i nie zawiera publikacji — `approve` zostaje w S2, żeby nie powstał `APPROVED` nieczytany przez stary resolver.
- P1 (S2+) nie łączy parserów, modeli i logiki cen w jednym commicie — każda zmiana modelu ma własny test regresyjny.
- Każda faza kończy się checkpointem w `docs/plans/_active-evidence.md` (CLAIM / EVIDENCE / BEFORE / AFTER / TESTS / DIFF / COMMIT).

### 7.1 Backlog audytu F1–F8 (severity, nie wszystko w v1)

| ID  | Problem                                                              | Dowód                                                        | Severity | Faza                 |
| --- | -------------------------------------------------------------------- | ------------------------------------------------------------ | -------- | -------------------- |
| F1  | N+1 w `GET /pricelist-versions` (4 county na wersję)                 | `src/services/pricelist/usage.ts:33-44`                      | P2       | S4                   |
| F2  | Brak indeksów na `pricelistVersionId` w 4 tabelach                   | `prisma/schema.prisma:334,368,488,505`                       | P2       | S4                   |
| F3  | Brak `READ_LIMITER` na `GET /`, `/labels`, `/:id/export`             | `src/routes/pricelistVersions.ts:92,170,482`                 | P1       | S1a                  |
| F4  | `nextScheduledFor` widzi tylko przyszłe SCHEDULED — zaległe giną     | `src/services/pricelist/usage.ts:149`                        | P1       | S2 (znika z modelem) |
| F5  | Hash PRECO order-sensitive + WebCrypto (async)                       | `public/js/shared/pricelistVersions.js:118-153`              | P2       | S3                   |
| F6  | `ensureActiveVersions` abort-on-error (jeden błąd blokuje auto-heal) | `src/app.ts:424-425`; `src/services/ensureActiveVersions.ts` | P2       | S2 (usunięcie)       |
| F7  | PRECO references liczą drafty                                        | resolver PRECO / `usage.ts`                                  | P1       | S2                   |
| F8  | Legacy standalone studnie bez przełączenia LIVE/ACTIVE               | `public/js/studnie/pricelistInit.js:37`                      | P1       | S1a                  |

**Uwaga (ocena 2, punkt 8):** F1 (N+1) i F2 (indeksy) to **tor wydajnościowy**, niezależny od celu „prostego cennika". Nie blokują S1a/S1b; wchodzą w S4. F3 zostaje w S1a, bo jest bezpieczeństwem (limiter), nie wydajnością.

## 8. Bramki jakości i dowody

### 8.1 Bramki obowiązkowe (każdy commit / paczka)

**Tierowanie (korekta po ocenie 2, punkt 7):** pełna lista poniżej obowiązuje przy **release/paczkę fazy**. Przy pojedynczym commicie minimum: `typecheck` (jeśli TS), `typecheck:frontend` (jeśli `public/js`), `lint`/`lint:frontend` dla zmienionych warstw, `format`, `encoding:check`, `version:check`, `test:quick`. `test:e2e`, `test:axe`, `build`, `prices:verify` — na koniec fazy, nie na każdy commit.

| Bramka                                     | Cel                                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `npm run typecheck`                        | Backend TS bez błędów                                                                      |
| `npm run typecheck:frontend`               | `public/js` bez błędów typów                                                               |
| `npm run build`                            | Build produkcyjny                                                                          |
| `npm run lint`                             | ESLint backend                                                                             |
| `npm run lint:frontend`                    | ESLint frontend (reguły przeglądarki)                                                      |
| `npm run format`                           | Prettier, SSoT formatowania                                                                |
| `npm run encoding:check`                   | UTF-8 bez BOM, brak mojibake                                                               |
| `npm run version:check`                    | Spójność wersji we wszystkich źródłach                                                     |
| `npm run ratchet:check`                    | Ratchet dostępu do DB w `src/routes` (`prisma.*` nie rośnie)                               |
| `npm run test:quick`                       | Testy dymne                                                                                |
| `npm run collisions:check`                 | Kolizje globali JS (`window.X`) — brama ogólna; nie sprawdza dat cennika                   |
| `npm run pricelist:preflight`              | Kolizje `(type, effectiveFrom)` po mapowaniu — S0/S2 (read-only)                           |
| `npm run prices:verify`                    | Kontrakt transferu cen; po S6 czyta `APPROVED` zamiast LIVE+Default (zostaje w `validate`) |
| `npm run test:e2e-pricelist-preview:spawn` | E2E preview/diff/deep-link na izolowanym porcie 3179                                       |
| `npm run test:axe`                         | A11y trzech widoków huba i modala historii                                                 |
| `npm run test:e2e`                         | Pełny E2E                                                                                  |

### 8.2 Dowody regresji (wymagane przed S2 i S6)

1. **Drill migracji:** kopia backupu → `npm run pricelist:preflight` EXIT 0 → `npx prisma migrate deploy` (guard przerywa przy duplikacie) → `npx prisma migrate status` EXIT 0 → porównanie liczby wersji i wierszy przed/po (bez utraty historii).
2. **1000 fixtures:** resolver stary vs nowy na tych samych danych — identyczny wybór wersji dla daty `now`, `now-1d`, `now+30d`; zero różnic (stan `ARCHIVED` jest wyliczany, nie zapisany).
3. **Świeża instalacja:** `git clone` → `npm ci` → `install.bat --skip-seed` → start serwera → `GET /summary` 200.
4. **Test regresyjny RED→GREEN** dla każdej naprawy (najpierw FAIL na starym kodzie, potem PASS).
5. **Timeouty:** pełny `validate` ma ~7 testów blisko limitu — mierzyć czas per pakiet, nie „przedłużać wszystkiego"; przy FAIL diagnoza, nie reset gita.
6. **Budżety wydajności (S4, mierzalne — ocena 1, punkt 5):** fixture `3 typy × 200 wersji × 5 000 wierszy` (rury/studnie) + PRECO `3 × 100 wersji × 2 000 wierszy`; lokalnie (SQLite, ten sam runtime): `GET /pricelist-versions` p95 ≤ 300 ms, `GET /summary` p95 ≤ 200 ms, `GET /:id/checks` p95 ≤ 500 ms przy 10 000 ofert; brak zapytań N+1 (liczba zapytań nie rośnie liniowo z liczbą wersji — asercja na licznik). Przekroczenie = FAIL fazy, nie „akceptowalne".
   **Metoda:** najpierw F1/F2, potem pomiar; 3 przebiegi rozgrzewkowe, 20 próbek, p95 liczony ze wszystkich żądań po warm-upie; ten sam seed (`scripts/seed-pricelist-perf.ts`, raz, plik DB poza repo). Brak metody = brak zaliczenia.

## 9. Ryzyka i mitygacje

| Ryzyko                                                        | Wpływ  | Mitygacja                                                                                                                                                                 | Rollback                               |
| ------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Utrata historii przy migracji kolizji `(type, effectiveFrom)` | Wysoki | O1=A: `pricelist:preflight` raportuje, migracja **przerywa** (guard + unique index), zero automatycznej utraty; decyzja człowieka per kolizja                             | backup + `npm run restore`             |
| Auto-resolve kolizji (B/C) zmienia historię bez śladu         | Wysoki | Odrzucone: B demotuje starszą wersję do `DRAFT` (znika z osi), C przesuwa datę (fałszuje oś); istniejące guardy nie obejmują `ARCHIVED`/`SCHEDULED`                       | nie dotyczy (nie wdrażane)             |
| S6 usuwa LIVE i łamie transfer cen                            | Wysoki | O4: `prices:*` zostaje; `prices:export/import/verify` przepisane na `APPROVED` przed dropem tabel; test świeżej instalacji                                                | restore + revert release               |
| Unique DRAFT blokuje klon/reimport                            | Średni | O6: brak indeksu; `cloneAsDraft` tworzy kolejny `DRAFT`; trigger dopiero po metryce `draftCount`                                                                          | brak (nie wdrażane)                    |
| LIVE vs DRAFT niejasne dla użytkownika                        | Średni | Copy wprost „LIVE = bufor, nie wersja"; szkolenie 1 ekran w hubie; DRAFT zawsze widoczny jako „Szkic"                                                                     | revert copy (bez danych)               |
| Cache (HTML/CSS/min po zmianie FE)                            | Średni | Po release restart serwera + twardy refresh; `?v=` tylko przez release; test na `about:blank` w E2E                                                                       | restart + purge cache przeglądarki     |
| Timeouty ~7 testów w pełnym `validate`                        | Średni | Mierzyć czas pakietów, dzielić testy wolne, nie podnosić globalnego timeoutu bez pomiaru                                                                                  | uruchomienie pakietu docelowego osobno |
| Brak `baseVersionId` → ostrzeżenie niepewne                   | Średni | `baseVersion.status='UNVERIFIABLE'` z jawnym „nie można potwierdzić"; zero fałszywego MATCH                                                                               | brak (read-only)                       |
| Przeoczony mapping statusu w FE (1 plik)                      | Średni | `state` + `displayStatus`/capability helpery w **S1a** obsługują 6 statusów + `APPROVED`; S2 nie zmienia widoków. Grep po surowych `'ACTIVE'`/`'ARCHIVED'` + test helpera | revert S1a (bez migracji)              |
| Checks potraktowane jako gwarancja publikacji                 | Średni | `advisory: true` + `checkedAt` w odpowiedzi; `approve` re-waliduje w tx (status, kolizja, sha, użycie); UI nie blokuje na podstawie checks                                | revert copy (bez danych)               |
| LIVE widoczny dla ofert przy braku APPROVED                   | Średni | Copy i badge `X-Pricelist-Fallback: live`; S5 domyślnie draft; S6 po bramce O3                                                                                            | flaga zapisu do LIVE                   |
| Korekta wsteczna używana rzadko/nieużywana                    | Niski  | Preflight S0 raportuje liczbę `BACKDATE`/`BACKDATE_REQUESTED`; decyzja o uproszczeniu copy/testów dopiero po pomiarze, bez automatycznego usuwania                        | brak (read-only)                       |
| Husky/commitlint blokuje commit (np. `well.magazyn`)          | Niski  | `node scripts/commit.mjs "typ(scope): opis"`; obejście hooka tylko świadomie, bez pomijania `version:check`                                                               | ponowny commit po korekcie             |
| Rozjazd wersji w docs przy edycji planu                       | Niski  | Nie wpisywać markerów wersji do planu; po edycji `version:check`                                                                                                          | korekta treści pliku                   |
| Aliasy API (`activate-due`) wołane po S2 przez stary FE       | Średni | `activate-due` od S2a zwraca `410`; `publish`/`activate`/`backdate` działają przez wspólny rdzeń; E2E sprawdza brak wywołań 410                                           | przywrócenie aliasu na kolejny release |

## 10. Non-goals

- Nowy `cenniki.html` / nowy edytor cennika.
- Generyczny `PriceItem` + `attrs`.
- Merge PRECO do studni lub kopiowanie wierszy PRECO do wersji studni.
- Automatyczne przypinanie `precoVersionId` w wersji studni w v1 (kandydat S4+, jawny GO; ADR-007 wskazuje to jako kierunek docelowy — patrz 14.5).
- `baseVersionId` i migracja schematu z nim związana.
- Osobny status `BACKDATE_REQUESTED`.
- Twarde `422` przy weryfikacji sum ofert.
- Przełącznik four-eyes jako blokada (tylko zapis pól, flaga OFF).
- Indeks unikalności draftu w v1 i bez redesignu schematu (brak kolumny `section`; unique DRAFT blokuje klon — O6).
- Usunięcie `LIVE` / `*_Default` w v1 (S6, osobny GO); `prices:*` nie jest celem usunięcia (kontrakt transferu).
- DROP COLUMN `approvalStatus` w S2/S6 (O5: tylko komentarz `@deprecated`).
- Paginacja diffu w modalu (limit 100 + eksport).
- Przepisywanie legacy standalone studni na nowy moduł (tylko naprawa wejścia).
- Zmiana pieczątek i snapshotów ofert.
- React, PostgreSQL, mikroserwisy, Redis, nowe kolejki.
- Zmiany w Excel poza importem do draftu.

## 11. Decyzje O1–O6 (rozstrzygnięte 2026-10-20)

| ID  | Decyzja                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Uzasadnienie (1–3 zdania)                                                                                                                                                                                                                                                                                                      | Dowód (plik:linia / komenda)                                                                                                                                                                                                                                                                                                         | Wpływ na etap (S0–S6)                             | Status                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- | ------------------------------------------- |
| O1  | **A — preflight raportuje, migracja przerywa.** `scripts/pricelist-preflight.ts` + `npm run pricelist:preflight`; read-only wobec DB; wejście `DATABASE_URL`, opcjonalnie `--type`, `--out`, `--json`; wyjście: grupy `(type, effectiveFrom)` z `id/version/seq/status/createdBy`, inwentarz statusów, daty niepoprawne; exit `0` = brak kolizji, `2` = kolizje (blokada), `1` = błąd. Migracja S2 ma guard i przy duplikacie kończy się rollbackiem.                                                                                     | B (demote starszej do `DRAFT`) usuwa wersję z osi bez śladu; C (+1 s) fałszuje datę i resolver. A nie zmienia danych po cichu: człowiek widzi pełną listę i decyduje per kolizja. Kolizje są realne, bo guardy nie obejmują `ARCHIVED`/`SCHEDULED`.                                                                            | Brak skryptu: `scripts/` nie ma preflightu cennika; istniejący `check-global-collisions.mjs` sprawdza globalne `window.X`; unikalności brak: `prisma/schema.prisma:992-994`; guardy: `src/services/pricelist/lifecycle.ts:301-318,407-414`; wzorzec partial unique: `prisma/migrations/20261009000000_fu_cycles/migration.sql:25-27` | S0 (skrypt + raport), S2 (guard + GO na migrację) | DECIDED; wykonanie S2 wymaga GO na migrację |
| O2  | **`ARCHIVED` wyliczany, nigdy zapisywany.** Mapowanie S2: `ACTIVE`/`SCHEDULED`/`ARCHIVED`/`BACKDATE` → `APPROVED`, `BACKDATE_REQUESTED` → `DRAFT`, `DRAFT` → `DRAFT`. `PRECO_REFERENCE_STATUSES` w S2 → `['APPROVED']` (oraz `RESOLVABLE_STATUSES` → `['APPROVED']`); resolver wybiera najnowszą `APPROVED` z `effectiveFrom <= data`, a `state` oznacza wyparte jako `ARCHIVED`.                                                                                                                                                         | Zapisany `ARCHIVED` jest dziś kandydatem referencji PRECO, więc po zmianie modelu może wyciec jako źródło cen. Wyliczanie z osi daje jedno źródło prawdy i zachowuje historyczny eksport: stare `ARCHIVED` stają się `APPROVED` bez utraty wierszy.                                                                            | `src/services/pricelist/lifecycle.ts:319-322`; `src/services/pricelist/validation.ts:49`; `src/services/pricelist/usage.ts:95-108`                                                                                                                                                                                                   | S2 (migracja + resolver), S1a (`displayStatus`)   | DECIDED                                     |
| O3  | **Nie kalendarz sam, lecz bramka dowodowa + krótsze okno.** Po S5 zapis domyślnie idzie do draftu; każdy udany zapis LIVE trafia do trwałego licznika (`audit_logs`, `entityType='pricelist_live'`, `action='LIVE_WRITE'`), fallback `X-Pricelist-Fallback` dostaje licznik w `/metrics`, a dzienny check pilnuje „dokładnie 1 aktywnej wersji na typ". S6 dozwolone po **14 kolejnych dniach i min. 2 wydaniach**: 0 `LIVE_WRITE`, 0 fallbacków w próbkach tygodniowych, 0 naruszeń checku + podpis admina; każde trafienie zeruje okno. | Dziś nie ma żadnego trwałego sygnału użycia LIVE: trasy `PUT` nie piszą audytu, a nagłówek fallbacku nie ma licznika. 30 dni było arbitralne dla jednej firmy; 14 dni + 2 wydania zachowuje dowód (licznik), skraca martwe oczekiwanie. Sam kalendarz nie jest kryterium — jeśli licznika brak, bramka nie przechodzi.         | Brak `logAudit` w `src/routes/productsV2.ts:64-108`, `productsStudnieV2.ts:279`, `precoPricingV2.ts:64`; nagłówek bez licznika: `productsV2.ts:48`; brak metryki w `src/utils/metrics.ts`; `prices:verify` w `package.json` (`scripts.validate`)                                                                                     | S5 (liczniki), S6 (bramka)                        | DECIDED                                     |
| O4  | **Rozdzielone: (a) LIVE/`*_Default` → S6; (b) `prices:*`/`price_defaults.json` zostają bezterminowo jako kontrakt instalacji i transferu.** W S6 CLI `prices:export/import/verify` przechodzi na `APPROVED`: export czyta aktywną wersję, import tworzy `APPROVED` tylko gdy nie ma żadnej aktywnej (bootstrap świeżej instalacji), inaczej `DRAFT`; `prices:verify` porównuje plik z aktywną wersją i zostaje w `validate`. Usunięcie dopiero po zastąpieniu kontraktu równoważnym testem świeżej instalacji i transferu offline.        | `price_defaults.json` jest jedynym lekkim transferem cen między maszynami (bez backupu SQLite) i jest wpisany w `install.bat`/`install.sh`, `CONTRIBUTING.md` i start serwera. Usunięcie razem z LIVE złamałoby instalację i bramę `validate`; przepisanie źródła na `APPROVED` usuwa zależność od LIVE bez łamania kontraktu. | `src/services/priceOverrideService.ts:13-17`; `src/app.ts:411-413`; `install.bat:152,176-185`; `install.sh:102,127-128`; `CONTRIBUTING.md:118-124`; `.gitignore:153`                                                                                                                                                                 | S6 (przepisanie CLI + drop tabel LIVE/Default)    | DECIDED                                     |
| O5  | **Zostaje deprecated, bez DROP.** W S2 (i tak dotyka schematu) dopisać `/// @deprecated` przy `approvalStatus` i zakaz zapisu w review; zero kodu runtime. DROP tylko jako dodatek do przyszłego rebuild tabeli `PricelistVersion` (np. przy `baseVersionId`/`draftKey`), nigdy jako osobna migracja.                                                                                                                                                                                                                                     | DROP w SQLite to rebuild tabeli z 5 relacjami FK — koszt i ryzyko bez zysku funkcjonalnego, bo pole jest nieużywane. Komentarz i zakaz zapisu wystarczą, by nie powstał nowy konsument.                                                                                                                                        | `prisma/schema.prisma:982`; jedyne wystąpienie poza planem: `prisma/migrations/20260926000000_pricelist_versioning/migration.sql:32`; `rg -n "approvalStatus" src public tests` = brak                                                                                                                                               | S2 (komentarz), S6 (bez zmian)                    | DECIDED                                     |
| O6  | **Bez indeksu teraz i bez unique DRAFT bez redesignu.** v1: `draftCount` na typ w `/summary` + ostrzeżenie UI „masz N szkiców"; PRECO nadal dedupuje identyczne. Trigger twardej zmiany: `draftCount > 3` dla typu przez 30 dni **albo** >1 szkic o tym samym `(sha256, effectiveFrom)` w raporcie/audycie → najpierw soft-guard UI; indeks DB dopiero po dodaniu jawnego `isWorkingCopy`/`draftKey` i osobnym GO.                                                                                                                        | `PricelistVersion` nie ma kolumny `section`, więc proponowany `(type, section)` jest niewykonalny; `(type) WHERE status='DRAFT'` blokowałby `cloneAsDraft` i import, które legalnie tworzą kolejny DRAFT. Realny konflikt jest dziś rzadki (tylko PRECO dedupuje), więc indeks to koszt bez dowodu.                            | `prisma/schema.prisma:969-995` (brak `section`); `src/services/pricelist/lifecycle.ts:703-748` (clone → DRAFT); `src/routes/pricelistVersions.ts:233-260` (POST zawsze nowy); `public/js/shared/pricelistVersions.js:1683-1693` (dedup tylko PRECO)                                                                                  | S1a (`draftCount`), S3 (UI), brak schematu        | DECIDED                                     |

**Uwaga do O1:** preflight nie zastępuje backupu. Kolejność S2: backup → `pricelist:preflight` EXIT 0 → `migrate deploy` (z guardem) → `migrate status` → test resolvera. Kolizja wykryta po migracji = `npm run restore` + poprawa danych, nie ręczna edycja na produkcji.

**Uwaga do O3:** `14` dni + 2 wydania to minimalne okno obserwacji, nie samodzielne kryterium; jeśli licznik nie istnieje, bramka nie może przejść.

## 12. Evidence ledger

| ID    | Twierdzenie                                                                   | Dowód                                                                                                                                                 | Status                                    |
| ----- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| E-001 | Stack: TS + Express + Prisma + SQLite; FE vanilla JS SPA + iframe             | `package.json`, `src/app.ts`, `public/index.html`; wersja 1.47.0 (`VERSION`)                                                                          | VERIFIED                                  |
| E-002 | W kodzie jest 6 statusów cennika                                              | `src/services/pricelist/validation.ts:32-33`                                                                                                          | VERIFIED                                  |
| E-003 | Resolver dopuszcza `ACTIVE` i `BACKDATE`                                      | `src/services/pricelist/validation.ts:44-46`                                                                                                          | VERIFIED                                  |
| E-004 | `ARCHIVED` jest fizycznie zapisywany przy przejściu ACTIVE→nowsza ACTIVE      | `src/services/pricelist/lifecycle.ts:321`                                                                                                             | VERIFIED                                  |
| E-005 | Cron 5 min + start uruchamia `activateDue`                                    | `src/utils/cronService.ts:59-63,252-253`; `src/app.ts:424-425`                                                                                        | VERIFIED                                  |
| E-006 | `activateDue` filtruje tylko `SCHEDULED`                                      | `src/services/pricelist/lifecycle.ts:526-532`                                                                                                         | VERIFIED                                  |
| E-007 | `nextScheduledFor` widzi tylko przyszłe SCHEDULED (F4)                        | `src/services/pricelist/usage.ts:147-165`                                                                                                             | VERIFIED                                  |
| E-008 | FK istnieje tylko `PricelistItem* → PricelistVersion`                         | migracja `20260929000000_fk_pricelist_version`                                                                                                        | VERIFIED                                  |
| E-009 | `pricelistVersionId` w ofertach/zamówieniach to plain TEXT bez FK             | `prisma/schema.prisma:334,368,488,505`                                                                                                                | VERIFIED                                  |
| E-010 | `offers_rel` nie ma `totalPrice`; jest tylko w `offers_studnie_rel`           | `prisma/schema.prisma:364`                                                                                                                            | VERIFIED                                  |
| E-011 | API montowane bez `-v2` w ścieżce                                             | `src/mountRoutes.ts:86,87,106,111`                                                                                                                    | VERIFIED                                  |
| E-012 | `*_Default` = 5 tabel                                                         | `prisma/schema.prisma` (ProductsRuryDefault, ProductsStudnieDefault, PrecoKonfigDefault, PrecoKinetyDefault, PrecoZakresyDefault)                     | VERIFIED                                  |
| E-013 | `price_defaults.json` jest gitignored legacy                                  | `src/services/priceOverrideService.ts:4-16`; `.gitignore:153`                                                                                         | VERIFIED                                  |
| E-014 | `npm run validate` zawiera `prices:verify` zależny od LIVE+Default+pliku      | `package.json` (`scripts.validate`)                                                                                                                   | VERIFIED                                  |
| E-015 | Pola `approvedBy/approvedAt/approvalStatus` istnieją i są nieużywane          | `prisma/schema.prisma:980-982`                                                                                                                        | VERIFIED                                  |
| E-016 | Brak `GET /:id/checks`                                                        | `src/routes/pricelistVersions.ts` (brak trasy)                                                                                                        | VERIFIED                                  |
| E-017 | Allowlista audytu `KNOWN_ENTITY_TYPES` bez checks                             | `src/routes/audit.ts:17-27`                                                                                                                           | VERIFIED                                  |
| E-018 | Brak unikalności `(type, effectiveFrom)`; są inne unikalności                 | `prisma/schema.prisma:992-994`                                                                                                                        | VERIFIED                                  |
| E-019 | Partial unique `WHERE status='APPROVED'` wykonalny                            | wzorzec `prisma/migrations/20261009000000_fu_cycles/migration.sql`                                                                                    | VERIFIED                                  |
| E-020 | FE ma porównania statusów cennika w **1 pliku** (nie 21)                      | `rg -l` po literałach statusów w `public/js` → tylko `shared/pricelistVersions.js`                                                                    | VERIFIED (skorygowane)                    |
| E-021 | Testy F2/F3 zależą od `activateDue`                                           | `tests/pricelistVersions.f2.test.ts` (~420-460), `tests/pricelistVersions.f3.test.ts` (~260-345)                                                      | VERIFIED                                  |
| E-022 | Istnieją komponenty do reużycia (preview, xlsx, router, chmura)               | `public/js/shared/pricelistXlsx.js:213`, `pricelistVersionPreview.js`, `dashboard.js`, `public/js/spa/router.js:257-294`, `public/index.html:831-866` | VERIFIED                                  |
| E-023 | E2E preview działa na izolowanym porcie i DB                                  | `tests/playwright/pricelistPreview.cjs` (`--spawn` :3179, DB `data/e2e-pricelist-preview.sqlite`)                                                     | VERIFIED                                  |
| E-024 | Admin przełącza LIVE/ACTIVE przy wejściu w cennik (poza legacy standalone)    | `public/js/rury/offerNavigation.js:41-57`; `public/js/studnie/globals.js:429-444`                                                                     | VERIFIED                                  |
| E-025 | Legacy standalone studnie nie przełącza LIVE/ACTIVE (F8)                      | `public/js/studnie/pricelistInit.js:37`                                                                                                               | VERIFIED                                  |
| E-026 | Brak `baseVersionId` — ostrzeżenie o bazie wersji musi być `UNVERIFIABLE`     | `prisma/schema.prisma` (brak pola); `src/routes/pricelistVersions.ts` (brak checks)                                                                   | VERIFIED                                  |
| E-027 | Dwa statusy zapisane są wystarczające dla osi czasu                           | `effectiveFrom` + `@@index([type,status,effectiveFrom])` (`schema.prisma:994`)                                                                        | HYPOTHESIS (do potwierdzenia w S2 drillu) |
| E-028 | Trzy statusy zapisane (z `ARCHIVED`) jako model docelowy                      | spór agentów; `ARCHIVED` wycieka jako kandydat PRECO                                                                                                  | REJECTED                                  |
| E-029 | Generyczny `PriceItem` + `attrs`                                              | brak wspólnego kształtu danych; 3 różne walidacje                                                                                                     | REJECTED                                  |
| E-030 | Nowy `cenniki.html` / nowy edytor                                             | duplikat iframe i logiki Excel                                                                                                                        | REJECTED                                  |
| E-031 | `collisions:check` sprawdza globalne `window.X`, nie daty cennika             | `scripts/check-global-collisions.mjs:1-8`; `package.json` (`scripts.collisions:check`)                                                                | VERIFIED                                  |
| E-032 | Brak skryptu preflight kolizji `(type, effectiveFrom)`                        | `scripts/` (brak preflightu; istnieje `check-global-collisions.mjs` i `backfill-pricelist-v1.ts`); `package.json` (brak `pricelist:preflight`)        | VERIFIED                                  |
| E-033 | Trasy LIVE nie piszą audytu; fallback nie ma licznika                         | `src/routes/productsV2.ts:64-108`, `productsStudnieV2.ts:279`, `precoPricingV2.ts:64`; `productsV2.ts:48`; `src/utils/metrics.ts:21-32`               | VERIFIED                                  |
| E-034 | `approvalStatus` nie jest czytane ani zapisywane w kodzie                     | `prisma/schema.prisma:982`; `rg -n "approvalStatus" src public tests` = brak; migracja `20260926000000_pricelist_versioning/migration.sql:32`         | VERIFIED                                  |
| E-035 | `PricelistVersion` nie ma kolumny `section`; draft jest per typ               | `prisma/schema.prisma:969-995`; `section` tylko jako nazwa sekcji w serwisach eksportu (`src/services/pricelist/export.ts`), nie kolumna modelu       | VERIFIED                                  |
| E-036 | `POST /:type/drafts` zawsze tworzy nowy DRAFT                                 | `src/routes/pricelistVersions.ts:233-260`                                                                                                             | VERIFIED                                  |
| E-037 | Dedup istniejącego draftu dotyczy tylko PRECO (identyczny hash + data)        | `public/js/shared/pricelistVersions.js:156-186,1683-1693`                                                                                             | VERIFIED                                  |
| E-038 | `cloneAsDraft` zawsze tworzy DRAFT — unique DRAFT blokowałby klon             | `src/services/pricelist/lifecycle.ts:703-748`                                                                                                         | VERIFIED                                  |
| E-039 | `price_defaults.json` jest kontraktem instalacji/transferu                    | `src/services/priceOverrideService.ts:13-17`; `install.bat:152,176-185`; `install.sh:102,127-128`; `CONTRIBUTING.md:118-124`; `src/app.ts:411-413`    | VERIFIED                                  |
| E-040 | `prices:verify` jest w `validate` i zależy od LIVE+Default+pliku              | `package.json` (`scripts.validate`, `scripts.prices:verify`); `src/services/priceOverrideService.ts:568-629`                                          | VERIFIED                                  |
| E-041 | `ARCHIVED` jest zapisywany przy aktywacji nowszej wersji                      | `src/services/pricelist/lifecycle.ts:319-322`                                                                                                         | VERIFIED                                  |
| E-042 | `PRECO_REFERENCE_STATUSES` dopuszcza `ARCHIVED` — wymaga zmiany w S2          | `src/services/pricelist/validation.ts:49`                                                                                                             | VERIFIED                                  |
| E-043 | `resolveActive` filtruje `ACTIVE`/`BACKDATE` — wymaga przejścia na `APPROVED` | `src/services/pricelist/usage.ts:95-108`                                                                                                              | VERIFIED                                  |
| E-044 | Testy F2/F3 zależą od `activateDue` — S2 musi je przepisać                    | `tests/pricelistVersions.f2.test.ts:233,420-453`; `tests/pricelistVersions.f3.test.ts:211,266-343`                                                    | VERIFIED                                  |
| E-045 | Auto-resolve B/C (demote/przesunięcie daty) zmienia historię bez śladu        | analiza `lifecycle.ts:319-322` + resolver `usage.ts:95-108`; brak testu migracyjnego dla B/C                                                          | REJECTED (wariant odrzucony)              |
| E-046 | `prices:*` można utrzymać po S6, czytając `APPROVED` zamiast LIVE             | projekt O4; wymaga testu świeżej instalacji i transferu w S6                                                                                          | HYPOTHESIS (do walidacji w S6)            |
| E-047 | Indeks `(type) WHERE status='DRAFT'` jest bezpieczny                          | koliduje z `cloneAsDraft` (`lifecycle.ts:703-748`) i importem                                                                                         | REJECTED                                  |
| E-048 | Próg „30 dni" sam w sobie jest dowodem braku użycia LIVE                      | brak trwałego licznika (E-033)                                                                                                                        | REJECTED (zastąpiony bramką O3)           |
| E-049 | ADR-007 wskazuje `studnieVersion.precoVersionId` jako kierunek docelowy       | `docs/adr/ADR-007-unified-pricing.md:69-74`                                                                                                           | VERIFIED                                  |
| E-050 | `?source=active` spada na LIVE tylko przy braku resolwowalnej wersji          | `src/routes/productsV2.ts:37-48`; `productsStudnieV2.ts:251-263`; `precoPricingV2.ts:38-48`                                                           | VERIFIED                                  |
| E-051 | Checks nie istnieją; `approve` nie istnieje — oba są nowe kontrakty           | `src/routes/pricelistVersions.ts` (brak tras `checks`, `approve`)                                                                                     | VERIFIED                                  |
| E-052 | Plan miał sprzeczność: `displayStatus` w S1 i S2                              | sekcja 11 O2 (wcześniej „S1") vs roadmapa S2 („21 plików") — poprawione na S1a/S2                                                                     | VERIFIED (poprawione)                     |
| E-053 | Skala użycia `BACKDATE`/`BACKDATE_REQUESTED` jest nieznana                    | brak zapytania/raportu w repo; preflight S0 ma ją zmierzyć                                                                                            | UNVERIFIED                                |
| E-054 | Ocena 2 błędnie podała 6 tabel `*_Default`; jest 5                            | `prisma/schema.prisma` (5 modeli Default); E-012                                                                                                      | VERIFIED (korekta oceny)                  |
| E-055 | 14 dni + 2 wydania wystarcza jako okno dowodowe O3                            | decyzja produktowa; twardy dowód to licznik, nie kalendarz                                                                                            | DECIDED                                   |
| E-056 | `precoVersionId` w wersji studni jest kandydatem S4+, nie celem v1            | ADR-007 + brak kolumny w `schema.prisma`; wymaga backfillu i osobnego GO                                                                              | DECIDED (poza v1)                         |

## 13. Definition of Done planu

- [ ] Plan zapisany w `docs/plans/2026-10-20-cenniki-centrum-p0.md`, UTF-8 bez BOM.
- [ ] Wszystkie decyzje użytkownika (1–12) odwzorowane bez reinterpretacji.
- [ ] Tabela ocen 12 pozycji z werdyktami i uzasadnieniami.
- [ ] Model docelowy rozdzielony na Rury / Studnie / PRECO / Oferty.
- [ ] Kontrakty API z kodami 409/403, `checks` read-only, `summary` addytywnie, aliasy na 1 release.
- [ ] Roadmapa S0–S6 (S1a/S1b, S2a/S2b) ze schematem, bramką, rollbackiem i estymatą.
- [ ] Bramki jakości + dowody regresji (drill migracji, 1000 fixtures, świeży clone).
- [ ] Ryzyka z mitygacją i rollbackiem.
- [ ] Decyzje O1–O6 rozstrzygnięte w sekcji 11, każda z dowodem i wpływem na etap.
- [ ] O1: opisany `scripts/pricelist-preflight.ts` + test na fixture z kolizją (exit 2) i czystą bazą (exit 0); `collisions:check` nie jest mylony z preflightem cennika.
- [ ] O2: mapowanie `ARCHIVED → APPROVED`, `PRECO_REFERENCE_STATUSES → ['APPROVED']` i **rewrite guardów** (`IMMUTABLE_STATUSES`, `DELETABLE_STATUSES`, `createDraft`, `publishDraft`, `deleteVersion`) w S2a + testy RED→GREEN edycji/kasowania `APPROVED`.
- [ ] O3: zapytanie metryki (audit `pricelist_live`, `/metrics`, dzienny check) + bramka 14 dni i min. 2 wydań.
- [ ] O4: lista konsumentów `price_defaults.json` + plan przepisania `prices:*` na `APPROVED`.
- [ ] O5: komentarz `@deprecated`, zero DROP w S2/S6.
- [ ] O6: `draftCount` + trigger; brak indeksu w v1.
- [ ] S2a: pełny rewrite guardów wg 6.8 + przepisane testy `f1/f2/f3/summary/labels/delete/ensureActiveVersions/precoResolver/activeSource/cloneDraft/publish/exportShape/e55gate` (RED→GREEN) oraz testy przejść `DRAFT→APPROVED`, edycja/kasowanie `APPROVED`.
- [ ] Non-goals, decyzje O1–O6, evidence ledger.
- [ ] Oceny zewnętrzne uwzględnione w sekcji 14 z wagą, werdyktem i śladem w planie.
- [ ] S1a/S1b rozdzielone; `displayStatus` + capability helpery w S1a obsługują 6 statusów + `APPROVED`; S2 nie zmienia widoków.
- [ ] `checks` oznaczone jako doradcze; `approve` re-waliduje w transakcji.
- [ ] Budżety wydajności S4 mierzalne (fixture + p95 + asercja braku N+1).
- [ ] `precoVersionId` zapisany jako kandydat S4+, nie merge i nie cel v1.
- [ ] `npm run format` EXIT 0.
- [ ] `npm run version:check` EXIT 0.
- [ ] `npm run encoding:check` EXIT 0.
- [ ] Zero zmian w kodzie runtime, schemacie, VERSION, `?v=`, zero commitów.

## 14. Zewnętrzne oceny planu — analiza, waga i rozstrzygnięcia

Dwie niezależne oceny nie mają tej samej wagi: liczy się **kontakt z kodem**, świeżość względem aktualnej wersji planu i to, czy uwaga prowadzi do mierzalnej zmiany. Ocena 1 deklaruje wprost brak weryfikacji `main` i używa starej numeracji faz (P0–P4), więc częściowo odnosi się do wcześniejszego szkicu. Ocena 2 jest oparta na kodzie, sama koryguje własny błąd (6 → 5 tabel `*_Default`) i wskazuje konkretne sprzeczności w planie.

| Ocena             | Deklarowany wynik                   | Waga     | Trafność                                                                                              | Werdykt                                                 |
| ----------------- | ----------------------------------- | -------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **1** (UX/proces) | 8,8/10                              | **0,45** | Wysoka w warstwie kontraktów bezpieczeństwa; niższa, bo bez weryfikacji kodu i ze starą numeracją faz | Przyjęte punkty 1, 2, 3, 5; punkt 4 częściowo (S1a/S1b) |
| **2** (kod/cel)   | 8/10 inżyniersko, 6/10 cel „prosty" | **0,55** | Wysoka: dowody `file:line`, wykryła sprzeczność S1/S2 i 4 nieprawdy                                   | Przyjęte 2, 3, 4, 5, 6, 8; 1 i 7 częściowo              |

**Wynik ważony (przed korektami):** inżyniersko `8,8 × 0,45 + 8,0 × 0,55 = 8,36 ≈ 8,4/10`; oś celu „prosty, czytelny" — **6/10** (ocena 2), bo LIVE i `*_Default` zostają do S6.

**Po korektach w tym planie (szacunek):** inżyniersko **8,5/10** (ważona średnia wymiarów z 14.4), oś celu **7,5/10** — bez S6 nie da się uczciwie dać więcej; S6 jest warunkowe i poza v1.

### 14.1 Ocena 1 — rozstrzygnięcia

| Punkt | Treść                                              | Werdykt       | Co zmieniono w planie                                                                                                                                                    |
| ----- | -------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | Checks nie są gwarancją; publish musi re-walidować | **SŁUSZNE**   | 6.3: `advisory: true`, `checkedAt`, lista wykrywalnych rzeczy; 6.4: re-walidacja w tx (`status`, kolizja, sha, użycie)                                                   |
| 2     | Semantyka LIVE musi być jawna                      | **SŁUSZNE**   | 5.2 i 6.6: natychmiast widoczne dla `?source=live` i admina; dla ofert tylko fallback przy braku `APPROVED`                                                              |
| 3     | Ostrzeżenie o bazie wersji musi mieć granice       | **SŁUSZNE**   | 6.3: `baseVersion` zawsze `UNVERIFIABLE`; osobne `comparisonToCurrentApproved` (`MATCH`/`DIFFERS`/`NO_CURRENT`) i jawna lista tego, czego checks nie potrafi             |
| 4     | P1 to za dużo na jeden etap                        | **CZĘŚCIOWO** | S1 → S1a (hub + `displayStatus` + F3/F8) i S1b (checks). Nie usunięto checks z paczki P0, bo bez nich hub nie ma bezpieczeństwa publikacji; `approve` przeniesione do S2 |
| 5     | Brak mierzalnych kryteriów wydajności              | **SŁUSZNE**   | 8.2.6: fixture, p95 (300/200/500 ms), asercja braku N+1, FAIL fazy przy przekroczeniu                                                                                    |

### 14.2 Ocena 2 — rozstrzygnięcia

| Punkt | Treść                                                    | Werdykt                          | Co zmieniono w planie                                                                                                             |
| ----- | -------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Złożoność użytkownika znika dopiero w S6                 | **SŁUSZNE, przyjęte jako koszt** | Nie zmieniono decyzji O4; wzmocniono copy LIVE≠DRAFT i S5 (domyślny zapis do draftu, LIVE read-only). S6 pozostaje warunkowe      |
| 2     | 30 dni to za dużo dla jednej firmy                       | **SŁUSZNE**                      | O3, S5, S6, DoD: **14 kolejnych dni + min. 2 wydania**, zero trafień licznika, każde trafienie zeruje okno                        |
| 3     | PRECO ↔ studnie: jawny `precoVersionId` zamiast non-goal | **SŁUSZNE**                      | 10 i 14.5: kandydat **S4+**, osobny GO; nadal bez merge i bez kopiowania wierszy. ADR-007:74 wskazuje ten kierunek                |
| 4     | Sprzeczność: `displayStatus` w S1 i S2                   | **SŁUSZNE**                      | 5.4 i roadmapa: helper w **S1a** obsługuje 6 obecnych statusów; S2 tylko backend/dane. Ryzyko spada z Wysokiego na Średni         |
| 5     | Backdate: najpierw zmierzyć użycie                       | **SŁUSZNE**                      | S0 raportuje liczbę `BACKDATE`/`BACKDATE_REQUESTED`; decyzja o uproszczeniu copy/testów po pomiarze, bez automatycznego usuwania  |
| 6     | Derywowany ACTIVE nie zostawia zdarzenia                 | **SŁUSZNE**                      | 5.3: badge zawsze pokazuje `effectiveFrom`; audyt powstaje przy `approve` (nie przy upływie czasu)                                |
| 7     | Narzut procesu (13 sekcji, 48 wpisów, 16 bramek)         | **CZĘŚCIOWO**                    | 8.1: tierowanie bramek (pełny zestaw na fazę/release, minimum na commit). Ledger zostaje, bo jest dowodem decyzji, nie checklistą |
| 8     | F1/F2 to osobny tor, rozmywają zakres                    | **SŁUSZNE**                      | 7.1: F1/F2 jako tor wydajnościowy w S4; F3 zostaje w S1a (bezpieczeństwo, nie wydajność)                                          |

### 14.3 Czego nie przyjęto i dlaczego

- **Skrócenie S6 do „teraz" / usunięcie LIVE przed S5** — brak dowodu braku użycia; O4 i O3 istnieją właśnie po to, żeby decyzja była oparta na licznikach, nie na opinii.
- **Rezygnacja z backdate bez pomiaru** — preflight ma zmierzyć; dopiero wynik `0` upoważnia do rozmowy o usunięciu copy/testów.
- **Usunięcie ledgera** — zostaje, ale bez wymogu wpisu dla każdego drobnego commita; wpisy dotyczą decyzji i napraw P0/P1.
- **`precoVersionId` w v1** — wymaga kolumny, backfillu i testu eksportu historycznego; to zmiana schematu po S2, więc tylko kandydat z osobnym GO.

### 14.4 Wpływ ocen na ocenę końcową planu

| Wymiar                   | Waga |    Przed | Po korektach | Źródło zmiany                                                     |
| ------------------------ | ---: | -------: | -----------: | ----------------------------------------------------------------- |
| Kontrakty bezpieczeństwa | 0,15 |        8 |        **9** | checks doradcze + re-walidacja `approve` + granice `UNVERIFIABLE` |
| Prostota wdrożenia (FE)  | 0,20 |        7 |        **9** | `displayStatus`/capability w S1a (1 plik), S2 bez zmian widoków   |
| Mierzalność odbioru      | 0,15 |        7 |        **9** | budżety wydajności, jawny raport BACKDATE, bramka O3              |
| Prostota modelu          | 0,30 |        8 |        **8** | bez zmian: LIVE/Default do S6                                     |
| Zakres/ryzyko            | 0,20 |        8 |        **8** | S1a/S1b dodaje etap, ale zmniejsza ryzyko S2                      |
| **Łącznie (inż.)**       | 1,00 | **7,65** |      **8,5** | średnia ważona wymiarów                                           |
| **Cel „prosty"**         |    — |  **6,0** |      **7,5** | copy, S5, 14 dni; pełne 9–10 dopiero po S6                        |

### 14.5 Kandydat S4+: jawne przypięcie PRECO do wersji studni

- **Problem:** resolver po dacie jest deterministyczny tylko przy założeniu, że oś PRECO jest immutable i kompletna; ADR-007:73-74 wskazuje znane ograniczenie i docelową kolumnę `studnieVersion.precoVersionId`.
- **Decyzja:** **nie w v1**; kandydat **S4+**, z osobnym GO. Trigger: pierwszy realny mismatch eksportu albo wymóg audytowy „wskaż dokładnie tę wersję PRECO".
- **Zakres, gdy GO:** kolumna `precoVersionId TEXT?` + backfill resolverem po dacie + zapis przy `approve` studni + test historycznego eksportu. Nadal **bez merge** i bez kopiowania wierszy.

## Następny krok

**GO na S0+S1a+S1b** (bez zmian schematu): `scripts/pricelist-preflight.ts` + raport kolizji i użycia BACKDATE, hub „Cenniki" z 3 widokami, `state` + `displayStatus`/capability na 6 statusach + `APPROVED`, addytywne pola `/summary`, `GET /:id/checks`, naprawa F3/F8. **S2a (migracja statusów + guardy wg 6.8 + przepisanie wszystkich dotkniętych testów) startuje dopiero po:** zielonym S0+S1a+S1b, `npm run pricelist:preflight` EXIT 0 na kopii backupu i osobnym GO na migrację (O1); bez preflightu nie ma S2a. **S2b** (`approve` + aliasy, w tym `publish` + test `checksStale`) po zielonym S2a.

## 15. Realizacja S0+S1a+S1b (2026-10-21)

- [x] S0: `scripts/pricelist-preflight.ts` + `pricelist:preflight`; test `tests/pricelistPreflight.test.ts` (3 PASS); raport `docs/plans/pricelist-preflight-s0.md` — 8 wersji, 0 kolizji, EXIT 0.
- [x] S1a BE: `state`/`deriveState`, addytywne `summary` (`state`, `draftCount`, `approvedCount`, `collisionCount`), `READ_LIMITER` na GET/labels/export.
- [x] S1b BE: `GET /api/pricelist-versions/:id/checks` (admin, read-only, `no-store`) + `getVersionChecks`; testy service 3 PASS.
- [x] S1a FE: etykiety planu + `stateOf`/`displayStatus`/`can*`; hub `cenniki.html` + `cennikiHub.js` (Przegląd/Cennik/Historia), kafelek i moduł SPA.
- [x] F3 (limiter) i F8 (`loadPrecoPricing({source:'active'})`).
- [x] Bramy: typecheck, typecheck:frontend, lint, lint:frontend, build, ratchet, version:check, encoding:check, collisions:check (45/45), format.
- [x] S2a/S2b kod: model 2 statusów, resolver `APPROVED`, guardy wg 6.8, partial unique w migracji, `approve` + aliasy z `Deprecation`/`Sunset`, checks staleness. Testy: `pricelistVersions.*` 149+ PASS, `test:quick` 5059 PASS (1 flaky timeout `claimIdempotencyHttp` zielony solo).
- [ ] S2a deploy: backup → `npm run pricelist:preflight` EXIT 0 → osobny GO → `migrate deploy/status`. Bez tego baza nie ma indeksu `uq_pricelist_version_approved`.
- [x] S3: `VersionDiff.totalChanges`, jawny licznik w modalu diffu, historia 9 kolumn (Nota/Kontrola), deep-link `#/cenniki/historia?type=&version|id=&against=`, import z błędami per-komórka (klient + 422 `details`, modal bez częściowego zapisu). Testy: `pricelistXlsx` 17 PASS, `pricelistImportTarget` 17 PASS, router/hub 16 PASS.
- [x] S3 bramka pełna: `test:e2e-pricelist-preview:spawn` PASS + `test:axe` 5/5 PASS; nowy spec `a11yAxe.spec.ts` „cenniki hub — historia (deep-link)" ładuje `#/cenniki/historia?type=rury` w iframe i filtruje wyłącznie znany artefakt transparentnego body iframe (bg `#ffffff`).
- Odstępstwo: hub używa osobnego `public/cenniki.html` (iframe SPA), bo plan nie przewidywał nowego shell HTML; logika zapisu pozostaje w edytorach.
- Odstępstwo: F5 (hash PRECO order-sensitive) pozostaje otwarte — nie blokuje S3, bo dedup porównuje hash zapisany przez BE; kandydat na osobną zmianę.
