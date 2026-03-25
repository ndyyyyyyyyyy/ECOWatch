from __future__ import annotations

from datetime import datetime, timezone

import psycopg
from psycopg import sql
from psycopg import OperationalError

from config import (
    ENERGY_PG_DATABASE,
    ENERGY_PG_ENABLED,
    ENERGY_PG_HOST,
    ENERGY_PG_PASSWORD,
    ENERGY_PG_PORT,
    ENERGY_PG_TABLE,
    ENERGY_PG_USER,
)


def _normalize_timestamp(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _connection_kwargs() -> dict[str, object]:
    return {
        "host": ENERGY_PG_HOST,
        "port": ENERGY_PG_PORT,
        "dbname": ENERGY_PG_DATABASE,
        "user": ENERGY_PG_USER,
        "password": ENERGY_PG_PASSWORD,
    }


def ensure_energy_table():
    if not ENERGY_PG_ENABLED:
        return

    query = sql.SQL(
        """
        CREATE TABLE IF NOT EXISTS {table_name} (
            timestamp TIMESTAMP NOT NULL,
            device_name VARCHAR(100),
            tag_name VARCHAR(100),
            tag_address VARCHAR(100),
            value DOUBLE PRECISION
        )
        """
    ).format(table_name=sql.Identifier(ENERGY_PG_TABLE))

    try:
        with psycopg.connect(**_connection_kwargs()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query)
            connection.commit()
    except OperationalError as error:
        print(f"[energy-db] skipped table initialization: {error}")


def insert_energy_reading(
    timestamp: datetime,
    device_name: str,
    tag_name: str,
    tag_address: str,
    value: float,
):
    if not ENERGY_PG_ENABLED:
        return

    normalized_timestamp = _normalize_timestamp(timestamp)
    query = sql.SQL(
        """
        INSERT INTO {table_name} (timestamp, device_name, tag_name, tag_address, value)
        VALUES (%s, %s, %s, %s, %s)
        """
    ).format(table_name=sql.Identifier(ENERGY_PG_TABLE))

    try:
        with psycopg.connect(**_connection_kwargs()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    query,
                    (
                        normalized_timestamp,
                        device_name,
                        tag_name,
                        tag_address,
                        value,
                    ),
                )
            connection.commit()
    except OperationalError as error:
        print(f"[energy-db] insert skipped: {error}")
