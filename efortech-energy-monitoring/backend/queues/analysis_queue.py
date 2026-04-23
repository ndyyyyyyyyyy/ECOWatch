from __future__ import annotations

import json
import socket
from datetime import datetime
from typing import Any

from core.config import (
    PROJECT_QUEUE_BACKPRESSURE_LIMIT,
    PROJECT_QUEUE_BLOCK_MS,
    PROJECT_QUEUE_CLAIM_IDLE_MS,
    PROJECT_QUEUE_DB,
    PROJECT_QUEUE_DLQ_NAME,
    PROJECT_QUEUE_ENABLED,
    PROJECT_QUEUE_GROUP,
    PROJECT_QUEUE_HOST,
    PROJECT_QUEUE_MAXLEN,
    PROJECT_QUEUE_NAME,
    PROJECT_QUEUE_PASSWORD,
    PROJECT_QUEUE_PORT,
    PROJECT_QUEUE_READ_COUNT,
    PROJECT_QUEUE_RETRY_MAX,
)

try:
    import redis
except ImportError:  # pragma: no cover - runtime dependency
    redis = None


_queue_client = None
_METRICS_KEY = "project_energy_metrics"


def queue_available() -> bool:
    return PROJECT_QUEUE_ENABLED and redis is not None


def _get_client():
    global _queue_client
    if _queue_client is None and queue_available():
        _queue_client = redis.Redis(
            host=PROJECT_QUEUE_HOST,
            port=PROJECT_QUEUE_PORT,
            db=PROJECT_QUEUE_DB,
            password=PROJECT_QUEUE_PASSWORD or None,
            decode_responses=False,
        )
    return _queue_client


def _safe_decode(value: Any) -> str:
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="ignore")
    return str(value)


def _increment_metric(metric_name: str, amount: int = 1):
    client = _get_client()
    if client is None:
        return
    try:
        client.hincrby(_METRICS_KEY, metric_name, amount)
    except Exception:
        return


def ensure_queue_group():
    client = _get_client()
    if client is None:
        return
    try:
        client.xgroup_create(PROJECT_QUEUE_NAME, PROJECT_QUEUE_GROUP, id="0", mkstream=True)
    except Exception as error:
        if "BUSYGROUP" not in str(error):
            raise


def enqueue_energy_job(
    timestamp: datetime,
    device_name: str,
    tag_name: str,
    tag_address: str,
    topic: str,
    value: float,
):
    client = _get_client()
    if client is None:
        raise RuntimeError("Project queue is not available.")

    try:
        current_length = int(client.xlen(PROJECT_QUEUE_NAME))
    except Exception:
        current_length = 0

    if PROJECT_QUEUE_BACKPRESSURE_LIMIT > 0 and current_length >= PROJECT_QUEUE_BACKPRESSURE_LIMIT:
        _increment_metric("backpressure_rejected")
        raise RuntimeError("Project queue backpressure limit reached.")

    payload = {
        "timestamp": timestamp.isoformat(),
        "device_name": device_name,
        "tag_name": tag_name,
        "tag_address": tag_address,
        "topic": topic,
        "value": str(value),
        "retry_count": "0",
    }
    ensure_queue_group()
    client.xadd(
        PROJECT_QUEUE_NAME,
        payload,
        maxlen=PROJECT_QUEUE_MAXLEN if PROJECT_QUEUE_MAXLEN > 0 else None,
        approximate=True,
    )
    _increment_metric("enqueued")


def build_consumer_name(worker_name: str, slot: int) -> str:
    hostname = socket.gethostname()
    return f"{worker_name}-{hostname}-{slot}"


def read_energy_jobs(consumer_name: str) -> list[tuple[str, dict[str, str]]]:
    client = _get_client()
    if client is None:
        raise RuntimeError("Project queue is not available.")

    ensure_queue_group()
    response = client.xreadgroup(
        groupname=PROJECT_QUEUE_GROUP,
        consumername=consumer_name,
        streams={PROJECT_QUEUE_NAME: ">"},
        count=max(1, PROJECT_QUEUE_READ_COUNT),
        block=max(1, PROJECT_QUEUE_BLOCK_MS),
    )
    if not response:
        return []

    entries: list[tuple[str, dict[str, str]]] = []
    for _, stream_entries in response:
        for message_id, fields in stream_entries:
            entries.append(
                (
                    _safe_decode(message_id),
                    {_safe_decode(key): _safe_decode(value) for key, value in fields.items()},
                )
            )
    return entries


def ack_energy_job(message_id: str):
    client = _get_client()
    if client is None:
        raise RuntimeError("Project queue is not available.")
    client.xack(PROJECT_QUEUE_NAME, PROJECT_QUEUE_GROUP, message_id)
    try:
        client.xdel(PROJECT_QUEUE_NAME, message_id)
    except Exception:
        pass


def retry_or_dead_letter_job(message_id: str, payload: dict[str, str], error_message: str):
    client = _get_client()
    if client is None:
        raise RuntimeError("Project queue is not available.")

    current_retry = int(str(payload.get("retry_count", "0")).strip() or "0")
    next_retry = current_retry + 1
    retry_payload = {
        **payload,
        "retry_count": str(next_retry),
        "last_error": str(error_message),
    }

    if next_retry > PROJECT_QUEUE_RETRY_MAX:
        client.xadd(
            PROJECT_QUEUE_DLQ_NAME,
            retry_payload,
            maxlen=PROJECT_QUEUE_MAXLEN if PROJECT_QUEUE_MAXLEN > 0 else None,
            approximate=True,
        )
        ack_energy_job(message_id)
        _increment_metric("dead_lettered")
        return "dead_lettered"

    client.xadd(
        PROJECT_QUEUE_NAME,
        retry_payload,
        maxlen=PROJECT_QUEUE_MAXLEN if PROJECT_QUEUE_MAXLEN > 0 else None,
        approximate=True,
    )
    ack_energy_job(message_id)
    _increment_metric("retried")
    return "retried"


def claim_stale_jobs(consumer_name: str) -> list[tuple[str, dict[str, str]]]:
    client = _get_client()
    if client is None:
        raise RuntimeError("Project queue is not available.")

    try:
        _, claimed_messages, _ = client.xautoclaim(
            PROJECT_QUEUE_NAME,
            PROJECT_QUEUE_GROUP,
            consumer_name,
            min_idle_time=max(1, PROJECT_QUEUE_CLAIM_IDLE_MS),
            start_id="0-0",
            count=max(1, PROJECT_QUEUE_READ_COUNT),
        )
    except Exception:
        return []

    entries: list[tuple[str, dict[str, str]]] = []
    for message_id, fields in claimed_messages:
        entries.append(
            (
                _safe_decode(message_id),
                {_safe_decode(key): _safe_decode(value) for key, value in fields.items()},
            )
        )
    return entries


def queue_metrics() -> dict[str, int]:
    client = _get_client()
    if client is None:
        return {
            "queueDepth": 0,
            "dlqDepth": 0,
            "pendingCount": 0,
            "enqueuedCount": 0,
            "processedCount": 0,
            "retriedCount": 0,
            "deadLetterCount": 0,
            "failedCount": 0,
            "backpressureRejectedCount": 0,
        }

    metrics = {
        "queueDepth": 0,
        "dlqDepth": 0,
        "pendingCount": 0,
        "enqueuedCount": 0,
        "processedCount": 0,
        "retriedCount": 0,
        "deadLetterCount": 0,
        "failedCount": 0,
        "backpressureRejectedCount": 0,
    }
    try:
        metrics["queueDepth"] = int(client.xlen(PROJECT_QUEUE_NAME))
    except Exception:
        pass
    try:
        metrics["dlqDepth"] = int(client.xlen(PROJECT_QUEUE_DLQ_NAME))
    except Exception:
        pass
    try:
        pending_summary = client.xpending(PROJECT_QUEUE_NAME, PROJECT_QUEUE_GROUP)
        if isinstance(pending_summary, dict):
            metrics["pendingCount"] = int(pending_summary.get("pending", 0))
        elif isinstance(pending_summary, (list, tuple)) and pending_summary:
            metrics["pendingCount"] = int(pending_summary[0])
    except Exception:
        pass
    try:
        raw_metrics = client.hgetall(_METRICS_KEY)
        metrics["enqueuedCount"] = int(raw_metrics.get(b"enqueued", raw_metrics.get("enqueued", 0)))
        metrics["processedCount"] = int(raw_metrics.get(b"processed", raw_metrics.get("processed", 0)))
        metrics["retriedCount"] = int(raw_metrics.get(b"retried", raw_metrics.get("retried", 0)))
        metrics["deadLetterCount"] = int(raw_metrics.get(b"dead_lettered", raw_metrics.get("dead_lettered", 0)))
        metrics["failedCount"] = int(raw_metrics.get(b"failed", raw_metrics.get("failed", 0)))
        metrics["backpressureRejectedCount"] = int(
            raw_metrics.get(b"backpressure_rejected", raw_metrics.get("backpressure_rejected", 0))
        )
    except Exception:
        pass
    return metrics


def mark_processed():
    _increment_metric("processed")


def mark_failed():
    _increment_metric("failed")


def queue_length() -> int:
    return queue_metrics()["queueDepth"]
