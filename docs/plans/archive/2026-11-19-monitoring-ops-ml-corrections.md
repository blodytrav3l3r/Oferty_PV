# Plan: wiarygodny monitoring Operacji i ML

## Primary goal

Administrator widzi prawdziwy stan backupu, PostgreSQL, API i modelu ML, a oznaczenie `OK` nigdy nie maskuje braku danych ani nieaktualnego zasobu. Diagnostyka pozostaje dostępna tylko w odpowiednim zakresie uprawnień i daje wskazówkę, gdzie szukać błędu.

## Bieżący stan potwierdzony

- Panel Operacje pokazuje backup z 2026-11-06 jako `OK`; kontrakt backupu uznaje kopię starszą niż 26 godzin za nieaktualną. UI sprawdza jedynie `backups > 0`, choć `/health/backup` już udostępnia świeżość.
- `GET /metrics` zwraca `dbBytes: null` i `walBytes: null` celowo; panel zawsze pokazuje rozmiar bazy jako `UNKNOWN`.
- Metryki 5xx są licznikami od startu procesu; źródłowy snapshot ma także agregaty per endpoint, ale karta pokazuje tylko sumę.
- Model `v0.1.0-starter` z AUC 0.5000 i 0 wierszami treningowymi jest prezentowany jako online, a część kart ma status `OK`.
- `GET /api/telemetry/ai/ml-status` jest używany przez admin dashboard, panel Operacje, wskaźnik w nagłówku i `mlDualRanking.js`. Nie można po prostu dodać `requireAdmin` bez rozdzielenia wymaganych danych.
- Test Playwright ma domyślne hasło, którego backend nie pozwala użyć przy tworzeniu konta administratora. CI przekazuje `TEST_ADMIN_PASSWORD` jawnie.

## Phase 0 — dokumentacja i kontrakty

**How this serves the primary goal:** ustala prawdziwe źródła danych i kontrakty zanim zmienimy statusy widoczne dla administratora lub klienta.

### What to implement

- Przed kodowaniem potwierdzić w aktualnej dokumentacji PostgreSQL funkcję i wymagane uprawnienia dla `pg_database_size(current_database())`; rozstrzygnąć, czy rozmiar mierzymy synchronicznie przy `/metrics`, czy cache'ujemy poza ścieżką żądania.
- Sprawdzić wszystkie pola konsumowane z `ml-status` przez `aiStatusIndicator.js`, `mlDualRanking.js`, `opsDashboard.js` i `aiDashboardMl.js`; przygotować kontrakt minimalnego statusu dla użytkowników oraz szczegółów admin-only.
- Zachować istniejący próg świeżości backupu `MAX_BACKUP_AGE_MS` jako SSoT. Nie dodawać nowego progu jakości AUC bez decyzji domenowej.
- Wykorzystać istniejące testy i wzorce: `tests/frontend/opsDashboard.test.ts`, `tests/healthBackup.test.ts`, `tests/backupFreshness.test.ts`, `tests/metrics.test.ts`, `tests/ml/trainingGate.test.ts`, `tests/security/informationDisclosure.test.ts`.

### Documentation references

- `docs/agents/database.md` — PostgreSQL-only, parametryzowane SQL, minimalne role, monitoring i backup/restore.
- `docs/agents/testing.md` — izolowany PostgreSQL przez `POSTGRES_TEST_URL`, test regresyjny dla błędu logicznego.
- `docs/SYSTEM_INVARIANTS.md` — I-006 backup/restore, I-007 deterministyczna walidacja ML, I-011 ograniczenie ujawniania diagnostyki.
- `docs/API.md` — obecne kontrakty `/metrics`, `/health/backup` i `/api/telemetry/ai/ml-status`.

### Verification

- `verify:` lista konsumentów statusu ML i wymaganych pól pokrywa wszystkie referencje w kodzie.
- `verify:` dokumentacja PostgreSQL potwierdza funkcję pomiaru rozmiaru i model uprawnień przed wyborem implementacji.
- `verify:` żadna zmiana kontraktu nie usuwa CSP z odpowiedzi używanej przez sondę w panelu Operacje.

### Anti-pattern guards

- Nie podnosić istniejącego endpointu diagnostycznego do `requireAdmin` bez zachowania lekkiego statusu potrzebnego rankingowi i headerowi.
- Nie raportować braku danych jako zera ani statusu `OK`.
- Nie używać `queryRawUnsafe` z danymi wejściowymi; nie łączyć pomiaru PostgreSQL z kopiowaniem plików bazy.

## Phase 1 — prawdziwy status backupu i rozmiaru PostgreSQL

**How this serves the primary goal:** panel przestaje pokazywać nieaktualną kopię jako poprawną i wyjaśnia brak albo błąd odczytu zamiast udawać pomiar.

### What to implement

- Rozszerzyć pobieranie danych w `public/js/admin/opsDashboard.js` o istniejący `/health/backup`; mapować `200/ok` na `OK`, `503/stale` na `WARNING`, a brak odpowiedzi lub błędny payload na `UNKNOWN`/`ERROR` zgodnie z ustalonym kontraktem.
- Pokazać wiek kopii i maksymalny wiek akceptowany przez backend. Liczbę lokalnych plików nadal prezentować oddzielnie od świeżości.
- Dodać pomiar bajtów bieżącej bazy PostgreSQL w admin-only `/metrics`, korzystając z potwierdzonej funkcji i praw roli aplikacji. Błąd pomiaru pozostawia `null` z rozróżnialną przyczyną; WAL pozostaje `UNKNOWN`, dopóki nie zostanie wdrożony osobny poprawny pomiar.
- Rozszerzyć `tests/frontend/opsDashboard.test.ts` o świeży backup, przeterminowany backup, brak markera, błąd endpointu oraz payload bez daty; rozszerzyć `tests/metrics.test.ts` o wynik rozmiaru i kontrolowany błąd zapytania.

### Documentation references

- `src/app.ts:179-191` — kontrakt `/health/backup` z `status`, `ageHours` i `maxAgeHours`.
- `scripts/backup.ts:43-57` — SSoT progu 26 godzin i klasyfikacji przeterminowanej kopii.
- `src/utils/metrics.ts:124-234` — typ `StorageSnapshot` i obecny null dla rozmiaru bazy.
- `public/js/admin/opsDashboard.js:267-282` — obecna implementacja badge backupu i rozmiaru.

### Verification

- `verify:` regresje frontendowe dowodzą, że przeterminowany backup nigdy nie otrzymuje `OK`.
- `verify:` test PostgreSQL sprawdza realistyczny typ zwracany dla rozmiaru i błąd uprawnień/połączenia bez użycia bazy deweloperskiej.
- `verify:` `/metrics` bez dostępu do rozmiaru zwraca `null`/stan niewiadomy, nie `0`; ścieżka gotowości DB nie jest blokowana pomiarem.

### Anti-pattern guards

- Nie wyznaczać świeżości kopii z samej liczby dumpów ani nie kopiować progu 26 h do frontendu.
- Nie przechwytywać błędu rozmiaru i nie zwracać `0` jako poprawnego wyniku.
- Nie dodawać DDL ani migracji schematu do tej fazy.

## Phase 2 — czytelna kondycja API i błędów 5xx

**How this serves the primary goal:** administrator może odróżnić historyczny licznik od aktualnego pogorszenia i znaleźć endpointy generujące błędy.

### What to implement

- Zachować obecne liczniki `n` i `errors` jako wartości od startu procesu, ale nazwać ich zakres w UI i odpowiedzi API.
- Rozszerzyć ograniczony bufor metryk endpointu o status odpowiedzi i udostępnić liczbę oraz udział 5xx dla ostatnich próbek. Pozostawić limit rozmiaru i długości bufora.
- W panelu pokazać najbardziej błędne endpointy z liczbą żądań, 5xx i p95, wraz z tekstem „ostatnie próbki”; przy pustej próbce użyć `UNKNOWN`.
- Dodać testy dla resetu procesu, pustego bufora, pojedynczych błędów i przekroczenia limitu próbek.

### Documentation references

- `src/utils/metrics.ts:11-21,81-96,149-188` — ograniczone bufory i liczniki per endpoint.
- `public/js/admin/opsDashboard.js:218-265` — obecna suma 5xx i opis `DB busy`.
- `src/middleware/requestLogger.ts:16-29` — sposób zliczania żądań i statusów.

### Verification

- `verify:` testy dowodzą poprawnych liczników kumulatywnych oraz statusów dla próbek ostatnich żądań.
- `verify:` format `/metrics` pozostaje backward-compatible dla obecnego panelu do czasu jego aktualizacji.
- `verify:` UI nie wylicza bieżącego procentu z licznika lifetime.

### Anti-pattern guards

- Nie przedstawiać 5xx „od startu” jako błędów z ostatniego okna.
- Nie przechowywać surowych URL-i z identyfikatorami ani treści żądań w metrykach.
- Nie zwiększać limitu próbek bez pomiaru pamięci.

## Phase 3 — rozdzielenie statusu ML od gotowości modelu i szczegółów admina

**How this serves the primary goal:** użytkownicy i administratorzy dostają status właściwy dla swojej roli, a model bez danych nie wygląda jak zdrowy model produkcyjny.

### What to implement

- Rozdzielić pojęcia „aktywny rekord modelu”, „model wytrenowany” i „gotowość do rankingu”. Minimalny endpoint auth-only zachowuje pola wymagane przez `mlDualRanking.js` i header; szczegółowy endpoint admin-only obsługuje panel AI/ML i Operacje.
- Zachować CSP na odpowiedzi używanej przez sondę bezpieczeństwa; jeśli zmienia się źródło sondy, przenieść test i kontrakt CSP razem z endpointem.
- Dla modelu bez próbek treningowych, bez udanego runu lub bez metryk pokazywać `UNKNOWN`/`WARNING`, nie `OK`. Wyświetlać AUC i fingerprint jako dane opisowe; nie wprowadzać automatycznej granicy AUC bez zatwierdzonego kryterium.
- Zaktualizować `docs/API.md` i testy `tests/frontend/aiDashboardMl.test.ts`, `tests/frontend/opsDashboard.test.ts`, `tests/ml/telemetryAiMl.test.ts` oraz `tests/security/informationDisclosure.test.ts`.

### Documentation references

- `src/routes/telemetryAiMl.ts:714-801` — status modelu i danych treningowych.
- `public/js/studnie/mlDualRanking.js:24,117-137` — wymaganie `featureVersion` dla rankingu.
- `public/js/aiStatusIndicator.js:11-78` — pola obecnie prezentowane w nagłówku.
- `tests/ml/trainingGate.test.ts` — istniejący kontrakt bramki treningowej bez arbitralnego progu.

### Verification

- `verify:` testy 401/403 dowodzą, że metryki administracyjne nie są dostępne zwykłemu zalogowanemu użytkownikowi.
- `verify:` ranking nadal odczytuje wersję cech i działa fail-safe, a odpowiedź źródłowa dla CSP zachowuje `script-src` z nonce.
- `verify:` macierz UI rozróżnia: brak modelu, starter bez treningu, model z danymi bez fingerprintu, model po udanym treningu i niedostępny endpoint.

### Anti-pattern guards

- Nie blokować ML rankingu przez zmianę roli na endpointzie bez aktualizacji konsumentów.
- Nie oznaczać modelu jako gotowego tylko dlatego, że istnieje aktywny rekord.
- Nie wnioskować o jakości z AUC `0.5` bez liczebności i kontraktu walidacji.

## Phase 4 — niezawodność testów i ręcznego cyklu uczenia

**How this serves the primary goal:** diagnostyczne testy uruchamiają się w sposób powtarzalny, a kosztowna operacja uczenia nie może być wywoływana jak odczyt dashboardu.

### What to implement

- Wymagać jawnego `TEST_ADMIN_PASSWORD` w `tests/playwright/aiDashboardSmoke.spec.ts`. Błąd konfiguracji ma być czytelny przed próbą logowania.
- Zmienić limiter `POST /ai/learning/run` z `READ_LIMITER` na dedykowany limit operacji/cooldown, dobrany do czasu pracy i procesu jednego serwera. Zachować istniejący guard równoległości.
- Dodać test route dla limitu i test uruchomienia smoke bez zmiennej środowiskowej.

### Documentation references

- `tests/playwright/aiDashboardSmoke.spec.ts:12-20` — obecny fallback hasła.
- `src/middleware/auth.ts:29-32` — odrzucanie tego hasła.
- `.github/workflows/ci.yml:341-344` — jawna konfiguracja hasła w CI.
- `src/routes/telemetryAiDashboard.ts:23-34` i `src/middleware/rateLimiters.ts:38-46` — endpoint i obecny read limiter.

### Verification

- `verify:` lokalny smoke bez konfiguracji kończy się czytelnym błędem konfiguracji; CI nadal loguje konto testowe przez env.
- `verify:` test limitu dopuszcza legalny pojedynczy cykl, blokuje serię oraz nie zmienia zachowania dla innych odczytów.

### Anti-pattern guards

- Nie wkładać haseł testowych do kodu ani fixture śledzonych w Git.
- Nie używać produkcyjnej bazy lub wspólnego konta dla testów Playwright.
- Nie stosować limitu read jako zabezpieczenia kosztownej mutacji.

## Final phase — weryfikacja i dokumentacja

**How this serves the primary goal:** domyka wszystkie poprawki dowodem w testach i aktualnym kontraktem API.

### What to implement

- Uzupełnić `docs/API.md` o nowe pola, role, semantykę liczników oraz statusy backupu/ML.
- Uruchomić testy regresyjne z faz, następnie `npm run format`, `npm run version:check` i `npm run validate`.
- Sprawdzić diff, kodowanie UTF-8 bez BOM i brak nowych globali, inline handlerów oraz inline styles. Nie commitować ani nie wdrażać w ramach samego planu.

### Documentation references

- `docs/agents/testing.md` — wymagane testy i bramy.
- `docs/agents/evidence.md` — dowody, wynik weryfikacji i zapis ograniczeń.
- `AGENTS.md` — wersja, format, walidacja i zasady commit/push.

### Verification

- `verify:` wszystkie nowe testy regresyjne przechodzą na izolowanym PostgreSQL.
- `verify:` `npm run version:check`, formatowanie i `npm run validate` przechodzą.
- `verify:` ręczny podgląd dashboardu pokazuje nieaktualny backup jako WARNING, brak pomiaru jako UNKNOWN, nieprzeszkolony model jako nierozpoznany/warning oraz aktualne błędy per endpoint.

### Anti-pattern guards

- Nie aktualizować numeru wersji ręcznie poza `scripts/versionWrite.ts`.
- Nie traktować zielonego typechecku ani testu mockowego jako dowodu rozmiaru bazy/backup restore.
- Nie wykonywać operacji na produkcyjnej bazie, nie pushować i nie wdrażać bez osobnego zakresu zgody.

## Deferred

- WAL bytes, alerty zewnętrzne i historia metryk ponad buforem procesu — wymagają osobnej decyzji o retencji i infrastrukturze monitoringu.
- Pełny restore drill oraz określenie RPO/RTO — osobna operacja zgodnie z runbookiem backup/restore.
- Ustalanie biznesowego progu jakości AUC — wymaga danych walidacyjnych i zatwierdzenia domenowego.

## Decyzje wdrożeniowe

- Rozmiar bazy pochodzi z `pg_database_size(current_database())`, które zwraca `bigint` i działa na obecnym połączeniu z uprawnieniem `CONNECT`. Aplikacja współdzieli wynik przez 60 sekund i ogranicza czas zapytania. [Dokumentacja PostgreSQL 18](https://www.postgresql.org/docs/18/functions-admin.html#FUNCTIONS-ADMIN-DBSIZE)
- Nagłówek korzysta z `/ml-summary`, ranking Studni pobiera wersję z istniejącego `/feature-schema`, a szczegóły pozostają na `/ml-status` za kontrolą roli admin. Statusy jakości odwołują się do danych aktywnego modelu.
- Ręczny cykl uczenia ma limit jednego żądania na minutę na proces. Istniejąca blokada chroni przed nałożeniem cykli.
- Wydanie na środowisko, które już serwuje wersję 1.64.7, wymaga standardowej aktualizacji wersji zasobów. Starsze skrypty z cache nadal wywołują `/ml-status` w sesjach bez roli admin.

## Wynik weryfikacji

- `npm run format`, `npm run version:check` i pełne `npm run validate` zakończyły się kodem 0 na izolowanym PostgreSQL. Główny przebieg Jest zaliczył 6552 testy, cztery pominął. Osobny przebieg bramy cenników zaliczył dwa testy. `prices:verify` zgłosił różnice między danymi testowymi a pakietem instalacyjnym w trybie ostrzegawczym.
- Playwright zaliczył trzy testy HTTP na osobnym serwerze. Sprawdzono też komunikat startowy przy braku `TEST_ADMIN_PASSWORD`.
