# Instrukcja Migracji i Instalacji Systemu WITROS Oferty PV

Niniejszy dokument opisuje krok po kroku, jak przenieść bazę danych na centralny serwer oraz jak skonfigurować stanowiska pracy dla pracowników.

---

## 1. Przygotowanie Serwera Bazodanowego (CouchDB)

Serwer docelowy musi pełnić rolę centralnego magazynu danych.

### A. Instalacja CouchDB
1. Pobierz instalator CouchDB ze strony [couchdb.apache.org](https://couchdb.apache.org/).
2. Zainstaluj program, wybierając opcję **Single Node**.
3. Podczas instalacji ustaw:
   - **Admin Username**: `admin`
   - **Admin Password**: `admin123` (lub inne, jeśli zmienisz je również w pliku `.env`)

### B. Konfiguracja Dostępu Sieciowego
Domyślnie CouchDB słucha tylko na `localhost`. Aby pracownicy mogli się połączyć:
1. Otwórz panel **Fauxton** w przeglądarce na serwerze: `http://127.0.0.1:5984/_utils/`.
2. Przejdź do sekcji **Settings** (ikona koła zębatego) -> **Configuration**.
3. Znajdź sekcję `chttpd` i zmień `bind_address` z `127.0.0.1` na `0.0.0.0`.
4. Kliknij zielony przycisk potwierdzenia.

### C. Konfiguracja CORS (Kluczowe dla aplikacji)
W tej samej sekcji **Settings**:
1. Wybierz zakładkę **CORS**.
2. Kliknij **Enable CORS**.
3. W sekcji **Origins** wybierz `All domains (*)` lub dodaj adresy IP komputerów pracowników.
4. Zaznacz wszystkie metody (GET, POST, PUT, DELETE, etc.) i zaznacz `Allow Credentials`.

---

## 2. Przeniesienie Danych (Migracja)

### Metoda 1: Replikacja (Zalecana)
Jeśli na obecnym komputerze masz już dane w CouchDB:
1. W Fauxton na **serwerze docelowym** przejdź do zakładki **Replication**.
2. Kliknij **New Replication**.
3. **Source**: Remote Database. Wpisz URL obecnego komputera: `http://admin:admin123@ADRES_IP_STAREGO_KOMPUTERA:5984/nazwa_bazy`.
4. **Target**: Local Database. Wpisz nazwę bazy.
5. Powtórz dla wszystkich baz (zaczynających się od `pv_`).

### Metoda 2: Fizyczne kopiowanie plików
Jeśli chcesz przenieść wszystko naraz (wymaga zatrzymania usługi):
1. Zatrzymaj usługę `Apache CouchDB` na obu komputerach.
2. Skopiuj folder danych:
   - **Ścieżka**: `C:\Program Files\Apache CouchDB\data\`
3. Przenieś zawartość na serwer w to samo miejsce.
4. Uruchom usługę na serwerze.

---

## 3. Instalacja na Komputerach Pracowników

Wykonać na każdym komputerze, na którym ma działać aplikacja.

### Krok 1: Instalacja Node.js
1. Pobierz i zainstaluj **Node.js (wersja LTS)** z [nodejs.org](https://nodejs.org/).

### Krok 2: Kopiowanie Aplikacji
1. Skopiuj cały folder `Oferty_PV` z obecnego komputera na komputer pracownika (np. na `C:\WITROS\Oferty_PV`).
   > [!TIP]
   > Nie musisz kopiować folderu `node_modules`. Skrypt startowy zainstaluje go automatycznie.

### Krok 3: Konfiguracja połączenia z serwerem
1. W folderze aplikacji na komputerze pracownika otwórz plik `.env` za pomocą Notatnika.
2. Zmień adres `localhost` na **adres IP serwera**.
   - **Stara wersja**: `COUCHDB_URL=http://admin:admin123@localhost:5984`
   - **Nowa wersja**: `COUCHDB_URL=http://admin:admin123@ADRES_IP_SERWERA:5984`
3. Zapisz plik.

### Krok 4: Pierwsze Uruchomienie
1. Kliknij dwukrotnie plik `PV_START.bat`.
2. System sprawdzi Node.js, zainstaluje brakujące dodatki i zainicjuje bazy danych.
3. Przeglądarka otworzy się automatycznie na stronie aplikacji.

---

## Podsumowanie Ścieżek

| Element | Lokalizacja domyślna |
| :--- | :--- |
| **Pliki aplikacji** | `g:\GitHub\Oferty_PV` (skopiować do pracowników) |
| **Baza SQLite (stara)** | `g:\GitHub\Oferty_PV\data\app_database.sqlite` |
| **Bazy CouchDB (pliki)** | `C:\Program Files\Apache CouchDB\data` |
| **Konfiguracja IP** | `g:\GitHub\Oferty_PV\.env` |
| **Plik startowy** | `g:\GitHub\Oferty_PV\PV_START.bat` |

---
> [!IMPORTANT]
> Upewnij się, że serwer ma stały adres IP w sieci lokalnej, aby pracownicy nie tracili połączenia po restarcie routera.
