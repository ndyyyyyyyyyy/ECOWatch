from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path

import psycopg
from psycopg import sql

from config import ENERGY_PG_TABLE
from energy_db import _connection_kwargs, ensure_energy_table
from energy_routes import LEGACY_ECOWATCH_DEVICE


def _extract_copy_rows(sql_text: str, table_name: str) -> list[list[str]]:
    marker = f"COPY public.{table_name} "
    start_index = sql_text.find(marker)
    if start_index == -1:
        raise RuntimeError(f"Section COPY public.{table_name} not found in SQL dump.")

    copy_start = sql_text.find("\n", start_index)
    if copy_start == -1:
        raise RuntimeError(f"Malformed COPY section for {table_name}.")

    rows: list[list[str]] = []
    for raw_line in sql_text[copy_start + 1 :].splitlines():
        line = raw_line.rstrip("\r")
        if line == r"\.":
            break
        if not line:
            continue
        rows.append(line.split("\t"))
    return rows


def _parse_tags(sql_text: str) -> dict[int, dict[str, str | None]]:
    tags: dict[int, dict[str, str | None]] = {}
    for row in _extract_copy_rows(sql_text, "energy_tag"):
        if len(row) != 4:
            continue
        tag_id = int(row[0])
        tags[tag_id] = {
            "tag_name": None if row[1] == r"\N" else row[1],
            "modbus_address": None if row[2] == r"\N" else row[2],
            "parent_id": None if row[3] == r"\N" else row[3],
        }
    return tags


def _parse_energy_rows(
    sql_text: str,
    tags: dict[int, dict[str, str | None]],
    device_name: str,
) -> list[tuple[datetime, str, str, str, float]]:
    records: list[tuple[datetime, str, str, str, float]] = []
    for row in _extract_copy_rows(sql_text, "energy_data"):
        if len(row) != 4:
            continue

        tag = tags.get(int(row[1]))
        if not tag:
            continue

        tag_name = str(tag.get("tag_name") or "").strip()
        if not tag_name:
            continue

        timestamp = datetime.fromisoformat(row[3])
        tag_address = str(tag.get("modbus_address") or tag_name).strip() or tag_name
        value = float(row[2])
        records.append((timestamp, device_name, tag_name, tag_address, value))
    return records


def migrate_energy_dump(sql_path: Path, device_name: str = LEGACY_ECOWATCH_DEVICE) -> tuple[int, int]:
    if not sql_path.exists():
        raise FileNotFoundError(f"SQL dump not found: {sql_path}")

    ensure_energy_table()
    sql_text = sql_path.read_text(encoding="utf-8")
    tags = _parse_tags(sql_text)
    records = _parse_energy_rows(sql_text, tags, device_name=device_name)

    delete_query = sql.SQL("DELETE FROM {table_name} WHERE device_name = %s").format(
        table_name=sql.Identifier(ENERGY_PG_TABLE)
    )
    insert_query = sql.SQL(
        """
        INSERT INTO {table_name} (timestamp, device_name, tag_name, tag_address, value)
        VALUES (%s, %s, %s, %s, %s)
        """
    ).format(table_name=sql.Identifier(ENERGY_PG_TABLE))

    with psycopg.connect(**_connection_kwargs()) as connection:
        with connection.cursor() as cursor:
            cursor.execute(delete_query, (device_name,))
            deleted_rows = cursor.rowcount or 0
            cursor.executemany(insert_query, records)
        connection.commit()

    return deleted_rows, len(records)


def main():
    parser = argparse.ArgumentParser(
        description="Migrate ecowatch-main energy_eco.sql into the current flattened energy_data table."
    )
    parser.add_argument("sql_path", help="Path to energy_eco.sql dump file.")
    parser.add_argument(
        "--device-name",
        default=LEGACY_ECOWATCH_DEVICE,
        help=f"device_name marker for imported legacy data. Default: {LEGACY_ECOWATCH_DEVICE}",
    )
    args = parser.parse_args()

    deleted_rows, inserted_rows = migrate_energy_dump(
        Path(args.sql_path),
        device_name=args.device_name,
    )
    print(
        f"[migrate-energy-eco] replaced legacy slice device_name={args.device_name!r}: "
        f"deleted={deleted_rows}, inserted={inserted_rows}"
    )


if __name__ == "__main__":
    main()
