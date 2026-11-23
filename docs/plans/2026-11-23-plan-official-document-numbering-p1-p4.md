# Plan P1–P4 — Oficjalna numeracja dokumentów S.O.K.

## Cel

Szkice ofert i zleceń nie otrzymują oficjalnych numerów. Numer powstaje atomowo w PostgreSQL przy uzgodnionym zdarzeniu biznesowym, jest unikalny, idempotentny i nigdy nie jest ponownie używany; bieżące formaty, serie, identyfikatory robocze i pozostałe zachowanie aplikacji zostają zachowane.

## Stan i decyzje wejściowe

- P0.9 zatwierdza: oferty `OS`/`OF` przy przejściu do `final`; zamówienia sprzedażowe `ZS`/`ZK` przy pierwszym udanym utworzeniu; PZ docelowo przy `accepted`, warunkowo po audycie wszystkich konsumentów.
- Oficjalne numery pozostają niezmienne po wydaniu; anulowanie tworzy trwały wpis `void`. Nie ma rezerwacji, heartbeatów, `nextval()` ani numeracji szkicu.
- Zachować serie i formaty: `OS`/`OF` per jednostka i rok, `ZS`/`ZK` per rok, produkcja według obecnych zakresów użytkowników i roku.
- **FACT — checkout:** `main`, HEAD `ba555801`; lokalny HEAD jest 3 commity przed `origin/main`, bez commitów za upstreamem. Working tree ma 24 zmienione pliki i 3 pliki nieśledzone. Nie nadpisywać tych zmian. Szczególnie ponownie przejrzeć lokalne zmiany `public/js/studnie/orderBulk.js`, `public/js/studnie/printManager.js`, testy wydruku PZ i nowy `tests/playwright/productionOrderPrint.spec.ts` przed dotknięciem przepływu produkcyjnego.
- **FACT — narzędzia:** Node 24.18.0, Prisma 7.10.1; repozytorium i CI używają PostgreSQL 18. Lokalna baza `postgres:5432` była niedostępna, więc nie potwierdzono lokalnego stanu migracji ani nie wykonano benchmarku.
- **FACT — obecny kod:** `src/services/offers/offerNumbering.ts` blokuje transakcję i liczy `MAX+1`; oferta dostaje numer już przy zapisie szkicu. Zamówienia sprzedażowe pobierają numer przed oddzielnym zapisem. PZ może otrzymać numer przed akceptacją i ma ścieżki recyklingu. Tabele ofert mają unikalne indeksy; rejestr numerów zamówień sprzedażowych obecnie nie ma indeksu DB.
- **UNKNOWN — bramy przed zmianą zachowania:** kompletność historii usuniętych ofert/numerów, użycie ręcznej edycji pola `Nr oferty`, zewnętrzni konsumenci API claimów oraz to, czy którykolwiek konsument produkcyjny wymaga numeru PZ przed `accepted`. Jeżeli nie da się ustalić wysokiego numeru historycznego dla serii albo wykryte zostaną nierozstrzygnięte duplikaty, nie włączać tej serii.

## P0 — Odkrycie dokumentacji (zakończone podczas planowania)

**Jak ten etap realizuje cel:** plan bazuje na istniejących mechanizmach PostgreSQL, ownership, idempotencji i izolowanych testów, a nie na nowej infrastrukturze.

- Źródła przeczytane: `docs/agents/backend.md`, `database.md`, `testing.md`, `release.md`, `docs/AUTONOMY_CONTRACT.md`, `docs/SYSTEM_INVARIANTS.md` I-003/I-004, `docs/DATABASE.md`, `docs/DEPLOYMENT.md`; wzorzec migracji: `tests/migrations/globalProductionNumbering.test.ts`.
- Dozwolone istniejące wzorce: `Prisma.TransactionClient` + transakcja; Prisma atomic `upsert` dla counter row; `claimIdempotencyKey` / `completeIdempotencyKey`; `requireAuth`, `resolveWriteUserId` / `canWriteDoc`; Zod; `versionedWrite`; izolowany PostgreSQL 18 migration harness.
- Zakazy: provider SQLite, `MAX+1` jako źródło wydania, `nextval()` dla bezlukowej transakcji, lock in-memory, runtime DDL/`db push`, drugie źródło numeru, długa transakcja wokół PDF/email, cicha naprawa historii.
- **Weryfikacja:** wzorce i bramy repozytorium sprawdzono read-only; nie uruchamiano migracji, testów ani benchmarków.

## Projekt docelowy

### Dane i moduł numeracji

- Dodać addytywne tabele `official_number_counters` (`seriesKey`, `year`, `lastNumber`, stan gotowości serii) i `official_document_numbers` (typ dokumentu, roboczy `documentId`, seria, rok, kolejny numer, pełny numer, stan `issued|void|legacy`, daty wydania/unieważnienia).
- Ograniczenia DB: unikalny pełny numer, unikalna para seria/rok/numer kolejny oraz najwyżej jeden wpis numeru na typ dokumentu i jego ID. Rejestr jest trwały po anulowaniu i usunięciu dokumentu. Counter i wpis rejestru są zapisywane w transakcji finalizującej.
- Dodać mały interfejs `issueOfficialNumber(tx, request)` w `src/services/numbering/officialDocumentNumbers.ts`. W transakcji sprawdza istniejący wpis dokumentu (retry zwraca ten sam numer), atomowo zwiększa licznik serii, zapisuje wpis rejestru i zwraca sformatowany numer. Route zapisuje stan dokumentu w tej samej transakcji. Konflikt treści przy ponowieniu zwraca `409`; brak autoryzacji pozostaje `403`.
- Zachować obecne kolumny `offer_number` i `productionNumber` oraz kształt JSON zamówień. Rejestr będzie źródłem unikalności, a istniejące pola i odpowiedzi API pozostaną zgodne z dotychczasowymi konsumentami.
- Licznik musi rosnąć w tej samej transakcji co dokument i rejestr. Rollback cofa wszystkie trzy zapisy; `void` nie cofa licznika. Blokada obejmuje wyłącznie krótki zapis DB. Walidacja, PDF, eksport i e-mail pozostają poza transakcją.
- Użyć istniejących `claimIdempotencyKey` / `completeIdempotencyKey`, ownership, Zod, `versionedWrite` i audit w transakcji. Kluczem biznesowym retry jest też para typ dokumentu + ID dokumentu; ten sam HTTP `Idempotency-Key` z innym payloadem daje `409 IDEMPOTENCY_KEY_REUSE`.

### Kontrakty API i UI

- Zachować trasy i kształt payloadów ofert: `POST/PUT /api/offers-rury` i `POST/PUT /api/offers-rury/studnie`. `draft` zapisuje bez numeru; przejście do `active` (backendowe `final`) wydaje numer. Odpowiedź sukcesu zawiera kanoniczne `results[].number`; ponowna edycja finalnej oferty zachowuje ten numer.
- Dodać w formularzach ofert jawne akcje „Zapisz szkic” i „Zatwierdź ofertę”. Obecny formularz nie pokazuje jednoznacznego przejścia do `active`; nowe akcje ustalą ten moment. Puste pole numeru szkicu zastąpi komunikat „Numer oferty zostanie nadany przy zatwierdzeniu”. Po finalizacji UI ustawi numer z odpowiedzi serwera. Wydruk szkicu nie może przedstawiać numeru jako oficjalnego.
- Dla nowej oferty serwer jest autorytatywny; istniejących zapisanych numerów nie zmieniać. Kopie i importy zachowują numer źródłowy jako referencję `sourceNumber`, a nowy oficjalny numer dostają dopiero przy finalizacji. Ręczne wpisanie numeru przez użytkownika jest **bramą P2**: przed zmianą potwierdzić użycie; nie usuwać istniejącej funkcji bez decyzji.
- Zamówienia Studnie i Rury zachowują istniejące trasy zapisu (`PUT /api/orders-studnie` i `PUT /api/orders-rury/rury`) oraz JSON `orderNumber`. Pierwszy skuteczny zapis nowego dokumentu atomowo wydaje numer i zwraca go w dotychczasowym kształcie. Edycja zachowuje numer. Frontend nie pobiera claimu przed zapisem. Przez okres kompatybilności endpointy claim/preview zachowują dotychczasowy kształt odpowiedzi, dodają `provisional: true` i nie inkrementują licznika; zapis zawsze zastępuje tę wartość oficjalnym numerem i zwraca numer kanoniczny. Po inwentaryzacji zewnętrznych konsumentów claim-route można wycofać osobną decyzją.
- PZ zmienić dopiero w P4: szkic ma robocze ID i brak oficjalnego `productionOrderNumber`; zaakceptowanie (`accepted`) przydziela numer wraz z zapisem. Jeśli audyt wykaże zależność od numeru przed akceptacją, zatrzymać tę zmianę i przedstawić wariant z roboczym identyfikatorem bez zmiany obecnego procesu.

## Etapy

### P1 — Audyt danych, rejestr i migracja addytywna

**Jak ten etap realizuje cel:** przygotowuje autorytatywne źródło numerów i blokuje cutover, gdy historia serii nie jest bezpieczna.

- Dodać read-only raport `scripts/audit-official-numbers.ts`: dla każdego dokumentu raportuje typ, ID, numer, datę, właściciela i źródło wartości; porównuje kolumny ofert/PZ z JSON, JSON zamówień sprzedażowych, stare liczniki, aktywne claimy, pule recyklingu oraz możliwe snapshoty delete w `audit_logs`. `audit_logs` jest źródłem best-effort, bo błąd logowania nie cofa operacji; raport musi zaznaczyć niepewność historii.
- Raport ma wykrywać: duplikaty pełnego numeru w ramach przyszłego zakresu globalnego; rozjazd kolumna↔JSON; nieparsowalne formaty; ręczne numery; brak możliwego do udowodnienia high-water mark. Bez automatycznej zmiany, usunięcia lub renumeracji dokumentów. Konflikt blokuje dotkniętą serię.
- Rozszerzyć `prisma/schema.prisma` i dodać `prisma/migrations-postgresql/0009_official_document_number_ledger/migration.sql`. Backfillować dotychczasowe numery z kolumn i JSON, seedować liczniki z najwyższego potwierdzonego numeru oraz utrwalić znane numery anulowane/usunięte jako `void/legacy`. Nie backfillować konfliktów bez rozstrzygnięcia. Seria niegotowa pozostaje zablokowana.
- Dodać `tests/migrations/officialDocumentNumberLedger.test.ts` na wzór `tests/migrations/globalProductionNumbering.test.ts`: poprzednie migracje, legacy fixtures z kolumn/JSON/audit snapshot, backfill, constraints, odrzucenie kolizji, zachowanie danych, drugi `migrate deploy`, schema drift.
- **Checkpoint P1:** zatwierdzony raport dla każdej serii; zero nierozstrzygniętych konfliktów w seriach włączanych; brak zmiany numerów historycznych; migracja przechodzi na pustej i istniejącej izolowanej bazie PG18. Brak dowodu na historię numerów zatrzymuje cutover tej serii.
- **Anti-patterns:** żadnego `MAX+1`, `nextval`, cache/locka procesu, cichego parsowania numeru ani automatycznej naprawy duplikatów.

### P2 — Oferty Studnie i Rury

**Jak ten etap realizuje cel:** szkice nie zużywają numerów, a finalizacja obu rodzajów ofert zapisuje dokument i niepowtarzalny numer atomowo.

- Rozszerzyć usługę numeracji i testy `tests/offers/offerNumbering.test.ts`; zmienić `src/routes/offers/ruryCrud.ts` oraz `src/routes/offers/studnieCrud.ts`, aby alokacja zachodziła wyłącznie przy `draft→final` albo bezpośrednim utworzeniu jako `final`. W istniejącej transakcji zapisać dokument, counter, rejestr i audit; użyć istniejącego ownership/version guard.
- Zmienić `public/js/shared/StorageService.js`, `public/js/shared/offerCrudCommon.js`, `public/js/rury/offerCrud.js`, `public/js/rury/offerItems.js`, `public/js/studnie/offerSave.js`, `public/js/studnie/pricelistInit.js` i `public/js/appStudnie.js`: puste szkice bez numeru, jawna finalizacja, UI przyjmuje numer z odpowiedzi serwera. Usunąć logikę traktującą lokalne `getNextOfferNumber` jako oficjalny numer.
- Zachować odczyty historycznych ofert i kształt API; finalnej oferty nie renumerować przy edycji. Obsłużyć kopię/import w `public/js/kartoteka/kartotekaActions.js` oraz `public/js/import-export/{rury,studnie}/transferJson.js`: nowy ID, zachowany source number jako referencja, bez odziedziczenia oficjalnego numeru.
- Zaktualizować walidatory `src/validators/offerSchemas.ts`; nowe dokumenty finalizowane przez serwer nie mogą narzucić innego `number` z przeglądarki. Ręczne użycie pola sprawdzić przed zmianą i wstrzymać ten punkt, jeśli ma uzasadniony workflow.
- Dodać regresje: szkic bez numeru, finalizacja draftu, bezpośrednie final create, retry utraty odpowiedzi, dwa równoległe finalize, edycja finalnej oferty, import/kopia, PDF/Excel i brak zmiany starego numeru. Zachować testy `tests/offers/{ruryCrud,studnieCrud,offerNumbering}.test.ts`.
- **Checkpoint P2:** `OS` i `OF` są unikalne w konkurencji 2/10/100/500; szkic nie tworzy wpisu rejestru; zapisana finalna oferta i odpowiedź UI zawierają ten sam numer.
- **Anti-patterns:** nie finalizować przez samo generowanie PDF; nie przypisywać numeru przy otwarciu formularza; nie przestawiać stanu przy zwykłym zapisie szkicu.

### P3 — Zamówienia sprzedażowe Studnie i Rury

**Jak ten etap realizuje cel:** wydanie numeru i pierwszy zapis zamówienia stają się jedną, powtarzalną operacją DB.

- Zmienić `src/routes/orders/studnieOrders.crud.ts` oraz `src/routes/orders/ruryOrders.crud.ts`, tak by utworzenie nowego zamówienia w istniejącym zapisie `PUT` przydzielało `ZS` lub `ZK` i zapisywało JSON + rejestr + counter w jednej transakcji. Aktualizacja zachowuje numer. Unikalność rejestru chroni wszystkie ścieżki zapisu, nie tylko UI.
- Zmienić `public/js/studnie/orderCrud.js` i `public/js/rury/orderCrud.js`: usunąć pre-claim jako oficjalny numer, użyć numeru zwróconego przez create; `GET next-number` pozostawić wyłącznie jako oznaczony podgląd, jeśli jest nadal potrzebny. Przed wycofaniem claim-route wyszukać repozytoryjnych konsumentów i sprawdzić kontrakt zewnętrznych integracji.
- Zachować bieżące payloady/serializację (`orderNumber` w JSON), powiązania z ofertą, ownership i statusy. Przypisać `Idempotency-Key` do requestu; dodatkowo unikalny wpis `(documentType, documentId)` sprawia, że retry po utracie odpowiedzi zwraca numer już zapisanego zamówienia.
- Dodać `tests/orders/salesOrderNumbering.test.ts` i rozszerzyć `tests/orders/{studnieSingleSave,ruryOrders.crud,claimIdempotencyHttp}.test.ts`: równoległy create, retry, inny payload z tym samym kluczem → 409, rollback bez zużycia numeru, usunięcie/anulowanie jako tombstone, brak duplikatów JSON w API.
- **Checkpoint P3:** serie `ZS` i `ZK` są unikalne dla 2/10/100/500 równoczesnych create; każda zatwierdzona transakcja zużywa dokładnie jeden kolejny numer; retry tego samego ID zwraca ten sam numer; numery usuniętych dokumentów pozostają w rejestrze.
- **Anti-patterns:** nie decrementować licznika przy delete; nie zwiększać licznika w osobnym endpointzie przed zapisem; nie polegać na samym polu JSON jako constraint.

### P4 — Zlecenia produkcyjne, cutover i końcowa walidacja

**Jak ten etap realizuje cel:** kończy spójność numeracji produkcyjnej bez naruszenia przepływów, które mogą wymagać numeru przed akceptacją.

- **P4a — obowiązkowy audyt przed kodem:** prześledzić wszystkie czytelników/zapisujących `productionOrderNumber`, accept/retract/delete, pojedynczy claim, bulk chunk/retry, kartotekę, etykiety, PDF/druk, eksporty i cross-reference. Zaktualizować tylko po ponownym obejrzeniu lokalnego diffu `orderBulk.js`, `printManager.js`, testów print i nieśledzonego Playwright spec. Zestawić, czy draft, wydruk lub bulk flow potrzebuje identyfikatora przed `accepted`.
- **Checkpoint P4a:** jeśli numer jest wymagany w szkicu lub przed akceptacją, zatrzymać refaktor numeracji PZ i przedstawić wariant z roboczym UUID; bez odrębnego potwierdzenia nie zmieniać tego procesu. Jeśli nie jest wymagany, przejść do P4b.
- **P4b — warunkowa implementacja:** w `src/routes/orders/production.ts` przydzielać numer oraz wpis rejestru tylko przy transakcyjnym przejściu do `accepted`; zachować user-range i format. Usunąć ścieżki oddające do puli numer już zarejestrowany jako oficjalny. Zmienić `public/js/studnie/orderZleceniaData.js`, `public/js/studnie/orderBulk.js`, claim helpery oraz widoki/druk; szkice używają roboczego ID, odpowiedź accept ustawia oficjalny numer.
- Dostosować `tests/orders/{productionBulkClaim,productionRecyclePostgres,productionNumberUnique,productionOrders}.test.ts`, migrację oraz E2E wydruków: draft bez oficjalnego numeru, accept nadaje jeden, retry zachowuje numer, withdraw/delete nie zwalnia numeru oficjalnego, bulk acceptance jest atomowe. Testów/projektowych zmian dotykających lokalnego użytkownika nie nadpisywać.
- **Checkpoint P4b:** testy wszystkich ścieżek produkcyjnych przechodzą; żaden wydruk, bulk proces ani downstream nie oczekuje numeru przed `accepted`; brak re-use po anulowaniu/usunięciu. Jeżeli któryś warunek nie zachodzi, wrócić do P4a z propozycją zgodną z istniejącym zachowaniem.
- **Cutover:** staging na PostgreSQL 18, raport legacy, migration deploy dokładnie raz, weryfikacja status/drift, backup/restore drill, smoke ofert/zamówień/PZ/importów/eksportów/PDF/auth/ownership. Przy właściwym cutoverze wstrzymać zapisy nadające numery na wszystkich instancjach; nie dopuszczać starego i nowego alokatora równolegle. Włączać tylko serie ze statusem gotowym.
- **Rollback:** przed wydaniem nowych numerów można wycofać aplikację, zachowując addytywne tabele. Po pierwszym wydaniu nie usuwać ledger/counter i nie wracać do `MAX+1`/recycle. W razie awarii wyłączyć operacje wydania, pozostawić odczyt/edycję szkiców, wdrożyć poprawkę kompatybilną z rejestrem i wznowić po smoke. Restore live wymaga osobnego GO.
- **Anti-patterns:** żadnego dual-write do różnych baz, długich transakcji z PDF/email, procesowych locków, cichego fallbacku do starego claimu ani roll-forwardu na produkcji bez osobnego GO.

## Plan weryfikacji i kryteria akceptacji

- Testy czystej logiki formatowania/serii i retry; integracyjne transakcje PostgreSQL 18; migracja od pustego schematu i upgrade z legacy fixture; pełne API/E2E dla szkiców, finalizacji, importu, kopii, edycji, wydruków i anulowania.
- Współbieżność 2/10/100/500 dla tej samej serii i różnych serii; przypadki double-click, utrata odpowiedzi, retry po restarcie, rollback, timeout, deadlock, dwie karty i dwóch użytkowników zapisujących ten sam dokument.
- Benchmark na izolowanym PG18: p50/p95, przepustowość, lock wait, liczba zapytań i brak skanowania tabel dokumentów. Strukturalne kryterium: stała liczba zapytań na wydanie i blokada tylko jednego licznika serii; wynik latency porównać z baseline na tym samym środowisku, bez deklarowania pomiarów przed wykonaniem.
- Akceptacja: brak duplikatów; numery zapisane przy finalizacji są kolejne dla zatwierdzonych wydań; rollback nie zostawia luki; anulowane wydania pozostają w ledger; retry zwraca ten sam numer; istniejące numery i formaty są niezmienne; konflikty legacy są raportowane i nie są automatycznie naprawiane.
- Dla zmian kodu uruchomić test regresyjny danego etapu, test migracji, `npm run version:check`, lint/typecheck dotkniętej warstwy i pełną `npm run validate` jako zmianę przekrojową/wysokiego ryzyka. CI uruchamia pełną macierz. Testów nie uruchamiano podczas planowania.

## Zatwierdzenia i poza zakresem tego planu

- Niniejszy dokument jest planem, nie zgodą na implementację, migrację live, commit ani push. Batch GO jest wymagane przed kodem; migracja/live cutover i push mają osobne bramy zgodnie z `docs/AUTONOMY_CONTRACT.md`.
- Nie zmieniać formatu serii, kalkulacji, cenników, historycznych numerów ani istniejących niezwiązanych lokalnych zmian.
- Przed P2 zamknąć ręczne wpisywanie numeru. Przed P4b zamknąć zależności PZ. Każda seria z konfliktami lub niepewnym high-water pozostaje wyłączona do indywidualnej decyzji.
