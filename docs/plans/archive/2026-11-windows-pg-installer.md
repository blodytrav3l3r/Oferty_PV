# Plan: instalator S.O.K. na nowym komputerze Windows

**Status:** ZAKOŃCZONO w 1.56.4 — instalator i launcher zostały zaimplementowane,
przetestowane, a lokalne uruchomienie z PostgreSQL 18 i aktywnymi cennikami
zweryfikowane. Plan zachowano do historii; bieżąca instrukcja użytkownika:
[`docs/instalacja-krok-po-kroku-dla-laika.md`](../../instalacja-krok-po-kroku-dla-laika.md).

## Primary goal

Osoba uruchamiająca S.O.K. na nowym komputerze Windows dostaje działającą aplikację z PostgreSQL 18 i może zachować wyłącznie aktywne cenniki ze starej instalacji.

## Phase 0: Dokumentacja i stan istniejący

**How this serves the primary goal:** Instalator używa istniejących, wspieranych ścieżek projektu i jasno rozpoznaje kroki wymagające Windows/UAC.

- `install.bat` obecnie instaluje zależności developerskie i próbuje uruchomić Prisma na hoście; Compose ma PostgreSQL 18, role o minimalnych prawach, named volume i aplikacyjny healthcheck.
- Kontener aplikacji wykonuje `prisma migrate deploy`, granty oraz seed przed startem serwera. Import aktywnych cenników musi odbyć się przed pierwszym startem serwera; importer domyślnie wykonuje dry-run i zapis wymaga `--apply`.
- Źródła: `install.bat`, `docker-compose.yml`, `scripts/docker-entrypoint.sh`, `scripts/import-active-pricelists.ts`, `docs/cutover/active-pricelists.md`, oficjalna dokumentacja Docker Desktop Windows i Compose.
- Docker Desktop per-user nie wymaga admina, ale pierwsze włączenie WSL2 wymaga uprawnień administratora i może wymagać restartu. Instalator nie może po cichu zaakceptować umowy licencyjnej.

## Phase 1: Bezpieczne przygotowanie konfiguracji

**How this serves the primary goal:** Świeża instalacja otrzymuje unikalne sekrety Compose, chroniony plik `.env` oraz dostępne dane logowania administratora.

- Dodać helper PowerShell uruchamiany z `.bat`, który utworzy `.env` tylko gdy go brakuje, zachowa istniejące ustawienia, wygeneruje losowe sekrety ról/admina, zsynchronizuje connection URL-e, ustawi ACL tylko dla bieżącego użytkownika/SYSTEM/Administratorów i nie wypisze sekretów DB.
- Zapisać pierwsze hasło administratora w osobnym pliku z tym samym ACL i wykluczyć ten plik z Gita.
- Wzorce: `.env.example`, `docker-compose.yml`, `scripts/init-env.mjs`, instrukcje bezpieczeństwa z `docs/agents/security.md`.
- Weryfikacja: brak placeholderów dla wymaganych zmiennych, zgodność URL-i z wygenerowanymi rolami, zachowanie istniejącego `.env`, sekretów brak w logach.
- Nie nadpisywać `.env` ani nie używać `docker compose down -v`, `prisma migrate reset` lub `docker volume rm`.

## Phase 2: Instalator nowego komputera

**How this serves the primary goal:** Jeden plik `.bat` uruchamia preflight Windows/Docker, Compose PostgreSQL 18 i aplikację bez instalowania bazy w katalogu repozytorium.

- Dodać oddzielny `install-new-pc.bat`, który sprawdzi wymagania, zaoferuje instalację Docker Desktop per-user przez winget bez automatycznej akceptacji licencji, uruchomi Compose, poczeka na healthcheck i otworzy aplikację.
- Zachować istniejący `install.bat` jako instalator developerski.
- Wzorce: `docker-compose.yml`, `Dockerfile`, `scripts/docker-entrypoint.sh`; oficjalne `docker compose config --quiet` i `docker compose up --wait`.
- Weryfikacja: błędne lub brakujące Docker/WSL/porty/sekrety kończą się komunikatem działania; poprawna instalacja nie usuwa volume i nie drukuje sekretów.
- Nie próbować włączać wirtualizacji/WSL bez zgody UAC, omijać licencji Docker Desktop ani publikować portu PostgreSQL do sieci.

## Phase 3: Wymagany import aktywnych cenników

**How this serves the primary goal:** Import zachowuje tylko zatwierdzone aktywne cenniki i blokuje start aplikacji, jeśli wybrany artefakt jest nieprawidłowy.

- Wymagać jawnie wskazanego `active-pricelists.json`; bez niego przerwać przed utworzeniem bazy. Uruchomić migracje/seed i importer w jednorazowym kontenerze bez startu serwera, pokazać dry-run, wymagać lokalnego potwierdzenia `--apply`, a dopiero potem uruchomić aplikację.
- Nie oferować ścieżki instalacji pomijającej aktywne cenniki.
- Wzorce: `docs/cutover/active-pricelists.md`, `scripts/export-active-pricelists.py`, `scripts/import-active-pricelists.ts`.
- Weryfikacja: import na nowej pustej bazie, SHA-256/liczniki i `prices:verify`; brak lub odrzucenie artefaktu nie może startować aplikacji z domyślnymi cenami zamiast aktywnych.
- Nie kopiować ofert/użytkowników/historii ani nie eksportować SQLite poza jednorazowym, read-only eksporterem.

## Phase 4: Kontrola i instrukcja dla użytkownika

**How this serves the primary goal:** Instalator jest czytelny dla osoby nietechnicznej i ma sprawdzone scenariusze błędów oraz bezpiecznego wznowienia.

- Dodać instrukcję krok po kroku: skopiowanie tylko artefaktu cenowego ze starej instalacji, wymagania UAC/restartu, pierwsze logowanie i usunięcie pliku z hasłem po zmianie hasła.
- Weryfikacja: ASCII-only/UTF-8 bez BOM dla `.bat`, poprawność składni PowerShell, Compose config, testy helpera/instalatora na czystym i istniejącym `.env`, diff oraz wymagane bramy projektu przed commitem.
- Nie zmieniać numeru wersji ani nie commitować bez jawnego requestu; nie uruchamiać produkcyjnego cutoveru.
