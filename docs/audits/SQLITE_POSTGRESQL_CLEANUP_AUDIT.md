# S.O.K. — lokalny audyt pozostałości SQLite po migracji do PostgreSQL 18

- **Data audytu:** 2026-11-05
- **Zakres źródła:** wyłącznie pliki dostępne lokalnie w `I:\GitHub\Oferty_PV`
- **Branch / HEAD na początku audytu:** `main` / `81a68d1a899feca5f10a833037e019292b98c8eb`
- **Stan worktree na początku audytu:** czysty.
  **Operacje niewykonane:** GitHub/API/remote, fetch/pull/push/clone, połączenie/zmiana bazy, migracja, seed, restore i odczyt danych z bazy.
  **Cleanup wykonany po audycie na bieżącą prośbę użytkownika:** usunięto wyłącznie zawartość `tests/tmp/` po sprawdzeniu ścieżki, braku tracked files, braku procesów Node oraz wieku wpisów (>5 min); katalog główny pozostawiono. Szczegóły w sekcji 7.

## 1. Wniosek wykonawczy

Kod i konfiguracja bieżącej aplikacji wskazują PostgreSQL jako jedyny backend relacyjny. Prisma ma provider `postgresql`, wskazuje kanoniczny katalog migracji PostgreSQL, instalatory wdrażają te migracje, a guard CI skanuje 309 plików runtime pod kątem powrotu API SQLite. W ścieżkach `src/` i `public/` nie znaleziono aktywnego adaptera ani połączenia SQLite. Frontend używa API HTTP; IndexedDB w `public/js/shared/draftIdb.js` jest osobnym magazynem przeglądarki dla dużych szkiców, a nie bazą aplikacji.

Początkowy inventory nie miał plików `REMOVE_SAFE`: ignorowane artefakty testów były wtedy zaklasyfikowane jako `REVIEW`. Po osobnym, jawnym poleceniu cleanup usunąłem wyłącznie zawartość `tests/tmp/` po potwierdzeniu, że katalog nie jest śledzony, wszystkie wpisy były stare, a proces Node nie działał. Pre-cleanup inwentarz jest zachowany w dodatku B. Archiwa i potencjalne dane cenników poza tym katalogiem pozostały nietknięte.

Odrębne ustalenie bezpieczeństwa: `docs/plans/_active-evidence.md:188` zawiera literalny tekst opisany jako lokalne hasło testowe. Review lokalnej historii potwierdził jego występowanie w 19 z 27 rewizji tego pliku (najstarszy znaleziony lokalny commit `1b12acb51679…`). Czy credential jest nadal aktywny oraz czy został udostępniony poza lokalne repozytorium — `UNVERIFIED`; nie kontaktowano się ze zdalnym GitHub. Nie kopiuję wartości do raportu. Jeśli jest aktywny lub współdzielony, należy go obrócić. Redakcja pliku HEAD nie usunie wartości z historii Git; jej czyszczenie wymaga osobnej skoordynowanej decyzji.

Najważniejsza blokada ochrony danych to ignorowany backup ustawień zawierający cztery pola cenników oraz archiwum audytowe powiązane manifestem z dawną bazą SQLite. Nie porównano tych danych z kanonicznym pakietem ani z bazą PostgreSQL. Pakiet świeżej instalacji jest poprawny: `--validate-only` potwierdził 3 aktywne wersje i 1 023 pozycje, ale **to nie dowodzi kompletności danych w działającej bazie ani migracji historycznych cen**. Żadnych danych nie należy usuwać przed takim porównaniem i osobną zgodą.

## 2. Metoda, zakres i ograniczenia

- Lokalny stan Git: `git branch`, `git rev-parse HEAD`, `git status --short`, `git log -10`, `git diff --stat`, `git diff --name-status`; bez operacji zdalnych.
- Zinwentaryzowano 1 668 śledzonych plików i 5 675 lokalnych ścieżek plików w skanie nazw; skan tekstu objął 4 820 kandydatów z kodem, konfiguracją i dokumentacją. Pominięto `.git`, `node_modules`, wygenerowany graph/build/coverage oraz zawartość `.env` i innych plików sekretów. Osobno zinwentaryzowano artefakty `tests/tmp/` i metadane `data/backups/`.
- Skan repozytorium Git znalazł 372 linie z terminami SQLite w 121 śledzonych plikach. Obejmują one guardy, negatywne testy, wpisy historyczne i dokumentację, a nie 372 użycia SQLite. Pełny indeks ścieżek/wierszy jest w dodatku A.
- Weryfikację nagłówków plików w `tests/tmp/` ograniczono do pierwszych 16 bajtów każdego pliku. Nie odczytywano tabel ani rekordów. Nie otwarto 91 MB skompresowanego archiwum audytowego ani wartości cen z backupu JSON.
- Nie łączono się z PostgreSQL. Ocena migracji poniżej dotyczy kodu, konfiguracji, pakietu seed i testów; nie potwierdza schematu ani danych live/produkcyjnych.
- Graphify lokalny użyto jako indeksu pomocniczego. Wnioski końcowe oparto na bieżących plikach i komendach lokalnych, nie na zdalnym indeksie.

## 3. Potwierdzone elementy architektury PostgreSQL

| Obszar                     | Dowód lokalny                                                                                                                                                                                                       | Ocena                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Prisma schema              | `prisma/schema.prisma:11-13` — datasource `postgresql`                                                                                                                                                              | `KEEP_ACTIVE`                                                |
| Prisma config              | `prisma.config.ts:5-11` — `prisma/migrations-postgresql`, jawny `DATABASE_URL`, seed Prisma                                                                                                                         | `KEEP_ACTIVE`                                                |
| Historia migracji          | `prisma/migrations-postgresql/0001_initial`, `0002_care_latest_followup_triggers`, `0003_partial_unique_invariants` i `migration_lock.toml` z providerem PostgreSQL                                                 | `KEEP_ACTIVE`                                                |
| API/serwer                 | `src/prismaClient.ts:4-14`; routes/services wywołują Prisma; frontend komunikuje się przez REST                                                                                                                     | `KEEP_ACTIVE`                                                |
| Instalatory                | `scripts/setup-new-pc.ps1:468-513`; `install-linux-server.sh:284-288` walidują i importują zatwierdzony bundle przed readiness                                                                                      | `KEEP_ACTIVE`                                                |
| Docker                     | `scripts/docker-entrypoint.sh:8-23`, `scripts/docker-db-bootstrap.sh:20-50`, `docker-compose.yml:40-80` wymagają PostgreSQL i jawnych URL-i                                                                         | `KEEP_ACTIVE`                                                |
| Backup/restore             | `scripts/backup.ts:193-205,276-316,366-388` waliduje PostgreSQL, wykonuje `pg_dump`, sprawdza archiwum przez `pg_restore --list` i zapisuje marker po weryfikacji; `scripts/restore-db.js:187,281-320` waliduje cel | `KEEP_ACTIVE`                                                |
| Testy regresji             | `tests/scripts/postgresOnlySurface.test.cjs:34-80` skanuje 309 plików runtime; izolacja testów wymaga PostgreSQL                                                                                                    | `KEEP_ACTIVE`                                                |
| Bezpośrednie zależności    | `package.json:131,142` deklaruje `@prisma/adapter-pg` i `pg`; brak bezpośredniego pakietu SQLite                                                                                                                    | `KEEP_ACTIVE`                                                |
| Opcjonalny peer w lockfile | `package-lock.json:14933-14964` zawiera `better-sqlite3` wyłącznie jako opcjonalne metadane peer dependency Prisma CLI; nie ma go jako zależności root ani w `node_modules` aplikacji                               | `KEEP_ACTIVE` — nie edytować ręcznie wygenerowanego lockfile |

W bieżącym checkoutcie brak aktywnego katalogu dawnych migracji SQLite i brak śledzonych plików bazy. `prisma/migrations/` i dawny exporter nie są obecnymi źródłami; test powierzchni PostgreSQL wymaga ich braku, a `.dockerignore:30-37` zachowuje wykluczenia jako guardy. Nie znaleziono aktywnej implementacji `node:sqlite`, `better-sqlite3`, `sql.js`, SQLite `PRAGMA`, `sqlite_master`, `sqlite_sequence`, `AUTOINCREMENT` ani `last_insert_rowid` w S.O.K. UI/API.

## 4. Inwentaryzacja pozostałości i klasyfikacja

| Ścieżka lokalna                                                                                                                                                                                                                                                                                                                                               | Przeznaczenie / wykorzystanie                                                     | Dowód                                                                                                                                                                                                                                       | Status                                             | Ryzyko i zalecenie                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tests/tmp/` — 114 `fu-cycles-*.db`, 57 `fu-terminal-*.db`, 30 `fu-tie-*.db`, 30 `fu-wins-*.db`; łącznie 231 `.db`                                                                                                                                                                                                                                            | Ignorowane artefakty testów — stan sprzed cleanupu                                | Wszystkie 231 miały nagłówek SQLite; 5 431 296 B; `git ls-files tests/tmp` puste; `.gitignore:179`; brak aktywnych referencji do tych nazw                                                                                                  | `REVIEW` przed zgodą; usunięto po jawnym poleceniu | Zawartości nie badano; nie można wykluczyć danych cenników. Usunięto wyłącznie stare pliki z katalogu tymczasowego na jawną prośbę. Szczegóły nazw w dodatku B.                                                                                                                                  |
| `tests/tmp/` — 32 `jest-worker-*.sqlite`, 1 `jest-template.*.sqlite`, 1 `manual-prisma7.sqlite`; łącznie 34 `.sqlite`                                                                                                                                                                                                                                         | Ignorowane artefakty harnessów — stan sprzed cleanupu                             | 33 656 832 B; 33 pliki miały nagłówek SQLite, 1 pusty plik 0 B; `.gitignore:179`                                                                                                                                                            | `REVIEW` przed zgodą; usunięto po jawnym poleceniu | Były stare artefakty testowe; ich pre-cleanup ścieżki zachowano w dodatku B.                                                                                                                                                                                                                     |
| `tests/tmp/` — 33 `*.ready`, 1 `*.log`                                                                                                                                                                                                                                                                                                                        | Markery/log testowego harnessu — stan sprzed cleanupu                             | 429 B markerów i 232 B logu; po usunięciu brak wpisów w katalogu                                                                                                                                                                            | Usunięto po jawnym poleceniu                       | Powiązane ze starymi artefaktami testowymi.                                                                                                                                                                                                                                                      |
| `data/backups/legacy_settings_1787071124385.json`                                                                                                                                                                                                                                                                                                             | Ignorowany eksport legacy ustawień                                                | 552 754 B; JSON zawiera `keys.pricelist_rury`, `pricelist_rury_default`, `pricelist_studnie`, `pricelist_studnie_default` jako serializowane JSON; `.gitignore:54`; brak aktualnego odwołania do nazwy pliku w `src/`, `scripts/`, `tests/` | `BLOCKER` / `KEEP_ARCHIVE`                         | Zawiera dane cenowe, których kompletności i zgodności z bundle/DB nie porównano. Bezwzględnie zachować do weryfikacji i decyzji retencyjnej. Raport nie kopiuje wartości cen.                                                                                                                    |
| `data/backups/audit-archive-2026-10-24T15-39-38-916Z.jsonl.gz`                                                                                                                                                                                                                                                                                                | Ignorowane archiwum audytowe                                                      | 91 264 297 B; manifest obok deklaruje źródłową ścieżkę dawnej bazy, 226 rekordów, payload 1.31 GB i hash; zawartość gzip nie była otwierana                                                                                                 | `KEEP_ARCHIVE` / `BLOCKER` dla cleanupu            | Archiwum może być wymagane dla audytu/retencji; nie usuwać bez osobnego restore/retention review.                                                                                                                                                                                                |
| `data/backups/audit-archive-2026-10-24T15-39-38-916Z.jsonl.gz.manifest.json`                                                                                                                                                                                                                                                                                  | Metadane powyższego archiwum, wskazują dawną ścieżkę SQLite                       | linie 3-9; `.gitignore:54`; manifest powiązany nazwą i hashem z archiwum                                                                                                                                                                    | `KEEP_ARCHIVE`                                     | Nie jest bazą SQLite; zachować razem z plikiem gzip.                                                                                                                                                                                                                                             |
| `data/backups/.last-backup.json`                                                                                                                                                                                                                                                                                                                              | Marker ostatniego backupu                                                         | marker datowany 2026-11-04 wskazuje `backup_2026-11-04_1793806964768.sqlite`, deklaruje 141 160 448 B i `verification: ok`; `Test-Path` dla celu jest `False`, a lokalny katalog zawiera tylko 4 powyższe wpisy                             | `BLOCKER` / `REVIEW`                               | Niespójny lokalny marker. Kod bieżący tworzy backup `.dump` i odświeża marker dopiero po pozytywnej weryfikacji (`scripts/backup.ts:281-282,366-378`). Nie usuwaj ani nie poprawiaj markera ręcznie; naprawa wymaga zweryfikowanego backupu PG i odrębnego GO, bez operacji na DB w tym audycie. |
| `docs/adr/ADR-001-sqlite.md`, `docs/adr/ADR-012-single-node-sqlite.md`                                                                                                                                                                                                                                                                                        | Superseded ADR-y — zapis pierwotnych decyzji                                      | status `Superseded / historyczny` na początku dokumentów                                                                                                                                                                                    | `KEEP_ARCHIVE`                                     | Nie usuwać: dokumentują kontekst i wskazują aktualny standard PostgreSQL.                                                                                                                                                                                                                        |
| `CHANGELOG.md`, `docs/DELETION_LOG.md`, `docs/AUDIT.md`, `docs/audits/*`, `docs/plans/archive/*`                                                                                                                                                                                                                                                              | Historia zmian, audytów i dawnego SQLite                                          | datowane wpisy/archiwalne lokalizacje; wiele starych instrukcji lub zrzutów                                                                                                                                                                 | `KEEP_ARCHIVE`                                     | Stare polecenia SQLite w archiwach nie są runtime. Nie kopiować ich do aktywnych runbooków.                                                                                                                                                                                                      |
| Guardy: `.gitignore:57-67,132`, `.dockerignore:30-37`, `.gitattributes:19`, `.editorconfig:21`, `eslint.config.mjs`, `scripts/check-appname.cjs:99-104`, `scripts/encoding-integrity.js:26-32`, `scripts/migrate-diff-check.mjs:33-39`                                                                                                                        | Ignorowanie plików DB, klasyfikacja binarna i regresyjne wykrywanie SQLite        | bieżące wpisy oraz test `tests/scripts/postgresOnlySurface.test.cjs:34-80`                                                                                                                                                                  | `KEEP_ACTIVE`                                      | Zachować. Usunięcie tych wpisów osłabi ochronę przed przypadkowym dodaniem bazy SQLite albo regresją.                                                                                                                                                                                            |
| Negatywne testy: `tests/prismaClient.requiresDatabaseUrl.test.ts:39-59`, `tests/scripts/checkDbPath.test.ts:11-38`, `tests/restoreGuards.test.ts:13-16,125-130`, `tests/scripts/recoverFailedInitialMigration.test.cjs:14-21`, `tests/auditIntegrity.test.ts:23-27`, `tests/ci/e2eIsolation.test.ts:48-52,87-91`, `tests/scripts/dockerEntrypoint.test.ts:28` | Fixture’y z `file:...sqlite` potwierdzają odrzucanie SQLite i niepoprawnych URL-i | testy sprawdzają brak fallbacku, walidację PG i zabezpieczenia                                                                                                                                                                              | `KEEP_ACTIVE`                                      | Nie są użyciem SQLite; zachować bez „czyszczenia” samych słów `sqlite`.                                                                                                                                                                                                                          |
| `tests/setupDbIsolation.ts:20-24`, `tests/playwright/isolatedPostgres.cjs:11-22`, `tests/playwright/postgresServer.cjs:12-27`, `playwright.config.ts:5-8`                                                                                                                                                                                                     | Wymuszenie jawnego PostgreSQL i izolacja workerów/schematów                       | konfiguracja wymaga URL PostgreSQL                                                                                                                                                                                                          | `KEEP_ACTIVE`                                      | Nie zmieniać na SQLite ani na domyślną bazę.                                                                                                                                                                                                                                                     |
| `package-lock.json:14933-14964`                                                                                                                                                                                                                                                                                                                               | Opcjonalne metadane peer dependency Prisma CLI                                    | brak root/direct dependency; pakiet `better-sqlite3` nie jest zainstalowany jako runtime                                                                                                                                                    | `KEEP_ACTIVE`                                      | To metadane upstream, nie ślad użycia. Nie ręcznie modyfikować lockfile.                                                                                                                                                                                                                         |
| `docs/errors-known.md:3-6`                                                                                                                                                                                                                                                                                                                                    | Aktywna dokumentacja statusu migracji                                             | używa teraźniejszego sformułowania „migruje do PostgreSQL-only” mimo obecnej konfiguracji PG-only                                                                                                                                           | `REVIEW`                                           | Proponowane C5: doprecyzować, że runtime jest już PG-only; nie usuwać historii błędów.                                                                                                                                                                                                           |
| `docs/plans/_active-evidence.md:188`                                                                                                                                                                                                                                                                                                                          | Śledzona notatka historyczna zawiera literalny tekst opisany jako hasło testowe   | obecność potwierdzona w 19/27 lokalnych rewizji; wartość pominięta                                                                                                                                                                          | `BLOCKER` — bezpieczeństwo                         | Aktywność i zasięg zewnętrzny są nieznane. Jeśli wartość nadal działa lub jest współdzielona, należy ją obrócić. Redakcja HEAD nie usuwa historii; audyt niczego nie zmienia ani nie rotuje.                                                                                                     |
| `docs/plans/2026-11-two-os-installers.md:59`                                                                                                                                                                                                                                                                                                                  | Niezarchiwizowana checklista instalatorów                                         | odwołuje się do dozwolonego SQLite eksportera, którego brak w bieżącym repo i który jest jawnie zakazany przez guard testowy                                                                                                                | `REVIEW`                                           | Proponowane C5: aktualizacja do stanu PostgreSQL i oznaczenie wykonania/archiwizacja zgodnie z workflow planów.                                                                                                                                                                                  |
| `docs/plans/_active-evidence.md:188,193,757`, `docs/plans/2026-10-20-cenniki-centrum-p0.md:231,340,389-390,401,423`, `docs/plans/2026-10-21-cenniki-panel-admina-plan.md:248,339`, pozostałe niearchiwizowane plany z dodatku A                                                                                                                               | Historyczne dowody i planowanie z fixture’ami/warunkami SQLite                    | datowane kroki i zrzuty, a nie referencje runtime                                                                                                                                                                                           | `REVIEW`                                           | Zachować dowody. C5 może oznaczyć kontekst jako historyczny lub przenieść ukończone plany do `docs/plans/archive/`; nie usuwać samych danych dowodowych.                                                                                                                                         |
| `public/js/shared/draftIdb.js:2-39`                                                                                                                                                                                                                                                                                                                           | IndexedDB przeglądarki dla dużych szkiców                                         | API przeglądarkowe IndexedDB; brak SQLite runtime                                                                                                                                                                                           | `KEEP_ACTIVE`                                      | To osobna warstwa lokalnego draftu; nie zastępować ani nie nazywać bazą aplikacji.                                                                                                                                                                                                               |
| `src/services/pricelist/export.ts:195-227`, `src/services/pricelist/validation.ts:476-479`, `src/app.ts:371`, `public/templates/ofertaStudnie.html:1146`                                                                                                                                                                                                      | Kolumna/zmienna `rowId`, nagłówek HTTP `Pragma`, nazwa produktu „Pragma”          | fałszywe trafienia wyszukiwania bez API bazy SQLite                                                                                                                                                                                         | `KEEP_ACTIVE`                                      | Nie zmieniać na podstawie samej nazwy tokenu.                                                                                                                                                                                                                                                    |

### 4.1 Lokalny, nieśledzony zasób spoza S.O.K.

`ECC/` jest wykluczony przez `.gitignore:96-97` i zawiera osobny embedded repository/toolchain. W pierwszym nieograniczonym skanie jego zależności `ECC/node_modules/sql.js` miały własne SQLite implementation/docs; nie są zależnością bezpośrednią S.O.K. ani w ścieżce aplikacji. `Dockerfile:34` używa `COPY . .`, a `.dockerignore` nie ma jawnego wpisu `ECC/`. Zalecana kontrola w C3: potwierdzić efektywny build context i wykluczyć osobny tooling repository z obrazu. Nie klasyfikuję ECC jako kodu wymagającego migracji S.O.K.; to izolacja build contextu do weryfikacji.

## 5. Ochrona cenników i danych

- `scripts/import-active-pricelists.ts:479-503` ma jawny `--validate-only`, który parsuje artefakt, sprawdza jego checksum/liczniki i kończy przed `verifyOrInsert`.
- Lokalna komenda `npx --no-install ts-node scripts/import-active-pricelists.ts data/pricelists/active-pricelists.json --validate-only` zakończyła się `PASS`: 3 aktywne wersje, 1 023 pozycje, SHA-256 `60d5cd806da3338f0875d8ed3dd9fdfc0837583337143a193abf520e3d5aaeae`.
- `data/backups/legacy_settings_1787071124385.json` ma pola cenników rur i studni oraz warianty domyślne. Nie porównano ich zawartości z bundle ani bazą, a plik może przechowywać inną historię/konfigurację.
- Archiwum audytowe ma manifest z dawną ścieżką SQLite. Nie wiadomo, czy zawiera wyłącznie logi, czy też dane wrażliwe/dowodowe; jego zawartość nie była odczytywana.
- **Status kompletności migracji danych:** `UNVERIFIED`. Potwierdzono PostgreSQL-only konfigurację i poprawność pakietu seed, ale nie odczytywano bazy live, nie wykonywano restore/cutover i nie porównywano wszystkich pozycji cenników między źródłami.

## 6. Kontrole i wyniki

| Kontrola                                    | Wynik                    | Zakres                                                                                         |
| ------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------- |
| Lokalny stan Git na początku                | `PASS`                   | `main`, HEAD powyżej, clean worktree; żadnego fetch/pull/push/clone ani zapytania o zdalny ref |
| PostgreSQL-only surface                     | `PASS`                   | `node tests/scripts/postgresOnlySurface.test.cjs`; 309 plików runtime                          |
| Schema Prisma                               | `PASS`                   | `npx --no-install prisma validate`; schema poprawna, bez połączenia z DB                       |
| Installer/recovery policy                   | `PASS`                   | `npm run test:installer-linux`; Windows/Linux policy i recovery policy przeszły                |
| Bash installer syntax/help                  | `SKIPPED`                | test zgłosił brak dostępnego Bash; statyczne policy checks przeszły                            |
| Spójność wersji                             | `PASS`                   | `npm run version:check`; wszystkie źródła 1.56.4                                               |
| Walidacja bundle cenników                   | `PASS`                   | jawny `--validate-only`; bez importu/zmian w PostgreSQL                                        |
| Unit/integration/e2e całej aplikacji        | `NOT RUN`                | nie łączono testów z domyślną konfiguracją `.env`; audyt nie uruchamiał modyfikacji DB         |
| Docker build/fresh install Linux            | `NOT RUN`                | brak potrzeby budowania/deployu w audycie; nie uruchamiano zdalnych workflow                   |
| PostgreSQL migracje, cenniki i restore live | `BLOCKED BY SCOPE`       | użytkownik zabronił operacji na bazie produkcyjnej; nie wykonano żadnego odczytu live          |
| `git diff` po utworzeniu raportu            | do sprawdzenia końcowego | raport jest jedynym dozwolonym nowym plikiem                                                   |

## 7. Lista bezpiecznego usunięcia

Początkowa klasyfikacja nie obejmowała `REMOVE_SAFE`; po nowym poleceniu użytkownika wykonano ograniczony cleanup starych artefaktów `tests/tmp/`. Usunięto 304 wpisy najwyższego poziomu: 299 plików oraz 5 katalogów; łącznie 332 pliki i 39 457 852 B. Katalog `tests/tmp/` pozostał pusty. Przed usunięciem potwierdzono: 0 śledzonych plików, wszystkie wpisy starsze niż 5 minut oraz brak procesów `node`; istniejący `tests/setup.ts:5-26` traktuje katalogi tymczasowe starsze niż 5 minut jako osierocone.

## 8. Checkpointy cleanupu C1–C6 — C1 częściowo wykonany, pozostałe wymagają zgody

| Checkpoint                                 | Zakres i pliki                                                                                                                                                                                                       | Ryzyko / zależności                                                                                                  | Wymagane testy i kryteria akceptacji                                                                                                                                           | Wycofanie                                                                                    |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| **C1 — pliki SQLite (częściowo wykonany)** | Usunięto 304 stare wpisy z `tests/tmp/` (299 plików root + 5 katalogów; łącznie 332 pliki/39 457 852 B); pozostawiono pusty katalog. Nietknięte: backup marker, legacy cenniki, archiwum audytowe i dane PostgreSQL. | Pozostałe archiwa/marker wymagają weryfikacji retencji i nowego, poprawnego backupu PG; nie wykonano operacji na DB. | Cleanup ograniczony do ignorowanych artefaktów testowych, 0 śledzonych plików; po operacji `tests/tmp` pusty.                                                                  | Test fixtures odtworzyć wyłącznie przez lokalny harness; nie przywracać danych do bazy live. |
| **C2 — przestarzałe skrypty**              | Potwierdzić brak exporterów/migracji SQLite i referencji dynamicznych; audytować `scripts/`, `prisma/`, `package.json`; nie ruszać guardów                                                                           | Możliwe ukryte odwołanie w instalatorze, historii operacyjnej lub recovery                                           | `postgresOnlySurface` PASS; graf zależności/statyczne wywołania; installer contracts i backup/restore checks                                                                   | Przywrócić zmiany przez osobny commit lub snapshot; nie ingerować w DB                       |
| **C3 — zależności i konfiguracje**         | Zweryfikować optional peer Prisma bez edycji lockfile; rozważyć jawny `ECC/` w `.dockerignore`; zachować `.gitignore` i `.dockerignore` patterny dla DB                                                              | Błędna edycja lockfile, regresja guardów, dołączenie embedded repo do obrazu                                         | `npm ls`/lockfile check bez sieci, Docker context listing, `postgresOnlySurface`, image scan potwierdzający brak SQLite payload w obrazie                                      | Przywrócić poprzedni `.dockerignore`/manifest; bez zmiany runtime bazy                       |
| **C4 — testy PostgreSQL**                  | Zachować testy odrzucające SQLite; cleanup starego `tests/tmp/` wykonano w C1. Jeśli testy ponownie wygenerują artefakty root, dodać bezpieczny cleanup po ustaleniu ich producenta.                                 | Nie usuwać fixture/diagnostyki ani nie dotykać nieizolowanej bazy.                                                   | Testy tylko na jawnym `POSTGRES_TEST_URL`; guardy zachowane; cleanup nie usuwał tracked files ani DB PG live. `npm run validate` pozostaje wymagane dla przyszłych zmian kodu. | Revert wyłącznie przyszłych zmian test/harness; żadnego resetu bazy dev/prod.                |
| **C5 — dokumentacja**                      | Zaktualizować aktualny status w `docs/errors-known.md`; poprawić `docs/plans/2026-11-two-os-installers.md`; oznaczyć ukończone stare plany/evidence historycznie; zachować ADR-y, changelog, deletion log i raporty  | Usunięcie historycznych dowodów albo błędne przedstawienie lokalnego cutoveru jako produkcyjnego                     | Linki lokalne, format, wersja, review zmian i zgodność z faktycznym kodem/HEAD                                                                                                 | Przywrócić pojedyncze dokumenty z lokalnego pre-change snapshot                              |
| **C6 — końcowa kontrola**                  | Powtórny inventory śledzonych i ignorowanych plików; skan runtime/Docker/CI; porównanie bundle i cenników dopiero na jawnie izolowanej kopii/po odrębnej zgodzie                                                     | Fałszywa pewność z samego grep albo pomylenie aktywnych cenników z historią                                          | `version:check`, `format`, `validate`, PG migrations + drift, restore roundtrip i pełny audit ceny/pozycji; bez produkcyjnego celu testowego                                   | Zatrzymać rollout; restore jedynie izolowanego backupu; live DB poza tą procedurą            |

## 9. Końcowa rekomendacja

Utrzymać PostgreSQL-only runtime i aktywne guardy. C1 wykonano częściowo: usunięto wyłącznie stare artefakty testowe z `tests/tmp/`. Zachować `data/backups/` i historyczne ADR-y. Przed kolejnym cleanupem najpierw porównać dane legacy cenników z zatwierdzonym bundle na bezpiecznych, nieprodukcyjnych danych oraz odtworzyć prawidłowy backup PostgreSQL; marker `.last-backup.json` pozostawić nietknięty do tej weryfikacji. C2–C6 pozostają planem do odrębnego zakresu.

### Ograniczenia i rozbieżności źródeł

- Audyt nie dowodzi poprawności istniejącej bazy ani pełnego cutoveru danych; repozytorium dowodzi tylko konfiguracji i ścieżek kodu.
- Kilka wcześniejszych wyników agentów rozbiegało się co do obecności dużego pliku `backup_*.sqlite`; niezależny odczyt katalogu w bieżącym worktree potwierdził, że pliku nie ma. Raport traktuje aktualny stan lokalnego systemu plików jako źródło prawdy.
- W repo wskazywano `docs/AUTONOMY_CONTRACT.md`, ale taki plik nie jest obecny w lokalnym `docs/`; zakres audytu tego nie zmieniał.
- W `docs/plans/_active-evidence.md:188` lokalny reviewer potwierdził credential disclosure w treści opisanej jako lokalne hasło testowe. Występuje w 19/27 lokalnych rewizji; zasięg zewnętrzny i bieżąca aktywność są niezweryfikowane. Wartość nie jest kopiowana do raportu. Nie wykonano rotacji ani redakcji.

## Dodatek A — pełny indeks śledzonych dopasowań

Poniżej podano wszystkie śledzone ścieżki i numery linii z lokalnego `git grep` dla terminów `sqlite`, `better-sqlite3`, `sqlite_master`, `sqlite_sequence`, `AUTOINCREMENT`, `last_insert_rowid`. Dopasowania zawierają historię i guardy; nie są listą użyć runtime. Pozycje te rozstrzyga tabela z sekcji 4.

| Ścieżka                                                                   | Linie                                                                                                                                                                                                     |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.dockerignore`                                                           | 35, 36, 37                                                                                                                                                                                                |
| `.editorconfig`                                                           | 21                                                                                                                                                                                                        |
| `.gitattributes`                                                          | 19                                                                                                                                                                                                        |
| `.gitignore`                                                              | 57, 58, 59, 64, 67, 132                                                                                                                                                                                   |
| `.hermes/plan-modernizacja.md`                                            | 33, 136, 222, 224                                                                                                                                                                                         |
| `.opencode/skills/prisma-patterns/SKILL.md`                               | 47                                                                                                                                                                                                        |
| `AGENTS.md`                                                               | 38, 40                                                                                                                                                                                                    |
| `CHANGELOG.md`                                                            | 1737, 1739, 2264                                                                                                                                                                                          |
| `CLAUDE.md`                                                               | 67, 70, 192                                                                                                                                                                                               |
| `docs/adr/ADR-001-sqlite.md`                                              | 1, 3, 12, 16, 20, 28, 30, 31                                                                                                                                                                              |
| `docs/adr/ADR-004-express-prisma.md`                                      | 3, 11, 32, 41                                                                                                                                                                                             |
| `docs/adr/ADR-012-single-node-sqlite.md`                                  | 1, 3, 4, 10                                                                                                                                                                                               |
| `docs/adr/ADR-015-sync-powiadomien.md`                                    | 6, 7, 24, 49                                                                                                                                                                                              |
| `docs/agents/backend.md`                                                  | 7, 13                                                                                                                                                                                                     |
| `docs/agents/database.md`                                                 | 7, 11, 36                                                                                                                                                                                                 |
| `docs/agents/metrics.md`                                                  | 83                                                                                                                                                                                                        |
| `docs/agents/testing.md`                                                  | 7, 12, 34                                                                                                                                                                                                 |
| `docs/AUDIT.md`                                                           | 3, 59, 70, 73, 92                                                                                                                                                                                         |
| `docs/audits/audyt-serwera-2026-08-29.md`                                 | 23, 33, 40, 69, 76, 160                                                                                                                                                                                   |
| `docs/audits/FULL-AUDIT-2026-10-19.md`                                    | 64                                                                                                                                                                                                        |
| `docs/audits/seed-studnie-audit-2026-07-05.md`                            | 10                                                                                                                                                                                                        |
| `docs/audits/SOK-AUDIT-2026-10-04.md`                                     | 35                                                                                                                                                                                                        |
| `docs/audits/SOK-FULL-AUDIT-2026-09-26.md`                                | 19, 31, 93                                                                                                                                                                                                |
| `docs/cutover/active-pricelists.md`                                       | 13                                                                                                                                                                                                        |
| `docs/DATABASE.md`                                                        | 22, 25, 73                                                                                                                                                                                                |
| `docs/DELETION_LOG.md`                                                    | 176, 190, 191                                                                                                                                                                                             |
| `docs/DEPLOYMENT.md`                                                      | 130, 132, 135                                                                                                                                                                                             |
| `docs/errors-known.md`                                                    | 3, 4, 34, 35, 48, 90, 107, 196                                                                                                                                                                            |
| `docs/instalacja-przenoszenie-systemu.md`                                 | 18                                                                                                                                                                                                        |
| `docs/PERF_BASELINE.md`                                                   | 4, 54, 101, 155, 198                                                                                                                                                                                      |
| `docs/plans/_active-evidence.md`                                          | 188, 193, 757                                                                                                                                                                                             |
| `docs/plans/2026-10-18-excel-optimization-plan-v7.md`                     | 70                                                                                                                                                                                                        |
| `docs/plans/2026-10-20-cenniki-centrum-p0.md`                             | 231, 340, 389, 390, 401, 423                                                                                                                                                                              |
| `docs/plans/2026-10-21-cenniki-panel-admina-plan.md`                      | 248, 339                                                                                                                                                                                                  |
| `docs/plans/2026-10-25-draft-l2-server-review.md`                         | 54                                                                                                                                                                                                        |
| `docs/plans/2026-10-25-plan-poprawy-po-audycie-struktury.md`              | 120                                                                                                                                                                                                       |
| `docs/plans/2026-11-two-os-installers.md`                                 | 59                                                                                                                                                                                                        |
| `docs/plans/archive/2026-08-02-blokada-usuwania-pz.md`                    | 49, 353                                                                                                                                                                                                   |
| `docs/plans/archive/2026-08-02-excel-krag-ot-naglowki-i-xss.md`           | 160                                                                                                                                                                                                       |
| `docs/plans/archive/2026-08-06-retencja-modeli-ml.md`                     | 36, 118, 163                                                                                                                                                                                              |
| `docs/plans/archive/2026-08-09-spojna-korekta-nazwy-aplikacji.md`         | 260, 292, 318, 324, 325, 327, 382, 388, 411                                                                                                                                                               |
| `docs/plans/archive/2026-08-11-wersjonowanie-cennikow-plan.md`            | 30                                                                                                                                                                                                        |
| `docs/plans/archive/2026-08-12-instrukcja-wdroznia-ai-ml-fix.md`          | 49, 66, 97, 102, 103, 146, 157, 189                                                                                                                                                                       |
| `docs/plans/archive/2026-08-12-raport-ai-ml-dashboard-instalacja.md`      | 61, 71                                                                                                                                                                                                    |
| `docs/plans/archive/2026-08-14-dokonczenie-modernizacji-8.2-8.3-audit.md` | 12, 14, 88, 105, 116, 123, 124, 203, 211, 226, 233, 259, 288, 418, 441, 462, 519, 528, 556                                                                                                                |
| `docs/plans/archive/2026-08-14-modernizacja-testy-stabilizacja.md`        | 180, 268                                                                                                                                                                                                  |
| `docs/plans/archive/2026-08-16-bezpieczny-update-produkcji.md`            | 16                                                                                                                                                                                                        |
| `docs/plans/archive/2026-08-16-plan-naprawy-audyt.md`                     | 27                                                                                                                                                                                                        |
| `docs/plans/archive/2026-08-18-atomiczny-zapis-cen-rollback.md`           | 42                                                                                                                                                                                                        |
| `docs/plans/archive/2026-09-01-architektura-10k.md`                       | 54, 199                                                                                                                                                                                                   |
| `docs/plans/archive/2026-09-02-audyt-wydajnosci-10k-readonly-plan.md`     | 206, 228                                                                                                                                                                                                  |
| `docs/plans/archive/2026-09-07-production-readiness-100-users.md`         | 15, 61, 92, 96, 147, 180, 196, 203, 284                                                                                                                                                                   |
| `docs/plans/archive/2026-09-11-ml-training-gate.md`                       | 11                                                                                                                                                                                                        |
| `docs/plans/archive/2026-09-12-atomicity-audit.md`                        | 31                                                                                                                                                                                                        |
| `docs/plans/archive/2026-09-12-backup-drill.md`                           | 11, 12, 16, 17                                                                                                                                                                                            |
| `docs/plans/archive/2026-09-12-synth-harness.md`                          | 18, 40                                                                                                                                                                                                    |
| `docs/plans/archive/2026-09-16-e2-e5-roadmap.md`                          | 18, 137                                                                                                                                                                                                   |
| `docs/plans/archive/2026-09-20-master-plan-ulepszen-sok-1.27.0.md`        | 38, 57, 98, 124, 224, 225, 353                                                                                                                                                                            |
| `docs/plans/archive/2026-09-25-open-code-review-integracja.md`            | 73                                                                                                                                                                                                        |
| `docs/plans/archive/2026-09-27-audit-v2-p0-p3-build-plan.md`              | 35, 82                                                                                                                                                                                                    |
| `docs/plans/archive/2026-09-29-audit-8-5-p1-p3-improvement-plan.md`       | 84                                                                                                                                                                                                        |
| `docs/plans/archive/2026-09-29-e0-checkpoint.md`                          | 22, 24                                                                                                                                                                                                    |
| `docs/plans/archive/2026-09-29-profesjonalizacja-sok-plan.md`             | 39                                                                                                                                                                                                        |
| `docs/plans/archive/2026-10-18-excel-optimization-plan-v4.md`             | 27, 38                                                                                                                                                                                                    |
| `docs/plans/archive/2026-10-18-excel-optimization-plan-v5.md`             | 28                                                                                                                                                                                                        |
| `docs/plans/archive/2026-10-18-excel-optimization-plan-v6.md`             | 37                                                                                                                                                                                                        |
| `docs/plans/archive/2026-10-18-excel-optimization-plan.md`                | 37, 95                                                                                                                                                                                                    |
| `docs/plans/archive/2026-11-04-migracja-postgresql.md`                    | 1, 26, 29, 35, 37, 40, 41, 43, 44, 46, 53, 55, 59, 61, 70, 90, 108, 122, 124, 126, 140, 152, 162, 169, 175, 184, 185, 187, 189, 213, 218, 227, 235, 243, 267, 273, 290, 293, 298, 300, 308, 312, 316, 322 |
| `docs/plans/archive/2026-11-windows-pg-installer.md`                      | 49                                                                                                                                                                                                        |
| `docs/plans/archive/AUDIT_AI.md`                                          | 85, 320                                                                                                                                                                                                   |
| `docs/plans/archive/AUDIT_TELEMETRY.md`                                   | 14, 50, 268, 278, 363, 365                                                                                                                                                                                |
| `docs/plans/archive/audit-matrix-p1-4.md`                                 | 26                                                                                                                                                                                                        |
| `docs/plans/archive/care-p0-checkpoints.md`                               | 9, 25, 95                                                                                                                                                                                                 |
| `docs/plans/archive/centrum-weryfikacja-adam-klos.md`                     | 9, 20, 21, 27, 28, 96                                                                                                                                                                                     |
| `docs/plans/archive/d1-production-drill.md`                               | 13, 19, 22, 27, 28, 38, 40, 48, 65, 71                                                                                                                                                                    |
| `docs/plans/archive/d1-restore-drill.md`                                  | 6, 8, 9                                                                                                                                                                                                   |
| `docs/plans/archive/e2-auth-audit.md`                                     | 305                                                                                                                                                                                                       |
| `docs/plans/archive/e3-perf.md`                                           | 73, 121, 122, 123, 159                                                                                                                                                                                    |
| `docs/plans/archive/e5-decision.md`                                       | 6, 10, 12, 38, 57                                                                                                                                                                                         |
| `docs/plans/archive/faza1-inwentaryzacja.md`                              | 9, 10, 12                                                                                                                                                                                                 |
| `docs/plans/archive/import-xlsx-kartoteka.md`                             | 62                                                                                                                                                                                                        |
| `docs/plans/archive/modernizacja-ui-cala-aplikacja.md`                    | 80                                                                                                                                                                                                        |
| `docs/plans/archive/opieka-nad-oferta.md`                                 | 6, 37                                                                                                                                                                                                     |
| `docs/plans/archive/plan-modernizacji-sok-8.0-9.0.md`                     | 28, 54, 132                                                                                                                                                                                               |
| `docs/plans/archive/prisma-only-pricing.md`                               | 6, 23, 56, 311, 680, 814, 832, 836, 839, 863, 865, 1005, 1033, 1052                                                                                                                                       |
| `docs/plans/archive/RAPORT_MODERNIZACJI.md`                               | 24, 68                                                                                                                                                                                                    |
| `docs/plans/archive/remediation-plan-2026-08-05.md`                       | 76, 138                                                                                                                                                                                                   |
| `docs/plans/archive/REPAIR_PLAN.md`                                       | 824                                                                                                                                                                                                       |
| `docs/plans/archive/skalowanie-kartoteki.md`                              | 23, 533, 536, 649                                                                                                                                                                                         |
| `docs/plans/archive/skalowanie-zlecenia.md`                               | 34, 538                                                                                                                                                                                                   |
| `docs/plans/archive/spojnosc-backend-frontend.md`                         | 15, 37                                                                                                                                                                                                    |
| `docs/plans/archive/wersjonowanie-cennikow-effectiveFrom-plan.md`         | 68                                                                                                                                                                                                        |
| `docs/plans/baseline-FINAL.json`                                          | 111, 118                                                                                                                                                                                                  |
| `docs/plans/excel-10k-rewrite-plan.md`                                    | 29                                                                                                                                                                                                        |
| `docs/plans/excel-naprawy-priorytet.md`                                   | 27, 61                                                                                                                                                                                                    |
| `docs/plans/opieka-monitoring-przypomnienia-p0.md`                        | 16                                                                                                                                                                                                        |
| `docs/plans/p1-audit-closeout.md`                                         | 38, 40                                                                                                                                                                                                    |
| `docs/plans/P7-ai-ml-transfer-center-plan.md`                             | 37                                                                                                                                                                                                        |
| `docs/plans/postgresql-pricelist-bundle.md`                               | 7, 20, 21, 35                                                                                                                                                                                             |
| `docs/VERSIONING.md`                                                      | 61                                                                                                                                                                                                        |
| `eslint.config.mjs`                                                       | 11                                                                                                                                                                                                        |
| `package-lock.json`                                                       | 14955, 14959                                                                                                                                                                                              |
| `playwright.config.ts`                                                    | 7                                                                                                                                                                                                         |
| `scripts/check-appname.cjs`                                               | 102                                                                                                                                                                                                       |
| `scripts/encoding-integrity.js`                                           | 29                                                                                                                                                                                                        |
| `scripts/migrate-diff-check.mjs`                                          | 36                                                                                                                                                                                                        |
| `tests/auditIntegrity.test.ts`                                            | 23, 25                                                                                                                                                                                                    |
| `tests/ci/e2eIsolation.test.ts`                                           | 50, 90                                                                                                                                                                                                    |
| `tests/offers/postgresCareSql.test.ts`                                    | 38                                                                                                                                                                                                        |
| `tests/offersPricelistStamp.test.ts`                                      | 367                                                                                                                                                                                                       |
| `tests/playwright/isolatedPostgres.cjs`                                   | 13                                                                                                                                                                                                        |
| `tests/playwright/postgresServer.cjs`                                     | 14                                                                                                                                                                                                        |
| `tests/prismaClient.requiresDatabaseUrl.test.ts`                          | 41, 58, 59                                                                                                                                                                                                |
| `tests/restoreGuards.test.ts`                                             | 15, 127                                                                                                                                                                                                   |
| `tests/scripts/checkDbPath.test.ts`                                       | 14, 37                                                                                                                                                                                                    |
| `tests/scripts/dockerEntrypoint.test.ts`                                  | 28                                                                                                                                                                                                        |
| `tests/scripts/postgresOnlySurface.test.cjs`                              | 34, 35, 64, 79                                                                                                                                                                                            |
| `tests/scripts/recoverFailedInitialMigration.test.cjs`                    | 18                                                                                                                                                                                                        |
| `tests/setupDbIsolation.ts`                                               | 22                                                                                                                                                                                                        |
| `tsconfig.frontend.json`                                                  | 21                                                                                                                                                                                                        |
| `tsconfig.json`                                                           | 26                                                                                                                                                                                                        |

## Dodatek B — pełna lista lokalnych plików DB z `tests/tmp/`

To historyczny inwentarz sprzed cleanupu, wykonany w celu identyfikacji usuniętych plików. Artefakty były ignorowane przez Git i nie stanowiły części commitów; bazy nie były otwierane ani odczytywane.

| Ścieżka                                             | Rozszerzenie |       B |
| --------------------------------------------------- | -----------: | ------: |
| `tests/tmp/fu-cycles-1793726692603-o9yhm2w261p.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793726702289-gdc4hzz18zq.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793726710003-j2n6d07s1pl.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793726721979-bkueftt2s0e.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793726729037-xdbvv21oqdb.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793726735147-1gbetc2rzvq.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793727027870-yxszf5ll7c.db`   |          .db |   24576 |
| `tests/tmp/fu-cycles-1793727043451-nr2ffa7xrts.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793727053970-92zckkddehq.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793727067947-e8gzls9c4vc.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793727076067-lo6lrku0yoj.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793727083974-ow7ra8y15n.db`   |          .db |   24576 |
| `tests/tmp/fu-cycles-1793728368166-37zar4bdklw.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793728373319-nm7fkgk6pne.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793728381491-ljcms7x06g.db`   |          .db |   24576 |
| `tests/tmp/fu-cycles-1793728395205-b4jszfskdpg.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793728405915-nt9xsyfy00i.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793728416002-rh8zudd193f.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793733074382-86aop3ch3hf.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793733080597-fchzinq3x6u.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793733088109-tv8bsr9qw7.db`   |          .db |   24576 |
| `tests/tmp/fu-cycles-1793733098962-xd2rbap6ch.db`   |          .db |   24576 |
| `tests/tmp/fu-cycles-1793733108351-8knrzcx82rp.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793733114321-k3jlwelfzz.db`   |          .db |   24576 |
| `tests/tmp/fu-cycles-1793733784117-xp2f2cr2f8p.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793733787388-jgmvie0cf0f.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793733797670-srs0yj4mb.db`    |          .db |   24576 |
| `tests/tmp/fu-cycles-1793733809088-f4r6pwle8ki.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793733817915-0j8z2di5gih.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793733827425-mi791u1u0k8.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793735726486-hz44ao9z5vf.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793735740613-k6nctqoo0e.db`   |          .db |   24576 |
| `tests/tmp/fu-cycles-1793735750484-ln5h6w22xob.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793735761300-pfvpan8mssd.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793735767913-pgeo9a3hbhi.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793735773811-c1xsd6lo23a.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793735998738-o24z02uic.db`    |          .db |   24576 |
| `tests/tmp/fu-cycles-1793736013520-nb0r6i0oi4.db`   |          .db |   24576 |
| `tests/tmp/fu-cycles-1793736023244-xt1ekv3wz4d.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793736037474-abulysm8xhh.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793736047576-ye5npk9oonq.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793736055639-wk9askxsx9.db`   |          .db |   24576 |
| `tests/tmp/fu-cycles-1793736351724-z0l9ybpey4p.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793736362117-931vqrdfvj.db`   |          .db |   24576 |
| `tests/tmp/fu-cycles-1793736371290-xukd2hnaxya.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793736382541-yccbulqlnbq.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793736392556-pc39ytpi56q.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793736399794-gd61uerxgna.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793737073117-k8tsqwyff.db`    |          .db |   24576 |
| `tests/tmp/fu-cycles-1793737088008-231j9dt6oj1.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793737099072-739lo57fyq9.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793737112589-m24vc2onrf7.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793737124310-3niuzu3b4fa.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793737132758-f3q3kbf1958.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793738609539-1hysrdqn1l5.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793738618092-i4m7rxtztqa.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793738626429-5qqv4tieim3.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793738637943-ncgtjnjwoyl.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793738645539-yxh16d9wxza.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793738652501-nb9r6kyqvg.db`   |          .db |   24576 |
| `tests/tmp/fu-cycles-1793739891263-b1qjg3k3ant.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793739902642-z6rtdf70eka.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793739911057-88jf6601jh4.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793739923927-6fxi06hrref.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793739934278-brloufze4u6.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793739941472-qj206mt2c9q.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793741233969-5micb6ckmbj.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793741235017-j1q1okduefi.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793741238791-yygkzv8rtwj.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793741253975-x7wjloo8ic.db`   |          .db |   24576 |
| `tests/tmp/fu-cycles-1793741267592-11vxe8zbwgak.db` |          .db |   24576 |
| `tests/tmp/fu-cycles-1793741277734-5nqwdj1i4ad.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793741574704-9upcqlqftk9.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793741579662-oypcjeicwkk.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793741591333-9yp7nsoklg.db`   |          .db |   24576 |
| `tests/tmp/fu-cycles-1793741604211-xnt3cpni7un.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793741614774-xa0ltupahx.db`   |          .db |   24576 |
| `tests/tmp/fu-cycles-1793741622942-izk9vycnxt.db`   |          .db |   24576 |
| `tests/tmp/fu-cycles-1793741973515-15es2dtxa3yg.db` |          .db |   24576 |
| `tests/tmp/fu-cycles-1793741975008-f2ll9nkbsnd.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793741983012-xchsph926k.db`   |          .db |   24576 |
| `tests/tmp/fu-cycles-1793741997968-1thdfcfdp8i.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793742008160-fr4dahj8mi5.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793742016535-fjiho6303lw.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793743599168-446q81uzh3f.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793743609208-rhvncq6ch2.db`   |          .db |   24576 |
| `tests/tmp/fu-cycles-1793743616642-oub0x36o1e.db`   |          .db |   24576 |
| `tests/tmp/fu-cycles-1793743628179-ssbfd43s8bk.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793743637722-2rmxxh7xzf.db`   |          .db |   24576 |
| `tests/tmp/fu-cycles-1793743646077-dsmw3ednj6g.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793804723415-dyphhuc45e4.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793804731833-mddma5p8e9d.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793804738704-thlh01zzvl.db`   |          .db |   24576 |
| `tests/tmp/fu-cycles-1793804748921-my873thxe.db`    |          .db |   24576 |
| `tests/tmp/fu-cycles-1793804757378-z6ff2wyuiu.db`   |          .db |   24576 |
| `tests/tmp/fu-cycles-1793804762200-gqo268s0qrt.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793805332680-5z5k7ha489t.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793805338696-9mnzbe1llj6.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793805348880-l81x8e0tpgi.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793805358072-upyftcgzhu.db`   |          .db |   24576 |
| `tests/tmp/fu-cycles-1793805364843-zwfe49n03bb.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793805371359-bilnixrsnnw.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793806102934-1z9tdltce6i.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793806110595-wy4qumyj4oo.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793806117671-s14owgs3k0s.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793806127567-54adsbzl7ka.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793806135811-gsav8okgkro.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793806141453-5s6pt2qi45b.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793815190823-edcniq7qzt.db`   |          .db |   24576 |
| `tests/tmp/fu-cycles-1793815194276-zv4wx0e1hu.db`   |          .db |   24576 |
| `tests/tmp/fu-cycles-1793815202945-6qobgv7oh7g.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793815216564-btv0liszz1t.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793815230402-t5akbmwcduc.db`  |          .db |   24576 |
| `tests/tmp/fu-cycles-1793815241529-wlp0iqfbsab.db`  |          .db |   24576 |
| `tests/tmp/fu-terminal-1793726692168.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793726695960.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793726702324.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793727028086.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793727038204.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793727047454.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793728368917.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793728375361.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793728382903.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793733075124.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793733079783.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793733085791.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793733784527.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793733788663.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793733796611.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793735724799.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793735725578.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793735731277.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793735998321.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793736004196.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793736014764.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793736350108.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793736350611.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793736351146.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793737072169.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793737076642.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793737085472.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793738610199.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793738616708.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793738624517.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793739891011.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793739897532.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793739904842.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793741236145.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793741244593.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793741253976.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793741575093.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793741580712.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793741590462.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793741975468.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793741981718.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793741990078.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793743598203.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793743599729.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793743606715.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793804723616.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793804729863.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793804736939.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793805332617.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793805334421.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793805341574.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793806103489.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793806109095.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793806115661.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793815191391.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793815193562.db`            |          .db |   24576 |
| `tests/tmp/fu-terminal-1793815200435.db`            |          .db |   24576 |
| `tests/tmp/fu-tie-1793725526412.db`                 |          .db |   20480 |
| `tests/tmp/fu-tie-1793725784333.db`                 |          .db |   20480 |
| `tests/tmp/fu-tie-1793726706588.db`                 |          .db |   20480 |
| `tests/tmp/fu-tie-1793727039735.db`                 |          .db |   20480 |
| `tests/tmp/fu-tie-1793727412241.db`                 |          .db |   20480 |
| `tests/tmp/fu-tie-1793728372238.db`                 |          .db |   20480 |
| `tests/tmp/fu-tie-1793728702302.db`                 |          .db |   20480 |
| `tests/tmp/fu-tie-1793733073931.db`                 |          .db |   20480 |
| `tests/tmp/fu-tie-1793733785331.db`                 |          .db |   20480 |
| `tests/tmp/fu-tie-1793735728767.db`                 |          .db |   20480 |
| `tests/tmp/fu-tie-1793736001289.db`                 |          .db |   20480 |
| `tests/tmp/fu-tie-1793736352146.db`                 |          .db |   20480 |
| `tests/tmp/fu-tie-1793737083249.db`                 |          .db |   20480 |
| `tests/tmp/fu-tie-1793737667211.db`                 |          .db |   20480 |
| `tests/tmp/fu-tie-1793738613050.db`                 |          .db |   20480 |
| `tests/tmp/fu-tie-1793739893685.db`                 |          .db |   20480 |
| `tests/tmp/fu-tie-1793741238819.db`                 |          .db |   20480 |
| `tests/tmp/fu-tie-1793741575606.db`                 |          .db |   20480 |
| `tests/tmp/fu-tie-1793741978110.db`                 |          .db |   20480 |
| `tests/tmp/fu-tie-1793742583190.db`                 |          .db |   20480 |
| `tests/tmp/fu-tie-1793743601466.db`                 |          .db |   20480 |
| `tests/tmp/fu-tie-1793744040371.db`                 |          .db |   20480 |
| `tests/tmp/fu-tie-1793804723242.db`                 |          .db |   20480 |
| `tests/tmp/fu-tie-1793805031992.db`                 |          .db |   20480 |
| `tests/tmp/fu-tie-1793805344162.db`                 |          .db |   20480 |
| `tests/tmp/fu-tie-1793805634749.db`                 |          .db |   20480 |
| `tests/tmp/fu-tie-1793806108684.db`                 |          .db |   20480 |
| `tests/tmp/fu-tie-1793806443986.db`                 |          .db |   20480 |
| `tests/tmp/fu-tie-1793806606850.db`                 |          .db |   20480 |
| `tests/tmp/fu-tie-1793815191057.db`                 |          .db |   20480 |
| `tests/tmp/fu-wins-1793725519406.db`                |          .db |   20480 |
| `tests/tmp/fu-wins-1793725776625.db`                |          .db |   20480 |
| `tests/tmp/fu-wins-1793726692508.db`                |          .db |   20480 |
| `tests/tmp/fu-wins-1793727028582.db`                |          .db |   20480 |
| `tests/tmp/fu-wins-1793727414266.db`                |          .db |   20480 |
| `tests/tmp/fu-wins-1793728369541.db`                |          .db |   20480 |
| `tests/tmp/fu-wins-1793728703364.db`                |          .db |   20480 |
| `tests/tmp/fu-wins-1793733075928.db`                |          .db |   20480 |
| `tests/tmp/fu-wins-1793733785668.db`                |          .db |   20480 |
| `tests/tmp/fu-wins-1793735726835.db`                |          .db |   20480 |
| `tests/tmp/fu-wins-1793735998680.db`                |          .db |   20480 |
| `tests/tmp/fu-wins-1793736352242.db`                |          .db |   20480 |
| `tests/tmp/fu-wins-1793737074051.db`                |          .db |   20480 |
| `tests/tmp/fu-wins-1793737668244.db`                |          .db |   20480 |
| `tests/tmp/fu-wins-1793738610784.db`                |          .db |   20480 |
| `tests/tmp/fu-wins-1793739891927.db`                |          .db |   20480 |
| `tests/tmp/fu-wins-1793741235252.db`                |          .db |   20480 |
| `tests/tmp/fu-wins-1793741576006.db`                |          .db |   20480 |
| `tests/tmp/fu-wins-1793741975179.db`                |          .db |   20480 |
| `tests/tmp/fu-wins-1793742583938.db`                |          .db |   20480 |
| `tests/tmp/fu-wins-1793743599987.db`                |          .db |   20480 |
| `tests/tmp/fu-wins-1793744040407.db`                |          .db |   20480 |
| `tests/tmp/fu-wins-1793804724027.db`                |          .db |   20480 |
| `tests/tmp/fu-wins-1793805033146.db`                |          .db |   20480 |
| `tests/tmp/fu-wins-1793805334260.db`                |          .db |   20480 |
| `tests/tmp/fu-wins-1793805629853.db`                |          .db |   20480 |
| `tests/tmp/fu-wins-1793806104338.db`                |          .db |   20480 |
| `tests/tmp/fu-wins-1793806444722.db`                |          .db |   20480 |
| `tests/tmp/fu-wins-1793806607458.db`                |          .db |   20480 |
| `tests/tmp/fu-wins-1793815193574.db`                |          .db |   20480 |
| `tests/tmp/jest-template.1793814535065.8948.sqlite` |      .sqlite | 1019904 |
| `tests/tmp/jest-worker-1.sqlite`                    |      .sqlite | 1019904 |
| `tests/tmp/jest-worker-10.sqlite`                   |      .sqlite | 1019904 |
| `tests/tmp/jest-worker-11.sqlite`                   |      .sqlite | 1019904 |
| `tests/tmp/jest-worker-12.sqlite`                   |      .sqlite | 1019904 |
| `tests/tmp/jest-worker-13.sqlite`                   |      .sqlite | 1019904 |
| `tests/tmp/jest-worker-14.sqlite`                   |      .sqlite | 1019904 |
| `tests/tmp/jest-worker-15.sqlite`                   |      .sqlite | 1019904 |
| `tests/tmp/jest-worker-16.sqlite`                   |      .sqlite | 1019904 |
| `tests/tmp/jest-worker-17.sqlite`                   |      .sqlite | 1019904 |
| `tests/tmp/jest-worker-18.sqlite`                   |      .sqlite | 1019904 |
| `tests/tmp/jest-worker-19.sqlite`                   |      .sqlite | 1019904 |
| `tests/tmp/jest-worker-2.sqlite`                    |      .sqlite | 1019904 |
| `tests/tmp/jest-worker-20.sqlite`                   |      .sqlite | 1019904 |
| `tests/tmp/jest-worker-21.sqlite`                   |      .sqlite | 1019904 |
| `tests/tmp/jest-worker-22.sqlite`                   |      .sqlite | 1019904 |
| `tests/tmp/jest-worker-23.sqlite`                   |      .sqlite | 1019904 |
| `tests/tmp/jest-worker-24.sqlite`                   |      .sqlite | 1019904 |
| `tests/tmp/jest-worker-25.sqlite`                   |      .sqlite | 1019904 |
| `tests/tmp/jest-worker-26.sqlite`                   |      .sqlite | 1019904 |
| `tests/tmp/jest-worker-27.sqlite`                   |      .sqlite | 1019904 |
| `tests/tmp/jest-worker-28.sqlite`                   |      .sqlite | 1019904 |
| `tests/tmp/jest-worker-29.sqlite`                   |      .sqlite | 1019904 |
| `tests/tmp/jest-worker-3.sqlite`                    |      .sqlite | 1019904 |
| `tests/tmp/jest-worker-30.sqlite`                   |      .sqlite | 1019904 |
| `tests/tmp/jest-worker-31.sqlite`                   |      .sqlite | 1019904 |
| `tests/tmp/jest-worker-4.sqlite`                    |      .sqlite | 1019904 |
| `tests/tmp/jest-worker-5.sqlite`                    |      .sqlite | 1019904 |
| `tests/tmp/jest-worker-53060-1.sqlite`              |      .sqlite | 1019904 |
| `tests/tmp/jest-worker-6.sqlite`                    |      .sqlite | 1019904 |
| `tests/tmp/jest-worker-7.sqlite`                    |      .sqlite | 1019904 |
| `tests/tmp/jest-worker-8.sqlite`                    |      .sqlite | 1019904 |
| `tests/tmp/jest-worker-9.sqlite`                    |      .sqlite | 1019904 |
| `tests/tmp/manual-prisma7.sqlite`                   |      .sqlite |       0 |
