# Zadanie: uzupełnienie dokumentacji S.O.K. na podstawie aktualnego stanu repozytorium

## Cel

Przeprowadź ograniczony, evidence-first przegląd dokumentacji S.O.K. i uzupełnij najważniejsze potwierdzone luki. Rezultatem ma być dokumentacja przydatna użytkownikom, administratorom i programistom, zgodna z kodem oraz istniejącymi źródłami prawdy.

Nie rozpoczynaj od przebudowy struktury dokumentacji. Repozytorium ma już nawigację w `docs/README.md`, audyt pokrycia w `docs/documentation-audit.md` oraz dokumenty SSoT dla architektury, API, bazy, wdrożenia, bezpieczeństwa, modułów i reguł biznesowych. Uzupełniaj te dokumenty; nowy dokument dodaj tylko wtedy, gdy nie ma właściwego miejsca w istniejącym układzie.

## Punkt odniesienia i źródła prawdy

1. Na początku zapisz branch, dokładny HEAD, status worktree i wersję aplikacji. Stan `main` jest punktem odniesienia dla opisu bieżącej aplikacji; nie zakładaj, że wcześniejszy SHA z dokumentacji nadal jest aktualny.
2. Stan kodu potwierdzaj w aktualnym checkoutcie: kodzie, konfiguracji, testach i wynikach komend. Historię Git wykorzystuj do inwentaryzacji wcześniejszych materiałów dokumentacyjnych, nie jako opis aktualnego runtime.
3. Nie zakładaj osobnej „Wersji Bazowej”. Dla każdego odzyskanego materiału historycznego podaj commit/tag i ścieżkę. Jeżeli źródła nie da się wskazać, oznacz ją jako niedostępną lub nierozstrzygniętą; nie odtwarzaj jej z pamięci ani domysłów.
4. Traktuj wcześniejsze audyty i plany jako hipotezy do ponownego sprawdzenia. W szczególności audyt wskazujący HEAD `5ab15ac0` jest snapshotem historycznym; odśwież jego twierdzenia względem HEAD ustalonego na początku pracy.
5. Każde istotne twierdzenie oznacz jako `FACT`, `VERIFIED`, `INFERRED`, `UNKNOWN` albo `TODO`. `VERIFIED` stosuj wyłącznie do procedur faktycznie wykonanych w opisanym środowisku.

## Zakres

Najpierw zweryfikuj, czy poniższe luki nadal istnieją na aktualnym HEAD, a następnie ustal ich priorytet:

- kompletność katalogu tras API: metoda, ścieżka, ochrona, walidator i kontrakt żądania/odpowiedzi tam, gdzie potwierdzają je route, schema, testy lub `/api/docs.json`;
- praktyczne instrukcje obsługi modułów i administracji, uzupełniające istniejący przewodnik, bez opisywania kroków, których nie potwierdza interfejs;
- aktualność instrukcji instalacji i wdrożenia oraz jawny status czystej instalacji Linux i produkcyjnego cutoveru;
- procedury backupu/odtworzenia i ograniczenia operacyjne; wartości RPO/RTO pozostaw jako `TODO` do czasu decyzji właściciela operacji.

Używaj istniejących źródeł SSoT, między innymi `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/DEPLOYMENT.md`, `docs/DEPLOY_UPDATE.md`, `docs/SECURITY.md`, `docs/user-guide/modules-and-workflows.md`, `docs/SYSTEM_INVARIANTS.md`, `docs/MONEY_ROUNDING.md` oraz dokumentów wskazanych w `docs/README.md`. Przed dopisaniem kontraktu API sprawdź odpowiedni router, walidator i testy.

## Ograniczenia

- Zmieniaj wyłącznie dokumentację bezpośrednio związaną z zakresem oraz ewentualny pomocniczy checker dokumentacji, jeśli wykażesz, że jest potrzebny.
- Nie zmieniaj kodu aplikacji, API, logiki biznesowej, schematu ani migracji bazy, danych użytkowników, sekretów ani konfiguracji produkcyjnej.
- Nie łącz się z produkcyjną bazą i nie wykonuj migracji, seedów, restartów, wdrożeń, backupu ani restore na środowisku live.
- Nie usuwaj istniejących dokumentów i nie przenoś ich do archiwum bez uzasadnionej, potwierdzonej potrzeby.
- PostgreSQL 18 jest jedyną wspieraną bazą runtime. Nie dokumentuj SQLite jako alternatywnego wspieranego silnika.
- Nie utożsamiaj testu polityk/instalatora z pełnym testem instalacji na czystym Linuxie. Nie utożsamiaj lokalnej walidacji, statusu CI ani dokumentacji deploymentu z produkcyjnym cutoverem.
- Nie wymyślaj wymagań sprzętowych, portów, payloadów, ról, procedur ani rezultatów testów. Braki oznaczaj jawnie.
- Nie nadpisuj zmian użytkownika ani nie włączaj do zakresu niepowiązanych poprawek.

## Etapy pracy

### D0 — stan i inwentaryzacja

- Zapisz branch, HEAD, status worktree i wersję.
- Zinwentaryzuj dokumenty bieżące w obrębie zakresu oraz ich odnośniki z `docs/README.md`.
- Przeszukaj historię Git dla dokumentacji powiązanej z zakresem. Dla istotnych kandydatów zapisz ścieżkę, commit/tag, temat i decyzję: zachować, zaktualizować, scalić, odnotować jako historyczny albo pominąć z uzasadnieniem.
- Nie wykonuj destrukcyjnych operacji Git.

### D1 — odświeżenie stanu dokumentacji

- Porównaj ustalenia `docs/documentation-audit.md` z aktualnym kodem, konfiguracją i testami.
- Skoryguj nieaktualne SHA, wersję, datę weryfikacji, statusy i linki tylko na podstawie dowodów z bieżącej pracy.
- Zachowaj ograniczenia wcześniejszych weryfikacji oraz rozdziel repozytorium od zewnętrznego środowiska produkcyjnego.

### D2 — API i przepływy użytkownika

- Porównaj istotne trasy z routerami, walidatorami, middleware/autoryzacją i testami. Udokumentuj wyłącznie potwierdzone pola i zachowanie; jawnie wskaż niepełne pokrycie.
- Uzupełnij przewodnik modułów o potwierdzone procedury użytkownika i administratora. Odsyłaj do istniejących opisów cen, Excela, importu/eksportu i inwariantów zamiast kopiować reguły.
- Jeżeli pełne przejście UI/E2E jest niedostępne, oznacz brak jako `UNKNOWN`/`TODO` i wskaż potrzebny dostęp lub źródło.

### D3 — wdrożenie i utrzymanie

- Zweryfikuj istniejące instrukcje Windows/Linux/Docker, wymagania, konfigurację PostgreSQL, aktywny pakiet cenników, aktualizację, rollback i backup/restore względem skryptów oraz konfiguracji.
- Dla nieprzetestowanych środowisk oznacz status jako `UNKNOWN`; zapisz dokładnie, jaki izolowany host, dostęp lub decyzja jest potrzebna do weryfikacji.
- Nie ustalaj RPO/RTO za właściciela operacji. Zapisz `TODO` i właściciela decyzji, jeśli jest znany.

### D4 — kontrola końcowa i raport

- Zweryfikuj nowe twierdzenia z kodem/config/testami, lokalne linki Markdown i nawigację z `docs/README.md`.
- Sprawdź format i diff zmienionych plików. Uruchamiaj tylko adekwatne, bezpieczne kontrole dokumentacji; nie deklaruj uruchomienia testów, których nie wykonano.
- Zaktualizuj audyt dokumentacji i ten plan o zakres, dowody, kontrole, ograniczenia oraz otwarte pozycje. Nie oznaczaj całego obszaru jako kompletnego, jeśli sprawdzono tylko próbkę.

## Kryteria odbioru

1. Stan początkowy jest zapisany z aktualnym SHA, branch i wersją.
2. Materiały historyczne z zakresu mają wskazane źródła Git lub są jawnie oznaczone jako nierozstrzygnięte.
3. Audyt nie przedstawia historycznego HEAD jako bieżącego stanu.
4. Zaktualizowane dokumenty zachowują istniejącą strukturę i prowadzą do właściwych SSoT.
5. Każdy nowy kontrakt, instrukcja i status weryfikacji ma potwierdzone źródło albo oznaczenie `INFERRED`, `UNKNOWN` lub `TODO`.
6. Czysta instalacja Linux, produkcyjny cutover, restore drill oraz RPO/RTO nie są przedstawione jako potwierdzone bez odpowiedniego testu lub decyzji.
7. Raport końcowy podaje zmienione pliki, materiały historyczne, kontrole wykonane i pominięte, nierozstrzygnięte braki oraz status w zakresie faktycznie zweryfikowanym.
8. Repozytorium nie zawiera zmian kodu ani operacji na produkcji wynikających z tego zadania.

## Raport końcowy

Podaj krótko:

- stan początkowy i końcowy Git;
- dokumenty zmienione oraz historyczne źródła uwzględnione w inwentaryzacji;
- zakres sprawdzonych tras/procedur i dowody użyte do ich potwierdzenia;
- wykonane kontrole z wynikiem oraz pominięte kontrole z powodem;
- otwarte `UNKNOWN`/`TODO`, w tym dostęp potrzebny do testów środowiskowych i decyzję RPO/RTO;
- status: `GOTOWE`, `GOTOWE Z UWAGAMI`, `CZĘŚCIOWO GOTOWE` albo `ZABLOKOWANE`, ograniczony do rzeczywiście wykonanego zakresu.

Nie wykonuj commitu ani pushu w ramach tego zadania. Commit dokumentacji wymaga przejścia bram repozytorium; push wymaga osobnego, jawnego GO na dokładny `remote/branch`.

## Checkpoint wykonania — 2026-11-07

- **Punkt odniesienia:** `main`, HEAD `fe8bbb3bcba36304e355d37051e4afb310c1f143`, wersja `1.56.6`. Worktree początkowo zawierał wyłącznie ten nieśledzony plan zadania.
- **Zmienione dokumenty:** `docs/documentation-audit.md`, `docs/README.md`, `docs/API.md`, `docs/OPIEKA.md`, `docs/user-guide/modules-and-workflows.md`.
- **API:** statycznie policzono 205 literalnych rejestracji tras. W katalogu API dodano trzy pominięte odczyty Opieki i poprawiono uwagę o publicznym wylogowaniu. W instrukcji Opieki skorygowano parametry kolejki i dopisano potwierdzone query fields. Liczniki źródła i dokumentacji nie stanowią porównania unikalnych tras z powodu aliasów/mountów.
- **Świeżość:** indeks `docs/README.md` zweryfikowano pod kątem lokalnych celów linków. Audyt starego SHA oznaczono jako historyczny; metadane przewodnika modułów nie sugerują pełnej weryfikacji na aktualnym HEAD.
- **Kontrole:** `npm run format`, `npm run version:check`, `npm run validate`, Prettier `--check` oraz `git diff --check` PASS. Walidacja użyła świeżej, izolowanej bazy PostgreSQL 18 `sok_test`: 586 suite’ów PASS, 2 SKIP; 5817 testów PASS, 4 SKIP. `prices:verify` prawidłowo pominął pusty schemat.
- **Ograniczenia i otwarte kwestie:** pełny semantyczny przegląd wszystkich tras API i szczegółowa weryfikacja procedur UI/E2E pozostają otwarte. Czysta instalacja Linux, produkcyjny cutover i RPO/RTO pozostają `UNKNOWN`/`TODO`. Dla wskazanego SHA GitHub Actions o 12:12 UTC: trzy check runs zakończone sukcesem, `Test (Jest)` nadal `in_progress`.
- **Bezpieczny zakres:** nie wykonano połączeń ani operacji na produkcyjnej bazie, seedów, restartu, wdrożenia ani restore. Migracje uruchomiły się wyłącznie w izolowanych schematach testowych. Commit/push dokumentacji są osobną, późniejszą operacją.
- **Status:** `CZĘŚCIOWO GOTOWE` — poprawiono potwierdzone niezgodności i odświeżono zakres/status audytu; otwarte obszary pozostają jawnie oznaczone.
