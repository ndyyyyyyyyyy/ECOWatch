from __future__ import annotations

import os
from collections import defaultdict
from datetime import date, datetime, time, timedelta

from fastapi import FastAPI, HTTPException, Query

try:
    import psycopg
except ImportError:  # pragma: no cover
    psycopg = None


DEFAULT_AREAS = ["RAC", "NR1", "NR2", "UT_NEW", "UTILITY"]
POSTGRES_DSN = os.getenv("ENERGY_PG_DSN", "").strip()
POSTGRES_HOST = os.getenv("ENERGY_PG_HOST", "192.168.1.101").strip() or "192.168.1.101"
POSTGRES_PORT = int(os.getenv("ENERGY_PG_PORT", "5432"))
POSTGRES_DB = os.getenv("ENERGY_PG_DATABASE", "modbus").strip() or "modbus"
POSTGRES_USER = os.getenv("ENERGY_PG_USER", "postgres").strip() or "postgres"
POSTGRES_PASSWORD = os.getenv("ENERGY_PG_PASSWORD", "postgres")
AREA_REGISTER_GROUPS = {
    "RAC": ["40004"],
    "NR1": ["40005"],
    "NR2": ["40006"],
    "UT_NEW": ["40007", "40008"],
    "UTILITY": ["40009", "40010"],
}
KNOWN_AREA_GROUPS = {
    "MAIN_ELECTRICAL": DEFAULT_AREAS,
    "ELECTRIC_TRANSFORMER": [
        "LVMDP_RAC",
        "LVMDP_NR1",
        "LVMDP_NR2",
        "LVMDP_UT_NEW",
        "LVMDP_UTILITY",
    ],
    "RAC": ["RAC"],
    "NR1": ["NR1"],
    "NR2": ["NR2"],
    "UT_NEW": ["UT_NEW"],
    "UTILITY": ["UTILITY"],
    "LVMDP_RAC": ["RAC"],
    "LVMDP_NR1": ["NR1"],
    "LVMDP_NR2": ["NR2"],
    "LVMDP_UT_NEW": ["UT_NEW"],
    "LVMDP_UTILITY": ["UTILITY"],
}


def _parse_date(value: str | None, fallback: date) -> date:
    if not value:
        return fallback
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return fallback


def _resolve_areas(raw_areas: str | None) -> list[str]:
    if not raw_areas:
        return DEFAULT_AREAS

    resolved: list[str] = []
    for item in raw_areas.split(","):
        area = item.strip()
        if not area:
            continue
        for name in KNOWN_AREA_GROUPS.get(area, [area]):
            if name not in resolved:
                resolved.append(name)
    return resolved or DEFAULT_AREAS


def _coerce_datetime(value) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, time.min)
    if isinstance(value, str):
        normalized = value.strip()
        if not normalized:
            return None
        for pattern in (
            "%Y-%m-%d %H:%M:%S.%f",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y-%m-%dT%H:%M:%S",
        ):
            try:
                return datetime.strptime(normalized, pattern)
            except ValueError:
                continue
        try:
            return datetime.fromisoformat(normalized)
        except ValueError:
            return None
    return None


def _bucket_label(timestamp: datetime, normalized_interval: str) -> str:
    if normalized_interval == "year":
        return timestamp.strftime("%Y")
    if normalized_interval == "month":
        return timestamp.strftime("%Y-%m")
    if normalized_interval == "day":
        return timestamp.strftime("%Y-%m-%d")
    if normalized_interval == "minute":
        minute_slot = (timestamp.minute // 15) * 15
        return timestamp.replace(minute=minute_slot, second=0, microsecond=0).strftime("%H:%M")
    return timestamp.replace(minute=0, second=0, microsecond=0).strftime("%H:%M")


def _sort_key(label: str, normalized_interval: str):
    if normalized_interval == "year":
        return (int(label),)
    if normalized_interval == "month":
        year, month = label.split("-")
        return (int(year), int(month))
    if normalized_interval == "day":
        return datetime.strptime(label, "%Y-%m-%d")
    hour, minute = label.split(":")
    return (int(hour), int(minute))


def _connect_postgres():
    if psycopg is None:
        raise HTTPException(status_code=500, detail="psycopg belum terpasang")

    if POSTGRES_DSN:
        return psycopg.connect(POSTGRES_DSN)

    return psycopg.connect(
        host=POSTGRES_HOST,
        port=POSTGRES_PORT,
        dbname=POSTGRES_DB,
        user=POSTGRES_USER,
        password=POSTGRES_PASSWORD,
    )


def _query_sensor_rows(
    register_addresses: list[str],
    start_dt: datetime,
    end_dt: datetime,
) -> list[tuple[str, float, datetime]]:
    if psycopg is None:
        raise HTTPException(status_code=500, detail="psycopg belum terpasang")

    placeholders = ",".join("%s" for _ in register_addresses)
    sql = f"""
        SELECT "RegisterAddressText", "Value", "Timestamp"
        FROM "SensorData"
        WHERE "RegisterAddressText" IN ({placeholders})
          AND "Timestamp" >= %s
          AND "Timestamp" <= %s
        ORDER BY "Timestamp" ASC
    """

    params = [*register_addresses, start_dt, end_dt]
    try:
        with _connect_postgres() as conn:
            cursor = conn.cursor()
            rows = cursor.execute(sql, params).fetchall()
            payload: list[tuple[str, float, datetime]] = []
            for row in rows:
                timestamp = _coerce_datetime(row[2])
                if timestamp is None:
                    continue
                payload.append((str(row[0]), float(row[1]), timestamp))
            return payload
    except psycopg.Error as error:
        raise HTTPException(status_code=500, detail=f"Gagal query PostgreSQL: {error}") from error


def _aggregate_area_rows(
    area_name: str,
    register_addresses: list[str],
    normalized_interval: str,
    start_dt: datetime,
    end_dt: datetime,
) -> list[dict[str, str | float]]:
    rows = _query_sensor_rows(register_addresses, start_dt, end_dt)
    if not rows:
        return []

    bucket_register_values: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    for register_address, value, timestamp in rows:
        bucket = _bucket_label(timestamp, normalized_interval)
        bucket_register_values[bucket][register_address].append(value)

    payload: list[dict[str, str | float]] = []
    for bucket in sorted(bucket_register_values.keys(), key=lambda item: _sort_key(item, normalized_interval)):
        register_map = bucket_register_values[bucket]
        bucket_total = 0.0
        for address in register_addresses:
            samples = register_map.get(address)
            if not samples:
                continue
            bucket_total += sum(samples) / len(samples)

        payload.append(
            {
                "timestamp": bucket,
                "tag_name": area_name,
                "value_kwh": round(bucket_total, 2),
            }
        )
    return payload


def _resolve_time_window(normalized_interval: str, start: str | None, end: str | None) -> tuple[datetime, datetime]:
    today = datetime.combine(datetime.now().date(), time.min)

    if normalized_interval == "year":
        end_date = _parse_date(end, today.date())
        start_date = _parse_date(start, date(end_date.year - 4, 1, 1))
        return datetime.combine(start_date, time.min), datetime.combine(end_date, time.max)

    if normalized_interval == "month":
        end_date = _parse_date(end, today.date())
        start_date = _parse_date(start, date(end_date.year, 1, 1))
        return datetime.combine(start_date, time.min), datetime.combine(end_date, time.max)

    if normalized_interval == "day":
        end_date = _parse_date(end, today.date())
        start_date = _parse_date(start, end_date - timedelta(days=6))
        return datetime.combine(start_date, time.min), datetime.combine(end_date, time.max)

    target_date = _parse_date(start, today.date())
    return datetime.combine(target_date, time.min), datetime.combine(target_date, time.max)


def register_energy_routes(app: FastAPI):
    @app.get("/api/energy/health")
    async def energy_health():
        if psycopg is None:
            return {"ok": False, "database": False, "message": "psycopg belum terpasang"}

        try:
            with _connect_postgres() as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT 1 FROM "SensorData" LIMIT 1')
                cursor.fetchone()
            return {"ok": True, "database": True, "message": None}
        except psycopg.Error as error:
            return {"ok": False, "database": False, "message": str(error)}

    @app.get("/energy")
    async def energy(
        interval: str = Query(default="Hour"),
        start: str | None = Query(default=None),
        end: str | None = Query(default=None),
        areas: str | None = Query(default=None),
    ):
        normalized_interval = interval.strip().lower() if interval else "hour"
        resolved_areas = _resolve_areas(areas)
        start_dt, end_dt = _resolve_time_window(normalized_interval, start, end)

        payload: list[dict[str, str | float]] = []
        for area in resolved_areas:
            register_addresses = AREA_REGISTER_GROUPS.get(area)
            if not register_addresses:
                continue
            payload.extend(
                _aggregate_area_rows(
                    area_name=area,
                    register_addresses=register_addresses,
                    normalized_interval=normalized_interval,
                    start_dt=start_dt,
                    end_dt=end_dt,
                )
            )
        return payload
