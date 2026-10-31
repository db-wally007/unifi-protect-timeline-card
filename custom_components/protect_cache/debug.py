"""Field telemetry from the card (opt-in: `debug: true` in the card's config).

Problems that only happen on a real device - the wall tablet's decoder, an
iPhone's ManagedMediaSource, a talk session's echo - cannot be reproduced in a
headless browser. With `debug` on, the card batches what its player, Talk and
the device actually do and POSTs it here (`/api/protect_cache/debug`, normal
HA auth). Each batch becomes one JSON line in
    config/.cache/protect_debug/<YYYY-MM-DD>/<client>.jsonl
stamped with the server's receive time `rx` (device clocks can be off; `rx`
minus the batch's own `sent` aligns them). `.cache/` is skipped by HA backups,
nothing here is ever served back, files are capped and days pruned.

Only timings, states and levels are recorded - never footage or microphone
audio (Talk sends its level per 20 ms frame, not the sound).
"""

from __future__ import annotations

import json
import os
import re
import shutil
import time
from typing import Any

from aiohttp import web

from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant

MAX_BODY = 1024 * 1024          # one batch
MAX_FILE = 20 * 1024 * 1024     # one client's day
KEEP_DAYS = 7
_SAFE = re.compile(r"[^A-Za-z0-9_-]")


class ProtectDebugView(HomeAssistantView):
    """The card's telemetry sink."""

    url = "/api/protect_cache/debug"
    name = "api:protect_cache:debug"
    requires_auth = True

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.base = hass.config.path(".cache", "protect_debug")

    async def post(self, request: web.Request) -> web.Response:
        if (request.content_length or 0) > MAX_BODY:
            return self.json_message("batch too large", 413)
        try:
            body: Any = await request.json()
        except ValueError:
            return self.json_message("not JSON", 400)
        if not isinstance(body, dict):
            return self.json_message("not an object", 400)
        now = time.time() * 1000
        client = _SAFE.sub("", str(body.get("client") or ""))[:48] or "unknown"
        user = request.get("hass_user")
        line = json.dumps(
            {"rx": round(now), "user": getattr(user, "name", None), **body},
            separators=(",", ":"),
        )
        await self.hass.async_add_executor_job(self._append, client, line)
        return self.json({"ok": True, "now": round(now)})

    def _append(self, client: str, line: str) -> None:
        day = time.strftime("%Y-%m-%d")
        folder = os.path.join(self.base, day)
        if not os.path.isdir(folder):
            os.makedirs(folder, exist_ok=True)
            self._prune(day)
        path = os.path.join(folder, f"{client}.jsonl")
        try:
            if os.path.getsize(path) > MAX_FILE:
                return
        except OSError:
            pass
        with open(path, "a", encoding="utf-8") as f:
            f.write(line + "\n")

    def _prune(self, today: str) -> None:
        cutoff = time.strftime("%Y-%m-%d", time.localtime(time.time() - KEEP_DAYS * 86400))
        for name in os.listdir(self.base):
            if re.fullmatch(r"\d{4}-\d{2}-\d{2}", name) and name < cutoff and name != today:
                shutil.rmtree(os.path.join(self.base, name), ignore_errors=True)


_view: ProtectDebugView | None = None


def async_setup_debug(hass: HomeAssistant) -> None:
    """Register the telemetry sink."""
    global _view  # noqa: PLW0603 - one sink per HA instance
    _view = ProtectDebugView(hass)
    hass.http.register_view(_view)


async def async_write_debug(hass: HomeAssistant, client: str, record: dict[str, Any]) -> None:
    """Server-side telemetry (e.g. a talk session), next to the card's own."""
    if _view is None:
        return
    line = json.dumps({"rx": round(time.time() * 1000), "server": True, **record}, separators=(",", ":"))
    await hass.async_add_executor_job(_view._append, _SAFE.sub("", client)[:48] or "server", line)
