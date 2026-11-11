@echo off
REM  Wersja: 1.56.17
REM ===========================================================
REM  prod.bat - alias do start.bat --prod
REM  Uruchamia tryb produkcyjny przez start.bat (pojedyncze
REM  zrodlo prawdy). NODE_ENV ustawia start.bat w trybie --prod.
REM Rola: Skrot do produkcyjnego trybu start.bat.
REM Uzycie: prod.bat [argumenty przekazywane do start.bat]
REM Uruchamia: start.bat --prod.
REM Wplyw: Jak start.bat; moze wykonac migracje lub seed bazy z DATABASE_URL.
REM ===========================================================

call "%~dp0start.bat" --prod %*
exit /b %errorlevel%
