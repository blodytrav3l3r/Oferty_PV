# Usuwa Windows Task Scheduler wpis dla backupu.

$ErrorActionPreference = 'Stop'
$taskName = 'WITROS-Oferty-DailyBackup'

$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if (-not $existing) {
    Write-Host "Task '$taskName' nie istnieje. Nic do zrobienia." -ForegroundColor Yellow
    exit 0
}

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
Write-Host "Task '$taskName' usunięty." -ForegroundColor Green
