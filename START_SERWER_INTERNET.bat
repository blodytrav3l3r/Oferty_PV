@echo off
chcp 65001 >nul
title WITROS Oferty - Serwer INTERNET
color 0B

echo.
echo  ╔════════════════════════════════════════════╗
echo  ║  🌐 WITROS Oferty - Serwer INTERNETOWY    ║
echo  ╚════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

:: Sprawdź czy Node.js jest zainstalowany
where node >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo  ❌ BŁĄD: Node.js nie jest zainstalowany!
    echo  Pobierz go z: https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Sprawdź czy node_modules istnieje
if not exist "node_modules" (
    echo  📦 Instalowanie zależności...
    call npm install
    echo.
)

:: Pobierz adres IP w sieci lokalnej
echo  🔍 Wykrywanie adresu IP...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4"') do (
    set "LOCAL_IP=%%a"
)
set "LOCAL_IP=%LOCAL_IP: =%"

echo.
echo  ─────────────────────────────────────────────
echo  📡 ADRESY DOSTĘPU:
echo  ─────────────────────────────────────────────
echo.
echo   Lokalnie:        http://localhost:3000
echo   Sieć lokalna:    http://%LOCAL_IP%:3000
echo.
echo  ─────────────────────────────────────────────
echo  🌐 ABY DZIAŁAŁO PRZEZ INTERNET:
echo  ─────────────────────────────────────────────
echo.
echo   1. Przekieruj port 3000 na routerze
echo      na adres: %LOCAL_IP%
echo.
echo   2. Sprawdź publiczny IP na: https://whatismyip.com
echo.
echo   3. Podaj innym: http://TWOJ_PUBLICZNY_IP:3000
echo.
echo  ─────────────────────────────────────────────
echo.

:: Otwórz port w Firewall Windows (wymaga uprawnień admina)
echo  🔓 Otwieranie portu 3000 w firewall...
netsh advfirewall firewall show rule name="WITROS Serwer" >nul 2>&1
if %errorlevel% neq 0 (
    netsh advfirewall firewall add rule name="WITROS Serwer" dir=in action=allow protocol=TCP localport=3000 >nul 2>&1
    if %errorlevel% equ 0 (
        echo  ✅ Port 3000 otwarty w firewall Windows
    ) else (
        echo  ⚠️  Nie udało się otworzyć portu - uruchom jako Administrator
    )
) else (
    echo  ✅ Port 3000 już otwarty w firewall
)

echo.
echo  🚀 Serwer startuje...
echo  Aby zatrzymać serwer naciśnij: Ctrl+C
echo  ═════════════════════════════════════════════
echo.

node server.js

pause
