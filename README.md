# UniFi Protect Timeline Card

A Home Assistant Lovelace card that brings the **UniFi Protect** camera experience into a dashboard:
a vertical timeline you drag past a fixed playhead to scrub through recorded footage, live streaming,
and a detections list with thumbnails. It talks only to the `unifiprotect` integration — there is no
direct NVR access and nothing to configure on the NVR side.

Three optional server-side helpers (included in this repo) make it fast: they mirror the NVR's event
list and thumbnails locally, cache low-res footage so scrubbing shows real frames instead of a black
stage, and stream historical clips with proper HTTP range support.

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
| `live_camera` | string | = `camera` | Separate entity for the live view — point it at a low-resolution channel to cut decode cost |
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
| `autoplay_next_event` | boolean | `true` | When a clip ends, step to the next newer event. `false` keeps playing timeline footage from where the clip ended |

### Thumbnails and cache

| Option | Type | Default | Description |
|---|---|---|---|
| `thumbnail_concurrency` | number | `2` | Maximum parallel thumbnail fetches from the NVR. Both modes |
| `thumbnail_cache_dir` | string | `/protect_thumbs/<camera object_id>` | Where the [event cache](#event-cache--protect_thumbspy) writes. Single mode only |

### Scrub preview

| Option | Type | Default | Description |
|---|---|---|---|
| `scrub_preview` | boolean | `true` | Show cached footage frames while scrubbing instead of a black stage. Needs the [scrub cache](#scrub-preview--protect_scrubpy) |
| `scrub_preview_dir` | string | `/protect_scrub/<camera object_id>` | Where that cache lives |
| `scrub_tip` | boolean | `true` | Near the live edge, fetch an on-demand real-time clip of the newest ~60 s so the last minute scrubs frame by frame. `false` = cron cache only |
| `scrub_preview_mode` | string | `sprites` | How the scrub preview paints. `sprites` draws JPEG atlases, `video` seeks cached MP4s, and `auto` measures MP4 seek latency before switching slow devices to sprites |
| `scrub_fast_preview` | `always` \| `speed` \| `off` | `speed` | Compact-tier policy. `speed` enables compact previews on every client only when motion outruns the fine tier. `always` is a diagnostic override that forces temporally decimated compact frames during any movement. `off` keeps the 640×360 fine tier |

Fast atlases are additive and begin when the updated `protect_scrub.py` starts; older footage keeps
its existing sprite/MP4 representation with no historical backfill. Completed overview hours keep
roughly one frame per minute in three 480×270 JPEG sheets (about 1 MB/hour/camera). Compact copies
of completed 10-minute blocks and the immutable rolling head cover the newest incomplete hour.
After LIVE is stable, the card preloads only the current compact head sidecar and one JPEG sheet,
not the head MP4. Preview targets are coalesced to 30 Hz while the ruler remains display-rate.
Slow movement stays on the roughly 2.4-second 640×360 fine frames. Fast movement uses the compact
tier, then holding still for about 425 ms redraws the same canvas from the fine tier where available,
without remounting a media element or flashing black. On-demand tips remain on the video path.

### Playback

| Option | Type | Default | Description |
|---|---|---|---|
| `chunk_seconds` | number | `300` | Length of each exported clip segment. Longer = slower to start, fewer joins. Minimum 2. Both modes |
| `delay_seconds` | number | `15` | How far behind live delayed-follow playback holds. Minimum 12 |
| `live_audio_start` | `auto` \| `muted` | `muted` | `muted` starts the card session silently. One explicit Unmute applies to LIVE, history, clips, and camera switches until the view closes. `auto` additionally permits a best-effort audible initial LIVE start |
| `live_transport` | `auto` \| `hls` \| `webrtc` | `auto` | `auto` keeps high HLS on desktop/Android and uses a medium startup bridge followed by high WebRTC on Apple mobile. Explicit values force a transport for diagnosis or rollback |

#### Reliable live startup

Detail LIVE uses one Home Assistant high-HLS player on desktop and Android. Apple mobile avoids the
two-second LL-HLS buffer: a same-device medium camera starts as a muted bridge while an explicit high
WebRTC player negotiates underneath. After 750 ms of verified high decoded-frame progress, the bridge
is released and unmounted; settled LIVE is the original high entity, not medium. An explicit
`live_camera` entry wins, otherwise the card discovers an available same-device entity ending in
`_medium_resolution_channel`. `live_transport: hls` restores the prior behavior immediately.

Every card session starts muted so visual autoplay is deterministic. One explicit Unmute applies to
LIVE, delayed history, event clips, and subsequent camera switches until the card is hidden or
unmounted. The preference survives player remounts and the Apple-mobile medium-to-high handoff.
`live_audio_start: auto` remains available as an opt-in best-effort audible initial LIVE start.

After stable playback, a genuine progress stall releases and remounts the player. Hiding the card
also releases its network and decoder pipeline; showing it mounts a fresh muted player and reapplies
the audio policy. This prevents a closed popup or cached dashboard view from decoding in the
background. A nonfatal Home Assistant startup rejection (for example, `Stream never started`) is
also retried with bounded backoff instead of leaving the player on a permanent error screen.

For consistently fast high-resolution startup, enable **Preload stream** in Home Assistant's camera
preferences for each entity used by a timeline, and align LL-HLS with UniFi Protect's five-second
keyframes:

```yaml
stream:
  ll_hls: true
  segment_duration: 5
  part_duration: 1
```

Preloading continuously pulls each selected camera stream into Home Assistant, so account for its
network cost. On the measured 2688x1512 high channel, the release candidate's 20 fresh starts took
358-1180 ms (753 ms median), and 20 actual timeline-to-LIVE returns took 226-1012 ms (605 ms median).
Five injected HLS freezes resumed full-resolution motion 957-1956 ms after the last advancing frame,
with the replaced decoder released each time. In the Apple-mobile transport test, medium motion began
in 108-296 ms and high 2688x1512 WebRTC took over in 6.0-6.3 s; a stopped high track brought medium
motion back in 1.8 s while a fresh high player negotiated.

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
camera in `cameras:`, and a live grid below it. Tapping a clip plays it in the grid's place with the
live streams unmounted, so only one stream decodes at a time. Tapping a live tile follows its
`navigation_path`, or drills in place if it has none.

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
`thumbnail_concurrency`, `chunk_seconds`, `page_background` and `height` all work here too.
`thumbnail_cache_dir` and `scrub_preview_dir` are ignored — multi mode derives each camera's cache
path from its own entity id.

> Options removed in 2.0 and now ignored if present: `timeline_height`, `list_duration_size`,
> `grid_columns`, `hours_back`, `clip_text_size`, `clip_text_color`, `clip_text_bg`,
> `hide_occluded_thumbnails`, `list_hours_back`, `scrub_time_size`, `detections`. Safe to delete
> from your YAML.

## Server-side helpers

Three optional pieces, all in this repo. The card works without them — you get live, scrubbing and
on-demand NVR snapshots — but the events list stays empty and scrubbing shows no frames.

### `protect_cache` (required by both caches)

A small custom component that serves the two caches at `/protect_thumbs/…` and `/protect_scrub/…`,
and hosts the clip-session API (`POST /api/protect_clip/session`) used by bounded event clips. The
native Home Assistant UniFi export proxy ignores HTTP Range and the NVR writes MP4 metadata after
the media payload, so a browser cannot start or seek it without receiving the entire file. The
helper materializes the export, uses FFmpeg stream copy with `+faststart` (no quality/codec change),
and serves it with real HTTP Range support. One prepared session is retained across every seek in
that playback. Preparation and initial loading use explicit black `Preparing clip` / `Loading clip`
screens instead of stale LIVE/history frames; seek buffering leaves the video visible and, only
after 1.2 seconds, shows a transparent animated spinner in the configured seek-bar accent color
with no text.

The caches deliberately live in `config/.cache/` rather than `config/www/`, because that is the one
path Home Assistant's backups skip — and a symlink from `www/` cannot work, as aiohttp's static
handler refuses to follow symlinks out of its root. Hence this component.

- Copy `custom_components/protect_cache/` to `/config/custom_components/protect_cache/` (a symlink
  from a checkout works too).
- Add `protect_cache:` to `configuration.yaml` and restart Home Assistant once.

### Event cache — `pyscript/protect_thumbs.py`

Mirrors the NVR's raw detection events 1:1 into a local `manifest.json` plus the exact thumbnail the
Protect app shows, under `/config/.cache/protect_thumbs/<slug>/`. The card renders its events list
and timeline bars straight from that manifest, so no client ever hits the NVR per view. It syncs
incrementally every minute from a persisted cursor and keeps a rolling 7-day window
(`LOOKBACK_HOURS`), with thumbnail files kept for `RETENTION_DAYS` (90).

### Scrub preview — `pyscript/protect_scrub.py`

Exports the NVR's own low-resolution timelapse in fixed 10-minute blocks to
`/config/.cache/protect_scrub/<slug>/`, so dragging the timeline shows real footage. It also keeps a
rolling head block for the current minutes, compact atlases for the head/new blocks/hourly overview,
and — when `scrub_tip` is on — on-demand real-time clips of the newest ~60 s.

Disk: roughly **0.7–1.0 GB per day per camera**, so 5–7 GB per camera at the default 7-day window.
Lower `RETENTION_HOURS` to shrink it.

### Installing and configuring the two pyscript jobs

Both need [pyscript](https://github.com/custom-components/pyscript) with `allow_all_imports: true`
and `hass_is_global: true` (one Home Assistant restart), and both need `protect_cache` above.

Copy each file to `/config/pyscript/`, or symlink it there from a checkout — neither script contains
any install-specific value, so the copy in your config and the copy in this repo can be the same
file.

They read the **same** camera list, so the two can never drift apart. Give it as
`<protect camera id>=<HA camera object_id>` pairs, separated by commas and/or newlines. Environment
first:

```yaml
# Container / Compose / Kubernetes: an env var on the Home Assistant process.
# Read once at startup, so changing it needs a restart.
UNIFI_PROTECT_CAMERAS: "0123456789abcdef01234567=front_yard_high_resolution_channel"
```

```yaml
# HA OS / Supervised, or anywhere you prefer YAML: configuration.yaml.
# Picked up by pyscript.reload alone, and !secret works here.
pyscript:
  allow_all_imports: true
  hass_is_global: true
  unifi_protect_cameras: "0123456789abcdef01234567=front_yard_high_resolution_channel"
```

Find the Protect camera ids by calling `pyscript.protect_thumbs_list_cameras` and reading the log.
The slug **must** equal the camera entity's `object_id` (the part after `camera.`) — that is what the
card derives its cache paths from.

`UNIFI_PROTECT_ENTRY_ID` / `unifi_protect_entry_id` is optional and only needed with more than one
Protect NVR; otherwise the single `unifiprotect` config entry is auto-discovered.

Then `pyscript.reload` and run `pyscript.protect_thumbs_sync` and `pyscript.protect_scrub_sync` once
each to start the backfill — it spreads itself over many per-minute runs rather than hammering the
NVR.

## Develop

```bash
npm ci
npm run typecheck     # tsc --noEmit
npm test              # vitest — pure logic only
npm run build         # -> dist/unifi-protect-timeline-card.js
```

## License

MIT
