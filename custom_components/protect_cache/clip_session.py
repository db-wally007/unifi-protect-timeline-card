"""On-demand, self-cleaning clip sessions for the unifi-protect-timeline-card.

Why this exists
---------------
The card used to play a recorded event by downloading the WHOLE export into a
JS Blob and handing the object URL to `<video>`. That was not a stylistic
choice — it was forced by two properties of the NVR's export, both measured:

1. `/api/unifiprotect/video/...` (core's `VideoProxyView`) is a plain
   `web.StreamResponse` byte passthrough that IGNORES `Range:` — it answers 200
   with the entire body and no `Accept-Ranges`. A streamed `<video>` therefore
   could not seek at all.
2. The NVR writes the MP4 index LAST (`ftyp`, `mdat`, `moov`). Without the
   `moov` box up front a player cannot start, let alone seek, so it has to read
   to the very end regardless.

A Blob solves both by materialising the file in memory. But at ~52 MB per
minute of 4K, a 7-minute event is ~370 MB resident and ~740 MB at the moment
the byte chunks are copied into the Blob — which is past what iOS allows a
WKWebView content process. iOS kills the process and the Companion app reloads
at the default dashboard, i.e. "it bounces me back to the homepage exactly when
the download finishes".

The fix is to materialise the clip HERE instead of on the phone: export it,
remux it so `moov` is at the front (`+faststart`), and serve the result as a
plain file. aiohttp's `FileResponse` then gives real HTTP Range for free, so the
phone streams and seeks natively while holding only its own player buffer.

Remuxing cannot be done on the fly — both ends need a seekable file:
    cat export.mp4 | ffmpeg -i pipe:0 ...   -> "partial file" / demux error
                                               (moov is last; a pipe can't seek back)
    ffmpeg ... -movflags +faststart pipe:1  -> "muxer does not support non seekable output"
                                               (faststart is a two-pass rewrite)
Hence the session directory below. It is transient by design: nothing is
retained between plays, so the same clip requested twice is remuxed twice. That
is deliberate — this is a scratch space, not a library. It follows Plex's
transcoder-session model: a private dir per playback, deleted when playback
ends, and stale dirs swept whenever a new session starts so an orphan left by a
crashed client can never accumulate.
"""

from __future__ import annotations

import asyncio
import logging
import os
import secrets
import shutil
import time
from contextlib import suppress
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from aiohttp import web

from homeassistant.components.http import HomeAssistantView
from homeassistant.components.http.auth import async_sign_path
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr, entity_registry as er

_LOGGER = logging.getLogger(__name__)

SESSIONS_DIR = "protect_sessions"

# Guard-rails, not a disk budget: this host has ~346 GB free and the previous
# disk-full incident was unpruned BACKUPS sweeping in a cache, not capacity.
# These exist so one pathological request can't run away.
MAX_CONCURRENT_SESSIONS = 8
SESSION_TTL = timedelta(minutes=30)

# A merged display event is NOT a clip: the card's gap-merge turned 43 raw motion
# events into one 37m56s row, and asking for that span in one request measured
# 34.9 s and 1.29 GB on disk (plus the same again through the remux) — while the
# NVR also feeds the live streams. The card now plays such a row as a playlist of
# ~120 s segments, so this ceiling is a backstop against a bug or a hand-written
# config, not a normal path. Measured rate: ~50 MB per minute of footage.
MAX_CLIP_SECONDS = 600  # 10 min ~= 525 MB, ~17 s to prepare

# How long ONE export may take before it is abandoned. uiprotect asks the NVR
# with timeout=0 (no timeout at all), so without this a wedged export holds a
# request, a worker and a session directory indefinitely.
EXPORT_TIMEOUT_S = 180

# Concurrent BUILDS. The work is one NVR export plus a whole-file remux, so
# letting eight run at once multiplies disk traffic and NVR load precisely when
# the user is already waiting. Extra requests queue instead — and identical ones
# do not even queue, they share the build in flight (see _inflight).
MAX_CONCURRENT_BUILDS = 2

# The export is streamed to disk by uiprotect (aiofiles), so HA's own memory
# stays flat — otherwise we'd merely have moved the 370 MB problem off the phone
# and into the Python heap.
RAW_NAME = "raw.mp4"
CLIP_NAME = "clip.mp4"


async def _ffmpeg_faststart(raw: str, out: str) -> None:
    """Move `moov` to the front. Stream copy — no re-encode, ~0.3 s for 239 MB.

    An asyncio subprocess, NOT `subprocess.run` in an executor: HA runs its
    aiohttp app with `handler_cancellation=True`, so a client that gives up
    cancels this coroutine — but a thread already inside `subprocess.run` cannot
    be cancelled, so every abandoned request used to leave its ffmpeg grinding
    through a multi-hundred-MB file. Retapping a slow clip therefore piled up
    work that nothing could stop. Here cancellation propagates: the process is
    killed and the partial output removed.
    """
    tmp = f"{out}.tmp"
    proc: asyncio.subprocess.Process | None = None
    try:
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-y", "-v", "error",
            "-i", raw,
            "-c", "copy",
            "-movflags", "+faststart",
            # -f is REQUIRED: the temp name ends in `.tmp`, and without an
            # extension it recognises ffmpeg refuses to pick a muxer
            # ("Unable to choose an output format").
            "-f", "mp4",
            tmp,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            _, stderr = await asyncio.wait_for(proc.communicate(), timeout=300)
        except TimeoutError as err:
            raise RuntimeError("ffmpeg remux timed out") from err
        if proc.returncode != 0:
            # Surface ffmpeg's own message — a bare exit code says nothing.
            detail = stderr.decode("utf-8", "replace").strip().splitlines()
            raise RuntimeError(
                f"ffmpeg failed ({proc.returncode}): {detail[0] if detail else '?'}"
            )
        # Publish atomically: the URL is only ever handed out after this, but a
        # rename also means a crashed remux can never leave a servable stub.
        await asyncio.to_thread(os.replace, tmp, out)
    finally:
        if proc is not None and proc.returncode is None:
            with suppress(ProcessLookupError):
                proc.kill()
            with suppress(Exception):
                await proc.wait()
        if await asyncio.to_thread(os.path.exists, tmp):
            await asyncio.to_thread(os.unlink, tmp)


@dataclass
class _Build:
    """One in-flight build and how many clients are still waiting for it."""

    task: asyncio.Task[tuple[str, int]]
    waiters: int = 0


class ClipSessionManager:
    """Owns the session directories: create, sweep, destroy."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.root = hass.config.path(".cache", SESSIONS_DIR)
        # Serialises the sweep/count/mkdir critical section only. The export and
        # remux happen OUTSIDE it so concurrent viewers don't queue behind each
        # other — multi-user is the whole point of per-session dirs.
        self._bookkeeping = asyncio.Lock()
        # Sessions currently being built. The sweep must not evict one of these:
        # at capacity it deletes the OLDEST directory, which can be a build in
        # progress — the export then writes on happily to an unlinked inode and
        # the remux fails on a file nobody can serve.
        self._building: set[str] = set()
        self._build_slots = asyncio.Semaphore(MAX_CONCURRENT_BUILDS)
        # Identical in-flight requests (same camera + range), so the retaps that
        # a slow export invites share one build instead of starting another.
        self._inflight: dict[str, _Build] = {}

    # ---- paths ------------------------------------------------------------

    def session_dir(self, sid: str) -> str:
        return os.path.join(self.root, sid)

    def clip_path(self, sid: str) -> str:
        return os.path.join(self.root, sid, CLIP_NAME)

    # ---- sweeping ---------------------------------------------------------

    def _sweep_sync(self) -> int:
        """Delete expired session dirs; return how many survive.

        Runs on every session start, so an orphan from a client that crashed or
        was force-quit (no DELETE ever arrives) lives at most SESSION_TTL.
        """
        os.makedirs(self.root, exist_ok=True)
        cutoff = time.time() - SESSION_TTL.total_seconds()
        alive: list[tuple[float, str]] = []
        for name in os.listdir(self.root):
            path = os.path.join(self.root, name)
            if not os.path.isdir(path):
                continue
            try:
                mtime = os.stat(path).st_mtime
            except OSError:
                continue
            if mtime < cutoff:
                _LOGGER.debug("Sweeping expired clip session %s", name)
                shutil.rmtree(path, ignore_errors=True)
            else:
                alive.append((mtime, path))

        # At capacity, evict oldest-first rather than refusing the request: the
        # user pressing play is a better claim on the space than a stale session.
        alive.sort()
        while len(alive) >= MAX_CONCURRENT_SESSIONS:
            _, victim = alive.pop(0)
            if os.path.basename(victim) in self._building:
                continue  # never evict a session someone is still waiting for
            _LOGGER.debug("Evicting oldest clip session %s (at capacity)", victim)
            shutil.rmtree(victim, ignore_errors=True)
        return len(alive)

    async def create(self) -> str:
        """Sweep, then allocate a fresh session directory."""
        async with self._bookkeeping:
            await self.hass.async_add_executor_job(self._sweep_sync)
            sid = secrets.token_urlsafe(16)
            await self.hass.async_add_executor_job(
                lambda: os.makedirs(self.session_dir(sid), exist_ok=True)
            )
            return sid

    def _forget(self, key: str, build: _Build) -> None:
        """Drop a finished build from the in-flight map (done-callback)."""
        if self._inflight.get(key) is build:
            self._inflight.pop(key, None)

    async def destroy(self, sid: str) -> bool:
        """Remove one session directory. Safe to call twice."""
        path = self.session_dir(sid)
        if not os.path.isdir(path):
            return False
        await self.hass.async_add_executor_job(
            lambda: shutil.rmtree(path, ignore_errors=True)
        )
        return True

    # ---- the actual work --------------------------------------------------

    async def build(self, sid: str, api: Any, camera_id: str, start: datetime, end: datetime) -> int:
        """Export the range, remux to faststart, drop the raw file. Returns bytes."""
        raw = os.path.join(self.session_dir(sid), RAW_NAME)
        clip = self.clip_path(sid)

        # output_file= streams to disk inside uiprotect rather than buffering
        # the whole export in memory. The timeout is ours: uiprotect passes
        # timeout=0 to the NVR, i.e. it would wait forever.
        try:
            async with asyncio.timeout(EXPORT_TIMEOUT_S):
                await api.get_camera_video(camera_id, start, end, output_file=Path(raw))
        except TimeoutError as err:
            raise RuntimeError(
                f"NVR export timed out after {EXPORT_TIMEOUT_S}s"
            ) from err
        size = await asyncio.to_thread(lambda: os.path.getsize(raw) if os.path.exists(raw) else 0)
        if size == 0:
            raise RuntimeError("NVR returned an empty export")

        await _ffmpeg_faststart(raw, clip)
        await asyncio.to_thread(os.unlink, raw)
        return await asyncio.to_thread(os.path.getsize, clip)

    async def prepare(
        self, api: Any, camera_id: str, start: datetime, end: datetime
    ) -> tuple[str, int]:
        """A ready session for this range: `(session_id, bytes)`.

        Identical concurrent requests share one build — a slow export invites
        retaps, and each used to start its own export of the same range.
        """
        key = f"{camera_id}|{start.isoformat()}|{end.isoformat()}"
        build = self._inflight.get(key)
        if build is None or build.task.done():
            build = _Build(
                task=asyncio.create_task(self._build_session(api, camera_id, start, end))
            )
            self._inflight[key] = build
            build.task.add_done_callback(lambda _t: self._forget(key, build))

        # Waiters are counted so the build outlives ONE client giving up (the
        # retap case: the same range is asked for again a moment later) but not
        # ALL of them — an export nobody is waiting for is pure load on the NVR
        # and the disk, which is how this wedged the instance in the first place.
        build.waiters += 1
        try:
            return await asyncio.shield(build.task)
        finally:
            build.waiters -= 1
            if build.waiters <= 0 and not build.task.done():
                _LOGGER.debug("No client left waiting for %s — cancelling build", key)
                build.task.cancel()

    async def _build_session(
        self, api: Any, camera_id: str, start: datetime, end: datetime
    ) -> tuple[str, int]:
        """Allocate a directory and fill it, cleaning up on any failure."""
        async with self._build_slots:
            sid = await self.create()
            self._building.add(sid)
            try:
                size = await self.build(sid, api, camera_id, start, end)
            except BaseException:
                # BaseException, not Exception: a cancelled request (the client
                # navigated away, or a newer clip superseded this one) must not
                # leave a multi-hundred-MB directory behind for the sweep.
                await self.destroy(sid)
                raise
            finally:
                self._building.discard(sid)
            return sid, size


class ProtectClipSessionView(HomeAssistantView):
    """Create (POST) and tear down (DELETE) a clip session."""

    url = "/api/protect_clip/session"
    extra_urls = ["/api/protect_clip/session/{session_id}"]
    name = "api:protect_clip:session"
    requires_auth = True

    def __init__(self, hass: HomeAssistant, manager: ClipSessionManager) -> None:
        self.hass = hass
        self.manager = manager

    async def post(self, request: web.Request) -> web.Response:
        """Build a clip and return a signed, seekable URL for it."""
        try:
            body = await request.json()
        except ValueError:
            return self.json_message("Invalid JSON body", web.HTTPBadRequest.status_code)

        nvr_id = body.get("nvr_id")
        camera_id = body.get("camera_id")
        if not nvr_id or not camera_id:
            return self.json_message(
                "nvr_id and camera_id are required", web.HTTPBadRequest.status_code
            )

        try:
            start = datetime.fromisoformat(body["start"])
            end = datetime.fromisoformat(body["end"])
        except (KeyError, TypeError, ValueError):
            return self.json_message(
                "start and end must be ISO timestamps", web.HTTPBadRequest.status_code
            )

        seconds = (end - start).total_seconds()
        if seconds <= 0:
            return self.json_message("end must be after start", web.HTTPBadRequest.status_code)
        if seconds > MAX_CLIP_SECONDS:
            return self.json_message(
                f"Clip too long ({int(seconds)}s > {MAX_CLIP_SECONDS}s)",
                web.HTTPBadRequest.status_code,
            )

        # Imported lazily: the unifiprotect integration may not be loaded yet at
        # module-import time, and we don't want to hard-fail setup if it isn't.
        from homeassistant.components.unifiprotect.data import (  # noqa: PLC0415
            async_get_data_for_entry_id,
            async_get_data_for_nvr_id,
        )

        data = async_get_data_for_nvr_id(self.hass, nvr_id) or async_get_data_for_entry_id(
            self.hass, nvr_id
        )
        if data is None:
            return self.json_message("Invalid NVR ID", web.HTTPNotFound.status_code)

        protect_camera_id = self._resolve_camera(data, camera_id)
        if protect_camera_id is None:
            return self.json_message(
                f"Invalid camera ID: {camera_id}", web.HTTPNotFound.status_code
            )

        try:
            sid, size = await self.manager.prepare(data.api, protect_camera_id, start, end)
        except Exception as err:  # noqa: BLE001 - report any export/remux failure as 502
            _LOGGER.error("Clip session failed (%s %s..%s): %s", camera_id, start, end, err)
            return self.json_message(
                f"Could not prepare clip: {err}", web.HTTPBadGateway.status_code
            )

        # Sign for the session's whole lifetime. The card's own signPath() default
        # is 300 s, which was fine when the signature only had to survive a
        # download but would 401 mid-playback now that the browser issues Range
        # requests for as long as the user keeps watching or seeking.
        path = f"/api/protect_clip/media/{sid}/{CLIP_NAME}"
        signed = async_sign_path(self.hass, path, SESSION_TTL)

        return self.json(
            {
                "session_id": sid,
                "url": signed,
                "size": size,
                "expires_in": int(SESSION_TTL.total_seconds()),
            }
        )

    async def delete(self, request: web.Request, session_id: str) -> web.Response:
        """End a session: drop its directory now rather than waiting for the sweep."""
        if not _valid_sid(session_id):
            return self.json_message("Invalid session id", web.HTTPBadRequest.status_code)
        removed = await self.manager.destroy(session_id)
        return self.json({"removed": removed})

    def _resolve_camera(self, data: Any, camera_id: str) -> str | None:
        """Accept a Protect camera id OR an HA camera entity_id.

        Mirrors core's VideoProxyView._async_get_camera: the card passes an
        entity_id, which resolves through the entity registry to the device's
        MAC and from there to the Protect device.
        """
        from uiprotect.data import Camera  # noqa: PLC0415

        if camera_id in data.api.bootstrap.cameras:
            return camera_id

        entity_registry = er.async_get(self.hass)
        device_registry = dr.async_get(self.hass)
        if (entity := entity_registry.async_get(camera_id)) is None or (
            device := device_registry.async_get(entity.device_id or "")
        ) is None:
            return None

        macs = [c[1] for c in device.connections if c[0] == dr.CONNECTION_NETWORK_MAC]
        for mac in macs:
            ufp_device = data.api.bootstrap.get_device_from_mac(mac)
            if isinstance(ufp_device, Camera):
                return ufp_device.id
        return None


class ProtectClipMediaView(HomeAssistantView):
    """Serve a prepared clip. `FileResponse` implements Range/206 natively."""

    url = "/api/protect_clip/media/{session_id}/{filename}"
    name = "api:protect_clip:media"
    requires_auth = True

    def __init__(self, manager: ClipSessionManager) -> None:
        self.manager = manager

    async def get(
        self, request: web.Request, session_id: str, filename: str
    ) -> web.StreamResponse:
        if not _valid_sid(session_id) or filename != CLIP_NAME:
            return web.Response(status=web.HTTPNotFound.status_code)

        path = self.manager.clip_path(session_id)
        if not os.path.isfile(path):
            return web.Response(status=web.HTTPNotFound.status_code)

        # Content-Type must be explicit: the phone's player is picky and the
        # extension sniff isn't guaranteed. Range handling is aiohttp's.
        return web.FileResponse(path, headers={"Content-Type": "video/mp4"})


def _valid_sid(sid: str) -> bool:
    """Session ids are our own token_urlsafe output — reject anything else.

    This is the path-traversal guard for every filesystem call above.
    """
    return bool(sid) and len(sid) <= 64 and all(c.isalnum() or c in "-_" for c in sid)


async def async_setup_clip_sessions(hass: HomeAssistant) -> None:
    """Register the session endpoints and clear anything left by a previous run."""
    manager = ClipSessionManager(hass)

    def _reset() -> None:
        # A restart orphans every session by definition: no client will ever
        # DELETE them, so start from empty.
        shutil.rmtree(manager.root, ignore_errors=True)
        os.makedirs(manager.root, exist_ok=True)

    await hass.async_add_executor_job(_reset)

    hass.http.register_view(ProtectClipSessionView(hass, manager))
    hass.http.register_view(ProtectClipMediaView(manager))
    _LOGGER.debug("Clip sessions ready at %s", manager.root)
