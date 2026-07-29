"""Serve the UniFi Protect scrub/thumbnail caches from outside `www/`.

Why this exists
---------------
The pyscript jobs `protect_scrub` and `protect_thumbs` maintain large rolling
caches (several GB of timelapse mp4s + event jpgs) for the
`unifi-protect-timeline-card`. They used to live under `config/www/` so the
frontend could reach them at `/local/...`, but HA Core's backup walks the whole
config directory and there is NO user-configurable exclude on Container installs
(`include_folders` is Supervisor-only) — so every nightly backup carried the
entire cache verbatim (~7 GB/night, also uploaded to the cloud agent).

The only exclusions are the hardcoded ones in
`homeassistant/components/backup/const.py:EXCLUDE_FROM_BACKUP`, which include
`.cache/*`. securetar evaluates that filter on DIRECTORY entries and skips them
before recursing, so anything under `config/.cache/<name>/` is pruned whole.

A symlink from `www/` back to `.cache/` does NOT work: aiohttp's StaticResource
is created with `follow_symlinks=False`, so it resolves the request path and
requires the result to stay under `config/www` — a symlinked target outside it
404s. Hence this integration, which registers the relocated directories as their
own static paths.

URLs served (unauthenticated static, exactly like `/local`):
    /protect_scrub/<camera_object_id>/...   <- config/.cache/protect_scrub
    /protect_thumbs/<camera_object_id>/...  <- config/.cache/protect_thumbs

This integration ALSO hosts the card's on-demand clip sessions (authenticated,
transient, self-cleaning) — see `clip_session.py` for why they exist:
    POST   /api/protect_clip/session
    DELETE /api/protect_clip/session/<sid>
    GET    /api/protect_clip/media/<sid>/clip.mp4    (HTTP Range / seekable)
"""

from __future__ import annotations

import logging
import os

from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant
from homeassistant.helpers.typing import ConfigType

from .clip_session import async_setup_clip_sessions

_LOGGER = logging.getLogger(__name__)

DOMAIN = "protect_cache"

# Directory name under config/.cache/ -> URL path it is served at. Keeping the
# names identical to the old www/ folders keeps the on-disk layout recognisable.
CACHE_DIRS = {
    "protect_scrub": "/protect_scrub",
    "protect_thumbs": "/protect_thumbs",
}


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Register a static path for each relocated cache directory."""
    base = hass.config.path(".cache")

    def _ensure_dirs() -> dict[str, str]:
        # HA skips (silently) any static path whose directory doesn't exist, and
        # the pyscript jobs only create their own per-camera subdirectories.
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
            # Cache-Control). The card's loaders already force no-cache/no-store
            # on the files that are rewritten in place (index.json, the sidecar
            # maps and head.mp4); everything else is immutable once written.
            StaticPathConfig(url, paths[name], True)
            for name, url in CACHE_DIRS.items()
        ]
    )
    _LOGGER.debug("Serving Protect caches from %s", base)

    # Transient per-playback clip sessions (see clip_session.py).
    await async_setup_clip_sessions(hass)
    return True
