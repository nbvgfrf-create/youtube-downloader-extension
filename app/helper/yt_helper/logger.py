from __future__ import annotations

from datetime import datetime
from pathlib import Path
from threading import Lock

from .config import log_file


class LogService:
    def __init__(self) -> None:
        self._path: Path = log_file()
        self._lock = Lock()

    @property
    def path(self) -> Path:
        return self._path

    def info(self, message: str) -> None:
        self._write("INFO", message)

    def error(self, message: str) -> None:
        self._write("ERROR", message)

    def exception(self, message: str, error: Exception) -> None:
        self._write("ERROR", f"{message}: {error}")

    def _write(self, level: str, message: str) -> None:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        line = f"[{timestamp}] [{level}] {message}\n"
        with self._lock:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            with self._path.open("a", encoding="utf-8") as handle:
                handle.write(line)

