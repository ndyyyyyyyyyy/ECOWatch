from __future__ import annotations

from core.config import INFLUX_ENABLED
from fastapi import Body, FastAPI, HTTPException
from fastapi.responses import StreamingResponse

from project.store import project_store
from queues.analysis_queue import queue_available, queue_metrics
from queues.raw_queue import raw_queue_available, raw_queue_metrics


def register_project_routes(app: FastAPI):
    @app.get("/api/project/status")
    async def project_status():
        status = project_store.get_status()
        metrics = queue_metrics() if queue_available() else {}
        raw_metrics = raw_queue_metrics() if raw_queue_available() else {}
        return {
            "mqttEnabled": status.enabled,
            "connected": status.connected,
            "available": status.available,
            "topicFilter": status.topic_filter,
            "brokerHost": status.broker_host,
            "brokerPort": status.broker_port,
            "message": status.message,
            "queueEnabled": queue_available(),
            "queueDepth": metrics.get("queueDepth", 0),
            "queuePendingCount": metrics.get("pendingCount", 0),
            "queueDlqDepth": metrics.get("dlqDepth", 0),
            "queueProcessedCount": metrics.get("processedCount", 0),
            "queueRetriedCount": metrics.get("retriedCount", 0),
            "queueDeadLetterCount": metrics.get("deadLetterCount", 0),
            "queueFailedCount": metrics.get("failedCount", 0),
            "queueBackpressureRejectedCount": metrics.get("backpressureRejectedCount", 0),
            "rawQueueEnabled": raw_queue_available() and INFLUX_ENABLED,
            "rawQueueDepth": raw_metrics.get("queueDepth", 0),
            "rawQueuePendingCount": raw_metrics.get("pendingCount", 0),
            "rawQueueDlqDepth": raw_metrics.get("dlqDepth", 0),
            "rawQueueProcessedCount": raw_metrics.get("processedCount", 0),
            "rawQueueRetriedCount": raw_metrics.get("retriedCount", 0),
            "rawQueueDeadLetterCount": raw_metrics.get("deadLetterCount", 0),
            "rawQueueFailedCount": raw_metrics.get("failedCount", 0),
            "rawQueueBackpressureRejectedCount": raw_metrics.get("backpressureRejectedCount", 0),
            "topicWorkerCount": len(project_store._topic_threads),
        }

    @app.get("/api/project/devices")
    async def project_devices():
        status = project_store.get_status()
        metrics = queue_metrics() if queue_available() else {}
        raw_metrics = raw_queue_metrics() if raw_queue_available() else {}
        return {
            "source": "mqtt" if status.enabled else "unavailable",
            "devices": project_store.get_devices(),
            "status": {
                "mqttEnabled": status.enabled,
                "connected": status.connected,
                "available": status.available,
                "message": status.message,
                "topicFilter": status.topic_filter,
                "queueEnabled": queue_available(),
                "queueDepth": metrics.get("queueDepth", 0),
                "queuePendingCount": metrics.get("pendingCount", 0),
                "queueDlqDepth": metrics.get("dlqDepth", 0),
                "queueProcessedCount": metrics.get("processedCount", 0),
                "queueRetriedCount": metrics.get("retriedCount", 0),
                "queueDeadLetterCount": metrics.get("deadLetterCount", 0),
                "queueFailedCount": metrics.get("failedCount", 0),
                "queueBackpressureRejectedCount": metrics.get("backpressureRejectedCount", 0),
                "rawQueueEnabled": raw_queue_available() and INFLUX_ENABLED,
                "rawQueueDepth": raw_metrics.get("queueDepth", 0),
                "rawQueuePendingCount": raw_metrics.get("pendingCount", 0),
                "rawQueueDlqDepth": raw_metrics.get("dlqDepth", 0),
                "rawQueueProcessedCount": raw_metrics.get("processedCount", 0),
                "rawQueueRetriedCount": raw_metrics.get("retriedCount", 0),
                "rawQueueDeadLetterCount": raw_metrics.get("deadLetterCount", 0),
                "rawQueueFailedCount": raw_metrics.get("failedCount", 0),
                "rawQueueBackpressureRejectedCount": raw_metrics.get("backpressureRejectedCount", 0),
                "topicWorkerCount": len(project_store._topic_threads),
            },
        }

    @app.get("/api/project/stream")
    async def project_stream():
        return StreamingResponse(
            project_store.stream_snapshots(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    @app.post("/api/project/devices/subscribe")
    async def subscribe_project_device(payload: dict = Body(default={})):
        try:
            result = project_store.subscribe_device(payload.get("properties"))
            return {"ok": True, **result}
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        except RuntimeError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    @app.post("/api/project/devices/update")
    async def update_project_device(payload: dict = Body(default={})):
        try:
            result = project_store.update_device(payload.get("currentDeviceName", ""), payload.get("properties"))
            return {"ok": True, **result}
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        except RuntimeError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    @app.post("/api/project/devices/{device_name}/deploy")
    async def deploy_project_device(device_name: str):
        try:
            result = project_store.deploy_device(device_name)
            return {"ok": True, **result}
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

    @app.delete("/api/project/devices/{device_name}")
    async def unsubscribe_project_device(device_name: str):
        try:
            result = project_store.unsubscribe_device(device_name)
            return {"ok": True, **result}
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

    @app.post("/api/project/devices/{device_name}/tags")
    async def upsert_project_tag(device_name: str, payload: dict = Body(default={})):
        try:
            result = project_store.upsert_tag(device_name, payload.get("tag"), payload.get("currentTagName"))
            return {"ok": True, **result}
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

    @app.delete("/api/project/devices/{device_name}/tags/{tag_name}")
    async def delete_project_tag(device_name: str, tag_name: str):
        try:
            result = project_store.delete_tag(device_name, tag_name)
            return {"ok": True, **result}
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
