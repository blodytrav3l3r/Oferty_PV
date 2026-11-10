@echo off
REM  Wersja: 1.56.10
REM Rola: Start aplikacji developerskiej z osobna testowa baza PostgreSQL w Dockerze.
REM Uzycie: start-dev.bat
REM Uruchamia: start-native.bat -Watch -StartTestDatabase.
REM Wplyw: Startuje baze testowa Docker; nie migruje ani nie seeduje lokalnej bazy aplikacji.
call "%~dp0start-native.bat" -Watch -StartTestDatabase
exit /b %errorlevel%
