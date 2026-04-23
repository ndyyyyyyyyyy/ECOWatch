from __future__ import annotations

from datetime import datetime
from typing import Any

from core.config import MQTT_BROKER_HOST, MQTT_BROKER_PORT
from project.support import (
    BrokerConfig,
    coerce_float,
    format_property,
    looks_like_energy_tag,
    looks_like_power_tag,
    parse_iso_datetime,
    pick,
    topic_tail,
)


def broker_config_from_device_payload(device_payload: dict[str, Any]) -> BrokerConfig:
    host = str(device_payload.get("ipAddress", device_payload.get("primaryIpAddress", MQTT_BROKER_HOST))).strip()
    port_value = str(device_payload.get("portNumber", device_payload.get("primaryPortNumber", MQTT_BROKER_PORT))).strip()
    try:
        port = int(port_value)
    except (TypeError, ValueError):
        port = MQTT_BROKER_PORT
    return BrokerConfig(
        host=host or MQTT_BROKER_HOST,
        port=port,
        username=str(device_payload.get("username", "")).strip(),
        password=str(device_payload.get("password", "")).strip(),
    )


def broker_key(config: BrokerConfig) -> str:
    return f"{config.host}:{config.port}:{config.username}:{config.password}"


def broker_key_from_userdata(userdata: Any) -> str:
    if isinstance(userdata, dict):
        return str(userdata.get("broker_key", "")).strip()
    return ""


def build_incoming_device_payload(
    device_name: str,
    payload_data: dict[str, Any],
    device_section: dict[str, Any],
) -> dict[str, str]:
    device_type = str(
        pick(payload_data.get("device_type"), device_section.get("device_type"), default="MQTT")
    )
    base_payload = {
        "name": str(device_name),
        "unitNumber": str(pick(payload_data.get("unit_number"), device_section.get("unit_number"), default="0")),
        "deviceType": device_type,
        "description": str(
            pick(
                payload_data.get("device_description"),
                device_section.get("description"),
                default="",
            )
        ),
    }

    if device_type == "MQTT":
        return {
            **base_payload,
            "topic": str(
                pick(
                    payload_data.get("topic"),
                    device_section.get("topic"),
                    default="",
                )
            ),
            "heartbeatFrequency": str(
                pick(
                    payload_data.get("heartbeat_frequency"),
                    device_section.get("heartbeat_frequency"),
                    default="60",
                )
            ),
            "deviceId": str(
                pick(
                    payload_data.get("device_id"),
                    device_section.get("device_id"),
                    default="",
                )
            ),
            "username": str(
                pick(
                    payload_data.get("username"),
                    device_section.get("username"),
                    default="",
                )
            ),
            "password": str(
                pick(
                    payload_data.get("password"),
                    device_section.get("password"),
                    default="",
                )
            ),
            "ipAddress": str(
                pick(
                    payload_data.get("ip_address"),
                    device_section.get("ip_address"),
                    default=MQTT_BROKER_HOST,
                )
            ),
            "portNumber": str(
                pick(
                    payload_data.get("port_number"),
                    device_section.get("port_number"),
                    default=MQTT_BROKER_PORT,
                )
            ),
            "primaryIpAddress": str(
                pick(
                    payload_data.get("ip_address"),
                    device_section.get("ip_address"),
                    default=MQTT_BROKER_HOST,
                )
            ),
            "primaryPortNumber": str(
                pick(
                    payload_data.get("port_number"),
                    device_section.get("port_number"),
                    default=MQTT_BROKER_PORT,
                )
            ),
            "primaryDeviceAddress": str(
                pick(
                    payload_data.get("device_id"),
                    device_section.get("device_id"),
                    default="",
                )
            ),
        }

    return {
        **base_payload,
        "primaryIpAddress": str(
            pick(payload_data.get("primary_ip"), device_section.get("primary_ip"), default=MQTT_BROKER_HOST)
        ),
        "primaryPortNumber": str(
            pick(payload_data.get("primary_port"), device_section.get("primary_port"), default=MQTT_BROKER_PORT)
        ),
        "primaryDeviceAddress": str(
            pick(payload_data.get("device_address"), device_section.get("device_address"), default="1")
        ),
        "heartbeatFrequency": str(
            pick(
                payload_data.get("heartbeat_frequency"),
                device_section.get("heartbeat_frequency"),
                default="60",
            )
        ),
        "deviceId": str(
            pick(
                payload_data.get("device_id"),
                device_section.get("device_id"),
                payload_data.get("device_address"),
                device_section.get("device_address"),
                default="",
            )
        ),
        "username": str(
            pick(
                payload_data.get("username"),
                device_section.get("username"),
                default="",
            )
        ),
        "password": str(
            pick(
                payload_data.get("password"),
                device_section.get("password"),
                default="",
            )
        ),
        "ipAddress": str(
            pick(
                payload_data.get("ip_address"),
                device_section.get("ip_address"),
                payload_data.get("primary_ip"),
                device_section.get("primary_ip"),
                default=MQTT_BROKER_HOST,
            )
        ),
        "portNumber": str(
            pick(
                payload_data.get("port_number"),
                device_section.get("port_number"),
                payload_data.get("primary_port"),
                device_section.get("primary_port"),
                default=MQTT_BROKER_PORT,
            )
        ),
    }


def properties_to_device_payload(properties: list[dict[str, Any]] | None) -> dict[str, str]:
    property_map = {
        str(item.get("label", "")).strip(): str(item.get("value", "")).strip()
        for item in (properties or [])
        if isinstance(item, dict)
    }

    name = property_map.get("Device Name", "").strip()
    if not name:
        raise ValueError("Device Name is required.")
    device_type = property_map.get("Device Type", "MQTT")
    topic = property_map.get("Topic", "").strip()
    if device_type == "MQTT" and not topic:
        raise ValueError("Topic is required for MQTT devices.")

    return {
        "name": name,
        "unitNumber": property_map.get("Unit Number", "0"),
        "deviceType": device_type,
        "description": property_map.get("Description", ""),
        "topic": topic,
        "primaryIpAddress": property_map.get("Primary IP Address", property_map.get("IP Address", MQTT_BROKER_HOST)),
        "primaryPortNumber": property_map.get(
            "Primary Port Number",
            property_map.get("Port Number", str(MQTT_BROKER_PORT)),
        ),
        "primaryDeviceAddress": property_map.get("Primary Device Address", "1"),
        "heartbeatFrequency": property_map.get("Heartbeat Frequency (second)", "60"),
        "deviceId": "",
        "username": property_map.get("Username", ""),
        "password": property_map.get("Password", ""),
        "ipAddress": property_map.get("IP Address", MQTT_BROKER_HOST),
        "portNumber": property_map.get("Port Number", str(MQTT_BROKER_PORT)),
    }


def tag_to_payload(tag: dict[str, Any] | None) -> dict[str, str]:
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


def device_type_from_entry(device_entry: dict[str, Any] | None) -> str:
    properties = device_entry.get("configuredProperties") if device_entry else None
    if not properties:
        properties = device_entry.get("properties") if device_entry else None
    property_map = {
        str(item.get("label", "")).strip(): str(item.get("value", "")).strip()
        for item in (properties or [])
        if isinstance(item, dict)
    }
    return property_map.get("Device Type", "MQTT") or "MQTT"


def normalize_configured_tag(
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


def device_topic(device_name: str, configured_topic: str | None = None) -> str:
    normalized_topic = str(configured_topic or "").strip()
    if normalized_topic:
        return normalized_topic
    raise ValueError(f"Topic is required for MQTT device '{str(device_name).strip() or 'Unknown'}'.")


def build_properties(device_payload: dict[str, Any]) -> list[dict[str, str]]:
    if device_payload["deviceType"] == "MQTT":
        return [
            format_property("Device Name", device_payload["name"]),
            format_property("Description", device_payload["description"]),
            format_property("Unit Number", device_payload["unitNumber"]),
            format_property("Device Type", device_payload["deviceType"]),
            format_property("Topic", device_payload.get("topic", "")),
            format_property("Heartbeat Frequency (second)", device_payload.get("heartbeatFrequency", "60")),
            format_property("Username", device_payload.get("username", "")),
            format_property("Password", device_payload.get("password", "")),
            format_property("IP Address", device_payload.get("ipAddress", device_payload["primaryIpAddress"])),
            format_property("Port Number", device_payload.get("portNumber", device_payload["primaryPortNumber"])),
        ]

    return [
        format_property("Device Name", device_payload["name"]),
        format_property("Description", device_payload["description"]),
        format_property("Unit Number", device_payload["unitNumber"]),
        format_property("Device Type", device_payload["deviceType"]),
        format_property("Primary IP Address", device_payload["primaryIpAddress"]),
        format_property("Primary Port Number", device_payload["primaryPortNumber"]),
        format_property("Primary Device Address", device_payload["primaryDeviceAddress"]),
    ]


def heartbeat_seconds_from_properties(properties: list[dict[str, Any]] | None) -> int:
    property_map = {
        str(item.get("label", "")).strip(): str(item.get("value", "")).strip()
        for item in (properties or [])
        if isinstance(item, dict)
    }
    raw_value = property_map.get("Heartbeat Frequency (second)", "60").strip()
    try:
        heartbeat_seconds = int(raw_value)
    except (TypeError, ValueError):
        heartbeat_seconds = 60
    return max(heartbeat_seconds, 1)


def build_tag_entry(tag_payload: dict[str, Any], existing_tag: dict[str, Any] | None = None) -> dict[str, Any]:
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


def configured_tag_registry_status(device_name: str, tag_payload: dict[str, Any]) -> dict[str, str]:
    return {"status": "waiting", "message": "Waiting for MQTT payload."}


def build_incoming_tag_payload(
    candidate_tag: dict[str, Any],
    payload_data: dict[str, Any],
    tag_section: dict[str, Any],
    default_timestamp: datetime,
    topic: str,
    wildcard_values: list[str],
) -> dict[str, Any]:
    timestamp = parse_iso_datetime(
        pick(
            candidate_tag.get("timestamp"),
            candidate_tag.get("ts"),
            payload_data.get("timestamp"),
            payload_data.get("ts"),
            tag_section.get("timestamp"),
        )
    ) or default_timestamp
    address = str(
        pick(
            candidate_tag.get("address"),
            candidate_tag.get("tag"),
            payload_data.get("address"),
            tag_section.get("address"),
            wildcard_values[1] if len(wildcard_values) >= 2 else None,
            topic_tail(topic),
            default=topic,
        )
    )
    inferred_name = str(
        pick(
            candidate_tag.get("name"),
            candidate_tag.get("tag"),
            payload_data.get("tag_name"),
            tag_section.get("name"),
            payload_data.get("tag"),
            address,
            default=topic,
        )
    )

    if looks_like_power_tag(inferred_name, address):
        value_candidates = (
            candidate_tag.get("value_kw"),
            candidate_tag.get("kw"),
            candidate_tag.get("power"),
            candidate_tag.get("value"),
            payload_data.get("value_kw"),
            payload_data.get("kw"),
            payload_data.get("power"),
            payload_data.get("value"),
            candidate_tag.get("value_kwh"),
            payload_data.get("value_kwh"),
        )
    elif looks_like_energy_tag(inferred_name, address):
        value_candidates = (
            candidate_tag.get("value_kwh"),
            candidate_tag.get("kwh"),
            candidate_tag.get("energy"),
            candidate_tag.get("value"),
            payload_data.get("value_kwh"),
            payload_data.get("kwh"),
            payload_data.get("energy"),
            payload_data.get("value"),
        )
    else:
        value_candidates = (
            candidate_tag.get("value"),
            payload_data.get("value"),
            candidate_tag.get("value_kw"),
            payload_data.get("value_kw"),
            candidate_tag.get("value_kwh"),
            payload_data.get("value_kwh"),
        )

    numeric_value = coerce_float(pick(*value_candidates))
    return {
        "name": inferred_name,
        "type": str(pick(candidate_tag.get("type"), payload_data.get("type"), tag_section.get("type"), default="analog")),
        "description": str(
            pick(
                candidate_tag.get("description"),
                payload_data.get("description"),
                tag_section.get("description"),
                default=f"MQTT topic: {topic}",
            )
        ),
        "sourceAddress": str(
            pick(
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
        "logData": str(pick(candidate_tag.get("logData"), payload_data.get("logData"), tag_section.get("logData"), default="yes")),
        "latestValue": numeric_value,
        "lastTimestamp": timestamp.isoformat(),
        "topic": topic,
    }


def evaluate_device_match(
    device_name: str,
    configured_properties: list[dict[str, Any]] | None,
    incoming_device_payload: dict[str, Any],
    payload_data: dict[str, Any],
    device_section: dict[str, Any],
    active_broker_config: BrokerConfig | None = None,
) -> dict[str, str]:
    property_map = {
        str(item.get("label", "")).strip(): str(item.get("value", "")).strip()
        for item in (configured_properties or [])
        if isinstance(item, dict)
    }
    configured_device_type = property_map.get("Device Type", "MQTT").strip() or "MQTT"
    incoming_device_type = str(incoming_device_payload["deviceType"]).strip() or "MQTT"
    if incoming_device_type == "MQTT" and active_broker_config is not None:
        expected_host = property_map.get("IP Address", "").strip()
        expected_port = property_map.get("Port Number", "").strip()
        expected_username = property_map.get("Username", "").strip()
        expected_password = property_map.get("Password", "").strip()
        broker_mismatches: list[str] = []
        if expected_host and expected_host != active_broker_config.host:
            broker_mismatches.append("IP Address mismatch")
        if expected_port and expected_port != str(active_broker_config.port):
            broker_mismatches.append("Port Number mismatch")
        if expected_username != active_broker_config.username:
            broker_mismatches.append("Username mismatch")
        if expected_password != active_broker_config.password:
            broker_mismatches.append("Password mismatch")
        if broker_mismatches:
            return {"status": "mismatch", "message": "mismatch"}
        # For MQTT, the broker session itself is the source of truth. Payloads from field devices
        # typically do not repeat broker credentials, so a connected matching broker means the
        # device side is already matched before tag-level validation runs.
        return {"status": "matched", "message": ""}
    if incoming_device_type == "MQTT":
        # Project device matching for MQTT is broker-centric and only uses broker credentials.
        comparisons = [
            ("Username", incoming_device_payload.get("username", ""), "username" in payload_data or "username" in device_section),
            ("Password", incoming_device_payload.get("password", ""), "password" in payload_data or "password" in device_section),
            ("IP Address", incoming_device_payload.get("ipAddress", ""), "ip_address" in payload_data or "ip_address" in device_section),
            ("Port Number", incoming_device_payload.get("portNumber", ""), "port_number" in payload_data or "port_number" in device_section),
        ]
    else:
        if configured_device_type != incoming_device_type:
            return {
                "status": "mismatch",
                "message": "mismatch",
            }
        comparisons = [
            ("Device Name", incoming_device_payload["name"], True),
            ("Device Type", incoming_device_type, True),
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
        return {"status": "mismatch", "message": "mismatch"}
    if matched_fields > 0:
        return {"status": "matched", "message": ""}
    return {"status": "waiting", "message": ""}


def evaluate_tag_match(
    device_name: str,
    configured_tag: dict[str, Any],
    incoming_tag_payload: dict[str, Any],
    payload_data: dict[str, Any],
    tag_section: dict[str, Any],
) -> dict[str, str]:
    expected = str(configured_tag["address"]).strip()
    is_present = (
        "address" in payload_data
        or "address" in tag_section
        or bool(str(incoming_tag_payload.get("address", "")).strip())
    )
    incoming = str(incoming_tag_payload["address"]).strip()

    if not expected or not is_present:
        return {"status": "waiting", "message": "Waiting for matching tag fields from MQTT payload."}
    if expected != incoming:
        return {"status": "mismatch", "message": "mismatch"}
    return {"status": "matched", "message": "Payload matches available tag fields."}
