from __future__ import annotations
from typing import Any

from psycopg import OperationalError
from psycopg.types.json import Jsonb

from storage.energy_db import get_connection_pool


def ensure_project_store_tables():
    pool = get_connection_pool()
    if pool is None:
        return

    device_query = """
        CREATE TABLE IF NOT EXISTS project_devices (
            device_name VARCHAR(150) PRIMARY KEY,
            deployed BOOLEAN NOT NULL DEFAULT FALSE,
            configured_properties JSONB NOT NULL DEFAULT '[]'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """
    tag_query = """
        CREATE TABLE IF NOT EXISTS project_tags (
            device_name VARCHAR(150) NOT NULL REFERENCES project_devices(device_name) ON DELETE CASCADE,
            tag_address VARCHAR(150) NOT NULL,
            tag_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (device_name, tag_address)
        )
    """

    try:
        with pool.connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(device_query)
                cursor.execute(tag_query)
                cursor.execute(
                    "CREATE INDEX IF NOT EXISTS idx_project_tags_device_name ON project_tags (device_name)"
                )
            connection.commit()
    except OperationalError as error:
        print(f"[project-store-db] skipped table initialization: {error}")


def load_project_store_state() -> list[dict[str, Any]]:
    pool = get_connection_pool()
    if pool is None:
        return []

    query = """
        SELECT
            d.device_name,
            d.deployed,
            d.configured_properties,
            COALESCE(
                jsonb_agg(t.tag_payload ORDER BY t.tag_address) FILTER (WHERE t.tag_address IS NOT NULL),
                '[]'::jsonb
            ) AS configured_tags
        FROM project_devices d
        LEFT JOIN project_tags t ON t.device_name = d.device_name
        GROUP BY d.device_name, d.deployed, d.configured_properties
        ORDER BY d.device_name
    """

    try:
        with pool.connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query)
                rows = cursor.fetchall()
    except OperationalError as error:
        print(f"[project-store-db] state load skipped: {error}")
        return []

    devices: list[dict[str, Any]] = []
    for device_name, deployed, configured_properties, configured_tags in rows:
        devices.append(
            {
                "deviceName": str(device_name or "").strip(),
                "deployed": bool(deployed),
                "configuredProperties": list(configured_properties or []),
                "configuredTags": list(configured_tags or []),
            }
        )
    return devices


def save_project_store_state(devices: list[dict[str, Any]]):
    pool = get_connection_pool()
    if pool is None:
        return

    normalized_devices_by_name: dict[str, dict[str, Any]] = {}
    for device in devices:
        if not isinstance(device, dict):
            continue
        device_name = str(device.get("deviceName", "")).strip()
        if not device_name:
            continue
        normalized_devices_by_name[device_name] = {
            "deviceName": device_name,
            "deployed": bool(device.get("deployed", False)),
            "configuredProperties": list(device.get("configuredProperties", []) or []),
            "configuredTags": list(device.get("configuredTags", []) or []),
        }

    normalized_devices = list(normalized_devices_by_name.values())

    try:
        with pool.connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute("DELETE FROM project_tags")
                cursor.execute("DELETE FROM project_devices")

                for device in normalized_devices:
                    cursor.execute(
                        """
                        INSERT INTO project_devices (device_name, deployed, configured_properties, updated_at)
                        VALUES (%s, %s, %s, NOW())
                        ON CONFLICT (device_name) DO UPDATE
                        SET deployed = EXCLUDED.deployed,
                            configured_properties = EXCLUDED.configured_properties,
                            updated_at = NOW()
                        """,
                        (
                            device["deviceName"],
                            device["deployed"],
                            Jsonb(device["configuredProperties"]),
                        ),
                    )
                    for tag_payload in device["configuredTags"]:
                        if not isinstance(tag_payload, dict):
                            continue
                        tag_address = str(tag_payload.get("address", "")).strip()
                        if not tag_address:
                            continue
                        cursor.execute(
                            """
                            INSERT INTO project_tags (device_name, tag_address, tag_payload, updated_at)
                            VALUES (%s, %s, %s, NOW())
                            ON CONFLICT (device_name, tag_address) DO UPDATE
                            SET tag_payload = EXCLUDED.tag_payload,
                                updated_at = NOW()
                            """,
                            (
                                device["deviceName"],
                                tag_address,
                                Jsonb(tag_payload),
                            ),
                        )
            connection.commit()
    except OperationalError as error:
        print(f"[project-store-db] state save skipped: {error}")
