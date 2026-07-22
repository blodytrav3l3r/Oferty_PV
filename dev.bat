@echo off
REM ===========================================================
REM  dev.bat - Alias do start.bat w trybie developerskim
REM  Zachowany dla kompatybilnosci z przyzwyczajeniami.
REM  Funkcjonalnie identyczny z: start.bat
REM ===========================================================
call "%~dp0start.bat" --dev %*
