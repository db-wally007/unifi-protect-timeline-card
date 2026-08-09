# Reliable Event Clips (2026-08-09)

This document records the isolated bounded-event-clip reliability candidate. It contains no
credentials, signed media URLs, session IDs, or camera stream URLs.

## Git Boundary

- Baseline commit: `e3db1f3c5ab780652453a33cdad521ad055d0426`
- Pre-change branch/tag: `snapshot/pre-reliable-clips-20260809`
- Feature branch: `fix/reliable-event-clips-20260809`
- Initial seek/preparation fix: `88d9554`
- Watchdog/session cleanup: `2fb33a5`
- Watchdog ownership tests: `d388a9a`
- Active-source event isolation: `832f32b`
- Transparent buffering spinner: `f456227`
- Delayed buffering indicator: `19c7719`
- Presented-frame rewind fix: `c42fffd`
- No-rVFC readiness correction: `c0a03cd`
- Final no-rVFC lifecycle review fixes: `689dd86`
- Multi-camera all-event autoplay: `5195095`
- Isolated worktree: `www/unifi-protect-timeline-card-clip-reliability`

## Root Causes And Fixes

- Internal bounded-clip seeks emitted `playback-seek`; the parent rewrote `targetTime`, which the
  reusable single-card media view interpreted as a new clip. Every +15 could therefore destroy the
  current seekable session and export/remux the event again. The parent now glides the ruler without
  feeding an internal seek back as a new playback request.
- Single-card playback inherited the global LIVE/history held frame. That z-index-3 still covered
  the truthful `Preparing clip` overlay and could remain during same-source seeking while audio
  advanced. Bounded clips now release unrelated holds. `Preparing clip` and `Loading clip` remain
  opaque status screens; seek buffering keeps the video visible and reveals only an animated
  accent-colored spinner after a 1.2-second grace period, with no text or black insert.
- Clip video events now include loadeddata/canplay/playing/seeking/seeked/waiting/stalled. A bounded
  watchdog starts immediately when the prepared URL is assigned, even if a WebView emits no events.
  It requires a presented frame through requestVideoFrameCallback where available; older WebViews
  use a ready-state fallback.
- The watchdog performs one pause/reseek/play nudge, then reaches an explicit terminal error after a
  bounded second interval. A pending `play()` promise and repeated media-event storms cannot move
  the deadline. Terminal failure cannot become a new unbounded buffering overlay; Play or a seek is
  an explicit retry.
- A presented rVFC frame at the requested seek target ends buffering immediately even if the
  browser has not yet flipped `seeking` to false. Stale pre-seek frames remain rejected. Trailing
  `seeked`/`canplay`/`playing` events cannot rearm a completed watch, preventing the watchdog from
  rewinding already-playing footage back to the original seek target.
- Without rVFC, a completed seek with current frame data now wins before first-expiry recovery, so
  ready playback is never paused and reseeked just because the initial double-rAF sample was early.
  Explicit retries clear prior terminal errors, and canceled watches release their outstanding
  video-frame callback registration as well as their timeout.
- The no-rVFC readiness shortcut is limited to source loading and explicit seeking. A normal
  `waiting`/`stalled` watch cannot mistake retained `HAVE_CURRENT_DATA` for renewed playback; it
  still receives one bounded recovery attempt and then a terminal failure if no ready event arrives.
- Every media event verifies current element, load token, session ID, and normalized source URL.
  Outgoing videos are forced to NETWORK_EMPTY before replacement, so detached old players cannot
  cancel, pause, error, or delete the new session.
- Multi-camera playback closes and unmounts at natural clip end. Session cleanup is source-scoped;
  a late old-video ended event cannot delete the replacement session.

## Active Installation

- Resource ID: `5eb9580c5c0844319ad12cf76ef286ff`
- Resource URL:
  `/local/unifi-protect-timeline-card-clip-reliability/dist/unifi-protect-timeline-card.js?v=multi-all-camera-autoplay-2e083cc40389`
- Bundle SHA-256 prefix: `2e083cc40389`
- Pyscript remains the restored scrub generator and is unrelated to this clip-only candidate.

## Validation

- Automated tests: 86/86 passed
- TypeScript typecheck: passed
- Production build: passed
- Independent final review: fallback findings corrected; closing re-review found no issues
- Real 137-second single-card event: visible preparation with no held frame; +15 preserved media
  source, session, and parent target; buffering status was visible; playback continued from the
  requested position without re-export
- Eight alternating +/-15 seeks: all recovered with advancing frames in 0.68-1.20 seconds, one
  session/source, no freezes, no preparation restart, and zero new session POSTs
- Slow 4G plus 4x CPU: three rapid seeks recovered at the final requested timestamp in about one
  second; a different event accepted a seek at readyState 1 and presented it in 2.1 seconds
- Intentionally paused seek: requested frame presented, remained paused and time-stable
- Desktop/tablet fullscreen and stacked 390x844 rotated mobile fullscreen: +15 advanced, buffering
  status visible, no stale freeze, no layout overflow, playback recovered
- Multi-camera clip: visible preparation, same-session seeking, close/unmount at natural end
- Forced forever-pending `play()` plus continuous seeking/waiting event storm: terminal error in
  about five seconds, no timer leak, and later events could not reopen buffering
- Replacement clip with twelve injected stale events from the released old video: old video was
  NETWORK_EMPTY/disconnected; replacement session/source/timer/state stayed unchanged and recovered
- Warm seek completed in 379ms with buffering-spinner opacity remaining zero for the entire seek
- Throttled cold seek showed the spinner only after 1.2s; overlay background was fully transparent,
  contained no text, video opacity stayed 1, and both active spinner arcs exactly matched the seek
  fill (`rgb(252, 157, 243)` in the tested card)
- Spinner transform changed between 180ms samples under animation `upc-spin`, confirming it is a
  real rotating CSS indicator rather than a static image
- Before the rewind fix, a target frame was presented at 482ms, but the watcher rejected it solely
  because `seeking` was still true. At 2.5s it paused at 106.85s and reseeked to 104.90s, matching
  the reported visible rewind.
- Final identical Slow 4G/2x trace: buffering cleared in 505ms, spinner never flashed, no watchdog
  pause/play occurred, and no rewind was observed.
- Deterministic delayed-rVFC trace: spinner appeared at 1214ms and cleared at 1542ms on the
  presented target frame; playback advanced from 79.39s to 80.73s with zero watchdog calls and
  zero backward jumps.
- Forced no-rVFC first-expiry trace: the initial readiness sample was deliberately made early;
  current frame data then completed at 2516ms with zero pause/play recovery calls and no live timer.
- Canceling an armed frame watch invoked `cancelVideoFrameCallback` for its registered callback and
  cleared both registration and timeout. A prior terminal error cleared at retry start and remained
  clear after no-rVFC readiness completion.
- Permanently unresolved no-rVFC trace still performed exactly one recovery at 2500ms and reached
  terminal failure at 5017ms with no live timer or callback registration.
- No-rVFC `waiting` injected during an active seek immediately escalated the watch to `stall`; its
  queued ready-state rAF could not finish it. Recovery-generated `seeking` kept the stall reason,
  one recovery ran at 2501ms, and terminal failure followed at 5029ms with no live timer.
- A no-rVFC watch completed by its watchdog advanced the generation before queued rAF work ran.
  Starting a new stall watch and then flushing every old callback left that new watch, reason, and
  timeout intact.
- Multi-camera autoplay advanced from a Garden clip to the immediately newer Garage clip in the
  merged 344-event all-camera list. The collapsed player and expanded event-grid lightbox passed
  on tablet and 390x844 mobile layouts; the newest event stopped autoplay and restored the live grid.
  The chain snapshots that merged order when playback starts, so a manifest refresh cannot skip an
  equal-time cross-camera successor or remove the active row out from under the sequence.
- Native versus prepared Range test: native export ignored `Range` and returned full HTTP 200 with
  `ftyp -> mdat -> moov`; prepared session returned exact HTTP 206 bytes with
  `ftyp -> moov`, proving faststart materialization remains necessary
- Garden, Garage, and Corner prepared files preserve H.264 Main/yuv420p, 2688x1512 at 30fps, plus
  AAC-LC mono at 16kHz. FFmpeg uses stream copy; there is no video/audio re-encode.

## Remux Decision

The current Home Assistant UniFi Protect export proxy is not range-seekable and the native MP4 has
its `moov` index after `mdat`. A browser must receive the entire file before it can start or seek.
The server therefore still needs to materialize the export and run FFmpeg `-c copy -movflags
+faststart`; this moves metadata without changing codec quality. Streaming the rewrite through a
pipe is not viable because both reading the tail-indexed input and writing faststart output require
seekable files.

Export dominates preparation time; measured remux time is roughly 0.3 seconds. Keeping the prepared
session for all seeks is the important speed fix in this candidate. A future server-cache experiment
could reuse a prepared event across separate plays, but requires a custom-component update/restart
and is deliberately not coupled to this client reliability rollout.

## Rollback

1. Restore resource ID `5eb9580c5c0844319ad12cf76ef286ff` to
   `/local/unifi-protect-timeline-card-live-experiment/dist/unifi-protect-timeline-card.js?v=smooth-scrub-speed-d75bf3dd0610`.
2. Open a fresh browser tab or force-quit/reopen the Companion app.

No Pyscript or custom-component rollback/restart is required. The active `protect_cache` component
was not modified.

## Residual Risks

- Real iOS WKWebView sequencing remains the primary platform risk despite throttled mobile browser
  validation and explicit no-event/pending-play injections.
- Session deletion is best-effort; a force-quit can leave a temporary directory until its 30-minute
  sweep. A maximum-duration 30-minute clip has little pause/seek margin before its signed URL expires;
  extending that server-side lifetime should be a separate custom-component change with restart.