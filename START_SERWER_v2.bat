@echo off
chcp 65001 >nul
title WITROS Oferty - Instalacja i Uruchomienie Serwera (v2)
color 0B

echo.
echo  ==============================================================
echo        🚀 WITROS Oferty - INSTALACJA I START (v2) 🚀
echo  ==============================================================
echo.

cd /d "%~dp0"

:: Sprawdzenie czy zainstalowano Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo  ❌ BLAD: Nie znaleziono Node.js w systemie!
    echo  Aby serwer mogl dzialac, musisz najpierw zainstalowac środowisko Node.js.
    echo  Pobierz i zainstaluj ze strony: https://nodejs.org/
    echo.
    echo  Po instalacji uruchom ponownie ten skrypt.
    pause
    exit /b 1
)

echo  [1/3] Znaleziono Node.js. Wersja:
node -v
echo.

echo  [2/3] Instalowanie lub aktualizowanie niezbednych pakietow...
echo  Trwa praca menedzera npm (moze to chwile potrwac)...
call npm install
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo  ❌ BLAD podczas instalacji pakietow. Sprawdz polaczenie z internetem.
    pause
    exit /b 1
)
echo  ✅ Pakiety zainstalowane poprawnie.
echo.

echo  [3/3] Uruchamianie serwera na adresie lokalnym...
echo.
echo  ✅ Serwer startuje. Aby połączyć się w przegladarce, wejdz na:
echo     http://localhost:3000
echo.
echo  Aby zatrzymac serwer w dowolnej chwili, nacisnij Crl+C lub zamknij to okno.
echo  ==============================================================
echo.

:: Start the server explicitly
node server.js

pause
