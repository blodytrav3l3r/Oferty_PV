# graphify-query.ps1 — query graph z cache
# Usage: .\scripts\graphify-query.ps1 "pytanie"
# Zwraca: wynik z cache/ lub nowy query, zapisuje do cache

param([string]$Question)

if (-not $Question) {
    Write-Host "Usage: .\scripts\graphify-query.ps1 ""pytanie"""
    exit 1
}

# Generate hash from question (simple hash, no external deps)
$hashStream = [System.Security.Cryptography.MD5]::Create()
$hashBytes = $hashStream.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($Question))
$hash = -join ($hashBytes | ForEach-Object { $_.ToString("x2") })
$cacheFile = "graphify-out/query-cache/$hash.json"

if (Test-Path $cacheFile) {
    Write-Host "[graphify-query] CACHE HIT: $Question"
    Get-Content $cacheFile -Raw
    exit 0
}

Write-Host "[graphify-query] CACHE MISS: $Question"

# Determine Python path
$python = "python3"
if (-not (Get-Command $python -ErrorAction SilentlyContinue)) {
    $python = "python"
}

# Run graphify query — output to variable
$result = & $python -m graphify query "$Question" --budget 1500 2>&1 | Out-String
$result | Out-File -FilePath $cacheFile -Encoding utf8
Write-Host $result
Write-Host "[graphify-query] Saved to cache/$hash.json"
