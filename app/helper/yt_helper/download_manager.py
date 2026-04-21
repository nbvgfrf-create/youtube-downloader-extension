from __future__ import annotations

import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any

from .logger import LogService
from .models import DownloadJob, FormatOption
from .yt_dlp_service import YtDlpService


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class DownloadManager:
    def __init__(self, yt_dlp_service: YtDlpService, logger: LogService) -> None:
        self._yt_dlp_service = yt_dlp_service
        self._logger = logger
        self._jobs: dict[str, DownloadJob] = {}
        self._lock = threading.RLock()
        self._executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="yt-download")

    def create_download(self, url: str, option_payload: dict[str, Any]) -> dict[str, Any]:
        option = FormatOption.from_dict(option_payload)
        if not option.selector:
            raise ValueError("Не передан selector для выбранного формата.")

        with self._lock:
            existing_job = self._find_active_job(url, option.key)
            if existing_job is not None:
                payload = existing_job.to_dict()
                payload["already_exists"] = True
                return payload

            job = DownloadJob(
                job_id=uuid.uuid4().hex,
                url=url,
                option_key=option.key,
                option_label=option.label,
            )
            self._jobs[job.job_id] = job

        self._executor.submit(self._run_download, job.job_id, option)
        payload = job.to_dict()
        payload["already_exists"] = False
        return payload

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        with self._lock:
            job = self._jobs.get(job_id)
            return job.to_dict() if job else None

    def shutdown(self) -> None:
        self._executor.shutdown(wait=False, cancel_futures=False)

    def _find_active_job(self, url: str, option_key: str) -> DownloadJob | None:
        for job in self._jobs.values():
            if job.url != url or job.option_key != option_key:
                continue
            if job.state in {"queued", "running", "downloading"}:
                return job
        return None

    def _run_download(self, job_id: str, option: FormatOption) -> None:
        self._update(job_id, state="running", message="Подготовка скачивания")
        try:
            with self._lock:
                url = self._jobs[job_id].url

            result = self._yt_dlp_service.download(
                url=url,
                option=option,
                progress_callback=lambda progress, message, file_path: self._update(
                    job_id,
                    state="downloading",
                    progress=progress,
                    message=message,
                    file_path=file_path,
                ),
            )
            self._update(
                job_id,
                state="completed",
                progress=100.0,
                message="Готово",
                file_path=result.get("file_path"),
                title=result.get("title"),
            )
        except Exception as error:
            self._logger.exception(f"Ошибка скачивания для job={job_id}", error)
            self._update(job_id, state="failed", message=str(error))

    def _update(
        self,
        job_id: str,
        *,
        state: str | None = None,
        progress: float | None = None,
        message: str | None = None,
        file_path: str | None = None,
        title: str | None = None,
    ) -> None:
        with self._lock:
            job = self._jobs[job_id]
            if state is not None:
                job.state = state
            if progress is not None:
                job.progress = progress
            if message is not None:
                job.message = message
            if file_path is not None:
                job.file_path = file_path
            if title is not None:
                job.title = title
            job.updated_at = utc_now()
