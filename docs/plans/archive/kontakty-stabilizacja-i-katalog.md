# Osoby do kontaktu + katalog kontaktów — plan etapowy (CONDITIONAL GO)

Status: PLAN — do wykonania etapami, GO na Paczkę 1. Paczki 2–4 po bramkach poprzednika.
Migracja dev-DB i push wyłącznie za osobnym GO. Nic nie commitować z cudzymi zmianami.

## 0. Stan wejściowy (zweryfikowany: HEAD `609f125`, worktree brudny)

Prace kontaktowe to niezcommitowane zmiany worktree (m.in. `src/routes/offers/followUps.ts`,
`src/routes/offers/index.ts`, `public/js/kartoteka/kartotekaFollowUp.js`,
`public/js/shared/offerCrudCommon.js`, `clientManager.js`, `types.d.ts`, partiale kroku 1 ×2,
`rury/studnie.html`, `style.cards.css`, `src/types/offerData.ts` + nowe `clientContacts.js`,
`clientContact.ts`, 4 testy). Pliki obce (`sessionIdle.js`, `auth.ts`, `wellTransitions*.js`,
`tests/auth*` …) — NIE RUSZAĆ, nie obejmować commitem.

### Fakty z audytu (łańcuch krok 1 → blob → Opieka)

- OK: zapis kroku 1 trafia do bloba (`clientContacts[]` + mirror `clientContact`);
  Opieka prefilluje z DETAIL i zapisuje `contacts[]` (testy 7/7).
- F1 HIGH: pełny zapis oferty kasuje `contactPerson/clientPhone/clientEmail`
  (`buildBaseOfferDoc` ich nie emituje; BE serializuje cały doc).
- F2 HIGH: otwarcie oferty do edycji (`offerManager.js:155`, `offerCrud.js:356,590`)
  nie przekazuje `clientContacts` → edytor z mirrora bez maili → zapis nadpisuje bloba.
- F3 MED: `DRAFT_FIELD_KEYS` bez `clientContacts` → recovery z mirrora.
- F4 MED: `normalizeOfferData` (studnie) bez nowych kluczy. Rury: DETAIL spłaszcza bloba,
  brak zmian normalizacji.
- F5/F6 LOW (odroczone): zamówienia dziedziczą tylko string; FTS indeksuje tylko mirror.
- F7: `clients_rel` — 1 wiersz = firma, pojedynczy `contact`; phone/email z 1. osoby.

## 1. Zasady operacyjne (5 warunków oceny — obowiązują wszystkie paczki)

1. **Worktree nienaruszalny dla obcych zmian.** Zero `reset/checkout --/clean`, zero commita
   z cudzymi plikami. Commit P1 tylko gdy da się wyizolować pliki paczki; inaczej bez
   commita + opis blokady.
2. **Sync = pełny zestaw albo nic.** `PUT sync` z semantyką „brak na liście = usuń" wymaga
   kompletnego zestawu od klienta; **błąd pobrania nigdy nie jest pustą listą**
   (FE: fetch fail → blokada zapisu + komunikat, nigdy `contacts: []`). Współbieżne zapisy:
   wykrywanie konfliktu przez `updatedAt` klienta-vs-serwer (409 CONFLICT + retry
   użytkownika), bo sama tx nie chroni przed last-write-wins.
3. **`isPrimary` max-jeden w tx.** Ustawienie głównego zeruje pozostałe tego klienta
   w tej samej transakcji; test współbieżności: po równoległych żądaniach ≤1 główny.
   Zero głównych dozwolone; następca po usunięciu nie auto-wyznaczany.
4. **Audyt w tej samej tx.** Wpis `audit_logs` w transakcji biznesowej (precedens
   `followUps.ts`); błąd audytu = rollback całości. Sprawdzić kontrakt `audit_logs`
   przed implementacją.
5. **Bramy w zakresie.** `format`/`lint` tylko na plikach paczki (nie całe repo).
   `validate`: znany FAIL `licenses` (THIRD-PARTY-NOTICES, przed pracami — brak zmian
   w zależnościach) dokumentować osobno; nigdy nie oznaczać całości PASS przy FAIL.

## 2. Paczka 1 — stabilizacja A–D (GO)

- **A. Kanon:** `data.clientContacts[]` SSoT; mirror `[0]` →
  `contactPerson/clientPhone/clientEmail`; `clientContact` = display `"Jan, 600; …"`.
  Jedyna prawda: `ClientContacts.normalizeContacts/legacyToContacts/contactsToLegacy`.
  Zapis zawsze wyprowadza mirror z tablicy. `getOfferFormFields` += split-klucze;
  `buildBaseOfferDoc` przenosi `clientContacts + split` do doc.
- **B. Ścieżki edycji:** `setOfferFormFields` w `offerManager.js:155`, `offerCrud.js:356,590`
  += `clientContacts/split`; allowlista `normalizeOfferData` (studnie) += 3 klucze.
- **C. Draft:** `DRAFT_FIELD_KEYS += 'clientContacts'` (+ licznik w komentarzu).
- **D. Snapshot-vs-katalog (twarda reguła):** edycja oferty NIGDY nie dociąga katalogu;
  tylko jawne „Wczytaj klienta" (confirm przy brudnym edytorze, sync-guard jak
  `showClientsDb`). Zwykły zapis nie merguje (nie wskrzeszać usuniętych).
- **Testy (przepływ):** email-cykl zapis→otwarcie→edycja→zapis (rury+studnie);
  draft z mailami; hoist normalizacji; `pickDraftPayload`.
- Bramy P1: `typecheck`×2, `lint` (pliki paczki), `test:quick`, `format` (pliki paczki),
  `version:check`. Raport: dowody, pliki, testy (SUCCESS/FAILURE/SKIPPED + bazowe),
  diff, commit/checkpoint, ryzyka. STOP po P1.

## 3. Paczka 2 — katalog relacyjny (GO warunkowe, po zielonej P1)

- **Schema** (`..._client_contacts`): `client_contacts_rel(id TEXT PK, clientId TEXT NOT NULL,
name TEXT NOT NULL, phone TEXT, email TEXT, position TEXT DEFAULT '',
isPrimary INTEGER DEFAULT 0, createdByUserId TEXT, createdAt TEXT, updatedAt TEXT)`
    - `idx_client_contacts_client(clientId)`. Bez FK (konwencja); **delete klienta =
      cascade kontaktów w tej samej tx** (snapshoty ofert w blobach zostają).
      Auto-heal `CREATE TABLE IF NOT EXISTS` w `initDatabase.ts` (precedens shares) + test.
- **API** (`src/routes/clients/contacts.ts`): `GET /:clientId/contacts`,
  **`PUT /:clientId/contacts/sync`** `{contacts:[{id?,name,phone?,email?,position?,isPrimary?}], clientUpdatedAt?}`:
  404 gdy brak klienta; pełna walidacja Zod przed tx; każde `id` musi należeć do klienta
  (mismatch → 404; test IDOR A→B); diff w 1 tx (insert z client-minted id — retry
  idempotentny, D-009; update; delete przez pominięcie); audyt w tx; konflikt
  `updatedAt` → 409. Uprawnienia = parity `clients.ts` (Wariant A; `userId==null` → admin).
- **Testy P2** (realna persystencja, wzorzec `tests/migrations/*`): atomowość,
  IDOR, cascade, primary-współbieżność, init legacy-DB.

## 4. Paczka 3 — UI (GO po P2)

Wczytanie kontaktów przy jawnym wyborze firmy (loading/error/retry, dirty-guard);
zapis katalogu jednym `PUT sync` (blokada przy fetch-fail — warunek 2); snapshot oferty
bez zmian. Odroczone: zamówienia (F5), FTS (F6), wydruk wszystkich osób.

## 5. Paczka 4 — walidacja (GO po P3)

`test:quick`, `validate` (licenses-FAIL osobno), format w zakresie, `version:check`,
diff-review, commit wyłącznie plików paczek, raport + checkpoint. Migracja dev-DB i push
poza zakresem (osobne GO).

## 6. Kryteria akceptacji

Email-cykl cały; draft z mailami+id; brak odrzutów normalizacji; katalog nie rusza
snapshotu; jawne wczytanie nie auto-nadpisuje; IDOR odrzucony; brak sierot po delete
klienta; fail-sync bez częściowego zapisu; init legacy bez utraty danych.
