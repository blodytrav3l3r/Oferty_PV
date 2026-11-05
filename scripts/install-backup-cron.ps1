# Instaluje Windows Task Scheduler wpis: codzienny PostgreSQL backup o 02:00.
# Uruchom jako administrator:  powershell -ExecutionPolicy Bypass -File install-backup-cron.ps1

$ErrorActionPreference = 'Stop'

$taskName = 'SOK-Oferty-DailyBackup'

# Migracja po rebrandingu — usuń zadanie sprzed zmiany nazwy (idempotentne, no-op na świeżych instalacjach)
Unregister-ScheduledTask -TaskName 'WITROS-Oferty-DailyBackup' -Confirm:$false -ErrorAction SilentlyContinue
$projectRoot = Split-Path -Parent $PSScriptRoot
$npmCmd = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
if (-not $npmCmd) { $npmCmd = (Get-Command npm -ErrorAction SilentlyContinue).Source }
if (-not $npmCmd) {
    Write-Error "Nie znaleziono npm. Zainstaluj Node.js 22.13+."
    exit 1
}

Write-Host "Projekt: $projectRoot"
Write-Host "npm:     $npmCmd"

$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $pgDump) {
    Write-Error "Brak pg_dump. Zainstaluj klienta PostgreSQL 18 i dodaj jego katalog bin do PATH."
    exit 1
}
$pgDumpVersionText = & $pgDump.Source --version
$pgDumpVersionMatch = [regex]::Match($pgDumpVersionText, '\b(\d+)\.')
$pgDumpVersion = $pgDumpVersionMatch.Groups[1].Value
if ($pgDumpVersion -ne '18') {
    Write-Error "Backup wymaga pg_dump 18; znaleziono wersję $pgDumpVersion."
    exit 1
}
$envFile = Join-Path $projectRoot '.env'
if (-not (Test-Path -LiteralPath $envFile) -or -not (Select-String -Path $envFile -Pattern '^BACKUP_DATABASE_URL=.+$' -Quiet)) {
    Write-Error "Ustaw BACKUP_DATABASE_URL w .env jako połączenie PostgreSQL rolą backupu."
    exit 1
}
Write-Host "pg_dump:  $((& $pgDump.Source --version).Trim())"

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
    -Description "Codzienny backup PostgreSQL 18 przez pg_dump custom archive." `
    -RunLevel Highest

Write-Host ""
Write-Host "Task '$taskName' zarejestrowany. Uruchomienie codziennie o 02:00." -ForegroundColor Green
Write-Host "Status:    Get-ScheduledTask -TaskName '$taskName'"
Write-Host "Run now:   Start-ScheduledTask -TaskName '$taskName'"
Write-Host "Uninstall: powershell -File scripts\uninstall-backup-cron.ps1"
