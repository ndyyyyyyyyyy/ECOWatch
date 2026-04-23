from __future__ import annotations

from datetime import datetime
from urllib.parse import urlencode

import httpx
from core.config import (
    INFLUX_DATABASE_RAW,
    INFLUX_ENABLED,
    INFLUX_MEASUREMENT,
    INFLUX_PASSWORD,
    INFLUX_URL,
    INFLUX_USER,
)


_client: httpx.Client | None = None


def influx_available() -> bool:
    return INFLUX_ENABLED


def _get_client() -> httpx.Client | None:
    global _client
    if _client is None and influx_available():
        _client = httpx.Client(timeout=10.0)
    return _client


def close_influx_client():
    global _client
    if _client is not None:
        _client.close()
    _client = None


def _escape_measurement(value: str) -> str:
    return str(value).replace("\\", "\\\\").replace(",", "\\,").replace(" ", "\\ ")


def _escape_tag(value: str) -> str:
    return (
        str(value)
        .replace("\\", "\\\\")
        .replace(",", "\\,")
        .replace(" ", "\\ ")
        .replace("=", "\\=")
    )


def write_raw_point(
    timestamp: datetime,
    device_name: str,
    tag_name: str,
    tag_address: str,
    topic: str,
    value: float,
):
    client = _get_client()
    if client is None:
        raise RuntimeError("InfluxDB writer is not available.")

    timestamp_ns = int(timestamp.timestamp() * 1_000_000_000)
    line = (
        f"{_escape_measurement(INFLUX_MEASUREMENT)},"
        f"device_name={_escape_tag(device_name)},"
        f"tag_name={_escape_tag(tag_name)},"
        f"topic={_escape_tag(topic)} "
        f"value={float(value)} "
        f"{timestamp_ns}"
    )
    query = urlencode({"db": INFLUX_DATABASE_RAW, "precision": "ns"})
    response = client.post(
        f"{INFLUX_URL.rstrip('/')}/write?{query}",
        content=line,
        auth=(INFLUX_USER, INFLUX_PASSWORD or ""),
        headers={"Content-Type": "text/plain"},
    )
    response.raise_for_status()
