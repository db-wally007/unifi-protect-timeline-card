"""UniFi Protect scrub-preview cache — companion for unifi-protect-timeline-card.

Makes scrubbing show real footage frames instead of a black stage — the same
mechanism the UniFi app uses. Every minute it exports the NVR's own "timelapse"
video (640×360 H.264) in fixed 10-minute blocks and stores them as static MP4
files under /config/.cache/protect_scrub/<slug>/ (served at /protect_scrub/...
by the protect_cache custom_component); the card
seeks a hidden muted <video> through the covering block/part while the user
drags the timeline.

Setup
-----
1. Enable pyscript (via HACS or manually) and add to configuration.yaml:
       pyscript:
         allow_all_imports: true
         hass_is_global: true
   This needs ONE Home Assistant restart; afterwards iterate with the
   `pyscript.reload` service (no restart).
2. Copy this file to /config/pyscript/protect_scrub.py (or symlink it there
   from a checkout — this file holds no install-specific values, see below).
3. Say which cameras to cache, either
   (a) with the UNIFI_PROTECT_CAMERAS environment variable on the Home
       Assistant process — Container / Compose / Kubernetes installs:
           UNIFI_PROTECT_CAMERAS="<protect_camera_id>=<ha_camera_object_id>,..."
   (b) or in configuration.yaml, inside the pyscript: block — HA OS /
       Supervised, where the process environment isn't yours to set:
           pyscript:
             allow_all_imports: true
             hass_is_global: true
             unifi_protect_cameras: "<protect_camera_id>=<ha_camera_object_id>,..."
   This is the SAME setting protect_thumbs.py reads, so the two can no longer
   drift. Find each Protect camera id with the
   pyscript.protect_thumbs_list_cameras service (from the event-cache
   companion). The event-boundary splitting also needs protect_thumbs.py
   running (it reads that cache's manifest.json).
4. `pyscript.reload`, then run `pyscript.protect_scrub_sync` once; the backfill
   spreads itself over many per-minute runs.

Configuration (env wins; see the block below the imports)
  UNIFI_PROTECT_CAMERAS / unifi_protect_cameras    required
  UNIFI_PROTECT_ENTRY_ID / unifi_protect_entry_id  optional, "" = auto-discover

Disk: a 640×360 block is typically 3-6 MB -> ~0.5-0.8 GB/day/camera, so about
4-6 GB per camera at the default 7-day window. Lower RETENTION_HOURS to shrink.

Design
------
- Fixed epoch-aligned blocks of BLOCK_S seconds. Only COMPLETED blocks are
  exported (end <= now - SAFETY_LAG_S), so a written block is immutable —
  browsers can cache the files forever.
- Plus a rolling HEAD block: the current (incomplete) block is exported every
  run as h<start_ms>-<end_ms>.mp4 (advertised via the index's `head` field) so
  scrubbing shows frames up to ~a minute behind live. Once the block completes,
  its immutable <start_ms>.mp4 takes over. The covered range is IN THE FILENAME
  and a few generations are kept (KEEP_HEADS) — see HEAD_PREFIX for why that is
  load-bearing rather than cosmetic.
- EVENT-BOUNDARY SPLITTING: the NVR's timelapse has no per-frame times and its
  frame density follows recording activity, so a block containing events is
  exported as separate per-segment part files (<start>.p<k>.mp4, normalized
  CFR) plus a <start>.map.json sidecar — the card plays the covering part and
  maps time linearly within it, so a scrubbed frame can never drift across an
  event boundary (the bug this design exists to kill).
- Incremental & NVR-gentle: each run lists what's on disk, exports only missing
  blocks NEWEST-first (the region people actually scrub), at most
  MAX_EXPORTS_PER_RUN per run with a pause between exports — a cold 7-day
  backfill spreads over hours of 1-minute runs instead of hammering the NVR.
- Rolling window: blocks older than RETENTION_HOURS are deleted every run
  (the block start is encoded in the filename, so the purge needs no stat).
  RETENTION_HOURS matches protect_thumbs LOOKBACK_HOURS — the preview window
  is exactly the event-manifest window the card can show.
- index.json per camera lists the block starts that exist, so the card knows
  which blocks are available without probing (no 404 spam), plus `generated`
  so it can detect a dead sync job and request a run.
- Failed exports (e.g. camera was offline -> no footage for that range) are
  retried at most EXPORT_MAX_ATTEMPTS times, tracked in state.json — a
  footage-less block never hammers the NVR forever.
- 4K fallback normalization: the NVR usually serves the timelapse from its
  low-res preview track (640×360), but for some ranges it falls back to the
  FULL-RES track (3840×2160, ~100-160 MB per block!). Every downloaded block
  is ffprobe'd; anything wider than 640 px is transcoded down to 640×360 with
  the container's ffmpeg before being stored.

pyscript injects `hass` (hass_is_global), `log`, `task`, and the
`@service`/`@time_trigger` decorators, and auto-awaits coroutine calls.
NOTE: no generator expressions anywhere — pyscript's interpreter does not
implement them (use list comprehensions).
"""

import json
import os
import subprocess
from datetime import datetime, timezone

# ---- install configuration — KEEP THIS BLOCK IDENTICAL IN BOTH FILES --------
# Nothing install-specific is hardcoded, so this file is pure code: it can live
# in a git checkout and be symlinked into /config/pyscript/ with no local edits.
# Read ONCE, when pyscript loads this module. First match wins:
#   1. the environment — UNIFI_PROTECT_CAMERAS / UNIFI_PROTECT_ENTRY_ID.
#      Container/Compose/Kubernetes; needs an HA restart to take effect.
#   2. configuration.yaml, inside the pyscript: block —
#        pyscript:
#          allow_all_imports: true
#          hass_is_global: true
#          unifi_protect_cameras: "<camera_id>=<slug>,<camera_id>=<slug>"
#      For HA OS / Supervised, where the process environment isn't yours to set.
#      Supports !secret, and `pyscript.reload` alone picks up changes.

def _conf(name, default=""):
    """UNIFI_PROTECT_<NAME> from the environment, else unifi_protect_<name>
    from the pyscript: block in configuration.yaml, else `default`."""
    val = os.environ.get("UNIFI_PROTECT_" + name.upper())
    if val is not None and val.strip():
        return val.strip()
    cfg = pyscript.config
    if isinstance(cfg, dict):
        val = cfg.get("unifi_protect_" + name.lower())
        if val:
            return val
    return default


def _parse_cameras(raw):
    """`<camera_id>=<slug>` pairs (comma and/or newline separated), or a YAML
    mapping when configured in configuration.yaml.

    NEVER raises: a malformed entry is logged and dropped, and a value that
    yields no pairs leaves the map empty — which both sync jobs already treat as
    "not configured yet" and no-op on. Raising here would abort the module load
    and take every @service in this file down with it.
    """
    out = {}
    items = []
    if isinstance(raw, dict):
        for key in raw:
            items.append(str(key) + "=" + str(raw[key]))
    else:
        for chunk in str(raw or "").replace("\n", ",").split(","):
            items.append(chunk)
    for chunk in items:
        item = chunk.strip()
        if not item or item.startswith("#"):
            continue
        bits = item.split("=")
        if len(bits) != 2:
            log.error("protect: ignoring camera entry %s — want <camera_id>=<slug>", item)
            continue
        cam_id = bits[0].strip()
        slug = bits[1].strip()
        # The slug becomes a directory name under the cache root, so restrict it
        # to what an HA object_id can be: no dots, no slashes, no traversal.
        # Also catches pasting a whole entity_id ("camera.front_yard").
        if not cam_id or not slug or slug != slug.lower() \
                or not slug.replace("_", "").isalnum():
            log.error("protect: ignoring camera entry %s — slug must be the HA "
                      "camera object_id (the part after 'camera.')", item)
            continue
        out[cam_id] = slug
    return out


# unifiprotect config-entry id. "" (the default) auto-discovers the single
# unifiprotect entry — set this only if you run more than one Protect instance.
ENTRY_ID = _conf("entry_id")

# Cameras to cache: Protect camera id -> output slug. The slug MUST equal the HA
# camera entity's object_id (the part after "camera."), so the card can derive
# the cache directory from its `camera:` option. Find the Protect camera id with
# the pyscript.protect_thumbs_list_cameras service.
CAMERAS = _parse_cameras(_conf("cameras"))
if not CAMERAS:
    log.error("protect: no cameras configured — set UNIFI_PROTECT_CAMERAS "
              "(\"<camera_id>=<slug>,...\") or unifi_protect_cameras under "
              "pyscript: in configuration.yaml; the sync jobs will no-op")
# ---- end install configuration ----------------------------------------------

# Under .cache/ (NOT www/) so HA Core backups skip it: .cache/* is the only
# exclusion available on Container installs, and this cache runs to several GB.
# Served by the protect_cache custom_component (a symlink from www/ cannot work
# — aiohttp's static handler refuses paths that resolve outside its root).
BASE_DIR = "/config/.cache/protect_scrub"  # served at /protect_scrub
THUMBS_DIR = "/config/.cache/protect_thumbs"  # protect_thumbs cache — the event list
                                              # used to cut blocks at event boundaries
BLOCK_S = 600              # block length: 10 min, epoch-aligned
TIMELAPSE_FPS = 4          # uiprotect fps param (app presets: 60x=4 ... 600x=40);
                           # the NVR returns 640×360 regardless — this only trades
                           # frame density (scrub granularity) vs file size
RETENTION_HOURS = 168      # rolling window; == protect_thumbs LOOKBACK_HOURS
SAFETY_LAG_S = 60          # only export blocks fully older than this (NVR flush)
HEAD_LAG_S = 10            # head block reaches up to now minus this (NVR flush)
HEAD_MIN_S = 20            # don't export a head shorter than this (just after a
                           # block boundary the previous head still covers)
# The head is the ONLY playable file that gets re-exported, so its name carries
# the range it covers: h<start_ms>-<end_ms>.mp4. This is a correctness
# requirement, not tidiness. It used to be one head.mp4 overwritten in place
# while the card mapped it with a range read from a separately cached
# index.json — and because SAFETY_LAG_S delays head_start past each block
# boundary, that file SHRINKS from ~620s of coverage to ~50s and jumps to a
# different 10 minutes at every xx:x1:00 run. A card holding a <=60s-old index
# then seeked proportionally into bytes from a completely different time and
# showed a frame up to ~9 minutes away from its own label (worst near live,
# which is exactly where the head is the only source). With the range in the
# name, URL == range == bytes: a stale index can only make the preview OLDER,
# never wrong.
HEAD_PREFIX = "h"
KEEP_HEADS = 3             # head generations kept (~3 min, ~1 MB): enough for a
                           # client holding a 60s-stale index plus one missed run
MAX_EXPORTS_PER_RUN = 10   # backfill spreads over many 1-minute runs
EXPORT_GAP_S = 0.5         # pause between exports (serial / gentle on the NVR)
EXPORT_MAX_ATTEMPTS = 3    # per-block retry cap (no footage / transient errors)
INDEX_VERSION = 2          # v2 = head advertises its immutable `file` name
MAP_VERSION = 2            # v2 = per-part files (v1 concat sidecars are ignored)
# Segment splitting: the NVR's timelapse packs frames back-to-back with NO
# real-time info, at content-driven density (~4.6s/frame during motion,
# 12-150s/frame idle on adaptive recording) — a single-file linear time mapping
# skews by minutes around events. So blocks containing events are exported as
# SEPARATE standalone part files cut at padded event boundaries, with a sidecar
# map (<start>.map.json) recording each part's real range — the card plays the
# covering part and can never show an event frame under an idle timestamp
# (or vice versa).
SEG_MERGE_EPS_S = 5        # idle slivers shorter than this merge into a neighbour
MAX_SEGMENTS = 12          # cap exports per block (merge smallest segments over it)
# Splitting only earns its keep under ADAPTIVE recording. With always-on
# recording at a single quality the timelapse density is uniform across a block
# — measured 2.35 / 2.29 / 2.40 s of real time per frame across the three parts
# of a split block — so one linear mapping is accurate and splitting just costs
# extra NVR exports plus a .map.json round trip before the card can resolve
# ANY playable unit. Set back to True if adaptive/smart recording returns
# (symptom: scrub timestamps drift ~80s around events).
SPLIT_AT_EVENTS = False

# ---- overview tier ----------------------------------------------------------
# A second, much coarser timelapse used while DRAGGING: at 10-minute blocks a
# fast drag across 6-12 h crosses 36-72 files and the card can only fetch the
# ones the playhead lingers in, so the stage holds one frozen frame. The
# overview covers an hour per file at a fraction of the bytes, so it can be
# prefetched and shown instantly; the fine block upgrades the frame when it
# lands. Density is speedup / output_fps: at 25 fps CFR, fps=20 (300x) gives one
# frame per 12 s of real time, ~700 KB per hour-file (~17 MB/day/camera).
# Tuning: raise to 40 (600x, one frame per 24 s) if long drags still stutter;
# drop to 10 (150x, one frame per 6 s) for smoother drags at ~2x the bytes.
OVERVIEW_BLOCK_S = 3600
OVERVIEW_FPS = 20
OVERVIEW_PREFIX = "o"      # o<start_ms>.mp4, alongside the fine <start_ms>.mp4
MAX_OVERVIEW_PER_RUN = 3   # own small budget so a fine-block backfill can't
                           # starve it (168 files/camera -> covered in ~1 hour)

# ---- sprite tier (SPRITE-PREVIEW-2026-08-04) --------------------------------
# A decoder-free copy of every playable unit: the same frames, laid out as JPEG
# mosaics instead of an MP4, so a client can show a scrub frame with one canvas
# drawImage and never touch the video decoder.
#
# WHY this exists (measured on the Lenovo Idea Tab, Mali-G57, 2026-08-04):
#   * seeking an MP4 costs 99 ms there (p90 122) vs 10 ms on a MacBook-class
#     device, capping the scrub preview at ~10 updates/sec no matter how fast
#     the JavaScript around it is — that ceiling IS the "preview won't follow my
#     finger" bug, and no client-side optimisation can move it;
#   * every fresh <video> costs another ~198 ms of decoder start-up, paid twice
#     per gesture and again at each block boundary;
#   * drawing one sprite tile on the SAME device costs 0.53 ms — ~190x cheaper
#     than a seek, i.e. comfortably inside a 60 Hz frame.
# The client decides which tier to use by MEASURING ITSELF; this job just
# publishes both, so fast devices keep the sharper video preview untouched.
#
# The format choices are measurements from that device too, not preferences:
#   * JPEG over WebP — decode 55 ms vs 108 ms and draw 0.53 vs 0.86 ms, for only
#     ~9% more bytes. Mobile decoders are far better at JPEG.
#   * sheets must stay at/under ~2560x1440. The same tiles packed into 5120x2880
#     sheets drew at 1.30 ms instead of 0.53 ms even on a device whose
#     MAX_TEXTURE_SIZE is 8192 — and 4096 is a common mobile cap, past which the
#     texture upload can fail outright. Keep SPRITE_COLS * SPRITE_TILE_W and
#     SPRITE_ROWS * SPRITE_TILE_H under 2560.
SPRITES_ENABLED = True
# FULL SOURCE RESOLUTION as of 2026-08-04. 480x270 was visibly softer than the
# near-live video tier (which is the 640x360 mp4), and the seam was obvious the
# moment scrubbing crossed out of the head region into sprite territory. Since
# sprites are generated FROM that mp4 they can never beat it — matching it is
# the whole target. Measured against the exact source frame, single 640x360
# frame, SSIM: jpg q=8 -> 0.930 (28 KB), q=6 -> 0.949 (37 KB), q=4 -> 0.970
# (54 KB), q=2 -> 0.989 (88 KB). WebP is equivalent in this range (q=60 ->
# 0.937 / 32 KB) and the tablet decodes it TWICE as slowly, so JPEG stays.
SPRITE_TILE_W = 640
SPRITE_TILE_H = 360
SPRITE_COLS = 4            # 4x4 = 16 frames per sheet -> 2560x1440, the largest
SPRITE_ROWS = 4            # geometry measured as fast on the tablet (0.53 ms)
SPRITE_QUALITY = 4         # ~54 KB/frame, SSIM 0.97 vs source. ~35 GB for 3
                           # cameras over the 7-day window; 6 -> ~24 GB (0.95),
                           # 8 -> ~18 GB (0.93), 2 -> ~55 GB (0.99).
SPRITE_VERSION = 1
# Changing ANY of the four settings above invalidates every sheet on disk. The
# signature below is stored in state.json and compared each run; a mismatch
# wipes that camera's sheets so they rebuild at the new setting, which means
# retuning quality is a one-line edit and never a manual cleanup.
SPRITE_SIG = "%sx%s:%sx%s:q%s" % (
    SPRITE_TILE_W, SPRITE_TILE_H, SPRITE_COLS, SPRITE_ROWS, SPRITE_QUALITY)
# Built from the ALREADY CACHED mp4 — no NVR call, no network, ~0.28 s per block
# — so this budget is only about not hogging the executor on a busy HA. At 60 a
# run costs ~17 s of ONE executor thread per minute and a full 7-day backfill
# (~3500 units across 3 cameras) completes in about an hour; drop it back toward
# 20 if HA ever feels sluggish while the cache is filling.
MAX_SPRITE_PER_RUN = 60
SPRITE_SUFFIX = ".sprite.json"  # sidecar; its presence means "sheets complete"

# Dedicated FAST-SCRUB atlas. The ordinary 640x360 sheets remain the fine tier
# when movement slows; this overview-only tier trades detail for predictable
# cadence during multi-hour swipes. The source overview carries ~300 frames per
# hour. Keeping every fifth frame gives one frame/minute, and 5x5 packing turns
# an hour from 19 requests / ~11-15 MB into 3 requests / ~1 MB.
FAST_SPRITES_ENABLED = True
FAST_SPRITE_TILE_W = 480
FAST_SPRITE_TILE_H = 270
FAST_SPRITE_COLS = 5
FAST_SPRITE_ROWS = 5
FAST_SPRITE_QUALITY = 6
FAST_SPRITE_STRIDE = 5
FAST_SPRITE_VERSION = 1
FAST_SPRITE_SUFFIX = ".fast-sprite.json"
FAST_SPRITE_SIG = "%sx%s:%sx%s:q%s:stride%s" % (
    FAST_SPRITE_TILE_W, FAST_SPRITE_TILE_H,
    FAST_SPRITE_COLS, FAST_SPRITE_ROWS,
    FAST_SPRITE_QUALITY, FAST_SPRITE_STRIDE)
MAX_FAST_SPRITE_PER_RUN = 12
# PURGING: sheets are "<stem>.s<i>.jpg" and the sidecar "<stem>.sprite.json", so
# for FINE blocks the existing expired-block sweep (which deletes every name
# whose leading dot-segment is an expired block start) already removes them. The
# overview sweep matches "o<start>.mp4" explicitly and is extended below.
# NOT generated for the head/tip tiers: the head is re-exported every minute, so
# sheets for it would cost ~11 files a minute per camera to cover a few minutes
# of footage. Near-live scrubbing stays on the video path (i.e. exactly today's
# behaviour) until that proves worth solving separately.

# ---- tip tier (EXPERIMENTAL) ------------------------------------------------
# On-demand real-time clip of the newest TIP_S seconds, exported when the user
# STARTS SCRUBBING rather than on a schedule. Measured on this NVR (2026-07-27):
#   * footage is available 1 SECOND behind live — a 30s window ending 1s ago
#     returned a complete 900-frame clip, so HEAD_LAG_S=10 plus the per-minute
#     cron was never an NVR limit, nothing was simply asking;
#   * channel 2 serves 640×360 NATIVELY (channel 0 gave 2688px / 8.96 MB for the
#     same range) so no 4K fallback and no downscale pass;
#   * an fps=None (PLAIN, not timelapse) export of 30s = 900 frames / 0.94 MB in
#     ~1s — i.e. ~2 MB and ~1.5s for 60s.
# So the tip is both fresher AND frame-accurate (~30fps) where the timelapse
# head is one frame per 2.4s. Advertised in its own small tip.json, never in
# index.json: the cron rewrites that file and the two writers would race.
TIP_S = 60                 # window length (~2 MB at 640×360 real time)
TIP_LAG_S = 2              # measured floor is 1s; 2s of headroom
TIP_CHANNEL = 2            # low-res tier — native 640×360, no transcode
TIP_PREFIX = "t"           # t<start_ms>-<end_ms>.mp4 (immutable, as for heads)
TIP_MIN_S = 5              # ignore absurdly short requests
KEEP_TIPS = 2              # generations kept for in-flight clients
TIP_MAX_AGE_S = 900        # cron drops tips older than this (the head covers them)
# Raw NVR exports have hit browser DECODE errors on BACKWARD seeks (the reason
# split parts are normalized — see _store_block). Scrubbing seeks backward
# constantly, so the tip is re-encoded to clean CFR with 1s keyframes by
# default. Flip to False (or pass encode=False to the service) if a raw export
# proves to seek fine — it saves the encode time.
TIP_ENCODE = True


# ---- filesystem helpers -----------------------------------------------------
# Same constraints as protect_thumbs.py: pyscript sandboxes builtins.open, so all
# file I/O is low-level os.open/os.read/os.write; os.listdir is loop-protected by
# HA and runs via task.executor (it accepts stdlib callables).

def _ensure_dir(path):
    os.makedirs(path, exist_ok=True)


def _write_bytes(path, data):
    tmp = path + ".tmp"
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)
    try:
        os.write(fd, data)
    finally:
        os.close(fd)
    os.replace(tmp, path)  # atomic: readers never see a half-written file


def _write_json(path, obj):
    _write_bytes(path, json.dumps(obj).encode("utf-8"))


def _read_json(path):
    """Parse a JSON file via low-level os I/O; None if missing/corrupt."""
    if not os.path.exists(path):
        return None
    try:
        fd = os.open(path, os.O_RDONLY)
        try:
            chunks = []
            while True:
                chunk = os.read(fd, 65536)
                if not chunk:
                    break
                chunks.append(chunk)
        finally:
            os.close(fd)
        return json.loads(b"".join(chunks).decode("utf-8"))
    except (OSError, ValueError):
        return None


def _probe_width(path):
    """Video width in px via ffprobe; 0 if unreadable (treat as a bad export)."""
    try:
        res = task.executor(
            subprocess.run,
            ["ffprobe", "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=width", "-of", "csv=p=0", path],
            capture_output=True, timeout=30,
        )
        return int(res.stdout.decode().strip() or 0)
    except (OSError, ValueError, subprocess.SubprocessError):
        return 0


def _probe_duration_ms(path):
    """Container duration in ms via ffprobe; 0 if unreadable."""
    try:
        res = task.executor(
            subprocess.run,
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "csv=p=0", path],
            capture_output=True, timeout=30,
        )
        return int(float(res.stdout.decode().strip() or 0) * 1000)
    except (OSError, ValueError, subprocess.SubprocessError):
        return 0


def _store_block(path, data, force_encode=False):
    """Validate + store one exported block atomically; downscale 4K fallbacks.

    `force_encode` re-encodes even 640-wide input: segment PART files are
    always normalized because the NVR's raw short exports can hit browser
    DECODE errors on backward seeks (unreliable VFR structure) — a clean CFR
    libx264 file seeks perfectly. Returns True if a playable block ended up
    at `path`."""
    tmp_raw = path + ".raw.tmp.mp4"
    _write_bytes(tmp_raw, data)  # atomic within itself (.tmp -> rename)
    width = _probe_width(tmp_raw)
    if width == 0:
        os.remove(tmp_raw)
        return False
    if width <= 640 and not force_encode:
        os.replace(tmp_raw, path)
        return True
    # 4K fallback and/or normalization — re-encode to clean 640×360 CFR.
    tmp_out = path + ".sc.tmp.mp4"
    try:
        res = task.executor(
            subprocess.run,
            ["ffmpeg", "-y", "-v", "error", "-i", tmp_raw,
             "-vf", "scale=640:360", "-r", "25", "-c:v", "libx264",
             "-preset", "veryfast", "-crf", "27",
             # Keyframe every second: backward scrub-seeks only ever rebuffer
             # <=1s of video, which keeps fragile decoders happy and snappy.
             "-g", "25", "-keyint_min", "25",
             "-an", "-movflags", "+faststart", tmp_out],
            capture_output=True, timeout=120,
        )
        ok = res.returncode == 0 and os.path.exists(tmp_out)
    except (OSError, subprocess.SubprocessError):
        ok = False
    if ok:
        os.replace(tmp_out, path)
    else:
        log.warning("protect_scrub: transcode failed for %s (width=%s)", path, width)
        for t in (tmp_out,):
            if os.path.exists(t):
                os.remove(t)
    os.remove(tmp_raw)
    return ok


def _probe_frame_count(path):
    """Number of video frames; 0 if unreadable.

    SPRITE-PREVIEW-2026-08-04. The container header is tried first (the NVR's
    exports carry nb_frames and it costs nothing); counting is the fallback for
    re-encoded files that don't. The count is what maps a time onto a tile, so a
    wrong one skews every frame in the block — never guess it from duration.
    """
    for args in (
        ["-show_entries", "stream=nb_frames"],
        ["-count_frames", "-show_entries", "stream=nb_read_frames"],
    ):
        try:
            res = task.executor(
                subprocess.run,
                ["ffprobe", "-v", "error", "-select_streams", "v:0"] + args
                + ["-of", "csv=p=0", path],
                capture_output=True, timeout=60,
            )
            n = int(res.stdout.decode().strip().rstrip(",") or 0)
            if n > 0:
                return n
        except (OSError, ValueError, subprocess.SubprocessError):
            pass
    return 0


def _sprite_sheets(cam_dir, stem):
    """Render <stem>.mp4 into JPEG mosaics + a sidecar. True if it ended up
    complete. SPRITE-PREVIEW-2026-08-04.

    The sidecar is written LAST and is the only completeness marker: a client
    reads it before touching a sheet, so an interrupted run just leaves orphan
    .jpg files that the next run overwrites (the render is deterministic for the
    same source, so a half-written sheet can never become permanently wrong).
    """
    src = os.path.join(cam_dir, stem + ".mp4")
    if not os.path.exists(src):
        return False
    count = _probe_frame_count(src)
    if count <= 0:
        return False
    per = SPRITE_COLS * SPRITE_ROWS
    n_sheets = (count + per - 1) // per
    # ffmpeg's image2 muxer numbers its output from 1.
    pattern = os.path.join(cam_dir, stem + ".s%d.jpg")
    try:
        res = task.executor(
            subprocess.run,
            ["ffmpeg", "-y", "-v", "error", "-i", src,
             "-vf", "scale=%s:%s,tile=%sx%s" % (
                 SPRITE_TILE_W, SPRITE_TILE_H, SPRITE_COLS, SPRITE_ROWS),
             "-q:v", str(SPRITE_QUALITY), pattern],
            capture_output=True, timeout=180,
        )
        ok = res.returncode == 0
    except (OSError, subprocess.SubprocessError):
        ok = False
    if not ok:
        log.warning("protect_scrub: sprite render failed for %s", stem)
        return False
    sheets = []
    for i in range(1, n_sheets + 1):
        nm = "%s.s%s.jpg" % (stem, i)
        if not os.path.exists(os.path.join(cam_dir, nm)):
            log.warning("protect_scrub: sprite sheet %s missing after render", nm)
            return False
        sheets.append(nm)
    # `count` is the ground truth for time -> tile: tile = floor(frac * count),
    # sheet = tile // per, position = tile % per. The trailing tiles of the last
    # sheet are padding and must never be shown, which is exactly what `count`
    # prevents.
    _write_json(os.path.join(cam_dir, stem + SPRITE_SUFFIX), {
        "version": SPRITE_VERSION,
        "tile_w": SPRITE_TILE_W,
        "tile_h": SPRITE_TILE_H,
        "cols": SPRITE_COLS,
        "rows": SPRITE_ROWS,
        "count": count,
        "sheets": sheets,
    })
    return True


def _fast_sprite_sheets(cam_dir, stem):
    """Render one decimated, compact overview atlas plus its sidecar."""
    src = os.path.join(cam_dir, stem + ".mp4")
    if not os.path.exists(src):
        return False
    source_count = _probe_frame_count(src)
    if source_count <= 0:
        return False
    count = (source_count + FAST_SPRITE_STRIDE - 1) // FAST_SPRITE_STRIDE
    per = FAST_SPRITE_COLS * FAST_SPRITE_ROWS
    n_sheets = (count + per - 1) // per
    pattern = os.path.join(cam_dir, stem + ".f%d.jpg")
    vf = "select='not(mod(n,%s))',scale=%s:%s,tile=%sx%s" % (
        FAST_SPRITE_STRIDE,
        FAST_SPRITE_TILE_W, FAST_SPRITE_TILE_H,
        FAST_SPRITE_COLS, FAST_SPRITE_ROWS)
    try:
        res = task.executor(
            subprocess.run,
            ["ffmpeg", "-y", "-v", "error", "-i", src,
             "-vf", vf, "-vsync", "0",
             "-q:v", str(FAST_SPRITE_QUALITY), pattern],
            capture_output=True, timeout=180,
        )
        ok = res.returncode == 0
    except (OSError, subprocess.SubprocessError):
        ok = False
    if not ok:
        log.warning("protect_scrub: fast sprite render failed for %s", stem)
        return False
    sheets = []
    for i in range(1, n_sheets + 1):
        nm = "%s.f%s.jpg" % (stem, i)
        if not os.path.exists(os.path.join(cam_dir, nm)):
            log.warning("protect_scrub: fast sprite sheet %s missing", nm)
            return False
        sheets.append(nm)
    _write_json(os.path.join(cam_dir, stem + FAST_SPRITE_SUFFIX), {
        "version": FAST_SPRITE_VERSION,
        "tile_w": FAST_SPRITE_TILE_W,
        "tile_h": FAST_SPRITE_TILE_H,
        "cols": FAST_SPRITE_COLS,
        "rows": FAST_SPRITE_ROWS,
        "count": count,
        "sheets": sheets,
    })
    return True


def _purge_sprites(cam_dir, names, stems):
    """Delete sheets + sidecars belonging to `stems` (used for the overview
    tier, whose names the digit-led block sweep never matches).
    SPRITE-PREVIEW-2026-08-04."""
    if not stems:
        return
    for nm in names:
        hit = False
        for stem in stems:
            if nm == stem + SPRITE_SUFFIX:
                hit = True
            elif nm.startswith(stem + ".s") and nm.endswith(".jpg"):
                hit = True
        if not hit:
            continue
        try:
            os.remove(os.path.join(cam_dir, nm))
        except OSError:
            pass


def _purge_fast_sprites(cam_dir, names, stems):
    """Delete fast-atlas sheets + sidecars for supplied overview stems."""
    if not stems:
        return
    for nm in names:
        hit = False
        for stem in stems:
            if nm == stem + FAST_SPRITE_SUFFIX:
                hit = True
            elif nm.startswith(stem + ".f") and nm.endswith(".jpg"):
                hit = True
        if not hit:
            continue
        try:
            os.remove(os.path.join(cam_dir, nm))
        except OSError:
            pass


def _read_events_meta(slug):
    """(events, pre_ms, post_ms) from the protect_thumbs manifest for a camera.
    Empty when the event cache isn't running — blocks then export unsplit."""
    m = _read_json(os.path.join(THUMBS_DIR, slug, "manifest.json")) or {}
    events = m.get("events") or []
    return events, int(m.get("pre_ms") or 0), int(m.get("post_ms") or 0)


def _block_segments(start_ms, end_ms, events, pre_ms, post_ms):
    """Cut [start_ms, end_ms) at padded event boundaries.

    Returns chronological (seg_start, seg_end) tuples covering the whole range:
    recorded-motion spans (event ± recording padding, overlaps merged) alternate
    with idle spans. Within each segment the timelapse frame density is roughly
    constant, so a per-segment linear time mapping is accurate."""
    if not SPLIT_AT_EVENTS:
        return [(start_ms, end_ms)]  # uniform recording — one linear mapping fits
    spans = []
    for e in events:
        s = e["start"] - pre_ms
        en = e["end"] + post_ms
        if en <= start_ms or s >= end_ms:
            continue
        spans.append((max(s, start_ms), min(en, end_ms)))
    spans.sort()
    merged = []
    for s, en in spans:
        if merged and s - merged[-1][1] < SEG_MERGE_EPS_S * 1000:
            merged[-1] = (merged[-1][0], max(merged[-1][1], en))
        else:
            merged.append((s, en))
    segs = []
    cur = start_ms
    for s, en in merged:
        if s - cur >= SEG_MERGE_EPS_S * 1000:
            segs.append((cur, s))
        else:
            s = cur  # tiny idle sliver — absorb into the event segment
        segs.append((s, en))
        cur = en
    if end_ms - cur >= SEG_MERGE_EPS_S * 1000:
        segs.append((cur, end_ms))
    elif segs:
        segs[-1] = (segs[-1][0], end_ms)
    else:
        segs = [(start_ms, end_ms)]
    # Cap exports per block: merge the shortest segment into its predecessor.
    # (Explicit loop, no min(key=lambda...): pyscript lambdas can't close over
    # enclosing-function locals — `segs` would be undefined inside the lambda.)
    while len(segs) > MAX_SEGMENTS:
        shortest = 1
        for j in range(1, len(segs)):
            if segs[j][1] - segs[j][0] < segs[shortest][1] - segs[shortest][0]:
                shortest = j
        segs[shortest - 1] = (segs[shortest - 1][0], segs[shortest][1])
        del segs[shortest]
    return segs


def _cleanup_split(cam_dir, name):
    """Remove a block's split representation (sidecar + part files)."""
    for nm in task.executor(os.listdir, cam_dir):
        if nm.startswith(f"{name}.p") or nm == f"{name}.map.json":
            try:
                os.remove(os.path.join(cam_dir, nm))
            except OSError:
                pass


def _head_stem(nm):
    """`h<start>-<end>` if `nm` belongs to a head generation, else None.

    Matches the mp4, its split parts (.p<k>.mp4), its sidecar and any temp file
    of that generation — they all share the stem before the first dot."""
    stem = nm.split(".")[0]
    if not stem.startswith(HEAD_PREFIX):
        return None
    bits = stem[len(HEAD_PREFIX):].split("-")
    if len(bits) != 2 or not bits[0].isdigit() or not bits[1].isdigit():
        return None
    return stem


def _reap_heads(cam_dir, keep, protect=None):
    """Keep the newest `keep` head generations; delete older ones and any legacy
    head.mp4 left over from before the immutable naming. `protect` is the stem
    currently advertised in the index — never reaped, however old (the export may
    have been failing for a while and that file is the only coverage left).

    The head gets a NEW name every run, so the digit-led rolling-window purge in
    the main job never sees these files — they need their own reaper. Several
    generations survive on purpose: a card whose index.json is up to a minute old
    still names an older generation, and that file must still be there (and still
    covers exactly its advertised range, so the frame is correct, just older)."""
    gens = {}
    legacy = []
    for nm in task.executor(os.listdir, cam_dir):
        if nm.split(".")[0] == "head":
            legacy.append(nm)  # pre-immutable head.mp4 / head.map.json / parts
            continue
        stem = _head_stem(nm)
        if stem is None:
            continue
        if stem not in gens:
            gens[stem] = []
        gens[stem].append(nm)
    doomed = list(legacy)
    if len(gens) > keep:
        # Newest last by the END time in the stem (starts repeat within a block).
        stems = sorted(gens.keys(), key=lambda s: int(s.split("-")[1]))
        for stem in stems[:-keep]:
            if stem != protect:
                doomed.extend(gens[stem])
    for nm in doomed:
        try:
            os.remove(os.path.join(cam_dir, nm))
        except OSError:
            pass


def _reap_tips(cam_dir, keep, now_ms=0, protect=None):
    """Keep the newest `keep` tip generations (and drop any older than
    TIP_MAX_AGE_S when `now_ms` is given — by then the cron's head covers that
    range and the tip is dead weight). Same stem rule as _reap_heads."""
    gens = {}
    for nm in task.executor(os.listdir, cam_dir):
        stem = nm.split(".")[0]
        if not stem.startswith(TIP_PREFIX):
            continue
        bits = stem[len(TIP_PREFIX):].split("-")
        if len(bits) != 2 or not bits[0].isdigit() or not bits[1].isdigit():
            continue
        if stem not in gens:
            gens[stem] = []
        gens[stem].append(nm)
    stems = sorted(gens.keys(), key=lambda s: int(s.split("-")[1]))
    doomed = []
    for i, stem in enumerate(stems):
        if stem == protect:
            continue
        too_old = now_ms and int(stem.split("-")[1]) < now_ms - TIP_MAX_AGE_S * 1000
        if too_old or i < len(stems) - keep:
            doomed.extend(gens[stem])
    for nm in doomed:
        try:
            os.remove(os.path.join(cam_dir, nm))
        except OSError:
            pass


def _export_range(api, cam_id, s_ms, e_ms, fps=TIMELAPSE_FPS, channel=0):
    """One NVR export. `fps=None` = a PLAIN (real-time) export rather than a
    timelapse; `channel` selects the recording tier (2 = the low-res 640×360
    one, which never hits the 4K fallback). channel_index is only passed when
    non-zero so the block pipeline's calls stay byte-for-byte what they were."""
    start_dt = datetime.fromtimestamp(s_ms / 1000, tz=timezone.utc)
    end_dt = datetime.fromtimestamp(e_ms / 1000, tz=timezone.utc)
    try:
        if channel:
            return api.get_camera_video(cam_id, start_dt, end_dt, fps=fps,
                                        channel_index=channel)
        return api.get_camera_video(cam_id, start_dt, end_dt, fps=fps)
    except Exception as err:  # noqa: BLE001
        log.warning("protect_scrub: export failed %s-%s: %r", s_ms, e_ms, err)
        return None


def _export_overview(api, cam_id, c, start_ms):
    """Export one epoch-aligned hour into o<start_ms>.mp4 at OVERVIEW_FPS.

    Never split: at this speedup the density is uniform by construction, so the
    card's linear mapping is exact. force_encode because the NVR's raw exports
    hit browser DECODE errors on backward seeks — the exact thing a drag does."""
    data = _export_range(api, cam_id, start_ms, start_ms + OVERVIEW_BLOCK_S * 1000,
                         fps=OVERVIEW_FPS)
    task.sleep(EXPORT_GAP_S)
    if not data:
        return False
    path = os.path.join(c["dir"], f"{OVERVIEW_PREFIX}{start_ms}.mp4")
    return _store_block(path, data, force_encode=True)


def _export_block_split(api, cam_id, c, start_ms, end_ms, name):
    """Export [start_ms, end_ms) as one <name>.mp4 when its content is uniform,
    or — when events cut it into segments — as SEPARATE part files
    <name>.p<k>.mp4 plus a <name>.map.json sidecar listing each part's real
    range. Parts are deliberately NOT concatenated: the NVR's exports are VFR
    with unreliable container durations (a concat re-times them — measured),
    so the card plays the covering part standalone and uses the <video>
    element's own duration as the exact ground truth for its per-segment
    linear time mapping. Returns (ok, nvr_exports_used)."""
    final = os.path.join(c["dir"], f"{name}.mp4")
    map_path = os.path.join(c["dir"], f"{name}.map.json")
    segs = _block_segments(start_ms, end_ms, c["events"], c["pre"], c["post"])
    if len(segs) == 1:
        # Uniform block (all idle, or one continuous event) — single export,
        # linear mapping is fine, no sidecar.
        data = _export_range(api, cam_id, start_ms, end_ms)
        task.sleep(EXPORT_GAP_S)
        if not (data and _store_block(final, data)):
            return (False, 1)
        _cleanup_split(c["dir"], name)  # stale parts from an older split export
        return (True, 1)
    used = 0
    segments = []
    for k, (s, en) in enumerate(segs):
        data = _export_range(api, cam_id, s, en)
        used += 1
        task.sleep(EXPORT_GAP_S)
        if not data:
            continue  # no footage for this span — the map just omits it
        fname = f"{name}.p{k}.mp4"
        if _store_block(os.path.join(c["dir"], fname), data, force_encode=True):
            segments.append({"s": s, "e": en, "f": fname})
    if not segments:
        return (False, used)
    # Sidecar written LAST — its presence marks the split block as complete.
    _write_json(map_path, {"version": MAP_VERSION, "segments": segments})
    if os.path.exists(final):
        os.remove(final)  # replaced by the per-part representation
    return (True, used)


def _get_api():
    """The integration's authenticated uiprotect client (ProtectApiClient)."""
    entry = None
    if ENTRY_ID:
        entry = hass.config_entries.async_get_entry(ENTRY_ID)
    else:
        entries = hass.config_entries.async_entries("unifiprotect")
        entry = entries[0] if entries else None
    if entry is None:
        return None
    data = getattr(entry, "runtime_data", None)
    return getattr(data, "api", None)


def _write_index(cam_dir, blocks, maps, head, now_ms, overview,
                 sprites=None, o_sprites=None, fast_sprites=None, fast_o_sprites=None,
                 fast_sprite_started=None):
    _write_json(os.path.join(cam_dir, "index.json"), {
        "version": INDEX_VERSION,
        "generated": now_ms,
        "block_ms": BLOCK_S * 1000,
        "blocks": sorted(blocks),
        # Coarse overview tier (o<start>.mp4), one file per hour — what the
        # card shows while dragging, before the fine block has downloaded.
        # Additive: an older card ignores both keys and just uses `blocks`.
        "overview_block_ms": OVERVIEW_BLOCK_S * 1000,
        "overview": sorted(overview),
        # Blocks that were split at event boundaries and carry a
        # <start>.map.json sidecar (piecewise time mapping for the card).
        "maps": sorted(maps),
        # Rolling partial export of the CURRENT (incomplete) block, re-exported
        # each run so scrubbing works up to ~a minute behind live.
        # {start, end, map, file} — `file` is the immutable per-generation name
        # (h<start>-<end>.mp4) covering exactly [start, end]; the card must map
        # THAT file, never a fixed name, or a stale index skews the frame.
        "head": head,
        # SPRITE-PREVIEW-2026-08-04: units that also have decoder-free JPEG
        # mosaics. Additive — a card that doesn't know these keys ignores them
        # and keeps using the mp4 tiers exactly as before. Per-unit geometry
        # lives in "<stem>.sprite.json" (immutable, cache-forever) because the
        # frame COUNT varies per unit and listing it here would bloat a file
        # that is re-read every minute.
        "sprite_meta": {
            "version": SPRITE_VERSION,
            "tile_w": SPRITE_TILE_W,
            "tile_h": SPRITE_TILE_H,
            "cols": SPRITE_COLS,
            "rows": SPRITE_ROWS,
            "suffix": SPRITE_SUFFIX,
        } if SPRITES_ENABLED else None,
        "sprites": sorted(sprites or []),
        "osprites": sorted(o_sprites or []),
        "fast_sprite_meta": {
            "version": FAST_SPRITE_VERSION,
            "tile_w": FAST_SPRITE_TILE_W,
            "tile_h": FAST_SPRITE_TILE_H,
            "cols": FAST_SPRITE_COLS,
            "rows": FAST_SPRITE_ROWS,
            "stride": FAST_SPRITE_STRIDE,
            "suffix": FAST_SPRITE_SUFFIX,
        } if FAST_SPRITES_ENABLED else None,
        "fast_sprites": sorted(fast_sprites or []),
        "fast_osprites": sorted(fast_o_sprites or []),
        "fast_sprite_started": fast_sprite_started,
    })


# ---- tip tier (EXPERIMENTAL) ------------------------------------------------

@service
def protect_scrub_tip(slug="", seconds=0, encode=None):
    """EXPERIMENTAL: export the newest ~TIP_S seconds for ONE camera, on demand.

    The card calls this the moment a scrub gesture starts near the live edge.
    Unlike the cron-driven head this reaches to within TIP_LAG_S of live and is
    a PLAIN (real-time, ~30fps) export, so the newest minute scrubs frame by
    frame instead of one frame per 2.4s. Writes t<start>-<end>.mp4 plus a small
    tip.json naming it — deliberately NOT index.json, which the cron owns and
    rewrites every run (two writers would race).

    Call: pyscript.protect_scrub_tip with slug: <camera object_id>."""
    # A second gesture while one export is in flight is a no-op: the running
    # one is about to publish a tip at least as fresh as the new request.
    task.unique(f"protect_scrub_tip_{slug}", kill_me=True)
    if not slug:
        log.error("protect_scrub_tip: slug is required")
        return
    cam_id = None
    for cid, s in CAMERAS.items():
        if s == slug:
            cam_id = cid
    if cam_id is None:
        log.error("protect_scrub_tip: unknown slug %s", slug)
        return
    api = _get_api()
    if api is None:
        log.error("protect_scrub_tip: uiprotect client unavailable")
        return

    span_s = int(seconds) or TIP_S
    if span_s < TIP_MIN_S:
        return
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    end_ms = now_ms - TIP_LAG_S * 1000
    start_ms = end_ms - span_s * 1000
    cam_dir = os.path.join(BASE_DIR, slug)
    _ensure_dir(cam_dir)

    # fps=None => plain real-time export (a timelapse would defeat the point).
    data = _export_range(api, cam_id, start_ms, end_ms, fps=None, channel=TIP_CHANNEL)
    if not data:
        log.warning("protect_scrub_tip: %s -> empty export %s-%s", slug, start_ms, end_ms)
        return
    do_encode = TIP_ENCODE if encode is None else bool(encode)
    pending = os.path.join(cam_dir, f"{TIP_PREFIX}pending.mp4")
    if not _store_block(pending, data, force_encode=do_encode):
        log.warning("protect_scrub_tip: %s -> unplayable export %s-%s", slug, start_ms, end_ms)
        return
    # The NVR pads the START of an export with a keyframe lead-in — measured
    # 4.4s on a 60s request, and VERIFIED against the camera's burnt-in clock:
    # the last frame lands exactly on the requested end, the first one early.
    # The card maps a file linearly onto its advertised range, so the range has
    # to be what the bytes ACTUALLY cover or every frame is skewed. Derive it
    # from the stored file's own duration (post-encode: that is what plays).
    dur_ms = _probe_duration_ms(pending)
    if dur_ms <= 0:
        os.remove(pending)
        log.warning("protect_scrub_tip: %s -> undurated export", slug)
        return
    start_ms = end_ms - dur_ms
    name = f"{TIP_PREFIX}{start_ms}-{end_ms}"
    os.replace(pending, os.path.join(cam_dir, f"{name}.mp4"))
    # Published LAST, so the card never sees a tip.json naming a file that is
    # still being written. Same contract as the head: the name states the range.
    _write_json(os.path.join(cam_dir, "tip.json"), {
        "version": 1,
        "generated": now_ms,
        "start": start_ms,
        "end": end_ms,
        "file": f"{name}.mp4",
    })
    _reap_tips(cam_dir, KEEP_TIPS, protect=name)
    log.debug("protect_scrub_tip: %s -> %s (%s bytes)", slug, name, len(data))


# ---- main job ---------------------------------------------------------------

@time_trigger("cron(* * * * *)")
@service
def protect_scrub_sync():
    """Export missing timelapse blocks, purge the rolling window, write index.

    Call manually via: service: pyscript.protect_scrub_sync
    """
    # Per-minute cron + on-demand service calls must never overlap.
    task.unique("protect_scrub_sync", kill_me=True)

    if not CAMERAS:
        # Not an error every 60s: the module-level load already logged it once.
        log.debug("protect_scrub: no cameras configured — nothing to do")
        return
    api = _get_api()
    if api is None:
        log.error("protect_scrub: uiprotect client unavailable; aborting")
        return

    now = datetime.now(timezone.utc)
    now_ms = int(now.timestamp() * 1000)
    block_ms = BLOCK_S * 1000
    cutoff_ms = now_ms - RETENTION_HOURS * 3600 * 1000
    # Oldest block start in the window (aligned), newest completed block start.
    first_start = ((cutoff_ms + block_ms - 1) // block_ms) * block_ms
    last_start = ((now_ms - SAFETY_LAG_S * 1000) // block_ms - 1) * block_ms
    over_ms = OVERVIEW_BLOCK_S * 1000
    last_o = ((now_ms - SAFETY_LAG_S * 1000) // over_ms - 1) * over_ms

    # Per camera: what's on disk, what's expired, what's missing.
    cams = {}
    missing = []  # (start_ms, cam_id) across all cameras, exported newest-first
    for cam_id, slug in CAMERAS.items():
        cam_dir = os.path.join(BASE_DIR, slug)
        _ensure_dir(cam_dir)
        state = _read_json(os.path.join(cam_dir, "state.json")) or {}
        attempts = {int(k): v for k, v in (state.get("attempts") or {}).items()}

        # One directory pass: plain blocks (<start>.mp4), split blocks (their
        # <start>.map.json sidecar marks completeness — parts are written first),
        # and stale temp files from interrupted runs (>1h old).
        names = task.executor(os.listdir, cam_dir)
        plain = set()
        map_starts = set()
        overview = set()
        # SPRITE-PREVIEW-2026-08-04: units whose sheets are complete (the
        # sidecar is written last, so its presence is the marker). A change to
        # the tile geometry or quality invalidates all of them — detected by
        # comparing SPRITE_SIG against what state.json recorded.
        sprites = set()
        o_sprites = set()
        sprite_stale = SPRITES_ENABLED and state.get("sprite_sig") != SPRITE_SIG
        fast_sprites = set()
        fast_o_sprites = set()
        fast_sprite_stale = (
            FAST_SPRITES_ENABLED
            and state.get("fast_sprite_sig") != FAST_SPRITE_SIG)
        fast_sprite_started = int(
            state.get("fast_sprite_started") or last_o)
        if fast_sprite_stale:
            fast_sprite_started = last_o
        for nm in names:
            if (nm.endswith(FAST_SPRITE_SUFFIX)
                    or (".f" in nm and nm.endswith(".jpg"))):
                if fast_sprite_stale:
                    try:
                        os.remove(os.path.join(cam_dir, nm))
                    except OSError:
                        pass
                    continue
                if not nm.endswith(FAST_SPRITE_SUFFIX):
                    continue
                stem = nm[: -len(FAST_SPRITE_SUFFIX)]
                if stem.isdigit():
                    fast_sprites.add(int(stem))
                elif (stem.startswith(OVERVIEW_PREFIX)
                        and stem[len(OVERVIEW_PREFIX):].isdigit()):
                    fast_o_sprites.add(int(stem[len(OVERVIEW_PREFIX):]))
            elif nm.endswith(SPRITE_SUFFIX) or (".s" in nm and nm.endswith(".jpg")):
                if sprite_stale:
                    # Built at a different geometry/quality — drop it so this
                    # unit is re-rendered at the current setting.
                    try:
                        os.remove(os.path.join(cam_dir, nm))
                    except OSError:
                        pass
                    continue
                if not nm.endswith(SPRITE_SUFFIX):
                    continue
                stem = nm[: -len(SPRITE_SUFFIX)]
                if stem.isdigit():
                    sprites.add(int(stem))
                elif (stem.startswith(OVERVIEW_PREFIX)
                        and stem[len(OVERVIEW_PREFIX):].isdigit()):
                    o_sprites.add(int(stem[len(OVERVIEW_PREFIX):]))
            elif nm.endswith(".mp4") and nm[:-4].isdigit():
                plain.add(int(nm[:-4]))
            elif (nm.startswith(OVERVIEW_PREFIX) and nm.endswith(".mp4")
                    and nm[len(OVERVIEW_PREFIX):-4].isdigit()):
                overview.add(int(nm[len(OVERVIEW_PREFIX):-4]))
            elif nm.endswith(".map.json") and nm[: -len(".map.json")].isdigit():
                map_starts.add(int(nm[: -len(".map.json")]))
            elif nm.endswith(".tmp.mp4") or nm.endswith(".tmp"):
                fp = os.path.join(cam_dir, nm)
                try:
                    if os.path.getmtime(fp) < now.timestamp() - 3600:
                        os.remove(fp)
                except OSError:
                    pass
        on_disk = plain | map_starts

        # Rolling window: delete expired blocks — every file whose name leads
        # with an expired block start (.mp4, .p<k>.mp4 parts, .map.json).
        expired = {b for b in on_disk if b < first_start}
        if expired:
            for nm in names:
                lead = nm.split(".")[0]
                if lead.isdigit() and int(lead) in expired:
                    try:
                        os.remove(os.path.join(cam_dir, nm))
                    except OSError:
                        pass
        on_disk -= expired
        map_starts -= expired

        # Same rolling window for the overview tier (its names carry the prefix,
        # so the digit-led purge above never sees them).
        o_expired = {b for b in overview if b < first_start}
        for b in o_expired:
            try:
                os.remove(os.path.join(cam_dir, f"{OVERVIEW_PREFIX}{b}.mp4"))
            except OSError:
                pass
        # SPRITE-PREVIEW-2026-08-04: their sheets/sidecars go with them (the
        # digit-led sweep above only matches the FINE tier's names).
        _purge_sprites(cam_dir, names,
                       [f"{OVERVIEW_PREFIX}{b}" for b in o_expired])
        _purge_fast_sprites(cam_dir, names,
                    [f"{OVERVIEW_PREFIX}{b}" for b in o_expired])
        overview -= o_expired
        o_sprites -= o_expired
        fast_o_sprites -= o_expired
        fast_sprites -= expired
        sprites -= expired

        head = state.get("head")
        if head and head.get("start", 0) < first_start:
            head = None  # ancient head (job was off for days) — don't advertise it
        elif head and not head.get("map") and head.get("file") not in names:
            # Its generation was reaped (or it predates the immutable naming, so
            # `file` is absent) — advertising it would just 404 the card. A split
            # head has no single .mp4 (parts + sidecar instead), hence the `map`
            # guard; _reap_heads sheds those by stem.
            head = None
        events, pre_ms, post_ms = _read_events_meta(slug)
        cams[cam_id] = {
            "slug": slug,
            "dir": cam_dir,
            "blocks": on_disk,
            "maps": map_starts,
            "overview": overview,
            "sprites": sprites,          # SPRITE-PREVIEW-2026-08-04
            "o_sprites": o_sprites,
            "fast_o_sprites": fast_o_sprites,
            "fast_sprites": fast_sprites,
            "fast_sprite_started": fast_sprite_started,
            "fast_s_attempts": {
                int(k): v for k, v in (
                    {} if fast_sprite_stale
                    else (state.get("fast_s_attempts") or {})).items()},
            "fast_o_attempts": {
                int(k): v for k, v in (
                    {} if fast_sprite_stale
                    else (state.get("fast_o_attempts") or {})).items()},
            "s_attempts": {int(k): v for k, v in (state.get("s_attempts") or {}).items()},
            "o_attempts": {int(k): v for k, v in (state.get("o_attempts") or {}).items()},
            "attempts": attempts,
            "head": head,
            "events": events,
            "pre": pre_ms,
            "post": post_ms,
            "purged": len(expired),
            "added": 0,
        }
        start = last_start
        while start >= first_start:
            if start not in on_disk and attempts.get(start, 0) < EXPORT_MAX_ATTEMPTS:
                missing.append((start, cam_id))
            start -= block_ms

    # HEAD BLOCK first (the region people scrub the most): a rolling partial
    # export of the CURRENT incomplete block, [block start, now - HEAD_LAG_S],
    # written each run under a NEW name carrying that range (see HEAD_PREFIX).
    # Once the block completes, the normal pipeline exports its immutable
    # <start>.mp4 and coverage hands over (the card checks completed blocks
    # before the head). Not budget-capped: it's one small (<= 10 min) export per
    # camera per run.
    head_start = last_start + block_ms
    head_end = now_ms - HEAD_LAG_S * 1000
    for cam_id, c in cams.items():
        if head_end - head_start >= HEAD_MIN_S * 1000:
            name = f"{HEAD_PREFIX}{head_start}-{head_end}"
            ok, _used = _export_block_split(api, cam_id, c, head_start, head_end, name)
            if ok:
                mapped = os.path.exists(os.path.join(c["dir"], f"{name}.map.json"))
                fast_sprite = (
                    FAST_SPRITES_ENABLED
                    and not mapped
                    and _fast_sprite_sheets(c["dir"], name))
                c["head"] = {
                    "start": head_start,
                    "end": head_end,
                    "map": mapped,
                    # The card fetches THIS file and maps it onto [start, end].
                    # The two can never disagree: the name states both.
                    "file": f"{name}.mp4",
                    "fast_sprite": fast_sprite,
                }
            # On failure the previous head keeps serving — its file is still on
            # disk (KEEP_HEADS) and still covers exactly its advertised range.
        # Unconditional: a job that stops exporting heads (short window right
        # after a boundary, or repeated export failures) must still shed old
        # generations instead of accumulating them forever.
        live = c["head"]["file"] if c["head"] and c["head"].get("file") else None
        _reap_heads(c["dir"], KEEP_HEADS, _head_stem(live) if live else None)
        # On-demand tips are only worth keeping until the head covers the same
        # range; the tip service reaps its own, this catches the ones left
        # behind when scrubbing stops (age-based, so an idle camera goes clean).
        _reap_tips(c["dir"], KEEP_TIPS, now_ms)

    # Newest blocks first across ALL cameras — every camera gets recent coverage
    # early in a backfill; the per-run budget just continues next minute.
    # The budget counts NVR EXPORT REQUESTS (a split block uses several), but a
    # started block always finishes so it's never left half-exported.
    missing.sort(key=lambda m: m[0], reverse=True)
    exported = 0
    failed = 0
    budget = MAX_EXPORTS_PER_RUN
    for start_ms, cam_id in missing:
        if budget <= 0:
            break
        c = cams[cam_id]
        ok, used = _export_block_split(
            api, cam_id, c, start_ms, start_ms + block_ms, str(start_ms))
        budget -= max(1, used)
        if ok:
            c["blocks"].add(start_ms)
            if os.path.exists(os.path.join(c["dir"], f"{start_ms}.map.json")):
                c["maps"].add(start_ms)
            else:
                c["maps"].discard(start_ms)
            c["attempts"].pop(start_ms, None)
            c["added"] += 1
            exported += 1
        else:
            # No footage for this range (camera offline) or a transient NVR
            # error — retry up to the cap on later runs, then give up for good.
            c["attempts"][start_ms] = c["attempts"].get(start_ms, 0) + 1
            failed += 1

    # OVERVIEW TIER, on its own small budget so a fine-block backfill can't
    # starve it. Only hours that are fully complete (same safety lag) are
    # exported; the current partial hour is covered by the fine blocks + head.
    first_o = ((cutoff_ms + over_ms - 1) // over_ms) * over_ms
    missing_over = []
    for cam_id, c in cams.items():
        o_start = last_o
        while o_start >= first_o:
            if (o_start not in c["overview"]
                    and c["o_attempts"].get(o_start, 0) < EXPORT_MAX_ATTEMPTS):
                missing_over.append((o_start, cam_id))
            o_start -= over_ms
    missing_over.sort(key=lambda m: m[0], reverse=True)  # newest hours first
    o_budget = MAX_OVERVIEW_PER_RUN
    for o_start, cam_id in missing_over:
        if o_budget <= 0:
            break
        o_budget -= 1
        c = cams[cam_id]
        if _export_overview(api, cam_id, c, o_start):
            c["overview"].add(o_start)
            c["o_attempts"].pop(o_start, None)
        else:
            c["o_attempts"][o_start] = c["o_attempts"].get(o_start, 0) + 1

    # FAST-SCRUB ATLAS. Additive: start at the latest complete hour recorded on
    # the first run, never backfill the seven-day cache. Overview hours cover
    # long swipes; 10-minute blocks cover the newest incomplete overview hour.
    if FAST_SPRITES_ENABLED:
        fast_pending = []
        for cam_id, c in cams.items():
            missing_over = c["overview"] - c["fast_o_sprites"]
            for b in sorted(missing_over, reverse=True):
                if b >= c["fast_sprite_started"]:
                    fast_pending.append((1, b, cam_id, f"{OVERVIEW_PREFIX}{b}",
                                         "fast_o_sprites", "fast_o_attempts"))
            missing_blocks = c["blocks"] - c["fast_sprites"] - c["maps"]
            for b in sorted(missing_blocks, reverse=True):
                if b >= c["fast_sprite_started"]:
                    fast_pending.append((0, b, cam_id, str(b),
                                         "fast_sprites", "fast_s_attempts"))
        fast_pending.sort(key=lambda p: (p[0], p[1]), reverse=True)
        fast_budget = MAX_FAST_SPRITE_PER_RUN
        fast_made = 0
        for _tier, b, cam_id, stem, set_key, attempts_key in fast_pending:
            if fast_budget <= 0:
                break
            c = cams[cam_id]
            if c[attempts_key].get(b, 0) >= EXPORT_MAX_ATTEMPTS:
                continue
            fast_budget -= 1
            if _fast_sprite_sheets(c["dir"], stem):
                c[set_key].add(b)
                c[attempts_key].pop(b, None)
                fast_made += 1
            else:
                c[attempts_key][b] = c[attempts_key].get(b, 0) + 1
        if fast_made:
            log.info("protect_scrub: fast atlases +%s (pending %s)",
                     fast_made, max(0, len(fast_pending) - MAX_FAST_SPRITE_PER_RUN))

    # FINE SPRITE TIER (SPRITE-PREVIEW-2026-08-04). Runs LAST and reads only files
    # already on disk — no NVR call, no network — so it can never delay or
    # compete with the exports above; if the budget runs out the units simply
    # get their sheets on a later run and the card keeps using the video tier
    # for them meanwhile. New overview units use the compact fast atlas above;
    # these high-quality sheets are only for slow 10-minute fine blocks. Split
    # blocks are skipped — their playable units are the part
    # files, not <start>.mp4 (SPLIT_AT_EVENTS is off, so this is dormant).
    if SPRITES_ENABLED:
        s_budget = MAX_SPRITE_PER_RUN
        pending = []
        for cam_id, c in cams.items():
            for b in sorted(c["blocks"] - c["sprites"] - c["maps"], reverse=True):
                pending.append((0, b, cam_id, str(b), "sprites"))
        # newest fine blocks first
        pending.sort(key=lambda p: (p[0], p[1]), reverse=True)
        made = 0
        for tier, b, cam_id, stem, key in pending:
            if s_budget <= 0:
                break
            c = cams[cam_id]
            if c["s_attempts"].get(b, 0) >= EXPORT_MAX_ATTEMPTS:
                continue
            s_budget -= 1
            if _sprite_sheets(c["dir"], stem):
                c[key].add(b)
                c["s_attempts"].pop(b, None)
                made += 1
            else:
                c["s_attempts"][b] = c["s_attempts"].get(b, 0) + 1
        if made:
            log.info("protect_scrub: sprites +%s (pending %s)",
                     made, max(0, len(pending) - MAX_SPRITE_PER_RUN))

    # Publish per-camera index + state. The index is rewritten every run (cheap,
    # single small file) so `generated` doubles as the job's heartbeat.
    for cam_id, c in cams.items():
        _write_index(c["dir"], c["blocks"], c["maps"] & c["blocks"], c["head"], now_ms,
                     c["overview"], c["sprites"] & c["blocks"],
                     c["o_sprites"] & c["overview"],
                     c["fast_sprites"] & c["blocks"],
                     c["fast_o_sprites"] & c["overview"],
                     c["fast_sprite_started"])
        _write_json(os.path.join(c["dir"], "state.json"), {
            "attempts": {str(k): v for k, v in c["attempts"].items() if k >= first_start},
            "o_attempts": {str(k): v for k, v in c["o_attempts"].items() if k >= first_start},
            "s_attempts": {str(k): v for k, v in c["s_attempts"].items() if k >= first_start},
            "fast_s_attempts": {
                str(k): v for k, v in c["fast_s_attempts"].items()
                if k >= c["fast_sprite_started"]},
            "fast_o_attempts": {
                str(k): v for k, v in c["fast_o_attempts"].items()
                if k >= c["fast_sprite_started"]},
            # SPRITE-PREVIEW-2026-08-04: recorded so the next run can tell that
            # the tile geometry/quality changed and rebuild the sheets.
            "sprite_sig": SPRITE_SIG if SPRITES_ENABLED else None,
            "fast_sprite_sig": FAST_SPRITE_SIG if FAST_SPRITES_ENABLED else None,
            "fast_sprite_started": c["fast_sprite_started"],
            "head": c["head"],
        })
        if c["added"] or c["purged"]:
            log.info(
                "protect_scrub: %s -> %s blocks (+%s, purged %s)",
                c["slug"], len(c["blocks"]), c["added"], c["purged"],
            )
    if exported or failed:
        log.info("protect_scrub: done exported=%s failed=%s pending=%s",
                 exported, failed, max(0, len(missing) - MAX_EXPORTS_PER_RUN))


@service
def protect_scrub_probe(block_ms=0, fps=4, cam_id="", end_ms=0, channel=0):
    """Diagnostic: export one range and log its frame layout (count, output
    duration, size). fps=0 => PLAIN (non-timelapse) export; channel selects
    the NVR channel index (adaptive low-quality tier probing).
    Call: pyscript.protect_scrub_probe with block_ms/fps/cam_id/end_ms/channel."""
    api = _get_api()
    if api is None:
        log.error("probe: no api")
        return
    cam_ids = list(CAMERAS)
    if not cam_id and not cam_ids:
        log.error("probe: no cameras configured and no cam_id given")
        return
    cam = cam_id or cam_ids[0]
    block_ms = int(block_ms)
    end_ms = int(end_ms) or block_ms + BLOCK_S * 1000
    start_dt = datetime.fromtimestamp(block_ms / 1000, tz=timezone.utc)
    end_dt = datetime.fromtimestamp(end_ms / 1000, tz=timezone.utc)
    fps_val = int(fps) if int(fps) > 0 else None
    data = api.get_camera_video(
        cam, start_dt, end_dt, channel_index=int(channel), fps=fps_val)
    if not data:
        log.warning("PROBE fps=%s ch=%s block=%s -> EMPTY", fps, channel, block_ms)
        return
    # Scratch file in the .cache ROOT, not in /config and not in a served cache
    # directory: .cache/* is the one path HA Core's backup skips, so a file left
    # behind by a crashed probe can never be swept into a backup, and the cache
    # root itself is not registered as a static path (the per-cache dirs are).
    _ensure_dir(os.path.dirname(BASE_DIR))
    tmp = os.path.join(os.path.dirname(BASE_DIR), "protect_scrub_probe.tmp.mp4")
    _write_bytes(tmp, data)
    try:
        res = task.executor(
            subprocess.run,
            ["ffprobe", "-v", "error", "-select_streams", "v:0", "-count_frames",
             "-show_entries", "stream=width,nb_read_frames,duration",
             "-of", "csv=p=0", tmp],
            capture_output=True, timeout=60,
        )
        log.warning("PROBE fps=%s ch=%s range=%s..%s span=%ss size=%s -> %s",
                    fps, channel, block_ms, end_ms, (end_ms - block_ms) // 1000,
                    len(data), res.stdout.decode().strip())
    finally:
        os.remove(tmp)

