# Jednorazowy cutover aktywnych cenników

> **Status:** runbook roboczy, nie zatwierdzona procedura produkcyjna. Pełna
> weryfikacja aplikacji na PostgreSQL 18 i rozdzielenie ról bootstrap/migrator/runtime
> w Compose są nadal w toku. Nie wykonuj produkcyjnego cutoveru przed potwierdzeniem
> obu bramek i osobnym GO.

Ten mechanizm służy wyłącznie do zachowania aktualnie obowiązujących cenników podczas przejścia ze starego pliku SQLite na PostgreSQL. Eksporter używa wyłącznie Python `sqlite3` w trybie `mode=ro` i nie jest importowany przez aplikację. Nie eksportuje ofert, zamówień, użytkowników, sesji, draftów ani wersji archiwalnych lub przyszłych.

## 1. Preflight / eksport

Wskaż konkretny plik starej bazy i osobny plik artefaktu. Ścieżka nie ma wartości domyślnej:

```powershell
python scripts/export-active-pricelists.py --source <stary-plik.sqlite> --output <bezpieczny-katalog>/active-pricelists.json --dry-run
python scripts/export-active-pricelists.py --source <stary-plik.sqlite> --output <bezpieczny-katalog>/active-pricelists.json
```

Eksporter rozpoczyna spójną transakcję read-only, sprawdza wymagany schemat, liczy aktywne pozycje, przelicza dokładne kwoty do tekstu z dwiema cyframi po przecinku oraz wypisuje SHA-256. Błąd schematu, brak aktywnego cennika dla dowolnej osi albo kwota o większej skali zatrzymuje eksport. Zachowaj niezmieniony artefakt i jego SHA-256 poza repozytorium; zawiera on firmowe dane cenowe.

Aktywność jest rozstrzygana w chwili `exportedAt`: zatwierdzona (`APPROVED`) wersja z `effectiveFrom` nie późniejszym od tej chwili. Poprawne ręczne ustawienie `pricelist_active_override_<typ>` ma pierwszeństwo. W artefakcie są dokładnie po jednej wersji `rury`, `studnie`, `preco`, ich pozycje z pięciu tabel oraz tylko te ręczne ustawienia, które wskazują zachowaną wersję.

Po cutoverze historia wersji PRECO nie jest zachowywana. Gdy aktywny cennik studni nie ma dostępnej historycznej PRECO, eksport XLSX użyje bieżącego aktywnego PRECO. Preview i API oznaczają `precoSource: ACTIVE_FALLBACK`, a arkusz `_Cennik` zapisuje wersję zastępczą i informację, że stawki pochodzą z aktywnego cennika. W takiej sytuacji stawki mogą różnić się od historycznych.

## 2. Import do pustego zakresu cenników PostgreSQL

Importer musi działać **po migracjach i przed pierwszym uruchomieniem serwera S.O.K.** Startup aplikacji tworzy fabryczne wersje bazowe, gdy nie widzi wersji cenników. Import po tym bootstrapie ma się zatrzymać zamiast scalać zestawy.

Poniższa ścieżka Compose uruchamia bazę, a potem wykonuje migracje, seed i import w kontenerze jednorazowym z nadpisanym entrypointem. Dzięki temu serwer S.O.K. nie startuje przed importem. Artefakt jest montowany read-only:

```powershell
docker compose build app
docker compose up -d postgres
$artifactDirectory = (Resolve-Path <katalog-z-artefaktem>).Path
docker compose run --rm --no-deps --volume "${artifactDirectory}:/cutover:ro" --entrypoint sh app -ec 'DATABASE_URL="$MIGRATION_DATABASE_URL" npx prisma migrate deploy && node scripts/grant-postgres-roles.mjs && npx prisma db seed && npx ts-node scripts/import-active-pricelists.ts /cutover/active-pricelists.json'
```

W Compose `MIGRATION_DATABASE_URL` wskazuje rolę `sok_migrator`; jest używana tylko dla `migrate deploy` i grantów. `DATABASE_URL` pozostaje rolą `sok_app` dla seedu i importera. `scripts/grant-postgres-roles.mjs` nadaje runtime oraz backupowi ograniczone uprawnienia i ustawia default privileges migratora. Nie uruchamiaj serwera przez entrypoint na tym etapie.

Uruchomienie bez `--apply` sprawdza artefakt, jego SHA-256, liczniki, wersje i kompatybilność danych. Po sprawdzeniu środowiska docelowego i raportu, oraz po odrębnym GO na zapis dla tego środowiska, powtórz polecenie jednorazowe, zmieniając końcówkę łańcucha na:

```powershell
docker compose run --rm --no-deps --volume "${artifactDirectory}:/cutover:ro" --entrypoint sh app -ec 'DATABASE_URL="$MIGRATION_DATABASE_URL" npx prisma migrate deploy && node scripts/grant-postgres-roles.mjs && npx prisma db seed && npx ts-node scripts/import-active-pricelists.ts /cutover/active-pricelists.json --apply'
```

Tylko ta druga komenda zapisuje cenniki. Operacja produkcyjna wymaga osobnego GO na cutover.

Importer odmawia działania, jeżeli w bazie istnieją inne wersje cenników albo częściowe dane. Całość zapisuje w jednej transakcji z blokadą zakresu wersji i ponowną kontrolą pustki. Ponowne uruchomienie jest bezpieczne tylko wtedy, gdy wszystkie wersje, pozycje i ustawienia są identyczne z artefaktem; rozbieżność przerywa operację bez naprawiania ani kasowania danych.

Po zatwierdzonym imporcie uruchom serwer:

```powershell
docker compose up -d app
docker compose ps
```

Nie uruchamiaj importera na produkcji bez odrębnej zgody na cutover. Po imporcie sprawdź SHA-256, liczniki pozycji dla każdej tabeli, `prices:verify`, aktywność `/api/pricelists/versions/summary` i ścieżki kalkulacji/eksportu ofert na izolowanym środowisku PostgreSQL 18.
