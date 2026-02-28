@echo off
chcp 65001 >nul
title WITROS Oferty - Serwer
color 0A

echo.
echo  ╔════════════════════════════════════════════╗
echo  ║     🚀 WITROS Oferty - Uruchamianie...    ║
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

echo  ✅ Serwer startuje na: http://localhost:3000
echo  📂 Dane w folderze: %~dp0data
echo.
echo  Aby zatrzymać serwer naciśnij: Ctrl+C
echo  ─────────────────────────────────────────────
echo.

node server.js

pause
