from __future__ import annotations

import argparse
import json
import os
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path
from typing import Any

from .autostart import AutostartService
from .config import ConfigService, binary_root, data_root, log_file
from .download_manager import DownloadManager
from .http_api import ApiServer
from .logger import LogService
from .tray import TrayController
from .yt_dlp_service import YtDlpService


class HelperApplication:
    def __init__(self) -> None:
        self.config_service = ConfigService()
        self.logger = LogService()
        self.autostart_service = AutostartService()
        self.yt_dlp_service = YtDlpService(self.config_service, self.logger)
        self.download_manager = DownloadManager(self.yt_dlp_service, self.logger)
        self.api_server: ApiServer | None = None
        self.tray = TrayController(
            on_open_settings=self.open_settings,
            on_open_downloads=self.open_downloads,
            on_open_logs=self.open_logs,
        )
        self._stopped = False

    def run(
        self,
        *,
        open_settings_on_start: bool = False,
        server_only: bool = False,
    ) -> int:
        self.logger.info("Запуск helper-приложения")
        settings = self.config_service.settings
        self.autostart_service.apply(settings.launch_at_startup)
        self.api_server = ApiServer(self)
        self.api_server.start()
        self.logger.info(f"Helper API слушает http://{settings.host}:{settings.port}")

        if open_settings_on_start:
            self.open_settings()

        try:
            if server_only:
                while True:
                    time.sleep(0.5)
            else:
                self.tray.run()
        except KeyboardInterrupt:
            self.logger.info("Helper остановлен через KeyboardInterrupt")
        finally:
            self.shutdown()
        return 0

    def shutdown(self) -> None:
        if self._stopped:
            return
        self._stopped = True
        self.logger.info("Останавливаем helper-приложение")
        self.download_manager.shutdown()
        if self.api_server is not None:
            self.api_server.stop()

    def open_settings(self) -> None:
        settings = self.config_service.settings
        webbrowser.open(f"http://{settings.host}:{settings.port}/settings", new=1)

    def open_downloads(self) -> None:
        Path(self.config_service.settings.save_directory).mkdir(parents=True, exist_ok=True)
        os.startfile(self.config_service.settings.save_directory)

    def open_logs(self) -> None:
        os.startfile(str(log_file().parent))

    def update_settings(self, payload: dict[str, Any]):
        if not str(payload.get("save_directory", "")).strip():
            payload["save_directory"] = self.config_service.settings.save_directory

        if payload.get("cookie_source") == "file" and not str(
            payload.get("cookie_file_path", "")
        ).strip():
            raise ValueError("Укажи путь к cookies.txt или переключись на другой источник cookies.")

        updated = self.config_service.update(payload)
        self.autostart_service.apply(updated.launch_at_startup)
        self.logger.info("Настройки обновлены через локальный web UI")
        return updated

    def health_payload(self) -> dict[str, Any]:
        settings = self.config_service.settings
        return {
            "app": "YouTube Downloader Helper",
            "ready": True,
            "host": settings.host,
            "port": settings.port,
            "save_directory": settings.save_directory,
            "cookie_source": settings.cookie_source,
            "cookie_browser": settings.cookie_browser,
            "cookie_file_path": settings.cookie_file_path,
            "missing_dependencies": self.yt_dlp_service.missing_dependencies(),
            "dependency_details": self.yt_dlp_service.dependency_details(),
            "binary_root": str(binary_root()),
            "data_root": str(data_root()),
            "log_file": str(log_file()),
        }


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="YouTube Downloader helper")
    parser.add_argument("--settings", action="store_true", help="Open settings page after start")
    parser.add_argument(
        "--server-only",
        action="store_true",
        help="Start local API without tray icon (useful for diagnostics)",
    )
    parser.add_argument(
        "--healthcheck",
        action="store_true",
        help="Print helper runtime info as JSON and exit",
    )
    return parser.parse_args(argv)


def existing_helper_url(settings: ConfigService) -> str | None:
    current = settings.settings
    url = f"http://{current.host}:{current.port}/health"
    try:
        with urllib.request.urlopen(url, timeout=1.5) as response:
            if response.status == 200:
                return f"http://{current.host}:{current.port}"
    except (urllib.error.URLError, TimeoutError, ConnectionError):
        return None
    return None


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or [])
    config_service = ConfigService()
    running_base_url = existing_helper_url(config_service)
    if running_base_url and not args.server_only and not args.healthcheck:
        if args.settings:
            webbrowser.open(f"{running_base_url}/settings", new=1)
        print("Helper уже запущен.")
        return 0

    app = HelperApplication()
    if args.healthcheck:
        print(json.dumps(app.health_payload(), ensure_ascii=False, indent=2))
        return 0
    return app.run(
        open_settings_on_start=args.settings,
        server_only=args.server_only,
    )
