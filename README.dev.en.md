# YouTube Downloader: developer README

## Purpose

This repository contains:

- a browser extension for YouTube;
- a local Python helper for downloads, queue management, and settings;
- a first-run Windows bootstrap;
- a helper build template for packaging into `.exe`.

## What production-ready means here

- git should contain only source code, docs, and scripts;
- build artifacts, `dist`, `.venv`, temp files, logs, and local configs must not be committed;
- large binaries must not live in the repository;
- dependencies should be prepared on first launch.

## Project structure

```text
app/
  helper/
    yt_helper/        main Python helper
extension/            browser extension
docs/                 extra docs
installer/            Inno Setup template
run_helper.cmd        main user entry point
run_helper.ps1        first-run bootstrap
```

## Main components

### Extension

- `extension/i18n.js`
  Shared translation dictionary for the extension UI.
- `extension/content.js`
  Injects buttons into YouTube pages.
- `extension/popup.js`
  Shows the popup UI, download progress, language selection, and the helper autostart toggle.
- `extension/background.js`
  Bridges the extension and the local helper API.

### Helper

- `app/helper/yt_helper/app.py`
  Main helper entry point.
- `app/helper/yt_helper/http_api.py`
  Local HTTP API on `127.0.0.1:45719`.
- `app/helper/yt_helper/download_manager.py`
  Download queue and job states.
- `app/helper/yt_helper/yt_dlp_service.py`
  `yt-dlp` integration, downloads, muxing, and cookies handling.
- `app/helper/yt_helper/autostart.py`
  Windows autostart registry integration.
- `app/helper/yt_helper/static/settings.html`
  Local helper settings page.
- `app/helper/yt_helper/static/settings-i18n.js`
  Translation dictionary for the helper settings page.
- `app/helper/yt_helper/static/settings.js`
  Logic for the helper settings page.

## Local launch

### User flow

```powershell
.\run_helper.ps1
```

or:

```text
run_helper.cmd
```

### What the bootstrap does

1. Looks for Python 3.11.
2. If Python is missing, tries to install it through `winget`.
3. Creates `.venv`.
4. Installs dependencies from `app/helper/requirements.txt`.
5. Warms up the built-in `ffmpeg`.
6. Starts the helper via `pythonw`.

## Localization and adding a new language

The project currently supports `ru` and `en`.

To add a new language:

1. Add a new locale key to `extension/i18n.js`.
2. Fill in the popup, inline YouTube button, and background extension strings.
3. Add the same locale key to `app/helper/yt_helper/static/settings-i18n.js`.
4. Fill in the helper settings page strings.
5. Keep the locale code identical in both files, for example `de`, `es`, or `fr`.

No extra registration step is required:

- the popup builds its language list from `extension/i18n.js`;
- the helper settings page builds its language list from `settings-i18n.js`.

## Why ffmpeg must not live in the repository

The repository should stay lightweight.  
`ffmpeg` is treated as a runtime dependency and is prepared on first launch through the helper dependency setup.

The following must stay out of git:

- `bin/`
- `dist/`
- `build/`
- packaged `.exe` files
- local archives

## Extension installation in dev mode

The extension is loaded as an unpacked extension from the `extension` folder.

Important: this is a browser limitation. Fully automatic installation of a local extension without a store or policy install is not reliable.

## Useful commands

### Helper healthcheck

```powershell
py -3.11 -m app.helper.yt_helper --healthcheck
```

### Python syntax check

```powershell
py -3.11 -m compileall app\helper\yt_helper
```

### Extension syntax check

```powershell
node --check extension\background.js
node --check extension\content.js
node --check extension\popup.js
```

### PowerShell bootstrap parse check

```powershell
powershell -NoProfile -Command "[scriptblock]::Create((Get-Content -Raw 'run_helper.ps1')) | Out-Null; 'ok'"
```

### Build `.exe`

```powershell
Set-Location app\helper
.\build.ps1
```

## CI

For GitHub, CI should at least validate:

- Python 3.11 setup;
- dependency installation from `app/helper/requirements.txt`;
- `compileall` for the helper;
- `node --check` for the extension JavaScript files.

## What must never be committed

Do not commit:

- `.venv/`
- `.local-helper-data/`
- `.test-downloads/`
- `app/helper/build/`
- `app/helper/dist/`
- `__pycache__/`
- local logs and temporary folders

## Good next steps

- signed installer;
- extension store publication;
- API smoke tests;
- automated release builds in GitHub Actions.

## Extra docs

- architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- user docs RU: [README.user.ru.md](README.user.ru.md)
- user docs EN: [README.user.en.md](README.user.en.md)
