@echo off
REM  Wersja: 1.56.12
REM ===========================================================
REM  dev.bat - Alias do start.bat w trybie developerskim
REM  Zachowany dla kompatybilnosci z przyzwyczajeniami.
REM  Funkcjonalnie identyczny z: start.bat
REM Rola: Skrot kompatybilnosci dla deweloperskiego startu.
REM Uzycie: dev.bat [argumenty przekazywane do start.bat]
REM Uruchamia: start.bat --dev.
REM Wplyw: Jak start.bat; moze wykonac migracje lub seed bazy z DATABASE_URL.
REM ===========================================================
call "%~dp0start.bat" --dev %*
