# Kompleksowy audyt lokalny S.O.K.

## Wynik 6,76/10 · 92% wag ocenionych

Bieżący checkout main, e6cf731ed65b8399cebb891c0375139003d6e3a6, S.O.K. 1.56.4. Wynik łączy przegląd statyczny z ograniczoną walidacją. Pełna wydajność ma N/A. **Gotowość produkcyjna jest zablokowana przez API-01**, ponieważ normalny zapis starszego katalogu przez administratora może usunąć nowszą firmę i jej kontakty oraz odpiąć oferty. To potwierdzony przepływ kodu, bez incydentu zarejestrowanego na danych klienta.

## Pięć zalet

1. Monolit ma czytelne punkty wejścia i oddzielone domeny ofert, cen, zleceń i opieki.
2. Jedna ścieżka PostgreSQL, wersjonowane migracje, oddzielne role, GIN i trigger projekcji follow-up.
3. Bootstrap cenników obejmuje trzy aktywne wersje, kontrolę struktury i SHA oraz oddziela dane ofert.
4. Excel ma wirtualizację, testy parity/golden oraz osobne definicje SLO.
5. Lokalny CI definiuje PostgreSQL, testy regresji, E2E, coverage, smoke obrazu i osobną analizę CodeQL.

## Dziesięć najwyżej ocenionych zagrożeń

1. **API-01 P0**. Starsza pełna lista usuwa brakujące rekordy i kontakty oraz rozłącza oferty.
2. **SEC-01 P1**. Odczytowe share pozwala utrzymywać blokadę właściciela.
3. **BUS-01 P1**. Zlecenie może wskazać cudzą lub nieistniejącą ofertę; zmiana relacji i blokada usunięcia.
4. **API-02 P1**. Odrzucone Promise w Express 4 kończy proces przez globalny handler.
5. **BUS-04 P1**. Import raportuje sukces po odrzuconym zapisie zlecenia; spread może zmienić link.
6. **FE-07 P1**. Ponad 100 studni opcja bez zapisu zachowuje zmiany w pamięci.
7. **DB-04 P1**. Niepoprawna zapisana data może zepsuć wyszukiwanie; tekstowy kursor może dać 500.
8. **DB-01 P1**. Sort po numerze i kursor po dacie powodują pominięcia/powtórzenia.
9. **SEC-06 P1**. Kontekst obrazu obejmuje lokalne foldery narzędzi; potencjalna ekspozycja przy dystrybucji.
10. **SEC-07 P1**. Duży parser przed auth ułatwia presję na pamięć, wpływ zależy od proxy.

Wyścig draftu, brak FK stamp oraz daty i limit w wydruku łącznym są kolejnymi P1. Wydruk i dystrybucję należy ocenić ponownie po smoke z rzeczywistym Chromium i kontroli zawartości obrazu. Kluczowe hipotezy wydajności to przygotowanie pełnego modelu Excel przed wirtualizacją, rzutowania i koszt planu wyszukiwania, duże payloady, retencja iframe oraz zaprogramowane oczekiwanie hosta cennika.

## Zakres i granice

Zinwentaryzowano 1669 ścieżek Git, policzono 1272 pliki źródłowe w wybranych rozszerzeniach i 367 094 linie fizyczne, przeskanowano AST w głównych katalogach oraz 205 deklaracji tras. Ręczne śledzenie objęło wszystkie zidentyfikowane rodziny funkcji i wybrane ścieżki ryzyka, bez przeglądu każdej linii, każdej kombinacji danych lub role × endpoint. Bezpieczne kontrakty instalatorów, walidacja cenników, guard 309 plików oraz próby w pamięci zostały wykonane w tym przebiegu. Bash syntax/help pominięto. Bez aktualnego benchmarku funkcji S.O.K. na 4 GB, testów działania aplikacji i kompletnej izolowanej walidacji PostgreSQL wyniki pozostają oceną statyczną wspartą wąskimi próbami.

N/A pozostają pełny Jest/coverage, bieżące E2E, ręczne WCAG i użyteczność, stan danych produkcyjnych, runtime API/PDF/DOCX/XLSX, zmierzona wydajność SQL/Excel/startup, świeża instalacja Windows i Linux, odtwarzanie po awarii hosta, zdalne CI, status zależności względem CVE i produkcyjny cutover. Wyniki historyczne oznaczono datą albo jako lokalną dokumentację.

## Raporty

- [02_ARCHITECTURE.md](./02_ARCHITECTURE.md)
- [03_FRONTEND_UX.md](./03_FRONTEND_UX.md)
- [04_BACKEND_API.md](./04_BACKEND_API.md)
- [05_POSTGRESQL.md](./05_POSTGRESQL.md)
- [06_SECURITY.md](./06_SECURITY.md)
- [07_PERFORMANCE.md](./07_PERFORMANCE.md)
- [08_BUSINESS_MODULES.md](./08_BUSINESS_MODULES.md)
- [09_TESTS_CICD.md](./09_TESTS_CICD.md)
- [10_CODE_QUALITY.md](./10_CODE_QUALITY.md)
- [11_FINDINGS_REGISTER.md](./11_FINDINGS_REGISTER.md)
- [12_IMPROVEMENT_ROADMAP.md](./12_IMPROVEMENT_ROADMAP.md)
- [13_FINAL_SCORECARD.md](./13_FINAL_SCORECARD.md)

W pierwszej kolejności zatwierdzić F0 i ochronę zapisu klientów. Kolejność F1/F2 i warunki dalszych etapów podaje plan. Ten przebieg zapisuje raporty lokalnie.
