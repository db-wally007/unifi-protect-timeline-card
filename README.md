# UniFi Protect Timeline Card

A Home Assistant Lovelace card that brings the **UniFi Protect** camera experience into a dashboard:
a vertical timeline you drag past a fixed playhead to scrub through recorded footage, live streaming,
and a detections list with thumbnails. It works through the `unifiprotect` integration's own NVR
connection — nothing to configure on the NVR side.

Like the UniFi Protect app, it plays LIVE and recorded footage in **one player** fed straight from
the NVR's own streams: a seek is a seek, nothing is exported or downloaded, and nothing switches
between players. The server-side helpers in this repo relay those streams, mirror the NVR's event
list and thumbnails locally, and keep photos of the footage so dragging the timeline shows real
frames.

Current release: **[v3.0.0](https://github.com/db-wally007/unifi-protect-timeline-card/releases/tag/v3.0.0)**.
See [CHANGELOG.md](CHANGELOG.md) for release details (and the upgrade steps from 2.x).

📸 **[Screenshots](screenshots/)** — tablet and phone, single- and multi-camera, timeline, events,
scrubbing and fullscreen.

## Install

**HACS (custom repository)**

1. HACS → ⋮ → **Custom repositories** → add `db-wally007/unifi-protect-timeline-card`, type
   **Dashboard**.
2. **Install**, then hard-refresh the browser.

**Manual** — `dist/` is committed, so no build step is needed:

```bash
cp dist/unifi-protect-timeline-card.js /config/www/
```

Then add it under **Settings → Dashboards → Resources** as a *JavaScript module*
(`/local/unifi-protect-timeline-card.js`) and hard-refresh.

## Configuration

Minimal:

```yaml
type: custom:unifi-protect-timeline-card
camera: camera.front_yard_high_resolution_channel
```

Everything else is optional. Defaults below are the ones baked into the code, so omitting an option
is identical to setting it to its default.

### Core

| Option | Type | Default | Description |
|---|---|---|---|
| `type` | string | — | `custom:unifi-protect-timeline-card` (required) |
| `camera` | string | — | Camera entity the timeline, events and clips come from. **Required** in single mode; in multi mode it defaults to the first `cameras` entry |
| `cameras` | list | `[]` | Single mode: a gallery strip you drag down to switch cameras. Multi mode: the grid's cameras (**required**, non-empty). See [camera entries](#camera-entries) |
| `card_version` | `single` \| `multi` | `single` | `multi` renders the [multi-camera page](#multi-camera-page) instead |
| `nvr_id` | string | auto | UniFi Protect config-entry id; derived from the camera entity |
| `height` | string | `80vh` / `100dvh` | Card height. Default depends on the resolved layout (columns / stacked) |
| `calendar_days` | number | `30` | How far back the date pill's calendar lets you jump |
| `page_background` | string | `""` | Pins the page background while the card is mounted; kills the flash during view transitions |

### Camera entries

Each item of `cameras:` is either a plain entity id or a mapping:

| Option | Type | Default | Description |
|---|---|---|---|
| `camera` | string | — | Camera entity (required) |
| `name` | string | friendly name | Label shown in the header / on the tile |
| `live_camera` | string | = `camera` | Multi-camera page: the entity its live grid tile streams — point it at a lower-resolution channel so several tiles don't decode the high-resolution stream at once |
| `navigation_path` | string | — | Tapping navigates here. Omit it and the card drills in place instead (what you want inside a popup) |

### Layout

| Option | Type | Default | Description |
|---|---|---|---|
| `layout` | `auto` \| `columns` \| `stacked` | `auto` | `auto` picks by measured card width |
| `layout_breakpoint` | number | `600` | Card width in px at which `auto` switches to `columns` |
| `video_ratio` | number | `0.45` | Stacked layout: the video's share of the height. Values 15–85 are read as a percentage. Clamped to 15–85% |
| `video_aspect` | string | `""` | Stacked layout: size the video by aspect ratio (e.g. `16/9`) instead of `video_ratio` |

### Header and back button

| Option | Type | Default | Description |
|---|---|---|---|
| `title` | string | `UniFi Protect Timeline` / `Cameras` | Header text (the second default applies in multi mode). Ignored in single mode when `cameras:` is set — the title then follows the active camera |
| `title_font_size` | number | theme headline5 (24) | px |
| `title_font_color` | string | `--primary-text-color` | Any CSS color |
| `title_font_weight` | number | `500` | |
| `camera_name_font_weight` | number | `600` | Weight used when the header shows a camera name rather than `title` |
| `back_button` | boolean | `false` | Chevron before the title. Always shown when a multi-camera page drills into one camera |
| `back_button_size` | number | `38` | px |
| `back_button_path` | string | `""` | Explicit destination; wins over browser history |
| `back_fallback_path` | string | dashboard root | Used when there is no history to pop — e.g. a cold start straight onto the view |

### Timeline appearance

Single mode unless noted.

| Option | Type | Default | Description |
|---|---|---|---|
| `accent_color` | string | `#fc9df3` | Playhead, LIVE pill, zoom slider, day dividers. Applies to both modes |
| `timeline_font_size` | number | `12` | Tick time labels |
| `timeline_font_color` | string | `#d0d0d0` | Tick labels |
| `tick_color` | string | `#4f4f4f` | Minute dividers |
| `tick_size` | number \| `small` \| `medium` \| `large` | `8` | Tick length; the keywords are 4 / 8 / 14 |
| `recorded_color` | string | `#6e476a` | The recorded track below the playhead |
| `future_color` | string | `#7a7a84` | The empty future above it |
| `show_footage_gaps` | boolean | `true` | Grey bands where the NVR has no footage. Also gates the gap probing itself |
| `gap_color` | string | `#4a4a52` | Those bands |
| `thumb_size` | number | `87` | Inline thumbnail width |
| `thumb_size_active` | number | `105` | Width under the playhead / on hover |
| `date_font_size` | number | `13` | Date pill and events day dividers. Both modes |
| `date_font_color` | string | `#ffffff` | Both modes |
| `arrow_color` | string | `rgba(0,0,0,0.6)` | Background of the jump-to-live arrow |
| `live_arrow_bottom` | number | `14` | That arrow's distance from the bottom, px |
| `toggle_bg` | string | theme card background | The Timeline \| Events switch track |
| `toggle_active_bg` | string | `rgba(0,0,0,0.6)` | Active segment fill |
| `toggle_active_color` | string | `#fff` | Active segment text |
| `toggle_text_color` | string | `--secondary-text-color` | Inactive segment text |

### Timeline behaviour

| Option | Type | Default | Description |
|---|---|---|---|
| `default_timeline_zoom` | number 0–100 | `100` | Initial zoom. `0` = widest (60 min visible), `100` = narrowest (4 min) |
| `default_span_minutes` | number | — | Initial visible span in minutes instead of the 0–100 scale, clamped to 4–60. Only consulted when `default_timeline_zoom` is absent |
| `scrub_settle_ms` | number | `700` | Delay between releasing a drag and playback starting. Taps play immediately; `0` disables the delay |
| `event_merge_gap_seconds` | number | `60` | Consecutive NVR events closer than this are shown as one event, the way the Protect app does it. `0` = raw 1:1. Both modes |

### Events list

| Option | Type | Default | Description |
|---|---|---|---|
| `list_text_size` | number | `12` | Row 1 (camera / kind). The second line is always 1px smaller |
| `list_text_color` | string | `#d0d0d0` | Row 1 |
| `list_duration_color` | string | row-1 color at 70% | Row 2 (time and duration) |
| `list_active_text_size` | number | `12` | Playing row, row 1 |
| `list_active_text_color` | string | `#000` | |
| `list_active_duration_size` | number | `12` | Playing row, row 2 |
| `list_active_duration_color` | string | `#000` | |
| `list_active_bg` | string | `#fff` | Playing-row background |
| `list_divider_color` | string | = `accent_color` | Day-divider line (single mode) |
| `tablet_events_thumbnail_size` | number | `145` | Event thumbnail width in the wide layout. Also sets the events column width and the gallery tile width, in **both** modes |

### Thumbnails and cache

| Option | Type | Default | Description |
|---|---|---|---|
| `thumbnail_concurrency` | number | `2` | Maximum parallel thumbnail fetches from the NVR. Both modes |
| `thumbnail_cache_dir` | string | `/protect_thumbs/<camera object_id>` | Where the [event cache](#event-cache--pyscript-job) writes. Single mode only |

### Scrub preview

| Option | Type | Default | Description |
|---|---|---|---|
| `scrub_preview` | boolean | `true` | Show photos of the footage while scrubbing instead of a plain stage. Needs the [scrub preview job](#scrub-preview--protect_cachescrub_sync) |
| `scrub_preview_dir` | string | `/protect_scrub/<camera object_id>` | Where those photos live |
| `scrub_fast_preview` | `always` \| `speed` \| `off` | `speed` | Which photos a drag shows. `speed`: the hour photos (one per 30 s, far fewer bytes) while the drag outruns the 10-minute ones, which take over when it slows. `always`: the hour photos during any movement. `off`: always the 10-minute ones |

The photos are 640×360 JPEGs packed 16 to a sheet: one every 5 s per 10-minute block, and one every
30 s per hour for fast drags. The card draws them on a canvas — no video decoder involved, so even a
low-end tablet keeps up with the finger — and releasing the drag starts playback at that moment.
After LIVE is stable, the card preloads only the newest photo sheet.

### Playback

| Option | Type | Default | Description |
|---|---|---|---|
| `live_audio_start` | `auto` \| `muted` | `muted` | `muted` starts the card session silently. One explicit Unmute applies to LIVE, recorded footage, events and camera switches until the view closes. `auto` additionally makes one best-effort audible start of LIVE |

#### How playback works

The card plays everything — LIVE, a rewind, an event, any moment you scrub to — in one `<video>`
element fed through MediaSource (ManagedMediaSource on iOS / iPadOS 17.1+) from the NVR's own
playback and live streams, the websockets the UniFi Protect web app uses. `protect_cache` relays
them (`/api/protect_stream/ws`, authenticated) with the integration's NVR session, so the browser
never talks to the NVR. Recorded and live footage share one wall-clock timeline, so every seek is a
seek inside one buffer:

- ±15 s skips and timeline taps land where asked, within ~0.05 s. Back 15 s from LIVE rewinds
  exactly 15 s.
- The NVR writes footage to disk ~13–20 s after it happens and LIVE carries no history, so a rewind
  into that band starts at the earliest footage there is, and recorded playback that catches up
  with the recording edge waits for it.
- An event stops at its end, paused on its last frame. Play replays it; a skip or a seek resumes it.
- Hiding the card (a closed popup, another view, a locked phone) releases the player after 3 s;
  showing it again carries on where it was.

Measured on the LAN with 2688×1512 cameras: opening a camera's LIVE 0.9 s (then 0.2–0.6 s behind
real time), back to LIVE 0.9 s, an event's first frame ~0.4 s. Relaying costs Home Assistant little:
about 1% of a core per LIVE stream, about 3% for recorded footage at full NVR speed (~20 MB/s).

### Fullscreen overlay

The scrubber drawn on the right edge of the fullscreen player. Single mode only; the second value in
each default is the phone (stacked) one.

| Option | Type | Default | Description |
|---|---|---|---|
| `fs_timeline` | boolean | `true` | Enable the overlay |
| `fs_timeline_width` | number | `165` / `120` | Ruler width, px |
| `fs_timeline_grab_width` | number | `0` | Width of the scrub-gesture band; `0` = the whole player |
| `fs_timeline_padding` | number | `60` / `20` | Clearance from the top and bottom of the screen |
| `fs_timeline_gutter` | number | `140` / `110` | Lane holding the zoom control and live arrow |
| `fs_timeline_scrim` | number 0–1 | `0.88` | Peak dimming behind the ruler |
| `fs_timeline_scrim_extend` | number | `170` / `130` | How far that dimming reaches past the ruler |

## Multi-camera page

`card_version: multi` turns the card into an overview page: one event strip merged across every
camera in `cameras:`, and a live grid below it. Tapping an event plays it in the grid's place with
the live streams unmounted, so only one stream decodes at a time; like everywhere else it stops at
its end. Tapping a live tile follows its `navigation_path`, or drills in place if it has none. The
grid tiles are Home Assistant's own camera streams (of each entry's `live_camera`).

```yaml
type: custom:unifi-protect-timeline-card
card_version: multi
title: Cameras
cameras:
  - camera: camera.front_yard_high_resolution_channel
    name: Front Yard
    live_camera: camera.front_yard_low_resolution_channel
    navigation_path: /dashboard/front-yard
  - camera: camera.driveway_high_resolution_channel
    name: Driveway
```

| Option | Type | Default | Description |
|---|---|---|---|
| `strip_title` | string | `Events` | Strip header; the merged event count is appended |
| `mobile_events_thumbnail_size` | number | `0` | Strip thumbnail width in the narrow layout. `0` = auto-size so two thumbnails fit |
| `strip_time_size` | number | `12` | Time label on strip thumbnails |
| `grid_aspect` | string | `16/9` | Live tile aspect ratio |

`accent_color`, `title*`, `back_button*`, `date_font_*`, `list_*`, `event_merge_gap_seconds`,
`thumbnail_concurrency`, `page_background` and `height` all work here too.
`thumbnail_cache_dir` and `scrub_preview_dir` are ignored — multi mode derives each camera's cache
path from its own entity id.

> Options removed in 2.0 and now ignored if present: `timeline_height`, `list_duration_size`,
> `grid_columns`, `hours_back`, `clip_text_size`, `clip_text_color`, `clip_text_bg`,
> `hide_occluded_thumbnails`, `list_hours_back`, `scrub_time_size`, `detections`. Removed after
> 2.1 (events no longer play as a playlist): `merged_playback`, `clip_segment_seconds`,
> `clip_segment_join_seconds`. Removed in 3.0 (one player, no clip files, photo-only scrub
> preview): `chunk_seconds`, `delay_seconds`, `max_clip_seconds`, `live_transport`,
> `live_prewarm`, `scrub_tip`, `scrub_preview_mode`. Safe to delete from your YAML.

## Server-side helpers

Two pieces, both in this repo: the `protect_cache` custom component (**required** — the player's
footage comes through it) and the optional `protect_thumbs` pyscript job. Without the job the
events list stays empty.

### `protect_cache` (required)

A custom component that

- relays the NVR's playback and live streams to the card's player (`/api/protect_stream/ws`, see
  [How playback works](#how-playback-works));
- builds the [scrub preview](#scrub-preview--protect_cachescrub_sync) photos;
- serves both caches at `/protect_thumbs/…` and `/protect_scrub/…`. They deliberately live in
  `config/.cache/` rather than `config/www/`, because that is the one path Home Assistant's backups
  skip — and a symlink from `www/` cannot work, as aiohttp's static handler refuses to follow
  symlinks out of its root.

Install: copy `custom_components/protect_cache/` to `/config/custom_components/protect_cache/` (a
symlink from a checkout works too), add `protect_cache:` to `configuration.yaml`, configure the
[camera list](#camera-list) and restart Home Assistant once.

### Scrub preview — `protect_cache.scrub_sync`

Part of `protect_cache`; nothing extra to install. Every 15 s it asks the NVR for the newest footage
in the NVR's keyframe-only playback mode (the full-resolution picture the cameras send every ~5 s,
nothing in between), turns each keyframe into a 640×360 photo with FFmpeg, and packs the photos
into the sheets the card draws from, under `/config/.cache/protect_scrub/<slug>/`. Each stretch of
footage is fetched once; the newest photo is ~20–30 s behind live (the NVR itself writes footage
~13–20 s late). After an outage it catches up from where it stopped, up to 24 hours back. With three
2688×1512 cameras it costs about 5% of one core in total (it replaced a job that cost 35–50%).

Disk: about **4 GB per camera** for the 7-day window (`RETENTION_MS` in `scrub.py`), more for busy
or detailed scenes. Lower `SHEET_QUALITY` to shrink it — it does not change the CPU cost, which is
almost all decoding the keyframes.

### Event cache — pyscript job

`pyscript/protect_thumbs.py` mirrors the NVR's raw detection events 1:1 into a local
`manifest.json` plus the exact thumbnail the Protect app shows, under
`/config/.cache/protect_thumbs/<slug>/`. The card renders its events list and timeline bars straight
from that manifest, so no client ever hits the NVR per view. It syncs incrementally every minute
from a persisted cursor and keeps a rolling 7-day window (`LOOKBACK_HOURS`), with thumbnail files
kept for `RETENTION_DAYS` (90).

Needs [pyscript](https://github.com/custom-components/pyscript) with `allow_all_imports: true` and
`hass_is_global: true` (one Home Assistant restart). Copy `pyscript/protect_thumbs.py` to
`/config/pyscript/`, or symlink it there from a checkout — it contains no install-specific value,
so the copy in your config and the copy in this repo can be the same file. Then `pyscript.reload`
and run `pyscript.protect_thumbs_sync` once to start the backfill, which spreads itself over many
per-minute runs rather than hammering the NVR.

(Before 3.0 a second pyscript job, `protect_scrub.py`, made the scrub preview. Delete it — see the
upgrade steps in the [CHANGELOG](CHANGELOG.md).)

### Camera list

The event cache and the scrub preview read the **same** camera list, so the two can never drift
apart. Give it as `<protect camera id>=<HA camera object_id>` pairs, separated by commas and/or
newlines. Environment first:

```yaml
# Container / Compose / Kubernetes: an env var on the Home Assistant process.
# Read once at startup, so changing it needs a restart.
UNIFI_PROTECT_CAMERAS: "0123456789abcdef01234567=front_yard_high_resolution_channel"
```

```yaml
# HA OS / Supervised, or anywhere you prefer YAML: configuration.yaml.
# !secret works here. pyscript picks a change up on pyscript.reload;
# protect_cache reads this same block, but only when Home Assistant starts.
pyscript:
  allow_all_imports: true
  hass_is_global: true
  unifi_protect_cameras: "0123456789abcdef01234567=front_yard_high_resolution_channel"
```

Without pyscript, `protect_cache: cameras: "…"` works for the scrub preview too.

Find the Protect camera ids by calling `pyscript.protect_thumbs_list_cameras` and reading the log.
The slug **must** equal the camera entity's `object_id` (the part after `camera.`) — that is what the
card derives its cache paths from.

`UNIFI_PROTECT_ENTRY_ID` / `unifi_protect_entry_id` is optional and only needed with more than one
Protect NVR; otherwise the single `unifiprotect` config entry is auto-discovered.

#### Monitoring the jobs

Both jobs run themselves — the event cache once a minute, the scrub preview every 15 s — and a pass
that fails only reaches the log. To have failures recorded, run them from Home Assistant scripts on
an automation's schedule: `pyscript.protect_thumbs_sync` (with `unifi_protect_schedule: false`, or
`UNIFI_PROTECT_SCHEDULE=false`, to switch its own timer off) and `protect_cache.scrub_sync` (which
keeps its 15 s passes and returns the result of the one in flight). Each returns
`{"ok": true, …}` or `{"ok": false, "error": "…"}`, and the script stops with an error when it is
not ok, which records a failed run any monitor of scripts can see. The YAML is in
`protect_thumbs.py`'s docstring. A job fails when it cannot work at all (the NVR or the integration
unreachable, nothing configured, a crash); a thumbnail the NVR does not have, or a camera that was
offline, is not a failure. Motion-triggered event syncs keep working either way.

Have the automation hold off for a few minutes after Home Assistant starts (the docstring's YAML
does, with a condition on the automation's own `last_changed` — a string in `this`, hence
`as_datetime`). Until pyscript has loaded the file, `pyscript.protect_thumbs_sync` does not exist,
and a script calling a missing action dies with `ServiceNotFound` — which `continue_on_error`
deliberately does not cover. For the first three minutes after startup, a sync that finds the UniFi
Protect integration not up yet is skipped (ok), not failed.

## Develop

```bash
npm ci
npm run typecheck     # tsc --noEmit
npm test              # vitest — pure logic only
npm run build         # -> dist/unifi-protect-timeline-card.js
```

## License

MIT
