import httpx

_HTTP_CLIENT: httpx.AsyncClient | None = None


async def startup_http_client():
    global _HTTP_CLIENT
    _HTTP_CLIENT = httpx.AsyncClient(
        follow_redirects=False,
        timeout=httpx.Timeout(40.0),
        limits=httpx.Limits(max_keepalive_connections=100, max_connections=200),
    )


async def shutdown_http_client():
    global _HTTP_CLIENT
    if _HTTP_CLIENT is not None:
        await _HTTP_CLIENT.aclose()
        _HTTP_CLIENT = None


def get_http_client() -> httpx.AsyncClient | None:
    return _HTTP_CLIENT
