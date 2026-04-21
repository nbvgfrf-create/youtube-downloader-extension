from __future__ import annotations

import json
import mimetypes
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from typing import Any
from urllib.parse import urlparse


STATIC_ROOT = Path(__file__).resolve().parent / "static"


class ApiServer:
    def __init__(self, app_context: Any) -> None:
        settings = app_context.config_service.settings
        self._server = _ContextServer((settings.host, settings.port), _RequestHandler, app_context)
        self._thread = Thread(target=self._server.serve_forever, daemon=True, name="helper-api")

    def start(self) -> None:
        self._thread.start()

    def stop(self) -> None:
        self._server.shutdown()
        self._server.server_close()
        self._thread.join(timeout=3)


class _ContextServer(ThreadingHTTPServer):
    def __init__(
        self,
        server_address: tuple[str, int],
        handler_cls: type[BaseHTTPRequestHandler],
        app_context: Any,
    ) -> None:
        super().__init__(server_address, handler_cls)
        self.app_context = app_context


class _RequestHandler(BaseHTTPRequestHandler):
    server: _ContextServer

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(HTTPStatus.NO_CONTENT)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self._write_json(self.server.app_context.health_payload())
            return
        if parsed.path == "/api/settings":
            self._write_json(self.server.app_context.config_service.settings.to_dict())
            return
        if parsed.path.startswith("/api/downloads/"):
            job_id = parsed.path.rsplit("/", 1)[-1]
            job = self.server.app_context.download_manager.get_job(job_id)
            if job is None:
                self._write_json({"error": "Download was not found."}, status=HTTPStatus.NOT_FOUND)
                return
            self._write_json(job)
            return
        if parsed.path == "/settings":
            self._write_static("settings.html")
            return
        if parsed.path.startswith("/assets/"):
            relative_name = parsed.path.removeprefix("/assets/")
            self._write_static(relative_name)
            return

        self._write_json({"error": "Route was not found."}, status=HTTPStatus.NOT_FOUND)

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        try:
            body = self._read_json()
            if parsed.path == "/api/formats":
                response = self.server.app_context.yt_dlp_service.get_formats(body["url"])
                self._write_json(response)
                return
            if parsed.path == "/api/downloads":
                response = self.server.app_context.download_manager.create_download(
                    body["url"],
                    body["option"],
                )
                self._write_json(response, status=HTTPStatus.ACCEPTED)
                return
            if parsed.path == "/api/settings":
                updated = self.server.app_context.update_settings(body)
                self._write_json(
                    {
                        "ok": True,
                        "message": "Settings saved.",
                        "settings": updated.to_dict(),
                    }
                )
                return
            if parsed.path == "/api/actions/open-downloads":
                self.server.app_context.open_downloads()
                self._write_json({"ok": True, "message": "Downloads folder opened."})
                return
            if parsed.path == "/api/actions/open-logs":
                self.server.app_context.open_logs()
                self._write_json({"ok": True, "message": "Logs folder opened."})
                return
        except KeyError as error:
            self._write_json(
                {"error": f"Missing required field: {error}."},
                status=HTTPStatus.BAD_REQUEST,
            )
            return
        except ValueError as error:
            self._write_json({"error": str(error)}, status=HTTPStatus.BAD_REQUEST)
            return
        except RuntimeError as error:
            self._write_json({"error": str(error)}, status=HTTPStatus.BAD_REQUEST)
            return
        except Exception as error:  # pragma: no cover
            self.server.app_context.logger.exception("API error", error)
            self._write_json(
                {"error": "Internal helper application error."},
                status=HTTPStatus.INTERNAL_SERVER_ERROR,
            )
            return

        self._write_json({"error": "Route was not found."}, status=HTTPStatus.NOT_FOUND)

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A003
        return

    def end_headers(self) -> None:
        self._send_cors_headers()
        super().end_headers()

    def _send_cors_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Cache-Control", "no-store")

    def _read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        return json.loads(raw)

    def _write_json(
        self,
        payload: dict[str, Any],
        *,
        status: HTTPStatus = HTTPStatus.OK,
    ) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _write_static(self, filename: str) -> None:
        safe_name = Path(filename).name
        path = STATIC_ROOT / safe_name
        if not path.exists():
            self._write_json(
                {"error": "Static asset was not found."},
                status=HTTPStatus.NOT_FOUND,
            )
            return

        content_type, _ = mimetypes.guess_type(path.name)
        body = path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type or "application/octet-stream")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
