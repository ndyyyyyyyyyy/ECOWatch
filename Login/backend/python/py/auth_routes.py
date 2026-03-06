from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, RedirectResponse, Response

from .config import GRAFANA_DEFAULT_PATH, GRAFANA_TARGET, LOGIN_APP_URL, SESSION_COOKIE_NAME
from .http_client import get_http_client
from .security import is_weekend
from .session_store import (
    apply_session_cookie,
    clear_session,
    clear_session_cookie,
    create_session,
    get_session_data,
)


def register_auth_routes(app: FastAPI):
    @app.get("/api/health")
    async def api_health():
        return {"ok": True}

    @app.get("/api/session")
    async def api_session(request: Request):
        sid, data = get_session_data(request)
        user = data.get("user") if data else None
        if not user:
            response = JSONResponse({"authenticated": False}, status_code=401)
            if sid:
                clear_session(sid)
                clear_session_cookie(response)
            return response
        return {"authenticated": True, "user": str(user)}

    @app.post("/api/login")
    async def api_login(request: Request):
        payload = await request.json()
        account = str(payload.get("account", "")).strip()
        password = str(payload.get("password", ""))
        remember_requested = bool(payload.get("remember"))
        remember_applied = remember_requested and not is_weekend()

        if not account:
            return JSONResponse({"message": "Account is required."}, status_code=400)
        if not password:
            return JSONResponse({"message": "Password is required."}, status_code=400)

        client = get_http_client()
        if client is None:
            return JSONResponse({"message": "Auth service not ready."}, status_code=503)

        try:
            # Strict credential verification against Grafana user API.
            login_check = await client.get(
                f"{GRAFANA_TARGET}/api/user",
                auth=(account, password),
                follow_redirects=False,
            )
        except Exception:
            return JSONResponse({"message": "Failed to connect to Grafana."}, status_code=502)

        if login_check.status_code != 200:
            return JSONResponse({"message": "Invalid account or password."}, status_code=401)

        sid, _ = create_session(user=account, remember_applied=remember_applied)
        response = JSONResponse({"ok": True, "user": account, "remember": remember_applied})
        apply_session_cookie(response, sid, remember_applied)
        return response

    def _sign_out_response(request: Request) -> Response:
        sid = request.cookies.get(SESSION_COOKIE_NAME)
        clear_session(sid)
        response = JSONResponse({"ok": True})
        clear_session_cookie(response)
        return response

    @app.post("/api/sign-out")
    async def api_sign_out(request: Request):
        return _sign_out_response(request)

    @app.post("/api/logout")
    async def api_logout_alias(request: Request):
        return _sign_out_response(request)

    @app.get("/auth/grafana-login")
    async def auth_grafana_login(request: Request):
        account = str(request.query_params.get("account", "")).strip()
        if not account:
            return Response("Account is required.", status_code=400)

        sid, _ = create_session(user=account, remember_applied=False)
        response = RedirectResponse(f"/grafana{GRAFANA_DEFAULT_PATH}", status_code=302)
        apply_session_cookie(response, sid, remember_applied=False)
        return response

    @app.api_route("/sign-out", methods=["GET", "POST"])
    @app.api_route("/grafana/sign-out", methods=["GET", "POST"])
    @app.api_route("/logout", methods=["GET", "POST"])
    @app.api_route("/grafana/logout", methods=["GET", "POST"])
    async def sign_out_redirect(request: Request):
        sid = request.cookies.get(SESSION_COOKIE_NAME)
        clear_session(sid)
        redirect_to = "/" if LOGIN_APP_URL == "/" else LOGIN_APP_URL
        response = RedirectResponse(redirect_to, status_code=302)
        clear_session_cookie(response)
        return response
