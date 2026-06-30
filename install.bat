@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ====================================================
echo   WITROS Oferty PV - instalator
echo ====================================================
echo.

REM 1. Sprawdzenie Node.js
echo [1/6] Sprawdzenie Node.js...
where node >nul 2>nul
if errorlevel 1 (
    echo BLAD: Node.js nie jest zainstalowany.
    echo Pobierz ze https://nodejs.org/ i zainstaluj LTS 18+.
    pause
    exit /b 1
)
node --version
echo OK
echo.

REM 2. Sprawdzenie npm
echo [2/6] Sprawdzenie npm...
where npm >nul 2>nul
if errorlevel 1 (
    echo BLAD: npm nie jest dostepny.
    pause
    exit /b 1
)
call npm --version
echo OK
echo.

REM 3. Instalacja zaleznosci
echo [3/6] Instalacja node_modules...
if not exist "package.json" (
    echo BLAD: brak package.json w katalogu %CD%
    pause
    exit /b 1
)
call npm install --no-audit --no-fund
if errorlevel 1 (
    echo BLAD: npm install nie powiodl sie.
    pause
    exit /b 1
)
echo OK
echo.

REM 4. Prisma - generate
echo [4/6] Prisma generate...
call npx prisma generate
if errorlevel 1 (
    echo BLAD: prisma generate nie powiodl sie.
    pause
    exit /b 1
)
echo OK
echo.

REM 5. Prisma - db push (tworzy dev.db)
echo [5/6] Prisma db push...
call npx prisma db push --accept-data-loss
if errorlevel 1 (
    echo BLAD: prisma db push nie powiodl sie.
    pause
    exit /b 1
)
echo OK
echo.

REM 6. (Opcjonalnie) Seed
if exist "prisma\seed.js" (
    echo [6/6] Prisma seed...
    call npx prisma db seed
) else if exist "prisma\seed.ts" (
    echo [6/6] Prisma seed (TypeScript)...
    call npx prisma db seed
) else (
    echo [6/6] Pomijam seed (brak pliku seed)
)
echo.

echo ====================================================
echo   GOTOWE
echo ====================================================
echo.
echo Uruchomienie:
echo   - produkcja:  npm start
echo   - dev:        npm run dev
echo.
echo Aplikacja bedzie dostepna pod: http://localhost:3000
echo Konto: admin / admin123
echo.

REM Pytanie o uruchomienie
set /p RUN="Uruchomic serwer teraz? (T/N): "
if /i "%RUN%"=="T" (
    echo.
    echo Uruchamiam server...
    echo (Zatrzymanie: Ctrl+C)
    echo.
    call npm start
)

pause
