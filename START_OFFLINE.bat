@echo off
chcp 65001 >nul
title WITROS Oferty - OFFLINE
color 0B

echo.
echo  ==============================================
echo       WITROS Oferty - Uruchamianie OFFLINE
echo  ==============================================
echo.

cd /d "%~dp0"

where node >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo  [BLAD]: Node.js nie jest zainstalowany.
    echo  Pobierz z: https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Instalacja zaleznosci, tylko jesli brakuje folderu node_modules
if not exist "node_modules" (
    echo  [INFO] Pierwsze uruchomienie - instalowanie paczek...
    call npm install
)

echo.
echo  [OK] Gotowe! Serwer dziala TYLKO na tym komputerze.
echo  Wejdz w przegladarce na: 
echo  ==========================
echo   http://localhost:3000
echo  ==========================
echo.
echo  [INFO] Nacisnij Ctrl+C aby wylaczyc.
echo  ----------------------------------------------

set HOST=127.0.0.1
node server.js

pause
