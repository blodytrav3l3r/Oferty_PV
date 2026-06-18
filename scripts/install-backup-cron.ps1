# Instaluje Windows Task Scheduler wpis: codzienny backup SQLite o 02:00.
# Uruchom jako administrator:  powershell -ExecutionPolicy Bypass -File install-backup-cron.ps1

$ErrorActionPreference = 'Stop'

$taskName = 'WITROS-Oferty-DailyBackup'
$projectRoot = Split-Path -Parent $PSScriptRoot
$npmCmd = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
if (-not $npmCmd) { $npmCmd = (Get-Command npm -ErrorAction SilentlyContinue).Source }
if (-not $npmCmd) {
    Write-Error "Nie znaleziono npm. Zainstaluj Node.js 20+."
    exit 1
}

Write-Host "Projekt: $projectRoot"
Write-Host "npm:     $npmCmd"

# Sprawdź czy task już istnieje
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Task '$taskName' już istnieje. Usuwam..."
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

$action = New-ScheduledTaskAction `
    -Execute $npmCmd `
    -Argument 'run backup' `
    -WorkingDirectory $projectRoot

$trigger = New-ScheduledTaskTrigger -Daily -At '02:00'

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Codzienny backup SQLite (data/app_database.sqlite) dla WITROS Oferty. VACUUM INTO jest WAL-safe - nie blokuje aplikacji." `
    -RunLevel Highest

Write-Host ""
Write-Host "Task '$taskName' zarejestrowany. Uruchomienie codziennie o 02:00." -ForegroundColor Green
Write-Host "Status:    Get-ScheduledTask -TaskName '$taskName'"
Write-Host "Run now:   Start-ScheduledTask -TaskName '$taskName'"
Write-Host "Uninstall: powershell -File scripts\uninstall-backup-cron.ps1"
