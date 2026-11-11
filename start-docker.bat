@echo off
REM  Wersja: 1.56.16
REM Rola: Zalecany start istniejacej instalacji S.O.K. w Dockerze.
REM Uzycie: start-docker.bat
REM Uruchamia: start-postgres.bat.
REM Wplyw: Startuje/przebudowuje kontenery; zachowuje wolumen bazy i jego dane.
call "%~dp0start-postgres.bat"
exit /b %errorlevel%
