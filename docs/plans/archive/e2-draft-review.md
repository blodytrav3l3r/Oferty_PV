# P1.1a — Threat/model review mechanizmu draftów (autosave)

Status: protokół (research, BEZ KODU). Gate dla P1.1b.
Data: 2026-09-16. Wersja protokołu: 1.

Stan faktyczny na dziś (dowody w kodzie):

- Brak autosave. Jedyna ochrona to guard `beforeunload` / `pagehide` / popup przy
  nawigacji: `public/js/shared/ui.js:627-772` (`_isWizardDirty()` czyta `_excelDirty`,
  `_wizardDirty`, w tym przez iframe), router SPA dokłada guard zmiany modułu
  (`public/js/spa/router.js:30-98`, hash nie wywołuje `beforeunload`).
- `localStorage` dziś = preferencje i token: `sok_excel_hidden_columns`,
  `sok_excel_col_widths` (`public/js/studnie/excelState.js:135-206`),
  `sok_studnie_display_unit/_prefs` (`public/js/studnie/displayUnits.js:8-10`),
  flagi `sok_excel_virtual / sok_well_virtual / sok_bulk_virtual`, `authToken`
  (`public/js/shared/auth.js:15-23`). Dane ofert/zamówień w `localStorage`: ZERO.
- IndexedDB w kodzie: ZERO trafień (wyłącznie wzmianka „opcjonalnie” w `docs/ARCHITECTURE.md:253`).
- Zapisy idą wyłącznie jawnie przez sieć: oferty studni `saveOfferStudnie`
  (`public/js/studnie/offerSave.js:26`), zamówienia studni `saveCurrentOrder`
  (`public/js/studnie/orderCrud.js:984`) i `saveOrderStudnie` (`orderCrud.js:458`),
  rury `window.saveOffer` (`public/js/rury/offerCrud.js:504`) i `saveRuryOrder`
  (`public/js/rury/orderCrud.js:285`), transport `StorageService.saveOffer`
  (`public/js/shared/StorageService.js:55`). Ochrona współbieżności: `versionedWrite`
  409 (`src/utils/versionWrite.ts:39-77`) + twarde `docLocks` TTL 180 s / heartbeat 60 s
  (`src/utils/docLocks.ts:14`, `public/js/shared/lockService.js:8`).
- Limit body: globalnie `express.json 50mb` (`src/app.ts:208`), po P1.3 global spadnie do
  ~1 MB, a 50 MB zostanie tylko na trasach offers/orders/import. Draft lokalny nie
  przechodzi przez HTTP, więc limity backendu go nie dotyczą (istotne tylko przy
  późniejszym jawnym zapisie SAVED).

## 1. Kształt i rozmiar stanu — rozstrzygnięcie

Draft = serializacja tego, co czyta ścieżka SAVED, minus pola runtime (patrz §2).

- Studnie, jedna studnia (`createNewWell`, `public/js/studnie/actionsWellCrud.js:67-116):
~40 pól skalarnych (parametry wizardu, rzędne, rabaty, uwagi) + `config[]`
(`{productId, quantity}`, typowo 5–10 wpisów) + `przejscia[]`(typowo 1–3 wpisy`{productId, angle, rzednaWlaczenia, ...}`) + `id/name/dn`. Po odcięciu pól runtime
(`stripWellRuntimeFields`, `offerSave.js:9-24`: `_lastAutoConfig, _lastAutoTelemetryId,
  _aiRankInfo, _lastSolveInputHash, __resCache`) realny koszt to **1,7–2,5 KB na studnię**.
- Zamówienie studni dokłada zamrożone ceny/udziały transportu (DTO `toOrderWellsDTO`,
  `orderCrud.js:1018-1067) — mnożnik ×1,2 względem oferty o tej samej liczbie studni.
- Rury, jedna pozycja (`public/js/rury/offerAddItems.js:134-157`):
  `{uid, productId, quantity, meters, lengthM, unitPrice, discount, ...}` —
  **~250 bajtów na pozycję**.
- Nagłówek oferty (wspólny, `getOfferFormFields`, `public/js/shared/offerCrudCommon.js:9-37):
  15 pól tekstowych + transport — **~2 KB**.

Szacunki (JSON po `JSON.stringify`, bez `wellsExport` — przeliczalne w `pricingCalculator.js:16`):

| Scenariusz                | Rozmiar draftu |
| ------------------------- | -------------: |
| Rury typowe (20–100 poz.) |        7–27 KB |
| Rury duże (1000 poz.)     |        ~250 KB |
| Studnie typowe (5–20)     |       12–55 KB |
| Studnie 100               |        ~250 KB |
| Studnie 300               |        ~0,7 MB |
| Studnie 1500–2000         |        ~3–4 MB |
| Studnie ~3000             |      ~6–7,5 MB |

**MAX ROZMIAR DRAFTU: 4 000 000 bajtów** (długość stringu JSON przed `setItem`).
Uzasadnienie: mieści się w limicie `localStorage` (~5 MB) z zapasem na pozostałe klucze
`sok_*` i drugą kartę; pokrywa 100% rur i studnie do ~1500–2000 sztuk. Draft powyżej
limitu jest ODRZUCANY (niezapisywany, flaga `draftOversize=true` w pamięci sesji,
toast „Draft zbyt duży — chroń się jawnym zapisem”), a guard `beforeunload` działa dalej.
Komentarz w `offerSave.js:119-124` potwierdza, że pełne payloady ~3k studni już dziś
ocierają się o limity — tym bardziej nie wolno ich pchać do 5-megowego `localStorage`.

## 2. Co przechowywane — rozstrzygnięcie (allowlista, wszystko inne zakazane)

```text
{ v: 1, kind, userId, docId, baseVersion, updatedAt, expiresAt,
  payload: { fields, wells|items, wellDiscounts?, visiblePrzejsciaTypes?,
             transportMode?, wizardGlobalParams?, wizardStep? } }
```

- `fields` = dokładnie wyjście `getOfferFormFields()` (15 pól, §1). Bez DOM, bez tokenów.
- `wells` = `structuredClone(wells)` po `stripWellRuntimeFields()`; `items` =
  `structuredClone(currentOfferItems | orderCurrentItems)`. BEZ `wellsExport`
  (przeliczalne), BEZ historii, BEZ PZ/zleceń produkcyjnych, BEZ obiektów userów
  (tylko `userId` w kluczu — przypisanie rozstrzyga serwer przy SAVED).
- `kind ∈ { offer_studnie, order_studnie, offer_rury, order_rury }`,
  `docId` = `editingOfferIdStudnie / editingRuryOrderId / orderEditMode.orderId` albo
  `"new"` dla nowego dokumentu, `baseVersion` = `existingDoc.version ?? null`
  (wyłącznie do wyświetlenia konfliktu, NIGDY nie wysyłane jako `version`).
- Wersja schematu draftu `v: 1` (integer). Niezgodne `v` lub brak pól = draft odrzucony
  cicho + log, nigdy migracja „w locie”.

## 3. Dane wrażliwe — rozstrzygnięcie

Draft zawiera dane osobowe RODO zwykłe (nie szczególne): `clientName`, `clientNip`,
`clientNumber`, `clientAddress`, `clientContact`, `investName/Address/Contractor`,
`notes/paymentTerms`, ceny i marże (tajemnica przedsiębiorstwa, nie PII). Źródła pól:
`offerCrudCommon.js:9-37`, kolumny DB `clientName/clientNip` (`prisma/schema.prisma:305-340`).

Implikacje: storage MUSI być (a) same-origin (jest — `localStorage`), (b) namespaced
per-user (klucz zawiera `userId`, patrz §9 — brak cross-read między użytkownikami na
wspólnym profilu), (c) czyszczony przy wylogowaniu i po TTL (patrz §6/§10). Zakaz
wysyłania draftu do telemetrii/logów (telemetria ofert wysyła tylko studnie zmienione,
`offerSave.js:158-161` — draft nie wchodzi do tego pipeline w ogóle).

## 4. Szyfrowanie — rozstrzygnięcie: NIE

Bez szyfrowania draftu (jawny JSON w `localStorage`). Uzasadnienie: klucz musiałby
leżeć obok danych (XSS i tak wygrywa — token sesji już dziś jest w `localStorage`,
`auth.js:15`, a ADR-006 odnotowuje to jako świadome ryzyko), WebCrypto per-user
z hasłem łamałoby recovery po crashu (cel P1.1b), a RODO nie wymaga szyfrowania
danych na urządzeniu użytkownika przy izolacji same-origin. Kompensacja: namespace
per-user, cleanup przy logout/TTL, zero przesyłu sieciowego, nigdy pełny dump do logów.

## 5. Punkty wpięcia — rozstrzygnięcie (draft NIGDY nie nadpisuje SAVED)

Draft jest ODCZYTEM równoległym (read-only snapshot), nie gałęzią zapisu:

- Studnie: kolekcja snapshotu czyta te same źródła co SAVED — `wells` (`globals.js:215`),
  `getOfferFormFields()`, `wellDiscounts`, `visiblePrzejsciaTypes`, `currentTransportMode`,
  `getWizardGlobalParams()` — ale zapis draftu wołany jest WYŁĄCZNIE z debounce
  (2000 ms po mutacji, tylko gdy dirty: `_excelDirty || _wizardDirty`) oraz synchronicznie
  przy `beforeunload`/`pagehide`/opuszczeniu modułu w routerze. Ścieżki SAVED
  (`offerSave.js:26`, `orderCrud.js:458`, `orderCrud.js:984`) NIE importują i NIE
  czytają draftu — udowodnione brakiem jakiegokolwiek odczytu `sok_draft*` (klucze dziś
  nie istnieją). Blokady trybu (`orderEditMode` blokuje `saveOfferStudnie`, `offerSave.js:27`;
  `isPreviewMode` blokuje oba zapisy) obowiązują też draft: w preview/order-view draft
  nie zbiera (read-only nie generuje draftu).
- Rury: analogicznie — źródła `currentOfferItems` (`orderItems.js:9-10`),
  `orderCurrentItems` + `editingRuryOrderId` (`orderEditMode.js:5-8`), zapisy
  `window.saveOffer` / `saveRuryOrder`. Draft rur i studni to osobne klucze (osobne
  moduły/iframe — patrz §7).
- Po SUKCESIE jawnego zapisu draft jest kasowany (`removeItem` w tej samej funkcji,
  po potwierdzeniu ID). Nieudany zapis (409/423/offline) draftu NIE rusza.
- Restore draftu NIGDY nie jest automatyczny: wyłącznie jawny przycisk użytkownika
  (§11), wypełniający formularz przez `setOfferFormFields()` + przypisanie klonów
    - rerender, z ustawieniem flag dirty. Domyślny stan po wejściu = SAVED z serwera.

## 6. TTL i wygaśnięcie — rozstrzygnięcie

**TTL 14 dni, sliding** (`expiresAt = updatedAt + 14 d`, odświeżane przy każdym
autosave). Uzasadnienie: oferty żyją tygodniami (`validity` domyślnie „7 dni”,
`offerCrudCommon.js:210-214`), więc 24 h gubiłoby realne drafty, a brak TTL —
gnije i wycieka RODO. Czyszczenie leniwe: sweep przy starcie modułu + przed każdym
zapisem draftu + przy logout (wszystkie klucze użytkownika). Po wygaśnięciu: ciche
usunięcie, bez pytania (draft martwy ≠ dane SAVED).

## 7. Multi-tab — rozstrzygnięcie: last-write-wins + powiadomienie, BEZ leadera

- Klucz draftu współdzielą karty tego samego użytkownika i dokumentu — zapis to zwykłe
  `setItem` (last-write-wins). Wybór świadomy: `docLocks` i tak pozwalają edytować
  dokument 1 użytkownikowi (`docLocks.ts:6-9` — re-entrancy per userId, nie per karta),
  więc dwie karty tego samego usera to ten sam właściciel; leader-election (BroadcastChannel)
  odrzucone jako nieproporcjonalna złożoność do zysku.
- Koegzystencja ze storage: listener `storage` event → gdy inna karta nadpisze ten sam
  klucz, aktywna karta pokazuje jeden toast „Draft zmieniony w innej karcie” (bez
  przeładowania formularza — formularz żyje, draft jest tylko kopią).
- Karty różnych użytkowników: brak kolizji z definicji (userId w kluczu) + brak
  cross-read. Iframe SPA (rury vs studnie) nie dzielą kluczy ani timerów — każdy moduł
  ma własny klucz i własny flush przy opuszczeniu (`router.js:80-98` woła synchroniczny
  `setItem` przed potwierdzoną nawigacją).

## 8. Relacja draft ↔ SAVED i konflikt z serwerem — rozstrzygnięcie

- SAVED zawsze wygrywa na ścieżce zapisu. Draft nie bierze udziału w `versionedWrite`:
  jawny zapis wysyła `version` z `existingDoc` (round-trip `buildBaseOfferDoc`,
  `offerCrudCommon.js:151-187`), nie z draftu. `baseVersion` z draftu służy tylko do
  komunikatu.
- Restore przy rozjechaniu z serwerem: jeśli `baseVersion != aktualny version` pobranego
  SAVED → modal wyboru: „Serwer ma nowszą wersję (vX → vY). Przywrócić draft jako
  NIEZAPISANE zmiany? [Pokaż różnice: liczba studni/pozycji, suma]” → przyciski
  „Przywróć jako niezapisane” / „Odrzuć draft”. Przywrócenie NIE zapisuje — wymaga
  jawnego SAVED, który przejdzie normalny `versionedWrite` (409 przy wyścigu, detekcja
  po status/code — `isVersionConflict`, `offerCrudCommon.js:197-201`).
- `docLocks` 423 nie dotyczy draftu w ogóle (draft nie woła API); utrata locka
  (`lockService.js:116-132`) nie kasuje draftu — przeciwnie, draft jest wtedy jedyną
  deską ratunku, a zapis SAVED i tak odrzuci backend.

## 9. Lokalny vs serwerowy — rozstrzygnięcie: LOKALNY `localStorage`

Draft żyje wyłącznie w `localStorage` pod kluczem
`sok_draft_v1_{userId}_{kind}_{docIdOrNew}`. Odrzucone alternatywy:

- Serwerowa tabela draftów: nowy attack surface (ownership, locki, retencja, RODO na
  backendzie), bezużyteczna przy offline/crashu sieci, wymaga migracji — zysk żaden,
  bo recovery ma działać po utracie karty, nie po zmianie urządzenia.
- IndexedDB: asynchroniczne API komplikuje synchroniczny flush w `beforeunload`
  (ryzyko utraty ostatniego taktu), a przy cap 4 MB nie daje nic ponad `localStorage`.
  Ponowna ocena DOZWOLONA tylko, gdy pomiary wykażą realne oferty >4 MB wymagające
  draftu (wtedy osobny protokół, nie „dopracowanie w implementacji”).

## 10. Cleanup — rozstrzygnięcie (5 punktów, wszystkie obowiązkowe w P1.1b)

1. Sukces SAVED → `removeItem` klucza (po potwierdzonym ID).
2. Nowa oferta / `clearOfferFormFields` / wyjście z `orderEditMode` → usuń draft
   poprzedniego kontekstu.
3. Logout (`auth.js:91`) → usuń WSZYSTKIE klucze draftu użytkownika.
4. Usunięcie dokumentu (DELETE oferty/zamówienia, w tym blokady PZ 403) → usuń draft
   tego `docId` (draft nie omija blokady — to tylko sprzątanie klucza).
5. TTL-sweep (§6) + `QuotaExceededError` → usuń największy draft / wyłącz drafty do
   końca sesji + toast; zapis SAVED NIGDY nie jest blokowany brakiem miejsca na draft.

## 11. Recovery po crashu — rozstrzygnięcie

Wejście do modułu → jeśli istnieje klucz draftu dla `(userId, kind, docIdOrNew)` i jego
zawartość różni się od świeżo pobranego SAVED → blokujący popup w stylu projektu
(`window.showModal` + `.modal`, przyciski `.btn`: „Znaleziono
niezapisany draft z <updatedAt>. [Przywróć] [Odrzuć] [Pobierz JSON]”). Brak
auto-restore (zakaz cichego nadpisywania formularza). „Pobierz JSON” = awaryjny eksport
draftu do pliku (obrona przed `QuotaExceeded`/uszkodzeniem klucza). Escape /
click-outside / ✕ zamyka popup bez usuwania draftu (draft żyje do TTL albo jawnego
„Odrzuć”). Uszkodzony JSON w kluczu → klucz usunięty + log, formularz = SAVED.

> Implementacja (`public/js/shared/draftAutosave.js`): recovery i autosave-write
> używają jednego komparatora `_draftEquivalent` (SSoT) — draft istnieje ⟺
> canonical(live) ≠ canonical(SAVED). `order_studnie` rzutuje live wells przez
> `toOrderWellsDTO` (SAVED to DTO, nie full). Slim z listy (bez wells/items)
> = brak decyzji + `logger.warn`, nie modal. Zapis przy live==SAVED pomijany
> (idempotency), `clearContext` anuluje pending debounce. `order_studnie`
> bierze SAVED ze świeżego `orderEditMode.order` (detail z wejścia), nie ze
> stale `ordersStudnie` (save mutuje detail + PATCH, tablicy nie odświeża).
> Wariant (v): modal tylko gdy draft różni się ZARÓWNO od serwera, JAK i od
> live-at-entry (live po solverze deterministycznie różni się od serwera —
> ghost solvera nie triggeruje). Odrzuć anuluje pending debounce.
> P0 (root cause wiecznego modala): `transitionRenderer.js` mutował live
> losowym `przejscie.id` (`prz-legacy-<idx>-<random>`) przy renderze kafelków;
> dla order_studnie `id` nie ma w DTO, więc re-losowanie co sesję drafciło
> wiecznie. Fix: lokalny deterministyczny `tileId`, zero zapisu do live.
> P0b (deterministyczne wejście): VPT/notatki liczone są z cennika, a SPA
> ładuje cennik w tle — entry przed cennikiem dawało niekompletny live.
> `enterOrderEditMode`/`loadSavedOfferStudnie` czekają na
> `ensureStudnieCatalogReady` (best-effort, timeout + flaga settled).
> P1a (fallback nested DTO) ODROCZONE na gate: ścieżka niepotwierdzona
> (recovery działa tylko tam gdzie orderDto.js zawsze ładowany).

## Decyzja

Draft to lokalny, jawny (bez szyfrowania), namespaced-per-user snapshot w `localStorage`
(`sok_draft_v1_{userId}_{kind}_{docIdOrNew}`, cap 4 000 000 B, TTL 14 dni sliding,
schemat `v: 1`), zbierany debounce 2 s + flush przy wyjściu, obejmujący wyłącznie
allowlistę §2 bez pól runtime i bez `wellsExport`; ze ścieżką SAVED (`saveOfferStudnie`,
`saveCurrentOrder`/`saveOrderStudnie`, `saveOffer`/`saveRuryOrder`, `versionedWrite` 409,
`docLocks` 180 s/60 s) łączy go wyłącznie kasowanie po sukcesie i jawny, potwierdzany
restore jako niezapisane zmiany — nigdy odczyt przy zapisie ani auto-nadpisanie
formularza; multi-tab to last-write-wins z powiadomieniem, konflikty z serwerem
rozstrzyga modal „SAVED nowszy → przywróć jako niezapisane albo odrzuć”, a oferty

> 4 MB (studnie ~3000) działają w trybie zdegradowanym (sam guard `beforeunload`).

## Ryzyka resztkowe

1. Oferty >4 MB (rząd ~3000 studni) bez draftu — akceptowane (nisza, guard zostaje);
   jedyna ścieżka zmiany to osobny protokół IndexedDB.
2. Wspólny profil przeglądarki + XSS = odczyt draftu — akceptowane (token w tym samym
   storage to większe ryzyko, odnotowane w ADR-006); mitygacja: namespace per-user,
   cleanup przy logout.
3. Last-write-wins między kartami gubi jedną wersję draftu — akceptowane (SAVED
   niezagrożony, toast informuje); pełne merge’owanie odrzucone jako nieopłacalne.
4. `QuotaExceededError` przy pełnym storage — mitygacja w §10, ale pierwszy zapis
   draftu po przepełnieniu przepada (SAVED działa).
5. Użytkownik ignoruje banner recovery i nadpisuje SAVED — jego świadoma decyzja;
   draft trzymany do TTL, więc odwrót możliwy przez ponowny restore.
