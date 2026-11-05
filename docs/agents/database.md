# S.O.K. — Agent: baza danych (Prisma + PostgreSQL)

> Szczegółowy przewodnik domenowy. Root: `AGENTS.md` (mapa + bramy).

## Kierunek i status

PostgreSQL 18 jest jedynym wspieranym silnikiem danych runtime i aktywnych testów. Schemat i kanoniczna historia migracji są w `prisma/schema.prisma` i `prisma/migrations-postgresql/`; klient, runtime, narzędzia operacyjne, CI, instalatory Windows/Linux i Compose używają PostgreSQL. Nowe instalacje importują zatwierdzony pakiet `data/pricelists/active-pricelists.json`; żadne narzędzie runtime ani instalator nie otwiera SQLite. Wydanie 1.56.4 przeszło lokalne walidacje na PostgreSQL 18.6. To nie oznacza produkcyjnego cutoveru: przed live wymagane są osobny GO, zatwierdzenie planu backup/restore oraz weryfikacja docelowego środowiska.

## Standard schematu

- Utrzymuj jeden provider PostgreSQL i jedną kanoniczną historię migracji PostgreSQL, budowaną od pustej bazy. Nie uruchamiaj historii migracji SQLite na PostgreSQL.
- Kwoty PLN przechowuj jako dokładne `Decimal` z jawnie uzgodnioną precyzją/scale i serializuj na granicach API/eksportu do dotychczasowych typów JSON; zaokrąglaj wyłącznie przez `roundMoney` zgodnie z `docs/MONEY_ROUNDING.md`. Nie używaj typu `money` ani Float do walut.
- Chwile zdarzeń modeluj jako `timestamptz` UTC, daty kalendarzowe jako `date`; zachowuj publiczny format dat po jawnej serializacji. Nie konwertuj tekstu/epoki bez rozpoznania istniejących formatów i producentów.
- Używaj `Json`/JSONB dla pól, których kontrakt jest rzeczywiście strukturalnym JSON; wersjonowane snapshoty zachowują kopertę `{schemaVersion, data}`. Nie normalizuj całego modelu JSON bez uzasadnienia domenowego.
- Nowe relacje mają jawne PK/FK, reguły `ON DELETE`, named constraints i indeksy uzasadnione query shape. Wejście trafia do zapytań wyłącznie parametryzowane; nie sklejaj SQL z danymi użytkownika.
- Zachowuj wszystkie 56 modeli oraz rodziny `PricelistVersion`/`PricelistItem*`, `AiTransfer`, `client_contacts_rel` i `user_preferences`, chyba że osobna decyzja zmieni zakres.

## Migracje i cykl życia

- Zmiany schematu wyłącznie przez wersjonowane migracje PostgreSQL. `migrate dev` służy do generowania/review SQL na izolowanej bazie deweloperskiej; instalacja i release używają `migrate deploy`. Runtime nie wykonuje DDL, auto-heal, `db push` ani równoległego deployu migracji przez wiele replik.
- Każda migracja ma sprawdzenie SQL, ograniczeń, indeksów, locków, statusu i driftu na PostgreSQL. Najpierw fixture/czysta baza; upgrade danych produkcyjnych i live cutover wymagają odrębnej bramy GO.
- Świeża baza otrzymuje migracje, bezpieczny seed startowy oraz aktywne cenniki przez osobny allowlistowany i audytowany import. Zachowuj tylko aktualnie aktywne wersje zgodne z lifecycle; nie importuj draftów ani historii ofert/użytkowników.
- Nigdy nie maskuj błędu aktywnego cennika seedem fabrycznym ani fallbackiem do innego źródła.

## Operacje i bezpieczeństwo

- Aplikacja, migrator i backup używają oddzielnych ról o minimalnych uprawnieniach. Runtime nie otrzymuje superusera ani uprawnień DDL. Połączenia zdalne używają zweryfikowanego TLS; URL-e i sekrety pochodzą z secret managera/env, nigdy z kodu, logów ani argumentów procesu.
- Backup/restore opieraj na `pg_dump`/`pg_restore` lub oficjalnym API wybranego hosta; nie kopiuj plików bazy. Restore drill wykonuj na izolowanym celu, sprawdzając checksum, migracje, aktywne cenniki i health/smoke.
- `/health/ready` sprawdza osiągalność DB i zwraca odpowiedź bez szczegółów hosta, SQL ani sekretów. Monitoruj pulę, latency, błędy połączeń, deadlocki, miejsce, backup i restore.
- Przed migracją/seedem lub operacją na live DB sprawdź kontrakt autonomii w `AGENTS.md`; plan migracji nie jest zgodą na produkcyjny cutover.

## Domeny wymagające zachowania

- Wersje i aktywność cennika zgodnie z `src/services/pricelist/` oraz I-014; ceny ofert i snapshoty zgodnie z I-001.
- Ownership, numeracja/idempotencja i CAS zgodnie z I-003/I-004/I-009/I-013; nie zastępuj gwarancji przez cache ani lock aplikacyjny.
- Backup/restore muszą spełniać I-005/I-006. `tests/migrations/restoreRoundtrip.test.ts` weryfikuje archiwum `pg_dump` i restore przez `pg_restore` do izolowanej bazy PostgreSQL; scenariusz wymaga dostępnych binariów klienta PostgreSQL i nie może być zastąpiony testem dawnej bazy SQLite.
