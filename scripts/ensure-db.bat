@echo off
REM  Wersja: 1.56.16
REM ensure-db.bat - Sprawdza i przygotowuje baze danych
REM Rola: Wewnetrzny helper bazy wywolywany przez start.bat.
REM Uzycie: call scripts\ensure-db.bat
REM Uruchamia: check-db.js, Prisma migrate deploy lub prisma/seed.ts.
REM Wplyw: Moze migrowac schemat lub seedowac baze wskazana przez DATABASE_URL.
REM Zwraca: errorlevel 0 = OK, 1 = blad krytyczny

setlocal ENABLEDELAYEDEXPANSION
set "RETRY=0"

REM ---------- 0. Stare instancje serwera ----------
REM Nie uruchamiaj migracji przy pozostawionej instancji S.O.K.
REM Potwierdzenie zatrzymania procesu pozostaje wymagane.
set "STALE_PIDS="
for /f %%p in ('powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\find-stale-server.ps1" ^<nul 2^>nul') do (
    if "%%p" neq "" set "STALE_PIDS=!STALE_PIDS! %%p"
)
if defined STALE_PIDS (
    echo [UWAGA] Znaleziono dzialajace procesy node serwera S.O.K. - PID:!STALE_PIDS!
    echo [UWAGA] Wykryto pozostawiona instancje S.O.K. przed migracja PostgreSQL.
    set "KILLSTALE="
    if /i "%SOK_KILL_STALE%"=="1" set "KILLSTALE=T"
    if not defined KILLSTALE set /p "KILLSTALE=Czy zatrzymac te procesy i kontynuowac? T/N [N]: "
    if /i "!KILLSTALE!"=="T" (
        for %%p in (!STALE_PIDS!) do (
            echo [INFO] Zatrzymuje PID %%p...
            powershell -Command "Stop-Process -Id %%p -Force" 2>nul
        )
        timeout /t 3 /nobreak >nul 2>&1
    ) else (
        echo [BLAD] Bez zatrzymania starej instancji migracja sie nie powiedzie.
        echo [BLAD] Zamknij stare okna start.bat / terminale z serwerem i uruchom ponownie.
        endlocal
        exit /b 1
    )
)

:check_loop
call node scripts/check-db.js
set "CHECK_EXIT=!errorlevel!"

if !CHECK_EXIT! equ 0 (
    REM Zdrowa baza tez wymaga migrate deploy: check-db widzi tylko tabele,
    REM a nowe kolumny/indexy z kolejnych migracji inaczej nigdy sie nie pojawia
    REM (500 na nowych polach, np. offer_follow_ups.cycle).
    call npx prisma migrate deploy
    if !errorlevel! neq 0 (
        echo [BLAD] migrate deploy nie powiodl sie, exit=!errorlevel!.
        endlocal
        exit /b 1
    )
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
    call npx prisma migrate deploy
    if !errorlevel! neq 0 (
        echo [BLAD] Nie udalo sie zaktualizowac schematu (exit=!errorlevel!).
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
