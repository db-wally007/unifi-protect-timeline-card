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
    index.json                                      what exists + the head +
                                                    `gaps`: [start, end] ms spans
                                                    the NVR holds no footage for
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

Schedule: the job runs itself every REFRESH_INTERVAL (15 s), so the newest photo
stays ~20-40 s behind live. To have failures RECORDED (a pass only logs), also
run the `protect_cache.scrub_sync` action from an HA script, e.g. once a minute:
it returns {"ok": true, ...} or {"ok": false, "error": "..."} for the pass in
flight or a new one. (`unifi_protect_schedule: false`, which switches the
pyscript jobs' own timers off, does not apply here.)
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
from homeassistant.util import dt as dt_util

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
SHEET_QUALITY = 60           # JPEG quality of the published sheets. Measured on
                             # a night sheet: 60 -> 15 KB/photo, 70 -> 19, 80 -> 25,
                             # and 60 saves slightly FASTER (5.2 vs 5.5 ms a sheet).
                             # The pyscript job's were ~11 KB but visibly softer
                             # (a crf 27 re-encode of the NVR's timelapse).
RETENTION_MS = 168 * 3_600_000  # the photos' rolling window (the events cache keeps
                                # 14 days, protect_thumbs LOOKBACK_HOURS; footage
                                # older than this plays without photos)
GONE_RECHECK_MS = 3_600_000     # see _confirm_gone: a recording start this far past
                                # the last confirmed one is asked about again

# Each pass asks for footage up to this far behind now. The NVR writes footage
# ~13-20 s after it happens and simply delivers what it has; the cursor then
# stands just after the last keyframe that ARRIVED, so anything not written yet
# comes with the next pass - never lost, never guessed. (A START past the
# recording edge is refused, but the start is always an older cursor.)
# Newest photo = the NVR's write delay + up to one REFRESH_INTERVAL + one slot.
PULL_LAG_MS = 10_000
PULL_MIN_MS = 5_000          # don't open a socket for less than one slot
EDGE_SURE_MS = 60_000        # a range that ended this long ago is fully written:
                             # no keyframes in it = nothing recorded (a gap)
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
GAP_MIN_MS = 20_000          # no keyframe for longer than this - and than GAP_IV_FACTOR
GAP_IV_FACTOR = 4            # x the camera's own keyframe interval - = nothing was
                             # recorded: a gap (published in index.json `gaps`)
MAX_GAPS = 500               # per camera, newest kept
RESCAN_MAX_MS = 3_600_000    # scrub_rescan_gaps: at most an hour per call
# Footage older than the photos' window (the gaps the job had not seen when its
# record started) is mapped once, back to the NVR's oldest footage, from the
# NVR's own record of it: GET cameras/<id>/playback-history - the call the
# Protect web app draws its timeline's gaps from (start/end ms, resolution
# 0 = full quality), metadata only. A day per camera per pass. From then on the
# gaps are kept for as long as the NVR keeps the footage. (Sampling keyframes
# instead - one per 15 min - was tried and dropped: the NVR delivers them a few
# seconds apart, ~3 h of footage a minute, and a pause read as a gap.)
HISTORY_PATH = "cameras/{camera}/playback-history"
HISTORY_SPAN_MS = 86_400_000
GAP_RECORD = 2               # state.json's gap record version (see _sync_camera)
KEEP_HEADS = 12              # head generations kept for clients with a stale index
                             # (one per pass: 12 = the card's 60 s index TTL x 3)
STARTUP_GRACE_S = 180        # unifiprotect not loaded yet = skipped, not failed
INDEX_VERSION = 2
SPRITE_VERSION = 1
FAST_SUFFIX = ".fast-sprite.json"
REFRESH_INTERVAL = timedelta(seconds=15)  # the job's own pass, always on
PURGE_EVERY_S = 60           # rolling-window sweep (a full listing) at most this often
ERROR_LOG_EVERY_S = 600      # a failing pass logs once, then at most this often

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


# ---- recording gaps -----------------------------------------------------------
#
# The card's grey "no footage" strip. The NVR is the only authority on what it
# recorded, and this job already receives EVERY keyframe it holds, so a stretch
# with none is exactly a gap - unlike the camera entity's `unavailable` history
# (Home Assistant losing sight of the NVR is not the NVR losing footage, and a
# hung console kept the entities `recording` for minutes into a real gap), and
# unlike asking the NVR for a still (it answers 200 with the nearest EARLIER
# frame, so a still exists inside every gap). A pass the NVR fails never gets
# here: the cursor does not move, so an error can never be published as a gap.

def key_interval(keys: list[int], prev: int | None, current: int | None) -> int | None:
    """The camera's keyframe interval (ms): median spacing of `keys` (after
    `prev`) blended into `current`. Spacings past MAX_FILL_MS are outages, not
    the camera's rhythm, and are left out."""
    seq = ([prev] if prev is not None else []) + sorted(keys)
    ivs = sorted(b - a for a, b in zip(seq, seq[1:]) if 0 < b - a < MAX_FILL_MS)
    if not ivs:
        return current
    med = ivs[len(ivs) // 2]
    return med if current is None else round(current * 0.8 + med * 0.2)


def gap_threshold(iv: int | None) -> int:
    return max(GAP_MIN_MS, GAP_IV_FACTOR * (iv or SLOT_MS))


def detect_gaps(keys: list[int], prev: int | None, threshold: int, lead: int) -> list[list[int]]:
    """[start, end] spans with no keyframe for longer than `threshold`, between
    `prev` (the newest keyframe seen before these) and the `keys`. A span starts
    `lead` (one keyframe interval: the footage that keyframe opens) after the
    keyframe before it and ends at the next one."""
    out: list[list[int]] = []
    last = prev
    for k in sorted(keys):
        if last is not None and k - last > threshold:
            out.append([last + lead, k])
        last = k if last is None else max(last, k)
    return out


def merge_gaps(gaps: list[list[int]], since: int) -> list[list[int]]:
    """Sorted, overlapping/touching spans joined, spans ended before `since`
    dropped, the newest MAX_GAPS kept."""
    out: list[list[int]] = []
    for s, e in sorted((int(g[0]), int(g[1])) for g in gaps if len(g) == 2 and g[1] > g[0]):
        if e < since:
            continue
        if out and s <= out[-1][1]:
            out[-1][1] = max(out[-1][1], e)
        else:
            out.append([s, e])
    return out[-MAX_GAPS:]


def _note_keys(state: dict[str, Any], keys: list[int]) -> None:
    """Fold a pass's keyframes into the camera's gap record (state.json)."""
    prev = state.get("last_key") if isinstance(state.get("last_key"), int) else None
    iv = key_interval(keys, prev, state.get("key_iv"))
    found = detect_gaps(keys, prev, gap_threshold(iv), iv or SLOT_MS)
    state["gaps"] = (state.get("gaps") or []) + found
    state["key_iv"] = iv
    state["last_key"] = max(keys) if prev is None else max(prev, *keys)


def gaps_since(state: dict[str, Any], now: int) -> int:
    """How far back a camera's gaps are kept: as long as the NVR keeps its
    footage (its recording start), else the photos' window."""
    start = state.get("recording_start")
    return start if isinstance(start, int) else now - RETENTION_MS


def published_gaps(state: dict[str, Any], cursor: int, now: int) -> list[list[int]]:
    """The gaps for index.json: the recorded ones, plus an OPEN one while the
    camera has had no keyframe for longer than the threshold - the cursor only
    passes an empty stretch once the NVR has surely written it (EDGE_SURE_MS),
    so everything up to it is confirmed empty."""
    gaps = list(state.get("gaps") or [])
    last = state.get("last_key")
    iv = state.get("key_iv")
    if isinstance(last, int) and cursor - last > gap_threshold(iv):
        gaps.append([last + (iv or SLOT_MS), cursor])
    return merge_gaps(gaps, gaps_since(state, now))


def history_gaps(segments: Any, start: int, end: int) -> list[list[int]]:
    """The gaps of [start, end) between the footage segments the NVR lists
    (playback-history: [{"start": ms, "end": ms or null while recording}]) -
    shorter than GAP_MIN_MS are joins between recording files, not gaps."""
    spans = sorted(
        (int(s["start"]), int(s["end"]) if s.get("end") else end)
        for s in (segments if isinstance(segments, list) else [])
        if isinstance(s, dict) and isinstance(s.get("start"), (int, float))
    )
    out: list[list[int]] = []
    t = start
    for s, e in spans:
        if s - t > GAP_MIN_MS:
            out.append([t, min(s, end)])
        t = max(t, e)
        if t >= end:
            break
    if end - t > GAP_MIN_MS:
        out.append([t, end])
    return out


def footage_in(segments: Any, start: int, end: int) -> bool:
    """Whether a footage segment the NVR lists (playback-history) covers any of
    [start, end) - more than a join between recording files (GAP_MIN_MS), so
    the first recording, starting right at `end`, does not count."""
    for s in segments if isinstance(segments, list) else []:
        if not isinstance(s, dict) or not isinstance(s.get("start"), (int, float)):
            continue
        lo = max(int(s["start"]), start)
        hi = min(int(s["end"]) if s.get("end") else end, end)
        if hi - lo > GAP_MIN_MS:
            return True
    return False


def recording_start(api: Any, cam_id: str) -> int | None:
    """Where the NVR's full-quality footage of a camera begins (its oldest
    recording still on disk), ms - read from the bootstrap the integration
    keeps current, so no NVR call. The card's calendar and timeline end there:
    the photos here cover RETENTION_MS, the NVR's footage usually far more.
    (The NVR's longer-kept low-quality copy is left out by choice: the user
    decided against its few extra hours, 2026-10-30.)"""
    try:
        start = api.bootstrap.cameras[cam_id].stats.video.recording_start
    except (AttributeError, KeyError, TypeError):
        return None
    return int(start.timestamp() * 1000) if start else None


def _recording(state: dict[str, Any]) -> dict[str, Any]:
    """The recording bounds a camera's state holds, for its index."""
    return {"recording_start": state.get("recording_start")}


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
        self._task: asyncio.Task[dict[str, Any]] | None = None
        self._lock = asyncio.Lock()  # a pass and a gap rescan never write state at once
        self._loaded_at = time.time()
        self._failing_since: float | None = None
        self._error_logged = 0.0
        self._partial_logged = 0.0
        self._purged: dict[str, float] = {}  # slug -> monotonic time of the last sweep

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
        """One pass, never two at once; never raises (a failure is a result).

        A call while a pass is in flight gets THAT pass's result rather than a
        "skipped": the job runs itself every 15 s, so a monitoring script's
        once-a-minute call often lands mid-pass, and a skip would report
        success for a job that might be failing.
        """
        if self._task is None or self._task.done():
            self._task = self.hass.async_create_background_task(self._guarded(), "protect scrub pass")
        return await asyncio.shield(self._task)

    async def _guarded(self) -> dict[str, Any]:
        try:
            async with self._lock:
                result = await self._sync()
        except Exception as err:  # noqa: BLE001 - reported to the caller
            result = {"ok": False, "error": f"sync failed: {type(err).__name__}: {err}"}
        # Every 15 s a broken NVR link would otherwise write a warning: log the
        # first failure, then at most every ERROR_LOG_EVERY_S, and the recovery.
        now = time.monotonic()
        if not result.get("ok"):
            if self._failing_since is None or now - self._error_logged > ERROR_LOG_EVERY_S:
                _LOGGER.warning("protect scrub: %s", result.get("error"))
                self._error_logged = now
            self._failing_since = self._failing_since or now
        elif self._failing_since is not None:
            _LOGGER.info("protect scrub: working again after %.0f s", now - self._failing_since)
            self._failing_since = None
        return result

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
                _LOGGER.debug("protect scrub: %s failed: %s", cam.slug, res)
                errors.append(f"{cam.slug}: {type(res).__name__}: {res}")
                report[cam.slug] = {"error": str(res) or type(res).__name__}
            else:
                report[cam.slug] = res
        # Failed = the job could not do its work at all. One camera the NVR has
        # no footage for is a gap, not a failure (that path does not raise);
        # one camera erroring while the others work is reported but logged.
        if errors and len(errors) == len(self.cams):
            return {"ok": False, "error": "; ".join(errors), "cameras": report}
        if errors and time.monotonic() - self._partial_logged > ERROR_LOG_EVERY_S:
            _LOGGER.warning("protect scrub: %s", "; ".join(errors))
            self._partial_logged = time.monotonic()
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
            if keys:
                _note_keys(state, keys)
                # Just after the last keyframe that arrived: whatever the NVR
                # had not written yet (or a delivery cut short) comes next pass.
                cursor = max(keys) + 1
            elif end < now - EDGE_SURE_MS:
                cursor = end  # long written and nothing in it: camera was offline
            # else: not written yet - the same range is asked again next pass
        state.pop("retry", None)  # written by the first version of this job
        state["cursor"] = cursor
        if (rec_start := recording_start(api, cam.id)) is not None:
            state["recording_start"] = rec_start
        state.pop("recording_start_lq", None)  # written by a version that tried it
        # Gaps are known from `gaps_from` on - a record kept before this
        # version only for the photos' window (whose older part, from the first
        # version of the mapping, was wrong: it is dropped and mapped again).
        # _map_history extends the record back to the NVR's oldest footage.
        if state.get("gap_record") != GAP_RECORD:
            state["gaps"] = [g for g in state.get("gaps") or [] if g[1] > now - RETENTION_MS]
            state["gaps_from"] = now - RETENTION_MS
            state["gap_record"] = GAP_RECORD
        await self._map_history(api, cam, state)
        state["gaps"] = merge_gaps(state.get("gaps") or [], gaps_since(state, now))
        purge = time.monotonic() - self._purged.get(cam.slug, 0) >= PURGE_EVERY_S
        if purge:
            self._purged[cam.slug] = time.monotonic()
            await self._confirm_gone(api, cam, state, now)
        head = await self.hass.async_add_executor_job(
            _publish, cam, cursor, now, purge, published_gaps(state, cursor, now), _recording(state),
            state.get("gone_before"))
        state["head"] = head
        await self.hass.async_add_executor_job(_write_json, os.path.join(cam.work, "state.json"), state)
        return {"photos": photos, "behind_s": round((now - cursor) / 1000)}

    async def _confirm_gone(self, api: Any, cam: _Camera, state: dict[str, Any], now: int) -> None:
        """Photos of footage the NVR no longer has - a format, a new disk, or
        retention shorter than the photos' window put its recording start
        inside the window (user, 2026-10-31: 18 GB of them after a format) -
        are deleted by the sweep, up to `gone_before`. That is set only once
        the NVR confirms there is no footage before the recording start, with
        one playback-history request: the bootstrap's word alone could wipe
        photos that can't be pulled again. Asked when the start passes the one
        last asked about by GONE_RECHECK_MS - at once after a format, at most
        hourly while retention creeps; a failed request is asked again by the
        next sweep."""
        rec = state.get("recording_start")
        floor = now - RETENTION_MS
        asked = state.get("gone_asked")
        if not isinstance(rec, int) or not floor < rec <= now:
            return
        if isinstance(asked, int) and rec < asked + GONE_RECHECK_MS:
            return
        try:
            segments = await api.api_request_list(
                HISTORY_PATH.format(camera=cam.id),
                params={"start": floor, "end": rec, "resolution": 0},
            )
        except Exception as err:  # noqa: BLE001 - asked again next sweep
            _LOGGER.debug("protect scrub: %s playback-history (gone check) failed: %s", cam.slug, err)
            return
        state["gone_asked"] = rec
        if footage_in(segments, floor, rec):
            _LOGGER.debug("protect scrub: %s has footage before its recording start - kept", cam.slug)
            return
        state["gone_before"] = rec
        _LOGGER.info("protect scrub: %s footage before %s is gone - its photos are deleted",
                     cam.slug, time.strftime("%Y-%m-%d %H:%M", time.localtime(rec / 1000)))

    async def _map_history(self, api: Any, cam: _Camera, state: dict[str, Any]) -> None:
        """Map one more day of the footage older than the gap record (see
        HISTORY_PATH), back towards the NVR's oldest - until it is reached. A
        failed request maps nothing (an error is never a gap); the next pass
        asks again."""
        rec_start = state.get("recording_start")
        known = state["gaps_from"]
        if not isinstance(rec_start, int) or known <= rec_start:
            return
        start = max(rec_start, known - HISTORY_SPAN_MS)
        try:
            segments = await api.api_request_list(
                HISTORY_PATH.format(camera=cam.id),
                params={"start": start, "end": known, "resolution": 0},
            )
        except Exception as err:  # noqa: BLE001 - mapped again next pass
            _LOGGER.debug("protect scrub: %s playback-history failed: %s", cam.slug, err)
            return
        found = history_gaps(segments, start, known)
        state["gaps"] = (state.get("gaps") or []) + found
        state["gaps_from"] = start
        _LOGGER.debug("protect scrub: %s history %s-%s: %d segments, gaps %s",
                      cam.slug, start, known, len(segments or []), found)

    async def _pull(self, api: Any, cam: _Camera, start: int, end: int,
                    decode: bool = True) -> list[int]:
        """Fetch the keyframes in [start, end) and file each as a tile. Returns
        their wall-clock times (ms). A range the NVR declines yields [].
        `decode=False` only collects the times (the gap rescan): no ffmpeg, no
        tiles."""
        params = {"format": "FMP4", "camera": cam.id, "channel": "0",
                  "start": str(start), "end": str(end),
                  "withIdrs": "true", "idrFrequency": str(IDR_FREQUENCY_MS)}
        tmp = None
        if decode:
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
            got_data = False
            async with asyncio.timeout(STREAM_LIMIT_S):
                while True:
                    try:
                        # The first data comes ~0.1-0.3 s after resume; after
                        # it, a pause means the NVR has sent all it has.
                        msg = await upstream.receive(timeout=STREAM_IDLE_S if got_data else 5)
                    except TimeoutError:
                        break  # delivered everything (the NVR leaves the socket open)
                    if msg.type != aiohttp.WSMsgType.BINARY:
                        break
                    got_data = True
                    for kind, data, seg_keys in deframer.push(msg.data):
                        if kind == "init":
                            init = init or data
                            continue
                        if not seg_keys or init is None:
                            continue  # no keyframe in it: nothing to show
                        if max(seg_keys) < start:
                            # The NVR starts on the keyframe at or before
                            # `start` - the last pass already filed it.
                            continue
                        if not decode:
                            keys.extend(seg_keys)
                            continue
                        if proc is None:
                            proc = await _start_decoder(tmp)
                            log_task = asyncio.create_task(_frame_times(proc))
                            proc.stdin.write(init)
                        keys.extend(seg_keys)
                        proc.stdin.write(data)
                        await proc.stdin.drain()
            if not decode:
                return sorted({k for k in keys if start <= k < end})
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
            if tmp is not None:
                await self.hass.async_add_executor_job(shutil.rmtree, tmp, True)

    async def rescan_gaps(self, start: int, end: int) -> dict[str, Any]:
        """Rebuild the recorded gaps of [start, end) for every camera from the
        NVR's keyframe times, replacing whatever was recorded for that window -
        for footage this job processed before it recorded gaps. One camera at a
        time, keyframe times only (no decode), at most RESCAN_MAX_MS."""
        now = int(time.time() * 1000)
        start = max(start, now - RETENTION_MS)
        end = min(end, now - EDGE_SURE_MS)  # only surely-written footage
        if end - start > RESCAN_MAX_MS:
            return {"ok": False, "error": f"window longer than {RESCAN_MAX_MS // 60_000} minutes"}
        if end <= start:
            return {"ok": False, "error": "empty window"}
        async with self._lock:
            api = self._api()
            if api is None:
                return {"ok": False, "error": "UniFi Protect integration not loaded"}
            report: dict[str, Any] = {}
            for cam in self.cams:
                try:
                    keys = await self._pull(api, cam, start, end, decode=False)
                except Exception as err:  # noqa: BLE001 - per camera, reported
                    report[cam.slug] = {"error": f"{type(err).__name__}: {err}"}
                    continue
                path = os.path.join(cam.work, "state.json")
                state = await self.hass.async_add_executor_job(_read_json, path) or {}
                iv = key_interval(keys, None, state.get("key_iv"))
                lead, thr = iv or SLOT_MS, gap_threshold(iv)
                if keys:
                    found = detect_gaps(keys, None, thr, lead)
                    if keys[0] - start > thr:
                        found.insert(0, [start, keys[0]])
                    if end - keys[-1] > thr:
                        found.append([keys[-1] + lead, end])
                else:
                    found = [[start, end]]
                kept: list[list[int]] = []  # recorded gaps, minus the window
                for g in state.get("gaps") or []:
                    if g[0] < start:
                        kept.append([g[0], min(g[1], start)])
                    if g[1] > end:
                        kept.append([max(g[0], end), g[1]])
                state["gaps"] = merge_gaps(kept + found, gaps_since(state, now))
                await self.hass.async_add_executor_job(_write_json, path, state)
                cursor = state.get("cursor")
                if isinstance(cursor, int):
                    await self.hass.async_add_executor_job(
                        _publish, cam, cursor, now, False, published_gaps(state, cursor, now),
                        _recording(state))
                report[cam.slug] = {"keyframes": len(keys), "key_interval_ms": iv, "gaps": found}
        return {"ok": True, "start": start, "end": end, "cameras": report}


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


def _publish(cam: _Camera, cursor: int, now: int, purge: bool = True,
             gaps: list[list[int]] | None = None, rec: dict[str, Any] | None = None,
             gone_before: int | None = None) -> dict[str, Any] | None:
    """Pack sheets for every block/hour in progress up to `cursor`, write the
    index (with the recording `gaps`) and (when `purge`) sweep the rolling
    window and the photos of footage gone before `gone_before`. Returns the
    head advertised in the index."""
    head = None
    blocks = sorted(int(d) for d in os.listdir(cam.work) if d.isdigit())
    for block in blocks:
        # Slots up to the one holding the cursor: the cursor stands just after
        # the last keyframe that arrived, so that keyframe's slot is complete
        # (the first keyframe in a slot is the one shown).
        n = min(SLOTS, -(-(cursor - block) // SLOT_MS))
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
            # A sheet never changes once written: a full one's slots are all
            # behind the cursor, and a partial one's name states how many
            # slots it holds - a pass that added none re-uses it as it is.
            if not os.path.exists(path):
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
    if purge:
        _purge(cam, names, now, head, gone_before)
        names = os.listdir(cam.dir)
    _write_index(cam, names, head, now, gaps or [], rec)
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


def _purge(cam: _Camera, names: list[str], now: int, head: dict[str, Any] | None,
           gone_before: int | None = None) -> None:
    """Rolling window + photos of footage gone before `gone_before` (a
    confirmed recording start, _confirm_gone - a block or hour ENDED by then;
    the one it falls in holds the first new footage) + superseded head
    generations + the retired tip tier."""
    cutoff = now - RETENTION_MS
    gone = gone_before or 0
    live_stem = head["file"].rsplit(".", 1)[0] if head else None
    gens: dict[str, int] = {}
    doomed = []
    for name in names:
        stem = name.split(".")[0]
        if m := re.match(r"^o?(\d+)$", stem):
            # <start>.* and o<start>.* (sheets, sidecars, the old job's mp4s)
            start = int(m.group(1))
            span = OVERVIEW_MS if stem.startswith("o") else BLOCK_MS
            if start < cutoff or start + span <= gone:
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
        span = OVERVIEW_MS if d.startswith("o") else BLOCK_MS
        if num.isdigit() and (int(num) + OVERVIEW_MS < cutoff or int(num) + span <= gone):
            shutil.rmtree(path, ignore_errors=True)
        elif d.startswith("pull-"):
            # A delivery's scratch dir, left behind only if HA died mid-pull.
            with suppress(OSError):
                if os.path.getmtime(path) < now / 1000 - 3600:
                    shutil.rmtree(path, ignore_errors=True)


def _write_index(cam: _Camera, names: list[str], head: dict[str, Any] | None, now: int,
                 gaps: list[list[int]], rec: dict[str, Any] | None = None) -> None:
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
        # [start, end] ms spans the NVR holds no footage for - see "recording
        # gaps" above. Absent on an older job: the card then draws no gaps.
        "gaps": gaps,
        # ms: the NVR's oldest full-quality footage of this camera (what
        # playback serves), null while unknown. Absent on an older job: no
        # lower bound.
        "recording_start": (rec or {}).get("recording_start"),
    })


# ---- setup --------------------------------------------------------------------

async def async_setup_scrub(hass: HomeAssistant, config: ConfigType) -> None:
    """Register `protect_cache.scrub_sync` and the job's own 15 s pass."""
    cameras = parse_cameras(_conf(config, "cameras"))
    job = ScrubJob(hass, cameras, _conf(config, "entry_id"))

    async def _service(call: ServiceCall) -> ServiceResponse:
        return await job.run()

    hass.services.async_register(DOMAIN, "scrub_sync", _service,
                                 supports_response=SupportsResponse.OPTIONAL)

    async def _rescan(call: ServiceCall) -> ServiceResponse:
        def ms(value: Any) -> int:
            parsed = dt_util.parse_datetime(str(value))
            if parsed is None:
                raise ValueError(f"not a date/time: {value}")
            return int(dt_util.as_utc(parsed).timestamp() * 1000)

        try:
            start, end = ms(call.data["start"]), ms(call.data["end"])
        except (KeyError, ValueError) as err:
            return {"ok": False, "error": f"start/end: {err}"}
        return await job.rescan_gaps(start, end)

    hass.services.async_register(DOMAIN, "scrub_rescan_gaps", _rescan,
                                 supports_response=SupportsResponse.ONLY)
    if not cameras:
        _LOGGER.warning("protect scrub: no cameras configured - set UNIFI_PROTECT_CAMERAS or "
                        "unifi_protect_cameras; scrub_sync will fail until then")
        return

    async def _tick(_now: Any) -> None:
        await job.run()

    async_track_time_interval(hass, _tick, REFRESH_INTERVAL, name="protect scrub pass",
                              cancel_on_shutdown=True)
