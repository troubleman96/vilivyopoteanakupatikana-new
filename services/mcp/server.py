"""Read-only FastMCP adapter over the public Vilivyopotea API."""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from fastmcp import FastMCP

API_BASE_URL = os.environ.get(
    "VILIVY_API_BASE_URL", "http://localhost:8080/api/v1"
).rstrip("/")
REQUEST_TIMEOUT_SECONDS = 4

mcp = FastMCP(
    "Vilivyopotea public discovery",
    instructions=(
        "Read-only access to reviewed public lost-and-found listings and the active "
        "institution directory. Never request or expose private claims, contact "
        "details, evidence, staff notes, or withheld identifying clues. A possible "
        "match is never proof of ownership."
    ),
)


def _validate_query(query: str) -> str:
    value = query.strip()
    if not 2 <= len(value) <= 120:
        raise ValueError("Search text must be between 2 and 120 characters.")
    if "@" in value or len(re.sub(r"\D", "", value)) >= 8:
        raise ValueError("Search text must not contain contact or account details.")
    if re.search(r"https?://|www\.", value, flags=re.IGNORECASE):
        raise ValueError("Search text must be a short item description.")
    return value


def _request_json(path: str, query: dict[str, str] | None = None) -> Any | None:
    url = f"{API_BASE_URL}/{path.lstrip('/')}"
    if query:
        url = f"{url}?{urllib.parse.urlencode(query)}"
    request = urllib.request.Request(
        url,
        headers={"Accept": "application/json", "User-Agent": "vilivyopotea-mcp/1.0"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            return json.loads(response.read(1_000_001))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        return None


def _bounded_text(value: Any, maximum: int) -> str:
    if not isinstance(value, str):
        return ""
    return value.strip()[:maximum]


def _project_public_item(value: Any) -> dict[str, str] | None:
    """Return an allow-listed public projection; ignore every unknown/private key."""
    if not isinstance(value, dict):
        return None
    item_id = _bounded_text(value.get("id"), 80)
    title = _bounded_text(value.get("title"), 120)
    if not item_id or not title:
        return None
    return {
        "id": item_id,
        "title": title,
        "category": _bounded_text(value.get("category"), 60),
        "kind": _bounded_text(value.get("kind"), 20),
        "status": _bounded_text(value.get("status"), 30),
        "institution_name": _bounded_text(value.get("institution_name"), 100),
        "description": _bounded_text(value.get("description"), 400),
        "approximate_area": _bounded_text(value.get("location"), 120),
        "occurred_on": _bounded_text(value.get("occurred_on"), 20),
    }


def _project_institution(value: Any) -> dict[str, str] | None:
    if not isinstance(value, dict):
        return None
    institution_id = _bounded_text(value.get("id"), 80)
    name = _bounded_text(value.get("name"), 100)
    if not institution_id or not name:
        return None
    return {
        "id": institution_id,
        "name": name,
        "region": _bounded_text(value.get("region"), 80),
    }


def search_public_listings(query: str, limit: int = 10) -> dict[str, Any]:
    """Search reviewed public-safe listing summaries using a generic description."""
    safe_query = _validate_query(query)
    if not 1 <= limit <= 25:
        raise ValueError("Limit must be between 1 and 25.")
    payload = _request_json("items", {"q": safe_query})
    if not isinstance(payload, dict) or not isinstance(payload.get("data"), list):
        return {"status": "unavailable", "items": []}
    items = [
        projected
        for row in payload["data"]
        if (projected := _project_public_item(row)) is not None
    ][:limit]
    return {"status": "ok", "items": items, "count": len(items)}


def get_public_listing(item_id: str) -> dict[str, Any]:
    """Fetch one reviewed public listing by its public identifier."""
    safe_id = item_id.strip()
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,79}", safe_id):
        raise ValueError("A valid public listing identifier is required.")
    payload = _request_json(f"items/{urllib.parse.quote(safe_id, safe='')}")
    if not isinstance(payload, dict):
        return {"status": "unavailable", "item": None}
    projected = _project_public_item(payload.get("data"))
    if projected is None:
        return {"status": "not_found", "item": None}
    return {"status": "ok", "item": projected}


def list_active_institutions() -> dict[str, Any]:
    """List active institutions using the API's public directory."""
    payload = _request_json("institutions")
    if not isinstance(payload, dict) or not isinstance(payload.get("data"), list):
        return {"status": "unavailable", "institutions": []}
    institutions = [
        projected
        for row in payload["data"]
        if (projected := _project_institution(row)) is not None
    ]
    return {"status": "ok", "institutions": institutions}


mcp.tool(search_public_listings)
mcp.tool(get_public_listing)
mcp.tool(list_active_institutions)


@mcp.resource("vilivyopotea://safe-use")
def safe_use_resource() -> str:
    """Describe the data and decision boundaries for this public-only server."""
    return (
        "This MCP server exposes reviewed public-safe item summaries and the active "
        "institution directory only. It cannot read claims, contact details, private "
        "evidence, staff notes, or administrator data and cannot submit or change "
        "records. Similarity suggestions are leads only; people verify ownership. "
        "All repository demo records and institution names are fictional."
    )


def main() -> None:
    transport = os.environ.get("MCP_TRANSPORT", "stdio").strip().lower()
    if transport == "stdio":
        mcp.run()
        return
    if transport != "http":
        raise ValueError("MCP_TRANSPORT must be either 'stdio' or 'http'.")
    host = os.environ.get("MCP_HOST", "127.0.0.1")
    port = int(os.environ.get("MCP_PORT", "8100"))
    mcp.run(transport="http", host=host, port=port)


if __name__ == "__main__":
    main()
