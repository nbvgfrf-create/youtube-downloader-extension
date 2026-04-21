# YouTube Downloader

Browser extension + local Windows helper for downloading YouTube videos with quality selection.

## Documentation

### For users
- Russian: [README.user.ru.md](README.user.ru.md)
- English: [README.user.en.md](README.user.en.md)

### For developers
- Russian: [README.dev.ru.md](README.dev.ru.md)
- English: [README.dev.en.md](README.dev.en.md)

## Quick summary

- the browser extension adds a `Download` button on YouTube;
- the local helper runs in the background and performs all downloads;
- first run bootstraps Python dependencies automatically;
- the UI supports Russian and English with a switch inside the extension popup;
- the repository is meant to stay source-only, without generated binaries in git.

## Project structure

```text
app/          Python helper
extension/    Browser extension
docs/         Extra technical docs
installer/    Installer template
```
