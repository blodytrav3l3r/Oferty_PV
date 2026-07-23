@echo off
REM ===========================================================
REM  install.bat - Setup srodowiska developer-skiego (final)
REM  Strategia: proste kroki, zero kolorow i delikatnych ANSI.
REM ===========================================================

setlocal ENABLEDELAYEDEXPANSION
cd /d "%~dp0"

echo ===========================================================
echo   WITROS Oferty PV - Instalator
echo ===========================================================
echo.

REM 1. Node.js 20+
where node >nul 2>nul
if errorlevel 1 (
    echo [BLAD] Brak Node.js.
    pause
    exit /b 1
)
for /F "tokens=*" %%v in ('node --version') do echo [OK] Node.js %%v

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
if not exist ".env" (
    if exist ".env.example" (
        echo [INFO] Brak .env - kopiuje z .env.example
        copy ".env.example" ".env" >nul
    ) else (
        echo [BLAD] Brak .env i .env.example. Skopiuj .env.example na .env recznie.
        pause
        exit /b 1
    )
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
if exist "prisma\migrations\migration_lock.toml" (
    call npx prisma migrate deploy
    if errorlevel 1 (
        echo [INFO] migrate deploy nie powiodl sie - fallback db push
        call npx prisma db push --skip-generate --accept-data-loss
    )
) else (
    call npx prisma db push --skip-generate --accept-data-loss
)
if errorlevel 1 (
    echo [BLAD] Prisma schema nie powiodl sie.
    pause
    exit /b 1
)
echo [OK] Schema OK

REM 9. Seed (opcja — pomijany z --skip-seed)
set "SKIP_SEED="
for %%a in (%*) do if /i "%%a"=="--skip-seed" set "SKIP_SEED=1"
if not defined SKIP_SEED (
    if exist "prisma\seed.ts" (
        echo [INFO] Seed (--skip-seed aby pominac)...
        call npx ts-node prisma\seed.ts
        if !errorlevel! equ 0 (echo [OK] Seed OK) else (echo [BLAD] Seed nie powiodl sie. Sprawdz komunikaty powyzej.)
    )
) else (
    echo [INFO] Seed pominiety (--skip-seed)
)

REM 10. Typecheck
echo [INFO] typecheck...
call npx tsc --noEmit >nul 2>nul && echo [OK] Brak bledow || echo [WARN] Blad typecheck

echo ===========================================================
echo   Instalacja zakonczona
echo ===========================================================
echo.
echo Uruchom start.bat aby zaczac prace.
echo.
echo UWAGA: Jesli przenosisz baze z innego urzadzenia, uruchom:
echo   npm run restore data/backups/nazwa_pliku.sqlite
pause
endlocal
