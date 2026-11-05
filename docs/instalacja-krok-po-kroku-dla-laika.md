# Instalacja S.O.K. na nowym komputerze Windows

**Wersja dokumentacji:** 1.56.4

**Aktualizacja:** 2026-11-05

Ten poradnik prowadzi przez testową instalację S.O.K. z PostgreSQL 18 na
Windows 10/11. Do tego wariantu użyj `install-new-pc.bat`; nie instaluj osobno
PostgreSQL ani Node.js. Baza działa w wolumenie Docker, poza folderem aplikacji.

> Ten wariant Windows służy do testów. Instalacja serwerowa Linux jest opisana
> w [README — Linux](../README.md). Przed produkcyjnym
> użyciem zweryfikuj wdrożenie na firmowym serwerze i wykonaj restore drill.

## Czego potrzebujesz

- Komputera z Windows 10 lub 11 i uprawnieniami administratora.
- Połączenia z internetem podczas pobierania komponentów.
- Docker Desktop dla Windows. Instalator S.O.K. może go przygotować przez
  `winget`; pierwsze uruchomienie może wymagać zaakceptowania warunków Docker,
  włączenia WSL 2 oraz restartu komputera.
- Repozytorium S.O.K. pobranego jako ZIP albo przez Git.
- Plik `active-pricelists.json` z aktywnymi cennikami, przygotowany na starym
  komputerze według [procedury eksportu](cutover/active-pricelists.md). Instalator
  poprosi o jego ścieżkę, jeśli pliku nie ma w folderze `cutover`. Bez niego
  instalacja zatrzyma się przed uruchomieniem aplikacji.

Docker Desktop jest bezpłatny dla części zastosowań; większe firmy mogą
potrzebować płatnej subskrypcji według warunków Docker. Instalator nie usuwa
istniejących wolumenów ani danych.

## Instalacja

1. Pobierz repozytorium z
   [GitHub](https://github.com/blodytrav3l3r/Oferty_PV) przez **Code → Download
   ZIP** i rozpakuj je do zwykłego folderu, np. `C:\SOK`.
2. Otwórz folder i uruchom `install-new-pc.bat` dwukrotnym kliknięciem.
3. Zaakceptuj monit Windows/UAC. Jeśli instalator poprosi o restart, uruchom
   komputer ponownie, a następnie uruchom ten sam plik jeszcze raz.
4. Przy pierwszym uruchomieniu Docker Desktop zaakceptuj jego warunki i poczekaj,
   aż Docker będzie gotowy.
5. Pozostaw czarne okno otwarte. Instalator tworzy lokalne sekrety, uruchamia
   PostgreSQL 18, wykonuje migracje i seed, pokazuje dry-run importu cenników,
   a następnie prosi o jawne potwierdzenie ich importu. Po imporcie sprawdza
   gotowość aplikacji.
6. Instalacja zakończy się dopiero po pozytywnym health checku. Otwórz
   `http://localhost:3000`.

Pierwsze hasło administratora instalator zapisuje w
`data/install-admin-password.txt`; po pierwszym logowaniu zmień je w aplikacji.
Nie wysyłaj tego pliku ani `.env` innym osobom.

## Codzienne uruchamianie

Po poprawnej instalacji uruchamiaj `start-postgres.bat`. Ten launcher uruchamia
istniejące kontenery i sprawdza stan aplikacji. Nie tworzy nowej bazy, nie
importuje cenników i nie resetuje wolumenów.

Do pierwszej instalacji albo wznowienia przerwanej konfiguracji użyj ponownie
`install-new-pc.bat` i postępuj zgodnie z komunikatami. Jeżeli instalator wykryje
istniejący wolumen, nie zatwierdzaj wznowienia, jeśli nie wiesz, do jakiej
instalacji należy. Nie usuwaj wolumenów w Docker Desktop.

## Przenoszenie aktywnych cenników ze starej instalacji

Obsługiwany zakres to aktywne cenniki rur, studni i PRECO. Oferty, użytkownicy,
zamówienia, sesje, historia wersji i pozostałe dane nie są kopiowane. Szczegółowa
procedura dla administratora znajduje się w
[`docs/cutover/active-pricelists.md`](cutover/active-pricelists.md). Artefakt
cenników zawiera dane handlowe: przechowuj go poza repozytorium i ogranicz do
niego dostęp.

## Rozwiązywanie problemów

- **Docker nie jest gotowy:** otwórz Docker Desktop, zaakceptuj wymagane warunki,
  włącz backend WSL 2 i uruchom ponownie instalator.
- **`POSTGRES_DB` lub inna zmienna jest pusta:** instalator nie nadpisuje
  istniejącego `.env`. Poproś administratora o sprawdzenie konfiguracji zamiast
  wpisywać losowe wartości.
- **Błąd migracji lub importu:** zachowaj całe okno/log, nie usuwaj wolumenu i
  przekaż komunikat administratorowi.
- **Strona się nie otwiera:** sprawdź, czy Docker Desktop działa, uruchom
  `start-postgres.bat` i otwórz ponownie `http://localhost:3000`.

## Dokumentacja administratora

- [README — uruchamianie i instalatory](../README.md)
- [Baza danych PostgreSQL](DATABASE.md)
- [Wdrożenie, backup i restore](DEPLOYMENT.md)
- [Instalacja i przenoszenie cenników](instalacja-przenoszenie-systemu.md)
