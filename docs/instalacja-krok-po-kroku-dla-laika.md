# Instrukcja instalacji S.O.K. — System Ofert i Kalkulacji — krok po kroku dla laika

> **Plik:** docs/instalacja-krok-po-kroku-dla-laika.md
> **Wersja:** 1.56.4
> **Dla kogo:** Osób bez doświadczenia technicznego
> Wersja ops (Docker, VPS, praca zdalna, migracje): `docs/instalacja-przenoszenie-systemu.md`.
>
> **Status:** instrukcja wymaga aktualizacji do PostgreSQL 18. Migracja
> aplikacji nie jest ukończona ani zweryfikowana w pełnym runtime. Kroki 2–7,
> 9–10 oraz stare przykłady SQLite są historyczne i nie stanowią bieżącej
> procedury instalacji, backupu ani odtworzenia. Status i aktualna ścieżka:
> [`DEPLOYMENT.md`](DEPLOYMENT.md).

---

## Spis treści

1. [Czego potrzebujesz](#1-czego-potrzebujesz)
2. [Szybki start — w 5 minut](#2-szybki-start--w-5-minut)
3. [Krok 1 — Zainstaluj Node.js](#3-krok-1--zainstaluj-nodejs)
4. [Krok 2 — Pobierz program](#4-krok-2--pobierz-program)
5. [Krok 3 — Skonfiguruj hasło](#5-krok-3--skonfiguruj-hasło)
6. [Krok 4 — Uruchom instalator](#6-krok-4--uruchom-instalator)
7. [Krok 5 — Uruchom aplikację](#7-krok-5--uruchom-aplikację)
8. [Przenoszenie aktywnych cenników ze starszej instalacji](#8-przenoszenie-aktywnych-cenników-ze-starszej-instalacji)
9. [Problemy i rozwiązania](#9-problemy-i-rozwiązania)
10. [Ściągawka](#10-ściągawka)

---

## 1. Czego potrzebujesz

| Wymaganie                | Opis                                                                      |
| ------------------------ | ------------------------------------------------------------------------- |
| **Komputer**             | Windows 10 lub 11 (może być też Linux, ale ta instrukcja dotyczy Windows) |
| **Internet**             | Do pobrania plików — ok. 500 MB                                           |
| **Konto administratora** | Aby zainstalować Node.js (możesz poprosić informatyka)                    |
| **Czas**                 | Ok. 10-15 minut                                                           |

Aplikacja działa **na Twoim komputerze** — nie potrzebujesz serwera, chmury ani internetu po instalacji.

---

## 2. Szybki start — w 5 minut

Jeśli już wiesz co robisz, oto cały proces w pigułce:

```
Krok 1: Wejdź na https://nodejs.org → kliknij duży zielony przycisk → zainstaluj
Krok 2: Wejdź na https://github.com/blodytrav3l3r/Oferty_PV → Code → Download ZIP → rozpakuj
Krok 3: W folderze: edytuj .env (auto-kopiowany z .env.example) i zmień hasło
Krok 4: Kliknij 2x na install.bat → poczekaj aż się skończy
Krok 5: Kliknij 2x na start.bat (lub dev.bat) → otwórz http://localhost:3000
```

Poniżej każdy krok jest szczegółowo opisany.

---

## 3. Krok 1 — Zainstaluj Node.js

**Node.js** to program, który pozwala uruchomić naszą aplikację. Bez niego nic nie zadziała.

### Instrukcja:

1. Otwórz przeglądarkę (Chrome, Edge, Firefox)
2. Wejdź na stronę: **https://nodejs.org**
3. Zobaczysz duży zielony przycisk z napisem **"LTS"** (z lewej strony)
4. **Kliknij ten przycisk** — rozpocznie się pobieranie pliku instalatora
5. Po pobraniu otwórz plik (np. `node-v22.x.x-x64.msi`)
6. **Klikaj "Dalej" / "Next"** we wszystkich oknach — nie zmieniaj niczego
7. Na końcu kliknij **"Zainstaluj" / "Install"**
8. Jeśli system zapyta "Czy chcesz zezwolić tej aplikacji na wprowadzanie zmian?" → kliknij **"Tak"**
9. Po instalacji kliknij **"Zakończ" / "Finish"**

### ✅ Gotowe! Node.js jest zainstalowany.

> **Uwaga:** Jeśli masz już zainstalowanego Node.js (np. od informatyka), możesz pominąć ten krok.

---

## 4. Krok 2 — Pobierz program

Musisz pobrać folder z programem na swój komputer.

### Opcja A: Pobierz plik ZIP (najprostsza)

1. Otwórz stronę w przeglądarce: **https://github.com/blodytrav3l3r/Oferty_PV**
2. Kliknij zielony przycisk **"Code"** (po prawej stronie)
3. W menu które się rozwinie kliknij **"Download ZIP"**
4. System pobierze plik `Oferty_PV-main.zip`
5. Otwórz folder gdzie został pobrany plik (zwykle "Pobrane" / "Downloads")
6. Kliknij PRAWYM przyciskiem myszy na `Oferty_PV-main.zip` → **"Wyodrębnij wszystko"** / **"Extract All"**
7. Wybierz folder docelowy (np. `C:\Programy\` lub `D:\Programy\`) i kliknij **"Wyodrębnij"**
8. Po rozpakowaniu wejdź do folderu `Oferty_PV-main` (lub `Oferty_PV`)

### Opcja B: Dla znających Git

Otwórz wiersz poleceń i wpisz:

```powershell
git clone https://github.com/blodytrav3l3r/Oferty_PV.git
cd Oferty_PV
```

### ✅ Gotowe! Program jest na Twoim komputerze.

> **WAŻNE:** Zapamiętaj gdzie rozpakowałeś folder! Będziesz go potrzebować za chwilę.

---

## 5. Krok 3 — Skonfiguruj hasło

Aplikacja potrzebuje hasła administratora. Musisz utworzyć plik konfiguracyjny `.env`.

### Co to jest plik .env?

To taki plik z ustawieniami — trzyma hasło i inne opcje. Jest prywatny (nikt go nie widzi).

### Instrukcja:

1. Otwórz folder z programem (ten który rozpakowałeś w Kroku 2)
2. Jeśli plik `.env` nie istnieje — **uruchom `install.bat`**, który sam utworzy `.env` na podstawie `.env.example`
3. Instalator **wygeneruje losowe hasło administratora** — zostanie ono wypisane w oknie instalatora oraz zapisane w pliku `.env` (wiersz `DEFAULT_ADMIN_PASSWORD=...`). **Zapisz je!**
4. (opcjonalnie) Chcesz użyć własnego hasła? Otwórz `.env` w Notatniku PRZED pierwszym uruchomieniem serwera i podmień wartość przy `DEFAULT_ADMIN_PASSWORD=` (minimum 6 znaków):
    ```
    DEFAULT_ADMIN_PASSWORD=MojeTajneHaslo123
    ```
5. Zapisz plik (Ctrl+S) i zamknij Notatnik

### ✅ Gotowe! Hasło skonfigurowane.

> **⚠️ UWAGA:** Hasło z pliku `.env` jest używane tylko przy tworzeniu konta administratora (przy pierwszym starcie serwera). Po utworzeniu konta zmiana hasła w `.env` **nie zadziała** — hasło zmieniasz wtedy w aplikacji (panel administratora).

---

## 6. Krok 4 — Uruchom instalator

Instalator pobierze wszystkie potrzebne biblioteki, przygotuje bazę danych i sprawdzi czy wszystko działa.

### Instrukcja:

1. Otwórz folder z programem (ten z Kroku 2)
2. Znajdź plik **`install.bat`** (ikona z kołem zębatym)
3. Kliknij na niego **DWUKROTNIE** lewym przyciskiem myszy
4. Pojawi się **czarne okno** (terminal / wiersz poleceń)
5. **NIE ZAMYKAJ tego okna!** Instalator pracuje:
    - Najpierw sprawdzi czy Node.js jest zainstalowany
    - Potem pobierze biblioteki (może to trwać 2-5 minut)
    - Następnie przygotuje bazę danych
    - Na końcu sprawdzi czy wszystko jest OK
6. Gdy zobaczysz napis:

    ```
    ===========================================================
      Instalacja zakonczona
    ===========================================================
    Uruchom dev.bat aby zaczac prace.
    ```

    oznacza to, że instalacja się udała

7. Kliknij dowolny klawisz aby zamknąć okno

### Jeśli pojawił się błąd:

Nie panikuj! Zobacz sekcję [Problemy i rozwiązania](#9-problemy-i-rozwiązania). Najczęściej pomaga:

- Sprawdzenie czy Node.js został poprawnie zainstalowany (wróć do Kroku 1)
- Uruchomienie instalatora ponownie (jeszcze raz kliknij na `install.bat`)

### ✅ Gotowe! Program zainstalowany.

---

## 7. Krok 5 — Uruchom aplikację

Teraz uruchomisz aplikację i zobaczysz ją w przeglądarce.

### Instrukcja:

1. Otwórz folder z programem
2. Znajdź plik **`start.bat`** (lub `dev.bat` — to to samo)
3. Kliknij na niego **DWUKROTNIE**
4. Pojawi się czarne okno — aplikacja się uruchamia
5. **Poczekaj** aż zobaczysz w oknie:

    ```
    Aplikacja: http://localhost:3000
    Backend:  http://localhost:3000/health
    ```

    To może potrwać 10-30 sekund

6. **NIE ZAMYKAJ** tego okna! Dopóki jest otwarte, aplikacja działa
7. Otwórz swoją przeglądarkę (Chrome, Edge, Firefox)
8. W pasku adresu (na górze) wpisz: **http://localhost:3000**
9. Naciśnij Enter

### Logowanie:

1. Powinieneś zobaczyć stronę logowania
2. W polu **"Login"** wpisz: `admin`
3. W polu **"Hasło"** wpisz: to hasło które ustawiłeś w `.env` (Krok 3)
4. Kliknij **"Zaloguj"**

### ✅ Gotowe! Aplikacja działa.

> **WAŻNE:** Za każdym razem gdy chcesz uruchomić aplikację:
>
> 1. Otwórz folder
> 2. Kliknij 2x na `start.bat` (lub `dev.bat` — to to samo)
> 3. Otwórz http://localhost:3000 w przeglądarce
> 4. Gdy skończysz pracę, zamknij czarne okno

---

## 8. Przenoszenie aktywnych cenników ze starszej instalacji

PostgreSQL 18 jest jedynym docelowym silnikiem bazy. Przy cutoverze ze starszej
instalacji przenoszone są wyłącznie aktywne cenniki rur, studni i PRECO. Oferty,
klienci, użytkownicy, zamówienia, sesje, drafty i historia wersji pozostają w
starej bazie i nie są importowane. Plik SQLite ani backup SQLite nie może być
przywrócony jako baza aplikacji PostgreSQL.

Ta operacja wymaga administratora systemu i osobnej zgody na cutover. Wykonaj
ją tylko według [runbooka aktywnych cenników](cutover/active-pricelists.md), po
potwierdzeniu gotowości PostgreSQL 18 i spełnieniu wszystkich bramek w
[`DEPLOYMENT.md`](DEPLOYMENT.md). Migracja runtime nadal trwa, więc ta
instrukcja nie jest samodzielnym przewodnikiem uruchomienia produkcyjnego.

## 9. Problemy i rozwiązania

### "Node.js nie jest zainstalowany" / [BŁĄD] Brak Node.js

**Przyczyna:** Nie zainstalowałeś Node.js (Krok 1) lub instalacja się nie udała.

**Rozwiązanie:**

1. Wejdź na https://nodejs.org
2. Kliknij duży zielony przycisk LTS (lewa strona)
3. Uruchom pobrany plik
4. Klikaj "Dalej" aż do końca
5. Jeśli system pyta "Czy zezwolić?" → "Tak"
6. Po instalacji uruchom `install.bat` jeszcze raz

### "Nie mogę znaleźć plików .bat"

**Przyczyna:** Nie rozpakowałeś pliku ZIP lub rozpakowałeś w złym miejscu.

**Rozwiązanie:**

1. Otwórz folder "Pobrane" (Downloads) w Eksploratorze Windows
2. Znajdź plik `Oferty_PV-main.zip`
3. Kliknij PRAWYM → "Wyodrębnij wszystko"
4. Wybierz folder np. `C:\Programy\` lub `D:\MojeProgramy\`
5. Kliknij "Wyodrębnij"
6. Wejdź do rozpakowanego folderu — powinieneś widzieć pliki `install.bat`, `dev.bat`, itp.

### "Port 3000 zajęty" — czarne okno pyta o pozwolenie

**Przyczyna:** Inny program już używa portu 3000 (np. inna kopia aplikacji).

**Rozwiązanie:**

1. W czarnym oknie pojawi się pytanie: "Zwolnić port? (T=tak, N=nie)"
2. Wpisz: **T** (tak) i naciśnij Enter
3. Program sam zamknie starą aplikację i uruchomi nową

### Aplikacja się nie uruchamia — błąd w czarnym oknie

**Przyczyna:** Może być wiele przyczyn. Zrób screena i wyślij do pomocy technicznej.

**Co możesz sam sprawdzić:**

1. Czy Node.js jest zainstalowany? Otwórz wiersz poleceń i wpisz: `node --version` — powinieneś zobaczyć `v22.x.x` lub nowszą
2. Czy plik `.env` istnieje? Sprawdź w folderze — jeśli nie ma, wróć do [Kroku 3](#5-krok-3--skonfiguruj-hasło)
3. Czy plik .env ma ustawione hasło? Otwórz .env w Notatniku i sprawdź linię `DEFAULT_ADMIN_PASSWORD=...`

### Strona logowania się nie pokazuje

**Przyczyna:** Aplikacja nie jest uruchomiona lub uruchomiła się na innym porcie.

**Rozwiązanie:**

1. Sprawdź czy czarne okno (dev.bat) jest otwarte
2. W oknie powinno być napisane `Aplikacja: http://localhost:3000`
3. Jeśli nie ma takiego napisu — poczekaj jeszcze chwilę
4. Jeśli okno jest zamknięte — uruchom `dev.bat` ponownie
5. W pasku adresu przeglądarki wpisz dokładnie: **http://localhost:3000** (nie https!)

### Nie mogę się zalogować — "Nieprawidłowe hasło"

**Przyczyna:** Hasło w pliku .env jest inne niż to które wpisujesz.

**Rozwiązanie:**

1. Otwórz plik `.env` Notatnikiem
2. Sprawdź linię: `DEFAULT_ADMIN_PASSWORD=...`
3. Zapamiętaj hasło (za `=` jest hasło)
4. Na stronie logowania wpisz:
    - Login: `admin`
    - Hasło: to z pliku .env
5. Jeśli nadal nie działa: zamknij czarne okno, zmień hasło w .env, uruchom `dev.bat` od nowa

### install.bat się wysypał (error)

**Przyczyna:** Różne — najczęściej problem z internetem lub antywirusem.

**Rozwiązanie:**

1. Sprawdź czy masz dostęp do internetu
2. Wyłącz na chwilę antywirusa (Windows Defender może blokować npm)
3. Uruchom `install.bat` jeszcze raz
4. Jeśli nadal nie działa — zrób screenshot i wyślij do pomocy

### ⚠️ OSTATECZNOŚĆ: Przywracanie systemu

Jeśli całkowicie zablokowałeś system:

1. Wejdź do folderu z programem
2. Usuń folder `node_modules`
3. Usuń folder `data`
4. Usuń folder `generated`
5. Usuń folder `dist`
6. Usuń plik `.env`
7. Zacznij od początku (Krok 1)

---

## 10. Ściągawka

| Komenda / Plik           | Kiedy używać                    | Opis                                                                |
| ------------------------ | ------------------------------- | ------------------------------------------------------------------- |
| `install.bat`            | **RAZ po pobraniu programu**    | Instaluje biblioteki i przygotowuje bazę. `--skip-seed` pomija seed |
| `start.bat`              | **ZAWSZE gdy chcesz pracować**  | Główne wejście: domyślnie dev, `--prod` tryb produkcyjny            |
| `dev.bat`                | **ZAMIAST start.bat**           | Alias do `start.bat` (to samo)                                      |
| `start.bat --prod`       | **Do użytku produkcyjnego**     | Tryb produkcyjny (szybszy, bez debugowania)                         |
| `npm run backup`         | **Regularnie (np. co tydzień)** | Tworzy kopię bezpieczeństwa bazy danych                             |
| `npm run restore <plik>` | **Przy przenoszeniu danych**    | Przywraca bazę z kopii bezpieczeństwa                               |
| `build.bat`              | **Przed wdrożeniem na serwer**  | Kompiluje program do wersji produkcyjnej                            |

### Gdzie są pliki?

| Plik / Folder   | Opis                                                      |
| --------------- | --------------------------------------------------------- |
| PostgreSQL 18   | Docelowa baza danych; migracja i weryfikacja nadal trwają |
| `data/backups/` | Folder z archiwami backupu PostgreSQL (`.dump`)           |
| `.env`          | Plik z hasłem i ustawieniami                              |
| `node_modules/` | Biblioteki (nie ruszaj, instalator sam zarządza)          |
| `dist/`         | Skompilowany program (tworzony przez `build.bat`)         |

### 💡 Złote zasady:

1. **Zawsze zmieniaj domyślne hasło** w pliku `.env`
2. **Backup PostgreSQL** wykonuj zgodnie z procedurą administratora systemu
3. **Nie zamykaj czarnego okna** — dopóki okno jest otwarte, aplikacja działa
4. **Nie usuwaj folderu `node_modules`** — instalator sam go utworzył i zarządza nim
5. **Gdy coś nie działa** — zgłoś problem administratorowi systemu
6. Aktualizacji i odtworzenia bazy nie wykonuj według tej historycznej instrukcji
7. Przenoszenie ze starszej instalacji obejmuje tylko aktywne cenniki według runbooka

---

> **Dokumentacja wygenerowana na podstawie analizy projektu S.O.K. — System Ofert i Kalkulacji**
> W razie problemów: skontaktuj się z administratorem systemu
