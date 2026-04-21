$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $root
try {
    py -3.11 -m pip install -r requirements-dev.txt
    py -3.11 -m PyInstaller --clean --noconfirm youtube_downloader.spec
}
finally {
    Pop-Location
}
