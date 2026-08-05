# CLAUDE.md — working notes for AI agents

Guidance for Claude Code (or any AI agent) continuing work on this card. It captures the
architecture and the **non-obvious decisions** that aren't visible from the code alone, so you can
pick up where the last session left off.

## What this is

`unifi-protect-timeline-card` — a HACS-installable Home Assistant Lovelace card that replicates the
**UniFi Protect** camera UX: a vertical **timeline** scrubber (fixed playhead, drag footage past
it, pinch/wheel zoom, live + historical playback) plus an **events** list (detections newest-first,
grouped by day, with thumbnails). Lit + a `<canvas>` timeline, built with Vite into a single ESM
file. It talks only to Home Assistant's `unifiprotect` integration — there is no direct NVR access.

## Layout

```
src/card.ts               root <unifi-protect-timeline-card>: config, state, orchestration,
                          getStubConfig (the picker defaults — keep in sync with the README),
                          live tick, band/manifest fetching, mode (timeline/list) switching.
src/scrubber-timeline.ts  the <canvas> timeline: ticks, track, event bars, inline thumbnails,
                          playhead/LIVE pill, pointer gestures (drag/pinch/wheel), zoom.
src/media-view.ts         the video pane: live <ha-camera-stream> + streamed historical clips
                          + the scrub preview (cached timelapse blocks/parts).
src/events-list.ts        the events list view (day dividers, lazy thumbnails, infinite scroll).
src/data/thumbnail-loader.ts  shared NVR-safe thumbnail loader (manifest-first, blob cache).
src/data/detections.ts    binary_sensor history -> detection bands (pure, unit-tested).
src/data/time-scale.ts    time<->pixel + pan/zoom math (pure, unit-tested).
src/data/ha-urls.ts       proxy URL builders + auth/sign_path.
src/data/types.ts         CardConfig + shared interfaces.
pyscript/protect_thumbs.py  OPTIONAL server-side event/thumbnail cache (see README).
pyscript/protect_scrub.py   OPTIONAL scrub-preview cache: timelapse blocks + head/tip tiers.
custom_components/protect_cache/  serves both caches from config/.cache/ (NOT www/, so
                          HA backups skip them — Core has no configurable excludes, and a
                          symlink can't work: aiohttp static uses follow_symlinks=False).
                          clip_session.py = the on-demand clip sessions (export -> faststart
                          remux -> Range-served file -> deleted), see "Historical" below.
dist/                     the built bundle — COMMITTED on purpose (HACS installs it directly).
```

## Architecture & data flow

- **Timeline (canvas).** `scrubber-timeline.ts` owns a visible time `domain`; the playhead is fixed
  near the top (`PLAYHEAD_FRAC`). Dragging pans the domain; tap/drag/wheel emit `scrub`/`scrub-end`
  with a time; the card loads footage for that time. Zoom is stepped (`SPAN_STEPS`) with an eased
  animation (`_animDomain`).
- **Live.** Live is HA's `<ha-camera-stream>` (full-quality HLS — *not* WebRTC/go2rtc, which can't
  carry it without transcoding — NOTE: measured 2026-08-04 the stream is H.264 2688x1512
  @30fps 6.9 Mbps, which WebRTC *can* carry natively, so this rationale is stale). It is a **black box that re-asserts its own autoplay**, so:
  it is **unmounted** when you leave live (the only reliable way to stop its decode + audio), and
  remounted + re-unmuted on return. Its play/pause is detected by **polling** the inner `<video>`
  `.paused` (events get missed on remount/slow init) so the card can freeze the playhead when live
  is paused.
- **Historical (bounded event clips).** The export proxy IGNORES `Range:` and the NVR writes the
  MP4 index (`moov`) LAST, so the export can be neither started nor seeked as a stream. It used to
  be downloaded whole into a Blob; at the measured ~52 MB/min of high-res footage that peaked near 740 MB for a
  7-minute event and got the WKWebView content process killed on iOS (the Companion app appeared to
  "jump back to the dashboard" exactly when the download finished). Now the card POSTs
  `/api/protect_clip/session`; `custom_components/protect_cache` exports the range to disk,
  remuxes it with `-c copy -movflags +faststart` (~0.3 s) into a throwaway session directory, and
  serves it via `FileResponse` — real HTTP Range, so `<video>` streams and seeks natively.
  Measured: a 7-min clip prepares in ~9 s and playback pulls **18.5 MB of 332 MB** (5.6%) to play
  the head and seek to 95%. Sessions are deleted when the clip is superseded or the view is torn
  down, and swept after 30 min (a hard page navigation runs no `disconnectedCallback`, so the
  sweep — not the client — is what reaps those). `ffmpeg -f mp4` is REQUIRED: the temp file ends
  in `.tmp` and ffmpeg won't infer a muxer from that.
- **Historical (delayed-follow).** Still Blob-based on purpose — chunks are capped at
  `FOLLOW_MAX_CHUNK_MS` (30 s, ~26 MB) across two leap-frogging `<video>` slots, which was never
  the memory problem, and blobs let them swap without a reload flash.
  Segments are CUT at event boundaries (`segmentEndFor`): adaptive recording keeps high-res (2K) around
  events and a continuous 640×360 tier between, and the NVR serves ONE tier per export — a
  request overlapping an event comes from the high-res track where idle is just sparse keyframes
  (played it fast-forwards and desyncs the marker). Single-tier segments play real time, so
  `clipStart + currentTime` drives the playhead correctly (`playback-time` event), high-res during
  events, low-quality between — UniFi-app parity.
- **Events.** Two sources are unioned: the optional thumbnail-cache **manifest** (exact Protect
  events with local thumbnails, a rolling window) for recent events, plus **binary_sensor history**
  for older ones (back to recorder retention). The list lazy-loads thumbnails via
  IntersectionObserver and auto-loads more until the viewport fills.

## The server-side helpers hold NO install-specific values

`pyscript/*.py` and `custom_components/protect_cache/` are **the deployed files** — a working
install symlinks `/config/pyscript/protect_{thumbs,scrub}.py` and
`/config/custom_components/protect_cache` straight at this checkout, so there is exactly one copy
of each and editing either path edits this repo. Two consequences:

- **Never hardcode a camera id, entity id, config-entry id or NVR address in them.** They are read
  from `UNIFI_PROTECT_CAMERAS` / `UNIFI_PROTECT_ENTRY_ID` in the environment, falling back to
  `unifi_protect_*` under `pyscript:` in `configuration.yaml` (see the fenced *install
  configuration* block, which must stay byte-identical in both pyscript files). This is not just
  hygiene: the checkout lives under `config/www/`, which HA serves **unauthenticated** at
  `/local/...`, so anything written into these files is published.
- **An edit here is live on the next `pyscript.reload`** (or HA restart for `protect_cache`). There
  is no separate deploy step, and no second copy to keep in sync.

## Gotchas (these cost real debugging time — keep them)

- **Canvas `ctx.font` cannot use CSS `var()`** — it silently fails and the font stays default.
  Resolve the family with `getComputedStyle(this).fontFamily` and use a concrete `${px}` size.
- **Canvas sizing flash:** resize the backing store and `_draw()` **synchronously** (not via rAF)
  and skip zero-size measurements, or text flashes the wrong size while layout settles.
- **`<ha-camera-stream>` fights you:** don't try to pause/mute it to "keep it alive" — it re-asserts
  autoplay every render (CPU + audio bleed). Unmount it; poll for pause.
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
  re-exported artefact.
- **`ha-camera-stream` needs `--video-max-height: 100%`, or live is top-aligned AND undersized in
  fullscreen.** Both HA players style their inner `<video>` (in their own shadow root, unreachable
  by our CSS) as `max-height: var(--video-max-height, calc(100vh - 97px))` — the 97px being HA's
  allowance for its own toolbar. Our fullscreen stage IS `100vh`, so the cap binds: the video box
  became 703px inside an 800px stage and, being `display:block`, sat at the TOP, while
  scrub/clip/follow centre via `object-fit: contain`. Measured 1250x703 @ gap 0/97 before,
  1280x720 @ gap 40/40 after. The custom property inherits through the shadow boundary — that is
  the only lever. **Not reproducible outside fullscreen** (the stage is then shorter than the cap),
  so always verify this one with the player actually fullscreen. Same override in `live-grid.ts`.
- **Anything cached off `cameraId` must be reset when `cameraId` changes.** The held-frame
  poster fallback (`_posterWarm`) is latched — `if (this.live && !this._posterWarm)` — because
  `entity_picture` carries a token that changes on every state update, so refreshing it freely
  re-fetches constantly. That latch had no camera-switch reset, so it kept the FIRST camera's
  still for the life of the card, and `_holdFrame` prefers `_posterWarm` over `_posterUrl()`.
  A second latch (`if (!img.getAttribute('src'))`) pinned the `<img class="freeze">` src the
  same way. Result: after switching cameras, every hold that couldn't copy its frame — i.e.
  **every scrub start while live is on screen**, which cannot be drawn to a canvas on
  Apple/Android hardware decoders — flashed the OLD camera's picture. Fixed 2026-08-04, tagged
  `BUGFIX-POSTER-2026-08-04`; `_holdFrame`'s "already holding, nothing better to copy" early
  return needed the same treatment (`_releaseFrame()` on camera change) or a hold captured from
  the old camera survived the switch and got re-armed forever.
  **Not reproducible in headless Chromium**, which software-decodes and copies the frame
  happily — force the path with `_looksBlack = () => true` to test it.
- **Don't grep the minified bundle** to verify a fix — build with `--minify false` if you must.

## Decoder-free sprite preview — `SPRITE-PREVIEW-2026-08-04` (server side DONE, card side TODO)

**Why.** Measured on the Lenovo Idea Tab (Mali-G57) with `www/scrub-bench/index.html`: an MP4
seek costs **99 ms** there (p90 122) vs 10 ms on a MacBook-class device, and a fresh `<video>`
costs another **~198 ms** of decoder start-up. That caps the scrub preview at ~10 updates/sec —
a ceiling no amount of JavaScript tuning can move, which is why `PERF-SCRUB-2026-08-03` (which
was real, ~4x less JS) changed nothing on that device. Drawing a sprite tile on the *same* GPU
costs **0.53 ms**, ~190x cheaper than a seek. Its CPU is only 5.5x slower than the dev box, so
this is specifically the hardware video decoder, not general slowness.

**Stage 1 (done): `pyscript/protect_scrub.py` also publishes JPEG mosaics.** 9 hunks tagged
`SPRITE-PREVIEW-2026-08-04`. Set `SPRITES_ENABLED = False` to switch the whole tier off.
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
8192*, and 4096 is a common mobile cap past which the upload can fail. Hence 480x270 tiles in a
5x5 grid = 2400x1350. Keep `COLS*TILE_W` and `ROWS*TILE_H` under 2560.

**Cost.** ~5.2 MB per unit → **~18 GB** for 3 cameras over the 7-day window (the initial ~11 GB
estimate came from one garden-camera block; the other two cameras' scenes compress worse). Lower
`SPRITE_QUALITY` (6 → 8) for roughly -25% if that ever matters.

**Stage 2 (done): the card paints from sheets.** Config `scrub_preview_mode: auto|sprites|video`
(`scrub_preview` was already taken — it's the feature on/off). **Currently defaulted to
`sprites` on EVERY device, deliberately and temporarily**, so the 480x270 quality can be judged
on a Mac and an iPhone; the intended long-term default is `auto`. Two words to change:
`getStubConfig` in card.ts and the `?? 'sprites'` where the property is passed to the media-view.
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

## Scrub performance work — `PERF-SCRUB-2026-08-03` (UNRELEASED, revertible)

Three independent changes landed on 2026-08-03 to fix scrubbing being unusable on a low-end
Android tablet (fine on iPhone/MacBook). **Every hunk is tagged `PERF-SCRUB-2026-08-03`** —
`grep -rn "PERF-SCRUB-2026-08-03" src/` lists all of them, and each carries its own
`Revert:` line describing the exact previous code.

The tree was clean at `1f7cbd8` when this started and nothing has been committed or
version-bumped since, so **`git checkout -- src/ && npm run build` is a total rollback.**
Locally the dashboard Resource is pinned at `?v=2.0.0-perfscrub2` (was `?v=2.0.0`) — bump or
restore that cache-buster whenever the bundle changes, or the browser keeps the old module.

Riding along in the same uncommitted diff, but **unrelated to the perf work and independently
revertible**: `BUGFIX-POSTER-2026-08-04` (3 hunks in `media-view.ts`) — the stale cross-camera
held-frame poster, see the Gotchas entry below. It is a pre-existing bug, verified present in
`1f7cbd8`; the perf changes touch none of that machinery.

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
npm test              # vitest — pure logic only (time-scale, detections)
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
