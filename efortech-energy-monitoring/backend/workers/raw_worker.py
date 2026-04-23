from __future__ import annotations

import threading
import time

from core.config import PROJECT_RAW_WORKER_CONCURRENCY
from project.support import parse_iso_datetime
from queues.raw_queue import (
    ack_raw_job,
    build_raw_consumer_name,
    claim_stale_raw_jobs,
    mark_raw_failed,
    mark_raw_processed,
    raw_queue_available,
    read_raw_jobs,
    retry_or_dead_letter_raw_job,
)
from storage.influx_writer import close_influx_client, influx_available, write_raw_point


def _process_payload(message_id: str, payload: dict[str, str]):
    timestamp = parse_iso_datetime(payload.get("timestamp"))
    if timestamp is None:
        raise ValueError("invalid timestamp")

    write_raw_point(
        timestamp=timestamp,
        device_name=str(payload.get("device_name", "")).strip(),
        tag_name=str(payload.get("tag_name", "")).strip(),
        tag_address=str(payload.get("tag_address", "")).strip(),
        topic=str(payload.get("topic", "")).strip(),
        value=float(str(payload.get("value", "0")).strip()),
    )
    ack_raw_job(message_id)
    mark_raw_processed()


def _worker_loop(slot: int):
    consumer_name = build_raw_consumer_name("influx-worker", slot)
    print(f"[influx-worker] consumer {consumer_name} listening")
    while True:
        try:
            stale_jobs = claim_stale_raw_jobs(consumer_name)
            for message_id, payload in stale_jobs:
                try:
                    _process_payload(message_id, payload)
                except Exception as error:
                    mark_raw_failed()
                    retry_or_dead_letter_raw_job(message_id, payload, str(error))

            jobs = read_raw_jobs(consumer_name)
            for message_id, payload in jobs:
                try:
                    _process_payload(message_id, payload)
                except Exception as error:
                    mark_raw_failed()
                    retry_or_dead_letter_raw_job(message_id, payload, str(error))
        except Exception as error:  # pragma: no cover - long-running worker
            print(f"[influx-worker] worker loop error ({consumer_name}): {error}")
            time.sleep(1)


def run_worker():
    if not raw_queue_available():
        raise RuntimeError("Raw queue is not available. Check Redis dependency/configuration.")
    if not influx_available():
        raise RuntimeError("InfluxDB writer is not available. Check Influx dependency/configuration.")

    worker_count = max(1, PROJECT_RAW_WORKER_CONCURRENCY)
    print(f"[influx-worker] starting {worker_count} consumer thread(s)")
    threads: list[threading.Thread] = []
    for index in range(worker_count):
        thread = threading.Thread(target=_worker_loop, args=(index + 1,), daemon=True)
        thread.start()
        threads.append(thread)

    try:
        while True:
            time.sleep(5)
    finally:
        close_influx_client()


if __name__ == "__main__":
    run_worker()
