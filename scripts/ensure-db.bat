@echo off
REM ensure-db.bat - Sprawdza i przygotowuje baze danych
REM Zwraca: errorlevel 0 = OK, 1 = blad krytyczny
REM Uzycie: call scripts\ensure-db.bat

setlocal ENABLEDELAYEDEXPANSION
set "RETRY=0"

:check_loop
call node scripts/check-db.js
set "CHECK_EXIT=!errorlevel!"

if !CHECK_EXIT! equ 0 (
    endlocal
    exit /b 0
)

if !CHECK_EXIT! equ 2 (
    echo [INFO] Baza pusta - uruchamianie seeda...
    call npx ts-node prisma/seed.ts
    if !errorlevel! equ 0 (
        echo [OK] Seed zakonczony.
        endlocal
        exit /b 0
    ) else (
        echo [WARN] Seed nie powiodl sie.
        endlocal
        exit /b 1
    )
)

if !CHECK_EXIT! equ 1 (
    echo [INFO] Brak tabel w bazie - uruchamianie migracji...
    call npx prisma db push --skip-generate --accept-data-loss
    if !errorlevel! equ 1 (
        echo [BLAD] Nie udalo sie zaktualizowac schematu.
        endlocal
        exit /b 1
    )
    echo [OK] Schema zaktualizowana.
    set /a RETRY+=1
    if !RETRY! lss 3 goto :check_loop
    echo [BLAD] Za duzo prob - przerywam.
    endlocal
    exit /b 1
)

echo [WARN] ensure-db: nieznany kod !CHECK_EXIT!
endlocal
exit /b 1
