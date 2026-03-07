@echo off
chcp 65001 >nul
title WITROS Oferty - ONLINE
color 0A

echo.
echo  ==============================================
echo       🌍 WITROS Oferty - Uruchamianie ONLINE
echo  ==============================================
echo.

cd /d "%~dp0"

where node >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo  ❌ BLAD: Node.js nie jest zainstalowany.
    echo  Pobierz z: https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Zawsze sprawdza i doinstalowuje uaktualnienia
echo  📦 Sprawdzam i instaluje zaleznosci (online)...
call npm install --no-fund --no-audit

echo.
echo  Pobieram adres sieciowy Twojego komputera...
for /f "tokens=2 delims=:" %%A In ('ipconfig ^| findstr /c:"IPv4 Address" /c:"IPv4"') do set PC_IP=%%A
if not "%PC_IP%"=="" (
    set PC_IP=%PC_IP: =%
) else (
    set PC_IP=twój_adres_IP
)

echo.
echo  ✅ Gotowe! Serwer dziala, mozna wejsc z innych urzadzen.
echo  Wejdz w przegladarce na: 
echo  ==========================
echo  Twoj komputer: http://localhost:3000
echo  Inne urzadzenia: http://%PC_IP%:3000
echo  ==========================
echo.
echo  [INFO] Upewnij sie, ze zapora systemu nie blokuje portu 3000!
echo  [INFO] Nacisnij Ctrl+C aby wylaczyc.
echo  ----------------------------------------------

set HOST=0.0.0.0
node server.js

pause
