import os
from pathlib import Path

PORT = int(os.getenv("PORT", "4000"))
SESSION_COOKIE_NAME = os.getenv("SESSION_COOKIE_NAME", "ef_session")
SESSION_SECRET = os.getenv("SESSION_SECRET", "efortech-dev-secret")
REMEMBER_ME_MAX_AGE_SECONDS = int(
    os.getenv("REMEMBER_ME_MAX_AGE_MS", str(7 * 24 * 60 * 60 * 1000))
) // 1000
GRAFANA_TARGET = os.getenv("GRAFANA_TARGET", "http://127.0.0.1:3000").rstrip("/")
GRAFANA_DEFAULT_PATH = os.getenv(
    "GRAFANA_DEFAULT_PATH", "/?orgId=1&from=now-6h&to=now&timezone=browser"
)
LOGIN_APP_URL = os.getenv("LOGIN_APP_URL", "/").rstrip("/") or "/"

ALLOWED_ORIGINS = {
    value.strip()
    for value in os.getenv(
        "ALLOWED_ORIGINS",
        f"http://localhost:{PORT},http://127.0.0.1:{PORT},http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if value.strip()
}

ROOT_DIR = Path(__file__).resolve().parents[3]
DIST_DIR = ROOT_DIR / "dist"
DIST_INDEX = DIST_DIR / "index.html"
