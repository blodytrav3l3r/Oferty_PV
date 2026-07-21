# Instrukcja instalacji WITROS Oferty PV — krok po kroku dla laika

> **Plik:** docs/plans/instalacja-krok-po-kroku-dla-laika.md
> **Wersja:** 1.8.0
> **Dla kogo:** Osób bez doświadczenia technicznego

---

## Spis treści

1. [Czego potrzebujesz](#1-czego-potrzebujesz)
2. [Szybki start — w 5 minut](#2-szybki-start--w-5-minut)
3. [Krok 1 — Zainstaluj Node.js](#3-krok-1--zainstaluj-nodejs)
4. [Krok 2 — Pobierz program](#4-krok-2--pobierz-program)
5. [Krok 3 — Skonfiguruj hasło](#5-krok-3--skonfiguruj-hasło)
6. [Krok 4 — Uruchom instalator](#6-krok-4--uruchom-instalator)
7. [Krok 5 — Uruchom aplikację](#7-krok-5--uruchom-aplikację)
8. [Przenoszenie bazy ze starego komputera](#8-przenoszenie-bazy-ze-starego-komputera)
9. [Problemy i rozwiązania](#9-problemy-i-rozwiązania)
10. [Ściągawka](#10-ściągawka)

---

## 1. Czego potrzebujesz

| Wymaganie | Opis |
|-----------|------|
| **Komputer** | Windows 10 lub 11 (może być też Linux, ale ta instrukcja dotyczy Windows) |
| **Internet** | Do pobrania plików — ok. 500 MB |
| **Konto administratora** | Aby zainstalować Node.js (możesz poprosić informatyka) |
| **Czas** | Ok. 10-15 minut |

Aplikacja działa **na Twoim komputerze** — nie potrzebujesz serwera, chmury ani internetu po instalacji.

---

## 2. Szybki start — w 5 minut

Jeśli już wiesz co robisz, oto cały proces w pigułce:

```
Krok 1: Wejdź na https://nodejs.org → kliknij duży zielony przycisk → zainstaluj
Krok 2: Wejdź na https://github.com/blodytrav3l3r/Oferty_PV → Code → Download ZIP → rozpakuj
Krok 3: W folderze: skopiuj .env.example → .env; edytuj .env i zmień hasło
Krok 4: Kliknij 2x na install.bat → poczekaj aż się skończy
Krok 5: Kliknij 2x na dev.bat → otwórz http://localhost:5173
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
5. Po pobraniu otwórz plik (np. `node-v20.x.x-x64.msi`)
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
2. Znajdź plik o nazwie **`.env.example`** (ikona pliku, niebieska)
   > Jeśli nie widzisz rozszerzeń plików: w Eksploratorze Windows kliknij **"Widok"** → zaznacz **"Rozszerzenia nazw plików"**
3. Kliknij PRAWYM przyciskiem myszy na `.env.example` → **"Kopiuj"**
4. Kliknij PRAWYM w pustym miejscu (w tym samym folderze) → **"Wklej"**
5. Powstał plik **"Kopia — .env.example"**
6. Kliknij na niego PRAWYM → **"Zmień nazwę"**
7. Zaznacz całą nazwę i wpisz: **`.env`** (tylko `.env`, nic więcej)
8. Kliknij Enter
9. System zapyta "Czy na pewno chcesz zmienić rozszerzenie?" → kliknij **"Tak"**
10. Teraz kliknij PRAWYM na `.env` → **"Otwórz za pomocą"** → **"Notatnik"**
11. Znajdź linię (mniej więcej w połowie):
    ```
    DEFAULT_ADMIN_PASSWORD=anim123456
    ```
12. Zaznacz `anim123456` i wpisz **swoje własne hasło** (minimum 6 znaków)
    > Np. `DEFAULT_ADMIN_PASSWORD=MojeTajneHaslo123`
13. Kliknij **"Plik"** → **"Zapisz"** (lub naciśnij **Ctrl+S**)
14. Zamknij Notatnik

### ✅ Gotowe! Hasło skonfigurowane.

> **⚠️ UWAGA:** Hasło `anim123456` to hasło przykładowe. Jeśli go nie zmienisz, KAŻDY kto uruchomi aplikację będzie mógł się zalogować jako administrator. **Zawsze zmieniaj hasło!**

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
2. Znajdź plik **`dev.bat`** (lub `start.bat`)
3. Kliknij na niego **DWUKROTNIE**
4. Pojawi się czarne okno — aplikacja się uruchamia
5. **Poczekaj** aż zobaczysz w oknie:
   ```
   Frontend: http://localhost:5173
   Backend:  http://localhost:3000/health
   ```
   To może potrwać 10-30 sekund

6. **NIE ZAMYKAJ** tego okna! Dopóki jest otwarte, aplikacja działa
7. Otwórz swoją przeglądarkę (Chrome, Edge, Firefox)
8. W pasku adresu (na górze) wpisz: **http://localhost:5173**
9. Naciśnij Enter

### Logowanie:

1. Powinieneś zobaczyć stronę logowania
2. W polu **"Login"** wpisz: `admin`
3. W polu **"Hasło"** wpisz: to hasło które ustawiłeś w `.env` (Krok 3)
4. Kliknij **"Zaloguj"**

### ✅ Gotowe! Aplikacja działa.

> **WAŻNE:** Za każdym razem gdy chcesz uruchomić aplikację:
> 1. Otwórz folder
> 2. Kliknij 2x na `dev.bat`
> 3. Otwórz http://localhost:5173 w przeglądarce
> 4. Gdy skończysz pracę, zamknij czarne okno

---

## 8. Przenoszenie bazy ze starego komputera

Masz już dane (produkty, oferty, cenniki) na starym komputerze i chcesz je przenieść na nowy? **Nie musisz zaczynać od zera!**

### Co to jest "baza danych"?

Wyobraź sobie plik Excel z wszystkimi danymi. Tutaj baza to jeden plik: `data/app_database.sqlite`. Przeniesienie go na nowy komputer = wszystkie dane są przeniesione.

### Krok po kroku — przenoszenie danych

#### Na STARYM komputerze (zrób kopię):

1. Otwórz folder z programem na starym komputerze
2. Kliknij PRAWYM w pustym miejscu w folderze (przytrzymaj Shift i kliknij prawym)
3. Wybierz **"Otwórz w terminalu"** lub **"Otwórz okno PowerShell tutaj"**
4. Wpisz w oknie: `npm run backup`
5. Naciśnij Enter
6. Zobaczysz napis: `[Backup] Utworzono: data/backups/backup_...`
7. Wejdź do folderu `data/backups/` — zobaczysz plik `backup_YYYY-MM-DD_TIMESTAMP.sqlite`
8. **Skopiuj ten plik na pendrive** (lub wyślij przez e-mail / chmurę)

#### Na NOWYM komputerze (przywróć dane):

1. Wykonaj Kroki 1-4 z tej instrukcji (zainstaluj Node.js, pobierz program, skonfiguruj .env, uruchom install.bat)
2. **Nie seeduj bazy** — nie uruchamiaj ponownie `install.bat`
3. Skopiuj plik backupu (ze starego komputera) do folderu `data/backups/` na nowym komputerze
4. Kliknij PRAWYM w pustym miejscu w folderze → **"Otwórz w terminalu"**
5. Wpisz: `npm run backup:restore -- data/backups/backup_NAZWA_PLIKU.sqlite`
   > Zamiast `backup_NAZWA_PLIKU.sqlite` wpisz rzeczywistą nazwę pliku
6. Naciśnij Enter
7. System zapyta: "Czy na pewno przywrócić backup?" — wpisz: `tak` i naciśnij Enter
8. Zobaczysz: "Baza przywrócona z: ..."
9. Uruchom aplikację (`dev.bat`) — wszystkie dane są już na miejscu

### ⚠️ WAŻNE PRZY PRZENOSZENIU:

- **Wersja programu na starym i nowym komputerze powinna być taka sama** (sprawdź w pliku `VERSION`)
- Jeśli wersje są różne, po przywróceniu bazy uruchom `install.bat` jeszcze raz (zaktualizuje schemat bazy)
- Po wykonaniu backupu na starym komputerze możesz bezpiecznie wyłączyć stary komputer

---

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
1. Czy Node.js jest zainstalowany? Otwórz wiersz poleceń i wpisz: `node --version` — powinieneś zobaczyć `v20.x.x`
2. Czy plik `.env` istnieje? Sprawdź w folderze — jeśli nie ma, wróć do [Kroku 3](#5-krok-3--skonfiguruj-hasło)
3. Czy plik .env ma ustawione hasło? Otwórz .env w Notatniku i sprawdź linię `DEFAULT_ADMIN_PASSWORD=...`

### Strona logowania się nie pokazuje

**Przyczyna:** Aplikacja nie jest uruchomiona lub uruchomiła się na innym porcie.

**Rozwiązanie:**
1. Sprawdź czy czarne okno (dev.bat) jest otwarte
2. W oknie powinno być napisane `Frontend: http://localhost:5173`
3. Jeśli nie ma takiego napisu — poczekaj jeszcze chwilę
4. Jeśli okno jest zamknięte — uruchom `dev.bat` ponownie
5. W pasku adresu przeglądarki wpisz dokładnie: **http://localhost:5173** (nie https!)

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

| Komenda / Plik | Kiedy używać | Opis |
|----------------|--------------|------|
| `install.bat` | **RAZ po pobraniu programu** | Instaluje wszystkie biblioteki i przygotowuje bazę |
| `dev.bat` | **ZAWSZE gdy chcesz pracować** | Uruchamia aplikację (tryb developerski) |
| `start.bat` | **ZAMIAST dev.bat** | To samo co dev.bat |
| `prod.bat` | **Do użytku produkcyjnego** | Uruchamia w trybie produkcyjnym (szybszy, bez debugowania) |
| `npm run backup` | **Regularnie (np. co tydzień)** | Tworzy kopię bezpieczeństwa bazy danych |
| `npm run backup:restore -- <plik>` | **Przy przenoszeniu danych** | Przywraca bazę z kopii bezpieczeństwa |
| `build.bat` | **Przed wdrożeniem na serwer** | Kompiluje program do wersji produkcyjnej |

### Gdzie są pliki?

| Plik / Folder | Opis |
|---------------|------|
| `data/app_database.sqlite` | **BAZA DANYCH** — najważniejszy plik! To w nim są wszystkie dane |
| `data/backups/` | Folder z kopiami bezpieczeństwa |
| `.env` | Plik z hasłem i ustawieniami |
| `node_modules/` | Biblioteki (nie ruszaj, instalator sam zarządza) |
| `dist/` | Skompilowany program (tworzony przez `build.bat`) |

### 💡 Złote zasady:

1. **Zawsze zmieniaj domyślne hasło** w pliku `.env`
2. **Rób backup regularnie** — `npm run backup` raz w tygodniu
3. **Nie zamykaj czarnego okna** — dopóki okno jest otwarte, aplikacja działa
4. **Nie usuwaj folderu `node_modules`** — instalator sam go utworzył i zarządza nim
5. **Gdy coś nie działa** — uruchom `install.bat` jeszcze raz (to naprawia większość problemów)
6. **Przed aktualizacją** zrób backup (`npm run backup`)
7. **Przy przenoszeniu na nowy komputer** → najpierw backup na starym, potem restore na nowym

---

> **Dokumentacja wygenerowana na podstawie analizy projektu WITROS Oferty PV**
> W razie problemów: skontaktuj się z administratorem systemu
