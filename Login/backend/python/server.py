import uvicorn
from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from py.auth_routes import register_auth_routes
from py.config import DIST_DIR, DIST_INDEX, GRAFANA_TARGET, LOGIN_APP_URL, PORT
from py.grafana_proxy import register_grafana_proxy_routes
from py.http_client import shutdown_http_client, startup_http_client
from py.middleware import register_gateway_middleware
from py.security import ALLOWED_SUBNETS

app = FastAPI()


@app.on_event("startup")
async def startup_event():
    await startup_http_client()


@app.on_event("shutdown")
async def shutdown_event():
    await shutdown_http_client()


register_gateway_middleware(app)
register_auth_routes(app)
register_grafana_proxy_routes(app)

if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")


@app.get("/{full_path:path}")
async def spa_fallback(full_path: str):
    if full_path.startswith(("api", "grafana", "auth", "public", "avatar", "login")):
        return JSONResponse({"message": "Not Found"}, status_code=404)

    if DIST_INDEX.exists():
        candidate = DIST_DIR / full_path
        if full_path and candidate.exists() and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(DIST_INDEX)

    if LOGIN_APP_URL == "/":
        return {"ok": True, "message": "Efortech Python gateway running."}
    return RedirectResponse(LOGIN_APP_URL, status_code=302)


if __name__ == "__main__":
    print(f"Python ASGI gateway aktif di http://0.0.0.0:{PORT}")
    print(f"Grafana upstream: {GRAFANA_TARGET}")
    if ALLOWED_SUBNETS:
        print("Akses dibatasi subnet:", ", ".join(str(item) for item in ALLOWED_SUBNETS))
    uvicorn.run(app, host="0.0.0.0", port=PORT, proxy_headers=True)
