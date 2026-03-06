import asyncio
from urllib.parse import urlencode, urlparse

import httpx
import websockets
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse, RedirectResponse, Response, StreamingResponse
from starlette.background import BackgroundTask

from .config import GRAFANA_TARGET, LOGIN_APP_URL, SESSION_COOKIE_NAME
from .http_client import get_http_client
from .security import build_request_origin
from .session_store import _SESSIONS, require_user


def rewrite_location(location_value: str | None, request: Request) -> str | None:
    if not location_value:
        return location_value
    req_origin = build_request_origin(dict(request.headers), request.url.scheme)

    if location_value == "/grafana" or location_value.startswith("/grafana/"):
        return location_value
    if location_value.startswith("/"):
        return f"/grafana{location_value}"
    if location_value.startswith(f"{req_origin}/grafana"):
        return location_value
    if location_value.startswith(GRAFANA_TARGET):
        return location_value.replace(GRAFANA_TARGET, f"{req_origin}/grafana", 1)

    parsed = urlparse(location_value)
    if parsed.scheme in ("http", "https"):
        path_part = parsed.path or "/"
        query_part = f"?{parsed.query}" if parsed.query else ""
        if path_part == "/grafana" or path_part.startswith("/grafana/"):
            return f"{req_origin}{path_part}{query_part}"
        if path_part.startswith("/"):
            return f"{req_origin}/grafana{path_part}{query_part}"
    return location_value


async def proxy_http_to_grafana(request: Request, path_suffix: str) -> Response:
    user, auth_error = require_user(request)
    if auth_error:
        if request.url.path.startswith("/grafana"):
            return RedirectResponse("/#/login" if LOGIN_APP_URL == "/" else LOGIN_APP_URL, status_code=302)
        return auth_error

    full_path = f"/grafana{path_suffix}"
    target_url = f"{GRAFANA_TARGET}{full_path}"
    if request.query_params:
        target_url = f"{target_url}?{urlencode(list(request.query_params.multi_items()))}"

    headers = {
        key: value
        for key, value in request.headers.items()
        if key.lower() not in {"host", "content-length", "connection"}
    }
    headers["X-WEBAUTH-USER"] = user
    headers["X-Forwarded-Prefix"] = "/grafana"
    headers["X-Forwarded-Host"] = request.headers.get("host", "")
    headers["X-Forwarded-Proto"] = request.url.scheme
    headers["Origin"] = build_request_origin(dict(request.headers), request.url.scheme)
    headers["Host"] = request.headers.get("host", "")

    body = await request.body()
    client = get_http_client()
    if client is None:
        return JSONResponse({"message": "Grafana proxy client not ready"}, status_code=503)

    try:
        upstream_request = client.build_request(
            request.method,
            target_url,
            headers=headers,
            content=body,
        )
        upstream = await client.send(upstream_request, stream=True)
    except httpx.HTTPError as exc:
        return JSONResponse({"message": "Grafana proxy error", "detail": str(exc)}, status_code=502)

    response_headers = {}
    for key, value in upstream.headers.items():
        if key.lower() in {"content-encoding", "transfer-encoding", "connection"}:
            continue
        if key.lower() == "location":
            value = rewrite_location(value, request) or value
        response_headers[key] = value

    if upstream.status_code >= 400:
        print(f"[grafana-proxy] {request.method} {request.url.path} -> {upstream.status_code}")

    async def iter_upstream():
        async for chunk in upstream.aiter_raw():
            yield chunk

    return StreamingResponse(
        iter_upstream(),
        status_code=upstream.status_code,
        headers=response_headers,
        background=BackgroundTask(upstream.aclose),
    )


async def grafana_live_ws_handler(websocket: WebSocket):
    sid = websocket.cookies.get(SESSION_COOKIE_NAME)
    data = _SESSIONS.get(sid) if sid else None
    user = str(data.get("user")) if data else ""
    if not user:
        await websocket.close(code=1008)
        return

    upstream_base = GRAFANA_TARGET.replace("http://", "ws://").replace("https://", "wss://")
    query = websocket.url.query
    upstream_url = f"{upstream_base}/grafana/api/live/ws"
    if query:
        upstream_url = f"{upstream_url}?{query}"

    await websocket.accept()

    request_origin = f"{websocket.url.scheme}://{websocket.headers.get('host', '')}"
    upstream_headers = [
        ("X-WEBAUTH-USER", user),
        ("X-Forwarded-Prefix", "/grafana"),
        ("X-Forwarded-Host", websocket.headers.get("host", "")),
        ("X-Forwarded-Proto", websocket.url.scheme),
        ("Origin", request_origin),
    ]

    try:
        async with websockets.connect(
            upstream_url,
            additional_headers=upstream_headers,
            open_timeout=10,
        ) as upstream_ws:
            async def client_to_upstream():
                while True:
                    message = await websocket.receive()
                    if message.get("type") == "websocket.disconnect":
                        break
                    if message.get("text") is not None:
                        await upstream_ws.send(message["text"])
                    elif message.get("bytes") is not None:
                        await upstream_ws.send(message["bytes"])

            async def upstream_to_client():
                while True:
                    incoming = await upstream_ws.recv()
                    if isinstance(incoming, bytes):
                        await websocket.send_bytes(incoming)
                    else:
                        await websocket.send_text(incoming)

            await asyncio.gather(client_to_upstream(), upstream_to_client())
    except (WebSocketDisconnect, websockets.WebSocketException):
        pass
    finally:
        if websocket.client_state.value == 1:
            await websocket.close()


def register_grafana_proxy_routes(app: FastAPI):
    @app.api_route("/grafana", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
    @app.api_route("/grafana/{subpath:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
    async def grafana_proxy(request: Request, subpath: str = ""):
        suffix = f"/{subpath}" if subpath else ""
        return await proxy_http_to_grafana(request, suffix)

    @app.api_route("/api/live/{subpath:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
    async def grafana_live_compat(request: Request, subpath: str):
        return await proxy_http_to_grafana(request, f"/api/live/{subpath}")

    @app.api_route("/public/{subpath:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
    async def grafana_public_compat(request: Request, subpath: str):
        return await proxy_http_to_grafana(request, f"/public/{subpath}")

    @app.api_route("/avatar/{subpath:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
    async def grafana_avatar_compat(request: Request, subpath: str):
        return await proxy_http_to_grafana(request, f"/avatar/{subpath}")

    @app.get("/favicon.ico")
    async def grafana_favicon_compat(request: Request):
        return await proxy_http_to_grafana(request, "/favicon.ico")

    @app.websocket("/grafana/api/live/ws")
    async def grafana_live_ws(websocket: WebSocket):
        await grafana_live_ws_handler(websocket)

    @app.websocket("/api/live/ws")
    async def grafana_live_ws_compat(websocket: WebSocket):
        await grafana_live_ws_handler(websocket)
