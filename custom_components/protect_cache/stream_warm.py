"""Keep Home Assistant's live HLS streams warm while a camera UI is on screen.

Why this exists
---------------
A cold `stream` worker cannot answer its first playlist until a whole segment
exists: the master playlist handler waits for one complete segment plus the
start of the next, and a segment can only close on a keyframe. With UniFi's
~5 s keyframe interval that is 6-7 s from the tap to the first high-resolution
frame (measured on the wall tablet: master playlist answered after 6.1 s and
6.3 s), and a freshly started playlist holding a single segment is also where
hls.js was seen re-downloading that segment ~24 times in 5 s.

HA stops an HLS output 30 s after its last segment/part request
(`OUTPUT_IDLE_TIMEOUT`), and only those requests wake it — playlist requests do
not. So keeping a stream warm from the browser means downloading a 0.2-1 MB part
every 20-30 s per camera. This endpoint does it server-side instead: it starts
the worker and wakes its idle timer, and the card calls it every ~20 s ONLY while
one of its camera pages is visible. Nothing is sent to the client; the cost is
the NVR->HA stream and HA's remux for the cameras on screen, and it stops by
itself 30 s after the card stops asking (hidden, closed, screen off).

`preload_stream` does the same thing permanently (a camera preference). That is
a continuous cost the card has no business switching on behind the user's back.

    POST /api/protect_clip/warm   {"entity_ids": ["camera.x", ...]}
"""

from __future__ import annotations

import asyncio
import logging

from aiohttp import web

from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError

_LOGGER = logging.getLogger(__name__)

# More than any sane camera page shows at once; bounds what one request can start.
MAX_WARM = 8
HLS_PROVIDER = "hls"


class ProtectStreamWarmView(HomeAssistantView):
    """Start (or keep alive) the HLS stream of each listed camera."""

    url = "/api/protect_clip/warm"
    name = "api:protect_clip:warm"
    requires_auth = True

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass

    async def post(self, request: web.Request) -> web.Response:
        try:
            body = await request.json()
        except ValueError:
            return self.json_message("Invalid JSON body", web.HTTPBadRequest.status_code)
        ids = body.get("entity_ids") if isinstance(body, dict) else None
        if not isinstance(ids, list) or not all(isinstance(i, str) for i in ids):
            return self.json_message("entity_ids must be a list", web.HTTPBadRequest.status_code)

        warm: list[str] = []
        failed: dict[str, str] = {}
        for entity_id in list(dict.fromkeys(ids))[:MAX_WARM]:
            if not entity_id.startswith("camera."):
                failed[entity_id] = "not a camera"
                continue
            try:
                async with asyncio.timeout(5):
                    await self._warm(entity_id)
                warm.append(entity_id)
            except (HomeAssistantError, TimeoutError) as err:
                failed[entity_id] = str(err) or type(err).__name__
        return self.json({"warm": warm, "failed": failed})

    async def _warm(self, entity_id: str) -> None:
        from homeassistant.components.camera.helper import get_camera_from_entity_id

        camera = get_camera_from_entity_id(self.hass, entity_id)
        stream = await camera.async_create_stream()
        if stream is None:
            raise HomeAssistantError("camera has no stream")
        output = stream.add_provider(HLS_PROVIDER)
        await stream.start()
        # The same call a segment request makes: push the idle deadline out
        # another OUTPUT_IDLE_TIMEOUT (30 s).
        output.idle_timer.awake()


def async_setup_stream_warm(hass: HomeAssistant) -> None:
    """Register the warm-up endpoint."""
    hass.http.register_view(ProtectStreamWarmView(hass))
