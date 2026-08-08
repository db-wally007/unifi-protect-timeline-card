# Smooth Fast Scrub Candidate (2026-08-08)

This file records the deployed, rollback-safe compact fast-scrub experiment. It contains no
credentials or camera tokens.

## Git

- Repository: `db-wally007/unifi-protect-timeline-card`
- Feature branch: `fix/smooth-fast-scrub-20260808`
- Pre-change snapshot branch: `snapshot/scrub-session-audio-20260808`
- Pre-change annotated tag: `snapshot/scrub-session-audio-20260808`
- Pre-change commit: `784ecd507552bbf54e8cd6dd592b7e5b997542c6`
- Generator/index commit: `4fb3f61`
- Dual-atlas client commit: `d95bd14`
- Latest-target/fine-upgrade commit: `118d89c`
- Transient LIVE startup retry commit: `cb469fd`
- Newest-block/head atlas commit: `44f6a91`
- All-client compact/prewarm commit: `e08b0b0`
- 30 Hz compact cadence commit: `b208e16`

## Active Installation

- Resource ID: `5eb9580c5c0844319ad12cf76ef286ff`
- Resource URL: `/local/unifi-protect-timeline-card-live-experiment/dist/unifi-protect-timeline-card.js?v=smooth-scrub-30hz-1e3a039a6bfe`
- Bundle SHA-256 prefix: `1e3a039a6bfe`
- Active Pyscript symlink: `pyscript/protect_scrub.py -> ../www/unifi-protect-timeline-card-live-experiment/pyscript/protect_scrub.py`
- Previous Pyscript symlink: `pyscript/protect_scrub.py -> ../www/unifi-protect-timeline-card/pyscript/protect_scrub.py`

## Coverage Start

Compact fast atlases are active from **2026-08-08 09:00 Europe/Prague**
(**2026-08-08 07:00 UTC**) for Garden, Garage, and Corner. No older hour is backfilled.

At initial activation each camera had one completed compact hour:

- 60-61 temporal frames (roughly one frame/minute)
- 480x270 tiles
- 5x5 packing
- 3 JPEG sheets/hour
- 0.92-1.64 MiB/hour depending on scene complexity

Future completed overview hours are generated automatically. From the updated generator activation,
completed 10-minute blocks and each rolling-head generation also receive compact atlases. At the
first manual run all three cameras published 29 compact blocks through 11:40 UTC and compact heads
covering the current 11:50 block. Existing pre-activation files are left in place for rollback and
are not regenerated.

## Behavior

- The timeline/ruler still updates at display rate.
- Expensive preview work is latest-value coalesced to 30 Hz.
- `scrub_fast_preview: always` temporarily uses compact motion previews on every client.
- Stable LIVE preloads one current-head compact sheet without fetching the head MP4.
- Fast movement uses compact overview, completed-block, and rolling-head atlases where available.
- Holding/slowing for about 425 ms re-resolves the same target from the existing 640x360 fine tier.
- Both quality levels draw into the same canvas, so the upgrade has no DOM/player swap or black gap.
- Releasing the gesture flushes the exact final timestamp before historical playback starts.
- Hours before the coverage start use the prior sprite/MP4 behavior.
- A nonfatal Home Assistant LIVE startup error automatically remounts the player up to three times
   (750 ms, 1.5 s, then 3 s). Stable motion clears the retry budget.

## Validation

- Python syntax: passed
- Actual fast renderer on a real overview MP4: 61 frames, 3 sheets, 0.99 MiB
- Automated tests: 76/76 passed
- TypeScript typecheck: passed
- Production build: passed
- Source diagnostics: no errors in TypeScript/test files
- Five LIVE startup regressions: 600-1125 ms, all 2688x1512
- Ten fast-scrub -> LIVE transitions before the retry change: all succeeded in 366-1115 ms
- Injected exact `Stream never started` state: remounted in 781 ms, restored 2688x1512 motion in
   1917 ms, released the old decoder, preserved audio choice, and removed the alert
- Five fast-scrub -> LIVE transitions after retry: all succeeded; maximum 3314 ms

Active-hour browser benchmark (50-minute fast scrub in about one second):

- 61 source timeline updates
- 23 preview jobs after latest-target coalescing
- 20 compact frames painted during motion
- Regular 2.5-minute painted steps
- 3 compact JPEG requests
- Exact final target preserved

Fast-to-fine transition benchmark:

- 20 compact frames during motion
- Same canvas repainted at 640x360 after 457 ms held still
- No canvas/player replacement
- 3 compact JPEG requests
- 2.65 MiB total including the fine upgrade

Newest-hour/all-client benchmark after compact block/head activation:

- A clean-profile first movement painted at 480x270 in 6 ms; no preview MP4 was fetched
- A real switch to an uncached second camera painted its first movement in 27 ms with zero
   gesture-time preview requests; high LIVE was ready in 1014 ms and prewarm completed 1375 ms later
- 61 source updates over a cold 50-minute covered-hour fling became 34 preview jobs
- 28 compact frames painted during the one-second motion
- Worst paint gap improved from 88 ms at 20 Hz to 56 ms at 30 Hz
- Worst painted time jump improved from 2.71 minutes to 1.67 minutes
- The same canvas upgraded to 640x360 after 492 ms held still
- No preview MP4 was fetched; 2688x1512 LIVE returned in 888 ms

## Rollback

1. Restore resource ID `5eb9580c5c0844319ad12cf76ef286ff` to
   `/local/unifi-protect-timeline-card-live-experiment/dist/unifi-protect-timeline-card.js?v=session-audio-18b0c444af1d`.
2. Restore `pyscript/protect_scrub.py` to the relative target
   `../www/unifi-protect-timeline-card/pyscript/protect_scrub.py`.
3. Call `pyscript.reload`.
4. Open a fresh browser tab or force-quit/reopen the Companion app.

The additive `.fast-sprite.json` and `.fN.jpg` files are ignored by the old generator/client and may
remain on disk after rollback. They can be deleted later without affecting the previous behavior.
