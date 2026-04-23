from __future__ import annotations

from datetime import datetime
from typing import Any

from core.config import TIMEZONE_INFO
from project.support import parse_iso_datetime


def reset_device_tags_to_waiting(self, device_entry: dict[str, Any]):
    waiting_message = (
        "Waiting for MQTT payload."
        if device_entry.get("deployed", True)
        else "Configuration saved. Deploy device to start data stream."
    )
    device_name = str(device_entry.get("name", "")).strip()
    for tag_key, configured_tag in device_entry.get("configuredTags", {}).items():
        existing_tag = device_entry.get("tags", {}).get(tag_key)
        registry_status = self._configured_tag_registry_status(device_name, configured_tag)
        device_entry["tags"][tag_key] = self._build_tag_entry(
            configured_tag,
            {
                **(existing_tag or {}),
                "latestValue": None,
                "lastTimestamp": None,
                "topic": "",
                "matchStatus": registry_status["status"],
                "matchMessage": (
                    registry_status["message"]
                    if registry_status["status"] == "mismatch"
                    else waiting_message
                ),
            },
        )


def mark_device_requires_deploy(self, device_entry: dict[str, Any]):
    device_entry["deployed"] = False
    device_entry["matchStatus"] = "waiting"
    device_entry["matchMessage"] = "Configuration saved. Deploy device to start data stream."
    device_entry["lastSeenAt"] = None
    device_entry["deployedAt"] = None
    self._reset_device_tags_to_waiting(device_entry)


def touch_device_heartbeat_locked(self, device_entry: dict[str, Any], seen_at: str):
    device_entry["lastSeenAt"] = seen_at
    if not device_entry.get("deployedAt"):
        device_entry["deployedAt"] = seen_at


def heartbeat_reference_time_locked(self, device_entry: dict[str, Any]) -> datetime | None:
    reference_value = device_entry.get("lastSeenAt") or device_entry.get("deployedAt")
    return parse_iso_datetime(reference_value)


def apply_heartbeat_timeout_locked(self, device_name: str, device_entry: dict[str, Any], now: datetime) -> bool:
    if not device_entry.get("deployed", True):
        return False
    broker_key = self._device_brokers.get(device_name)
    if not broker_key:
        return False
    session = self._broker_sessions.get(broker_key)
    if not session or not session.connected:
        return False

    configured_properties = device_entry.get("configuredProperties") or device_entry.get("properties")
    heartbeat_seconds = self._heartbeat_seconds_from_properties(configured_properties)
    reference_time = self._heartbeat_reference_time_locked(device_entry)
    if reference_time is None:
        return False
    if (now - reference_time).total_seconds() <= heartbeat_seconds:
        return False

    timeout_message = f"No valid payload received within heartbeat window ({heartbeat_seconds}s)."
    changed = False
    if device_entry.get("matchStatus") != "mismatch" or device_entry.get("matchMessage") != timeout_message:
        device_entry["matchStatus"] = "mismatch"
        device_entry["matchMessage"] = timeout_message
        changed = True
    for tag_key, configured_tag in device_entry.get("configuredTags", {}).items():
        tag_entry = device_entry.setdefault("tags", {}).setdefault(tag_key, self._build_tag_entry(configured_tag))
        if tag_entry.get("matchStatus") != "mismatch" or tag_entry.get("matchMessage") != timeout_message:
            tag_entry["matchStatus"] = "mismatch"
            tag_entry["matchMessage"] = timeout_message
            changed = True
    return changed


def heartbeat_monitor_loop(self):
    while not self._stop_event.wait(1):
        should_publish = False
        with self._lock:
            now = datetime.now(TIMEZONE_INFO)
            for device_name, device_entry in self._devices.items():
                if self._apply_heartbeat_timeout_locked(device_name, device_entry, now):
                    should_publish = True
        if should_publish:
            self._publish_snapshot()
