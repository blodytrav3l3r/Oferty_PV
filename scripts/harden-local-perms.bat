@echo off
REM harden-local-perms.bat - ogranicza ACL .env i data\ do wlasciciela + SYSTEM + Administratorzy.
REM SIDy zamiast nazw (niezalezne od jezyka Windows): *S-1-5-18 SYSTEM,
REM *S-1-5-32-544 Administratorzy. Usuwa dziedziczone wpisy grupowe
REM (Authenticated Users, Users), przez ktore kazdy lokalny user czyta sekrety.
REM Uzycie: scripts\harden-local-perms.bat [--restore-dir KATALOG]
REM   Bez --restore-dir: zapisuje snapshot ACL, nadaje jawne wpisy, wycina dziedziczenie.
REM   Z --restore-dir: przywraca snapshot i konczy.
REM Zasieg: lokalny Windows dev. Na serwerze prod/legacy najpierw audyt czytelnikow.
REM Wersja: 1.44.1
setlocal ENABLEDELAYEDEXPANSION

if /i "%1"=="--restore-dir" (
    if "%2"=="" (
        echo [BLAD] Podaj katalog ze snapshotem.
        exit /b 1
    )
    pushd "%~dp0.."
    icacls .env /restore "%2\acl-env.bak"
    if errorlevel 1 (
        echo [BLAD] Restore .env nie powiodl sie.
        popd
        exit /b 1
    )
    icacls data /restore "%2\acl-data.bak"
    if errorlevel 1 (
        echo [BLAD] Restore data nie powiodl sie.
        popd
        exit /b 1
    )
    popd
    echo [OK] Przywrocono ACL.
    exit /b 0
)

for /f %%t in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "STAMP=%%t"
set "SNAPDIR=%TEMP%\sok-acl-!STAMP!"
mkdir "!SNAPDIR!" 2>nul
pushd "%~dp0.."

icacls .env /save "!SNAPDIR!\acl-env.bak" >nul
icacls data /save "!SNAPDIR!\acl-data.bak" >nul
echo [INFO] Snapshot ACL: !SNAPDIR!

set "ME=%USERDOMAIN%\%USERNAME%"
REM Pliki: jawny (F) BEZ (OI)(CI) — flagi dziedziczenia na pliku powoduja
REM ciche odrzucenie wpisu i pusty DACL (lockout). Katalogi: z (OI)(CI).
icacls ".env" /grant:r "!ME!:(F)" "*S-1-5-18:(F)" "*S-1-5-32-544:(F)" >nul
if errorlevel 1 (
    echo [BLAD] Grant .env nie powiodl sie - restore ze snapshotu powyzej.
    popd
    exit /b 1
)
icacls ".env" /inheritance:r >nul
if errorlevel 1 (
    echo [BLAD] Inheritance .env nie powiodlo sie - restore ze snapshotu powyzej.
    popd
    exit /b 1
)
icacls "data" /grant:r "!ME!:(OI)(CI)(F)" "*S-1-5-18:(OI)(CI)(F)" "*S-1-5-32-544:(OI)(CI)(F)" >nul
if errorlevel 1 (
    echo [BLAD] Grant data nie powiodl sie - restore ze snapshotu powyzej.
    popd
    exit /b 1
)
icacls "data" /inheritance:r >nul
if errorlevel 1 (
    echo [BLAD] Inheritance data nie powiodlo sie - restore ze snapshotu powyzej.
    popd
    exit /b 1
)
popd
echo [OK] .env i data\: tylko wlasciciel + SYSTEM + Administratorzy.
