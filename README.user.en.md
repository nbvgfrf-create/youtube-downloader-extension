# YouTube Downloader: user guide

This project adds a download button to YouTube.

You do not need to manually install `ffmpeg` or configure the download logic. The project tries to do everything automatically on first launch.

## What you need

- Windows
- a browser: Google Chrome, Microsoft Edge, Yandex Browser, Brave, Chromium, or another Chromium-based browser
- internet access

## The easiest way to start

### Step 1. Download the project

Download the project and unpack it into a normal folder on your computer.

### Step 2. Start the helper

1. Open the project folder.
2. Double-click `run_helper.cmd`.

What happens next:
- if Python is already installed, setup continues automatically;
- if Python is missing, the script tries to install it automatically;
- then the helper installs the required Python packages;
- then it prepares the built-in `ffmpeg`;
- after that, the helper starts in the background.

If everything works, you can close the window.

## How to install the browser extension

### Google Chrome

1. Open:

```text
chrome://extensions
```

2. Turn on `Developer mode`.
3. Click `Load unpacked`.
4. Select the `extension` folder inside the project.

### Microsoft Edge

1. Open:

```text
edge://extensions
```

2. Turn on `Developer mode`.
3. Click `Load unpacked`.
4. Select the `extension` folder.

### Yandex Browser

1. Open the browser extensions page.
2. Turn on developer mode.
3. Click the unpacked extension install button.
4. Select the `extension` folder.

### Brave / Chromium

1. Open the extensions page.
2. Turn on developer mode.
3. Click `Load unpacked`.
4. Select the `extension` folder.

## How to use it

1. Start the helper with `run_helper.cmd` if it is not already running.
2. Open YouTube.
3. Open any video.
4. Refresh the page if the button is not visible yet.

After that:
- the `Download` button under the video starts a download using the default settings;
- the `Quality` button opens the list of available formats;
- the extension popup shows current downloads and settings.

## How to change the language

1. Click the extension icon.
2. Find the `Language` field.
3. Choose `Русский` or `English`.

The popup, the YouTube buttons, and the helper settings page use the selected language.

## How to turn autostart on or off

In the extension popup:

1. Click the extension icon.
2. Find the `Helper autostart` toggle.
3. Turn it on or off.

Autostart is enabled by default.

## If something does not work

### The button does not appear

1. Make sure the helper is already running.
2. Refresh the YouTube tab.
3. Make sure the extension was loaded from the `extension` folder.

### It says the helper is not responding

Run:

```text
run_helper.cmd
```

again.

### The video requires cookies or sign-in

1. Click the extension icon.
2. Click `Settings`.
3. In helper settings, enable cookies or provide `cookies.txt`.

### Yandex Browser

If downloading fails because of authorization, using `cookies.txt` is usually the most reliable option.

## What you do not need to install manually

Usually you do not need to manually install:
- `ffmpeg.exe`
- `yt-dlp.exe`
- extra Python packages

## Where files are stored

- downloaded videos: the folder selected in helper settings
- helper settings:

```text
%LOCALAPPDATA%\YouTubeDownloader\config.json
```

## If you want to reinstall everything

1. Close the helper.
2. Delete the `.venv` folder inside the project.
3. Run `run_helper.cmd` again.

The script installs the dependencies again and starts the helper.
