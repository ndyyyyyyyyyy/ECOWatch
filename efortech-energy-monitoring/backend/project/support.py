from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from core.config import TIMEZONE_INFO


def parse_iso_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=TIMEZONE_INFO)
    if not isinstance(value, str):
        return None

    normalized = value.strip()
    if not normalized:
        return None
    if normalized.endswith("Z"):
        normalized = normalized[:-1] + "+00:00"

    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=TIMEZONE_INFO)
    return parsed.astimezone(TIMEZONE_INFO)


def coerce_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def match_topic_segments(topic: str, topic_filter: str) -> list[str]:
    topic_segments = topic.split("/")
    filter_segments = topic_filter.split("/")
    matches: list[str] = []
    topic_index = 0

    for filter_segment in filter_segments:
        if filter_segment == "#":
            matches.extend(topic_segments[topic_index:])
            return matches
        if topic_index >= len(topic_segments):
            return []

        topic_segment = topic_segments[topic_index]
        if filter_segment == "+":
            matches.append(topic_segment)
        elif filter_segment != topic_segment:
            return []
        topic_index += 1

    if topic_index != len(topic_segments):
        return []
    return matches


def topic_tail(topic: str) -> str:
    topic_segments = [segment for segment in str(topic).split("/") if segment]
    return topic_segments[-1] if topic_segments else ""


def looks_like_power_tag(*values: Any) -> bool:
    for value in values:
        text = str(value or "").strip().lower()
        if not text:
            continue
        if text in {"kw", "power", "p"}:
            return True
        if text.startswith("kw:") or text.startswith("kw ") or text.startswith("kw_"):
            return True
        if ":kw" in text or "_kw" in text:
            return True
    return False


def looks_like_energy_tag(*values: Any) -> bool:
    for value in values:
        text = str(value or "").strip().lower()
        if not text:
            continue
        if text in {"kwh", "energy", "e"}:
            return True
        if text.startswith("kwh:") or text.startswith("kwh ") or text.startswith("kwh_"):
            return True
        if ":kwh" in text or "_kwh" in text:
            return True
    return False


def format_property(label: str, value: Any) -> dict[str, str]:
    return {"label": label, "value": "" if value is None else str(value)}


def as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def pick(*values: Any, default: Any = None) -> Any:
    for value in values:
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        return value
    return default


@dataclass
class ProjectStatus:
    enabled: bool
    connected: bool
    available: bool
    topic_filter: str
    broker_host: str
    broker_port: int
    message: str


@dataclass(frozen=True)
class BrokerConfig:
    host: str
    port: int
    username: str
    password: str


@dataclass
class BrokerSession:
    key: str
    config: BrokerConfig
    client: Any
    device_names: set[str]
    subscribed_topics: set[str] = field(default_factory=set)
    connected: bool = False
    message: str = ""
