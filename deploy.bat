@echo off
REM ===========================================================
REM  deploy.bat - Uruchamia deploy aplikacji (rdzen w deploy.mjs)
REM  Uzycie: deploy.bat <windows|linux|docker> vX.Y.Z [--dry-run]
REM  Przyklad: deploy.bat windows v1.16.0
REM  Podglad:  deploy.bat windows v1.16.0 --dry-run
REM ===========================================================
setlocal
cd /d "%~dp0"
node scripts/deploy.mjs %*
exit /b %errorlevel%