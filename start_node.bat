@echo off
setlocal enabledelayedexpansion

chcp 65001 >nul 2>&1

echo =========================================
echo    WITROS Oferty - Uruchamianie Node.js
echo =========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo [BLAD] Node.js nie jest zainstalowany.
    echo Pobierz z: https://nodejs.org/
    pause
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo [BLAD] npm nie jest dostepny.
    pause
    exit /b 1
)

echo ---------- Sprawdzanie portu ----------

call :check_port 3000
if errorlevel 1 (
    echo [UWAGA] Port 3000 jest zajety!
    echo.
    choice /c YN /n /m "Probowac mimo to? [Y/N]: "
    if errorlevel 2 exit /b 1
    echo.
)

echo.
echo =========================================
echo  Wybierz tryb uruchomienia:
echo =========================================
echo  1 - Development (ts-node-dev, hot reload)
echo  2 - Production (skompilowany dist/server.js)
echo.
choice /c 12 /n /m "Wybierz [1/2]: "

if errorlevel 2 (
    set "MODE=production"
) else (
    set "MODE=development"
)

echo.
echo ---------- Tryb: !MODE! ----------

if "!MODE!"=="production" (
    echo Budowanie aplikacji...
    call npm run build
    if errorlevel 1 (
        echo.
        echo [BLAD] Build nie powiodl sie.
        pause
        exit /b 1
    )
    echo.
    echo Uruchamianie serwera produkcyjnego...
    npm start
) else (
    echo Uruchamianie serwera deweloperskiego...
    npm run dev
)

exit /b 0

:check_port
set "PORT_CHECK=0"
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3000 "') do (
    if /i "%%a"=="LISTENING" set "PORT_CHECK=1"
)
if "%PORT_CHECK%"=="1" exit /b 1
exit /b 0