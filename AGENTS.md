# WITROS Oferty PV — Konwencje i Instrukcje dla Agenta AI (v2)

Niniejszy dokument stanowi uniwersalny zestaw reguł i wytycznych dla każdego modelu AI (OpenCode, DeepSeek, Claude, Cursor itp.) pracującego nad projektem WITROS Oferty PV.

### Przełączanie Między Modelami i Aplikacjami (Multi-Agent/Multi-Model)

Projekt wspiera płynne przełączanie się dewelopera między różnymi aplikacjami i modelami. Wszyscy agenci muszą stosować się do poniższych wytycznych dotyczących koegzystencji:

1. **Adaptacja do środowiska uruchomieniowego (Aplikacje)**:
    - **Cursor / Roo Code / Cline**: Korzystaj z wbudowanych narzędzi IDE do precyzyjnej edycji plików (`replace_file_content`, `apply_diff`). Zawsze sprawdzaj błędy lintera wyświetlane bezpośrednio w środowisku.
    - **Claude Code / Gemini CLI / Codex CLI**: Wykorzystuj interaktywny terminal i wbudowane polecenia. Pamiętaj o respektowaniu pytań o uprawnienia do uruchamiania poleceń i odczytu plików.
    - **Aider**: Twórz precyzyjne commity i opisuj zmiany w historycznych wątkach. Pozostaw Aiderowi automatyczne zarządzanie git flow, ale upewnij się, że opisy commitów są zgodne z sekcją _Conventional Commits_.
2. **Dostosowanie do możliwości i przełączania modeli (DeepSeek, Qwen, GPT, Claude, Kimi, MiniMax itp.)**:
    - **Przełączanie modeli w locie**: Deweloper może zmienić model w trakcie konwersacji (np. z powodu limitów tokenów, kosztów lub zmiany stopnia trudności zadania). Każdy model po załadowaniu musi przeanalizować dotychczasowy przebieg czatu, odnaleźć pliki pomocnicze (`task.md`, `implementation_plan.md`) i podjąć pracę od ostatniego stabilnego stanu bez zapytań o powtórzenie kontekstu. Poprzedni model mógł mieć inną datę odcięcia wiedzy (knowledge cutoff) lub specyfikę – nie należy traktować jego stwierdzeń o nim samym jako własnych instrukcji systemowych.
    - **Szybkie/Mniejsze modele (np. DeepSeek-Flash, Qwen, Kimi, MiniMax)**: Ze względu na mniejszą precyzję logiczną w bardzo długim kontekście, muszą bezwzględnie pilnować zakazu stosowania placeholderów (nie skracać kodu) oraz przeprowadzać częstszą weryfikację składni (`node -c`, `npm run typecheck`).
    - **Zaawansowane modele (np. Claude, GPT-5, Gemini 3.5)**: Mają za zadanie kontrolować architekturę (SRP, DRY) i przestrzeganie ADR. Dodatkowo, w przypadku przejęcia sesji po mniejszym modelu, mają obowiązek przeanalizować i zrefaktoryzować kod wprowadzony przez poprzednika pod kątem potencjalnych błędów typowania TypeScript, obsługi błędów (silent fail) i niechlujnych konstrukcji.
3. **Spójność formatowania (Format SSoT)**:
    - Niezależnie od tego, która aplikacja i model edytuje kod, przed zakończeniem pracy **zawsze** uruchom `npm run format`. Zapobiega to powstawaniu chaosu w formatowaniu kodu (Prettier) i utrzymuje czysty, czytelny dla ludzi git diff.
    - Wszystkie aplikacje i modele muszą respektować plik `.prettierrc` i reguły lintera, nie nadpisując ich własnymi ustawieniami domyślnymi.

---

## 1. Stack Technologiczny i Architektura

Aplikacja jest zbudowana z podziałem na backend i frontend (SPA oparte na iframe'ach):

- **Backend**: TypeScript + Express + Prisma + SQLite (`server.ts`, katalogi `src/`, `scripts/`, `tests/`).
- **Frontend**: Czysty Vanilla JS (bez frameworków SPA), Vite jako dev server (`build:frontend`). Kod modułów znajduje się w `public/js/rury/` oraz `public/js/studnie/`.
- **SPA (Single Page Application)**: Plik `app.html` jest jedynym punktem wejścia (entry point). Moduły (`studnie.html`, `rury.html`) są ładowane jako iframe wewnątrz `app.html`.

- **Kompilacja/Build**: TypeScript kompiluje wyłącznie katalogi `src/**`, `server.ts`, `scripts/**` oraz `tests/**`. Pliki w katalogu `public/` są wykluczone z kompilacji `tsc` oraz sprawdzania `eslint`.

### Decyzje Architektoniczne (ADR)

Szczegółowe opisy decyzji projektowych znajdują się w `docs/adr/`:

- **ADR-001**: SQLite jako produkcyjna baza danych.
- **ADR-002**: Vanilla JS SPA (architektura bez frameworka frontendowego).
- **ADR-003**: Vite jako bundler frontendu.
- **ADR-004**: Express + Prisma na backendzie.

---

## 2. Filozofia Pracy i Zachowanie Agenta (Proaktywność i Odpowiedzialność)

Poniższe reguły określają, jak agent powinien wchodzić w interakcję z kodem i użytkownikiem:

### Proaktywne Działanie i Narzędzia

- **Narzędzia tylko do odczytu**: Narzędzia wyszukujące i odczytujące dane (wyszukiwanie w sieci, czytanie plików, grep) stosuj **od razu**, gdy są potrzebne do wykonania zadania, bez pytania użytkownika o zgodę.
- **Obsługa niejasności**: Jeśli żądanie użytkownika jest niejednoznaczne lub brakuje w nim szczegółów, wybierz najbardziej logiczne, domyślne rozwiązanie zgodne z architekturą projektu. Krótko opisz swoje założenie w odpowiedzi i przejdź do realizacji. Unikaj zadawania pytań doprecyzowujących, chyba że kontynuowanie pracy bez nich groziłoby poważnym błędem lub stratą czasu.
- **Reakcja na błędy**: Gdy popełnisz błąd w kodzie, przyznaj się do niego rzeczowo i przejdź bezpośrednio do jego naprawienia. Unikaj nadmiernych, wylewnych przeprosin (bądź profesjonalny i skupiony na rozwiązaniu problemu).
- **Zasada "Myśl Krok po Kroku" (Chain of Thought)**: Modele OpenCode/DeepSeek działają znacznie lepiej, gdy analizują kod przed jego zapisaniem. Zawsze sformułuj krótki, logiczny plan działania w myślach lub w odpowiedzi przed edycją plików.
- **NIGDY nie używaj placeholderów**: Szybsze modele mają tendencję do skracania generowanego kodu poprzez komentarze typu `// ... reszta kodu bez zmian` lub `/* TODO: reszta logiki */`. **Zabrania się** stosowania takich praktyk. Każda modyfikacja pliku musi dostarczać kompletny, w pełni poprawny i gotowy do uruchomienia kod.
- **Weryfikacja składni (Syntax Checking)**: Zawsze po modyfikacji kodu zweryfikuj go odpowiednią komendą: dla backendu uruchom `npm run typecheck`, a dla kodu JS w katalogu `public/js/` wykonaj lokalnie `node -c <nazwa_pliku>`.

### Czystość i Jakość Kodu (Clean Code)

- **Zasada DRY (Don't Repeat Yourself)**: Nigdy nie powielaj logiki. Kod występujący częściej niż 2 razy wydziel do osobnej funkcji, modułu, klasy lub pliku pomocniczego (utils).
- **Zasada SRP (Single Responsibility Principle)**: Każdy moduł, klasa i funkcja odpowiada za **jedną** rzecz. Oddzielaj logikę pobierania danych, walidacji, przetwarzania i renderowania UI. Logika biznesowa musi być odseparowana od warstwy widoku (UI).
- **Ograniczenia rozmiaru kodu (zalecenia, nie sztywne reguły)**:
    - Funkcje: preferowane do około **100–150 linii**.
    - Klasy: preferowane do około **500–800 linii**.
    - Pliki: preferowane do około **1000–1500 linii**.
- **Zasady**:
    - Nie dziel funkcji, klas ani plików wyłącznie ze względu na liczbę linii.
    - Najpierw oceniaj spójność odpowiedzialności (SRP), a dopiero później rozmiar.
    - Jeśli wydzielenie pogarsza czytelność, nadmiernie zwiększa liczbę parametrów lub utrudnia zrozumienie przepływu — pozostaw w jednej całości.
    - Dopuszczalne są większe jednostki, jeśli realizują jeden logiczny proces, a podział byłby sztuczny.
    - Refaktoryzuj tylko wtedy, gdy faktycznie poprawia czytelność, testowalność lub reuse.
    - **Najważniejsze:** spójny, czytelny kod > sztuczne przestrzeganie limitów linii.
- **Ograniczenie zagnieżdżeń**: Maksymalnie **3 poziomy** zagnieżdżenia kodu. Stosuj _early return_, _guard clauses_ oraz wydzielanie bloków do osobnych funkcji pomocniczych.
- **Jasne Nazewnictwo**:
    - Funkcje: czasownik + rzeczownik (np. `createUser`, `calculateTotalPrice`).
    - Zmienne: rzeczownik opisujący dane (np. `userList`, `productPrice`).
    - Boolean: przedrostek sugerujący stan logiczny (np. `isLoggedIn`, `hasAccess`, `canEdit`).
- **Czytelność ponad przedwczesną optymalizację**: Kod powinien być prosty i łatwy do zrozumienia dla człowieka. Unikaj nadmiernie skomplikowanych skrótów myślowych i niepotrzebnych abstrakcji (KISS).

---

## 3. Konwencje Deweloperskie

### Język i Dokumentacja

- **Komunikacja z użytkownikiem**: Zawsze w języku **polskim** (odpowiedzi, plany, wyjaśnienia).
- **Komentarze w kodzie, commity, CHANGELOG**: Zawsze w języku **polskim**.
- **Nazewnictwo w kodzie**: Identyfikatory, klasy, zmienne, funkcje, klucze API pisz w języku **angielskim**.

### Wersjonowanie i Release Flow (Single Source of Truth)

- **VERSION**: Plik tekstowy `VERSION` w głównym katalogu projektu jest jedynym źródłem prawdy o aktualnej wersji.
- Plik `package.json` musi posiadać dokładnie tę samą wersję co plik `VERSION`. Aktualizacja wersji odbywa się automatycznie poprzez narzędzie `standard-version`.
- **Release Flow**:
    1. Pracuj nad zadaniem i twórz commity zgodnie z konwencją _Conventional Commits_.
    2. Gdy zmiany są gotowe do wydania wersji produkcyjnej, uruchom odpowiednie skrypty:
        ```bash
        npm run release          # Automatyczny dobór patch/minor/major na bazie commitów
        npm run release:patch    # Wymuszenie wersji patch
        npm run release:minor    # Wymuszenie wersji minor
        npm run release:major    # Wymuszenie wersji major
        npm run release:dry      # Podgląd zmian w changelogu bez ich zapisywania
        ```
    3. Release automatycznie wykonuje:
        - Podbicie `VERSION` i `package.json` (przez `standard-version`)
        - **Cache-bust assetów** — skrypt `scripts/auto-cache-bust.mjs` (przez hook `postbump`) podmienia wszystkie `?v=` w HTML (w tym `public/templates/*.html`) na nową wersję
        - Generowanie `CHANGELOG.md`
        - Commit `chore(release): X.Y.Z` + tag `vX.Y.Z`
    4. Wyślij tag na repozytorium zdalne: `git push --follow-tags`.
- **Nigdy nie taguj gita ręcznie!** Wszystko obsługuje `npm run release`. Po zmianie wersji zrestartuj backend (`npx ts-node-dev ./server.ts`).
- **Nie zmieniaj ręcznie parametrów `?v=` w HTML** — cache-bust jest synchronizowany z `VERSION` tylko podczas release.
- **Pre-push validation**: Husky `pre-push` sprawdza `npm run version:check` (blokuje push przy niespójnej wersji) oraz `typecheck` + testy.

### Punkty Wejścia i SPA (Single Page Application)

- Moduły aplikacji (np. `studnie.html`, `rury.html`) osadzane są w tagu `iframe` wewnątrz pliku głównego `app.html`. Router w `app.html` automatycznie ukrywa nagłówki osadzonych stron.
- Każdy moduł HTML musi posiadać skrypt przekierowujący (redirect) do `app.html#/<nazwa_modułu>` w przypadku bezpośredniego otwarcia pliku modułu w przeglądarce.
- Stopka (`<footer>`) powinna być usunięta z poszczególnych modułów – informacja o wersji systemu wyświetlana jest wyłącznie w toolbarze strony głównej `app.html`.

### Formaty i Styl Kodowania

- Formatowanie: używaj Prettier (pojedyncze cudzysłowy `'`, zawsze średniki `;`, brak tabulatorów - wcięcia spacjami).
- Kod frontendowy w `public/js/` **nie** jest sprawdzany przez lintery ani TypeScript. Weryfikuj go ręcznie i za pomocą komendy `node -c <nazwa_pliku>` w celu sprawdzenia składni.
- Klasyczne zmienne globalne: wszystkie globalne helpery na frontendzie rejestruj jawnie na obiekcie `window` (np. na końcu pliku: `window.myHelper = myHelper;`).
- Po każdym dynamicznym wstrzyknięciu kodu HTML zawierającego ikony Lucide (atrybuty `data-lucide`) wywołaj funkcję inicjalizującą: `lucide.createIcons({root: container})`.
- Zapobieganie XSS: Przy interpolacji ciągów znaków do `innerHTML` zawsze używaj funkcji `escapeHtml(str)`.
- Cache-busting: Wszystkie parametry `?v=` w plikach HTML (w tym `public/templates/*.html`) są automatycznie synchronizowane z `VERSION` podczas release (hook `postbump` w `scripts/auto-cache-bust.mjs`). **Nie edytuj ręcznie** parametrów `?v=` w HTML.

### Kodowanie polskich znaków (encoding policy)

Projekt stosuje jednolite kodowanie dla wszystkich plików tekstowych:

| Typ pliku                          | Kodowanie           | Uwagi                                              |
| ---------------------------------- | ------------------- | -------------------------------------------------- |
| `.ts`, `.js`, `.mjs`, `.cjs`       | **UTF-8 (bez BOM)** | Standard dla Node.js/TypeScript                    |
| `.html`, `.css`, `.json`           | **UTF-8 (bez BOM)** | Standard webowy                                    |
| `.md`, `.txt`                      | **UTF-8 (bez BOM)** | Dokumentacja                                       |
| `.sh`, `.ps1`                      | **UTF-8 (bez BOM)** | Skrypty powłoki                                    |
| `.bat`, `.cmd`                     | **ASCII-only**      | Brak polskich znaków — cmd.exe nie obsługuje UTF-8 |
| `.yaml`, `.yml`, `.sql`, `.prisma` | **UTF-8 (bez BOM)** | Pliki konfiguracyjne i migracje                    |

**Zasady:**

- W plikach `.bat` NIE używaj polskich znaków (ąćęłńóśźż) ani znaków spoza ASCII (np. `—` em dash). Zastąp je odpowiednikami ASCII (`-` zamiast `—`, `l` zamiast `ł`, `s` zamiast `ś` itp.).
- We wszystkich pozostałych plikach używaj swobodnie polskich znaków w UTF-8.
- Unikaj BOM (Byte Order Mark) na początku plików UTF-8 — może powodować problemy z narzędziami Node.js i konsolą.
- Weryfikacja: `npm run encoding:check` (jeśli skrypt istnieje) lub ręcznie przez `node -c` dla plików JS.

---

## 4. Logika Domenowa i Wdrożenie Szczegółowe

### Moduł: Rury

- **Sortowanie (krok 3 oraz zakładka Oferta)**:
    - Logika ta jest zdublowana w dwóch plikach: `offerItems.js:578-635` (pełna tabela z podnagłówkami) oraz `offerSummaryTab.js:111-153` (tabela uproszczona, bez podnagłówków). Dbaj o to, by zmiany w logice sortowania były nanoszone w obu miejscach równolegle.
    - Kategorie są sortowane według kolejności w tablicy `CATEGORIES`:
      `Rury Betonowe` → `Żelbetowe KL.A` → `Żelbetowe KL.S` → `Duże Żelbetowe II` → `Rury Jajowe Betonowe` → `Rury Jajowe Żelbetowe` → `Akcesoria PEHD` → `Uszczelki` → `Zabezpieczenie transportu`.
    - Średnice są sortowane numerycznie. Jeśli `getProductDiameter` zwraca `null`, pobierz średnicę z ID produktu: `productId.split('-')[4]` pomnożone przez 100.
    - W obrębie tej samej kategorii i średnicy, produkty z bosym końcem (Bosy-Bosy) są pozycjonowane jako pierwsze, a następnie sortowane rosnąco po długości (`lengthM`).
- **Struktura Tabeli**:
    - Krok 5: Funkcja `updateRuryOrderSummary` kopiuje zawartość z `#offer-items-body` do `#order-items-body`. Tabela jest edytowalna tylko w trybie edycji zamówienia (`orderEditMode`).
    - Kolumny tabeli są generowane dynamicznie przy użyciu `buildRuryColgroup(extraCols)` (13 kolumn w Kroku 3, 9-11 w zakładce Oferta).
    - Wyrównanie: Lp oraz Nazwa do lewej (LEFT), wartości liczbowe do prawej (RIGHT) z klasą `.rury-col-num` (czcionka monospaced tabular-nums).
- **CSS i Interakcje**:
    - Przyciski PEHD must mieć klasę `.pehd-btn` (unikać stylów inline).
    - Akcje PEHD oraz przycisk usuwania muszą być widoczne i aktywne zawsze (nawet jeśli oferta jest zablokowana).
    - Spinner w polach typu `number` musi być ukryty za pomocą CSS.
- **AutoAdded**:
    - Nowo dodawane elementy muszą mieć unikalne identyfikatory generowane według wzorca: `item.uid = 'rur_' + Date.now() + '_' + Math.random()...`.

### Moduł: Studnie

- **Sortowanie oferty**: Sortowanie odbywa się wyłącznie numerycznie po wartości DN (`parseInt(a.well.dn) - parseInt(b.well.dn)`). Studnie oznaczane jako "styczna" trafiają na sam koniec (`Infinity`).
- Brak grupowania według kategorii w tabeli oferty (plik `offerManager.js`).
- **Tryb zamówienia**: Wykorzystuje flagę `orderEditMode` oraz obiekt `originalSnapshot`. Tabela zawiera dodatkowe kolumny porównawcze ("Cena z oferty", "Różnica").
- **Układ strony (Layout)**: Trójkolumnowy grid (wizualizacja/diagram | konfigurator | lista studni) z responsywnym dopasowaniem za pomocą funkcji `clamp()` oraz `minmax(0, 1fr)`.

### Import i Eksport (Kartoteka)

- Logika znajduje się w katalogu `public/js/import-export/` oraz pliku `public/js/sales/pvImportExportToolbar.js`.
- Moduł importu/eksportu jest aktywowany flagą funkcjonalną (feature flag) `feature_import_export_enabled` w tabeli bazy danych `settings` (domyślnie włączona). Toolbar inicjalizuje się w `pvSalesUi.js:307`.
- Nowe funkcjonalności importu/eksportu **nie mogą** modyfikować kluczowych plików rdzenia systemu: `offerCrud.js`, `offerManager.js`, `offerItems.js`, `wizard.js`, `router.js`.
- Eksport do formatu XLSX opiera się na 12 wspólnych kolumnach. Kolumna `NR_STUDNI` w przypadku modułu rur przechowuje typ wykładziny PEHD, natomiast dla modułu studni – nazwę własną studni.

---

## 5. Baza Znanych Błędów (Rozwiązania i Zabezpieczenia)

Zawsze sprawdzaj kod pod kątem występowania poniższych znanych problemów:

| #   | Problem                                      | Przyczyna                                                                                                                                                      | Rozwiązanie / Fix                                                                                                                                                           |
| --- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Seed timeout SQLite**                      | Zbyt duża liczba produktów do wgrania na raz (824 produkty).                                                                                                   | Wprowadzono podział na paczki (chunk 25 pozycji na transakcję), ustawiono parametr `busy_timeout=30000` i sekwencyjną inicjalizację bazy.                                   |
| 2   | **SQLITE_BUSY (Race condition)**             | Równoległe wykonywanie asynchronicznych funkcji IIFE zapisujących do bazy.                                                                                     | Zastąpiono IIFE standardowymi funkcjami i wywoływaniem ich sekwencyjnie za pomocą słowa kluczowego `await`.                                                                 |
| 3   | **Podatność XSS**                            | Bezpośrednie wstrzykiwanie zmiennych tekstowych do `innerHTML`.                                                                                                | Każda dynamiczna interpolacja tekstu musi być zabezpieczona funkcją `escapeHtml(str)`.                                                                                      |
| 4   | **Błąd kalkulatora (przecinek/kropka)**      | Różne formaty separatorów dziesiętnych wprowadzane przez użytkownika.                                                                                          | Przed parsowaniem lub wywołaniem `safeEval` należy zamienić przecinki na kropki: `value.replace(',', '.')`.                                                                 |
| 5   | **Duplikacja stylów przycisku PEHD**         | Wielokrotne nadpisywanie stylów inline.                                                                                                                        | Używać wyłącznie zdefiniowanej klasy CSS `.pehd-btn` zamiast modyfikowania stylów inline z poziomu JS.                                                                      |
| 6   | **Błąd TDZ (Temporal Dead Zone) isLocked**   | Użycie zmiennej `isLocked` przed jej jawną deklaracją w kodzie.                                                                                                | Zapewnić hoist (przeniesienie) deklaracji zmiennej na sam początek bloku kodu / pliku.                                                                                      |
| 7   | **Błąd colspan (13 → 15) w tabelach**        | Sztywne wpisanie wartości colspan w trybie porównania zamówienia.                                                                                              | Zaimplementowano dynamiczne obliczanie wartości parametru `colspan` w zależności od liczby aktywnych kolumn.                                                                |
| 8   | **Błąd toggleAllItemsForOrder**              | Brak sprawdzenia obecności elementu checkbox w drzewie DOM przed operacją.                                                                                     | Dodać warunek zabezpieczający: `if (checkbox) { ... }` przed wywołaniem metody toggle.                                                                                      |
| 9   | **Problem wydajnościowy N+1 (Prisma)**       | Wykonywanie zapytań do powiązanych rekordów w pętli.                                                                                                           | Zastąpić zapytania w pętli pobieraniem zbiorczym (`findMany` z operatorem `in`) i mapowaniem wyników w pamięci podręcznej.                                                  |
| 10  | **Błędy typu Null na DOM queries**           | Próba przypisania listenera do elementu, który nie został jeszcze wyrenderowany.                                                                               | Zawsze stosować sprawdzenie: `if (element) { element.addEventListener(...) }`.                                                                                              |
| 11  | **Timeout przy czyszczeniu audit loga**      | Zbyt duża liczba usuwanych starych logów w jednej transakcji.                                                                                                  | Zaimplementować usuwanie partiami (`deleteMany` z limitem) oraz dodać indeks na kolumnę `createdAt` w bazie danych.                                                         |
| 12  | **Timeout funkcji ensureAdminExists**        | Blokowanie inicjalizacji bazy danych przez równoległe procesy.                                                                                                 | Uporządkować kolejność startu aplikacji: najpierw wgrać produkty, następnie upewnić się o istnieniu konta administratora, a na końcu uruchomić nasłuchiwanie portu serwera. |
| 13  | **CSP blokuje inline onclick**               | Restrykcyjna polityka bezpieczeństwa nagłówków HTTP Helmet.                                                                                                    | Skonfigurować Helmet tak, aby zezwalał na skrypty inline o bezpiecznym pochodzeniu: `scriptSrc: ["'self'", "'unsafe-inline'"]`.                                             |
| 14  | **Domyślne spinnery w input[type=number]**   | Standardowe kontrolki przeglądarki psujące wygląd formularzy.                                                                                                  | Ukryć spinnery za pomocą CSS: `input::-webkit-inner-spin-button { appearance: none; }` oraz `-moz-appearance: textfield`.                                                   |
| 15  | **Mutacja tablicy wejściowej przez sort()**  | Wywołanie metody `.sort()` bezpośrednio na oryginalnej tablicy danych.                                                                                         | Zawsze tworzyć kopię przed sortowaniem: `[...tablica].sort(...)`.                                                                                                           |
| 16  | **Wyrównanie kolumn w pustym wierszu Excel** | 5 gołych `<select disabled>` w pustym wierszu vs `_excelOverlaySelectHtml` w wierszach danych — różnica w box modelu / intrinsic sizing → przesunięcie sticky. | Używać `_excelOverlaySelectHtml(productId, null, null, null, null, true)` dla wyłączonych selectów w pustym wierszu oraz CSS `.excel-sel-wrap.disabled`.                    |

---

## 6. Przydatne Polecenia Konsolowe

Podczas pracy z projektem korzystaj z poniższych komend:

| Polecenie                    | Opis działania                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| `npm run dev:backend`        | Uruchamia serwer backendowy w trybie deweloperskim (auto-reload via ts-node-dev).           |
| `npm run typecheck`          | Wykonuje statyczną analizę typów TypeScript dla plików backendowych.                        |
| `npm run typecheck:frontend` | Wykonuje analizę typów dla plików frontendowych (jeśli są skonfigurowane).                  |
| `npm run test:quick`         | Uruchamia szybkie testy dymne (Smoke Tests) za pomocą Jest (bez pokrycia kodu).             |
| `npm run test:alignment`     | Uruchamia regresyjny test Playwright sprawdzający wyrównanie kolumn w pustym wierszu Excel. |
| `npm run lint`               | Sprawdza poprawność kodu i stylistyki za pomocą ESLint (tylko w katalogu `src/`).           |
| `npm run format`             | Automatycznie formatuje cały kod źródłowy przy użyciu narzędzia Prettier.                   |
| `npm run version:check`      | Sprawdza spójność numeracji wersji w pliku `VERSION`, `package.json` oraz `CHANGELOG.md`.   |
| `npm run release:patch`      | Tworzy nową wersję typu patch, generuje changelog i taguje commit w git.                    |
| `npm run release:minor`      | Tworzy nową wersję typu minor (nowe funkcje wstecznie kompatybilne).                        |
| `npm run release:major`      | Tworzy nową wersję typu major (zmiany przełamujące kompatybilność).                         |

---

## 7. Lokalizacja Planów

Wszystkie plany, taski, implementation plany i dokumenty planistyczne (`.md`) muszą znajdować się w katalogu `docs/plans/`. Dotyczy to zarówno istniejących, jak i nowo tworzonych planów. Wyjątkiem są plany narzędziowe w katalogach konfiguracyjnych (`.hermes/`, `.opencode/`).

---

## 8. Subagenty OpenCode — Model w `task` tool

### Działa po restarcie

Model dla subagentów (`architect`, `planner`, `code-reviewer`, `build-error-resolver`, `doc-updater` itd.) konfiguruje się w `.opencode/opencode.json` w sekcji `agent.{type}.model`. **Wymaga restartu opencode** — zmiany nie są odczytywane w trakcie trwającej sesji.

**Przykład:**
```json
"architect": {
    "description": "System design and scalability specialist",
    "mode": "subagent",
    "model": "deepseek-v4-flash-free",
    ...
}
```

**Jeśli nie ustawisz modelu** dla subagenta, dziedziczy on model z primary agenta (build) lub globalnego modelu (dokumentacja: "subagents will use the model of the primary agent that invoked the subagent").

### Workaround — gdybyś nie mógł zmienić configu

Użyj `general` z precyzyjnym promptem:
```
task(subagent_type: "general", prompt: "Jesteś architektem. Przeanalizuj...")
```
