# Well Configurator Backend (Offline-First)

Modularny, produkcyjny system konfiguratora studni kanalizacyjnych, zbudowany pod architekturę offline-first. API zrealizowano w FastAPI, obliczenia poprzez Google OR-Tools CP-SAT, a zasady biznesowe (formy standardowe, redukcje, zapasy) we własnym Rule Engine. Do predykcyjnego układania skonstruowanych wariantów użyty jest stelaż pod model Machine Learning (LightGBM).

## Technologie

- **Wymagania**: Python 3.10+
- **API**: FastAPI, Pydantic
- **Modelowanie / Baza danych**: SQLAlchemy (SQLite wbudowany jako tryb lokalny - offline-first, przygotowane w `tables.py` obiekty na synchronizację do centralnej bazy)
- **Solver**: Google OR-Tools (moduł `optimizer/cp_optimizer.py`) do układania z klocków (np. 1000mm, 500mm, 250mm) optymalnej sumy dla wysokości.
- **ML Ranking**: Szablon rankingowy na podstawie modułu `ml/ranker.py` (rozszerzalny dla np. LightGBM `lgb.Booster`).
- **Testy**: `pytest`

## Architektura i Pakiety

- `api/`: Definicja FastAPI Endpointów (`endpoints.py`), modeli Pydantic oraz definicja samej aplikacji.
- `database/`: Konfiguracja SQLAlchemy, pliki CRUD i modele encji `tables.py`.
- `rule_engine/`: Zestaw szukanych/najlepszych reguł dla wyciągania płyt i dennic.
- `optimizer/`: Zaawansowany model CP-SAT Solver z optymalizacją wybierania jak zdefiniowanych kręgów komina budowlanego.
- `configuration_generator/`: Element docelowy agregujący dane do `WellConfigResult`.
- `validator/`: Moduł do detekcji dziur przejściowych i kolidowania.
- `data/`: Plik `seed.py` napełniający katalog do pustej bazy startowej.
- `sync/`: Symulator "Offline-First" API dla pobierania katalogu lub wypychania dokonanych konstrukcji.
- `tests/`: Skrypty sprawdzające API w formacie `pytest`.

## Jak uruchomić system

Dla użytkowników systemu Windows przygotowano skrypty ułatwiające uruchomienie aplikacji:

1. **Instalacja (pierwsze uruchomienie)**:
   Uruchom plik `install.bat` (dwukrotne kliknięcie). Skrypt automatycznie:

- Zweryfikuje obecność języka Python.
- Utworzy wirtualne środowisko `venv`.
- Zainstaluje wszystkie wymagane pakiety z pliku `requirements.txt`.

2. **Uruchomienie Serwera API**:
   Uruchom plik `start.bat`. Skrypt ten samoistnie aktywuje środowisko wirtualne i podniesie serwer korzystając z `run.py`.

> Podczas pierwszego uruchomienia API (port `:8000`) dokona migracji bazy danych SQLite i zasilenia tabel testowymi elementami z użyciem modułu `seed.py`.

3. **Dokumentacja API**:
   Świetne interaktywne API ukaże się po otwarciu przeglądarki pod adresem:
   http://localhost:8000/docs
   _(Tam możliwa jest interakcja z endpointem `/api/v1/configure` wyliczającym wymaganą wysokość studni DN1500 / DN2000)._

## Model Redukcji w Przykładowej Studni

Jeśli konfigurujesz DN1500 na wysokość 3500mm, algorytm:

1.  Znajdzie optymalną Dennicę DN1500 H=600.
2.  Spróbuje zoptymalizować pozostałe miejsce z głównych kręgów DN1500 używając CP-SAT.
3.  Zaaplikuje płytę redukcyjną z uwzględnieniem tolerancji zapasów - DN1500/DN1000 H=200.
4.  Zamknie konstrukcję Konusem DN1000.
5.  Jeżeli wystąpiły zapasy w rejonie przejść lub zmuszono studnię do zrobienia "Kreg_OT" funkcja natychmiastowo to wymusi we fazie `validator.py`.
6.  Dobierze domyślny właz (~15 cm) jako warstwę wieńczącą.
