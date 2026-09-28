# -*- coding: utf-8 -*-
"""Shared plumbing for the desk CLI: the one place every site-API trap is fixed.

Every agent session used to rewrite this from scratch and hit the same walls:
  - Cloudflare answers urllib's default user-agent with 403 / error 1010
  - the Windows console is GBK, so printing a customer's text crashes
  - non-ASCII pushed through a shell argument arrives mangled (09-18 a
    customer got "10�C14" on an invoice), so bodies travel as UTF-8 bytes
  - a 409 from sms-thread is a brake, not a failure, and must be read
Nothing here contains business rules; it only talks to the endpoints.
"""
from __future__ import annotations

import json
import pathlib
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]  # realhibachi-marketing/
ENV_FILE = ROOT / ".env.local"
import os

# DESK_SITE=http://localhost:3000 points the site calls at a dev server (the
# invoice app is always the live one - there is no local copy of it here).
SITE = os.environ.get("DESK_SITE", "https://www.realhibachi.com").rstrip("/")
INVOICE = "https://invoice.realhibachi.com"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36"

# The console must be able to print any customer text, whatever its code page.
for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass


class ApiError(Exception):
    """A non-2xx answer. `status` and the decoded JSON (or text) are kept so a
    caller can tell a brake (409) from a real failure."""

    def __init__(self, status: int, payload):
        self.status = status
        self.payload = payload
        super().__init__(f"HTTP {status}: {json.dumps(payload, ensure_ascii=False)[:300]}")


def env(name: str) -> str:
    """Read one key from .env.local without ever printing it."""
    text = ENV_FILE.read_text(encoding="utf-8", errors="ignore")
    m = re.search(rf"^{re.escape(name)}=(.+)$", text, re.M)
    if not m:
        raise SystemExit(f"{name} not found in {ENV_FILE}")
    return m.group(1).strip().strip('"').strip("'")


def _call(method: str, url: str, payload=None, *, admin: bool, timeout: int = 90):
    headers = {"user-agent": UA, "accept": "application/json"}
    if admin:
        headers["x-admin-key"] = env("ADMIN_DASH_KEY")
    data = None
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["content-type"] = "application/json"
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            body = json.loads(raw.decode("utf-8", "replace"))
        except ValueError:
            body = raw.decode("utf-8", "replace")[:500]
        raise ApiError(e.code, body) from None
    try:
        return json.loads(raw.decode("utf-8"))
    except ValueError:
        return raw.decode("utf-8", "replace")


def site_get(path: str, params: dict | None = None, *, admin: bool = True, timeout: int = 90):
    q = ("?" + urllib.parse.urlencode(params)) if params else ""
    return _call("GET", SITE + path + q, admin=admin, timeout=timeout)


def site_post(path: str, payload: dict, *, method: str = "POST", timeout: int = 90):
    return _call(method, SITE + path, payload, admin=True, timeout=timeout)


def invoice_post(path: str, payload: dict, timeout: int = 120):
    """The invoice app has no admin key; its self-service endpoints are open."""
    return _call("POST", INVOICE + path, payload, admin=False, timeout=timeout)


def e164(phone: str) -> str:
    digits = re.sub(r"\D", "", phone or "")
    if len(digits) == 10:
        digits = "1" + digits
    if len(digits) != 11 or not digits.startswith("1"):
        raise SystemExit(f"not a US number: {phone!r}")
    return "+" + digits


def is_uuid(s: str) -> bool:
    return bool(re.fullmatch(r"[0-9a-f-]{36}", s or "", re.I))


def read_text_arg(value: str | None, file: str | None) -> str:
    """A message body: from --body-file (bytes, UTF-8) when given, else the
    argument. Files are the safe path for anything non-ASCII on Windows."""
    if file:
        return pathlib.Path(file).read_bytes().decode("utf-8").strip()
    if value is None:
        raise SystemExit("give a body or --body-file")
    return value.strip()


def dump(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=1)


def pt(iso: str | None) -> str:
    """ISO timestamp -> 'MM-DD HH:MM PT' (customers and the desk share the
    Pacific clock; the API speaks UTC)."""
    if not iso:
        return "-"
    from datetime import datetime, timezone
    from zoneinfo import ZoneInfo

    try:
        t = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except ValueError:
        return iso[:16]
    if t.tzinfo is None:
        t = t.replace(tzinfo=timezone.utc)
    return t.astimezone(ZoneInfo("America/Los_Angeles")).strftime("%m-%d %H:%M")
