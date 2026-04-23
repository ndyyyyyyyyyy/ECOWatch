from __future__ import annotations

from datetime import datetime
import uuid

from core.config import MQTT_CLIENT_ID
from project.support import BrokerSession


def create_broker_session(self, broker_key: str, config, device_names: set[str]) -> BrokerSession:
    client_id = f"{MQTT_CLIENT_ID}-{uuid.uuid4().hex[:8]}"
    client = self._mqtt_module.Client(
        self._mqtt_module.CallbackAPIVersion.VERSION2,
        client_id=client_id,
        userdata={"broker_key": broker_key},
    )
    if config.username:
        client.username_pw_set(config.username, config.password or None)
    client.on_connect = self._on_connect
    client.on_disconnect = self._on_disconnect
    client.on_message = self._on_message
    session = BrokerSession(
        key=broker_key,
        config=config,
        client=client,
        device_names=set(device_names),
        subscribed_topics=set(),
        connected=False,
        message=f"Connecting to broker {config.host}:{config.port}...",
    )
    client.connect_async(config.host, config.port, keepalive=60)
    client.loop_start()
    return session


def refresh_connectivity_state_locked(self):
    connected_sessions = [session for session in self._broker_sessions.values() if session.connected]
    self._connected = bool(connected_sessions)
    if not self._broker_sessions:
        has_saved_devices = bool(self._devices)
        self._message = (
            "No deployed MQTT broker sessions. Deploy device to start data stream."
            if has_saved_devices
            else "No configured MQTT devices."
        )
        return
    if connected_sessions:
        total_devices = sum(len(session.device_names) for session in connected_sessions)
        subscribed_topics = sorted({topic for session in connected_sessions for topic in session.subscribed_topics})
        topic_summary = ", ".join(subscribed_topics[:5]) if subscribed_topics else "configured device topics"
        if len(subscribed_topics) > 5:
            topic_summary = f"{topic_summary}, ..."
        self._message = (
            f"Connected to {len(connected_sessions)} broker session(s). "
            f"Listening on {topic_summary} for {total_devices} deployed device(s)."
        )
        return
    first_session = next(iter(self._broker_sessions.values()))
    self._message = first_session.message or (
        f"Connecting to broker {first_session.config.host}:{first_session.config.port}..."
    )


def refresh_devices_for_broker_locked(self, broker_key: str):
    session = self._broker_sessions.get(broker_key)
    waiting_message = "Waiting for MQTT payload."
    for device_name, device_entry in self._devices.items():
        if self._device_brokers.get(device_name) != broker_key:
            continue
        if not device_entry.get("deployed", True):
            device_entry["matchStatus"] = "waiting"
            device_entry["matchMessage"] = "Configuration saved. Deploy device to start data stream."
            self._reset_device_tags_to_waiting(device_entry)
            continue
        if not session:
            device_entry["matchStatus"] = "mismatch"
            device_entry["matchMessage"] = "Broker session is not available."
        elif session.connected:
            if device_entry.get("matchStatus") != "matched":
                device_entry["matchStatus"] = "waiting"
                device_entry["matchMessage"] = waiting_message
            for tag_key, configured_tag in device_entry.get("configuredTags", {}).items():
                tag_entry = device_entry.setdefault("tags", {}).setdefault(
                    tag_key,
                    self._build_tag_entry(configured_tag),
                )
                if tag_entry.get("matchStatus") != "matched":
                    tag_entry["matchStatus"] = "waiting"
                    tag_entry["matchMessage"] = waiting_message
            if not device_entry.get("deployedAt"):
                device_entry["deployedAt"] = datetime.now().isoformat()
        else:
            device_entry["matchStatus"] = "mismatch"
            device_entry["matchMessage"] = session.message or "Broker connection failed."
            for tag_key, configured_tag in device_entry.get("configuredTags", {}).items():
                tag_entry = device_entry.setdefault("tags", {}).setdefault(
                    tag_key,
                    self._build_tag_entry(configured_tag),
                )
                tag_entry["matchStatus"] = "mismatch"
                tag_entry["matchMessage"] = device_entry["matchMessage"]


def desired_topics_for_broker_locked(self, broker_key: str) -> set[str]:
    topics: set[str] = set()
    for device_name, device_entry in self._devices.items():
        if self._device_brokers.get(device_name) != broker_key:
            continue
        if not bool(device_entry.get("deployed", True)):
            continue
        topic = str(self._subscriptions.get(device_name, "")).strip()
        if topic:
            topics.add(topic)
    return topics


def sync_session_subscriptions_locked(self, broker_key: str):
    session = self._broker_sessions.get(broker_key)
    if not session or not session.connected:
        return

    desired_topics = self._desired_topics_for_broker_locked(broker_key)
    obsolete_topics = set(session.subscribed_topics) - desired_topics
    missing_topics = desired_topics - set(session.subscribed_topics)

    for topic in obsolete_topics:
        try:
            session.client.unsubscribe(topic)
        except Exception:
            pass

    for topic in missing_topics:
        session.client.subscribe(topic)

    session.subscribed_topics = desired_topics


def sync_broker_sessions(self):
    if self._mqtt_module is None:
        return

    desired_configs: dict[str, object] = {}
    desired_devices: dict[str, set[str]] = {}
    new_device_brokers: dict[str, str] = {}

    with self._lock:
        for device_name, device_entry in self._devices.items():
            configured_properties = device_entry.get("configuredProperties") or device_entry.get("properties")
            if not bool(device_entry.get("deployed", True)):
                continue
            try:
                device_payload = self._properties_to_device_payload(configured_properties)
            except ValueError:
                continue
            config = self._broker_config_from_device_payload(device_payload)
            broker_key = self._broker_key(config)
            desired_configs[broker_key] = config
            desired_devices.setdefault(broker_key, set()).add(device_name)
            new_device_brokers[device_name] = broker_key

        existing_keys = set(self._broker_sessions.keys())
        desired_keys = set(desired_configs.keys())
        obsolete_keys = existing_keys - desired_keys
        missing_keys = desired_keys - existing_keys
        retained_keys = existing_keys & desired_keys

    for broker_key in obsolete_keys:
        with self._lock:
            session = self._broker_sessions.pop(broker_key, None)
        if not session:
            continue
        try:
            session.client.loop_stop()
        finally:
            try:
                session.client.disconnect()
            except Exception:
                pass

    for broker_key in missing_keys:
        session = self._create_broker_session(broker_key, desired_configs[broker_key], desired_devices[broker_key])
        with self._lock:
            self._broker_sessions[broker_key] = session

    with self._lock:
        for broker_key in retained_keys:
            session = self._broker_sessions.get(broker_key)
            if session:
                session.device_names = set(desired_devices[broker_key])
        self._device_brokers = new_device_brokers
        for broker_key in retained_keys:
            self._sync_session_subscriptions_locked(broker_key)
        self._refresh_connectivity_state_locked()
        for broker_key in desired_keys:
            self._refresh_devices_for_broker_locked(broker_key)
