param(
    [switch]$Watch,
    [switch]$StartTestDatabase
)

$ErrorActionPreference = 'Stop'

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$cluster = $null
$pgCtl = $null
$startedPostgresHere = $false
$exitCode = 1
$previousValues = @{
    DATABASE_URL = [Environment]::GetEnvironmentVariable('DATABASE_URL', 'Process')
    HOST = [Environment]::GetEnvironmentVariable('HOST', 'Process')
    PORT = [Environment]::GetEnvironmentVariable('PORT', 'Process')
    NODE_ENV = [Environment]::GetEnvironmentVariable('NODE_ENV', 'Process')
    POSTGRES_TEST_PORT = [Environment]::GetEnvironmentVariable('POSTGRES_TEST_PORT', 'Process')
    POSTGRES_TEST_URL = [Environment]::GetEnvironmentVariable('POSTGRES_TEST_URL', 'Process')
}

function Find-NativePostgresRoot {
    param([string]$RepositoryRoot)

    $performanceRoot = Join-Path $RepositoryRoot 'data\perf'
    if (-not (Test-Path -LiteralPath $performanceRoot)) {
        throw 'Native PostgreSQL setup was not found under data\perf.'
    }

    $candidates = @(
        Get-ChildItem -LiteralPath $performanceRoot -Directory -Filter 'sok-native-pg18-*' |
            Where-Object {
                (Test-Path (Join-Path $_.FullName 'cluster-native\PG_VERSION')) -and
                (Test-Path (Join-Path $_.FullName 'runtime\pgsql\bin\pg_ctl.exe')) -and
                (Test-Path (Join-Path $_.FullName 'native-db-password.txt'))
            } |
            Sort-Object Name -Descending
    )

    if ($candidates.Count -eq 0) {
        throw 'Native PostgreSQL 18 is not installed. Install the local PostgreSQL setup first.'
    }

    return $candidates[0].FullName
}

function Find-AvailableAppPort {
    for ($port = 3000; $port -le 3100; $port++) {
        $probe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
        $probe.ExclusiveAddressUse = $true
        try {
            $probe.Start()
            return $port
        } catch [System.Net.Sockets.SocketException] {
            if ($_.Exception.SocketErrorCode -notin @(
                    [System.Net.Sockets.SocketError]::AddressAlreadyInUse,
                    [System.Net.Sockets.SocketError]::AccessDenied
                )) {
                throw
            }
        } finally {
            $probe.Stop()
        }
    }

    throw 'No free application port is available between 3000 and 3100.'
}

function Wait-PostgresReady {
    param([string]$PgIsReady)

    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        & $PgIsReady --host=127.0.0.1 --port=55432 *> $null
        if ($LASTEXITCODE -eq 0) {
            return $true
        }
        Start-Sleep -Milliseconds 500
    }

    return $false
}

function Start-TestDatabase {
    if (-not (Get-Command docker.exe -ErrorAction SilentlyContinue)) {
        throw 'Docker Desktop is required by start-dev.bat to run the isolated PostgreSQL test database.'
    }

    & docker.exe info *> $null
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker is not running. Start Docker Desktop and retry start-dev.bat.'
    }

    & docker.exe compose -f docker-compose.postgres-test.yml config --quiet
    if ($LASTEXITCODE -ne 0) {
        throw 'PostgreSQL test database configuration is invalid. Check POSTGRES_TEST_* in .env.'
    }

    $runningContainer = & docker.exe compose -f docker-compose.postgres-test.yml ps --status running --quiet postgres-test
    if ($LASTEXITCODE -eq 0 -and $runningContainer) {
        & docker.exe compose -f docker-compose.postgres-test.yml up -d --wait
        if ($LASTEXITCODE -eq 0) {
            & node.exe scripts/postgres-test-url.cjs
            if ($LASTEXITCODE -eq 0) {
                Write-Host 'Reusing the running PostgreSQL test database.'
                return
            }
        }
    }

    $started = $false
    for ($attempt = 0; $attempt -lt 5; $attempt++) {
        $portConfigJson = & node.exe scripts/postgres-test-url.cjs --prepare-port
        if ($LASTEXITCODE -ne 0) {
            throw 'Could not select a local port for the PostgreSQL test database. Check POSTGRES_TEST_* in .env.'
        }
        $portConfig = ($portConfigJson -join '') | ConvertFrom-Json
        $env:POSTGRES_TEST_PORT = [string]$portConfig.port
        $env:POSTGRES_TEST_URL = [string]$portConfig.url
        if ($portConfig.changed) {
            Write-Host "Test database port is occupied; using port $($portConfig.port). Local .env test settings were updated."
        }

        & docker.exe compose -f docker-compose.postgres-test.yml config --quiet
        if ($LASTEXITCODE -ne 0) {
            throw 'PostgreSQL test database configuration is invalid. Check POSTGRES_TEST_* in .env.'
        }

        & docker.exe compose -f docker-compose.postgres-test.yml up -d --wait
        if ($LASTEXITCODE -eq 0) {
            $started = $true
            break
        }

        $nextPortConfigJson = & node.exe scripts/postgres-test-url.cjs --prepare-port
        if ($LASTEXITCODE -ne 0) { break }
        $nextPortConfig = ($nextPortConfigJson -join '') | ConvertFrom-Json
        if (-not $nextPortConfig.changed) { break }
        $env:POSTGRES_TEST_PORT = [string]$nextPortConfig.port
        $env:POSTGRES_TEST_URL = [string]$nextPortConfig.url
        Write-Host "Port $($portConfig.port) became occupied; retrying with port $($nextPortConfig.port)."
    }

    if (-not $started) {
        throw 'Could not start the PostgreSQL test database on a free local port.'
    }

    & node.exe scripts/postgres-test-url.cjs
    if ($LASTEXITCODE -ne 0) {
        throw 'PostgreSQL test database is not reachable. Check POSTGRES_TEST_URL in .env.'
    }

    Write-Host "PostgreSQL test database is ready on port $env:POSTGRES_TEST_PORT."
}

try {
    Set-Location -LiteralPath $repoRoot

    $appPort = Find-AvailableAppPort
    if ($appPort -ne 3000) {
        Write-Host "Port 3000 is occupied; using http://localhost:$appPort instead."
    }

    if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
        throw 'Node.js was not found. Install Node.js before starting S.O.K.'
    }
    if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
        throw 'npm was not found. Install Node.js with npm before starting S.O.K.'
    }
    if (-not (Test-Path (Join-Path $repoRoot 'node_modules'))) {
        throw 'node_modules is missing. Run npm install first.'
    }
    if ($StartTestDatabase) {
        Start-TestDatabase
    }
    $nativeRoot = Find-NativePostgresRoot -RepositoryRoot $repoRoot
    $cluster = Join-Path $nativeRoot 'cluster-native'
    $pgBin = Join-Path $nativeRoot 'runtime\pgsql\bin'
    $pgCtl = Join-Path $pgBin 'pg_ctl.exe'
    $pgIsReady = Join-Path $pgBin 'pg_isready.exe'
    $passwordFile = Join-Path $nativeRoot 'native-db-password.txt'

    & $pgIsReady --host=127.0.0.1 --port=55432 *> $null
    $postgresReady = $LASTEXITCODE -eq 0
    $statusArgs = @('status', "--pgdata=$cluster")
    & $pgCtl @statusArgs *> $null
    $targetClusterRunning = $LASTEXITCODE -eq 0

    if ($postgresReady -and -not $targetClusterRunning) {
        throw 'Port 55432 belongs to another PostgreSQL server. No database was changed.'
    }

    if (-not $postgresReady -and $targetClusterRunning) {
        if (-not (Wait-PostgresReady -PgIsReady $pgIsReady)) {
            throw 'The native PostgreSQL cluster is running but not accepting connections.'
        }
    }

    if (-not $postgresReady -and -not $targetClusterRunning) {
        $pidFile = Join-Path $cluster 'postmaster.pid'
        if (Test-Path -LiteralPath $pidFile) {
            $oldPid = [int](Get-Content -LiteralPath $pidFile -TotalCount 1)
            if (Get-Process -Id $oldPid -ErrorAction SilentlyContinue) {
                throw 'The PostgreSQL PID file points to a running process; refusing to remove it.'
            }
            Remove-Item -LiteralPath $pidFile
        }

        $startArgs = @(
            'start',
            "--pgdata=$cluster",
            "--log=$(Join-Path $nativeRoot 'postgres-host.log')",
            '--options=-h 127.0.0.1 -p 55432',
            '--wait',
            '--timeout=30'
        )
        & $pgCtl @startArgs
        if ($LASTEXITCODE -ne 0) {
            throw 'Could not start the native PostgreSQL cluster.'
        }
        $startedPostgresHere = $true

        if (-not (Wait-PostgresReady -PgIsReady $pgIsReady)) {
            throw 'Native PostgreSQL did not become ready on port 55432.'
        }
    }

    $password = (Get-Content -LiteralPath $passwordFile -Raw).Trim()
    if (-not $password) {
        throw 'The local PostgreSQL password file is empty.'
    }

    $escapedPassword = [uri]::EscapeDataString($password)
    $env:DATABASE_URL = "postgresql://sok_dev:$escapedPassword@127.0.0.1:55432/sok_dev?schema=public"
    $env:HOST = '127.0.0.1'
    $env:PORT = [string]$appPort
    $env:NODE_ENV = 'development'

    if (-not (Test-Path (Join-Path $repoRoot 'generated\prisma-postgres\client.d.ts'))) {
        Write-Host 'Generating Prisma Client...'
        & npx.cmd prisma generate
        if ($LASTEXITCODE -ne 0) {
            throw 'Prisma Client generation failed.'
        }
    }

    & node.exe scripts/check-db.js
    if ($LASTEXITCODE -ne 0) {
        throw 'The local database is not ready. No migrations or seed were run.'
    }

    Write-Host "Starting S.O.K. at http://localhost:$appPort. Press Ctrl+C to stop."
    if ($Watch) {
        & npm.cmd run dev
    } else {
        & node.exe -r ts-node/register/transpile-only server.ts
    }
    $exitCode = $LASTEXITCODE
} catch {
    Write-Host "[ERROR] $($_.Exception.Message)"
    $exitCode = 1
} finally {
    foreach ($name in $previousValues.Keys) {
        [Environment]::SetEnvironmentVariable($name, $previousValues[$name], 'Process')
    }

    if ($startedPostgresHere -and $pgCtl -and $cluster) {
        $stopArgs = @('stop', "--pgdata=$cluster", '--mode=fast', '--wait', '--timeout=30')
        & $pgCtl @stopArgs
        if ($LASTEXITCODE -ne 0) {
            Write-Host '[WARN] Native PostgreSQL did not stop cleanly.'
        }
    }
}

exit $exitCode
