@echo off
REM  Wersja: 1.56.6
REM ===========================================================
REM  build.bat - Budowanie production bundle (final)
REM ===========================================================

setlocal
cd /d "%~dp0"

set "APP_VERSION=1.56.6"

echo ===========================================================
echo   S.O.K. - Budowanie produkcyjne v%APP_VERSION%
echo ===========================================================
echo.

REM Walidacja
where node >nul 2>nul || (
    echo [BLAD] Brak Node.js.
    pause
    exit /b 1
)

REM npm ci jesli brak node_modules
if not exist "node_modules" (
    echo [INFO] npm ci...
    call npm ci --no-audit --no-fund
    if errorlevel 1 (
        echo [BLAD] npm ci nie powiodl sie.
        pause
        exit /b 1
    )
)
echo [OK] Dependencies OK

REM Prisma client
echo [INFO] Prisma generate...
call npx prisma generate
if errorlevel 1 (
    echo [BLAD] prisma generate
    pause
    exit /b 1
)
echo [OK] Prisma client

REM TypeScript compile
echo [INFO] TypeScript compile...
REM Clean dist: tsc nigdy nie usuwa, stare .js po rename/delete wisialyby w prod.
if exist "dist" rmdir /s /q "dist"
call npx tsc
if errorlevel 1 (
    echo [BLAD] TypeScript compile.
    pause
    exit /b 1
)
echo [OK] dist\

REM Kopiuj Prisma Client do dist - tsc nie kopiuje generated/ (src/prismaClient.ts importuje ../generated/prisma-postgres)
echo [INFO] Kopiowanie Prisma Client...
if not exist "dist\generated" mkdir "dist\generated"
xcopy /e /i /y "generated\prisma-postgres" "dist\generated\prisma-postgres" >nul
if errorlevel 1 (
    echo [BLAD] Kopiowanie Prisma Client nie powiodlo sie.
    pause
    exit /b 1
)
echo [OK] dist\generated\prisma-postgres

echo ===========================================================
echo   Build zakonczony
echo ===========================================================
pause
endlocal
