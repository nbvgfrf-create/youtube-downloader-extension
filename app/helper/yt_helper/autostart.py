from __future__ import annotations

import sys
import winreg
from pathlib import Path


RUN_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"
VALUE_NAME = "YouTubeDownloaderHelper"


class AutostartService:
    def apply(self, enabled: bool) -> None:
        command = self._build_command()
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, RUN_KEY) as key:
            if enabled:
                winreg.SetValueEx(key, VALUE_NAME, 0, winreg.REG_SZ, command)
            else:
                try:
                    winreg.DeleteValue(key, VALUE_NAME)
                except FileNotFoundError:
                    pass

    def _build_command(self) -> str:
        if getattr(sys, "frozen", False):
            return f'"{Path(sys.executable).resolve()}"'

        project_root = Path(__file__).resolve().parents[3]
        venv_pythonw = project_root / ".venv" / "Scripts" / "pythonw.exe"
        venv_python = project_root / ".venv" / "Scripts" / "python.exe"
        helper_script = project_root / "app" / "helper" / "run_helper.py"

        interpreter = venv_pythonw if venv_pythonw.exists() else venv_python
        if not interpreter.exists():
            interpreter = Path(sys.executable).resolve()

        return f'"{interpreter}" "{helper_script}"'
