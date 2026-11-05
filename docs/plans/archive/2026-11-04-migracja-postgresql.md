# Plan: migracja S.O.K. z SQLite do PostgreSQL

**Status:** ZAKOŃCZONO — implementacja i lokalna walidacja PostgreSQL 18 w wydaniu 1.56.4 (`2ef5d907`). Produkcyjny cutover nie był zakresem wykonanego wdrożenia i nadal wymaga osobnego GO, planu restore oraz weryfikacji hosta docelowego.

**Data zamknięcia:** 2026-11-05
**Zakres:** kompletna zmiana jedynego silnika bazy danych aplikacji na PostgreSQL.  
**Cel danych:** zachować wyłącznie aktualnie aktywne wersje cenników i ich pozycje; pozostałe dane aplikacyjne odtworzyć jako świeży stan zgodnie z uzgodnionym seedem i onboardingiem.

> Ten plik zachowuje pierwotny plan i kolejne checkpointy. Twierdzenia w sekcjach
> „Stan potwierdzony” i datowanych raportach opisują stan z chwili ich powstania,
> nie końcowy rezultat. Bieżący stan oraz zakres walidacji: [`docs/DATABASE.md`](../DATABASE.md)
> i [`docs/DEPLOYMENT.md`](../DEPLOYMENT.md). Lokalne testy nie oznaczają, że
> produkcyjna baza została zmieniona.

## Primary goal

Użytkownik uruchamia S.O.K. na PostgreSQL i może bez zmiany kontraktów aplikacji tworzyć, wyszukiwać, importować, eksportować i drukować oferty oraz zarządzać cennikami. Po jednorazowym przejściu zachowane są aktywne ceny, a pozostałe dane są świeże.

## Zasady i ograniczenia

1. To jest plan, nie zgoda na wykonanie migracji. Przełączenie produkcji oraz skasowanie danych wymagają osobnego GO zgodnie z kontraktem autonomii przekazanym w instrukcjach; jego wskazana ścieżka `docs/AUTONOMY_CONTRACT.md` nie istnieje w obecnym checkout i musi zostać rozstrzygnięta w Fazie 0. Stosować również `docs/development/GIT_SAFETY.md`.
2. Nie przenosić historii ofert, zamówień, użytkowników, sesji, logów, audytu, telemetryki, ustawień ani szkiców/dawnych wersji cenników. Aktualny admin, role i ustawienia odtworzyć przez bezpieczny seed/onboarding. Nie kopiować haseł, sesji ani sekretów.
3. Zachować tylko aktywną wersję z każdej osi cennika (rury, studnie, PRECO) wyznaczoną przez istniejący lifecycle i `effectiveFrom`, razem z kompletem rekordów `PricelistItem*`, metadanymi wersji oraz SHA-256. Nie rekonstruować cennika z `data/seed_*.json`, jeśli bieżąca wersja w bazie zawiera edycje.
4. Brak lub niejednoznaczność aktywnego cennika, niezgodny hash albo brak pozycji blokuje cutover; nie wolno po cichu zastąpić go seedem fabrycznym. Postępowanie awaryjne wymaga jawnej decyzji właściciela.
5. Zachować inwarianty domenowe I-001–I-014, numerację/idempotencję, ownership, CAS ofert/draftów, CSRF, rozliczanie cen przez `roundMoney`, snapshoty ofert i publiczne kontrakty API.
6. Nie robić równoległego dual-write do SQLite i PostgreSQL. Celem jest nowa pusta baza PostgreSQL plus kontrolowany import wyłącznie aktywnych cenników.
7. Nie projektować dziś mikroserwisów, shardingu ani partycjonowania. Najpierw poprawny model relacyjny, mierzone indeksy i możliwość addytywnych migracji.

**Twardy stan końcowy:** PostgreSQL jest jedynym silnikiem aplikacji we wszystkich środowiskach. Z aktywnego kodu, zależności, konfiguracji, instalatorów, skryptów operacyjnych, CI i testów usuwa się adaptery/sterowniki SQLite, `node:sqlite`, `PRAGMA`, SQLite URL, SQLite SQL i kroki `db push`. Aktywne wytyczne zastępują procedury SQLite procedurami PostgreSQL; wzmianki o SQLite mogą pozostać jedynie w archiwalnej historii albo w ściśle jednorazowym, read-only kroku eksportu aktywnych cenników ze starego pliku. Taki importer nie może być częścią runtime ani wspieraną ścieżką pracy po cutoverze.

## Stan potwierdzony (evidence ledger)

| Fakt                                                                                                                                            | Dowód w repozytorium                                                                                                                                                                                                                                               | Skutek dla planu                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Źródłem modelu jest SQLite; provider zablokowany również w pliku migracji.                                                                      | `prisma/schema.prisma:1-15`; `prisma/migrations/migration_lock.toml:1-3`                                                                                                                                                                                           | Sama zmiana URL/provider nie wystarcza. PostgreSQL wymaga niezależnej historii migracji.                                                                                         |
| W stanie bazowym przed migracją aplikacja używała Prisma ORM 6.19.3; model dokumentacyjny obejmuje 56 modeli.                                   | Stan początkowy `package.json`; `docs/agents/database.md`                                                                                                                                                                                                          | Prisma została następnie zaktualizowana do 7.10.1 w fazie wykonania; dalsze decyzje muszą bazować na aktualnym lockfile i oficjalnych dokumentach v7.                            |
| W kodzie i migracjach są wyrażenia specyficzne dla SQLite.                                                                                      | `src/routes/offers/search.ts:210-270`; m.in. `prisma/migrations/20260831000000_add_wellcount/migration.sql`, `20260902000000_add_totalprice/migration.sql`, `20260907000000_prod_number_unique/migration.sql`, `20261014000000_care_latest_followup/migration.sql` | Przepisać raw SQL/DDL i sprawdzić równoważność zachowania na prawdziwym PostgreSQL.                                                                                              |
| Runtime rozwiązuje `file:` URL, tworzy katalog DB i inicjalizuje pojedynczego klienta Prisma.                                                   | `src/prismaClient.ts:12-52`                                                                                                                                                                                                                                        | Usunąć plikowe założenia, zachować singleton, jawnie walidować URL i rozdzielić runtime/CLI połączenia jeżeli host/pooler tego wymaga.                                           |
| `PricelistVersion` i pięć rodzin elementów są jedynym źródłem cen; aktywne wersje są wyliczane z lifecycle.                                     | `prisma/schema.prisma:816-934`; `docs/SYSTEM_INVARIANTS.md` I-014; `src/services/pricelist/`                                                                                                                                                                       | Eksport cenników musi odczytać stan runtime, nie tylko seedów lub statusu tekstowego.                                                                                            |
| Backup/restore/integrity są oparte o SQLite, `VACUUM INTO`, `node:sqlite`, `PRAGMA` i rozszerzenie `.sqlite`.                                   | `scripts/backup.ts`; `scripts/restore-db.js`; `scripts/audit-integrity.mjs`; `scripts/check-db.js`                                                                                                                                                                 | Zastąpić cały cykl narzędziem obsługującym PostgreSQL oraz przetestować odtworzenie.                                                                                             |
| Docker, entrypoint, workflow CI i release zakładają lokalny plik DB, `db push` lub SQLite.                                                      | `Dockerfile`; `docker-compose.yml`; `scripts/docker-entrypoint.sh`; `.github/workflows/ci.yml`; `.github/workflows/release.yml`                                                                                                                                    | Zmienić konfigurację wszystkich środowisk, health/readiness, migracje i joby.                                                                                                    |
| Importer ofert korzysta z endpointów HTTP, więc może zachować kontrakt, jeśli API pozostanie stabilne.                                          | `scripts/import-offers.ts:385-424,889-931,1002-1025`                                                                                                                                                                                                               | Testować przez endpointy end-to-end zamiast przepisywać importer do bezpośredniego DB write.                                                                                     |
| Istniejące testy raw SQL oraz integracyjne testy danych używają SQLite; mocki nie dowodzą zgodności z PostgreSQL.                               | `tests/searchSlimParity.test.ts`; `tests/migrations/`; testy w `tests/transfer/`                                                                                                                                                                                   | Wprowadzić obowiązkowy zestaw integracyjny i E2E na faktycznym PostgreSQL w CI.                                                                                                  |
| Wytyczne i ADR uznają SQLite za decyzję oraz zakazują PostgreSQL.                                                                               | `docs/adr/ADR-001-sqlite.md`; `docs/adr/ADR-012-single-node-sqlite.md`; root `AGENTS.md` (mapa architektury)                                                                                                                                                       | Zmiana musi zawierać formalne zastąpienie decyzji i usunięcie sprzecznych zakazów.                                                                                               |
| Przekazane instrukcje wskazują `docs/AUTONOMY_CONTRACT.md`, ale plik nie istnieje w tym checkout; istnieje `AGENTS.md`.                         | Sprawdzenie `Test-Path` i `rg --files --hidden` w repo                                                                                                                                                                                                             | W Fazie 0 ustalić rzeczywiste SSoT GO/tiers; jeśli ten kontrakt ma być wersjonowaną polityką projektu, dodać go lub poprawić odwołania w ramach osobnej akceptacji dokumentacji. |
| Są aktywne zależności runtime od FTS5 i SQLite schema-heal poza Prisma migrations.                                                              | `src/initDatabase.ts:12-141,296`; `src/utils/fts5Sync.ts:84-160,228-267`; `src/app.ts:431,453,511`                                                                                                                                                                 | Przenieść DDL do migracji i zaprojektować FTS PostgreSQL z porównaniem wyników/repair; nie wystarczy przepisać tylko `offers/search.ts`.                                         |
| `PrismaVersion` resolver wybiera najnowszy zatwierdzony cennik, którego `effectiveFrom <= now`, a ustawienie admina może jawnie nadpisać tę oś. | `src/services/pricelist/usage.ts:161-195`; `src/services/pricelist/health.ts:47-89`                                                                                                                                                                                | Artefakt migracyjny musi zachować konkretny resolved ID per oś oraz wyłącznie klucz override wskazujący na ten ID, jeśli override ma pozostać aktywny.                           |
| Startup tworzy brakujące wersje bazowe z seed JSON, jeśli oś nie ma żadnej wersji; zwykły seed Prisma nie tworzy sam cennika.                   | `src/services/pricelist/bootstrap.ts:8-10,39-123`; `src/app.ts:431`; `prisma/seed.ts:6-10,54`                                                                                                                                                                      | Import zachowanych cenników musi poprzedzić bootstrap albo bootstrap musi dostać jawny import artifact, tak by nie dodał wersji fabrycznej obok zachowanej.                      |
| Prisma ORM 6.19.3 security-only support kończy się 2026-11-19; Prisma 7 jest wspierana, a Prisma 8 jest Release Candidate.                      | Oficjalny [Prisma ORM release status](https://www.prisma.io/docs/orm/release-status), sprawdzony 2026-11-04                                                                                                                                                        | Produkcyjny plan ma targetować stabilną, wspieraną linię Prisma 7; nie rozpoczynać migracji na 6 z założeniem długoterminowego wsparcia ani nie wdrażać na Prisma 8 RC.          |

**Stan working tree podczas sporządzania planu:** istniał niepowiązany untracked `scripts/db-reset-fresh.mjs`; nie zmieniać ani nie włączać do migracji bez osobnego uzasadnienia. W trakcie wykonania rozszerzono statyczny audyt zapytań SQL i semantyki modeli; usługa hostingu, dane dostępowe i raport wstępnej kontroli aktywnych cenników pozostają niezweryfikowane, bo nie są dostępne w tym checkout.

**Checkpoint wykonania 2026-11-04:** Prisma ORM 7.10.1 uruchamia się na tymczasowym adapterze SQLite; generator, build, backend typecheck i test adaptera przechodzą. Testy `tests/sharesRawSql` przechodzą 8/8. Test CAS dwóch klientów timeoutuje na synchronicznym `better-sqlite3`; nie zmieniono asercji. Cztery migracyjne suite’y nie zakończyły się w limicie 30 s bez raportu, więc są niezweryfikowane. Niezależny review nie wykrył błędu wysokiego priorytetu; wskazane stare CLI komendy i noty licencyjne zostały poprawione. Produkcyjnego providera jeszcze nie zmieniono. W checkout nie ma Docker/Podman/psql ani skonfigurowanego PostgreSQL, więc testu na serwerze PG18 nie da się obecnie wykonać lokalnie.

Pierwszy typowany batch cen cennikowych zmienił 13 pól PLN w `PricelistItemRury`, `PricelistItemStudnie` i `PricelistItemPrecoKinety` z Float na Prisma Decimal; pozostałe miary nadal są Float. Zapis/import przechodzą wspólne `roundMoney`, a publiczne odczyty oraz `scripts/export-settings-to-seed.mjs` zwracają liczby JSON zamiast Decimal strings. Zestaw `tests/pricelistVersionDecimalShape`, `tests/pricelistVersions.exportShape` i `tests/pricelistVersions.f1` przechodzi 43/43; `prisma generate`, backend typecheck, `prisma validate`, `node --check` i diff check przechodzą. `tests/pricelistVersions.validation` osobno nie jest zaliczony: 9 przypadków dostało `connect EACCES 127.0.0.1`, pozostałe 9/9 testów w suite’y cenników przechodzą. Prisma nie pozwala jeszcze dodać `@db.Decimal(18,2)` przy tymczasowym SQLite providerze; jawna precision jest odłożona do provider switch. Kontrole na aktywnych cennikach w live DB nadal są wymagane.

Drugi batch zamienił relacyjne pola kwotowe ofert na Prisma Decimal: pozycje Rury i Studni, transport/total ofert Studni i Rur oraz cenę konkurencji follow-up. Walidowane zapisy stosują `roundMoney`; odpowiedzi CRUD, wyszukiwania, osi follow-up i PDF normalizują Decimal do liczb zgodnych z dotychczasowym JSON. `npx tsc --noEmit --pretty false`, 4 suite’y/28 testów (`offerDecimalShape`, `pdfCorruptedData`, `pdfGenerator`, `searchPricelistVersion`), dodatkowe 4 suite’y/99 testów routerów, `prisma validate` i `git diff --check` przechodzą. Testy routerów wymagały dostępu do lokalnego loopback; Supertest zakończył asercje sukcesem, a Jest po raporcie ostrzegł o uchwytach otwartych przez ~44 s, po czym wyszedł kodem 0. Niezależny review nie znalazł wycieku Decimal ani brakującej granicy `roundMoney`. `offers_studnie_rel.transportCost` oraz `offer_studnie_items_rel` nie mają obecnych bezpośrednich callsite’ów Prisma; ich semantyka wymaga potwierdzenia przy docelowym schemacie. Nadal nie przełączono providera, nie dodano natywnej precyzji PostgreSQL i nie wykonano testów na serwerze PG.

Commit-gate checkpoint: `npm run format` i `npm run version:check` przechodzą. `npm run validate` nie przechodzi (run: 577 suites passed, 6 failed, 1 skipped; 5 tests failed, 7 skipped, 5736 passed). Po uruchomieniu routerów z loopback i poprawkach Prisma 7 w testach/CLI, dwa blokujące problemy wymagają rozwiązania przed commitem: (1) migracyjny baseline nadal pokazuje `Redefined table` dla ośmiu modeli kwotowych po `Float`→`Decimal`, więc potrzebna jest spójna przejściowa migracja schematu albo właściwa granica testu; (2) test równoległego CAS powtarzalnie timeoutuje na `better-sqlite3` adapterze i zwraca nieobsłużony `SocketTimeout`. Nie wyłączono ani nie osłabiono tych testów; commit wstrzymany do zielonego validate.

**PostgreSQL-only implementation checkpoint (2026-11-04):** schema i wygenerowany klient Prisma zostały przełączone na PostgreSQL; runtime używa `@prisma/adapter-pg`/`pg`, waliduje jawny URL i przenosi parametr `schema` do Prisma adaptera. Usunięto zależność `@prisma/adapter-better-sqlite3`; utworzono osobną historię `prisma/migrations-postgresql` z baseline wygenerowanym ze schematu oraz `migration_lock.toml` PostgreSQL. Typy kwot relacyjnych mają `Decimal(18,2)`. Harness CI/Jest i workflow są przepinane na PostgreSQL 18 z osobnym schematem per worker/job; główny Compose/Docker jest w trakcie konwersji. Przygotowywany jest jednorazowy, read-only eksport/import wyłącznie aktywnych cenników; aktywne cenniki pozostają jedynymi danymi do zachowania. Wyszukiwanie ofert i FTS są w trakcie przepisywania. **Nie jest to jeszcze działająca migracja całej aplikacji:** liczne zapytania SQL i skrypty operacyjne wciąż są SQLite-only, a aplikacja nie została jeszcze uruchomiona na PostgreSQL 18. Lokalnie brak PostgreSQL/psql i Docker/Podman; nie wykonano testu integracyjnego na serwerze PostgreSQL. Nie wykonywano operacji na bazie produkcyjnej.

## Standard docelowej bazy

Docelowy standard jest zgodny z możliwościami PostgreSQL oraz zachowuje publiczne kontrakty S.O.K. To nie jest migracja przez mechaniczne podstawienie provider.

- **Wersja/host:** docelowo PostgreSQL 18 (obecna stabilna linia PostgreSQL na dzień planu) i stabilna Prisma ORM 7. Prisma ORM 6.19.3 ma security-only support tylko do 2026-11-19; Prisma 8 jest RC, więc nie używać jej produkcyjnie. Oficjalna tabela Prisma 6 potwierdza zgodność z PostgreSQL 18, ale Fazę implementacji rozpoczynać od upgrade'u do wspieranej stabilnej Prisma 7. Jeśli wybrana usługa nie oferuje PostgreSQL 18, zatwierdzić PostgreSQL 17 jako jawny wyjątek ADR przed wdrożeniem. Zapisać wersję główną, politykę aktualizacji, region, SLA, retencję i koszt w nowym ADR. Nie zakładać konkretnego dostawcy przed tą decyzją.
- **Schemat i nazwy:** w pierwszym przejściu zachować fizyczne nazwy istniejących tabel i kolumn, by nie łączyć rename masowego z konwersją providera. Prisma API/model names i obecne camelCase quoted identifiers pozostają; wszystkie nowe tabele/kolumny dostają konwencję uzgodnioną przed dodaniem. Osobny ADR może zdecydować o stopniowym `snake_case` rename po migracji. Użyć jednego schematu aplikacyjnego (`public`, jeśli hosting nie uzasadni izolacji innym schematem); nie używać nazw zastrzeżonych.
- **Typy:** czas zdarzeń jako `timestamptz` przechowywany w UTC, daty kalendarzowe jako `date`, statusy jako enum/check tam gdzie skończony i stabilny; identyfikatory pozostać stringami w publicznym kontrakcie, chyba że audyt udowodni bezpieczną korzyść z UUID. Nie wprowadzać `money`; kwoty używają dokładnego `numeric(p,2)`/Prisma Decimal lub jawnego modelu groszy po audycie kontraktów, a zaokrąglanie biznesowe pozostaje w `roundMoney` half-up. `Float` pozostaje dla miar/ocen, które naprawdę są ciągłe, nigdy dla kwot.
- **JSON i relacje:** klasyfikować każde pole JSON-serializowane: niezmienne snapshoty/dokumenty mogą być `jsonb` z `schemaVersion`; filtrowane i relacyjne dane stają się jawnie typowanymi kolumnami/tabelami. Nie normalizować wszystkich snapshotów. Zastąpić SQLite JSON1 funkcje operatorami/wyrażeniami PostgreSQL i zadbać o indeksy GIN/wyrażeniowe tylko po pomiarze.
- **Integralność:** klucz główny każdej tabeli; jawne `NOT NULL`, `UNIQUE`, FK i reguły `onDelete`/`onUpdate`; `CHECK` tylko dla niezmienników pojedynczego wiersza, które nie dublują reguł aplikacyjnych i nie odwołują się do innych wierszy. Nie dodawać FK do relacji polimorficznych bez rozstrzygniętego modelu. Nazwy ograniczeń stabilne i czytelne.
- **Indeksy:** zachować indeksy schematu, ocenić je na podstawie query shapes i `EXPLAIN (ANALYZE, BUFFERS)` na bezpiecznych danych. Sprawdzać indeksy wiodącymi kolumnami, partial/GIN tylko tam gdzie pasuje zapytanie; unikać duplikatów i indeksowania wszystkiego.
- **Transakcje/współbieżność:** zachować CAS/optimistic locking oraz atomiczne claimy; testować konflikt dwóch zapisów i semantykę unique constraints/serializacji na PostgreSQL. Jawnie retry wyłącznie dla znanych transient SQLSTATE, ograniczona liczba prób i idempotentny payload; bez ogólnego retry.
- **Bezpieczeństwo operacyjne:** osobne role/sekrety dla runtime i migracji; runtime najmniejsze potrzebne uprawnienia, bez superusera i DDL; TLS wymagany poza lokalnym dev, sekrety wyłącznie przez secret store/env deploymentu. Oddzielne pooled URL dla aplikacji i direct URL dla migracji/admin jeśli dostawca używa poolera; nie uruchamiać migracji przez transaction pooler.
- **Migracje:** migracje wyłącznie addytywne, deterministyczne i reviewowane; release uruchamia `prisma migrate deploy` na direct connection jako pojedynczy krok przed nową wersją aplikacji. Bez `db push` w staging/production, bez auto-heal DDL przy starcie. Test: pusta baza → pełna historia migracji → seed → brak driftu.
- **Backup/restore:** udokumentowany format `pg_dump` (preferencyjnie custom archive), szyfrowanie w spoczynku i w transporcie, checksum, polityka RPO/RTO i retencja zaakceptowana przez właściciela; regularny restore drill do izolowanej bazy, następnie migracje/status/check aplikacji. Backup nie zastępuje restore testu.

## Dozwolone wzorce i źródła

1. Prisma ORM 7 (stabilne): provider `postgresql`, wersje `prisma` i `@prisma/client` zgodne i przypięte, Node.js spełniający oficjalny floor, wymagany driver adapter, `prisma.config.ts` oraz generator/ścieżkę klienta zgodne z Prisma 7. Przed użyciem potwierdzić dokładną konfigurację i typy na oficjalnych docs oraz minimalnym testem CLI. Nie kopiować wzorców Prisma 8 RC.
2. PostgreSQL: DDL, typy, ograniczenia, indeksy, role i backup zgodne z dokumentacją oficjalną PostgreSQL; transakcje i constrainty stanowią ochronę integralności.
3. Oficjalne odniesienia sprawdzone w przygotowaniu planu:
    - [PostgreSQL 18: constraints](https://www.postgresql.org/docs/18/ddl-constraints.html)
    - [PostgreSQL 18: data types](https://www.postgresql.org/docs/current/datatype.html), [date/time](https://www.postgresql.org/docs/current/datatype-datetime.html), [numeric](https://www.postgresql.org/docs/18/datatype-numeric.html)
    - [PostgreSQL 18: indexes](https://www.postgresql.org/docs/18/indexes.html), [multicolumn indexes](https://www.postgresql.org/docs/18/indexes-multicolumn.html)
    - [PostgreSQL 18: backup and restore](https://www.postgresql.org/docs/18/backup.html), [`pg_dump`](https://www.postgresql.org/docs/18/app-pgdump.html), [`pg_restore`](https://www.postgresql.org/docs/18/app-pgrestore.html), [schemas and privileges](https://www.postgresql.org/docs/18/ddl-schemas.html), [connections and authentication](https://www.postgresql.org/docs/18/runtime-config-connection.html)
    - [Prisma ORM 6: PostgreSQL connector](https://www.prisma.io/docs/orm/v6/overview/databases/postgresql), [development and production migrations](https://www.prisma.io/docs/orm/v6/prisma-migrate/workflows/development-and-production)
    - [Prisma ORM: release status](https://www.prisma.io/docs/orm/release-status), [Prisma ORM 6 supported databases](https://www.prisma.io/docs/orm/v6/reference/supported-databases), [Prisma ORM 7 PostgreSQL setup](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql)
    - Główne wzorce projektu: `docs/SYSTEM_INVARIANTS.md`, `docs/agents/database.md`, `docs/agents/testing.md`, `docs/agents/release.md`, `docs/MONEY_ROUNDING.md`, `docs/development/GIT_SAFETY.md`, `docs/DEPLOYMENT.md`.
4. Antywzorce: pozostawienie SQLite URL/default, dopuszczenie dwóch providerów, użycie `db push` dla utrzymania środowisk, odtwarzanie bazy bez restore testu, maskowanie błędu cennika seedem, `Float` dla PLN, konwersja pól bez analizy semantycznej, broad catch/retry, runtime DDL, testy wyłącznie na mockach/SQLite, `json_extract`/`json_valid`/`json_array_length`/`INSERT OR IGNORE`/`PRAGMA` w ścieżce PostgreSQL.

## Mapa schematu PostgreSQL — wynik discovery, przed zmianą providera

Źródła: `prisma/schema.prisma` (56 modeli; brak deklaracji `DateTime` i `Json`), wyszukiwane callsites aplikacji, `src/utils/money.ts`, `docs/MONEY_ROUNDING.md`, seed JSON oraz migracje SQL. Poniższe mapowanie jest projektem dla implementacji; nie należy jednocześnie przełączać providera, dopóki nie zostaną zaktualizowane serializatory i zapytania każdej domeny.

### Daty i czas

Wszystkie poniższe pola są obecnie `String` z ISO timestamps i kandydatem na `DateTime @db.Timestamptz(3)` (UTC, milisekundy); konwersja wymaga aktualizacji Prisma write/read, sort/filter, raw bindings i serializacji odpowiedzi do ISO string, by API nie zmieniło kształtu:

| Modele                  | Pola                                                                                                                                                                                                                                                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI/telemetria           | `ai_telemetry_logs.createdAt,lastUsedAt,lastAcceptedAt,lastRejectedAt`; `ai_telemetry_events.createdAt`; `ai_config_history.createdAt`; `ai_telemetry_versions.createdAt`; `ai_knowledge_base.firstDetectedAt,lastHitAt,lastUpdatedAt`; `ai_recommendations.generatedAt,decidedAt`; `ai_transition_snapshots.createdAt` |
| Audyt, klienci i oferty | `audit_logs.createdAt`; `clients_rel.createdAt,updatedAt`; `client_contacts_rel.createdAt,updatedAt`; `offers_rel.createdAt,updatedAt`; `offers_studnie_rel.createdAt,updatedAt`                                                                                                                                        |
| Opieka i zlecenia       | `offer_follow_ups.createdAt,updatedAt,contactedAt,nextContactAt`; `latest_followup.nextContactAt,contactedAt,createdAt`; `orders_studnie_rel.createdAt`; `orders_rury_rel.createdAt`; `production_orders_rel.createdAt,updatedAt`                                                                                       |
| ML i bezpieczeństwo     | `AiFeature.createdAt`; `AiModel.createdAt`; `AiTrainingRun.startedAt,finishedAt,datasetStartAt,datasetEndAt`; `AiTransfer.createdAt`; `AiEvaluation.triggeredAt`; `aiRewardLog.createdAt`; `document_shares.createdAt`; `idempotency_keys.createdAt,expiresAt`; `doc_locks.lockedAt,heartbeatAt`; `users.createdAt`     |
| Cenniki, care i drafty  | `PricelistVersion.effectiveFrom,createdAt,updatedAt,approvedAt`; `care_states.snoozedUntil,doneAt,updatedAt`; `care_sla_config.updatedAt`; `care_sla_scopes.updatedAt`; `care_notifications.readAt,createdAt`; `drafts.updatedAt,expiresAt`                                                                             |

Wyjątki: `sessions.createdAt,lastActivity` są epoch-ms `BigInt` (zostawić w tej migracji); `ai_telemetry_versions.appliedFrom` jest tekstem opisowym `${APP_NAME} @ ${now}`, nie timestampem; daty treningu trzeba sprawdzić pod kątem semantyki przed konwersją. `searchUtils` i produkcyjne wyszukiwanie obsługują legacy epoch-ms przez SQLite `GLOB`/`datetime` — ich normalizację należy opisać i przetestować, nie zgubić.

### JSON tekstowy → `Json` / PostgreSQL JSONB

Potwierdzone kandydaty wymagają wymiany `JSON.parse/stringify` na granicy persistence, walidacji shape/version oraz jawnego rozróżnienia SQL NULL i JSON null:

- `ai_telemetry_logs`: `original_auto_config`, `final_user_config`, `ringHeights`, `appliedReductions`, `appliedKonus`, `appliedHatches`, `appliedSeals`, `allComponentIds`, `featureSnapshot`, `labelSnapshot`, `predictionSnapshot`, `extraMeta`.
- `ai_config_history.configJson,diffFromParent`; `ai_knowledge_base.changeHistory,context,recommendation`; `ai_recommendations.payload`; `audit_logs.oldData,newData`.
- Dokumenty: `offers_rel.data,history`; `offers_studnie_rel.data,history`; `orders_studnie_rel.data`; `orders_rury_rel.data`; `production_orders_rel.data`; `drafts.payload`; `idempotency_keys.responseBody`.
- ML: `AiModel.weights,metrics,features,featureMins,featureMaxs,featureDistributions`; `AiTrainingRun.metrics`; `aiRewardLog.configSnapshot`.
- Cenniki PRECO: `PricelistItemPrecoZakresy.grupy`; `PricelistItemPrecoKonfig.value` (jest to JSON-string, zachować jego shape w DTO i seed exporterze).

Nie zamieniać bez producer audit: `settings.value`, `user_preferences.value`, `ai_telemetry_events.previousValue,newValue` (wartości key-dependent). Snapshoty mają zachować kopertę `{schemaVersion,data}` zgodnie z `src/utils/snapshots.ts`; dokument offer payloads muszą przejść audyt kompatybilności historycznych wersji.

Read-only audit potwierdził 0 pól Prisma `DateTime` i 0 pól Prisma `Json`; czas jest obecnie głównie `String`, a sesje używają `BigInt` epoki. Testy zawierają zarówno ISO jak i epoch-ms (`tests/apiValidation.test.ts:321-329,365-366`), a SQL normalizujący daty jest SQLite-only. Nie zmieniać typów przez masowy rename: przy cutover do `timestamptz` normalizować oba wejściowe formaty, a API nadal serializować w uzgodnionym ISO. `Session.lastActivity` i wszystkie pola JSON tekstowe wymagają jeszcze pełnego inventory producerów przed wyborem `Json`/`jsonb`.

Główne SQLite JSON1 callsites do wspólnej modernizacji: `src/routes/offers/search.ts`; `src/services/careService.ts`; `src/routes/offers/followUpStats.ts`; `src/routes/offers/studnieCrud.ts`; `src/routes/orders/production.ts`, `src/routes/orders/productionSearch.ts`; `src/utils/productionSearchUtils.ts`, `src/utils/productionOrderGuard.ts`, `src/utils/searchUtils.ts`. Operatory JSONB, `jsonb_array_elements`, typy/casty oraz indeksy wyrażeniowe/GIN muszą być sprawdzone testem parity; indeksy tylko na zmierzone query shapes.

Read-only SQL audit sklasyfikował jako P0: startowe `PRAGMA`/`sqlite_master` i runtime schema-heal w `src/initDatabase.ts`; JSON1/`GLOB` w wyszukiwaniu ofert, `careService.ts` i FTS5 w `src/utils/fts5Sync.ts`; oraz `rowid`, `INSERT OR IGNORE`, `randomblob()` w opiece. P1 obejmuje order/production SQL i follow-up stats. Są to bramki rzeczywistego provider switch, nie tylko zadania optymalizacyjne. Graphify istniejący przed tą pracą był nieaktualny (wskazywał Prisma 6); odświeżenie graphu wykonać po domknięciu kolejnego zakresu zmian.

### Kwoty, miary i wyniki

Kandydaci PLN → `Decimal @db.Decimal(18,2)` (18,2 ma pojemność większą od wartości seedów, ale pozostaje tymczasowy do kontroli aktywnego cennika i maksimum walidatora): `offer_items_rel.price`; `offer_studnie_items_rel.price`; `offers_rel.transportCost`; `offers_studnie_rel.transportCost,totalPrice`; `offer_follow_ups.competitorPrice`; `AiFeature.totalPrice`; `PricelistItemRury.price,transport`; `PricelistItemStudnie.price,transport,cena1,cena2,cena3,doplataPEHD,doplataZelbet,doplataDrabNierdzewna,malowanieWewnetrzne,malowanieZewnetrzne`; `PricelistItemPrecoKinety.cena`. `AiFeature.totalPrice` jest osobną cechą ML: zmiana jego numerycznej reprezentacji pozostaje poza batchami ofert/cenników i wymaga weryfikacji kontraktu transferu/modelu przed zmianą.

Odczyt seedów 2026-11-04: `data/seed_rury.json` 170 kandydatów liczbowych, max 7 500; `seed_studnie.json` 1 564, max 1 000 000; `seed_preco.json` 10, max 3 500; wszystkie mają max 0 miejsc dziesiętnych w tych plikach. **To nie dowodzi maksimum aktywnego cennika, importów ani ofert.** Przed ustaleniem `numeric(p,s)` przejrzeć walidatory, roundMoney, fixture/API zakresy i uzyskać preflight z aktywnych danych. PostgreSQL `numeric` jest dokładny; nie używać typu `money` ani konwersji przez binary Float. Zachować `roundMoney` half-up przy istniejącej granicy biznesowej i zdefiniować `Decimal`→API/JSON/XLSX/PDF bez zmiany DTO.

Nie PLN: `quantity` (miara, sprawdzić dozwoloną precyzję), `discount` (procent 0–100; `src/validators/offerSchemas.ts`), wymiary/waga/powierzchnia i cechy geometrii (float, w tym `rzDna`, `rzWlazu`, `wellHeight`, `dennicaHeight`, `heightFromBottomMm`, `angleDeg`, `affectedDennicaHeight`, `minimalDennicaForTransitionsMm`, item `weight/area/areaExt`), a także confidence/ranking/reward/probability/AI statistics (`rankingScore`, `confidenceScore`, `learningWeight`, `rewardValue`, `successRate`, knowledge/recommendation scores, `ringVariety`, model bias/metrics, `totalReward`). Zostają `Float`/Postgres `double precision` dopóki domena nie wymaga decimalnej miary; wyodrębnić `AiFeature.totalPrice` jako PLN, a `AiFeature.totalWeight` i wskaźniki statystyczne zostawić jako miary/wyniki.

### Relacje, częściowe unikalności i triggery

Zachować obecne Prisma FK: nullable `offer_items_rel.offerId → offers_rel.id`; wymagane `versionId → PricelistVersion.id` dla pięciu modeli `PricelistItem*`; wszystkie `onDelete: Restrict`. Nie dopisywać FK do scalar owner/user/client/order IDs bez audytu usuwania i orphanów. Pary `offerKind+offerId`, `documentType+documentId`, `docType+docId` są polimorficzne i nie mają pojedynczego FK celu; pozostają aplikacyjnie walidowane.

Utrzymać NULL-distinct semantykę PostgreSQL, równe zachowaniu SQLite dla unikalności nullable `offer_number` i `(userId,productionNumber)`; rozstrzygnąć separately puste stringi przed migracją. Utrzymać jawne unique/PK z Prisma schema i odtworzyć partial unique SQL z ograniczeniami `WHERE`:

| Reguła SQL-only                                     | Dowód istniejącej migracji                                                                                                                            |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dedup reward dla well/action                        | `20260815000001_uq_reward_well_action`                                                                                                                |
| Numer produkcyjny, partial dla rekordów z wartością | `20260907000000_prod_number_unique`                                                                                                                   |
| Terminal follow-up per cycle i cycle uniqueness     | `20261008000001_fu_terminal_uq`, `20261009000000_fu_cycles`                                                                                           |
| Unread notification uniqueness                      | `20261010000003_care_notif_uq`                                                                                                                        |
| Jedna approved wersja/warunek osi cennika           | `20261021000000_pricelist_approved`                                                                                                                   |
| Jeden draft na typ cennika                          | `20261023000000_pricelist_one_draft`                                                                                                                  |
| Aktualizacja latest follow-up                       | `20261014000000_care_latest_followup` trigger SQL, do odtworzenia na PostgreSQL albo zastąpienia atomowym service upsert + concurrency/property tests |

W Prisma ORM 7 użyć checked-in custom migration SQL dla partial indexes/triggers i sprawdzić je w `pg_catalog`; wyrażenia CHECK mają dotyczyć pojedynczego wiersza. Nie przenosić SQLite `PRAGMA`/table rebuild/JSON SQL.

## Fazy realizacji

### Faza 0 — dokumentacja, discovery i decyzje blokujące

**Jak służy celowi:** ustala dokładny zakres oraz parametry nowej bazy, zanim powstanie schemat lub ryzykowna operacja danych.

**Do wykonania**

- Zaktualizować dowody z bieżącego HEAD: pełna lista `node:sqlite`, `sqlite_master`, `PRAGMA`, `json_*`, `INSERT OR IGNORE`, `file:` URL, SQLite migracji, nazw `.sqlite`, wolumenów, cronów i komend restore/backup; każda pozycja ma ownera i decyzję: usunąć, zastąpić lub zostawić jako narzędzie archiwalne.
- Zmapować 56 modeli: tabele/kolumny, użycia raw SQL, pola kwotowe vs miary, daty ISO vs kalendarzowe, stringi JSON, relacje brakujące/polimorficzne, wszystkie unikalności i sortowania. Dla kwot porównać wartości/zaokrąglenia z `roundMoney` i `docs/MONEY_ROUNDING.md`.
- Ustalić usługę/hosting, wersję PostgreSQL, region, TLS, pooled/direct URL, limity połączeń, role, sekret store, SLA, backup, RPO/RTO, koszty oraz właściciela migracji; dopisać ADR PostgreSQL, jawnie supersede `ADR-001` i `ADR-012`.
- Zakończyć Prisma 7 stable upgrade jako oddzielny, weryfikowalny krok na obecnym providerze przed przełączeniem PostgreSQL; wymaga on oficjalnej konfiguracji z driver adapterem/generatorem Prisma 7 i zielonych testów bez użycia API v8 RC. Dla wersji Node sprawdzić rzeczywisty Docker/CI floor przed wyborem dokładnego Prisma 7 release.
- Zatwierdzić definicję „aktywnego” cennika z `src/services/pricelist/usage.ts`/lifecycle; wykonać read-only preflight raportu osi (rury/studnie/PRECO), count pozycji, wersji, `effectiveFrom`, SHA-256 i walidacji `prices:verify` bez eksportu sekretów.
- Wskazać listę danych celowo resetowanych oraz procedurę odtworzenia admina; uwzględnić osierocone pliki/dokumenty i sesje po stronie przeglądarki (IndexedDB/draft cache) jako osobną decyzję retencji, bez cichego przypięcia do nowych dokumentów.

**Dokumentacja / wzorce:** `docs/adr/ADR-001-sqlite.md`, `docs/adr/ADR-012-single-node-sqlite.md`, `docs/agents/database.md`, `docs/SYSTEM_INVARIANTS.md` I-005/I-006/I-014, Prisma ORM 6 PostgreSQL/migrate docs, PostgreSQL 18 docs wymienione wyżej.

**Weryfikacja:** audyt ma zero nieprzypisanych grep-hitów; model map ma wszystkie modele/kolumny; cenniki mają rozstrzygniętą aktywność i dokładne counts/hash; decyzje hostingu i RPO/RTO podpisane; wersja narzędzi potwierdzona przez repo (`package.json`/lockfile), nie z pamięci.

**Antywzorce:** rozpoczęcie zmian przed decyzją hostingu, założenie, że każdy `Float` jest kwotą lub że każdy JSON ma zostać JSONB, wybór cennika po samym `status = ACTIVE`, brak rozpoznania lokalnych draftów i plików ofert.

### Faza 1 — upgrade do wspieranej Prisma 7 na SQLite (krok przejściowy)

**Jak służy celowi:** pozwala oddzielnie wykryć zmiany ORM/runtime przed zmianą dostawcy bazy, a docelowy PostgreSQL nie startuje na Prisma 6 tuż przed końcem jej security support.

**Do wykonania**

- Podnieść `prisma` i `@prisma/client` do zgodnego, exact-pin stabilnego wydania Prisma 7 (stan discovery: 7.10.1; ponownie sprawdzić release status przy implementacji). Nie używać `latest`, bo Prisma 8 jest RC.
- Zaktualizować generator do `prisma-client` z jawnie wskazanym `output`, schemat i importy klienta/build/test do nowego output. Zachować CJS/TS build obecnego repo przez jawne `moduleFormat` i config potwierdzone oficjalnym upgradem; nie wprowadzać niezamierzonego ESM cutover całej aplikacji.
- Dodać Prisma 7 root config (`prisma.config.ts`), jawne dotenv loading, migration/seed config i `prisma db seed`; jawnie wygenerować klienta w build/test/deploy (Prisma 7 nie robi tego automatycznie po migracjach). Zaktualizować wersję Node do minimum wspieranego floor (Node 22.12+ na bieżącej linii 22) we wszystkich obrazach i CI.
- Na tym kroku zachować SQLite provider wyłącznie jako izolowany mechanizm przejściowy; skonfigurować i exact-pin `@prisma/adapter-better-sqlite3` oraz sprawdzić zachowanie query event telemetry/metrics API. SQLite nie będzie wspieranym providerem finalnego rozwiązania.
- Nie zmieniać logiki biznesowej w tym etapie. Obsłużyć konieczne API/breaking changes Prisma 7, typy, klient i test setup; zanotować SQLite-only test/tool, który zostaje do wyeliminowania w późniejszych fazach.

**Dokumentacja / wzorce:** [Prisma ORM 7 upgrade guide](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7), [SQLite adapter](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/sqlite), [system requirements](https://www.prisma.io/docs/orm/v7/reference/system-requirements), release status; repo `package.json`, `tsconfig.json`, `Dockerfile`, CI workflows, `src/prismaClient.ts`, generated client usage.

**Weryfikacja:** Prisma 7 CLI/client/adapters mają identyczne exact versions; Prisma generate i migracje działają na izolowanym SQLite; `npm run validate`, migracyjne, security, auth/offers, E2E i query telemetry testy przechodzą bez zmiany wyników; runtime Node jest zgodny; lockfile nie zawiera Prisma 6/8 RC.

**Antywzorce:** bump do Prisma 8 RC, `prisma@latest`, dodanie v7 config bez jawnego URL loading, zapomniany client generation, zmiana provider w tym samym commicie/paczce, migracja całego backendu na ESM bez potrzeby, nieprzypięty adapter.

### Faza 2 — docelowy model i kontrakty PostgreSQL

**Jak służy celowi:** określa profesjonalny, spójny model typów i integralności, który zachowuje zachowanie aplikacji i pozwala rozszerzać domenę.

**Do wykonania**

- Sporządzić tabelę „obecny model → docelowy PostgreSQL”: typ Prisma/SQL, nullability, default, PK/FK, onDelete/onUpdate, unique/check, indeks, czy pole jest API-visible, owner i uzasadnienie.
- Określić dokładne mapowania `DateTime`/`String ISO` → `timestamptz` albo `date`; `Float` → `Decimal` tylko dla kwot PLN; pozostałe `Float` pozostają miarami/scoringiem. Wskazać precyzję/scale oraz sposób serializacji Decimal w API/JSON/PDF/Excel, bez zmiany wartości poza canonical `roundMoney`.
- Dla ofert i zamówień rozdzielić pola do wyszukiwania/sortowania od snapshotu. Zdecydować format `jsonb` i wersjonowanie (`{schemaVersion,data}`) dla dokumentów, sposób przechowywania/indeksowania i obsługę rekordów historycznych. Zastąpić niejawne zależności JSON1 projekcjami jawnych kolumn tam, gdzie filtr/sort jest produkcyjną ścieżką.
- Potwierdzić decyzję pierwszego cutoveru o zachowaniu dotychczasowych fizycznych nazw; uzgodnić schemat, enumy, długości/typy, semantykę NULL/unikalności (w tym NULLs), FK dla relacji prawdziwych; jawnie opisać świadome wyjątki i powód.
- Przygotować SQL/query matrix dla wszystkich raw queries oraz zmierzone indeksy do wyszukiwania ofert, audit retention, idempotency, locków, cenników i transferów.

**Dokumentacja / wzorce:** `prisma/schema.prisma`, `src/routes/offers/search.ts`, `src/utils/roundMoney`/`docs/MONEY_ROUNDING.md`, `docs/SYSTEM_INVARIANTS.md`; PostgreSQL constraints, types, numeric, date/time, indexes docs.

**Weryfikacja:** każdy model i raw query ma docelową definicję; wartości PLN mają dokładną politykę precyzji/serializacji; żaden inwariant nie jest przeniesiony z aplikacji do niespójnego CHECK/FK; akceptacja mapy typów przez właściciela produktu.

**Antywzorce:** zachowanie `Float` dla PLN bez uzasadnienia, typ `money`, każdy snapshot jako JSONB bez wersjonowania, migracja przez masową normalizację, zbyt szerokie FK/ON DELETE CASCADE, indeksy bez query shape i pomiaru.

### Faza 3 — provider, historia migracji i świeża baza

**Jak służy celowi:** daje powtarzalną i audytowalną ścieżkę tworzenia PostgreSQL, niezależną od SQLite i bez driftu.

**Do wykonania**

- Przełączyć Prisma schema/lock na `postgresql`; ustawić fizyczne mapowania i typy zaakceptowane w Fazie 1. Regenerować klienta jedynie przez wersję CLI przypiętą lockfile.
- Utworzyć czystą historię migracji PostgreSQL od uzgodnionego schematu pustej bazy. SQLite migrations nie uruchamiać na PostgreSQL; zachować je archiwalnie poza aktywną ścieżką Prisma migrate i nie kasować z historii repo bez jawnej decyzji.
- Użyć `migrate dev` wyłącznie na izolowanej developerskiej bazie PostgreSQL do wygenerowania/review migration SQL; sprawdzić DDL, locki i czas migracji; wdrożenie używa `migrate deploy` direct URL. Nie polegać na `db push` poza krótkim lokalnym eksperymentem.
- Dodać świeżą instalację: pusta PostgreSQL → migracje → seed domyślnych danych/administratora z bezpiecznym sekretem → aktywne cenniki jako osobny import → `prices:verify` → readiness. Startup nie wykonuje DDL/auto-heal.
- Zapewnić nazwane constraints, PK/FK, defaults, indeksy i brak niedozwolonych relacji; sprawdzić drift `migrate diff`/status według Prisma ORM 7.

**Dokumentacja / wzorce:** `prisma/migrations/`, `prisma/migrations/migration_lock.toml`, `docs/agents/database.md`, `docs/SYSTEM_INVARIANTS.md` I-005, `docs/adr/ADR-004-express-prisma.md`; Prisma ORM 7 migrate workflows/config, PostgreSQL DDL/constraints/indexes.

**Weryfikacja:** z pustej bazy w CI przechodzą wszystkie migracje; drugi deploy jest idempotentny; `prisma migrate status` czysty; schema diff nie ma driftu; seed idempotentny i brak DDL w kodzie startowym; `pg_catalog`/`information_schema` potwierdzają wymagane constraints/indexes.

**Antywzorce:** pozostawienie `migration_lock` sqlite, uruchamianie starych SQLite migrations, akceptacja strat przez `db push`, ręczne poprawki DB poza migracją, wykonywanie migracji jednocześnie przez wiele replik.

### Faza 4 — aplikacja, SQL i semantyka typów

**Jak służy celowi:** zapewnia te same funkcje ofert, cen, użytkowników i dokumentów po zmianie silnika.

**Do wykonania**

- Usunąć SQLite URL/path normalization i `mkdir` z `src/prismaClient.ts`; wymagać jawnego, prawidłowego PostgreSQL URL poza testami. Utrzymać jeden singleton Prisma; telemetria zapytań nie loguje SQL ani PII.
- Przepisać każdy raw query i SQL migration: przede wszystkim wyszukiwanie ofert (`json_extract`) z parity sort/filter/pagination; zdefiniować casty, null ordering, case/collation i escaping. Parametry nadal przekazywać przez Prisma tagged templates/parametry, bez konkatenacji danych wejściowych.
- Zmienić typy modeli, services, serializers i frontend/API w sposób zachowujący JSON kontrakty. Dla Decimal jawnie serializować wartości i weryfikować `roundMoney`; uniknąć `Prisma.Decimal` leakage do `JSON.stringify`, xlsx, CSV i PDF.
- Przeglądnąć transakcje, `updateMany` CAS, `createMany`, seedy chunkowane i concurrency; dopisać bounded retry tylko dla wybranych SQLSTATE konfliktu/deadlock/serialization, z idempotency key i metryką.
- Zachować kolejność raportów, numerów dokumentów, statusów, FTS, eksportów i renderowania snapshotu (I-001–I-014). Nie dodawać niepotrzebnych zmian UI; komunikaty DB błędów pozostają generyczne i nie ujawniają SQL/hosta.

**Dokumentacja / wzorce:** `src/routes/offers/search.ts`; `src/utils/versionWrite.ts`, `src/utils/ownership.ts`, `src/services/pricelist/`, `src/routes/offers/`, `src/utils/snapshots.ts`; testy kontraktowe ofert i cenników; PostgreSQL docs dot. transakcji/typów.

**Weryfikacja:** query parity ze stałymi fixture dla SQLite starego wyniku vs PostgreSQL nowego; round-trip API dla Decimal/JSON snapshots; testy CAS, idempotency, unique numbering, ownership i FK; brak SQLite query/API pattern w aplikacji; typecheck BE/FE i lint po zmianach.

**Antywzorce:** nieparametryzowany SQL, ciche zmiany sortowania/NULL, `parseFloat` kwot, różny format JSON między API/CSV/PDF, retry wszystkich błędów Prisma, przechwycenie błędów cennika i fallback do seed.

### Faza 5 — wyłącznie cenniki aktywne i cutover danych

**Jak służy celowi:** przenosi dokładnie jedyną kategorię danych objętą retencją i dowodzi, że ceny nie zmieniły się podczas cutover.

**Do wykonania**

- Zaimplementować osobny, audytowalny export/import cenników z `PricelistVersion` i wszystkich pięciu typów itemów. Artefakt ma jawny `schemaVersion`, typ/wersję/seq/effectiveFrom/approval/hash/counts/canonical data, checksum, bez sekretów i bez pozostałych tabel. Utrwalić dokładny resolved `PricelistVersion.id` per oś na zamrożony czas cutover; eksportować tylko override setting dla tej wersji, jeśli jest aktywny.
- Dry-run raportuje dla każdej osi wykrytą aktywną wersję zgodną z lifecycle, liczbę pozycji per model, wynik SHA-256, walidację referencji, walut i `prices:verify`; brak wersji, wiele aktywnych lub mismatch = abort bez zapisu.
- Przećwiczyć export → checksum → import do pustego izolowanego PostgreSQL → odczyt lifecycle/API → porównanie itemów/hash/counts i wyceny reprezentatywnych ofert. Cenniki zachowują oryginalne IDs i datę efektywności; nie przenosić draftów, historycznych ani zaplanowanych wersji.
- Przy właściwym cutover: sprawdzić poprawny backup starej bazy i odrębny cennikowy artifact; zatrzymać aplikację/zapisy; wyeksportować jeszcze raz z finalnego stanu; zweryfikować; wykonać migracje i nie-cennikowy seed; zaimportować zachowany artifact przed `ensureBaselineVersionsAtStartup` (lub jawnie pomijać bootstrap, gdy artifact jest przypięty), tak by seed nie dodał fabrycznej wersji; sprawdzić tylko cenniki; uruchomić aplikację i smoke; dopiero po akceptacji kierować ruch. Stara baza zachowana tylko w trybie odczytu przez uzgodniony okres rollbacku; nie reanimować jej równoległymi zapisami.
- Dokumentować odtworzenie nowego admina bez przenoszenia starych sesji/hashy haseł. Rozważyć i jawnie zatwierdzić skutki istniejących lokalnych draftów/eksportów w przeglądarkach.

**Dokumentacja / wzorce:** `src/services/pricelist/lifecycle.ts`, `usage.ts`, `bootstrap.ts`, `src/utils/snapshots.ts`; `docs/SYSTEM_INVARIANTS.md` I-005/I-014; `npm run prices:verify`; kontrakt autonomii z przekazanych instrukcji (wskazany plik nie istnieje w checkout).

**Weryfikacja:** dry-run i import round-trip dają identyczne active version IDs, metadata, item counts i SHA-256; wszystkie osie przechodzą strict `prices:verify`; żadne inne tabele nie mają importowanych rekordów; powtórny import bezpiecznie odrzucany lub idempotentny.

**Antywzorce:** eksport całej bazy „na wszelki wypadek” i import selektywny bez allowlisty; cennik z seed JSON zamiast aktualnej DB; aktywność ustalana po string status; kasowanie starej bazy przed akceptacją nowej; dual-write.

### Faza 6 — backup, restore, deployment i operacje

**Jak służy celowi:** S.O.K. może wdrażać, monitorować i odtwarzać PostgreSQL bez zależności od SQLite na produkcji.

**Do wykonania**

- Zastąpić `scripts/backup.ts`, `restore-db.js`, `audit-integrity.mjs`, `check-db.js`, `check-legacy-db.js`, `audit-archive.mjs` oraz cron/deploy hooks: `pg_dump`/`pg_restore` albo uzgodnione oficjalne API hosta. Utrzymać checksum, retencję, marker świeżości i jawny wybór targetu restore; nie ujawniać connection stringów w argv/logach.
- `restore` tylko do izolowanego celu, waliduje checksum, wersję formatu, restore/migracje, `prices:verify`, zdrowie referencyjnych tabel i smoke. Restore do live wymaga osobnej flagi/potwierdzenia zgodnie z istniejącą bramą bezpieczeństwa.
- Zmienić Docker: app nie utrzymuje DB-volume ani nie zawiera lokalnego SQLite default; PostgreSQL jest osobną usługą/managed DB. Compose dev ma usługę PostgreSQL, healthcheck, wolumen i hasła tylko lokalne; prod credentials z secret managera. Entry point: sprawdza połączenie, pojedynczy deploy migracji, seed wyłącznie jeśli czysta baza, uruchamia serwer. `/health/ready` weryfikuje osiągalność DB bez ujawniania błędu.
- Zaktualizować `DATABASE_URL`, direct URL, TLS, connection limits/pooler, ENV templates, install/update scripts, release/rollback docs i CI secrets; oddzielne role `app_runtime`, `migration`, `backup` z minimalnymi prawami. Nie zakładać, że nazwa zmiennej `DIRECT_URL` jest obsługiwana przez Prisma ORM 7 — sprawdzić konkretną konfigurację i oficjalne API v7.
- Zdefiniować alerty: błędy połączenia/pula, latency zapytań, deadlocks/retry, brak backupu, nieudany restore drill, wolna przestrzeń, failed migration. Nie logować query text, danych klientów ani sekretów.

**Dokumentacja / wzorce:** `Dockerfile`, `docker-compose.yml`, `scripts/docker-entrypoint.sh`, `scripts/deploy-core.cjs`, `docs/DEPLOYMENT.md`, `docs/adr/ADR-006-https-transport.md`, `src/app.ts` health/readiness; PostgreSQL backup/restore/security docs.

**Weryfikacja:** czysta instalacja Docker i lokalna Compose; restart nie seeduje istniejących danych; managed environment connectivity/TLS; deploy/rollback; backup integrity/checksum oraz faktyczny restore drill; readiness 200/503 w kontrolowanych warunkach, bez diagnostyki wewnętrznej w body.

**Antywzorce:** wykonywanie `pg_dump` przez pooler, trzymanie superuser credentials w app, migrowanie z entrypointu każdej repliki, backup kopią pliku wolumenu, restore do prod bez jawnego celu, publiczne szczegóły DB w health/logach.

### Faza 7 — CI, integracja, kontrakty i QA całego produktu

**Jak służy celowi:** dowodzi na realnym silniku, że pełna aplikacja nadal realizuje pracę użytkownika, a nie tylko że typy się kompilują.

**Do wykonania**

- Dodać PostgreSQL service/container izolowane per CI job/worker; readiness probe; losowe nazwy baz/schema i gwarantowane sprzątanie bez dotykania dev/prod DB. Wszystkie integracyjne, migracyjne, security i E2E testy krytyczne uruchamiają się na PostgreSQL.
- Zachować unit testy z mockami dla szybkiej logiki, ale żadnego kontraktu SQL/migracji nie uznawać za udowodniony bez PG. Ograniczyć/dedykować stare SQLite fixture i testy wyłącznie do archiwalnych narzędzi; nie pozostawić joba, który daje fałszywe zielone na SQLite.
- Pokryć: migracje empty DB; seed/admin/login/logout/session invalidation; create/update/search/sort/page/delete offer, CAS/409, idempotency/unique numbering; wersje i aktywacja wszystkich cenników; zamówienia/ownership/audit/telemetry/retention; import ofert CLI przez HTTP; eksport CSV/XLSX/PDF/DOCX i połączony PDF; restore drill; health/readiness i SQL injection/security regression.
- E2E Playwright na ephemeral PG: logowanie, stworzenie i edycja oferty Rury i Studnie, zapis draftu/konfliktu, wyszukanie/listowanie, cennik aktywny, import i eksport plików, PDF, admin lifecycle. Sprawdzać wynik pliku/API i snapshot, nie wyłącznie HTTP 200.
- Dodać schema policy checks: brak `provider=sqlite`, `file:` URL/runtime defaults, `node:sqlite`, `PRAGMA`, SQLite-only SQL i migration SQL w aktywnych ścieżkach; `version:check`, encoding, migrate status/drift, role checks i `prices:verify` jako bramy.
- Wykonać `npm run format`, typecheck BE/FE, lint BE/FE, `test:quick`, PostgreSQL integracyjne i wymagane pełne Playwright; potem `npm run validate`. Zgodnie z repo: przed commitem wymagane także `npm run version:check`; commit tylko wrapperem `node scripts/commit.mjs ...`. Push nie jest częścią planu.

**Dokumentacja / wzorce:** `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `docs/agents/testing.md`, istniejące `tests/offersContract.test.ts`, `tests/searchSlimParity.test.ts`, `tests/migrations/restoreRoundtrip.test.ts`, `tests/security/`, `tests/playwright/`.

**Weryfikacja:** required GitHub checks przechodzą na PostgreSQL; migracje od zera i upgrade fixture są czyste; wszystkie krytyczne scenariusze mają asercje danych/plików; żadna brama SQLite nie została wyłączona zamiast przepisana; coverage/security pozostaje co najmniej na istniejącym progu.

**Antywzorce:** tylko SQLite w CI, tylko mocki, pominięte/skipped testy, `continue-on-error` dla krytycznych jobów, publiczna usługa PG w testach, testy na wspólnej bazie.

### Faza 8 — dokumentacja, cutover i okres stabilizacji

**Jak służy celowi:** formalnie usuwa sprzeczne reguły i bezpiecznie przenosi użytkowników na sprawdzony backend.

**Do wykonania**

- Zaktualizować root `AGENTS.md`, `docs/agents/database.md`, `testing.md`, `release.md`, `commands.md`, `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, README, install/update, lokalny dev, backup runbook, disaster recovery i onboarding. Usunąć zakaz PostgreSQL oraz instrukcje SQLite z aktywnych dokumentów; historię SQLite oznaczyć jako legacy. Rozstrzygnąć brak `docs/AUTONOMY_CONTRACT.md`: dodać politykę do repo albo poprawić odwołania do faktycznego źródła.
- `ADR-001` i `ADR-012` zmienić na „Superseded”, wskazując nowy zaakceptowany ADR PostgreSQL; zaktualizować I-005/I-006 i DB opisy w I-014, bez osłabiania kontraktów biznesowych.
- Checklista GO na live: zielone gate’y; snapshot/checksum całej starej bazy do rollbacku; osobny verified artifact cenników; konkretne counts/hashes zaakceptowane; maintenance window i komunikat dla użytkowników; odtworzenie konta admina/sekretu; jedna osoba accountable; rollback trigger, owner i deadline.
- Cutover pod nadzorem: pause writes → końcowy cennikowy export → verify/import → migration/seed → smoke suite → switch traffic → monitor DB/API/exports/prices → owner akceptuje. W rollbackie nie przyjmować zapisów w dwóch bazach; utracić nowe zapisy po switchu tylko po jawnej decyzji i raportowaniu skutków.
- Okres obserwacji obejmuje minimum jeden pełny cykl backupu/restore check oraz użycie głównych przepływów. Zamknąć migrację dopiero po potwierdzeniu eksportów, backup restore, cenników i stabilności; archiwalna SQLite zostaje poza ścieżką aplikacji zgodnie z retencją.

**Dokumentacja / wzorce:** kontrakt autonomii z przekazanych instrukcji (wskazany plik nie istnieje w checkout), `docs/adr/`, `docs/development/GIT_SAFETY.md`, `docs/agents/release.md`, `docs/DEPLOYMENT.md`; I-005/I-006/I-014.

**Weryfikacja:** nie ma sprzecznych aktywnych instrukcji o SQLite/PostgreSQL; release checklist i disaster recovery wykonane na stagingu; podpisany GO; monitoring i backup działa; cutover acceptance zawiera counts/hash cenników, scenariusze produktowe i ownera.

**Antywzorce:** uznanie GO na plan za GO na implementację lub produkcję; commit/push/deploy bez bramek projektu; kasowanie starego źródła przed stabilizacją; zamknięcie zadania bez przećwiczonego restore.

## Finalna definicja ukończenia

- PostgreSQL jest jedynym providerem w rozwoju, testach, CI, release i produkcji; aktywna dokumentacja nie wymienia SQLite jako backendu wspieranego.
- PostgreSQL świeży install oraz kolejne wersje powstają wyłącznie z migracji; zero driftu i brak runtime DDL.
- Zachowane są wyłącznie aktywne cenniki, zgodne co do wersji, metadanych, liczby pozycji i hashy; brak innych przeniesionych rekordów.
- Oferta Rury/Studnie oraz zapis, wyszukiwanie, import, eksport, PDF/DOCX, zamówienia, cenniki, auth/ownership, draft/CAS i backup/restore przechodzą automatyczne testy na PostgreSQL.
- `npm run version:check`, `npm run format`, `npm run validate`, PostgreSQL integration/E2E, migrate deploy verify, security gates, restore drill i CI wymagane checks są zielone.
- Cutover i rollback zostały przećwiczone/zaakceptowane, a wszystkie osobne GO dotyczące live danych i wdrożenia zapisane.
