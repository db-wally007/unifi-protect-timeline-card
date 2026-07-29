"""UniFi Protect event cache — companion for unifi-protect-timeline-card.

Every minute (and on-demand) mirrors the NVR's raw detection events 1:1 into a
local manifest.json plus each event's *exact* NVR thumbnail — the same image the
UniFi Protect app shows — under /config/.cache/protect_thumbs/<slug>/, so every
dashboard/client loads cheap static /local/... files instead of hitting the NVR
per view. The card renders its event list/timeline straight from this manifest.

Setup
-----
1. Enable pyscript (via HACS or manually) and add to configuration.yaml:
       pyscript:
         allow_all_imports: true
         hass_is_global: true
   This needs ONE Home Assistant restart; afterwards iterate with the
   `pyscript.reload` service (no restart).
2. Copy this file to /config/pyscript/protect_thumbs.py (or symlink it there
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
   Find each Protect camera id by calling the
   `pyscript.protect_thumbs_list_cameras` service (logs id / name / mac); the
   slug MUST equal the HA camera entity's object_id (the part after "camera.").
4. `pyscript.reload`, then run `pyscript.protect_thumbs_sync` once to backfill.

Configuration (env wins; see the block below the imports)
  UNIFI_PROTECT_CAMERAS / unifi_protect_cameras    required
  UNIFI_PROTECT_ENTRY_ID / unifi_protect_entry_id  optional, "" = auto-discover

Design
------
- 1:1 events: one raw Protect event == one manifest entry, no grouping/merging,
  no synthetic durations. dur = end - start exactly as the NVR reports it.
  In-progress events (no end yet) are included with a provisional end=now and
  ongoing=true; each later run re-fetches and finalizes them.
- Incremental: the manifest IS the event DB. Each run queries the NVR only from
  a persisted cursor (state.json) minus a small overlap, and upserts by event id
  — so the per-minute run asks the NVR for ~5 minutes of events, not 7 days.
  Bootstrap (no state / no v2 manifest) fetches the full LOOKBACK_HOURS window.
- NVR-gentle: thumbnails are fetched strictly ONE AT A TIME with a small gap,
  newest first, and at most MAX_THUMBS_PER_RUN per run — the manifest is
  written BEFORE the thumbnail pass, so events always reach the card within a
  minute even mid-backfill. Failed thumbnails are retried at most
  THUMB_MAX_ATTEMPTS times (tracked in state.json), so a permanently missing
  thumb never hammers the NVR forever. Events without a thumbnail still go in
  the manifest (the card falls back to a one-off NVR snapshot for those rows).
- Retention: thumbnail files older than RETENTION_DAYS are purged on the
  top-of-hour run; manifest entries are trimmed to LOOKBACK_HOURS.

pyscript injects `hass` (hass_is_global), `log`, `task`, and the
`@service`/`@time_trigger` decorators, and auto-awaits coroutine calls.
NOTE: no generator expressions anywhere — pyscript's interpreter does not
implement them (use list comprehensions).
"""

import json
import os
from datetime import datetime, timezone

from uiprotect.data import EventType

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

# Under .cache/ (NOT www/): HA Core backups exclude .cache/* and nothing else,
# and this cache is large + fully rebuildable. Served at /protect_thumbs by the
# protect_cache custom_component.
BASE_DIR = "/config/.cache/protect_thumbs"  # served at /protect_thumbs
THUMB_WIDTH = 320
LOOKBACK_HOURS = 168       # depth of the manifest event list (and bootstrap window)
RETENTION_DAYS = 90        # thumbnail files on disk (>= LOOKBACK so trims are safe)
REQUEST_GAP_S = 0.2        # pause between NVR thumbnail fetches (serial / gentle)
OVERLAP_S = 300            # re-query this much before the cursor each run: covers
                           # NVR write latency, clock skew, and short ongoing events
THUMB_MAX_ATTEMPTS = 5     # per-event thumbnail retry cap (completed events only)
MAX_THUMBS_PER_RUN = 15    # cap thumbnail downloads per run so a big backfill
                           # spreads over many 1-minute runs instead of blocking
                           # the event sync for its whole duration
MANIFEST_VERSION = 2

# kind shown for an event with multiple smart-detect types: most important first.
KIND_PRIORITY = ["person", "vehicle", "animal", "package", "license_plate"]

# Only query the detection event types the timeline shows. Passing `types` is
# REQUIRED, not just an optimisation: without it uiprotect can't apply the
# start/end window server-side and iterates EVERY event client-side. Keeping the
# smart-detect types means AI events (if the NVR records them) appear 1:1 too.
EVENT_TYPES = [EventType.MOTION, EventType.SMART_DETECT, EventType.SMART_DETECT_LINE]


# ---- filesystem helpers -----------------------------------------------------
# pyscript-defined helpers are called directly (a pyscript function can't be
# handed to task.executor). builtins.open is sandboxed by pyscript (doesn't
# write), so ALL file I/O here is low-level os.open/os.read/os.write; os.listdir
# is loop-protected by HA and runs via task.executor (it accepts stdlib callables).

def _ensure_dir(path):
    os.makedirs(path, exist_ok=True)


def _exists(path):
    return os.path.exists(path)


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


def _purge_old(dir_path, cutoff_epoch):
    """Delete *.jpg older than cutoff; return how many were removed."""
    removed = 0
    for name in task.executor(os.listdir, dir_path):
        if not name.endswith(".jpg"):
            continue
        fp = os.path.join(dir_path, name)
        try:
            if os.path.getmtime(fp) < cutoff_epoch:
                os.remove(fp)
                removed += 1
        except OSError:
            pass
    return removed


# ---- helpers ----------------------------------------------------------------

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


def _smart_types(event):
    return [str(s).split(".")[-1].lower() for s in (getattr(event, "smart_detect_types", None) or [])]


def _event_kind(event):
    """kind = highest-priority smart-detect type on the event, else motion."""
    kinds = _smart_types(event)
    for p in KIND_PRIORITY:
        if p in kinds:
            return p
    return "motion"


def _padding_ms(api, cam_id):
    """(pre_ms, post_ms) recording padding for the camera; (0, 0) if unreadable.
    The card pads clip playback with these so it plays what the UniFi app plays."""
    cam = api.bootstrap.cameras.get(cam_id)
    rs = getattr(cam, "recording_settings", None) if cam else None
    if rs is not None:
        try:
            return (
                int(rs.pre_padding.total_seconds() * 1000),
                int(rs.post_padding.total_seconds() * 1000),
            )
        except Exception:  # noqa: BLE001
            pass
    return (0, 0)


def _write_manifest(cam_dir, entries, pre_ms, post_ms, now_ms):
    _write_json(os.path.join(cam_dir, "manifest.json"), {
        "version": MANIFEST_VERSION,
        "generated": now_ms,
        "pre_ms": pre_ms,
        "post_ms": post_ms,
        "events": entries,
    })


# ---- main job ---------------------------------------------------------------

@time_trigger("cron(* * * * *)")
@service
def protect_thumbs_sync():
    """Incrementally mirror NVR events + thumbnails, write manifest v2.

    Call manually via: service: pyscript.protect_thumbs_sync
    """
    # Per-minute cron + on-demand service calls must never overlap: if a sync is
    # already running, this new invocation exits (the running one finishes).
    task.unique("protect_thumbs_sync", kill_me=True)

    api = _get_api()
    if api is None:
        log.error("protect_thumbs: uiprotect client unavailable; aborting")
        return

    now = datetime.now(timezone.utc)
    now_ms = int(now.timestamp() * 1000)
    manifest_cutoff_ms = now_ms - LOOKBACK_HOURS * 3600 * 1000

    # Load each camera's state + previous manifest, and derive the single NVR
    # query window: from the earliest thing any camera still needs, to now.
    # A v1 (bare-array) manifest holds MERGED groups, not raw events — ignore it
    # and rebuild the DB with a full-lookback bootstrap fetch.
    cams = {}
    query_start_ms = None
    for cam_id, slug in CAMERAS.items():
        cam_dir = os.path.join(BASE_DIR, slug)
        _ensure_dir(cam_dir)
        state = _read_json(os.path.join(cam_dir, "state.json")) or {}
        prev = _read_json(os.path.join(cam_dir, "manifest.json"))
        prev_events = prev.get("events") if isinstance(prev, dict) else None
        bootstrap = not isinstance(prev_events, list) or "cursor_ms" not in state
        if bootstrap:
            cam_start_ms = manifest_cutoff_ms
            prev_events = []
        else:
            cam_start_ms = int(state["cursor_ms"])
            # An event that was still ongoing last run must be re-fetched in full
            # to pick up its final end time, however long ago it started.
            for e in prev_events:
                if e.get("ongoing") and e["start"] < cam_start_ms:
                    cam_start_ms = e["start"]
            cam_start_ms -= OVERLAP_S * 1000
        cams[cam_id] = {
            "slug": slug,
            "dir": cam_dir,
            "prev": prev_events,
            "attempts": dict(state.get("thumb_attempts") or {}),
            "bootstrap": bootstrap,
        }
        if query_start_ms is None or cam_start_ms < query_start_ms:
            query_start_ms = cam_start_ms

    if not cams:
        # Not an error every 60s: the module-level load already logged it once.
        log.debug("protect_thumbs: no cameras configured — nothing to do")
        return

    start_dt = datetime.fromtimestamp(query_start_ms / 1000, tz=timezone.utc)
    events = api.get_events(start=start_dt, end=now, types=EVENT_TYPES)
    log.debug(
        "protect_thumbs: %s events since %s (window %.1f min)",
        len(events), start_dt.isoformat(), (now_ms - query_start_ms) / 60000,
    )

    total_fetched = 0
    total_removed = 0
    total_new = 0
    for cam_id, c in cams.items():
        slug = c["slug"]
        cam_dir = c["dir"]
        by_id = {e["id"]: e for e in c["prev"]}
        prev_ongoing = {e["id"] for e in c["prev"] if e.get("ongoing")}

        # Upsert every fetched raw event 1:1 (re-fetched events replace their old
        # entry — that's how provisional ongoing entries get finalized).
        fetched_ids = set()
        new_count = 0
        for e in events:
            if getattr(e, "camera_id", None) != cam_id:
                continue
            ev_id = getattr(e, "id", None)
            start = getattr(e, "start", None)
            if not ev_id or start is None:
                continue
            start_ms = int(start.timestamp() * 1000)
            end = getattr(e, "end", None)
            fetched_ids.add(ev_id)
            if ev_id not in by_id:
                new_count += 1
            entry = {
                "id": ev_id,
                "kind": _event_kind(e),
                "start": start_ms,
            }
            if end is None:
                entry["end"] = now_ms  # provisional; finalized on a later run
                entry["ongoing"] = True
            else:
                entry["end"] = int(end.timestamp() * 1000)
                entry["dur"] = entry["end"] - start_ms
            by_id[ev_id] = entry

        # A previously-ongoing event the NVR no longer returns (dropped/expired):
        # finalize it with its stored provisional end so it can't grow forever.
        for ev_id in prev_ongoing - fetched_ids:
            e = by_id.get(ev_id)
            if e and e.get("ongoing"):
                e.pop("ongoing", None)
                e["dur"] = e["end"] - e["start"]

        entries = [e for e in by_id.values() if e["start"] >= manifest_cutoff_ms]
        entries.sort(key=lambda m: m["start"], reverse=True)

        # Publish the manifest IMMEDIATELY (with whatever thumbnails already
        # exist on disk) — fresh events must reach the card within a minute even
        # while a long thumbnail backfill is still working through its queue.
        pre_ms, post_ms = _padding_ms(api, cam_id)
        for m in entries:
            if _exists(os.path.join(cam_dir, f"{m['id']}.jpg")):
                m["file"] = f"/protect_thumbs/{slug}/{m['id']}.jpg"
            else:
                m.pop("file", None)
        _write_manifest(cam_dir, entries, pre_ms, post_ms, now_ms)

        # Thumbnails: exact per-event NVR thumbs, serial + gentle, NEWEST first,
        # capped at MAX_THUMBS_PER_RUN so a big backfill spreads across many
        # 1-minute runs instead of starving the event sync (the next cron run
        # simply continues where this one stopped). Retries for completed events
        # are capped (state thumb_attempts); ongoing events retry every run
        # uncapped (the NVR creates the thumb during the event); a just-completed
        # event gets ONE re-download (final thumbnail replaces the provisional).
        attempts = c["attempts"]
        budget = MAX_THUMBS_PER_RUN
        fetched_here = 0
        for m in entries:
            if budget <= 0:
                break
            ev_id = m["id"]
            finalized = ev_id in prev_ongoing and not m.get("ongoing")
            if finalized:
                attempts.pop(ev_id, None)  # fresh retry budget for the final thumb
            want = "file" not in m or finalized
            if want and not m.get("ongoing") and not finalized \
                    and attempts.get(ev_id, 0) >= THUMB_MAX_ATTEMPTS:
                want = False
            if not want:
                continue
            budget -= 1
            try:
                thumb = api.get_event_thumbnail(ev_id, width=THUMB_WIDTH)
            except Exception as err:  # noqa: BLE001
                log.warning("protect_thumbs: thumb fetch failed for %s: %r", ev_id, err)
                thumb = None
            if thumb:
                _write_bytes(os.path.join(cam_dir, f"{ev_id}.jpg"), thumb)
                m["file"] = f"/protect_thumbs/{slug}/{ev_id}.jpg"
                attempts.pop(ev_id, None)
                fetched_here += 1
            elif not m.get("ongoing"):
                attempts[ev_id] = attempts.get(ev_id, 0) + 1
            task.sleep(REQUEST_GAP_S)  # serial + gentle on the NVR
        if fetched_here:
            # Re-publish so the just-cached thumbnails reach the card now.
            _write_manifest(cam_dir, entries, pre_ms, post_ms, now_ms)
        total_fetched += fetched_here

        # Cursor for the next incremental query: everything still unsettled is an
        # ongoing event; otherwise the newest completed end we've seen.
        ongoing_starts = [e["start"] for e in entries if e.get("ongoing")]
        completed_ends = [e["end"] for e in entries if not e.get("ongoing")]
        if ongoing_starts:
            cursor_ms = min(ongoing_starts)
        elif completed_ends:
            cursor_ms = max(completed_ends)
        else:
            cursor_ms = now_ms
        live_ids = {e["id"] for e in entries}
        _write_json(os.path.join(cam_dir, "state.json"), {
            "cursor_ms": cursor_ms,
            "thumb_attempts": {k: v for k, v in attempts.items() if k in live_ids},
        })

        # Disk retention is a slow process — run it once an hour, not per-minute.
        if now.minute == 0 or c["bootstrap"]:
            total_removed += _purge_old(cam_dir, now.timestamp() - RETENTION_DAYS * 86400)

        total_new += new_count
        if new_count or c["bootstrap"]:
            log.info(
                "protect_thumbs: %s -> %s events (+%s new%s)",
                slug, len(entries), new_count, ", bootstrap" if c["bootstrap"] else "",
            )

    if total_fetched or total_removed or total_new:
        log.info(
            "protect_thumbs: done new=%s thumbs=%s purged=%s",
            total_new, total_fetched, total_removed,
        )


@service
def protect_thumbs_list_cameras():
    """Log every Protect camera's id / name / mac so you can fill in
    UNIFI_PROTECT_CAMERAS / unifi_protect_cameras.
    Call: service: pyscript.protect_thumbs_list_cameras."""
    api = _get_api()
    if api is None:
        log.error("protect_thumbs: uiprotect client unavailable")
        return
    for cam_id, cam in api.bootstrap.cameras.items():
        log.warning(
            "CAMERA id=%s name=%s mac=%s",
            cam_id,
            getattr(cam, "name", None),
            getattr(cam, "mac", None),
        )


@service
def protect_thumbs_dump(hours=3):
    """Diagnostic: log the raw NVR events (type/smart/start/end/dur/score) for the
    last N hours — the ground truth the manifest must match 1:1.
    Call: pyscript.protect_thumbs_dump."""
    api = _get_api()
    if api is None:
        log.error("dump: no api")
        return
    now = datetime.now(timezone.utc)
    start_dt = datetime.fromtimestamp(now.timestamp() - int(hours) * 3600, tz=timezone.utc)
    events = api.get_events(start=start_dt, end=now, types=EVENT_TYPES)
    log.warning("DUMP: %s raw events in last %sh (times UTC)", len(events), hours)
    for e in events:
        st = getattr(e, "start", None)
        en = getattr(e, "end", None)
        dur = round((en.timestamp() - st.timestamp()), 1) if (st and en) else None
        log.warning(
            "DUMP evt type=%s smart=%s start=%s end=%s dur=%ss score=%s id=%s",
            str(getattr(e, "type", None)).split(".")[-1],
            getattr(e, "smart_detect_types", None),
            st.strftime("%H:%M:%S") if st else None,
            en.strftime("%H:%M:%S") if en else None,
            dur,
            getattr(e, "score", None),
            getattr(e, "id", None),
        )
    log.warning("DUMP: end")
