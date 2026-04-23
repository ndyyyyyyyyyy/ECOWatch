from __future__ import annotations

from datetime import datetime

from psycopg import OperationalError
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

from core.config import (
    ENERGY_PG_DATABASE,
    ENERGY_PG_ENABLED,
    ENERGY_PG_HOST,
    ENERGY_PG_POOL_MAX_SIZE,
    ENERGY_PG_POOL_MIN_SIZE,
    ENERGY_PG_PASSWORD,
    ENERGY_PG_PORT,
    ENERGY_PG_USER,
    TIMEZONE_INFO,
)


_pool: ConnectionPool | None = None

LEGACY_ECOWATCH_DEVICE = "LEGACY_ECOWATCH"
LEGACY_ECOWATCH_TOPIC = "simulation/legacy-ecowatch"
DEFAULT_LEGACY_AREA_TREE: tuple[tuple[str, str | None, int, int, str | None], ...] = (
    ("MAIN_ELECTRICAL", None, 1, 0, None),
    ("RAC", "MAIN_ELECTRICAL", 2, 0, None),
    ("NR1", "MAIN_ELECTRICAL", 2, 1, None),
    ("NR2", "MAIN_ELECTRICAL", 2, 2, None),
    ("UT_NEW", "MAIN_ELECTRICAL", 2, 3, None),
    ("UTILITY", "MAIN_ELECTRICAL", 2, 4, None),
    ("DB1", "NR1", 3, 0, "DB1"),
    ("DB3", "NR1", 3, 1, None),
    ("CHAMBER_AR1", "DB3", 4, 0, "CHAMBER_AR1"),
    ("H_PRESS_MC1", "DB3", 4, 1, "H_PRESS_MC1"),
    ("V_F_MALE_C_NR1", "DB3", 4, 2, "V_F_MALE_C_NR1"),
    ("V_F_MALE_B_NR1", "DB3", 4, 3, "V_F_MALE_B_NR1"),
    ("V_F_MALE_A_NR1", "DB3", 4, 4, "V_F_MALE_A_NR1"),
    ("LVMDP_RAC", "RAC", 3, 0, "LVMDP_RAC"),
    ("LVMDP_NR2", "NR2", 3, 0, "LVMDP_NR2"),
    ("LVMDP_UT_NEW", "UT_NEW", 3, 0, "LVMDP_UT_NEW"),
    ("LVMDP_UTILITY", "UTILITY", 3, 0, "LVMDP_UTILITY"),
)


def _status_for_metric_value(metric: str, value: float) -> str:
    normalized = str(metric or "").strip().lower()
    if normalized == "power" and value >= 0:
        return "NORMAL"
    if normalized == "energy" and value >= 0:
        return "NORMAL"
    return "NORMAL"


def _derive_tag_name(tag_address: str) -> str:
    normalized = str(tag_address or "").strip()
    if ":" not in normalized:
        return normalized
    return normalized.split(":", 1)[1].strip()


def _normalize_timestamp(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(TIMEZONE_INFO).replace(tzinfo=None)


def _connection_kwargs() -> dict[str, object]:
    return {
        "host": ENERGY_PG_HOST,
        "port": ENERGY_PG_PORT,
        "dbname": ENERGY_PG_DATABASE,
        "user": ENERGY_PG_USER,
        "password": ENERGY_PG_PASSWORD,
    }


def _pool_kwargs() -> dict[str, object]:
    return {
        "conninfo": (
            f"host={ENERGY_PG_HOST} port={ENERGY_PG_PORT} dbname={ENERGY_PG_DATABASE} "
            f"user={ENERGY_PG_USER} password={ENERGY_PG_PASSWORD}"
        ),
        "min_size": max(1, ENERGY_PG_POOL_MIN_SIZE),
        "max_size": max(1, ENERGY_PG_POOL_MAX_SIZE),
        "open": True,
    }


def get_connection_pool() -> ConnectionPool | None:
    global _pool
    if not ENERGY_PG_ENABLED:
        return None
    if _pool is None:
        _pool = ConnectionPool(**_pool_kwargs())
    return _pool


def close_connection_pool():
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


def _seed_default_legacy_area_tree(cursor):
    cursor.execute("SELECT COUNT(*) FROM area_nodes")
    existing_count = int(cursor.fetchone()[0] or 0)
    if existing_count > 0:
        return

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
        (LEGACY_ECOWATCH_DEVICE, LEGACY_ECOWATCH_TOPIC, LEGACY_ECOWATCH_DEVICE),
    )

    measurable_tags = [item[4] for item in DEFAULT_LEGACY_AREA_TREE if item[4]]
    for payload_tag in measurable_tags:
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
            (LEGACY_ECOWATCH_DEVICE, payload_tag, payload_tag, "mixed"),
        )

    node_ids: dict[str, int] = {}
    for name, parent_name, level, sort_order, payload_tag in DEFAULT_LEGACY_AREA_TREE:
        parent_id = node_ids.get(parent_name) if parent_name else None
        cursor.execute(
            """
            INSERT INTO area_nodes (name, level, parent_id, sort_order, updated_at)
            VALUES (%s, %s, %s, %s, NOW())
            RETURNING id
            """,
            (name, level, parent_id, sort_order),
        )
        node_id = int(cursor.fetchone()[0])
        node_ids[name] = node_id

        if payload_tag:
            cursor.execute(
                """
                INSERT INTO area_tag_assignments (area_node_id, device_id, payload_tag, value_mode)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (area_node_id) DO UPDATE
                SET device_id = EXCLUDED.device_id,
                    payload_tag = EXCLUDED.payload_tag,
                    value_mode = EXCLUDED.value_mode
                """,
                (node_id, LEGACY_ECOWATCH_DEVICE, payload_tag, "raw"),
            )

    cursor.execute(
        """
        INSERT INTO area_config_logs (action, target_type, payload, changed_by)
        VALUES (%s, %s, %s, %s)
        """,
        (
            "seed_default_tree",
            "tree",
            Jsonb({"root": "MAIN_ELECTRICAL", "device_id": LEGACY_ECOWATCH_DEVICE}),
            "system",
        ),
    )


def ensure_energy_table():
    if not ENERGY_PG_ENABLED:
        return

    devices_table_query = """
        CREATE TABLE IF NOT EXISTS devices (
            id SERIAL PRIMARY KEY,
            device_id VARCHAR(100) UNIQUE NOT NULL,
            mqtt_topic VARCHAR(255) UNIQUE NOT NULL,
            display_name VARCHAR(150),
            location VARCHAR(150),
            description VARCHAR(200),
            active BOOLEAN NOT NULL DEFAULT TRUE,
            config_status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE'
                CHECK (config_status IN ('DRAFT', 'ACTIVE')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """

    tag_configs_table_query = """
        CREATE TABLE IF NOT EXISTS tag_configs (
            id SERIAL PRIMARY KEY,
            device_id VARCHAR(100) NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
            payload_tag VARCHAR(150) NOT NULL,
            display_name VARCHAR(150),
            unit VARCHAR(30),
            warn_threshold NUMERIC(14,4),
            crit_threshold NUMERIC(14,4),
            scale_factor NUMERIC(10,6) DEFAULT 1,
            active BOOLEAN NOT NULL DEFAULT TRUE,
            config_status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE'
                CHECK (config_status IN ('DRAFT', 'ACTIVE')),
            save_to_db BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (device_id, payload_tag)
        )
    """

    logs_table_query = """
        CREATE TABLE IF NOT EXISTS logs (
            id BIGSERIAL PRIMARY KEY,
            device_id VARCHAR(100) NOT NULL,
            payload_tag VARCHAR(150) NOT NULL,
            value NUMERIC(16,6) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'NORMAL'
                CHECK (status IN ('NORMAL','WARNING','CRITICAL')),
            ts_sensor TIMESTAMPTZ,
            ts_saved TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """

    raw_messages_table_query = """
        CREATE TABLE IF NOT EXISTS raw_messages (
            id BIGSERIAL PRIMARY KEY,
            mqtt_topic VARCHAR(255) NOT NULL,
            payload TEXT,
            reason VARCHAR(200),
            received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """

    mqtt_messages_table_query = """
        CREATE TABLE IF NOT EXISTS mqtt_messages (
            id BIGSERIAL PRIMARY KEY,
            device_id VARCHAR(100) NOT NULL,
            tag_count INTEGER NOT NULL DEFAULT 0,
            saved_count INTEGER NOT NULL DEFAULT 0,
            received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """

    area_nodes_table_query = """
        CREATE TABLE IF NOT EXISTS area_nodes (
            id SERIAL PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            level SMALLINT NOT NULL CHECK (level BETWEEN 1 AND 5),
            parent_id INTEGER REFERENCES area_nodes(id) ON DELETE CASCADE,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """

    area_tag_assignments_table_query = """
        CREATE TABLE IF NOT EXISTS area_tag_assignments (
            id SERIAL PRIMARY KEY,
            area_node_id INTEGER NOT NULL REFERENCES area_nodes(id) ON DELETE CASCADE,
            device_id VARCHAR(100) NOT NULL,
            payload_tag VARCHAR(150) NOT NULL,
            value_mode VARCHAR(10) NOT NULL DEFAULT 'delta' CHECK (value_mode IN ('raw', 'delta')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT area_tag_assignments_area_node_id_unique UNIQUE (area_node_id),
            CONSTRAINT area_tag_assignments_device_payload_unique UNIQUE (device_id, payload_tag),
            CONSTRAINT fk_area_tag_config
                FOREIGN KEY (device_id, payload_tag)
                REFERENCES tag_configs (device_id, payload_tag) ON DELETE CASCADE
        )
    """

    area_config_logs_table_query = """
        CREATE TABLE IF NOT EXISTS area_config_logs (
            id BIGSERIAL PRIMARY KEY,
            action VARCHAR(20) NOT NULL,
            target_type VARCHAR(20) NOT NULL,
            target_id INTEGER,
            payload JSONB,
            changed_by VARCHAR(100) NOT NULL DEFAULT 'system',
            changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """

    tou_config_table_query = """
        CREATE TABLE IF NOT EXISTS tou_config (
            id SERIAL PRIMARY KEY,
            peak_start_hour SMALLINT NOT NULL DEFAULT 17 CHECK (peak_start_hour BETWEEN 0 AND 23),
            peak_end_hour SMALLINT NOT NULL DEFAULT 22 CHECK (peak_end_hour BETWEEN 0 AND 23),
            mid_start_hour SMALLINT NOT NULL DEFAULT 6 CHECK (mid_start_hour BETWEEN 0 AND 23),
            mid_end_hour SMALLINT NOT NULL DEFAULT 17 CHECK (mid_end_hour BETWEEN 0 AND 23),
            tariff_peak NUMERIC(12,4) NOT NULL DEFAULT 1699.5300,
            tariff_mid NUMERIC(12,4) NOT NULL DEFAULT 1444.7000,
            tariff_offpeak NUMERIC(12,4) NOT NULL DEFAULT 1039.0000,
            timezone_offset SMALLINT NOT NULL DEFAULT 7,
            notes TEXT,
            updated_by VARCHAR(100) NOT NULL DEFAULT 'system',
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """

    usage_targets_table_query = """
        CREATE TABLE IF NOT EXISTS usage_targets (
            id SERIAL PRIMARY KEY,
            area_node_id INTEGER REFERENCES area_nodes(id) ON DELETE SET NULL,
            period VARCHAR(10) NOT NULL CHECK (period IN ('daily', 'monthly', 'yearly')),
            target_kwh NUMERIC(15,4) NOT NULL,
            effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
            notes TEXT,
            created_by VARCHAR(100) NOT NULL DEFAULT 'system',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """

    try:
        pool = get_connection_pool()
        if pool is None:
            return
        with pool.connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(devices_table_query)
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_devices_topic ON devices (mqtt_topic)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_devices_active ON devices (active)")
                cursor.execute(tag_configs_table_query)
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_tagcfg_device ON tag_configs (device_id)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_tagcfg_active ON tag_configs (active)")
                cursor.execute(logs_table_query)
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_logs_device_tag ON logs (device_id, payload_tag)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_logs_ts_saved ON logs (ts_saved DESC)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_logs_status ON logs (status)")
                cursor.execute(raw_messages_table_query)
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_raw_topic ON raw_messages (mqtt_topic)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_raw_ts ON raw_messages (received_at DESC)")
                cursor.execute(mqtt_messages_table_query)
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_mqtt_msg_device ON mqtt_messages (device_id)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_mqtt_msg_ts ON mqtt_messages (received_at DESC)")
                cursor.execute(area_nodes_table_query)
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_area_nodes_parent ON area_nodes(parent_id)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_area_nodes_level ON area_nodes(level)")
                cursor.execute(area_tag_assignments_table_query)
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_area_tag_node ON area_tag_assignments(area_node_id)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_area_tag_dev ON area_tag_assignments(device_id, payload_tag)")
                cursor.execute(area_config_logs_table_query)
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_area_config_logs_at ON area_config_logs(changed_at DESC)")
                cursor.execute(tou_config_table_query)
                cursor.execute(
                    """
                    INSERT INTO tou_config (notes, updated_by)
                    SELECT %s, %s
                    WHERE NOT EXISTS (SELECT 1 FROM tou_config)
                    """,
                    ("Default PLN Indonesia tariff (Golongan I-3 TDL 2024)", "system"),
                )
                cursor.execute(usage_targets_table_query)
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_usage_targets_node ON usage_targets(area_node_id)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_usage_targets_period ON usage_targets(period)")
                _seed_default_legacy_area_tree(cursor)
            connection.commit()
    except OperationalError as error:
        print(f"[energy-db] skipped table initialization: {error}")


def upsert_ecowatch_device(
    device_id: str,
    mqtt_topic: str,
    display_name: str | None = None,
):
    if not ENERGY_PG_ENABLED:
        return

    normalized_device_id = str(device_id or "").strip()
    normalized_topic = str(mqtt_topic or "").strip()
    if not normalized_device_id or not normalized_topic:
        return

    query = """
        INSERT INTO devices (device_id, mqtt_topic, display_name, active, config_status, updated_at)
        VALUES (%s, %s, %s, TRUE, 'ACTIVE', NOW())
        ON CONFLICT (device_id) DO UPDATE
        SET mqtt_topic = EXCLUDED.mqtt_topic,
            display_name = COALESCE(EXCLUDED.display_name, devices.display_name),
            active = TRUE,
            config_status = 'ACTIVE',
            updated_at = NOW()
    """

    try:
        pool = get_connection_pool()
        if pool is None:
            return
        with pool.connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (normalized_device_id, normalized_topic, display_name or normalized_device_id))
            connection.commit()
    except OperationalError as error:
        print(f"[energy-db] device upsert skipped: {error}")


def upsert_ecowatch_tag_config(
    device_id: str,
    payload_tag: str,
    display_name: str | None = None,
    unit: str | None = None,
):
    if not ENERGY_PG_ENABLED:
        return

    normalized_device_id = str(device_id or "").strip()
    normalized_payload_tag = str(payload_tag or "").strip()
    if not normalized_device_id or not normalized_payload_tag:
        return

    query = """
        INSERT INTO tag_configs (
            device_id, payload_tag, display_name, unit, active, config_status, save_to_db
        )
        VALUES (%s, %s, %s, %s, TRUE, 'ACTIVE', TRUE)
        ON CONFLICT (device_id, payload_tag) DO UPDATE
        SET display_name = COALESCE(EXCLUDED.display_name, tag_configs.display_name),
            unit = COALESCE(EXCLUDED.unit, tag_configs.unit),
            active = TRUE,
            config_status = 'ACTIVE',
            save_to_db = TRUE
    """

    try:
        pool = get_connection_pool()
        if pool is None:
            return
        with pool.connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    query,
                    (
                        normalized_device_id,
                        normalized_payload_tag,
                        display_name or _derive_tag_name(normalized_payload_tag),
                        unit,
                    ),
                )
            connection.commit()
    except OperationalError as error:
        print(f"[energy-db] tag config upsert skipped: {error}")


def insert_ecowatch_log_reading(
    timestamp: datetime,
    device_id: str,
    payload_tag: str,
    value: float,
    metric: str,
):
    if not ENERGY_PG_ENABLED:
        return

    normalized_timestamp = _normalize_timestamp(timestamp)
    normalized_device_id = str(device_id or "").strip()
    normalized_payload_tag = str(payload_tag or "").strip()
    if not normalized_device_id or not normalized_payload_tag:
        return

    query = """
        INSERT INTO logs (device_id, payload_tag, value, status, ts_sensor)
        VALUES (%s, %s, %s, %s, %s)
    """

    try:
        pool = get_connection_pool()
        if pool is None:
            return
        with pool.connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    query,
                    (
                        normalized_device_id,
                        normalized_payload_tag,
                        float(value),
                        _status_for_metric_value(metric, float(value)),
                        normalized_timestamp,
                    ),
                )
            connection.commit()
    except OperationalError as error:
        print(f"[energy-db] logs insert skipped: {error}")


def insert_ecowatch_mqtt_message(device_id: str, tag_count: int, saved_count: int):
    if not ENERGY_PG_ENABLED:
        return

    normalized_device_id = str(device_id or "").strip()
    if not normalized_device_id:
        return

    query = """
        INSERT INTO mqtt_messages (device_id, tag_count, saved_count)
        VALUES (%s, %s, %s)
    """

    try:
        pool = get_connection_pool()
        if pool is None:
            return
        with pool.connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (normalized_device_id, int(tag_count), int(saved_count)))
            connection.commit()
    except OperationalError as error:
        print(f"[energy-db] mqtt_messages insert skipped: {error}")


def fetch_ecowatch_log_rows(start: datetime, end: datetime, metric: str) -> list[dict[str, object]]:
    if not ENERGY_PG_ENABLED:
        return []

    normalized_metric = str(metric or "").strip().lower()
    expected_tag_names = ("kw", "power", "p") if normalized_metric == "power" else ("kwh", "energy")
    legacy_suffix = "::power" if normalized_metric == "power" else "::energy"
    normalized_start = _normalize_timestamp(start)
    normalized_end = _normalize_timestamp(end)
    query = """
        SELECT
            l.ts_sensor,
            l.device_id,
            COALESCE(NULLIF(tc.display_name, ''), split_part(l.payload_tag, ':', 2), l.payload_tag) AS tag_name,
            l.payload_tag,
            d.mqtt_topic,
            l.value
          FROM logs l
          LEFT JOIN tag_configs tc ON tc.device_id = l.device_id AND tc.payload_tag = l.payload_tag
          LEFT JOIN devices d ON d.device_id = l.device_id
          WHERE COALESCE(l.ts_sensor, l.ts_saved) BETWEEN %s AND %s
            AND (
                LOWER(COALESCE(NULLIF(tc.display_name, ''), split_part(l.payload_tag, ':', 2), l.payload_tag)) = ANY(%s)
                OR LOWER(l.payload_tag) LIKE %s
            )
          ORDER BY COALESCE(l.ts_sensor, l.ts_saved) ASC
    """

    try:
        pool = get_connection_pool()
        if pool is None:
            return []
        with pool.connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    query,
                    (
                        normalized_start,
                        normalized_end,
                        list(expected_tag_names),
                        f"%{legacy_suffix}",
                    ),
                )
                rows = cursor.fetchall()
    except OperationalError as error:
        print(f"[energy-db] ecowatch logs select skipped: {error}")
        return []

    return [
        {
            "timestamp": row[0].replace(tzinfo=TIMEZONE_INFO) if row[0] is not None else None,
            "device_name": row[1] or "",
            "tag_name": row[2] or "",
            "tag_address": row[3] or "",
            "topic": row[4] or "",
            "metric": normalized_metric,
            "value": float(row[5]) if row[5] is not None else 0.0,
        }
        for row in rows
    ]


def fetch_ecowatch_area_nodes() -> list[dict[str, object]]:
    if not ENERGY_PG_ENABLED:
        return []

    query = """
        SELECT
            n.id,
            n.name,
            n.level,
            n.parent_id,
            n.sort_order,
            a.device_id,
            a.payload_tag,
            a.value_mode,
            tc.display_name AS tag_display_name,
            tc.unit,
            d.display_name AS device_display_name
        FROM area_nodes n
        LEFT JOIN area_tag_assignments a ON a.area_node_id = n.id
        LEFT JOIN tag_configs tc ON tc.device_id = a.device_id AND tc.payload_tag = a.payload_tag
        LEFT JOIN devices d ON d.device_id = a.device_id
        ORDER BY n.level, n.parent_id NULLS FIRST, n.sort_order, n.id
    """

    try:
        pool = get_connection_pool()
        if pool is None:
            return []
        with pool.connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query)
                rows = cursor.fetchall()
    except OperationalError as error:
        print(f"[energy-db] area_nodes select skipped: {error}")
        return []

    return [
        {
            "id": row[0],
            "name": row[1] or "",
            "level": int(row[2]) if row[2] is not None else None,
            "parent_id": row[3],
            "sort_order": int(row[4]) if row[4] is not None else 0,
            "device_id": row[5] or "",
            "payload_tag": row[6] or "",
            "value_mode": row[7] or "delta",
            "tag_display_name": row[8] or "",
            "unit": row[9] or "",
            "device_display_name": row[10] or "",
        }
        for row in rows
    ]


def fetch_ecowatch_area_tree() -> list[dict[str, object]]:
    rows = fetch_ecowatch_area_nodes()
    if not rows:
        return []

    node_map: dict[int, dict[str, object]] = {}
    children_by_parent: dict[int | None, list[int]] = {}
    for row in rows:
        node_id = int(row["id"])
        node_map.setdefault(
            node_id,
            {
                "id": node_id,
                "name": row["name"],
                "level": row["level"],
                "parent_id": row["parent_id"],
                "sort_order": row["sort_order"],
                "device_id": row.get("device_id") or None,
                "payload_tag": row.get("payload_tag") or None,
                "value_mode": row.get("value_mode") or "delta",
                "tag_display_name": row.get("tag_display_name") or None,
                "unit": row.get("unit") or None,
            },
        )
        children_by_parent.setdefault(row["parent_id"], [])
        if node_id not in children_by_parent[row["parent_id"]]:
            children_by_parent[row["parent_id"]].append(node_id)

    def _build(parent_id: int | None) -> list[dict[str, object]]:
        result: list[dict[str, object]] = []
        child_ids = sorted(
            children_by_parent.get(parent_id, []),
            key=lambda item: (int(node_map[item]["sort_order"]), str(node_map[item]["name"])),
        )
        for node_id in child_ids:
            node = node_map[node_id]
            result.append(
                {
                    "title": node["name"],
                    "key": f"area:{node_id}",
                    "area_id": node_id,
                    "level": node["level"],
                    "device_id": node["device_id"],
                    "payload_tag": node["payload_tag"],
                    "value_mode": node["value_mode"],
                    "tag_display_name": node["tag_display_name"],
                    "unit": node["unit"],
                    "children": _build(node_id),
                }
            )
        return result

    return _build(None)


def create_area_node(
    name: str,
    level: int,
    parent_id: int | None,
    sort_order: int = 0,
    device_id: str | None = None,
    payload_tag: str | None = None,
    value_mode: str = "delta",
    changed_by: str = "system",
) -> int:
    pool = get_connection_pool()
    if pool is None:
        raise RuntimeError("PostgreSQL is not available.")

    try:
        with pool.connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO area_nodes (name, level, parent_id, sort_order, updated_at)
                    VALUES (%s, %s, %s, %s, NOW())
                    RETURNING id
                    """,
                    (name, level, parent_id, sort_order),
                )
                node_id = int(cursor.fetchone()[0])
                cursor.execute(
                    """
                    INSERT INTO area_config_logs (action, target_type, target_id, payload, changed_by)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    ("create_node", "node", node_id, Jsonb({"name": name, "level": level, "parent_id": parent_id}), changed_by),
                )
                if device_id and payload_tag:
                    cursor.execute(
                        """
                        INSERT INTO area_tag_assignments (area_node_id, device_id, payload_tag, value_mode)
                        VALUES (%s, %s, %s, %s)
                        """,
                        (node_id, device_id, payload_tag, value_mode),
                    )
                connection.commit()
                return node_id
    except OperationalError as error:
        raise RuntimeError(f"failed to create area node: {error}") from error


def update_area_node(node_id: int, data: dict[str, object], changed_by: str = "system") -> bool:
    pool = get_connection_pool()
    if pool is None:
        return False

    allowed_fields = ("name", "level", "parent_id", "sort_order")
    fields = ["updated_at = NOW()"]
    values: list[object] = []
    for field in allowed_fields:
        if field in data:
            fields.append(f"{field} = %s")
            values.append(data[field])
    values.append(node_id)

    try:
        with pool.connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(f"UPDATE area_nodes SET {', '.join(fields)} WHERE id = %s", values)
                if cursor.rowcount == 0:
                    connection.rollback()
                    return False
                cursor.execute(
                    """
                    INSERT INTO area_config_logs (action, target_type, target_id, payload, changed_by)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    ("update_node", "node", node_id, Jsonb(data), changed_by),
                )
            connection.commit()
            return True
    except OperationalError:
        return False


def delete_area_node(node_id: int, changed_by: str = "system") -> bool:
    pool = get_connection_pool()
    if pool is None:
        return False
    try:
        with pool.connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO area_config_logs (action, target_type, target_id, payload, changed_by)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    ("delete_node", "node", node_id, Jsonb({}), changed_by),
                )
                cursor.execute("DELETE FROM area_nodes WHERE id = %s", (node_id,))
                deleted = cursor.rowcount > 0
            connection.commit()
            return deleted
    except OperationalError:
        return False


def fetch_area_node(node_id: int) -> dict[str, object] | None:
    rows = [row for row in fetch_ecowatch_area_nodes() if int(row["id"]) == int(node_id)]
    return rows[0] if rows else None


def fetch_assigned_tags() -> set[tuple[str, str]]:
    pool = get_connection_pool()
    if pool is None:
        return set()
    try:
        with pool.connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT device_id, payload_tag FROM area_tag_assignments")
                rows = cursor.fetchall()
    except OperationalError:
        return set()
    return {(str(row[0]), str(row[1])) for row in rows}


def set_area_node_tag(node_id: int, device_id: str, payload_tag: str, value_mode: str = "delta", changed_by: str = "system") -> bool:
    pool = get_connection_pool()
    if pool is None:
        return False
    try:
        with pool.connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO area_tag_assignments (area_node_id, device_id, payload_tag, value_mode)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (area_node_id) DO UPDATE
                    SET device_id = EXCLUDED.device_id,
                        payload_tag = EXCLUDED.payload_tag,
                        value_mode = EXCLUDED.value_mode
                    """,
                    (node_id, device_id, payload_tag, value_mode),
                )
                cursor.execute(
                    """
                    INSERT INTO area_config_logs (action, target_type, target_id, payload, changed_by)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (
                        "assign_tag",
                        "assignment",
                        node_id,
                        Jsonb({"device_id": device_id, "payload_tag": payload_tag, "value_mode": value_mode}),
                        changed_by,
                    ),
                )
            connection.commit()
            return True
    except OperationalError:
        return False


def clear_area_node_tag(node_id: int, changed_by: str = "system") -> bool:
    pool = get_connection_pool()
    if pool is None:
        return False
    try:
        with pool.connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute("DELETE FROM area_tag_assignments WHERE area_node_id = %s", (node_id,))
                deleted = cursor.rowcount > 0
                if deleted:
                    cursor.execute(
                        """
                        INSERT INTO area_config_logs (action, target_type, target_id, payload, changed_by)
                        VALUES (%s, %s, %s, %s, %s)
                        """,
                        ("unassign_tag", "assignment", node_id, Jsonb({}), changed_by),
                    )
            connection.commit()
            return deleted
    except OperationalError:
        return False


def update_area_assignment_mode(node_id: int, value_mode: str, changed_by: str = "system") -> bool:
    pool = get_connection_pool()
    if pool is None:
        return False
    try:
        with pool.connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    "UPDATE area_tag_assignments SET value_mode = %s WHERE area_node_id = %s",
                    (value_mode, node_id),
                )
                updated = cursor.rowcount > 0
                if updated:
                    cursor.execute(
                        """
                        INSERT INTO area_config_logs (action, target_type, target_id, payload, changed_by)
                        VALUES (%s, %s, %s, %s, %s)
                        """,
                        ("update_assignment", "assignment", node_id, Jsonb({"value_mode": value_mode}), changed_by),
                    )
            connection.commit()
            return updated
    except OperationalError:
        return False


def fetch_available_ecowatch_tags() -> list[dict[str, object]]:
    assigned = fetch_assigned_tags()
    query = """
        SELECT device_id, payload_tag, display_name, unit, active, config_status, save_to_db
        FROM tag_configs
        WHERE active = TRUE
          AND config_status = 'ACTIVE'
        ORDER BY device_id, payload_tag
    """
    pool = get_connection_pool()
    if pool is None:
        return []
    try:
        with pool.connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query)
                rows = cursor.fetchall()
    except OperationalError:
        return []
    data = []
    for row in rows:
        pair = (str(row[0]), str(row[1]))
        if pair in assigned:
            continue
        data.append(
            {
                "device_id": row[0],
                "payload_tag": row[1],
                "display_name": row[2] or row[1],
                "unit": row[3] or "",
                "active": bool(row[4]),
                "config_status": row[5] or "ACTIVE",
                "save_to_db": bool(row[6]),
            }
        )
    return data


def fetch_tou_config() -> dict[str, object] | None:
    pool = get_connection_pool()
    if pool is None:
        return None
    try:
        with pool.connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, peak_start_hour, peak_end_hour, mid_start_hour, mid_end_hour,
                           tariff_peak, tariff_mid, tariff_offpeak, timezone_offset,
                           notes, updated_by, updated_at
                    FROM tou_config
                    ORDER BY updated_at DESC
                    LIMIT 1
                    """
                )
                row = cursor.fetchone()
    except OperationalError:
        return None
    if not row:
        return None
    return {
        "id": row[0],
        "peak_start_hour": int(row[1]),
        "peak_end_hour": int(row[2]),
        "mid_start_hour": int(row[3]),
        "mid_end_hour": int(row[4]),
        "tariff_peak": float(row[5]),
        "tariff_mid": float(row[6]),
        "tariff_offpeak": float(row[7]),
        "timezone_offset": int(row[8]),
        "notes": row[9] or "",
        "updated_by": row[10] or "",
        "updated_at": row[11].isoformat() if row[11] else None,
    }


def upsert_tou_config(data: dict[str, object], updated_by: str = "system") -> bool:
    pool = get_connection_pool()
    if pool is None:
        return False
    try:
        with pool.connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT id FROM tou_config ORDER BY updated_at DESC LIMIT 1")
                row = cursor.fetchone()
                values = (
                    data["peak_start_hour"],
                    data["peak_end_hour"],
                    data["mid_start_hour"],
                    data["mid_end_hour"],
                    data["tariff_peak"],
                    data["tariff_mid"],
                    data["tariff_offpeak"],
                    data["timezone_offset"],
                    data.get("notes"),
                    updated_by,
                )
                if row:
                    cursor.execute(
                        """
                        UPDATE tou_config SET
                            peak_start_hour = %s,
                            peak_end_hour = %s,
                            mid_start_hour = %s,
                            mid_end_hour = %s,
                            tariff_peak = %s,
                            tariff_mid = %s,
                            tariff_offpeak = %s,
                            timezone_offset = %s,
                            notes = %s,
                            updated_by = %s,
                            updated_at = NOW()
                        WHERE id = %s
                        """,
                        (*values, row[0]),
                    )
                else:
                    cursor.execute(
                        """
                        INSERT INTO tou_config (
                            peak_start_hour, peak_end_hour, mid_start_hour, mid_end_hour,
                            tariff_peak, tariff_mid, tariff_offpeak, timezone_offset,
                            notes, updated_by
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        values,
                    )
            connection.commit()
            return True
    except OperationalError:
        return False


def fetch_usage_targets(node_id: int | None = None) -> list[dict[str, object]]:
    query = """
        SELECT t.id, t.area_node_id, n.name, t.period, t.target_kwh, t.effective_from, t.notes,
               t.created_by, t.created_at, t.updated_at
        FROM usage_targets t
        LEFT JOIN area_nodes n ON n.id = t.area_node_id
    """
    params: list[object] = []
    if node_id is not None:
        query += " WHERE t.area_node_id = %s"
        params.append(node_id)
    query += " ORDER BY t.area_node_id NULLS FIRST, t.period, t.effective_from DESC"

    pool = get_connection_pool()
    if pool is None:
        return []
    try:
        with pool.connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, params)
                rows = cursor.fetchall()
    except OperationalError:
        return []
    return [
        {
            "id": row[0],
            "area_node_id": row[1],
            "area_name": row[2] or "",
            "period": row[3] or "",
            "target_kwh": float(row[4]) if row[4] is not None else 0.0,
            "effective_from": row[5].isoformat() if row[5] else None,
            "notes": row[6] or "",
            "created_by": row[7] or "",
            "created_at": row[8].isoformat() if row[8] else None,
            "updated_at": row[9].isoformat() if row[9] else None,
        }
        for row in rows
    ]


def create_usage_target(data: dict[str, object]) -> int:
    pool = get_connection_pool()
    if pool is None:
        raise RuntimeError("PostgreSQL is not available.")
    try:
        with pool.connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO usage_targets (
                        area_node_id, period, target_kwh, effective_from, notes, created_by
                    ) VALUES (%s, %s, %s, COALESCE(%s, CURRENT_DATE), %s, %s)
                    RETURNING id
                    """,
                    (
                        data.get("area_node_id"),
                        data["period"],
                        data["target_kwh"],
                        data.get("effective_from"),
                        data.get("notes"),
                        data.get("created_by", "system"),
                    ),
                )
                target_id = int(cursor.fetchone()[0])
            connection.commit()
            return target_id
    except OperationalError as error:
        raise RuntimeError(f"failed to create usage target: {error}") from error


def update_usage_target(target_id: int, data: dict[str, object]) -> bool:
    pool = get_connection_pool()
    if pool is None:
        return False
    fields = ["updated_at = NOW()"]
    values: list[object] = []
    for field in ("area_node_id", "period", "target_kwh", "effective_from", "notes"):
        if field in data:
            fields.append(f"{field} = %s")
            values.append(data[field])
    values.append(target_id)
    try:
        with pool.connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(f"UPDATE usage_targets SET {', '.join(fields)} WHERE id = %s", values)
                updated = cursor.rowcount > 0
            connection.commit()
            return updated
    except OperationalError:
        return False


def delete_usage_target(target_id: int) -> bool:
    pool = get_connection_pool()
    if pool is None:
        return False
    try:
        with pool.connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute("DELETE FROM usage_targets WHERE id = %s", (target_id,))
                deleted = cursor.rowcount > 0
            connection.commit()
            return deleted
    except OperationalError:
        return False
