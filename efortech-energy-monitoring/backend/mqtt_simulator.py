from __future__ import annotations

import json
import math
import threading
import time
from datetime import datetime
from typing import Any, Callable

import paho.mqtt.client as mqtt

from config import (
    MQTT_BROKER_HOST,
    MQTT_BROKER_PORT,
    MQTT_PASSWORD,
    MQTT_SIMULATOR_ENABLED,
    MQTT_SIMULATOR_INTERVAL_SECONDS,
    MQTT_TOPIC_FILTER,
    MQTT_USERNAME,
)
from source_bridge import bridge_property_mismatches, modicon_property_mismatches


def _topic_for_device(device_name: str) -> str:
    return _topic_for_device_and_tag(device_name, "")


def _topic_for_device_and_tag(device_name: str, tag_address: str) -> str:
    if "+" not in MQTT_TOPIC_FILTER:
        suffix = f"/{tag_address}" if tag_address else ""
        return f"{MQTT_TOPIC_FILTER.rstrip('/')}/{device_name}{suffix}"

    topic = MQTT_TOPIC_FILTER.replace("+", device_name, 1)
    if "+" in topic:
        topic = topic.replace("+", tag_address or "tag", 1)
    elif tag_address:
        topic = f"{topic.rstrip('/')}/{tag_address}"
    return topic


def _safe_int(value: Any, default: int) -> int:
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return default


def _property_map(device: dict[str, Any]) -> dict[str, str]:
    return {
        str(item.get("label", "")).strip(): str(item.get("value", "")).strip()
        for item in device.get("properties", [])
        if isinstance(item, dict)
    }


class MqttDeviceSimulator:
    def __init__(self, get_devices: Callable[[], list[dict[str, Any]]]):
        self._get_devices = get_devices
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None
        self._mqtt_client: mqtt.Client | None = None
        self._sequence = 0
        self._last_sent_at: dict[str, float] = {}
        self._accumulators: dict[str, float] = {}
        self._device_profiles: dict[str, dict[str, float]] = {}

    def start(self):
        if not MQTT_SIMULATOR_ENABLED:
            return
        if self._thread and self._thread.is_alive():
            return

        mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="efortech-mqtt-simulator")
        if MQTT_USERNAME:
            mqtt_client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD or None)
        try:
            mqtt_client.connect(MQTT_BROKER_HOST, MQTT_BROKER_PORT, keepalive=60)
        except Exception as error:  # pragma: no cover - defensive logging
            print(f"[mqtt-simulator] MQTT connect failed: {error}")
            return
        mqtt_client.loop_start()
        self._mqtt_client = mqtt_client

        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run_loop, name="mqtt-device-simulator", daemon=True)
        self._thread.start()

    def stop(self):
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5)
        self._thread = None

        if self._mqtt_client is not None:
            self._mqtt_client.loop_stop()
            self._mqtt_client.disconnect()
            self._mqtt_client = None

    def _run_loop(self):
        while not self._stop_event.is_set():
            try:
                self._publish_due_devices()
            except Exception as error:  # pragma: no cover - defensive logging
                print(f"[mqtt-simulator] publish error: {error}")

            self._stop_event.wait(max(1, MQTT_SIMULATOR_INTERVAL_SECONDS))

    def _publish_due_devices(self):
        now = time.time()
        for device in self._get_devices():
            device_type = self._device_type(device)
            device_name = str(device.get("name", "")).strip()
            if not device_name:
                continue

            if device_type == "MQTT":
                heartbeat = _safe_int(self._property_value(device, "Heartbeat Frequency (second)"), MQTT_SIMULATOR_INTERVAL_SECONDS)
            else:
                heartbeat = MQTT_SIMULATOR_INTERVAL_SECONDS
            last_sent_at = self._last_sent_at.get(device_name, 0)
            if now - last_sent_at < max(1, heartbeat):
                continue

            if device_type == "MQTT":
                self._publish_mqtt_device_tags(device, device_name, device.get("tags", []))
            elif device_type == "Modicon":
                self._publish_modicon_device_tags(device, device_name, device.get("tags", []))
            else:
                continue

            self._last_sent_at[device_name] = now

    def _publish_mqtt_device_tags(self, device: dict[str, Any], device_name: str, tags: list[dict[str, Any]]):
        if self._mqtt_client is None:
            return

        mismatches = bridge_property_mismatches(device_name, _property_map(device))
        if mismatches:
            print(f'[mqtt-simulator] bridge validation failed for {device_name}: ' + ", ".join(mismatches))
            return

        for tag in tags:
            payload = self._build_payload(device, device_name, tag, "MQTT")
            if payload is None:
                continue
            topic = _topic_for_device_and_tag(device_name, str(tag.get("address", "")).strip())
            self._mqtt_client.publish(topic, json.dumps(payload), qos=0, retain=False)

    def _publish_modicon_device_tags(self, device: dict[str, Any], device_name: str, tags: list[dict[str, Any]]):
        if self._mqtt_client is None:
            return

        mismatches = modicon_property_mismatches(device_name, _property_map(device))
        if mismatches:
            print(f'[mqtt-simulator] bridge validation failed for {device_name}: ' + ", ".join(mismatches))
            return

        for tag in tags:
            payload = self._build_payload(device, device_name, tag, "Modicon")
            if payload is None:
                continue
            topic = _topic_for_device_and_tag(device_name, str(tag.get("address", "")).strip())
            self._mqtt_client.publish(topic, json.dumps(payload), qos=0, retain=False)

    def _build_payload(self, device: dict[str, Any], device_name: str, tag: dict[str, Any], device_type: str) -> dict[str, Any] | None:
        tag_type = str(tag.get("type", "analog")).strip().lower()
        if tag_type == "text":
            return None

        self._sequence += 1
        source_address = str(tag.get("sourceAddress", "")).strip() or str(tag.get("address", "")).strip()
        mqtt_address = str(tag.get("address", "")).strip()
        value = self._next_value(device_name, tag, tag_type, source_address or mqtt_address)
        base_payload = {
            "device_name": device_name,
            "device_type": device_type,
            "timestamp": datetime.now().isoformat(),
            "source_address": source_address,
            "tag": {
                "name": tag.get("name", ""),
                "type": tag.get("type", "analog"),
                "description": tag.get("description", ""),
                "sourceAddress": source_address,
                "address": mqtt_address,
                "logData": tag.get("logData", "yes"),
            },
            "value": value,
        }
        if device_type == "MQTT":
            return {
                **base_payload,
                "device_id": self._property_value(device, "Device ID"),
                "username": self._property_value(device, "Username"),
                "ip_address": self._property_value(device, "IP Address"),
                "port_number": self._property_value(device, "Port Number"),
            }
        return {
            **base_payload,
            "primary_ip": self._property_value(device, "Primary IP Address"),
            "primary_port": self._property_value(device, "Primary Port Number"),
            "device_address": self._property_value(device, "Primary Device Address"),
        }

    def _next_value(self, device_name: str, tag: dict[str, Any], tag_type: str, source_key: str) -> float:
        tag_name = str(tag.get("name", "")).strip().lower()
        address = str(tag.get("address", "")).strip().lower()
        state_key = f"{device_name}:{address or source_key}"
        seed = sum(ord(char) for char in state_key) % 17
        profile = self._device_profile(device_name)

        if tag_type == "discrete":
            threshold = 0.55 + (seed % 3) * 0.1
            return float(profile["load_ratio"] >= threshold)

        if "voltage" in tag_name or "volt" in address or address.startswith("v"):
            return round(profile["voltage"] + (seed % 5 - 2) * 0.08, 2)

        if "current" in tag_name or "curr" in address or address.startswith("i"):
            return round(profile["current"] + (seed % 4 - 1.5) * 0.03, 2)

        if "power factor" in tag_name or "pf" == address or address.startswith("pf"):
            return round(profile["power_factor"] + (seed % 3 - 1) * 0.002, 3)

        if "frequency" in tag_name or "freq" in tag_name or address.startswith("hz") or "freq" in address:
            return round(profile["frequency"] + (seed % 3 - 1) * 0.005, 2)

        if "power" in tag_name or "kw" in tag_name or address.startswith("kw"):
            return round(profile["power_kw"] + (seed % 4 - 1.5) * 0.04, 2)

        if "kwh" in tag_name or "energy" in tag_name or "kwh" in address:
            previous = self._accumulators.get(state_key, 100 + seed)
            hours = max(1, MQTT_SIMULATOR_INTERVAL_SECONDS) / 3600
            increment = max(profile["power_kw"], 0.1) * hours
            next_value = round(previous + increment, 3)
            self._accumulators[state_key] = next_value
            return next_value

        if "temperature" in tag_name or "temp" in address:
            base = 26.0 + profile["load_ratio"] * 6.5
            swing = math.sin(profile["phase"] / 2.0 + seed) * 0.35
            return round(base + swing, 2)

        if "pressure" in tag_name or "press" in address:
            base = 3.1 + profile["load_ratio"] * 1.4
            swing = math.cos(profile["phase"] / 1.7 + seed) * 0.08
            return round(base + swing, 3)

        if "flow" in tag_name or "flow" in address:
            base = 14.0 + profile["load_ratio"] * 8.0
            swing = math.sin(profile["phase"] / 1.3 + seed) * 0.45
            return round(base + swing, 2)

        base = 10 + (seed % 10) + profile["load_ratio"] * 3.5
        swing = math.sin(profile["phase"] + seed) * 0.25
        return round(base + swing, 2)

    def _device_profile(self, device_name: str) -> dict[str, float]:
        device_seed = sum(ord(char) for char in device_name) % 19
        phase = (self._sequence + device_seed) / 3.0
        load_wave = (math.sin(phase) + 1) / 2
        load_ripple = (math.sin(phase / 3.0 + 0.7) + 1) / 2
        load_ratio = 0.35 + load_wave * 0.45 + load_ripple * 0.1

        profile = {
            "phase": phase,
            "load_ratio": load_ratio,
            "voltage": 221.5 + math.sin(phase / 2.2) * 2.4 - load_ratio * 1.8,
            "current": 4.0 + load_ratio * 8.5 + math.sin(phase / 1.5) * 0.25,
            "power_factor": min(0.98, 0.84 + load_ratio * 0.11 + math.sin(phase / 4.0) * 0.01),
            "frequency": 50.0 + math.sin(phase / 5.0) * 0.06,
        }
        profile["power_kw"] = profile["voltage"] * profile["current"] * profile["power_factor"] / 1000
        self._device_profiles[device_name] = profile
        return profile

    @staticmethod
    def _property_value(device: dict[str, Any], label: str) -> str:
        for item in device.get("properties", []):
            if isinstance(item, dict) and str(item.get("label", "")).strip() == label:
                return str(item.get("value", "")).strip()
        return ""

    def _device_type(self, device: dict[str, Any]) -> str:
        return self._property_value(device, "Device Type") or "MQTT"
