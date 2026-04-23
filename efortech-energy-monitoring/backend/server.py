import uvicorn
from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from api.auth import register_auth_routes
from api.ecowatch import register_energy_routes
from api.ecowatch_config import register_ecowatch_config_routes
from api.project import register_project_routes
from core.config import DIST_DIR, DIST_INDEX, GRAFANA_TARGET, LOGIN_APP_URL, PORT
from core.http_client import shutdown_http_client, startup_http_client
from core.middleware import register_gateway_middleware
from core.security import ALLOWED_SUBNETS
from project.store import project_store
from storage.energy_db import close_connection_pool, ensure_energy_table
from storage.project_store_db import ensure_project_store_tables


def create_app() -> FastAPI:
    app = FastAPI()

    register_gateway_middleware(app)
    register_auth_routes(app)
    register_project_routes(app)
    register_energy_routes(app)
    register_ecowatch_config_routes(app)

    if DIST_DIR.exists():
        app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")

    @app.get("/healthz")
    async def healthcheck():
        return {"ok": True}

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        if full_path.startswith(("api", "grafana", "auth", "public", "avatar")):
            return JSONResponse({"message": "Not Found"}, status_code=404)

        if DIST_INDEX.exists():
            candidate = DIST_DIR / full_path
            if full_path and candidate.exists() and candidate.is_file():
                return FileResponse(candidate)
            return FileResponse(DIST_INDEX)

        if LOGIN_APP_URL == "/":
            return {"ok": True, "message": "Efortech Python gateway running."}
        return RedirectResponse(LOGIN_APP_URL, status_code=302)

    return app


app = create_app()


@app.on_event("startup")
async def startup_event():
    await startup_http_client()
    ensure_energy_table()
    ensure_project_store_tables()
    project_store.start()


@app.on_event("shutdown")
async def shutdown_event():
    project_store.stop()
    close_connection_pool()
    await shutdown_http_client()


if __name__ == "__main__":
    print(f"Python ASGI gateway aktif di http://0.0.0.0:{PORT}")
    print(f"Grafana upstream: {GRAFANA_TARGET}")
    if ALLOWED_SUBNETS:
        print("Akses dibatasi subnet:", ", ".join(str(item) for item in ALLOWED_SUBNETS))
    uvicorn.run(app, host="0.0.0.0", port=PORT, proxy_headers=True)
