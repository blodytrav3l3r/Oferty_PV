# Baza danych S.O.K. — PostgreSQL 18

**Docelowy silnik:** PostgreSQL 18

**ORM:** Prisma ORM 7

**Status:** PostgreSQL 18 jest jedynym providerem runtime, development, CI i
aktywnych testów. W wydaniu 1.56.4 migracje, Docker/Compose, instalatory,
operacje backup/restore oraz import wyłącznie aktywnych cenników działają w
ścieżce PostgreSQL.

**Potwierdzona walidacja (2026-11-05):** lokalna instancja PostgreSQL 18.6,
aplikacja `/health/ready` HTTP 200, `prices:verify` dla trzech aktywnych list
(1 023 pozycje), smoke backup/restore oraz pełne bramki pre-push:
573 zestawy / 5 734 testy i 23 testy Git safety. Nie wykonano produkcyjnego
cutoveru ani czystej instalacji na Ubuntu/Debian; są to odrębne działania
operacyjne i nie wynikają z lokalnej walidacji.

## 1. Zasady docelowego schematu

- PostgreSQL 18 jest jedynym wspieranym providerem w development, testach, CI,
  release i produkcji. Nie utrzymujemy równoległego runtime SQLite ani fallbacku
  do lokalnego pliku bazy.
- Utrzymuj jedną kanoniczną historię migracji PostgreSQL, tworzoną od pustej
  bazy. Historyczne migracje SQLite nie są migracjami PostgreSQL i nie mogą być
  uruchamiane na nowym providerze.
- Relacje modeluj przy użyciu nazwanych PK/FK, jawnych reguł `ON DELETE`,
  `UNIQUE`/`CHECK` oraz indeksów uzasadnionych rzeczywistymi zapytaniami. Nie
  przenoś runtime DDL ani schema auto-heal do aplikacji.
- Kwoty PLN przechowuj jako `Decimal` z natywnym `numeric(p,s)` o precyzji
  potwierdzonej preflightem aktywnych cenników, walidatorów i ofert. `18,2` jest
  kandydatem roboczym, nie zatwierdzoną wartością. Nie używaj `money` ani Float
  dla kwot; granicę biznesowego zaokrąglania stanowi `roundMoney` i
  `docs/MONEY_ROUNDING.md`.
- Chwile zdarzeń zapisuj jako `timestamptz` w UTC; daty kalendarzowe jako
  `date`. Przed zmianą istniejących tekstów/epok mapuj wszystkie formaty i
  zachowuj dotychczasową serializację API.
- Typ `Json`/`jsonb` stosuj tylko dla rozpoznanych kontraktów danych. Zachowaj
  snapshot envelope `{schemaVersion, data}` oraz rozróżnienie SQL NULL i JSON
  null.
- Parametry wejściowe trafiają do SQL przez parametryzowane zapytania. Nazwy
  istniejących tabel/kolumn zmieniaj tylko przez osobną, uzasadnioną migrację.

## 2. Docelowy lifecycle i migracje

1. Przygotuj pustą bazę PostgreSQL 18 w prywatnej sieci oraz oddzielne role
   runtime, migrator i backup o minimalnych uprawnieniach. Połączenia zdalne
   wymagają zweryfikowanego TLS.
2. Migrator odtwarza schemat wyłącznie z zatwierdzonej historii PostgreSQL.
   `migrate dev` jest przeznaczone do izolowanej bazy developerskiej i review
   wygenerowanego SQL; release używa `migrate deploy` dokładnie raz na release,
   poza startem każdej repliki.
3. Seed twórz tylko dla pustej bazy i bez przenoszenia haseł, sesji ani sekretów.
   Nie uruchamiaj automatycznego DDL przy starcie aplikacji.
4. Aktywne cenniki eksportuj ze źródłowej bazy jednorazowym, read-only
   eksporterem. Artefakt allowlistuje wyłącznie resolved aktywne wersje, ich
   pozycje i konieczny override; zawiera schema version, liczności i SHA-256.
   Import do PostgreSQL odrzuć przy niezgodnym hash/count albo niejednoznacznej
   aktywności. Historia ofert i pozostałe dane nie są przenoszone.
5. Po imporcie sprawdź `prices:verify`, schema drift, role/uprawnienia i
   kontraktowe przepływy ofert przed readiness lub przełączeniem ruchu.

**Status wykonania:** schemat PostgreSQL, kanoniczne migracje, bootstrap ról,
importer aktywnych cenników, preflight oraz narzędzia operacyjne są
zaimplementowane i przeszły lokalną walidację na PostgreSQL 18. Runbook
[`cutover/active-pricelists.md`](cutover/active-pricelists.md) opisuje
powtarzalną procedurę dla starej instalacji. Produkcyjny cutover nie został
wykonany i wymaga osobnej akceptacji oraz walidacji konkretnego środowiska.

## 3. Testy bazy

- Test harness wymaga jawnego `POSTGRES_TEST_URL`, a brak połączenia jest
  błędem. Każdy worker działa w odizolowanym schemacie PostgreSQL; Playwright
  otrzymuje osobny URL testowy. SQLite nie jest providerem aktywnych testów
  aplikacji. Wyjątek stanowią wyłącznie testy jednorazowego eksportera starego
  pliku cenników.
- Testuj migrate deploy na pustej bazie, ponowny deploy, drift, constraints,
  FTS/search, JSON, null ordering, Decimal round-trip, transakcje, CAS,
  idempotency i konkurencyjne zapisy.
- Testy API/E2E weryfikują zawartość ofert oraz eksportów CSV/XLSX/PDF/DOCX.
  Zachowaj inwarianty `docs/SYSTEM_INVARIANTS.md`, w szczególności I-001,
  I-003–I-006, I-009, I-013 i I-014.
- Testy PostgreSQL sprawdzają semantykę `Decimal`, transakcji, ograniczeń,
  wyszukiwania i izolacji. Przy zmianach schematu zachowaj suite’y migracji
  i drift check na PostgreSQL 18.

## 4. Backup i restore

Docelowy backup korzysta z `pg_dump` w formacie umożliwiającym kontrolowany
restore albo z oficjalnej usługi backupu wybranego hosta. Proces powinien
uruchamiać dedykowana rola backupu, niezależna od runtime. Connection stringi,
hasła i certyfikaty pobieraj z secret managera; nie umieszczaj ich w repo,
logach, dokumentacji ani argv widocznym dla innych procesów.

Każdy backup otrzymuje checksum, czas, wersję schematu i status weryfikacji.
Retencję dobierz do wymagań RPO/RTO i potwierdź testem. Restore wykonuj najpierw
do izolowanej bazy, sprawdź checksum, wersję/migracje, `prices:verify` oraz
smoke aplikacji. Restore do live wymaga jawnej osobnej zgody.

**Status wykonania:** `npm run backup` tworzy custom archive przez `pg_dump`,
`npm run restore` przyjmuje cel przez `RESTORE_DB_URL`, a narzędzia wspierają
role/guards PostgreSQL. Live restore wymaga osobnej roli migracyjnej i po
odtworzeniu ponownie stosuje granty dla runtime. Format archiwum, checksum,
walidacja archiwum i retencja są zaimplementowane; lokalny smoke
`pg_dump`/`pg_restore` na PostgreSQL 18 przeszedł. Przed produkcyjnym rolloutem
wymagany jest osobny restore drill do izolowanego celu, z oceną RPO/RTO.
Wymagania bezpieczeństwa i kontrakty komend są w [`DEPLOYMENT.md`](DEPLOYMENT.md).

## 5. Dane i historia migracji

Kanoniczny model Prisma znajduje się w `prisma/schema.prisma`, a źródłem zmian
schematu jest `prisma/migrations-postgresql/`. Modele obejmują m.in.
`PricelistVersion` i pozycje cennikowe, oferty, zamówienia, audyt,
ML/telemetrię, blokady oraz udostępnienia. Schemat PostgreSQL, typy kwotowe,
constraints i indeksy zmieniaj addytywnie, przez wersjonowane migracje.

Historyczne decyzje SQLite i wcześniejszy model zachowują
`docs/adr/ADR-001-sqlite.md`, `docs/adr/ADR-012-single-node-sqlite.md` oraz
`prisma/migrations/` wyłącznie jako kontekst legacy. Nie są instrukcją
konfiguracji ani eksploatacji docelowej bazy. Jedyny wspierany wyjątek
odczytujący stary SQLite to jednorazowy, read-only eksport aktywnych cenników.
