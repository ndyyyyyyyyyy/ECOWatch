from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response

from .security import ip_in_allowed_subnet, is_allowed_origin, normalize_ip


def register_gateway_middleware(app: FastAPI):
    @app.middleware("http")
    async def gateway_guard(request: Request, call_next):
        remote_ip = normalize_ip(
            (request.headers.get("x-forwarded-for", "").split(",")[0].strip() or request.client.host)
            if request.client
            else ""
        )
        if remote_ip and remote_ip != "127.0.0.1" and not ip_in_allowed_subnet(remote_ip):
            return JSONResponse(
                {"message": "Forbidden: only local subnet access is allowed."},
                status_code=403,
            )

        if request.url.path.startswith("/api"):
            origin = request.headers.get("origin")
            if origin and not is_allowed_origin(origin):
                return JSONResponse({"message": "Origin not allowed by CORS"}, status_code=403)

            if request.method == "OPTIONS":
                response = Response(status_code=204)
            else:
                response = await call_next(request)

            if origin and is_allowed_origin(origin):
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Vary"] = "Origin"
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type"
            response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
            return response

        return await call_next(request)
