$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "==> $Message"
}

function Get-PythonLauncher {
    if (Get-Command py -ErrorAction SilentlyContinue) {
        return @{ Kind = "py"; Command = "py" }
    }

    if (Get-Command python -ErrorAction SilentlyContinue) {
        return @{ Kind = "python"; Command = "python" }
    }

    return $null
}

function Test-Python311 {
    param(
        [string]$LauncherKind,
        [string]$LauncherCommand
    )

    if ($LauncherKind -eq "py") {
        & $LauncherCommand -3.11 -c "import sys; raise SystemExit(0 if sys.version_info[:2] >= (3, 11) else 1)" *> $null
        return ($LASTEXITCODE -eq 0)
    }

    & $LauncherCommand -c "import sys; raise SystemExit(0 if sys.version_info[:2] >= (3, 11) else 1)" *> $null
    return ($LASTEXITCODE -eq 0)
}

function Ensure-PythonInstalled {
    $launcher = Get-PythonLauncher
    if ($launcher -and (Test-Python311 -LauncherKind $launcher.Kind -LauncherCommand $launcher.Command)) {
        return $launcher
    }

    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if (-not $winget) {
        throw "Python 3.11 was not found and winget is not available. Install Python 3.11 manually, then run run_helper.cmd again."
    }

    Write-Step "Python 3.11 was not found. Trying to install it with winget"
    & $winget.Source install --id Python.Python.3.11 --exact --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) {
        throw "Python installation through winget failed. Install Python 3.11 manually, then run run_helper.cmd again."
    }

    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + `
        [System.Environment]::GetEnvironmentVariable("PATH", "User")

    $launcher = Get-PythonLauncher
    if (-not $launcher -or -not (Test-Python311 -LauncherKind $launcher.Kind -LauncherCommand $launcher.Command)) {
        throw "Python 3.11 looks installed but was not found in PATH yet. Run run_helper.cmd one more time."
    }

    return $launcher
}

function New-Venv {
    param(
        [string]$LauncherKind,
        [string]$LauncherCommand,
        [string]$Target
    )

    Write-Step "Creating the local Python environment"
    if ($LauncherKind -eq "py") {
        & $LauncherCommand -3.11 -m venv $Target
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
        New-Venv -LauncherKind $launcher.Kind -LauncherCommand $launcher.Command -Target $venvRoot
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
