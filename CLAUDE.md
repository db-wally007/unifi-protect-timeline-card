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
  carry 4K H.265 without transcoding). It is a **black box that re-asserts its own autoplay**, so:
  it is **unmounted** when you leave live (the only reliable way to stop its decode + audio), and
  remounted + re-unmuted on return. Its play/pause is detected by **polling** the inner `<video>`
  `.paused` (events get missed on remount/slow init) so the card can freeze the playhead when live
  is paused.
- **Historical (bounded event clips).** The export proxy IGNORES `Range:` and the NVR writes the
  MP4 index (`moov`) LAST, so the export can be neither started nor seeked as a stream. It used to
  be downloaded whole into a Blob; at the measured ~52 MB/min of 4K that peaked near 740 MB for a
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
  Segments are CUT at event boundaries (`segmentEndFor`): adaptive recording keeps 4K around
  events and a continuous 640×360 tier between, and the NVR serves ONE tier per export — a
  request overlapping an event comes from the 4K track where idle is just sparse keyframes
  (played it fast-forwards and desyncs the marker). Single-tier segments play real time, so
  `clipStart + currentTime` drives the playhead correctly (`playback-time` event), 4K during
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
- **Don't grep the minified bundle** to verify a fix — build with `--minify false` if you must.

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
