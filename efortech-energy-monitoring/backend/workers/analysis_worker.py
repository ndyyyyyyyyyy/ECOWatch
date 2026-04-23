from __future__ import annotations

import threading
import time

from core.config import PROJECT_WORKER_CONCURRENCY
from project.support import looks_like_energy_tag, looks_like_power_tag, parse_iso_datetime
from queues.analysis_queue import (
    ack_energy_job,
    build_consumer_name,
    claim_stale_jobs,
    mark_failed,
    mark_processed,
    queue_available,
    read_energy_jobs,
    retry_or_dead_letter_job,
)
from storage.energy_db import (
    close_connection_pool,
    ensure_energy_table,
    insert_ecowatch_log_reading,
    insert_ecowatch_mqtt_message,
    upsert_ecowatch_device,
    upsert_ecowatch_tag_config,
)


def _process_payload(message_id: str, payload: dict[str, str]):
    timestamp = parse_iso_datetime(payload.get("timestamp"))
    if timestamp is None:
        raise ValueError("invalid timestamp")

    tag_name = str(payload.get("tag_name", "")).strip()
    tag_address = str(payload.get("tag_address", "")).strip()
    topic = str(payload.get("topic", "")).strip()
    metric: str | None = None
    if looks_like_power_tag(tag_name, tag_address):
        metric = "power"
    elif looks_like_energy_tag(tag_name, tag_address):
        metric = "energy"

    if metric is None:
        ack_energy_job(message_id)
        mark_processed()
        return

    value = float(str(payload.get("value", "0")).strip())
    device_name = str(payload.get("device_name", "")).strip()
    upsert_ecowatch_device(device_id=device_name, mqtt_topic=topic, display_name=device_name)
    upsert_ecowatch_tag_config(
        device_id=device_name,
        payload_tag=tag_address,
        display_name=tag_name,
        unit="kW" if metric == "power" else "kWh",
    )
    insert_ecowatch_log_reading(
        timestamp=timestamp,
        device_id=device_name,
        payload_tag=tag_address,
        value=value,
        metric=metric,
    )
    insert_ecowatch_mqtt_message(device_id=device_name, tag_count=1, saved_count=1)
    ack_energy_job(message_id)
    mark_processed()


def _worker_loop(slot: int):
    consumer_name = build_consumer_name("postgres-worker", slot)
    print(f"[postgres-worker] consumer {consumer_name} listening")
    while True:
        try:
            stale_jobs = claim_stale_jobs(consumer_name)
            for message_id, payload in stale_jobs:
                try:
                    _process_payload(message_id, payload)
                except Exception as error:
                    mark_failed()
                    retry_or_dead_letter_job(message_id, payload, str(error))

            jobs = read_energy_jobs(consumer_name)
            for message_id, payload in jobs:
                try:
                    _process_payload(message_id, payload)
                except Exception as error:
                    mark_failed()
                    retry_or_dead_letter_job(message_id, payload, str(error))
        except Exception as error:  # pragma: no cover - long-running worker
            print(f"[postgres-worker] worker loop error ({consumer_name}): {error}")
            time.sleep(1)


def run_worker():
    ensure_energy_table()
    if not queue_available():
        raise RuntimeError("Project queue is not available. Check Redis dependency/configuration.")

    worker_count = max(1, PROJECT_WORKER_CONCURRENCY)
    print(f"[postgres-worker] starting {worker_count} consumer thread(s)")
    threads: list[threading.Thread] = []
    for index in range(worker_count):
        thread = threading.Thread(target=_worker_loop, args=(index + 1,), daemon=True)
        thread.start()
        threads.append(thread)

    try:
        while True:
            time.sleep(5)
    finally:
        close_connection_pool()


if __name__ == "__main__":
    run_worker()
