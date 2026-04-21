$ErrorActionPreference = "Stop"

try {
    $root = Split-Path -Parent $MyInvocation.MyCommand.Path
    $venvRoot = Join-Path $root ".venv"
    $pythonExe = Join-Path $venvRoot "Scripts\python.exe"
    $pythonwExe = Join-Path $venvRoot "Scripts\pythonw.exe"
    $requirements = Join-Path $root "app\helper\requirements.txt"
    $builtExe = Join-Path $root "app\helper\dist\YouTubeDownloaderHelper\YouTubeDownloaderHelper.exe"

    if (Test-Path $builtExe) {
        Start-Process -FilePath $builtExe -WorkingDirectory $root -WindowStyle Hidden
        Write-Host "Helper launched from built .exe"
        exit 0
    }

    if (-not (Get-Command py -ErrorAction SilentlyContinue)) {
        throw "Python Launcher (py) was not found. Install Python 3.11 and enable Add Python to PATH."
    }

    if (-not (Test-Path $pythonExe)) {
        Write-Host "Creating local Python virtual environment..."
        py -3.11 -m venv $venvRoot
    }

    if (-not (Test-Path $pythonExe)) {
        throw "Virtual environment was not created."
    }

    $needsInstall = $true
    try {
        & $pythonExe -c "import yt_dlp, imageio_ffmpeg" *> $null
        if ($LASTEXITCODE -eq 0) {
            $needsInstall = $false
        }
    }
    catch {
        $needsInstall = $true
    }

    if ($needsInstall) {
        Write-Host "Installing helper dependencies..."
        & $pythonExe -m pip install --upgrade pip
        if ($LASTEXITCODE -ne 0) { throw "pip upgrade failed." }

        & $pythonExe -m pip install -r $requirements
        if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed." }
    }

    if (-not (Test-Path $pythonwExe)) {
        throw "pythonw.exe was not found in .venv."
    }

    $env:PYTHONUTF8 = "1"
    Start-Process -FilePath $pythonwExe -ArgumentList "-m", "app.helper.yt_helper" -WorkingDirectory $root -WindowStyle Hidden
    Write-Host "Helper started in background."
}
catch {
    Write-Host ""
    Write-Host "Helper startup error:"
    Write-Host $_.Exception.Message
    Write-Host ""
    Read-Host "Press Enter to close"
    exit 1
}
