@echo off
REM  Wersja: 1.22.2
REM ===========================================================
REM  install.bat - Setup srodowiska developer-skiego (final)
REM  Strategia: proste kroki, zero kolorow i delikatnych ANSI.
REM ===========================================================

setlocal ENABLEDELAYEDEXPANSION
cd /d "%~dp0"

set "APP_VERSION=1.22.2"

echo ===========================================================
echo   S.O.K. - Instalator v%APP_VERSION%
echo ===========================================================
echo.

REM 1. Node.js 22.13+
where node >nul 2>nul
if errorlevel 1 (
    echo [BLAD] Brak Node.js.
    pause
    exit /b 1
)
for /F "tokens=*" %%v in ('node --version') do set "NODE_VER=%%v"
for /F "tokens=1,2 delims=.v" %%a in ("%NODE_VER%") do (
    set "NODE_MAJOR=%%a"
    set "NODE_MINOR=%%b"
)
if defined NODE_MAJOR if defined NODE_MINOR (
    if %NODE_MAJOR% lss 22 goto :node_bad
    if %NODE_MAJOR% equ 22 if %NODE_MINOR% lss 13 goto :node_bad
)
echo [OK] Node.js %NODE_VER%
goto :node_ok
:node_bad
echo [BLAD] Wymagane Node.js ^>=22.13.0. Masz %NODE_VER%
pause
exit /b 1
:node_ok

REM 2. npm
where npm >nul 2>nul
if errorlevel 1 (
    echo [BLAD] Brak npm.
    pause
    exit /b 1
)
for /F "tokens=1" %%v in ('npm --version') do echo [OK] npm v%%v

REM 3. Git (opcjonalny)
where git >nul 2>nul && echo [OK] Git || echo [INFO] Brak Git - husky hooks beda nieaktywne

REM 4. .env
if not exist ".env.example" (
    echo [BLAD] Brak .env.example. Skopiuj .env.example na .env recznie.
    pause
    exit /b 1
)
echo [INFO] Inicjalizacja .env (init-env.mjs)...
call node scripts\init-env.mjs
if errorlevel 1 (
    echo [BLAD] init-env.mjs nie powiodl sie.
    pause
    exit /b 1
)
echo [OK] .env OK

REM 5. Struktura katalogow
if not exist "src" (
    echo [BLAD] Brak katalogu src\
    pause
    exit /b 1
)
if not exist "public" (
    echo [BLAD] Brak katalogu public\
    pause
    exit /b 1
)
if not exist "tests" (
    echo [BLAD] Brak katalogu tests\
    pause
    exit /b 1
)
if not exist "prisma" (
    echo [BLAD] Brak katalogu prisma\
    pause
    exit /b 1
)
echo [OK] Struktura OK

REM 6. npm install
echo [INFO] npm install (moze potrwac kilka minut)...
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
echo [OK] node_modules zainstalowane

REM 7. Prisma
echo [INFO] Prisma generate...
call npx prisma generate
if errorlevel 1 (
    echo [BLAD] prisma generate nie powiodl sie.
    pause
    exit /b 1
)
echo [OK] Prisma Client OK

REM 8. Schema DB
echo [INFO] migrate db...
call npx prisma migrate deploy
if errorlevel 1 (
    echo [INFO] migrate deploy nie powiodl sie...
    call node scripts\check-legacy-db.js
    if !errorlevel! equ 1 (
        echo [INFO] Baza legacy (db push) - fallback db push
        call npx prisma db push --skip-generate --accept-data-loss
    ) else (
        echo [BLAD] migrate deploy nie powiodl sie, a baza nie jest legacy (db push).
        pause
        exit /b 1
    )
)
if errorlevel 1 (
    echo [BLAD] Prisma schema nie powiodl sie.
    pause
    exit /b 1
)
echo [OK] Schema OK

REM 9. Seed (opcja - pomijany z --skip-seed)
set "SKIP_SEED="
for %%a in (%*) do if /i "%%a"=="--skip-seed" set "SKIP_SEED=1"
if not defined SKIP_SEED (
    if exist "prisma\seed.ts" (
        echo [INFO] Seed ^(--skip-seed aby pominac^)...
        call npx ts-node prisma\seed.ts
        if !errorlevel! equ 0 (
            echo [OK] Seed OK
        ) else (
            echo [BLAD] Seed nie powiodl sie. Sprawdz komunikaty powyzej.
            echo [INFO] Jesli przenosisz baze z innego urzadzenia, uruchom:
            echo [INFO]   install.bat --skip-seed
            echo [INFO]   npm run restore data/backups/nazwa_backupu.sqlite
            echo [INFO] Lekka alternatywa: skopiuj price_defaults.json do data\
            echo [INFO] ^(ceny zostana przywrocone automatycznie po starcie^)
            pause
            exit /b 1
        )
    )
) else (
    echo [INFO] Seed pominiety ^(--skip-seed^)
)

REM 10. Typecheck
echo [INFO] typecheck...
call npx tsc --noEmit
if errorlevel 1 (
    echo [WARN] Typecheck wykryl bledy. Sprawdz komunikaty powyzej.
) else (
    echo [OK] Brak bledow
)

echo ===========================================================
echo   Instalacja zakonczona
echo ===========================================================
echo.
echo [INFO] Jesli masz wlasne ceny domyslne z innej instalacji,
echo [INFO] skopiuj plik price_defaults.json do katalogu data\
echo [INFO] przed uruchomieniem start.bat.
echo [INFO] ^(na starym urzadzeniu: npm run prices:export lub przycisk "Zapisz domyslne"^).
echo.
echo Uruchom start.bat aby zaczac prace.
echo.
echo UWAGA: Jesli przenosisz baze z innego urzadzenia, uruchom:
echo   npm run restore data/backups/nazwa_pliku.sqlite
echo.
echo Lekka alternatywa: skopiuj price_defaults.json do data\
echo (ceny zostana przywrocone automatycznie po starcie).
endlocal
