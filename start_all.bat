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