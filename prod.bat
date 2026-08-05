@echo off
REM ===========================================================
REM  prod.bat - alias do start.bat --prod
REM  Uruchamia tryb produkcyjny przez start.bat (pojedyncze
REM  zrodlo prawdy). NODE_ENV ustawia start.bat w trybie --prod.
REM ===========================================================

call start.bat --prod %*
exit /b %errorlevel%