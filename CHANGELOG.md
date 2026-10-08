# Changelog

## [2.3.2] - 2026-10-08

### Fixed

- After a Home Assistant restart `pyscript.protect_thumbs_sync` could stay missing until pyscript
  was reloaded, so every run of the monitoring script failed with `ServiceNotFound`. pyscript
  loaded `protect_thumbs.py` while the UniFi Protect integration was still importing `uiprotect`,
  and the file's top-level `from uiprotect.data import EventType` got a half-initialised module
  ("partially initialized module 'uiprotect.data' has no attribute 'EventType'"): the file failed
  to load and pyscript does not retry. `uiprotect` is now imported when a sync first runs.

## [2.3.1] - 2026-10-06

### Fixed

- After a Home Assistant restart, a sync that found the UniFi Protect integration not loaded yet
  was reported as a failed run. For the first three minutes after the job files load it is now
  skipped (ok). The monitoring recipe also holds its automation off for three minutes after
  startup: until pyscript has loaded the files the actions do not exist, and a script calling a
  missing action dies with `ServiceNotFound`.

## [2.3.0] - 2026-10-02

### Added

- **The pyscript jobs can be monitored.** `pyscript.protect_thumbs_sync` and
  `pyscript.protect_scrub_sync` now return `{"ok": true, …}` or `{"ok": false, "error": "…"}`.
  With the new `unifi_protect_schedule: false` (or `UNIFI_PROTECT_SCHEDULE=false`) their built-in
  once-a-minute timers are off, so Home Assistant scripts can run them on an automation's schedule
  and record a failed run when one is not ok — see "Monitoring the jobs" in the README. Without the
  setting nothing changes.

### Fixed

- A sync requested while another was running was cancelled rather than skipped
  (`task.unique(kill_me=True)`), which a calling script recorded as a broken run. It now returns
  ok with `skipped`, and the run in flight covers it.

## [2.2.0] - 2026-10-02

### Changed

- Events — merged or not, any length — play on the same chunk engine as continuous footage: a
  fixed grid from the event's start, two-minute chunks prepared in the background, entered
  through a 30-second slice so a start or a seek still shows a picture in about a second. The
  seek bar and the ±15 s buttons are plain seeks on one timeline: inside a loaded chunk they are
  instant, recently played chunks are reused instead of exported again, and the end of an event
  rolls on into what follows without a reload.
- Seek bar: the knob follows the finger and the footage seeks once, on release, then the knob
  stays where it was let go.
- Live: while a camera page is on screen, the high-resolution streams of its cameras are kept
  running on the server (`live_prewarm`, default on; needs `protect_cache`), so LIVE opens in
  about a second instead of waiting for a cold stream's first segment. Nothing extra is sent to
  the browser, and the streams stop 30 s after the page is hidden. A stream kept warm opens
  without the medium bridge.
- A card hidden for 3 s (closed popup, background view, screen off) releases every player and
  download, and resumes where it was when shown again.
- Fullscreen: one tap model for the whole player — a tap anywhere toggles the controls, a tap on a
  button, the seek bar or a thumbnail does not. A drag anywhere on the overlay, including right of
  the ruler and above or below it, scrubs.
- `protect_cache`: sessions are evicted least-recently-used (a session being played is never the
  one evicted), up to 16 at a time.

### Removed

- `merged_playback`, `clip_segment_seconds` and `clip_segment_join_seconds` (events no longer play
  as a playlist). Ignored if present.

### Fixed

- Skip back 15 s inside a merged event moved only to the start of the loaded segment, and dragging
  the seek bar started an export per pointer move, landing on a random point.
- A chunk that loaded and then failed could be re-prepared forever (a wall tablet re-exported one
  chunk every 44 s for hours); the retry budget now resets only on real playback, any one chunk is
  prepared at most four times per run, and failure reports are capped per hour, not per page load.
- Finger jitter on a tap counted as a timeline drag, dropping out of LIVE in fullscreen.
- Fullscreen: the controls could not be hidden over most of the screen (they flashed off and back
  on), and a tap just beside the exit-fullscreen button hid the controls before exiting.
- A freshly started HLS stream could re-download its first segment repeatedly.

## [2.1.1] - 2026-09-29

### Changed

- Multi-camera page, tablet layout: a clip opened from the expanded events grid now scales with
  the space it has — 90% of the popup's binding side, kept 16:9 — instead of stopping at 900 px
  wide, so a full-width popup gets a proportionally larger player. The phone layout is unchanged.

## [2.1.0] - 2026-09-27

### Added

- Merged events play as a playlist of short clips instead of one export of the whole span
  (`merged_playback`, `clip_segment_seconds`, `clip_segment_join_seconds`, `max_clip_seconds`).
  The next segment is prepared before the current one ends, and the seek bar spans the whole event.
- When a clip ends, playback continues into the footage that follows it, in every view.
- Multi-camera page: a clip's fullscreen button opens that camera's fullscreen timeline at the
  moment on screen; leaving fullscreen returns to the same page, scrolled to and highlighting the
  clip that was playing (grid, list and phone carousel).
- A preparation overlay with a Cancel button, and a transparent overlay (no black flash) when
  moving between segments of one event.
- Playback failures are written to the Home Assistant log with the device's user agent (capped per
  page load), so failures on phones can be diagnosed afterwards.
- `protect_thumbs`: motion-triggered event refresh, so new events appear within seconds.

### Changed

- Continuous playback chunks are prepared by the server as clip sessions (index at the front,
  served with HTTP Range) instead of being downloaded whole into the page.
- Scrub preview: one consistent tier — 640x360 atlas tiles at one frame per ~7 s everywhere; the
  newest block is exported from the same recording channel as older footage.
- Live: the medium stream bridges the start of the high-resolution stream and hands over in time
  sync.
- `autoplay_next_event` is removed; continuous rollover replaces it.

### Fixed

- The iPhone app losing its connection to Home Assistant after a clip. On Apple WebKit the card no
  longer deletes finished clip sessions (the server reaps them), never leaves a video in its
  `ended` state, never copies a video frame into a canvas, and holds the clip's last frame during
  the rollover instead of a black screen or a current snapshot.
- A continuous-playback chunk the device could not play was re-downloaded every ~1.3 s forever; it
  now retries with backoff and stops with a message.
- A long merged event no longer asks the NVR for one huge export (a 37-minute row made Home
  Assistant unresponsive).
- Taps ignored after a lost pointer release; scrub mode stuck after the view was detached; playback
  not resuming after a popup was re-shown or a view re-attached; blank video in stacked layout when
  the layout changed after the first render.
- `protect_scrub`: full directory walks replaced with native matching (large CPU reduction); clip
  session builds are bounded, deduplicated and cancellable.

## [2.0.2] - 2026-08-09

### Added

- Reliable, range-seekable bounded event clips backed by faststart MP4 sessions.
- Merged all-camera event autoplay in multi-camera list, grid, and lightbox views.
- Speed-aware compact scrub atlases with latest-target scheduling and fine-frame upgrades.
- Explicit live transport selection and Apple-mobile medium-to-high WebRTC handoff.

### Changed

- Event seeks stay within one prepared clip session instead of exporting the clip again.
- Multi-camera autoplay follows the visible merged event order across camera boundaries and returns
  to the live grid after the newest event.
- Live playback keeps one session-wide mute choice across camera, transport, and player changes.
- Hidden or replaced media players release their network and decoder resources promptly.

### Fixed

- Clip buffering is bounded on WebViews and cannot be reopened by stale media events.
- A presented seek frame clears buffering without a watchdog pause/reseek rewind.
- The delayed buffering spinner remains transparent, appears only after its grace period, and does
  not obscure already-visible footage.
- Fast scrubbing remains responsive without sacrificing fine frames during slow movement.
- Live startup and genuine playback stalls recover without leaving permanent error screens.

### Validation

- 86 automated tests, TypeScript typecheck, and production build passed.
- Browser validation covered desktop/tablet and 390x844 mobile layouts, high-resolution LIVE,
  bounded seeking, delayed spinner behavior, no-rVFC recovery, and cross-camera event autoplay.

No configuration options were removed in this release. Existing 2.0 configurations remain valid.

## [2.0.0] - 2026-07-29

- Initial clean-slate 2.0 release with timeline, events, multi-camera views, scrub cache helpers,
  and range-capable clip sessions.

[2.3.1]: https://github.com/db-wally007/unifi-protect-timeline-card/compare/v2.3.0...v2.3.1
[2.3.0]: https://github.com/db-wally007/unifi-protect-timeline-card/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/db-wally007/unifi-protect-timeline-card/compare/v2.1.1...v2.2.0
[2.1.1]: https://github.com/db-wally007/unifi-protect-timeline-card/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/db-wally007/unifi-protect-timeline-card/compare/v2.0.2...v2.1.0
[2.0.2]: https://github.com/db-wally007/unifi-protect-timeline-card/compare/v2.0.0...v2.0.2
[2.0.0]: https://github.com/db-wally007/unifi-protect-timeline-card/releases/tag/v2.0.0