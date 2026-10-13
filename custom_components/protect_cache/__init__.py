"""Server side of the unifi-protect-timeline-card.

Three jobs:

1. Serve the card's two caches from outside `www/` (unauthenticated static,
   exactly like `/local`):
       /protect_scrub/<camera_object_id>/...   <- config/.cache/protect_scrub
       /protect_thumbs/<camera_object_id>/...  <- config/.cache/protect_thumbs
   They used to live under `config/www/`, but HA Core's backup walks the whole
   config directory and there is NO user-configurable exclude on Container
   installs (`include_folders` is Supervisor-only) - so every nightly backup
   carried the entire cache (~7 GB/night, also uploaded to the cloud agent).
   The only exclusions are the hardcoded ones in
   `homeassistant/components/backup/const.py:EXCLUDE_FROM_BACKUP`, which include
   `.cache/*`; securetar skips those DIRECTORY entries before recursing, so
   anything under `config/.cache/<name>/` is pruned whole. A symlink from
   `www/` back to `.cache/` does NOT work: aiohttp's StaticResource is created
   with `follow_symlinks=False` and 404s a target outside `config/www`.

2. Relay the NVR's own fMP4 playback/live streams to the card's player
   (`nvr_stream.py`, authenticated with a signed path):
       GET    /api/protect_stream/ws   (websocket)

3. Build the scrub-preview photos in config/.cache/protect_scrub from the NVR's
   keyframes (`scrub.py`):
       action protect_cache.scrub_sync   (the job also runs itself every 15 s)

The event/thumbnail cache is written by pyscript/protect_thumbs.py.

Until 3.0 this component also hosted clip sessions (export -> faststart remux
-> Range-served file) and kept HA's live streams warm; the single-player engine
made both unnecessary and they were removed (see the v2.3.2 tag).
"""

from __future__ import annotations

import logging
import os

from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant
from homeassistant.helpers.typing import ConfigType

from .nvr_stream import async_setup_nvr_stream
from .scrub import async_setup_scrub

_LOGGER = logging.getLogger(__name__)

DOMAIN = "protect_cache"

# Directory name under config/.cache/ -> URL path it is served at. Keeping the
# names identical to the old www/ folders keeps the on-disk layout recognisable.
CACHE_DIRS = {
    "protect_scrub": "/protect_scrub",
    "protect_thumbs": "/protect_thumbs",
}


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Serve the caches, register the stream relay, start the scrub job."""
    base = hass.config.path(".cache")

    def _ensure_dirs() -> dict[str, str]:
        # HA skips (silently) any static path whose directory doesn't exist, and
        # the jobs only create their own per-camera subdirectories.
        paths: dict[str, str] = {}
        for name in CACHE_DIRS:
            path = os.path.join(base, name)
            os.makedirs(path, exist_ok=True)
            paths[name] = path
        return paths

    paths = await hass.async_add_executor_job(_ensure_dirs)

    await hass.http.async_register_static_paths(
        [
            # cache_headers=True mirrors /local (CachingStaticResource, 1-month
            # Cache-Control). The card forces no-cache on index.json and the
            # manifest, the only files rewritten in place; everything else is
            # immutable once written (names carry the time range they cover).
            StaticPathConfig(url, paths[name], True)
            for name, url in CACHE_DIRS.items()
        ]
    )
    _LOGGER.debug("Serving Protect caches from %s", base)

    # The NVR's own playback/live streams for the card's player (see nvr_stream.py).
    async_setup_nvr_stream(hass)
    # Scrub-preview photos from the NVR's keyframes (see scrub.py).
    await async_setup_scrub(hass, config)
    return True
