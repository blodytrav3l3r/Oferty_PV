# Baza danych S.O.K. — docelowy standard PostgreSQL

**Docelowy silnik:** PostgreSQL 18

**ORM:** Prisma ORM 7

**Status:** provider, kanoniczne migracje, ścieżki operacyjne backup/restore i import cenników oraz konfiguracja CI/Compose są przełączone na PostgreSQL. Pozostają SQLite-owe test fixtures, a pełna integracja aplikacji i testów na PostgreSQL 18 nie została potwierdzona; brak tej weryfikacji blokuje status produkcyjny.

> Kod i narzędzia PostgreSQL są już obecne w working tree. Obecność konfiguracji
> CI/Compose ani testu startu kontenera nie dowodzi jeszcze, że wszystkie ścieżki
> runtime i aktywne testy działają na PostgreSQL 18. Nie uznawaj cutoveru za
> zweryfikowany bez przejścia pełnej wymaganej walidacji.

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

**Status wykonania:** PostgreSQL schema, migracje, importer aktywnych cenników,
preflight i narzędzia porównania migracji są zaimplementowane. Runbook cutover
pozostaje roboczy; migracje/import nie są równoznaczne z dowodem poprawności
całego runtime. Pełna integracja na PostgreSQL 18 i walidacja cutoveru nie są
potwierdzone.

## 3. Testy bazy

- Test harness wymaga jawnego PostgreSQL URL, a brak połączenia jest błędem.
  Część aktywnych fixtures SQL nadal korzysta z `node:sqlite`; ich konwersja na
  PostgreSQL jest główną pozostałą pracą w testach. Pełny suite integracyjny nie
  został jeszcze potwierdzony na PostgreSQL 18.
- Testuj migrate deploy na pustej bazie, ponowny deploy, drift, constraints,
  FTS/search, JSON, null ordering, Decimal round-trip, transakcje, CAS,
  idempotency i konkurencyjne zapisy.
- Testy API/E2E weryfikują zawartość ofert oraz eksportów CSV/XLSX/PDF/DOCX.
  Zachowaj inwarianty `docs/SYSTEM_INVARIANTS.md`, w szczególności I-001,
  I-003–I-006, I-009, I-013 i I-014.
- Obecne zielone testy SQLite nie dowodzą zgodności z PostgreSQL. Nie uznawaj
  migracji za zakończoną przed uruchomieniem wymaganych suite’ów na PostgreSQL.

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
walidacja archiwum i logika
retencji są zaimplementowane; pełny backup/restore drill oraz integracja
PostgreSQL 18 nie zostały potwierdzone. Wymagania bezpieczeństwa i bieżące
kontrakty komend są w [`DEPLOYMENT.md`](DEPLOYMENT.md).

## 5. Dane i historia migracji

Dotychczasowy schemat obejmuje 56 modeli, w tym `PricelistVersion` i pięć rodzin
pozycji cennikowych, oferty, zamówienia, audyt, ML/telemetrię, blokady oraz
udostępnienia. Kanoniczne mapowanie każdego modelu powstanie przy nowym
PostgreSQL schema review; opis kolumn bieżącego SQLite schema nie jest
specyfikacją docelowych typów.

Historyczne decyzje SQLite, wcześniejszy model oraz opis ograniczeń zachowują
`docs/adr/ADR-001-sqlite.md`, `docs/adr/ADR-012-single-node-sqlite.md` i
`docs/errors-known.md` wyłącznie jako kontekst legacy. Nie są instrukcją
konfiguracji ani eksploatacji docelowej bazy.
