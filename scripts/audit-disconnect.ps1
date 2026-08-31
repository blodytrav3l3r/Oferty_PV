# scripts/audit-disconnect.ps1 - S.O.K. P0 Windows: bezpieczny zbieracz diagnostyki rozlaczen
#
# Odpowiednik audit-disconnect.sh dla Windows (start.bat, bez Dockera).
# Tylko odczyt - zero restartow, zero modyfikacji bazy, zero zmian w produkcji.
# Uruchomienie (PowerShell):
#   powershell -ExecutionPolicy Bypass -File scripts\audit-disconnect.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\audit-disconnect.ps1 -SinceHours 2 -OutDir .
#   powershell -ExecutionPolicy Bypass -File scripts\audit-disconnect.ps1 -Port 3000
#
# Wynik: sok-audit-<stamp>.zip w katalogu wyjsciowym (lub .dir gdy brak Compress-Archive).
# Kodowanie: UTF-8 bez BOM.

param(
    [int]$SinceHours = 2,
    [string]$OutDir = ".",
    [int]$Port = 3000,
    [string]$Container = "sok-oferty"
)

$ErrorActionPreference = "Continue"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Resolve-Path (Join-Path $here "..") -ErrorAction SilentlyContinue
if (-not $root) { $root = (Get-Location).Path } else { $root = $root.Path }
Set-Location $root

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$tmp = Join-Path $env:TEMP "sok-audit-$stamp"
New-Item -ItemType Directory -Path $tmp -Force | Out-Null
$resolvedOut = try { (Resolve-Path $OutDir -ErrorAction Stop).Path } catch { $OutDir }
$outZip = Join-Path $resolvedOut "sok-audit-$stamp.zip"
try { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null } catch {}

function Log($msg) { Write-Host "[$(Get-Date -Format o)] $msg" }
function Save-Text($name, $text) {
    $p = Join-Path $tmp $name
    try { Set-Content -LiteralPath $p -Value $text -Encoding utf8 } catch { Set-Content -LiteralPath $p -Value ("[write error] " + $_.Exception.Message) -Encoding utf8 }
}
function Save-Command($title, $scriptBlock, $outName) {
    $header = "`n--- $title ---`n`$ $scriptBlock`n"
    Add-Content -LiteralPath (Join-Path $tmp "00-meta.txt") -Value $header -Encoding utf8
    $out = ""
    try { $out = & $scriptBlock 2>&1 | Out-String } catch { $out = "[error] $($_.Exception.Message)`n$($_.ScriptStackTrace)" }
    if ($outName) {
        Save-Text $outName $out
        Add-Content -LiteralPath (Join-Path $tmp "00-meta.txt") -Value "-> $outName" -Encoding utf8
    } else {
        Add-Content -LiteralPath (Join-Path $tmp "00-meta.txt") -Value $out -Encoding utf8
    }
}

# meta
$meta = @(
    "S.O.K. audit-disconnect (Windows)"
    "stamp: $stamp"
    "sinceHours: $SinceHours"
    "port: $Port"
    "container: $Container (sprawdzany jesli Docker dostepny)"
    "host: $($env:COMPUTERNAME)"
    "user: $($env:USERNAME)"
    "date: $(Get-Date -Format o)"
    "root: $root"
    "pwd: $(Get-Location)"
)
Save-Text "00-meta.txt" ($meta -join "`n")

Log "S.O.K. audit-disconnect (Windows) - start (since=${SinceHours}h, port=$Port, out=$outZip)"

# 1. ENV i DATABASE_URL (trop B) - bez uruchamiania serwera, tylko odczyt plikow
Save-Command "ENV - .env DATABASE_URL / HOST / PORT / TRUST_PROXY" {
    if (Test-Path ".env") {
        Get-Content ".env" | Select-String -Pattern "DATABASE_URL|HOST|PORT|TRUST_PROXY|NODE_ENV|DEFAULT_ADMIN" | ForEach-Object { $_.Line }
        ""
        "--- .env raw DATABASE_URL line ---"
        (Get-Content ".env" | Select-String "DATABASE_URL").Line
    } else { ".env: brak pliku" }
    ""
    "--- process env (PowerShell) ---"
    Get-ChildItem Env: | Where-Object { $_.Name -match "DATABASE_URL|HOST|PORT|TRUST_PROXY|NODE_ENV" } | ForEach-Object { "$($_.Name)=$($_.Value)" }
} "01-env.txt"

Save-Command "src/prismaClient.ts - default connection_limit/busy_timeout" {
    if (Test-Path "src/prismaClient.ts") {
        Select-String -Path "src/prismaClient.ts" -Pattern "connection_limit|busy_timeout|DATABASE_URL" | ForEach-Object { "$($_.Filename):$($_.LineNumber): $($_.Line.Trim())" }
    }
    if (Test-Path "docker-entrypoint.sh") {
        "--- docker-entrypoint.sh DATABASE_URL ---"
        Select-String -Path "scripts/docker-entrypoint.sh" -Pattern "DATABASE_URL" | ForEach-Object { $_.Line.Trim() }
        Select-String -Path "Dockerfile" -Pattern "DATABASE_URL" | ForEach-Object { $_.Line.Trim() }
    }
} "02-prisma-default.txt"

# 2. PRAGMA journal_mode / busy_timeout / synchronous (trop B - wymaga uruchomionej bazy)
Save-Command "PRAGMA - sqlite3 lub Node fallback" {
    $dbCandidates = @("data/app_database.sqlite", "prisma/data/app_database.sqlite", "data\app_database.sqlite")
    $db = $null
    foreach ($c in $dbCandidates) { if (Test-Path $c) { $db = (Resolve-Path $c).Path; break } }
    if (-not $db) { "Baza nie znaleziona w: $($dbCandidates -join ', ')"; return }
    "DB: $db"
    $hasSqlite3 = Get-Command sqlite3 -ErrorAction SilentlyContinue
    if ($hasSqlite3) {
        "--- sqlite3 PRAGMA ---"
        & sqlite3 $db "PRAGMA journal_mode; PRAGMA busy_timeout; PRAGMA synchronous;" 2>&1 | Out-String
    } else {
        "sqlite3: brak w PATH - uzywam Node fallback"
    }
    "--- Node prisma PRAGMA (fallback, read-only) ---"
    if (Test-Path "dist/src/prismaClient.js") {
        $tmpJs = Join-Path $env:TEMP "sok-pragma-$([Guid]::NewGuid().ToString('N').Substring(0,8)).cjs"
        Set-Content -LiteralPath $tmpJs -Value "require('I:/GitHub/Oferty_PV/node_modules/dotenv').config({path:'I:/GitHub/Oferty_PV/.env'});const c=require('I:/GitHub/Oferty_PV/dist/src/prismaClient.js').default;Promise.all([c.`$queryRawUnsafe('PRAGMA journal_mode'),c.`$queryRawUnsafe('PRAGMA busy_timeout'),c.`$queryRawUnsafe('PRAGMA synchronous')]).then(r=>{console.log(JSON.stringify(r,(k,v)=>typeof v==='bigint'?v.toString():v,2));return c.`$disconnect()}).catch(e=>{console.error('PRAGMA error',e.message);process.exit(1)});" -Encoding utf8
        try { node $tmpJs 2>&1 | Out-String } finally { Remove-Item $tmpJs -Force -ErrorAction SilentlyContinue }
    } else {
        "dist/src/prismaClient.js: brak (uruchom npm run build aby umozliwic Node PRAGMA check)"
        "Alternatywnie: npx --yes sqlite3 $db 'PRAGMA journal_mode; PRAGMA busy_timeout;'"
    }
    ""
    "--- ls -lh data ---"
    Get-ChildItem "data" -ErrorAction SilentlyContinue | Format-Table Name, Length, LastWriteTime | Out-String
    try { (Get-Item $db).Length } catch {}
} "03-pragma.txt"

# 3. Logi aplikacji - grep A/B/E (trop A: UnhandledRejection, B: SQLITE_BUSY, E: CronService co 15 min)
Save-Command "Logi - grep UnhandledRejection/SQLITE_BUSY/CronService/429" {
    $patterns = @("UnhandledRejection","UncaughtException","flushSentry","UnhandledError","SQLITE_BUSY","busy","PRAGMA","P1017","Unable to open","CronService","mlTraining","fullCycle","Retry-After"," 429 ")
    $logFiles = @("data/*.log","logs/*.log","*.log") | ForEach-Object { Get-ChildItem $_ -ErrorAction SilentlyContinue } | Select-Object -ExpandProperty FullName
    if (-not $logFiles) { "Brak plikow logow w data/*.log - przeszukuje caly projekt (bez node_modules)..." }
    $cutoff = (Get-Date).AddHours(-$SinceHours)
    $found = 0
    Get-ChildItem -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch "node_modules|\\.git|dist|\\.next" -and $_.Extension -in @(".log",".txt") } |
        ForEach-Object {
            $hits = Select-String -LiteralPath $_.FullName -Pattern $patterns -ErrorAction SilentlyContinue | Select-Object -Last 50
            if ($hits) { $found++; "== $($_.FullName) =="; $hits | ForEach-Object { "$($_.LineNumber): $($_.Line.Trim())" } }
        } | Out-String | ForEach-Object { $_ }
    if ($found -eq 0) { "(brak dopasowan w logach z ostatnich $SinceHours h - to nie wyklucza A, jesli logi sa tylko na stdout Dockera)" }
    ""
    "--- src/utils/logger - format logow ---"
    if (Test-Path "src/utils/logger.ts") { Get-Content "src/utils/logger.ts" | Select-Object -First 30 | Out-String }
} "10-logs-grep.txt"

# 4. Stan procesu Node / port 3000 - czy serwer odpowiada (C: /health vs /health/ready)
Save-Command "Procesy Node + porty" {
    "--- Get-Process node ---"
    Get-Process node -ErrorAction SilentlyContinue | Format-Table Id, ProcessName, CPU, WorkingSet64, StartTime | Out-String
    if (-not (Get-Process node -ErrorAction SilentlyContinue)) { "(brak procesu node - serwer nie uruchomiony; test curl ponizej pokaze connection refused, co jest oczekiwane)" }
    ""
    "--- netstat -ano | findstr $Port / 10000 ---"
    netstat -ano 2>&1 | Select-String -Pattern "3000|10000|LISTENING" | Select-Object -First 20 | ForEach-Object { $_.Line }
    ""
    "--- Get-NetTCPConnection (jesli dostepny) ---"
    try { Get-NetTCPConnection -LocalPort $Port -ErrorAction Stop | Format-Table LocalAddress, LocalPort, State, OwningProcess | Out-String } catch { "(Get-NetTCPConnection niedostepny lub port nie nasluchuje)" }
} "20-process-ports.txt"

Save-Command "curl /health* - liveness vs readiness (C)" {
    $base = "http://localhost:$Port"
    foreach ($path in @("/health","/health/live","/health/ready","/api/version")) {
        $url = "$base$path"
        Write-Output "`n== GET $url =="
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        try {
            $res = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 12 -ErrorAction Stop
            $sw.Stop()
            "HTTP $($res.StatusCode) time=$([math]::Round($sw.Elapsed.TotalSeconds,3))s"
            "Headers: X-Request-Id=$($res.Headers['X-Request-Id']) X-RateLimit-Limit=$($res.Headers['X-RateLimit-Limit']) X-RateLimit-Remaining=$($res.Headers['X-RateLimit-Remaining']) Retry-After=$($res.Headers['Retry-After'])"
            ($res.Content | Out-String).Substring(0, [Math]::Min(800, $res.Content.Length))
        } catch {
            $sw.Stop()
            $code = ""
            if ($_.Exception.Response) { try { $code = [int]$_.Exception.Response.StatusCode } catch {} }
            "FAIL time=$([math]::Round($sw.Elapsed.TotalSeconds,3))s code=$code error=$($_.Exception.Message.Split("`n")[0])"
            if ($_.ErrorDetails.Message) { ($_.ErrorDetails.Message | Out-String).Substring(0, [Math]::Min(600, $_.ErrorDetails.Message.Length)) }
        }
    }
} "21-curl-health.txt"

Save-Command "Rate-limit naglowki (D) - 5 szybkich requestow" {
    $url = "http://localhost:$Port/api/version"
    for ($i=1; $i -le 5; $i++) {
        try {
            $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 8 -ErrorAction Stop
            "[$i] HTTP $($r.StatusCode) Remaining=$($r.Headers['X-RateLimit-Remaining']) Limit=$($r.Headers['X-RateLimit-Limit'])"
        } catch {
            $code = ""; if ($_.Exception.Response) { try { $code=[int]$_.Exception.Response.StatusCode } catch {} }
            "[$i] FAIL code=$code $($_.Exception.Message.Split("`n")[0])"
            if ($code -eq 429) { "  Retry-After=$($_.Exception.Response.Headers.GetValues('Retry-After') -join ',')" }
        }
        Start-Sleep -Milliseconds 200
    }
} "22-ratelimit.txt"

# 5. Docker (jesli dostepny na Windows - Docker Desktop) - ten sam zestaw co .sh
Save-Command "Docker - ps/inspect/logs (jesli Docker Desktop)" {
    $hasDocker = Get-Command docker -ErrorAction SilentlyContinue
    if (-not $hasDocker) { "docker: brak w PATH (oczekiwane na Windows bez Dockera - pominieto)"; return }
    "--- docker ps -a ---"
    docker ps -a 2>&1 | Out-String
    "--- docker inspect $Container State ---"
    docker inspect $Container --format '{{json .State}}' 2>&1 | Out-String
    "--- docker inspect Health ---"
    docker inspect $Container --format '{{json .State.Health}}' 2>&1 | Out-String
    "--- docker logs --since ${SinceHours}h (tail 200) ---"
    docker logs --since "${SinceHours}h" --timestamps $Container 2>&1 | Select-Object -Last 200 | Out-String
    "--- grep rejection/busy/cron w docker logs ---"
    $logs = docker logs --since "${SinceHours}h" --timestamps $Container 2>&1 | Out-String
    $logs -split "`n" | Select-String -Pattern "UnhandledRejection|UncaughtException|SQLITE_BUSY|busy|CronService|429" | Select-Object -Last 50 | ForEach-Object { $_.Line }
} "30-docker.txt"

# 6. Host - zasoby, dysk, mount (roznica Windows vs Linux)
Save-Command "Host - CPU/RAM/dysk" {
    "--- free (Get-CimInstance Win32_OperatingSystem) ---"
    try {
        $os = Get-CimInstance Win32_OperatingSystem
        "FreePhysicalMemory: $([math]::Round($os.FreePhysicalMemory/1024)) MB / TotalVisibleMemory: $([math]::Round($os.TotalVisibleMemorySize/1024)) MB"
        "FreeVirtualMemory: $([math]::Round($os.FreeVirtualMemory/1024)) MB"
    } catch { "(Get-CimInstance nieudany: $($_.Exception.Message))" }
    "--- uptime ---"
    try { "Uptime: $((Get-Date) - (Get-CimInstance Win32_OperatingSystem).LastBootUpTime)" } catch { "(uptime nieudany)" }
    "--- df -h (Get-PSDrive) ---"
    Get-PSDrive -PSProvider FileSystem | Format-Table Name, Used, Free, Root | Out-String
    "--- data dir ---"
    if (Test-Path "data") { Get-ChildItem "data" | Format-Table Name, Length, LastWriteTime | Out-String | Select-Object -First 60 } else { "data/: brak" }
    "--- mount / FS type (Get-Volume) ---"
    try { Get-Volume | Format-Table DriveLetter, FileSystem, FileSystemLabel, SizeRemaining, Size | Out-String } catch { "(Get-Volume nieudany)" }
} "40-host-resources.txt"

Save-Command "Kod - server.ts / app.ts / cronService (A/C/E)" {
    "--- server.ts unhandledRejection/uncaughtException ---"
    if (Test-Path "server.ts") { Select-String -Path "server.ts" -Pattern "unhandledRejection|uncaughtException|flushSentryAndExit|process\.exit" | ForEach-Object { "$($_.LineNumber): $($_.Line.Trim())" } }
    "--- src/app.ts trust proxy + rateLimiter + health ---"
    if (Test-Path "src/app.ts") {
        Select-String -Path "src/app.ts" -Pattern "trust proxy|TRUST_PROXY|createRateLimiter|apiLimiter|/health" | ForEach-Object { "$($_.LineNumber): $($_.Line.Trim())" } | Select-Object -First 20
    }
    "--- src/utils/cronService.ts schedule ---"
    if (Test-Path "src/utils/cronService.ts") { Select-String -Path "src/utils/cronService.ts" -Pattern "schedule|setInterval|mlTraining|fullCycle|running\.has" | ForEach-Object { "$($_.LineNumber): $($_.Line.Trim())" } }
} "41-code-refs.txt"

# 7. Werdykt P0 - wskazowki
$verdict = @"
WERDYKT P0 - wskazowki (Windows, bez Dockera - nie rozstrzyga B/C infra)
======================================================
Sprawdz w archiwum:
  01-env.txt              - DATABASE_URL bez ?busy_timeout na Windows OK (dev fallback ma 30000),
                           ale w Dockerze brak parametru = trop B
  03-pragma.txt           - UWAGA per-connection: wartosc z osobnego polaczenia (Node fallback) NIE dowodzi
                           wartosci w app; brak WARN PRAGMA to dowod posredni; najmocniej: PRAGMA na tym
                           samym polaczeniu Prisma lub test lock contention
  10-logs-grep.txt        - UnhandledRejection/UncaughtException => hipoteza A (exit+restart) WYSOKIE
  20/21-*.txt             - /health 200 + /health/ready 503 => C (readiness); connection refused => serwer nie dziala
  22-ratelimit.txt        - 429 Retry-After => D (tylko przy wielu klientach/NAT)
  30-docker.txt           - jesli Docker Desktop: RestartCount/Health porownaj z Linux
  41-code-refs.txt        - server.ts:41 flushSentryAndExit + app.ts:56 trust proxy + cronService 15 min

Na Windows glownie potwierdzisz A/E (kod) i wykluczysz D (smoke).
Pelny werdykt wymaga archiwum z Linux (audit-disconnect.sh) - tam 40-env + 41-pragma na tym
samym polaczeniu lub reprodukcja locka rozstrzyga B definitywnie.

Bezpieczenstwo: NIE zmieniaj globalnego handlera unhandledRejection na 'log bez exit'
przed znalezieniem zrodla - zamieni kontrolowany restart na dzialanie w uszkodzonym stanie.
"@
Save-Text "99-WERDYKT-P0.txt" $verdict
Add-Content -LiteralPath (Join-Path $tmp "00-meta.txt") -Value "`n$verdict" -Encoding utf8
Write-Host "`n$verdict`n"

# Pakowanie
Log "Pakowanie archiwum: $outZip"
$zipOk = $false
try {
    if (Get-Command Compress-Archive -ErrorAction SilentlyContinue) {
        if (Test-Path $outZip) { Remove-Item $outZip -Force }
        Compress-Archive -Path (Join-Path $tmp "*") -DestinationPath $outZip -Force
        $zipOk = $true
    }
} catch { Log "Compress-Archive nieudany: $($_.Exception.Message)" }

if (-not $zipOk) {
    $outDir = Join-Path $OutDir "sok-audit-$stamp.dir"
    try { New-Item -ItemType Directory -Path $outDir -Force | Out-Null } catch {}
    Copy-Item -Path (Join-Path $tmp "*") -Destination $outDir -Force
    $outZip = (Resolve-Path $outDir).Path
    Log "Brak Compress-Archive - zapisano katalog: $outZip"
} else {
    Log "Gotowe: $outZip"
    try { $size = (Get-Item $outZip).Length; Log "Rozmiar: $size bajtow" } catch {}
}

Write-Host "`nZawartosc:"
Get-ChildItem $tmp | Format-Table Name, Length, LastWriteTime | Out-String | Write-Host
Write-Host "`nPodglad meta (ostatnie 80 linii):"
Get-Content (Join-Path $tmp "00-meta.txt") -Tail 80 | ForEach-Object { Write-Host $_ }

# Nie usuwaj tmp jesli zip nieudany - zostaw do inspekcji; jesli zip OK - posprzataj
if ($zipOk) { try { Remove-Item $tmp -Recurse -Force } catch {} } else { Log "Katalog tymczasowy zachowany: $tmp" }

# Kod wyjscia: 0 zawsze (diagnostyka nie blokuje builda)
exit 0
