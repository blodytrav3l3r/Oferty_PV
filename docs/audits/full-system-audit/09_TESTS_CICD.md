# Testy, CI/CD i operacje

## A9 · Inwentaryzacja i wykonanie

- 640 śledzonych ścieżek pod tests/, 580 plików *.test.ts, 7 *.spec.ts, 35 *.cjs. Liczba plików nie jest liczbą przypadków. Jest rozdziela node, jsdom i git-safety (jest.config.ts:21–53). Playwright używa Chromium i serwera E2E (playwright.config.ts:12–42).
- Bieżące wykonanie npm run test:installer-linux zakończyło się kodem 0. Przeszły kontrakty Windows/Linux, walidacja 3 wersji/1023 pozycji, polityka odzyskania nieudanej migracji (stub) i guard 309 plików runtime. Bash syntax/help odnotowano jako SKIP. Sprawdzone ścieżki nie wywołują instalacji ani PostgreSQL. Importer wraca przed verifyOrInsert w --validate-only (scripts/import-active-pricelists.ts:479–502).
- Próby syntetyczne w pamięci sprawdziły CSRF scheme, X-Forwarded-Proto, marker skróconego audytu i limit bcrypt. Dane i aplikacja nie były uruchamiane w tym celu.
- Pełny Jest tworzy/droppuje schematy i może usuwać stare katalogi tests/tmp (tests/setupDbIsolation.ts:60–103, tests/setup.ts:10–29). Nie uruchomiono na lokalnych danych. Restore roundtrip ma warunkowy it.skip i tworzy/usuwa bazę testową (tests/migrations/restoreRoundtrip.test.ts:34,126,162). Bash-based preflight ma warunkowy it.skip (tests/scripts/dockerPreflight.test.ts:66).
- Testy lokalnie zawierają security, pricing, body limits, export TOCTOU, lock/share, migration/restore, Excel parity/golden i krytyczne smoke. Pokrycie z raportu istniejącej sesji i wcześniejsze 575 zestawów PASS nie stanowią świeżego przebiegu. Status flaky i coverage bieżącego HEAD N/A.
- QA-01: test axe Kartoteki może zbadać stronę zastępczą (FE-05). QA-02: regresje współbieżności w P0/P1 wymagają dwóch autentycznych sesji lub synchronizowanych transakcji, a testy polityk regex nie zastępują pełnej instalacji.

## A10 · Lokalne definicje

| Obszar            | Stan                                                                                                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Główne bramy      | CI lint, typecheck, version, coverage, schema sanity, migracje, PostgreSQL 18, Docker, E2E smoke, Excel gates. ci.yml:29–147,235–303,398–480,546–593,761–902.                |
| CI testy okresowe | Flaky 3 przebiegi i porównanie :179–225, extended E2E advisory :596–687, osobny load i throttle.                                                                             |
| Skanowanie        | CodeQL z oddzielnymi permissions; actions referują tagi major (codeql.yml:16–39), nie ustalony w repo commit SHA.                                                            |
| PostgreSQL        | Compose z PG18, osobny wolumen i role, app bind 127.0.0.1, healthcheck. Smoke workflow :55–128 testuje kontener i narzędzia PostgreSQL.                                      |
| Dostawa           | Windows setup-new-pc.ps1 / start-postgres.bat, Linux install-linux-server.sh, bootstrap docker-db-bootstrap.sh. Świeża rzeczywista instalacja Linux i Windows pozostaje N/A. |
| Backup            | Osobny wolumen Compose, walidacja TOC, SHA i retencja. Odtworzenie poza hostem, czas odzyskania i wypróbowany rollback N/A.                                                  |

- OPS-01 P2: Render webhook raportuje DEPLOYED bez potwierdzenia wersji/readiness po wdrożeniu (.github/workflows/ci.yml:905–939). Konfiguracja opcjonalna, jej stan zdalny N/A. Oddzielić status trigger od sukcesu po smoke z wersją.
- OPS-02 P2: główne ścieżki CI opierają się na Node 22 i Ubuntu, a audyt lokalny na Windows/Node 24. Linux i Windows mają własne ścieżki instalacji. Dodać blokującą bramę testów instalatora bez użycia prawdziwego hosta produkcyjnego, dodać macierz wspieranych środowisk. Obecny test:installer-linux należy do test:quick, a główne CI używa npm test; osobny smoke kontenera jest innym zakresem.
- OPS-03 P2: lokalny kontekst Docker nie ma pozytywnej listy plików. Przed dystrybucją sprawdzić SEC-06 i paczkę. Wersje bazowych obrazów i akcji wskazują ruchome tagi. Przypięcie i zaplanowana aktualizacja zwiększają powtarzalność.
- OPS-04 P2, ryzyko operacyjne. Jedyny potwierdzony z definicji wolumen backupu jest lokalny dla hosta. RPO/RTO, kopia poza hostem i odtworzenie po utracie hosta nie są dowiedzione przez healthcheck ani TOC. docker-compose.yml:47,92, scripts/backup.ts:313–334.

Status i konfiguracja zdalnego CI oraz środowiska Render nie były sprawdzane.
