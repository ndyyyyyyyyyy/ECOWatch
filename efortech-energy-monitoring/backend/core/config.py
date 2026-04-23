import os
from pathlib import Path
from zoneinfo import ZoneInfo


ROOT_DIR = Path(__file__).resolve().parents[2]


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

MQTT_ENABLED = _env_bool("MQTT_ENABLED", False)
MQTT_BROKER_HOST = os.getenv("MQTT_BROKER_HOST", "127.0.0.1")
MQTT_BROKER_PORT = _env_int("MQTT_BROKER_PORT", 1883)
MQTT_USERNAME = os.getenv("MQTT_USERNAME", "").strip()
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "").strip()
MQTT_CLIENT_ID = os.getenv("MQTT_CLIENT_ID", "efortech-project-backend").strip()
ENERGY_PG_HOST = os.getenv("ENERGY_PG_HOST", "127.0.0.1").strip() or "127.0.0.1"
ENERGY_PG_PORT = _env_int("ENERGY_PG_PORT", 5432)
ENERGY_PG_DATABASE = os.getenv("ENERGY_PG_DATABASE", "postgres").strip() or "postgres"
ENERGY_PG_USER = os.getenv("ENERGY_PG_USER", "postgres").strip() or "postgres"
ENERGY_PG_PASSWORD = os.getenv("ENERGY_PG_PASSWORD", "").strip()
ENERGY_PG_ENABLED = _env_bool("ENERGY_PG_ENABLED", True)
ENERGY_PG_POOL_MIN_SIZE = _env_int("ENERGY_PG_POOL_MIN_SIZE", 1)
ENERGY_PG_POOL_MAX_SIZE = _env_int("ENERGY_PG_POOL_MAX_SIZE", 10)
PROJECT_QUEUE_ENABLED = _env_bool("PROJECT_QUEUE_ENABLED", True)
PROJECT_QUEUE_HOST = os.getenv("PROJECT_QUEUE_HOST", "127.0.0.1").strip() or "127.0.0.1"
PROJECT_QUEUE_PORT = _env_int("PROJECT_QUEUE_PORT", 6379)
PROJECT_QUEUE_DB = _env_int("PROJECT_QUEUE_DB", 0)
PROJECT_QUEUE_PASSWORD = os.getenv("PROJECT_QUEUE_PASSWORD", "").strip()
PROJECT_QUEUE_NAME = os.getenv("PROJECT_QUEUE_NAME", "project_energy_ingest").strip() or "project_energy_ingest"
PROJECT_QUEUE_GROUP = os.getenv("PROJECT_QUEUE_GROUP", "project_energy_workers").strip() or "project_energy_workers"
PROJECT_QUEUE_DLQ_NAME = os.getenv("PROJECT_QUEUE_DLQ_NAME", f"{PROJECT_QUEUE_NAME}_dlq").strip() or f"{PROJECT_QUEUE_NAME}_dlq"
PROJECT_QUEUE_MAXLEN = _env_int("PROJECT_QUEUE_MAXLEN", 100000)
PROJECT_QUEUE_RETRY_MAX = _env_int("PROJECT_QUEUE_RETRY_MAX", 5)
PROJECT_QUEUE_BLOCK_MS = _env_int("PROJECT_QUEUE_BLOCK_MS", 5000)
PROJECT_QUEUE_READ_COUNT = _env_int("PROJECT_QUEUE_READ_COUNT", 20)
PROJECT_QUEUE_CLAIM_IDLE_MS = _env_int("PROJECT_QUEUE_CLAIM_IDLE_MS", 60000)
PROJECT_QUEUE_BACKPRESSURE_LIMIT = _env_int("PROJECT_QUEUE_BACKPRESSURE_LIMIT", 90000)
PROJECT_WORKER_CONCURRENCY = _env_int("PROJECT_WORKER_CONCURRENCY", 2)
PROJECT_RAW_QUEUE_NAME = os.getenv("PROJECT_RAW_QUEUE_NAME", "project_raw_ingest").strip() or "project_raw_ingest"
PROJECT_RAW_QUEUE_GROUP = os.getenv("PROJECT_RAW_QUEUE_GROUP", "project_raw_workers").strip() or "project_raw_workers"
PROJECT_RAW_QUEUE_DLQ_NAME = os.getenv("PROJECT_RAW_QUEUE_DLQ_NAME", f"{PROJECT_RAW_QUEUE_NAME}_dlq").strip() or f"{PROJECT_RAW_QUEUE_NAME}_dlq"
PROJECT_RAW_WORKER_CONCURRENCY = _env_int("PROJECT_RAW_WORKER_CONCURRENCY", 2)
INFLUX_ENABLED = _env_bool("INFLUX_ENABLED", False)
INFLUX_URL = os.getenv("INFLUX_URL", "http://127.0.0.1:8086").strip() or "http://127.0.0.1:8086"
INFLUX_DATABASE_RAW = os.getenv("INFLUX_DATABASE_RAW", "energy_raw").strip() or "energy_raw"
INFLUX_USER = os.getenv("INFLUX_USER", "admin").strip() or "admin"
INFLUX_PASSWORD = os.getenv("INFLUX_PASSWORD", "").strip()
INFLUX_MEASUREMENT = os.getenv("INFLUX_MEASUREMENT", "energy_meter_raw").strip() or "energy_meter_raw"
APP_TIMEZONE = os.getenv("APP_TIMEZONE", "Asia/Jakarta").strip() or "Asia/Jakarta"
TIMEZONE_INFO = ZoneInfo(APP_TIMEZONE)
