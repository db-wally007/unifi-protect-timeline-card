# Changelog

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

[2.1.1]: https://github.com/db-wally007/unifi-protect-timeline-card/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/db-wally007/unifi-protect-timeline-card/compare/v2.0.2...v2.1.0
[2.0.2]: https://github.com/db-wally007/unifi-protect-timeline-card/compare/v2.0.0...v2.0.2
[2.0.0]: https://github.com/db-wally007/unifi-protect-timeline-card/releases/tag/v2.0.0