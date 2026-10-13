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
src/data/types.ts         CardConfig + shared interfaces.
pyscript/protect_thumbs.py  OPTIONAL server-side event/thumbnail cache (see README).
custom_components/protect_cache/  REQUIRED. __init__.py serves both caches from config/.cache/
                          (NOT www/, so HA backups skip them — Core has no configurable excludes,
                          and a symlink can't work: aiohttp static uses follow_symlinks=False);
                          nvr_stream.py = the stream relay (/api/protect_stream/ws);
                          scrub.py = the scrub-preview job (action protect_cache.scrub_sync).
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
  on a keyframe and holds ~1 s behind its edge (`LIVE_TARGET_S`, catches up past 4 s). Failures are
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

- **The NVR REFUSES a playback that starts past its recording edge** (~13-20 s behind now) and
  LIVE has no history. So a rewind into that band lands on the earliest live frame, recorded
  playback that catches the edge waits (`_notRecordedYet`, retried every ~2 s), and the relay logs
  those refusals at DEBUG — at WARNING they filled the HA log.
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
