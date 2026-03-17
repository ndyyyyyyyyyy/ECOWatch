import os
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[3]


def _load_env_file():
    env_path = ROOT_DIR / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


_load_env_file()


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


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
AUTH_MODE = os.getenv("AUTH_MODE", "hybrid").strip().lower() or "hybrid"
ALLOW_LOCAL_LOGIN_WITHOUT_PASSWORD = _env_bool("ALLOW_LOCAL_LOGIN_WITHOUT_PASSWORD", False)
LOCAL_AUTH_USERNAME = os.getenv("LOCAL_AUTH_USERNAME", "admin")
LOCAL_AUTH_PASSWORD = os.getenv("LOCAL_AUTH_PASSWORD", "admin123")

ALLOWED_ORIGINS = {
    value.strip()
    for value in os.getenv(
        "ALLOWED_ORIGINS",
        f"http://localhost:{PORT},http://127.0.0.1:{PORT},http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if value.strip()
}

DIST_DIR = ROOT_DIR / "dist"
DIST_INDEX = DIST_DIR / "index.html"
DATA_DIR = ROOT_DIR / "backend" / "python" / "data"
PROJECT_STORE_FILE = DATA_DIR / "project_store.json"

MQTT_ENABLED = _env_bool("MQTT_ENABLED", False)
MQTT_BROKER_HOST = os.getenv("MQTT_BROKER_HOST", "127.0.0.1")
MQTT_BROKER_PORT = _env_int("MQTT_BROKER_PORT", 1883)
MQTT_USERNAME = os.getenv("MQTT_USERNAME", "").strip()
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "").strip()
MQTT_CLIENT_ID = os.getenv("MQTT_CLIENT_ID", "efortech-project-backend").strip()
MQTT_TOPIC_FILTER = os.getenv("MQTT_TOPIC_FILTER", "devices/+").strip() or "devices/+"
