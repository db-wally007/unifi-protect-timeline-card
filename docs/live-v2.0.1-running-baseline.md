# Running LIVE Baseline (2026-08-07)

This file records the installation state immediately before the lean high-quality
LIVE experiment. It intentionally contains no credentials or RTSPS URLs.

## Git

- Repository: `db-wally007/unifi-protect-timeline-card`
- Commit: `b9181e7ab17423a64eeabed3685220f28756ffa1`
- Version: `2.0.1`
- Snapshot branch: `snapshot/live-v2.0.1-running`
- Annotated tag: `snapshot/live-v2.0.1-running-20260807`

## Home Assistant

- Lovelace resource ID: `5eb9580c5c0844319ad12cf76ef286ff`
- Resource URL: `/local/unifi-protect-timeline-card/dist/unifi-protect-timeline-card.js?v=2.0.1-d7208e536ef0`
- `stream.ll_hls`: `true`
- `stream.segment_duration`: `5`
- `stream.part_duration`: `1`
- High-resolution `preload_stream`: `true` for Garden, Garage, and Corner
- Medium-resolution `preload_stream`: `false` for Garden, Garage, and Corner
- Idle established RTSPS sessions with both tiers enabled: `3`

## Immediate Runtime Rollback

1. Restore the resource URL above for resource ID `5eb9580c5c0844319ad12cf76ef286ff`.
2. Restore all three high-resolution camera preferences to `preload_stream: true`.
3. Restore all three medium-resolution camera preferences to `preload_stream: false`.
4. Reload the dashboard in a fresh browser session.
5. Confirm the browser loaded the `v=2.0.1-d7208e536ef0` resource and the RTSPS session count returned to three while the grid is closed.

## Code Rollback

Use the snapshot branch/tag above, or revert candidate commits individually. The
baseline checkout and bundle path are not modified during experiments; candidates
are built under `/local/unifi-protect-timeline-card-live-experiment/`.
