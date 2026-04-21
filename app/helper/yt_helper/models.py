from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(slots=True)
class FormatOption:
    key: str
    label: str
    selector: str
    kind: str
    container: str = "mp4"
    height: int | None = None
    requires_muxing: bool = False
    transcode_audio_to: str | None = None
    audio_codec: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "FormatOption":
        return cls(
            key=str(payload.get("key", "")).strip(),
            label=str(payload.get("label", "")).strip(),
            selector=str(payload.get("selector", "")).strip(),
            kind=str(payload.get("kind", "")).strip(),
            container=str(payload.get("container", "mp4")).strip() or "mp4",
            height=payload.get("height"),
            requires_muxing=bool(payload.get("requires_muxing", False)),
            transcode_audio_to=(
                str(payload["transcode_audio_to"]).strip()
                if payload.get("transcode_audio_to")
                else None
            ),
            audio_codec=(
                str(payload["audio_codec"]).strip()
                if payload.get("audio_codec")
                else None
            ),
        )


@dataclass(slots=True)
class DownloadJob:
    job_id: str
    url: str
    option_key: str = ""
    option_label: str = ""
    state: str = "queued"
    progress: float | None = None
    message: str = "Ожидание очереди"
    file_path: str | None = None
    title: str | None = None
    created_at: datetime = field(default_factory=utc_now)
    updated_at: datetime = field(default_factory=utc_now)

    def to_dict(self) -> dict[str, Any]:
        return {
            "job_id": self.job_id,
            "url": self.url,
            "option_key": self.option_key,
            "option_label": self.option_label,
            "state": self.state,
            "progress": self.progress,
            "message": self.message,
            "file_path": self.file_path,
            "title": self.title,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
