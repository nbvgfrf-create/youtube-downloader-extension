from __future__ import annotations

import re
import shutil
import subprocess
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

try:
    import imageio_ffmpeg
except ImportError:  # pragma: no cover - handled in runtime diagnostics
    imageio_ffmpeg = None

try:
    import yt_dlp
except ImportError:  # pragma: no cover - handled in runtime diagnostics
    yt_dlp = None

from .config import ConfigService, temp_root
from .logger import LogService
from .models import FormatOption


CREATE_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)
AUTO_BROWSERS = ("edge", "chrome", "firefox", "brave", "opera", "chromium")
AUTH_HINTS = (
    "sign in to confirm you're not a bot",
    "sign in to confirm you’re not a bot",
    "login required",
    "sign in to confirm your age",
    "private video",
    "members-only",
    "age-restricted",
    "cookies",
    "authentication",
    "http error 403",
    "forbidden",
)


@dataclass(slots=True)
class CookieStrategy:
    label: str
    params: dict[str, Any]


def safe_filename(title: str, fallback: str = "video") -> str:
    if not title:
        title = fallback
    safe = re.sub(r'[<>:"/\\|?*\n\r\t]+', "", title).strip()
    return safe[:180] or fallback


class YtDlpService:
    def __init__(self, config_service: ConfigService, logger: LogService) -> None:
        self._config_service = config_service
        self._logger = logger

    def missing_dependencies(self) -> list[str]:
        missing: list[str] = []
        if yt_dlp is None:
            missing.append("yt-dlp")
        if imageio_ffmpeg is None:
            missing.append("imageio-ffmpeg")
        elif self.ffmpeg_path is None:
            missing.append("ffmpeg-runtime")
        return missing

    def dependency_details(self) -> dict[str, str]:
        return {
            "yt_dlp": yt_dlp.version.__version__ if yt_dlp is not None else "not installed",
            "ffmpeg": self.ffmpeg_path or "not available",
        }

    @property
    def ffmpeg_path(self) -> str | None:
        if imageio_ffmpeg is None:
            return None
        try:
            return imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:
            return None

    def get_formats(self, url: str) -> dict[str, Any]:
        self._ensure_runtime()
        info = self._run_with_cookie_strategies(
            url=url,
            action_name="получение форматов",
            operation=lambda cookie_params: self._extract_info(url, cookie_params),
        )
        return {
            "title": info.get("title") or "Без названия",
            "channel": info.get("channel") or info.get("uploader") or "",
            "thumbnail": info.get("thumbnail") or "",
            "options": [option.to_dict() for option in self._build_options(info)],
        }

    def download(
        self,
        url: str,
        option: FormatOption,
        progress_callback: Callable[[float | None, str, str | None], None],
    ) -> dict[str, Any]:
        self._ensure_runtime()

        if option.kind == "audio":
            return self._run_with_cookie_strategies(
                url=url,
                action_name=f"скачивание аудио [{option.label}]",
                operation=lambda cookie_params: self._download_audio(
                    url,
                    option,
                    cookie_params,
                    progress_callback,
                ),
                retry_auth_errors=True,
            )

        return self._run_with_cookie_strategies(
            url=url,
            action_name=f"скачивание видео [{option.label}]",
            operation=lambda cookie_params: self._download_video_with_merge(
                url,
                option,
                cookie_params,
                progress_callback,
            ),
            retry_auth_errors=True,
        )

    def _ensure_runtime(self) -> None:
        missing = self.missing_dependencies()
        if missing:
            raise RuntimeError(
                "Не найдены зависимости helper: "
                + ", ".join(missing)
                + ". Запусти run_helper.ps1 или установи зависимости из app/helper/requirements.txt."
            )
        if self.ffmpeg_path is None:
            raise RuntimeError(
                "Не удалось подготовить встроенный ffmpeg. Запусти run_helper.ps1 ещё раз "
                "или пересобери helper. Отдельно устанавливать ffmpeg в Windows не нужно."
            )

    def _extract_info(self, url: str, cookie_params: dict[str, Any]) -> dict[str, Any]:
        with yt_dlp.YoutubeDL(self._base_options(cookie_params)) as ydl:
            info = ydl.extract_info(url, download=False)
            return ydl.sanitize_info(info)

    def _base_options(self, cookie_params: dict[str, Any]) -> dict[str, Any]:
        options: dict[str, Any] = {
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
            "ignoreerrors": False,
        }
        options.update(cookie_params)
        return options

    def _download_video_with_merge(
        self,
        url: str,
        option: FormatOption,
        cookie_params: dict[str, Any],
        progress_callback: Callable[[float | None, str, str | None], None],
    ) -> dict[str, Any]:
        save_directory = Path(self._config_service.settings.save_directory)
        save_directory.mkdir(parents=True, exist_ok=True)

        info = self._extract_info(url, cookie_params)
        video_id = info.get("id") or "video"
        title = safe_filename(info.get("title") or video_id, fallback=video_id)
        final_path = self._unique_output_path(save_directory, title, "mp4")

        target_height = option.height
        if option.kind == "best":
            heights = [item.get("height") for item in info.get("formats") or [] if item.get("height")]
            target_height = max((int(height) for height in heights), default=360)

        direct_combined = target_height is not None and target_height <= 360
        temp_dir = self._create_temp_dir()
        self._cleanup_legacy_temp_artifacts(save_directory)

        try:
            if direct_combined:
                progress_callback(0.0, "Скачиваем видео со звуком", None)
                combined_path = self._download_to_file(
                    url,
                    selector=self._combined_selector(target_height),
                    temp_dir=temp_dir,
                    stem="combined_track",
                    cookie_params=cookie_params,
                    progress_callback=self._stage_progress(progress_callback, "Видео + аудио", 0, 90),
                )
                self._remux_to_mp4(combined_path, final_path)
                progress_callback(100.0, "Готово", str(final_path))
                return {"file_path": str(final_path), "title": info.get("title")}

            video_path = self._download_to_file(
                url,
                selector=self._video_selector(target_height),
                temp_dir=temp_dir,
                stem="video_track",
                cookie_params=cookie_params,
                progress_callback=self._stage_progress(progress_callback, "Видео", 0, 70),
            )

            try:
                audio_source = self._download_to_file(
                    url,
                    selector=self._audio_selector("m4a"),
                    temp_dir=temp_dir,
                    stem="audio_track",
                    cookie_params=cookie_params,
                    progress_callback=self._stage_progress(progress_callback, "Аудио", 70, 90),
                )
            except Exception as audio_error:
                if not self._looks_like_cookie_issue(audio_error):
                    raise

                progress_callback(None, "Аудио-поток недоступен, пробуем взять звук из 360p", None)
                combined_audio_source = self._download_to_file(
                    url,
                    selector=self._combined_selector(360),
                    temp_dir=temp_dir,
                    stem="combined_audio_source",
                    cookie_params={},
                    progress_callback=self._stage_progress(progress_callback, "Запасной 360p", 70, 90),
                )
                audio_source = temp_dir / "audio_from_360.m4a"
                self._extract_audio_to_file(combined_audio_source, audio_source, "m4a")

            progress_callback(None, "Объединяем видео и аудио", None)
            self._merge_video_and_audio(video_path, audio_source, final_path)
            progress_callback(100.0, "Готово", str(final_path))
            return {"file_path": str(final_path), "title": info.get("title")}
        finally:
            self._cleanup_temp_dir(temp_dir)
            self._cleanup_legacy_temp_artifacts(save_directory)

    def _download_audio(
        self,
        url: str,
        option: FormatOption,
        cookie_params: dict[str, Any],
        progress_callback: Callable[[float | None, str, str | None], None],
    ) -> dict[str, Any]:
        save_directory = Path(self._config_service.settings.save_directory)
        save_directory.mkdir(parents=True, exist_ok=True)

        info = self._extract_info(url, cookie_params)
        video_id = info.get("id") or "audio"
        title = safe_filename(info.get("title") or video_id, fallback=video_id)
        target_ext = option.transcode_audio_to or option.container or "mp3"
        final_path = self._unique_output_path(save_directory, title, target_ext)
        temp_dir = self._create_temp_dir()
        self._cleanup_legacy_temp_artifacts(save_directory)

        try:
            try:
                audio_source = self._download_to_file(
                    url,
                    selector=self._audio_selector(target_ext),
                    temp_dir=temp_dir,
                    stem="audio_source",
                    cookie_params=cookie_params,
                    progress_callback=self._stage_progress(progress_callback, "Аудио", 0, 85),
                )
            except Exception as audio_error:
                if not self._looks_like_cookie_issue(audio_error):
                    raise

                progress_callback(None, "Прямой аудио-поток недоступен, пробуем 360p с извлечением аудио", None)
                audio_source = self._download_to_file(
                    url,
                    selector=self._combined_selector(360),
                    temp_dir=temp_dir,
                    stem="combined_audio_source",
                    cookie_params={},
                    progress_callback=self._stage_progress(progress_callback, "Запасной 360p", 0, 85),
                )

            progress_callback(None, "Готовим аудиофайл", None)
            self._extract_audio_to_file(audio_source, final_path, target_ext)
            progress_callback(100.0, "Готово", str(final_path))
            return {"file_path": str(final_path), "title": info.get("title")}
        finally:
            self._cleanup_temp_dir(temp_dir)
            self._cleanup_legacy_temp_artifacts(save_directory)

    def _create_temp_dir(self) -> Path:
        temp_root().mkdir(parents=True, exist_ok=True)
        return Path(tempfile.mkdtemp(prefix="yt-helper-", dir=temp_root()))

    def _cleanup_temp_dir(self, temp_dir: Path) -> None:
        for _ in range(5):
            try:
                if temp_dir.exists():
                    shutil.rmtree(temp_dir)
                return
            except OSError:
                time.sleep(0.25)

    def _cleanup_legacy_temp_artifacts(self, save_directory: Path) -> None:
        for legacy_dir in save_directory.glob("yt-helper-*"):
            if legacy_dir.is_dir():
                shutil.rmtree(legacy_dir, ignore_errors=True)

    def _download_to_file(
        self,
        url: str,
        *,
        selector: str,
        temp_dir: Path,
        stem: str,
        cookie_params: dict[str, Any],
        progress_callback: Callable[[float | None, str, str | None], None],
    ) -> Path:
        options = self._base_options(cookie_params)
        options.update(
            {
                "format": selector,
                "outtmpl": str(temp_dir / f"{stem}.%(ext)s"),
                "overwrites": True,
                "progress_hooks": [self._download_progress_hook(progress_callback)],
            }
        )

        with yt_dlp.YoutubeDL(options) as ydl:
            ydl.download([url])

        matches = sorted(temp_dir.glob(f"{stem}.*"), key=lambda item: item.stat().st_mtime, reverse=True)
        if not matches:
            raise RuntimeError("Не удалось определить путь к скачанному временному файлу.")
        return matches[0]

    def _download_progress_hook(
        self,
        progress_callback: Callable[[float | None, str, str | None], None],
    ) -> Callable[[dict[str, Any]], None]:
        def hook(payload: dict[str, Any]) -> None:
            status = payload.get("status")
            filename = payload.get("filename") or payload.get("info_dict", {}).get("_filename")
            if status == "downloading":
                total = payload.get("total_bytes") or payload.get("total_bytes_estimate")
                downloaded = payload.get("downloaded_bytes") or 0
                percent = round(downloaded / total * 100, 1) if total else None
                text = f"{percent:.1f}%" if percent is not None else "скачивание"
                progress_callback(percent, text, filename)
            elif status == "finished":
                progress_callback(100.0, "готово", filename)

        return hook

    def _stage_progress(
        self,
        progress_callback: Callable[[float | None, str, str | None], None],
        stage_name: str,
        start: float,
        end: float,
    ) -> Callable[[float | None, str, str | None], None]:
        def wrapped(percent: float | None, message: str, file_path: str | None) -> None:
            if percent is None:
                progress_callback(None, f"{stage_name}: {message}", file_path)
                return
            scaled = round(start + ((end - start) * percent / 100), 1)
            progress_callback(scaled, f"{stage_name}: {message}", file_path)

        return wrapped

    def _video_selector(self, target_height: int | None) -> str:
        if target_height is None:
            return "bestvideo*[ext=mp4]/bestvideo*"
        return (
            f"bestvideo*[height<={target_height}][ext=mp4]"
            f"/bestvideo*[height<={target_height}]"
        )

    def _audio_selector(self, preferred_ext: str) -> str:
        if preferred_ext == "m4a":
            return "bestaudio[ext=m4a]/bestaudio"
        if preferred_ext == "opus":
            return "bestaudio[acodec*=opus]/bestaudio"
        return "bestaudio"

    def _combined_selector(self, target_height: int | None) -> str:
        if target_height is None:
            return "best"
        return f"best[height<={target_height}]/18/best"

    def _unique_output_path(self, directory: Path, base_name: str, extension: str) -> Path:
        candidate = directory / f"{base_name}.{extension}"
        if not candidate.exists():
            return candidate

        index = 1
        while True:
            candidate = directory / f"{base_name}_{index}.{extension}"
            if not candidate.exists():
                return candidate
            index += 1

    def _extract_audio_to_file(self, source_path: Path, target_path: Path, target_ext: str) -> None:
        codec_args = {
            "mp3": ["-vn", "-c:a", "libmp3lame", "-q:a", "0"],
            "m4a": ["-vn", "-c:a", "aac", "-b:a", "192k"],
            "opus": ["-vn", "-c:a", "libopus", "-b:a", "160k"],
        }.get(target_ext, ["-vn", "-c:a", "aac", "-b:a", "192k"])

        self._run_ffmpeg(
            [
                self.ffmpeg_path,
                "-y",
                "-i",
                str(source_path),
                *codec_args,
                str(target_path),
            ],
            "Не удалось извлечь аудио через ffmpeg.",
        )

    def _merge_video_and_audio(self, video_path: Path, audio_path: Path, target_path: Path) -> None:
        self._run_ffmpeg(
            [
                self.ffmpeg_path,
                "-y",
                "-i",
                str(video_path),
                "-i",
                str(audio_path),
                "-c:v",
                "copy",
                "-c:a",
                "aac",
                str(target_path),
            ],
            "Не удалось объединить видео и аудио через ffmpeg.",
        )

    def _remux_to_mp4(self, source_path: Path, target_path: Path) -> None:
        self._run_ffmpeg(
            [
                self.ffmpeg_path,
                "-y",
                "-i",
                str(source_path),
                "-c:v",
                "copy",
                "-c:a",
                "aac",
                str(target_path),
            ],
            "Не удалось подготовить итоговый MP4 через ffmpeg.",
        )

    def _run_ffmpeg(self, command: list[str | None], default_message: str) -> None:
        filtered_command = [str(item) for item in command if item]
        result = subprocess.run(
            filtered_command,
            capture_output=True,
            text=True,
            encoding="utf-8",
            creationflags=CREATE_NO_WINDOW,
            check=False,
        )
        if result.returncode != 0:
            stderr = (result.stderr or result.stdout or "").strip()
            raise RuntimeError(stderr or default_message)

    def _cookie_strategies(self) -> list[CookieStrategy]:
        settings = self._config_service.settings
        source = (settings.cookie_source or "auto").strip().lower()
        browser = (settings.cookie_browser or "edge").strip().lower()
        profile = settings.cookie_browser_profile.strip() or None
        cookie_file_path = settings.cookie_file_path.strip()

        if source == "none":
            return [CookieStrategy("без cookies", {})]

        if source == "file":
            if not cookie_file_path:
                raise RuntimeError("В настройках выбран файл cookies, но путь не указан.")
            cookie_path = Path(cookie_file_path)
            if not cookie_path.exists():
                raise RuntimeError(f"Файл cookies не найден: {cookie_path}")
            return [CookieStrategy("cookies file", {"cookiefile": str(cookie_path)})]

        if source == "browser":
            return [
                CookieStrategy(f"browser:{browser}", {"cookiesfrombrowser": (browser, profile, None, None)}),
                CookieStrategy("без cookies", {}),
            ]

        ordered = [browser, *AUTO_BROWSERS]
        unique_browsers = list(dict.fromkeys(item for item in ordered if item))
        strategies = [CookieStrategy("без cookies", {})]
        strategies.extend(
            CookieStrategy(
                f"browser:{browser_name}",
                {"cookiesfrombrowser": (browser_name, profile, None, None)},
            )
            for browser_name in unique_browsers
        )
        return strategies

    def _looks_like_missing_browser_cookie_store(self, error: Exception) -> bool:
        message = str(error).lower()
        return (
            ("could not find" in message and "cookies database" in message)
            or "failed to decrypt with dpapi" in message
        )

    def _run_with_cookie_strategies(
        self,
        *,
        url: str,
        action_name: str,
        operation: Callable[[dict[str, Any]], dict[str, Any]],
        retry_auth_errors: bool = False,
    ) -> dict[str, Any]:
        strategies = self._cookie_strategies()
        last_error: Exception | None = None

        for index, strategy in enumerate(strategies):
            try:
                self._logger.info(f"{action_name}: пробуем стратегию {strategy.label} для {url}")
                return operation(strategy.params)
            except Exception as error:
                if not self._looks_like_missing_browser_cookie_store(error) or last_error is None:
                    last_error = error
                self._logger.exception(
                    f"{action_name}: стратегия {strategy.label} завершилась ошибкой",
                    error if isinstance(error, Exception) else Exception(str(error)),
                )
                should_continue = index + 1 < len(strategies) and (
                    strategy.label.startswith("browser:")
                    or retry_auth_errors
                    or self._looks_like_cookie_issue(error)
                )
                if not should_continue:
                    break

        assert last_error is not None
        raise RuntimeError(self._friendly_error_message(last_error))

    def _looks_like_cookie_issue(self, error: Exception) -> bool:
        message = str(error).lower()
        return any(hint in message for hint in AUTH_HINTS)

    def _friendly_error_message(self, error: Exception) -> str:
        raw = str(error).strip() or "Неизвестная ошибка yt-dlp."
        lowered = raw.lower()

        if "failed to decrypt with dpapi" in lowered or "[errno 22] invalid argument" in lowered:
            return (
                "Не удалось прочитать cookies из браузера. Попробуй закрыть браузер и запустить helper не от имени администратора, "
                "либо переключись на Авто или укажи cookies.txt в настройках helper."
            )
        if "cookies database" in lowered and "could not find" in lowered:
            return (
                "Не удалось найти cookies в выбранном браузере. Попробуй другой браузер в настройках helper "
                "или укажи cookies.txt."
            )
        if "sign in to confirm you're not a bot" in lowered or "sign in to confirm you’re not a bot" in lowered:
            return (
                "YouTube запросил cookies. Открой настройки helper и включи cookies из браузера "
                "или укажи путь к cookies.txt."
            )
        if "login required" in lowered or "private video" in lowered:
            return (
                "Видео требует авторизации. Включи cookies браузера или укажи cookies.txt в настройках helper."
            )
        if "age-restricted" in lowered or "confirm your age" in lowered:
            return "Видео ограничено по возрасту. Нужны cookies авторизованного браузера."
        if "requested format is not available" in lowered:
            return "Выбранный формат недоступен для этого видео."
        if "http error 403" in lowered or "forbidden" in lowered:
            return (
                "YouTube заблокировал прямой поток. Попробуй включить cookies в helper или выбери 360p."
            )
        if "cookie" in lowered and "file" in lowered:
            return (
                "Не удалось прочитать cookies. Проверь путь к cookies.txt или переключись на cookies из браузера."
            )
        if 'unsupported browser: "yandex"' in lowered or "unsupported browser" in lowered:
            return (
                "Текущая версия yt-dlp не умеет читать cookies напрямую из Яндекс Браузера. "
                "Для Яндекса используй режим Авто без cookies или укажи cookies.txt."
            )
        return raw

    def _build_options(self, info: dict[str, Any]) -> list[FormatOption]:
        formats = info.get("formats") or []
        heights = sorted(
            {
                int(item["height"])
                for item in formats
                if item.get("height") and item.get("vcodec") not in (None, "none")
            },
            reverse=True,
        )

        options: list[FormatOption] = [
            FormatOption(
                key="best",
                label="Лучшее доступное",
                selector="best",
                kind="best",
                container="mp4",
                requires_muxing=True,
            )
        ]

        for height in heights:
            options.append(
                FormatOption(
                    key=f"video-{height}",
                    label=f"{height}p",
                    selector=self._combined_selector(height) if height <= 360 else self._video_selector(height),
                    kind="video",
                    container="mp4",
                    height=height,
                    requires_muxing=height > 360,
                )
            )

        options.extend(
            [
                FormatOption(
                    key="audio-m4a",
                    label="Аудио M4A",
                    selector=self._audio_selector("m4a"),
                    kind="audio",
                    container="m4a",
                    transcode_audio_to="m4a",
                    audio_codec="aac",
                ),
                FormatOption(
                    key="audio-mp3",
                    label="MP3",
                    selector=self._audio_selector("mp3"),
                    kind="audio",
                    container="mp3",
                    transcode_audio_to="mp3",
                    audio_codec="mp3",
                ),
                FormatOption(
                    key="audio-opus",
                    label="Аудио Opus",
                    selector=self._audio_selector("opus"),
                    kind="audio",
                    container="opus",
                    transcode_audio_to="opus",
                    audio_codec="opus",
                ),
            ]
        )

        return options
