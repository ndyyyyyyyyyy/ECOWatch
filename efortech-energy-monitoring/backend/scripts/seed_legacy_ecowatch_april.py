from __future__ import annotations

import math
import random
from datetime import datetime, timedelta

from core.config import TIMEZONE_INFO
from storage.energy_db import close_connection_pool, ensure_energy_table, get_connection_pool


LEGACY_DEVICE_NAME = "LEGACY_ECOWATCH"
LEGACY_TOPIC = "simulation/legacy-ecowatch"
APRIL_YEAR = 2026
STEP_MINUTES = 15

# Leaf-ish nodes to seed directly. Parent nodes remain aggregated by the existing tree logic.
LEGACY_SIM_NODES: dict[str, dict[str, float]] = {
    "DB1": {"base_kw": 22.0, "variance": 0.12},
    "CHAMBER_AR1": {"base_kw": 8.5, "variance": 0.10},
    "H_PRESS_MC1": {"base_kw": 14.0, "variance": 0.11},
    "V_F_MALE_C_NR1": {"base_kw": 11.5, "variance": 0.14},
    "V_F_MALE_B_NR1": {"base_kw": 10.2, "variance": 0.13},
    "V_F_MALE_A_NR1": {"base_kw": 9.7, "variance": 0.12},
    "LVMDP_RAC": {"base_kw": 18.0, "variance": 0.08},
    "LVMDP_NR2": {"base_kw": 12.4, "variance": 0.10},
    "LVMDP_UT_NEW": {"base_kw": 7.8, "variance": 0.09},
    "LVMDP_UTILITY": {"base_kw": 5.9, "variance": 0.07},
}


def _day_factor(timestamp: datetime) -> float:
    hour = timestamp.hour + (timestamp.minute / 60.0)
    weekday = timestamp.weekday()

    base = 0.45
    morning_ramp = 0.35 / (1 + math.exp(-(hour - 8.0) * 1.3))
    afternoon_hump = 0.22 * math.exp(-((hour - 14.5) ** 2) / 10.0)
    evening_tail = 0.08 * math.exp(-((hour - 19.0) ** 2) / 6.0)
    weekday_factor = 1.0 if weekday < 5 else 0.72
    return max((base + morning_ramp + afternoon_hump + evening_tail) * weekday_factor, 0.18)


def _node_kw(node_name: str, timestamp: datetime) -> float:
    cfg = LEGACY_SIM_NODES[node_name]
    seed_value = int(timestamp.strftime("%Y%m%d%H%M")) + sum(ord(char) for char in node_name)
    rng = random.Random(seed_value)

    base_kw = cfg["base_kw"]
    profile = _day_factor(timestamp)
    wave = 1.0 + (0.06 * math.sin((timestamp.hour / 24.0) * math.tau + (len(node_name) * 0.17)))
    drift = 1.0 + (0.03 * math.sin((timestamp.timetuple().tm_yday / 31.0) * math.tau))
    noise = 1.0 + rng.uniform(-cfg["variance"], cfg["variance"])

    # Occasional brief spikes to avoid a flat synthetic profile.
    spike = 1.0
    if rng.random() < 0.03:
        spike += rng.uniform(0.08, 0.22)

    kw = base_kw * profile * wave * drift * noise * spike
    return round(max(kw, base_kw * 0.12), 3)


def _iter_april_2026() -> list[datetime]:
    current = datetime(APRIL_YEAR, 4, 1, 0, 0, tzinfo=TIMEZONE_INFO)
    end = datetime(APRIL_YEAR, 4, 30, 23, 45, tzinfo=TIMEZONE_INFO)
    values: list[datetime] = []
    while current <= end:
        values.append(current)
        current += timedelta(minutes=STEP_MINUTES)
    return values


def seed_legacy_ecowatch_april():
    ensure_energy_table()
    pool = get_connection_pool()
    if pool is None:
        raise RuntimeError("PostgreSQL connection pool is not available.")

    timestamps = _iter_april_2026()
    rows: list[tuple] = []
    for timestamp in timestamps:
        for node_name in LEGACY_SIM_NODES:
            kw = _node_kw(node_name, timestamp)
            kwh = round(kw * (STEP_MINUTES / 60.0), 4)
            rows.append((LEGACY_DEVICE_NAME, f"{node_name}::power", kw, "NORMAL", timestamp.replace(tzinfo=None)))
            rows.append((LEGACY_DEVICE_NAME, f"{node_name}::energy", kwh, "NORMAL", timestamp.replace(tzinfo=None)))

    april_start = datetime(APRIL_YEAR, 4, 1, 0, 0)
    may_start = datetime(APRIL_YEAR, 5, 1, 0, 0)

    with pool.connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO devices (device_id, mqtt_topic, display_name, active, config_status, updated_at)
                VALUES (%s, %s, %s, TRUE, 'ACTIVE', NOW())
                ON CONFLICT (device_id) DO UPDATE
                SET mqtt_topic = EXCLUDED.mqtt_topic,
                    display_name = EXCLUDED.display_name,
                    active = TRUE,
                    config_status = 'ACTIVE',
                    updated_at = NOW()
                """,
                (LEGACY_DEVICE_NAME, LEGACY_TOPIC, LEGACY_DEVICE_NAME),
            )
            for node_name in LEGACY_SIM_NODES:
                cursor.execute(
                    """
                    INSERT INTO tag_configs (
                        device_id, payload_tag, display_name, unit, active, config_status, save_to_db
                    )
                    VALUES (%s, %s, %s, %s, FALSE, 'ACTIVE', FALSE)
                    ON CONFLICT (device_id, payload_tag) DO UPDATE
                    SET display_name = EXCLUDED.display_name,
                        unit = EXCLUDED.unit,
                        active = FALSE,
                        config_status = 'ACTIVE',
                        save_to_db = FALSE
                    """,
                    (LEGACY_DEVICE_NAME, node_name, node_name, "mixed"),
                )
                cursor.execute(
                    """
                    INSERT INTO tag_configs (
                        device_id, payload_tag, display_name, unit, active, config_status, save_to_db
                    )
                    VALUES (%s, %s, %s, %s, FALSE, 'ACTIVE', FALSE)
                    ON CONFLICT (device_id, payload_tag) DO UPDATE
                    SET display_name = EXCLUDED.display_name,
                        unit = EXCLUDED.unit,
                        active = FALSE,
                        config_status = 'ACTIVE',
                        save_to_db = FALSE
                    """,
                    (LEGACY_DEVICE_NAME, f"{node_name}::power", node_name, "kW"),
                )
                cursor.execute(
                    """
                    INSERT INTO tag_configs (
                        device_id, payload_tag, display_name, unit, active, config_status, save_to_db
                    )
                    VALUES (%s, %s, %s, %s, FALSE, 'ACTIVE', FALSE)
                    ON CONFLICT (device_id, payload_tag) DO UPDATE
                    SET display_name = EXCLUDED.display_name,
                        unit = EXCLUDED.unit,
                        active = FALSE,
                        config_status = 'ACTIVE',
                        save_to_db = FALSE
                    """,
                    (LEGACY_DEVICE_NAME, f"{node_name}::energy", node_name, "kWh"),
                )
            cursor.execute(
                """
                DELETE FROM logs
                WHERE device_id = %s
                  AND COALESCE(ts_sensor, ts_saved) >= %s
                  AND COALESCE(ts_sensor, ts_saved) < %s
                """,
                (LEGACY_DEVICE_NAME, april_start, may_start),
            )
            cursor.execute(
                """
                INSERT INTO logs (device_id, payload_tag, value, status, ts_sensor)
                VALUES (%s, %s, %s, %s, %s)
                """,
                rows,
            )
        connection.commit()

    print(
        f"[seed-legacy-ecowatch-april] inserted {len(rows)} rows "
        f"for {len(LEGACY_SIM_NODES)} legacy nodes in April {APRIL_YEAR}"
    )


if __name__ == "__main__":
    try:
        seed_legacy_ecowatch_april()
    finally:
        close_connection_pool()
