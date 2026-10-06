# SPA-GUARD-PRO — pakiet profesjonalny: guard zakładek + edytowane oferty (P0+P1)

**Status:** PLAN (nie rozpoczęty)
**Data:** 2026-10-06
**Zakres:** wyłącznie `public/js/spa/router.js`, `public/js/shared/ui.js`, `public/js/shared/auth.js`, `public/js/shared/draftAutosave.js` (+ cienka warstwa SSoT dirty) + testy. Bez zmian backendu, bez zmian cen, bez dotykania Excela/solvera. Inwarianty I-001–I-012 bez zmian.
**Baseline FACT (zweryfikowane w kodzie):**

- Router iframe + atomowy swap: `public/js/spa/router.js:347-498`
- Guard flagowy: `public/js/spa/router.js:30-54` (`_isDirtyNow`), duplikat: `public/js/shared/ui.js:693-714`
- Popup 2-btn: `public/js/spa/router.js:80-98` (`_confirmLeaveModule`)
- Flush draftu przy zmianie modułu: `public/js/spa/router.js:453-457`
- Draft API: `flushAll` / `checkRecovery` / `areEquivalent (= _draftEquivalent)`: `public/js/shared/draftAutosave.js:1515-1526`
- Zapisy docelowe dla „Zapisz i idź": `window.saveOffer` (`public/js/rury/offerCrud.js:592`), `window.saveOfferStudnie` (`public/js/studnie/offerSave.js:421`), `window.saveCurrentOrder` (`public/js/studnie/orderCrud.js:1284`)
- Otwarcie oferty z kartoteki: `window.parent.SpaRouter.openOfferInModule` (`public/js/kartoteka/kartotekaActions.js:312-319`) → reload na inne ID (`router.js:480-484`)
- Logout kasuje drafty: `public/js/shared/auth.js:112-116`

## 1. Cel

Po pakiecie: (a) guard wykrywa brud także w rurach (diff, nie flaga), (b) jedno źródło prawdy dirty, (c) popup 3-przyciskowy „Zapisz i idź", (d) popup mówi którą ofertę porzucasz i dokąd idziesz (także A-vs-B), (e) logout nie zjada robocizny po cichu.

## 2. Evidence ledger (startowy — statusy do aktualizacji w trakcie)

| ID    | Twierdzenie                                                | Dowód                                                              | Status   |
| ----- | ---------------------------------------------------------- | ------------------------------------------------------------------ | -------- |
| E-001 | Guard routera oparty na flagach, rury bez `_excelDirty`    | `router.js:30-54`, `excelHelpers.js:819` (tylko studnie stawia)    | VERIFIED |
| E-002 | Duplikat `_isWizardDirty` w routerze i ui.js               | `router.js:30`, `ui.js:693`                                        | VERIFIED |
| E-003 | Komparator kanoniczny istnieje i jest SSoT dla recovery    | `draftAutosave.js:565` `_draftEquivalent`, użyty w `707,1446,1464` | VERIFIED |
| E-004 | `areEquivalent` wystawione publicznie                      | `draftAutosave.js:1526`                                            | VERIFIED |
| E-005 | Hash SPA nie woła `beforeunload`, router flushuje ręcznie  | `router.js:25`, `router.js:456`                                    | VERIFIED |
| E-006 | Zapisy per moduł osiągalne z rodzica przez `contentWindow` | `offerCrud.js:592`, `offerSave.js:421`, `orderCrud.js:1284`        | VERIFIED |
| E-007 | Otwarcie B nad edycją A = reload iframe (utrata widoku A)  | `router.js:480-484`                                                | VERIFIED |

## 3. P0 — must (kolejność = kolejność commitów, jeden obszar = jeden commit)

### P0.1 — SSoT dirty (usuń duplikat)

- Nowy `public/js/shared/sokDirty.js` (klasyczny skrypt, `defer` przed `ui.js` i `router.js` w `app.html` + odpowiedniki w `rury.html`/`studnie.html` jeśli ładują `ui.js`):
    - `window.__sokIsDirty()` — agreguje: lokalne `_excelDirty`/`_wizardDirty` + skan iframe (jak dziś) + **diff draft-vs-SAVED** (pkt P0.2) jako rozstrzygający.
    - Zachować `window._isWizardDirty` jako alias (kompatybilność wsteczna, legacy woła bezpośrednio).
- `router.js:30-54` i `ui.js:693-714` → cienkie delegaty do `__sokIsDirty()`. Zero logiki w dwóch miejscach.
- Pułapka: `ui.js` ładuje się też w iframe i w rodzicu — SSoT musi działać w obu kontekstach (guard `typeof window` jak w `_draftG`).
- Test: `tests/frontend/sokDirty.test.ts` (jsdom/vm): flaga w iframe → true; brak flag + draft==SAVED → false; brak flag + draft!=SAVED → true.
- REGRESSION PROOF: test na starym kodzie pokazuje rozjazd rury-vs-studnie (FAIL na rurach), po P0.1+P0.2 GREEN.

### P0.2 — Guard na diff, nie na flagę (naprawia „ciche przejście w rurach")

- W `__sokIsDirty()` po fast-path flag: dla każdego zarejestrowanego `kind` (`offer_rury/order_rury/offer_studnie/order_studnie`) zebrać `livePayload` (`_draftCollectLive`, `draftAutosave.js:213`) i `savedPayload` (`_draftCurrentSaved`, `draftAutosave.js:602`), porównać `areEquivalent`. `slim` → pomiń (jak w `checkRecovery`, `draftAutosave.js:625`).
- Konieczne: wystawić z `draftAutosave` dwie funkcje read-only (bez efektów): `collectLive(kind)` + `currentSaved(kind)` — dziś są prywatne (`_draftCollectLive`, `_draftCurrentSaved`). Bez tego rodzic musiałby duplikować projekcję (zakaz — SSoT projekcji to `_draftEquivalent`).
- Wydajność: diff tylko gdy flagi milczą + throttle (guard wołany na każdy `navigate`/klik — kanoniczny JSON jest tani, ale nie za darmo). `ponytail:` memo per 500 ms, unieważniane przez `input/change`.
- Test: edycja pola `clientName` w rurach bez flag → guard true; po `clearContext` (SAVED) → false.

### P0.3 — Popup 3-przyciskowy „Zapisz i idź"

- Rozszerzyć `_confirmLeaveModule` (`router.js:80`) i odpowiedniki w `ui.js:751` (linki) i `auth.js:49` (logout): trzeci przycisk `Zapisz i przejdź`.
- Flow „Zapisz i idź": wykryj aktywny kontekst w docelowym iframe (offer vs order, rury vs studnie) → zawołaj `contentWindow.saveOffer / saveOfferStudnie / saveCurrentOrder` → czekaj na wynik (return boolean/obietnica; przy braku — traktuj jako FAIL, zostań) → przy sukcesie `_navForceOnce=true`, `_bypassBeforeUnload=true`, nawiguj. Przy FAIL → toast z błędem, zostań.
- `modalCore`/`appConfirm` dziś to 2-btn — dodać wariant 3-btn (np. `appConfirm3`) w `shared/ui.js`, ujednolicić teksty: tytuł `Niezapisane zmiany`, body z kontekstem (P1.1).
- Lock `_confirmLock` już istnieje (`router.js:67`) — użyć także dla ścieżki zapisu (długi async, podwójny klik = podwójny zapis).
- Test: mock `contentWindow.saveOffer=ok:true` → nawigacja nastąpiła; `=throw` → została + toast. E2E (Playwright, wzorzec `tests/playwright/*.cjs`): brudna oferta → klik kartoteki → „Zapisz i idź" → hash docelowy + brak draftu w `localStorage`.

### P0.4 — Testy guarda E2E (dowód runtime, nie tylko statyka)

- Nowe `tests/playwright/spa-guard.cjs` (backend na `localhost:3000` jak inne): scenariusze z rozdz. 9 poprzedniej analizy (przełącz moduł → Zostań / Opuść / Zapisz-i-idź; F5 z brudem; recovery po F5).
- Plus `tests/frontend/sokDirty.test.ts` z P0.1.
- Bramy: `node -c` zmienionych JS, `lint:frontend`, `typecheck:frontend`, `test:quick:lite`, Prettier. Potem commit przez `node scripts/commit.mjs`.

## 4. P1 — should (po zielonym P0, osobne commity)

### P1.1 — Popup mówi co porzucasz i dokąd idziesz

- Helper `describeDirtyContext()`: z aktywnego iframe odczytaj `kind` + `docId` (`draftAutosave.getDocId`-odpowiednik per kind) + numer oferty (15 pól nagłówka, `DRAFT_FIELD_KEYS` w `draftStore.js:27`) + nazwę modułu docelowego (`MODULES[module].logo`).
- Treść: `Oferta R-2025-0115 (Studnie) ma niezapisane zmiany. Zapisać przed przejściem do Kartoteki?` Zamiast generycznego „Wprowadzone zmiany…".
- XSS: wszystko przez `escapeHtml` (baza #3) — numer oferty to dane usera.

### P1.2 — Ochrona A-vs-B (otwarcie oferty B nad brudną edycją A)

- W `navigate()`, gałąź `params.edit/order` z `needsReload=true` (`router.js:473`): przed reloadem zebrać kontekst A (jak P1.1). Jeśli brudny → popup: `Porzucić niezapisane zmiany oferty A123 i wczytać B456?` + 3-btn (Zapisz-A-i-wczytaj-B / Odrzuć-A / Zostań).
- „Zapisz-A-i-wczytaj-B": zapis A, potem `iframe.src` na B (istniejący kod `router.js:481-484` bez zmian).
- Bez brudu → cisza, dzisiejsze zachowanie.

### P1.3 — Logout nie zjada robocizny

- Opcja A (rekomendowana, tańsza): przed `removeUserDrafts` (`auth.js:112-116`) pokazać popup z liczbą draftów (`summarizeDraftCounts`, `draftAutosave.js:1041`) + przyciski `Wyloguj mimo to (drafty przepadną) / Zostań`. Po wylogowaniu mimo to — kasuj jak dziś.
- Opcja B (droższa, RODO do decyzji): kosz 24h zamiast kasowania (`sok_trash_v1_` + sweep). Wymaga decyzji produktowej — nie robić bez GO.
- Default: opcja A. Opcja B tylko za jawną decyzją (wpisać do ADR/inwariantu, bo dotyka RODO-namespace).

## 5. Zakazy (twarde)

- Zero zmian backendu, cen, solvera, Excela, FTS, migracji.
- Zero nowych zależności npm.
- Zero nowych globali `window.*` poza `__sokIsDirty` + `appConfirm3` (legacy surface: NEW globals = 0 poza tymi dwoma, uzasadnione w opisie commita).
- Zero inline `onclick` w nowym kodzie (ESM + `addEventListener`).
- Pliki `.bat` ASCII-only; reszta UTF-8 bez BOM.
- Commity wyłącznie `node scripts/commit.mjs "typ(scope): opis"`; przed każdym: `npm run version:check` + `npm run validate` + `npm run format`.

## 6. Kolejność i checkpointy

1. P0.1 SSoT dirty → commit `refactor(ui): ssoT dirty dla guardu spa`
2. P0.2 guard-diff (+ expose `collectLive`/`currentSaved`) → commit `fix(spa): guard na diff draft-vs-saved`
3. P0.3 popup 3-btn → commit `feat(ui): zapisz i idz w guardzie niezapisanych zmian`
4. P0.4 testy → commit `test(spa): e2e guardu modulow i recovery`
5. P1.1 kontekst → commit `feat(ui): kontekst oferty w popupie guarda`
6. P1.2 A-vs-B → commit `feat(spa): ochrona otwarcia oferty B nad brudna A`
7. P1.3 logout → commit `fix(auth): popup draftow przed wylogowaniem`

Każdy checkpoint: CLAIM → EVIDENCE (plik:linia) → REPRO (komenda) → BEFORE/AFTER → TESTS (komendy + wynik) → DIFF → COMMIT. Push i release poza zakresem (osobne GO, kontrakt autonomii 🔴).

## 7. Ryzyka i odrzucenia

- `saveOffer` w iframe zwraca różne typy (rury vs studnie) — P0.3 normalizuje do `true/false` Саратовской wrapperem, nie grzebie w funkcjach zapisu.
- `collectLive` w podglądzie (read-only) nie generuje draftu (`_draftStudniePreview`, `draftAutosave.js:71`) — guard-diff musi respektować `isActive` per kind, inaczej popup na podglądzie.
- Notify multi-tab (`storage` event, `_draftLastTabToastAt`) poza zakresem — nie ruszać.
