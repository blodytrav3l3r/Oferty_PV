# Załącznik licencyjny — pochodzenie kodu i komponenty zewnętrzne

**Dokument:** Załącznik do umowy licencyjnej na oprogramowanie **S.O.K. — System Ofert i Kalkulacji**
**Wersja dokumentu:** 1.0 (2026-11-16)
**Wersja oprogramowania, którego dotyczy:** 1.59.0
**Identyfikator weryfikacji:** `SOK-PROV-2026-11-16`, commit `2bc3cc108995f3510496f1cf9361eac4f395d53d` (gałąź `main`)
**Dokument źródłowy audytu:** [`POCHODZENIE_KODU_I_AI.md`](POCHODZENIE_KODU_I_AI.md)

---

## Informacje wstępne

1. Dokument opisuje **stan faktyczny ustalony na dzień 2026-11-16** dla wskazanego commita. Nie obejmuje zmian wprowadzonych później.
2. Dokument jest **materiałem technicznym** i nie stanowi opinii prawnej ani gwarancji zgodności prawnej. Kwestie wymagające interpretacji prawa wskazano wprost.
3. Stosowane oznaczenia:
    - **POTWIERDZONE** — istnieje bezpośredni dowód w repozytorium, konfiguracji, historii zmian lub wyniku komendy weryfikacyjnej;
    - **ZADEKLAROWANE PRZEZ AUTORA** — informacja przekazana przez właściciela projektu, bez niezależnego dowodu technicznego;
    - **WYMAGA POTWIERDZENIA** — istnieją przesłanki, ale brak wystarczającego dowodu;
    - **NIEUSTALONE** — brak danych pozwalających ustalić fakt;
    - **NIE DOTYCZY** — element nie występuje lub nie ma zastosowania.
4. Oprogramowanie jest objęte licencją własnościową. Właściciel praw majątkowych wskazany w pliku `LICENSE`: **Łukasz Kobyłka**, Copyright (c) 2026. Ustalenie pełni praw majątkowych wymaga dokumentów poza repozytorium (patrz pkt 4 i 5).

---

## 1. Wykaz narzędzi AI

Narzędzia AI wykorzystane **do wytworzenia** oprogramowania (nie: mechanizmy działające w produkcie — patrz pkt 5.4).

| Lp. | Narzędzie             | Dostawca                       | Zakres wykorzystania                                                                                                                | Status ustalenia                                                                                                                                                                                         |
| --- | --------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 | OpenCode (wersja 2.x) | OpenCode (projekt open source) | wytworzenie całości kodu, testów i dokumentacji oraz analizy (deklaracja P-06a); główne środowisko agentowe projektu                | **POTWIERDZONE** — wersjonowana konfiguracja projektu `.opencode/opencode.json`, instrukcje `AGENTS.md`, opis `docs/development/OPENCODE.md`. Zakres przypadający na poszczególne pliki: **NIEUSTALONE** |
| 1.2 | OpenAI Codex          | OpenAI                         | wytworzenie kodu, testów, dokumentacji i analiz (deklaracja P-06a)                                                                  | **ZADEKLAROWANE PRZEZ AUTORA**; częściowo potwierdzone istnieniem konfiguracji `.codex/hooks.json` w katalogu projektu (plik nie jest częścią repozytorium). Zakres i konkretne zmiany: **NIEUSTALONE**  |
| 1.3 | Google Antigravity    | Google                         | wytworzenie kodu, testów, dokumentacji i analiz (deklaracja P-06a)                                                                  | **ZADEKLAROWANE PRZEZ AUTORA**; brak artefaktów w repozytorium. Zakres i konkretne zmiany: **NIEUSTALONE**                                                                                               |
| 1.4 | Claude Code           | Anthropic                      | możliwe użycie w niewielkim zakresie; w katalogu projektu obecne pliki konfiguracyjne `.claude/settings.json` i `.claude/CLAUDE.md` | **ZADEKLAROWANE PRZEZ AUTORA** (odpowiedź P-08); szczegółowy zakres: **NIEUSTALONE**                                                                                                                     |
| 1.5 | Inne narzędzia AI     | różni dostawcy                 | możliwe użycie w niewielkim zakresie (m.in. Cursor, Windsurf, Copilot) — bez wskazania konkretnych narzędzi i zmian                 | **ZADEKLAROWANE PRZEZ AUTORA** (odpowiedź P-08); wykaz i zakres: **NIEUSTALONE**                                                                                                                         |

**Rola autora (deklaracja P-10a, korekta 2026-11-16):** autor sprawdzał, czy system działa poprawnie (weryfikacja funkcjonalna). Autor nie zadeklarował pisania kodu ani przeglądu kodu linia po linii. Wcześniejsza deklaracja, że żadne narzędzie nie tworzyło całych modułów bez istotnej modyfikacji, jest **nieaktualna**.

Ustalenia dodatkowe dotyczące narzędzi AI:

- W historii zmian nie występują oznaczenia współautorstwa narzędzi AI ani commity autorstwa botów AI; wszystkie commity merytoryczne są autorstwa osoby wskazanej w `LICENSE` (poza automatycznymi aktualizacjami zależności).
- Nie jest możliwe techniczne przypisanie konkretnych fragmentów kodu do konkretnego narzędzia AI. Dokument nie zawiera takich przypisań.
- Narzędzia AI nie są właścicielami praw autorskich do oprogramowania.
- Żadne narzędzie AI nie jest zależnością uruchomieniową oprogramowania.

---

## 2. Wykaz bibliotek i komponentów zewnętrznych

### 2.1. Zasady wykazu

- Pełny, maszynowo wygenerowany rejestr pakietów (nazwa, wersja, licencja, zakres produkcyjny/deweloperski) znajduje się w dokumencie referencyjnym **`THIRD-PARTY-NOTICES.md`** (stan 2026-11-15: 325 pozycji bez flagi deweloperskiej i 981 z flagą deweloperską w pliku blokady wersji). Dokument ten jest generowany z `package-lock.json` i zasobów `public/` i nie jest tu powielany.
- Analiza dystrybucji, obrazów i otwartych kwestii: **`docs/LICENCJE_ZALEZNOSCI.md`**.
- Stos technologiczny i licencje głównych technologii: **`docs/TECH_STACK.md`**.
- Teksty licencji dołączone do oprogramowania: **`public/licenses/`**.

### 2.2. Bezpośrednie zależności produkcyjne (runtime)

| Lp.    | Komponent                             | Wersja       | Zastosowanie                   | Licencja                                               |
| ------ | ------------------------------------- | ------------ | ------------------------------ | ------------------------------------------------------ |
| 2.2.1  | Express                               | 4.22.x       | serwer HTTP / API              | MIT                                                    |
| 2.2.2  | Prisma Client, `@prisma/adapter-pg`   | 7.10.1       | warstwa dostępu do bazy danych | Apache-2.0                                             |
| 2.2.3  | `pg`                                  | 8.23.1       | sterownik PostgreSQL           | MIT                                                    |
| 2.2.4  | Zod                                   | 4.3.x        | walidacja danych wejściowych   | MIT                                                    |
| 2.2.5  | Helmet                                | 8.3.x        | nagłówki bezpieczeństwa        | MIT                                                    |
| 2.2.6  | `compression`                         | 1.8.x        | kompresja odpowiedzi HTTP      | MIT                                                    |
| 2.2.7  | `cookie-parser`                       | 1.4.x        | obsługa ciastek sesji          | MIT                                                    |
| 2.2.8  | `bcryptjs`                            | 3.0.x        | haszowanie haseł               | BSD-3-Clause                                           |
| 2.2.9  | `dotenv`                              | 17.4.x       | konfiguracja środowiska        | BSD-2-Clause                                           |
| 2.2.10 | `@sentry/node`                        | 10.59.x      | monitorowanie błędów           | MIT                                                    |
| 2.2.11 | Puppeteer                             | 25.16.x      | generowanie dokumentów PDF     | Apache-2.0 (biblioteka); przeglądarka — patrz 2.5      |
| 2.2.12 | `docx`                                | 9.6.x        | generowanie dokumentów DOCX    | MIT                                                    |
| 2.2.13 | `jszip`                               | 3.10.x       | archiwa ZIP (eksport)          | MIT (wariant wybrany z licencji dualnej MIT / GPL-3.0) |
| 2.2.14 | `swagger-jsdoc`, `swagger-ui-express` | 6.3.x, 5.0.x | dokumentacja API               | MIT                                                    |

### 2.3. Zależności pośrednie produkcyjne

Zależności pośrednie wynikają z pakietów z pkt 2.2. Ich pełny wykaz z licencjami zawiera `THIRD-PARTY-NOTICES.md` (pozycje bez flagi deweloperskiej). Większość to licencje permisywne (MIT, ISC, BSD, Apache-2.0). Komponenty o licencjach innych niż permisywne, obecne w artefakcie obrazu, wskazano w pkt 2.5 i 4.

### 2.4. Zależności deweloperskie i testowe

Testy, lint, formatowanie, wersjonowanie, bundling i testy end-to-end: m.in. Jest, Playwright, ESLint, Prettier, TypeScript, Husky, commitlint, `standard-version`, esbuild, Prisma CLI. Nie są przeznaczone do dystrybucji, ale **obecnie znajdują się w obrazie Docker** (instalacja `npm ci` bez usuwania zależności deweloperskich) — fakt potwierdzony w `docs/LICENCJE_ZALEZNOSCI.md`. W zadeklarowanym modelu przekazania kodu źródłowego są częścią przekazywanego repozytorium. Wykaz i licencje: `THIRD-PARTY-NOTICES.md` (pozycje z flagą deweloperską).

### 2.5. Komponenty dołączone bezpośrednio do oprogramowania (vendored) i platforma

| Lp.   | Komponent                                                                      | Wersja                                                | Sposób dostarczenia                              | Licencja                                                 | Tekst licencji w repo                                                      |
| ----- | ------------------------------------------------------------------------------ | ----------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------- | -------------------------------------------------------------------------- |
| 2.5.1 | SheetJS Community Edition (`public/vendor/xlsx.full.min.js`)                   | 0.20.3 (wersja odczytana z pliku)                     | plik w katalogu `public/`, dostarczany w obrazie | Apache-2.0                                               | `public/licenses/APACHE-2.0.txt`; obecność pliku NOTICE — do potwierdzenia |
| 2.5.2 | Font Inter (pliki `.woff2` + `inter.css`)                                      | subset, wagi 300–900                                  | katalog `public/css/`                            | SIL Open Font License 1.1                                | `public/licenses/SIL-OFL-1.1.txt`                                          |
| 2.5.3 | Ikony Lucide (subset `iconsSlim.js`)                                           | subset                                                | katalog `public/js/shared/`                      | ISC + MIT (Feather)                                      | `public/licenses/ISC-Lucide.txt`                                           |
| 2.5.4 | Node.js                                                                        | ≥ 22.13 (`.nvmrc`: 22; obraz: `node:22-slim`)         | środowisko uruchomieniowe / obraz bazowy         | MIT                                                      | tekst w dystrybucji Node.js                                                |
| 2.5.5 | PostgreSQL                                                                     | 18 (`postgres:18-alpine`; w audytowanym obrazie 18.7) | kontener bazy danych, uruchamiany obok aplikacji | PostgreSQL License                                       | `public/licenses/PostgreSQL.txt`                                           |
| 2.5.6 | Chrome for Testing                                                             | wersja pobierana przez Puppeteer                      | cache przeglądarki w obrazie                     | licencja przeglądarki Chromium oraz licencje komponentów | pełna lista atrybucji **niezweryfikowana**                                 |
| 2.5.7 | System bazowy obrazów (Debian w `node:22-slim`, Alpine w `postgres:18-alpine`) | wersje zależne od daty budowy                         | obraz Docker                                     | licencje systemowe poszczególnych pakietów               | pełna inwentaryzacja **nieprzeprowadzona**                                 |
| 2.5.8 | Docker / Docker Desktop / Docker Engine                                        | wersje instalowane osobno przez użytkownika           | nie jest dołączany do oprogramowania             | Apache-2.0                                               | nie dotyczy (komponent zewnętrzny użytkownika)                             |

### 2.6. Komponenty pobierane podczas instalacji

Instalatory Windows i Linux pobierają Docker Desktop (Windows) lub Docker Engine, containerd, buildx i Compose plugin (Linux) z repozytoriów dostawcy. Komponenty te nie są częścią oprogramowania S.O.K. i nie są objęte niniejszym wykazem licencji; podlegają warunkom ich dostawców.

### 2.7. Zasoby, które nie są dostarczane odbiorcy

Katalogi narzędziowe agentów AI (`.claude/`, `.codex/`, `.agents/`, `.hermes/`, `graphify-out/`) oraz katalog `assets/` (robocze dane cennikowe i pliki `.xlsm`) nie są wersjonowane i są wyłączone z obrazu Docker — nie są dostarczane odbiorcy. Wersjonowany katalog `.opencode/` (konfiguracja, reguły, prompty, pluginy, skille) jest częścią repozytorium i trafia do odbiorcy w modelu przekazania kodu źródłowego; zawiera adaptacje materiału ECC (MIT) — patrz 4.5.

---

## 3. Wykaz licencji komponentów zewnętrznych

### 3.1. Licencje występujące w komponentach

| Licencja                               | Rodzaj                                         | Główne obowiązki                                                                   | Występowanie                                                        |
| -------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| MIT                                    | permisywna                                     | zachowanie noty o prawach autorskich i tekstu licencji                             | większość pakietów npm, Node.js                                     |
| ISC                                    | permisywna                                     | zachowanie noty o prawach autorskich i tekstu licencji                             | pakiety npm, ikony Lucide                                           |
| BSD-2-Clause / BSD-3-Clause            | permisywna                                     | zachowanie noty i tekstu licencji; BSD-3 zakazuje użycia nazw autorów w reklamie   | `dotenv`, `bcryptjs` i in.                                          |
| Apache-2.0                             | permisywna z klauzulą patentową                | tekst licencji, informacje o zmianach, plik NOTICE jeżeli występuje                | Prisma, Puppeteer, SheetJS, TypeScript, Playwright, Docker          |
| SIL OFL 1.1                            | licencja na fonty                              | zachowanie noty copyright i tekstu licencji; zakaz sprzedaży fontu samodzielnie    | font Inter                                                          |
| PostgreSQL License                     | permisywna (typu BSD)                          | zachowanie noty i tekstu licencji                                                  | PostgreSQL                                                          |
| EPL-2.0                                | słabe copyleft                                 | dostęp do źródeł komponentu i informacje o zmianach dla dystrybuowanego komponentu | `elkjs` (obecny w obrazie) — do potwierdzenia spełnienia obowiązków |
| MPL-2.0                                | słabe copyleft                                 | udostępnienie źródeł zmodyfikowanych plików objętych MPL                           | pakiety deweloperskie (`@axe-core/playwright`, `axe-core`)          |
| Licencja Chromium / Chrome for Testing | własna, z atrybucjami komponentów              | dostarczenie informacji licencyjnych przeglądarki i jej komponentów                | przeglądarka w obrazie — atrybucje niezweryfikowane                 |
| Licencje systemowe (Debian/Alpine)     | różne, w tym GPL/LGPL dla narzędzi systemowych | obowiązki zależą od pakietu i sposobu dystrybucji                                  | system bazowy obrazów — inwentaryzacja nieprzeprowadzona            |

### 3.2. Zgodność informacji licencyjnych

- Rejestr `THIRD-PARTY-NOTICES.md` jest generowany z pliku blokady wersji; kontrola `npm run licenses:check` w dniu 2026-11-16 potwierdziła jego aktualność względem `package-lock.json`.
- Teksty licencji dla zasobów dołączonych bezpośrednio (SheetJS, Inter, Lucide, PostgreSQL) są obecne w `public/licenses/` i dostarczane w obrazie.
- Wybrane teksty licencji zależności npm wraz z mapowaniem wersji i źródła: `public/licenses/npm/` (manifest z sumami kontrolnymi).

### 3.3. Obowiązki przy komercyjnym udostępnianiu

Zadeklarowany model przekazania (P-11): **kod źródłowy, bez prawa odsprzedaży**. Poniższa tabela obejmuje także pozostałe warianty, gdyby model uległ zmianie.

| Model dystrybucji                                  | Obowiązki w zakresie komponentów zewnętrznych                                                                                                                                                                                                         |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Przekazanie kodu źródłowego (model zadeklarowany)  | zachowanie wszystkich not i tekstów licencji; dla MIT/ISC/BSD/Apache-2.0 — noty i teksty; dla EPL-2.0 — dostęp do źródeł i informacje o zmianach; dla OFL — nota i tekst licencji fontu; zakaz odsprzedaży wynika z umowy, nie z licencji komponentów |
| Przekazanie gotowego pakietu / instalacji lokalnej | jak wyżej dla komponentów zawartych w pakiecie; dodatkowo informacje licencyjne Node.js, PostgreSQL i przeglądarki, jeśli są dołączone                                                                                                                |
| Przekazanie obrazu Docker                          | jak wyżej dla całej zawartości obrazu, w tym pakietów systemowych, przeglądarki i pakietów deweloperskich obecnych w obrazie                                                                                                                          |
| Udostępnianie jako usługa (SaaS)                   | obowiązki atrybucji zwykle ograniczają się do komponentów przekazywanych użytkownikowi; kwestia wymaga odrębnej oceny prawnej, w szczególności dla licencji copyleft                                                                                  |

### 3.4. Kwestie otwarte w zakresie licencji (do uzupełnienia przed wydaniem)

1. Pełne atrybucje Chrome for Testing dla dostarczanej wersji przeglądarki.
2. Sposób spełnienia obowiązków EPL-2.0 dla `elkjs` w obrazie.
3. Uzupełnienie tekstów licencji dla pakietów npm obecnych w obrazie bez pliku `LICENSE` (w tym `@prisma/dev`).
4. Inwentaryzacja licencji pakietów systemowych obrazów bazowych oraz pinowanie digestów obrazów dla wydania.
5. Potwierdzenie obecności i dołączenie pliku NOTICE dla SheetJS, jeśli występuje w dystrybuowanym buildzie.

---

## 4. Elementy o nieustalonym statusie prawnym

| Lp.  | Element                                                                                                                    | Problem                                                                                                                                                | Ryzyko                             | Status                                    | Wymagane działanie                                                                                                  |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 4.1  | Historia rozwoju przed pierwszym commitem (wersja 1.5.0, 2026-07-14)                                                       | brak technicznego zapisu pochodzenia kodu sprzed pierwszego commitu; autor zadeklarował powstanie poza pracą i bez udziału innych osób                 | ŚREDNIE                            | NIEUSTALONE (technicznie) / ZADEKLAROWANE | objąć oświadczeniem autora w umowie (pochodzenie kodu i użyte narzędzia)                                            |
| 4.2  | Prawa majątkowe autora (tryb pracowniczy/zleceniowy)                                                                       | autor zadeklarował: utwór poza godzinami pracy, poza obowiązkami pracowniczymi, brak umów o prawa autorskie, wyłączny właściciel                       | NISKIE                             | ZADEKLAROWANE / WYMAGA OCENY PRAWNEJ      | potwierdzić oświadczeniem w umowie; ocena prawna przed podpisaniem umowy                                            |
| 4.3  | Claude Code i inne narzędzia AI poza pierwotną deklaracją                                                                  | autor potwierdził możliwe użycie „w niewielkim stopniu”; brak wskazania narzędzi i zmian                                                               | NISKIE                             | ZADEKLAROWANE (szczegóły NIEUSTALONE)     | doprecyzować wykaz, jeśli wymagany w umowie                                                                         |
| 4.4  | Zakres użycia Codex, OpenCode, Antigravity w odniesieniu do konkretnych zmian                                              | brak mapowania „zmiana → narzędzie AI”; autor zadeklarował wytworzenie całości kodu przez AI oraz weryfikację funkcjonalną (nie: przegląd kodu)        | ŚREDNIE                            | ZADEKLAROWANE                             | zapis w umowie o zakresie udziału AI i sposobie weryfikacji (testy, akceptacja funkcjonalna)                        |
| 4.5  | Materiały adaptowane z projektu ECC (licencja MIT, Copyright (c) 2026 Affaan Mustafa) w plikach narzędziowych `.opencode/` | adaptacja bez zachowania pełnej noty licencyjnej w plikach; nie dotyczy obrazu aplikacji, ale trafia do odbiorcy przy przekazaniu kodu źródłowego      | NISKIE                             | WYMAGA POTWIERDZENIA                      | przy przekazywaniu kodu źródłowego dołączyć notę o pochodzeniu i tekst licencji MIT                                 |
| 4.6  | Dane cennikowe producentów (`assets/` lokalnie; `data/pricelists/active-pricelists.json` wersjonowany i dostarczany)       | autor zadeklarował prawo do wykorzystania i przekazywania danych; cenniki są publicznie dostępne (P-07)                                                | NISKIE (zastrzeżenie prawne niżej) | ZADEKLAROWANE                             | potwierdzić oświadczeniem w umowie; publiczna dostępność nie jest licencją na redystrybucję — ocena prawna          |
| 4.7  | Papier firmowy i grafiki (`public/images/`)                                                                                | zasoby papieru firmowego „dodane na potrzeby testów” są używane w generowanych ofertach PDF i etykietach; prawo do ich wykorzystania niepotwierdzone   | WYSOKIE                            | WYMAGA POTWIERDZENIA                      | potwierdzić prawo do papieru firmowego lub zastąpić zasobami własnymi; ocena prawna użycia oznaczeń CE/B            |
| 4.8  | Materiał opisujący zachowanie modelu językowego (`assets/claude-sonnet-5.md`, plik lokalny poza repozytorium i obrazem)    | nieustalone pochodzenie i dopuszczalność wykorzystania                                                                                                 | NISKIE                             | WYMAGA POTWIERDZENIA                      | usunięcie z obszaru projektu lub udokumentowanie pochodzenia; nie dołączać do artefaktów                            |
| 4.9  | Repozytorium publiczne a treść `LICENSE`                                                                                   | `LICENSE` zakazuje publicznego udostępniania kopii bez zgody; autor zdecydował o pozostawieniu repozytorium publicznego (P-12)                         | NISKIE                             | ZADEKLAROWANE                             | dopasować brzmienie `LICENSE` do decyzji o publicznym repozytorium                                                  |
| 4.10 | Źródła kodu spoza inwentarza (P-05)                                                                                        | autor zadeklarował korzystanie z kodu innych repozytoriów zgodnie z ich licencjami, bez wskazania nazw                                                 | NISKIE                             | ZADEKLAROWANE                             | wskazać repozytoria, jeśli są inne niż zależności npm, zasoby vendored i materiał ECC                               |
| 4.11 | Autorstwo człowieka a zakres ochrony prawnoautorskiej                                                                      | autor deklaruje, że kod wytworzyły narzędzia AI, a jego rola ograniczała się do sprawdzania poprawności działania; twórczy wkład człowieka nieustalony | WYSOKIE                            | WYMAGA OCENY PRAWNEJ                      | ocena prawna zdolności ochronnej i przypisania praw; udokumentować wkład człowieka (wymagania, decyzje, akceptacje) |
| 4.12 | Podobieństwo kodu do istniejących utworów (w tym materiałów z danych treningowych)                                         | nie przeprowadzono analizy podobieństwa kodu wytworzonego przez AI do istniejących repozytoriów                                                        | ŚREDNIE                            | WYMAGA POTWIERDZENIA                      | przed podpisaniem umowy rozważyć skan podobieństwa i zachować wynik                                                 |
| 4.13 | Warunki korzystania z narzędzi AI (Antigravity, Codex, OpenCode, inne)                                                     | nie zweryfikowano regulaminów dostawców w zakresie praw do wyników, użytku komercyjnego i odpowiedzialności                                            | ŚREDNIE                            | WYMAGA POTWIERDZENIA                      | sprawdzić warunki dla wersji faktycznie używanych i zachować kopie regulaminów z datą                               |

Poziom ryzyka „KRYTYCZNE” nie został przypisany żadnemu elementowi na podstawie zebranych dowodów.

---

## 5. Dodatkowe informacje dotyczące pochodzenia kodu

### 5.1. Autorstwo i historia

- Oprogramowanie jest rozwijane w repozytorium Git od 2026-07-14 (pierwszy commit: wersja 1.5.0). Stan na dzień audytu: 2 169 commitów, wersja 1.59.0.
- Wszystkie commity merytoryczne w historii mają jednego autora — osobę wskazaną w `LICENSE`; pozostałe wpisy to automatyczne aktualizacje zależności.
- Autor zadeklarował (2026-11-16): utwór powstał poza godzinami pracy, poza obowiązkami pracowniczymi, bez udziału innych osób i bez umów regulujących prawa autorskie; właścicielem praw jest wyłącznie Łukasz Kobyłka. Są to **deklaracje**, nie dokumenty.
- Autor zadeklarował również (korekta 2026-11-16), że **całość kodu powstała z użyciem narzędzi AI**, a jego rola ograniczała się do sprawdzania, czy system działa poprawnie. Dokument nie rozstrzyga, jaki jest zakres twórczy tego wkładu — patrz 4.11.
- Projekt posiada własną, szczegółową dokumentację architektury, inwariantów systemowych i procesu wydania (`docs/ARCHITECTURE.md`, `docs/SYSTEM_INVARIANTS.md`, `docs/RELEASE_PROCESS.md`).

### 5.2. Kod własny a komponenty zewnętrzne

- Logika biznesowa (konfiguracja studni i rur, oferty, cenniki, import/eksport, integracja z arkuszami, generowanie PDF/DOCX) jest implementacją własną, wytworzoną z użyciem narzędzi AI na podstawie wymagań autora.
- Kod zewnętrzny występuje w postaci bibliotek npm oraz zasobów dołączonych bezpośrednio (pkt 2), każdy z określoną licencją.
- Nie stwierdzono w repozytorium fragmentów kodu z nieoznaczonym pochodzeniem. Nie stanowi to jednak dowodu negatywnego dla całej historii — patrz 4.1, 4.4 i 4.12. Nie przeprowadzono analizy podobieństwa kodu wytworzonego przez AI do istniejących repozytoriów.

### 5.3. Wykorzystanie AI w procesie wytwórczym

- Autor zadeklarował wykorzystanie narzędzi: Google Antigravity, OpenAI Codex, OpenCode oraz możliwe użycie innych narzędzi AI „w niewielkim stopniu” (m.in. Claude Code, Cursor, Windsurf, Copilot) — bez wskazania konkretnych narzędzi i zmian.
- Dowody techniczne użycia istnieją dla OpenCode (wersjonowana konfiguracja i dokumentacja) oraz dla Codex i Claude Code (pliki konfiguracyjne w katalogu projektu, poza repozytorium). Dla Antigravity brak artefaktów.
- Zgodnie z korektą deklaracji z 2026-11-16: **całość kodu, testów i dokumentacji wytworzono z użyciem AI**, a autor sprawdzał poprawność działania systemu. Autor nie zadeklarował pisania kodu ani przeglądu kodu linia po linii. Wcześniejsza deklaracja o braku całych modułów tworzonych przez AI oraz o sprawdzaniu i testowaniu każdego wyniku jest **nieaktualna**. Deklaracja: **ZADEKLAROWANE PRZEZ AUTORA**; zakres per plik: **NIEUSTALONE**.
- Nie ustalono, które fragmenty kodu powstały przy udziale twórczym człowieka; wpływ na zakres ochrony wymaga oceny prawnej (pkt 4.11).
- Dokument nie przypisuje autorstwa żadnego fragmentu kodu narzędziom AI.

### 5.4. Mechanizmy AI/ML w produkcie

- S.O.K. zawiera własny, lokalny mechanizm uczenia i rankingu konfiguracji (moduł AI/ML). Mechanizm działa na danych zapisanych w bazie PostgreSQL u odbiorcy.
- Oprogramowanie nie korzysta z zewnętrznych usług AI ani z modeli dostawców zewnętrznych; nie przekazuje danych do zewnętrznych dostawców AI.
- Prawa do danych treningowych i wytrenowanych modeli w instalacji odbiorcy zależą od treści umowy i wymagają uregulowania (ocena prawna).

### 5.5. Dokumenty referencyjne

| Dokument                                       | Zakres                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| `THIRD-PARTY-NOTICES.md`                       | pełny rejestr pakietów npm i zobowiązań licencyjnych (generowany)   |
| `docs/LICENCJE_ZALEZNOSCI.md`                  | analiza dystrybucji, obrazów Docker, otwartych kwestii licencyjnych |
| `docs/TECH_STACK.md`                           | stos technologiczny i licencje głównych technologii                 |
| `public/licenses/` oraz `public/licenses/npm/` | teksty licencji i mapowanie wersji/źródeł                           |
| `docs/POCHODZENIE_KODU_I_AI.md`                | pełny audyt: dowody, rejestr ustaleń, pytania, ograniczenia         |
| `LICENSE`                                      | warunki licencji własnościowej oprogramowania                       |

### 5.6. Oświadczenia autora (2026-11-16)

| ID   | Oświadczenie                                                                                    | Status                                                  |
| ---- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| P-01 | S.O.K. powstał poza godzinami pracy                                                             | ZADEKLAROWANE PRZEZ AUTORA                              |
| P-02 | Tworzenie S.O.K. nie należało do obowiązków pracowniczych ani nie było zlecane przez pracodawcę | ZADEKLAROWANE PRZEZ AUTORA                              |
| P-03 | Nie istnieją umowy ani dokumenty regulujące prawa autorskie do S.O.K.                           | ZADEKLAROWANE PRZEZ AUTORA                              |
| P-04 | Inne osoby nie uczestniczyły w tworzeniu oprogramowania                                         | ZADEKLAROWANE PRZEZ AUTORA                              |
| P-05 | Część kodu pochodzi z innych repozytoriów i jest używana zgodnie z ich licencjami               | ZADEKLAROWANE PRZEZ AUTORA                              |
| P-06 | Narzędzia AI wytworzyły całość kodu, testów i dokumentacji (korekta 2026-11-16)                 | ZADEKLAROWANE PRZEZ AUTORA; zakres per plik NIEUSTALONE |
| P-07 | Autor ma prawo wykorzystywać i przekazywać dane cennikowe; cenniki są publicznie dostępne       | ZADEKLAROWANE PRZEZ AUTORA                              |
| P-08 | Inne narzędzia AI mogły być wykorzystane w niewielkim stopniu                                   | ZADEKLAROWANE PRZEZ AUTORA (szczegóły NIEUSTALONE)      |
| P-09 | Grafiki w `public/images/` pochodzą z papieru firmowego i dodano je na potrzeby testów          | ZADEKLAROWANE PRZEZ AUTORA                              |
| P-10 | Autor sprawdzał poprawność działania systemu (weryfikacja funkcjonalna) — korekta 2026-11-16    | ZADEKLAROWANE PRZEZ AUTORA                              |
| P-11 | Oprogramowanie jest przekazywane jako kod źródłowy, bez możliwości odsprzedaży                  | ZADEKLAROWANE PRZEZ AUTORA                              |
| P-12 | Repozytorium GitHub pozostaje publiczne                                                         | ZADEKLAROWANE PRZEZ AUTORA                              |
| P-13 | Wyłącznym właścicielem praw do S.O.K. jest Łukasz Kobyłka                                       | ZADEKLAROWANE PRZEZ AUTORA                              |

### 5.7. Oświadczenie o ograniczeniach

Dokument odzwierciedla wyłącznie informacje możliwe do ustalenia na podstawie repozytorium, konfiguracji, historii zmian i deklaracji autora. Nie zawiera niepotwierdzonych twierdzeń o autorstwie, prawach majątkowych ani zgodności prawnej. Kwestie oznaczone jako **WYMAGA POTWIERDZENIA**, **NIEUSTALONE** lub **WYMAGA OCENY PRAWNEJ** nie mogą być traktowane jako potwierdzone przez którąkolwiek ze stron umowy bez odrębnego oświadczenia lub dokumentu.

---

**Podpisy stron umowy**

| Strona         | Imię i nazwisko / nazwa | Data | Podpis |
| -------------- | ----------------------- | ---- | ------ |
| Licencjodawca  |                         |      |        |
| Licencjobiorca |                         |      |        |
