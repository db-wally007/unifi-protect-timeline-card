# Changelog

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

[2.0.2]: https://github.com/db-wally007/unifi-protect-timeline-card/compare/v2.0.0...v2.0.2
[2.0.0]: https://github.com/db-wally007/unifi-protect-timeline-card/releases/tag/v2.0.0