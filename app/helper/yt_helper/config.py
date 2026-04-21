from __future__ import annotations

import json
import os
import sys
import threading
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


APP_SLUG = "YouTubeDownloader"


def _local_app_data() -> Path:
    return Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))

def default_download_directory() -> Path:
    save_override = os.environ.get("YT_DOWNLOADER_SAVE_DIRECTORY")
    if save_override:
        return Path(save_override)
    data_override = os.environ.get("YT_DOWNLOADER_DATA_ROOT")
    if data_override:
        return Path(data_override) / "downloads"
    return Path.home() / "Downloads" / "YouTube Downloader"

def data_root() -> Path:
    override = os.environ.get("YT_DOWNLOADER_DATA_ROOT")
    if override:
        return Path(override)
    return _local_app_data() / APP_SLUG

def logs_directory() -> Path:
    return data_root() / "logs"


def log_file() -> Path:
    return logs_directory() / "app.log"


def config_file() -> Path:
    return data_root() / "config.json"


def temp_root() -> Path:
    return data_root() / "temp"


def runtime_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parents[3]


def binary_root() -> Path:
    bundled = runtime_root() / "bin"
    if bundled.exists():
        return bundled
    return Path(__file__).resolve().parents[3] / "bin"


@dataclass(slots=True)
class AppSettings:
    host: str = "127.0.0.1"
    port: int = 45719
    save_directory: str = str(default_download_directory())
    launch_at_startup: bool = True
    minimize_to_tray: bool = True
    close_to_tray: bool = True
    default_mode: str = "best"
    preferred_audio_format: str = "mp3"
    language: str = "ru"
    cookie_source: str = "auto"
    cookie_browser: str = "edge"
    cookie_browser_profile: str = ""
    cookie_file_path: str = ""
    show_completion_notifications: bool = True

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "AppSettings":
        instance = cls()
        for field_name in asdict(instance):
            if field_name in payload:
                setattr(instance, field_name, payload[field_name])
        instance.port = int(instance.port)
        return instance

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class ConfigService:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._settings = AppSettings()
        self.ensure_directories()
        self.load()

    @property
    def settings(self) -> AppSettings:
        with self._lock:
            return AppSettings.from_dict(self._settings.to_dict())

    def ensure_directories(self) -> None:
        data_root().mkdir(parents=True, exist_ok=True)
        logs_directory().mkdir(parents=True, exist_ok=True)
        temp_root().mkdir(parents=True, exist_ok=True)
        default_download_directory().mkdir(parents=True, exist_ok=True)

    def load(self) -> AppSettings:
        with self._lock:
            path = config_file()
            if path.exists():
                try:
                    payload = json.loads(path.read_text(encoding="utf-8"))
                    self._settings = AppSettings.from_dict(payload)
                except json.JSONDecodeError:
                    self._settings = AppSettings()
                    self.save()
            else:
                self._settings = AppSettings()
                self.save()

            self._ensure_save_directory()
            return self.settings

    def save(self) -> AppSettings:
        with self._lock:
            self._ensure_save_directory()
            config_file().write_text(
                json.dumps(self._settings.to_dict(), ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            return self.settings

    def update(self, patch: dict[str, Any]) -> AppSettings:
        with self._lock:
            current = self._settings.to_dict()
            current.update(patch)
            self._settings = AppSettings.from_dict(current)
            return self.save()

    def _ensure_save_directory(self) -> None:
        target = Path(self._settings.save_directory)
        try:
            target.mkdir(parents=True, exist_ok=True)
        except OSError:
            fallback = default_download_directory()
            fallback.mkdir(parents=True, exist_ok=True)
            self._settings.save_directory = str(fallback)
