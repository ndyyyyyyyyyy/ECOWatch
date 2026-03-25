from __future__ import annotations

import json
import queue
import threading
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Iterator

from energy_db import insert_energy_reading
from source_bridge import bridge_property_mismatches, get_source_bridge, modicon_property_mismatches
from config import (
    MQTT_BROKER_HOST,
    MQTT_BROKER_PORT,
    MQTT_CLIENT_ID,
    MQTT_ENABLED,
    MQTT_PASSWORD,
    PROJECT_STORE_FILE,
    MQTT_TOPIC_FILTER,
    MQTT_USERNAME,
)

try:
    import paho.mqtt.client as mqtt
except ImportError:  # pragma: no cover - handled at runtime
    mqtt = None


def _parse_iso_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value)
    if not isinstance(value, str):
        return None

    normalized = value.strip()
    if not normalized:
        return None
    if normalized.endswith("Z"):
        normalized = normalized[:-1] + "+00:00"

    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        return None


def _coerce_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _match_topic_segments(topic: str, topic_filter: str) -> list[str]:
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


def _topic_tail(topic: str) -> str:
    topic_segments = [segment for segment in str(topic).split("/") if segment]
    return topic_segments[-1] if topic_segments else ""


def _format_property(label: str, value: Any) -> dict[str, str]:
    return {"label": label, "value": "" if value is None else str(value)}


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _pick(*values: Any, default: Any = None) -> Any:
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


class MqttProjectStore:
    def __init__(self):
        self._lock = threading.Lock()
        self._devices: dict[str, dict[str, Any]] = {}
        self._subscriptions: dict[str, str] = {}
        self._listeners: set[queue.Queue[str]] = set()
        self._connected = False
        self._message = "MQTT disabled."
        self._client = None

    @staticmethod
    def _store_path() -> Path:
        return PROJECT_STORE_FILE

    def _save_persisted_state(self):
        store_path = self._store_path()
        store_path.parent.mkdir(parents=True, exist_ok=True)
        with self._lock:
            devices_payload = [
                {
                    "deviceName": device_name,
                    "configuredProperties": device.get("configuredProperties", []),
                    "configuredTags": list(device.get("configuredTags", {}).values()),
                }
                for device_name, device in self._devices.items()
            ]

        store_path.write_text(
            json.dumps({"devices": devices_payload}, ensure_ascii=True, indent=2),
            encoding="utf-8",
        )

    def _load_persisted_state(self):
        store_path = self._store_path()
        if not store_path.exists():
            return

        try:
            payload = json.loads(store_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return

        loaded_devices: dict[str, dict[str, Any]] = {}
        loaded_subscriptions: dict[str, str] = {}
        for raw_device in payload.get("devices", []):
            if not isinstance(raw_device, dict):
                continue

            configured_properties = raw_device.get("configuredProperties")
            try:
                device_payload = self._properties_to_device_payload(configured_properties)
            except ValueError:
                continue

            configured_tags: dict[str, dict[str, Any]] = {}
            visible_tags: dict[str, dict[str, Any]] = {}
            for raw_tag in raw_device.get("configuredTags", []):
                try:
                    tag_payload = self._tag_to_payload(raw_tag)
                except ValueError:
                    continue
                configured_tags[tag_payload["address"]] = tag_payload
                visible_tags[tag_payload["address"]] = self._build_tag_entry(tag_payload)

            device_name = device_payload["name"]
            loaded_devices[device_name] = {
                "id": device_name,
                "name": device_name,
                "properties": self._build_properties(device_payload),
                "configuredProperties": self._build_properties(device_payload),
                "configuredTags": configured_tags,
                "tags": visible_tags,
                "matchStatus": "waiting",
                "matchMessage": "Waiting for MQTT payload.",
            }
            loaded_subscriptions[device_name] = self._device_topic(device_name)

        with self._lock:
            self._devices = loaded_devices
            self._subscriptions = loaded_subscriptions
        self._save_persisted_state()

    def start(self):
        self._load_persisted_state()
        if not MQTT_ENABLED:
            self._message = "MQTT disabled. Set MQTT_ENABLED=true to activate broker subscription."
            self._publish_snapshot()
            return
        if mqtt is None:
            self._message = "MQTT enabled but dependency paho-mqtt is not installed."
            self._publish_snapshot()
            return

        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=MQTT_CLIENT_ID)
        if MQTT_USERNAME:
            client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD or None)

        client.on_connect = self._on_connect
        client.on_disconnect = self._on_disconnect
        client.on_message = self._on_message

        self._client = client
        self._message = f"Connecting to MQTT broker {MQTT_BROKER_HOST}:{MQTT_BROKER_PORT}..."
        client.connect_async(MQTT_BROKER_HOST, MQTT_BROKER_PORT, keepalive=60)
        client.loop_start()

    def stop(self):
        client = self._client
        if client is None:
            return
        client.loop_stop()
        client.disconnect()

    @staticmethod
    def _reason_code_value(reason_code: Any) -> int | str:
        value = getattr(reason_code, "value", reason_code)
        try:
            return int(value)
        except (TypeError, ValueError):
            return str(reason_code)

    def _serialize_snapshot(self) -> str:
        status = self.get_status()
        payload = {
            "source": "mqtt" if status.enabled else "unavailable",
            "devices": self.get_devices(),
            "status": {
                "mqttEnabled": status.enabled,
                "connected": status.connected,
                "available": status.available,
                "message": status.message,
                "topicFilter": status.topic_filter,
                "brokerHost": status.broker_host,
                "brokerPort": status.broker_port,
            },
        }
        return json.dumps(payload)

    def _publish_snapshot(self):
        snapshot = self._serialize_snapshot()
        with self._lock:
            listeners = list(self._listeners)

        stale_listeners: list[queue.Queue[str]] = []
        for listener in listeners:
            try:
                listener.put_nowait(snapshot)
            except queue.Full:
                stale_listeners.append(listener)

        if stale_listeners:
            with self._lock:
                for listener in stale_listeners:
                    self._listeners.discard(listener)

    def stream_snapshots(self) -> Iterator[str]:
        listener: queue.Queue[str] = queue.Queue(maxsize=8)
        with self._lock:
            self._listeners.add(listener)

        try:
            yield f"data: {self._serialize_snapshot()}\n\n"
            while True:
                try:
                    snapshot = listener.get(timeout=15)
                except queue.Empty:
                    yield ": keep-alive\n\n"
                    continue
                yield f"data: {snapshot}\n\n"
        finally:
            with self._lock:
                self._listeners.discard(listener)

    def _on_connect(self, client, userdata, flags, reason_code, properties):  # pragma: no cover - callback
        code = self._reason_code_value(reason_code)
        self._connected = code == 0
        if self._connected:
            client.subscribe(MQTT_TOPIC_FILTER)
            with self._lock:
                topic_count = len(self._subscriptions)

            self._message = (
                f"Connected to MQTT broker. Listening on {MQTT_TOPIC_FILTER} with {topic_count} configured device(s)."
            )
        else:
            self._message = f"MQTT connect failed with reason code {code}."

        self._publish_snapshot()

    def _on_disconnect(self, client, userdata, flags, reason_code, properties):  # pragma: no cover - callback
        self._connected = False
        code = self._reason_code_value(reason_code)
        self._message = f"Disconnected from MQTT broker with reason code {code}."
        self._publish_snapshot()

    def _on_message(self, client, userdata, msg):  # pragma: no cover - callback
        payload_text = msg.payload.decode("utf-8", errors="ignore").strip()
        payload_data: dict[str, Any]
        try:
            parsed = json.loads(payload_text) if payload_text else {}
            payload_data = parsed if isinstance(parsed, dict) else {"value": parsed}
        except json.JSONDecodeError:
            payload_data = {"value": payload_text}

        device_section = _as_dict(payload_data.get("device"))
        tag_section = _as_dict(payload_data.get("tag"))
        tags_section = [item for item in _as_list(payload_data.get("tags")) if isinstance(item, dict)]
        telemetry_section = _as_dict(payload_data.get("telemetry"))
        wildcard_values = _match_topic_segments(msg.topic, MQTT_TOPIC_FILTER)
        device_name = str(
            _pick(
                payload_data.get("device_name"),
                device_section.get("name"),
                wildcard_values[0] if len(wildcard_values) >= 1 else None,
                default="Unknown Device",
            )
        )

        with self._lock:
            device_entry = self._devices.get(device_name)
            configured_properties = device_entry.get("configuredProperties", []) if device_entry else []
            configured_tags = device_entry.get("configuredTags", {}) if device_entry else {}

        device_payload = self._build_incoming_device_payload(device_name, payload_data, device_section)

        device_match_result = self._evaluate_device_match(device_name, configured_properties, device_payload, payload_data, device_section)
        default_timestamp = _parse_iso_datetime(
            _pick(payload_data.get("timestamp"), telemetry_section.get("timestamp"))
        ) or datetime.now()
        candidate_tags = tags_section or [tag_section or {}]

        should_publish = False
        with self._lock:
            device_entry = self._devices.get(device_name)
            if not device_entry:
                properties = self._build_properties(device_payload)
                device_entry = {
                    "id": device_name,
                    "name": device_name,
                    "properties": properties,
                    "configuredProperties": properties,
                    "configuredTags": {},
                    "tags": {},
                    "matchStatus": "matched",
                    "matchMessage": "",
                }
                self._devices[device_name] = device_entry
                self._subscriptions[device_name] = self._device_topic(device_name)
                configured_properties = device_entry["configuredProperties"]
                configured_tags = device_entry["configuredTags"]

            device_entry["name"] = device_payload["name"]
            device_entry["properties"] = device_entry.get("configuredProperties") or self._build_properties(device_payload)
            if not device_entry.get("configuredProperties"):
                device_entry["configuredProperties"] = self._build_properties(device_payload)
            if device_match_result["status"] == "mismatch":
                print(f'[project-store] device mismatch for "{device_name}": {device_match_result["message"]}')
                device_entry["matchStatus"] = "mismatch"
                device_entry["matchMessage"] = device_match_result["message"]
                should_publish = True
            else:
                device_entry["matchStatus"] = device_match_result["status"]
                device_entry["matchMessage"] = device_match_result["message"]

                for candidate_tag in candidate_tags:
                    tag_payload = self._build_incoming_tag_payload(
                        candidate_tag,
                        payload_data,
                        tag_section,
                        default_timestamp,
                        msg.topic,
                        wildcard_values,
                    )
                    configured_tag = configured_tags.get(tag_payload["address"])
                    if not configured_tag:
                        configured_tag = self._tag_to_payload(tag_payload)
                        configured_tags[tag_payload["address"]] = configured_tag

                    tag_entry = device_entry["tags"].setdefault(tag_payload["address"], self._build_tag_entry(configured_tag))
                    tag_match_result = self._evaluate_tag_match(configured_tag, tag_payload, payload_data, candidate_tag)
                    if tag_match_result["status"] == "mismatch":
                        print(
                            f'[project-store] tag mismatch for "{device_name}" / "{configured_tag["name"]}": '
                            f'{tag_match_result["message"]}'
                        )
                        tag_entry.update(
                            {
                                "matchStatus": "mismatch",
                                "matchMessage": tag_match_result["message"],
                                "topic": msg.topic,
                            }
                        )
                        continue

                    tag_entry.update(
                        {
                            "name": configured_tag["name"],
                            "type": configured_tag["type"],
                            "description": configured_tag["description"],
                            "sourceAddress": configured_tag.get("sourceAddress", ""),
                            "address": configured_tag["address"],
                            "logData": configured_tag["logData"],
                            "latestValue": tag_payload["latestValue"],
                            "lastTimestamp": tag_payload["lastTimestamp"],
                            "topic": tag_payload["topic"],
                            "matchStatus": tag_match_result["status"],
                            "matchMessage": tag_match_result["message"],
                        }
                    )
                    if (
                        str(configured_tag.get("logData", "yes")).strip().lower() == "yes"
                        and tag_payload["latestValue"] is not None
                    ):
                        insert_energy_reading(
                            timestamp=_parse_iso_datetime(tag_payload["lastTimestamp"]) or default_timestamp,
                            device_name=device_name,
                            tag_name=configured_tag["name"],
                            tag_address=configured_tag["address"],
                            value=tag_payload["latestValue"],
                        )
                should_publish = True

        if should_publish:
            self._save_persisted_state()
            self._publish_snapshot()

    @staticmethod
    def _build_incoming_device_payload(
        device_name: str,
        payload_data: dict[str, Any],
        device_section: dict[str, Any],
    ) -> dict[str, str]:
        device_type = str(
            _pick(payload_data.get("device_type"), device_section.get("device_type"), default="MQTT")
        )
        base_payload = {
            "name": str(device_name),
            "unitNumber": str(_pick(payload_data.get("unit_number"), device_section.get("unit_number"), default="0")),
            "deviceType": device_type,
            "description": str(
                _pick(
                    payload_data.get("device_description"),
                    device_section.get("description"),
                    default="",
                )
            ),
        }

        if device_type == "MQTT":
            return {
                **base_payload,
                "heartbeatFrequency": str(
                    _pick(
                        payload_data.get("heartbeat_frequency"),
                        device_section.get("heartbeat_frequency"),
                        default="60",
                    )
                ),
                "deviceId": str(
                    _pick(
                        payload_data.get("device_id"),
                        device_section.get("device_id"),
                        default="",
                    )
                ),
                "username": str(
                    _pick(
                        payload_data.get("username"),
                        device_section.get("username"),
                        default="",
                    )
                ),
                "password": str(
                    _pick(
                        payload_data.get("password"),
                        device_section.get("password"),
                        default="",
                    )
                ),
                "ipAddress": str(
                    _pick(
                        payload_data.get("ip_address"),
                        device_section.get("ip_address"),
                        default=MQTT_BROKER_HOST,
                    )
                ),
                "portNumber": str(
                    _pick(
                        payload_data.get("port_number"),
                        device_section.get("port_number"),
                        default=MQTT_BROKER_PORT,
                    )
                ),
                "primaryIpAddress": str(
                    _pick(
                        payload_data.get("ip_address"),
                        device_section.get("ip_address"),
                        default=MQTT_BROKER_HOST,
                    )
                ),
                "primaryPortNumber": str(
                    _pick(
                        payload_data.get("port_number"),
                        device_section.get("port_number"),
                        default=MQTT_BROKER_PORT,
                    )
                ),
                "primaryDeviceAddress": str(
                    _pick(
                        payload_data.get("device_id"),
                        device_section.get("device_id"),
                        default="",
                    )
                ),
            }

        return {
            **base_payload,
            "primaryIpAddress": str(
                _pick(payload_data.get("primary_ip"), device_section.get("primary_ip"), default=MQTT_BROKER_HOST)
            ),
            "primaryPortNumber": str(
                _pick(payload_data.get("primary_port"), device_section.get("primary_port"), default=MQTT_BROKER_PORT)
            ),
            "primaryDeviceAddress": str(
                _pick(payload_data.get("device_address"), device_section.get("device_address"), default="1")
            ),
            "heartbeatFrequency": str(
                _pick(
                    payload_data.get("heartbeat_frequency"),
                    device_section.get("heartbeat_frequency"),
                    default="60",
                )
            ),
            "deviceId": str(
                _pick(
                    payload_data.get("device_id"),
                    device_section.get("device_id"),
                    payload_data.get("device_address"),
                    device_section.get("device_address"),
                    default="",
                )
            ),
            "username": str(
                _pick(
                    payload_data.get("username"),
                    device_section.get("username"),
                    default="",
                )
            ),
            "password": str(
                _pick(
                    payload_data.get("password"),
                    device_section.get("password"),
                    default="",
                )
            ),
            "ipAddress": str(
                _pick(
                    payload_data.get("ip_address"),
                    device_section.get("ip_address"),
                    payload_data.get("primary_ip"),
                    device_section.get("primary_ip"),
                    default=MQTT_BROKER_HOST,
                )
            ),
            "portNumber": str(
                _pick(
                    payload_data.get("port_number"),
                    device_section.get("port_number"),
                    payload_data.get("primary_port"),
                    device_section.get("primary_port"),
                    default=MQTT_BROKER_PORT,
                )
            ),
        }

    @staticmethod
    def _properties_to_device_payload(properties: list[dict[str, Any]] | None) -> dict[str, str]:
        property_map = {
            str(item.get("label", "")).strip(): str(item.get("value", "")).strip()
            for item in (properties or [])
            if isinstance(item, dict)
        }

        name = property_map.get("Device Name", "").strip()
        if not name:
            raise ValueError("Device Name is required.")

        return {
            "name": name,
            "unitNumber": property_map.get("Unit Number", "0"),
            "deviceType": property_map.get("Device Type", "MQTT"),
            "description": property_map.get("Description", ""),
            "primaryIpAddress": property_map.get("Primary IP Address", property_map.get("IP Address", MQTT_BROKER_HOST)),
            "primaryPortNumber": property_map.get("Primary Port Number", property_map.get("Port Number", str(MQTT_BROKER_PORT))),
            "primaryDeviceAddress": property_map.get("Primary Device Address", property_map.get("Device ID", "1")),
            "heartbeatFrequency": property_map.get("Heartbeat Frequency (second)", "60"),
            "deviceId": property_map.get("Device ID", ""),
            "username": property_map.get("Username", ""),
            "password": property_map.get("Password", ""),
            "ipAddress": property_map.get("IP Address", MQTT_BROKER_HOST),
            "portNumber": property_map.get("Port Number", str(MQTT_BROKER_PORT)),
        }

    @staticmethod
    def _tag_to_payload(tag: dict[str, Any] | None) -> dict[str, str]:
        tag_map = tag or {}
        name = str(tag_map.get("name", "")).strip()
        if not name:
            raise ValueError("Tag Name is required.")

        return {
            "name": name,
            "type": str(tag_map.get("type", "analog")).strip() or "analog",
            "description": str(tag_map.get("description", "")).strip(),
            "sourceAddress": str(tag_map.get("sourceAddress", tag_map.get("source_address", ""))).strip(),
            "address": str(tag_map.get("address", "")).strip(),
            "logData": str(tag_map.get("logData", "yes")).strip() or "yes",
        }

    @staticmethod
    def _device_type_from_entry(device_entry: dict[str, Any] | None) -> str:
        properties = device_entry.get("configuredProperties") if device_entry else None
        if not properties:
            properties = device_entry.get("properties") if device_entry else None
        property_map = {
            str(item.get("label", "")).strip(): str(item.get("value", "")).strip()
            for item in (properties or [])
            if isinstance(item, dict)
        }
        return property_map.get("Device Type", "MQTT") or "MQTT"

    @staticmethod
    def _normalize_configured_tag(
        tag_payload: dict[str, str],
        device_type: str,
        existing_tag: dict[str, Any] | None = None,
    ) -> dict[str, str]:
        existing_source = str((existing_tag or {}).get("sourceAddress", "")).strip()
        existing_address = str((existing_tag or {}).get("address", "")).strip()
        raw_address = str(tag_payload.get("address", "")).strip()
        raw_source = str(tag_payload.get("sourceAddress", "")).strip()
        normalized_address = raw_address or raw_source or existing_address or existing_source
        return {
            **tag_payload,
            "sourceAddress": normalized_address,
            "address": normalized_address,
        }

    @staticmethod
    def _device_topic(device_name: str) -> str:
        if "+" not in MQTT_TOPIC_FILTER:
            return f"devices/{device_name}"
        return MQTT_TOPIC_FILTER.replace("+", device_name, 1)

    @staticmethod
    def _build_properties(device_payload: dict[str, Any]) -> list[dict[str, str]]:
        if device_payload["deviceType"] == "MQTT":
            return [
                _format_property("Device Name", device_payload["name"]),
                _format_property("Description", device_payload["description"]),
                _format_property("Unit Number", device_payload["unitNumber"]),
                _format_property("Device Type", device_payload["deviceType"]),
                _format_property("Heartbeat Frequency (second)", device_payload.get("heartbeatFrequency", "60")),
                _format_property("Device ID", device_payload.get("deviceId", device_payload["primaryDeviceAddress"])),
                _format_property("Username", device_payload.get("username", "")),
                _format_property("Password", device_payload.get("password", "")),
                _format_property("IP Address", device_payload.get("ipAddress", device_payload["primaryIpAddress"])),
                _format_property("Port Number", device_payload.get("portNumber", device_payload["primaryPortNumber"])),
            ]

        return [
            _format_property("Device Name", device_payload["name"]),
            _format_property("Description", device_payload["description"]),
            _format_property("Unit Number", device_payload["unitNumber"]),
            _format_property("Device Type", device_payload["deviceType"]),
            _format_property("Primary IP Address", device_payload["primaryIpAddress"]),
            _format_property("Primary Port Number", device_payload["primaryPortNumber"]),
            _format_property("Primary Device Address", device_payload["primaryDeviceAddress"]),
        ]

    @staticmethod
    def _build_tag_entry(tag_payload: dict[str, Any], existing_tag: dict[str, Any] | None = None) -> dict[str, Any]:
        return {
            "name": tag_payload["name"],
            "type": tag_payload["type"],
            "description": tag_payload["description"],
            "sourceAddress": tag_payload.get("sourceAddress", ""),
            "address": tag_payload["address"],
            "logData": tag_payload["logData"],
            "latestValue": existing_tag.get("latestValue") if existing_tag else None,
            "lastTimestamp": existing_tag.get("lastTimestamp") if existing_tag else None,
            "topic": existing_tag.get("topic") if existing_tag else "",
            "matchStatus": existing_tag.get("matchStatus") if existing_tag else "waiting",
            "matchMessage": existing_tag.get("matchMessage") if existing_tag else "Waiting for MQTT payload.",
        }

    @staticmethod
    def _build_incoming_tag_payload(
        candidate_tag: dict[str, Any],
        payload_data: dict[str, Any],
        tag_section: dict[str, Any],
        default_timestamp: datetime,
        topic: str,
        wildcard_values: list[str],
    ) -> dict[str, Any]:
        timestamp = _parse_iso_datetime(
            _pick(
                candidate_tag.get("timestamp"),
                payload_data.get("timestamp"),
                tag_section.get("timestamp"),
            )
        ) or default_timestamp
        numeric_value = _coerce_float(
            _pick(
                candidate_tag.get("value_kwh"),
                candidate_tag.get("value"),
                payload_data.get("value_kwh"),
                payload_data.get("value"),
            )
        )
        address = str(
            _pick(
                candidate_tag.get("address"),
                payload_data.get("address"),
                tag_section.get("address"),
                wildcard_values[1] if len(wildcard_values) >= 2 else None,
                _topic_tail(topic),
                default=topic,
            )
        )
        return {
            "name": str(
                _pick(
                    candidate_tag.get("name"),
                    payload_data.get("tag_name"),
                    tag_section.get("name"),
                    payload_data.get("tag"),
                    address,
                    default=topic,
                )
            ),
            "type": str(_pick(candidate_tag.get("type"), payload_data.get("type"), tag_section.get("type"), default="analog")),
            "description": str(
                _pick(
                    candidate_tag.get("description"),
                    payload_data.get("description"),
                    tag_section.get("description"),
                    default=f"MQTT topic: {topic}",
                )
            ),
            "sourceAddress": str(
                _pick(
                    candidate_tag.get("sourceAddress"),
                    candidate_tag.get("source_address"),
                    payload_data.get("sourceAddress"),
                    payload_data.get("source_address"),
                    tag_section.get("sourceAddress"),
                    tag_section.get("source_address"),
                    default="",
                )
            ),
            "address": address,
            "logData": str(_pick(candidate_tag.get("logData"), payload_data.get("logData"), tag_section.get("logData"), default="yes")),
            "latestValue": numeric_value,
            "lastTimestamp": timestamp.isoformat(),
            "topic": topic,
        }

    @staticmethod
    def _evaluate_device_match(
        device_name: str,
        configured_properties: list[dict[str, Any]] | None,
        incoming_device_payload: dict[str, Any],
        payload_data: dict[str, Any],
        device_section: dict[str, Any],
    ) -> dict[str, str]:
        property_map = {
            str(item.get("label", "")).strip(): str(item.get("value", "")).strip()
            for item in (configured_properties or [])
            if isinstance(item, dict)
        }
        if incoming_device_payload["deviceType"] == "MQTT":
            hardcoded_mismatches = bridge_property_mismatches(device_name, property_map)
            if hardcoded_mismatches:
                return {"status": "mismatch", "message": "Hardcoded property mismatch: " + ", ".join(hardcoded_mismatches)}

            bridge = get_source_bridge(device_name)
            comparisons = [
                ("Device Type", incoming_device_payload["deviceType"], "device_type" in payload_data or "device_type" in device_section),
                ("Device ID", incoming_device_payload.get("deviceId", ""), bool(bridge.get("deviceId")) or "device_id" in payload_data or "device_id" in device_section),
                ("Username", incoming_device_payload.get("username", ""), bool(bridge.get("username")) or "username" in payload_data or "username" in device_section),
                ("IP Address", incoming_device_payload.get("ipAddress", ""), bool(bridge.get("brokerHost")) or "ip_address" in payload_data or "ip_address" in device_section),
                ("Port Number", incoming_device_payload.get("portNumber", ""), bool(bridge.get("brokerPort")) or "port_number" in payload_data or "port_number" in device_section),
            ]
        else:
            hardcoded_mismatches = modicon_property_mismatches(device_name, property_map)
            if hardcoded_mismatches:
                return {"status": "mismatch", "message": "Hardcoded property mismatch: " + ", ".join(hardcoded_mismatches)}

            comparisons = [
                ("Device Type", incoming_device_payload["deviceType"], "device_type" in payload_data or "device_type" in device_section),
                ("Primary IP Address", incoming_device_payload["primaryIpAddress"], "primary_ip" in payload_data or "primary_ip" in device_section),
                ("Primary Port Number", incoming_device_payload["primaryPortNumber"], "primary_port" in payload_data or "primary_port" in device_section),
                ("Primary Device Address", incoming_device_payload["primaryDeviceAddress"], "device_address" in payload_data or "device_address" in device_section),
            ]

        mismatches: list[str] = []
        matched_fields = 0
        for label, incoming_value, is_present in comparisons:
            expected = property_map.get(label, "").strip()
            if not expected or not is_present:
                continue
            if expected != str(incoming_value).strip():
                mismatches.append(f"{label} mismatch")
                continue
            matched_fields += 1

        if mismatches:
            return {"status": "mismatch", "message": "; ".join(mismatches)}
        if matched_fields > 0:
            return {"status": "matched", "message": ""}
        return {"status": "waiting", "message": ""}

    @staticmethod
    def _evaluate_tag_match(
        configured_tag: dict[str, Any],
        incoming_tag_payload: dict[str, Any],
        payload_data: dict[str, Any],
        tag_section: dict[str, Any],
    ) -> dict[str, str]:
        expected = str(configured_tag["address"]).strip()
        is_present = "address" in payload_data or "address" in tag_section
        incoming = str(incoming_tag_payload["address"]).strip()

        if not expected or not is_present:
            return {"status": "waiting", "message": "Waiting for matching tag fields from MQTT payload."}
        if expected != incoming:
            return {"status": "mismatch", "message": "Address mismatch"}
        return {"status": "matched", "message": "Payload matches available tag fields."}

    @staticmethod
    def _reset_device_tags_to_waiting(device_entry: dict[str, Any]):
        for tag_key, configured_tag in device_entry.get("configuredTags", {}).items():
            existing_tag = device_entry.get("tags", {}).get(tag_key)
            device_entry["tags"][tag_key] = MqttProjectStore._build_tag_entry(
                configured_tag,
                {
                    **(existing_tag or {}),
                    "latestValue": None,
                    "lastTimestamp": None,
                    "topic": "",
                    "matchStatus": "waiting",
                    "matchMessage": "Waiting for MQTT payload.",
                },
            )

    def subscribe_device(self, properties: list[dict[str, Any]] | None) -> dict[str, Any]:
        if not MQTT_ENABLED:
            raise RuntimeError("MQTT is not enabled.")

        device_payload = self._properties_to_device_payload(properties)
        device_name = device_payload["name"]
        topic = self._device_topic(device_name)

        with self._lock:
            existing_device = self._devices.get(device_name, {})
            configured_tags = existing_device.get("configuredTags", {})
            visible_tags = {
                tag_key: self._build_tag_entry(configured_tag, existing_device.get("tags", {}).get(tag_key))
                for tag_key, configured_tag in configured_tags.items()
            }
            device_entry = {
                "id": device_name,
                "name": device_name,
                "properties": self._build_properties(device_payload),
                "configuredProperties": self._build_properties(device_payload),
                "configuredTags": configured_tags,
                "tags": visible_tags,
                "matchStatus": "waiting",
                "matchMessage": "Waiting for MQTT payload.",
            }
            self._devices[device_name] = device_entry
            self._subscriptions[device_name] = topic

        if self._client and self._connected:
            self._message = (
                f"Connected to MQTT broker. Listening on {MQTT_TOPIC_FILTER} with {len(self._subscriptions)} configured device(s)."
            )
        else:
            self._message = f'Device "{device_name}" added. Waiting for MQTT connection.'

        self._save_persisted_state()
        self._publish_snapshot()
        return {"deviceName": device_name, "topic": topic}

    def update_device(self, current_device_name: str, properties: list[dict[str, Any]] | None) -> dict[str, Any]:
        normalized_current = str(current_device_name).strip()
        if not normalized_current:
            raise ValueError("Current device name is required.")

        device_payload = self._properties_to_device_payload(properties)
        next_device_name = device_payload["name"]
        next_topic = self._device_topic(next_device_name)

        with self._lock:
            if normalized_current not in self._devices:
                raise ValueError("Device not found.")

            previous_topic = self._subscriptions.pop(normalized_current, None)
            current_device = self._devices.pop(normalized_current)
            current_device["id"] = next_device_name
            current_device["name"] = next_device_name
            current_device["properties"] = self._build_properties(device_payload)
            current_device["configuredProperties"] = self._build_properties(device_payload)
            current_device["matchStatus"] = "waiting"
            current_device["matchMessage"] = "Waiting for MQTT payload."
            self._reset_device_tags_to_waiting(current_device)
            self._devices[next_device_name] = current_device
            self._subscriptions[next_device_name] = next_topic
            subscription_count = len(self._subscriptions)

        if self._client and self._connected:
            self._message = (
                f"Connected to MQTT broker. Listening on {MQTT_TOPIC_FILTER} with {subscription_count} configured device(s)."
            )

        self._save_persisted_state()
        self._publish_snapshot()
        return {
            "deviceName": next_device_name,
            "previousDeviceName": normalized_current,
            "topic": next_topic,
        }

    def unsubscribe_device(self, device_name: str) -> dict[str, Any]:
        normalized_name = str(device_name).strip()
        if not normalized_name:
            raise ValueError("Device name is required.")

        with self._lock:
            topic = self._subscriptions.pop(normalized_name, None)
            self._devices.pop(normalized_name, None)
            remaining_topics = len(self._subscriptions)

        if topic and self._client and self._connected:
            pass

        if self._connected:
            self._message = (
                f"Connected to MQTT broker. Listening on {MQTT_TOPIC_FILTER} with {remaining_topics} configured device(s)."
                if remaining_topics
                else f"Connected to MQTT broker. Listening on {MQTT_TOPIC_FILTER}."
            )
        else:
            self._message = f'Device "{normalized_name}" removed.'

        self._save_persisted_state()
        self._publish_snapshot()
        return {"deviceName": normalized_name, "topic": topic}

    def upsert_tag(self, device_name: str, tag: dict[str, Any], current_tag_name: str | None = None) -> dict[str, Any]:
        normalized_device_name = str(device_name).strip()
        normalized_current_tag_name = str(current_tag_name or "").strip()
        raw_tag_payload = self._tag_to_payload(tag)

        with self._lock:
            device_entry = self._devices.get(normalized_device_name)
            if not device_entry:
                raise ValueError("Device not found.")

            device_type = self._device_type_from_entry(device_entry)

            configured_tags = device_entry.setdefault("configuredTags", {})
            visible_tags = device_entry.setdefault("tags", {})

            current_tag_key = normalized_current_tag_name or raw_tag_payload["address"]
            existing_configured_tag = configured_tags.get(current_tag_key)
            tag_payload = self._normalize_configured_tag(raw_tag_payload, device_type, existing_configured_tag)

            if normalized_current_tag_name and normalized_current_tag_name != tag_payload["address"]:
                configured_tags.pop(normalized_current_tag_name, None)
                existing_tag = visible_tags.pop(normalized_current_tag_name, None)
            else:
                existing_tag = visible_tags.get(current_tag_key)

            configured_tags[tag_payload["address"]] = tag_payload
            visible_tags[tag_payload["address"]] = self._build_tag_entry(
                tag_payload,
                {
                    **(existing_tag or {}),
                    "latestValue": None,
                    "lastTimestamp": None,
                    "topic": "",
                    "matchStatus": "waiting",
                    "matchMessage": "Waiting for MQTT payload.",
                },
            )

        self._save_persisted_state()
        self._publish_snapshot()
        return {"deviceName": normalized_device_name, "tagAddress": tag_payload["address"], "tagName": tag_payload["name"]}

    def delete_tag(self, device_name: str, tag_name: str) -> dict[str, Any]:
        normalized_device_name = str(device_name).strip()
        normalized_tag_name = str(tag_name).strip()
        if not normalized_device_name or not normalized_tag_name:
            raise ValueError("Device name and tag address are required.")

        with self._lock:
            device_entry = self._devices.get(normalized_device_name)
            if not device_entry:
                raise ValueError("Device not found.")

            device_entry.setdefault("configuredTags", {}).pop(normalized_tag_name, None)
            device_entry.setdefault("tags", {}).pop(normalized_tag_name, None)

        self._save_persisted_state()
        self._publish_snapshot()
        return {"deviceName": normalized_device_name, "tagAddress": normalized_tag_name}

    def get_status(self) -> ProjectStatus:
        available = self._connected and bool(self._devices)
        return ProjectStatus(
            enabled=MQTT_ENABLED,
            connected=self._connected,
            available=available,
            topic_filter=MQTT_TOPIC_FILTER,
            broker_host=MQTT_BROKER_HOST,
            broker_port=MQTT_BROKER_PORT,
            message=self._message,
        )

    def get_devices(self) -> list[dict[str, Any]]:
        with self._lock:
            devices = []
            ordered_devices = sorted(self._devices.values(), key=lambda item: str(item["name"]).lower())
            for index, device in enumerate(ordered_devices, start=1):
                tags = list(sorted(device["tags"].values(), key=lambda item: str(item["name"]).lower()))
                devices.append(
                    {
                        "id": device["id"] or index,
                        "name": device["name"],
                        "properties": device["properties"],
                        "tags": [
                            {
                                "id": f'{device["id"]}:{tag["address"] or tag["name"]}',
                                "name": tag["name"],
                                "type": tag["type"],
                                "description": tag["description"],
                                "sourceAddress": tag.get("sourceAddress", ""),
                                "address": tag["address"],
                                "logData": tag["logData"],
                                "latestValue": tag["latestValue"],
                                "lastTimestamp": tag["lastTimestamp"],
                                "topic": tag["topic"],
                                "matchStatus": tag.get("matchStatus", "waiting"),
                                "matchMessage": tag.get("matchMessage", "Waiting for MQTT payload."),
                            }
                            for tag in tags
                        ],
                        "items": [
                            {
                                "id": f'{device["id"]}:tag',
                                "kind": "tag",
                                "label": f"Tag({len(tags)})",
                                "tagGroupId": f'{device["id"]}-tags',
                            },
                            {"id": f'{device["id"]}:block', "kind": "block", "label": "Block(0)"},
                        ],
                        "matchStatus": device.get("matchStatus", "waiting"),
                        "matchMessage": device.get("matchMessage", "Waiting for MQTT payload."),
                    }
                )
            return devices


project_store = MqttProjectStore()
