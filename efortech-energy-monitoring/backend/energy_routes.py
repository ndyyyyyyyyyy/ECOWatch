from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta

from fastapi import FastAPI, Query

from energy_db import fetch_energy_readings
from project_store import project_store

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
    "NR1": {"parent": "MAIN_ELECTRICAL", "children": ("LVMDP_NR1", "DB1", "DB2", "DB3")},
    "NR2": {"parent": "MAIN_ELECTRICAL", "children": ("LVMDP_NR2",)},
    "UT_NEW": {"parent": "MAIN_ELECTRICAL", "children": ("LVMDP_UT_NEW",)},
    "UTILITY": {"parent": "MAIN_ELECTRICAL", "children": ("LVMDP_UTILITY",)},
    "LVMDP_NR1": {"parent": "NR1", "children": ()},
    "DB1": {"parent": "NR1", "children": ()},
    "DB2": {"parent": "NR1", "children": ()},
    "DB3": {"parent": "NR1", "children": ("CHAMBER_AR1", "LP_OFFICE_REFF_2", "H_PRESS_MC1", "V_F_MALE_C_NR1", "V_F_FEMALE_B_NR1", "V_F_FEMALE_A_NR1", "V_F_MALE_B_NR1", "V_F_MALE_A_NR1")},
    "CHAMBER_AR1": {"parent": "DB3", "children": ()},
    "LP_OFFICE_REFF_2": {"parent": "DB3", "children": ()},
    "H_PRESS_MC1": {"parent": "DB3", "children": ()},
    "V_F_MALE_C_NR1": {"parent": "DB3", "children": ()},
    "V_F_FEMALE_B_NR1": {"parent": "DB3", "children": ()},
    "V_F_FEMALE_A_NR1": {"parent": "DB3", "children": ()},
    "V_F_MALE_B_NR1": {"parent": "DB3", "children": ()},
    "V_F_MALE_A_NR1": {"parent": "DB3", "children": ()},
    "LVMDP_RAC": {"parent": "RAC", "children": ()},
    "LVMDP_NR2": {"parent": "NR2", "children": ()},
    "LVMDP_UT_NEW": {"parent": "UT_NEW", "children": ()},
    "LVMDP_UTILITY": {"parent": "UTILITY", "children": ()},
}

DEFAULT_ROOT_AREAS = ("RAC", "NR1", "NR2", "UT_NEW", "UTILITY")


@dataclass(frozen=True)
class EnergyNode:
    key: str
    name: str
    parent_name: str | None
    children_names: tuple[str, ...]
    device_name: str | None = None
    tag_name: str | None = None
    uses_children_for_rollup: bool = False


def _is_usage_tag(tag: dict[str, object]) -> bool:
    name = str(tag.get("name", "")).strip().lower()
    address = str(tag.get("address", "")).strip().lower()
    source_address = str(tag.get("sourceAddress", "")).strip().lower()
    haystack = " ".join([name, address, source_address])
    return "kwh" in haystack or "energy" in haystack or "usage" in haystack


def _build_energy_nodes() -> dict[str, EnergyNode]:
    nodes: dict[str, EnergyNode] = {}
    for name, config in DEFAULT_ECOWATCH_TREE.items():
        is_legacy_measurable = name in LEGACY_MEASURABLE_TAGS
        nodes[name] = EnergyNode(
            key=name,
            name=name,
            parent_name=config["parent"],
            children_names=tuple(config["children"]),
            device_name=LEGACY_ECOWATCH_DEVICE if is_legacy_measurable else None,
            tag_name=name if is_legacy_measurable else None,
            uses_children_for_rollup=not is_legacy_measurable and bool(config["children"]),
        )

    devices = project_store.get_devices()

    for device in devices:
        device_name = str(device.get("name", "")).strip()
        if not device_name:
            continue

        tags = [tag for tag in device.get("tags", []) if isinstance(tag, dict)]
        usage_tags = [tag for tag in tags if _is_usage_tag(tag)]
        effective_tags = usage_tags or tags
        child_names: list[str] = []

        for tag in effective_tags:
            tag_name = str(tag.get("name", "")).strip()
            if not tag_name:
                continue

            child_names.append(tag_name)
            if tag_name not in nodes:
                nodes[tag_name] = EnergyNode(
                    key=f"{device_name}:{tag_name}",
                    name=tag_name,
                    parent_name=device_name,
                    children_names=(),
                    device_name=device_name,
                    tag_name=tag_name,
                    uses_children_for_rollup=False,
                )
            else:
                existing = nodes[tag_name]
                nodes[tag_name] = EnergyNode(
                    key=f"{device_name}:{tag_name}",
                    name=existing.name,
                    parent_name=existing.parent_name,
                    children_names=existing.children_names,
                    device_name=device_name,
                    tag_name=tag_name,
                    uses_children_for_rollup=existing.uses_children_for_rollup,
                )

        nodes[device_name] = EnergyNode(
            key=device_name,
            name=device_name,
            parent_name=None,
            children_names=tuple(child_names),
            device_name=device_name,
            tag_name=None,
            uses_children_for_rollup=True,
        )

    project_only_devices = [
        device_name
        for device_name in (str(device.get("name", "")).strip() for device in devices)
        if device_name and device_name not in DEFAULT_ECOWATCH_TREE
    ]
    if project_only_devices:
        nodes["PROJECT_DEVICES"] = EnergyNode(
            key="PROJECT_DEVICES",
            name="PROJECT_DEVICES",
            parent_name=None,
            children_names=tuple(project_only_devices),
            device_name=None,
            tag_name=None,
            uses_children_for_rollup=True,
        )

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
    if node.device_name and node.tag_name:
        result.add((node.device_name, node.tag_name))
        return

    for child_name in node.children_names:
        child = nodes.get(child_name)
        if child is not None:
            _collect_relevant_pairs(child, nodes, result)


def _resolve_bucket_total(
    node: EnergyNode,
    bucket: datetime,
    nodes: dict[str, EnergyNode],
    bucket_values: dict[tuple[str, datetime], float],
) -> float:
    if node.device_name and node.tag_name:
        return bucket_values.get((f"{node.device_name}:{node.tag_name}", bucket), 0.0)

    total = 0.0
    for child_name in node.children_names:
        child = nodes.get(child_name)
        if child is not None:
            total += _resolve_bucket_total(child, bucket, nodes, bucket_values)
    return total


def _parse_date_bound(value: str | None, is_end: bool) -> datetime:
    if not value:
        now = datetime.now()
        return now.replace(hour=23, minute=59, second=59, microsecond=999999) if is_end else now.replace(
            hour=0, minute=0, second=0, microsecond=0
        )

    text = value.strip()
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        parsed = datetime.fromisoformat(f"{text} 00:00:00")

    if "T" in text or " " in text:
        return parsed
    if is_end:
        return parsed.replace(hour=23, minute=59, second=59, microsecond=999999)
    return parsed.replace(hour=0, minute=0, second=0, microsecond=0)


def register_energy_routes(app: FastAPI):
    @app.get("/energy")
    async def energy(
        start: str | None = Query(default=None),
        end: str | None = Query(default=None),
        interval: str = Query(default="Hour"),
        areas: str | None = Query(default=None),
    ):
        interval_key, time_format = _bucket_config(interval)
        start_dt = _parse_date_bound(start, is_end=False)
        end_dt = _parse_date_bound(end, is_end=True)
        nodes = _build_energy_nodes()
        requested_names = [item.strip() for item in str(areas or "").split(",") if item.strip()]

        if requested_names:
            selected_nodes = [nodes[name] for name in requested_names if name in nodes]
        else:
            selected_nodes = sorted(nodes.values(), key=lambda item: (item.parent_name or "", item.name.lower()))

        if not selected_nodes:
            return []

        relevant_pairs: set[tuple[str, str]] = set()
        for node in selected_nodes:
            _collect_relevant_pairs(node, nodes, relevant_pairs)

        raw_rows = fetch_energy_readings(start_dt, end_dt)
        bucket_values: dict[tuple[str, datetime], float] = defaultdict(float)

        for row in raw_rows:
            row_device = str(row.get("device_name", "")).strip()
            row_tag = str(row.get("tag_name", "")).strip()
            if relevant_pairs and (row_device, row_tag) not in relevant_pairs:
                continue

            row_timestamp = row.get("timestamp")
            if not isinstance(row_timestamp, datetime):
                continue

            bucket = _truncate_datetime(row_timestamp, interval_key)
            value = float(row.get("value", 0.0) or 0.0)
            bucket_values[(f"{row_device}:{row_tag}", bucket)] += value

        buckets = _generate_buckets(start_dt, end_dt, interval_key)
        response: list[dict[str, object]] = []

        for node in selected_nodes:
            for bucket in buckets:
                total = _resolve_bucket_total(node, bucket, nodes, bucket_values)

                response.append(
                    {
                        "tag_name": node.name,
                        "value_kwh": float(total),
                        "timestamp": bucket.strftime(time_format),
                        "parent_name": node.parent_name,
                        "children_names": list(node.children_names),
                    }
                )

        response.sort(key=lambda item: (str(item["timestamp"]), str(item["tag_name"])))
        return response
