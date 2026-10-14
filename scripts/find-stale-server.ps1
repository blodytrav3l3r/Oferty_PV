# find-stale-server.ps1 - wypisuje PID procesow node martwego serwera S.O.K.
# (ts-node-dev / server.ts / server.js, takze bez listenera na :3000).
# Jeden PID na linie, brak outputu gdy czysto. ASCII-only (kontrakt .bat).
$procs = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {
    $_.CommandLine -like '*ts-node-dev*' -or
    $_.CommandLine -like '*server.ts*' -or
    $_.CommandLine -like '*server.js*'
}
foreach ($p in $procs) {
    Write-Output $p.ProcessId
}
