@echo off
REM Git Safety wrapper — PowerShell / CMD
REM Etap 4: dirty -> snapshot -> verify -> authorize -> exec
node "%~dp0..\..\..\scripts\git-safety\guard.mjs" %*
