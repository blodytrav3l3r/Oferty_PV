# Plan: instalatory S.O.K. dla Windows testowego i Linux serwerowego

**Stan:** kod obu instalatorów oraz testy polityk są gotowe w 1.56.4. Instalacja
Windows została uruchomiona lokalnie. Pozostało end-to-end sprawdzenie czystej
instalacji Linux na Ubuntu/Debian; do tego czasu nie deklaruj pełnej gotowości
serwera Linux.

## Primary goal

Administrator może uruchomić S.O.K. testowo na Windows oraz wdrożyć go na firmowym serwerze Linux bez Docker Desktop, płatnych usług bazodanowych i pomijania bezpiecznego importu aktywnych cenników.

## Phase 0 — Discovery i granice wdrożenia

**How this serves the primary goal:** Potwierdza wspólną ścieżkę S.O.K. i różnice hosta przed zmianami instalatora.

- Wspólne źródła: `docker-compose.yml`, `Dockerfile`, `scripts/docker-entrypoint.sh`, `scripts/import-active-pricelists.ts`, `docs/cutover/active-pricelists.md`.
- OS-specific źródła: `install-new-pc.bat`, `scripts/setup-new-pc.ps1`, `install.sh`, `docs/DEPLOYMENT.md`, `README.md`.
- Dokumentacja upstream: Docker Engine APT dla Ubuntu/Debian, Docker Compose plugin, Linux post-install/security i Docker Desktop Windows; PostgreSQL License.
- Decyzja: instalator Linux obsługuje Ubuntu/Debian z APT i systemd; Windows Desktop jest wariantem testowym, nie Windows Server runtime.
- Weryfikacja: brak powielonego schematu, importer zachowuje wyłącznie aktywne cenniki, żaden wariant nie uruchamia serwera przed poprawnym importem.
- Antywzorce: Docker Desktop na Windows Server, Docker convenience script w instalatorze produkcyjnym, publiczny port PostgreSQL, dodawanie operatora aplikacji do grupy `docker`.

## Phase 1 — Windows jako środowisko testowe

**How this serves the primary goal:** Utrzymuje prostą ścieżkę testową na komputerze użytkownika bez przedstawiania jej jako bezpłatnego wdrożenia serwerowego dla każdego przedsiębiorstwa.

- Zachować `install-new-pc.bat` i `scripts/setup-new-pc.ps1`; jasno oznaczyć ich przeznaczenie Windows 10/11 + Docker Desktop.
- Instalacja zostaje interaktywna i nie akceptuje licencji Docker Desktop automatycznie; błędy WinGet podają kod i ścieżkę logu.
- Weryfikacja: składnia BAT/PowerShell, zachowanie importu i kontrola braku usuwania wolumenów.
- Antywzorce: pakowanie lub redystrybucja Docker Desktop razem z S.O.K.; opisywanie wariantu jako wspieranego na Windows Server.

## Phase 2 — Instalator serwerowy Linux

**How this serves the primary goal:** Serwer instaluje PostgreSQL 18 i S.O.K. przez Docker Engine/Compose bez Docker Desktop i bez subskrypcji Docker Desktop.

- Dodać osobny `install-linux-server.sh` dla Ubuntu/Debian; użyć podpisanego oficjalnego repo APT Docker oraz pakietów Engine, CLI, Buildx i Compose plugin.
- Wymagać jawnego uruchomienia administratora; nie usuwać pakietów/wolumenów automatycznie, nie otwierać portów ani socketa daemonu, nie dodawać zwykłych operatorów do grupy `docker`.
- Wygenerować `.env` atomowo z sekretami losowymi, prawami `0600` i URL-ami password-safe; zachować istniejący `.env` bez nadpisania.
- Użyć wspólnego Compose, named volumes i istniejącego przepływu migracje → role → seed → dry-run cenników → potwierdzenie `IMPORT` → start aplikacji.
- Zachować bind `127.0.0.1:3000`; wymagać hostowego reverse proxy HTTPS lub jasno udokumentować istniejący firmowy proxy przed dostępem z innych urządzeń.
- Weryfikacja: `bash -n`, smoke `--help`, Compose config, Windows/CI testy, brak sekretów w logach, niezmienność istniejącego wolumenu.
- Antywzorce: `curl | sh`, `docker compose down -v`, import innych danych niż aktywne cenniki, serwer dostępny po surowym HTTP w LAN.

## Phase 3 — Dokumentacja i warunki sprzedaży

**How this serves the primary goal:** Użytkownik rozumie który instalator wybrać oraz jakie licencje/usługi są bezpłatne, a które zależą od jego środowiska.

- README rozdziela Windows testowy od Linux produkcyjnego; dodaje wymagania, kroki eksportu cenników, TLS/proxy, backup/restore i aktualizacje bez kasowania wolumenów.
- Opisać PostgreSQL License i Docker Engine Apache-2.0; nie składać deklaracji licencyjnej całego produktu bez audytu wszystkich zależności i praw S.O.K.
- Weryfikacja: instrukcja od pustego Ubuntu/Debian do healthcheck i logowania, poprawne third-party notices, aktualne statusy migracji PG18.
- Antywzorce: obietnica „zero kosztów” obejmująca sprzęt, OS, domenę, certyfikaty, wsparcie lub wszystkie licencje zależności.

## Phase 4 — Weryfikacja całego pakietu

**How this serves the primary goal:** Każda ścieżka ma dowody techniczne i jawnie wskazane ograniczenia, zanim zostanie przedstawiona jako gotowa.

- Sprawdzić `npm run version:check`, Prettier/format, `npm run typecheck`, `npm run typecheck:frontend`, lint, policy i testy adekwatne do instalatorów.
- Wymagane przed produkcją: prawdziwy PostgreSQL 18, clean install na Ubuntu/Debian, workflow CI, oferty i XLSX/PDF, ceny, import, backup i restore drill.
- Weryfikacja: brak aktywnego SQLite poza dozwolonym read-only eksportem cenników; CI na PostgreSQL 18 zielone; końcowy diff przejrzany.
- Antywzorce: uznanie parsowania skryptu za dowód działającej instalacji, testy na mocku jako dowód PostgreSQL, produkcyjny cutover bez osobnego GO.
