import ipaddress
import os
import socket
from datetime import datetime
from urllib.parse import urlparse

from .config import ALLOWED_ORIGINS, PORT


def normalize_ip(raw: str | None) -> str:
    value = (raw or "").strip()
    if value.startswith("::ffff:"):
        return value[7:]
    if value == "::1":
        return "127.0.0.1"
    return value


def is_weekend(now: datetime | None = None) -> bool:
    now = now or datetime.now()
    return now.weekday() >= 5


def get_week_key(now: datetime | None = None) -> str:
    now = now or datetime.now()
    year, week, _ = now.isocalendar()
    return f"{year}-W{week}"


def local_subnets_from_interfaces() -> list[ipaddress.IPv4Network]:
    # Best effort: collect host IPv4s and assume /24 when netmask is unknown.
    subnets: list[ipaddress.IPv4Network] = []
    try:
        infos = socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET)
    except Exception:
        infos = []

    seen: set[str] = set()
    for info in infos:
        ip = info[4][0]
        if ip.startswith("127.") or ip in seen:
            continue
        seen.add(ip)
        try:
            subnets.append(ipaddress.ip_network(f"{ip}/24", strict=False))
        except Exception:
            continue
    return subnets


_ENV_SUBNET = (os.getenv("ALLOWED_SUBNET_CIDR") or "").strip()
if _ENV_SUBNET:
    try:
        ALLOWED_SUBNETS = [ipaddress.ip_network(_ENV_SUBNET, strict=False)]
    except Exception:
        ALLOWED_SUBNETS = []
else:
    ALLOWED_SUBNETS = local_subnets_from_interfaces()


def ip_in_allowed_subnet(raw_ip: str) -> bool:
    if not ALLOWED_SUBNETS:
        return True
    try:
        addr = ipaddress.ip_address(raw_ip)
    except Exception:
        return False
    return addr.version == 4 and any(addr in subnet for subnet in ALLOWED_SUBNETS)


def is_allowed_origin(origin: str | None) -> bool:
    if not origin:
        return True
    if origin in ALLOWED_ORIGINS:
        return True
    try:
        parsed = urlparse(origin)
    except Exception:
        return False

    if parsed.scheme not in ("http", "https"):
        return False

    host = normalize_ip(parsed.hostname)
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    allowed_ports = {PORT, 5173, 4173}

    if host in ("localhost", "127.0.0.1"):
        return port in allowed_ports
    return ip_in_allowed_subnet(host) and port in allowed_ports


def build_request_origin(headers: dict[str, str], scheme: str) -> str:
    host = headers.get("x-forwarded-host") or headers.get("host", "")
    proto = headers.get("x-forwarded-proto") or scheme or "http"
    return f"{proto}://{host}"
