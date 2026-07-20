@echo off
REM ===========================================================
REM  install.bat - Setup srodowiska developer-skiego (final)
REM  Strategia: proste kroki, zero kolorow i delikatnych ANSI.
REM ===========================================================

setlocal
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
        echo [INFO] Brak .env - kopiuje z .env.example...
        copy .env.example .env >nul
        if errorlevel 1 (
            echo [BLAD] Nie udalo sie utworzyc .env.
            pause
            exit /b 1
        )
        echo [OK] .env utworzony
        echo [INFO] UWAGA: Edytuj .env i ustaw haslo administratora (DEFAULT_ADMIN_PASSWORD)
        echo [INFO] UWAGA: Dla lokalnego dev ustaw NODE_ENV=development
    ) else (
        echo [BLAD] Brak .env.example. Utworz .env recznie.
        pause
        exit /b 1
    )
) else (
    echo [OK] .env istnieje
)

REM 5. Struktura
if not exist "src" (
    echo [BLAD] Brak katalogu src\
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
echo [INFO] Synchronizacja schematu bazy...
call npx prisma db push --skip-generate --accept-data-loss
if errorlevel 1 (
    echo [BLAD] Prisma schema nie powiodl sie.
    pause
    exit /b 1
)
echo [OK] Schema OK

REM 9. Seed (opcja)
if exist "prisma\seed.ts" (
    echo [INFO] Seed...
    call npx ts-node prisma\seed.ts >nul 2>nul
    if not errorlevel 1 (echo [OK] Seed OK)
)

REM 10. Typecheck
echo [INFO] typecheck...
call npx tsc --noEmit >nul 2>nul && echo [OK] Brak bledow || echo [WARN] Blad typecheck

echo ===========================================================
echo   Instalacja zakonczona
echo ===========================================================
echo.
echo Uruchom dev.bat aby zaczac prace.
pause
endlocal
