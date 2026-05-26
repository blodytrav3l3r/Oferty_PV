@echo off
setlocal enabledelayedexpansion

chcp 65001 >nul 2>&1

echo =========================================
echo    Python AI Backend - Uruchamianie
echo =========================================
echo.

where python >nul 2>&1
if errorlevel 1 (
    echo [BLAD] Python nie jest zainstalowany lub nie jest w PATH.
    echo Pobierz z: https://python.org/
    pause
    exit /b 1
)

for /f "tokens=2" %%v in ('python --version 2^>nul') do set "PY_VERSION=%%v"
echo [OK] Python: !PY_VERSION!
echo.

for /f "tokens=1 delims=." %%m in ("!PY_VERSION!") do set "PY_MAJOR=%%m"
if "!PY_MAJOR!"=="3" (
    for /f "tokens=2 delims=." %%n in ("!PY_VERSION!") do (
        if %%n GEQ 13 (
            echo [BLAD] Python !PY_VERSION! nie jest wspierany.
            echo        Pakiety takie jak lightgbm, ortools, experta moga nie miec
            echo        gotowych instalatorow dla tej wersji Pythona.
            echo.
            echo        Rozwiazanie:
            echo        1. Odinstaluj Python !PY_VERSION!
            echo        2. Zainstaluj Python 3.11 lub 3.12
            echo           https://www.python.org/downloads/release/python-3119/
            echo        3. Upewnij sie, ze dodales Python do PATH podczas instalacji
            pause
            exit /b 1
        )
    )
)

if not exist "venv" (
    echo [INFO] Folder venv nie istnieje. Tworzenie...
    python -m venv venv
    if errorlevel 1 (
        echo [BLAD] Blad tworzenia venv.
        pause
        exit /b 1
    )
    echo [OK] venv utworzone.
    echo.
)

if not exist "venv\Scripts\activate.bat" (
    echo [BLAD] Plik activate.bat nie znaleziony w venv.
    echo        Uszkodzone srodowisko wirtualne.
    echo        Zalecane: usun folder venv i stworz na nowo.
    pause
    exit /b 1
)

call venv\Scripts\activate.bat
if errorlevel 1 (
    echo.
    echo [BLAD] Blad aktywacji srodowiska wirtualnego.
    pause
    exit /b 1
)

echo [OK] Srodowisko wirtualne aktywowane
echo.

if exist "requirements.txt" (
    echo ---------- Sprawdzanie zaleznosci ----------
    pip show sqlalchemy >nul 2>&1
    if errorlevel 1 (
        echo [INFO] Brakuje pakietow Python. Instalowanie...
        if exist "..\vendor\python_wheels" (
            echo        (tryb offline — lokalne pliki .whl)
            pip install --no-index --find-links ..\vendor\python_wheels\ -r requirements.txt
        ) else (
            echo        (tryb online — pobieranie z internetu)
            pip install -r requirements.txt
        )
        if errorlevel 1 (
            echo.
            echo [BLAD] Instalacja zaleznosci nie powiodla sie.
            echo        Moze to byc spowodowane niezgodnoscia z wersja Pythona.
            echo        Upewnij sie, ze masz Python 3.11 lub 3.12.
            pause
            exit /b 1
        )
        echo [OK] Zaleznosci Python zainstalowane.
    ) else (
        echo [OK] Zaleznosci Python sa aktualne.
    )
    echo.
)

python -c "import sqlalchemy" >nul 2>&1
if errorlevel 1 (
    echo.
    echo [BLAD] Pakiety Python sa zainstalowane, ale nie mozna ich zaimportowac.
    echo        Moze to oznaczac niezgodnosc z wersja Pythona.
    echo.
    echo        Sprawdz czy masz Python 3.11 lub 3.12.
    echo        Obecna wersja: !PY_VERSION!
    pause
    exit /b 1
)

echo ---------- Uruchamianie serwera ----------
echo.

if not exist "run.py" (
    echo [BLAD] Plik run.py nie znaleziony!
    pause
    exit /b 1
)

:restart
echo [INFO] Uruchamianie serwera Python (run.py)...
python run.py
set "EXIT_CODE=!ERRORLEVEL!"
echo.
echo [INFO] Serwer zatrzymany (kod: !EXIT_CODE!).
if "!EXIT_CODE!"=="0" (
    echo [INFO] Ctrl+C — normalne zamkniecie.
    pause
    exit /b 0
)
echo [INFO] Restart za 3 sekundy...
timeout /t 3 /nobreak >nul 2>&1
goto restart