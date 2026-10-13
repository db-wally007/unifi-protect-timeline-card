"""Scrub-preview photos built from the NVR's keyframes.

Why this exists
---------------
While the timeline is dragged the card paints a still for every moment. The
stills are prepared ahead of time - a fast drag across hours needs a picture
everywhere, instantly - as JPEG mosaics ("sheets") per 10-minute block and per
hour, which the card draws from without touching a video decoder.

They used to come from `pyscript/protect_scrub.py`, which asked the NVR for a
timelapse EXPORT of the current block every minute (so the same footage was
exported up to ten times), re-encoded it with libx264 and cut the photos out of
the result: ~35% of a core on average in daylight, with ~170% spikes at every
block boundary (measured 2026-09-23).

This job reads the NVR's playback socket - the one the card's player uses - in
the keyframe-only mode the Protect web app uses (`withIdrs` + `idrFrequency`)
and turns each keyframe straight into a photo. Every stretch of footage is
fetched once and nothing is re-encoded but the photo. Measured 2026-10-13 on
2688x1512 cameras with a keyframe every 4.99 s: a 10-minute block is 120
keyframes / 37 MB (night) delivered in ~1.3 s; decoding them to 640x360 costs
~4 s of one core.

Output (served at /protect_scrub/<slug>/, read by the card's scrub-preview loader)
---------------------------------------------------------------------------------
The layout the card already reads, so the card needs no change:
    <start>.fast-sprite.json + <start>.f<k>.jpg    completed 10-minute block,
                                                    one photo per SLOT_MS
    o<start>.fast-sprite.json + o<start>.f<k>.jpg  completed hour, one photo
                                                    per OVERVIEW_EVERY slots
    h<start>-<end>.fast-sprite.json                the block in progress; its
                                                    full sheets are the block's
                                                    own <start>.f<k>.jpg, the
                                                    partial last one is
                                                    h<start>-<end>.f<k>.jpg
    index.json                                      what exists + the head
The card maps a time linearly onto a unit: tile = floor(frac * count). Photos
are therefore placed on a fixed SLOT_MS grid (slot i of a block shows the
keyframe that fell in [start + i*SLOT_MS, start + (i+1)*SLOT_MS)), not packed
back to back, so a missing keyframe can never shift the ones after it.

Every file the card maps onto a time range carries that range in its NAME and
never changes once written (a stale index can then only show an OLDER frame,
never a wrong one) - see "Any file the card maps onto a time range" in the
card's CLAUDE.md.

Work files (tiles of the blocks/hours in progress, and the job's cursor) live in
.cache/protect_scrub_work/, which is not served.

Configuration - the same settings protect_thumbs.py reads, first match wins:
    cameras   UNIFI_PROTECT_CAMERAS, `protect_cache: cameras:`,
              `pyscript: unifi_protect_cameras:` - "<camera_id>=<slug>,..."
              (slug = the HA camera entity's object_id)
    entry_id  UNIFI_PROTECT_ENTRY_ID, ... (default: the only unifiprotect entry)
    schedule  UNIFI_PROTECT_SCHEDULE, ... - false = no built-in minute timer;
              run the `protect_cache.scrub_sync` action from an HA script
              instead, so a failed run is recorded (it returns {"ok": ...}).
"""

from __future__ import annotations

import asyncio
from contextlib import suppress
from datetime import timedelta
import json
import logging
import os
import re
import shutil
import struct
import tempfile
import time
from typing import Any

import aiohttp

from homeassistant.core import HomeAssistant, ServiceCall, ServiceResponse, SupportsResponse
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.helpers.typing import ConfigType

from .nvr_stream import PLAYBACK_PATH, PlaybackRefused, command_packet, connect_nvr, read_playback_grant

_LOGGER = logging.getLogger(__name__)

DOMAIN = "protect_cache"

BLOCK_MS = 600_000           # one block = 10 minutes, epoch-aligned
SLOT_MS = 5_000              # one photo per 5 s - the cameras' keyframe interval
SLOTS = BLOCK_MS // SLOT_MS  # 120 photos per block
OVERVIEW_MS = 3_600_000      # one overview unit = 1 hour, epoch-aligned
OVERVIEW_EVERY = 6           # every 6th slot -> one photo per 30 s, 120 per hour
TILE_W, TILE_H = 640, 360    # MUST stay 640x360: the size the card's other
                             # preview surfaces use, or the burnt-in clock
                             # visibly changes size when a drag crosses tiers
COLS, ROWS = 4, 4            # 2560x1440 sheets - the largest geometry measured
                             # fast on the low-end tablet (0.53 ms per draw)
PER_SHEET = COLS * ROWS
TILE_QSCALE = 2              # ffmpeg -q:v of the intermediate tiles (near lossless)
SHEET_QUALITY = 70           # JPEG quality of the published sheets. Measured on
                             # a night sheet: 70 -> 19 KB/photo, 60 -> 15, 80 -> 25.
                             # The pyscript job's were ~11 KB but visibly softer
                             # (a crf 27 re-encode of the NVR's timelapse).
RETENTION_MS = 168 * 3_600_000  # rolling window; == protect_thumbs LOOKBACK_HOURS

# The NVR refuses a playback that STARTS past its recording edge (~13-20 s
# behind now), and the newest seconds may not be flushed yet: read up to this
# far behind now. It is also how far behind live the newest photo can be, plus
# up to one run interval.
PULL_LAG_MS = 30_000
PULL_MIN_MS = 5_000          # don't open a socket for less than one slot
MAX_PULL_MS = 30 * 60_000    # per camera per run: a backlog catches up 30x faster
                             # than real time without holding a run for long
BACKFILL_MAX_MS = 24 * 3_600_000  # after a long outage, resume no further back
IDR_FREQUENCY_MS = 1_000     # NVR: at most one keyframe per this -> all of them
STREAM_IDLE_S = 1.5          # the NVR leaves a finished playback socket open;
                             # a delivery arrives at ~100 keyframes/s, so a gap
                             # this long means it is done
STREAM_LIMIT_S = 120         # hard cap on one delivery
FFMPEG_TIMEOUT_S = 120
MAX_FILL_MS = 60_000         # a slot with no keyframe repeats the previous photo
                             # for up to this long; beyond it (camera offline) it
                             # is black rather than a stale picture
NO_KEYS_RETRIES = 2          # a pull that ends well short of its range is retried
                             # (NVR still flushing?) before it is taken as a gap
KEEP_HEADS = 3               # head generations kept for clients with a stale index
STARTUP_GRACE_S = 180        # unifiprotect not loaded yet = skipped, not failed
INDEX_VERSION = 2
SPRITE_VERSION = 1
FAST_SUFFIX = ".fast-sprite.json"
RUN_INTERVAL = timedelta(minutes=1)

_SLUG_RE = re.compile(r"^[a-z0-9_]+$")


# ---- configuration ----------------------------------------------------------

def _conf(config: ConfigType, name: str) -> Any:
    """UNIFI_PROTECT_<NAME>, else protect_cache: <name>, else pyscript: unifi_protect_<name>."""
    val = os.environ.get("UNIFI_PROTECT_" + name.upper())
    if val is not None and val.strip():
        return val.strip()
    own = config.get(DOMAIN) or {}
    if isinstance(own, dict) and own.get(name) not in (None, ""):
        return own[name]
    shared = config.get("pyscript") or {}
    if isinstance(shared, dict):
        return shared.get("unifi_protect_" + name)
    return None


def parse_cameras(raw: Any) -> dict[str, str]:
    """`<camera_id>=<slug>` pairs (comma/newline separated) or a mapping -> {id: slug}.

    Never raises: a malformed entry is logged and dropped. The slug becomes a
    directory name, so it must look like an HA object_id.
    """
    items: list[str] = []
    if isinstance(raw, dict):
        items = [f"{k}={v}" for k, v in raw.items()]
    elif raw:
        items = str(raw).replace("\n", ",").split(",")
    out: dict[str, str] = {}
    for chunk in items:
        item = chunk.strip()
        if not item or item.startswith("#"):
            continue
        bits = item.split("=")
        if len(bits) != 2 or not bits[0].strip() or not _SLUG_RE.match(bits[1].strip()):
            _LOGGER.error("protect scrub: ignoring camera entry %r - want <camera_id>=<slug>", item)
            continue
        out[bits[0].strip()] = bits[1].strip()
    return out


def _flag(val: Any, default: bool) -> bool:
    if val is None or val == "":
        return default
    return str(val).strip().lower() not in ("false", "0", "no", "off")


# ---- the NVR's stream framing ---------------------------------------------
# `[type:1][len:3][payload]` frames, split across websocket messages at
# arbitrary boundaries (same decoder as the card's src/data/nvr-frames.ts):
# 250 init segment, 249/255 begin/end of a media segment, 251 PIECES of one
# moof, 254 mdat header, 252 video samples, 253 audio samples.

def _boxes(buf: bytes, frm: int, to: int):
    off = frm
    while off + 8 <= to:
        size = struct.unpack_from(">I", buf, off)[0]
        hdr = 8
        if size == 1:
            size = struct.unpack_from(">Q", buf, off + 8)[0]
            hdr = 16
        elif size == 0:
            size = to - off
        if size < hdr or off + size > to:
            return
        yield buf[off + 4:off + 8], off + hdr, off + size
        off += size


def moof_key_times(moof: bytes, timescale: int, default_flags: int) -> list[float]:
    """Wall-clock seconds of every sync sample in the FIRST track of a moof."""
    for typ, s, e in _boxes(moof, 0, len(moof)):
        if typ != b"moof":
            return []
        for ttyp, ts, te in _boxes(moof, s, e):
            if ttyp != b"traf":
                continue
            d_dur, d_flags, base, keys = 0, default_flags, None, []
            for btyp, bs, _be in _boxes(moof, ts, te):
                flags = struct.unpack_from(">I", moof, bs)[0] & 0xFFFFFF
                if btyp == b"tfhd":
                    o = bs + 8
                    if flags & 0x1:
                        o += 8
                    if flags & 0x2:
                        o += 4
                    if flags & 0x8:
                        d_dur = struct.unpack_from(">I", moof, o)[0]
                        o += 4
                    if flags & 0x10:
                        o += 4
                    if flags & 0x20:
                        d_flags = struct.unpack_from(">I", moof, o)[0]
                elif btyp == b"tfdt":
                    base = (struct.unpack_from(">Q", moof, bs + 4)[0] if moof[bs] == 1
                            else struct.unpack_from(">I", moof, bs + 4)[0])
                elif btyp == b"trun" and base is not None:
                    count = struct.unpack_from(">I", moof, bs + 4)[0]
                    o = bs + 8
                    if flags & 0x1:
                        o += 4
                    first = None
                    if flags & 0x4:
                        first = struct.unpack_from(">I", moof, o)[0]
                        o += 4
                    t = base
                    for i in range(count):
                        dur = d_dur
                        sf = first if i == 0 and first is not None else d_flags
                        if flags & 0x100:
                            dur = struct.unpack_from(">I", moof, o)[0]
                            o += 4
                        if flags & 0x200:
                            o += 4
                        if flags & 0x400:
                            sf = struct.unpack_from(">I", moof, o)[0]
                            o += 4
                        if flags & 0x800:
                            o += 4
                        if not sf & 0x10000:
                            keys.append(t / timescale)
                        t += dur
            return keys
    return []


def _find_box_payload(buf: bytes, name: bytes) -> int:
    """Offset just past the 4-byte type of the first `name` box (flat search)."""
    i = buf.find(name, 4)
    return -1 if i < 0 else i + 4


def init_timescale(init: bytes) -> int:
    at = _find_box_payload(init, b"mdhd")
    if at < 0:
        return 90000
    off = at + 4 + (16 if init[at] == 1 else 8)
    return struct.unpack_from(">I", init, off)[0] or 90000


def init_default_flags(init: bytes) -> int:
    at = _find_box_payload(init, b"trex")
    return struct.unpack_from(">I", init, at + 20)[0] if at >= 0 and at + 24 <= len(init) else 0


class Deframer:
    """Incremental decoder for one playback stream -> ("init" | "media", bytes, key ms)."""

    def __init__(self) -> None:
        self._carry = b""
        self._parts: dict[int, list[bytes]] | None = None
        self._timescale = 90000
        self._trex = 0

    def push(self, chunk: bytes) -> list[tuple[str, bytes, list[int]]]:
        buf = self._carry + chunk if self._carry else chunk
        out: list[tuple[str, bytes, list[int]]] = []
        off = 0
        n = len(buf)
        while n - off >= 4:
            typ = buf[off]
            ln = int.from_bytes(buf[off + 1:off + 4], "big")
            if n - off - 4 < ln:
                break
            payload = buf[off + 4:off + 4 + ln]
            off += 4 + ln
            if typ == 250:
                self._timescale = init_timescale(payload)
                self._trex = init_default_flags(payload)
                out.append(("init", payload, []))
            elif typ == 249:
                self._parts = {251: [], 254: [], 252: [], 253: []}
            elif typ in (251, 254, 252, 253):
                if self._parts is not None:
                    self._parts[typ].append(payload)
            elif typ == 255:
                p, self._parts = self._parts, None
                if p and p[251]:
                    moof = b"".join(p[251])
                    keys = [round(k * 1000) for k in moof_key_times(moof, self._timescale, self._trex)]
                    out.append(("media", b"".join([moof, *p[254], *p[252], *p[253]]), keys))
        self._carry = buf[off:]
        return out


# ---- sheets -------------------------------------------------------------------

def _render_sheet(tiles: list[str | None], out: str, quality: int) -> None:
    """Pack up to PER_SHEET tile JPEGs (None = black) into one sheet, atomically."""
    from PIL import Image  # noqa: PLC0415 - executor only; keeps HA startup light

    sheet = Image.new("RGB", (TILE_W * COLS, TILE_H * ROWS))
    for i, path in enumerate(tiles):
        if path is None:
            continue
        with Image.open(path) as im:
            tile = im.convert("RGB")
            if tile.size != (TILE_W, TILE_H):
                tile = tile.resize((TILE_W, TILE_H))
            sheet.paste(tile, ((i % COLS) * TILE_W, (i // COLS) * TILE_H))
    tmp = out + ".tmp"
    sheet.save(tmp, "JPEG", quality=quality)
    os.replace(tmp, out)


def _write_json(path: str, obj: Any) -> None:
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(obj, fh)
    os.replace(tmp, path)  # readers never see a half-written file


def _read_json(path: str) -> Any:
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return None


def _sidecar(sheets: list[str], count: int) -> dict[str, Any]:
    return {"version": SPRITE_VERSION, "tile_w": TILE_W, "tile_h": TILE_H,
            "cols": COLS, "rows": ROWS, "count": count, "sheets": sheets}


def fill_slots(tiles: dict[int, str], n: int) -> list[str | None]:
    """Slot -> tile for slots 0..n-1. A slot without its own keyframe repeats the
    nearest earlier photo (or, before the first one, the next one) within
    MAX_FILL_MS; further away it is black (None)."""
    reach = MAX_FILL_MS // SLOT_MS
    out: list[str | None] = []
    prev_i, prev = None, None
    present = sorted(tiles)
    for i in range(n):
        if i in tiles:
            prev_i, prev = i, tiles[i]
            out.append(prev)
        elif prev is not None and i - prev_i <= reach:
            out.append(prev)
        else:
            nxt = next((j for j in present if j > i), None)
            out.append(tiles[nxt] if nxt is not None and nxt - i <= reach and prev is None else None)
    return out


# ---- the job ------------------------------------------------------------------

class _Camera:
    def __init__(self, cam_id: str, slug: str, out_dir: str, work_dir: str) -> None:
        self.id = cam_id
        self.slug = slug
        self.dir = out_dir
        self.work = work_dir


class ScrubJob:
    """One sync = for every camera: fetch the new keyframes, file them as tiles,
    pack sheets, publish the index, purge the rolling window."""

    def __init__(self, hass: HomeAssistant, cameras: dict[str, str], entry_id: str | None) -> None:
        self.hass = hass
        self.entry_id = entry_id or None
        base = hass.config.path(".cache", "protect_scrub")
        work = hass.config.path(".cache", "protect_scrub_work")
        self.cams = [_Camera(cid, slug, os.path.join(base, slug), os.path.join(work, slug))
                     for cid, slug in cameras.items()]
        self._lock = asyncio.Lock()
        self._loaded_at = time.time()

    def _api(self) -> Any:
        entries = self.hass.config_entries.async_entries("unifiprotect")
        if self.entry_id:
            entries = [e for e in entries if e.entry_id == self.entry_id]
        for entry in entries:
            data = getattr(entry, "runtime_data", None)
            if (api := getattr(data, "api", None)) is not None:
                return api
        return None

    async def run(self) -> dict[str, Any]:
        """One sync, never two at once; never raises (a failure is a result)."""
        if self._lock.locked():
            return {"ok": True, "skipped": "a sync is already running"}
        async with self._lock:
            try:
                return await self._sync()
            except Exception as err:  # noqa: BLE001 - reported to the caller
                _LOGGER.exception("protect scrub: sync failed")
                return {"ok": False, "error": f"sync failed: {type(err).__name__}: {err}"}

    async def _sync(self) -> dict[str, Any]:
        if not self.cams:
            return {"ok": False, "error": "no cameras configured (unifi_protect_cameras)"}
        api = self._api()
        if api is None:
            if time.time() - self._loaded_at < STARTUP_GRACE_S:
                return {"ok": True, "skipped": "UniFi Protect is still loading"}
            return {"ok": False, "error": "UniFi Protect integration not loaded"}
        now = int(time.time() * 1000)
        results = await asyncio.gather(*(self._sync_camera(api, c, now) for c in self.cams),
                                       return_exceptions=True)
        report: dict[str, Any] = {}
        errors = []
        for cam, res in zip(self.cams, results, strict=True):
            if isinstance(res, BaseException):
                _LOGGER.warning("protect scrub: %s failed: %s", cam.slug, res)
                errors.append(f"{cam.slug}: {type(res).__name__}: {res}")
                report[cam.slug] = {"error": str(res) or type(res).__name__}
            else:
                report[cam.slug] = res
        # Failed = the job could not do its work at all. One camera the NVR has
        # no footage for is a gap, not a failure (that path does not raise).
        if errors and len(errors) == len(self.cams):
            return {"ok": False, "error": "; ".join(errors), "cameras": report}
        return {"ok": True, "cameras": report}

    # -- per camera ---------------------------------------------------------

    async def _sync_camera(self, api: Any, cam: _Camera, now: int) -> dict[str, Any]:
        await self.hass.async_add_executor_job(_ensure_dirs, cam)
        state = await self.hass.async_add_executor_job(_read_json, os.path.join(cam.work, "state.json")) or {}
        floor = (now - BACKFILL_MAX_MS) // BLOCK_MS * BLOCK_MS
        cursor = state.get("cursor")
        if not isinstance(cursor, int):
            cursor = await self.hass.async_add_executor_job(_initial_cursor, cam, now)
        cursor = max(cursor, floor)
        target = now - PULL_LAG_MS
        photos = 0
        if target - cursor >= PULL_MIN_MS:
            end = min(target, cursor + MAX_PULL_MS)
            keys = await self._pull(api, cam, cursor, end)
            photos = len(keys)
            last = max(keys) if keys else None
            if last is not None and last >= end - 3 * SLOT_MS:
                cursor = end
                state.pop("retry", None)
            else:
                # Ended well short of the range: the NVR may still be flushing,
                # or the camera recorded nothing (offline). Keep what arrived,
                # look again from there a couple of times, then take the rest
                # of the range as a gap.
                retry = state.get("retry") or {}
                tries = retry.get("n", 0) + 1 if retry.get("cursor") == cursor else 1
                if last is not None:
                    cursor, tries = last + 1, 0
                if tries > NO_KEYS_RETRIES:
                    cursor = end
                    state.pop("retry", None)
                else:
                    state["retry"] = {"cursor": cursor, "n": tries}
        state["cursor"] = cursor
        head = await self.hass.async_add_executor_job(_publish, cam, cursor, now)
        state["head"] = head
        await self.hass.async_add_executor_job(_write_json, os.path.join(cam.work, "state.json"), state)
        return {"photos": photos, "behind_s": round((now - cursor) / 1000)}

    async def _pull(self, api: Any, cam: _Camera, start: int, end: int) -> list[int]:
        """Fetch the keyframes in [start, end) and file each as a tile. Returns
        their wall-clock times (ms). A range the NVR declines yields []."""
        params = {"format": "FMP4", "camera": cam.id, "channel": "0",
                  "start": str(start), "end": str(end),
                  "withIdrs": "true", "idrFrequency": str(IDR_FREQUENCY_MS)}
        tmp = await self.hass.async_add_executor_job(
            lambda: tempfile.mkdtemp(prefix="pull-", dir=cam.work))
        keys: list[int] = []
        proc: asyncio.subprocess.Process | None = None
        log_task: asyncio.Task[list[float]] | None = None
        upstream: aiohttp.ClientWebSocketResponse | None = None
        try:
            upstream = await connect_nvr(api, PLAYBACK_PATH, params)
            try:
                await read_playback_grant(upstream)
            except PlaybackRefused as err:
                _LOGGER.debug("protect scrub: %s %s-%s refused: %s", cam.slug, start, end, err)
                return []
            await upstream.send_bytes(command_packet("resume"))
            deframer = Deframer()
            init: bytes | None = None
            async with asyncio.timeout(STREAM_LIMIT_S):
                while True:
                    try:
                        msg = await upstream.receive(timeout=STREAM_IDLE_S if keys else 15)
                    except TimeoutError:
                        break  # delivered everything (the NVR leaves the socket open)
                    if msg.type != aiohttp.WSMsgType.BINARY:
                        break
                    for kind, data, seg_keys in deframer.push(msg.data):
                        if kind == "init":
                            init = init or data
                            continue
                        if not seg_keys or init is None:
                            continue  # no keyframe in it: nothing to show
                        if proc is None:
                            proc = await _start_decoder(tmp)
                            log_task = asyncio.create_task(_frame_times(proc))
                            proc.stdin.write(init)
                        keys.extend(seg_keys)
                        proc.stdin.write(data)
                        await proc.stdin.drain()
            if proc is None:
                return []  # nothing recorded in the range
            proc.stdin.close()
            async with asyncio.timeout(FFMPEG_TIMEOUT_S):
                await proc.wait()
                pts = await log_task
            if proc.returncode != 0:
                raise RuntimeError(f"ffmpeg exited with {proc.returncode}")
            proc = None
            # ffmpeg numbers its frames from the first keyframe fed (pts 0), so
            # first key + pts is each photo's wall time even if one failed to
            # decode; snapped to the exact keyframe time from the moof.
            times = [_nearest(keys, keys[0] + round(p * 1000)) for p in pts]
            await self.hass.async_add_executor_job(_file_tiles, cam, tmp, times, start, end)
            return [k for k in keys if start <= k < end]
        finally:
            if proc is not None and proc.returncode is None:
                with suppress(ProcessLookupError):
                    proc.kill()
                with suppress(Exception):
                    await proc.wait()
            if log_task is not None and not log_task.done():
                log_task.cancel()
            if upstream is not None and not upstream.closed:
                with suppress(Exception):
                    await upstream.close()
            await self.hass.async_add_executor_job(shutil.rmtree, tmp, True)


async def _start_decoder(out_dir: str) -> asyncio.subprocess.Process:
    """One ffmpeg for a whole delivery, fed fMP4 on stdin as it arrives: decodes
    keyframes only (-skip_frame nokey also guards against a stray delta frame)
    into near-lossless 640x360 tiles, logging each frame's pts (showinfo)."""
    return await asyncio.create_subprocess_exec(
        "ffmpeg", "-nostdin", "-hide_banner", "-nostats", "-loglevel", "info",
        "-skip_frame", "nokey", "-f", "mp4", "-i", "pipe:0",
        "-an", "-fps_mode", "passthrough",
        "-vf", f"showinfo,scale={TILE_W}:{TILE_H}", "-q:v", str(TILE_QSCALE),
        "-f", "image2", os.path.join(out_dir, "%06d.jpg"),
        stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.PIPE)


async def _frame_times(proc: asyncio.subprocess.Process) -> list[float]:
    """pts (s) of every frame ffmpeg wrote, in output order. Read concurrently
    with feeding stdin: a full stderr pipe would stall ffmpeg, and with it the
    whole delivery."""
    out: list[float] = []
    assert proc.stderr is not None
    async for raw in proc.stderr:
        line = raw.decode(errors="replace")
        if "Parsed_showinfo" in line and " pts_time:" in line:
            with suppress(ValueError, IndexError):
                out.append(float(line.split(" pts_time:")[1].split()[0]))
        elif "rror" in line:
            _LOGGER.debug("protect scrub: ffmpeg: %s", line.strip())
    return out


def _nearest(values: list[int], target: int) -> int:
    best = min(values, key=lambda v: abs(v - target))
    return best if abs(best - target) <= 1000 else target


# ---- filesystem work (executor) ----------------------------------------------

def _ensure_dirs(cam: _Camera) -> None:
    os.makedirs(cam.dir, exist_ok=True)
    os.makedirs(cam.work, exist_ok=True)


def _initial_cursor(cam: _Camera, now: int) -> int:
    """Where a camera with no cursor starts: right after the newest completed
    block already in the cache (e.g. made by the pyscript job this replaces),
    else at the start of the current block."""
    newest = None
    for name in os.listdir(cam.dir):
        m = re.match(r"^(\d+)(?:\.fast-sprite\.json|\.mp4)$", name)
        if m and (newest is None or int(m.group(1)) > newest):
            newest = int(m.group(1))
    current = now // BLOCK_MS * BLOCK_MS
    return min(newest + BLOCK_MS, current) if newest is not None else current


def _file_tiles(cam: _Camera, tmp: str, times: list[int], start: int, end: int) -> int:
    """Move decoded tiles (numbered in output order, `times` = their wall ms)
    into their slots: work/<block>/<slot>.jpg. The first keyframe in a slot wins."""
    outs = sorted(f for f in os.listdir(tmp) if f.endswith(".jpg"))
    if len(outs) != len(times):
        raise RuntimeError(f"ffmpeg wrote {len(outs)} photos but logged {len(times)}")
    filed = 0
    for name, t in zip(outs, times, strict=True):
        if not start <= t < end:
            continue  # the NVR starts on the keyframe at or before `start`
        block = t // BLOCK_MS * BLOCK_MS
        slot = (t - block) // SLOT_MS
        bdir = os.path.join(cam.work, str(block))
        os.makedirs(bdir, exist_ok=True)
        dst = os.path.join(bdir, f"{slot}.jpg")
        if not os.path.exists(dst):
            os.replace(os.path.join(tmp, name), dst)
            filed += 1
    return filed


def _publish(cam: _Camera, cursor: int, now: int) -> dict[str, Any] | None:
    """Pack sheets for every block/hour in progress up to `cursor`, write the
    index, purge the rolling window. Returns the head advertised in the index."""
    head = None
    blocks = sorted(int(d) for d in os.listdir(cam.work) if d.isdigit())
    for block in blocks:
        n = min(SLOTS, (cursor - block) // SLOT_MS)
        if n <= 0:
            continue
        bdir = os.path.join(cam.work, str(block))
        tiles = {int(f[:-4]): os.path.join(bdir, f) for f in os.listdir(bdir)
                 if f.endswith(".jpg") and f[:-4].isdigit()}
        if not tiles:
            if n == SLOTS:
                shutil.rmtree(bdir, ignore_errors=True)  # nothing recorded in it
            continue
        slots = fill_slots(tiles, n)
        complete = n == SLOTS
        stem_head = f"h{block}-{block + n * SLOT_MS}"
        sheets = []
        for k in range((n + PER_SHEET - 1) // PER_SHEET):
            full = (k + 1) * PER_SHEET <= n or complete
            name = f"{block}.f{k + 1}.jpg" if full else f"{stem_head}.f{k + 1}.jpg"
            path = os.path.join(cam.dir, name)
            # A full sheet never changes once written: its slots are all behind
            # the cursor. Only the head's partial sheet is re-made (new name).
            if not (full and os.path.exists(path)):
                _render_sheet(slots[k * PER_SHEET:(k + 1) * PER_SHEET], path, SHEET_QUALITY)
            sheets.append(name)
        if complete:
            _write_json(os.path.join(cam.dir, f"{block}{FAST_SUFFIX}"), _sidecar(sheets, SLOTS))
            # Keep the photos the hour's overview needs, drop the rest.
            hour = block // OVERVIEW_MS * OVERVIEW_MS
            odir = os.path.join(cam.work, f"o{hour}")
            os.makedirs(odir, exist_ok=True)
            base = (block - hour) // SLOT_MS
            for slot in range(0, SLOTS, OVERVIEW_EVERY):
                if (src := slots[slot]) is not None:
                    shutil.copyfile(src, os.path.join(odir, f"{(base + slot) // OVERVIEW_EVERY}.jpg"))
            shutil.rmtree(bdir, ignore_errors=True)
        else:
            _write_json(os.path.join(cam.dir, stem_head + FAST_SUFFIX), _sidecar(sheets, n))
            head = {"start": block, "end": block + n * SLOT_MS, "map": False,
                    "file": f"{stem_head}.mp4", "fast_sprite": True}
    _publish_overviews(cam, cursor)
    names = os.listdir(cam.dir)
    _purge(cam, names, now, head)
    _write_index(cam, os.listdir(cam.dir), head, now)
    return head


def _publish_overviews(cam: _Camera, cursor: int) -> None:
    """An hour's overview atlas once the cursor has passed the hour."""
    per_hour = OVERVIEW_MS // SLOT_MS // OVERVIEW_EVERY
    for d in os.listdir(cam.work):
        if not (d.startswith("o") and d[1:].isdigit()):
            continue
        hour = int(d[1:])
        if cursor < hour + OVERVIEW_MS:
            continue
        odir = os.path.join(cam.work, d)
        tiles = {int(f[:-4]): os.path.join(odir, f) for f in os.listdir(odir)
                 if f.endswith(".jpg") and f[:-4].isdigit()}
        if tiles and not os.path.exists(os.path.join(cam.dir, f"o{hour}{FAST_SUFFIX}")):
            # Blocks this job did not make (the hour it took over from the
            # pyscript job) have no photos here: cut them from those blocks'
            # published sheets. Anything still missing (a gap) gets the same
            # fill rule as within a block, at the overview's own spacing.
            tiles.update(_crop_from_blocks(cam, hour, [j for j in range(per_hour) if j not in tiles], odir))
            slots = _fill_sparse(tiles, per_hour)
            sheets = []
            for k in range((per_hour + PER_SHEET - 1) // PER_SHEET):
                name = f"o{hour}.f{k + 1}.jpg"
                _render_sheet(slots[k * PER_SHEET:(k + 1) * PER_SHEET], os.path.join(cam.dir, name),
                              SHEET_QUALITY)
                sheets.append(name)
            _write_json(os.path.join(cam.dir, f"o{hour}{FAST_SUFFIX}"), _sidecar(sheets, per_hour))
        shutil.rmtree(odir, ignore_errors=True)


def _crop_from_blocks(cam: _Camera, hour: int, missing: list[int], odir: str) -> dict[int, str]:
    """Overview photos for `missing` indexes cut out of published block sheets,
    using each block's own sidecar (its photo count varies with its maker)."""
    from PIL import Image  # noqa: PLC0415

    out: dict[int, str] = {}
    sidecars: dict[int, Any] = {}
    sheets: dict[str, Any] = {}
    try:
        for j in missing:
            t = hour + j * OVERVIEW_EVERY * SLOT_MS
            block = t // BLOCK_MS * BLOCK_MS
            if block not in sidecars:
                sidecars[block] = _read_json(os.path.join(cam.dir, f"{block}{FAST_SUFFIX}"))
            sc = sidecars[block]
            if not sc or not sc.get("count") or not sc.get("sheets"):
                continue
            count, cols, per = sc["count"], sc["cols"], sc["cols"] * sc["rows"]
            idx = min(count - 1, (t - block) * count // BLOCK_MS)
            name = sc["sheets"][idx // per] if idx // per < len(sc["sheets"]) else None
            if name is None:
                continue
            if name not in sheets:
                path = os.path.join(cam.dir, name)
                sheets[name] = Image.open(path).convert("RGB") if os.path.exists(path) else None
            if (sheet := sheets[name]) is None:
                continue
            pos = idx % per
            x, y = (pos % cols) * sc["tile_w"], (pos // cols) * sc["tile_h"]
            dst = os.path.join(odir, f"c{j}.jpg")
            sheet.crop((x, y, x + sc["tile_w"], y + sc["tile_h"])).save(dst, "JPEG", quality=95)
            out[j] = dst
    finally:
        for im in sheets.values():
            if im is not None:
                im.close()
    return out


def _fill_sparse(tiles: dict[int, str], n: int) -> list[str | None]:
    """Like fill_slots for overview photos (OVERVIEW_EVERY slots apart)."""
    out: list[str | None] = []
    prev = None
    for i in range(n):
        prev = tiles.get(i, prev)
        out.append(prev)
    first = next((tiles[j] for j in sorted(tiles)), None)
    return [p if p is not None else first for p in out]


def _purge(cam: _Camera, names: list[str], now: int, head: dict[str, Any] | None) -> None:
    """Rolling window + superseded head generations + the retired tip tier."""
    cutoff = now - RETENTION_MS
    live_stem = head["file"].rsplit(".", 1)[0] if head else None
    gens: dict[str, int] = {}
    doomed = []
    for name in names:
        stem = name.split(".")[0]
        if m := re.match(r"^o?(\d+)$", stem):
            # <start>.* and o<start>.* (sheets, sidecars, the old job's mp4s)
            if int(m.group(1)) < cutoff:
                doomed.append(name)
        elif m := re.match(r"^h(\d+)-(\d+)$", stem):
            gens[stem] = int(m.group(2))
        elif re.match(r"^t\d+-\d+$", stem) or name == "tip.json":
            doomed.append(name)
        elif name.endswith(".tmp"):
            with suppress(OSError):
                if os.path.getmtime(os.path.join(cam.dir, name)) < now / 1000 - 3600:
                    doomed.append(name)
    keep = set(sorted(gens, key=gens.get)[-KEEP_HEADS:])
    if live_stem:
        keep.add(live_stem)
    doomed += [n for n in names if n.split(".")[0] in gens and n.split(".")[0] not in keep]
    for name in doomed:
        with suppress(OSError):
            os.remove(os.path.join(cam.dir, name))
    for d in os.listdir(cam.work):
        path = os.path.join(cam.work, d)
        num = d[1:] if d.startswith("o") else d
        if num.isdigit() and int(num) + OVERVIEW_MS < cutoff:
            shutil.rmtree(path, ignore_errors=True)
        elif d.startswith("pull-"):
            # A delivery's scratch dir, left behind only if HA died mid-pull.
            with suppress(OSError):
                if os.path.getmtime(path) < now / 1000 - 3600:
                    shutil.rmtree(path, ignore_errors=True)


def _write_index(cam: _Camera, names: list[str], head: dict[str, Any] | None, now: int) -> None:
    def ints(pattern: str) -> set[int]:
        rx = re.compile(pattern)
        return {int(m.group(1)) for n in names if (m := rx.match(n))}

    fast = ints(r"^(\d+)\.fast-sprite\.json$")
    fast_o = ints(r"^o(\d+)\.fast-sprite\.json$")
    # Blocks/hours the old pyscript job left as video only stay listed until
    # they age out (the card falls back to its video preview for them).
    blocks = fast | ints(r"^(\d+)\.mp4$")
    overview = fast_o | ints(r"^o(\d+)\.mp4$")
    _write_json(os.path.join(cam.dir, "index.json"), {
        "version": INDEX_VERSION,
        "generated": now,             # doubles as the job's heartbeat
        "block_ms": BLOCK_MS,
        "blocks": sorted(blocks),
        "overview_block_ms": OVERVIEW_MS,
        "overview": sorted(overview),
        "maps": [],
        "head": head,
        "sprite_meta": None,
        "sprites": [],
        "osprites": [],
        "fast_sprite_meta": {"version": SPRITE_VERSION, "tile_w": TILE_W, "tile_h": TILE_H,
                             "cols": COLS, "rows": ROWS, "slot_ms": SLOT_MS,
                             "suffix": FAST_SUFFIX},
        "fast_sprites": sorted(fast),
        "fast_osprites": sorted(fast_o),
    })


# ---- setup --------------------------------------------------------------------

async def async_setup_scrub(hass: HomeAssistant, config: ConfigType) -> None:
    """Register `protect_cache.scrub_sync` and, unless switched off, a minute timer."""
    cameras = parse_cameras(_conf(config, "cameras"))
    if not cameras:
        _LOGGER.warning("protect scrub: no cameras configured - set UNIFI_PROTECT_CAMERAS or "
                        "unifi_protect_cameras; scrub_sync will fail until then")
    job = ScrubJob(hass, cameras, _conf(config, "entry_id"))

    async def _service(call: ServiceCall) -> ServiceResponse:
        return await job.run()

    hass.services.async_register(DOMAIN, "scrub_sync", _service,
                                 supports_response=SupportsResponse.OPTIONAL)
    if _flag(_conf(config, "schedule"), True) and cameras:
        async def _tick(_now: Any) -> None:
            await job.run()

        async_track_time_interval(hass, _tick, RUN_INTERVAL, name="protect scrub sync")
