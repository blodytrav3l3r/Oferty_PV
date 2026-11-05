# Instalacja i przenoszenie danych S.O.K.

**Wersja:** 1.56.4<br>
**Data aktualizacji:** 2026-11-05

> **Status:** PostgreSQL 18 jest jedynym silnikiem runtime i testów. Wydanie
> 1.56.4 przeszło lokalną walidację PG18 oraz test instalacji Windows. Czysta
> instalacja Ubuntu/Debian i produkcyjny cutover pozostają do wykonania na
> docelowym serwerze; cutover wymaga osobnego GO.

## Wymagania

- Node.js 22.13 lub nowszy dla uruchomienia poza Dockerem.
- PostgreSQL 18.x. W środowisku CI używany jest PostgreSQL 18; Compose dostarcza `postgres:18-alpine`.
- Jawny `DATABASE_URL` w protokole `postgresql://` albo `postgres://`. Nie ma domyślnej bazy ani fallbacku do innego silnika.
- W produkcji przechowuj poświadczenia w secret managerze, ogranicz dostęp sieciowy do DB i skonfiguruj TLS dla połączeń poza zaufaną siecią.

## Nowa instalacja serwerowa

Na Ubuntu/Debian użyj wspieranego instalatora `install-linux-server.sh` zgodnie
z krokami z [README](../README.md). Instalator przygotowuje sekrety,
uruchamia PostgreSQL 18, wykonuje migracje i seed przez jednorazowy bootstrap,
importuje wyłącznie aktywne cenniki z przekazanego artefaktu, a potem uruchamia
aplikację. Czystą instalację zweryfikuj na docelowym OS przed dopuszczeniem
użytkowników.

Ręczna ścieżka Compose jest przeznaczona dla administratorów znających Docker:

1. Skonfiguruj wymagane sekrety w lokalnym `.env`; nie zapisuj ich w repozytorium.
2. Zbuduj obraz, uruchom DB, wykonaj jednorazowy bootstrap i dopiero wtedy aplikację:

    ```sh
    docker compose build app
    docker compose up -d --wait postgres
    docker compose run --rm db-bootstrap
    docker compose up -d --wait app
    docker compose ps
    ```

3. Sprawdź gotowość aplikacji i dzienniki bez publikowania poświadczeń:

    ```sh
    curl --fail http://localhost:3000/health/ready
    docker compose logs --tail=100 app
    ```

Compose używa osobnego serwisu PostgreSQL 18 i nazwanego wolumenu danych. Aplikacja łączy się z hostem `postgres` w prywatnej sieci Compose; port PostgreSQL nie jest wystawiany publicznie. `db-bootstrap` stosuje migracje, granty i seed; runtime nie dostaje sekretu migratora.

## Uruchomienie developerskie poza Dockerem

Dostarcz lokalny serwer PostgreSQL 18 i ustaw w `.env` jawny URL wskazujący tę instancję, np. `postgresql://<rola>:<hasło>@localhost:5432/sok?schema=public`. Hasło ze znakami specjalnymi musi być percent-encoded. Następnie, po zakończeniu migracji i skonfigurowaniu testowej bazy:

```sh
npm ci
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
npm run build
npm run dev
```

Nie uruchamiaj `prisma db push`; schemat zarządzany jest wyłącznie przez wersjonowane migracje PostgreSQL w `prisma/migrations-postgresql/`.

## Przejście ze starszej instalacji: tylko aktywne cenniki

Zakres transferu to dokładnie jedna aktywna wersja każdego typu cennika (rury, studnie, PRECO), jej pozycje i potrzebne aktywne override'y. Oferty, klienci, użytkownicy, sesje, zamówienia, szkice, logi, ustawienia niezwiązane z aktywnością cenników i historyczne wersje nie są przenoszone. Szczegóły polityki i format artefaktu: [docs/cutover/active-pricelists.md](cutover/active-pricelists.md).

### Eksport źródłowy

Na komputerze mającym starą bazę wskaż jawnie plik wejściowy i ścieżkę bezpiecznego artefaktu:

```powershell
python scripts/export-active-pricelists.py --source <stary-plik.sqlite> --output <bezpieczny-katalog>/active-pricelists.json --dry-run
python scripts/export-active-pricelists.py --source <stary-plik.sqlite> --output <bezpieczny-katalog>/active-pricelists.json
```

Eksporter działa read-only, odrzuca niejednoznaczny stan, brak aktywnego cennika, błędny hash lub niekompletne pozycje. Artefakt jest poufnym plikiem cenowym: przechowuj go poza repozytorium, ogranicz dostęp, sprawdź SHA-256 i usuń bezpiecznie po zatwierdzonym cutoverze.

### Import Compose przed pierwszym startem aplikacji

Nie uruchamiaj kontenera `app` przed importem: pierwszy start serwera może utworzyć fabryczny baseline cenników. Przygotuj katalog zawierający zatwierdzony `active-pricelists.json`. Poniższe polecenia najpierw uruchamiają wyłącznie PostgreSQL, a jednorazowy kontener aplikacji wykonuje migracje i seed bez startu serwera:

```powershell
docker compose build app
docker compose up -d postgres
$artifactDirectory = (Resolve-Path <katalog-z-artefaktem>).Path
docker compose run --rm --no-deps --volume "${artifactDirectory}:/cutover:ro" --entrypoint sh app -ec 'npx prisma migrate deploy && npx prisma db seed && npx ts-node scripts/import-active-pricelists.ts /cutover/active-pricelists.json'
```

Powyższy import bez `--apply` jest dry-runem. Dopiero po sprawdzeniu środowiska docelowego, raportu, SHA-256 i liczników oraz odrębnym GO na cutover wykonaj ponownie jednorazowy kontener z końcową komendą `npx ts-node scripts/import-active-pricelists.ts /cutover/active-pricelists.json --apply`. Ta operacja zapisuje cenniki w wskazanej bazie; nie uruchamiaj jej na produkcji bez jawnej zgody.

Po potwierdzeniu importu uruchom aplikację, a następnie wykonaj `prices:verify`, odczyt podsumowania aktywnych cenników, kalkulację oferty oraz eksport XLSX/PDF na izolowanym środowisku PostgreSQL 18. Wykonaj te same testy przed dopuszczeniem ruchu użytkowników. Dokładna procedura i kontrola rollbacku muszą odpowiadać [docs/cutover/active-pricelists.md](cutover/active-pricelists.md) i [docs/DEPLOYMENT.md](DEPLOYMENT.md).

## Backup i restore PostgreSQL

Backup twórz przez `npm run backup`; narzędzie `pg_dump` zapisuje custom archive `.dump` wraz z SHA-256. Restore wymaga jawnego celu PostgreSQL oraz weryfikacji archiwum:

```sh
npm run backup
$env:RESTORE_DB_URL = 'postgresql://sok_test:<hasło>@localhost:5432/sok_test?schema=public'
node scripts/restore-db.js data/backups/<backup>.dump
Remove-Item Env:RESTORE_DB_URL
```

Restore nie przyjmuje connection URL ani hasła w argumentach procesu. Cel podaj przez `RESTORE_DB_URL`; bez `--live` dozwolone są izolowane lokalne bazy testowe. Restore do bazy runtime wymaga dodatkowego jawnego `--live` oraz `RESTORE_DB_URL` z osobną rolą migracyjną wskazaną przez `MIGRATION_DATABASE_URL`; rola runtime `DATABASE_URL` jest odrzucana. Po odtworzeniu skrypt stosuje migracje i granty rolą migracyjną. Operacja na produkcji pozostaje osobną bramką GO. Przeprowadź restore drill na izolowanej bazie: sprawdź checksum, archiwum, status migracji, liczniki aktywnych cenników i health aplikacji. Nie kopiuj plików bazy jako metody backupu lub migracji.

## Aktualizacja aplikacji

Po dopuszczeniu wersji do wdrożenia:

1. Wykonaj zweryfikowany backup PostgreSQL i potwierdź możliwość restore.
2. Wdróż wersję aplikacji oraz zależności.
3. Zastosuj migracje przez `npx prisma migrate deploy`; runtime nie wykonuje DDL.
4. Uruchom testy smoke: `/health/ready`, logowanie, odczyt cenników, zapis i wyszukiwanie oferty, import/eksport XLSX oraz generowanie PDF/DOCX.
5. Zweryfikuj monitoring backupu i alerty.

Nie używaj pełnego starego backupu jako ścieżki aktualizacji PostgreSQL. Nie odtwarzaj w nowej bazie starych ofert, użytkowników ani historii cenników.

## Konfiguracja i dalsza dokumentacja

- Zmienne środowiskowe: `.env.example` oraz [docs/DEPLOYMENT.md](DEPLOYMENT.md).
- Schemat i migracje: [docs/DATABASE.md](DATABASE.md), `prisma/schema.prisma`, `prisma/migrations-postgresql/`.
- Bezpieczeństwo wdrożenia: [docs/SECURITY.md](SECURITY.md), [docs/DEPLOY_HTTPS_IT.md](DEPLOY_HTTPS_IT.md).
- Reguły pracy z bazą i testami: [docs/agents/database.md](agents/database.md), [docs/agents/testing.md](agents/testing.md).
