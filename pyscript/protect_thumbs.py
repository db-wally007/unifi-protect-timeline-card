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
  UNIFI_PROTECT_SCHEDULE / unifi_protect_schedule  optional, false = no built-in
                                                   timers (both jobs), see below

Monitoring
----------
By default this job runs itself once a minute, and that leaves no run history:
a sync that fails reaches only the log. To have failures seen, set
`unifi_protect_schedule: false` (it applies to protect_scrub.py too) and run
both syncs from Home Assistant SCRIPTS on an automation's schedule. Each sync
RETURNS {"ok": true, ...} or {"ok": false, "error": "..."}, because pyscript
catches any exception raised in a service and only logs it, so the script has
to check `ok` and stop with an error, which records a failed run:

    script:
      protect_thumbs_sync:
        mode: single
        max_exceeded: silent
        sequence:
          - action: pyscript.protect_thumbs_sync
            response_variable: sync
          - if: "{{ not (sync is mapping and sync.ok | default(false)) }}"
            then:
              - stop: Protect event cache sync failed
                error: true

    automation:
      - triggers:
          - trigger: time_pattern
            minutes: "*"
        conditions:
          # Hold off for 3 minutes after Home Assistant starts. Until pyscript
          # has loaded this file the action does not exist, and a script that
          # calls a missing action dies with ServiceNotFound -- which
          # continue_on_error deliberately does not cover. The automation's own
          # state is created at startup, so its last_changed (a string in
          # `this`) marks the start.
          - condition: template
            value_template: "{{ now() - as_datetime(this.last_changed) > timedelta(minutes=3) }}"
        actions:
          - action: script.turn_on
            target: {entity_id: script.protect_thumbs_sync}

The motion follower below keeps working either way; it is not scheduled. Within
STARTUP_GRACE_S of this file loading, a sync that finds the UniFi Protect
integration not up yet is skipped (ok), not failed.

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

# uiprotect is imported when a sync first runs (_event_types), NOT here at load: on a Home
# Assistant start pyscript loads this file while the UniFi Protect integration is importing
# uiprotect in a worker thread, and the import can see a half-initialised uiprotect.data
# ("partially initialized module 'uiprotect.data' has no attribute 'EventType'"). The file
# then fails to load, pyscript never retries it, and pyscript.protect_thumbs_sync stays
# missing until a reload - the every-minute script dying with ServiceNotFound (2026-10-08).

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


def _schedule_conf():
    """UNIFI_PROTECT_SCHEDULE / unifi_protect_schedule, read like _conf except
    that a YAML `false` counts (_conf treats every falsy value as unset)."""
    val = os.environ.get("UNIFI_PROTECT_SCHEDULE")
    if val is None or not val.strip():
        cfg = pyscript.config
        val = cfg.get("unifi_protect_schedule") if isinstance(cfg, dict) else None
    if val is None:
        return True
    return str(val).strip().lower() not in ("false", "0", "no", "off")


# Both jobs' built-in once-a-minute timers. `false` switches them off, to run
# the syncs from Home Assistant scripts instead, where a failed run is recorded
# (see "Monitoring" in each file's docstring).
SCHEDULED = _schedule_conf()
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
# A function, not a constant: uiprotect is imported at the first sync (see the imports).
def _event_types():
    from uiprotect.data import EventType
    return [EventType.MOTION, EventType.SMART_DETECT, EventType.SMART_DETECT_LINE]


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

# Set while a sync is in flight. The schedule, the motion follower and the card
# all ask for syncs, and they must never overlap.
_RUNNING = False
# This file is loaded while Home Assistant is still starting (or on a pyscript
# reload), and for a minute or two after a restart the UniFi Protect
# integration may not be up yet. A missing client in that window means "not
# yet", not "broken": the sync is SKIPPED, not failed — otherwise every restart
# recorded a failed run (and motion during startup logged an error).
STARTUP_GRACE_S = 180
_LOADED_AT = datetime.now(timezone.utc).timestamp()


@time_trigger("cron(* * * * *)")
def protect_thumbs_tick():
    """The built-in schedule: one sync a minute, unless SCHEDULED is off."""
    # Unconfigured is not an error every 60 s: the module load already said so.
    if SCHEDULED and CAMERAS:
        _run()


@service(supports_response="optional")
def protect_thumbs_sync():
    """Incrementally mirror NVR events + thumbnails, write manifest v2.

    Returns {"ok": true, ...counts} or {"ok": false, "error": "..."} - see
    "Monitoring" in the module docstring.
    Call manually via: service: pyscript.protect_thumbs_sync
    """
    return _run()


def _failed(reason):
    log.error(f"protect_thumbs: {reason}")
    return {"ok": False, "error": reason}


def _run():
    """One sync, never two at once, with anything it raised turned into a failed
    result: pyscript catches an exception raised in a service and only logs it,
    so a caller would never see one."""
    global _RUNNING
    if _RUNNING:
        # Routine, not a failure: the sync in flight covers this request too.
        # (A guard, not task.unique(kill_me=True): that CANCELS the new call,
        # which a calling script would record as a broken run.)
        log.debug("protect_thumbs: a sync is already running, skipping")
        return {"ok": True, "skipped": "a sync is already running"}
    _RUNNING = True
    try:
        return _sync()
    except Exception as err:  # noqa: BLE001 - a raise here would only reach the log
        return _failed(f"sync failed: {type(err).__name__}: {err}")
    finally:
        _RUNNING = False


def _sync():
    """One incremental sync. The NVR unreachable or nothing configured fails the
    run; a thumbnail the NVR does not have yet does not - those are retried up to
    THUMB_MAX_ATTEMPTS by design, and the card falls back to a snapshot."""
    if not CAMERAS:
        return _failed("no cameras configured (unifi_protect_cameras)")
    api = _get_api()
    if api is None:
        if datetime.now(timezone.utc).timestamp() - _LOADED_AT < STARTUP_GRACE_S:
            log.debug("protect_thumbs: UniFi Protect not loaded yet, skipping")
            return {"ok": True, "skipped": "UniFi Protect is still loading"}
        return _failed("uiprotect client unavailable - is the UniFi Protect "
                       "integration loaded?")

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

    start_dt = datetime.fromtimestamp(query_start_ms / 1000, tz=timezone.utc)
    events = api.get_events(start=start_dt, end=now, types=_event_types())
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
    return {"ok": True, "new": total_new, "thumbs": total_fetched, "purged": total_removed}


# ---- motion-driven immediacy ------------------------------------------------
# The once-a-minute sync above (the built-in cron, or a Home Assistant
# automation when SCHEDULED is off) is the RECONCILER, not the delivery path: it re-queries the NVR
# window and rebuilds the manifest unconditionally, which is what makes this job
# self-healing (a missed motion edge, an event the NVR revised after the fact, a
# burst that arrived while HA was restarting, the rolling manifest trim and the
# hourly thumbnail purge all get picked up without any special case). Measured
# at 0.28 s of event-loop CPU per run — 0.47% of a core at one run a minute — so
# it is kept at a minute BECAUSE it is cheap, not in spite of it.
#
# What the cron cannot do is be fast: an event surfaces up to 60 s late. So a
# motion edge starts a FOLLOWER that syncs immediately and then keeps syncing on
# a backoff while the burst is live, which puts a new event in the manifest a
# couple of seconds after it happens. The follower is pure latency optimisation:
# if it never ran at all, nothing would be lost — the next cron tick still
# catches everything. That is deliberate, and it is why resolving the sensors by
# convention below is safe.

# Backoff between syncs while following a burst. The NVR does not always have
# the event (or its thumbnail) the instant motion is reported, hence the retry.
MOTION_BACKOFF_S = [0, 3, 6, 12, 20, 30]
# Stop following one burst after this long; the cron owns it from then on.
MOTION_FOLLOW_MAX_S = 300


def _motion_sensors():
    """The motion binary_sensor of each configured camera.

    `unifi_protect_motion_sensors` (comma separated) wins if set. Otherwise the
    UniFi Protect naming is assumed: the camera object_id minus its channel
    suffix, plus `_motion` — `camera.front_door_high_resolution_channel` ->
    `binary_sensor.front_door_motion`. Resolving at module load keeps the
    trigger static (no dependency on unifiprotect having finished setting up),
    and a wrong guess costs only immediacy, never correctness.
    """
    raw = _conf("motion_sensors")
    if raw:
        out = []
        for chunk in str(raw).replace("\n", ",").split(","):
            item = chunk.strip()
            if item:
                out.append(item if "." in item else "binary_sensor." + item)
        return out
    out = []
    for cam_id in CAMERAS:
        slug = CAMERAS[cam_id]
        for suffix in ("_high_resolution_channel", "_medium_resolution_channel",
                       "_low_resolution_channel", "_package_camera"):
            if slug.endswith(suffix):
                slug = slug[: -len(suffix)]
                break
        out.append("binary_sensor." + slug + "_motion")
    return out


MOTION_SENSORS = _motion_sensors()
# A never-true expression keeps the decorator valid when nothing is configured.
MOTION_TRIGGER = " or ".join(
    ["%s == 'on'" % e for e in MOTION_SENSORS]) or "pyscript.no_motion_sensors == 'on'"


def _is_on(entity):
    """`entity` is on. state.get() RAISES NameError for an entity that does not
    exist (a typo, or the integration not loaded yet); that reads as off here —
    the cron is the safety net either way."""
    try:
        return state.get(entity) == "on"
    except NameError:
        return False


def _burst_live():
    """True while any camera still has motion, or an event we have not seen
    closed yet — i.e. while another sync could still add something."""
    for entity in MOTION_SENSORS:
        if _is_on(entity):
            return True
    for cam_id in CAMERAS:
        manifest = _read_json(os.path.join(BASE_DIR, CAMERAS[cam_id], "manifest.json"))
        for entry in (manifest or {}).get("events") or []:
            if entry.get("ongoing"):
                return True
    return False


@state_trigger(MOTION_TRIGGER)
def protect_thumbs_on_motion(**kwargs):
    """Motion started: sync now, then follow the burst on a backoff."""
    # One follower at a time. A second camera lighting up mid-burst does not
    # need its own: a sync covers every camera in a single NVR query, and
    # _burst_live() watches all of them.
    task.unique("protect_thumbs_follow", kill_me=True)
    started = datetime.now(timezone.utc).timestamp()
    step = 0
    while True:
        # If a scheduled run is already in flight this no-ops (the _RUNNING
        # guard), and that run produces the same data anyway.
        _run()
        if not _burst_live():
            return
        if datetime.now(timezone.utc).timestamp() - started >= MOTION_FOLLOW_MAX_S:
            log.debug("protect_thumbs: burst still live after %ss — cron takes over",
                      MOTION_FOLLOW_MAX_S)
            return
        delay = MOTION_BACKOFF_S[min(step, len(MOTION_BACKOFF_S) - 1)]
        step += 1
        if delay:
            task.sleep(delay)


@time_trigger("startup")
@service
def protect_thumbs_check_motion_sensors():
    """Whether the motion triggers actually resolved — a silent typo would
    otherwise just look like "events are a bit slow". Runs at startup and on
    demand: service: pyscript.protect_thumbs_check_motion_sensors."""
    if not MOTION_SENSORS:
        log.warning("protect_thumbs: no motion sensors resolved — events will "
                    "appear on the one-minute cron only")
        return
    missing = []
    for entity in MOTION_SENSORS:
        try:
            state.get(entity)
        except NameError:
            missing.append(entity)
    if missing:
        log.warning("protect_thumbs: motion sensors not found: %s — set "
                    "unifi_protect_motion_sensors to fix; events still arrive "
                    "on the one-minute cron", ", ".join(missing))
    else:
        log.info("protect_thumbs: following motion on %s", ", ".join(MOTION_SENSORS))


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
    events = api.get_events(start=start_dt, end=now, types=_event_types())
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
