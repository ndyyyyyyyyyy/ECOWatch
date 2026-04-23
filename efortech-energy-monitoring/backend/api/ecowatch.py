from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta

from fastapi import FastAPI, Query

from core.config import TIMEZONE_INFO
from project.store import project_store
from storage.energy_db import (
    fetch_ecowatch_area_nodes,
    fetch_ecowatch_log_rows,
)

LEGACY_ECOWATCH_DEVICE = "LEGACY_ECOWATCH"
LEGACY_MEASURABLE_TAGS = {
    "DB1",
    "DB3",
    "V_F_MALE_C_NR1",
    "V_F_MALE_B_NR1",
    "V_F_MALE_A_NR1",
    "CHAMBER_AR1",
    "H_PRESS_MC1",
    "LVMDP_RAC",
    "LVMDP_NR2",
    "LVMDP_UT_NEW",
    "LVMDP_UTILITY",
}

DEFAULT_ECOWATCH_TREE: dict[str, dict[str, object]] = {
    "MAIN_ELECTRICAL": {"parent": None, "children": ("RAC", "NR1", "NR2", "UT_NEW", "UTILITY")},
    "RAC": {"parent": "MAIN_ELECTRICAL", "children": ("LVMDP_RAC",)},
    "NR1": {"parent": "MAIN_ELECTRICAL", "children": ("DB1", "DB3")},
    "NR2": {"parent": "MAIN_ELECTRICAL", "children": ("LVMDP_NR2",)},
    "UT_NEW": {"parent": "MAIN_ELECTRICAL", "children": ("LVMDP_UT_NEW",)},
    "UTILITY": {"parent": "MAIN_ELECTRICAL", "children": ("LVMDP_UTILITY",)},
    "DB1": {"parent": "NR1", "children": ()},
    "DB3": {"parent": "NR1", "children": ("CHAMBER_AR1", "H_PRESS_MC1", "V_F_MALE_C_NR1", "V_F_MALE_B_NR1", "V_F_MALE_A_NR1")},
    "CHAMBER_AR1": {"parent": "DB3", "children": ()},
    "H_PRESS_MC1": {"parent": "DB3", "children": ()},
    "V_F_MALE_C_NR1": {"parent": "DB3", "children": ()},
    "V_F_MALE_B_NR1": {"parent": "DB3", "children": ()},
    "V_F_MALE_A_NR1": {"parent": "DB3", "children": ()},
    "LVMDP_RAC": {"parent": "RAC", "children": ()},
    "LVMDP_NR2": {"parent": "NR2", "children": ()},
    "LVMDP_UT_NEW": {"parent": "UT_NEW", "children": ()},
    "LVMDP_UTILITY": {"parent": "UTILITY", "children": ()},
}

DEFAULT_ROOT_AREAS = ("RAC", "NR1", "NR2", "UT_NEW", "UTILITY")
REAL_ROOT_NAME = "Office"
REAL_ENERGY_TAG_NAMES = {"kwh", "energy"}
REAL_POWER_TAG_NAMES = {"kw", "power", "p"}


@dataclass(frozen=True)
class EnergyNode:
    key: str
    name: str
    parent_name: str | None
    children_names: tuple[str, ...]
    device_name: str | None = None
    tag_names: tuple[str, ...] = ()
    uses_children_for_rollup: bool = False


def _select_project_tag_names(device: dict[str, object], metric: str) -> tuple[str, ...]:
    if metric != "power":
        for tag in device.get("tags", []):
            if str(tag.get("logData", "")).strip().lower() != "yes":
                continue

            tag_name = str(tag.get("name", "")).strip()
            if tag_name.lower() in REAL_ENERGY_TAG_NAMES:
                return (tag_name,)
        return ()

    exact_matches: list[str] = []
    phase_matches: list[str] = []

    for tag in device.get("tags", []):
        if str(tag.get("logData", "")).strip().lower() != "yes":
            continue

        tag_name = str(tag.get("name", "")).strip()
        normalized = tag_name.lower()
        if normalized in REAL_POWER_TAG_NAMES:
            exact_matches.append(tag_name)
            continue
        if normalized.startswith("kw " ) or normalized.startswith("kw_"):
            phase_matches.append(tag_name)

    if exact_matches:
        preferred_order = {"kw": 0, "power": 1, "p": 2}
        exact_matches.sort(key=lambda name: preferred_order.get(name.lower(), 99))
        return (exact_matches[0],)

    if phase_matches:
        phase_matches.sort()
        return tuple(phase_matches)

    return ()


def _build_project_energy_nodes(metric: str) -> dict[str, EnergyNode]:
    nodes: dict[str, EnergyNode] = {}
    child_names: list[str] = []

    try:
        devices = project_store.get_devices()
    except Exception:
        return nodes

    for device in devices:
        if not bool(device.get("deployed", True)):
            continue

        device_name = str(device.get("name", "")).strip()
        if not device_name:
            continue

        selected_tag_names = _select_project_tag_names(device, metric)
        if not selected_tag_names:
            continue

        child_names.append(device_name)
        nodes[device_name] = EnergyNode(
            key=device_name,
            name=device_name,
            parent_name=REAL_ROOT_NAME,
            children_names=(),
            device_name=device_name,
            tag_names=selected_tag_names,
            uses_children_for_rollup=False,
        )

    if child_names:
        nodes[REAL_ROOT_NAME] = EnergyNode(
            key=REAL_ROOT_NAME,
            name=REAL_ROOT_NAME,
            parent_name=None,
            children_names=tuple(child_names),
            uses_children_for_rollup=True,
        )

    return nodes


def _metric_matches_tag(metric: str, tag_name: str, payload_tag: str = "") -> bool:
    normalized_tag = str(tag_name or "").strip().lower()
    normalized_payload = str(payload_tag or "").strip().lower()
    if metric == "power":
        return normalized_tag in REAL_POWER_TAG_NAMES or normalized_payload.endswith(":kw")
    return normalized_tag in REAL_ENERGY_TAG_NAMES or normalized_payload.endswith(":kwh")


def _build_db_energy_nodes(metric: str) -> dict[str, EnergyNode]:
    rows = fetch_ecowatch_area_nodes()
    if not rows:
        return {}

    node_meta: dict[int, dict[str, object]] = {}
    child_ids_by_parent: dict[int | None, list[int]] = defaultdict(list)

    for row in rows:
        node_id = int(row["id"])
        parent_id = row["parent_id"]
        name = str(row.get("name", "")).strip()
        existing = node_meta.setdefault(
            node_id,
            {
                "id": node_id,
                "name": name,
                "parent_id": parent_id,
                "level": row.get("level"),
                "sort_order": int(row.get("sort_order") or 0),
                "device_name": None,
                "tag_names": (),
            },
        )
        if row.get("payload_tag"):
            tag_name = str(row.get("tag_display_name") or "").strip()
            payload_tag = str(row.get("payload_tag") or "").strip()
            row_device_id = str(row.get("device_id") or "").strip()
            derived_tag_name = tag_name or (payload_tag.split(":", 1)[1].strip() if ":" in payload_tag else payload_tag)
            if row_device_id == LEGACY_ECOWATCH_DEVICE or _metric_matches_tag(metric, derived_tag_name, payload_tag):
                existing["device_name"] = str(row.get("device_display_name") or row.get("device_id") or "").strip()
                existing["tag_names"] = (payload_tag if row_device_id == LEGACY_ECOWATCH_DEVICE else derived_tag_name,)
        if node_id not in child_ids_by_parent[parent_id]:
            child_ids_by_parent[parent_id].append(node_id)

    id_to_name = {node_id: str(meta["name"]) for node_id, meta in node_meta.items()}
    nodes: dict[str, EnergyNode] = {}
    for node_id, meta in sorted(node_meta.items(), key=lambda item: (int(item[1]["sort_order"]), str(item[1]["name"]))):
        parent_name = id_to_name.get(meta["parent_id"]) if meta["parent_id"] is not None else None
        children = [
            id_to_name[child_id]
            for child_id in sorted(
                child_ids_by_parent.get(node_id, []),
                key=lambda child_id: (int(node_meta[child_id]["sort_order"]), str(node_meta[child_id]["name"])),
            )
            if child_id in id_to_name
        ]
        device_name = str(meta.get("device_name") or "").strip() or None
        tag_names = tuple(meta.get("tag_names") or ())
        nodes[str(meta["name"])] = EnergyNode(
            key=str(meta["name"]),
            name=str(meta["name"]),
            parent_name=parent_name,
            children_names=tuple(children),
            device_name=device_name,
            tag_names=tag_names,
            uses_children_for_rollup=(not device_name and bool(children)),
        )

    return nodes


def _build_energy_nodes(metric: str = "energy") -> dict[str, EnergyNode]:
    nodes: dict[str, EnergyNode] = {}
    db_nodes = _build_db_energy_nodes(metric)
    if db_nodes:
        nodes.update(db_nodes)
    else:
        for name, config in DEFAULT_ECOWATCH_TREE.items():
            is_legacy_measurable = metric != "power" and name in LEGACY_MEASURABLE_TAGS
            nodes[name] = EnergyNode(
                key=name,
                name=name,
                parent_name=config["parent"],
                children_names=tuple(config["children"]),
                device_name=LEGACY_ECOWATCH_DEVICE if is_legacy_measurable else None,
                tag_names=(name,) if is_legacy_measurable else (),
                uses_children_for_rollup=not is_legacy_measurable and bool(config["children"]),
            )

    for key, node in _build_project_energy_nodes(metric).items():
        if key not in nodes:
            nodes[key] = node
    return nodes


def _bucket_config(interval: str) -> tuple[str, str]:
    normalized = str(interval or "Hour").strip().lower()
    if normalized == "year":
        return "year", "%Y"
    if normalized == "month":
        return "month", "%Y-%m"
    if normalized == "day":
        return "day", "%Y-%m-%d"
    if normalized == "minute":
        return "minute", "%Y-%m-%d %H:%M"
    return "hour", "%Y-%m-%d %H:00"


def _truncate_datetime(value: datetime, interval: str) -> datetime:
    if interval == "year":
        return value.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    if interval == "month":
        return value.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if interval == "day":
        return value.replace(hour=0, minute=0, second=0, microsecond=0)
    if interval == "minute":
        return value.replace(second=0, microsecond=0)
    return value.replace(minute=0, second=0, microsecond=0)


def _advance_bucket(value: datetime, interval: str) -> datetime:
    if interval == "year":
        return value.replace(year=value.year + 1)
    if interval == "month":
        if value.month == 12:
            return value.replace(year=value.year + 1, month=1)
        return value.replace(month=value.month + 1)
    if interval == "day":
        return value + timedelta(days=1)
    if interval == "minute":
        return value + timedelta(minutes=1)
    return value + timedelta(hours=1)


def _generate_buckets(start: datetime, end: datetime, interval: str) -> list[datetime]:
    buckets: list[datetime] = []
    current = _truncate_datetime(start, interval)
    last = _truncate_datetime(end, interval)

    while current <= last:
        buckets.append(current)
        current = _advance_bucket(current, interval)

    return buckets


def _collect_relevant_pairs(node: EnergyNode, nodes: dict[str, EnergyNode], result: set[tuple[str, str]]):
    if node.device_name and node.tag_names:
        for tag_name in node.tag_names:
            result.add((node.device_name, tag_name))

    for child_name in node.children_names:
        child = nodes.get(child_name)
        if child is not None:
            _collect_relevant_pairs(child, nodes, result)


def _collect_descendant_nodes(node: EnergyNode, nodes: dict[str, EnergyNode], result: list[EnergyNode], seen: set[str]):
    if node.key in seen:
        return
    result.append(node)
    seen.add(node.key)

    for child_name in node.children_names:
        child = nodes.get(child_name)
        if child is not None:
            _collect_descendant_nodes(child, nodes, result, seen)


def _resolve_bucket_total(
    node: EnergyNode,
    bucket: datetime,
    nodes: dict[str, EnergyNode],
    bucket_values: dict[tuple[str, datetime], float],
) -> float:
    total = 0.0
    if node.device_name and node.tag_names:
        for tag_name in node.tag_names:
            total += bucket_values.get((f"{node.device_name}:{tag_name}", bucket), 0.0)

    for child_name in node.children_names:
        child = nodes.get(child_name)
        if child is not None:
            total += _resolve_bucket_total(child, bucket, nodes, bucket_values)
    return total


def _is_project_device(device_name: str) -> bool:
    return bool(str(device_name).strip()) and str(device_name).strip() != LEGACY_ECOWATCH_DEVICE


def _parse_date_bound(value: str | None, is_end: bool) -> datetime:
    if not value:
        now = datetime.now(TIMEZONE_INFO)
        return now.replace(hour=23, minute=59, second=59, microsecond=999999) if is_end else now.replace(
            hour=0, minute=0, second=0, microsecond=0
        )

    text = value.strip()
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        parsed = datetime.fromisoformat(f"{text} 00:00:00")

    if "T" in text or " " in text:
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=TIMEZONE_INFO)
        return parsed.astimezone(TIMEZONE_INFO)
    if is_end:
        return parsed.replace(hour=23, minute=59, second=59, microsecond=999999, tzinfo=TIMEZONE_INFO)
    return parsed.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=TIMEZONE_INFO)


def register_energy_routes(app: FastAPI):
    @app.get("/energy")
    async def energy(
        start: str | None = Query(default=None),
        end: str | None = Query(default=None),
        interval: str = Query(default="Hour"),
        areas: str | None = Query(default=None),
        metric: str = Query(default="energy"),
        include_descendants: bool = Query(default=False),
    ):
        metric_key = str(metric or "energy").strip().lower()
        if metric_key not in {"energy", "power"}:
            metric_key = "energy"

        value_field = "value_kw" if metric_key == "power" else "value_kwh"
        interval_key, time_format = _bucket_config(interval)
        start_dt = _parse_date_bound(start, is_end=False)
        end_dt = _parse_date_bound(end, is_end=True)
        nodes = _build_energy_nodes(metric_key)
        requested_names = [item.strip() for item in str(areas or "").split(",") if item.strip()]

        if requested_names:
            selected_nodes: list[EnergyNode] = []
            seen_keys: set[str] = set()
            for name in requested_names:
                node = nodes.get(name)
                if node is None:
                    continue

                if include_descendants:
                    _collect_descendant_nodes(node, nodes, selected_nodes, seen_keys)
                    continue

                if node.key not in seen_keys:
                    selected_nodes.append(node)
                    seen_keys.add(node.key)
        else:
            root_nodes = [node for node in nodes.values() if node.parent_name is None]
            if root_nodes and metric_key == "energy" and interval_key == "day":
                selected_nodes = []
                seen_keys: set[str] = set()
                for root in root_nodes:
                    _collect_descendant_nodes(root, nodes, selected_nodes, seen_keys)
            elif root_nodes:
                selected_nodes = root_nodes
            else:
                selected_nodes = list(nodes.values())

        if not selected_nodes:
            return []

        relevant_pairs: set[tuple[str, str]] = set()
        for node in selected_nodes:
            _collect_relevant_pairs(node, nodes, relevant_pairs)

        raw_rows = fetch_ecowatch_log_rows(start_dt, end_dt, metric_key)
        if not raw_rows:
            return []
        bucket_values: dict[tuple[str, datetime], float] = defaultdict(float)
        power_bucket_sums: dict[tuple[str, datetime], float] = defaultdict(float)
        power_bucket_counts: dict[tuple[str, datetime], int] = defaultdict(int)
        energy_bucket_bounds: dict[tuple[str, datetime], tuple[datetime, float, datetime, float]] = {}

        for row in raw_rows:
            row_device = str(row.get("device_name", "")).strip()
            row_tag = str(row.get("tag_name", "")).strip()
            if relevant_pairs and (row_device, row_tag) not in relevant_pairs:
                continue

            row_timestamp = row.get("timestamp")
            if not isinstance(row_timestamp, datetime):
                continue

            local_timestamp = row_timestamp.astimezone(TIMEZONE_INFO) if row_timestamp.tzinfo else row_timestamp
            bucket = _truncate_datetime(local_timestamp, interval_key)
            value = float(row.get("value", 0.0) or 0.0)
            bucket_key = (f"{row_device}:{row_tag}", bucket)

            if metric_key == "power":
                power_bucket_sums[bucket_key] += value
                power_bucket_counts[bucket_key] += 1
            elif _is_project_device(row_device):
                existing_bounds = energy_bucket_bounds.get(bucket_key)
                if existing_bounds is None:
                    energy_bucket_bounds[bucket_key] = (local_timestamp, value, local_timestamp, value)
                else:
                    first_ts, first_val, last_ts, last_val = existing_bounds
                    if local_timestamp < first_ts:
                        first_ts, first_val = local_timestamp, value
                    if local_timestamp > last_ts:
                        last_ts, last_val = local_timestamp, value
                    energy_bucket_bounds[bucket_key] = (first_ts, first_val, last_ts, last_val)
            else:
                bucket_values[bucket_key] += value

        if metric_key == "power":
            for bucket_key, total in power_bucket_sums.items():
                count = power_bucket_counts.get(bucket_key, 0)
                if count > 0:
                    bucket_values[bucket_key] = total / count
        else:
            for bucket_key, (_, first_val, _, last_val) in energy_bucket_bounds.items():
                bucket_values[bucket_key] = max(0.0, last_val - first_val)

        buckets = _generate_buckets(start_dt, end_dt, interval_key)
        response: list[dict[str, object]] = []

        for node in selected_nodes:
            for bucket in buckets:
                total = _resolve_bucket_total(node, bucket, nodes, bucket_values)
                if abs(total) < 1e-12:
                    continue

                response.append(
                    {
                        "tag_name": node.name,
                        value_field: float(total),
                        "value": float(total),
                        "timestamp": bucket.strftime(time_format),
                        "parent_name": node.parent_name,
                        "children_names": list(node.children_names),
                        "metric": metric_key,
                    }
                )

        response.sort(key=lambda item: (str(item["timestamp"]), str(item["tag_name"])))
        return response
