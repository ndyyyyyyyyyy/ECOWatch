from __future__ import annotations
import json
import queue
import threading
from datetime import datetime
from typing import Any, Iterator

from core.config import (
    INFLUX_ENABLED,
    MQTT_BROKER_HOST,
    MQTT_BROKER_PORT,
    MQTT_ENABLED,
    TIMEZONE_INFO,
)
from project.brokers import (
    create_broker_session as _create_broker_session,
    desired_topics_for_broker_locked as _desired_topics_for_broker_locked,
    refresh_connectivity_state_locked as _refresh_connectivity_state_locked,
    refresh_devices_for_broker_locked as _refresh_devices_for_broker_locked,
    sync_session_subscriptions_locked as _sync_session_subscriptions_locked,
    sync_broker_sessions as _sync_broker_sessions,
)
from project.matchers import (
    broker_config_from_device_payload as _broker_config_from_device_payload,
    broker_key as _broker_key,
    broker_key_from_userdata as _broker_key_from_userdata,
    build_incoming_device_payload as _build_incoming_device_payload,
    build_incoming_tag_payload as _build_incoming_tag_payload,
    build_properties as _build_properties,
    build_tag_entry as _build_tag_entry,
    configured_tag_registry_status as _configured_tag_registry_status,
    device_topic as _device_topic,
    device_type_from_entry as _device_type_from_entry,
    evaluate_device_match as _evaluate_device_match,
    evaluate_tag_match as _evaluate_tag_match,
    heartbeat_seconds_from_properties as _heartbeat_seconds_from_properties,
    normalize_configured_tag as _normalize_configured_tag,
    properties_to_device_payload as _properties_to_device_payload,
    tag_to_payload as _tag_to_payload,
)
from project.state import (
    apply_heartbeat_timeout_locked as _apply_heartbeat_timeout_locked,
    heartbeat_monitor_loop as _heartbeat_monitor_loop,
    heartbeat_reference_time_locked as _heartbeat_reference_time_locked,
    mark_device_requires_deploy as _mark_device_requires_deploy,
    reset_device_tags_to_waiting as _reset_device_tags_to_waiting,
    touch_device_heartbeat_locked as _touch_device_heartbeat_locked,
)
from project.support import (
    BrokerSession,
    ProjectStatus,
    as_dict as _as_dict,
    as_list as _as_list,
    parse_iso_datetime as _parse_iso_datetime,
    pick as _pick,
)
from storage.project_store_db import (
    ensure_project_store_tables,
    load_project_store_state,
    save_project_store_state,
)

try:
    import paho.mqtt.client as mqtt
except ImportError:  # pragma: no cover - handled at runtime
    mqtt = None


class MqttProjectStore:
    def __init__(self):
        self._lock = threading.Lock()
        self._devices: dict[str, dict[str, Any]] = {}
        self._subscriptions: dict[str, str] = {}
        self._listeners: set[queue.Queue[str]] = set()
        self._ingest_queue: queue.Queue[dict[str, Any]] = queue.Queue(maxsize=2048)
        self._topic_queues: dict[str, queue.Queue[dict[str, Any]]] = {}
        self._topic_threads: dict[str, threading.Thread] = {}
        self._connected = False
        self._message = "MQTT disabled."
        self._broker_sessions: dict[str, BrokerSession] = {}
        self._device_brokers: dict[str, str] = {}
        self._stop_event = threading.Event()
        self._heartbeat_thread: threading.Thread | None = None
        self._ingest_thread: threading.Thread | None = None
        self._mqtt_module = mqtt

    def _save_persisted_state(self):
        with self._lock:
            devices_payload = [
                {
                    "deviceName": device_name,
                    "deployed": bool(device.get("deployed", True)),
                    "configuredProperties": device.get("configuredProperties", []),
                    "configuredTags": list(device.get("configuredTags", {}).values()),
                }
                for device_name, device in self._devices.items()
            ]
        save_project_store_state(devices_payload)

    def _load_persisted_state(self):
        ensure_project_store_tables()
        persisted_devices = load_project_store_state()
        if not persisted_devices:
            return

        loaded_devices: dict[str, dict[str, Any]] = {}
        loaded_subscriptions: dict[str, str] = {}
        for raw_device in persisted_devices:
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
                registry_status = self._configured_tag_registry_status(device_payload["name"], tag_payload)
                visible_tags[tag_payload["address"]] = self._build_tag_entry(
                    tag_payload,
                    {
                        "matchStatus": registry_status["status"],
                        "matchMessage": (
                            registry_status["message"]
                            if registry_status["status"] == "mismatch"
                            else "Waiting for MQTT payload." if bool(raw_device.get("deployed", True)) else "Configuration saved. Deploy device to start data stream."
                        ),
                    },
                )

            device_name = device_payload["name"]
            deployed = bool(raw_device.get("deployed", True))
            loaded_devices[device_name] = {
                "id": device_name,
                "name": device_name,
                "properties": self._build_properties(device_payload),
                "configuredProperties": self._build_properties(device_payload),
                "configuredTags": configured_tags,
                "tags": visible_tags,
                "matchStatus": "waiting",
                "matchMessage": "Waiting for MQTT payload." if deployed else "Configuration saved. Deploy device to start data stream.",
                "deployed": deployed,
                "deployedAt": datetime.now(TIMEZONE_INFO).isoformat() if deployed else None,
                "lastSeenAt": None,
            }
            loaded_subscriptions[device_name] = self._device_topic(
                device_name,
                device_payload.get("topic", ""),
            )

        with self._lock:
            self._devices = loaded_devices
            self._subscriptions = loaded_subscriptions
        self._save_persisted_state()

    def start(self):
        self._stop_event.clear()
        self._load_persisted_state()
        if not MQTT_ENABLED:
            self._message = "MQTT disabled. Set MQTT_ENABLED=true to activate broker subscription."
            self._publish_snapshot()
            return
        if mqtt is None:
            self._message = "MQTT enabled but dependency paho-mqtt is not installed."
            self._publish_snapshot()
            return
        self._sync_broker_sessions()
        if self._heartbeat_thread is None or not self._heartbeat_thread.is_alive():
            self._heartbeat_thread = threading.Thread(target=self._heartbeat_monitor_loop, name="project-heartbeat", daemon=True)
            self._heartbeat_thread.start()
        if self._ingest_thread is None or not self._ingest_thread.is_alive():
            self._ingest_thread = threading.Thread(target=self._ingest_loop, name="project-ingest", daemon=True)
            self._ingest_thread.start()
        self._publish_snapshot()

    def stop(self):
        self._stop_event.set()
        heartbeat_thread = self._heartbeat_thread
        self._heartbeat_thread = None
        ingest_thread = self._ingest_thread
        self._ingest_thread = None
        if heartbeat_thread and heartbeat_thread.is_alive():
            heartbeat_thread.join(timeout=2)
        if ingest_thread and ingest_thread.is_alive():
            ingest_thread.join(timeout=2)
        with self._lock:
            sessions = list(self._broker_sessions.values())
            self._broker_sessions = {}
            self._device_brokers = {}
            self._connected = False
            self._topic_queues = {}
            self._topic_threads = {}
        for session in sessions:
            try:
                session.client.loop_stop()
            finally:
                try:
                    session.client.disconnect()
                except Exception:
                    pass

    @staticmethod
    def _reason_code_value(reason_code: Any) -> int | str:
        value = getattr(reason_code, "value", reason_code)
        try:
            return int(value)
        except (TypeError, ValueError):
            return str(reason_code)

    def _serialize_snapshot(self) -> str:
        status = self.get_status()
        metrics = queue_metrics() if queue_available() else {}
        raw_metrics = raw_queue_metrics() if raw_queue_available() else {}
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
                "queueEnabled": queue_available(),
                "queueDepth": metrics.get("queueDepth", 0),
                "queuePendingCount": metrics.get("pendingCount", 0),
                "queueDlqDepth": metrics.get("dlqDepth", 0),
                "queueProcessedCount": metrics.get("processedCount", 0),
                "queueRetriedCount": metrics.get("retriedCount", 0),
                "queueDeadLetterCount": metrics.get("deadLetterCount", 0),
                "queueFailedCount": metrics.get("failedCount", 0),
                "queueBackpressureRejectedCount": metrics.get("backpressureRejectedCount", 0),
                "rawQueueEnabled": raw_queue_available() and INFLUX_ENABLED,
                "rawQueueDepth": raw_metrics.get("queueDepth", 0),
                "rawQueuePendingCount": raw_metrics.get("pendingCount", 0),
                "rawQueueDlqDepth": raw_metrics.get("dlqDepth", 0),
                "rawQueueProcessedCount": raw_metrics.get("processedCount", 0),
                "rawQueueRetriedCount": raw_metrics.get("retriedCount", 0),
                "rawQueueDeadLetterCount": raw_metrics.get("deadLetterCount", 0),
                "rawQueueFailedCount": raw_metrics.get("failedCount", 0),
                "rawQueueBackpressureRejectedCount": raw_metrics.get("backpressureRejectedCount", 0),
                "topicWorkerCount": len(self._topic_threads),
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
        broker_key = self._broker_key_from_userdata(userdata)
        with self._lock:
            session = self._broker_sessions.get(broker_key)
            if not session:
                return
            session.connected = code == 0
            if session.connected:
                self._sync_session_subscriptions_locked(broker_key)
                device_count = len(session.device_names)
                topic_summary = ", ".join(sorted(session.subscribed_topics)[:5]) if session.subscribed_topics else "configured device topics"
                if len(session.subscribed_topics) > 5:
                    topic_summary = f"{topic_summary}, ..."
                session.message = (
                    f'Connected to broker {session.config.host}:{session.config.port}. '
                    f'Listening on {topic_summary} for {device_count} configured device(s).'
                )
            else:
                session.message = (
                    f'Broker {session.config.host}:{session.config.port} connect failed with reason code {code}.'
                )
            self._refresh_connectivity_state_locked()
            self._refresh_devices_for_broker_locked(broker_key)
        self._publish_snapshot()

    def _on_disconnect(self, client, userdata, flags, reason_code, properties):  # pragma: no cover - callback
        code = self._reason_code_value(reason_code)
        broker_key = self._broker_key_from_userdata(userdata)
        with self._lock:
            session = self._broker_sessions.get(broker_key)
            if not session:
                return
            session.connected = False
            session.message = (
                f'Disconnected from broker {session.config.host}:{session.config.port} with reason code {code}.'
            )
            self._refresh_connectivity_state_locked()
            self._refresh_devices_for_broker_locked(broker_key)
        self._publish_snapshot()

    def _on_message(self, client, userdata, msg):  # pragma: no cover - callback
        broker_key = self._broker_key_from_userdata(userdata)
        payload_bytes = bytes(msg.payload or b"")
        try:
            self._ingest_queue.put_nowait(
                {
                    "broker_key": broker_key,
                    "topic": str(msg.topic),
                    "payload": payload_bytes,
                }
            )
        except queue.Full:
            print(f'[project-store] ingest queue full, dropping MQTT message from topic "{msg.topic}"')

    def _ingest_loop(self):
        while not self._stop_event.is_set():
            try:
                item = self._ingest_queue.get(timeout=1)
            except queue.Empty:
                continue
            try:
                broker_key = str(item.get("broker_key", "")).strip()
                topic = str(item.get("topic", "")).strip()
                payload = bytes(item.get("payload", b""))
                topic_queue = self._ensure_topic_worker(topic)
                try:
                    topic_queue.put_nowait(
                        {
                            "broker_key": broker_key,
                            "topic": topic,
                            "payload": payload,
                        }
                    )
                except queue.Full:
                    print(f'[project-store] topic queue full, dropping MQTT message from topic "{topic}"')
            finally:
                self._ingest_queue.task_done()

    def _ensure_topic_worker(self, topic: str) -> queue.Queue[dict[str, Any]]:
        normalized_topic = str(topic).strip() or "__unknown_topic__"
        with self._lock:
            existing_queue = self._topic_queues.get(normalized_topic)
            existing_thread = self._topic_threads.get(normalized_topic)
            if existing_queue is not None and existing_thread is not None and existing_thread.is_alive():
                return existing_queue

            topic_queue: queue.Queue[dict[str, Any]] = queue.Queue(maxsize=512)
            worker = threading.Thread(
                target=self._topic_worker_loop,
                args=(normalized_topic, topic_queue),
                name=f"project-topic-{normalized_topic.replace('/', '_')}",
                daemon=True,
            )
            self._topic_queues[normalized_topic] = topic_queue
            self._topic_threads[normalized_topic] = worker
            worker.start()
            return topic_queue

    def _topic_worker_loop(self, topic: str, topic_queue: queue.Queue[dict[str, Any]]):
        while not self._stop_event.is_set():
            try:
                item = topic_queue.get(timeout=1)
            except queue.Empty:
                continue
            try:
                self._process_incoming_message(
                    str(item.get("broker_key", "")).strip(),
                    str(item.get("topic", topic)).strip(),
                    bytes(item.get("payload", b"")),
                )
            finally:
                topic_queue.task_done()

    def _process_incoming_message(self, broker_key: str, topic: str, payload_bytes: bytes):
        payload_text = payload_bytes.decode("utf-8", errors="ignore").strip()
        payload_data: dict[str, Any]
        try:
            parsed = json.loads(payload_text) if payload_text else {}
            payload_data = parsed if isinstance(parsed, dict) else {"value": parsed}
        except json.JSONDecodeError:
            payload_data = {"value": payload_text}

        device_section = _as_dict(payload_data.get("device"))
        tag_section = _as_dict(payload_data.get("tag"))
        tags_section = [item for item in _as_list(payload_data.get("tags")) if isinstance(item, dict)]
        batch_section = [item for item in _as_list(payload_data.get("d")) if isinstance(item, dict)]
        telemetry_section = _as_dict(payload_data.get("telemetry"))
        topic_device_name = str(
            _pick(
                payload_data.get("device_name"),
                device_section.get("name"),
                default="Unknown Device",
            )
        )

        with self._lock:
            active_broker_session = self._broker_sessions.get(broker_key)
            if not active_broker_session or not active_broker_session.connected:
                return
            configured_tag_lookup = {
                device_name: set(device_entry.get("configuredTags", {}).keys())
                for device_name, device_entry in self._devices.items()
                if device_entry.get("deployed", True) and self._device_brokers.get(device_name) == broker_key
            }
            configured_topic_lookup = {
                device_name: self._subscriptions.get(device_name, "")
                for device_name, device_entry in self._devices.items()
                if device_entry.get("deployed", True) and self._device_brokers.get(device_name) == broker_key
            }

        default_timestamp = _parse_iso_datetime(
            _pick(payload_data.get("timestamp"), payload_data.get("ts"), telemetry_section.get("timestamp"))
        ) or datetime.now(TIMEZONE_INFO)
        candidate_tags = tags_section or batch_section or [tag_section or {}]
        resolved_tag_batches: dict[str, list[tuple[dict[str, Any], dict[str, Any]]]] = {}
        for candidate_tag in candidate_tags:
            preview_tag_payload = self._build_incoming_tag_payload(
                candidate_tag,
                payload_data,
                tag_section,
                default_timestamp,
                topic,
                [],
            )
            resolved_device_name = self._resolve_device_name_for_tag(
                topic_device_name,
                topic,
                preview_tag_payload["address"],
                configured_tag_lookup,
                configured_topic_lookup,
            )
            if not resolved_device_name:
                continue
            resolved_tag_batches.setdefault(resolved_device_name, []).append((candidate_tag, preview_tag_payload))

        should_publish = False
        with self._lock:
            for device_name, device_tag_batches in resolved_tag_batches.items():
                device_entry = self._devices.get(device_name)
                if not device_entry:
                    continue
                configured_properties = device_entry.get("configuredProperties", [])
                configured_tags = device_entry.get("configuredTags", {})
                device_payload = self._build_incoming_device_payload(device_name, payload_data, device_section)
                device_match_result = self._evaluate_device_match(
                    device_name,
                    configured_properties,
                    device_payload,
                    payload_data,
                    device_section,
                    active_broker_session.config,
                )

                device_entry["name"] = device_payload["name"]
                device_entry["properties"] = device_entry.get("configuredProperties") or self._build_properties(device_payload)
                if not device_entry.get("configuredProperties"):
                    device_entry["configuredProperties"] = self._build_properties(device_payload)
                if device_match_result["status"] == "mismatch":
                    print(f'[project-store] device mismatch for "{device_name}": {device_match_result["message"]}')
                    device_entry["matchStatus"] = "mismatch"
                    device_entry["matchMessage"] = device_match_result["message"]
                    for _, tag_payload in device_tag_batches:
                        configured_tag = configured_tags.get(tag_payload["address"])
                        if not configured_tag:
                            continue
                        tag_entry = device_entry["tags"].setdefault(
                            tag_payload["address"], self._build_tag_entry(configured_tag)
                        )
                        tag_entry.update(
                            {
                                "matchStatus": "mismatch",
                                "matchMessage": device_match_result["message"],
                                "topic": tag_payload["topic"],
                            }
                        )
                    should_publish = True
                    continue

                device_entry["matchStatus"] = device_match_result["status"]
                device_entry["matchMessage"] = device_match_result["message"]
                self._touch_device_heartbeat_locked(device_entry, default_timestamp.isoformat())

                for candidate_tag, tag_payload in device_tag_batches:
                    configured_tag = configured_tags.get(tag_payload["address"])
                    if not configured_tag:
                        configured_tag = self._tag_to_payload(tag_payload)
                        configured_tags[tag_payload["address"]] = configured_tag

                    tag_entry = device_entry["tags"].setdefault(tag_payload["address"], self._build_tag_entry(configured_tag))
                    tag_match_result = self._evaluate_tag_match(
                        device_name,
                        configured_tag,
                        tag_payload,
                        payload_data,
                        candidate_tag,
                    )
                    if tag_match_result["status"] == "mismatch":
                        print(
                            f'[project-store] tag mismatch for "{device_name}" / "{configured_tag["name"]}": '
                            f'{tag_match_result["message"]}'
                        )
                        tag_entry.update(
                            {
                                "matchStatus": "mismatch",
                                "matchMessage": tag_match_result["message"],
                                "topic": topic,
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
                        try:
                            enqueue_raw_job(
                                timestamp=_parse_iso_datetime(tag_payload["lastTimestamp"]) or default_timestamp,
                                device_name=device_name,
                                tag_name=configured_tag["name"],
                                tag_address=configured_tag["address"],
                                topic=tag_payload["topic"],
                                value=tag_payload["latestValue"],
                            )
                        except Exception as error:
                            print(f'[project-store] raw queue publish failed for "{device_name}" / "{configured_tag["name"]}": {error}')
                        try:
                            enqueue_energy_job(
                                timestamp=_parse_iso_datetime(tag_payload["lastTimestamp"]) or default_timestamp,
                                device_name=device_name,
                                tag_name=configured_tag["name"],
                                tag_address=configured_tag["address"],
                                topic=tag_payload["topic"],
                                value=tag_payload["latestValue"],
                            )
                        except Exception as error:
                            print(f'[project-store] queue publish failed for "{device_name}" / "{configured_tag["name"]}": {error}')
                should_publish = True

        if should_publish:
            self._save_persisted_state()
            self._publish_snapshot()

    @staticmethod
    def _resolve_device_name_for_tag(
        topic_device_name: str,
        topic: str,
        tag_address: str,
        configured_tag_lookup: dict[str, set[str]],
        configured_topic_lookup: dict[str, str],
    ) -> str | None:
        normalized_address = str(tag_address).strip()
        normalized_topic = str(topic).strip()
        if normalized_topic and normalized_address:
            matched_devices = [
                device_name
                for device_name, configured_addresses in configured_tag_lookup.items()
                if configured_topic_lookup.get(device_name) == normalized_topic and normalized_address in configured_addresses
            ]
            if len(matched_devices) == 1:
                return matched_devices[0]
        if normalized_address:
            matched_devices = [
                device_name
                for device_name, configured_addresses in configured_tag_lookup.items()
                if normalized_address in configured_addresses
            ]
            if len(matched_devices) == 1:
                return matched_devices[0]
        topic_device_name = str(topic_device_name).strip()
        if topic_device_name and normalized_address in configured_tag_lookup.get(topic_device_name, set()):
            return topic_device_name
        return None

    _broker_config_from_device_payload = staticmethod(_broker_config_from_device_payload)
    _broker_key = staticmethod(_broker_key)
    _broker_key_from_userdata = staticmethod(_broker_key_from_userdata)
    _build_incoming_device_payload = staticmethod(_build_incoming_device_payload)
    _properties_to_device_payload = staticmethod(_properties_to_device_payload)
    _tag_to_payload = staticmethod(_tag_to_payload)
    _device_type_from_entry = staticmethod(_device_type_from_entry)
    _normalize_configured_tag = staticmethod(_normalize_configured_tag)
    _device_topic = staticmethod(_device_topic)
    _build_properties = staticmethod(_build_properties)
    _heartbeat_seconds_from_properties = staticmethod(_heartbeat_seconds_from_properties)
    _build_tag_entry = staticmethod(_build_tag_entry)
    _configured_tag_registry_status = staticmethod(_configured_tag_registry_status)
    _build_incoming_tag_payload = staticmethod(_build_incoming_tag_payload)
    _evaluate_device_match = staticmethod(_evaluate_device_match)
    _evaluate_tag_match = staticmethod(_evaluate_tag_match)
    _reset_device_tags_to_waiting = _reset_device_tags_to_waiting
    _mark_device_requires_deploy = _mark_device_requires_deploy
    _touch_device_heartbeat_locked = _touch_device_heartbeat_locked
    _heartbeat_reference_time_locked = _heartbeat_reference_time_locked
    _apply_heartbeat_timeout_locked = _apply_heartbeat_timeout_locked
    _heartbeat_monitor_loop = _heartbeat_monitor_loop
    _create_broker_session = _create_broker_session
    _desired_topics_for_broker_locked = _desired_topics_for_broker_locked
    _refresh_connectivity_state_locked = _refresh_connectivity_state_locked
    _refresh_devices_for_broker_locked = _refresh_devices_for_broker_locked
    _sync_session_subscriptions_locked = _sync_session_subscriptions_locked
    _sync_broker_sessions = _sync_broker_sessions

    def deploy_device(self, device_name: str) -> dict[str, Any]:
        normalized_name = str(device_name).strip()
        if not normalized_name:
            raise ValueError("Device name is required.")

        with self._lock:
            device_entry = self._devices.get(normalized_name)
            if not device_entry:
                raise ValueError("Device not found.")

            device_entry["deployed"] = True
            device_entry["matchStatus"] = "waiting"
            device_entry["matchMessage"] = "Waiting for MQTT payload."
            device_entry["deployedAt"] = datetime.now(TIMEZONE_INFO).isoformat()
            device_entry["lastSeenAt"] = None
            self._reset_device_tags_to_waiting(device_entry)
            topic = self._subscriptions.get(normalized_name)

        self._sync_broker_sessions()
        self._save_persisted_state()
        self._publish_snapshot()
        return {"deviceName": normalized_name, "topic": topic}

    def subscribe_device(self, properties: list[dict[str, Any]] | None) -> dict[str, Any]:
        if not MQTT_ENABLED:
            raise RuntimeError("MQTT is not enabled.")

        device_payload = self._properties_to_device_payload(properties)
        device_name = device_payload["name"]
        topic = self._device_topic(device_name, device_payload.get("topic", ""))

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
                "matchMessage": "Configuration saved. Deploy device to start data stream.",
                "deployed": False,
                "deployedAt": None,
                "lastSeenAt": None,
            }
            self._devices[device_name] = device_entry
            self._subscriptions[device_name] = topic

        self._sync_broker_sessions()
        self._save_persisted_state()
        self._publish_snapshot()
        return {"deviceName": device_name, "topic": topic}

    def update_device(self, current_device_name: str, properties: list[dict[str, Any]] | None) -> dict[str, Any]:
        normalized_current = str(current_device_name).strip()
        if not normalized_current:
            raise ValueError("Current device name is required.")

        device_payload = self._properties_to_device_payload(properties)
        next_device_name = device_payload["name"]
        next_topic = self._device_topic(next_device_name, device_payload.get("topic", ""))

        with self._lock:
            if normalized_current not in self._devices:
                raise ValueError("Device not found.")

            previous_topic = self._subscriptions.pop(normalized_current, None)
            current_device = self._devices.pop(normalized_current)
            current_device["id"] = next_device_name
            current_device["name"] = next_device_name
            current_device["properties"] = self._build_properties(device_payload)
            current_device["configuredProperties"] = self._build_properties(device_payload)
            self._mark_device_requires_deploy(current_device)
            self._devices[next_device_name] = current_device
            self._subscriptions[next_device_name] = next_topic
        self._sync_broker_sessions()

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
        self._sync_broker_sessions()

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
            registry_status = self._configured_tag_registry_status(normalized_device_name, tag_payload)
            visible_tags[tag_payload["address"]] = self._build_tag_entry(
                tag_payload,
                {
                    **(existing_tag or {}),
                    "latestValue": None,
                    "lastTimestamp": None,
                    "topic": "",
                    "matchStatus": registry_status["status"],
                    "matchMessage": (
                        registry_status["message"]
                        if registry_status["status"] == "mismatch"
                        else "Configuration saved. Deploy device to start data stream."
                    ),
                },
            )
            self._mark_device_requires_deploy(device_entry)

        self._sync_broker_sessions()
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
            self._mark_device_requires_deploy(device_entry)

        self._sync_broker_sessions()
        self._save_persisted_state()
        self._publish_snapshot()
        return {"deviceName": normalized_device_name, "tagAddress": normalized_tag_name}

    def get_status(self) -> ProjectStatus:
        with self._lock:
            active_session = next(iter(self._broker_sessions.values()), None)
            available = self._connected and bool(self._device_brokers)
            broker_host = active_session.config.host if active_session else MQTT_BROKER_HOST
            broker_port = active_session.config.port if active_session else MQTT_BROKER_PORT
            configured_topics = sorted({topic for topic in self._subscriptions.values() if str(topic).strip()})
            topic_summary = ", ".join(configured_topics[:5]) if configured_topics else "Configured per device"
            if len(configured_topics) > 5:
                topic_summary = f"{topic_summary}, ..."
        return ProjectStatus(
            enabled=MQTT_ENABLED,
            connected=self._connected,
            available=available,
            topic_filter=topic_summary,
            broker_host=broker_host,
            broker_port=broker_port,
            message=self._message,
        )

    def get_devices(self) -> list[dict[str, Any]]:
        with self._lock:
            def _device_sort_key(item: dict[str, Any]) -> tuple[int, str]:
                property_map = {
                    str(prop.get("label", "")).strip(): str(prop.get("value", "")).strip()
                    for prop in (item.get("properties") or [])
                    if isinstance(prop, dict)
                }
                raw_unit_number = property_map.get("Unit Number", "").strip()
                try:
                    unit_number = int(raw_unit_number)
                except (TypeError, ValueError):
                    unit_number = 10**9
                return unit_number, str(item["name"]).lower()

            devices = []
            ordered_devices = sorted(self._devices.values(), key=_device_sort_key)
            for index, device in enumerate(ordered_devices, start=1):
                tags = list(sorted(device["tags"].values(), key=lambda item: str(item["name"]).lower()))
                property_map = {
                    str(prop.get("label", "")).strip(): str(prop.get("value", "")).strip()
                    for prop in (device.get("properties") or [])
                    if isinstance(prop, dict)
                }
                device_type = property_map.get("Device Type", "MQTT") or "MQTT"
                items = [
                    {
                        "id": f'{device["id"]}:tag',
                        "kind": "tag",
                        "label": f"Tag({len(tags)})",
                        "tagGroupId": f'{device["id"]}-tags',
                    }
                ]
                devices.append(
                    {
                        "id": device["id"] or index,
                        "name": device["name"],
                        "properties": device["properties"],
                        "deployed": bool(device.get("deployed", True)),
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
                        "items": items,
                        "matchStatus": device.get("matchStatus", "waiting"),
                        "matchMessage": device.get("matchMessage", "Waiting for MQTT payload."),
                    }
                )
            return devices


project_store = MqttProjectStore()
from queues.analysis_queue import enqueue_energy_job, queue_available, queue_metrics
from queues.raw_queue import enqueue_raw_job, raw_queue_available, raw_queue_metrics
