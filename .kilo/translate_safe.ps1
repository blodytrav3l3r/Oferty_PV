$repl = [ordered]@{}

# router.js
$repl['// ---- State ----'] = '// ---- Stan ----'
$repl['// ---- Config ----'] = '// ---- Konfiguracja ----'
$repl['// ---- Helpers ----'] = '// ---- Pomocnicy ----'
$repl['// ---- Public API ----'] = '// ---- Publiczne API ----'

$files = @(
    'I:\GitHub\Oferty_PV\public\js\spa\router.js',
    'I:\GitHub\Oferty_PV\public\js\sales\pvSalesUi.js',
    'I:\GitHub\Oferty_PV\public\js\spa\zlecenia.js'
)

$total = 0
foreach ($file in $files) {
    if (-not (Test-Path $file)) { continue }
    $content = Get-Content $file -Raw
    $c = 0
    foreach ($old in $repl.Keys) {
        if ($content.Contains($old)) {
            $content = $content.Replace($old, $repl[$old])
            $c++
        }
    }
    if ($c -gt 0) {
        Set-Content -Path $file -Value $content -NoNewline
        Write-Host "OK ($c): $(Split-Path $file -Leaf)"
        $total += $c
    }
}
Write-Host "Total: $total"
