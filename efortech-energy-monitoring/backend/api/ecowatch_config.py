from __future__ import annotations

from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel

from storage.energy_db import (
    clear_area_node_tag,
    create_area_node,
    create_usage_target,
    delete_area_node,
    delete_usage_target,
    fetch_area_node,
    fetch_assigned_tags,
    fetch_available_ecowatch_tags,
    fetch_ecowatch_area_nodes,
    fetch_ecowatch_area_tree,
    fetch_tou_config,
    fetch_usage_targets,
    set_area_node_tag,
    update_area_assignment_mode,
    update_area_node,
    update_usage_target,
    upsert_tou_config,
)


class NodeCreate(BaseModel):
    name: str
    level: int
    parent_id: Optional[int] = None
    sort_order: int = 0
    device_id: Optional[str] = None
    payload_tag: Optional[str] = None
    value_mode: str = "delta"


class NodeUpdate(BaseModel):
    name: Optional[str] = None
    level: Optional[int] = None
    parent_id: Optional[int] = None
    sort_order: Optional[int] = None


class SetTagBody(BaseModel):
    device_id: str
    payload_tag: str
    value_mode: str = "delta"


class UpdateValueModeBody(BaseModel):
    value_mode: str


class TOUConfigBody(BaseModel):
    peak_start_hour: int = 17
    peak_end_hour: int = 22
    mid_start_hour: int = 6
    mid_end_hour: int = 17
    tariff_peak: float = 1699.53
    tariff_mid: float = 1444.70
    tariff_offpeak: float = 1039.00
    timezone_offset: int = 7
    notes: Optional[str] = None


class TargetCreate(BaseModel):
    area_node_id: Optional[int] = None
    period: str
    target_kwh: float
    effective_from: Optional[str] = None
    notes: Optional[str] = None


class TargetUpdate(BaseModel):
    area_node_id: Optional[int] = None
    period: Optional[str] = None
    target_kwh: Optional[float] = None
    effective_from: Optional[str] = None
    notes: Optional[str] = None


def register_ecowatch_config_routes(app: FastAPI):
    @app.get("/ecowatch-config/area-tree")
    async def ecowatch_area_tree():
        tree = fetch_ecowatch_area_tree()
        return {"tree": tree, "configured": bool(tree)}

    @app.get("/ecowatch-config/area-nodes")
    async def ecowatch_area_nodes():
        nodes = fetch_ecowatch_area_nodes()
        return {"total": len(nodes), "data": nodes}

    @app.post("/ecowatch-config/area-nodes", status_code=201)
    async def ecowatch_create_area_node(body: NodeCreate):
        if body.parent_id is None and body.level != 1:
            raise HTTPException(status_code=400, detail="Root nodes must be level 1")
        if body.parent_id is not None:
            parent = fetch_area_node(body.parent_id)
            if parent is None:
                raise HTTPException(status_code=404, detail="Parent node not found")
            if body.level != int(parent.get("level") or 0) + 1:
                raise HTTPException(status_code=400, detail="Child level must be parent level + 1")
        if body.value_mode not in {"raw", "delta"}:
            raise HTTPException(status_code=400, detail="value_mode must be 'raw' or 'delta'")
        if body.device_id and body.payload_tag and (body.device_id, body.payload_tag) in fetch_assigned_tags():
            raise HTTPException(status_code=409, detail="This tag is already assigned to another area node")

        node_id = create_area_node(
            name=body.name,
            level=body.level,
            parent_id=body.parent_id,
            sort_order=body.sort_order,
            device_id=body.device_id,
            payload_tag=body.payload_tag,
            value_mode=body.value_mode,
        )
        return {"success": True, "id": node_id}

    @app.put("/ecowatch-config/area-nodes/{node_id}")
    async def ecowatch_update_area_node(node_id: int, body: NodeUpdate):
        ok = update_area_node(node_id, {k: v for k, v in body.model_dump().items() if v is not None})
        if not ok:
            raise HTTPException(status_code=404, detail="Node not found")
        return {"success": True}

    @app.delete("/ecowatch-config/area-nodes/{node_id}")
    async def ecowatch_delete_area_node(node_id: int):
        nodes = fetch_ecowatch_area_nodes()
        if any(item.get("parent_id") == node_id for item in nodes):
            raise HTTPException(status_code=400, detail="Cannot delete node with children. Remove children first.")
        ok = delete_area_node(node_id)
        if not ok:
            raise HTTPException(status_code=404, detail="Node not found")
        return {"success": True}

    @app.put("/ecowatch-config/area-nodes/{node_id}/tag")
    async def ecowatch_set_area_node_tag(node_id: int, body: SetTagBody):
        if body.value_mode not in {"raw", "delta"}:
            raise HTTPException(status_code=400, detail="value_mode must be 'raw' or 'delta'")
        node = fetch_area_node(node_id)
        if node is None:
            raise HTTPException(status_code=404, detail="Node not found")
        assigned = fetch_assigned_tags()
        current_pair = (str(node.get("device_id") or ""), str(node.get("payload_tag") or ""))
        incoming_pair = (body.device_id, body.payload_tag)
        if incoming_pair != current_pair and incoming_pair in assigned:
            raise HTTPException(status_code=409, detail="This tag is already assigned to another area node")
        ok = set_area_node_tag(node_id, body.device_id, body.payload_tag, body.value_mode)
        if not ok:
            raise HTTPException(status_code=400, detail="Failed to assign tag")
        return {"success": True}

    @app.patch("/ecowatch-config/area-nodes/{node_id}/tag")
    async def ecowatch_update_area_node_tag_mode(node_id: int, body: UpdateValueModeBody):
        if body.value_mode not in {"raw", "delta"}:
            raise HTTPException(status_code=400, detail="value_mode must be 'raw' or 'delta'")
        ok = update_area_assignment_mode(node_id, body.value_mode)
        if not ok:
            raise HTTPException(status_code=404, detail="No tag assigned to this node")
        return {"success": True}

    @app.delete("/ecowatch-config/area-nodes/{node_id}/tag")
    async def ecowatch_clear_area_node_tag(node_id: int):
        ok = clear_area_node_tag(node_id)
        if not ok:
            raise HTTPException(status_code=404, detail="No tag assigned to this node")
        return {"success": True}

    @app.get("/ecowatch-config/available-tags")
    async def ecowatch_available_tags():
        data = fetch_available_ecowatch_tags()
        return {"total": len(data), "data": data}

    @app.get("/ecowatch-config/tou")
    async def ecowatch_get_tou():
        data = fetch_tou_config()
        if data is None:
            raise HTTPException(status_code=404, detail="TOU config not found")
        return data

    @app.put("/ecowatch-config/tou")
    async def ecowatch_update_tou(body: TOUConfigBody):
        ok = upsert_tou_config(body.model_dump())
        if not ok:
            raise HTTPException(status_code=400, detail="Failed to update TOU config")
        return {"success": True}

    @app.get("/ecowatch-config/targets")
    async def ecowatch_targets(node_id: Optional[int] = Query(default=None)):
        data = fetch_usage_targets(node_id=node_id)
        return {"total": len(data), "data": data}

    @app.post("/ecowatch-config/targets", status_code=201)
    async def ecowatch_create_target(body: TargetCreate):
        if body.period not in {"daily", "monthly", "yearly"}:
            raise HTTPException(status_code=400, detail="period must be daily, monthly, or yearly")
        target_id = create_usage_target(body.model_dump())
        return {"success": True, "id": target_id}

    @app.put("/ecowatch-config/targets/{target_id}")
    async def ecowatch_update_target(target_id: int, body: TargetUpdate):
        ok = update_usage_target(target_id, {k: v for k, v in body.model_dump().items() if v is not None})
        if not ok:
            raise HTTPException(status_code=404, detail="Target not found")
        return {"success": True}

    @app.delete("/ecowatch-config/targets/{target_id}")
    async def ecowatch_delete_target(target_id: int):
        ok = delete_usage_target(target_id)
        if not ok:
            raise HTTPException(status_code=404, detail="Target not found")
        return {"success": True}
