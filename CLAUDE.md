# CLAUDE.md — working notes for AI agents

Guidance for Claude Code (or any AI agent) continuing work on this card. It captures the
architecture and the **non-obvious decisions** that aren't visible from the code alone, so you can
pick up where the last session left off.

## What this is

`unifi-protect-timeline-card` — a HACS-installable Home Assistant Lovelace card that replicates the
**UniFi Protect** camera UX: a vertical **timeline** scrubber (fixed playhead, drag footage past
it, pinch/wheel zoom, live + historical playback) plus an **events** list (detections newest-first,
grouped by day, with thumbnails). Lit + a `<canvas>` timeline, built with Vite into a single ESM
file. The browser never talks to the NVR: footage comes through `protect_cache`'s relay, which uses
the `unifiprotect` integration's own authenticated NVR session.

**3.0 (2026-10-14) replaced the whole playback stack** — HA's `<ha-camera-stream>` for live, clip
sessions (export -> faststart remux -> Range-served file) for events, the two-slot "follow" engine
for continuous footage, stream warming, and the pyscript scrub job — with ONE player fed by the
NVR's own websockets plus a keyframe-based scrub job. The old design and its measurements live at
tag `v2.3.2` / branch `checkpoint/pre-zero-switch`; don't resurrect its gotchas from memory.

## Layout

```
src/card.ts               root <unifi-protect-timeline-card>: config, state, orchestration,
                          getStubConfig (the picker defaults — keep in sync with the README),
                          live tick, band/manifest fetching, mode (timeline/list) switching.
src/scrubber-timeline.ts  the <canvas> timeline: ticks, track, event bars, inline thumbnails,
                          playhead/LIVE pill, pointer gestures (drag/pinch/wheel), zoom.
src/media-view.ts         the video pane: ONE stable stage around the player (live, recorded,
                          events), the control bar / seek bar, and the scrub preview layer.
src/nvr-player.ts         the player engine: one <video> + one MediaSource fed by the relay.
src/data/nvr-frames.ts    deframes the NVR's stream framing into init/media segments + keyframe
                          times (unit-tested; byte-identical to the Python port in scrub.py).
src/data/scrub-preview.ts loader for the scrub-preview photos (index, sidecars, sheet LRU).
src/live-grid.ts          multi page's live grid — still HA's <ha-camera-stream> per tile.
src/events-list.ts        the events list view (day dividers, lazy thumbnails, infinite scroll).
src/data/thumbnail-loader.ts  shared NVR-safe thumbnail loader (manifest-first, blob cache).
src/data/detections.ts    binary_sensor history -> detection bands (pure, unit-tested).
src/data/time-scale.ts    time<->pixel + pan/zoom math (pure, unit-tested).
src/data/ha-urls.ts       proxy URL builders + auth/sign_path.
src/data/motion.ts        the tablet's screen transitions: spring curve, zoom geometry, frame
                          copies (see "Screen transitions" under Gotchas; unit-tested).
src/data/types.ts         CardConfig + shared interfaces.
pyscript/protect_thumbs.py  OPTIONAL server-side event/thumbnail cache (see README).
custom_components/protect_cache/  REQUIRED. __init__.py serves both caches from config/.cache/
                          (NOT www/, so HA backups skip them — Core has no configurable excludes,
                          and a symlink can't work: aiohttp static uses follow_symlinks=False);
                          nvr_stream.py = the stream relay (/api/protect_stream/ws);
                          scrub.py = the scrub-preview job (action protect_cache.scrub_sync);
                          talk.py = Talk (/api/protect_talk/ws) + talk_sender.py, the
                          per-session encode/send process it starts.
dist/                     the built bundle — COMMITTED on purpose (HACS installs it directly).
```

## Architecture & data flow

- **Timeline (canvas).** `scrubber-timeline.ts` owns a visible time `domain`; the playhead is fixed
  near the top (`PLAYHEAD_FRAC`). Dragging pans the domain; tap/drag/wheel emit `scrub`/`scrub-end`
  with a time; the card loads footage for that time. Zoom is stepped (`SPAN_STEPS`) with an eased
  animation (`_animDomain`).
- **The player (`nvr-player.ts`, "zero switch").** ONE `<video>` + ONE MediaSource
  (ManagedMediaSource on iOS, attached via `srcObject` with `disableRemotePlayback`), fed from the
  NVR's own websockets — exactly what the Protect web app does. Media time = wall-clock seconds −
  `base` (`base` = now − 45 days, segments mode, `timestampOffset = −base`), so live and recorded
  footage share ONE timeline and every seek is a seek inside one buffer; nothing is ever handed
  from one element to another. Buffer kept ~45 s behind / 12-30 s ahead (`BACK_KEEP_S`,
  `AHEAD_LOW_S`/`AHEAD_HIGH_S`); recorded streams are flow-controlled with pause/resume; live joins
  on a keyframe inside the buffered live range and holds ~1 s behind its edge (`LIVE_TARGET_S`;
  1.1/1.25x past `LIVE_BAND_S`, keyframe jump past 4 s; watchdog re-aims/restarts). A seek back
  into the live session's footage TIMESHIFTS: the live stream keeps running and filling ahead of
  the playhead (see the NVR-edge gotcha), and live() rejoins the same stream. Failures are
  BUDGETED (`RETRY_DELAYS_MS` 1/3/8 s, then a message). Hooks to media-view: frame/change/
  boundReached/failed/problem/play. Measured on the LAN (2688x1512): live drill-in 0.86 s (0.2-0.6 s
  behind real time), back to LIVE 0.89 s, Back 15 s exact (−0.02 s), skips ±0.05 s, a 30-min scrub
  lands exactly, an event's first frame 0.42 s, zero exports. Device results: iPhone HA app (iOS
  26.6.1) ManagedMediaSource OK; the Android 16 wall tablet (WebView Chrome 153) MediaSource OK.
- **The relay (`protect_cache/nvr_stream.py`, `/api/protect_stream/ws`).** The browser cannot
  reach the NVR (Protect login, self-signed cert, remote access through HA), so this view relays
  bytes with the integration's session; it does NOT parse them. The card opens it via
  `auth/sign_path` (a browser websocket can't send a header). Client JSON ops live/play/pause/
  resume/stop with a `gen`; server = binary (4-byte gen + raw NVR bytes) + text events
  open/end/error. Relaying costs ~1% of a core per live stream, ~3% at full playback speed.
- **NVR stream protocol (measured, keep).** Negotiate `GET /proxy/protect/api/ws/{playback|
  livestream}?...` → `{url}`, then connect with the configured host (keep port/path/query — the
  token). Playback params `format=FMP4, camera, channel, start, end`; it first sends a Protect
  packet (`{success}` + `{channelName,start,end}`), then IDLES until a `{command:"resume"}` packet
  (two frames `[1|2, fmt=1, deflated=1, 0, len32] + zlib(JSON)`); `pause` stops it within ~250 ms.
  Live uses the web UI's params (`useWallClock=true`, `rebaseTimestampsToZero=false`,
  `allowPartialGOP`, 100 ms fragments); first keyframe 0.10-0.15 s after the request. Frames
  `[type:1][len:3][payload]`: 248 codec, 250 init, 249/255 segment begin/end, 251 = PIECES of one
  moof (tfdt in a later piece), 254 mdat header, 252 video, 253 audio, 247 timestamps. Wall-clock
  tfdt at 90 kHz. Recorded footage only on channel 0. Keyframes every 4.99 s.
  `withIdrs=true&idrFrequency=<ms>` = keyframes only (idrFrequency is MILLISECONDS and needs
  withIdrs; withIdrs alone = the full stream). `ws/timelapse` needs withIdrs and is the NVR's own
  640x360 track at ONE frame a minute. A finished playback socket is NOT closed by the NVR.
- **Events stop at their end (2026-10-12, user decision).** `_finishEvent` pauses on the last frame
  and fires `clip-ended` once; hosts no longer react (selection, highlight and seek bar stay); Play
  replays from the start, a skip/seek resumes. The engine's `setBound` stops at `_eventEnd`
  (`END_MARGIN_MS` short of it). The seek bar moves only its knob while dragging and seeks once on
  release (`_followNow` holds the released position) — an earlier engine fired an export per
  pixel. (Parked idea, user liked it: paint the scrub-preview photos while that bar is dragged.)
  Its times (`_clipProgress`, 2026-10-31): the event's length as the events list rounds it
  ("8s"), whole seconds elapsed, and an event that played to its bound reads as ENDED (knob at
  the end, "−0:00") - stopping `END_MARGIN_MS` short left "−0:01" and 0:07 of an 8 s event on
  every clip (user: "clips end 1 second too early").
- **Scrub preview job (`protect_cache/scrub.py`, since 3.0).** Every 15 s, per camera: playback
  socket in keyframe-only mode from a persisted cursor → one ffmpeg decodes the keyframes
  (`-skip_frame nokey`, showinfo pts → wall time) into 640x360 tiles → Pillow packs 4x4 sheets
  (JPEG 60) on a fixed 5 s SLOT grid (120 per 10-min block; every 6th slot → 120 per hour
  overview). Writes the layout the card already read (`<S>.fast-sprite.json` + `<S>.f<k>.jpg`,
  `o<H>…`, head `h<S>-<E>.fast-sprite.json` whose full sheets are the block's own `<S>.f<k>.jpg`).
  The cursor stands just after the last keyframe that ARRIVED (the NVR writes ~13-20 s late and
  simply delivers what it has); an empty range is a gap only once it ended >60 s ago. Measured: a
  10-min block = 120 keyframes / 37 MB (night) in ~1.3 s, ~33 ms CPU per keyframe; newest photo
  20-31 s behind live; HA container 50-100% (old pyscript job, spikes ~170%) → 18.8%. Monitoring:
  an HA script calls `protect_cache.scrub_sync`, which JOINS the pass in flight (a "skipped" would
  report success for a failing job).
- **Events.** Two sources are unioned: the optional thumbnail-cache **manifest** (exact Protect
  events with local thumbnails, a rolling window) for recent events, plus **binary_sensor history**
  for older ones (back to recorder retention). The list lazy-loads thumbnails via
  IntersectionObserver and auto-loads more until the viewport fills.

## The server-side helpers hold NO install-specific values

`pyscript/protect_thumbs.py` and `custom_components/protect_cache/` are **the deployed files** — a
working install symlinks `/config/pyscript/protect_thumbs.py` and
`/config/custom_components/protect_cache` straight at this checkout, so there is exactly one copy
of each and editing either path edits this repo. Two consequences:

- **Never hardcode a camera id, entity id, config-entry id or NVR address in them.** They are read
  from `UNIFI_PROTECT_CAMERAS` / `UNIFI_PROTECT_ENTRY_ID` in the environment, falling back to
  `unifi_protect_*` under `pyscript:` in `configuration.yaml` — protect_thumbs.py's *install
  configuration* block and `_conf` in scrub.py read the SAME settings in the same order (scrub.py
  reads the pyscript block out of the config HA hands `async_setup`); change both together. This
  is not just hygiene: the checkout lives under `config/www/`, which HA serves
  **unauthenticated** at `/local/...`, so anything written into these files is published. Never
  put camera footage under `/local` either.
- **An edit here is live on the next `pyscript.reload`** (or HA restart for `protect_cache`). There
  is no separate deploy step, and no second copy to keep in sync.

## Gotchas (these cost real debugging time — keep them)

- **Eviction must not judge LIVE footage by the playhead before the join (fixed 2026-10-25).**
  Until live joins, `currentTime` still stands where it was — minutes back after a scrub, 0 in a
  fresh buffer — so `_queueEvict` saw the new live footage as a far island (> `FAR_KEEP_S`
  ahead) and removed it, first keyframe included; the join then sought into the hole and sat
  `seeking` forever while MSE dropped everything up to the next keyframe 5 s later. Live had no
  stall recovery, so it was an endless spinner until the user switched camera or re-scrubbed —
  "1 in 10 scrub -> live" on every camera and device. Reproduced headless (3/16), every hang
  right after such a remove; after: 40/40. Now: no eviction before the join (aggressive quota
  eviction spares the live range), the join lands on a keyframe INSIDE the buffered live range
  (`_liveRange`/`_liveTarget`), and a live watchdog re-aims (`LIVE_JOIN_STALL_MS`,
  `LIVE_STALL_MS`) then restarts (`LIVE_MAX_REJOINS`, budgeted, then a message). Catch-up is
  playback rate (1.1/1.25x) + keyframe-only jumps — a mid-GOP jump made a slow decoder chew up
  to 5 s of frames. Live start, measured: the NVR sends 1-2 leftover P-frames, then a real IDR
  (`-p,SI` / `-p,-p,SI`), ~0.2 s after the request; MSE starts the range at the IDR.
  Stress test: scratchpad `live_stress.js` pattern = `_onScrub`+`_onScrubEnd` 1-11 min back,
  `_onLive()`, settled + `currentTime` moving within 10 s.
- **Field telemetry: `debug: true` (2026-10-25).** `src/data/debug-log.ts` batches events
  (player: open/data1/init/join/rejoin/jump/rate/evict/settled/fail, video + MediaSource
  events, a 2 s `snap` with lag/buffer/dropped frames; `decode` = mediaCapabilities for the
  stream; Talk: mic settings as APPLIED, mic level per 20 ms, server-side frame arrival) to
  `POST /api/protect_cache/debug` -> `config/.cache/protect_debug/<day>/<client>.jsonl`
  (`rx` server clock vs batch `sent` aligns devices). Headless 2K portrait doorbell decode:
  supported, NOT smooth, NOT powerEfficient (software) — check what each real device says.
- **Multi page, wide layout: "Events (N) >" IS the heading; tiles fill (2026-10-25).** The
  card header shows `strip_title` + a smaller bracketed count (centred on the title, not on
  its baseline) + chevron where `title` was (stacked keeps `title`), all ONE button
  (`.head-link`, 8 px in so its ink lines up with the list rows' text; `ha-card.multi-wide`
  adds 10 px above it). The header row mirrors the page: `.head-events` is the events pane's
  width (`tabletPaneWidth`), then `TABLET_GAP`, then `.head-cams` ending where the camera grid
  does — the grid-density control is centred in it (over the cameras, on the title's line;
  absolutely positioned so its 46 px don't grow the 28 px row) and fades out while the
  cameras are away. multi-view reports `MultiHead` `{count, expanded, gridView, liveGrid}`
  with `events-head`; the card calls its `toggleExpand()` / `setGridView()`. A `<button>`
  needs `font: inherit` (count and icon are sized in em); the chevron is `height: 1em` (else
  the header row grows 1.5 px and the page shifts).
  Live tiles there FILL the pane — rows share the height, tiles their row (CSS flex, no JS
  sizing; an orphan spans its row), `GRID_EDGE` (14 px) clear of the pane's top and the
  card's right and bottom edges, nothing on the left (user's spacing) — with
  no fullscreen button and `fitMode: 'cover'` on `<ha-camera-stream>` (HA's players apply it
  to their `<video>`), so every feed keeps its aspect and is zoomed to cover (UniFi app).
  `grid_aspect` only shapes stacked/single-column tiles now. CENTRED, verified: the tile's
  own video frame drawn on a canvas at the tile's scale, a vertical offset swept against a
  screenshot of the tile — 16:9 tile: best at a 165 px top crop (expected 164.6), RMSE 0.03
  vs 0.31-0.41 top-/bottom-aligned; 433x432 tile: 83 (82.5). Gotcha: the grid's own
  `height: 100%` beats a `bottom` inset — the bleed needs `height: auto`. The expanded events
  grid has its own thumbnail size (`tablet_events_grid_thumbnail_size`, 1.5x the list's).
- **The PHONE (stacked layout) has the same two screens since 2026-10-27 (user: "port ALL of
  the changes", design confirmed before building).** Multi page: today's arrangement (strip
  on top, live tiles below, one page scroll) with the tablet's heading `[<] Events (N) >`
  (card.ts `headLink`; the strip's own head is hidden), tiles cover-cropped (portrait
  doorbell fills its 16:9 tile), NO tile fullscreen buttons (that path - `tile-fullscreen`,
  `camera-fullscreen`, `_drillFs` - is gone), clip players with the round controls
  (`roundCtrl` everywhere) and the same zooms as the tablet - see the next note for how the
  page loads, switches and plays. Camera screen = the tablet's
  (`_renderPanel`) in a `.frame`: SIDEWAYS (rotate 90° cw, laid out height x width so it fills
  the card once turned) for landscape footage on a portrait window, UPRIGHT for portrait
  footage - decided by the camera's resolution (`_phoneTurned`/`_footageSize`), never per
  camera (user rule). Phone sizes via `_phoneScreen()` (stacked, OR a card < 500 px tall = a
  phone held in landscape with rotation unlocked - same ~844x390 geometry): controls
  `PHONE_CTRL_SCALE` 0.72, events column / picker tiles `PHONE_*`, compact calendar,
  ruler `FS_FONT_SCALE_PHONE` + phone pad/gutter, `PHONE_FS_PLAYHEAD_FRAC`. Upright: the bar
  is full width at the bottom with back/play/forward as its TOP row (`.vc-row`; the floating
  middle row would sit under the ruler), the ruler and events panel end above it
  (`--upc-fs-ctrl-h` on the host). The scrubber's `rotated` maps pointers for the sideways
  frame (verified: a 120 px finger move = exactly 120/350 of the span; a move across the
  ruler does nothing). Flights: `turnZoom` (motion.ts) - one translate/rotate/scale list at
  both ends so the picture turns as it grows; `turnedLocal` maps screen rects into the
  turned frame (picker fly-in); a pick that flips the orientation fades instead. The
  per-camera views (House room tiles) show the same screen; their card_mod padding is scoped
  `ha-card:not(.panel)` so the camera screen reaches the edges. The old phone page
  (Timeline/Events tabs, `video_ratio`, `video_aspect`, `toggle_*`, the rotated <dialog>
  fullscreen for it) is no longer rendered - README/stub options to prune at release.
- **Phone multi page: nothing shows before its picture (2026-10-27, user: "no black frame
  flashes", "fully test all animations").** View open: until the events are in, the strip
  holds the carousel's height with invisible `.clip.hold` items (`loaded`) and the heading's
  count is hidden (`.pending`); each strip item fades in once its `<img>` has loaded or
  failed (`.clip.shown`; `REVEAL_LATE_MS` 1200 without one); each live tile fades in whole
  (`.tile.ready`) on its stream's first frame OR as soon as HA's player has its POSTER (the
  camera's snapshot; streams take 0.2-2+ s) - seen through Resource Timing (live-grid
  `POSTERS`, module-level: a remounted tile's poster comes from the memory cache with no new
  entry). GOTCHA: the strip's scroll root is REPLACED when the events arrive (placeholder ->
  real `.strip`), so its IntersectionObserver is rebuilt whenever the root differs
  (`_ioRoot`) - against the detached one no thumbnail was ever requested. Grid open/close
  (`_toggleStacked`): open = `preload(12)`, strip + tiles fade out 180 ms, swap, page to its
  top, `firstScreenReady(450)` (the pictures in view loaded AND `decode()`d; the `instant`
  attribute lands items already in without their own fade), then the grid fades in rising
  14 px (380 ms); close = fade out, swap, carousel fades in, tiles each on their own frame.
  Clip card (`.playwrap` / grid lightbox `.playbox`): edge to edge, the clip's own shape
  (`_clipShape`: camera width/height) - landscape gets `PHONE_CLIP_STRIP` (136) below the
  picture for the seek bar + buttons, portrait none (the doorbell plays 390x520, controls
  over its foot); the picture is drawn at the TOP (`object-position: 50% 0`,
  `videoBox().y = 0`, middle row and spinner on `--upc-vc-top`); the seek bar runs the card's
  width (16 px in) with the times UNDER it, 40 px grab area (user: "seek bar not full width",
  "playhead almost impossible to control"); `PHONE_CLIP_CTRL_SCALE` 0.8. Its black is two
  layers (`.card-pic`, `.card-strip`; media-view's stage is transparent there) so a zoom
  flies the PICTURE only: the strip fades in over the last 45% of an open and out over the
  first 30% of a close (it used to hang black under the thumbnail). Same camera = the old
  picture holds until the new clip's frame (`sameCamClip`, no blank). Another camera:
  `_dissolve` puts backdrop + ghost at the OLD wrap's rect (`.under > .backdrop` has no
  inset), and on the phone the backdrop fades out late in the zoom (a portrait card is
  taller than a landscape one). A thumbnail tapped with the page scrolled down LIFTS:
  `scrollTop = 0` + strip and body FLIP down over the zoom (the playing card fits the page
  at its top; otherwise the scroll clamps with a jump when the tiles under it unmount).
  Foot: the host's 20 px gap + `.foot` = max(20 px, safe area) under the last tile (rounded
  screen corners). Test over HTTPS (the instance's public URL, HTTP/2 like the phone):
  over the pod's plain HTTP/1.1 the tiles' long-polls take the 6 connections and thumbnails
  crawl, which the phone never sees.
- **Camera screen: rows on one axis, nothing on top of anything (2026-10-28, user).** The
  rows stay centred in the area left of the timeline (user chose that over the screen
  centre, which would put the forward button on the ruler's thumbnails), and the bottom
  row is centred AS A WHOLE on the middle row's axis, whatever it holds (2026-10-31, user:
  the old `1fr auto 1fr` grid kept sound + talk on the axis, so without exit - the
  standalone popups - speed hung off to the left). Talk comes with live, exit with
  `cardFsExit`, so the count is 2-4: `_renderAxisGroup` gives each button an index
  (`.vg-slot`, `--i` of `--n`; all buttons are one size, so the place is
  `(i - (n-1)/2) * (57+28)px * k` around a 0-wide group) and a count change SLIDES them
  (transform transition). Talk keeps its slot off live (`.off`, i = 1.5: the very spot it
  holds in the row it leaves) and shrinks out / grows back there while the others make
  room. Sideways on a phone the frame's LEFT edge is the screen's TOP - the status bar and
  camera cutout (2026-10-31, real iPhone: skip-back sat under it; Chrome's simulator has no
  inset): the card sets `--upc-fs-left` (env `safe-area-inset-top` turned, `-left` otherwise),
  media-view reads it off `.vinset` (`_leftInset`, JS can't resolve env()) and centres both
  rows in the free area right of it (`shift = (taken - inset) / 2`, the gap fit and `crowded`
  without it). Test by setting `--upc-fs-left` on the ha-card + `_syncLeftInset()`.
  Phone control sizes = the clip card's (`PHONE_CTRL_SCALE` =
  `PHONE_CLIP_CTRL_SCALE`). PHONE ONLY: the events list REPLACES the timeline while open
  (`_tlAside` -> `.fs-tl.aside`, faded and untappable; `taken` = the list alone) - sideways
  it pushed the ruler into the picture, upright off the left edge (its pill vanished);
  the cameras chevron moves to the middle of what the list leaves (`--upc-cams-shift`; upright
  it sat on the list's heading); the calendar opens in the MIDDLE of the screen over a
  dimmed backdrop (`.cal-modal` in the `.frame`, `_calFlight`: `zoom()` out of / back into
  the date pill, its box mapped through `_layerBox` for the sideways frame; six week rows
  always); the camera picker dims the rest of the screen (`.fs-cams-foot::before`, 200vmax);
  the zoom slider hides the events chevron it opened beside (`zoom-panel` event from the
  scrubber; a scrubber re-announces "closed" when it connects, since one that left with the
  slider open can't). Month change (all calendars): a copy of the old title + days
  (`.cal-ghost`) slides out while the real ones, already the new month, slide in
  (`_calShift`). TESTING CSS transitions in slow motion: patching `Element.animate` doesn't
  touch them and `document.getAnimations()` doesn't see shadow DOM - set `playbackRate` on
  every shadow root's `getAnimations()` each frame.
- **Calendar, zoom (2026-10-30, user on the tablet).** The calendar is the centred modal on
  BOTH layouts now (it sat on the tablet's play controls): media-view `chromeAside` fades the
  controls, timeline and panels away while it is up and lets them back as it starts closing
  (`_calClosing`), so the pill it shrinks into is there when it lands. Its days are the days
  the camera HAS FOOTAGE (gaps + `recording_start`, see the gaps gotcha) - it offered every
  day of `calendar_days`, which is now only the fallback without a scrub index; a day jump
  lands at noon or, in a gap, where footage resumes that day (`nearestFootage`). Zoom: an
  iOS-style slider (`.zrail`/`.zfill`/`.zcarrier`/`.zthumb`: 30px white knob springing from
  step to step, swelling while held, accent fill; transform-only; grows out of the magnifier
  and shrinks back - `_closeZoom`), plus a two-finger PINCH on the ruler (`_pinch`): spreading
  the fingers shows less time, about the playhead, so nothing seeks (measure the playhead with
  `playheadTimeOf`: NEWEST is at the top - `start + frac * span` is wrong).
- **Camera screen events panel = the events grid's items, one column (2026-10-30, user:
  "throw the design away").** `upc-event-strip` (expanded, captions, `gridColumns` 1, `fs`:
  the playing item on the deep accent) fed `_panelBands` (this camera's bands tagged with its
  name); thumbnail = the multi page grid's (phone: `(portrait width - 36) / 2`, text +1 like
  its grid; tablet: `tablet_events_grid_thumbnail_size`); panel = thumb + `PHONE_EVENTS_PAD` /
  `TABLET_EVENTS_PAD` each side. `upc-events-list` is no longer used there. PHONE controls
  never move: `taken` = max(timeline, panel), since one replaces the other (the tablet's
  panel still pushes its timeline, so its controls re-centre). Speed is a round button like
  the others (smaller "×"). UPRIGHT: the picture fills the space ABOVE the bar
  (`height: calc(100% - --upc-fs-ctrl-h)`, `videoBox` too) - running on under the bar it met
  the timeline's/panel's backgrounds in a step; a `<video>`/`<canvas>` given `bottom` with
  `height: auto` takes its own aspect's height and sits at the top, so it must be a height.
  Events cache: 14 days (`LOOKBACK_HOURS` 336; a state built with less bootstraps once);
  the low-quality hours were declined (not wired, `recording_start_lq` removed).
- **Camera screen details (2026-10-31, user).** Chevrons (`.fs-chev`, all layouts) sit on a
  soft radial shade (`::before`, `isolation: isolate`; the drop-shadow moved to the svg) -
  they vanished on bright footage. The cameras chevron NEVER moves (an upright shift with
  the events open was rejected). Calendar open/close = `popFlight` (motion.ts): out on an
  underdamped spring (`bouncyEasing` 0.36 s / 0.75 over 460 ms: full size at ~200 ms,
  ~2.5% overshoot, settled ~470 ms), back on a quicker critically damped one (0.27 s over
  300 ms) that holds for its first tenth and is FADED OUT by 60% of it (`POP_OUT_GONE`;
  measured: opacity 0.53 at 100 ms / scale 0.41, 0.09 at 167 ms / scale 0.22, gone at
  ~180 ms). Both user limits: a miniature calendar visibly sat on the pill (340 ms, fade
  over the last 60%), and gone by 100 ms (260 ms, fade by 40%) was "nearly instant". The
  scrim decelerates both ways. Phone zoom slider (`_zoomPanelGeom`): sideways (a short
  strip) from the magnifier to 12 px above the strip's foot (294 px / 166 px track, was
  206 / 78), the live arrow fading out under it; upright (a strip with > `ZOOM_TALL_STRIP`
  400 px below the magnifier) HALF that (257 px - the full 514 was "a bit extreme", user);
  it grows from / shrinks into the magnifier's actual size. Upright
  events list fades at both ends (CSS mask on `.fs-events-list`, `FS_LIST_FADE` 28 px, the
  strip's `--upc-fs-list-pad-*` keep the first/last item clear at rest); sideways it starts
  at the frame's top (`top: 0`, padding = the pad) so it scrolls on to the screen's edge.
- **Wide camera screen = the player filling the card, "card fullscreen" (2026-10-25).** The
  side-by-side timeline view is gone on the WIDE layout (and on the phone since 2026-10-27): card.ts
  `_renderPanel` renders only `<upc-media-view cardFs>` — the fullscreen look (overlay ruler)
  WITHOUT the Fullscreen API. Its controls are iOS/UniFi-style round DIMMED buttons
  (`_renderCtrlBar`'s cardFs branch; rgba(0,0,0,.6) + a 2px light edge for dark footage —
  1.5px rounds to 1px on 1x screens — and NO backdrop blur: the user found it stutter even on
  a MacBook Air): back / play-pause / forward big in the middle (`.vcenter`, on a soft radial
  shade; the skip icons are mdi:rewind-10 / fast-forward-10's own path data, split into arrow
  and "10" and pulled ~2 units further apart (`SKIP_ARC_*` / `SKIP_DIGITS`) — the user
  rejected a redrawn round-arrow icon; the step is `SKIP_MS` 10 s for every player), speed /
  sound / talk / exit along the bottom
  (`.vctrl.card` > `.vctrl-group`, deeper/taller bottom shade; exit = `fs-exit` ->
  `_goBack`: drill out / back target, absent when `cardFsExit` is false, i.e. a standalone
  popup, whose X closes it; with `fs_close_button` (`cardFsClose`, 2026-11-07, the user's
  tablet Cameras view) the exit leaves the row and is a round glass X 24 px from the top-right
  corner instead - `.fs-close` in `_renderCardChrome`, never fading with the controls, hidden
  only by `chromeHidden` - the same X as the dashboard's pop-ups). Both groups are centred in the area the timeline leaves FREE —
  left of its resting time pill (the scrubber reports `timeline-reach` = ruler edge to that
  pill's left edge, measured only when its anchor moves), its gutter, and the events panel
  while open (`--upc-fs-shift` = half of that). The middle row's gap is `VC_GAP` 128px,
  narrowed only to fit the free area (host width via ResizeObserver; 87px with the panel open
  on the 1207px tablet card). Disabled buttons fade only the glyph (60% white on the full
  disc); speed above 1x = the deep accent. LAYERS (host stacking context): video 0 <
  shades `.vshade`/`.vcshade` 4 < strip 5 < buttons 6 < events panel 8 < camera picker 9 —
  a shade painted on the buttons' layer dimmed the timeline's foot (date pill, live arrow),
  and the picker must cover an open events panel. Press feedback: `_pressFlash` adds
  `pressed` while held (>= `PRESS_MIN_MS` 90 so a quick tap still shows). User-chosen style
  `.press` ("iPhone player") on the colour-keeping buttons (skips, play-pause, exit): shrink
  .92 + slightly grey disc, spring back; skips also spin their arrow 40deg (`_spinArc`). A
  white flash was rejected as jarring and an "iOS 26 lift" lost; the "UIKit dim" runner-up's
  exact values are in the user's memory (they may want it back). The colour-changing ones
  (speed, sound, talk) just fade into their active colour on cubic-bezier(.22,1,.36,1). The old view's parts are SLOTTED into the player, which
  places them and shows/hides them with its controls: `fs-top` = camera picker (sheet sliding
  down from a chevron, tiles = events-grid thumbnail size; closes on pick AND on any tap
  outside it, swallowed like the calendar's), `fs-side` = events list (slides in from a
  chevron on the right edge; only its chevron closes it; `fsSide` px wide while open — the
  strip translates left and the control bar's inset grows by it). A row WINDS THE TIMELINE to
  its event's start and plays on (`_rewindTo`, like a ruler thumbnail tap) — user rule: no
  bounded clip, no seek bar, playback continues past the event's end; the clip mode is the
  phone's Events tab only. The date pill + its calendar ride in the SCRUBBER's own `foot` slot
  (mirror only): stacked on an invisible copy of the playhead pill at its resting spot
  (`--upc-pill-base-right`, a clock string even at LIVE) so it sits centred under the time
  pill without any measuring and never moves with the pill's dodge or swell; `.tl-foot` stops
  pointerdown (gestures are bound on `.scrub`). `holdCtrl` (any panel/calendar open) stops the
  auto-hide. A press inside the slots is a "control" for the tap detector (`.tl-foot/.fs-top/
  .fs-side` in `_isControlTarget`), so a row tap doesn't hide the chrome. The wrappers are `pointer-events: none`
  and hide with `visibility` (a child with `pointer-events: auto` would otherwise stay
  tappable while invisible). The overlay colours: `darken(accent, 0.58)` (exported from
  scrubber-timeline) for the pill / active tile / active row, the bright accent for the
  calendar's selected day. The grid tile's "fullscreen" hand-off from the multi page's clip
  player lands here at the clip's moment (no real fullscreen; `startFs` is phone-only now).
  The multi page's CLIP PLAYERS (wide layout: the in-place player beside the events list and
  the lightbox over the events grid) use the same controls (2026-10-26, user: "match one to
  one, no microphone"): media-view `roundCtrl` = the cardFs control branch without the
  timeline, every size scaled by `CLIP_CTRL_SCALE` (0.9 - "too big on the smaller player";
  the CSS reads `--vc-k`, so it is one number) - round middle row, then along the bottom
  speed, sound, a text-only "View in Timeline" pill (`fsHandoff` -> `fullscreen-handoff`
  -> card `_drillTo(camera, true, at)`: this screen at the moment on screen, measured
  -0.03 s; its exit returns to the page as it was) and Close (`closable` ->
  `player-close`: back to the camera tiles / the events grid), with an iPhone-style seek
  bar over the event above them (`.vc-seek`: elapsed left, remaining right, thickens while
  dragged). The page's own top-right close pills and camera-name label are gone on the
  wide layout (user). Their speed highlight gets the same deep accent (multi-view sets
  `--upc-accent-deep`). (The phone has them too since 2026-10-27.) A moment younger than ~36 s (an event that just happened) lands
  exactly too: `seek()` starts the live stream and its backfill for it (`behindLive`).
- **Screen transitions, tablet layout (2026-10-26, user: "proper iOS style animations to all
  transitions"; reworked the same day after the wall tablet LAGGED: "whatever is least
  computationally heavy").** `data/motion.ts`: a player grows out of what was tapped and
  shrinks back into it; what has no source fades. ONLY transform + opacity are animated (the
  compositor runs them, so a player starting on the main thread can't stutter a flight) -
  the first version also animated `clip-path` crops, background colours (letterbox, scrim)
  and copied every live tile's frame to a canvas with a pixel readback: 67-133 ms frames under
  4x CPU throttle, now <= 33 ms. Every zoom rides `iosEase()` = a critically damped spring
  (response 0.45 s) as CSS `linear()` over `ZOOM_MS` 500 (a front-loaded cubic-bezier made the
  close "jump" into its thumbnail). `zoom()` = scale-to-fit + an opacity ramp: opening, the
  box dissolves IN over the first 30%; closing, it dissolves OUT over the last 40%.
  Inventory: clip open = the player's BLACK box grows out of the thumbnail and the clip fades
  in on its first frame (user rejected flying the thumbnail: it is not the clip's first frame
  - often a square crop round the detection - so the swap at landing was a jarring jump);
  same-camera pick = the clip just changes in place; ANOTHER camera = the old player's black
  box + last frame (one GPU-side canvas copy, fading) stay UNDER the new player (`.under`,
  `_dissolve`); close = zoom back + dissolve, tiles fade in; tile -> camera screen = the black
  screen grows out of the tile (`_zoomIn`, `.xf-dim` 0 -> 0.4, `_xf` states), exit shrinks
  the picture back (home = the clip it came from, else - always when a tile opened it - the
  tile, else a 0.94 scale-fade); View in Timeline = the ONE place a frame is copied
  (`snapshot()` -> `poster`): the screen opens on the very picture that was playing; camera
  picker fly-in; calendar pop; grid <-> list fade-through (outgoing side first); density
  fade; the list's playing highlight moves in 0.2 s; lightbox scrim = an opacity layer
  (`.playoverlay > .scrim`). LIVE TILES fade in slowly (`TILE_FADE_MS` 800) each on its
  stream's first frame (`_watchFrames` polls three shadow roots down; shown anyway after
  4 s), starting only once the grid is visible (`_visible` starts false - streams started at
  once were torn down 0.1 s later in a sliding popup) - the user's "tiles just flash in".
  Rules: (1) `chromeHidden` hides only the controls (`transition: none`; their own fades bring
  them back). (2) While `_xf`, `ha-card.multi-wide` is a stacking context and the panel is
  transparent; `ha-card.multi-wide` has `contain: layout` so the fixed lightbox covers the
  card, not the sidebar. (3) A tile partly scrolled out of its grid zooms from/to its visible
  part (`clipBox`). (4) Opening the camera screen from a clip or a tile SUSPENDS the multi page
  (`_suspendedFor`): it comes back as it was (density, scroll). (5) `frameOf` never reads
  pixels back (a GPU stall), never runs on Apple WebKit. HOST: the tablet runs it as the
  subview `/tablet-dashboard/house_cameras` (sidebar-card `hideOnPath`), not a Bubble popup -
  measured at 4x throttle the popup's close dropped frames (50 ms) the view doesn't (17-33),
  and the hidden Home view kept refreshing camera snapshots. TESTING: per-frame rAF probes
  (computed transform / opacity; frame gaps under `emulate cpuThrottlingRate: 4`); visuals from
  a CDP screencast + ffmpeg contact sheets with an on-screen marker div, at 4x slow motion by
  patching `Element.prototype.animate` (`playbackRate = 0.25`) - CSS transitions are NOT
  slowed, and the screencast lags 200-300 ms, so never judge timing from it. The phone has
  the same transitions (see the PHONE note above); review its sideways frames by rotating the
  screenshot back (`ffmpeg -vf transpose=2`).
- **The NVR's playable edge is a SAWTOOTH, and near-live footage comes from the live stream
  (2026-10-26).** The NVR REFUSES a playback that starts past its recording edge, and that edge
  advances in JUMPS as recording segments close: binary-searched every ~2 s for 70 s (garage),
  it trails real time by ~12 s right after a jump, falls behind to ~35 s, then jumps again,
  every ~34 s. So "20 s ago" (`RECORDED_LAG_MS`) was refused ~half the time, and recorded
  playback nearer live than ~35 s runs into the frozen edge and stalls up to ~20 s. LIVE has
  no history. Rules now: (1) TIMESHIFT — `seek()` into the running live session's footage (or
  other footage still loaded within `TIMESHIFT_MAX_S` 45 s of its edge) keeps the live stream
  running (`_keepLiveFor`), so playback behind live never needs the NVR; `live()`/Play rejoins
  that same stream (`resumeLive`, keeping its history for the next skip; a channel change -
  Talk - restarts it); `pause()` of live keeps it too; `_tick` stops it once the playhead is
  45 s behind its edge (paused, or rewound far). (2) BACKFILL for a young session (rewritten
  2026-10-26 after the user rejected landing ~36 s back): a playback STARTED behind the accept
  edge does not stop there - it tails the recording, delivering it in flushes (whole 5 s GOPs
  + the partial newest; first burst 0.1-0.3 s after the request, the moment the session
  started is typically delivered ~7.5 s after it). So at live settle a second relay socket
  fetches `BACKFILL_MS` (40 s) before the session's first keyframe and follows it until it
  meets the session ("met live"); `isAvailable`/`timeshiftable` include what it holds or will
  deliver (`_bfWillFill`), and seeks there keep live running. Its footage is HELD in memory
  (~39 MB at most, dropped 40 s into the session - older footage is accepted from the NVR at
  once) and goes into the buffer only when the playhead/target is before the session start
  and behind the live GOP being built - see the MSE gotcha below for why. A press in the
  first ~2-7 s may wait for the next flush (up to ~6 s, measured 5.6) and playback may pause
  ~1-2 s at the delivered edge: that footage is not written anywhere yet. Fallbacks:
  nothing delivered in 4 s, or nothing new in 11 s (it went silent after its first burst
  twice in ~100 sessions; flushes come up to ~10 s apart) -> reconnect from the start,
  skipping what it has (x2); a seek waiting > 12 s, or a backfill that failed ->
  `bf:reaim`: the ordinary NVR path (no nearer than `RECORDED_SAFE_MS` 36 s via media-view
  `_seekRecorded`). TALK (user rule 2026-10-26: "when rewinding with the microphone, switch
  back to normal footage - the microphone isn't available in the past anyway"): channel 1
  is not recorded, so the backfill always fetches channel 0, and it survives the live
  channel switch (`_stopStream(nextIsLive)`, end = `_blockStart`: the earliest footage
  running into the session, stepping over the ~0.2-0.7 s gap a switch leaves). Leaving live
  (`_playRecorded`) sets the live channel back to normal, and `seek()` restarts the
  timeshift live stream on it (`timeshiftChannel`) - so a rewind during Talk lands exactly,
  on channel 0 footage before Talk and after the rewind (the Talk stretch plays its channel-1
  footage; changeType at each boundary, playback steps over the gaps). Measured: 13/13
  exact, incl. Talk pressed the instant the camera opened. BEHIND LIVE without a live
  stream (a hand-off to a recent moment, a scrub released near live after the timeshift
  ended): `seek()` to a target within `BACKFILL_MS - 3 s` opens the live stream (not
  followed) and the backfill starts with its first keyframe (`_accept`), so the target
  comes from it exactly; `isAvailable` counts such targets, so media-view no longer clamps
  them to 36 s back. Measured: 15 s / 25 s ago exact in ~1.7 s, 8 s ago exact after the
  NVR's flush (8.3 s). A reaim (`_viaNvr`) bypasses all of this. (3) `_notRecordedYet` never moves a pending seek whose
  target is LOADED (the refusal was for the footage after it), and asks an unloaded one again
  5 s further back (x3) before landing after it. The OLD code moved every pending seek to the
  next buffered range = the start of a fresh live session: the user's "skip back 10 s moves
  1-2 s or not at all, 2-3 times in 10" (reproduced: 3.0, 1.5, 2.6, 0 s; plus 19-20 s
  over-shoots), because every return to live started a NEW session with an empty buffer.
  (4) `_skipFwd`: exact into the live session or recordings >= 36 s old, else LIVE (a fetch in
  between would stall or land behind the press); `NEAR_LIVE_MS` (speed held at 1x) = 41 s.
  Verified headless (dev43-46): ~78 presses on fresh sessions (all four cameras, 0.5-30 s after
  opening, triple presses, back/fwd/live/pause mixes, a 55 s pause past the timeshift cap) all
  landed exactly (-0.03..+0.04 s) except the Talk case above; once a backfill delivered
  nothing and the press fell back after 12 s (hence the 4 s reconnect). Test recipe:
  override `player._log` to capture steps, drive `_liveSkipBack`/`_skipBack`/`_skipFwd`/
  card `_onLive`, wait for `_settled && !video.seeking`, compare `_lastWall` before/after, and
  sample `currentTime` for stalls. The relay logs refusals at DEBUG — at WARNING they filled
  the HA log.
- **A SourceBuffer takes ONE stream at a time - interleaving two drops video (2026-10-26).**
  After an append from another stream (a decode-timestamp jump), MSE sets "need random access
  point" and DROPS every following video frame until a keyframe; re-appending an init does the
  same. Live fragments are 133 ms with keyframes every 5 s (anywhere in a fragment), so a
  backfill appended between live fragments made live lose up to 5 s of video - and Chrome
  still reported ONE continuous buffered range (it starts the new coded frame group at the
  first ACCEPTED frame - an audio frame, all of which are keyframes - so the hole is
  invisible in `buffered`): live froze on the last frame, and seeks into that footage
  "landed" without ever drawing (the hangs of dev41). Measured by wrapping `appendBuffer` /
  `remove` and logging `buffered` at every updateend. So `_planBackfillAppend` appends the
  backfill only while the playhead/target is behind the live GOP being built (never while
  following live), as one uninterruptible sequence (`_bfOps`, run before `_ops`): remove the
  current live GOP from its keyframe, append the backfill (each NVR playback fragment is one
  whole GOP from its keyframe), then the live GOP again from its keyframe's fragment
  (`_liveGop`, kept at append time) - live continues seamlessly. The fragment reaching into
  the session goes in with `appendWindowEnd` = the session's first keyframe (`_liveKey0`), so
  it never overwrites live frames (which would orphan the live frames after it). Both streams
  carry per-sample durations (tfhd 0x20008, trun 0xf01), so the inits' differing trex
  defaults don't matter. Any future "second stream into the same buffer" must follow the
  same rule: switch only at keyframes on BOTH sides.
- **A seek before the init segment is LOST** (currentTime resets to 0): `_tick` re-applies the
  target. **MediaSource duration only grows with appends** — a seek past it is CLAMPED to the
  buffered end and hangs `seeking`: keep `ms.duration` a day past now (`_extendDuration`).
- **WebKit: append the init segment ALONE first.** A SourceBuffer gets 5% of its budget until a
  video track exists, so init + media in one append threw QuotaExceeded on the iPhone ("it
  doesn't even start"). iOS budget ~105 MB per SourceBuffer.
- **Headless Chrome (software decode) STALLS on a backward seek** that must decode from a keyframe
  seconds back (plain MSE, any resolution). Recovery after 1.2 s: seek to the keyframe, then
  forward (`_recoverSeek`, keyframes from trun flags). Real devices did direct backward seeks in
  0.5-1 s; the recovery is only a fallback — don't "fix" device behaviour from headless results.
- **aiohttp's `WebSocketResponse` deflates by DEFAULT.** The relay passes `compress=False`: with
  it on, every video frame went through zlib in HA's executor (44.7% of a core at full playback
  speed) and a browser leaving mid-send logged "exception in shielded future ...
  ClientConnectionResetError".
- **A playback socket is never closed by the NVR when its range is done** — the scrub job treats
  1.5 s of silence as the end. The relay instead relies on the card's flow control and windows.
- **The scrub job's cursor follows ARRIVED keyframes, never the requested end.** Accepting the
  requested end near live filled not-yet-written slots with the previous photo FOREVER (sheets
  are immutable). Only an empty range that ended >60 s ago is a gap.
- **These cameras record `always`, not `adaptive`** (`select.*_recording_mode`, all three).
  So there is no cheap 640x360 idle tier — idle costs the same ~50 MB/min as event footage.
  Re-check before relying on either behaviour.
- **A merged display event can be long** (`groupBands`, `event_merge_gap_seconds`: 43 garden
  events over 37m56s on 2026-09-19; 30 s gap → 23m50s, 15 s → 19m38s — the activity genuinely is
  continuous). The single player streams it like any footage; the old clip pipeline needed 35 s
  and 1.3 GB to export it, which is what made HA crawl when the user retapped.
- **uiprotect calls the NVR with `timeout=0`** — any timeout has to be ours (`CONNECT_TIMEOUT_S`).
- **uiprotect 23 (HA 2026.10) removed `ProtectApiClient.get_events()`.** protect_thumbs.py's
  `_fetch_events` builds the same Event objects from `get_events_raw()` +
  `create_from_unifi_dict` (falls back to `get_events()` on an older uiprotect). After any HA
  update, check the events sync first — it failed every minute for 6.5 h before anyone noticed.
- **Talk (2026-10-21): browser mic -> `protect_cache/talk.py` -> the camera's speaker.** HA has no
  live UniFi talkback (the speaker entity only plays files/TTS); go2rtc's `unifi-talkback` is an
  unmerged PR. Shown only on LIVE for cameras whose device has a unifiprotect `media_player`
  (`talk.ts cameraCanTalk`; Protect `featureFlags.hasSpeaker` — only the doorbell here). Card:
  AudioWorklet -> 20 ms s16 frames -> signed `/api/protect_talk/ws`; AudioContext made inside the
  tap (iOS); needs a secure origin (https or localhost). Server: Protect public
  `talkback-session` (G6 Entry: Opus 24 kHz mono, `rtp://<camera>:7004`), encoded IN PROCESS with
  PyAV in a thread — an FFmpeg subprocess queued ~85 ms blocks (raw PCM) or took 0.7 s to start
  (WAV); PyAV = 21 ms PCM->RTP, evenly paced. Opus 20 ms frames: the G6 Entry plays nothing in
  10 ms frames. One talker per camera, 300 s cap, 15 s no-audio cutoff, backlog capped at 200 ms.
  **ECHO = CHANNEL (2026-10-25): the G6 Entry echo-cancels ONLY its channel 1 audio.** Channels 0
  and 2 carry the talker's words back ~0.5 s later, ~30 dB over the street noise, on EVERY talk
  path (ours and the Protect app's WebRTC alike); channel 1 keeps the ambient and drops the words
  (relay recordings of all three channels in the same seconds, TTS through the talk path). The
  Protect app switches its player to channel 1 ("Auto") while talking — so does the card:
  media-view `TALK_LIVE_CHANNEL` -> `NvrPlayer.setLiveChannel(1)` + `live()`, into the SAME
  buffer (wall-clock timeline; changeType avc1.4d0032 -> avc1.4d001f; 0.9 s to playing, frame
  stays), reset to channel 0 by the next `_startLive` or by leaving live (`_playRecorded` -
  see the NVR-edge gotcha's TALK note); recordings are always channel 0. Field
  data that found it: Mac telemetry (mic level per 20 ms) vs the doorbell's channel-0 recording =
  every word at +0.44-0.47 s. An earlier conclusion "the doorbell gates its mic" came from a test
  that recorded channel 1. Test with `protect_cache.talk_test` (tone) and ears. Headless test:
  a secure origin (localhost forwarder to the HA pod — see the memory on HA's pod network) + a
  fake getUserMedia + a TRUSTED click (devtools `click` by uid).
  **Latency (measured 2026-10-22, the OTHER cameras' mics as acoustic witnesses — garage hears the
  doorbell at ~23 dB SNR; 300 ms 1500 Hz beep every 2 s through one 12 s session; matched filter):
  ~0.8 s to the speaker is the doorbell's FLOOR.** The Protect app's own talk (WebRTC: local
  signaling `wss://<console>/api/ws/webrtc/local`, data-channel API `api:<n>` in binme frames,
  `/proxy/protect/api/tcp/livestream` + `/proxy/protect/api/tcp/talkback`, mic on the live
  track's sendrecv audio transceiver — rebuilt as a proof of concept with aiortc) measured
  0.77-0.82 s; precisely paced RTP straight to :7004 0.80-0.83 s; the old forward-on-arrival
  encoder crept 0.84 -> 1.00 s within 10 s (uneven arrival makes the doorbell grow its buffer).
  So encoding + sending live in `talk_sender.py`, ONE PROCESS PER SESSION (`python3 -I`, PCM over
  stdin, "ready" in ~60 ms): a steady 20 ms clock, `JITTER_FRAMES` 80 ms held, silence when
  nothing arrived, backlog past `JITTER+SLACK` dropped. It must be a process: the same clock as a
  thread inside HA sent packets 0.4-81 ms apart (tcpdump; HA's interpreter lock) and played
  0.94-1.01 s; the process sends 19-21 ms apart and plays 0.88-0.93 s vs 0.80-0.81 s for an
  ideal sender in the same run (the rest is the 80 ms allowance). Compare paths only WITHIN one
  run: the witness cameras' clocks wander ~0.1 s between runs. WebRTC is NOT worth adding: no
  latency gain, the same mic gate, and aiortc pins PyAV < 17 (HA ships 19). The other half of a
  conversation is the live view: plain live sat ~0.6 s behind, drifted ~5 ms/s later and never
  recovered a stall until `LIVE_MAX_LAG_S`; from Talk until the live session ends,
  `NvrPlayer.setLowLatency` holds `TALK_TARGET_S` 0.45 s of buffer (~0.6 s behind; 1.1x catch-up,
  jump past 1 s). 0.3 s stalled: footage arrives every ~133 ms but up to ~0.4-0.5 s apart. It
  stays on after Stop because closing the mic stalls the live sound (~0.8 s in Chrome).
- **Phone fullscreen stays UPRIGHT for portrait footage (2026-10-21; the media view's own
  <dialog> fullscreen, which the card no longer drives since the 2026-10-27 phone camera
  screen - the same rule now lives in card.ts `_phoneTurned`).** `_rotateForFs` skips the
  90° CSS rotation when the footage (`_footageSize`: entity width/height, else the video) is
  taller than wide; the dialog gets `upright` instead of `rotate`. The mirrored overlay ruler then
  runs down the right screen edge, so the card uses a slimmer lane (`_fsUpright`:
  `FS_UPRIGHT_*` width/gutter/scrim, thumbs 72/84), the control bar is ONE full-width row
  (no `.fs-inset`) and the strip ends above it (`--upc-fs-ctrl-h`, ResizeObserver,
  `_syncUprightCtrl`). Phone-only by construction: the tablet uses element fullscreen and never
  renders the dialog. Pill clamp (`_pillW`) is measured only on overlays < 400 px wide — a layout
  read per scrub frame elsewhere would undo PERF-SCRUB.
- **Scrub tiles are ALWAYS 640x360, whatever the camera's shape.** scrub.py `scale=640:360`
  squeezes a portrait 1920x2560 doorbell into 16:9. The card restores it: `_spriteSize` gives the
  sprite canvas the footage's aspect (camera entity `width`/`height`, else the player's video) and
  draws the tile stretched back, so `object-fit: contain` frames it exactly like the `<video>`
  (measured: doorbell canvas 640x853 → 634.7x846 on screen vs live 634.5x846; garden stays
  640x360). Don't "fix" it server-side with padding — a padded 16:9 tile is contained smaller
  than the portrait video.
- **Footage gaps come ONLY from the scrub job's keyframes (2026-10-21).** scrub.py records every
  stretch with no keyframe (> `GAP_MIN_MS` and > `GAP_IV_FACTOR` x the camera's interval) and
  publishes `gaps` in index.json; the card just draws them. Both earlier sources were wrong:
  (1) the camera entity's `unavailable` history — a hung console stopped recording at 22:43:06
  while the entities stayed `recording` until 22:48:01, and an HA restart greys footage that
  exists; (2) asking the NVR for a still inside a suspected gap — `recording-snapshot` answers 200
  with the nearest EARLIER frame (asked 22:48:30, got 22:43:06) and ignores `h=`/`w=`, so it
  "proves" footage inside every gap. Worse, re-probing on every pan sent ~230 full-size snapshots
  in 2 min (~100 in flight) and hung the whole UDM SE (Protect, Network, DNS) for 7 min. Never
  call the NVR per pan/scrub from the card. An NVR error must never become a gap: a failed pull
  leaves the cursor where it was. `protect_cache.scrub_rescan_gaps` rebuilds a window (≤ 1 h)
  from keyframe times only.
  **Older footage + where it begins (2026-10-30).** Footage older than the photos' window is
  mapped once from the NVR's OWN record - `GET cameras/<id>/playback-history?start&end&resolution`
  (0 = full quality, 2 = the low-quality copy; ms, end null while recording; ~70 segments a day,
  metadata only; the call the Protect web app draws its gaps from) - a day per camera per pass
  back to the camera's `stats.video.recording_start` (bootstrap, no NVR call), then the gaps are
  kept as long as the NVR keeps the footage (`gaps_since`, state `gaps_from`, `gap_record`).
  index.json carries `recording_start` (+ `_lq`); the card's `scrubIndexGaps` makes everything
  before it a gap from 0 (`footageStart`). NEVER map by sampling keyframes
  (`withIdrs&idrFrequency=900000`): the NVR delivers them seconds apart (~3 h of footage a
  minute) and a pause past `STREAM_IDLE_S` read as "no footage" - it marked whole days of
  continuous footage as gaps (first version, fixed the same day; `gap_record` 2 dropped them).
  The playable range is the FULL-QUALITY one: channel 0 refuses a start before
  `recording_start`; the low-quality hours the UniFi app shows before it (3-7 h here) stream on
  channel 2 (640x360, avc1.4d001e) - not wired into the player (user declined, 2026-10-30). The doorbell
  recorded HEVC (`hev1`) until 2026-10-20 evening: the player fails it where the browser can't
  decode HEVC (headless Chrome), plays where it can.
  **Deleted on the NVR = deleted here (2026-10-31, user formatted the NVR + deleted all events:
  978 clips, 9.5k thumbnails and 18 GB of photos lingered).** Neither cache re-read old data.
  Events (`protect_thumbs.py`): every sync drops events that ENDED before the camera's
  `recording_start` (no NVR call - user's choice: format/new disk/retention clear at once); the
  first sync after the file loads (HA start, `pyscript.reload`) re-reads the whole LOOKBACK window
  and REPLACES the list (`_FULL_READ_DONE`) - events deleted in the UniFi app go then; a thumbnail
  lives exactly as long as its event is listed (`RETENTION_DAYS` 90 is gone; `_purge_unlisted`
  hourly + on a full read). Photos (`scrub.py`): `_confirm_gone` asks playback-history once when
  `recording_start` moves into the photos' window (>= `GONE_RECHECK_MS` past `gone_asked`) and
  only an answer with NO footage before it sets `gone_before`, which `_purge` deletes up to
  (blocks/hours that END by then) - the bootstrap's word alone could wipe photos that can't be
  pulled again. A 7-day playback-history span works (verified).

- **Canvas `ctx.font` cannot use CSS `var()`** — it silently fails and the font stays default.
  Resolve the family with `getComputedStyle(this).fontFamily` and use a concrete `${px}` size.
- **Canvas sizing flash:** resize the backing store and `_draw()` **synchronously** (not via rAF)
  and skip zero-size measurements, or text flashes the wrong size while layout settles.
- **`<ha-camera-stream>` fights you** (only the multi page's live grid uses it since 3.0): don't
  try to pause/mute it to "keep it alive" — it re-asserts autoplay every render (CPU + audio
  bleed). Unmount it.
- **rAF-driven loops must call `_draw()` synchronously** (momentum glide, zoom animation): a loop
  that panned via `_setDomain` → `_scheduleDraw` left the canvas FROZEN for the whole glide,
  because the loop's own next-frame scheduling kept cancelling the pending draw callback before
  it ran. Pointer-event-driven panning is unaffected (events fire outside the rAF phase).
- **Height changes preserve the time SCALE, not the time window:** `_resize` rescales the visible
  span by `newHeight / oldHeight` (same ms-per-px; the timeline clips instead of squeezing) —
  needed because the camera strip opening shrinks the column. Gated by a 500ms settle window
  after `_setup()` so transient mid-layout heights can't corrupt the configured initial zoom.
  `domainForPlayhead` clamps to WIDE hard bounds (1min–6h), not the zoom UI's 4–128min, so these
  scaled spans survive the live tick's re-pinning.
- **`:host { display: block }` is load-bearing:** custom elements default to `display: inline`,
  and ResizeObserver reports width 0 for inline boxes — which silently wedges `layout: auto`
  in stacked mode. (It went unnoticed for months because the mobile view's `position: fixed`
  card_mod blockified the host as a side effect.)
- **Vite:** `define: { 'process.env.NODE_ENV': '"production"' }` is required (the bundle references
  it; `process` is undefined in browsers → the module fails to load). Legacy decorators are pinned
  via `esbuild.tsconfigRaw`. Production build has no sourcemap.
- **Any file the card maps onto a time range must carry that range in its NAME.** The scrub
  preview seeks proportionally: `frac = (t - b.start) / (b.end - b.start)` against a range read
  from a *separately cached* `index.json`. The head block used to be one `head.mp4` rewritten
  every minute, so a ≤60 s-stale index applied an old range to new bytes — and because
  `SAFETY_LAG_S` delays `head_start` past each 10-min boundary, that file shrinks from ~620 s of
  coverage to ~50 s and jumps a whole block at every `xx:x1:00` run. Result: a preview frame up to
  ~9 minutes from its own label, only ever near live (completed blocks are named `<start>.mp4` and
  were always fine). Fixed by naming it `h<start>-<end>.mp4`. Same trap applies to any future
  re-made artefact — scrub.py's head sidecars and partial sheets carry `h<start>-<end>` too, and a
  sheet is never rewritten under the same name.
- **`upc-live-grid` can be hidden without disconnecting.** Bubble popups and cached views use
  `display:none`; removing a video later does not stop its pipeline. The grid's IntersectionObserver
  calls `releaseVideosIn()` BEFORE rendering streams out, then remounts fresh players when visible.
- **Anything cached off `cameraId` must be reset when `cameraId` changes.** In 2.x a latched
  held-frame poster kept the FIRST camera's still for the life of the card, so every hold that
  couldn't copy its frame flashed the OLD camera's picture (`BUGFIX-POSTER-2026-08-04`). The 3.0
  hold frame is canvas-only, but `willUpdate` still releases it (`_releaseFrame()`) on a new
  event/camera — keep that. Hardware decoders often can't be drawn to a canvas; headless
  Chromium software-decodes and copies happily — force that path with `_looksBlack = () => true`.
- **Don't grep the minified bundle** to verify a fix — build with `--minify false` if you must.
- **Never walk a full directory listing in pyscript.** pyscript AST-interprets every iteration:
  the old scrub job's name-classification loops over ~24k files per camera pinned the HA event
  loop at 88-96% of a core for 15-20 s of every minute (2026-09-21), while native Python does the
  same scan in 24 ms. Hand the listing to C (`set(map(int, re.findall(...)))`, `fnmatch.filter`)
  and walk only the matches — or, as 3.0 did for the scrub job, don't write it in pyscript at all.
  pyscript has no generator expressions.
- **The per-minute cron is the RECONCILER; triggers are for latency.** `protect_thumbs_sync`
  re-queries the NVR window and rebuilds the manifest unconditionally, which is what makes a
  missed edge, a revised event, a restart mid-burst, the manifest trim and the hourly purge all
  self-heal with no special cases — at 0.28 s of CPU per run (0.47% of a core). Motion
  `@state_trigger` + a backoff follower then puts a new event in the manifest ~1 s after it
  happens instead of up to 60 s. Keep both: the follower is a pure optimisation, which is
  precisely why resolving the motion sensors by naming convention is safe.
- **The once-a-minute run may come from Home Assistant, not the cron.** With
  `unifi_protect_schedule: false` the built-in `@time_trigger` no-ops and an HA script calls
  `pyscript.protect_thumbs_sync`, turning a returned `ok: false` into a failed run — the
  only way a failure is recorded anywhere, because pyscript catches every exception raised in a run
  and only logs it. So the syncs must RETURN their outcome, never rely on raising. Overlap is
  prevented by a module-level `_RUNNING` guard that returns ok + `skipped`, NOT
  `task.unique(kill_me=True)`: that cancels the new call, and a calling script records the
  cancellation as a broken run. The motion follower calls `_run()` directly for the same reason.
  **After a restart (2026-10-06):** the HA automation's first minute tick came 8 s after start,
  before pyscript had loaded the files, so the scripts died with `ServiceNotFound` — which
  `continue_on_error` explicitly refuses to cover. The automation now holds off 3 minutes
  (`now() - as_datetime(this.last_changed)`: the automation's state is created at startup and on
  its own reload; in `this` the timestamp is a STRING — without `as_datetime` the condition
  errors on every tick, which a trace shows as `failed_conditions`, i.e. looks like a hold), and
  the jobs treat a missing uiprotect client within `STARTUP_GRACE_S` (180 s) of the
  file loading as skipped-ok, not failed.
  **And never import uiprotect at module top (2026-10-08).** At a start pyscript can load the file
  while the UniFi Protect integration is importing uiprotect in a worker thread; the top-level
  `from uiprotect.data import EventType` then got a half-initialised `uiprotect.data` ("partially
  initialized module … has no attribute 'EventType'"), the FILE failed to load, and pyscript never
  retries it - the action stayed missing until a reload, not just for three minutes. Import it
  inside the function that needs it (`_event_types()`); only stdlib / HA core at module level.
- **Detach/re-attach and hide/show must each leave the stage PLAYING (fixed 2026-09-23).** HA
  detaches cached views and Bubble hides popups with `display:none`; four separate ways the
  picture used to freeze there, all reproduced before fixing:
  1. media-view's `disconnectedCallback` tears every player down, but nothing about its
     properties changes, so `updated()` never rebuilt it — and the MULTI page, unlike the
     single-camera card, deliberately keeps its drilled-in state across a re-attach (card.ts
     `connectedCallback` skips `_resetToLive` for `_isMulti`). Now `connectedCallback` sets
     `_reattached` and `updated()` rebuilds, resuming at `_resumeAt` (the frame that was on
     screen), not at the originally tapped time.
  2. The card's `disconnectedCallback` DISCARDED a pending scrub-settle commit, and the
     scrubber's cancelled its glide without closing the session → `scrubbing` stuck true, stage
     parked on the preview tile. The card now runs `_pendingScrubCommit`; the scrubber emits
     `scrub-end` and clears `_pointers`. Every other "supersede the settle" site goes through
     `_cancelSettle()` so a stale commit can never run later.
  3. Hiding paused recorded footage and `_resumeAfterVisible` only resumed LIVE. It now resumes
     whatever was playing (`_resumeOnShow`).
  4. The stacked-layout player `<dialog>` was opened once in `firstUpdated`; a card that becomes
     stacked AFTER its first render (every `layout: auto` card) got it closed — `display:none`,
     no picture at all. `updated()` now re-asserts `open`.
- **A stale pointer makes the timeline ignore EVERY tap.** `_onPointerUp` treats a release while
  2+ pointers are tracked as the end of a pinch and returns — so one pointer whose release never
  arrived (capture lost, element detached mid-press) turns every later tap into the "second
  finger" and swallows it. A PRIMARY `pointerdown` now clears the map (a primary pointer means no
  other is active), and `lostpointercapture` is handled as a cancel — never as a tap, which would
  seek to whatever thumbnail is under it.
- **A tap on the fullscreen timeline must not be a scrub (fixed 2026-09-30).** The overlay covers
  the whole player, so every show/hide-controls tap lands on the scrubber. Sub-threshold motion
  used to pan the domain and emit `scrub`, so a finger's jitter on a tap left LIVE (2K player torn
  down, preview videos, a recorded chunk prepared) — part of what crashed the wall tablet's
  WebView. Now nothing moves before `TOUCH_SLOP_PX` (4, user-tuned) / `MOUSE_SLOP_PX` (3), and once crossed the
  domain CATCHES UP to the finger from the press point. Do NOT re-anchor at the crossing: a 10 px
  slop with re-anchoring (2026-09-30) left the timeline trailing the finger and the user felt it
  as an artificial delay at the start of every drag (measured after: 4 px moves 0, a 20 px drag
  moves 20.0 px).
- **Tap-to-toggle the controls is ONE detector on the host, in the CAPTURE phase (2026-10-02).**
  `_onPressCapture`/`_onReleaseCapture` qualify a tap from press + release (≤ `TAP_SLOP_PX` 4,
  ≤ 600 ms, press not on a control: buttons, `.vseek`, `.evt-wrap`, the timeline's zoom/live
  buttons — the control bar's EMPTY gradient is not a control), then the tap WAITS for its click
  (`_pendingTap`, 350 ms fallback): a click on a control cancels the toggle, anything else commits
  it. Why the click decides: a touch's press is reported at the fingertip's exact centre, but the
  browser ADJUSTS a touch's click to the nearest button — a finger a few px off the
  exit-fullscreen button hid the controls (press = video) and then exited (click = button):
  "controls disappear, then fullscreen exits, not always". Headless Chromium does NOT do touch
  adjustment even with finger-sized CDP touches — model it by redirecting the trusted click to
  the button (reproduced 6/6 on the old code, 0/6 after). It replaced four paths (stage click,
  strip `tap-through`, strip-padding click, show-on-pointerdown in the strip) that disagreed: the
  tap's `click` arrives AFTER the release, by when hiding had removed the strip, so it fell
  through to the video whose click handler showed the controls again — "flash off and on,
  impossible to hide". Hover-reveal only for `pointerType === 'mouse'`. Hidden controls are not
  hit-testable (`.vctrl.fs-inset.show > *` opts children in), so a show at click time cannot
  press a button that appears under the finger. Drags starting in the strip's PADDING (gutter
  right of the ruler, bands above/below) are handed to the timeline via `beginDrag(e)`
  (`_onStripPress`; `.fs-tl` needs `touch-action: none`). Verify with REAL touch (`page.touchscreen.tap` via
  puppeteer-core from the chrome-devtools plugin's node_modules — it makes the browser's own late
  click; synthetic PointerEvents don't). Phone fullscreen is the player rotated 90° cw: player
  (px,py) -> screen (390-py, px), so its control bar runs down the screen's LEFT edge.
- **Hidden = released, not paused (fixed 2026-09-30).** Pausing kept decoders and network alive.
  media-view `_suspend()`s after 3 s hidden (IntersectionObserver OR `document.hidden`): the
  player's socket and MediaSource are dropped with `_resumeAt` kept; showing again rebuilds via
  `_reattached` (a paused recording stays paused on the same frame).
- **A failure budget must only reset on real playback.** In 2.x it reset when a chunk became
  READY, so a chunk that loaded and then errored refilled forever: the wall tablet re-fetched the
  same 11 MB every 44 s for 2.5 h (2.2 GB, seen in the HAProxy log). The player's budget
  (`RETRY_DELAYS_MS`) resets only on presented frames.
- **Diagnosing the wall tablet: read the HAProxy log** (`podman logs haproxy-pod-haproxy`, client
  192.168.1.76). A renderer crash shows as the whole frontend re-downloading (`app.*.js`,
  `/dashboard-clock2`); what it fetched just before is the evidence. Bubble closes a popup by
  DISCONNECTING its card in Chromium (verified) — hidden-but-connected is views/other hosts.

- **`_checkStage` is media-view's last line of defence** for recorded playback the player
  considers settled: a video paused or stalled behind the card's back gets a `play()` nudge after
  2.5 s and a restart from the frame on screen after 6 s; user pause, tap-to-play, the live-edge
  wait, loading, scrubbing, hidden and the event bound are all excluded (a user Pause held 10 s is
  left alone).

## Decoder-free sprite preview — `SPRITE-PREVIEW-2026-08-04`

Since 3.0 the photos are the ONLY preview tier and `protect_cache/scrub.py` makes them straight
from keyframes (see Architecture); the card always paints sprites (`scrub_preview_mode` and the
`scrub_tip` video tier were removed — the video code paths in media-view only still play the
pre-3.0 cache's mp4 units until they age out). The history below explains the format choices and
the card-side behaviour, which are unchanged.

**Why.** Measured on the Lenovo Idea Tab (Mali-G57) with `www/scrub-bench/index.html`: an MP4
seek costs **99 ms** there (p90 122) vs 10 ms on a MacBook-class device, and a fresh `<video>`
costs another **~198 ms** of decoder start-up. That caps the scrub preview at ~10 updates/sec —
a ceiling no amount of JavaScript tuning can move, which is why `PERF-SCRUB-2026-08-03` (which
was real, ~4x less JS) changed nothing on that device. Drawing a sprite tile on the *same* GPU
costs **0.53 ms**, ~190x cheaper than a seek. Its CPU is only 5.5x slower than the dev box, so
this is specifically the hardware video decoder, not general slowness.

**Stage 1 (2026-08, retired in 3.0): `pyscript/protect_scrub.py` published JPEG mosaics** cut
from its timelapse mp4s.
- `<stem>.s<i>.jpg` sheets + a `<stem>.sprite.json` sidecar, for fine blocks and overview hours.
  NOT for head/tip — the head is re-exported every minute, so sheets for it would cost ~11 files
  a minute per camera; near-live scrubbing stays on the video path.
- Built with ffmpeg from the **already-cached mp4** — no NVR call, no network, ~0.28 s per unit.
- The sidecar is written LAST and is the only completeness marker, so an interrupted run leaves
  orphan .jpg files the next run overwrites (the render is deterministic).
- `index.json` gains `sprite_meta`, `sprites`, `osprites` — all additive; a card that doesn't
  know them ignores them and uses the mp4 tiers exactly as before.
- **Time → tile**: `tile = floor(frac * count)`, `sheet = tile // (cols*rows) + 1`,
  `pos = tile % (cols*rows)`. `count` is per-unit (varies!) and lives in the sidecar, which is
  why the sidecar exists at all. Verified by SSIM sweep: the peak lands exactly on the expected
  tile with clean falloff either side.

**Format choices are measurements from that device, not preferences.** JPEG over WebP (decode
55 vs 108 ms, draw 0.53 vs 0.86 ms, only ~9% more bytes). Sheets must stay at/under ~2560x1440:
the same tiles in 5120x2880 sheets drew at 1.30 ms instead of 0.53 ms *even at MAX_TEXTURE_SIZE
8192*, and 4096 is a common mobile cap past which the upload can fail. Today: 640x360 tiles in a
4x4 grid = 2560x1440 (the tile MUST be 640x360 — a smaller tile is magnified more and the
burnt-in clock visibly changes size when a drag crosses tiers). Keep `COLS*TILE_W` and
`ROWS*TILE_H` at or under 2560x1440.

**Cost (3.0).** JPEG 60 ≈ 15 KB a photo at night; ~4 GB per camera for 7 days projected. Quality
does not change CPU (60 encodes slightly faster than 70); the cost is decoding the keyframe.

**Stage 2: the card paints from sheets.** (The `scrub_preview_mode: auto|sprites|video` switch it
introduced is gone since 3.0 — sprites always.)
- One `<canvas class="sprite">` replaces the two leap-frogging `<video>`s while scrubbing. No
  leap-frogging is needed — a tile draw is instant and cannot flash black, so there is nothing to
  hide behind a standby element.
- `auto` measures the preview's OWN `seeking`→`seeked` latency (median of >=5 samples, switch
  above 40 ms, one-way). Never sniff: that tablet reports a desktop Linux UA, so a platform check
  fails on the exact device this is for, while a Mac/iPhone measures ~10 ms and can never trip it.
- Units with no sheets (head/tip, or anything the sync job hasn't reached) return false from
  `_drawSprite` and fall through to the video tiers, so near-live scrubbing is unchanged.
- `_prefetchUnit` / `_unitReady` make prefetching and the coarse/fine tier choice mode-aware.
  Without them sprite mode still downloaded every ~490 KB mp4 it flew over — bytes that can never
  reach the screen.
- **A late-arriving sheet must be RE-TARGETED, never discarded.** `_drawSprite` first bumped a
  per-draw token and bailed if it had been superseded while the sheet downloaded. During a
  CONTINUOUS gesture — a wheel scrub especially, where events never pause — every fetch was
  superseded before it landed, so the canvas froze on one frame until the gesture ended
  (reported as "stuck on some image, doesn't advance until I release", ~6.5 min adrift). Now it
  redraws the tile in that sheet nearest wherever the playhead has reached, gated by "only if
  closer to the wanted time than what is already shown" so an out-of-order arrival can't drag
  the preview backwards. Measured after: wheel scrub lag p50 1.3 s / p90 3.4 s, 39 of 40 samples
  painting a fresh frame. `_spriteToken` still exists but is bumped ONLY on a camera change.
- **The canvas MUST be hidden again when a unit has no sheets.** It sits above the preview
  `<video>`s and is opaque, so once sprites had painted even once it stayed pinned over the
  near-live region — where the head/tip tiers deliberately have no sheets and the *correct*
  footage was rendering invisibly underneath. The newest sprited frame is the end of the last
  COMPLETED block, i.e. 5-10 min behind live, so scrubbing toward live could never improve it:
  reported as "goes to minus 5-6 minutes and never gets closer to LIVE", and only after a
  history scrub, which is why the first scrub down from live always looked fine. `_updatePreview`
  now clears `_spriteReady`/`_spriteShownTime` when `_drawSprite` returns false.
  When testing this, CHECK YOU ACTUALLY REACHED THE HEAD REGION — a scripted drag that looks
  like "return to live" can easily stop 87 min short and then `hasSprites: true` is correct, not
  a bug. Use `card._onLive()` then a small drag back.
- **Holding the frame is a VIDEO-mode optimisation — don't do it in sprite mode.** The coarse
  tier returned `undefined` ("keep the last frame") when the overview unit wasn't in hand, which
  is right when restaging a `<video>` costs ~200 ms but freezes a canvas that could repaint in
  0.5 ms. Sprite mode now returns the coarse unit itself; `_drawSprite` paints it the moment its
  sheet lands. That also fixed the fetch count (97 -> 61 per fast drag), because one overview
  sheet covers ~12.8 min against a fine sheet's 60 s.
- Sheet prefetch width is speed-dependent (`[idx, idx±1]` when slow, `[idx, idx+dir]` when
  sweeping) — warming both ways during a sweep re-pulls what was just left behind.
- MAX_SHEETS is 6 ON PURPOSE: a 2400x1350 bitmap is ~13 MB of RGBA, so a dozen would be ~150 MB,
  exactly the pressure that has blacked out iOS before. Evicted bitmaps are `close()`d.

**Measuring the sprite path is noisy — don't tune on single runs.** "Distinct frames painted"
across repeat runs of the same scripted drag swung 13 / 5 / 3 on code paths that were identical,
because it depends on where the timeline happens to land and on cold-cache timing. Sample the
canvas DURING the gesture, never after (the canvas unmounts when scrubbing ends, so a post-drag
comparison reads null and looks like "never changed" — that cost a false bug report).

Note WebCodecs is NOT available (the frontend is served over plain http, so it isn't a secure
context) — don't design around it.

## Scrub performance work — `PERF-SCRUB-2026-08-03` (released in 2.x)

Three independent changes landed on 2026-08-03 to fix scrubbing being unusable on a low-end
Android tablet (fine on iPhone/MacBook). **Every hunk is tagged `PERF-SCRUB-2026-08-03`** —
`grep -rn "PERF-SCRUB-2026-08-03" src/` lists all of them, and each carries its own
`Revert:` line describing the exact previous code.

**The diagnosis** (measured in headless Chromium at 6x CPU throttle, scripted pointer drag,
`/protect-timeline-test`): a scrub gesture pinned the main thread at **95%**. It is a cliff,
not a gradient — on a fast CPU the preview tracks the finger and recovers in <200 ms; once
the thread saturates the preview loop starves completely, drifting to **~57 minutes** behind
the playhead and only catching up after the finger lifts. Ruled out by measurement: network
(block fetches 13–28 ms), video decode/seek (p50 10–16 ms; the cached blocks are 640x360
H.264 where **every frame is a keyframe** — ideal for scrubbing), and devicePixelRatio.

| 6x throttle, fast drag, mean of 5 runs | before | after |
|---|---|---|
| frames >60 s off the finger | 70% | **15%** |
| worst frame | 83 ms | **27 ms** |
| pointermoves processed per second | 45 | **55** |
| preview seeks delivered | 57 | **106** |
| canvas draw per gesture | 398 ms | **102 ms** |
| root-card Lit updates per gesture | 224 ms | **32 ms** |
| scrubber Lit updates per gesture | 334 ms | **46 ms** |

**PERF-1 — memoised `Intl.DateTimeFormat` (`src/data/fmt.ts`, new).** Constructing one costs
0.15 ms at 6x vs 0.004 ms to `.format()` an existing one. The card built ~2600 per 2.5 s
gesture: one per major tick label per canvas frame, one per frame for the mirror layout's
`measureText`, one per Lit render for the playhead pill, one per *card* render for the date
pill. Canvas *drawing* ops were only 0.3 ms of a 4.8 ms draw — the draw was almost entirely
this. Also applied to `event-strip.ts` / `events-list.ts`, which built one per rendered row.
Trade-off: a Home Assistant language/time-zone change now needs a reload to reach the card.

**PERF-2 — speed-aware preview tier (`media-view.ts`, `data/scrub-preview.ts`).**
`_resolvePlayable` preferred the fine 10-minute unit whenever cached, so a fling restaged the
`<video>` for every block it crossed while staging takes far longer than the ~130 ms the
playhead spends in one — nothing ever got promoted. Now, while the playhead moves faster than
a fine unit can be staged, the hour-long overview tier is shown and the fine unit upgrades the
frame once the drag settles (what the UniFi app does). Thresholds are derived, not tuned:
`blockMs / COARSE_ENTER_MS` is exactly "crossing more than one block per staging interval",
with a separate exit interval for hysteresis. `_updateScrubSpeed` must stay called **once per
retarget from `_updatePreview`** — `_resolvePlayable` runs twice per retarget and sampling
there feeds it a zero-delta second sample. `_warmOverview` also moved above the no-coverage
return, or prefetching stops in the exact case it exists for.

**PERF-3 — memoised thumbnail occlusion pass (`scrubber-timeline.ts`).** `_renderThumbs` runs
on every pointermove and walked every group member each time. The keep test is
`lastKeptY - y < spacing` and y is linear in time, so a pan shifts every y equally and cannot
change a single comparison — the selection depends on zoom/height/spacing only. Cached against
exactly those; positions are still recomputed every render. Verified in-browser: zooming
15→240 min changes the kept set (153→45 thumbs) while a pan leaves it byte-identical.

## Build / test / release

```bash
npm install
npm run typecheck     # tsc --noEmit
npm test              # vitest — pure logic + live transport selection
npm run build         # -> dist/unifi-protect-timeline-card.js (single ESM file)
```

**Release flow (do this on every functional change):**

1. Bump `VERSION` in `src/card.ts` **and** `version` in `package.json` (keep them equal).
2. `npm run build`.
3. Commit `src/` **and** `dist/` (the built file is tracked so HACS can install without building).
4. Tag a release whose tag == the version, attaching the bundle:
   `gh release create vX.Y.Z dist/unifi-protect-timeline-card.js`
5. Locally, the card is loaded as a dashboard *Resource*; bump its `?v=` cache-buster and
   hard-refresh to see changes.

## Conventions

- **`getStubConfig()` and the README config block must list every option** with its real default —
  they are the user-facing documentation. Add new options to both.
- Defaults are **baked into the code** (the `?? <default>` in `render()` and `getStubConfig`) so a
  config that omits an option looks identical to one that sets it to the default.
- Keep changes small and verify in a real browser — most of this card's behavior (HLS, gestures,
  canvas, autoplay policy) only manifests at runtime, not in unit tests.
