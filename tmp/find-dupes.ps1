param([string]$file)
$content = Get-Content -Path $file -Raw
$ids = [regex]::Matches($content, 'id="([^"]+)"') | ForEach-Object { $_.Groups[1].Value }
$ids | Group-Object | Where-Object { $_.Count -gt 1 } | ForEach-Object { Write-Output "$($_.Name) x$($_.Count)" }
