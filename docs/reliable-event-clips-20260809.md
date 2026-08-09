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
- Isolated worktree: `www/unifi-protect-timeline-card-clip-reliability`

## Root Causes And Fixes

- Internal bounded-clip seeks emitted `playback-seek`; the parent rewrote `targetTime`, which the
  reusable single-card media view interpreted as a new clip. Every +15 could therefore destroy the
  current seekable session and export/remux the event again. The parent now glides the ruler without
  feeding an internal seek back as a new playback request.
- Single-card playback inherited the global LIVE/history held frame. That z-index-3 still covered
  the truthful `Preparing clip` overlay and could remain during same-source seeking while audio
  advanced. Bounded clips now release unrelated holds and own an opaque status layer:
  `Preparing clip`, `Loading clip`, or `Buffering clip`.
- Clip video events now include loadeddata/canplay/playing/seeking/seeked/waiting/stalled. A bounded
  watchdog starts immediately when the prepared URL is assigned, even if a WebView emits no events.
  It requires a presented frame through requestVideoFrameCallback where available; older WebViews
  use a ready-state fallback.
- The watchdog performs one pause/reseek/play nudge, then reaches an explicit terminal error after a
  bounded second interval. A pending `play()` promise and repeated media-event storms cannot move
  the deadline. Terminal failure cannot become a new unbounded buffering overlay; Play or a seek is
  an explicit retry.
- Every media event verifies current element, load token, session ID, and normalized source URL.
  Outgoing videos are forced to NETWORK_EMPTY before replacement, so detached old players cannot
  cancel, pause, error, or delete the new session.
- Multi-camera playback closes and unmounts at natural clip end. Session cleanup is source-scoped;
  a late old-video ended event cannot delete the replacement session.

## Active Installation

- Resource ID: `5eb9580c5c0844319ad12cf76ef286ff`
- Resource URL:
  `/local/unifi-protect-timeline-card-clip-reliability/dist/unifi-protect-timeline-card.js?v=reliable-clips-f7dd85362237`
- Bundle SHA-256 prefix: `f7dd85362237`
- Pyscript remains the restored scrub generator and is unrelated to this clip-only candidate.

## Validation

- Automated tests: 81/81 passed
- TypeScript typecheck: passed
- Production build: passed
- Independent final review: no critical, high, or medium findings; deployment accepted
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