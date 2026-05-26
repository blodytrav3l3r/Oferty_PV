@echo off
setlocal enabledelayedexpansion

chcp 65001 >nul 2>&1

echo =========================================
echo    WITROS Oferty - Uruchamianie pelne
echo =========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo [BLAD] Node.js nie jest zainstalowany.
    echo Pobierz z: https://nodejs.org/
    pause
    exit /b 1
)

where python >nul 2>&1
if errorlevel 1 (
    echo [BLAD] Python nie jest zainstalowany.
    echo Pobierz z: https://python.org/
    pause
    exit /b 1
)

for /f "tokens=2" %%v in ('python --version 2^>nul') do set "PY_VER=%%v"
for /f "tokens=1 delims=." %%m in ("%PY_VER%") do set "PY_MAJOR=%%m"
if "%PY_MAJOR%"=="3" (
    for /f "tokens=2 delims=." %%n in ("%PY_VER%") do (
        if %%n GEQ 13 (
            echo.
            echo [BLAD] Wykryto Python %PY_VER%.
            echo        Ta wersja moze powodowac problemy z instalacja pakietow.
            echo        Zalecana wersja: Python 3.11 lub 3.12.
            echo        Pobierz z: https://www.python.org/downloads/release/python-3119/
            pause
            exit /b 1
        )
    )
)

if not exist "well_configurator_backend" (
    echo [UWAGA] Folder well_configurator_backend nie znaleziony.
    echo         Tylko serwer Node.js zostanie uruchomiony.
    set "PYTHON_AVAILABLE=0"
) else (
    set "PYTHON_AVAILABLE=1"
)

echo ---------- Sprawdzanie portow ----------

call :check_port 3000
if errorlevel 1 (
    echo [UWAGA] Port 3000 jest zajety przez inny proces.
    echo         Serwer Node.js moze nie uruchomic sie poprawnie.
    echo.
    choice /c YN /n /m "Kontynuowac mimo to? [Y/N]: "
    if errorlevel 2 exit /b 1
)

if "!PYTHON_AVAILABLE!"=="1" (
    call :check_port 5000
    if errorlevel 1 (
        echo [UWAGA] Port 5000 jest zajety przez inny proces.
        echo         Python backend moze nie uruchomic sie poprawnnie.
        echo.
    )
)

echo.

if "!PYTHON_AVAILABLE!"=="1" (
    choice /c YN /n /m "Uruchomic Python AI Backend? [Y/N]: "
    set "RUN_PYTHON=!errorlevel!"
) else (
    set "RUN_PYTHON=2"
)

echo.

if not exist "node_modules" (
    if exist "vendor\node_modules.tar.gz" (
        echo [INFO] Rozpakowywanie node_modules z archiwum offline...
        tar -xzf vendor\node_modules.tar.gz
        if errorlevel 1 (
            echo [BLAD] Rozpakowanie node_modules nie powiodlo sie.
            pause
            exit /b 1
        )
        echo [OK] node_modules rozpakowane z vendor\node_modules.tar.gz
        echo.
    ) else (
        echo [INFO] Brak folderu node_modules. Instalowanie zaleznosci Node.js...
        call npm install
        if errorlevel 1 (
            echo [BLAD] npm install nie powiodlo sie.
            pause
            exit /b 1
        )
        echo [OK] Zaleznosci Node.js zainstalowane.
        echo.
    )
)

if "!PYTHON_AVAILABLE!"=="1" (
    if not exist "well_configurator_backend\venv" (
        echo [INFO] Tworzenie venv dla Python backend...
        cd well_configurator_backend
        python -m venv venv
        if errorlevel 1 (
            echo [BLAD] Blad tworzenia venv.
            pause
            exit /b 1
        )
        echo [OK] venv utworzone.
        cd ..
        echo.
    )

    echo [INFO] Sprawdzanie zaleznosci Python...
    call well_configurator_backend\venv\Scripts\python -c "import sqlalchemy" >nul 2>&1
    if errorlevel 1 (
        echo [INFO] Instalowanie zaleznosci Python...
        if exist "vendor\python_wheels" (
            echo        (tryb offline — lokalne pliki .whl)
            call well_configurator_backend\venv\Scripts\python -m pip install --no-index --find-links vendor\python_wheels\ -r well_configurator_backend\requirements.txt
        ) else (
            echo        (tryb online — pobieranie z internetu)
            call well_configurator_backend\venv\Scripts\python -m pip install -r well_configurator_backend\requirements.txt
        )
        if errorlevel 1 (
            echo [BLAD] Instalacja zaleznosci Python nie powiodla sie.
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

echo ========================================
echo  Uruchamianie serwerow...
echo ========================================
echo.

if "!RUN_PYTHON!"=="1" (
    if exist "well_configurator_backend\run.py" (
        echo [1/2] Uruchamianie Python AI Backend...
        start "Zaplecze AI Python" cmd /k "cd /d %cd%\well_configurator_backend && python run.py"
        timeout /t 3 >nul
    )
)

echo [2/2] Uruchamianie Serwera Node.js...
start "Serwer Node.js" cmd /k "npm run dev"
start "Graphify Watch" cmd /k "graphify watch ."

echo.
echo ========================================
echo  Uruchamianie zakonczone!
echo ========================================
echo.
echo Czekaj az oba serwery sie uruchomia...
echo.
if "!RUN_PYTHON!"=="1" (
    echo Python AI Backend: http://127.0.0.1:5000
)
echo Node.js Server:    http://127.0.0.1:3000
echo.
echo TWOJ LINK: http://127.0.0.1:3000/app.html#/studnie
echo.
echo UWAGA: Sprawdz okna czy nie ma bledow ERROR!
echo ========================================
pause
exit /b 0

:check_port
set "PORT_CHECK=0"
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":%1 "') do (
    if /i "%%a"=="LISTENING" set "PORT_CHECK=1"
)
if "%PORT_CHECK%"=="1" exit /b 1
exit /b 0