import ipaddress
import os
import re
import socket
import subprocess
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


_IPV4_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")


def _windows_subnets_from_ipconfig() -> list[ipaddress.IPv4Network]:
    # Parse Windows `ipconfig` output to get real subnet prefix/mask.
    try:
        result = subprocess.run(
            ["ipconfig"],
            capture_output=True,
            text=True,
            check=False,
        )
    except Exception:
        return []

    if result.returncode != 0 or not result.stdout:
        return []

    subnets: list[ipaddress.IPv4Network] = []
    current_ip: str | None = None

    for raw_line in result.stdout.splitlines():
        line = raw_line.strip()
        if not line:
            current_ip = None
            continue

        lower = line.lower()
        ipv4_values = _IPV4_RE.findall(line)
        if not ipv4_values:
            continue

        # Example: "IPv4 Address. . . . . . . . . . . : 192.168.1.35"
        if "ipv4" in lower:
            candidate = ipv4_values[0]
            if candidate.startswith("127."):
                current_ip = None
                continue
            current_ip = candidate
            continue

        # Example: "Subnet Prefix  . . . . . . . . . . : 192.168.1.0/24 ..."
        if "subnet prefix" in lower:
            cidr_match = re.search(r"\b(?:\d{1,3}\.){3}\d{1,3}/\d{1,2}\b", line)
            if cidr_match:
                try:
                    subnets.append(ipaddress.ip_network(cidr_match.group(0), strict=False))
                except Exception:
                    pass
                continue

            # Some variants only show mask; fallback to current interface IP.
            if current_ip:
                mask_match = re.search(r"mask\s+((?:\d{1,3}\.){3}\d{1,3})", lower)
                if mask_match:
                    try:
                        prefix = ipaddress.ip_network(f"0.0.0.0/{mask_match.group(1)}").prefixlen
                        subnets.append(ipaddress.ip_network(f"{current_ip}/{prefix}", strict=False))
                    except Exception:
                        pass
            continue

        # Example: "Subnet Mask . . . . . . . . . . . : 255.255.255.0"
        if "subnet mask" in lower and current_ip:
            mask = ipv4_values[0]
            try:
                prefix = ipaddress.ip_network(f"0.0.0.0/{mask}").prefixlen
                subnets.append(ipaddress.ip_network(f"{current_ip}/{prefix}", strict=False))
            except Exception:
                pass

    # Remove duplicates while preserving order.
    seen: set[str] = set()
    uniq: list[ipaddress.IPv4Network] = []
    for subnet in subnets:
        key = str(subnet)
        if key in seen:
            continue
        seen.add(key)
        uniq.append(subnet)
    return uniq


def local_subnets_from_interfaces() -> list[ipaddress.IPv4Network]:
    # Prefer accurate subnet detection on Windows via ipconfig parsing.
    windows_subnets = _windows_subnets_from_ipconfig()
    if windows_subnets:
        return windows_subnets

    # Cross-platform fallback: collect host IPv4s and assume /24.
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
