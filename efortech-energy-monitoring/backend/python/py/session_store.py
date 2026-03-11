import secrets
from datetime import datetime, timedelta
from threading import Lock

from fastapi import Request
from fastapi.responses import JSONResponse, Response

from .config import REMEMBER_ME_MAX_AGE_SECONDS, SESSION_COOKIE_NAME
from .security import get_week_key, is_weekend

_SESSIONS: dict[str, dict] = {}
_SESSIONS_LOCK = Lock()


def create_session(*, user: str, remember_applied: bool) -> tuple[str, dict]:
    sid = secrets.token_urlsafe(32)
    now = datetime.now()
    data = {
        "user": user,
        "remember_applied": remember_applied,
        "remember_week_key": get_week_key(now) if remember_applied else None,
        "expires_at": (now + timedelta(seconds=REMEMBER_ME_MAX_AGE_SECONDS))
        if remember_applied
        else None,
    }
    with _SESSIONS_LOCK:
        _SESSIONS[sid] = data
    return sid, data


def get_session_data(request: Request) -> tuple[str | None, dict | None]:
    sid = request.cookies.get(SESSION_COOKIE_NAME)
    if not sid:
        return None, None
    with _SESSIONS_LOCK:
        data = _SESSIONS.get(sid)
    if not data:
        return sid, None

    expires_at = data.get("expires_at")
    if expires_at and datetime.now() > expires_at:
        clear_session(sid)
        return sid, None

    if data.get("remember_applied"):
        if is_weekend() or data.get("remember_week_key") != get_week_key():
            clear_session(sid)
            return sid, None
    return sid, data


def clear_session(sid: str | None):
    if not sid:
        return
    with _SESSIONS_LOCK:
        _SESSIONS.pop(sid, None)


def apply_session_cookie(response: Response, sid: str, remember_applied: bool):
    kwargs = dict(
        key=SESSION_COOKIE_NAME,
        value=sid,
        httponly=True,
        samesite="lax",
        secure=False,
        path="/",
    )
    if remember_applied:
        kwargs["max_age"] = REMEMBER_ME_MAX_AGE_SECONDS
    response.set_cookie(**kwargs)


def clear_session_cookie(response: Response):
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")


def require_user(request: Request) -> tuple[str | None, JSONResponse | None]:
    sid, data = get_session_data(request)
    user = data.get("user") if data else None
    if not user:
        response = JSONResponse(
            {"message": "Unauthorized. Please sign in first."},
            status_code=401,
        )
        if sid:
            clear_session(sid)
            clear_session_cookie(response)
        return None, response
    return str(user), None
