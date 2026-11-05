param([switch]$ResumeExistingVolume)

$ErrorActionPreference = 'Stop'
# Windows Compose publishes the app on loopback without a TLS proxy.
$env:HTTPS_ENABLED = 'false'
$script:AdminCredentialMatchesInstalledAccount = $null

function Write-Step {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host "`n[INFO] $Message"
}

function Invoke-Checked {
    param(
        [Parameter(Mandatory)][string]$Command,
        [Parameter(Mandatory)][string[]]$Arguments,
        [Parameter(Mandatory)][string]$FailureMessage
    )

    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw $FailureMessage
    }
}

function Enable-DockerCredentialHelper {
    param([Parameter(Mandatory)][string]$DockerPath)

    $dockerDirectory = Split-Path -Parent $DockerPath
    $credentialHelper = Join-Path $dockerDirectory 'docker-credential-desktop.exe'
    $pathEntries = @($env:PATH -split [IO.Path]::PathSeparator)
    $isOnPath = @($pathEntries | Where-Object {
        $_.TrimEnd('\') -ieq $dockerDirectory.TrimEnd('\')
    }).Count -gt 0
    if ((Test-Path -LiteralPath $credentialHelper -PathType Leaf) -and -not $isOnPath) {
        $env:PATH = $dockerDirectory + [IO.Path]::PathSeparator + $env:PATH
    }
}

function Get-DockerCli {
    $command = Get-Command docker.exe -ErrorAction SilentlyContinue
    if ($command) {
        Enable-DockerCredentialHelper -DockerPath $command.Source
        return $command.Source
    }

    $candidates = @(
        (Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin\docker.exe'),
        'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
    )
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            Enable-DockerCredentialHelper -DockerPath $candidate
            return $candidate
        }
    }

    return $null
}

function Get-DockerDesktopApp {
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\Docker Desktop.exe'),
        'C:\Program Files\Docker\Docker\Docker Desktop.exe'
    )
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            return $candidate
        }
    }

    return $null
}

function Test-PrivateFileAcl {
    param([Parameter(Mandatory)][string]$Path)

    $currentSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
    $allowedSids = @($currentSid.Value, 'S-1-5-18', 'S-1-5-32-544')
    $acl = Get-Acl -LiteralPath $Path
    $seenSids = @()
    foreach ($rule in $acl.Access) {
        $ruleSid = $rule.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value
        if ($rule.IsInherited -or $ruleSid -notin $allowedSids -or $rule.AccessControlType -ne 'Allow' -or
            $rule.FileSystemRights -ne [System.Security.AccessControl.FileSystemRights]::FullControl) {
            return $false
        }
        $seenSids += $ruleSid
    }

    return @($allowedSids | Where-Object { $_ -notin $seenSids }).Count -eq 0
}

function Set-PrivateFileAcl {
    param([Parameter(Mandatory)][string]$Path)

    $currentSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
    $icacls = Get-Command icacls.exe -ErrorAction SilentlyContinue
    if (-not $icacls) {
        throw 'icacls.exe is required to protect local secret files.'
    }

    & $icacls.Source $Path '/inheritance:r' '/remove:g' '*S-1-1-0' '*S-1-5-11' '*S-1-5-32-545' '*S-1-5-32-546' '/grant:r' "*$($currentSid.Value):(F)" '*S-1-5-18:(F)' '*S-1-5-32-544:(F)' *> $null
    $aclCommandFailed = $LASTEXITCODE -ne 0
    if (-not (Test-PrivateFileAcl -Path $Path)) {
        $reason = if ($aclCommandFailed) { 'Windows could not apply the requested file permissions.' } else { 'Unexpected accounts still have access to the file.' }
        throw "$reason No database setup was started. Move the S.O.K. folder into a location writable by your Windows user or ask an administrator."
    }
}

function New-RandomSecret {
    param([int]$ByteCount = 32)

    $bytes = [byte[]]::new($ByteCount)
    $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $random.GetBytes($bytes)
    } finally {
        $random.Dispose()
    }

    return [BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
}

function Set-EnvLine {
    param(
        [Parameter(Mandatory)][string]$Content,
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$Value
    )

    $escapedName = [Regex]::Escape($Name)
    $line = "$Name=$Value"
    if ($Content -match "(?m)^$escapedName=[^\r\n]*") {
        return [Regex]::Replace($Content, "(?m)^$escapedName=[^\r\n]*", [System.Text.RegularExpressions.MatchEvaluator]{ param($match) $line })
    }

    return ($Content.TrimEnd() + "`r`n$line`r`n")
}

function Write-PrivateEnvironment {
    param([Parameter(Mandatory)][string]$Content)

    $envPath = Join-Path $script:Root '.env'
    $tempEnvPath = "$envPath.tmp.$([Guid]::NewGuid().ToString('N'))"
    try {
        New-Item -ItemType File -Path $tempEnvPath -Force | Out-Null
        Set-PrivateFileAcl -Path $tempEnvPath
        [System.IO.File]::WriteAllText($tempEnvPath, $Content, [System.Text.UTF8Encoding]::new($false))
        Move-Item -LiteralPath $tempEnvPath -Destination $envPath -Force
        Set-PrivateFileAcl -Path $envPath
    } finally {
        if (Test-Path -LiteralPath $tempEnvPath) {
            Remove-Item -LiteralPath $tempEnvPath -Force
        }
    }
}

function Set-AdminRotationFlag {
    param([Parameter(Mandatory)][ValidateSet('true', 'false')][string]$Value)

    $envPath = Join-Path $script:Root '.env'
    $content = [System.IO.File]::ReadAllText($envPath)
    Write-PrivateEnvironment -Content (Set-EnvLine -Content $content -Name 'RESET_ADMIN_PASSWORD_ON_BOOTSTRAP' -Value $Value)
}

function Get-EnvValue {
    param(
        [Parameter(Mandatory)][string]$Content,
        [Parameter(Mandatory)][string]$Name
    )

    $match = [Regex]::Match($Content, "(?m)^$([Regex]::Escape($Name))=([^\r\n]*)")
    if (-not $match.Success) {
        return $null
    }

    return $match.Groups[1].Value
}

function Initialize-LocalEnvironment {
    param([switch]$FreshPostgresDatabase)

    $envPath = Join-Path $script:Root '.env'
    $templatePath = Join-Path $script:Root '.env.example'
    $passwordPath = Join-Path $script:Root 'data\install-admin-password.txt'
    $pendingPasswordPath = Join-Path $script:Root 'data\install-admin-password.pending.txt'
    if (-not (Test-Path -LiteralPath $templatePath -PathType Leaf)) {
        throw 'Missing .env.example; cannot create the local Compose configuration.'
    }
    foreach ($secretPath in @($envPath, $passwordPath, $pendingPasswordPath)) {
        if (Test-Path -LiteralPath $secretPath) {
            $secretItem = Get-Item -LiteralPath $secretPath -Force
            if ($secretItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
                throw "Refusing to read or change a linked secret file: $secretPath"
            }
        }
    }

    $isNew = -not (Test-Path -LiteralPath $envPath -PathType Leaf)
    if ($isNew) {
        $content = [System.IO.File]::ReadAllText($templatePath)
        $adminPassword = New-RandomSecret -ByteCount 24
        $bootstrapPassword = New-RandomSecret
        $migratorPassword = New-RandomSecret
        $appPassword = New-RandomSecret
        $backupPassword = New-RandomSecret
        $values = [ordered]@{
            COMPOSE_PROJECT_NAME      = 'sok'
            DEFAULT_ADMIN_PASSWORD    = $adminPassword
            POSTGRES_DB               = 'sok'
            POSTGRES_USER             = 'sok_bootstrap'
            POSTGRES_PASSWORD         = $bootstrapPassword
            SOK_MIGRATOR_PASSWORD     = $migratorPassword
            SOK_APP_PASSWORD          = $appPassword
            SOK_BACKUP_PASSWORD       = $backupPassword
            MIGRATION_DATABASE_URL    = "postgresql://sok_migrator:${migratorPassword}@postgres:5432/sok?schema=public"
            DATABASE_URL              = "postgresql://sok_app:${appPassword}@postgres:5432/sok?schema=public"
            BACKUP_DATABASE_URL       = "postgresql://sok_backup:${backupPassword}@postgres:5432/sok?schema=public"
            TRUST_PROXY               = '0'
            COOKIE_SECURE             = 'false'
        }
        foreach ($entry in $values.GetEnumerator()) {
            $content = Set-EnvLine -Content $content -Name $entry.Key -Value $entry.Value
        }

        $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
        New-Item -ItemType File -Path $envPath -Force | Out-Null
        Set-PrivateFileAcl -Path $envPath
        [System.IO.File]::WriteAllText($envPath, $content, $utf8NoBom)
        New-Item -ItemType Directory -Path (Split-Path -Parent $passwordPath) -Force | Out-Null
        New-Item -ItemType File -Path $passwordPath -Force | Out-Null
        Set-PrivateFileAcl -Path $passwordPath
        [System.IO.File]::WriteAllText($passwordPath, "admin`r`n$adminPassword`r`n", $utf8NoBom)
        Write-Host '[OK] Created a new local .env and administrator credential file.'
    } else {
        $content = [System.IO.File]::ReadAllText($envPath)
        $required = @(
            'DEFAULT_ADMIN_PASSWORD', 'POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD',
            'SOK_MIGRATOR_PASSWORD', 'SOK_APP_PASSWORD', 'SOK_BACKUP_PASSWORD',
            'MIGRATION_DATABASE_URL', 'DATABASE_URL', 'BACKUP_DATABASE_URL', 'TRUST_PROXY', 'COOKIE_SECURE'
        )
        $invalid = @($required | Where-Object {
            $value = Get-EnvValue -Content $content -Name $_
            [string]::IsNullOrWhiteSpace($value) -or $value -match 'CHANGE_ME|REPLACE_WITH'
        })
        if ($invalid.Count -gt 0 -and $FreshPostgresDatabase) {
            $adminPassword = Get-EnvValue -Content $content -Name 'DEFAULT_ADMIN_PASSWORD'
            $createAdminPasswordFile = [string]::IsNullOrWhiteSpace($adminPassword) -or $adminPassword -match 'CHANGE_ME|REPLACE_WITH'
            if ($createAdminPasswordFile) {
                $adminPassword = New-RandomSecret -ByteCount 24
            }
            $bootstrapPassword = New-RandomSecret
            $migratorPassword = New-RandomSecret
            $appPassword = New-RandomSecret
            $backupPassword = New-RandomSecret
            $values = [ordered]@{
                COMPOSE_PROJECT_NAME   = 'sok'
                DEFAULT_ADMIN_PASSWORD = $adminPassword
                POSTGRES_DB            = 'sok'
                POSTGRES_USER          = 'sok_bootstrap'
                POSTGRES_PASSWORD      = $bootstrapPassword
                SOK_MIGRATOR_PASSWORD  = $migratorPassword
                SOK_APP_PASSWORD       = $appPassword
                SOK_BACKUP_PASSWORD    = $backupPassword
                MIGRATION_DATABASE_URL = "postgresql://sok_migrator:${migratorPassword}@postgres:5432/sok?schema=public"
                DATABASE_URL           = "postgresql://sok_app:${appPassword}@postgres:5432/sok?schema=public"
                BACKUP_DATABASE_URL    = "postgresql://sok_backup:${backupPassword}@postgres:5432/sok?schema=public"
                TRUST_PROXY            = '0'
                COOKIE_SECURE          = 'false'
            }
            foreach ($entry in $values.GetEnumerator()) {
                $content = Set-EnvLine -Content $content -Name $entry.Key -Value $entry.Value
            }
            $tempEnvPath = "$envPath.tmp.$([Guid]::NewGuid().ToString('N'))"
            try {
                New-Item -ItemType File -Path $tempEnvPath -Force | Out-Null
                Set-PrivateFileAcl -Path $tempEnvPath
                [System.IO.File]::WriteAllText($tempEnvPath, $content, [System.Text.UTF8Encoding]::new($false))
                Move-Item -LiteralPath $tempEnvPath -Destination $envPath -Force
            } finally {
                if (Test-Path -LiteralPath $tempEnvPath) {
                    Remove-Item -LiteralPath $tempEnvPath -Force
                }
            }
            if ($createAdminPasswordFile) {
                New-Item -ItemType Directory -Path (Split-Path -Parent $passwordPath) -Force | Out-Null
                if (-not (Test-Path -LiteralPath $passwordPath -PathType Leaf)) {
                    New-Item -ItemType File -Path $passwordPath -Force | Out-Null
                }
                Set-PrivateFileAcl -Path $passwordPath
                [System.IO.File]::WriteAllText($passwordPath, "admin`r`n$adminPassword`r`n", [System.Text.UTF8Encoding]::new($false))
            }
            $content = [System.IO.File]::ReadAllText($envPath)
            Write-Host '[OK] Added fresh PostgreSQL settings to the existing .env; unrelated settings and a configured admin password were preserved.'
        } elseif ($invalid.Count -gt 0 -and -not $FreshPostgresDatabase) {
            $invalidDatabaseSetting = @($invalid | Where-Object { $_ -ne 'DEFAULT_ADMIN_PASSWORD' })
            if ($invalidDatabaseSetting.Count -gt 0) {
                throw ".env has an unset or placeholder value for $($invalidDatabaseSetting[0]). Existing .env was not changed; ask an administrator to configure it."
            }

            $adminPassword = New-RandomSecret -ByteCount 24
            $content = Set-EnvLine -Content $content -Name 'DEFAULT_ADMIN_PASSWORD' -Value $adminPassword
            $tempPasswordPath = "$pendingPasswordPath.tmp.$([Guid]::NewGuid().ToString('N'))"
            $tempEnvPath = "$envPath.tmp.$([Guid]::NewGuid().ToString('N'))"
            try {
                New-Item -ItemType Directory -Path (Split-Path -Parent $passwordPath) -Force | Out-Null
                New-Item -ItemType File -Path $tempPasswordPath -Force | Out-Null
                Set-PrivateFileAcl -Path $tempPasswordPath
                [System.IO.File]::WriteAllText($tempPasswordPath, "admin`r`n$adminPassword`r`n", [System.Text.UTF8Encoding]::new($false))
                Move-Item -LiteralPath $tempPasswordPath -Destination $pendingPasswordPath -Force

                New-Item -ItemType File -Path $tempEnvPath -Force | Out-Null
                Set-PrivateFileAcl -Path $tempEnvPath
                [System.IO.File]::WriteAllText($tempEnvPath, $content, [System.Text.UTF8Encoding]::new($false))
                Move-Item -LiteralPath $tempEnvPath -Destination $envPath -Force
            } finally {
                foreach ($tempPath in @($tempPasswordPath, $tempEnvPath)) {
                    if (Test-Path -LiteralPath $tempPath) {
                        Remove-Item -LiteralPath $tempPath -Force
                    }
                }
            }
            $content = [System.IO.File]::ReadAllText($envPath)
            Write-Host '[OK] Replaced the default initial admin password and protected the credential pending database verification.'
        } elseif ($invalid.Count -gt 0) {
            $name = $invalid[0]
            throw ".env has an unset or placeholder value for $name. Existing .env was not changed; ask an administrator to configure it."
        }
        foreach ($name in $required) {
            $value = Get-EnvValue -Content $content -Name $name
            if ([string]::IsNullOrWhiteSpace($value) -or $value -match 'CHANGE_ME|REPLACE_WITH') {
                throw ".env has an unset or placeholder value for $name. Existing .env was not changed; ask an administrator to configure it."
            }
        }
        foreach ($setting in @(@{ Name = 'TRUST_PROXY'; Value = '0' }, @{ Name = 'COOKIE_SECURE'; Value = 'false' })) {
            $settingValue = Get-EnvValue -Content $content -Name $setting.Name
            if ($settingValue -ne $setting.Value) {
                throw ".env $($setting.Name) must be $($setting.Value) for this local HTTP installation. Existing .env was not changed."
            }
        }
        $databaseName = Get-EnvValue -Content $content -Name 'POSTGRES_DB'
        foreach ($entry in @(
            @{ Name = 'MIGRATION_DATABASE_URL'; User = 'sok_migrator'; Password = 'SOK_MIGRATOR_PASSWORD' },
            @{ Name = 'DATABASE_URL'; User = 'sok_app'; Password = 'SOK_APP_PASSWORD' },
            @{ Name = 'BACKUP_DATABASE_URL'; User = 'sok_backup'; Password = 'SOK_BACKUP_PASSWORD' }
        )) {
            $urlValue = Get-EnvValue -Content $content -Name $entry.Name
            $databaseUrl = $null
            if (-not [Uri]::TryCreate($urlValue, [UriKind]::Absolute, [ref]$databaseUrl) -or
                $databaseUrl.Scheme -notin @('postgres', 'postgresql') -or
                $databaseUrl.Host -ne 'postgres' -or
                $databaseUrl.AbsolutePath.Trim('/') -ne $databaseName -or
                [Uri]::UnescapeDataString($databaseUrl.UserInfo.Split(':')[0]) -ne $entry.User -or
                [Uri]::UnescapeDataString($databaseUrl.UserInfo.Split(':', 2)[1]) -ne (Get-EnvValue -Content $content -Name $entry.Password)) {
                throw ".env $($entry.Name) must target the local Compose database and role $($entry.User). Existing .env was not changed."
            }
        }
        if (-not (Test-Path -LiteralPath $passwordPath -PathType Leaf)) {
            Write-Host '[WARN] Existing .env preserved. The administrator password remains in .env; it was not copied or displayed.'
        }
        Write-Host '[OK] Existing .env preserved.'
    }

    Set-PrivateFileAcl -Path $envPath
    if (Test-Path -LiteralPath $passwordPath -PathType Leaf) {
        Set-PrivateFileAcl -Path $passwordPath
    }
    Write-Host '[OK] Local configuration files are restricted to this user and Windows administrators.'
}

function Ensure-DockerDesktop {
    $docker = Get-DockerCli
    if (-not $docker) {
        $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
        if (-not $winget) {
            throw 'Docker Desktop is missing and winget is unavailable. Install Docker Desktop from https://docs.docker.com/desktop/setup/install/windows-install/, then run install-new-pc.bat again.'
        }

        Write-Step 'Installing Docker Desktop. Windows may request administrator approval; Docker terms remain an explicit user choice.'
        & $winget.Source install --id Docker.DockerDesktop --exact --interactive
        $wingetExitCode = $LASTEXITCODE
        if ($wingetExitCode -ne 0) {
            $logDirectory = Join-Path $env:LOCALAPPDATA 'Packages\Microsoft.DesktopAppInstaller_8wekyb3d8bbwe\LocalState\DiagOutputDir'
            $latestLog = Get-ChildItem -LiteralPath $logDirectory -Filter '*.log' -File -ErrorAction SilentlyContinue |
                Sort-Object -Property LastWriteTime -Descending |
                Select-Object -First 1
            $logHint = if ($latestLog) { " WinGet log: $($latestLog.FullName)." } else { '' }
            throw "Docker Desktop installation failed (WinGet exit code $wingetExitCode). Open Microsoft Store > Library > Get updates to update App Installer, then retry. If it fails again, send the WinGet log path shown here to support.$logHint"
        }
        $docker = Get-DockerCli
    }
    if (-not $docker) {
        throw 'Docker CLI is not available yet. Close this window, start Docker Desktop once, then run install-new-pc.bat again.'
    }

    $desktop = Get-DockerDesktopApp
    if ($desktop) {
        Start-Process -FilePath $desktop
    }

    Write-Step 'Waiting for Docker Desktop to start. Accept its terms in the Docker window if prompted.'
    for ($attempt = 1; $attempt -le 48; $attempt++) {
        & $docker info *> $null
        if ($LASTEXITCODE -eq 0) {
            return $docker
        }
        Start-Sleep -Seconds 5
    }

    $wsl = Get-Command wsl.exe -ErrorAction SilentlyContinue
    if ($wsl) {
        & $wsl.Source --status *> $null
        if ($LASTEXITCODE -ne 0) {
            $answer = Read-Host 'WSL 2 needs Windows administrator approval and may require a restart. Start the official WSL setup now? (Y/N)'
            if ($answer -match '^(Y|YES)$') {
                $process = Start-Process -FilePath $wsl.Source -ArgumentList @('--install', '--no-distribution') -Verb RunAs -Wait -PassThru
                if ($process.ExitCode -eq 0) {
                    throw 'WSL setup finished. Restart Windows, then run install-new-pc.bat again.'
                }
            }
        }
    }

    throw 'Docker engine is not ready. Open Docker Desktop, accept its terms, enable the WSL 2 backend, and restart Windows if requested. Then run install-new-pc.bat again.'
}

function Invoke-Compose {
    param([Parameter(Mandatory)][string[]]$Arguments)
    Invoke-Checked -Command $script:Docker -Arguments (@('compose', '--project-name', 'sok', '--file', 'docker-compose.yml') + $Arguments) -FailureMessage "Docker Compose failed: docker compose $($Arguments -join ' ')"
}

function Repair-UnsafeAdminSecret {
    param([Parameter(Mandatory)][string]$CheckOutput)

    $match = [Regex]::Match($CheckOutput, '(?m)^SOK_ADMIN_SECRET_UNSAFE=(true|false)$')
    if (-not $match.Success) {
        throw 'Could not verify the initial administrator secret; database bootstrap stopped.'
    }
    if ($match.Groups[1].Value -ceq 'false') {
        return
    }

    $adminPassword = New-RandomSecret -ByteCount 24
    $envPath = Join-Path $script:Root '.env'
    $pendingPath = Join-Path $script:Root 'data\install-admin-password.pending.txt'
    $content = [System.IO.File]::ReadAllText($envPath)
    $content = Set-EnvLine -Content $content -Name 'DEFAULT_ADMIN_PASSWORD' -Value $adminPassword
    $content = Set-EnvLine -Content $content -Name 'RESET_ADMIN_PASSWORD_ON_BOOTSTRAP' -Value 'true'
    $tempPasswordPath = "$pendingPath.tmp.$([Guid]::NewGuid().ToString('N'))"
    try {
        New-Item -ItemType Directory -Path (Split-Path -Parent $pendingPath) -Force | Out-Null
        New-Item -ItemType File -Path $tempPasswordPath -Force | Out-Null
        Set-PrivateFileAcl -Path $tempPasswordPath
        [System.IO.File]::WriteAllText($tempPasswordPath, "admin`r`n$adminPassword`r`n", [System.Text.UTF8Encoding]::new($false))
        Move-Item -LiteralPath $tempPasswordPath -Destination $pendingPath -Force

        Write-PrivateEnvironment -Content $content
    } finally {
        if (Test-Path -LiteralPath $tempPasswordPath) {
            Remove-Item -LiteralPath $tempPasswordPath -Force
        }
    }
    Write-Host '[OK] Replaced an unsafe initial administrator secret with a generated password protected pending database verification.'
}

function Invoke-DatabaseSetup {
    param([string]$ArtifactPath)

    $importPath = $null
    if ($ArtifactPath) {
        $artifactPath = (Resolve-Path -LiteralPath $ArtifactPath).Path
        $repoPrefix = $script:Root.TrimEnd('\') + '\'
        $cutoverPrefix = Join-Path $script:Root 'cutover\'
        if ($artifactPath.StartsWith($repoPrefix, [StringComparison]::OrdinalIgnoreCase) -and
            -not $artifactPath.StartsWith($cutoverPrefix, [StringComparison]::OrdinalIgnoreCase)) {
            throw 'Do not place active-pricelists.json in the project build files. Copy it into the cutover folder or keep it outside the S.O.K. folder.'
        }
        $artifactPath = $artifactPath.Replace('\', '/')
        if ($artifactPath.Contains(',')) {
            throw 'The selected artifact path contains a comma. Copy active-pricelists.json to a folder with a simple path, then retry.'
        }
        $importPath = '/tmp/active-pricelists.json'
    }

    Write-Step 'Building the S.O.K. image and starting PostgreSQL 18.'
    Invoke-Compose -Arguments @('build', 'app')
    Invoke-Compose -Arguments @('up', '--detach', '--wait', '--wait-timeout', '180', 'postgres')

    $secretCheckScript = 'const { isUnsafeDefaultAdminPassword } = require("./dist/src/middleware/auth.js"); console.log("SOK_ADMIN_SECRET_UNSAFE=" + isUnsafeDefaultAdminPassword(process.env.DEFAULT_ADMIN_PASSWORD));'
    $secretCheckOutput = @(Invoke-Compose -Arguments @('run', '--rm', '--no-deps', '--entrypoint', 'node', 'db-bootstrap', '-e', $secretCheckScript))
    $secretCheckOutput | ForEach-Object { Write-Host $_ }
    Repair-UnsafeAdminSecret -CheckOutput ($secretCheckOutput -join [Environment]::NewLine)

    $bootstrapOutput = @(Invoke-Compose -Arguments @('run', '--rm', '--no-deps', 'db-bootstrap'))
    $bootstrapOutput | ForEach-Object { Write-Host $_ }
    $bootstrapText = $bootstrapOutput -join [Environment]::NewLine
    if ($bootstrapText -match 'SOK_ADMIN_CREDENTIAL_MATCH=false') {
        if ((Get-EnvValue -Content ([System.IO.File]::ReadAllText((Join-Path $script:Root '.env'))) -Name 'RESET_ADMIN_PASSWORD_ON_BOOTSTRAP') -eq 'true') {
            throw 'The requested administrator credential rotation did not take effect; the app was not started.'
        }
        $script:AdminCredentialMatchesInstalledAccount = $false
        $pendingPasswordPath = Join-Path $script:Root 'data\install-admin-password.pending.txt'
        if (Test-Path -LiteralPath $pendingPasswordPath -PathType Leaf) {
            Remove-Item -LiteralPath $pendingPasswordPath -Force
        }
        Write-Host '[INFO] Existing administrator password was preserved. Use its current sign-in credentials.'
    } elseif ($bootstrapText -match 'SOK_ADMIN_CREDENTIAL_MATCH=true') {
        $script:AdminCredentialMatchesInstalledAccount = $true
        $pendingPasswordPath = Join-Path $script:Root 'data\install-admin-password.pending.txt'
        if (Test-Path -LiteralPath $pendingPasswordPath -PathType Leaf) {
            $passwordPath = Join-Path $script:Root 'data\install-admin-password.txt'
            Move-Item -LiteralPath $pendingPasswordPath -Destination $passwordPath -Force
            Set-PrivateFileAcl -Path $passwordPath
        }
        Set-AdminRotationFlag -Value 'false'
    } else {
        throw 'PostgreSQL bootstrap did not verify the administrator credential state.'
    }

    if ($ArtifactPath) {
        $mount = "${artifactPath}:${importPath}:ro"
        $dryRun = "npx ts-node scripts/import-active-pricelists.ts '$importPath'"
        Write-Step 'Checking the active-pricelist artifact. This first pass does not import prices.'
        Invoke-Compose -Arguments @('run', '--rm', '--no-deps', '--volume', $mount, '--entrypoint', 'sh', 'app', '-ec', $dryRun)

        $answer = Read-Host 'If the dry-run showed the expected three active lists and counts, type IMPORT to confirm their import'
        if ($answer -cne 'IMPORT') {
            throw 'Import cancelled. PostgreSQL was initialized, but the S.O.K. server was not started. Keep the export artifact and rerun after reviewing it.'
        }

        $apply = "npx ts-node scripts/import-active-pricelists.ts '$importPath' --apply"
        Write-Step 'Importing only the active pricelists into the new database.'
        Invoke-Compose -Arguments @('run', '--rm', '--no-deps', '--volume', $mount, '--entrypoint', 'sh', 'app', '-ec', $apply)
    }

    Write-Step 'Starting S.O.K. and waiting for its database readiness check.'
    Invoke-Compose -Arguments @('up', '--detach', '--wait', '--wait-timeout', '300', 'app')
    Invoke-Compose -Arguments @('ps')
}

function Write-PostgresInstallMarker {
    $markerPath = Join-Path $script:Root '.sok-postgres-installed'
    $tempMarkerPath = "$markerPath.tmp.$([Guid]::NewGuid().ToString('N'))"
    try {
        [System.IO.File]::WriteAllText(
            $tempMarkerPath,
            "PostgreSQL 18; active pricelists imported; app readiness passed`r`n",
            [System.Text.UTF8Encoding]::new($false)
        )
        Move-Item -LiteralPath $tempMarkerPath -Destination $markerPath -Force
    } finally {
        if (Test-Path -LiteralPath $tempMarkerPath) {
            Remove-Item -LiteralPath $tempMarkerPath -Force
        }
    }
}

try {
    $script:Root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
    Set-Location -LiteralPath $script:Root
    foreach ($requiredPath in @('docker-compose.yml', 'Dockerfile', 'docker/postgres/init-roles.sh', 'scripts/docker-entrypoint.sh')) {
        if (-not (Test-Path -LiteralPath (Join-Path $script:Root $requiredPath) -PathType Leaf)) {
            throw "Incomplete S.O.K. installation package; missing $requiredPath. Copy the complete project folder before running setup."
        }
    }

    $script:Docker = Ensure-DockerDesktop
    $volumeNames = @(& $script:Docker volume ls --quiet)
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker could not list volumes; setup stopped without changing the database.'
    }
    $volumeExists = @($volumeNames | Where-Object { ([string]$_).Trim() -ceq 'sok_postgres-data' }).Count -gt 0
    $volumeProject = $null
    if ($volumeExists) {
        try {
            $volumeInspection = & $script:Docker volume inspect 'sok_postgres-data'
            if ($LASTEXITCODE -ne 0) {
                throw 'Docker could not inspect the existing volume.'
            }
            $volumeDetails = ($volumeInspection -join [Environment]::NewLine) | ConvertFrom-Json
            $volumeProject = $volumeDetails[0].Labels.'com.docker.compose.project'
        } catch {
            throw 'Docker returned invalid metadata for the existing PostgreSQL volume; setup stopped without changing it.'
        }
    }
    if ($volumeExists -and ([string]$volumeProject).Trim() -cne 'sok') {
        throw 'The existing sok_postgres-data volume is not labeled as belonging to this S.O.K. Compose project; setup stopped without changing it.'
    }
    if ($volumeExists -and -not (Test-Path -LiteralPath (Join-Path $script:Root '.env') -PathType Leaf)) {
        throw 'An S.O.K. PostgreSQL volume exists but .env with its credentials is missing. Restore the matching .env from a secure backup; new credentials cannot access this database.'
    }
    if ($volumeExists -and -not $ResumeExistingVolume) {
        throw 'A PostgreSQL volume named sok_postgres-data already exists. To avoid changing existing data, setup stopped. If this is an interrupted installation you want to continue, rerun install-new-pc.bat -ResumeExistingVolume.'
    }

    if ($volumeExists) {
        Initialize-LocalEnvironment
    } else {
        Initialize-LocalEnvironment -FreshPostgresDatabase
    }
    Invoke-Compose -Arguments @('config', '--quiet')

    if ($volumeExists) {
        $resumeAnswer = Read-Host 'This will continue using the existing S.O.K. database volume without deleting it. Type RESUME to continue'
        if ($resumeAnswer -cne 'RESUME') {
            throw 'Resume cancelled; the existing database volume was not changed.'
        }
        $databaseAnswer = Read-Host 'This will run PostgreSQL migrations and seed against the existing database. Continue only for an interrupted S.O.K. install after checking a backup. Type MIGRATE AND SEED'
        if ($databaseAnswer -cne 'MIGRATE AND SEED') {
            throw 'Migrations and seed cancelled; the existing database was not changed.'
        }
    }

    $defaultArtifact = Join-Path $script:Root 'cutover\active-pricelists.json'
    $artifactPath = $null
    if (Test-Path -LiteralPath $defaultArtifact -PathType Leaf) {
        $artifactPath = $defaultArtifact
        Write-Host '[INFO] Found cutover\active-pricelists.json.'
    } else {
        Write-Host ''
        Write-Host 'Active pricelists are required to complete this installation.'
        Write-Host 'On the old S.O.K. computer, export the active lists using docs/cutover/active-pricelists.md.'
        Write-Host 'Copy active-pricelists.json to this computer, then enter its full path below.'
        $answer = Read-Host 'Path to active-pricelists.json'
        if (-not [string]::IsNullOrWhiteSpace($answer)) {
            $artifactPath = (Resolve-Path -LiteralPath $answer).Path
            if ([System.IO.Path]::GetFileName($artifactPath) -ne 'active-pricelists.json') {
                throw 'The selected file must be named active-pricelists.json.'
            }
        } else {
            throw 'Active pricelist export is required. No database setup was started. Export the lists from the old installation and run this installer again.'
        }
    }

    $markerPath = Join-Path $script:Root '.sok-postgres-installed'
    if (Test-Path -LiteralPath $markerPath) {
        $markerItem = Get-Item -LiteralPath $markerPath -Force
        if ($markerItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
            throw 'Refusing to remove a linked PostgreSQL installation marker.'
        }
        Remove-Item -LiteralPath $markerPath -Force
    }

    Invoke-DatabaseSetup -ArtifactPath $artifactPath
    Write-PostgresInstallMarker
    Write-Host '[OK] PostgreSQL install, active-pricelist import, and app readiness verified.'
    $passwordPath = Join-Path $script:Root 'data\install-admin-password.txt'
    if ($script:AdminCredentialMatchesInstalledAccount -eq $false) {
        Write-Host '[INFO] The existing administrator password was not changed.'
    } elseif (Test-Path -LiteralPath $passwordPath -PathType Leaf) {
        Start-Process -FilePath 'notepad.exe' -ArgumentList @('"' + $passwordPath + '"')
        Write-Host '[INFO] The initial admin password is in data\install-admin-password.txt. Change it after first login.'
    } else {
        Write-Host '[INFO] Existing .env was preserved. The existing admin password was not displayed; check DEFAULT_ADMIN_PASSWORD there.'
    }

    Write-Host ''
    Write-Host '[OK] S.O.K. is installed at http://localhost:3000'
    Write-Host '[INFO] Log in as admin and change the initial password after first login.'
    Start-Process 'http://localhost:3000'
} catch {
    Write-Host "`n[ERROR] $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
