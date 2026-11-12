@echo off
REM  Wersja: 1.57.0
REM ===========================================================
REM  deploy.bat - Uruchamia deploy aplikacji (rdzen w deploy.mjs)
REM  Przyklad: deploy.bat windows v1.16.0
REM  Podglad:  deploy.bat windows v1.16.0 --dry-run
REM Rola: Wdrozenie wskazanej wersji aplikacji.
REM Uzycie: deploy.bat <windows|linux|docker> <tag> [--dry-run]
REM Uruchamia: scripts/deploy.mjs, ktory wykonuje kroki wdrozenia.
REM Wplyw: Zmienia wskazane wdrozenie; --dry-run tylko pokazuje plan.
REM ===========================================================
setlocal
cd /d "%~dp0"
node scripts/deploy.mjs %*
exit /b %errorlevel%
