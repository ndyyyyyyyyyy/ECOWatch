from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

from config import SOURCE_BRIDGE_FILE


@lru_cache(maxsize=1)
def _load_bridge_payload() -> dict[str, dict[str, Any]]:
    if not SOURCE_BRIDGE_FILE.exists():
        return {}

    try:
        payload = json.loads(SOURCE_BRIDGE_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}

    if not isinstance(payload, dict):
        return {}

    normalized: dict[str, dict[str, Any]] = {}
    for device_name, device_config in payload.items():
        if not isinstance(device_config, dict):
            continue
        normalized_name = str(device_name).strip()
        if not normalized_name:
            continue
        normalized[normalized_name] = device_config
    return normalized


def get_source_bridge(device_name: str) -> dict[str, Any]:
    return _load_bridge_payload().get(str(device_name).strip(), {})


def bridge_property_mismatches(device_name: str, device_properties: dict[str, str]) -> list[str]:
    bridge = get_source_bridge(device_name)
    if not bridge:
        return ["missing bridge config"]

    expected_pairs = [
        ("Device ID", "deviceId"),
        ("Username", "username"),
        ("Password", "password"),
        ("IP Address", "brokerHost"),
        ("Port Number", "brokerPort"),
    ]

    mismatches: list[str] = []
    for property_label, bridge_key in expected_pairs:
        expected_value = str(bridge.get(bridge_key, "")).strip()
        actual_value = str(device_properties.get(property_label, "")).strip()
        if expected_value and actual_value != expected_value:
            mismatches.append(property_label)

    return mismatches


def modicon_property_mismatches(device_name: str, device_properties: dict[str, str]) -> list[str]:
    bridge = get_source_bridge(device_name)
    if not bridge:
        return ["missing bridge config"]

    expected_pairs = [
        ("Primary IP Address", "sourceHost"),
        ("Primary Port Number", "sourcePort"),
        ("Primary Device Address", "unitId"),
    ]

    mismatches: list[str] = []
    for property_label, bridge_key in expected_pairs:
        expected_value = str(bridge.get(bridge_key, "")).strip()
        actual_value = str(device_properties.get(property_label, "")).strip()
        if expected_value and actual_value != expected_value:
            mismatches.append(property_label)

    return mismatches


def reload_source_bridge():
    _load_bridge_payload.cache_clear()


def _save_bridge_payload(payload: dict[str, dict[str, Any]]):
    SOURCE_BRIDGE_FILE.parent.mkdir(parents=True, exist_ok=True)
    SOURCE_BRIDGE_FILE.write_text(json.dumps(payload, ensure_ascii=True, indent=2), encoding="utf-8")
    reload_source_bridge()


def sync_bridge_from_device(
    device_name: str,
    device_payload: dict[str, Any],
    previous_device_name: str | None = None,
):
    normalized_device_name = str(device_name).strip()
    if not normalized_device_name:
        return

    payload = _load_bridge_payload().copy()
    previous_name = str(previous_device_name or "").strip()
    existing = payload.pop(previous_name, {}) if previous_name and previous_name != normalized_device_name else payload.get(normalized_device_name, {})

    payload[normalized_device_name] = {
        "sourceHost": str(existing.get("sourceHost", "")).strip(),
        "sourcePort": existing.get("sourcePort", 502),
        "unitId": existing.get("unitId", 1),
        "deviceId": str(device_payload.get("deviceId", "")).strip(),
        "username": str(device_payload.get("username", "")).strip(),
        "password": str(device_payload.get("password", "")).strip(),
        "brokerHost": str(device_payload.get("ipAddress", "")).strip(),
        "brokerPort": str(device_payload.get("portNumber", "")).strip(),
    }
    _save_bridge_payload(payload)


def remove_bridge_device(device_name: str):
    normalized_device_name = str(device_name).strip()
    if not normalized_device_name:
        return

    payload = _load_bridge_payload().copy()
    if normalized_device_name not in payload:
        return
    payload.pop(normalized_device_name, None)
    _save_bridge_payload(payload)
