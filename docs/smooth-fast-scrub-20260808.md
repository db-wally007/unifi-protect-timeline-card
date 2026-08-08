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

## Active Installation

- Resource ID: `5eb9580c5c0844319ad12cf76ef286ff`
- Resource URL: `/local/unifi-protect-timeline-card-live-experiment/dist/unifi-protect-timeline-card.js?v=smooth-fast-scrub-9ae1eaa5d142`
- Bundle SHA-256 prefix: `9ae1eaa5d142`
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

Future completed overview hours are generated automatically. Existing historical fine/overview
files are left in place only to keep rollback immediate; they are not regenerated.

## Behavior

- The timeline/ruler still updates at display rate.
- Expensive preview work is latest-value coalesced to 20 Hz.
- Fast movement uses the compact atlas where available.
- Holding/slowing for about 425 ms re-resolves the same target from the existing 640x360 fine tier.
- Both quality levels draw into the same canvas, so the upgrade has no DOM/player swap or black gap.
- Releasing the gesture flushes the exact final timestamp before historical playback starts.
- Hours before the coverage start use the prior sprite/MP4 behavior.

## Validation

- Python syntax: passed
- Actual fast renderer on a real overview MP4: 61 frames, 3 sheets, 0.99 MiB
- Automated tests: 74/74 passed
- TypeScript typecheck: passed
- Production build: passed
- Source diagnostics: no errors in TypeScript/test files
- Five LIVE startup regressions: 600-1125 ms, all 2688x1512

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

## Rollback

1. Restore resource ID `5eb9580c5c0844319ad12cf76ef286ff` to
   `/local/unifi-protect-timeline-card-live-experiment/dist/unifi-protect-timeline-card.js?v=session-audio-18b0c444af1d`.
2. Restore `pyscript/protect_scrub.py` to the relative target
   `../www/unifi-protect-timeline-card/pyscript/protect_scrub.py`.
3. Call `pyscript.reload`.
4. Open a fresh browser tab or force-quit/reopen the Companion app.

The additive `.fast-sprite.json` and `.fN.jpg` files are ignored by the old generator/client and may
remain on disk after rollback. They can be deleted later without affecting the previous behavior.
