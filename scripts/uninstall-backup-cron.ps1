# Usuwa Windows Task Scheduler wpis dla backupu.

$ErrorActionPreference = 'Stop'
$taskName = 'SOK-Oferty-DailyBackup'
$legacyTaskName = 'WITROS-Oferty-DailyBackup'

# Migracja po rebrandingu — usuń zadanie sprzed zmiany nazwy (idempotentne, no-op na świeżych instalacjach)
Unregister-ScheduledTask -TaskName $legacyTaskName -Confirm:$false -ErrorAction SilentlyContinue

$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if (-not $existing) {
    Write-Host "Task '$taskName' nie istnieje. Nic do zrobienia." -ForegroundColor Yellow
    exit 0
}

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
Write-Host "Task '$taskName' usunięty." -ForegroundColor Green
