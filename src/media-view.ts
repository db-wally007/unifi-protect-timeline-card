// The video / preview area above the timeline.
//
// Continuous playback model: HA's /api/unifiprotect/video/{nvr}/{cam}/{start}/{end}
// EXPORTS the requested range on demand, so long ranges are slow. We therefore
// play SHORT segments and auto-chain the next one on `ended`, giving continuous
// playback from the chosen time toward live without a giant export.
//
// BOUNDED EVENT CLIPS ARE STREAMED, via a server-side session. The export proxy
// ignores HTTP Range AND the NVR writes the MP4 index (`moov`) last, so a
// streamed export can neither start nor seek — which is why this used to fetch
// the whole clip into a Blob. At ~52 MB per minute of high-res footage that peaked near 740 MB
// for a 7-minute event and got the WKWebView content process killed on iOS: the
// Companion app appeared to "jump back to the dashboard" exactly when the
// download completed. Now `protect_cache` exports + faststart-remuxes the clip
// into a throwaway session directory and serves it with real Range, so <video>
// streams and seeks natively holding only its own buffer. See ha-urls.ts
// (startClipSession) and custom_components/protect_cache/clip_session.py.
//
// The delayed-follow engine below still uses BLOBS on purpose: its chunks are
// capped at FOLLOW_MAX_CHUNK_MS (30s, ~26 MB) across two slots, which was never
// the memory problem, and blobs let the two <video> elements leap-frog without a
// reload flash. Live is HA's <ha-camera-stream>.
//
// TIER-AWARE SEGMENTS: the NVR keeps high-res (2K) footage around events and a continuous
// low-quality track in between, and serves ONE tier per export — a request
// overlapping an event comes from the high-res track where idle stretches are just
// sparse keyframes (they'd play absurdly fast and desync the marker). Segments
// are therefore CUT at the event boundaries (segmentEndFor), so every request
// streams real-time footage of a single tier and `clipStart + currentTime` is
// always the true time — high-res during events, low-quality between, like the app.

import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import type { FootageGap, HomeAssistant } from './data/types';
import { buildVideoUrl, signPath, startClipSession, endClipSession } from './data/ha-urls';
import { inGap } from './data/gaps';
import { clipWatchdogAction, isCurrentClipSource } from './data/clip-playback';
import {
  LiveHealthTracker,
  liveProgressValue,
  shouldAttemptLiveAudio,
  shouldRetryLiveStartup,
  type LiveAudioStart,
} from './data/live-health';
import { shouldUseWebRtcLive, type LiveTransport } from './data/live-transport';
import {
  ScrubPreviewLoader,
  spriteVariantOrder,
  type PreviewBlock,
  type SpriteSet,
  type SpriteVariant,
} from './data/scrub-preview';
import { releaseVideo, releaseVideosIn } from './data/media-release';
import { shadowVideo } from './data/live-video';

interface HaLivePlayerElement extends HTMLElement {
  muted: boolean;
  updateComplete?: Promise<unknown>;
  _error?: unknown;
  _errorIsFatal?: boolean;
}

// Cut playback chunks at recording-tier boundaries. Only needed under ADAPTIVE
// recording, where one export could straddle the high-res event tier and the low-res
// continuous tier and the NVR would serve just one of them (idle stretches then
// fast-forward and desync the playhead). With always-on recording at a single
// quality every export is single-tier, so cutting only produces more, shorter
// chunks — and every chunk boundary is a leap-frog swap, i.e. one more place
// playback can stall. Set back to true if adaptive/smart recording returns.
const CUT_CHUNKS_AT_EVENTS = false;

// How close to live a scrub has to be before the EXPERIMENTAL tip tier asks the
// NVR for a fresh real-time clip. Comfortably wider than the tip's own 60s
// window plus the head's worst staleness, so a gesture that lands anywhere in
// the stale region still triggers one, while scrubbing through history never
// touches the NVR at all.
const TIP_NEAR_LIVE_MS = 5 * 60_000;

// ---- PERF-SCRUB-2026-08-03: speed-aware preview tier -------------------------
// A fast drag used to freeze the preview outright. _resolvePlayable prefers the
// FINE 10-minute unit whenever its bytes are cached, and the neighbour/debounce
// prefetching means it usually is — so a fling restaged the <video> for every
// block it flew over, while staging one (src -> loadedmetadata -> seek ->
// loadeddata -> promote) takes far longer than the ~130 ms the playhead spends
// inside a block. Nothing ever got promoted, so the stage held one stale frame
// and only caught up after the finger lifted. Measured at 6x CPU throttle the
// shown frame drifted to ~57 MINUTES behind the playhead; on a fast CPU staging
// just barely wins, which is why this is invisible on a phone or a laptop.
//
// The hour-long overview tier already exists for exactly this, it was simply
// never preferred. So: while the playhead is moving faster than the fine tier
// can be staged, show the overview and let the fine unit upgrade the frame when
// the drag settles — which is what the UniFi app does too.
//
// The thresholds are derived, not tuned: crossing more than one fine block per
// staging interval is precisely the condition under which a fine unit cannot be
// promoted before it is stale. Velocity is footage-ms per wall-ms (i.e. "x
// realtime"), so the trigger is blockMs / interval — ~1500x realtime for the
// default 10-minute blocks. Separate enter/exit intervals give hysteresis so a
// drag hovering at the threshold doesn't flip tiers every frame.
const COARSE_ENTER_MS = 400; // can't stage a fine unit this fast -> go coarse
const COARSE_EXIT_MS = 1200; // ...and stay coarse until clearly slower
// A velocity sample older than this is meaningless (the finger stopped, or the
// gesture was interrupted) — treat the playhead as settled.
const SCRUB_VEL_STALE_MS = 400;

// SPRITE-PREVIEW-2026-08-04, `scrub_preview_mode: auto`. Measured seek latency
// above this means the device's video decoder cannot keep the preview under the
// finger (a 99 ms seek caps it at ~10 updates/sec). Set well clear of both
// measured populations: ~10 ms on a Mac/iPhone, ~99 ms (p90 122) on the Mali
// tablet, so neither sits near the boundary.
const SLOW_SEEK_MS = 40;
const SEEK_SAMPLE_MIN = 5; // don't judge a device on the first seek of a session
const SEEK_SAMPLE_MAX = 15;

// Live must never be hidden longer than one UniFi keyframe interval. Historical
// NVR exports may genuinely need longer, but both paths remain finite.
const LIVE_FREEZE_MAX_MS = 5_000;
const HISTORICAL_FREEZE_MAX_MS = 15_000;
const LIVE_STABLE_MS = 750;
const LIVE_STALL_MS = 3_000;
const LIVE_WEBRTC_STALL_MS = 3_000;
const LIVE_AUDIO_VERIFY_MS = 350;
// How often the live-only poster preload is refreshed (see _posterPreload).
const POSTER_REFRESH_MS = 10_000;
// HOLDFRAME-2026-08-05: master switch for the held-frame overlay.
const HOLD_FRAME_ENABLED = true;
const CLIP_FRAME_STALL_MS = 2_500;

/** A play() rejection that means "the browser refused", not "superseded".
 *  NotAllowedError = autoplay policy (iOS Low Power Mode refuses even muted).
 *  AbortError = a load()/src change interrupted it, which recovers on its own. */
function isBlockedByPolicy(err: unknown): boolean {
  return (err as { name?: string } | null)?.name === 'NotAllowedError';
}
import { segmentEndFor, type FootageSpan } from './data/footage-map';

@customElement('upc-media-view')
export class MediaView extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @property() nvrId = '';
  @property() cameraId = '';
  // Camera-offline spans: don't export a clip inside them (no footage), show a
  // "camera was offline" message instead — matches the grey timeline gap.
  @property({ attribute: false }) gaps: FootageGap[] = [];
  // Full-quality recorded spans (padded events from the manifest): playback
  // segments are cut at their boundaries so each export stays on one tier.
  @property({ attribute: false }) footageSpans: FootageSpan[] = [];
  @property({ type: Number }) targetTime = Date.now();
  @property({ type: Boolean }) scrubbing = false;
  @property({ type: Boolean }) live = false;
  // Internal segment length for chained playback, in seconds.
  @property({ type: Number }) chunkSeconds = 300;
  @property({ type: Number }) now = Date.now();
  // Directory of the scrub-preview timelapse cache (pyscript protect_scrub job);
  // empty = feature off, the scrub stage stays plain black.
  @property() previewDir = '';
  // SPRITE-PREVIEW-2026-08-04: 'video' | 'sprites' | 'auto' — see CardConfig.
  @property() previewMode: 'auto' | 'sprites' | 'video' = 'sprites';
  @property() fastPreview: 'always' | 'speed' | 'off' = 'speed';
  // EXPERIMENTAL (card config `scrub_tip`): ask the NVR for a real-time clip of
  // the newest ~minute when a scrub starts near live. Off = the cron head only.
  @property({ type: Boolean }) tipEnabled = false;
  // When > 0, play a single bounded clip ending at this epoch-ms (the event's
  // end) instead of a chunked window — so the player length = the event length.
  @property({ type: Number }) clipEndTime = 0;
  // Accent color (matches the card's accent_color).
  @property() accent = '';
  // Delayed-follow target: how many seconds BEHIND live the continuous recording
  // playback holds. The recording export can't serve the last ~8s, so the true
  // floor is ~12s; values below that are clamped. Each chunk is ~ (delay − 8)s.
  @property({ type: Number }) delaySeconds = 15;
  @property() liveAudioStart: LiveAudioStart = 'muted';
  @property() liveTransport: LiveTransport = 'auto';
  @property() liveBridgeCameraId = '';
  // True when the host card is in its stacked (phone) layout — turns on the
  // mobile control bar (full-width seek row) and the rotate-to-landscape
  // fullscreen. Passed down from the card's _isStacked().
  @property({ type: Boolean, reflect: true }) stacked = false;
  // Auto-enter fullscreen on mount, and emit `fs-exit` when fullscreen is left.
  // Used by the multi page to open a live camera fullscreen from a grid tile
  // (same player/controls as the timeline), returning to the grid on exit.
  @property({ type: Boolean }) startFs = false;
  // The host slots a scrubber into `fs-timeline` — the UniFi-style overlay
  // ruler down the right edge of the FULLSCREEN player. It has to render inside
  // this element's subtree: fullscreen is either this host (element fullscreen)
  // or its <dialog> in the top layer, and nothing outside either is visible.
  // Drives the strip wrapper + the control bar's right inset below.
  @property({ type: Boolean }) fsTimeline = false;
  @property({ type: Number }) fsTimelineWidth = 165;
  // How wide a band down the right edge ACCEPTS the scrub gesture. Everything
  // the timeline draws is anchored to the right edge, so this only widens the
  // grab area — a 165px-wide target is fiddly to catch with a thumb. 0 = the
  // WHOLE player, so a drag anywhere on the picture scrubs (taps outside the
  // timeline never uses taps itself — see the tap-through event).
  @property({ type: Number }) fsTimelineGrabWidth = 0;
  // Clearance between the ruler and the top/bottom screen edges.
  @property({ type: Number }) fsTimelinePadding = 100;
  // Clear lane between the ruler and the RIGHT screen edge. Wider than the
  // vertical padding: the zoom control and the jump-to-live arrow live in it.
  @property({ type: Number }) fsTimelineGutter = 140;
  // Peak opacity of the strip's scrim (at the screen edge, under the ruler).
  @property({ type: Number }) fsTimelineScrim = 0.88;
  // How far past the strip the scrim reaches (px) — it has to cover the event
  // thumbnails, which hang outside the ruler over the video.
  @property({ type: Number }) fsTimelineScrimExtend = 170;

  @state() private _videoSrc?: string;
  @state() private _loadingVideo = false;
  @state() private _error?: string;
  // True once HA's explicit WebRTC player element is available.
  @state() private _streamReady = false;

  @query('.fs-wrap') private _fsDlg?: HTMLDialogElement;
  @query('video.clip') private _video?: HTMLVideoElement;
  @query('video.preview-a') private _previewVidA?: HTMLVideoElement;
  @query('video.preview-b') private _previewVidB?: HTMLVideoElement;
  @query('video.follow-a') private _followVidA?: HTMLVideoElement;
  @query('video.follow-b') private _followVidB?: HTMLVideoElement;

  // ---- delayed-follow engine (gapless recording playback ~delaySeconds behind
  //      live) --------------------------------------------------------------
  // Two <video> elements leap-frog: one plays the current chunk while the next
  // (already-recorded, prefetched) chunk buffers in the other, then we swap with
  // no reload flash. Chunks are cut at recording-tier boundaries so quality
  // tracks the adaptive recording (low between events, high-res during). Never jumps
  // to live — it holds the offset until you stop, seek, or press LIVE.
  @state() private _followSrcA?: string;
  @state() private _followSrcB?: string;
  @state() private _followActive: 'a' | 'b' | null = null;
  // Custom controls for the delayed-follow stage (the two leap-frogging videos
  // can't use native controls: fullscreen would freeze at each chunk swap).
  @state() private _followPaused = false;
  @state() private _followMuted = true;
  // Playback was refused by the browser even muted (iOS Low Power Mode blocks
  // autoplay outright) — offer a one-tap start instead of leaving a frozen
  // first frame on screen with no explanation.
  @state() private _tapToPlay = false;
  @state() private _followCtrl = false; // control bar visible (auto-hides)
  // The player the control bar was last built for — the scrub stage re-renders
  // it in that mode so the chrome survives the gesture.
  private _ctrlMode: 'live' | 'follow' | 'clip' = 'live';
  @state() private _isFs = false; // fullscreen (mobile: dialog modal; desktop: element FS)
  @state() private _forceRotate = false; // mobile FS is CSS-rotated to landscape
  private _modalOn = false; // the player dialog is currently showModal()'d
  @state() private _followRate = 1; // playback speed (1, 2 or 4)
  @state() private _nearLive = false; // within ~16s of live (disables speed)
  @state() private _livePausedState = false; // live inner <video> paused (for the icon)
  @state() private _liveMuted = true;
  private _liveHealth = new LiveHealthTracker(LIVE_STABLE_MS, LIVE_STALL_MS);
  private _livePlayerGeneration = 0;
  @state() private _liveRestartKey = 0;
  @state() private _highLiveReady = false;
  private _liveMountedAt = 0;
  private _liveStartupAttempts = 0;
  private _livePreviewWarmTimer?: ReturnType<typeof setTimeout>;
  private _livePreviewWarmed = false;
  private _liveAudioAttempted = false;
  private _liveAudioTrying = false;
  private _audioUserChoice?: 'muted' | 'unmuted';
  @state() private _clipPaused = false; // bounded event clip paused
  @state() private _clipMuted = true;
  @state() private _clipRate = 1; // bounded event clip speed (1, 2 or 4)
  @state() private _clipProgress = 0; // 0..1 playback position (seek bar + playhead)
  @state() private _clipTime = 0; // clip playhead (s) for the M:SS / M:SS readout
  @state() private _clipDuration = 0; // clip length (s)
  @state() private _preparing = false; // server is exporting+remuxing the clip
  @state() private _clipBuffering = false;
  private _clipFrameGeneration = 0;
  private _clipFrameTimer?: ReturnType<typeof setTimeout>;
  private _clipSeekTarget = 0;
  private _clipSeekWasPlaying = false;
  private _clipRecoveryAttempts = 0;
  private _clipWatchFailed = false;
  private _clipSourceToken = 0;
  private _clipSourceSession?: string;
  private _clipSourceUrl = '';
  // Server-side working directory for the clip currently loaded. Dropped as soon
  // as playback ends or the view goes away; the server also sweeps orphans, so a
  // missed DELETE (force-quit, lost network) costs a directory for SESSION_TTL.
  private _sessionId?: string;
  private _sessionAbort?: AbortController;
  private _followCtrlTimer?: ReturnType<typeof setTimeout>;
  private _followToken = 0;
  // Recovery for a chunk that never becomes playable. Every step between "src
  // assigned" and "playing" is event-driven (loadeddata -> seek -> seeked), so
  // a single missed event used to strand the stage on its spinner forever with
  // nothing to retry it — and iOS drops those events far more readily than
  // Chromium (it will not fetch media data for an element it has decided not to
  // preload, so `loadeddata` simply never comes).
  // Per slot: both can be waiting at once (the active one on screen and the
  // standby prefetching), so they cannot share a timer or a retry budget.
  private _followWatch: Record<'a' | 'b', ReturnType<typeof setTimeout> | undefined> = {
    a: undefined,
    b: undefined,
  };
  private _followWatchTries: Record<'a' | 'b', number> = { a: 0, b: 0 };
  private static readonly FOLLOW_STALL_MS = 2500;
  // Per-slot: requested [start,end] (epoch ms) and the measured lead-in (s) —
  // the export snaps its START back to a keyframe, so the clip is longer than
  // the requested range; its content ENDS at `end`, so content(ct) = end −
  // duration + ct. We seek past the lead-in so chunks stitch without replaying.
  private _followMeta: Record<
    'a' | 'b',
    { start: number; end: number; ready: boolean; leadIn: number }
  > = {
    a: { start: 0, end: 0, ready: false, leadIn: 0 },
    b: { start: 0, end: 0, ready: false, leadIn: 0 },
  };
  private _followPlayhead = 0; // next content time (epoch ms) to fetch from
  private _followSwapArmed = false; // pre-swap fired for the active chunk
  private _followRetry?: ReturnType<typeof setTimeout>;
  // The NVR can't export the most recent ~8s (footage not finalized); hold the
  // chunk end this far behind wall-clock.
  private static readonly FOLLOW_AVAIL_LAG_MS = 8000;
  // Cap a single export so an idle stretch doesn't request a huge range.
  private static readonly FOLLOW_MAX_CHUNK_MS = 30000;

  // ---- scrub preview (low-res timelapse frames while dragging the timeline) --
  // Two <video>s leap-frog here for the same reason the follow engine does it:
  // assigning .src runs the media load algorithm, which drops readyState to
  // HAVE_NOTHING and paints NOTHING (no poster) until the new frame decodes —
  // a black flash at every block/part boundary. The incoming unit loads and
  // seeks in the STANDBY element while the active one keeps its last frame on
  // screen; promotion is a class swap once the new frame is decoded.
  private _preview = new ScrubPreviewLoader();
  @state() private _previewSrcA?: string;
  @state() private _previewSrcB?: string;
  @state() private _previewActive: 'a' | 'b' | null = null;
  // Per-slot: the block/part that slot's src belongs to, the latest wanted seek
  // while its decoder is busy, and its bounded error-retry budget.
  private _previewBlocks: Record<'a' | 'b', PreviewBlock | undefined> = {
    a: undefined,
    b: undefined,
  };
  private _previewPending: Record<'a' | 'b', number | undefined> = {
    a: undefined,
    b: undefined,
  };
  private _previewRetries: Record<'a' | 'b', number> = { a: 0, b: 0 };
  private _previewWant?: string; // block key being debounced/downloaded right now
  private _previewToken = 0; // invalidates block downloads superseded by scrubbing
  // PERF-SCRUB-2026-08-03: scrub velocity + the latched coarse-tier decision.
  private _scrubVelPrev?: { t: number; at: number };
  private _coarseScrub = false;
  private _scrubFineTimer?: ReturnType<typeof setTimeout>;
  // +1 = dragging toward newer footage, -1 = older. Drives sheet prefetching.
  private _scrubDir = 1;
  // ---- sprite tier (SPRITE-PREVIEW-2026-08-04) ----
  @query('canvas.sprite') private _spriteCanvas?: HTMLCanvasElement;
  // A frame has been painted, so the canvas is worth showing (an unpainted one
  // is just black, which is what the held frame is covering).
  @state() private _spriteReady = false;
  // Invalidates in-flight draws across a CAMERA CHANGE only. Deliberately not
  // bumped per draw: doing that discarded every late-arriving sheet during a
  // continuous gesture and froze the preview (see _drawSprite).
  private _spriteToken = 0;
  // 'auto' resolves here once the device has measured itself.
  private _autoSprites = false;
  private _seekSamples: number[] = [];

  private _loadedForTime?: number;
  private _videoToken = 0;
  private _clipStart = 0; // real epoch ms the current segment was requested from

  private _autoplayDone = false; // one unmuted-autoplay attempt per loaded clip

  /** Invalidate any in-flight segment load. Single-flight is enforced by the
   *  <video> element itself: replacing/clearing `src` makes the browser abort
   *  the streaming request, which cancels the export on the NVR side too.
   *  The clip's server-side session is released here too, so abandoning a clip
   *  frees its working directory immediately instead of waiting for the sweep. */
  private _cancelLoad(): void {
    this._videoToken++;
    if (this._video) releaseVideo(this._video);
    this._preparing = false;
    this._clipBuffering = false;
    this._cancelClipFrameWatch();
    this._endClipSession();
  }

  static styles = css`
    :host {
      display: block;
      position: relative; /* the inline fs-wrap dialog fills the host */
      width: 100%;
      height: 100%;
    }
    /* The whole player lives inside an always-open <dialog> so mobile fullscreen
       can promote it to the TOP LAYER via showModal() — that escapes every
       ancestor's clipping/stacking (a plain position:fixed gets trapped in the
       card's nested layout) WITHOUT moving or remounting the <video>. Normally
       it's a layout-neutral, transparent, inline box filling the host. */
    .fs-wrap {
      display: block;
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      border: none;
      background: transparent;
      max-width: none;
      max-height: none;
      overflow: visible;
      color: inherit;
    }
    .fs-wrap:not([open]) {
      display: none;
    }
    /* Mobile fullscreen (showModal): fill the viewport. */
    .fs-wrap.fs-active {
      position: fixed;
      inset: 0;
      background: #000;
    }
    /* iOS can't lock orientation from JS, so rotate the player to landscape when
       the phone is portrait (turn the phone to watch). Flip 90deg->-90deg if it
       lands the wrong way. */
    .fs-wrap.fs-active.rotate {
      inset: auto;
      top: 50%;
      left: 50%;
      width: 100vh;
      height: 100vw;
      transform: translate(-50%, -50%) rotate(90deg);
      transform-origin: center center;
    }
    .fs-wrap::backdrop {
      background: #000;
    }
    /* The held frame. A still copy of the last thing the player showed, laid
       over the stage while the next source loads, so a seek/skip/mode change
       never flashes black (UniFi-app behaviour). It is a SIBLING of .stage, not
       a child: each mode returns its own .stage template, so anything inside
       would be destroyed by the very swap it exists to cover.
       canvas is a replaced element, so object-fit letterboxes it exactly like
       the <video> it was copied from. Above the players, below the chrome. */
    canvas.freeze,
    img.freeze {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #000;
      z-index: 3;
      pointer-events: none;
    }
    .stage {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 200px;
      background: #000;
      border-radius: 10px;
      overflow: hidden;
    }
    /* TABLET/desktop element fullscreen: the VIDEO keeps its native positioning;
       only the CONTROLS are padded in from the screen edges. The gradient
       background (.vctrl) still spans full-width and reaches the bottom edge —
       just the buttons inside get the extra padding. */
    :host(:fullscreen) .vctrl {
      padding: 20px 48px 40px;
    }
    video,
    img.snap {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #000;
    }
    /* --video-max-height is LOAD-BEARING. Both of HA's players style their inner
       <video> (in their own shadow root, which we cannot reach) as:
           video { width: 100%; max-height: var(--video-max-height, calc(100vh - 97px)); }
       That 97px is HA's allowance for its own toolbar. Our FULLSCREEN stage IS
       100vh, so the cap binds: the video box became 703px in an 800px stage and,
       being display:block, sat at the TOP — live showed a slightly smaller
       picture pinned high while scrub/clip/follow (object-fit: contain on our own
       <video>) were centred, so switching to live visibly jumped the image up.
       Measured 1250x703 @ gap 0/97 before, 1280x720 @ gap 40/40 after — i.e. this
       also stops the picture being needlessly shrunk. The custom property
       inherits through the shadow boundary, which is the only lever we have.
       Not reproducible outside fullscreen: there the stage is shorter than
       100vh - 97px, so the cap never binds.
       The flex centring is belt-and-braces for any future player that ends up
       auto-height; measured a no-op for both current ones. */
    ha-web-rtc-player.live-player,
    ha-hls-player.live-player,
    ha-camera-stream.live-bridge {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #000;
      --video-max-height: 100%;
    }
    .live-player {
      z-index: 1;
    }
    .live-bridge {
      z-index: 2;
    }
    /* Clip/scrub/idle overlay drawn ON TOP of the always-mounted live element,
       so live is never torn down (that's what dropped HLS audio on return). */
    .overlay-stage {
      position: absolute;
      inset: 0;
      background: #000;
      z-index: 2;
    }
    video {
      opacity: 1;
      transition: opacity 0.15s ease;
    }
    video.loading {
      opacity: 0;
    }
    /* Delayed-follow leap-frog videos: the active one is on top and opaque, the
       standby one sits underneath buffering the next chunk (no transition — a
       fade would reveal a seam at the swap). */
    video.follow-a,
    video.follow-b {
      transition: none;
    }
    video.follow-off {
      opacity: 0;
      z-index: 0;
    }
    video.follow-on {
      opacity: 1;
      z-index: 1;
    }
    /* Scrub-preview leap-frog videos — same deal: the standby one loads and
       seeks the next block/part underneath, then swaps in already decoded. */
    video.preview-a,
    video.preview-b {
      transition: none;
    }
    /* SPRITE-PREVIEW-2026-08-04: the sprite canvas shares the video geometry
       (absolute inset 0, object-fit: contain) so switching tiers cannot move or
       resize the picture. <canvas> is a replaced element, so object-fit applies
       to it exactly as it does to <video>. */
    canvas.sprite {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #000;
      transition: none;
    }
    canvas.preview-off,
    video.preview-off {
      opacity: 0;
      z-index: 0;
    }
    canvas.preview-on,
    video.preview-on {
      opacity: 1;
      z-index: 1;
    }
    /* SPRITE-PREVIEW-2026-08-04: when the sprite canvas is live it owns the
       stage outright — the preview <video>s may still hold an older frame from
       a unit with no sheets, and it must not show through underneath. */
    canvas.sprite.preview-on {
      z-index: 2; /* above the preview <video>s (1), below the held frame (3) */
    }
    /* Shown when the browser refused to start playback (see _playFollowVideo).
       Sits above the video so the tap always reaches it. */
    .tap-play {
      position: absolute;
      z-index: 7; /* above the fullscreen timeline strip, which covers the stage */
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 64px;
      height: 64px;
      border: none;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.55);
      color: #fff;
      font-size: 26px;
      line-height: 1;
      padding-left: 4px; /* optically centre the ▶ glyph */
      cursor: pointer;
      appearance: none;
    }
    /* The scrub timestamp that used to sit on the stage is GONE. It was pinned
       to the bottom centre, which is exactly where the control bar lands on a
       phone and on a small tablet, so the one moment it mattered — mid-scrub,
       with the chrome up — was the one moment it was covered. The timeline's
       playhead pill carries the same clock and now swells while the ruler
       moves; see "PILL SWELL" in scrubber-timeline.ts. */
    /* Custom control bar for the delayed-follow stage — auto-hides. */
    .vctrl {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      background: linear-gradient(to top, rgba(0, 0, 0, 0.55), transparent);
      opacity: 0;
      transition: opacity 0.2s ease;
      pointer-events: none;
      z-index: 4;
    }
    .vctrl.show {
      opacity: 1;
      pointer-events: auto;
    }
    /* Shown but not operable: the bar stays put while a scrub swaps the stage
       for the preview (no player to drive), so the chrome doesn't flicker away
       under the finger and back. */
    .vctrl.inert {
      pointer-events: none;
    }
    .vctrl-spacer {
      flex: 1 1 auto;
    }
    /* Fullscreen overlay timeline: a strip down the RIGHT edge holding the
       host's slotted scrubber, over the video. Appears and auto-hides with the
       control bar (same transition, same show class), so the player is never
       covered by chrome the user didn't ask for. */
    .fs-tl {
      position: absolute;
      top: 0;
      bottom: 0;
      right: 0;
      /* The padding is INSIDE the strip (border-box), so the scrim still runs to
         the screen edges while the ruler itself keeps its clearance from them.
         The box is as wide as the GRAB area; the ruler inside it draws
         right-anchored, and the scrim below is sized independently — so a wide
         gesture target costs nothing visually. */
      box-sizing: border-box;
      width: var(--upc-fs-tl-boxw, 100%);
      padding: var(--upc-fs-tl-pad, 100px) var(--upc-fs-tl-gut, 140px)
        var(--upc-fs-tl-pad, 100px) 0;
      z-index: 5; /* above .vctrl, whose gradient runs under the strip */
      opacity: 0;
      transition: opacity 0.2s ease;
      pointer-events: none;
    }
    /* The dimming is a pseudo-element, not the strip's own background, so it can
       reach FURTHER LEFT than the strip's layout box — the event thumbnails hang
       outside the ruler, over the video, and need the same backing to stay
       readable. pointer-events:none keeps that overhang from swallowing taps
       meant for the video, and z-index:-1 puts it behind the ruler + thumbs.
       Built in the template from fs_timeline_scrim (no calc() inside a color
       function, which older WebViews drop). */
    .fs-tl::before {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      right: 0;
      /* Sized off the RULER, not the grab area: widening the touch target must
         not dim half the picture. */
      width: calc(
        var(--upc-fs-tl-w, 165px) + var(--upc-fs-tl-gut, 140px) +
          var(--upc-fs-tl-scrim-ext, 170px)
      );
      z-index: -1;
      pointer-events: none;
      background: var(--upc-fs-tl-bg, linear-gradient(to left, rgba(0, 0, 0, 0.88), transparent));
    }
    .fs-tl.show {
      opacity: 1;
      pointer-events: auto;
    }
    /* While the strip is up, keep every control clear of it: the bar's gradient
       still spans full width, only its contents move in. Both fullscreen
       flavors set their own padding SHORTHAND at a higher specificity (the
       element-fullscreen and rotated-mobile rules below), so the inset has to
       be spelled out against each of them or it is silently overridden. */
    .vctrl.fs-inset,
    :host(:fullscreen) .vctrl.fs-inset,
    :host([stacked]) .fs-wrap.fs-active .vctrl.fs-inset {
      padding-right: calc(var(--upc-fs-tl-w, 165px) + var(--upc-fs-tl-gut, 140px) + 12px);
      /* Above the strip: its grab area reaches well left of the ruler and would
         otherwise swallow the seek bar and the buttons under it. */
      z-index: 6;
      /* ...but only the CONTROLS need to win, not the bar's own box. The inset
         above leaves a wide empty lane on the right that lines up exactly with
         the strip, and the jump-to-live arrow sits low in it — on a phone the
         arrow's whole 38px band (timeline padding + 8px) falls inside the taller
         mobile bar, so an opaque .vctrl swallowed every tap on it and the arrow
         looked dead. (It worked on a tablet only because the bigger timeline
         padding happened to clear the shorter bar by 4px.) Hit-testing passes
         straight through the bar; its children opt back in below. */
      pointer-events: none;
    }
    /* Must follow .vctrl.show (same specificity, later wins) — and inert means
       shown-but-not-operable, so it keeps the whole bar dead. Clicks on the
       children still bubble to the bar's own stopPropagation sink. */
    .vctrl.fs-inset.show:not(.inert) > * {
      pointer-events: auto;
    }
    .vctrl button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border: none;
      border-radius: 9px;
      background: rgba(0, 0, 0, 0.4);
      color: #fff;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .vctrl button:hover {
      background: rgba(0, 0, 0, 0.6);
    }
    .vctrl button:disabled {
      opacity: 0.4;
      cursor: default;
    }
    .vctrl button ha-icon {
      --mdc-icon-size: 24px;
    }
    /* FULLSCREEN: the bar has a whole screen to itself and is worked from
       across a room, where the inline player's 40px targets read as tiny next
       to the timeline. Scale the controls up and double the spacing between
       them. Inline players keep the compact sizing — a phone's card-sized bar
       has no room for this and would wrap. */
    .vctrl.fs {
      gap: 16px;
    }
    :host([stacked]) .vctrl.fs {
      gap: 12px;
    }
    .vctrl.fs button {
      width: 48px;
      height: 48px;
      border-radius: 11px;
    }
    .vctrl.fs button ha-icon {
      --mdc-icon-size: 29px;
    }
    .vctrl.fs .vctrl-speed {
      min-width: 53px;
      padding: 0 11px;
      font-size: 17px;
    }
    .vctrl.fs .vtime {
      font-size: 19px;
    }
    /* Speed toggle: a text pill; highlighted (accent) while >1×. */
    .vctrl-speed {
      width: auto;
      min-width: 44px;
      padding: 0 9px;
      font-size: 14px;
      font-weight: 700;
    }
    .vctrl-speed.on {
      background: var(--upc-accent, var(--primary-color, #03a9f4));
    }
    /* Clip time readout, YouTube-style "current / total" (M:SS). */
    .vtime {
      flex: 0 0 auto;
      font-size: 16px;
      font-weight: 600;
      color: #fff;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      margin-left: 4px;
    }
    /* Wrapper around the time readout + seek bar. On tablet/desktop it is a
       no-op (display: contents) so both flow inline in the .vctrl row exactly as
       before; on phones it becomes the full-width seek ROW (see stacked rules). */
    .vseek-row {
      display: contents;
    }
    /* Clip seek bar: a track + fill + draggable playhead knob, filling the rest
       of the row after the buttons (the space the spacer holds otherwise). */
    .vseek {
      flex: 1 1 auto;
      display: flex;
      align-items: center;
      height: 40px;
      margin: 0 10px;
      cursor: pointer;
      touch-action: none;
    }
    .vseek-track {
      position: relative;
      width: 100%;
      height: 4px;
      border-radius: 3px;
      background: rgba(255, 255, 255, 0.3);
    }
    .vseek-fill {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      border-radius: 3px;
      background: var(--upc-accent, var(--primary-color, #03a9f4));
    }
    .vseek-knob {
      position: absolute;
      top: 50%;
      width: 13px;
      height: 13px;
      border-radius: 50%;
      background: #fff;
      transform: translate(-50%, -50%);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.55);
    }
    /* Phone: the seek bar is crushed inline between the buttons on a narrow
       video, so give it its own FULL-WIDTH row ABOVE the button row (YouTube /
       Plex style). Tablet/desktop keep the single inline row (they have room). */
    :host([stacked]) .vctrl {
      flex-wrap: wrap;
      /* Roomier controls on phones: inset the buttons/seek from the edges. The
         gradient background still spans the whole bar (it's .vctrl's own
         background), so it stays anchored to the bottom edge. */
      padding: 12px 22px 22px;
      gap: 6px;
    }
    /* The seek row is the full first line ABOVE the buttons; inside it the time
       readout sits at the left and the seek bar fills the rest (YouTube style),
       so the bar stays wide/usable instead of being crushed inline. */
    :host([stacked]) .vseek-row {
      display: flex;
      align-items: center;
      flex: 1 0 100%;
      order: -1;
      margin: 0 2px 4px;
    }
    :host([stacked]) .vseek-row .vtime {
      margin: 0 8px 0 2px;
    }
    :host([stacked]) .vseek-row .vseek {
      flex: 1 1 auto;
      margin: 0;
    }
    /* Mobile LANDSCAPE fullscreen (the rotated top-layer dialog): the control
       bar runs along the physical screen edge and its ends land under the iOS
       status bar / home-indicator (notch side). Inset it a LOT more
       horizontally so no control sits under the status bar. The gradient still
       spans the whole bar (its own background) — only the buttons move in. */
    :host([stacked]) .fs-wrap.fs-active .vctrl {
      padding: 14px 76px 30px;
    }
    .dl {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }
    .dl-bar {
      width: 55%;
      max-width: 260px;
      height: 5px;
      border-radius: 3px;
      overflow: hidden;
      background: rgba(255, 255, 255, 0.2);
    }
    .dl-fill {
      height: 100%;
      background: var(--upc-accent, var(--primary-color, #03a9f4));
      transition: width 0.1s linear;
    }
    .dl-pct {
      color: #fff;
      font-size: 13px;
      font-weight: 600;
    }
    .overlay {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 13px;
      text-align: center;
      padding: 12px;
      pointer-events: none;
    }
    .clip-status {
      z-index: 4;
      background: #000;
    }
    .clip-buffering {
      z-index: 4;
      background: transparent;
      opacity: 0;
      animation: upc-buffer-reveal 0s linear 1.2s forwards;
    }
    .spinner {
      width: 28px;
      height: 28px;
      border: 3px solid rgba(255, 255, 255, 0.25);
      border-top-color: var(--upc-accent, var(--primary-color, #03a9f4));
      border-radius: 50%;
      animation: upc-spin 0.8s linear infinite;
    }
    .clip-buffering .spinner {
      width: 40px;
      height: 40px;
      border-width: 4px;
      border-color: rgba(255, 255, 255, 0.28);
      border-top-color: var(--upc-accent, var(--primary-color, #03a9f4));
      border-right-color: var(--upc-accent, var(--primary-color, #03a9f4));
      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.8));
      animation-duration: 0.7s;
    }
    @keyframes upc-spin {
      to {
        transform: rotate(360deg);
      }
    }
    @keyframes upc-buffer-reveal {
      to {
        opacity: 1;
      }
    }
    .msg {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--secondary-text-color, #9aa0a6);
      font-size: 13px;
      text-align: center;
      padding: 12px;
    }
    .error {
      color: var(--error-color, #e53935);
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('fullscreenchange', this._onFsChange);
    // Keep the controls alive while ANYTHING in here is being touched. Bound on
    // the host in the CAPTURE phase on purpose: the overlay timeline's zoom
    // slider and its +/− buttons stop their own pointer events (they must not
    // reach the scrub gestures underneath), so a bubble-phase listener never
    // sees them — and the bar, plus the strip holding the slider, would fade
    // out mid-drag.
    this.addEventListener('pointerdown', this._keepCtrlAlive, true);
    this.addEventListener('pointermove', this._keepCtrlAlive, true);
    // Silence playback when the card is HIDDEN without being unmounted — a
    // hosting Bubble-Card popup on the tablet "closes" by display:none'ing the
    // card (disconnectedCallback never fires), so the live stream / clip keeps
    // decoding + playing AUDIO behind the dismissed popup. A display:none (or
    // scrolled-away) host reports zero intersection → mute + pause everything;
    // becoming visible again re-asserts live.
    this._visObserver = new IntersectionObserver(
      (entries) => this._onHostVisibility(entries[entries.length - 1].isIntersecting),
      { threshold: 0 },
    );
    this._visObserver.observe(this);
    // HA's player elements are defined lazily; loading card helpers pulls in
    // the camera stream module and its HLS/WebRTC player dependencies.
    const playersReady = (): boolean =>
      !!customElements.get('ha-hls-player') &&
      !!customElements.get('ha-web-rtc-player') &&
      !!customElements.get('ha-camera-stream');
    if (playersReady()) {
      this._streamReady = true;
    } else {
      const load = (window as unknown as { loadCardHelpers?: () => Promise<unknown> })
        .loadCardHelpers;
      load?.().then(() => {
        this._streamReady = playersReady();
      });
      Promise.all([
        customElements.whenDefined('ha-hls-player'),
        customElements.whenDefined('ha-web-rtc-player'),
        customElements.whenDefined('ha-camera-stream'),
      ]).then(() => {
        this._streamReady = true;
      });
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._resetAudioSession();
    clearTimeout(this._hideTimer);
    clearTimeout(this._followCtrlTimer);
    clearTimeout(this._scrubFineTimer);
    clearTimeout(this._livePreviewWarmTimer);
    this._releaseFrame(); // stop the held-frame watcher's rAF loop
    document.removeEventListener('fullscreenchange', this._onFsChange);
    this.removeEventListener('pointerdown', this._keepCtrlAlive, true);
    this.removeEventListener('pointermove', this._keepCtrlAlive, true);
    this._visObserver?.disconnect();
    this._visObserver = undefined;
    this._stopLivePoll();
    this._cancelLoad(); // don't leave an NVR export running for a dead view
    this._stopFollow();
    this._setClipSrc();
    this._resetPreviewSlots();
    this._preview.destroy(); // revoke cached preview blobs
    // Dropping the elements doesn't stop them: a detached <video> keeps its
    // decoder and MediaSource, and HA caches the view so it is never collected.
    // Costs nothing on Chromium; on iOS it is the difference between the next
    // view getting a media pipeline and coming up black. See media-release.ts.
    releaseVideosIn(this.renderRoot as unknown as DocumentFragment);
  }

  protected willUpdate(changed: PropertyValues): void {
    // Start the actual media element muted while keeping the outer WebRTC
    // player audio-enabled so it retains the incoming Opus track.
    if (
      this.live &&
      (changed.has('live') ||
        changed.has('_streamReady') ||
        changed.has('cameraId') ||
        changed.has('liveTransport') ||
        changed.has('liveBridgeCameraId'))
    ) {
      this._resetLiveSession();
    }
    // HOLDFRAME-2026-08-05c: CAPTURE THE HELD FRAME FIRST — before anything
    // below tears the outgoing player down. `releaseVideosIn` sets srcObject to
    // null and calls load(), which drops the element to readyState 0 /
    // videoWidth 0, so a _holdFrame() running after it finds an EMPTY video and
    // captures nothing. That ordering is what made the first scrub away from
    // live flash black: traced it as `deepVideoFound: true, readyState: 0,
    // videoWidth: 0` at the moment of the hold. The frame has to be copied
    // while it still exists.
    const enteringBoundedClip =
      this.clipEndTime > 0 &&
      (changed.has('clipEndTime') || changed.has('targetTime') || changed.has('cameraId'));
    if (enteringBoundedClip) {
      // A clip has an honest preparation screen. Never cover it with a frame
      // from LIVE, delayed history, or the previously selected event.
      this._releaseFrame();
    } else if (
      changed.has('scrubbing') ||
      changed.has('live') ||
      changed.has('cameraId') ||
      (changed.has('targetTime') && !this.scrubbing && !this.live)
    ) {
      // Leaving a scrub: the sprite canvas is what is currently on screen.
      const leavingScrub = changed.has('scrubbing') && !this.scrubbing;
      // Poster rule, stated as simply as it can be: the camera snapshot is the
      // fallback for EVERY transition except leaving a scrub. Leaving a scrub is
      // the one case where a snapshot of NOW would be a lie (the user scrubbed
      // to 07:17) AND the one case where we already have the truthful frame in
      // the sprite canvas. Everywhere else — entering a scrub, going to live —
      // the outgoing picture is live, so a live snapshot IS the honest stand-in.
      // Deliberately not derived from `changed.get('live')`: the card can flip
      // live in a separate update from scrubbing, so that test silently failed
      // and left the first scrub with nothing to show but black.
      this._holdFrame(leavingScrub, !leavingScrub);
    }
    // Leaving live (or switching camera) unmounts the explicit player. Release
    // it HERE, while it is still in the tree — by updated() Lit has already
    // dropped the element and the live pipeline would be stranded, holding a
    // decoder that the scrub preview and clip playback then have to compete
    // with. On iOS that competition is what left the stage black.
    if ((changed.has('live') && !this.live) || changed.has('cameraId')) {
      this._livePlayerGeneration++;
      releaseVideosIn(this.renderRoot?.querySelector('.live-stage'));
    }
    // A new camera at the SAME timestamp is still a new load: the dedup below
    // keys only on the time, so without this the switch showed nothing.
    if (changed.has('cameraId')) this._loadedForTime = undefined;
    // BUGFIX-POSTER-2026-08-04 / HOLDFRAME-2026-08-05: the warm-poster cache is
    // gone entirely (see _holdFrame), so there is nothing camera-scoped left to
    // go stale here. Kept as a belt-and-braces clear of any in-flight hold, so
    // a still captured from the previous camera can never survive a switch.
    if (changed.has('cameraId')) {
      this._holdPoster = '';
      this._posterPreload = '';
      this._posterAt = 0;
    }
    // Same trap, on the hottest path in the card. A scrub swaps the follow
    // slots out for the preview slots and swaps them back when the gesture
    // ends, so ONE PAIR IS REMOVED FROM THE TREE ON EVERY SCRUB — and removal
    // frees nothing. Measured here: twelve scrub gestures left 46 detached
    // <video> elements, not one of them back at NETWORK_EMPTY and half still
    // sitting at readyState 4 holding a decoded stream. Chromium has no
    // practical limit so the tablet never showed it; iOS caps concurrent media
    // pipelines, and once a few dozen orphans have eaten them the player wedges
    // with the controls hidden and no way out but killing the app. Release the
    // outgoing pair here, while it is still reachable — by updated() Lit has
    // already dropped it. (The pair being swapped IN isn't in the DOM yet, so
    // its @query is undefined and it is left alone.)
    // Hold the last frame across every source change on this stage: starting a
    // scrub (live/follow -> cached preview), ending one (preview -> a fresh NVR
    // export), a 15s skip, live<->historical, or a camera switch. NOT on every
    // targetTime tick DURING a scrub — the preview is meant to move with the
    // finger, and freezing it would defeat the whole scrub preview.
    // BUGFIX-POSTER-2026-08-04: drop any hold still up from the PREVIOUS camera
    // before re-capturing. _holdFrame() bails out early ("already holding and
    // nothing better to copy") when it can't reach a painting video — which is
    // exactly the state a camera switch leaves behind, since the outgoing
    // <ha-camera-stream> was just released above. Without this, a hold captured
    // from camera 1 survived the switch and every subsequent hold on camera 2
    // re-armed the same stale frame instead of replacing it. Releasing and
    // re-capturing in the same synchronous pass means no paint happens in
    // between, so this cannot reintroduce the black flash.
    // Revert: delete these two lines.
    // The hold is now captured at the TOP of willUpdate, before any teardown —
    // this only drops one belonging to the camera being switched away from.
    if (changed.has('cameraId')) this._releaseFrame();
    if (changed.has('scrubbing')) {
      const outgoing = this.scrubbing
        ? [this._followVidA, this._followVidB]
        : [this._previewVidA, this._previewVidB];
      for (const v of outgoing) if (v) releaseVideo(v);
    }
  }

  // ---- hidden-but-not-unmounted teardown ----------------------------------
  private _visObserver?: IntersectionObserver;
  @state() private _hidden = false;

  private _onHostVisibility(visible: boolean): void {
    if (visible === !this._hidden) return; // no state change
    this._hidden = !visible;
    if (this._hidden) {
      this._resetAudioSession();
      this._muteAndPauseAll();
      if (this._liveStream) this._restartLivePlayer();
    }
    else this._resumeAfterVisible();
  }

  /** Silence + pause EVERY player (live stream's inner <video>, clip, follow,
   *  preview) so nothing plays audio while the card is hidden. */
  private _muteAndPauseAll(): void {
    this._stopLivePoll();
    const vids = new Set([
      this._liveVideo(),
      this._highLiveVideo(),
      this._bridgeLiveVideo(),
      this._video,
      this._followVidA,
      this._followVidB,
      this._previewVidA,
      this._previewVidB,
    ]);
    for (const v of vids) {
      if (!v) continue;
      v.muted = true;
      try {
        v.pause();
      } catch {
        /* ignore */
      }
    }
  }

  /** Re-shown after being hidden: re-assert LIVE playback. Restore the user's
   *  mute preference and resume playing — UNLESS the user had deliberately
   *  paused live before the hide (`_livePausedState`, untouched by the forced
   *  hide-pause since the poll was stopped). Play DIRECTLY here rather than via
   *  _hideLiveTimeline: restarting the poll re-reports the still-paused frame as
   *  a pause, which would gate _hideLiveTimeline's own resume. Historical clips
   *  stay paused — we don't auto-resume a clip the user didn't return to. */
  private _resumeAfterVisible(): void {
    if (!this._liveStream) return;
    const v = this._liveVideo();
    if (v) {
      v.muted = this._liveMuted;
      if (!this._livePausedState && v.paused) v.play?.().catch(() => undefined);
    }
    this._startLivePoll();
    this._hideLiveTimeline();
  }

  private _hideTimer?: ReturnType<typeof setTimeout>;

  /**
   * Best-effort: hide the seek bar in the live stream's (nested-shadow) <video>
   * by injecting a style into its shadow root. The video loads async, so retry.
   */
  private _hideLiveTimeline(attempt = 0): void {
    clearTimeout(this._hideTimer);
    const video = this._liveVideo();
    if (video) {
      // Apply the selected mute state to whichever HA transport is visible and
      // keep autoplay asserted unless the user explicitly paused it.
      if (this._liveMuted !== video.muted) video.muted = this._liveMuted;
      if (!this._livePausedState && video.paused) {
        video.play?.().catch(() => {
          /* blocked pre-gesture; user can unmute/tap */
        });
      }
      // Hide the seek bar once.
      const root = video.getRootNode();
      if (root instanceof ShadowRoot && !root.querySelector('style[data-upc-hidebar]')) {
        const style = document.createElement('style');
        style.setAttribute('data-upc-hidebar', '1');
        style.textContent =
          'video::-webkit-media-controls-timeline,' +
          'video::-webkit-media-controls-current-time-display,' +
          'video::-webkit-media-controls-time-remaining-display{display:none!important}';
        root.appendChild(style);
      }
    }
    // Keep re-checking for ~3s: catches the async-created <video> AND counters
    // the stream re-muting itself during startup.
    if (attempt < 12) {
      this._hideTimer = setTimeout(() => this._hideLiveTimeline(attempt + 1), 250);
    }
  }

  // --- live play/pause detection (POLLING, not events) ---------------------
  // <ha-camera-stream> is a black box we mount/unmount constantly; binding
  // `pause`/`play` listeners misses events when the inner <video> is recreated
  // or initializes slowly (low-end tablet), leaving the card thinking live is
  // still playing -> the playhead/LIVE marker drifts ahead of a paused frame.
  // Polling the actual `.paused` property is immune to all of that.
  private _livePollTimer?: ReturnType<typeof setInterval>;
  private _lastLivePlaying?: boolean;

  private _startLivePoll(): void {
    this._stopLivePoll();
    this._resetLiveHealth();
    this._lastLivePlaying = undefined; // fresh mount -> re-report initial state
    // 250ms: cheap (trivial DOM reads), catches a frozen live HLS pipeline
    // quickly, and freezes the card's 1s playhead before it can step ahead.
    this._livePollTimer = setInterval(() => this._pollLive(), 250);
    this._pollLive();
  }

  private _stopLivePoll(): void {
    clearInterval(this._livePollTimer);
    this._livePollTimer = undefined;
  }

  private _pollLive(): void {
    const player = this.renderRoot.querySelector('.live-player') as HaLivePlayerElement | null;
    if (
      player &&
      shouldRetryLiveStartup(
        player._error,
        !!player._errorIsFatal,
        this._liveStartupAttempts,
        performance.now() - this._liveMountedAt,
      )
    ) {
      this._restartLivePlayer(true);
      return;
    }
    const video = this._liveVideo();
    if (!video) return; // not ready yet — keep last known state, try again next tick
    const highVideo = this._highLiveVideo();
    if (video.muted !== this._liveMuted) video.muted = this._liveMuted;
    this._reportLivePlaying(!video.paused);
    const monitoredVideo = this._useWebRtcLive ? highVideo : video;
    if (!monitoredVideo) return;
    const health = this._liveHealth.sample({
      identity: monitoredVideo,
      nowMs: performance.now(),
      currentTime: liveProgressValue(monitoredVideo, this._useWebRtcLive),
      readyState: monitoredVideo.readyState,
      paused: monitoredVideo.paused,
      seeking: monitoredVideo.seeking,
      videoWidth: monitoredVideo.videoWidth,
    });
    if (this._useWebRtcLive && health.stable && !this._highLiveReady) {
      releaseVideosIn(this.renderRoot.querySelector('.live-bridge'));
      this._highLiveReady = true;
    }
    if (health.stable) this._liveStartupAttempts = 0;
    if (health.stable) this._scheduleLivePreviewWarm();
    if (health.stalled && !monitoredVideo.paused && !this._livePausedState) {
      this._restartLivePlayer();
      return;
    }
    if (
      shouldAttemptLiveAudio(
        this.liveAudioStart,
        this._audioUserChoice,
        this._liveAudioAttempted,
        health.stable,
      )
    ) {
      void this._tryAutoLiveAudio(monitoredVideo);
    }
  }

  private _reportLivePlaying(playing: boolean): void {
    if (playing === this._lastLivePlaying) return;
    this._lastLivePlaying = playing;
    this._livePausedState = !playing; // drives the custom control's play/pause icon
    this.dispatchEvent(
      new CustomEvent('live-playing', {
        detail: { playing },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private get _liveStream(): boolean {
    return this.live && this._streamReady;
  }

  private get _useWebRtcLive(): boolean {
    return shouldUseWebRtcLive(this.liveTransport, {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      maxTouchPoints: navigator.maxTouchPoints,
    });
  }

  protected firstUpdated(): void {
    // Display the always-present player dialog inline. Set the `open` PROPERTY
    // (not show()) so it displays in flow WITHOUT the dialog focusing steps —
    // otherwise it would steal focus to the first control on every mount.
    if (this._fsDlg) this._fsDlg.open = true;
    // Opened for a grid-tile fullscreen: go straight to fullscreen.
    if (this.startFs) {
      if (this.stacked) {
        this._forceRotate = window.innerHeight > window.innerWidth;
        this._isFs = true;
      } else {
        void this.requestFullscreen?.().catch(() => undefined);
      }
    }
  }

  protected updated(changed: PropertyValues): void {
    if (this._liveStream) this._armLivePlayer();
    // While hidden, <ha-camera-stream> can re-assert its own autoplay on any
    // re-render (a hass tick) — keep re-silencing it so no audio leaks behind a
    // closed popup until we're visible again.
    if (this._hidden) {
      const lv = this._liveVideo();
      if (lv && (!lv.paused || !lv.muted)) {
        lv.muted = true;
        try {
          lv.pause();
        } catch {
          /* ignore */
        }
      }
    }
    if (changed.has('_isFs') && this.stacked) this._syncFsDialog();
    // HOLDFRAME-2026-08-05d: keep the poster preload warm ONLY while live is on
    // screen, and only every POSTER_REFRESH_MS so it costs one small fetch every
    // ten seconds rather than one per state update (entity_picture's token
    // changes constantly, which is why the original code latched it forever).
    if (this._liveStream && Date.now() - this._posterAt > POSTER_REFRESH_MS) {
      this._posterAt = Date.now();
      const url = this._posterUrl();
      if (url) this._posterPreload = url;
    }
    // HOLDFRAME-2026-08-05: the warm-poster LATCH is gone. It cached one still
    // for the life of the card, which is exactly how a stale (and, before the
    // camera-switch fix, wrong-camera) frame could be shown long after it
    // stopped being true. The fallback is now resolved fresh at capture time.
    // (Cost: the first poster fallback may fetch, i.e. show black a moment
    // longer. That is strictly better than showing something untrue.)
    // The strip's `pointer-events: none` does NOT make it inert. pointer-events
    // is INHERITED, so a descendant that sets `auto` re-enables ITSELF whatever
    // its ancestors say — and .evt-wrap (the event thumbnail) does exactly that.
    // Result: with the chrome hidden, a tap on the invisible strip where a
    // thumbnail happens to sit still seeked to that event. No outside CSS can
    // beat that `auto`, and the rule is inside the timeline's shadow root, so
    // the fix is the one switch that covers a whole subtree including shadow
    // DOM: the native `inert` attribute on the slotted timeline itself.
    // (_fsStrip is a getter, so it never shows up in `changed` — _isFs is the
    // reactive one, and it covers the moment the strip is first mounted.)
    if (changed.has('_followCtrl') || changed.has('_isFs')) {
      for (const el of this.querySelectorAll('[slot="fs-timeline"]'))
        el.toggleAttribute('inert', !this._followCtrl);
    }
    // Grid-tile fullscreen was left -> tell the multi page to unmount us.
    if (changed.has('_isFs') && changed.get('_isFs') === true && !this._isFs && this.startFs) {
      this.dispatchEvent(new CustomEvent('fs-exit', { bubbles: true, composed: true }));
    }
    // Auto-hide vs scrubbing. Keyed off the `scrubbing` PROP, not off pointer
    // events on the strip: a trackpad/wheel scrub produces no pointer traffic at
    // all, so an already-armed timer would fire mid-gesture and take the
    // controls — and the timeline being scrubbed — with it.
    if (changed.has('scrubbing')) {
      clearTimeout(this._scrubFineTimer);
      this._scrubFineTimer = undefined;
      if (!this.scrubbing) {
        // SPRITE-PREVIEW-2026-08-04: kill the sheet download tail the moment the
        // gesture ends. A fast drag queues tens of MB of sheets and they kept
        // arriving after the user had gone back to LIVE — measured 27 MB landing
        // post-gesture — starving an HLS stream that runs on a ~2 s buffer. That
        // was the "live stutters after scrubbing" regression. Aborting is free:
        // the sheets are immutable and long-cached, so anything still needed
        // re-fetches, usually straight from the HTTP cache.
        this._preview.abortSheets();
      }
      if (this.scrubbing) {
        clearTimeout(this._followCtrlTimer); // a scrub in flight holds them open
      } else if (this._followCtrl) {
        // Settled — re-arm, but only if they were already up (scrubbing the
        // card's own timeline column must not pop the player's controls open).
        this._showFollowCtrl();
      }
    }
    // Let the host mount/unmount its slotted overlay timeline, and tell it
    // whether we CSS-rotated the player (the scrubber's drag axis rotates with
    // it — see its `rotated` property).
    if (changed.has('_isFs') || changed.has('_forceRotate')) {
      this.dispatchEvent(
        new CustomEvent('fs-change', {
          detail: { fs: this._isFs, rotated: this._isFs && this._forceRotate },
          bubbles: true,
          composed: true,
        }),
      );
    }
    if (!this.hass || !this.nvrId || !this.cameraId) return;
    // --- preview lifecycle: runs even while LIVE is on screen ----------------
    // Both of these used to sit BELOW the `_liveStream` early return, so on a
    // card that opens on live (every mobile camera view) they only ran once the
    // first drag MOTION had already left live — putting the whole cold-start
    // fetch chain on the gesture's critical path.
    if (changed.has('previewDir')) {
      // Camera switch: the loader resets (revoking its blobs), so the shown
      // preview frame belongs to the old camera — drop it, and abandon the old
      // camera's follow chain. Block keys are camera-independent (`b<start>`),
      // so a slot left over from the previous camera would otherwise be
      // mistaken for a hit on the new one.
      this._resetPreviewSlots();
      this._previewToken++;
      this._stopFollow();
      void this._warmPreview();
    }
    // `scrub-start` fires on pointer-DOWN, before any motion has left live —
    // the earliest moment we know a scrub is coming.
    if (changed.has('scrubbing') && this.scrubbing) {
      // PERF-SCRUB-2026-08-03: every gesture starts settled, so the first
      // retarget can't inherit the previous fling's coarse latch (or measure a
      // bogus velocity across the gap between two gestures).
      this._scrubVelPrev = undefined;
      this._coarseScrub = false;
      clearTimeout(this._scrubFineTimer);
      this._scrubFineTimer = undefined;
      // SPRITE-PREVIEW-2026-08-04: the canvas is rebuilt (and therefore blank)
      // for each gesture, so hide it until it holds a frame — otherwise the
      // first moments of a scrub would show black instead of the held still.
      this._spriteReady = false;
      void this._warmPreview();
    }
    if (this._liveStream) {
      // <ha-camera-stream> renders the live feed; hide its seek bar (live has no
      // meaningful progress) while keeping play/volume/mute/fullscreen, and poll
      // its play/pause so the card can freeze the playhead when paused.
      if (changed.has('live') || changed.has('_streamReady')) {
        this._cancelLoad(); // back to live: stop any historical export in flight
        this._stopFollow();
        this._hideLiveTimeline();
        this._startLivePoll();
        this._flashFollowCtrl(); // flash the custom controls so they're discoverable
      }
      return;
    }
    // Not showing the live stream anymore — stop watching its play state.
    this._stopLivePoll();
    if (changed.has('scrubbing') && this.scrubbing) {
      // Scrubbing started: the current clip is dead the moment the timeline
      // moves — stop playback and drop its src (the browser aborts the stream,
      // which also cancels the NVR-side export).
      this._cancelLoad();
      this._stopFollow();
      this._setClipSrc();
      this._loadedForTime = undefined;
      this._loadingVideo = false;
      this._error = undefined;
      void this._updatePreview();
      return;
    }
    if (this.scrubbing) {
      // While scrubbing the stage shows cached timelapse frames (no NVR calls);
      // every playhead move retargets the preview.
      if (changed.has('targetTime') || changed.has('previewDir')) void this._updatePreview();
      return;
    }

    if (this.live) {
      // Live but no stream element available -> trailing export window at now.
      if (changed.has('live') || changed.has('_streamReady') || changed.has('scrubbing')) {
        void this._loadSegment(this.now, true);
      }
    } else if (
      changed.has('scrubbing') ||
      changed.has('targetTime') ||
      changed.has('live') ||
      changed.has('cameraId')
    ) {
      // Start a fresh playback at the chosen time (dedup identical times).
      // A `gap` no longer SKIPS the export. The gaps come from the camera
      // entity's `unavailable` history, and that is not the same fact as "the
      // NVR recorded nothing": measured on this NVR, two cameras went
      // unavailable and came back within 14ms of each other while recording
      // continued throughout — an integration/NVR-link blip, not an outage.
      // Refusing to load made that footage unreachable in the card even though
      // it plays fine in the UniFi app. The NVR is the only authority on what it
      // holds, so always ask it; if it really has nothing, the export fails and
      // render() shows the offline message anyway — accurate by construction.
      if (this._loadedForTime !== this.targetTime) {
        this._loadedForTime = this.targetTime;
        if (this.clipEndTime > this.targetTime + 500) {
          // Bounded event clip — play exactly [start, event end] in one video.
          this._stopFollow();
          void this._loadSegment(this.targetTime);
        } else {
          // Continuous DELAYED-FOLLOW from the chosen time: hold ~delaySeconds
          // behind live via gapless leap-frogged chunks. Never jumps to live.
          this._cancelLoad();
          this._setClipSrc();
          void this._startFollow(this.targetTime);
        }
      }
    }
  }

  // ---- scrub preview --------------------------------------------------------

  /** The FINE unit covering `t`: a plain block, or — for blocks split at
   *  event boundaries — the covering PART file (resolved via the sidecar map). */
  private async _resolveFine(t: number): Promise<PreviewBlock | undefined> {
    const ab = this._preview.blockFor(t);
    if (!ab) return undefined;
    return ab.mapped ? this._preview.resolvePart(ab, t) : ab;
  }

  /** The best unit available for `t` RIGHT NOW — level of detail, not a fixed
   *  tier.
   *
   *  A drag across hours crosses dozens of 10-minute blocks; only the ones the
   *  playhead lingers in ever get fetched, so the stage used to hold a single
   *  frozen frame for the whole gesture. The hour-long overview units are a
   *  fraction of the bytes and can be kept warm, so if the fine unit isn't in
   *  hand yet we show the overview immediately and let the fine download
   *  continue underneath. The upgrade needs no extra machinery: an overview
   *  block is just another PreviewBlock, so the existing a/b leap-frog stages,
   *  seeks and promotes it exactly like any other, and the fine unit replaces
   *  it through the standby slot the moment it arrives. */
  /** PERF-SCRUB-2026-08-03: sample the playhead's speed and latch whether the
   *  fine tier can keep up. Called EXACTLY ONCE per retarget, from
   *  _updatePreview — _resolvePlayable is called twice per retarget (once to
   *  pick a unit, once to re-check it after a download), and sampling there
   *  would feed it a zero-delta second sample and drop straight back out of
   *  coarse mode. */
  private _updateScrubSpeed(t: number): void {
    const now = performance.now();
    const prev = this._scrubVelPrev;
    this._scrubVelPrev = { t, at: now };
    const dw = prev ? now - prev.at : 0;
    // footage-ms per wall-ms == multiples of realtime
    const vel = prev && dw > 0 && dw <= SCRUB_VEL_STALE_MS ? Math.abs(t - prev.t) / dw : 0;
    // Direction of travel, held across a pause (a still finger keeps the last
    // heading rather than resetting the prefetch to "forward").
    if (prev && t !== prev.t) this._scrubDir = t > prev.t ? 1 : -1;
    if (this.fastPreview === 'off') {
      this._coarseScrub = false;
      return;
    }
    if (this.fastPreview === 'always') {
      this._coarseScrub = !!prev && t !== prev.t && dw > 0 && dw <= SCRUB_VEL_STALE_MS;
      return;
    }
    const blockMs = this._preview.blockMs();
    this._coarseScrub = this._coarseScrub
      ? vel > blockMs / COARSE_EXIT_MS
      : vel > blockMs / COARSE_ENTER_MS;
  }

  private _scheduleFineScrubUpgrade(): void {
    clearTimeout(this._scrubFineTimer);
    this._scrubFineTimer = undefined;
    if (!this._coarseScrub || !this.scrubbing) return;
    this._scrubFineTimer = setTimeout(() => {
      this._scrubFineTimer = undefined;
      if (this.scrubbing) void this._updatePreview();
    }, SCRUB_VEL_STALE_MS + 25);
  }

  private async _resolvePlayable(t: number): Promise<PreviewBlock | undefined> {
    // PERF-SCRUB-2026-08-03: moving faster than a fine unit can be staged —
    // serve the coarse overview hour instead. Checked BEFORE the tip/fine
    // tiers because at this speed neither of them can promote in time.
    // Revert: delete this block (the tier logic below is untouched).
    if (this._coarseScrub) {
      const over = this._preview.overviewBlockFor(t);
      if (over) {
        if (this._unitReady(over)) return over;
        this._prefetchUnit(over);
        // Its bytes aren't here yet. Restaging a fine unit we can't promote
        // would just churn the slots, so hold the frame already on screen and
        // let the overview take over when it lands. Only once something IS on
        // screen — an empty stage must fall through and show whatever it can.
        // SPRITE-PREVIEW-2026-08-04: holding is a VIDEO-mode optimisation —
        // restaging a <video> that can't be promoted in time is expensive, so
        // keeping the last frame is the lesser evil. A sprite draw is nearly
        // free, so holding there just freezes the preview: hand the coarse unit
        // back instead and let _drawSprite paint it the moment its sheet lands.
        // Returning the unit (rather than falling through to the fine tier) is
        // also what keeps the fetch count sane — one overview sheet covers
        // ~12.8 min of footage against a fine sheet's 60 s.
        if (this._useSprites()) return over;
        if (this._previewActive) return undefined;
      }
      // No overview coverage at all (the current incomplete hour): fall through
      // to the normal tiers rather than freezing.
    }
    // EXPERIMENTAL tip tier: the on-demand real-time clip of the newest ~minute
    // beats everything inside its own range (~30fps vs one frame per 2.4s) and
    // reaches ~2s behind live instead of the head's 10-70s. Checked before the
    // fine unit, but only served once its bytes are in hand — otherwise a fast
    // drag near live would sit on a 0.9 MB download instead of showing the
    // block it already has.
    const tip = this._preview.tipBlockFor(t, this._preview.headEnd());
    if (tip) {
      if (this._preview.isCached(tip)) return tip;
      // Re-resolve once the bytes land. Without this the upgrade only arrived
      // if the pointer happened to keep moving (an unchanged targetTime is not
      // a Lit update, so _updatePreview never re-ran) — holding still near the
      // live edge is exactly when the user is waiting for it.
      void this._preview.getBlock(tip).then((url) => {
        if (url && this.scrubbing) void this._updatePreview();
      });
    }
    const fine = await this._resolveFine(t);
    if (fine && this._unitReady(fine)) return fine;
    const over = this._preview.overviewBlockFor(t);
    if (over && this._unitReady(over)) {
      if (fine) this._prefetchUnit(fine); // keep upgrading underneath
      return over;
    }
    // Neither in hand: prefer the fine unit (its download is what _updatePreview
    // is about to debounce), falling back to the overview where there is no
    // fine coverage at all.
    return fine ?? over;
  }

  // ---- sprite tier (SPRITE-PREVIEW-2026-08-04) ------------------------------

  /** Whether the scrub preview paints from JPEG mosaics rather than by seeking
   *  a <video>. 'auto' defers to what this device measured (see _noteSeek). */
  private _useSprites(): boolean {
    if (this.previewMode === 'sprites') return true;
    if (this.previewMode === 'video') return false;
    return this._autoSprites;
  }

  private _spriteVariants(b: PreviewBlock): SpriteVariant[] {
    return spriteVariantOrder(
      this._coarseScrub,
      this._preview.hasSprites(b),
      this._preview.hasFastSprites(b),
    );
  }

  private _spriteIfLoaded(b: PreviewBlock, variant: SpriteVariant): SpriteSet | undefined {
    return variant === 'fast'
      ? this._preview.fastSpriteIfLoaded(b)
      : this._preview.spriteIfLoaded(b);
  }

  private _getSprite(b: PreviewBlock, variant: SpriteVariant): Promise<SpriteSet | undefined> {
    return variant === 'fast' ? this._preview.getFastSprite(b) : this._preview.getSprite(b);
  }

  private async _preferredSprite(
    b: PreviewBlock,
  ): Promise<{ set: SpriteSet; variant: SpriteVariant } | undefined> {
    for (const variant of this._spriteVariants(b)) {
      const set = await this._getSprite(b, variant);
      if (set) return { set, variant };
    }
    return undefined;
  }

  /** Feed one observed seek latency into the 'auto' decision.
   *
   *  Measuring beats sniffing here: the Android tablet this tier exists for
   *  reports a DESKTOP Linux user agent (Chrome's desktop-site mode), so a
   *  platform check fails on the exact device that needs it — while a Mac or
   *  iPhone seeks in ~10 ms and can never cross the threshold no matter what it
   *  claims to be. One-way on purpose: a device that has proved slow shouldn't
   *  flip back mid-session on one lucky sample. */
  private _noteSeek(ms: number): void {
    if (this._autoSprites || this.previewMode !== 'auto') return;
    this._seekSamples.push(ms);
    if (this._seekSamples.length < SEEK_SAMPLE_MIN) return;
    if (this._seekSamples.length > SEEK_SAMPLE_MAX) this._seekSamples.shift();
    const sorted = this._seekSamples.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    if (median > SLOW_SEEK_MS) {
      this._autoSprites = true;
      this.requestUpdate();
    }
  }

  /** Paint the frame for `t` from the sprite sheets. Returns false when this
   *  unit has no atlas (tip, mapped part, or a block the job hasn't reached),
   *  so the caller can fall back to the video path for it. */
  private async _drawSprite(b: PreviewBlock, t: number): Promise<boolean> {
    const preferred = await this._preferredSprite(b);
    if (!preferred) return false;
    const { set } = preferred;
    const per = set.cols * set.rows;
    const token = this._spriteToken; // bumped only on camera change / reset
    let idx = this._preview.tileIndexFor(b, set, t);
    const sheetIdx = Math.floor(idx / per);
    const sheetName = set.sheets[sheetIdx];
    if (!sheetName) return true; // covered by sheets, just not at this instant
    // Await only when the sheet isn't resident: an already-decoded one must
    // paint in the SAME task as the pointer move, or the preview lags a frame
    // behind the finger for no reason.
    let bmp = this._preview.hasSheet(sheetName)
      ? await this._preview.getSheet(sheetName)
      : undefined;
    if (!bmp) bmp = await this._preview.getSheet(sheetName);
    if (!bmp || !this.scrubbing || token !== this._spriteToken) return true;
    // MONOTONICITY RULE (both paths — even a resident sheet is fetched through
    // an await, so the playhead can move underneath either one).
    //
    // Re-resolve for where the playhead is NOW and paint only if that frame
    // still lives in THIS sheet. The previous version clamped to the nearest
    // tile in the sheet and accepted it whenever it was "closer than what's
    // shown" — which is what made the burned-in timestamp jump around, e.g.
    // 6:50:45 then 6:50:58 while dragging steadily in ONE direction, because a
    // late sheet could paint a frame that was not where the playhead was.
    // The rule is now absolute: EVERY painted frame is the frame for the
    // CURRENT playhead, so the preview can only move the way the finger moves.
    // If the playhead has left this sheet, drop the draw — the sheet it moved
    // into owns the next paint.
    idx = this._preview.tileIndexFor(b, set, this.targetTime);
    if (Math.floor(idx / per) !== sheetIdx) return true;
    const tile = this._preview.tileAt(set, idx);
    if (!tile) return true;
    const c = this._spriteCanvas;
    if (!c) return true;
    if (c.width !== set.tileW || c.height !== set.tileH) {
      c.width = set.tileW;
      c.height = set.tileH;
    }
    const ctx = c.getContext('2d');
    if (!ctx) return true;
    try {
      ctx.drawImage(bmp, tile.sx, tile.sy, set.tileW, set.tileH, 0, 0, set.tileW, set.tileH);
    } catch {
      return true; // bitmap closed under us by the LRU — next move repaints
    }
    if (!this._spriteReady) this._spriteReady = true;
    // The stage is showing a real frame now, so drop the held still that was
    // covering the transition. Without this the hold would sit on top of the
    // canvas for its full timeout, because the watcher only ever releases on a
    // painting <video> and in sprite mode there isn't one.
    if (this._frozen) this._releaseFrame();
    return true;
  }

  /** Keep the sheet covering `t` — and its neighbours — decoded, so continued
   *  dragging doesn't stall on a fetch. Fire-and-forget; the loader dedups and
   *  its LRU bounds the memory. */
  private async _warmSprites(b: PreviewBlock, t: number): Promise<void> {
    const preferred = await this._preferredSprite(b);
    if (!preferred) return;
    const { set } = preferred;
    const per = set.cols * set.rows;
    const span = b.end - b.start;
    if (span <= 0) return;
    const frac = Math.min(1, Math.max(0, (t - b.start) / span));
    const idx = Math.floor(Math.min(set.count - 1, Math.floor(frac * set.count)) / per);
    // How wide to warm depends on how fast the playhead is moving, because the
    // two failure modes pull in opposite directions:
    //   * sweeping fast, warming BOTH neighbours re-pulls the sheet just left
    //     behind on every move and thrashes the small LRU — measured 97 sheet
    //     fetches (~36 MB) in one 0.6 s drag for ~24 distinct sheets. A sweep is
    //     monotonic, so the one behind is exactly the one not needed again.
    //   * moving slowly, warming only ahead measurably COSTS smoothness (13
    //     distinct frames painted in a test drag fell to 5), because a small
    //     back-and-forth keeps landing on the sheet that was never warmed — and
    //     at this speed the whole gesture only touches a handful of sheets, so
    //     the extra one is nearly free.
    const ahead = this._scrubDir || 1;
    for (const i of this._coarseScrub ? [idx, idx + ahead] : [idx, idx - 1, idx + 1]) {
      const nm = set.sheets[i];
      // `true` = speculative: dropped rather than queued when downloads are
      // already saturated, so warming can never crowd out the sheet on screen
      // or the live stream.
      if (nm && !this._preview.hasSheet(nm)) void this._preview.getSheet(nm, true);
    }
  }

  /** Pull whichever representation of a unit this device will actually PAINT.
   *  SPRITE-PREVIEW-2026-08-04: without this, sprite mode still downloaded
   *  every ~490 KB mp4 block it flew over — bytes that can never reach the
   *  screen, and on the tablet the staging that comes with them is exactly the
   *  decoder work this tier exists to avoid. */
  private _prefetchUnit(b: PreviewBlock): void {
    if (this._useSprites() && this._spriteVariants(b).length) {
      void this._warmSprites(b, this.targetTime);
      return;
    }
    if (!this._preview.isCached(b)) void this._preview.getBlock(b);
  }

  /** "Already in hand", for whichever representation is in use — the tier
   *  choice in _resolvePlayable is about what can be shown WITHOUT waiting, and
   *  in sprite mode that is a decoded sheet, not an mp4 blob. */
  private _unitReady(b: PreviewBlock): boolean {
    if (this._useSprites() && this._spriteVariants(b).length) {
      for (const variant of this._spriteVariants(b)) {
        const set = this._spriteIfLoaded(b, variant);
        if (!set) continue;
        const tile = this._preview.tileFor(b, set, this.targetTime);
        if (tile && this._preview.hasSheet(tile.sheet)) return true;
      }
      return false;
    }
    return this._preview.isCached(b);
  }

  private _previewVideo(slot: 'a' | 'b'): HTMLVideoElement | undefined {
    return slot === 'a' ? this._previewVidA : this._previewVidB;
  }

  private _previewSrcOf(slot: 'a' | 'b'): string | undefined {
    return slot === 'a' ? this._previewSrcA : this._previewSrcB;
  }

  /** Pull the preview index (and the unit covering the playhead) into cache
   *  BEFORE a scrub needs it — on mount and on pointer-down.
   *
   *  A freshly mounted card has an empty loader, so the first drag had to fetch
   *  index.json, then any sidecar map, then the block itself, all serialized on
   *  the gesture's critical path; every step downstream is gated on `scrubbing`
   *  still being true, so on anything slower than a LAN the bytes landed after
   *  the gesture had already ended and the whole download was thrown away —
   *  the user had to scrub repeatedly before a frame appeared. The tablet never
   *  showed this because its card lives in a pop-up that is never unmounted, so
   *  the loader is warm from the first use onward; the phone opens a brand new
   *  view (and a brand new card) every time. */
  private async _warmPreview(): Promise<void> {
    if (!this.previewDir || !this.hass) return;
    this._preview.configure(this.hass, this.previewDir);
    // A gesture starting near the live edge is exactly when the cron head is
    // at its most stale, so ask the NVR for a fresh real-time clip NOW and let
    // it land mid-drag (~1.1s measured). Throttled inside the loader.
    this._preview.setTipEnabled(this.tipEnabled);
    this._preview.onTipUpdate = () => {
      if (this.scrubbing) void this._updatePreview();
    };
    // Only on a real gesture — _warmPreview also runs on MOUNT, and an NVR
    // export every time a view opens is pure waste when the user may never
    // scrub. The head still paints a frame immediately; the tip upgrades it.
    if (this.scrubbing && this.tipEnabled && this.targetTime > Date.now() - TIP_NEAR_LIVE_MS) {
      this._preview.requestTip();
    }
    await this._preview.ensureIndex(this.targetTime);
    // While live this is the small rolling head block — the exact unit a scrub
    // back from the live edge lands in.
    // SPRITE-PREVIEW-2026-08-04: on MOUNT (as opposed to at scrub-start) stop
    // here. Live is starting at this exact moment — ~8 Mbps with only a ~2 s
    // HLS buffer — and pulling preview units alongside it is enough to make it
    // stall on first open. `_warmPreview` runs again on scrub-start, so the
    // warming still happens, just not while live is fighting for the pipe.
    if (!this.scrubbing) return;
    const b = await this._resolveFine(this.targetTime);
    if (b) this._prefetchUnit(b); // sheets, not mp4
    // Plus the overview hour under the playhead: it is what a drag away from
    // here shows first, and it is cheap enough to hold speculatively.
    this._warmOverview(this.targetTime);
  }

  /** Keep the overview units around `t` in cache. Fire-and-forget; the loader
   *  dedups and its LRU bounds the memory. */
  private _warmOverview(t: number): void {
    const hour = 3_600_000;
    for (const at of [t, t - hour, t + hour]) {
      const o = this._preview.overviewBlockFor(at);
      if (o) this._prefetchUnit(o); // SPRITE-PREVIEW-2026-08-04: mode-aware
    }
  }

  private _scheduleLivePreviewWarm(): void {
    if (this._livePreviewWarmed || this._livePreviewWarmTimer !== undefined) return;
    this._livePreviewWarmTimer = setTimeout(() => {
      this._livePreviewWarmTimer = undefined;
      if (!this.live || this._hidden || this.scrubbing) return;
      this._livePreviewWarmed = true;
      void this._warmLiveFastPreview();
    }, 500);
  }

  private async _warmLiveFastPreview(): Promise<void> {
    if (!this.previewDir || !this.hass) return;
    this._preview.configure(this.hass, this.previewDir);
    await this._preview.ensureIndex(this.now);
    const block = await this._resolveFine(this.now);
    if (!block || !this._preview.hasFastSprites(block)) return;
    const set = await this._preview.getFastSprite(block);
    const tile = set ? this._preview.tileFor(block, set, this.now) : undefined;
    if (tile && !this._preview.hasSheet(tile.sheet)) {
      await this._preview.getSheet(tile.sheet);
    }
  }

  /** Point the preview at the unit covering targetTime: seek within the shown
   *  unit, or load the covering one into the STANDBY element and promote it
   *  once its frame has decoded — the active element never blanks. A time with
   *  no cached coverage keeps the last shown frame (UniFi-style). */
  private async _updatePreview(): Promise<void> {
    if (!this.previewDir || !this.hass) return;
    this._preview.configure(this.hass, this.previewDir);
    // Target time passed so a scrub in the head region gets the shorter,
    // non-blocking index refresh — that age is how far behind live it sits.
    await this._preview.ensureIndex(this.targetTime);
    // Dragging back INTO the live region mid-gesture (started in history, ended
    // near live) should also get a tip — _warmPreview only ran at pointer-down.
    if (this.tipEnabled && this.targetTime > Date.now() - TIP_NEAR_LIVE_MS) {
      this._preview.requestTip();
      void this._preview.ensureTip();
    }
    if (!this.scrubbing) return;
    // PERF-SCRUB-2026-08-03: latch the coarse/fine decision once per retarget,
    // before either _resolvePlayable call reads it.
    this._updateScrubSpeed(this.targetTime);
    this._scheduleFineScrubUpgrade();
    // Dragging leaves the current hour long before it leaves the current
    // block, so keep the overview neighbours warm on every retarget — that is
    // what makes a long fast drag keep showing frames instead of freezing.
    // PERF-SCRUB-2026-08-03: moved ABOVE the no-coverage return. A fling is
    // exactly when warming matters most, and it is also when _resolvePlayable
    // most often returns undefined (holding the frame while an overview hour
    // downloads) — so leaving this below the guard stopped the prefetching in
    // the one case it exists for. Revert: move it back under the `if (!b ...)`.
    this._warmOverview(this.targetTime);
    const b = await this._resolvePlayable(this.targetTime);
    if (!b || !this.scrubbing) return; // no coverage here — keep the last frame
    // SPRITE-PREVIEW-2026-08-04: decoder-free path. Returns false only when this
    // unit has no sheets (head/tip, or one the sync job hasn't reached), in
    // which case we fall through to the <video> tiers for it — so near-live
    // scrubbing and any gap in the cache still work exactly as before.
    if (this._useSprites()) {
      void this._warmSprites(b, this.targetTime);
      if (await this._drawSprite(b, this.targetTime)) return;
      // This unit has NO usable sheet (for example a tip or pre-activation
      // block), so the video tiers own the stage — the canvas has to get out
      // of the way. It sits above the preview <video>s and is opaque, so
      // leaving it up pinned the picture to the newest SPRITED frame while the
      // correct near-live footage rendered invisibly underneath. The newest
      // sprited frame is the end of the last COMPLETED block, i.e. 5-10 min
      // behind live, and no amount of scrubbing toward live could improve it:
      // exactly the "goes to minus 5-6 minutes and never gets closer" report.
      // Only bites after sprites have painted at least once, which is why the
      // first scrub down from live looked fine.
      this._spriteReady = false;
    }
    const active = this._previewActive;
    if (active && this._previewBlocks[active]?.key === b.key) {
      this._seekPreview(active);
      // Lingering in a shown block: warm the neighbouring blocks so continued
      // scrubbing is instant (fire-and-forget; the loader dedups; mapped
      // neighbours load on entry instead — their parts aren't known yet).
      for (const t of [b.start - 1, b.end + 1]) {
        const n = this._preview.blockFor(t);
        if (n && !n.mapped && n.key !== b.key) void this._preview.getBlock(n);
      }
      return;
    }
    const standby = this._standbySlot();
    if (this._previewBlocks[standby]?.key === b.key && this._previewSrcOf(standby)) {
      // Already loading/loaded in the standby — keep retargeting it; the
      // promotion happens from `seeked` once it's positioned.
      this._seekPreview(standby);
      return;
    }
    if (this._previewWant === b.key) return; // already debouncing/fetching it
    this._previewWant = b.key;
    const token = ++this._previewToken;
    try {
      if (!this._preview.isCached(b)) {
        // A fast pan flies across many blocks; downloading each one it merely
        // crosses is pure waste. Only start a download once the playhead has
        // stayed inside the block for a beat — cached blocks swap in instantly.
        await new Promise((r) => setTimeout(r, 120));
        if (token !== this._previewToken || !this.scrubbing) return;
      }
      const url = await this._preview.getBlock(b);
      if (!url || token !== this._previewToken) return;
      // Rapid scrubbing may have crossed into another block/part while this one
      // downloaded — only load it if it still covers the current time.
      if (this.scrubbing && (await this._resolvePlayable(this.targetTime))?.key !== b.key) return;
      if (token !== this._previewToken) return;
      // Reached here with the gesture already over (a slow first download):
      // stage it ANYWAY. The slot's <video> isn't rendered while not scrubbing,
      // so this is free, and it leaves the unit loaded + seekable instead of
      // making the next scrub into it start from an unmounted element again.
      this._loadPreviewInto(this._standbySlot(), b, url);
    } finally {
      // Must run on every exit: a `want` left behind by an abandoned download
      // makes every later scrub into that same block return early at the guard
      // above — the block would then never load again for the card's lifetime.
      if (this._previewWant === b.key) this._previewWant = undefined;
    }
  }

  /** The slot NOT currently on screen (slot 'a' when nothing is shown yet). */
  private _standbySlot(): 'a' | 'b' {
    return this._previewActive === 'a' ? 'b' : 'a';
  }

  /** Stage a unit in one slot. Only the standby is ever restaged, so the frame
   *  the user is looking at survives the whole load → seek → decode cycle. */
  private _loadPreviewInto(slot: 'a' | 'b', b: PreviewBlock, url: string): void {
    this._previewBlocks[slot] = b;
    this._previewPending[slot] = undefined;
    this._previewRetries[slot] = 0; // fresh error-recovery budget per unit
    if (slot === 'a') this._previewSrcA = url;
    else this._previewSrcB = url;
    // Never evict a blob that a mounted element is still pointing at.
    this._preview.setPinned([this._previewSrcA, this._previewSrcB]);
    this._seekPreview(slot); // no-op until loadedmetadata for a fresh src
  }

  /** Seek a (paused, muted) preview video to the frame for targetTime.
   *  The playable unit (a whole block, or one event-boundary part) covers
   *  [start, end] linearly and the element's own duration is the ground truth
   *  — no server-side timing bookkeeping can drift. Times past a head block's
   *  end clamp to its newest frame. Seeks are throttled seek-at-a-time: while
   *  the decoder is busy we remember only the LATEST wanted time and apply it
   *  on `seeked` — rapid scrub moves never queue up. */
  private _seekPreview(slot: 'a' | 'b'): void {
    const v = this._previewVideo(slot);
    const b = this._previewBlocks[slot];
    if (!v || !b) return;
    const dur = v.duration;
    if (!isFinite(dur) || dur <= 0) return; // metadata not in yet — @loadedmetadata re-calls
    const frac = Math.min(1, Math.max(0, (this.targetTime - b.start) / (b.end - b.start)));
    // Clamp just short of the end: seeking exactly to duration can show nothing.
    const target = Math.min(frac * dur, Math.max(0, dur - 0.05));
    if (Math.abs(v.currentTime - target) < 0.02) {
      // Already there — for a standby that never has to move, `seeked` will
      // never fire, so promote from here instead of waiting for it.
      if (slot !== this._previewActive) this._promotePreview(slot);
      return;
    }
    if (v.seeking) {
      this._previewPending[slot] = target;
      return;
    }
    this._previewPending[slot] = undefined;
    // SPRITE-PREVIEW-2026-08-04: time this seek for `scrub_preview_mode: auto`.
    // The preview's own seeks are the honest sample — same file sizes, same
    // decoder, same moment — so no separate probe is needed.
    if (this.previewMode === 'auto') {
      const t0 = performance.now();
      const done = (): void => {
        v.removeEventListener('seeked', done);
        this._noteSeek(performance.now() - t0);
      };
      v.addEventListener('seeked', done, { once: true });
    }
    v.currentTime = target;
  }

  /** Show a standby slot: a class swap only (no transition). Refuses to promote
   *  a unit whose frame isn't decoded yet (that would blank the stage — the
   *  whole point of the swap) or one the user has already scrubbed away from. */
  private _promotePreview(slot: 'a' | 'b'): void {
    const b = this._previewBlocks[slot];
    if (!b || !this.scrubbing) return;
    if (slot === this._previewActive) return;
    const v = this._previewVideo(slot);
    // HAVE_CURRENT_DATA: metadata alone means there is nothing painted yet.
    // @loadeddata re-runs the seek, which promotes from there.
    if (!v || v.readyState < 2) return;
    // Stale unit (scrubbed past it while it loaded): leave the current frame up
    // and let the next _updatePreview restage this slot.
    //
    // The HEAD block has no upper bound — blockFor() hands it back for ANY time
    // at or after its start and _seekPreview clamps to its newest frame, which
    // is the documented "last ~minute behind live" behaviour. Applying the
    // upper bound to it created a dead zone between the head's exported end and
    // live (HEAD_LAG_S plus up to a sync interval, so ~10-70s) where the unit
    // resolved and decoded fine but could never be promoted — and a small
    // rewind from the live edge lands in it every time.
    if (this.targetTime < b.start) return;
    // The tip has the same no-upper-bound rule as the head (it too is the
    // newest thing that exists, and _seekPreview clamps to its last frame).
    if (!b.head && !b.tip && this.targetTime > b.end) return;
    this._previewActive = slot;
  }

  private _onPreviewMeta(slot: 'a' | 'b'): void {
    this._seekPreview(slot);
  }

  // First frame decoded. Re-runs the seek so a unit that needed no seek (the
  // target frame is where the decoder opened) still gets promoted.
  private _onPreviewLoaded(slot: 'a' | 'b'): void {
    this._seekPreview(slot);
  }

  // Some decoders (distro chromium's openh264, notably) can throw a DECODE
  // error on a backward seek within an already-loaded preview. The blob is
  // fine — reload the element and re-seek (loadedmetadata re-runs the seek).
  // Bounded per unit; a persistent failure just keeps the last good frame.
  private _onPreviewError(slot: 'a' | 'b'): void {
    // Reloading blanks the element, so never do it to the one on screen — hand
    // the unit to the standby instead and promote when that one is positioned.
    if (slot === this._previewActive) {
      const b = this._previewBlocks[slot];
      const src = this._previewSrcOf(slot);
      if (b && src && this._previewRetries[slot] < 2) {
        this._previewRetries[slot]++;
        this._loadPreviewInto(this._standbySlot(), b, src);
      }
      return;
    }
    const v = this._previewVideo(slot);
    const src = this._previewSrcOf(slot);
    if (!v || !src || this._previewRetries[slot] >= 2) return;
    this._previewRetries[slot]++;
    this._previewPending[slot] = undefined;
    v.removeAttribute('src');
    v.load();
    v.src = src;
  }

  private _onPreviewSeeked(slot: 'a' | 'b'): void {
    const v = this._previewVideo(slot);
    const pending = this._previewPending[slot];
    this._previewPending[slot] = undefined;
    if (v && pending !== undefined && Math.abs(v.currentTime - pending) > 0.02) {
      v.currentTime = pending;
      return; // not settled yet; promote on the seek that actually lands
    }
    this._promotePreview(slot);
  }

  /** Drop both preview slots (camera switch / teardown). */
  private _resetPreviewSlots(): void {
    this._previewSrcA = undefined;
    this._previewSrcB = undefined;
    this._previewActive = null;
    this._previewBlocks = { a: undefined, b: undefined };
    this._previewPending = { a: undefined, b: undefined };
    this._previewRetries = { a: 0, b: 0 };
    this._previewWant = undefined;
    this._spriteReady = false; // SPRITE-PREVIEW-2026-08-04 (camera switch)
    this._spriteToken++; // strands any sheet still in flight for the old camera
    this._preview.setPinned([]);
  }

  // ---- single-clip playback (bounded event clips + live-no-stream fallback) -
  // Continuous delayed playback goes through the follow engine above; this path
  // now only serves a BOUNDED event clip ([start, event end]) and the rare
  // "live but <ha-camera-stream> unavailable" trailing window.

  private _segLenMs(): number {
    return Math.max(2, this.chunkSeconds) * 1000;
  }

  /** Set the clip <video> src. This is a plain server URL now, not a blob, so
   *  there is nothing to revoke — the bytes live on the server for the life of
   *  the session and the element only ever holds its own buffer. */
  private _setClipSrc(src?: string): void {
    this._videoSrc = src;
  }

  /** Play a single clip from `startMs`. Bounded event clip by default (ends at
   *  clipEndTime); `trailing` pulls the most-recent chunkSeconds window at now
   *  (live fallback when no live stream element is available). */
  private async _loadSegment(startMs: number, trailing = false): Promise<void> {
    const token = ++this._videoToken;
    if (this._video) releaseVideo(this._video);
    if (!trailing) this._releaseFrame();
    this._cancelClipFrameWatch();
    this._setClipSrc();
    this._error = undefined;
    this._loadingVideo = true;
    this._autoplayDone = false; // new clip -> attempt unmuted autoplay again
    this._clipPaused = false;
    this._clipRate = 1; // a fresh clip plays at 1× (mute preference is kept)
    this._clipProgress = 0;
    this._preparing = true;
    this._clipBuffering = false;
    this._clipSeekTarget = 0;
    this._clipSeekWasPlaying = false;
    this._clipRecoveryAttempts = 0;
    this._clipWatchFailed = false;
    this._error = undefined;
    this._flashFollowCtrl(); // flash the custom controls

    let start = startMs;
    let end: number;
    if (trailing) {
      end = this.now;
      start = Math.max(this.now - this._segLenMs(), 0);
    } else {
      end = Math.min(this.clipEndTime, this.now);
    }
    this._endClipSession(); // supersede any previous clip's session
    if (end - start < 1500) {
      this._setClipSrc();
      this._loadingVideo = false;
      this._preparing = false;
      this._error = 'Clip is too short to play.';
      queueMicrotask(() => {
        if (token === this._videoToken && this.clipEndTime > 0) {
          this.dispatchEvent(new CustomEvent('clip-ended', { bubbles: true, composed: true }));
        }
      });
      return;
    }
    this._clipStart = start;

    // Ask the server to materialise this clip, then STREAM it. The old path
    // downloaded the whole export into a Blob because the export proxy ignores
    // Range and the NVR writes the MP4 index last — but at ~52 MB per minute of
    // high-res footage that peaked around 740 MB for a 7-minute event and got the WKWebView
    // content process killed on iOS (the Companion app snaps back to the default
    // dashboard the moment the download finishes). The session endpoint returns a
    // faststart file served with real Range, so the phone holds only its buffer.
    const ctl = new AbortController();
    this._sessionAbort = ctl;
    try {
      const session = await startClipSession(
        this.hass,
        this.nvrId,
        this.cameraId,
        start,
        end,
        ctl.signal,
      );
      if (token !== this._videoToken) {
        endClipSession(this.hass, session.session_id); // raced by a newer clip
        return;
      }
      this._sessionId = session.session_id;
      this._clipSourceToken = token;
      this._clipSourceSession = session.session_id;
      this._clipSourceUrl = session.url;
      this._setClipSrc(session.url);
      // Start a bounded deadline immediately. Some WebViews emit no media event
      // at all after src assignment; event-driven arming alone can spin forever.
      this._clipBuffering = true;
      await this.updateComplete;
      if (
        token !== this._videoToken ||
        this._sessionId !== session.session_id ||
        this._videoSrc !== session.url
      ) {
        return;
      }
      this._armClipFrameWatch();
    } catch (err) {
      if (token !== this._videoToken) return; // superseded or torn down
      if ((err as Error)?.name === 'AbortError') return;
      console.warn('[unifi-timeline] clip session failed', err);
      this._failClip('Clip unavailable for this time range.');
    } finally {
      if (this._sessionAbort === ctl) this._sessionAbort = undefined;
      if (token === this._videoToken) this._preparing = false;
    }
  }

  /** Release the current clip's server-side working directory. */
  private _endClipSession(): void {
    this._sessionAbort?.abort();
    this._sessionAbort = undefined;
    if (!this._sessionId) return;
    endClipSession(this.hass, this._sessionId);
    this._sessionId = undefined;
    this._clipSourceToken = 0;
    this._clipSourceSession = undefined;
    this._clipSourceUrl = '';
  }

  private _isCurrentClipEvent(event: Event): HTMLVideoElement | undefined {
    const v = event.currentTarget instanceof HTMLVideoElement ? event.currentTarget : null;
    const expectedUrl = this._clipSourceUrl
      ? new URL(this._clipSourceUrl, window.location.href).href
      : '';
    return isCurrentClipSource({
      eventVideo: v,
      currentVideo: this._video,
      sourceToken: this._clipSourceToken,
      videoToken: this._videoToken,
      sourceSession: this._clipSourceSession,
      currentSession: this._sessionId,
      expectedUrl,
      actualUrl: v?.currentSrc || v?.src || '',
    })
      ? v ?? undefined
      : undefined;
  }

  private _onTimeUpdate = (event: Event): void => {
    const v = this._isCurrentClipEvent(event);
    if (!v) return;
    const real = this._clipStart + v.currentTime * 1000;
    this.dispatchEvent(
      new CustomEvent('playback-time', { detail: { time: real }, bubbles: true, composed: true }),
    );
    if (isFinite(v.duration) && v.duration > 0) this._clipProgress = v.currentTime / v.duration;
    this._clipTime = v.currentTime;
    if (isFinite(v.duration)) this._clipDuration = v.duration;
  };

  /** Seconds -> "M:SS" (e.g. 5 -> "0:05", 75 -> "1:15"). */
  private _fmtClock(s: number): string {
    if (!isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  // ---- clip seek bar (drag/click to scrub the fully-buffered blob) ----------
  private _seekTo(e: PointerEvent, bar: HTMLElement): void {
    const v = this._video;
    if (!v || !isFinite(v.duration) || v.duration <= 0) return;
    const rect = bar.getBoundingClientRect();
    // Rotated (mobile landscape) fullscreen: the bar runs VERTICALLY on screen,
    // so map the pointer's Y to progress instead of X.
    const frac = this._forceRotate
      ? Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
      : Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    this._seekClipTo(frac * v.duration);
    this._clipProgress = frac;
    this._clipTime = v.currentTime;
    this._clipDuration = v.duration;
  }

  private _onSeekDown = (e: PointerEvent): void => {
    e.stopPropagation();
    const bar = e.currentTarget as HTMLElement;
    try {
      bar.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic pointer ids in tests */
    }
    this._seekTo(e, bar);
    const move = (ev: PointerEvent): void => this._seekTo(ev, bar);
    const up = (): void => {
      bar.removeEventListener('pointermove', move);
      bar.removeEventListener('pointerup', up);
      bar.removeEventListener('pointercancel', up);
      this._showFollowCtrl();
    };
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup', up);
    bar.addEventListener('pointercancel', up);
    this._showFollowCtrl();
  };

  private _cancelClipFrameWatch(): void {
    this._clipFrameGeneration++;
    clearTimeout(this._clipFrameTimer);
    this._clipFrameTimer = undefined;
  }

  private _seekClipTo(target: number): void {
    const v = this._video;
    if (!v || !isFinite(v.duration) || v.duration <= 0) return;
    this._cancelClipFrameWatch();
    this._releaseFrame();
    this._clipSeekTarget = Math.min(v.duration, Math.max(0, target));
    this._clipSeekWasPlaying = !v.paused;
    this._clipRecoveryAttempts = 0;
    this._clipWatchFailed = false;
    this._clipBuffering = true;
    v.currentTime = this._clipSeekTarget;
    this._armClipFrameWatch();
  }

  private _onClipSeeking = (event: Event): void => {
    const v = this._isCurrentClipEvent(event);
    if (!v || this._clipWatchFailed) return;
    this._releaseFrame();
    this._clipSeekTarget = v.currentTime;
    this._clipSeekWasPlaying ||= !v.paused;
    this._clipBuffering = true;
    this._armClipFrameWatch();
  };

  private _onClipWaiting = (event: Event): void => {
    const v = this._isCurrentClipEvent(event);
    if (!v || v.ended || this._clipWatchFailed) return;
    this._clipSeekTarget = v.currentTime;
    this._clipSeekWasPlaying = !v.paused;
    this._clipBuffering = true;
    this._armClipFrameWatch();
  };

  private _armClipFrameWatch(): void {
    const v = this._video;
    if (!v || this._clipWatchFailed || this._clipFrameTimer !== undefined) return;
    const generation = this._clipFrameGeneration;
    const finish = (): void => {
      if (
        generation !== this._clipFrameGeneration ||
        v !== this._video ||
        v.seeking ||
        v.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
      ) {
        return;
      }
      clearTimeout(this._clipFrameTimer);
      this._clipFrameTimer = undefined;
      this._loadingVideo = false;
      this._clipBuffering = false;
      this._clipSeekWasPlaying = false;
      this._clipRecoveryAttempts = 0;
      this._clipWatchFailed = false;
      this._error = undefined;
      this._releaseFrame();
    };
    const requestFrameCallback = (v as unknown as {
      requestVideoFrameCallback?: (
        callback: (now: number, metadata: VideoFrameCallbackMetadata) => void,
      ) => number;
    }).requestVideoFrameCallback;
    const requestFrame = (): void => {
      requestFrameCallback?.call(v, (_now, metadata) => {
        if (generation !== this._clipFrameGeneration || v !== this._video) return;
        if (Math.abs(metadata.mediaTime - v.currentTime) > 0.75) {
          requestFrame();
          return;
        }
        finish();
      });
    };
    if (requestFrameCallback) {
      requestFrame();
    } else {
      requestAnimationFrame(() => requestAnimationFrame(finish));
    }
    this._clipFrameTimer = setTimeout(() => {
      if (generation !== this._clipFrameGeneration || v !== this._video) return;
      this._clipFrameTimer = undefined;
      const action = clipWatchdogAction({
        recoveryAttempts: this._clipRecoveryAttempts,
        hasFrameCallback: !!requestFrameCallback,
        seeking: v.seeking,
        readyState: v.readyState,
      });
      if (action === 'recover') {
        this._clipRecoveryAttempts = 1;
        const resume = this._clipSeekWasPlaying || !v.paused;
        v.pause();
        try {
          v.currentTime = Math.min(v.duration || this._clipSeekTarget, this._clipSeekTarget);
        } catch {
          /* source changed while recovery was arming */
        }
        if (resume) void v.play().catch(() => undefined);
        // WebViews can leave play() pending forever while stalled. Rearm now,
        // independently of that promise and independently of media events.
        this._cancelClipFrameWatch();
        this._armClipFrameWatch();
        return;
      }
      if (action === 'finish') {
        finish();
        return;
      }
      this._cancelClipFrameWatch();
      this._loadingVideo = false;
      this._clipBuffering = false;
      this._clipSeekWasPlaying = false;
      this._clipWatchFailed = true;
      this._error = 'Clip stalled while seeking. Try again.';
      this._releaseFrame();
    }, CLIP_FRAME_STALL_MS);
  }

  private _onClipSeeked = (event: Event): void => {
    if (!this._isCurrentClipEvent(event) || this._clipWatchFailed) return;
    this._armClipFrameWatch();
  };

  // The single <video> is only used for BOUNDED event clips now (continuous
  // playback goes through the delayed-follow engine). When a bounded clip ends,
  // hand back to the card to pick the next event or fall into delayed-follow.
  private _onEnded = (event: Event): void => {
    if (this.clipEndTime <= 0 || !this._isCurrentClipEvent(event)) return;
    this._cancelClipFrameWatch();
    this._clipBuffering = false;
    this._endClipSession();
    this.dispatchEvent(new CustomEvent('clip-ended', { bubbles: true, composed: true }));
  };

  private _onVideoReady = (event: Event): void => {
    const v = this._isCurrentClipEvent(event);
    if (!v || this._clipWatchFailed) return;
    v.playbackRate = this._clipRate; // keep the chosen speed across buffering stalls
    if (!this._autoplayDone) {
      this._autoplayDone = true;
      // Autoplay honoring the mute preference. After a user gesture (clip click /
      // timeline tap) the browser allows sound; if blocked, fall back to muted.
      v.muted = this._clipMuted;
      v.play().catch(() => {
        v.muted = true;
        v.play()
          .then(() => {
            if (this._audioUserChoice === 'unmuted') {
              v.volume = 1;
              v.muted = false;
            }
          })
          .catch(() => {
            /* give up; user can press play */
          });
      });
    }
    const requestFrameCallback = (v as unknown as {
      requestVideoFrameCallback?: (callback: () => void) => number;
    }).requestVideoFrameCallback;
    if (!requestFrameCallback && !v.seeking && v.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      this._cancelClipFrameWatch();
      this._loadingVideo = false;
      this._clipBuffering = false;
      this._clipSeekWasPlaying = false;
      this._clipRecoveryAttempts = 0;
      this._releaseFrame();
      return;
    }
    this._armClipFrameWatch();
  };

  private _onVideoError = (event: Event): void => {
    if (!this._isCurrentClipEvent(event)) return;
    this._failClip('Clip unavailable for this time range.');
  };

  private _failClip(message: string): void {
    // The clip is fetched fully into a blob before playing (no mid-playback
    // auth expiry to retry), so an error here means the clip is unplayable.
    this._loadingVideo = false;
    this._clipBuffering = false;
    this._cancelClipFrameWatch();
    this._error = message;
  }

  private _onClipPlay = (event: Event): void => {
    if (!this._isCurrentClipEvent(event)) return;
    this._clipPaused = false;
  };

  private _onClipPause = (event: Event): void => {
    if (!this._isCurrentClipEvent(event)) return;
    this._clipPaused = true;
  };

  // ---- delayed-follow engine -----------------------------------------------

  private _followVideo(slot: 'a' | 'b'): HTMLVideoElement | undefined {
    return slot === 'a' ? this._followVidA : this._followVidB;
  }

  /** Tear down the follow engine: invalidate in-flight fetches, drop both srcs
   *  (aborting their NVR exports), and clear state. */
  private _stopFollow(): void {
    this._followToken++;
    clearTimeout(this._followRetry);
    this._followRetry = undefined;
    clearTimeout(this._followWatch.a);
    clearTimeout(this._followWatch.b);
    this._followWatch = { a: undefined, b: undefined };
    this._followWatchTries = { a: 0, b: 0 };
    this._tapToPlay = false;
    this._followActive = null;
    if (this._followSrcA?.startsWith('blob:')) URL.revokeObjectURL(this._followSrcA);
    if (this._followSrcB?.startsWith('blob:')) URL.revokeObjectURL(this._followSrcB);
    this._followSrcA = undefined;
    this._followSrcB = undefined;
    this._followMeta.a = { start: 0, end: 0, ready: false, leadIn: 0 };
    this._followMeta.b = { start: 0, end: 0, ready: false, leadIn: 0 };
    this._followSwapArmed = false;
  }

  /** Begin continuous delayed playback from `startMs`, holding ~delaySeconds
   *  behind live. Clamped so it never starts closer than the export-availability
   *  floor (~12s); slot A loads the first chunk, then B prefetches the next. */
  private async _startFollow(startMs: number): Promise<void> {
    this._stopFollow();
    const token = ++this._followToken;
    this._error = undefined;
    this._loadingVideo = true;
    this._followPaused = false; // a fresh rewind plays; keep the mute preference
    this._nearLive = false; // recomputed on the first timeupdate
    this._followActive = 'a'; // mount the stage now (spinner until A buffers)
    this._flashFollowCtrl(); // flash the controls so they're discoverable
    // Hold at least the availability floor behind live; honor a deeper rewind.
    const floorMs = Math.max(this.delaySeconds, 12) * 1000;
    const start = Math.max(0, Math.min(startMs, this.now - floorMs));
    this._followPlayhead = start;
    const meta = await this._fetchFollowChunk('a', start, token);
    if (token !== this._followToken) return;
    // Footage for this instant isn't finalized yet — retry; A activates on load.
    if (!meta) this._scheduleFollowRetry('a', start, token);
  }

  /** Fetch the chunk starting at `startMs` into `slot`: end at the next tier
   *  boundary (single-quality export), capped at the availability edge and a max
   *  length. Returns the chunk range, or null when nothing is available yet. */
  private async _fetchFollowChunk(
    slot: 'a' | 'b',
    startMs: number,
    token: number,
  ): Promise<{ start: number; end: number } | null> {
    let start = startMs;
    // Skip a camera-offline gap: jump the playhead to where footage resumes.
    const g = this.gaps.find((gap) => start >= gap.start && start < gap.end);
    if (g) start = g.end;
    let end = CUT_CHUNKS_AT_EVENTS
      ? segmentEndFor(start, start + MediaView.FOLLOW_MAX_CHUNK_MS, this.footageSpans)
      : start + MediaView.FOLLOW_MAX_CHUNK_MS;
    const availEdge = this.now - MediaView.FOLLOW_AVAIL_LAG_MS;
    if (end > availEdge) end = availEdge;
    if (end - start < 1500) return null; // not enough finalized footage yet
    const raw = buildVideoUrl(this.nvrId, this.cameraId, start, end);
    const signed = await signPath(this.hass, raw, 300);
    if (token !== this._followToken) return null;
    // Fetch the whole (small, ~0.2s) chunk as a BLOB rather than streaming it:
    // the export proxy has no HTTP range support, so a streamed <video> can only
    // seek within already-buffered bytes — seeking past the keyframe lead-in
    // silently clamps to 0 and the chunk replays it (drift). A fully-downloaded
    // blob is range-seekable in memory, so the lead-in skip lands every time.
    let objUrl: string;
    try {
      const resp = await fetch(signed);
      if (!resp.ok || token !== this._followToken) return null;
      const blob = await resp.blob();
      if (token !== this._followToken) return null;
      objUrl = URL.createObjectURL(blob);
    } catch {
      return null;
    }
    const prev = slot === 'a' ? this._followSrcA : this._followSrcB;
    if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
    this._followMeta[slot] = { start, end, ready: false, leadIn: 0 };
    if (slot === 'a') this._followSrcA = objUrl;
    else this._followSrcB = objUrl;
    void this._kickFollowSlot(slot, token); // don't wait on preload goodwill
    return { start, end };
  }

  /** Start a follow slot playing, and DON'T lose the failure.
   *
   *  Every play() here used to be `.catch(() => {})`, so a refusal left a
   *  decoded first frame parked on screen looking exactly like a stalled
   *  download — the "snapshot appears but nothing plays" report. A rejection is
   *  normally the autoplay policy, so retry muted (permitted in far more
   *  situations); if even that is refused — iOS Low Power Mode blocks autoplay
   *  outright, muted or not — surface a tap target, since a user gesture always
   *  gets through. */
  private _playFollowVideo(v: HTMLVideoElement): void {
    v.play()
      .then(() => {
        this._tapToPlay = false;
      })
      .catch((err: unknown) => {
        // AbortError just means a new load superseded this play (we reload
        // stalled slots) — that resolves itself, and treating it as a refusal
        // would flash a play button over perfectly healthy playback.
        if (!isBlockedByPolicy(err)) return;
        v.muted = true;
        v.play()
          .then(() => {
            this._tapToPlay = false;
            if (this._audioUserChoice === 'unmuted') {
              v.volume = 1;
              v.muted = false;
            }
          })
          .catch((err2: unknown) => {
            if (!isBlockedByPolicy(err2)) return;
            this._tapToPlay = true;
            this._loadingVideo = false; // it's not loading — it's blocked
          });
      });
  }

  /** The stage's one-tap start (shown after playback was refused). Runs inside
   *  the tap's own gesture, which no autoplay policy blocks. */
  private _onTapToPlay = (e: Event): void => {
    e.stopPropagation(); // don't also toggle the control bar
    this._tapToPlay = false;
    this._followPaused = false;
    const v = this._followActive ? this._followVideo(this._followActive) : this._video;
    if (v) this._playFollowVideo(v);
  };

  /** The chunk's src has landed: watch that it actually becomes playable.
   *  Nothing is forced here — pairing load() with an immediate play() only
   *  makes the play reject with AbortError. The watchdog does the recovering,
   *  and only if the normal event chain fails to arrive. */
  private async _kickFollowSlot(slot: 'a' | 'b', token: number): Promise<void> {
    await this.updateComplete; // the <video> now carries the new src
    if (token !== this._followToken) return;
    if (this._followMeta[slot].ready) return;
    this._armFollowWatchdog(slot, token);
  }

  /** Re-drive a slot that never reported itself ready.
   *
   *  The engine is entirely event-driven (loadeddata -> seek -> seeked), so one
   *  missed event used to strand the stage forever: a spinner on the active
   *  slot, or a freeze at the chunk boundary when it was the standby that never
   *  loaded. The two forcing functions are applied on SEPARATE attempts —
   *  load() first, then play() — because together they cancel each other. */
  private _armFollowWatchdog(slot: 'a' | 'b', token: number): void {
    clearTimeout(this._followWatch[slot]);
    this._followWatch[slot] = setTimeout(() => {
      if (token !== this._followToken) return;
      const m = this._followMeta[slot];
      const v = this._followVideo(slot);
      if (!v || m.ready) return;
      const active = slot === this._followActive;
      if (this._followWatchTries[slot] >= 2) {
        // Both nudges failed. Re-fetch the chunk outright — the blob or the
        // decoder is the problem, not the element.
        this._followWatchTries[slot] = 0;
        if (active) this._loadingVideo = true;
        this._scheduleFollowRetry(slot, m.start, token);
        return;
      }
      if (this._followWatchTries[slot] === 0) {
        try {
          v.load(); // an engine that declined to preload will start here
        } catch {
          /* element went away */
        }
      } else if (active && !this._followPaused) {
        this._playFollowVideo(v); // play() forces a fetch where preload didn't
      }
      this._followWatchTries[slot]++;
      this._armFollowWatchdog(slot, token);
    }, MediaView.FOLLOW_STALL_MS);
  }

  /** Prefetch the NEXT chunk (from _followPlayhead) into the standby slot so the
   *  swap is instant. Retries if footage isn't available yet. */
  private _prefetchFollow(token: number): void {
    if (token !== this._followToken || this._followActive === null) return;
    const standby = this._followActive === 'a' ? 'b' : 'a';
    const from = this._followPlayhead;
    void this._fetchFollowChunk(standby, from, token).then((meta) => {
      if (token !== this._followToken) return;
      if (!meta) this._scheduleFollowRetry(standby, from, token);
    });
  }

  private _scheduleFollowRetry(slot: 'a' | 'b', startMs: number, token: number): void {
    clearTimeout(this._followRetry);
    this._followRetry = setTimeout(() => {
      if (token !== this._followToken) return;
      void this._fetchFollowChunk(slot, startMs, token).then((meta) => {
        if (token !== this._followToken) return;
        if (!meta) this._scheduleFollowRetry(slot, startMs, token);
      });
    }, 700);
  }

  /** A follow slot finished buffering. Active slot -> start playing + prefetch
   *  the next chunk; standby slot -> ready for a gapless swap (and cover a swap
   *  that was already waiting on it). */
  private _onFollowLoaded(slot: 'a' | 'b'): void {
    const m = this._followMeta[slot];
    if (m.start === 0 || m.ready) return; // placeholder src, or already positioned
    const v = this._followVideo(slot);
    if (!v || !isFinite(v.duration) || v.duration <= 0) return;
    // The export snaps its start to a keyframe, so the clip runs LONGER than the
    // requested range but its content ends exactly at `end`. Skip that lead-in
    // so this chunk begins precisely where the previous one ended (no replay,
    // no drift).
    m.leadIn = Math.max(0, v.duration - (m.end - m.start) / 1000);
    // Blob is fully in memory -> the seek lands immediately; `seeked` confirms.
    if (m.leadIn <= 0.05) this._followSlotReady(slot);
    else v.currentTime = m.leadIn;
  }

  private _onFollowSeeked(slot: 'a' | 'b'): void {
    const m = this._followMeta[slot];
    if (m.start === 0 || m.ready) return; // only the initial positioning seek
    this._followSlotReady(slot);
  }

  /** A slot is positioned at its lead-in and ready to show. Start it if it's the
   *  active slot (and prefetch the next chunk), or complete a pending swap. */
  private _followSlotReady(slot: 'a' | 'b'): void {
    const m = this._followMeta[slot];
    m.ready = true;
    clearTimeout(this._followWatch[slot]); // this slot made it
    this._followWatchTries[slot] = 0;
    const v = this._followVideo(slot);
    if (!v) return;
    if (slot === this._followActive) {
      this._loadingVideo = false;
      this._followSwapArmed = false;
      v.playbackRate = this._followRate;
      if (!this._followPaused) this._playFollowVideo(v);
      this._followPlayhead = m.end; // content ends here; chain contiguously
      this._prefetchFollow(this._followToken);
    } else if (this._followSwapArmed) {
      this._swapFollow(); // active already ended waiting on this one
    }
  }

  private _onFollowTime(slot: 'a' | 'b'): void {
    if (slot !== this._followActive) return;
    const v = this._followVideo(slot);
    const m = this._followMeta[slot];
    if (!v || !isFinite(v.duration)) return;
    // content(ct) = end − duration + ct (the clip ends at `end`).
    const real = m.end - v.duration * 1000 + v.currentTime * 1000;
    this.dispatchEvent(
      new CustomEvent('playback-time', { detail: { time: real }, bubbles: true, composed: true }),
    );
    // Caught up near the live edge: 2×/4× can't be sustained (no finalized
    // footage ahead), so drop back to real time automatically + disable speed.
    const near = this.now - real < this._nearLiveMs;
    if (near !== this._nearLive) this._nearLive = near; // reactive -> prompt UI
    if (near && this._followRate !== 1) this._setFollowRate(1);
  }

  private _onFollowEnded(slot: 'a' | 'b'): void {
    if (slot !== this._followActive) return;
    const standby = slot === 'a' ? 'b' : 'a';
    if (this._followMeta[standby].ready) this._swapFollow();
    else this._followSwapArmed = true; // hold last frame; swap when standby loads
  }

  /** Leap-frog: make the standby slot active (already buffered -> instant),
   *  pause the old one, advance the playhead, and prefetch the next chunk. */
  private _swapFollow(): void {
    const cur = this._followActive;
    if (cur === null) return;
    const next = cur === 'a' ? 'b' : 'a';
    if (!this._followMeta[next].ready) {
      this._followSwapArmed = true;
      return;
    }
    const nv = this._followVideo(next);
    if (!nv) return;
    this._followActive = next;
    this._followSwapArmed = false;
    // Standby is already positioned past its lead-in (confirmed via `seeked`
    // before it was marked ready) — just play; it continues exactly where the
    // outgoing chunk ended. (Honor a user pause + the chosen speed.)
    nv.playbackRate = this._followRate;
    if (!this._followPaused) this._playFollowVideo(nv);
    this._followVideo(cur)?.pause();
    this._followPlayhead = this._followMeta[next].end;
    this._prefetchFollow(this._followToken);
  }

  private _onFollowError(slot: 'a' | 'b'): void {
    if (this._followMeta[slot].start === 0) return; // empty/placeholder src
    if (slot !== this._followActive) {
      this._followMeta[slot].ready = false;
      return;
    }
    // Active chunk failed — re-fetch from the same point (decoder hiccup); a
    // persistent failure just keeps retrying rather than surfacing an error.
    this._scheduleFollowRetry(slot, this._followMeta[slot].start, this._followToken);
  }

  // ---- delayed-follow custom controls (play/pause, mute, fullscreen) --------

  /** Reveal the control bar and arm the auto-hide timer. */
  // ---- held frame (no black flash between sources) --------------------------
  //
  // Every source change here has dead air in it: a scrub-end re-exports from the
  // NVR, a 15s skip restarts the follow chain, live<->historical tears one
  // player down and builds another. The <video> goes blank the moment its src
  // drops, so the stage flashed black for a second or two. The UniFi app never
  // does: it holds the last frame until the next one is ready.
  @state() private _frozen = false;
  @query('canvas.freeze') private _freezeCanvas?: HTMLCanvasElement;
  @query('img.freeze') private _freezeImg?: HTMLImageElement;
  private _freezeRaf = 0;
  private _freezeTimer?: ReturnType<typeof setTimeout>;
  // What the held frame was copied FROM. The release check has to ignore it:
  // the outgoing player usually keeps painting for a moment after the switch is
  // set in motion, and treating that as "the new source has arrived" dropped the
  // hold instantly and put the black flash straight back (seen on ->LIVE, where
  // the follow slot lingers while ha-camera-stream connects).
  private _frozenFrom?: { el: HTMLVideoElement; src: string };
  private _framePresented = false;
  private _frameWatchGeneration = 0;
  private _rvfcVideo?: HTMLVideoElement;
  private _rvfcSource = '';
  @state() private _holdPoster = '';
  // HOLDFRAME-2026-08-05d: a BOUNDED preload of the camera snapshot, kept only
  // while live is on screen and refreshed every POSTER_REFRESH_MS. The poster
  // has to be already decoded to cover a gap — fetching it at transition time
  // means it downloads first and the stage is black meanwhile (measured ~600 ms).
  // This is NOT the old `_posterWarm` bug: that latched ONE url for the life of
  // the card and leaked across cameras. This is refreshed on a timer, cleared on
  // camera change, and only ever used when LEAVING LIVE, where a stand-in a few
  // seconds old is honest by construction.
  @state() private _posterPreload = '';
  private _posterAt = 0;
  // The fallback still, fetched WHILE LIVE IS PLAYING so it is decoded and ready
  // the instant it is needed. Loading it at transition time would show black for
  // exactly as long as the fetch took — the thing we are trying to remove.

  /** Mean luminance over a small sample; a copy this dark is a failed copy. */
  private _looksBlack(ctx: CanvasRenderingContext2D, c: HTMLCanvasElement): boolean {
    try {
      const w = Math.min(32, c.width);
      const h = Math.min(32, c.height);
      if (!w || !h) return true;
      const d = ctx.getImageData(0, 0, w, h).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += (d[i] + d[i + 1] + d[i + 2]) / 3;
      return sum / (d.length / 4) < 3;
    } catch {
      return true; // tainted canvas — can't read it back, so can't trust it
    }
  }

  /** The camera's current thumbnail from HA — kept as the fallback still. */
  private _posterUrl(): string {
    const pic = this.hass?.states?.[this.cameraId]?.attributes?.entity_picture;
    return typeof pic === 'string' ? pic : '';
  }

  /** A player that is ACTIVELY PRESENTING right now — not merely mounted with a
   *  decoded frame. HOLDFRAME-2026-08-05: this is what makes the held frame
   *  lowest-priority. `_visibleVideo` only proves a frame EXISTS, which is true
   *  of a stalled or paused element too; anything that is playing means there
   *  is no gap to cover and the still must get out of the way. */
  /** As _playingVideo, ignoring `skip` — used to exclude the element a held
   *  still was copied FROM, which is still playing for a moment after the
   *  transition that took the still. */
  private _playingVideoExcluding(skip?: HTMLVideoElement): HTMLVideoElement | undefined {
    const cands = [
      this._followActive ? this._followVideo(this._followActive) : undefined,
      this._video,
      this._liveVideo(),
    ];
    return cands.find(
      (v): v is HTMLVideoElement =>
        !!v && v !== skip && !v.paused && !v.ended && v.readyState >= 3 && v.videoWidth > 0,
    );
  }

  /** Whatever the viewer can actually see right now, whichever player owns the
   *  stage. Ordered by which one is on top when several are mounted. */
  private _visibleVideo(): HTMLVideoElement | null | undefined {
    const candidates = [
      this._previewActive ? this._previewVideo(this._previewActive) : undefined,
      this._followActive ? this._followVideo(this._followActive) : undefined,
      this._video,
      this._liveVideo(),
    ];
    // readyState >= 2 (HAVE_CURRENT_DATA) is the guarantee there is a frame to
    // copy; anything less would paint the canvas black, which is the very thing
    // this exists to avoid.
    return candidates.find((v) => v && v.readyState >= 2 && v.videoWidth > 0);
  }

  /** Copy the current frame onto the overlay canvas and hold it. No-op when
   *  nothing is showing yet — a black hold is worse than the honest black. */
  private _holdFrame(preferSprite = false, posterOk = false): void {
    if (!HOLD_FRAME_ENABLED) return;
    // HOLDFRAME-2026-08-05b: capture EVEN IF the outgoing player is still
    // playing. _holdFrame only runs at a real transition, and at that instant
    // the thing about to disappear is still on screen — its last frame is
    // exactly what must cover the gap. Refusing to capture here (the first
    // version of the "lowest priority" rule) is what made the FIRST scrub away
    // from live flash BLACK for ~0.5-1 s: live was playing, so nothing was
    // held, and the scrub stage is empty until the first sprite paints. Same
    // flash on the jump-to-live arrow. "Lowest priority" is enforced where it
    // belongs — on RELEASE: the watcher drops the hold the moment any player
    // OTHER than the one we copied from is presenting.
    const v = this._visibleVideo();
    // HOLDFRAME-2026-08-05: the SPRITE CANVAS is a copy source too. During a
    // sprite-mode scrub it is literally what is on screen, and at scrub-END it
    // holds the frame for the time just scrubbed TO — which is precisely the
    // frame to keep up while that footage loads. Without this there was no
    // video to copy at scrub-end (preview is a canvas, live is unmounted), so
    // the code fell through to the poster fallback and showed a picture of NOW
    // after the user had scrubbed to 5am.
    const sprite =
      this._spriteReady && this._spriteCanvas && this._spriteCanvas.width > 0
        ? this._spriteCanvas
        : undefined;
    // SPRITE CANVAS WINS over any <video>. This ordering is the whole fix for
    // "shows a near-live frame before the footage I scrubbed to":
    // _holdFrame runs in willUpdate, i.e. BEFORE the re-render that unmounts
    // <ha-camera-stream>, so at scrub-end the live element is still in the DOM
    // holding its last (near-live) frame — and `v ?? sprite` copied THAT,
    // ignoring the canvas that already holds the frame the user scrubbed to.
    // The rule is simply: if a scrub just happened, the last scrubbed frame is
    // what to hold. Nothing else is ever a better answer.
    // Which source is on screen RIGHT NOW? _holdFrame runs in willUpdate, so the
    // stage still shows the OLD state: entering a scrub it is live/clip (take
    // the video), leaving one it is the sprite canvas (take the canvas). A
    // fixed order is wrong in one direction or the other — preferring the
    // canvas always meant a SECOND scrub held the previous gesture's stale
    // sprite instead of the live frame it was leaving.
    const pick: (HTMLVideoElement | HTMLCanvasElement | undefined)[] = preferSprite
      ? [sprite, v ?? undefined]
      : [v ?? undefined, sprite];
    const src = pick.find((x) => !!x);
    const isCanvas = src instanceof HTMLCanvasElement;
    const srcW = isCanvas ? src.width : (src as HTMLVideoElement | undefined)?.videoWidth ?? 0;
    const srcH = isCanvas ? src.height : (src as HTMLVideoElement | undefined)?.videoHeight ?? 0;
    const c = this._freezeCanvas;
    // Already holding and there is nothing better to copy: KEEP what we have.
    // A transition fires this more than once (the button, then the property it
    // sets), and by the later call the outgoing player is usually gone — so
    // without this the good frame captured on the press was overwritten by the
    // coarser poster, or by nothing at all. Just re-arm the watcher.
    if (this._frozen && !src) {
      this._watchForFirstFrame();
      return;
    }
    if (!c) return;
    let copied = false;
    if (src && srcW > 0 && srcH > 0) {
      try {
        if (c.width !== srcW || c.height !== srcH) {
          c.width = srcW;
          c.height = srcH;
        }
        const ctx = c.getContext('2d', { willReadFrequently: true });
        // Clear FIRST. Setting width/height only clears when the size actually
        // changes, so a draw that silently fails would leave the previous hold
        // on the canvas — which reads as a good copy, defeats the check below,
        // and shows a stale (possibly other-camera) frame as if it were current.
        ctx?.clearRect(0, 0, c.width, c.height);
        ctx?.drawImage(src, 0, 0, c.width, c.height);
        copied = !!ctx && !this._looksBlack(ctx, c);
      } catch {
        copied = false; // decoder gone mid-copy, or a tainted/protected surface
      }
    }
    // A LIVE frame can refuse to be copied: hardware-decoded live often
    // draws as pure black (or throws) on Android WebView and iOS, even though it
    // renders perfectly on screen. Headless Chromium decodes in software and
    // copies fine, so this only ever shows up on the real devices. Holding a
    // black canvas would be worse than not holding at all — it would mask a
    // working player for up to FREEZE_MAX_MS — so fall back to the camera's own
    // poster image, which is a real (slightly older) picture of the same view.
    // HOLDFRAME-2026-08-05: entity_picture is a picture of NOW, so it is only a
    // valid fallback when LIVE is what we are waiting for. Using it while a
    // HISTORICAL clip loads showed a live snapshot after scrubbing to 5am — the
    // exact symptom reported. When there is nothing truthful to show, show
    // nothing: a brief black frame beats a frame from the wrong time.
    // entity_picture is a picture of NOW, so it is honest only when LIVE is one
    // side of this transition — `posterOk`, decided by the caller from what was
    // actually on screen. Two earlier gates were both wrong: `this.live` (still
    // set while transitioning AWAY from live, so it let a live snapshot cover a
    // scrub to 07:17) and then `targetTime` near now (which REJECTED it at
    // scrub-start, because by the time the hold runs the playhead has already
    // moved minutes back — traced at 3.8 min — leaving nothing to show and
    // flashing black). What matters is the stage being left or entered, not
    // where the playhead has since travelled.
    // Use the PRELOADED url so the still is already decoded and appears at once.
    this._holdPoster = copied || !posterOk ? '' : this._posterPreload || this._posterUrl();
    if (!copied && !this._holdPoster) return; // nothing worth showing
    this._frozen = true;
    // Reveal NOW, not on the next render (see the note in render()).
    const img = this._freezeImg;
    if (copied) {
      c.removeAttribute('hidden');
      img?.setAttribute('hidden', '');
    } else if (img) {
      // BUGFIX-POSTER-2026-08-04: was `if (!img.getAttribute('src'))`, i.e. the
      // src was written ONCE and never again — a second latch that pinned the
      // first camera's poster even after _posterWarm had moved on. Compare
      // against the wanted URL instead: that keeps the original intent (never
      // re-assign the same src, which would drop the decoded image and put a
      // flash back) while letting a camera switch actually take effect. This
      // has to be imperative — Lit's render is async and the hold is revealed
      // synchronously, so the binding in render() lands a frame too late.
      // Revert: `if (!img.getAttribute('src')) img.src = this._holdPoster;`
      if (img.getAttribute('src') !== this._holdPoster) img.src = this._holdPoster;
      img.removeAttribute('hidden');
      c.setAttribute('hidden', '');
    }
    // With the poster fallback there may be no source element to exclude — the
    // watcher then simply releases on the first painting video it sees, which is
    // right, because the one we would have excluded is already gone.
    this._frozenFrom = v ? { el: v, src: v.currentSrc || v.src } : undefined;
    this._watchForFirstFrame();
  }

  /** Drop the hold as soon as SOME player is painting again. Polled on rAF
   *  rather than wired into each player's events: four different sources take
   *  over this stage (live, clip, follow, preview) and they announce themselves
   *  differently — one condition covers them all and cannot be forgotten when a
   *  fifth is added. Backstopped by a timer so a failed load can never leave a
   *  stale frame pinned over the player. */
  private _watchForFirstFrame(): void {
    cancelAnimationFrame(this._freezeRaf);
    clearTimeout(this._freezeTimer);
    const generation = ++this._frameWatchGeneration;
    this._framePresented = false;
    this._rvfcVideo = undefined;
    this._rvfcSource = '';
    const started = performance.now();
    const maxHoldMs = this.live ? LIVE_FREEZE_MAX_MS : HISTORICAL_FREEZE_MAX_MS;
    const tick = (): void => {
      if (this._framePresented) {
        this._releaseFrame();
        return;
      }
      // HOLDFRAME-2026-08-05b: any player OTHER than the one this still was
      // copied from, actually presenting, ends the hold at once. Excluding the
      // source element is what lets the capture survive the instant after a
      // transition (the outgoing player is still playing then — that is why we
      // have its frame at all); without the exclusion the hold released
      // immediately and the black flash came straight back. The stuck-forever
      // bug this replaced came from _holdFrame running on every live tick, and
      // that trigger is gated off now, so the exclusion is safe again.
      const held = this._frozenFrom?.el;
      const other = this._playingVideoExcluding(held);
      if (other) {
        this._releaseFrame();
        return;
      }
      const v = this._visibleVideo();
      // Below here nothing is playing, so the hold is still legitimate; wait for
      // the INCOMING source to present its first frame. A skip reloads the very
      // same element, so identity alone can't separate them — src changes too.
      const from = this._frozenFrom;
      const isNew = !!v && (!from || v !== from.el || (v.currentSrc || v.src) !== from.src);
      if (v && isNew) {
        // requestVideoFrameCallback is the only signal that means "a frame is
        // ON SCREEN". readyState alone fired a beat early on the way to live and
        // left one black frame behind; and it can't be replaced by "currentTime
        // advanced" either, because the scrub preview is a PAUSED still whose
        // time never moves. rVFC covers both: playing, and seeked-then-parked.
        const rvfc = (
          v as HTMLVideoElement & {
            requestVideoFrameCallback?: (cb: () => void) => number;
          }
        ).requestVideoFrameCallback;
        const source = v.currentSrc || v.src || '';
        if (rvfc && (this._rvfcVideo !== v || this._rvfcSource !== source)) {
          this._rvfcVideo = v;
          this._rvfcSource = source;
          rvfc.call(v, () => {
            if (
              generation === this._frameWatchGeneration &&
              this._rvfcVideo === v &&
              this._rvfcSource === source
            ) {
              this._framePresented = true;
            }
          });
        } else if (!rvfc && v.readyState >= 3 && v.currentTime > 0 && !v.seeking) {
          this._releaseFrame(); // engine without rVFC — best available signal
          return;
        }
      }
      if (performance.now() - started > maxHoldMs) {
        this._releaseFrame();
        return;
      }
      this._freezeRaf = requestAnimationFrame(tick);
    };
    this._freezeRaf = requestAnimationFrame(tick);
  }

  private _releaseFrame(): void {
    cancelAnimationFrame(this._freezeRaf);
    this._freezeRaf = 0;
    clearTimeout(this._freezeTimer);
    this._freezeTimer = undefined;
    this._frozenFrom = undefined;
    this._frameWatchGeneration++;
    this._framePresented = false;
    this._rvfcVideo = undefined;
    this._rvfcSource = '';
    this._holdPoster = '';
    this._frozen = false;
    this._freezeCanvas?.setAttribute('hidden', '');
    this._freezeImg?.setAttribute('hidden', '');
  }

  private _showFollowCtrl = (): void => {
    this._followCtrl = true;
    clearTimeout(this._followCtrlTimer);
    // A scrub in flight (drag, momentum glide, settle delay) HOLDS the controls
    // open: the gesture is the interaction, and a finger resting mid-drag must
    // not make the bar — and with it the fullscreen timeline being dragged —
    // vanish. The timer is re-armed when the scrub ends (see updated()).
    if (this.scrubbing) return;
    this._followCtrlTimer = setTimeout(() => {
      this._followCtrl = false;
    }, 5200);
  };

  /** Hide the control bar immediately (cancels the pending auto-hide). */
  private _hideFollowCtrl = (): void => {
    clearTimeout(this._followCtrlTimer);
    this._followCtrl = false;
    this._ctrlDismissedAt = Date.now();
  };

  private _ctrlDismissedAt = 0;

  /** Re-arm the auto-hide on any pointer activity inside the player, but never
   *  reveal the controls — showing them is the stage tap's job. */
  private _keepCtrlAlive = (): void => {
    if (this._followCtrl) this._showFollowCtrl();
  };

  /** The automatic "here are the controls" flash when a player starts. Skipped
   *  right after the user dismissed them by hand: dragging the timeline and
   *  then tapping to clear the chrome starts playback a beat later, and that
   *  must not undo the tap. */
  private _flashFollowCtrl(): void {
    if (Date.now() - this._ctrlDismissedAt < 1500) return;
    this._showFollowCtrl();
  }

  // Tap-to-TOGGLE the controls (video area only — control-bar clicks are
  // stopped in _renderCtrlBar). The decision is snapshotted on pointerDOWN, not
  // on the click: on desktop a stray pointermove reveals the bar between press
  // and click, and on touch a shaky tap can too — reading the pre-press state
  // avoids "show-then-immediately-hide" so a tap always flips what the user saw.
  private _ctrlVisibleAtPress = false;

  private _onStagePress = (): void => {
    this._ctrlVisibleAtPress = this._followCtrl;
  };

  private _onStageTap = (): void => {
    if (this._ctrlVisibleAtPress) this._hideFollowCtrl();
    else this._showFollowCtrl();
  };

  /** The fullscreen strip covers the whole player (so a drag anywhere scrubs),
   *  which means it also swallows taps meant for the video. It doesn't use taps
   *  itself — dragging and scrolling only — so every one of them comes back
   *  here and behaves like a plain stage tap. */
  private _onStripTap = (e: Event): void => {
    e.stopPropagation();
    this._hideFollowCtrl(); // the strip is only up while the controls are
  };

  /** Tap on the strip's own PADDING — the clearance bands above, below and
   *  beside the ruler, including the gutter the round buttons sit in. There is
   *  no ruler under those to emit `tap-through`, so the tap used to do nothing
   *  but re-arm the auto-hide (pointerdown calls _showFollowCtrl): the chrome
   *  flashed and stayed up, and since the strip covers the WHOLE player that is
   *  most of the screen's edge. Give them the same dismiss the ruler has.
   *  composedPath()[0] is the true innermost target — a tap that landed on the
   *  ruler, a thumbnail or a button reports that element instead and is left
   *  alone, and a drag that merely ENDS here is excluded by `scrubbing`. */
  private _onStripBlankTap = (e: Event): void => {
    e.stopPropagation();
    if (e.composedPath()[0] !== e.currentTarget || this.scrubbing) return;
    this._hideFollowCtrl();
  };

  private _toggleFollowPlay = (e: Event): void => {
    e.stopPropagation();
    this._followPaused = !this._followPaused;
    const v = this._followActive ? this._followVideo(this._followActive) : undefined;
    if (this._followPaused) v?.pause();
    else v?.play().catch(() => {});
    this._showFollowCtrl();
  };

  private _toggleFollowMute = (e: Event): void => {
    e.stopPropagation();
    const active = this._followActive ? this._followVideo(this._followActive) : undefined;
    this._setSessionMuted(!this._followMuted, active);
    this._showFollowCtrl();
  };

  private _toggleFs = (e: Event): void => {
    e.stopPropagation();
    // MOBILE: iPhone Safari won't fullscreen a non-video element and forbids JS
    // orientation lock, and its NATIVE video fullscreen ignores our wish and
    // stays PORTRAIT on an orientation-locked phone. So promote the whole player
    // (an always-open <dialog>) to the top layer via showModal() — that escapes
    // the card's nested clipping without moving/remounting the <video> — and
    // CSS-rotate it to LANDSCAPE ourselves (the YouTube-app feel). Synced in
    // updated() -> _syncFsDialog.
    if (this.stacked) {
      const entering = !this._isFs;
      this._isFs = entering;
      this._forceRotate = entering && window.innerHeight > window.innerWidth;
      this._showFollowCtrl();
      return;
    }
    // Desktop/tablet: real element fullscreen of the HOST (persists across the
    // live<->rewind swap; both leap-frog videos live inside it). The inline
    // dialog just fills the fullscreened host.
    if (!document.fullscreenElement) void this.requestFullscreen?.().catch(() => undefined);
    else void document.exitFullscreen?.().catch(() => undefined);
    this._showFollowCtrl();
  };

  /** Promote/demote the player dialog to/from the top layer to match _isFs.
   *  Enter uses `open = false` (not close()) to demote the inline dialog so no
   *  spurious `close` event fires — close() dispatches its event asynchronously,
   *  which would otherwise race _onDlgClose and toggle us straight back out. */
  private _syncFsDialog(): void {
    const dlg = this._fsDlg;
    if (!dlg) return;
    if (this._isFs) {
      if (!this._modalOn) {
        if (dlg.open) dlg.open = false; // demote inline WITHOUT firing close
        try {
          dlg.showModal();
          this._modalOn = true;
        } catch {
          /* showModal can throw if not connected; ignore */
        }
      }
    } else {
      if (this._modalOn) {
        dlg.close(); // leave the top layer
        this._modalOn = false;
      }
      dlg.open = true; // back to inline (no focus-steal, vs show())
    }
  }

  /** The modal was dismissed (Esc / back gesture) — leave fullscreen so
   *  updated() re-shows it inline. */
  private _onDlgClose = (): void => {
    this._modalOn = false;
    if (this._isFs) {
      this._isFs = false;
      this._forceRotate = false;
    }
  };

  private _onFsChange = (): void => {
    // DESKTOP/tablet element fullscreen only — mobile drives _isFs via the dialog.
    if (!this.stacked) this._isFs = !!document.fullscreenElement;
  };

  // ---- LIVE custom controls (native controls off; same bar as delayed-follow) --

  private _liveVideo(): HTMLVideoElement | null {
    const high = this._highLiveVideo();
    if (!this._useWebRtcLive || this._highLiveReady) return high;
    return this._bridgeLiveVideo() ?? high;
  }

  private _highLiveVideo(): HTMLVideoElement | null {
    const player = this.renderRoot.querySelector('.live-player');
    return player ? shadowVideo(player) : null;
  }

  private _bridgeLiveVideo(): HTMLVideoElement | null {
    const bridge = this.renderRoot.querySelector('.live-bridge');
    return bridge ? shadowVideo(bridge) : null;
  }

  private _setSessionMuted(muted: boolean, activeVideo?: HTMLVideoElement | null): void {
    this._audioUserChoice = muted ? 'muted' : 'unmuted';
    this._liveMuted = muted;
    this._followMuted = muted;
    this._clipMuted = muted;
    this._liveAudioAttempted = true;

    const videos = new Set([
      this._liveVideo(),
      this._highLiveVideo(),
      this._bridgeLiveVideo(),
      this._video,
      this._followVidA,
      this._followVidB,
    ]);
    const bridge = this.renderRoot.querySelector('.live-bridge') as HaLivePlayerElement | null;
    if (bridge) bridge.muted = muted;
    for (const video of videos) {
      if (!video) continue;
      video.muted = muted;
      if (!muted) {
        video.volume = 1;
        const stream = video.srcObject;
        if (stream instanceof MediaStream) {
          for (const track of stream.getAudioTracks()) track.enabled = true;
        }
      }
    }
    if (!muted && activeVideo) activeVideo.play().catch(() => undefined);
  }

  private _resetAudioSession(): void {
    this._audioUserChoice = undefined;
    this._liveMuted = true;
    this._followMuted = true;
    this._clipMuted = true;
    this._liveAudioAttempted = false;
    this._liveAudioTrying = false;

    const videos = new Set([
      this._liveVideo(),
      this._highLiveVideo(),
      this._bridgeLiveVideo(),
      this._video,
      this._followVidA,
      this._followVidB,
    ]);
    const bridge = this.renderRoot.querySelector('.live-bridge') as HaLivePlayerElement | null;
    if (bridge) bridge.muted = true;
    for (const video of videos) if (video) video.muted = true;
  }

  private _resetLiveHealth(): void {
    this._liveHealth = new LiveHealthTracker(
      LIVE_STABLE_MS,
      this._useWebRtcLive ? LIVE_WEBRTC_STALL_MS : LIVE_STALL_MS,
    );
  }

  private _resetLiveSession(): void {
    this._livePlayerGeneration++;
    this._livePausedState = false;
    this._liveMuted = this._audioUserChoice !== 'unmuted';
    this._highLiveReady = false;
    this._liveMountedAt = performance.now();
    this._liveStartupAttempts = 0;
    clearTimeout(this._livePreviewWarmTimer);
    this._livePreviewWarmTimer = undefined;
    this._livePreviewWarmed = false;
    this._liveAudioAttempted = this._audioUserChoice !== undefined;
    this._liveAudioTrying = false;
    this._resetLiveHealth();
  }

  private _restartLivePlayer(startupFailure = false): void {
    this._livePlayerGeneration++;
    releaseVideosIn(this.renderRoot.querySelector('.live-stage'));
    this._highLiveReady = false;
    this._liveRestartKey++;
    this._liveMountedAt = performance.now();
    this._liveStartupAttempts = startupFailure ? this._liveStartupAttempts + 1 : 0;
    this._liveMuted = this._audioUserChoice !== 'unmuted';
    this._liveAudioAttempted = this._audioUserChoice !== undefined;
    this._liveAudioTrying = false;
    this._lastLivePlaying = undefined;
    this._resetLiveHealth();
  }

  /** Leave the HA player audio-enabled, but mute its nested media element before
   * media arrives so visual autoplay never depends on audible policy. */
  private _armLivePlayer(): void {
    const player = this.renderRoot.querySelector('.live-player') as HaLivePlayerElement | null;
    if (!player) return;
    const generation = this._livePlayerGeneration;
    void (player.updateComplete ?? Promise.resolve()).then(() => {
      if (!this.live || generation !== this._livePlayerGeneration) return;
      const video = shadowVideo(player);
      if (!video) return;
      video.muted = this._liveMuted;
      if (!this._livePausedState && video.paused) {
        video.play().catch(() => undefined);
      }
    });
    const bridge = this.renderRoot.querySelector('.live-bridge') as HaLivePlayerElement | null;
    if (bridge) {
      bridge.muted = this._liveMuted;
      void (bridge.updateComplete ?? Promise.resolve()).then(() => {
        if (!this.live || generation !== this._livePlayerGeneration) return;
        const video = shadowVideo(bridge);
        if (!video) return;
        video.muted = this._liveMuted;
        if (!this._livePausedState && video.paused) video.play().catch(() => undefined);
      });
    }
  }

  private async _tryAutoLiveAudio(video: HTMLVideoElement): Promise<void> {
    if (this._liveAudioTrying || this._liveAudioAttempted) return;
    this._liveAudioAttempted = true;
    this._liveAudioTrying = true;
    const generation = this._livePlayerGeneration;
    const before = video.currentTime;
    try {
      video.muted = false;
      await video.play();
      await new Promise<void>((resolve) => setTimeout(resolve, LIVE_AUDIO_VERIFY_MS));
      if (
        generation !== this._livePlayerGeneration ||
        video !== this._liveVideo() ||
        video.paused ||
        video.currentTime <= before + 0.01
      ) {
        throw new Error('audible autoplay did not remain active');
      }
      this._liveMuted = false;
    } catch {
      if (generation === this._livePlayerGeneration && video === this._liveVideo()) {
        if (this._audioUserChoice === 'unmuted') {
          video.muted = false;
        } else {
          video.muted = true;
          this._liveMuted = true;
          await video.play().catch(() => undefined);
        }
      }
    } finally {
      this._liveAudioTrying = false;
    }
  }

  /** Rewind 15s off live -> the card drops out of live into delayed-follow. */
  private _liveSkipBack = (e: Event): void => {
    e.stopPropagation();
    // Hold from HERE, not from the `live` property flip: that only reaches this
    // component after a round trip through the card, and the live player can be
    // gone by then. Every other skip control already holds on the press.
    this._holdFrame();
    this.dispatchEvent(
      new CustomEvent('rewind', {
        detail: { time: this.now - 15_000 },
        bubbles: true,
        composed: true,
      }),
    );
    this._showFollowCtrl();
  };

  private _toggleLivePlay = (e: Event): void => {
    e.stopPropagation();
    const v = this._liveVideo();
    if (!v) return;
    if (v.paused) {
      this._livePausedState = false;
      for (const video of new Set([v, this._highLiveVideo(), this._bridgeLiveVideo()])) {
        video?.play().catch(() => {});
      }
    } else {
      this._livePausedState = true;
      for (const video of new Set([v, this._highLiveVideo(), this._bridgeLiveVideo()])) {
        video?.pause();
      }
    }
    this._showFollowCtrl();
  };

  private _toggleLiveMute = (e: Event): void => {
    e.stopPropagation();
    const muted = !this._liveMuted;
    this._setSessionMuted(muted, this._liveVideo());
    this._showFollowCtrl();
  };

  // ---- BOUNDED event-clip custom controls (single <video>, real timeline) ----

  private _clipSkipBack = (e: Event): void => {
    e.stopPropagation();
    const v = this._video;
    if (v) {
      const target = Math.max(0, v.currentTime - 15);
      this._seekClipTo(target);
      this._announceSeek(this._clipStart + target * 1000, false);
    }
    this._showFollowCtrl();
  };
  private _clipSkipFwd = (e: Event): void => {
    e.stopPropagation();
    const v = this._video;
    if (v && isFinite(v.duration)) {
      const target = Math.min(v.duration, v.currentTime + 15);
      this._seekClipTo(target);
      this._announceSeek(this._clipStart + target * 1000, false);
    }
    this._showFollowCtrl();
  };
  private _toggleClipPlay = (e: Event): void => {
    e.stopPropagation();
    const v = this._video;
    if (!v) return;
    if (v.paused) {
      if (this._clipWatchFailed) this._seekClipTo(v.currentTime);
      v.play().catch(() => {});
    }
    else v.pause();
    this._showFollowCtrl();
  };
  private _toggleClipMute = (e: Event): void => {
    e.stopPropagation();
    const v = this._video;
    if (!v) return;
    this._setSessionMuted(!this._clipMuted, v);
    this._showFollowCtrl();
  };
  private _toggleClipRate = (e: Event): void => {
    e.stopPropagation();
    this._clipRate = this._clipRate === 1 ? 2 : this._clipRate === 2 ? 4 : 1;
    const v = this._video;
    if (v) v.playbackRate = this._clipRate;
    this._showFollowCtrl();
  };

  /** The content time (epoch ms) the active chunk is currently showing. */
  private _followContentNow(): number | null {
    const a = this._followActive;
    if (!a) return null;
    const v = this._followVideo(a);
    const m = this._followMeta[a];
    if (!v || !isFinite(v.duration)) return null;
    return m.end - v.duration * 1000 + v.currentTime * 1000;
  }

  /** Jump ±deltaMs from the current content time and re-follow from there.
   *  Forward is clamped to the availability floor by _startFollow. */
  /** Tell the host we are jumping to `t` RIGHT NOW, before the seek completes.
   *  A skip re-exports and reloads footage, which takes a second or two; the
   *  ruler must not sit still until then, so it glides on the press and the
   *  playback-time that eventually arrives is already where it is pointing. */
  private _announceSeek(t: number, holdFrame = true): void {
    // The skip buttons reload footage without touching targetTime, so the
    // willUpdate hook above never sees them — hold from here instead.
    if (holdFrame) this._holdFrame();
    this.dispatchEvent(
      new CustomEvent('playback-seek', { detail: { time: t }, bubbles: true, composed: true }),
    );
  }

  private _followSkip(deltaMs: number): void {
    const cur = this._followContentNow();
    if (cur == null) return;
    this._announceSeek(cur + deltaMs);
    const wasPaused = this._followPaused;
    void this._startFollow(cur + deltaMs); // resets _followPaused = false
    this._followPaused = wasPaused; // ...so keep the pause state across a skip
    this._showFollowCtrl();
  }

  // "Near live" = as close as the follow can get: it rests at ~delaySeconds +
  // a couple seconds of export overhead, so the window must be a bit above the
  // floor (delaySeconds) or it never triggers at the resting position. Within
  // it, skip-forward jumps to live and speed reverts to 1× (nothing ahead to
  // fast-forward through).
  private get _nearLiveMs(): number {
    return (this.delaySeconds + 5) * 1000;
  }

  private _followNearLive(): boolean {
    const c = this._followContentNow();
    return c != null && this.now - c < this._nearLiveMs;
  }

  private _skipBack = (e: Event): void => {
    e.stopPropagation();
    this._followSkip(-15_000);
  };
  private _skipFwd = (e: Event): void => {
    e.stopPropagation();
    if (this._followNearLive()) {
      // Already near live — can't skip into the un-exportable tail; go LIVE
      // instead (same as the timeline's jump-to-live arrow).
      this.dispatchEvent(new CustomEvent('go-live', { bubbles: true, composed: true }));
      return;
    }
    this._followSkip(15_000);
  };

  private _toggleFollowRate = (e: Event): void => {
    e.stopPropagation();
    if (this._followNearLive()) return; // capped at 1× near the live edge
    this._followRate = this._followRate === 1 ? 2 : this._followRate === 2 ? 4 : 1;
    [this._followVidA, this._followVidB].forEach((v) => {
      if (v) v.playbackRate = this._followRate;
    });
    this._showFollowCtrl();
  };

  private _setFollowRate(rate: number): void {
    if (this._followRate === rate) return;
    this._followRate = rate;
    [this._followVidA, this._followVidB].forEach((v) => {
      if (v) v.playbackRate = rate;
    });
  }

  /** The custom control bar, shared by all three players (LIVE, delayed-follow,
   *  bounded event clip) so they feel identical. Live greys skip-forward + speed
   *  (nothing ahead of live); follow greys speed near the live edge (and its
   *  skip-forward jumps to live there); a clip enables everything. */
  private _renderCtrlBar(mode: 'live' | 'follow' | 'clip', inert = false) {
    if (!inert) this._ctrlMode = mode; // remembered for the scrub stage
    const live = mode === 'live';
    const clip = mode === 'clip';
    const paused = live ? this._livePausedState : clip ? this._clipPaused : this._followPaused;
    const muted = live ? this._liveMuted : clip ? this._clipMuted : this._followMuted;
    const rate = clip ? this._clipRate : live ? 1 : this._followRate;
    const speedOn = clip ? this._clipRate > 1 : !live && this._followRate > 1;
    const speedDisabled = live || (mode === 'follow' && this._nearLive);
    const back = live ? this._liveSkipBack : clip ? this._clipSkipBack : this._skipBack;
    const playPause = live ? this._toggleLivePlay : clip ? this._toggleClipPlay : this._toggleFollowPlay;
    const fwd = clip ? this._clipSkipFwd : this._skipFwd;
    const speed = clip ? this._toggleClipRate : this._toggleFollowRate;
    const mute = live ? this._toggleLiveMute : clip ? this._toggleClipMute : this._toggleFollowMute;
    const fwdTitle = mode === 'follow' && this._nearLive ? 'Go live' : 'Forward 15s';
    return html`
      <div
        class="vctrl ${this._followCtrl ? 'show' : ''} ${this._isFs ? 'fs' : ''} ${this._fsStrip
          ? 'fs-inset'
          : ''} ${inert ? 'inert' : ''}"
        style="--upc-fs-tl-w:${this.fsTimelineWidth}px;--upc-fs-tl-gut:${this
          .fsTimelineGutter}px;--upc-fs-tl-pad:${this.fsTimelinePadding}px"
        @click=${(e: Event) => e.stopPropagation()}
      >
        <button @click=${back} title="Back 15s">
          <ha-icon icon="mdi:rewind-15"></ha-icon>
        </button>
        <button @click=${playPause} title=${paused ? 'Play' : 'Pause'}>
          <ha-icon icon=${paused ? 'mdi:play' : 'mdi:pause'}></ha-icon>
        </button>
        <button ?disabled=${live} @click=${live ? undefined : fwd} title=${fwdTitle}>
          <ha-icon icon="mdi:fast-forward-15"></ha-icon>
        </button>
        <button
          class="vctrl-speed ${speedOn ? 'on' : ''}"
          ?disabled=${speedDisabled}
          @click=${live ? undefined : speed}
          title="Playback speed"
        >
          ${rate}×
        </button>
        <button @click=${mute} title=${muted ? 'Unmute' : 'Mute'}>
          <ha-icon icon=${muted ? 'mdi:volume-off' : 'mdi:volume-high'}></ha-icon>
        </button>
        <button class="vfs" @click=${this._toggleFs} title="Fullscreen">
          <ha-icon icon=${this._isFs ? 'mdi:fullscreen-exit' : 'mdi:fullscreen'}></ha-icon>
        </button>
        ${clip
          ? html`<div class="vseek-row">
              <span class="vtime"
                >${this._fmtClock(this._clipTime)} / ${this._fmtClock(this._clipDuration)}</span
              >
              <div class="vseek" @pointerdown=${this._onSeekDown}>
                <div class="vseek-track">
                  <div class="vseek-fill" style="width:${this._clipProgress * 100}%"></div>
                  <div class="vseek-knob" style="left:${this._clipProgress * 100}%"></div>
                </div>
              </div>
            </div>`
          : html`<div class="vctrl-spacer"></div>`}
      </div>
    `;
  }

  /** True while the host's slotted overlay timeline is on screen. */
  private get _fsStrip(): boolean {
    return this._isFs && this.fsTimeline;
  }

  /** The fullscreen overlay timeline strip. Rendered as a SIBLING of the stage
   *  (inside the dialog on mobile) so it survives the stage being swapped for
   *  the scrub-preview one mid-drag — the drag that caused the swap.
   *  All pointer traffic stops here: the stage's tap-to-toggle would hide the
   *  controls mid-scrub, and the card's video-column drag gesture would read a
   *  vertical scrub as "open the camera strip". Down/move also re-arm the
   *  auto-hide so a long drag can't make the strip vanish under the finger. */
  private _renderFsTimeline() {
    if (!this._fsStrip) return nothing;
    const hold = (e: Event): void => {
      e.stopPropagation();
      this._showFollowCtrl();
    };
    // Deepest at the screen edge (under the ruler), holding across it, then
    // fading out under the thumbnails that hang past the strip.
    const s = this.fsTimelineScrim;
    const scrim =
      `linear-gradient(to left, rgba(0,0,0,${s}) 30%, rgba(0,0,0,${(s * 0.78).toFixed(3)}) 55%,` +
      ` rgba(0,0,0,${(s * 0.35).toFixed(3)}) 80%, transparent)`;
    // 0 (the default) = the whole player accepts the gesture.
    const boxWidth =
      this.fsTimelineGrabWidth > 0
        ? `calc(${Math.max(this.fsTimelineWidth, this.fsTimelineGrabWidth)}px + ${this
            .fsTimelineGutter}px)`
        : '100%';
    return html`<div
      class="fs-tl ${this._followCtrl ? 'show' : ''}"
      style="--upc-fs-tl-w:${this.fsTimelineWidth}px;--upc-fs-tl-boxw:${boxWidth};--upc-fs-tl-gut:${this
        .fsTimelineGutter}px;--upc-fs-tl-pad:${this
        .fsTimelinePadding}px;--upc-fs-tl-scrim-ext:${this
        .fsTimelineScrimExtend}px;--upc-fs-tl-bg:${scrim}"
      @pointerdown=${hold}
      @pointermove=${hold}
      @wheel=${hold}
      @pointerup=${(e: Event) => e.stopPropagation()}
      @pointercancel=${(e: Event) => e.stopPropagation()}
      @click=${this._onStripBlankTap}
      @tap-through=${this._onStripTap}
    >
      <slot name="fs-timeline"></slot>
    </div>`;
  }

  render() {
    const stage = this._stage();
    // DESKTOP/tablet fullscreen uses the real Fullscreen API on the host, so it
    // needs NO dialog — and wrapping a LIVE <video> in a <dialog> breaks its
    // compositing on desktop Chrome (audio plays, the frame FREEZES). Only the
    // MOBILE (stacked) landscape fullscreen needs the top-layer showModal, so
    // only there does the player live inside the always-open <dialog>.
    // The freeze canvas sits next to the stage in BOTH layouts — inside the
    // dialog for the rotated phone fullscreen, so it rotates and fills with it.
    // Both hold elements are always in the tree. Lit's update is async, and the
    // outgoing player can be torn down before that render lands — which left a
    // ~200ms black gap at the very start of a transition. Having both mounted
    // lets _holdFrame reveal the right one SYNCHRONOUSLY, the instant it has the
    // picture; these bindings just keep the DOM honest afterwards.
    const freeze = html`
      <canvas class="freeze" ?hidden=${!this._frozen || !!this._holdPoster}></canvas>
      <img
        class="freeze"
        src=${this._posterPreload || this._holdPoster || nothing}
        ?hidden=${!this._frozen || !this._holdPoster}
        alt=""
      />
    `;
    if (!this.stacked) return html`${stage}${freeze}${this._renderFsTimeline()}`;
    return html`<dialog
      class="fs-wrap ${this._isFs ? 'fs-active' : ''} ${this._forceRotate ? 'rotate' : ''}"
      @close=${this._onDlgClose}
    >
      ${stage}${freeze}${this._renderFsTimeline()}
    </dialog>`;
  }

  private _stage() {
    if (!this.nvrId || !this.cameraId) {
      return html`<div class="stage"><div class="msg error">Missing camera / nvr_id.</div></div>`;
    }

    // LIVE: non-Apple clients keep the explicit high HLS player. Apple mobile
    // gets a smooth medium bridge while explicit high WebRTC negotiates; after
    // verified high motion the bridge is released and unmounted.
    if (this._liveStream) {
      const stateObj = this.hass.states[this.cameraId];
      const bridgeStateObj = this.hass.states[this.liveBridgeCameraId];
      const useWebRtc = this._useWebRtcLive;
      return html`
        <div
          class="stage live-stage"
          style=${this.accent ? `--upc-accent:${this.accent}` : ''}
          @pointermove=${this._showFollowCtrl}
          @pointerdown=${this._onStagePress}
          @click=${this._onStageTap}
        >
          ${stateObj
            ? html`${this._hidden
                  ? nothing
                  : keyed(
                      this._liveRestartKey,
                      useWebRtc
                        ? html`<ha-web-rtc-player
                              class="live-player live-high"
                              autoplay
                              playsinline
                              .entityid=${this.cameraId}
                              .controls=${false}
                              .muted=${false}
                            ></ha-web-rtc-player>
                            ${!this._highLiveReady && bridgeStateObj
                              ? html`<ha-camera-stream
                                  class="live-bridge"
                                  .hass=${this.hass}
                                  .stateObj=${bridgeStateObj}
                                  .controls=${false}
                                  .muted=${this._liveMuted}
                                  allow-exoplayer
                                ></ha-camera-stream>`
                              : nothing}`
                        : html`<ha-hls-player
                            class="live-player"
                            autoplay
                            playsinline
                            .entityid=${this.cameraId}
                            .controls=${false}
                            .muted=${false}
                          ></ha-hls-player>`,
                    )}
                ${this._renderCtrlBar('live')}`
            : html`<div class="msg error">Camera entity not found.</div>`}
        </div>
      `;
    }

    if (this.scrubbing) {
      // Scrub stage: cached timelapse frames when the preview cache has this
      // time (UniFi-style), otherwise plain black. Never calls the NVR.
      // The control bar rides along in its pre-scrub mode (inert — there is no
      // player behind it right now) so it doesn't blink out mid-gesture.
      return html`
        <div class="stage" style=${this.accent ? `--upc-accent:${this.accent}` : ''}>
          <!-- SPRITE-PREVIEW-2026-08-04: the decoder-free surface. Always in the
               tree while scrubbing so _drawSprite can paint it synchronously
               (Lit's update is async and the first frame must not wait a tick),
               but only revealed once it actually holds a frame — an unpainted
               canvas is black, and the held still is covering that moment. -->
          <canvas
            class="sprite ${this._spriteReady ? 'preview-on' : 'preview-off'}"
          ></canvas>
          <video
            class="preview-a ${this._previewActive === 'a' ? 'preview-on' : 'preview-off'}"
            muted
            playsinline
            preload="auto"
            .src=${this._previewSrcA ?? ''}
            @loadedmetadata=${() => this._onPreviewMeta('a')}
            @loadeddata=${() => this._onPreviewLoaded('a')}
            @seeked=${() => this._onPreviewSeeked('a')}
            @error=${() => this._onPreviewError('a')}
          ></video>
          <video
            class="preview-b ${this._previewActive === 'b' ? 'preview-on' : 'preview-off'}"
            muted
            playsinline
            preload="auto"
            .src=${this._previewSrcB ?? ''}
            @loadedmetadata=${() => this._onPreviewMeta('b')}
            @loadeddata=${() => this._onPreviewLoaded('b')}
            @seeked=${() => this._onPreviewSeeked('b')}
            @error=${() => this._onPreviewError('b')}
          ></video>
          ${this._renderCtrlBar(this._ctrlMode, true)}
        </div>
      `;
    }

    if (this._followActive !== null) {
      // DELAYED-FOLLOW: two leap-frogged <video>s. The active one plays on top;
      // the standby one buffers the next chunk underneath. Swapping z-index +
      // opacity (no transition) hides the reset frame, so playback is seamless.
      return html`
        <div
          class="stage follow-stage"
          style=${this.accent ? `--upc-accent:${this.accent}` : ''}
          @pointermove=${this._showFollowCtrl}
          @pointerdown=${this._onStagePress}
          @click=${this._onStageTap}
        >
          <video
            class="follow-a ${this._followActive === 'a' ? 'follow-on' : 'follow-off'}"
            playsinline
            preload="auto"
            .muted=${this._followMuted}
            .src=${this._followSrcA ?? ''}
            @loadeddata=${() => this._onFollowLoaded('a')}
            @seeked=${() => this._onFollowSeeked('a')}
            @timeupdate=${() => this._onFollowTime('a')}
            @ended=${() => this._onFollowEnded('a')}
            @error=${() => this._onFollowError('a')}
          ></video>
          <video
            class="follow-b ${this._followActive === 'b' ? 'follow-on' : 'follow-off'}"
            playsinline
            preload="auto"
            .muted=${this._followMuted}
            .src=${this._followSrcB ?? ''}
            @loadeddata=${() => this._onFollowLoaded('b')}
            @seeked=${() => this._onFollowSeeked('b')}
            @timeupdate=${() => this._onFollowTime('b')}
            @ended=${() => this._onFollowEnded('b')}
            @error=${() => this._onFollowError('b')}
          ></video>
          ${this._tapToPlay
            ? html`<button class="tap-play" @click=${this._onTapToPlay} title="Play">▶</button>`
            : this._loadingVideo
              ? html`<div class="overlay"><div class="spinner"></div></div>`
              : nothing}
          ${this._error ? html`<div class="msg error">${this._error}</div>` : nothing}
          ${this._renderCtrlBar('follow')}
        </div>
      `;
    }

    if (!this._videoSrc) {
      // At a time the camera was offline there is no footage — say so (parity
      // with the grey timeline gap) instead of a generic "unavailable".
      const offline = !this.live && inGap(this.gaps, this.targetTime);
      // This stage used to carry no tap handlers and no control bar, which made
      // fullscreen a DEAD END whenever there was nothing to play: the chrome
      // auto-hid, tapping did nothing to bring it back, there was no exit
      // button, and the timeline strip was hidden (and inert) alongside it —
      // the only way out was killing the app. It gets the same tap-to-toggle as
      // every other stage, plus the control bar in fullscreen, riding along
      // inert because there is no player behind it: its job here is purely to
      // offer the way out and back to the ruler.
      return html`<div
        class="stage"
        style=${this.accent ? `--upc-accent:${this.accent}` : ''}
        @pointermove=${this._showFollowCtrl}
        @pointerdown=${this._onStagePress}
        @click=${this._onStageTap}
      >
        ${this.live
          ? html`<div class="overlay"><div class="spinner"></div>Connecting…</div>`
          : offline
            ? html`<div class="msg">Footage unavailable — camera was offline.</div>`
            : this._loadingVideo
              ? this._preparing
                ? // No percentage any more: the transfer happens NVR->server, so
                  // there is nothing client-side to measure. Export dominates
                  // (~5.6s for a 5-minute clip), the remux is ~0.3s.
                  html`<div class="overlay clip-status"><div class="spinner"></div>Preparing clip…</div>`
                : html`<div class="overlay clip-status"><div class="spinner"></div>Loading clip…</div>`
              : this._error
                ? html`<div class="msg error">${this._error}</div>`
                : html`<div class="msg">Tap the timeline to play from a time.</div>`}
        ${this._isFs ? this._renderCtrlBar(this._ctrlMode, true) : nothing}
      </div>`;
    }

    return html`
      <div
        class="stage clip-stage"
        style=${this.accent ? `--upc-accent:${this.accent}` : ''}
        @pointermove=${this._showFollowCtrl}
        @pointerdown=${this._onStagePress}
        @click=${this._onStageTap}
      >
        <video
          class="clip ${this._loadingVideo ? 'loading' : ''}"
          autoplay
          playsinline
          preload="auto"
          .muted=${this._clipMuted}
          .src=${this._videoSrc}
          @timeupdate=${this._onTimeUpdate}
          @ended=${this._onEnded}
          @canplay=${this._onVideoReady}
          @playing=${this._onVideoReady}
          @loadeddata=${this._onVideoReady}
          @seeking=${this._onClipSeeking}
          @seeked=${this._onClipSeeked}
          @waiting=${this._onClipWaiting}
          @stalled=${this._onClipWaiting}
          @play=${this._onClipPlay}
          @pause=${this._onClipPause}
          @error=${this._onVideoError}
        ></video>
        ${this._loadingVideo
          ? html`<div class="overlay clip-status"><div class="spinner"></div>Loading clip…</div>`
          : this._clipBuffering
            ? html`<div class="overlay clip-buffering" aria-label="Buffering clip">
                <div class="spinner"></div>
              </div>`
            : nothing}
        ${this._renderCtrlBar('clip')}
        ${this._error ? html`<div class="msg error">${this._error}</div>` : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'upc-media-view': MediaView;
  }
}
