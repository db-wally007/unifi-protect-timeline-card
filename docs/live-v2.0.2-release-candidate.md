# LIVE 2.0.2 Release Candidate (2026-08-07)

This file records the tested high-quality LIVE candidate. It intentionally contains no credentials,
camera access tokens, or RTSPS URLs.

## Candidate

- Repository: `db-wally007/unifi-protect-timeline-card`
- Branch: `fix/lean-high-live-20260807`
- Candidate snapshot tag: `snapshot/live-v2.0.2-candidate-20260807`
- Source and bundle commit: `7ed7a465a1643a7755691ce327c78ff3ef7f5bac`
- Version: `2.0.2`
- Bundle SHA-256 prefix: `980e3ed6c421`
- Lovelace resource ID: `5eb9580c5c0844319ad12cf76ef286ff`
- Resource URL: `/local/unifi-protect-timeline-card-live-experiment/dist/unifi-protect-timeline-card.js?v=2.0.2-980e3ed6c421`
- Settled LIVE transport: one explicit high-resolution Home Assistant HLS player
- Settled LIVE resolution under test: `2688x1512`

`main` and the baseline checkout remain at `b9181e7`. The candidate has not been promoted to `main`.

## Behavior

- Detail LIVE mounts one `ha-hls-player`; it does not concurrently negotiate WebRTC.
- The nested video starts muted for reliable visual autoplay while HLS retains audio.
- `live_audio_start: auto` makes one audible attempt after stable motion and safely falls back to
  muted playback when browser policy blocks it.
- A stable player that stops progressing is released and remounted.
- Leaving LIVE releases the outgoing decoder before the historical player mounts.
- Hiding the card releases and unmounts LIVE; showing it mounts one fresh muted player.

## Automated Validation

Run against the versioned candidate:

- `npm run typecheck`: passed
- `npm test -- --run`: 59/59 tests passed
- `npm run build`: passed
- Home Assistant resource fetch: HTTP 200
- Editor diagnostics: no errors in the touched TypeScript files

## Browser Validation

Behavioral candidate `995e2f8` and bundle `aea36c467f9a` (identical LIVE code to the versioned
bundle):

- 20 fresh desktop starts: 358 ms minimum, 753 ms median, 1180 ms maximum
- 20 actual Back 15s -> Jump to live returns: 226 ms minimum, 605 ms median, 1012 ms maximum
- 10 phone-viewport starts: 447 ms minimum, 841 ms median, 1218 ms maximum
- 10 phone-viewport LIVE returns: 233 ms minimum, 640 ms median, 947 ms maximum
- Five injected HLS freezes: 957-1956 ms from the last advancing frame to new motion
- The same five faults: 2504-3795 ms from network-stop injection to new motion, including buffered
  video draining before a visible freeze existed
- Every replaced fault-test video reached `NETWORK_EMPTY` with its source released
- 45-second post-fault soak: zero waiting, stalled, error, pause, or false-remount events
- Soak live-edge lag: 1.077-2.125 seconds; LL-HLS enabled; target duration five seconds
- Soak transport count: one HLS player, zero WebRTC players
- Ten hidden/show cycles: complete release on every hide; 411 ms minimum, 716 ms median, 1095 ms
  maximum to restored high-resolution motion
- Audio mute/unmute: decoded audio and video motion continued on the same player without a remount
- Desktop and phone fullscreen enter/exit: high-resolution motion continued on the same player
- Desktop and 390x844 phone screenshots: video rendered, controls fit, and no horizontal overflow

Exact versioned resource `2.0.2-980e3ed6c421` gate:

- Five fresh starts: 392 ms minimum, 813 ms median, 1124 ms maximum
- Injected freeze: 1662 ms from the last frame and 3325 ms from injection to restored motion
- Hidden/show: old player fully released; restored high-resolution motion in 485 ms
- Final transport count: one HLS player, zero WebRTC players

## Real-Device Acceptance

Use a fresh tab or hard refresh so the resource URL above is loaded.

1. On the MacBook Air, open the Garden timeline five times and record any LIVE start over five
   seconds.
2. Use Back 15s or scrub away, then press LIVE ten times. Record any return over five seconds or any
   held frame that remains after motion starts.
3. Unmute and confirm audio starts without the picture restarting; mute again.
4. Enter and exit fullscreen while LIVE is moving.
5. Navigate away or close the containing popup for ten seconds, return, and confirm LIVE resumes
   within five seconds.
6. Repeat steps 1-5 on the iPhone, including portrait-to-fullscreen behavior and one test after the
   phone has been locked and unlocked.
7. Android hardware validation remains pending until the tablet is available.

## Rollback

Immediate runtime rollback:

1. Set resource ID `5eb9580c5c0844319ad12cf76ef286ff` to
   `/local/unifi-protect-timeline-card/dist/unifi-protect-timeline-card.js?v=2.0.1-d7208e536ef0`.
2. Hard refresh or open a fresh browser session.
3. Confirm `main`/the running checkout is still `b9181e7`.

Code rollback is available through branch `snapshot/live-v2.0.1-running` or annotated tag
`snapshot/live-v2.0.1-running-20260807`. Candidate commits are also granular and can be reverted
individually.
