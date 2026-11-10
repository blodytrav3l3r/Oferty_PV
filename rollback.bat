@echo off
REM  Wersja: 1.56.13
REM ===========================================================
REM  rollback.bat - Powrot do poprzedniej wersji (rdzen w rollback.mjs)
REM  Przyklad: rollback.bat windows v1.15.1
REM Rola: Cofniecie wskazanego wdrozenia do poprzedniej wersji.
REM Uzycie: rollback.bat <windows|linux|docker> <tag> [--dry-run]
REM Uruchamia: scripts/rollback.mjs i wspolna procedure rollback.
REM Wplyw: Przywraca wersje; procedura moze odtworzyc baze z kopii zapasowej.
REM ===========================================================
setlocal
cd /d "%~dp0"
node scripts/rollback.mjs %*
exit /b %errorlevel%
