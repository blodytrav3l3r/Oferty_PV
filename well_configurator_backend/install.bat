@echo off
echo Sprawdzanie Pythona...

for /f "tokens=2" %%v in ('python --version 2^>nul') do set "PY_VERSION=%%v"
if not defined PY_VERSION (
    echo [BLAD] Python nie jest zainstalowany lub nie jest w PATH.
    echo        Pobierz Python 3.11: https://www.python.org/downloads/release/python-3119/
    pause
    exit /b 1
)

echo Wykryto Python %PY_VERSION%

for /f "tokens=1 delims=." %%m in ("%PY_VERSION%") do set "PY_MAJOR=%%m"
for /f "tokens=2 delims=." %%n in ("%PY_VERSION%") do set "PY_MINOR=%%n"

if "%PY_MAJOR%" neq "3" (
    echo [BLAD] Wymagany Python 3.x. Wykryto %PY_VERSION%.
    pause
    exit /b 1
)

if %PY_MINOR% GEQ 13 (
    echo.
    echo [BLAD] Python %PY_VERSION% nie jest wspierany.
    echo        Niektore pakiety (lightgbm, ortools, experta) nie maja
    echo        gotowych instalatorow dla Python 3.13+.
    echo.
    echo        Zainstaluj Python 3.11 lub 3.12:
    echo        https://www.python.org/downloads/release/python-3119/
    pause
    exit /b 1
)

echo Tworzenie wirtualnego srodowiska...
python -m venv venv
if errorlevel 1 (
    echo [BLAD] Blad podczas tworzenia venv.
    pause
    exit /b 1
)

echo Aktywacja venv i instalacja pakietow...
call venv\Scripts\activate.bat
if exist "..\vendor\python_wheels" (
    echo (tryb offline — lokalne pliki .whl)
    pip install --no-index --find-links ..\vendor\python_wheels\ -r requirements.txt
) else (
    echo (tryb online — pobieranie z internetu)
    pip install -r requirements.txt
)
if errorlevel 1 (
    echo.
    echo [BLAD] Instalacja pakietow nie powiodla sie.
    echo        Moze to byc spowodowane niezgodnoscia z wersja Pythona.
    echo        Upewnij sie, ze masz Python 3.11 lub 3.12.
    pause
    exit /b 1
)

echo.
echo [OK] Instalacja zakonczona pomyslnie.
pause