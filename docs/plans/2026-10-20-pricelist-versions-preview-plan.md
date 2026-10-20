# Plan wdrożenia: podgląd starych cen, porównanie wersji i parytet PRECO

- **Data:** 2026-10-20
- **Status:** DONE — wdrożone commity: `be727c1`, `1a4b562`, `594ef54`, `82aa0a4`, `5cfa477`, `111c596`, `4adbf91`, `3b8f96f`, `f72d4c1` (docs w toku). Wszystkie fazy 1–6 zrealizowane; preview/diff/summary, parytet PRECO i kafelki z deep-linkiem.
  E2E Playwright (`tests/playwright/pricelistPreview.cjs`) pozostaje do dodania przy najbliższym
  uruchomieniu serwera testowego; pokrycie zastępcze: 7 testów `pricelistAdminTiles.test.ts`
  (deep-link, guard, kolejność panel → preview) + testy backendowe preview/diff/summary.
- **Wersja aplikacji:** 1.46.5
- **Zakres:** panel wersji cenników (Rury/Studnie/PRECO), podgląd i porównanie wersji, guard usuwania PRECO, kafelki cenników na pulpicie admina
- **Poza zakresem:** workflow zatwierdzania, zmiany schematu Prisma, `GET /:id/integrity`, naprawa orders stamp guard, masowe przepisywanie legacy, paginacja >5k wierszy

## 1. Cel i kryteria sukcesu

Admin ma mieć możliwość:

1. Podejrzeć zawartość dowolnej wersji cennika (Rury, Studnie, PRECO) bez eksportu XLSX.
2. Porównać dowolne dwie wersje tego samego typu, nie tylko `seq-1`.
3. Zarządzać wersjami PRECO z pełnym parytetem: zapis z LIVE, publikacja, aktywacja, wstecz, klon, diff, eksport, usuwanie.
4. Wejść w panel wersji z pulpitu admina przez 3 kafelki (Rury/Studnie/PRECO) oraz deep-link.

Sukces = wszystkie bramy `npm run validate`, `version:check`, `encoding:check`, `format` na EXIT 0; nowe testy w `test:quick`; brak nowych inline handlerów i niekontrolowanych globali.

## 2. Decyzje zatwierdzone

| ID  | Decyzja                                                                | Uzasadnienie                                                                  |
| --- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| D1  | Resolver PRECO filtruje statusy do `ACTIVE`, `BACKDATE`, `ARCHIVED`    | DRAFT/SCHEDULED/BACKDATE_REQUESTED nie mogą wejść do historycznego eksportu   |
| D2  | Usunięcie PRECO blokowane, gdy dowolna wersja studni wskazuje tę PRECO | Historia eksportu studni nie może stracić PRECO; dotyczy też wersji roboczych |
| D3  | Diff PRECO: ceny kinet po polach, konfig/zakresy jako liczniki         | Mały payload, brak fałszywych added/removed przez indeksowe `id`              |

**Doprecyzowanie D2 (po przeglądzie):** „wskazuje” = wersja studni (dowolny status) wybiera tę PRECO przez resolver **po D1**. DRAFT/SCHEDULED PRECO nigdy nie jest wybierane, więc nie może być referencją. Test „DRAFT PRECO → 409” jest błędny; poprawny scenariusz to **ARCHIVED PRECO + DRAFT wersja studni → 409**.

## 3. Dowody z kodu (stan wyjściowy)

| Fakt                                                                    | Dowód                                                                                                       |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `getVersionDiff` twardo bierze `seq-1`                                  | `src/services/pricelist/export.ts:116-118`                                                                  |
| Resolver PRECO nie filtruje statusu                                     | `src/services/pricelist/export.ts:211-220`                                                                  |
| `deleteVersion` sprawdza użycie tylko poza allowlistą                   | `src/services/pricelist/lifecycle.ts:581-591`                                                               |
| `loadVersionItems` bez `orderBy`                                        | `src/services/pricelist/validation.ts:360-382`                                                              |
| `GET /` robi 4 county na wersję                                         | `src/routes/pricelistVersions.ts:84-89`                                                                     |
| Router przekazuje parametry do iframe, ale reloaduje tylko `edit/order` | `public/js/spa/router.js:452-460, 601-619, 695-702`                                                         |
| Testy panelu czytają bezpośrednio jeden plik                            | `tests/frontend/pricelistChrome.test.ts`, `pricelistPanelClarity.test.ts`, `appConfirmMigration.test.ts:26` |
| Panel ma 1411 linii i `wirePanel` ~294 linie                            | `public/js/shared/pricelistVersions.js`                                                                     |
| PRECO nie ma pieczątki w ofertach; `countUsage` liczy 4 tabele          | `src/services/pricelist/usage.ts:25-44`                                                                     |
| `diffById` porównuje cały wiersz, nie tylko cenę                        | `src/services/priceOverrideService.ts:144-164`                                                              |
| `precoNestedToFlat` zwraca dokładnie `{konfig,kinety,zakresy}`          | `public/js/shared/pricelistXlsx.js:213-271`                                                                 |
| `precoPricing` getter i `collectPrecoFromUI` istnieją                   | `public/js/studnie/globals.js:540`, `pricelistPreco.js:300`                                                 |
| Panel ładowany przed `pricelistXlsx.js` i `pricelistPreco.js`           | `public/studnie.html:332,347,349`                                                                           |

## 4. Wnioski z przeglądu 10 agentów

| Agent                | Werdykt              | Najważniejsza korekta                                                                 |
| -------------------- | -------------------- | ------------------------------------------------------------------------------------- |
| architect            | APPROVE WITH CHANGES | Usunąć Fazę 0; dodać `precoIncluded`/`precoVersion`; guard bezwarunkowy w tx          |
| build-error-resolver | WARUNKOWO            | D1 łamie `exportShape`; e55 mock, delete txMock, ikony, `VersionDiff` typ             |
| code-reviewer        | WARUNKOWO BLOCK      | D1↔D2 sprzeczne; duplikaty kluczy naturalnych; race locków; deep-link kolejność       |
| doc-updater          | WARUNKOWO            | Braki w CENNIKI/API/README/UI_GUIDELINES/SECURITY/ADR-007                             |
| e2e-runner           | WARUNKOWO OK         | Playwright must-have dla deep-link i preview; izolacja DB/port; nie aktywować wersji  |
| general              | NIE GOTOWY           | Preview ≠ eksport; D2 blokuje prawie każdą historyczną PRECO; nowy global zbędny      |
| explore              | —                    | Pominięte: `appConfirmMigration`, `productsStudnieV2`, barrel, CSS, script order      |
| planner              | WARUNKOWO OK         | D1/D2 najpierw; mniejsze commity; testy per commit; szacunek ~7-9 dni                 |
| refactor-cleaner     | SPLIT NIEUZASADNIONY | 1411 linii w limicie; rozszerzyć `openDiff`, nowy moduł tylko preview; reuse helperów |
| security-reviewer    | WARUNKOWO OK         | Walidacja `id` na wszystkich trasach; cap preview; XSS testy; `no-store`              |

**Decyzja po przeglądzie:** **Faza 0 (podział na 5 plików) zostaje usunięta.** Plik mieści się w limicie 1000–1500 linii; realny problem to `wirePanel`, który można rozwiązać mapą handlerów w tym samym pliku. Zamiast tego powstaje **jeden** nowy plik `pricelistVersionPreview.js`, a nowe funkcje dopinają się do istniejącego `window.pricelistVersions` (bez nowego globala). To eliminuje 5 tagów `<script>`, zmiany w `appConfirmMigration.test.ts` i 6 miejsc odczytu w `pricelistChrome.test.ts`.

## 5. Kontrakt API

Wszystkie nowe odczyty: `requireAuth + requireAdmin`, `READ_LIMITER` (600/min), `Cache-Control: no-store`.

| Endpoint                                            | Odpowiedź 200                                                                      | Błędy                                                                          |
| --------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `GET /api/pricelist-versions/summary`               | `{ generatedAt, types: { rury, studnie, preco: { active, nextScheduled } } }`      | 500                                                                            |
| `GET /api/pricelist-versions/:id/preview`           | `{ version, sheets, counts, totalRows, truncated, precoIncluded?, precoVersion? }` | 400 `INVALID_ID`, 404 `NOT_FOUND`, 413 `VERSION_TOO_LARGE`, 422 `INVALID_TYPE` |
| `GET /api/pricelist-versions/:id/diff?against=<id>` | `VersionDiff` + `from`, `to`                                                       | 400 `INVALID_QUERY`, 404 `NOT_FOUND`/`AGAINST_NOT_FOUND`, 422 `TYPE_MISMATCH`  |

- `active` = `resolveActive(type)`; `nextScheduled` = najwcześniejsza `SCHEDULED` z `effectiveFrom > now`; `due` tylko informacyjnie (cron ≤5 min), nie steruje UI.
- `preview`: `projectVersionToLiveShape(type, sections)`; PRECO → `PRECO_Kinety`, `PRECO_Zakresy`, `PRECO_Dodatki`.
- Dla studni preview **nie dokleja** PRECO do `sheets` (to zawartość wersji), ale zwraca `precoIncluded` i `precoVersion`, żeby UI pokazało „Eksport dołączy PRECO vX”. To domyka rozjazd preview ≠ eksport bez kopiowania logiki eksportu.
- `diff` bez `against` zachowuje `seq-1`; z `against` dowolna para tego samego typu.
- Kierunek: `from = against`, `to = id`. `version = to.version`; `previousVersion = from.version ?? null` (kompatybilność); `from`/`to` = `{ id, version, seq }`.
- `id`/`against`: `z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/)` (jeden schemat, bez duplikatu). **Walidacja `:id` na wszystkich trasach** (`preview`, `diff`, `export`, `publish`, `activate`, `backdate`, `clone-draft`, `DELETE`, `PUT`), nie tylko nowych. Invalid → `400 INVALID_ID` **bez echa surowego id** w treści/logu.
- `precoVersion` (tylko `studnie`) = `{ id, version, seq } | null`; `precoIncluded` = `Boolean(precoVersion)`. Dla `rury`/`preco` oba klucze **nieobecne**.
- `MAX_PREVIEW_ROWS = 5000` — preview obcina każdy arkusz do limitu, `truncated=true`, `totalRows` = rzeczywista liczba.
- `MAX_COMPARE_ROWS = 20000` — `totalRows` powyżej limitu → `413 VERSION_TOO_LARGE` **przed** cięciem arkuszy (odpowiedź nie rośnie z liczbą arkuszy).
- `counts.bySheet`/`totalRows` liczone po projekcji (`projectVersionToLiveShape`), nie z rekordów DB (PRECO zakresy rozwijają się per grupa).
- `Cache-Control: no-store` także dla `GET /`, `GET /labels`, `GET /:id/diff` i `GET /:id/export`.
- Kolejność tras: `GET /`, `GET /labels`, `GET /summary`, `POST ...`, `GET /:id/preview`, `GET /:id/diff`, `GET /:id/export`, `DELETE/PUT /:id`.

## 6. Faza 0 — decyzja: brak refaktoru

Nie dzielimy `pricelistVersions.js`. Uzasadnienie:

- 1411 linii mieści się w limicie AGENTS.md (1000–1500); podział „na linie” jest zabroniony.
- 5 modułów wymagałoby współdzielonego `labelCache`, `state`, `getRowsByType` → nowy namespace lub nowe globale.
- Helper sklejający testy maskuje brakujący `<script>`; testy źródłowe i tak nie dowodzą runtime.
- `appConfirmMigration.test.ts:26` czyta ten plik i wymaga `pvConfirm` — split wymusza jego zmianę bez wartości produktowej.

Zamiast tego:

- `pricelistVersions.js` dostaje `openDiff(id, againstId?)`, `openPreview` (delegacja) i `openFromDeepLink`.
- Nowy `pricelistVersionPreview.js` dopina się przez `Object.assign(window.pricelistVersions, {...})`; **zero nowych globali**.
- Load order: `pricelistVersions.js` → `pricelistVersionPreview.js` w `rury.html` i `studnie.html`; `kartoteka.html` bez preview (tylko badge).
- `wirePanel` można skrócić mapą handlerów dopiero przy okazji, jeśli przekroczy 1500 linii — nie teraz.

## 7. Faza 1 — D1: resolver PRECO (pierwszy commit)

### `src/services/pricelist/export.ts`

- Nowa stała `PRECO_REFERENCE_STATUSES = ['ACTIVE','BACKDATE','ARCHIVED']` (nie reużywać `RESOLVABLE_STATUSES`).
- `pickPrecoVersionForStudnie(studnieVersion, client = prisma)`:
    - filtr statusów,
    - `effectiveFrom <= version.effectiveFrom`, sort `effectiveFrom desc, seq desc`,
    - fallback `seq <=` **tylko** dla wersji bez `effectiveFrom` (legacy/mocki), z tym samym filtrem,
    - przyjmuje `client`, żeby działać w `tx`.
- `getVersionExportSheets` używa helpera; brak PRECO → `precoIncluded:false`.
- D1 dotyczy też `?source=active` w `productsStudnieV2.ts:397` — to zamierzone; dodać test.

### Testy D1

- `tests/pricelistVersions.exportShape.test.ts`: seed PRECO `ARCHIVED` zamiast `DRAFT`; mock `findFirst` obsługuje `status.in` i `effectiveFrom.lte` oraz tablicowy `orderBy`.
- Nowy `tests/pricelistVersions.precoResolver.test.ts`: DRAFT/SCHEDULED/BACKDATE_REQUESTED → brak PRECO; ARCHIVED → jest; legacy bez `effectiveFrom` → fallback `seq <=` z filtrem.
- RED→GREEN: najpierw test na starym kodzie (DRAFT wchodzi), potem fix.

## 8. Faza 2 — D2: guard usuwania PRECO (drugi commit)

### `src/services/pricelist/usage.ts`

- `getPrecoReferences(client)` — jedna lista wersji studni + mapa wersji PRECO; dla każdej studni wybiera resolverem D1; zwraca `Map<precoId, { count, labels: string[] }>`.
- `countPrecoReferences(client, precoId)` — z mapy; **ten sam helper** co eksport.
- `getVersionsSummary()` — 3× `resolveActive` + 3× najbliższa `SCHEDULED`; test spy: ≤6 zapytań.
- `usedByKind: 'offers' | 'studnieVersions'`; dla PRECO `usedBy` = liczba referencji.

### `src/services/pricelist/lifecycle.ts`

- `deleteVersion` dla `type === 'preco'`:
    - status ACTIVE/BACKDATE → `409 NOT_DELETABLE` **pierwsze** (bez zmian),
    - następnie guard referencji; dla DRAFT/SCHEDULED/BACKDATE_REQUESTED też (zwróci 0 po D1, ale bezwarunkowo),
    - referencje > 0 → `409 USED_BY_STUDNIE`, komunikat z liczbą i max 3 labelkami,
    - re-check w `$transaction` z tym samym `tx`.
- **Race cross-type:** delete PRECO pozyskuje locki w stałej kolejności `preco → studnie` (nested `runWithLock`), bo `createDraft('studnie')` bierze tylko lock studni. Dodać test współbieżny. Ograniczenie: nadal możliwa zmiana referencji przez operację, która nie bierze locka studni — udokumentować w ADR-007 jako znane; docelowo kolumna `studnieVersion.precoVersionId` (poza zakresem).
- Audit DELETE: `oldData` z `references` dla PRECO.

### `src/services/pricelistVersionService.ts`

- Barrel: eksport `getVersionPreview`, `getVersionDiff` (nowa sygnatura), `pickPrecoVersionForStudnie`, `getVersionsSummary`, `countPrecoReferences`, `getPrecoReferences`.

### Testy D2

- `tests/pricelistVersions.delete.test.ts`: txMock z `pricelistVersion.findMany`; top-level mock z nowymi funkcjami.
- Nowy `tests/pricelistVersions.precoGuard.test.ts`: ARCHIVED PRECO + DRAFT studnie → 409; wiele wersji → liczba i max 3 labelki; ACTIVE/BACKDATE → `NOT_DELETABLE` przed guardem; DRAFT PRECO bez ref → 200 + kaskada; re-check w tx; współbieżny delete.

## 9. Faza 3 — backend preview/diff/summary

> **Commit 3 = tylko backend preview i ma pełny zakres w §9.1.** Reszta tej sekcji opisuje commity 4–5 (`against=`, `/summary`).

### 9.1 Commit 3 — dokładny zakres: `GET /:id/preview`

**Cel:** jeden read-only endpoint zwracający zawartość wersji w shape LIVE **bez** doklejania PRECO do `sheets`, ale z informacją, którą PRECO dołączyłby eksport. `getVersionDiff` i `/summary` zostają nietknięte (commity 4–5).

**Pliki (3 src + 2 testy, zero innych):**

| Plik                                             | Zmiana                                                                                  |
| ------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `src/services/pricelist/export.ts`               | dopisane `MAX_PREVIEW_ROWS`, `MAX_COMPARE_ROWS`, `VersionPreview*`, `getVersionPreview` |
| `src/services/pricelistVersionService.ts`        | barrel: `getVersionPreview` + typ `VersionPreview`                                      |
| `src/routes/pricelistVersions.ts`                | `GET /:id/preview`, `versionIdParamsSchema` na górę + regex, `no-store`, `READ_LIMITER` |
| `tests/pricelistVersions.preview.test.ts` (nowy) | harness HTTP: 401/403/400/404/413/422, counts, truncation, `precoVersion`, no-store     |
| `tests/security/e55gate.test.ts` (rozszerzyć)    | 401/403 dla nowego GET, złe `id` bez echa                                               |

**Sygnatury — SSoT dla implementacji:**

```ts
// src/services/pricelist/export.ts
export const MAX_PREVIEW_ROWS = 5000;
export const MAX_COMPARE_ROWS = 20000;

export interface VersionPreviewPrecoRef {
    id: string;
    version: string;
    seq: number;
}

export interface VersionPreview {
    version: PricelistVersion;
    sheets: LiveSheetRows;
    counts: { totalRows: number; bySheet: Record<string, number> };
    totalRows: number;
    truncated: boolean;
    /** Tylko `studnie` — czy eksport dokleiłby PRECO. */
    precoIncluded?: boolean;
    /** Tylko `studnie` — którą wersję PRECO eksport by dokleił (D1). */
    precoVersion?: VersionPreviewPrecoRef | null;
}

export async function getVersionPreview(id: string): Promise<VersionPreview>;
```

**Kolejność (test-first, każdy krok zielony przed następnym):**

1. **RED** — `tests/pricelistVersions.preview.test.ts`: harness + przypadki z tabeli niżej. Na starym kodzie `GET /:id/preview` → 404/HTML (route nie istnieje) = dowód braku funkcji.
2. **GREEN service** — `export.ts`: stałe + `getVersionPreview` **dopisane na końcu pliku**; zero edycji istniejących funkcji.
3. **barrel** — `pricelistVersionService.ts`: nowe eksporty serwisu + typów.
4. **schema** — `versionIdParamsSchema` przenieść nad pierwszy handler (dziś w `:338`, używany wyżej przez DELETE/PUT/clone-draft) i zaostrzyć do `z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/)`. UUID-y Prisma przechodzą; efekt uboczny: egzotyczne `id` w DELETE/PUT/clone → `400 INVALID_ID` zamiast 404 (zamierzone, §5).
5. **route** — `GET /:id/preview` po `POST /activate-due`, przed `GET /:id/diff`; `requireAuth, requireAdmin, READ_LIMITER`; `res.setHeader('Cache-Control','no-store')` **przed** parsowaniem (nagłówek też na 400/404/422); `safeParse(req.params)` → 400 bez echa `id`; reszta przez `sendVersionError`. `no-store` dodać też do `GET /`, `GET /labels`, `GET /:id/diff` i `GET /:id/export` (§5).
6. **e55gate** — mock serwisu: `getVersionPreview: jest.fn()`; 3 przypadki.
7. **bramy** — §16.1 (bez `test:quick`).

**Algorytm `getVersionPreview` (kolejność operacji ma znaczenie):**

1. `const { version, sections } = await getVersionExport(id);` — 404/422 przychodzą z istniejącej funkcji, bez duplikatu walidacji.
2. `isPricelistType(version.type)` guard (narrowing TS) — jak w `getVersionExportSheets`.
3. `const sheets = projectVersionToLiveShape(type, sections);` — **nie** `getVersionExportSheets` (tam eksport dokleja arkusze PRECO; preview pokazuje wyłącznie zawartość wersji).
4. `counts.bySheet[name] = rows.length` **po projekcji**; `totalRows` = suma. `counts.totalRows === totalRows` (dwa pola w kontrakcie, jedna wartość).
5. jeśli `totalRows > MAX_COMPARE_ROWS` → `413 VERSION_TOO_LARGE` **przed** cięciem; dopiero potem każdy arkusz `slice(0, MAX_PREVIEW_ROWS)`, a `truncated` = którykolwiek arkusz dłuższy niż limit.
6. tylko `studnie`: `const pv = await pickPrecoVersionForStudnie(version);` → `precoIncluded = Boolean(pv)`, `precoVersion = pv ? { id: pv.id, version: pv.version, seq: pv.seq } : null`. **Bez** `getVersionExport(pv.id)` — to jest granica preview ≠ eksport.
7. `rury`/`preco`: nie ustawiać `precoIncluded`/`precoVersion`.

**Testy commit 3 (`tests/pricelistVersions.preview.test.ts`):**

Harness: `express()` + prawdziwy router + prawdziwy serwis; mock tylko `middleware/auth` (nagłówki `x-test-*` jak w e55gate), `middleware/rateLimiters` (pass-through) i `prismaClient` (in-memory; kopia mocka z `pricelistVersions.exportShape.test.ts`: `findUnique`, `findFirst` z `status.in` / `effectiveFrom.lte` / tablicowym `orderBy` + 5 delegatów `findMany`). Bez `$transaction`.

| #   | Przypadek                               | Oczekiwanie                                                                             |
| --- | --------------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | anon                                    | 401, serwis niewołany                                                                   |
| 2   | user                                    | 403, serwis niewołany                                                                   |
| 3   | admin, wersja rury                      | 200, `sheets: { 'Cennik Rury': [...] }`, brak kluczy PRECO                              |
| 4   | admin, studnie + ARCHIVED PRECO w dacie | `precoIncluded: true`, `precoVersion: { id, version, seq }`, `sheets` **bez** `PRECO_*` |
| 5   | admin, studnie bez PRECO                | `precoIncluded: false`, `precoVersion: null`                                            |
| 6   | admin, nieistniejące id                 | 404 `NOT_FOUND`                                                                         |
| 7   | `../`, `<script>`, 10000 znaków, `%00`  | 400 `INVALID_ID`, body nie zawiera wejścia                                              |
| 8   | wersja z typem spoza allowlisty         | 422 `INVALID_TYPE`                                                                      |
| 9   | arkusz 5001 wierszy                     | arkusz 5000, `counts.bySheet` = 5001, `totalRows` = 5001, `truncated: true`             |
| 10  | `Cache-Control`                         | `no-store` na 200, 400, 404 i 413                                                       |
| 11  | `totalRows` 20001                       | 413 `VERSION_TOO_LARGE`, brak `sheets`, `no-store`                                      |

`e55gate` (3 przypadki): `GET /:id/preview` anon → 401, user → 403, admin + złe `id` → 400 bez echa.

**Zależności od D1/D2:**

- D1 (`be727c1`): `PRECO_REFERENCE_STATUSES`, `pickPrecoVersionFromTimeline`, `pickPrecoVersionForStudnie` w `export.ts`. Preview **musi** użyć async `pickPrecoVersionForStudnie`, nie `pickPrecoVersionFromTimeline` — inaczej `precoVersion` rozjedzie się z eksportem.
- D2 (`1a4b562`): `getPrecoReferences` nie jest potrzebne w preview (potrzebne w `GET /`, commit 5). Mock `findFirst` z D1 (`status.in`, `effectiveFrom.lte`, tablicowy `orderBy`) jest gotowym wzorcem dla `preview.test.ts`.
- Wspólny invariant: preview i eksport muszą wskazać tę samą PRECO dla tej samej wersji studni — przypadek 4 jest kontraktem.

**Ryzyka regresji:**

- `getVersionExport` jest współdzielone z eksportem; nowa funkcja tylko czyta → brak wpływu, ale edycja istniejących funkcji = ryzyko eksportu. Zakaz w commit 3.
- Zaostrzenie `versionIdParamsSchema` dotyka DELETE/PUT/clone — targeted suite musi objąć `pricelistVersions.delete.test.ts` i `pricelistVersions.f2.test.ts`.
- `getVersionExport` ładuje wszystkie wiersze przed liczeniem: cap chroni tylko odpowiedź. `ponytail: cap po load; count przed findMany, jeśli duże wersje zaczną boleć`.
- `READ_LIMITER` ma stan per-proces — w testach pass-through, inaczej flaky 429.

**DoD commit 3:**

- [ ] `GET /api/pricelist-versions/:id/preview` admin-only, `READ_LIMITER`, `no-store`, walidacja `id` bez echa.
- [ ] 3 typy: rury (1 arkusz), studnie (arkusze wg `liveStudnieSheetName`), preco (3 arkusze).
- [ ] `precoIncluded`/`precoVersion` zgodne z `getVersionExportSheets` (ten sam `pickPrecoVersionForStudnie`).
- [ ] `truncated`/`counts`/`totalRows` z projekcji, nie z DB; `> 20000` → 413 przed cięciem.
- [ ] Zero `prisma.*` w route; zero zmian w istniejących funkcjach `export.ts`.
- [ ] Bramy z §16.1 EXIT 0; `version:check` bez zmian (wersja i markery nietknięte).

**Czego nie robić w commit 3:**

- Nie zmieniać `getVersionExportSheets` / `X-Preco-Included`, `getVersionDiff` (commit 4), `/summary` (commit 5).
- Nie dodawać `precoVersion` do eksportu XLSX — to zmiana kontraktu eksportu, nie preview.
- Nie ruszać `GET /` (batch `getPrecoReferences`), `loadVersionItems` `orderBy`, frontendu, docs, Prisma, wersji.
- Nie dodawać `READ_LIMITER` do `GET /:id/export` ani POST-ów (higiena przed release, osobno).
- Nie uruchamiać pełnego `test:quick`/`validate` — równoległe agenty; tylko targeted suite z §16.1.

### `src/services/pricelist/export.ts`

- `getVersionPreview(id)`:
    - `getVersionExport` + `projectVersionToLiveShape`,
    - `counts = { totalRows, bySheet }`,
    - `truncated` po `MAX_PREVIEW_ROWS`,
    - dla studni: `precoIncluded`, `precoVersion` z `pickPrecoVersionForStudnie`,
    - dla PRECO: `precoIncluded` nie dotyczy.
- `getVersionDiff(id, againstId?)`:
    - brak `against` → `seq-1`; jawne `against` → walidacja istnienia i typu,
    - `from`/`to`, `version`/`previousVersion` wg kontraktu,
    - rury/studnie: `diffById` (changed = cały wiersz, nie tylko cena),
    - PRECO: klucze naturalne:
        - konfig: `key`,
        - kinety: `wellDn|dn|order` (disambiguacja `dn:0`),
        - zakresy: `wellDn|label|min|max|order`,
    - `changes` PRECO: osobne wpisy `field: 'height' | 'cena'`; top 100 po `|deltaPct|`,
    - `sections` PRECO: liczniki po kluczach; duplikaty klucza → occurrence suffix, test.
- Nie zmieniać `loadVersionItems` o `orderBy`; preview sortuje w serwisie/UI.

### `src/routes/pricelistVersions.ts`

- 3 cienkie handlery; zero `prisma.*` w route (ratchet).
- `GET /` dla PRECO używa `getPrecoReferences` (batch); rury/studnie bez zmian.
- `/:id/diff` parsuje `against` przez `z.string().safeParse`.
- `READ_LIMITER` dla nowych GET; `no-store` także `/` i `/labels`.
- `GET /summary` przed `/:id/preview`; brak `GET /:id`, więc kolizji nie ma, ale kolejność trzymana na przyszłość.

### Testy backend

- `tests/pricelistVersions.preview.test.ts`: 401/403, 400 `INVALID_ID`, 404, `INVALID_TYPE`, kształt 3 typów, `precoIncluded`, `truncated`, `no-store`, counts/truncation.
- `tests/pricelistVersions.compare.test.ts`: `seq-1`, `against`, ten sam id → 400, cross-type → 422, `AGAINST_NOT_FOUND`, cap 100, `deltaPct=null` przy 0, PRECO dwa pola, duplikaty kluczy.
- `tests/pricelistVersions.summary.test.ts`: kształt, pusty stan, `nextScheduled`, spy ≤6 zapytań, brak N×4.
- `tests/security/e55gate.test.ts`: nowe GET 401/403; mock serwisu rozszerzony o nowe eksporty; złe id (`../`, 10k, `<script>`, `%00`) → 400 bez echa; `against===id` → 400.

## 10. Faza 4 — UI: podgląd i porównanie

Nowy `public/js/shared/pricelistVersionPreview.js`:

- `Object.assign(window.pricelistVersions, { openPreview, openCompare, openFromDeepLink })`.
- Modal read-only, search, licznik, tabela przewijana.
- Rury/studnie: kolumny z `sheets`; PRECO: 3 zakładki arkuszy.
- `konfig.value` i `grupy` parsować w `try/catch`; renderować jako tekst (`textContent`/`escapeHtml`).
- Porównanie: rozszerzyć istniejący `openDiff(id, againstId?)` zamiast pisać `compareHtml` od zera; dwa `<select>`, domyślnie bieżąca vs `seq-1`; `GET /:id/diff?against=`.
- PRECO: zmiany kinet z etykietą `DN{wellDn} / rura {dn}`, pole `prosta`/`dod. wlot`; konfig/zakresy jako liczniki.
- W `renderRows`: przyciski `Podgląd` (`eye`) i `Porównaj` (`git-compare` **nie istnieje** — użyć istniejącej ikony, np. `arrow-left-right` lub `columns`; sprawdzić `iconsSlim.js` testem).
- Zero inline `onclick`/`style`; `data-csp`, `addEventListener`, `escapeHtmlAttr`; blokada przycisków w trakcie requestu.
- CSS: ~20 linii w `style.responsive.css` (panel), kafelki w `index.css`; bez nowego systemu.

## 11. Faza 5 — parytet PRECO

W `pricelistVersions.js` / `pricelistManager.js`:

- `availableTypes()` zostaje capability-based; dodaje `preco` tylko gdy `typeof window.collectPrecoFromUI === 'function'` i `window.pricelistXlsx?.precoNestedToFlat`; na `rury.html`/`kartoteka.html` tab Preco się nie pojawia.
- `openStudnieVersionsPanel(initialType?)` przyjmuje typ i przekazuje mapę `{ studnie, rury, preco }` do `openVersionsPanel`; `preco` getRows = `collectPrecoFromUI()` → `precoNestedToFlat`, fallback `window.precoPricing`.
- „Zapisz jako wersję” z LIVE: `POST /api/pricelist-versions/preco/drafts` z `{ rows, note }`.
- Pełny cykl: publish, activate, backdate, clone, diff, export, delete.
- `usedByCell(v)` czyta `v.usedByKind`: PRECO „wersji studni”, reszta „ofert/zamówień”; fallback dla braku pola.
- `deleteReason`: PRECO `usedBy > 0` sprawdzane **przed** `isDeletable`; ACTIVE/BACKDATE bez zmian.
- Transfer: dla PRECO ukryć import/eksport LIVE, pokazać „Import PRECO przez import studni”.
- Deduplikacja draftów PRECO: identyczne `rows` + istniejący DRAFT PRECO → `PUT` zamiast nowego `POST` (lub `409 DUPLICATE_DRAFT`); decyzja przed implementacją, test.

## 12. Faza 6 — kafelki admina + deep-link

### `public/index.html`

- Sekcja „Cenniki” w `#admin-panel` przed „Zarządzanie Użytkownikami” (`:814`).
- 3 kafelki `<a class="admin-stat-card">`, reuse `.admin-stats-row`:
    - `app.html#/rury?tab=pricelist&panel=versions`
    - `app.html#/studnie?tab=pricelist&panel=versions`
    - `app.html#/studnie?tab=pricelist&panel=versions&pvtype=preco`
- Treść: aktywna wersja, `effectiveFrom`, najbliższa zaplanowana; `aria-live="polite"`, `title`, `aria-label`.
- CSS: tylko kursor/hover dla anchor + ewentualny compact.

### `public/js/shared/dashboard.js`

- W gałęzi admina `showLoggedIn` (`:273-288`) jeden `fetch('/api/pricelist-versions/summary')`.
- Hydratacja przez `textContent`; fail-soft (`—`, bez toastu). Bez pollingu, bez nowego globala.

### `public/js/spa/router.js`

- `params.panel` dodać do **pre-nawigacyjnego** guardu dirty (`:601-605`) razem z `edit/order`; confirm **przed** `showSection`.
- Po `showSection` (`:695-702`): jeśli `panel=versions`, wywołać modułowy global:
    - rury → `iframeWin.openRuryVersionsPanel()`,
    - studnie → `iframeWin.openStudnieVersionsPanel(pvtype || 'studnie')`.
- Następnie `iframeWin.pricelistVersions.openFromDeepLink({ type, versionId, againstId })` w `try/catch`.
- `pvtype` allowlist: rury → tylko `rury`; studnie → `studnie|preco`; niepoprawne ignorować.
- `version`/`against`: regex; niepoprawne ignorować.
- `panel/pvtype/version/against` nie mogą trafić do `_logicalSrcKey`/`src` iframe; `_buildModuleSrc` bez zmian, ale `_logicalSrcKey` filtruje te parametry.
- `_lastCleanHash` ustawiać po confirm, nie przed; test back/forward i anulowania.
- Po zamknięciu panelu nie zostawiać `panel` w URL (opcjonalnie `history.replaceState`); jeśli zostaje, refresh ma otwierać panel — świadoma decyzja.

## 13. Testy — pełna macierz

| Plik                                                        | Zakres                                                                                                             |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `tests/pricelistVersions.precoResolver.test.ts`             | D1: statusy, legacy fallback, `precoIncluded`                                                                      |
| `tests/pricelistVersions.delete.test.ts`                    | D2: ARCHIVED + DRAFT studnie → 409, liczba/labelki, ACTIVE first, re-check w tx, współbieżność                     |
| `tests/pricelistVersions.preview.test.ts`                   | 401/403, 400 `INVALID_ID`, 404, 413, 422, D1 negative, `no-store`, counts/truncation                               |
| `tests/pricelistVersions.compare.test.ts`                   | `seq-1`, `against`, same id, cross-type, `AGAINST_NOT_FOUND`, cap 100, PRECO pola i duplikaty                      |
| `tests/pricelistVersions.summary.test.ts`                   | kształt, pusty stan, `nextScheduled`, spy ≤6 zapytań                                                               |
| `tests/frontend/pricelistPreview.test.ts`                   | VM: escape `<img onerror>`, `textContent` dla JSON, null-safe, `data-csp`, brak inline, pusty stan, malformed JSON |
| `tests/frontend/pricelistAdminTiles.test.ts`                | kafelki tylko w `#admin-panel`, dokładne href, hydratacja, fail-soft                                               |
| `tests/frontend/pricelistPanelClarity.test.ts` (rozszerzyć) | tab Preco, save z LIVE, `usedByKind`, `openPreview`, `openDiff(id, against)`                                       |
| `tests/security/e55gate.test.ts` (rozszerzyć)               | nowe GET 401/403, złe id bez echa, CSRF POST draft, `against===id`                                                 |
| `tests/playwright/pricelistPreview.cjs` (must-have)         | deep-link → panel Preco; preview/compare bez mutacji; PRECO draft body przez route mock                            |
| `tests/frontend/iconsCoverage.test.ts` (jeśli ikony)        | nowe ikony istnieją w `iconsSlim.js` lub użyto istniejących                                                        |

Regresja D1/D2: najpierw test na starym kodzie (FAIL), potem minimalna zmiana (PASS). Testy per commit, nie na końcu.

## 14. Dokumentacja

- `docs/CENNIKI-INSTRUKCJA-ADMINA.md:37,42-49,60-65,90-99,132-149,157-169`: taby Rury/Studnie/Preco, save z LIVE, compare A↔B, guard `USED_BY_STUDNIE`, resolver statusów, deep-link, endpointy.
- `docs/API.md:373-390,412-416,573`: 3 endpointy, `against=`, kody błędów, `usedByKind`, cap 100/5000, `no-store`, `READ_LIMITER`.
- `docs/SECURITY.md:150`: limiter odczytu cenników.
- `README.md`: sekcja „Cenniki i wersje” + link do instrukcji admina (obecnie 0 trafień).
- `docs/UI_GUIDELINES.md:162-187`: deep-link, kafelki jako linki, `aria-live`.
- `docs/agents/frontend.md:26`, `docs/agents/backend.md:29`: ownership `pricelistVersionPreview`, endpointy, guard.
- `docs/adr/ADR-007-unified-pricing.md:75`: dopisać, że „PRECO nie wspiera DELETE” dotyczy `/api/preco-pricing`, nie wersji; oraz znane ograniczenie race cross-type.
- `CHANGELOG.md` generowany z commitów; rationale D1/D2 w body commitów, nie ręcznie.
- Markery `**Wersja:**` i `?v=` tylko przez release; nowe tagi z bieżącym `1.46.5`, release nadpisze.

## 15. Commity i kolejność

| #   | Commit                                            | Zakres                                  | Testy w commicie      |
| --- | ------------------------------------------------- | --------------------------------------- | --------------------- |
| 1   | `fix(preco): resolver statusów eksportu studni`   | D1 + helper + mock                      | resolver, exportShape |
| 2   | `fix(preco): guard usuwania wersji`               | D2 + locki + barrel                     | guard, delete         |
| 3   | `feat(api): podgląd wersji cennika`               | preview + cap + precoVersion            | read                  |
| 4   | `feat(api): porównanie dowolnych wersji`          | `against=`, natural keys                | compare               |
| 5   | `feat(api): podsumowanie wersji cenników`         | `/summary` + batch                      | summary               |
| 6   | `feat(ui): podgląd i porównanie wersji`           | preview module, `openDiff(id, against)` | frontend              |
| 7   | `feat(preco): pełna obsługa wersji PRECO`         | tab, save z LIVE, usedByKind            | panel clarity         |
| 8   | `feat(ui): kafelki cenników na pulpicie admina`   | index/dashboard                         | admin tiles           |
| 9   | `feat(ui): deep-link do panelu cenników`          | router, guard, openFromDeepLink         | deep-link, e2e        |
| 10  | `docs(docs): podgląd, porównanie i parytet PRECO` | docs                                    | —                     |
| 11  | `chore(release): ...`                             | `npm run release:minor`                 | version:check         |

Szacunek: D1 0,5d; D2 1d; backend preview/diff/summary 1,5d; UI 1,5d; PRECO 1,5d; kafelki 0,5d; deep-link 0,5d; testy/docs 1,5d; **~8,5 dnia**.

**Zrealizowane:** `be727c1` (D1 resolver + testy), `1a4b562` (D2 guard + locki + testy), `c08ce22` (notices — brama `licenses:check`).

Rollback: każdy commit addytywny, bez migracji → `git revert` bezpieczny. D1 wymaga jawnej noty „zmiana zachowania eksportu” i testu.

## 16. Bramy i DoD

```bash
npx tsc --noEmit
npx tsc -p tsconfig.frontend.json
npx eslint public/js --ext .js
npx jest <nowe pliki> --no-coverage
npm run validate
npm run version:check
npm run format
npm run encoding:check
```

`validate` nie zawiera `encoding:check` — uruchomić ręcznie. Commit wyłącznie `node scripts/commit.mjs`.

### 16.1 Bramy commit 3 (równoległe agenty — bez `test:quick`/`validate`)

```bash
npx tsc --noEmit
npx jest tests/pricelistVersions.preview.test.ts tests/security/e55gate.test.ts tests/pricelistVersions.exportShape.test.ts tests/pricelistVersions.delete.test.ts tests/pricelistVersions.precoResolver.test.ts tests/pricelistVersions.f2.test.ts --no-coverage --runInBand
npx eslint src/routes/pricelistVersions.ts src/services/pricelist/export.ts src/services/pricelistVersionService.ts
npx prettier --check src/routes/pricelistVersions.ts src/services/pricelist/export.ts src/services/pricelistVersionService.ts tests/pricelistVersions.preview.test.ts tests/security/e55gate.test.ts
npm run encoding:check
npm run ratchet:check
npm run version:check
```

`typecheck` pokrywa BE; `typecheck:frontend` zbędny (zero zmian w `public/js`). Pełne `validate`/`test:quick` dopiero na końcu paczki — teraz blokują inne agenty (DB/migracje, wspólne pliki). Kolejność przy FAIL: `diagnose → fix → rerun`, bez destrukcyjnego gita.

DoD:

- 3 endpointy admin-only, walidacja id na wszystkich trasach, read limiter, `no-store`.
- Preview/compare dla 3 typów; PRECO pełny cykl i zapis z LIVE; preview pokazuje przypiętą PRECO.
- D1/D2 mają testy RED→GREEN; D2 ma test współbieżny.
- Kafelki linkują do paneli; zero nowych inline handlerów; **zero nowych globali** (funkcje dopięte do `window.pricelistVersions`).
- Wszystkie nowe testy w `test:quick`; Playwright deep-link/preview w CI extended.
- Wszystkie bramy EXIT 0; docs zgodne z kodem; `collisions:check` i `ratchet:check` bez podnoszenia baseline.

## 17. Ryzyka i poza zakresem

- D2 może blokować usuwanie historycznej PRECO — celowe; komunikat wskazuje wersje studni. DRAFT PRECO po D1 nie jest referencją.
- D1 zmienia historyczne i `source=active` eksporty — test regresyjny + body commita.
- Race cross-type: locki `preco → studnie` redukują okno, ale nie eliminują operacji bez locka studni; ADR-007 z ograniczeniem, docelowo kolumna `precoVersionId`.
- Preview bez paginacji; cap 5000 + `truncated`. Gdy >5k, dodać `offset/limit`.
- `GET /` dla rury/studnie nadal N×4 — istniejące, poza zakresem; preco batchowane.
- Poza zakresem: `GET /:id/integrity`, naprawa orders stamp guard, zmiany schematu, pełny refaktor panelu, ikony `git-compare`/`columns-2` (użyć istniejących).

## 18. Review log (zamknięty)

| Agent                | Werdykt              | Rozstrzygnięcie w planie                                                             |
| -------------------- | -------------------- | ------------------------------------------------------------------------------------ |
| architect            | APPROVE WITH CHANGES | Usunięto Fazę 0; dodano `precoIncluded`/`precoVersion`; guard bezwarunkowy; locki    |
| build-error-resolver | WARUNKOWO            | Poprawiono scenariusz exportShape, e55 mock, delete txMock, typ `VersionDiff`, ikony |
| code-reviewer        | WARUNKOWO BLOCK      | D1↔D2 doprecyzowane; klucze z `order`; race locki; deep-link przed `showSection`     |
| doc-updater          | WARUNKOWO            | Rozszerzono listę docs o SECURITY, README, ADR-007, agents                           |
| e2e-runner           | WARUNKOWO OK         | Playwright must-have; izolacja DB/port; zakaz aktywacji wersji w E2E                 |
| general              | NIE GOTOWY           | Preview ≠ eksport oznaczone; D2 zawężone semantycznie; usunięto nowy global          |
| explore              | —                    | Dodano `productsStudnieV2`, barrel, CSS, script order, `_lastCleanHash`              |
| planner              | WARUNKOWO OK         | D1/D2 na początek; 11 mniejszych commitów; testy per commit; szacunek 8,5d           |
| refactor-cleaner     | SPLIT NIEUZASADNIONY | Faza 0 usunięta; rozszerzenie `openDiff`; reuse `escapeHtml`, istniejące ikony       |
| security-reviewer    | WARUNKOWO OK         | Walidacja id wszędzie, cap preview, XSS testy, `no-store`, brak echa id              |

**Status końcowy:** plan gotowy do GO. Jedyne otwarte pytanie produktowe: deduplikacja draftów PRECO (identyczne `rows` → `PUT` czy `409`). Rekomendacja: `PUT` istniejącego DRAFT.
