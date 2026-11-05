# Wdrożenie S.O.K. — docelowy standard PostgreSQL 18

**Docelowa architektura:** Node.js + Express + Prisma + PostgreSQL 18 + Vanilla JS SPA.

**Status:** runtime S.O.K. używa PostgreSQL 18. Wydanie 1.56.4 przeszło lokalne
bramki oraz testy na PostgreSQL 18.6; lokalnie potwierdzono readiness, aktywne
cenniki i smoke backup/restore. Dokument opisuje wspieraną architekturę i
kontrolowany rollout. Produkcyjny cutover nie został wykonany; wymaga osobnego
GO oraz walidacji docelowego hosta, backupu, sieci i procedury odzyskiwania.

Instalator Windows został sprawdzony lokalnie na Docker Desktop. Czysta
instalacja Linux na serwerze Ubuntu/Debian nie została jeszcze potwierdzona
end-to-end; zweryfikuj ją na docelowym systemie przed produkcją.

## 1. Celowa topologia

- Aplikacja S.O.K. działa jako usługa Node.js. PostgreSQL 18 jest osobną
  managed usługą albo odrębną, utrzymywaną usługą bazodanową w prywatnej sieci.
- Kontener aplikacji nie zawiera bazy ani persistent volume z danymi DB. Nie ma
  ścieżki do lokalnego pliku bazy ani fallbacku do innego silnika.
- Aplikacja, migrator i backup mają oddzielne role. Runtime ma tylko wymagane
  uprawnienia DML; migrator otrzymuje DDL wyłącznie podczas kontrolowanego
  release; backup ma wyłącznie wymagane prawa odczytu/eksportu.
- Zdalne połączenie do PostgreSQL wymaga zweryfikowanego TLS, ograniczeń sieci
  oraz sekretów dostarczanych przez secret manager.
- Wybór hosta, regionu, SLA, RPO/RTO i retencji musi być opisany w ADR przed
  konfiguracją produkcyjną. PostgreSQL 18 jest wymaganym targetem; odstępstwo
  wersji wymaga jawnej decyzji architektonicznej.

## 2. Konfiguracja środowiska

| Ustawienie                                                         | Docelowe znaczenie                                 | Zasada bezpieczeństwa                                                                      |
| ------------------------------------------------------------------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                                                     | Rola runtime `sok_app`, tylko wymagane DML         | Secret/env; TLS dla połączeń zdalnych; nigdy nie logować ani commitować.                   |
| `MIGRATION_DATABASE_URL`                                           | Rola migratora `sok_migrator`, uprawnienia DDL     | Używana wyłącznie w kontrolowanym deploy/import; nie przekazuj do runtime serwera.         |
| `BACKUP_DATABASE_URL`                                              | Rola backupu `sok_backup`, prawa odczytu           | Secret/env; używana przez backup; nigdy nie logować ani commitować.                        |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`                               | Rola bootstrapowa kontenera PostgreSQL             | Superuser inicjalizacyjny; tylko provisioning, nie używać jako roli runtime aplikacji.     |
| `SOK_MIGRATOR_PASSWORD`, `SOK_APP_PASSWORD`, `SOK_BACKUP_PASSWORD` | Hasła ról aplikacyjnych                            | Wstrzykiwane wyłącznie do init PostgreSQL/Compose z secret managera albo lokalnego `.env`. |
| `DEFAULT_ADMIN_PASSWORD`                                           | Sekret startowego administratora pustej instalacji | Wstrzykiwany tylko na czas utworzenia konta; nie zapisuj w obrazie ani pliku przykładowym. |
| `HOST`, `PORT`                                                     | Adres i port procesu HTTP                          | Domyślnie bind lokalny za reverse proxy; publiczny dostęp przez HTTPS.                     |
| `TRUST_PROXY`, `PUBLIC_BASE_URL`, `COOKIE_SECURE`                  | Granica reverse proxy i bezpieczne cookie          | Ustaw zgodnie z faktycznym łańcuchem proxy; w produkcji HTTPS i Secure cookies.            |
| `SENTRY_DSN`                                                       | Endpoint telemetryczny błędów, jeśli używany       | Tylko sekret/env; scrub danych klienta i connection stringów.                              |

Aktualny `DATABASE_URL` runtime musi używać jawnego URL PostgreSQL. Nie ma
fallbacku do innego silnika. Brak, błąd TLS lub brak połączenia blokuje
readiness bez ujawnienia szczegółów w publicznej odpowiedzi.

Compose inicjalizuje role `sok_migrator`, `sok_app` i `sok_backup` przez
`docker/postgres/init-roles.sh`; `POSTGRES_USER` jest superuserem jednorazowej
inicjalizacji wolumenu i nie może być użyty jako konto aplikacji. Migracje
wykonuje `MIGRATION_DATABASE_URL`. Po migracjach `node scripts/grant-postgres-roles.mjs`
nadaje role runtime/backup do istniejących tabel i ustawia default privileges;
następnie seed/import używa
`DATABASE_URL` roli `sok_app`. Backup używa `BACKUP_DATABASE_URL`. Compose wymaga
wszystkich tych zmiennych i sekretów.

## 3. Sekwencja wdrożenia release

Po zatwierdzeniu wdrożenia release przebiega w następującej kolejności:

1. Provision PostgreSQL 18 w prywatnej sieci; ustaw TLS, retencję, monitoring,
   połączenia/pool limits oraz role runtime, migration i backup.
2. Utwórz pustą bazę i zweryfikuj endpoint, wersję serwera, TLS oraz uprawnienia
   przez izolowany preflight. Nie używaj produkcyjnych danych w CI.
3. Zatwierdzony release job wykonuje PostgreSQL migration deploy jeden raz.
   Migracje są odtwarzalne od pustej bazy; po nich sprawdź status i brak driftu.
4. Po migracjach wykonaj granty dla runtime/backup, następnie seeduj tylko
   brakujące dane startowe i bezpieczne konto administratora rolą runtime.
   W osobnym, audytowalnym kroku importuj tylko aktywne cenniki z artefaktu
   allowlistowanego z bazy źródłowej; potwierdź count/hash oraz
   `prices:verify`.
5. Uruchom aplikację po gotowej bazie. Readiness sprawdza połączenie i
   wymagane schematyczne warunki, nie wykonuje DDL i nie zwraca hosta/SQL.
6. Na stagingu przejdź smoke i E2E dla logowania, ofert Rury/Studnie, zapisów,
   wyszukiwania, importów/eksportów CSV/XLSX/PDF/DOCX, zamówień, aktywnych
   cenników, CAS/ownership oraz obsługi błędów bazy.
7. Dopiero po zielonych CI, testach migracji i backup/restore drill oraz osobnym
   GO na live przełącz ruch. Nie wykonuj dual-write.

**Stan walidacji:** commit `2ef5d907` (1.56.4) przeszedł lokalne bramki
pre-push: wersja, kodowanie, licencje, collisions, ratchet i cenniki; backend i
frontend lint/typecheck; 573 zestawy / 5 734 testy oraz 23 testy Git safety.
Lokalna aplikacja PostgreSQL 18.6 zwraca `/health/ready` HTTP 200; import
aktywnego zestawu i backup/restore smoke zostały sprawdzone. To nie zastępuje
produkcyjnej zgody, testu czystej instalacji Linux ani restore drillu
dopasowanego do wymaganego RPO/RTO.

## 4. Backup, restore i rollback

- Backup używa `pg_dump` custom archive i dedykowanej roli backupu; checksum i
  archiwum są weryfikowane przed restore. Lokalny round-trip smoke przeszedł;
  przed live wymagane są restore drill oraz zatwierdzenie retencji, świeżości,
  monitoringu i RPO/RTO dla serwera docelowego.
- Restore najpierw do izolowanego celu; sprawdź checksum, PostgreSQL/schema
  version, `migrate deploy`, `prices:verify` i aplikacyjne smoke. Restore do
  live wymaga osobnego GO.
- Rollback aplikacji jest dozwolony tylko przy zgodności wersji schematu. Nie
  odtwarzaj równoległych zapisów do dwóch baz. Stare źródło pozostaje
  read-only wyłącznie przez uzgodniony okres przejściowy i zgodnie z polityką
  retencji.
- Restore wymaga jawnego celu przez zmienną środowiskową `RESTORE_DB_URL` — nigdy
  nie przekazuj URL ani hasła jako argumentu procesu. Przykład PowerShell dla
  izolowanej lokalnej bazy testowej:

    ```powershell
    $env:RESTORE_DB_URL = 'postgresql://sok_test:<hasło>@localhost:5432/sok_test?schema=public'
    node scripts/restore-db.js data/backups/<backup>.dump
    Remove-Item Env:RESTORE_DB_URL
    ```

    Przywrócenie do bazy runtime wymaga jawnego `--live` i celu `RESTORE_DB_URL`
    używającego osobnej roli wskazanej przez `MIGRATION_DATABASE_URL`. Rola
    runtime `DATABASE_URL` jest odrzucana. Po odtworzeniu migracje i granty
    uruchamia rola migracyjna. Produkcyjny restore nadal wymaga osobnego GO.
    Nie umieszczaj sekretnego URL w historii shella ani logach.

## 5. Sieć HTTP i reverse proxy

S.O.K. nadal udostępnia HTTP aplikacji za reverse proxy. W produkcji proxy
obsługuje TLS/certyfikaty, przekierowanie HTTP→HTTPS i nagłówki proxy; port
procesu aplikacji nie powinien być publicznie dostępny. Ustaw
`TRUST_PROXY` i `PUBLIC_BASE_URL` zgodnie z topologią, a `COOKIE_SECURE` dla
HTTPS.

Po wdrożeniu sprawdź `/health`, `/health/ready`, logowanie, bezpieczne cookie,
iframe modułów, import XLSX, eksport/druk PDF-DOCX, clipboard i podstawowe
przepływy w obsługiwanych przeglądarkach. Publiczne health endpoints nie
ujawniają connection stringu, SQL, hosta ani sekretów.

## 6. Historyczny kontekst SQLite

Poprzednie instrukcje wdrożenia bazowały na lokalnym pliku SQLite, katalogu
`data`, `db push`, WAL, kopiowaniu plików i `VACUUM INTO`. Są zachowane wyłącznie
jako historia obecnego runtime, nie jako docelowa lub wspierana procedura.
Stare SQLite artefakty można wykorzystać wyłącznie w jednorazowym, read-only
eksporcie aktywnych cenników; nie przenosi się z nich kont, sesji ani historii
ofert.
