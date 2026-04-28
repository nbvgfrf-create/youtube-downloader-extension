$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "==> $Message"
}

function Get-PythonLauncher {
    if (Get-Command py -ErrorAction SilentlyContinue) {
        & py -3.11 -c "import sys; raise SystemExit(0 if sys.version_info[:2] >= (3, 11) else 1)" *> $null
        if ($LASTEXITCODE -eq 0) {
            return @{ Kind = "py"; Command = "py"; Args = @("-3.11") }
        }

        & py -c "import sys; raise SystemExit(0 if sys.version_info[:2] >= (3, 11) else 1)" *> $null
        if ($LASTEXITCODE -eq 0) {
            return @{ Kind = "py"; Command = "py"; Args = @() }
        }
    }

    if (Get-Command python -ErrorAction SilentlyContinue) {
        return @{ Kind = "python"; Command = "python"; Args = @() }
    }

    return $null
}

function Test-Python311 {
    param(
        [string]$LauncherKind,
        [string]$LauncherCommand,
        [string[]]$LauncherArgs = @()
    )

    if ($LauncherKind -eq "py") {
        & $LauncherCommand @LauncherArgs -c "import sys; raise SystemExit(0 if sys.version_info[:2] >= (3, 11) else 1)" *> $null
        return ($LASTEXITCODE -eq 0)
    }

    & $LauncherCommand -c "import sys; raise SystemExit(0 if sys.version_info[:2] >= (3, 11) else 1)" *> $null
    return ($LASTEXITCODE -eq 0)
}

function Ensure-PythonInstalled {
    $launcher = Get-PythonLauncher
    if ($launcher -and (Test-Python311 -LauncherKind $launcher.Kind -LauncherCommand $launcher.Command -LauncherArgs $launcher.Args)) {
        return $launcher
    }

    $installed = $false
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if ($winget) {
        Write-Step "Python 3.11 was not found. Trying to install it with winget"
        & $winget.Source install --id Python.Python.3.11 --exact --accept-package-agreements --accept-source-agreements
        $installed = ($LASTEXITCODE -eq 0)
    }

    if (-not $installed) {
        Write-Step "winget installation was not available or failed. Trying the official Python installer"
        $pythonVersion = "3.11.9"
        $installerName = if ([Environment]::Is64BitOperatingSystem) { "python-$pythonVersion-amd64.exe" } else { "python-$pythonVersion.exe" }
        $installerUrl = "https://www.python.org/ftp/python/$pythonVersion/$installerName"
        $installerPath = Join-Path $env:TEMP $installerName

        Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath
        Start-Process -FilePath $installerPath -ArgumentList "/quiet", "InstallAllUsers=0", "PrependPath=1", "Include_pip=1", "Include_test=0" -Wait
        Remove-Item -LiteralPath $installerPath -Force -ErrorAction SilentlyContinue
    }

    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + `
        [System.Environment]::GetEnvironmentVariable("PATH", "User")

    $launcher = Get-PythonLauncher
    if (-not $launcher -or -not (Test-Python311 -LauncherKind $launcher.Kind -LauncherCommand $launcher.Command -LauncherArgs $launcher.Args)) {
        throw "Python 3.11 or newer could not be prepared automatically. Install Python 3.11+ manually from python.org, then run run_helper.cmd again."
    }

    return $launcher
}

function New-Venv {
    param(
        [string]$LauncherKind,
        [string]$LauncherCommand,
        [string[]]$LauncherArgs,
        [string]$Target
    )

    Write-Step "Creating the local Python environment"
    if ($LauncherKind -eq "py") {
        & $LauncherCommand @LauncherArgs -m venv $Target
    } else {
        & $LauncherCommand -m venv $Target
    }

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create the local Python environment."
    }
}

function Ensure-Dependencies {
    param(
        [string]$PythonExe,
        [string]$Requirements
    )

    $depsReady = $false
    try {
        & $PythonExe -c "import yt_dlp, imageio_ffmpeg" *> $null
        if ($LASTEXITCODE -eq 0) {
            $depsReady = $true
        }
    } catch {
        $depsReady = $false
    }

    if (-not $depsReady) {
        Write-Step "Installing helper dependencies"
        & $PythonExe -m pip install --upgrade pip
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to upgrade pip."
        }

        & $PythonExe -m pip install -r $Requirements
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to install helper dependencies."
        }
    }

    Write-Step "Preparing built-in ffmpeg"
    & $PythonExe -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())" *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to prepare the built-in ffmpeg runtime."
    }
}

try {
    $root = Split-Path -Parent $MyInvocation.MyCommand.Path
    $venvRoot = Join-Path $root ".venv"
    $pythonExe = Join-Path $venvRoot "Scripts\python.exe"
    $pythonwExe = Join-Path $venvRoot "Scripts\pythonw.exe"
    $requirements = Join-Path $root "app\helper\requirements.txt"
    $builtExe = Join-Path $root "app\helper\dist\YouTubeDownloaderHelper\YouTubeDownloaderHelper.exe"

    if (Test-Path $builtExe) {
        Write-Step "Starting the helper from the packaged executable"
        Start-Process -FilePath $builtExe -WorkingDirectory $root -WindowStyle Hidden
        Write-Host ""
        Write-Host "Helper started successfully."
        exit 0
    }

    $launcher = Ensure-PythonInstalled

    if (-not (Test-Path $pythonExe)) {
        New-Venv -LauncherKind $launcher.Kind -LauncherCommand $launcher.Command -LauncherArgs $launcher.Args -Target $venvRoot
    }

    if (-not (Test-Path $pythonExe)) {
        throw "python.exe was not found after the virtual environment was created."
    }

    Ensure-Dependencies -PythonExe $pythonExe -Requirements $requirements

    if (-not (Test-Path $pythonwExe)) {
        throw "pythonw.exe was not found after the environment setup finished."
    }

    $env:PYTHONUTF8 = "1"
    Write-Step "Starting the helper in background mode"
    Start-Process -FilePath $pythonwExe -ArgumentList "-m", "app.helper.yt_helper" -WorkingDirectory $root -WindowStyle Hidden

    Write-Host ""
    Write-Host "Helper started successfully."
    Write-Host "You can now load the browser extension from the extension folder."
}
catch {
    Write-Host ""
    Write-Host "Helper startup failed:"
    Write-Host $_.Exception.Message
    Write-Host ""
    Read-Host "Press Enter to close this window"
    exit 1
}
