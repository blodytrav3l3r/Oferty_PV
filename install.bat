@echo off
REM ===========================================================
REM  WITROS Oferty PV — instalator (Windows 10+)
REM  Architektura: Node.js + Express + Prisma + AI Learning Engine
REM  Data: 2026-06-30
REM  Kompatybilny z istniejaca struktura po wdrozeniu AI/modulow.
REM ===========================================================

setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1

cd /d "%~dp0"

echo ============================================================
echo   WITROS Oferty PV - instalator (Node.js + AI + Telemetry)
echo ============================================================
echo.

REM -----------------------------------------------------------
REM  Krok 1: Sprawdzenie Node.js
REM -----------------------------------------------------------
echo [1/8] Sprawdzanie Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo [BLAD] Node.js nie jest zainstalowany.
    echo        Pobierz LTS 20+ z https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=2" %%v in ('node --version') do set "NODE_VER=%%v"
for /f "tokens=1 delims=." %%m in ("!NODE_VER!") do set "NODE_MAJOR=%%m"
if !NODE_MAJOR! LSS 20 (
    echo [BLAD] Wymagane Node.js ^>= 20. Wykryto !NODE_VER!.
    pause
    exit /b 1
)
echo        [OK] Node.js !NODE_VER!
echo.

REM -----------------------------------------------------------
REM  Krok 2: Sprawdzenie npm
REM -----------------------------------------------------------
echo [2/8] Sprawdzanie npm...
where npm >nul 2>&1
if errorlevel 1 (
    echo [BLAD] npm nie jest dostepny. Zainstaluj Node.js z npm.
    pause
    exit /b 1
)
for /f "tokens=1" %%v in ('npm --version') do set "NPM_VER=%%v"
echo        [OK] npm !NPM_VER!
echo.

REM -----------------------------------------------------------
REM  Krok 3: Sprawdzenie Git
REM -----------------------------------------------------------
echo [3/8] Sprawdzanie Git (potrzebny dla husky)...
where git >nul 2>&1
if errorlevel 1 (
    echo [UWAGA] Git nie jest zainstalowany. Hooki husky moga nie dzialac.
) else (
    echo        [OK] Git jest zainstalowany.
)
echo.

REM -----------------------------------------------------------
REM  Krok 4: Struktura katalogow src/public/tests
REM -----------------------------------------------------------
echo [4/8] Sprawdzanie struktury katalogow projektu...
if not exist "src" (
    echo [BLAD] Brak katalogu src^/ - niepoprawny katalog roboczy.
    pause
    exit /b 1
)
if not exist "public" (
    echo [BLAD] Brak katalogu public^/.
    pause
    exit /b 1
)
if not exist "tests" (
    echo [BLAD] Brak katalogu tests^/.
    pause
    exit /b 1
)
if not exist "prisma" (
    echo [BLAD] Brak katalogu prisma^/.
    pause
    exit /b 1
)
echo        [OK] Struktura Git repo poprawna.
echo.

REM -----------------------------------------------------------
REM  Krok 5: Instalacja npm install
REM -----------------------------------------------------------
echo [5/8] Instalacja zaleznosci (npm install)...
if exist "package-lock.json" (
    call npm ci --no-audit --no-fund
) else (
    call npm install --no-audit --no-fund
)
if errorlevel 1 (
    echo [BLAD] npm install nie powiodl sie.
    pause
    exit /b 1
)
echo        [OK] Zaleznosci zainstalowane.
echo.

REM -----------------------------------------------------------
REM  Krok 6: Prisma generate + migrate
REM -----------------------------------------------------------
echo [6/8] Prisma generate (client)...
call npx prisma generate
if errorlevel 1 (
    echo [BLAD] prisma generate nie powiodl sie.
    pause
    exit /b 1
)
echo        [OK] Prisma client wygenerowany.
echo.

echo [6/8] Prisma migrate deploy (produkcja) lub db push (dev)...
if exist "migrations" (
    if exist "migrations\migration_lock.toml" (
        call npx prisma migrate deploy
        if errorlevel 1 (
            echo [UWAGA] migrate deploy nie powiodl sie ^(fallback do db push^).
            call npx prisma db push --skip-generate --accept-data-loss
        )
    ) else (
        call npx prisma db push --skip-generate --accept-data-loss
    )
) else (
    call npx prisma db push --skip-generate --accept-data-loss
)
if errorlevel 1 (
    echo [BLAD] Prisma migration nie powiodla sie.
    pause
    exit /b 1
)
echo        [OK] Schemat bazy jest aktualny.
echo.

REM -----------------------------------------------------------
REM  Krok 7: Prisma seed (opcjonalny)
REM -----------------------------------------------------------
echo [7/8] Seed danych poczatkowych (opcjonalny)...
if exist "prisma\seed.ts" (
    call npx ts-node prisma/seed.ts
    if errorlevel 1 (
        echo        [UWAGA] Seed nie powiodl sie ^(pomijam^).
    ) else (
        echo        [OK] Dane poczatkowe zapisane.
    )
) else (
    echo        [INFO] Brak pliku prisma\seed.ts — pomijam.
)
echo.

REM -----------------------------------------------------------
REM  Krok 8: Build (produkcja) - opcjonalny
REM -----------------------------------------------------------
echo [8/8] TypeScript type check (weryfikacja)...
call npx tsc --noEmit
if errorlevel 1 (
    echo [UWAGA] Typecheck wykryl bledy. Sprawdz kod przed pierwszym uruchomieniem.
) else (
    echo        [OK] Brak bledow typow.
)
echo.

echo ============================================================
echo   GOTOWE - instalacja zakończona
echo ============================================================
echo.
echo Nastepne kroki:
echo   1. Uruchomienie dev (hot reload):
echo      dev.bat
echo.
echo   2. Uruchomienie produkcyjne:
echo      build.bat       (budowanie TypeScript)
echo      prod.bat        (start z dist^/server.js)
echo.
echo   3. Cron Service - uruchamia sie automatycznie przy starcie aplikacji
echo      (NIE trzeba uruchamiac recznie - jest wewnatrz server.ts)
echo.
echo Aplikacja: http://localhost:3000
echo Konto: admin ^/ admin123
echo.
pause
