// The video / preview area above the timeline.
//
// ONE <video> shows everything: live, recorded footage, events. It is driven by
// NvrPlayer (nvr-player.ts), which feeds it the NVR's own fMP4 streams through
// protect_cache's relay into one MediaSource on a wall-clock timeline — the way
// the UniFi app plays. So nothing is ever handed from one player to another: a
// skip or a seek is a seek in the same element, going live or rewinding from
// live is too, and the frame on screen stays until the next one is ready.
// That replaced (2026-10-13) two leap-frogging <video>s fed with exported clip
// files, HA's HLS/WebRTC players for live and a medium-stream bridge — every
// hand-over between them showed on the wall tablet as a jump.
//
// The scrub preview (cached timelapse sprites/videos while the timeline is
// dragged) is a layer ON TOP of that element, so the footage underneath keeps
// its buffer through a scrub.
//
// IOS-FREEZE-2026-09-26 (see data/platform.ts): on Apple WebKit a <video> is
// never drawn into a canvas, and playback never runs into `ended` (NvrPlayer
// stops an event a moment before its end and never ends the MediaSource).

import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import type { FootageGap, HomeAssistant } from './data/types';
import { APPLE_WEBKIT } from './data/platform';
import { inGap } from './data/gaps';
import { shouldAttemptLiveAudio, type LiveAudioStart } from './data/live-audio';
import { Talker } from './talk';
import { dbg } from './data/debug-log';
import {
  ScrubPreviewLoader,
  spriteVariantOrder,
  type PreviewBlock,
  type SpriteSet,
  type SpriteVariant,
} from './data/scrub-preview';
import { releaseVideo, releaseVideosIn } from './data/media-release';
import { NvrPlayer, RECORDED_LAG_MS, RECORDED_SAFE_MS } from './nvr-player';
import { FADE_MS, containBox, frameOf, type Box } from './data/motion';

// How close to live a scrub has to be before the EXPERIMENTAL tip tier asks the
// NVR for a fresh real-time clip. Comfortably wider than the tip's own 60s
// window plus the head's worst staleness, so a gesture that lands anywhere in
// the stale region still triggers one, while scrubbing through history never
// touches the NVR at all.
const TIP_NEAR_LIVE_MS = 5 * 60_000;
const TALK_MSG_MS = 4_000; // how long "why talking stopped" stays up
// While talking, live plays from this channel: the doorbell's echo-cancelled
// audio is only there (see _toggleTalk).
const TALK_LIVE_CHANNEL = 1;

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

// The held frame (scrub end) is a backstop-bounded cover: live must never be
// hidden longer than one keyframe interval, recorded footage a little longer.
const LIVE_FREEZE_MAX_MS = 5_000;
const HISTORICAL_FREEZE_MAX_MS = 15_000;
// The skip buttons' step (back / forward), like the UniFi app's.
const SKIP_MS = 10_000;
// cardFs skip glyphs: mdi:rewind-10 / mdi:fast-forward-10 (path data as HA
// ships them, 24-unit grid), split into the arrow and the "10" so the two can
// be pulled apart — as drawn they all but touch. Must match SKIP_MS.
const SKIP_ARC_BACK =
  'M12.5,3C17.15,3 21.08,6.03 22.47,10.22L20.1,11C19.05,7.81 16.04,5.5 12.5,5.5C10.54,5.5 ' +
  '8.77,6.22 7.38,7.38L10,10H3V3L5.6,5.6C7.45,4 9.85,3 12.5,3Z';
const SKIP_ARC_FWD =
  'M11.5,3C14.15,3 16.55,4 18.4,5.6L21,3V10H14L16.62,7.38C15.23,6.22 13.46,5.5 11.5,5.5C7.96,5.5 ' +
  '4.95,7.81 3.9,11L1.53,10.22C2.92,6.03 6.85,3 11.5,3Z';
const SKIP_DIGITS =
  'M10,12V22H8V14H6V12H10M18,14V20C18,21.11 17.11,22 16,22H14A2,2 0 0,1 12,20V14A2,2 0 0,1 ' +
  '14,12H16C17.11,12 18,12.9 18,14M14,14V20H16V14H14Z';
// cardFs middle row: the gap between its buttons, and the buttons' own width
// (skip + play + skip, see .vc-skip / .vc-play) for fitting that gap.
const VC_GAP = 128;
const VC_ROW_W = 75 + 97 + 75;
// The multi page's clip players (roundCtrl) are smaller than the camera
// screen: all their controls at this scale (user, 2026-10-26: "about 10%
// smaller... maybe smaller still" - one number).
const CLIP_CTRL_SCALE = 0.9;
// The phone's: its clip players (a full-width card in the clip's own shape -
// landscape footage with a strip below the picture for the seek bar and
// buttons, PHONE_CLIP_STRIP in multi-view; buttons >= 44px) and its camera
// screen (a ~844 x 390 screen turned sideways, or a ~390px-wide upright one),
// whose controls match the clip players' (user, 2026-10-28).
const PHONE_CLIP_CTRL_SCALE = 0.8;
const PHONE_CTRL_SCALE = PHONE_CLIP_CTRL_SCALE;
// Shortest press flash (see _pressFlash): a tap is often over before a frame.
const PRESS_MIN_MS = 90;
const LIVE_AUDIO_VERIFY_MS = 350;
// Hidden this long -> release every player (see _suspend). Short enough that a
// closed popup lets go almost at once, long enough to ride out a flicker.
const SUSPEND_AFTER_MS = 3_000;
// Shown again after being hidden LONGER than this (the tablet's screen off
// overnight with a camera popup open, the phone app in the background): come
// back on LIVE, as reopening the card does. A shorter hide resumes the footage
// that was playing. 2026-10-14: the wall tablet woke at 8:00 on the frame
// scrubbed to at midnight, and a scrub showed that frame until its first
// preview photo arrived.
const LONG_HIDE_MS = 5 * 60_000;
// HOLDFRAME-2026-08-05: master switch for the held-frame overlay.
const HOLD_FRAME_ENABLED = true;
// Recorded footage this close to now is "near live": skip-forward goes live
// unless it can land exactly (see _skipFwd), and the speed is held at 1x (the
// NVR's playable recordings trail real time by up to RECORDED_SAFE_MS, so
// there is nothing ahead to fast-forward through).
const NEAR_LIVE_MS = RECORDED_SAFE_MS + 5_000;
// A forward skip landing this close to now (or past it) is simply LIVE.
const FWD_LIVE_MS = 2_000;
// The ruler and the event seek bar follow playback this often (every frame is
// reported; a jump is passed on at once).
const TIME_REPORT_MS = 250;

/** A play() rejection that means "the browser refused", not "superseded".
 *  NotAllowedError = autoplay policy (iOS Low Power Mode refuses even muted).
 *  AbortError = a load()/src change interrupted it, which recovers on its own. */
function isBlockedByPolicy(err: unknown): boolean {
  return (err as { name?: string } | null)?.name === 'NotAllowedError';
}

@customElement('upc-media-view')
export class MediaView extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @property() nvrId = '';
  @property() cameraId = '';
  // Camera-offline spans: while footage there is awaited, say "camera was
  // offline" instead of a spinner — matches the grey timeline gap.
  @property({ attribute: false }) gaps: FootageGap[] = [];
  @property({ type: Number }) targetTime = Date.now();
  @property({ type: Boolean }) scrubbing = false;
  @property({ type: Boolean }) live = false;
  // The camera has a speaker (the host decides — see talk.ts cameraCanTalk):
  // live view shows a Talk button in the control bar.
  @property({ type: Boolean }) canTalk = false;
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
  // When > targetTime, an EVENT is being played: [targetTime, clipEndTime] is
  // its span — the seek bar's range, and where playback STOPS (paused on the
  // last frame, `clip-ended` sent once). Play replays it; a skip or seek resumes.
  @property({ type: Number }) clipEndTime = 0;
  // Accent color (matches the card's accent_color).
  @property() accent = '';
  @property() liveAudioStart: LiveAudioStart = 'muted';
  // True when the host card is in its stacked (phone) layout — turns on the
  // mobile control bar (full-width seek row) and the rotate-to-landscape
  // fullscreen. Passed down from the card's _isStacked().
  @property({ type: Boolean, reflect: true }) stacked = false;
  // Auto-enter fullscreen on mount, and emit `fs-exit` when fullscreen is left.
  // Used by the multi page to open a live camera fullscreen from a grid tile
  // (same player/controls as the timeline), returning to the grid on exit.
  @property({ type: Boolean }) startFs = false;
  // The host has a better fullscreen than this bare player: the fullscreen
  // button hands off (`fullscreen-handoff`, with the camera and the moment on
  // screen) instead of going fullscreen here. The multi page uses it to open
  // the camera's own fullscreen TIMELINE at that moment.
  @property({ type: Boolean }) fsHandoff = false;
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
  // WHOLE player, so a drag anywhere on the picture scrubs; a TAP anywhere
  // toggles the controls (see _tap).
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
  // The player IS the card (the tablet's camera screen): the fullscreen look —
  // overlay timeline, inset and scaled-up controls — inside the card, without
  // the Fullscreen API. The fullscreen button becomes "exit" (`fs-exit`),
  // shown only when the host has somewhere to go back to (`cardFsExit`). The
  // host's other overlay chrome is slotted and shows/hides with the controls:
  // `fs-top` (camera picker) and `fs-side` (events panel — while open it is
  // `fsSide` px wide and the strip and the controls make way for it). (The
  // date pill rides in the timeline's own `foot` slot.)
  @property({ type: Boolean, reflect: true, attribute: 'cardfs' }) cardFs = false;
  @property({ type: Boolean }) cardFsExit = false;
  // The camera screen's controls without its timeline (the multi page's clip
  // players, wide layout): the same round buttons at CLIP_CTRL_SCALE, plus a
  // seek bar over the event, - with `fsHandoff` - a "View in Timeline" pill
  // that hands off to the camera screen at the moment on screen, and - with
  // `closable` - a close button ending the row (`player-close`: the host
  // closes the player).
  @property({ type: Boolean, reflect: true, attribute: 'roundctrl' }) roundCtrl = false;
  @property({ type: Boolean }) closable = false;
  // The camera screen on a phone (the host's stacked layout): its controls at
  // PHONE_CTRL_SCALE - and, `upright` (portrait footage on an upright phone),
  // the bar runs full width along the bottom, clear of the home indicator,
  // with the timeline and the events panel ending above it.
  @property({ type: Boolean, reflect: true }) phone = false;
  @property({ type: Boolean, reflect: true }) upright = false;
  // A picture to show where the video will be (object-fit contain, like the
  // video) until the first frame after it was set - the thumbnail or frame a
  // zoom transition flew in, so the zoom lands on the same picture and the
  // video then cross-fades over it (see data/motion.ts).
  @property({ attribute: false }) poster?: string | HTMLCanvasElement;
  // Hide every control and overlay (a zoom transition is running: iOS shows
  // only the picture while it flies); they fade back when this clears.
  @property({ type: Boolean, reflect: true, attribute: 'chromehidden' }) chromeHidden = false;
  // ...or fade them all away while the host shows a modal over the player
  // (the calendar); they fade back when this clears.
  @property({ type: Boolean, reflect: true, attribute: 'chromeaside' }) chromeAside = false;
  // The upright camera screen's control bar height (_syncUprightCtrl).
  @state() private _uprightBarH = 0;
  @state() private _posterOn = false;
  @state() private _posterGone = false;
  private _posterFadeIn = false;
  private _posterTimer?: ReturnType<typeof setTimeout>;
  @property({ type: Number }) fsSide = 0;
  // The host has a panel open: the controls stay up (no auto-hide) meanwhile.
  @property({ type: Boolean }) holdCtrl = false;
  // cardFs: how far in from the ruler's right edge the slotted timeline
  // reaches at rest (its `timeline-reach`); 0 = not reported yet.
  @state() private _tlReach = 0;
  private _onTimelineReach = (e: Event): void => {
    this._tlReach = (e as CustomEvent<{ px: number }>).detail.px;
  };
  // Own width — cardFs fits its middle row's gap into the free area with it —
  // and height (the poster's box follows both).
  @state() private _hostW = 0;
  @state() private _hostH = 0;
  private _hostRo?: ResizeObserver;

  @state() private _error?: string;

  @query('.fs-wrap') private _fsDlg?: HTMLDialogElement;
  @query('video.main') private _mainVideo?: HTMLVideoElement;
  @query('video.preview-a') private _previewVidA?: HTMLVideoElement;
  @query('video.preview-b') private _previewVidB?: HTMLVideoElement;

  // ---- the player: ONE <video> for live and recorded footage ----------------
  private _player = new NvrPlayer(() => this.hass, {
    frame: (wall) => this._onFrame(wall),
    change: () => this._onPlayerChange(),
    boundReached: () => this._finishEvent(),
    failed: (message) => {
      dbg('ui:error', { cam: this.cameraId, message });
      this._error = message;
    },
    problem: (message) => this._reportPlaybackProblem(message),
    play: (video) => this._playFollowVideo(video),
  });
  // What the stage is showing: live, recorded footage, or nothing yet.
  @state() private _mode: 'live' | 'recorded' | null = null;
  // Waiting for footage: a seek or switch that has not presented its frame,
  // or playback stalled for data. Drives the (grace-delayed) spinner.
  @state() private _waiting = false;
  private _waitingSince = 0;
  // A NEW selection (another event, another camera): the previous picture is
  // hidden until the new one's first frame — the honest loading screen, never
  // a frame from live, earlier history or the event before it.
  @state() private _blank = false;
  // Live: the first frame of this live session has been presented.
  private _liveSettled = false;
  // Bumped per live session; a late audio check from an old one does nothing.
  private _liveEpoch = 0;
  // Custom controls (play/pause, skips, speed, mute, fullscreen).
  @state() private _followPaused = false;
  @state() private _followMuted = true;
  // Playback was refused by the browser even muted (iOS Low Power Mode blocks
  // autoplay outright) — offer a one-tap start instead of leaving a frozen
  // first frame on screen with no explanation.
  @state() private _tapToPlay = false;
  @state() private _followCtrl = false; // control bar visible (auto-hides)
  // The mode the control bar was last built for — the scrub stage re-renders
  // it in that mode so the chrome survives the gesture.
  private _ctrlMode: 'live' | 'follow' = 'live';
  @state() private _isFs = false; // fullscreen (mobile: dialog modal; desktop: element FS)
  @state() private _forceRotate = false; // mobile FS is CSS-rotated to landscape
  // Talk button: idle -> connecting (mic permission, session) -> talking.
  @state() private _talk: 'idle' | 'connecting' | 'talking' = 'idle';
  // Why talking stopped by itself; shown briefly above the control bar. The
  // text outlives `_talkMsgOn` so the message fades OUT with its words.
  @state() private _talkMsg = '';
  @state() private _talkMsgOn = false;
  private _talker?: Talker;
  private _talkMsgTimer?: ReturnType<typeof setTimeout>;
  private _modalOn = false; // the player dialog is currently showModal()'d
  @state() private _followRate = 1; // playback speed (1, 2 or 4)
  @state() private _nearLive = false; // within NEAR_LIVE_MS of now (disables speed)
  @state() private _livePausedState = false; // live paused by the user (for the icon)
  @state() private _liveMuted = true;
  private _livePreviewWarmTimer?: ReturnType<typeof setTimeout>;
  private _livePreviewWarmed = false;
  private _liveAudioAttempted = false;
  private _liveAudioTrying = false;
  private _audioUserChoice?: 'muted' | 'unmuted';
  private _followCtrlTimer?: ReturnType<typeof setTimeout>;
  // An event is being played: `clip-ended` has been sent for it already.
  private _eventEndSent = false;
  // The seek bar knob while it is being dragged (epoch ms), else undefined.
  @state() private _seekDragAt?: number;
  // The instant on screen while an event plays — drives its seek bar.
  @state() private _followNow?: number;
  // When _checkStage last restarted playback (see there).
  private _stageRestarts: number[] = [];
  // Throttle for `playback-time` (see _onFrame).
  private _lastTimeReport = 0;
  private _lastWallReported?: number;

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
  // Set by connectedCallback on a RE-attach; updated() rebuilds the stage.
  private _reattached = false;
  // Recorded playback's position when it was torn down (see disconnectedCallback).
  private _resumeAt?: number;
  // ...and whether it was paused there (a pause survives a hide).
  private _resumePaused = false;
  // Recorded footage was playing when the card was hidden: resume it on return.
  private _resumeOnShow = false;
  // Stage watchdog (see _checkStage).
  private _stageWatch?: ReturnType<typeof setInterval>;
  private _stageStuckSince = 0;
  private _stageLastCt = -1;

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
    /* The held frame: at the end of a scrub, a copy of the frame scrubbed TO,
       laid over the stage while the footage there loads, so the picture never
       jumps back to where playback was before the scrub. canvas is a replaced
       element, so object-fit letterboxes it exactly like the picture it was
       copied from. Above the players, below the chrome. */
    canvas.freeze {
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
    :host(:fullscreen) .vctrl,
    :host([cardfs]) .vctrl:not(.card) {
      padding: 20px 48px 40px;
    }
    /* The card-sized fullscreen: the card's own corners clip the picture. */
    :host([cardfs]) .stage {
      border-radius: 0;
    }
    video {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #000;
    }
    /* THE player. Bottom of the stage; the scrub layer, the held frame and the
       chrome sit above it. No opacity transition: a fade is a black flash. */
    video.main {
      z-index: 0;
      transition: none;
    }
    /* A new selection waits for its own first frame (see _blank). */
    video.main.blank {
      opacity: 0;
    }
    /* The picture a zoom transition flew in, until the video's first frame -
       then it cross-fades away (see poster). It fills the box the VIDEO will
       fill (placed in _stage), cropped: an event thumbnail is a square crop,
       never the camera's shape, and filling the video's box means the video
       arrives in exactly the shape the picture had. */
    .poster {
      position: absolute;
      object-fit: cover;
      z-index: 1;
      pointer-events: none;
      transition: opacity ${FADE_MS}ms ease-out;
    }
    .poster.gone {
      opacity: 0;
    }
    .poster.in {
      animation: upc-poster-in ${FADE_MS}ms ease-out;
    }
    @keyframes upc-poster-in {
      from {
        opacity: 0;
      }
    }
    div.poster > canvas {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    /* A zoom transition is flying this player: only the picture shows. The
       chrome's own opacity transitions bring it back afterwards. */
    :host([chromehidden]) .vctrl,
    :host([chromehidden]) .vcenter,
    :host([chromehidden]) .vshade,
    :host([chromehidden]) .vcshade,
    :host([chromehidden]) .fs-tl,
    :host([chromehidden]) .fs-top,
    :host([chromehidden]) .fs-side,
    :host([chromehidden]) .vtalk-msg,
    :host([chromehidden]) .overlay,
    :host([chromehidden]) .tap-play {
      opacity: 0 !important;
      pointer-events: none !important;
      transition: none !important; /* gone at once; back with their own fade */
    }
    /* The host's modal is up (the camera screen's calendar, 2026-10-30 - it
       sat on the play controls): every control, the timeline and the panels
       fade away, untappable, and come back with their own fades after. */
    :host([chromeaside]) .vctrl,
    :host([chromeaside]) .vcenter,
    :host([chromeaside]) .vshade,
    :host([chromeaside]) .vcshade,
    :host([chromeaside]) .fs-tl,
    :host([chromeaside]) .fs-top,
    :host([chromeaside]) .fs-side,
    :host([chromeaside]) .vtalk-msg {
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
      transition:
        opacity 0.25s ease,
        visibility 0s linear 0.25s !important;
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
      /* An open side panel (cardFs) pushes the strip left by its width. */
      transform: translateX(calc(-1 * var(--upc-fs-side, 0px)));
      transition:
        opacity 0.2s ease,
        transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
      pointer-events: none;
      /* A drag starting in the padding is handed to the timeline
         (_onStripPress); without this the browser claims the touch as a pan
         and cancels the pointer on its first move. */
      touch-action: none;
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
    /* The phone's, while its events panel is open (_tlAside): faded out where
       it stands, and not tappable (visibility follows the fade). */
    .fs-tl.aside {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transform: none;
      transition:
        opacity 0.2s ease,
        visibility 0s linear 0.2s;
    }
    /* The host's other overlay chrome (cardFs): the camera picker along the
       top, the events panel down the right — above the strip and the controls.
       The wrappers take no taps themselves (only what the host makes
       interactive inside does), and fade with the controls; visibility follows
       the fade so a hidden panel can't be tapped. */
    .fs-top,
    .fs-side {
      position: absolute;
      z-index: 8; /* .fs-top 9: the camera picker always on top, events too */
      pointer-events: none;
      opacity: 0;
      visibility: hidden;
      transition:
        opacity 0.2s ease,
        visibility 0s linear 0.2s;
    }
    .fs-top {
      top: 0;
      left: 0;
      right: 0;
      z-index: 9;
    }
    .fs-side {
      top: 0;
      bottom: 0;
      right: 0;
    }
    .fs-top.show,
    .fs-side.show {
      opacity: 1;
      visibility: visible;
      transition: opacity 0.2s ease;
    }
    /* While the strip is up, keep every control clear of it: the bar's gradient
       still spans full width, only its contents move in. Both fullscreen
       flavors set their own padding SHORTHAND at a higher specificity (the
       element-fullscreen and rotated-mobile rules below), so the inset has to
       be spelled out against each of them or it is silently overridden. */
    .vctrl.fs-inset,
    :host(:fullscreen) .vctrl.fs-inset,
    :host([cardfs]) .vctrl.fs-inset,
    :host([stacked]) .fs-wrap.fs-active .vctrl.fs-inset {
      padding-right: calc(
        var(--upc-fs-tl-w, 165px) + var(--upc-fs-tl-gut, 140px) + 12px + var(--upc-fs-side, 0px)
      );
      transition:
        opacity 0.2s ease,
        padding-right 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
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
    :host([stacked]) .vctrl.fs:not(.card) {
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
    /* ---- Card-sized fullscreen (cardFs) controls, iOS / UniFi-app style ----
       Round dimmed buttons (no backdrop blur: it stutters even on a laptop,
       let alone the wall tablet), on a dimmed shade of their own. The light
       edge keeps a button's outline on dark footage, where its dim disc would
       vanish. Back / play-pause / forward in the middle; speed, sound, talk
       and exit along the bottom. Both groups are centred in the area the
       timeline leaves free and follow it when the events panel opens
       (--upc-fs-shift). Hidden = not hit-testable (visibility), like the
       panels. */
    .vcenter button,
    .vctrl.card button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      border: 2px solid rgba(255, 255, 255, 0.3); /* 1.5px rounds to 1px on 1x screens */
      border-radius: 50%;
      font-family: inherit; /* the skip numbers and "1x": the card's type, not the UA's */
      background: rgba(0, 0, 0, 0.6);
      box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
      color: #fff;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      /* Speed / sound / talk fade INTO their active colours (accent, white,
         red) and back on the iOS ease-out curve — quick to start, long soft
         tail — rather than snapping. */
      transition:
        background 0.4s cubic-bezier(0.22, 1, 0.36, 1),
        color 0.4s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .vcenter button:hover,
    .vctrl.card button:hover {
      background: rgba(0, 0, 0, 0.72);
    }
    /* Press feedback for the buttons that keep their colour (skips,
       play-pause, exit; class .press, _pressFlash adds .pressed while held),
       "iPhone player" style: the button shrinks a little and its disc greys a
       touch, then springs back with a gentle overshoot; a skip's arrow also
       spins its way (_spinArc). Each state's transition is the one used to
       ENTER it: quick in on press, the softer curve out on release. (Chosen
       over a white flash - jarring - a UIKit dim and an iOS 26 lift.) */
    .vcenter button.press,
    .vctrl.card button.press {
      transition:
        background 0.35s cubic-bezier(0.22, 1, 0.36, 1),
        color 0.35s cubic-bezier(0.22, 1, 0.36, 1),
        transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .vcenter button.press.pressed,
    .vctrl.card button.press.pressed {
      transform: scale(0.92);
      background: rgba(72, 72, 76, 0.72);
      transition:
        background 0.08s ease-out,
        transform 0.08s ease-out;
    }
    .vc-skip-icon .arc {
      transform-box: view-box;
      transform-origin: 12.5px 12.5px; /* the arrow's circle (11.5px for forward) */
    }
    .vc-skip-icon .arc.fwd {
      transform-origin: 11.5px 12.5px;
    }
    /* Unavailable (forward / speed at the live edge): only the glyph fades —
       the dimmed disc stays, so it still reads on bright footage. */
    .vcenter button:disabled,
    .vctrl.card button:disabled {
      opacity: 1;
      color: rgba(255, 255, 255, 0.6);
      cursor: default;
    }
    .vcenter {
      position: absolute;
      left: 50%;
      top: var(--upc-vc-top, 50%);
      z-index: 6; /* above the strip, which spans the whole player */
      display: flex;
      align-items: center;
      gap: var(--upc-vc-gap, 128px); /* fitted to the free area (VC_GAP) */
      transform: translate(calc(-50% - var(--upc-fs-shift, 0px)), -50%);
      opacity: 0;
      visibility: hidden;
      pointer-events: none; /* only the buttons take taps, not the gaps */
      transition:
        opacity 0.2s ease,
        visibility 0s linear 0.2s,
        transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1),
        gap 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .vcenter.show {
      opacity: 1;
      visibility: visible;
      transition:
        opacity 0.2s ease,
        transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1),
        gap 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    /* The groups' shades — a soft dark ellipse behind the middle row, a deep
       gradient along the bottom. Own elements BELOW the strip (z 4 < 5), while
       the buttons sit above it: painted on the buttons' layer they dimmed the
       timeline's foot (date pill, live arrow, ruler). They fade with the
       controls and take no taps. */
    .vshade,
    .vcshade {
      position: absolute;
      z-index: 4;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    .vshade.show,
    .vcshade.show {
      opacity: 1;
    }
    /* Sizes below scale with --vc-k: 1 on the camera screen, CLIP_CTRL_SCALE
       on the multi page's (smaller) clip players. */
    .vshade {
      left: 0;
      right: 0;
      bottom: 0;
      height: calc(170px * var(--vc-k, 1));
      background: linear-gradient(to top, rgba(0, 0, 0, 0.72), rgba(0, 0, 0, 0.42) 55%, transparent);
    }
    .vcshade {
      left: 50%;
      top: var(--upc-vc-top, 50%);
      width: calc(var(--upc-vc-row, ${VC_ROW_W}px) + 2 * var(--upc-vc-gap, 128px) + 200px * var(--vc-k, 1));
      height: calc(257px * var(--vc-k, 1)); /* the play button + 80px above and below */
      transform: translate(calc(-50% - var(--upc-fs-shift, 0px)), -50%);
      background: radial-gradient(closest-side, rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.28) 55%, transparent);
      transition:
        opacity 0.2s ease,
        transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1),
        width 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .vcenter.show:not(.inert) button {
      pointer-events: auto;
    }
    .vc-skip {
      width: calc(75px * var(--vc-k, 1));
      height: calc(75px * var(--vc-k, 1));
    }
    .vc-skip-icon {
      display: block;
      width: calc(41px * var(--vc-k, 1));
      height: calc(41px * var(--vc-k, 1));
      fill: currentColor;
    }
    .vc-play {
      width: calc(97px * var(--vc-k, 1));
      height: calc(97px * var(--vc-k, 1));
    }
    .vc-play ha-icon {
      --mdc-icon-size: calc(60px * var(--vc-k, 1));
    }
    /* The bottom bar is only its centred group (and, on a clip, the seek bar
       above it): its shade is .vshade, under the strip. It takes no taps itself
       (the strip under it stays draggable); its buttons and seek bar do. */
    .vctrl.card {
      flex-direction: column;
      justify-content: flex-end;
      gap: calc(20px * var(--vc-k, 1));
      padding: calc(20px * var(--vc-k, 1)) calc(48px * var(--vc-k, 1)) calc(40px * var(--vc-k, 1));
      z-index: 6;
      pointer-events: none;
      background: none;
    }
    .vctrl.card.show:not(.inert) button,
    .vctrl.card.show:not(.inert) .vseek {
      pointer-events: auto;
    }
    /* The clip players' seek bar, iPhone-player style: elapsed on the left,
       what is left on the right, a white bar that thickens while dragged. */
    .vc-seek {
      align-self: stretch;
      display: flex;
      align-items: center;
      gap: calc(14px * var(--vc-k, 1));
    }
    /* (.vctrl.card: outranks the fullscreen bar's .vctrl.fs .vtime.) */
    .vctrl.card .vc-seek .vtime {
      margin: 0;
      min-width: 3.2em;
      font-size: calc(19px * var(--vc-k, 1));
      color: rgba(255, 255, 255, 0.85);
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
    }
    .vctrl.card .vc-seek .vtime.left {
      text-align: right;
    }
    .vc-seek .vseek {
      margin: 0;
      height: calc(32px * var(--vc-k, 1));
    }
    .vc-seek .vseek-track {
      height: calc(6px * var(--vc-k, 1));
      border-radius: calc(3px * var(--vc-k, 1));
      background: rgba(255, 255, 255, 0.3);
      transition: height 0.2s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .vc-seek .vseek.drag .vseek-track {
      height: calc(10px * var(--vc-k, 1));
      border-radius: calc(5px * var(--vc-k, 1));
    }
    .vc-seek .vseek-fill {
      border-radius: inherit;
      background: rgba(255, 255, 255, 0.92);
    }
    .vc-seek .vseek-knob {
      width: calc(16px * var(--vc-k, 1));
      height: calc(16px * var(--vc-k, 1));
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
    }
    /* "View in Timeline": a text pill, like the speed pill. */
    .vctrl.card button.vc-tl {
      width: auto;
      padding: 0 calc(22px * var(--vc-k, 1));
      border-radius: calc(29px * var(--vc-k, 1));
      font-size: calc(18px * var(--vc-k, 1));
      font-weight: 600;
      white-space: nowrap;
    }
    /* A clip's shade reaches higher: the seek bar sits above the buttons. */
    .vshade.seek {
      height: calc(230px * var(--vc-k, 1));
    }
    .vctrl-group {
      display: flex;
      align-items: center;
      gap: calc(28px * var(--vc-k, 1));
      transform: translateX(calc(-1 * var(--upc-bar-shift, 0px)));
      transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    /* The camera screen's: centred AS A WHOLE on the middle row's axis,
       whatever it holds - talk comes with live, exit with somewhere to go
       back to (user, 2026-10-31: without exit it hung off to the left). Its
       buttons are all one size, so a button's place is its index: --i of
       --n, a button and a gap apart around the axis (the group is that axis,
       0 wide). A change in the count slides them there - transform only -
       while talk keeps its slot when away (.off) and shrinks out, or grows
       back, where it stands. */
    .vctrl-group.axis {
      display: block;
      position: relative;
      width: 0;
      height: calc(57px * var(--vc-k, 1));
    }
    .vg-slot {
      --x: calc((var(--i) - (var(--n) - 1) / 2) * 85px * var(--vc-k, 1));
      position: absolute;
      top: 0;
      left: calc(-28.5px * var(--vc-k, 1));
      transform: translateX(var(--x));
      transition:
        transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1),
        opacity 0.2s ease;
    }
    .vg-slot.off {
      opacity: 0;
      visibility: hidden; /* not hit-testable */
      transform: translateX(var(--x)) scale(0.5);
      transition:
        transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1),
        opacity 0.15s ease,
        visibility 0s linear 0.15s;
    }
    /* No room for the middle row (the phone's upright screen with the events
       panel open): it steps aside until there is. */
    .vcenter.crowded,
    .vcshade.crowded {
      opacity: 0;
      visibility: hidden;
    }
    .vcenter.crowded button {
      pointer-events: none !important;
    }
    /* The phone's camera screen kept UPRIGHT (portrait footage): the bar runs
       full width along the bottom, clear of the home indicator, and the
       timeline and the events panel end above it (--upc-fs-ctrl-h: the bar's
       measured height, _syncUprightCtrl); both start below the status bar. */
    :host([upright]) .vctrl.card {
      padding-bottom: calc(40px * var(--vc-k, 1) + env(safe-area-inset-bottom, 0px));
    }
    :host([upright]) .fs-tl,
    :host([upright]) .fs-side {
      bottom: var(--upc-fs-ctrl-h, 0px);
    }
    :host([upright]) .fs-tl {
      padding-top: calc(var(--upc-fs-tl-pad, 20px) + env(safe-area-inset-top, 0px));
    }
    :host([upright]) .vshade {
      height: calc(var(--upc-fs-ctrl-h, 0px) + 40px);
    }
    /* ...and the picture fills the space ABOVE the bar, where they end, not
       the whole screen: running on under the bar it met their backgrounds in
       a step (user, 2026-10-30). Below it all is black, the bar's own. */
    :host([upright]) video,
    :host([upright]) canvas.sprite,
    :host([upright]) canvas.freeze,
    :host([upright]) .overlay {
      /* (A height, not a bottom: a <video> or <canvas> left at height auto
         takes its own aspect's height and sits at the top.) */
      height: calc(100% - var(--upc-fs-ctrl-h, 0px));
      box-sizing: border-box;
    }
    /* ...whose top row is back / play-pause / forward (the floating middle
       row's buttons, at their own size - not the bar's). */
    .vc-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: calc(56px * var(--vc-k, 1));
    }
    .vctrl.card .vc-row button.vc-skip {
      width: calc(75px * var(--vc-k, 1));
      height: calc(75px * var(--vc-k, 1));
    }
    .vctrl.card .vc-row button.vc-play {
      width: calc(97px * var(--vc-k, 1));
      height: calc(97px * var(--vc-k, 1));
    }
    .vctrl.card .vc-row .vc-play ha-icon {
      --mdc-icon-size: calc(60px * var(--vc-k, 1));
    }
    /* The phone's clip card: its picture at the TOP (a landscape clip's seek
       bar and buttons sit in the strip below it - see multi-view), the middle
       row on the picture's centre (--upc-vc-top), and a seek bar a finger
       can hold: a tall grab area, a bigger knob. */
    :host([stacked][roundctrl]) video {
      object-position: 50% 0;
    }
    /* ...whose black is the card's own (the picture's box and the strip are
       separate layers there, see multi-view). */
    :host([stacked][roundctrl]) .stage,
    :host([stacked][roundctrl]) video {
      background: transparent;
    }
    :host([stacked][roundctrl]) .overlay {
      bottom: auto;
      box-sizing: border-box;
      height: calc(2 * var(--upc-vc-top, 50%));
    }
    /* Its seek bar runs the card's full width (16px in from its edges), the
       times UNDER it at either end - the iPhone player's layout. */
    :host([stacked][roundctrl]) .vctrl.card {
      padding: 0 16px 24px;
      gap: 12px;
    }
    :host([stacked][roundctrl]) .vc-seek {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0;
    }
    :host([stacked][roundctrl]) .vc-seek .vseek {
      grid-row: 1;
      grid-column: 1 / -1;
      height: 40px;
    }
    :host([stacked][roundctrl]) .vctrl.card .vc-seek .vtime {
      grid-row: 2;
      margin-top: -10px;
      min-width: 0;
      font-size: 13px;
      text-align: right;
    }
    :host([stacked][roundctrl]) .vctrl.card .vc-seek .vtime.left {
      grid-column: 1;
      text-align: left;
    }
    :host([stacked][roundctrl]) .vc-seek .vseek-knob {
      width: 18px;
      height: 18px;
    }
    :host([stacked][roundctrl]) .vc-seek .vseek-track {
      height: 5px;
    }
    :host([stacked][roundctrl]) .vc-seek .vseek.drag .vseek-track {
      height: 8px;
    }
    .vctrl.card button {
      width: calc(57px * var(--vc-k, 1));
      height: calc(57px * var(--vc-k, 1));
    }
    .vctrl.card button ha-icon {
      --mdc-icon-size: calc(33px * var(--vc-k, 1));
    }
    /* Speed: a round button like the others (user, 2026-10-30), its "×"
       smaller so "1×" sits comfortably in it. */
    .vctrl.card .vctrl-speed {
      min-width: 0;
      padding: 0;
      font-size: calc(20px * var(--vc-k, 1));
    }
    .vctrl.card .vctrl-speed .vx {
      font-size: 0.7em;
      margin-left: 0.04em;
    }
    /* Above 1x: the overlay's own deep accent (its pills, zoom and live
       buttons, the date pill) — the bright one is meant for thin lines. */
    .vctrl.card .vctrl-speed.on {
      background: var(--upc-accent-deep, var(--upc-accent, var(--primary-color, #03a9f4)));
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
    /* Sound ON: the speaker button reversed — white with a black icon — so
       "you can hear this" reads at a glance against the muted (dark) look. */
    .vctrl button.vmute {
      transition:
        background 0.2s ease,
        color 0.2s ease;
    }
    .vctrl button.vmute.on {
      background: #fff;
      color: #000;
    }
    .vctrl button.vmute.on:hover {
      background: #e6e6e6;
    }
    /* Talk (cameras with a speaker, live only): a microphone next to the
       speaker, crossed out like a muted speaker while off, on a red background
       while talking. */
    .vctrl button.vtalk {
      transition: background 0.2s ease;
    }
    .vctrl button.vtalk.talking {
      background: #d9534f;
    }
    .vctrl button.vtalk.talking:hover {
      background: #c9403b;
    }
    /* Upright phone fullscreen (the doorbell): with Talk the row holds seven
       controls, which only fit a ~390px screen slightly tighter. */
    :host([stacked]) .fs-wrap.fs-active.upright .vctrl.has-talk {
      gap: 6px;
    }
    :host([stacked]) .fs-wrap.fs-active.upright .vctrl.has-talk button {
      width: 44px;
      height: 44px;
    }
    :host([stacked]) .fs-wrap.fs-active.upright .vctrl.has-talk .vctrl-speed {
      min-width: 49px;
      padding: 0 8px;
    }
    /* Why talking stopped (no microphone, permission denied, time limit...):
       above the control bar, fading in and out. */
    .vtalk-msg {
      position: absolute;
      left: 50%;
      bottom: calc(var(--upc-fs-ctrl-h, 64px) + 12px);
      transform: translate(-50%, 6px);
      max-width: calc(100% - 32px);
      padding: 8px 14px;
      border-radius: 10px;
      background: rgba(0, 0, 0, 0.75);
      color: #fff;
      font-size: 14px;
      text-align: center;
      opacity: 0;
      transition:
        opacity 0.25s ease,
        transform 0.25s ease;
      pointer-events: none;
      z-index: 7;
    }
    .vtalk-msg.show {
      opacity: 1;
      transform: translate(-50%, 0);
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
    :host([stacked]) .vctrl:not(.card) {
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
    /* UPRIGHT phone fullscreen (portrait footage — see _rotateForFs): the bar
       is ONE full-width row on the bottom screen edge, clear of the home
       indicator. Not inset like the other layouts: the timeline ends ABOVE it
       (.fs-tl below), so there is nothing to keep clear of — and the inset would
       crush six controls into half a narrow screen. The .fs-inset selector
       outranks the inset rule above. */
    :host([stacked]) .fs-wrap.fs-active.upright .vctrl,
    :host([stacked]) .fs-wrap.fs-active.upright .vctrl.fs-inset {
      padding: 14px 12px calc(16px + env(safe-area-inset-bottom, 0px));
    }
    /* ...and the timeline runs down the right edge from below the notch to just
       above that bar (--upc-fs-ctrl-h: its measured height, _syncUprightCtrl). */
    .fs-wrap.fs-active.upright .fs-tl {
      bottom: var(--upc-fs-ctrl-h, 0px);
      padding-top: calc(var(--upc-fs-tl-pad, 100px) + env(safe-area-inset-top, 0px));
    }
    .overlay {
      position: absolute;
      inset: 0;
      z-index: 4; /* above the player and a held frame */
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
    /* Waiting with a picture on screen: transparent, and only after a grace
       period — a seek inside what is loaded lands well before it. */
    .buffering {
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
    .buffering .spinner {
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
      z-index: 4; /* above the player: an error must be seen */
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
    this.addEventListener('timeline-reach', this._onTimelineReach);
    this._hostRo = new ResizeObserver((es) => {
      const r = es[es.length - 1].contentRect;
      const w = Math.round(r.width);
      const h = Math.round(r.height);
      if (w && w !== this._hostW) this._hostW = w;
      if (h && h !== this._hostH) this._hostH = h;
    });
    this._hostRo.observe(this);
    // Keep the controls alive while ANYTHING in here is being touched. Bound on
    // the host in the CAPTURE phase on purpose: the overlay timeline's zoom
    // slider and its +/− buttons stop their own pointer events (they must not
    // reach the scrub gestures underneath), so a bubble-phase listener never
    // sees them — and the bar, plus the strip holding the slider, would fade
    // out mid-drag.
    this.addEventListener('pointerdown', this._keepCtrlAlive, true);
    this.addEventListener('pointermove', this._keepCtrlAlive, true);
    // Tap-to-toggle, same phase and target for the same reason (see _tap).
    this.addEventListener('pointerdown', this._onPressCapture, true);
    this.addEventListener('pointerup', this._onReleaseCapture, true);
    this.addEventListener('pointercancel', this._onCancelCapture, true);
    this.addEventListener('click', this._onClickCapture, true);
    // Silence playback when the card is HIDDEN without being unmounted — a
    // hosting Bubble-Card popup on the tablet "closes" by display:none'ing the
    // card (disconnectedCallback never fires), so the live stream / clip keeps
    // decoding + playing AUDIO behind the dismissed popup. A display:none (or
    // scrolled-away) host reports zero intersection → mute + pause everything;
    // becoming visible again re-asserts live.
    this._visObserver = new IntersectionObserver(
      (entries) => {
        this._hostIntersecting = entries[entries.length - 1].isIntersecting;
        this._onDocVisibility();
      },
      { threshold: 0 },
    );
    this._visObserver.observe(this);
    // The screen going off / the app going to the background counts as hidden
    // too; an IntersectionObserver never reports that.
    document.addEventListener('visibilitychange', this._onDocVisibility);
    this._stageWatch = setInterval(() => this._checkStage(), 1000);
    // RE-attach (HA re-showing a cached view, a popup's content moved back in):
    // disconnectedCallback tore every player down, but nothing about the
    // properties changed, so updated() would otherwise leave an empty stage —
    // the multi page keeps its drilled-in state across this, and came back to
    // a picture that never moved again. Rebuild whatever was on screen.
    if (this.hasUpdated) {
      this._reattached = true;
      this.requestUpdate();
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._stageWatch);
    this._stopTalk();
    this._ctrlRO?.disconnect();
    this._ctrlRO = undefined;
    this._ctrlObserved = undefined;
    // Where recorded playback had got to, so a re-attach resumes THERE and not
    // back at the instant that was originally tapped.
    if (this._mode === 'recorded') {
      this._resumeAt = this._player.wallTime ?? this._resumeAt;
      this._resumePaused = this._followPaused;
    }
    this._loadedForTime = undefined;
    this._resetAudioSession();
    clearTimeout(this._followCtrlTimer);
    clearTimeout(this._scrubFineTimer);
    clearTimeout(this._livePreviewWarmTimer);
    this._releaseFrame(); // stop the held-frame backstop
    document.removeEventListener('fullscreenchange', this._onFsChange);
    this.removeEventListener('timeline-reach', this._onTimelineReach);
    this._hostRo?.disconnect();
    this.removeEventListener('pointerdown', this._keepCtrlAlive, true);
    this.removeEventListener('pointermove', this._keepCtrlAlive, true);
    this.removeEventListener('pointerdown', this._onPressCapture, true);
    this.removeEventListener('pointerup', this._onReleaseCapture, true);
    this.removeEventListener('pointercancel', this._onCancelCapture, true);
    this.removeEventListener('click', this._onClickCapture, true);
    clearTimeout(this._pendingTap?.timer);
    this._pendingTap = undefined;
    this._visObserver?.disconnect();
    this._visObserver = undefined;
    document.removeEventListener('visibilitychange', this._onDocVisibility);
    clearTimeout(this._suspendTimer);
    this._suspended = false; // the teardown below covers it; re-attach rebuilds
    // Close the NVR stream and free the decoder: a detached view is cached by
    // HA and never collected, and its MediaSource would hold both.
    this._player.suspend();
    this._resetPreviewSlots();
    this._preview.destroy(); // revoke cached preview blobs
    // Dropping the elements doesn't stop them: a detached <video> keeps its
    // decoder and MediaSource, and HA caches the view so it is never collected.
    // Costs nothing on Chromium; on iOS it is the difference between the next
    // view getting a media pipeline and coming up black. See media-release.ts.
    releaseVideosIn(this.renderRoot as unknown as DocumentFragment);
  }

  protected willUpdate(changed: PropertyValues): void {
    // The player is ONE element that stays mounted, so live <-> recorded,
    // skips and seeks need no cover: it keeps its last frame until the next
    // is ready. Only two transitions still change what is on screen:
    // A NEW event (its start moved, or another camera) gets the honest loading
    // screen — never a frame from live, earlier history or the event before
    // it (see _blank). The end alone changing is not a new event: it creeps
    // forward for an event still in progress and must not touch the picture.
    const enteringEvent =
      this.clipEndTime > 0 && (changed.has('targetTime') || changed.has('cameraId'));
    if (enteringEvent || changed.has('cameraId')) {
      this._releaseFrame();
    } else if (changed.has('scrubbing') && !this.scrubbing) {
      // Leaving a scrub: the scrub layer (on screen now, showing the instant
      // scrubbed TO) is about to go, uncovering the player still paused where
      // it was before the scrub. Hold the scrubbed frame until the footage
      // there presents — the frame has to be copied while it still exists.
      this._holdFrame(true);
    }    // A new camera at the SAME timestamp is still a new load: the dedup below
    // keys only on the time, so without this the switch showed nothing.
    if (changed.has('cameraId')) this._loadedForTime = undefined;
    // A new poster shows until the next presented frame - fading in over a
    // picture already on screen (another clip of the same camera), simply
    // there on a fresh player (it flew in with the zoom that opened it).
    if (changed.has('poster')) {
      clearTimeout(this._posterTimer);
      this._posterOn = !!this.poster;
      this._posterGone = false;
      this._posterFadeIn = !!this.poster && this._mode !== null;
    }
    // Talking belongs to the live picture of ONE camera: leaving live (a scrub,
    // an event) or switching camera ends it.
    if ((changed.has('live') && !this.live) || changed.has('cameraId') || (changed.has('canTalk') && !this.canTalk)) {
      this._stopTalk();
    }
    // A scrub ending removes the preview pair from the tree — and removal frees
    // nothing. Measured: twelve scrub gestures left 46 detached <video>
    // elements, half still holding a decoded stream. Chromium has no practical
    // limit; iOS caps concurrent media pipelines, and once orphans have eaten
    // them the player wedges. Release them here, while they are still
    // reachable — by updated() Lit has already dropped them.
    if (changed.has('scrubbing') && !this.scrubbing) {
      for (const v of [this._previewVidA, this._previewVidB]) if (v) releaseVideo(v);
    }
  }

  // ---- hidden-but-not-unmounted teardown ----------------------------------
  private _visObserver?: IntersectionObserver;
  @state() private _hidden = false;
  // Hidden for SUSPEND_AFTER_MS: every player, chunk chain and prepare is gone,
  // not just paused (see _suspend).
  @state() private _suspended = false;
  private _suspendTimer?: ReturnType<typeof setTimeout>;
  private _hiddenAt = 0; // when the card was last hidden (see LONG_HIDE_MS)
  private _hostIntersecting = true;
  private _onDocVisibility = (): void => {
    this._onHostVisibility(this._hostIntersecting && !document.hidden);
  };

  private _onHostVisibility(visible: boolean): void {
    if (visible === !this._hidden) return; // no state change
    this._hidden = !visible;
    clearTimeout(this._suspendTimer);
    if (this._hidden) {
      this._hiddenAt = Date.now();
      // Remember whether recorded footage was PLAYING — closing a popup pauses
      // it, and re-opening the popup is returning to it.
      this._resumeOnShow =
        !this.live && !this.scrubbing && this._mode === 'recorded' && !this._followPaused;
      this._resetAudioSession();
      this._muteAndPauseAll();
      this._suspendTimer = setTimeout(() => this._suspend(), SUSPEND_AFTER_MS);
    } else if (this._suspended) {
      // Asked BEFORE the rebuild below is queued: the host's update then sets
      // `live` first, so the rebuild starts LIVE instead of briefly reopening
      // the old footage. (A host without a go-live handler — the multi page's
      // event player — just resumes, as before.)
      if (!this.live && Date.now() - this._hiddenAt > LONG_HIDE_MS) {
        this.dispatchEvent(new CustomEvent('go-live', { bubbles: true, composed: true }));
      }
      this._unsuspend();
    } else {
      this._resumeAfterVisible();
    }
  }

  /** Hidden for a while (a closed popup, a view HA keeps cached behind another,
   *  the screen off): let go of EVERYTHING, exactly as a detach would. Pausing
   *  is not enough — a paused player keeps its decoder, and a live stream keeps
   *  coming. A hidden card on the wall tablet once held its decoders for hours
   *  and still had them when the viewer opened live fullscreen on top of it. */
  private _suspend(): void {
    if (!this._hidden || this._suspended) return;
    dbg('ui:suspend', { cam: this.cameraId, mode: this._mode });
    this._stopTalk(); // nobody talks through a player they can't see
    if (this._mode === 'recorded') {
      this._resumeAt = this._player.wallTime ?? this._resumeAt ?? this.targetTime;
      this._resumePaused = this._followPaused;
      this._loadedForTime = undefined; // showing again plays on from _resumeAt
    }
    this._player.suspend();
    this._resetPreviewSlots();
    this._suspended = true;
  }

  private _unsuspend(): void {
    this._suspended = false;
    this._reattached = true; // updated() rebuilds whatever was on screen
    this._resumeOnShow = false; // the rebuild plays (or stays paused) itself
  }

  /** Silence + pause every player (the footage, the scrub previews) so
   *  nothing plays audio while the card is hidden. Live stops its stream. */
  private _muteAndPauseAll(): void {
    if (this._mode === 'live') this._player.pause();
    for (const v of [this._mainVideo, this._previewVidA, this._previewVidB]) {
      if (!v) continue;
      v.muted = true;
      try {
        v.pause();
      } catch {
        /* ignore */
      }
    }
  }

  /** Re-shown after a short hide (no suspend). LIVE goes back to the live
   *  edge unless the user had paused it. Recorded footage that was PLAYING
   *  resumes too: becoming visible again IS the return (re-opening the popup),
   *  and staying paused looked like a picture frozen for no reason. */
  private _resumeAfterVisible(): void {
    dbg('ui:resume', { cam: this.cameraId, live: this.live });
    if (this.live) {
      if (!this._livePausedState && !this.scrubbing) this._startLive();
      return;
    }
    const resume = this._resumeOnShow;
    this._resumeOnShow = false;
    const v = this._mainVideo;
    if (resume && !this.scrubbing && this._mode === 'recorded' && v) {
      v.muted = this._followMuted;
      this._player.play();
    }
  }

  /** Last line of defence for recorded playback.
   *
   *  The engine recovers what it can see (a seek that does not land, a stream
   *  that fails or goes quiet). This watches the RESULT: footage that is
   *  settled, not paused by the user and not advancing gets a play() nudge
   *  after 2.5 s, and a clean restart from the frame on screen after 6 s.
   *  Every state in which "not advancing" is legitimate — user pause,
   *  tap-to-play, waiting for footage (a seek, the recording edge), the end of
   *  an event, scrubbing, hidden — is excluded. */
  private _checkStage(): void {
    const v = this._mainVideo;
    if (
      !v ||
      this._mode !== 'recorded' ||
      this._hidden ||
      document.hidden ||
      this.live ||
      this.scrubbing ||
      this._waiting ||
      this._followPaused ||
      this._tapToPlay ||
      !!this._error ||
      !this._player.settled ||
      this._player.atBound
    ) {
      this._stageStuckSince = 0;
      this._stageLastCt = -1;
      return;
    }
    const ct = v.currentTime;
    const moving = !v.paused && ct !== this._stageLastCt;
    this._stageLastCt = ct;
    if (moving) {
      this._stageStuckSince = 0;
      return;
    }
    const now = performance.now();
    if (!this._stageStuckSince) {
      this._stageStuckSince = now;
      return;
    }
    const stuck = now - this._stageStuckSince;
    if (stuck < 2500) return;
    if (stuck < 6000) {
      if (v.paused) this._playFollowVideo(v);
      return;
    }
    const at = this._player.wallTime ?? this.targetTime;
    this._stageStuckSince = 0;
    this._stageLastCt = -1;
    // Budgeted too: a device that stalls every time must end on a message, not
    // on a restart every 7 s forever.
    this._stageRestarts = this._stageRestarts.filter((t) => now - t < 120_000);
    if (this._stageRestarts.length >= 2) {
      this._reportPlaybackProblem(`playback stalled ${Math.round(stuck / 1000)}s — giving up`);
      v.pause();
      this._error = 'Playback keeps stalling on this device. Tap an event or the timeline to try again.';
      return;
    }
    this._stageRestarts.push(now);
    this._reportPlaybackProblem(`playback stalled ${Math.round(stuck / 1000)}s — restarting`);
    this._player.seek(at, { play: true });
  }

  private _lastLivePlaying?: boolean;

  /** Tell the card whether LIVE is playing: it pins the playhead to now only
   *  while it is, and on a resume it snaps back to now (live resumes at the
   *  live edge). */
  private _reportLivePlaying(playing: boolean): void {
    this._livePausedState = !playing; // drives the custom control's play/pause icon
    if (playing === this._lastLivePlaying) return;
    this._lastLivePlaying = playing;
    this.dispatchEvent(
      new CustomEvent('live-playing', {
        detail: { playing },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // ---- the player's hooks ----------------------------------------------------

  /** Every presented frame of the current seek / live switch (wall-clock ms). */
  private _onFrame(wall: number): void {
    // The frame the user is waiting for is on screen: drop any cover. Out of
    // the blank (black) it fades in - a fade TO black would be a flash, from
    // black it is just the picture arriving.
    if (this._blank) {
      this._blank = false;
      // (Under a poster the poster does the cross-fade: the video must be
      // opaque beneath it, or what is behind shows through mid-fade.)
      if (!this._posterOn) {
        this._mainVideo?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: 'ease-out' });
      }
    }
    if (this._frozen) this._releaseFrame();
    // ...and a poster cross-fades into it.
    if (this._posterOn && !this._posterGone) {
      this._posterGone = true;
      clearTimeout(this._posterTimer);
      this._posterTimer = setTimeout(() => (this._posterOn = false), FADE_MS + 60);
    }
    if (this._mode !== 'recorded' || this.scrubbing) return;
    // Report ~4x a second (it re-renders the card), but a jump at once.
    const now = performance.now();
    const expected =
      this._lastWallReported === undefined
        ? undefined
        : this._lastWallReported + (now - this._lastTimeReport) * (this._mainVideo?.playbackRate ?? 1);
    const jumped = expected === undefined || Math.abs(wall - expected) > 1000;
    if (!jumped && now - this._lastTimeReport < TIME_REPORT_MS) return;
    this._lastTimeReport = now;
    this._lastWallReported = wall;
    this.dispatchEvent(
      new CustomEvent('playback-time', { detail: { time: wall }, bubbles: true, composed: true }),
    );
    if (this.clipEndTime > 0) this._followNow = wall; // the event's seek bar
    // Caught up near the recording edge: 2x/4x can't be sustained (nothing
    // recorded ahead yet), so drop back to real time and disable speed.
    const near = Date.now() - wall < NEAR_LIVE_MS;
    if (near !== this._nearLive) this._nearLive = near;
    if (near && this._followRate !== 1) this._setFollowRate(1);
  }

  /** Loading / settled / failed changed. */
  private _onPlayerChange(): void {
    const waiting = this._player.loading;
    if (waiting !== this._waiting) {
      // What the user sees: the spinner (it shows after a short grace delay).
      const now = performance.now();
      dbg('ui:waiting', { cam: this.cameraId, on: waiting, mode: this._mode, ms: waiting ? undefined : Math.round(now - this._waitingSince) });
      if (waiting) this._waitingSince = now;
      this._waiting = waiting;
    }
    if (this._mode === 'live' && this._player.settled && !this._liveSettled) {
      // Live is on screen: warm the scrub preview around now (deferred until
      // here so it does not compete with the live start), and try sound.
      this._liveSettled = true;
      this._scheduleLivePreviewWarm();
      const v = this._mainVideo;
      if (v && shouldAttemptLiveAudio(this.liveAudioStart, this._audioUserChoice, this._liveAudioAttempted, true)) {
        void this._tryAutoLiveAudio(v);
      }
    }
  }

  // ---- what the stage plays ---------------------------------------------------

  /** Bind the player to the <video> and the camera (cheap when unchanged). A
   *  camera change drops everything loaded and hides the old picture. */
  private _syncPlayer(): void {
    const v = this._mainVideo;
    if (v && this._player.video !== v) this._player.attach(v);
    if (this._player.setSource(this.nvrId, this.cameraId, 0)) this._blank = true;
  }

  /** Follow the live edge — in the same element, so whatever is on screen
   *  stays until the first live frame. */
  private _startLive(): void {
    dbg('ui:live', { cam: this.cameraId, from: this._mode });
    this._mode = 'live';
    this._error = undefined;
    this._tapToPlay = false;
    this._followNow = undefined;
    this._nearLive = false;
    this._resetLiveSession();
    const v = this._mainVideo;
    if (v) v.muted = this._liveMuted;
    this._player.setLowLatency(this._talk !== 'idle'); // a new live session starts normal
    this._player.setLiveChannel(this._talk !== 'idle' ? TALK_LIVE_CHANNEL : null);
    this._player.live();
    this._reportLivePlaying(true);
    this._flashFollowCtrl(); // flash the custom controls so they're discoverable
  }

  /** Play recorded footage from `at` (an event's start, a tapped time, where a
   *  hidden card left off). `fresh`: a new selection, so the old picture is
   *  hidden until the new one presents. */
  private _playRecorded(at: number, opts: { fresh?: boolean; play?: boolean } = {}): void {
    dbg('ui:recorded', { cam: this.cameraId, at: Math.round(at), fresh: opts.fresh, play: opts.play, event: !!this._eventEnd });
    this._mode = 'recorded';
    this._error = undefined;
    this._tapToPlay = false;
    this._nearLive = false;
    this._followPaused = !(opts.play ?? true);
    // A poster covers the old picture itself (fading in over it): blanking
    // under it would dip the cross-fade through black.
    if (opts.fresh && !this._posterOn) this._blank = true;
    this._player.setBound(this._eventEnd || null);
    // Talk's channel is for talking LIVE (Talk ends with live): behind live
    // the player goes back to the normal one, whose recordings fill in the
    // footage before the live session.
    this._player.setLiveChannel(null);
    const v = this._mainVideo;
    if (v) v.muted = this._followMuted;
    this._player.setRate(this._followRate);
    this._seekRecorded(at);
    this._flashFollowCtrl(); // flash the controls so they're discoverable
  }

  /** Position recorded playback at `tIn` (clamped to the event / what exists). */
  private _seekRecorded(tIn: number): void {
    let t = Math.max(this._seekFloor, Math.min(tIn, this._seekCeiling));
    // Footage the player can't reach by itself (loaded, in the running live
    // session's footage, or in what its backfill holds or delivers) has to
    // come from the recordings, and safely: the NVR refuses a playback past
    // its edge, and playback near that edge stalls (RECORDED_SAFE_MS). Only
    // when the backfill failed does this land further back than asked -
    // never later.
    if (!this._player.isAvailable(t) && !this._eventEnd) t = Math.min(t, Date.now() - RECORDED_SAFE_MS);
    this._followNow = t; // the seek bar holds where it was let go
    this._lastWallReported = undefined;
    this._player.seek(t, { play: !this._followPaused });
  }

  protected firstUpdated(): void {
    // Display the always-present player dialog inline. Set the `open` PROPERTY
    // (not show()) so it displays in flow WITHOUT the dialog focusing steps —
    // otherwise it would steal focus to the first control on every mount.
    if (this._fsDlg) this._fsDlg.open = true;
    // Opened for a grid-tile fullscreen: go straight to fullscreen.
    if (this.startFs) {
      if (this.stacked) {
        this._forceRotate = this._rotateForFs();
        this._isFs = true;
      } else {
        void this.requestFullscreen?.().catch(() => undefined);
      }
    }
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('_isFs') && this.stacked) this._syncFsDialog();
    // The player dialog only exists in STACKED layout, and firstUpdated opened
    // it exactly once. A card that measures itself as stacked only AFTER its
    // first render (layout: auto does, and so does rotating a phone) got the
    // dialog CLOSED — and a closed <dialog> is display:none, so live and every
    // kind of playback ran with no picture at all.
    if (this.stacked && !this._isFs && !this._modalOn && this._fsDlg && !this._fsDlg.open) {
      this._fsDlg.open = true;
    }
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
    if (changed.has('_followCtrl') || changed.has('_isFs') || changed.has('cardFs')) {
      for (const el of this.querySelectorAll('[slot="fs-timeline"]'))
        el.toggleAttribute('inert', !this._followCtrl);
    }
    // A host panel opened: keep the controls up; closed: re-arm the auto-hide.
    if (changed.has('holdCtrl') && (this.holdCtrl || this._followCtrl)) this._showFollowCtrl();
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
    this._syncUprightCtrl();
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
      // preview frame belongs to the old camera — drop it. Block keys are
      // camera-independent (`b<start>`), so a slot left over from the previous
      // camera would otherwise be mistaken for a hit on the new one.
      this._resetPreviewSlots();
      this._previewToken++;
      void this._warmPreview();
    }
    // `scrub-start` fires on the gesture's first motion — the earliest moment
    // we know a scrub is coming.
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
    // Suspended (hidden a while): start nothing. _unsuspend sets _reattached,
    // and the pass after it rebuilds the stage below.
    if (this._suspended) return;
    this._syncPlayer();
    // Consumed exactly once, by whichever branch below owns the stage now.
    const reattached = this._reattached;
    this._reattached = false;
    if (changed.has('scrubbing') && this.scrubbing) {
      // Scrubbing started: the preview layer takes the stage. The footage
      // underneath pauses (live stops its stream) but KEEPS its buffer, so a
      // scrub that lands inside it is a native seek.
      this._player.pause();
      this._loadedForTime = undefined;
      this._resumeAt = undefined; // the scrub picks the new position
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
      if (
        reattached ||
        this._mode !== 'live' ||
        changed.has('live') ||
        changed.has('scrubbing') ||
        changed.has('cameraId')
      ) {
        this._loadedForTime = undefined;
        this._startLive();
      }
    } else if (
      reattached ||
      changed.has('scrubbing') ||
      changed.has('targetTime') ||
      changed.has('live') ||
      changed.has('cameraId')
    ) {
      // Play from the chosen time (dedup identical times). A `gap` does not
      // skip the request: the gaps come from the camera entity's `unavailable`
      // history, which is not the same fact as "the NVR recorded nothing"
      // (two cameras went unavailable and came back within 14 ms of each other
      // while recording continued — a link blip, not an outage). The NVR is
      // the authority on what it holds; the player steps over real holes.
      if (this._loadedForTime !== this.targetTime || reattached) {
        this._loadedForTime = this.targetTime;
        // After a re-attach, carry on from where playback had got to, as it was.
        const resume = reattached && this._resumeAt !== undefined ? this._resumeAt : undefined;
        const paused = resume !== undefined && this._resumePaused;
        if (this.clipEndTime > this.targetTime + 500) {
          // An EVENT: plays from its start and STOPS at its end. A re-attach
          // keeps a finished event finished (no second `clip-ended`).
          if (resume === undefined) this._eventEndSent = false;
          this._followNow = undefined; // the bar starts at this event's start
          // The phone's clip player changing to another event of the SAME
          // camera keeps the picture it shows until the new one is in (a
          // blank there was a black flash between two clips).
          const sameCamClip =
            this.stacked && this.roundCtrl && this._mode === 'recorded' && !changed.has('cameraId');
          this._playRecorded(resume ?? this.targetTime, {
            fresh: resume === undefined && !sameCamClip,
            play: !paused && !(resume !== undefined && this._eventEndSent),
          });
        } else {
          this._playRecorded(resume ?? this.targetTime, {
            fresh: changed.has('cameraId'),
            play: !paused,
          });
        }
      }
      this._resumeAt = undefined;
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
  /** The footage's pixel size: the camera entity's resolution (channel 0 = the
   *  stream the player shows), else the player's own video. undefined while
   *  neither is known. */
  private _footageSize(): [number, number] | undefined {
    const attrs = this.hass?.states?.[this.cameraId]?.attributes as
      | { width?: unknown; height?: unknown }
      | undefined;
    let w = Number(attrs?.width) || 0;
    let h = Number(attrs?.height) || 0;
    if (!(w > 0 && h > 0)) {
      w = this._mainVideo?.videoWidth || 0;
      h = this._mainVideo?.videoHeight || 0;
    }
    return w > 0 && h > 0 ? [w, h] : undefined;
  }

  /** Backing size of the sprite canvas. The scrub job squeezes every keyframe
   *  into a fixed 640x360 tile whatever the camera's shape (a 1920x2560
   *  portrait doorbell included), so the canvas takes the FOOTAGE's aspect and
   *  the tile is drawn stretched back into it; object-fit: contain then frames
   *  the preview exactly like the <video> it stands in for. A 16:9 camera
   *  stays 640x360, as before. */
  private _spriteSize(set: { tileW: number; tileH: number }): [number, number] {
    const size = this._footageSize();
    if (!size) return [set.tileW, set.tileH];
    return [set.tileW, Math.max(1, Math.round((set.tileW * size[1]) / size[0]))];
  }

  /** Upright fullscreen ends the timeline strip just above the control bar, so
   *  the bar's height is published as --upc-fs-ctrl-h on the dialog — watched,
   *  because it changes (live vs event playback, the seek row). Re-attached if
   *  a re-render replaced the bar; dropped outside upright fullscreen. */
  private _ctrlRO?: ResizeObserver;
  private _ctrlObserved?: Element;
  private _syncUprightCtrl(): void {
    // The old upright dialog fullscreen, or the phone's upright camera screen
    // (where the variable lives on the host).
    const target =
      this.cardFs && this.upright
        ? this
        : this.stacked && this._isFs && !this._forceRotate
          ? this._fsDlg
          : undefined;
    const bar = this.renderRoot.querySelector('.vctrl');
    if (!target || !bar) {
      this._ctrlRO?.disconnect();
      this._ctrlRO = undefined;
      this._ctrlObserved = undefined;
      return;
    }
    if (this._ctrlObserved === bar) return;
    this._ctrlRO?.disconnect();
    this._ctrlRO = new ResizeObserver(() => {
      const h = (bar as HTMLElement).offsetHeight;
      target.style.setProperty('--upc-fs-ctrl-h', `${h}px`);
      if (target === this) this._uprightBarH = h; // the picture ends above it (videoBox)
    });
    this._ctrlRO.observe(bar);
    this._ctrlObserved = bar;
  }

  /** Phone fullscreen turns the player to landscape on an upright phone (turn
   *  the phone to watch) — except for footage that is itself PORTRAIT (the
   *  doorbell): rotated, it would play sideways in a small band, so it stays
   *  upright and fills the screen, with the overlay timeline down its right
   *  edge (the `upright` layout). Unknown footage size keeps the rotation. */
  private _rotateForFs(): boolean {
    if (window.innerHeight <= window.innerWidth) return false;
    const size = this._footageSize();
    return !(size && size[1] > size[0]);
  }

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
    const [cw, ch] = this._spriteSize(set);
    if (c.width !== cw || c.height !== ch) {
      c.width = cw;
      c.height = ch;
    }
    const ctx = c.getContext('2d');
    if (!ctx) return true;
    try {
      ctx.drawImage(bmp, tile.sx, tile.sy, set.tileW, set.tileH, 0, 0, cw, ch);
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

  /** Seconds -> "M:SS" (e.g. 5 -> "0:05", 75 -> "1:15"). */
  private _fmtClock(s: number): string {
    if (!isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  // ---- recorded playback: limits, the event end, seeking --------------------

  /** Lowest instant playback may seek to: an event's start while one is being
   *  played (its seek bar starts there), else anything. */
  private get _seekFloor(): number {
    return this.clipEndTime > 0 ? this.targetTime : 0;
  }

  /** The latest instant recorded playback can be positioned at: an event's
   *  end, else just short of now (footage near now comes from the live buffer
   *  or not at all — see _seekRecorded). */
  private get _seekCeiling(): number {
    const ceiling = Date.now() - 1000;
    const ev = this._eventEnd;
    // An event stops at its end: nothing past it is ever played or fetched.
    return ev ? Math.min(ev - 250, ceiling) : ceiling;
  }

  /** The end of the event being played, never later than the NVR has recorded;
   *  0 when no event is (continuous timeline playback). Playback STOPS here. */
  private get _eventEnd(): number {
    return this.clipEndTime > this.targetTime
      ? Math.min(this.clipEndTime, Date.now() - RECORDED_LAG_MS)
      : 0;
  }

  /** The event's end has played: the player paused on its last frame; tell
   *  the host (once). Nothing follows it — rolling on into what came next read
   *  as "switching streams". Play replays the event; a skip or seek resumes it. */
  private _finishEvent(): void {
    this._followPaused = true;
    if (!this._eventEndSent) {
      this._eventEndSent = true;
      this.dispatchEvent(new CustomEvent('clip-ended', { bubbles: true, composed: true }));
    }
    this._showFollowCtrl();
  }

  /** Seek recorded playback to `t` — the seek bar, ±15 s, Play after an event
   *  ended. Inside what is loaded this is a native seek; elsewhere the NVR
   *  streams from there into the same buffer. Either way the frame on screen
   *  stays until the new one is ready, and the seek bar holds where it was let
   *  go (the player reports no time from the old position meanwhile). */
  private _seekFollowTo(tIn: number): void {
    const t = Math.max(this._seekFloor, Math.min(tIn, this._seekCeiling));
    // A skip or seek after an event finished resumes it from where it lands.
    if (this._eventEndSent || this._player.atBound) {
      this._eventEndSent = false;
      this._followPaused = false;
    }
    this._announceSeek(t);
    this._seekRecorded(t);
    this._showFollowCtrl();
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
        // AbortError just means a seek or a pause superseded this play — that
        // resolves itself, and treating it as a refusal would flash a play
        // button over perfectly healthy playback.
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
            dbg('ui:tapToPlay', { cam: this.cameraId });
            this._tapToPlay = true; // it's not loading — it's blocked
          });
      });
  }

  /** The stage's one-tap start (shown after playback was refused). Runs inside
   *  the tap's own gesture, which no autoplay policy blocks. */
  private _onTapToPlay = (e: Event): void => {
    e.stopPropagation(); // don't also toggle the control bar
    this._tapToPlay = false;
    if (this._mode === 'live') {
      this._livePausedState = false;
      this._reportLivePlaying(true);
    } else {
      this._followPaused = false;
    }
    const v = this._mainVideo;
    if (v) this._playFollowVideo(v);
  };

  /** Put a playback failure in the Home Assistant log, with the device it
   *  happened on. The failures that matter most happen on phones, where there is
   *  no console to read; this is what makes them diagnosable afterwards.
   *  Capped at 10 per HOUR so a failure can never turn into log spam — a cap per
   *  page load went silent for good on a wall tablet that never reloads, which
   *  is exactly the device whose failures went unseen. */
  private static _problemTimes: number[] = [];
  private _reportPlaybackProblem(message: string): void {
    console.warn(`[unifi-timeline] ${message}`);
    dbg('problem', { cam: this.cameraId, message });
    const now = Date.now();
    MediaView._problemTimes = MediaView._problemTimes.filter((t) => now - t < 3_600_000);
    if (MediaView._problemTimes.length >= 10 || !this.hass) return;
    MediaView._problemTimes.push(now);
    void this.hass
      .callWS({
        type: 'call_service',
        domain: 'system_log',
        service: 'write',
        service_data: {
          message: `unifi-protect-timeline-card: ${message} — ${this.cameraId} — ${navigator.userAgent}`,
          level: 'warning',
          logger: 'unifi_protect_timeline_card',
        },
      })
      .catch(() => undefined);
  }

  // ---- held frame (scrub end) -------------------------------------------------
  //
  // The player keeps its own last frame through every seek and switch, so the
  // only gap left to cover is the end of a scrub: the scrub layer (showing the
  // instant scrubbed TO) goes away and would uncover the player still paused
  // where it was before the scrub. The frame scrubbed to is held until the
  // footage there presents — what the UniFi app does.
  @state() private _frozen = false;
  @query('canvas.freeze') private _freezeCanvas?: HTMLCanvasElement;
  private _freezeTimer?: ReturnType<typeof setTimeout>;

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

  /** The scrub layer's preview <video> on screen, if it holds a frame. */
  private _visibleVideo(): HTMLVideoElement | undefined {
    const v = this._previewActive ? this._previewVideo(this._previewActive) : undefined;
    // readyState >= 2 (HAVE_CURRENT_DATA) is the guarantee there is a frame to
    // copy; anything less would paint the canvas black, which is the very thing
    // this exists to avoid.
    return v && v.readyState >= 2 && v.videoWidth > 0 ? v : undefined;
  }

  /** Copy what the scrub layer shows onto the overlay canvas and hold it until
   *  the player presents the footage (see _onFrame), or a backstop. No-op when
   *  there is nothing to copy — a black hold is worse than the honest frame.
   *  `preferSprite`: the sprite canvas first (it is what is on screen in sprite
   *  mode, and holds exactly the instant scrubbed to). */
  private _holdFrame(preferSprite = false): void {
    if (!HOLD_FRAME_ENABLED) return;
    // IOS-FREEZE-2026-09-26: never draw a <video> into a canvas on Apple WebKit
    // (a synchronous cross-process readback of a hardware frame, at the moment
    // the iPhone app used to hang). The sprite canvas is still fine to copy.
    const v = APPLE_WEBKIT ? undefined : this._visibleVideo();
    const sprite =
      this._spriteReady && this._spriteCanvas && this._spriteCanvas.width > 0
        ? this._spriteCanvas
        : undefined;
    const pick: (HTMLVideoElement | HTMLCanvasElement | undefined)[] = preferSprite
      ? [sprite, v]
      : [v, sprite];
    const src = pick.find((x) => !!x);
    const c = this._freezeCanvas;
    if (!src || !c) return;
    const isCanvas = src instanceof HTMLCanvasElement;
    const srcW = isCanvas ? src.width : (src as HTMLVideoElement).videoWidth;
    const srcH = isCanvas ? src.height : (src as HTMLVideoElement).videoHeight;
    if (!srcW || !srcH) return;
    let copied = false;
    try {
      if (c.width !== srcW || c.height !== srcH) {
        c.width = srcW;
        c.height = srcH;
      }
      const ctx = c.getContext('2d', { willReadFrequently: true });
      // Clear FIRST. Setting width/height only clears when the size actually
      // changes, so a draw that silently fails would leave the previous hold
      // on the canvas — which reads as a good copy and shows a stale (possibly
      // other-camera) frame as if it were current.
      ctx?.clearRect(0, 0, c.width, c.height);
      ctx?.drawImage(src, 0, 0, c.width, c.height);
      copied = !!ctx && !this._looksBlack(ctx, c);
    } catch {
      copied = false; // decoder gone mid-copy, or a tainted/protected surface
    }
    if (!copied) return;
    this._frozen = true;
    // Reveal NOW, not on the next render: Lit's update is async, and the scrub
    // layer may already be gone by then.
    c.removeAttribute('hidden');
    clearTimeout(this._freezeTimer);
    this._freezeTimer = setTimeout(
      () => this._releaseFrame(),
      this.live ? LIVE_FREEZE_MAX_MS : HISTORICAL_FREEZE_MAX_MS,
    );
  }

  private _releaseFrame(): void {
    clearTimeout(this._freezeTimer);
    this._freezeTimer = undefined;
    this._frozen = false;
    this._freezeCanvas?.setAttribute('hidden', '');
  }

  private _showFollowCtrl = (): void => {
    this._followCtrl = true;
    clearTimeout(this._followCtrlTimer);
    // A scrub in flight (drag, momentum glide, settle delay) HOLDS the controls
    // open: the gesture is the interaction, and a finger resting mid-drag must
    // not make the bar — and with it the fullscreen timeline being dragged —
    // vanish. The timer is re-armed when the scrub ends (see updated()). Same
    // for a seek-bar drag (re-armed on release), and for a host panel that is
    // open (re-armed when it closes, see updated()).
    if (this.scrubbing || this._seekDragAt !== undefined || this.holdCtrl) return;
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

  // ---- tap-to-TOGGLE the controls: ONE detector for the whole player --------
  // A tap anywhere in the player — video, the fullscreen timeline strip, its
  // margins — flips the controls; a tap on a control (a button, the seek bar, an
  // event thumbnail, the timeline's zoom/live buttons) does not. Decided from
  // the press and the release alone, in the CAPTURE phase on the host, so no
  // element inside can swallow or double it.
  // It replaced four separate paths (the stage's click, the strip's
  // `tap-through`, the strip's padding click, and a show-on-pointerdown in the
  // strip), which disagreed with each other: on a touchscreen the browser
  // delivers the tap's `click` a beat AFTER the release, by when hiding the
  // controls had already removed the strip, so the click fell through to the
  // video underneath and its handler showed them again — "flash off and back
  // on, impossible to hide" on most of the screen, while the strip's right
  // margin took a different path and mostly worked.
  private _tap?: { id: number; x: number; y: number; t: number; visible: boolean; control: boolean };
  // A qualifying tap waits for its CLICK before it toggles (see _onReleaseCapture).
  private _pendingTap?: { visible: boolean; timer: ReturnType<typeof setTimeout> };
  // Same travel as the timeline's touch slop: beyond it the press is a drag.
  private static readonly TAP_SLOP_PX = 4;
  private static readonly TAP_MAX_MS = 600;
  // No click within this after the release (rare: long press, element gone)
  // -> toggle anyway.
  private static readonly TAP_CLICK_WAIT_MS = 350;

  /** The press is on something with its own job, not on the picture. The
   *  control bar's empty stretch is NOT one: it is a gradient over the video,
   *  and a tap there means the same as a tap on the picture. */
  private _isControlTarget(e: Event): boolean {
    for (const n of e.composedPath()) {
      if (n === this) break;
      if (
        n instanceof Element &&
        n.matches(
          'button, input, select, a, .vseek, .tap-play, .evt-wrap, .zoom-panel, .zoom-fab, .live-arrow, .tl-foot, .fs-top, .fs-side',
        )
      ) {
        return true;
      }
    }
    return false;
  }

  private _onPressCapture = (e: PointerEvent): void => {
    // A second finger makes it a pinch, not a tap.
    this._tap = e.isPrimary
      ? {
          id: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          t: performance.now(),
          visible: this._followCtrl,
          control: this._isControlTarget(e),
        }
      : undefined;
  };

  /** A press + release that qualify as a tap DO NOT toggle yet: the click that
   *  follows decides. A touch press is reported at the exact centre of the
   *  fingertip, but the browser "adjusts" a touch's CLICK to the nearest
   *  button — so a finger landing a few pixels off the exit-fullscreen button
   *  pressed the video (toggle: the controls vanished) and then clicked the
   *  button (fullscreen exited a beat later). If the click goes to a control,
   *  the tap was the control's and nothing toggles. Toggling at the click also
   *  means nothing re-renders before the browser hit-tests it. */
  private _onReleaseCapture = (e: PointerEvent): void => {
    const tap = this._tap;
    this._tap = undefined;
    if (!tap || tap.id !== e.pointerId || tap.control || this.scrubbing) return;
    const moved = Math.hypot(e.clientX - tap.x, e.clientY - tap.y);
    if (moved > MediaView.TAP_SLOP_PX || performance.now() - tap.t > MediaView.TAP_MAX_MS) return;
    clearTimeout(this._pendingTap?.timer);
    this._pendingTap = {
      visible: tap.visible,
      timer: setTimeout(() => this._commitTap(), MediaView.TAP_CLICK_WAIT_MS),
    };
  };

  /** Flip what the user SAW at the press — not the state now, which hovering
   *  or the auto-hide may have changed in between. */
  private _commitTap(): void {
    const pending = this._pendingTap;
    this._pendingTap = undefined;
    if (!pending) return;
    clearTimeout(pending.timer);
    if (pending.visible) this._hideFollowCtrl();
    else this._showFollowCtrl();
  }

  private _onCancelCapture = (): void => {
    this._tap = undefined;
  };

  private _onClickCapture = (e: MouseEvent): void => {
    const pending = this._pendingTap;
    if (!pending) return;
    if (this._isControlTarget(e)) {
      clearTimeout(pending.timer); // the control's tap: let the click through
      this._pendingTap = undefined;
      return;
    }
    this._commitTap();
  };

  /** Mouse hover reveals the controls (desktop). Touch never does: a finger's
   *  jitter during a tap would undo the tap's own hide. */
  private _onStageHover = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse') this._showFollowCtrl();
  };

  private _toggleFollowPlay = (e: Event): void => {
    e.stopPropagation();
    // Play on a finished event plays it again, from its start.
    if (this._followPaused && (this._eventEndSent || this._player.atBound)) {
      this._seekFollowTo(this.targetTime);
      this._showFollowCtrl();
      return;
    }
    this._followPaused = !this._followPaused;
    if (this._followPaused) this._player.pause();
    else this._player.play();
    this._showFollowCtrl();
  };

  /** Talk / Stop. Starting is all inside this tap (iOS only lets an
   *  AudioContext run if it was made in the gesture — see talk.ts). */
  private _toggleTalk = (e: Event): void => {
    e.stopPropagation();
    this._showFollowCtrl();
    if (this._talk !== 'idle') {
      this._stopTalk();
      return;
    }
    // Talking to someone you can't hear makes no sense: unmute the live sound,
    // here in the tap (browsers only allow sound on a gesture). Stopping leaves
    // it on — the answer usually comes after you stop.
    if (this._liveMuted) this._setSessionMuted(false);
    const talker = new Talker(this.hass, this.nvrId, this.cameraId, (error) => {
      if (this._talker !== talker) return;
      this._talker = undefined;
      this._talk = 'idle';
      if (error) this._showTalkMsg(error);
    });
    this._talker = talker;
    this._talk = 'connecting';
    // A conversation: hear the reply as close to real time as is safe — and
    // keep doing so after Stop, for the rest of this live session (_startLive
    // resets it): the reply usually comes after you stop, and closing the
    // microphone stalls the live sound (~0.8 s measured in Chrome), which
    // normal live would then carry for minutes.
    this._player.setLowLatency(true);
    // ...and from the camera's channel whose audio is ECHO-CANCELLED. The G6
    // Entry runs its echo canceller only on channel 1: on channels 0 and 2 the
    // talker's own words come back ~0.5 s later, 30 dB over the street noise
    // (measured 2026-10-25, the same words absent from channel 1 in the same
    // seconds). The Protect app switches its player to this channel ("Auto")
    // while talking for exactly that. Same buffer, so the picture stays.
    this._player.setLiveChannel(TALK_LIVE_CHANNEL);
    this._player.live();
    talker.start().then(
      () => {
        if (this._talker === talker) this._talk = 'talking';
      },
      (err: Error) => {
        if (this._talker !== talker) return; // stopped (Stop pressed) while connecting
        this._talker = undefined;
        this._talk = 'idle';
        this._player.setLowLatency(false);
        this._showTalkMsg(err.message || 'Talking failed');
      },
    );
  };

  /** End talking, if it is on (any reason: Stop, leaving live, hidden...). */
  private _stopTalk(): void {
    const talker = this._talker;
    this._talker = undefined;
    if (this._talk !== 'idle') this._talk = 'idle';
    talker?.stop();
  }

  private _showTalkMsg(message: string): void {
    this._talkMsg = message;
    this._talkMsgOn = true;
    clearTimeout(this._talkMsgTimer);
    this._talkMsgTimer = setTimeout(() => (this._talkMsgOn = false), TALK_MSG_MS);
  }

  private _toggleFollowMute = (e: Event): void => {
    e.stopPropagation();
    this._setSessionMuted(!this._followMuted);
    this._showFollowCtrl();
  };

  private _toggleFs = (e: Event): void => {
    e.stopPropagation();
    dbg('ui:fullscreen', { cam: this.cameraId, on: !this._isFs });
    // Hand off to the host's fullscreen timeline, carrying the exact moment on
    // screen so it continues from there rather than from the clip's start.
    if (this.fsHandoff && !this._isFs && !document.fullscreenElement) {
      const at = (this._mode === 'recorded' ? this._player.wallTime : undefined) ?? this.targetTime;
      this._player.pause();
      this.dispatchEvent(
        new CustomEvent('fullscreen-handoff', {
          detail: { camera: this.cameraId, time: at },
          bubbles: true,
          composed: true,
        }),
      );
      return;
    }
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
      this._forceRotate = entering && this._rotateForFs();
      this._showFollowCtrl();
      return;
    }
    // Desktop/tablet: real element fullscreen of the HOST (the player lives
    // inside it). The inline dialog just fills the fullscreened host.
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

  /** cardFs press feedback for the buttons that keep their colour: `pressed`
   *  while the finger is down (what it looks like is the button's press-style
   *  class, see the CSS), then the CSS eases it back. Held at least
   *  PRESS_MIN_MS, so a quick tap still shows it. The colour-changing ones
   *  (speed, sound, talk) fade into their own colours instead. */
  private _pressFlash = (e: PointerEvent): void => {
    const btn = e.currentTarget as HTMLButtonElement;
    if (btn.disabled) return;
    btn.classList.add('pressed');
    const t0 = performance.now();
    const release = (): void => {
      for (const t of ['pointerup', 'pointercancel', 'pointerleave'] as const) {
        btn.removeEventListener(t, release);
      }
      const wait = Math.max(0, PRESS_MIN_MS - (performance.now() - t0));
      setTimeout(() => btn.classList.remove('pressed'), wait);
    };
    for (const t of ['pointerup', 'pointercancel', 'pointerleave'] as const) {
      btn.addEventListener(t, release);
    }
  };

  /** A skip's press: the button's arrow gives a quick spin in its own
   *  direction and springs back, like the iPhone video player's. */
  private _spinArc = (e: Event): void => {
    const btn = e.currentTarget as HTMLElement;
    const arc = btn.querySelector('.arc');
    if (!arc) return;
    const turn = arc.classList.contains('fwd') ? 40 : -40;
    arc.animate(
      [
        { transform: 'rotate(0deg)', easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
        { transform: `rotate(${turn}deg)`, offset: 0.3, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
        { transform: 'rotate(0deg)' },
      ],
      { duration: 560 },
    );
  };

  /** cardFs: the "exit fullscreen" button leaves the screen (the host decides
   *  where to). */
  private _exitCardFs = (e: Event): void => {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent('fs-exit', { bubbles: true, composed: true }));
  };

  /** roundCtrl's close button: the host closes the player. */
  private _close = (e: Event): void => {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent('player-close', { bubbles: true, composed: true }));
  };

  private _onFsChange = (): void => {
    // DESKTOP/tablet element fullscreen only — mobile drives _isFs via the dialog.
    if (!this.stacked) this._isFs = !!document.fullscreenElement;
  };

  // ---- LIVE controls, sound -----------------------------------------------------

  /** One mute choice for the whole session (live, recorded, camera switches)
   *  until the card is hidden. Unmuting resumes playback the user had not
   *  paused (a muted autoplay refusal leaves it stopped). */
  private _setSessionMuted(muted: boolean): void {
    dbg('ui:mute', { cam: this.cameraId, muted });
    this._audioUserChoice = muted ? 'muted' : 'unmuted';
    this._liveMuted = muted;
    this._followMuted = muted;
    this._liveAudioAttempted = true;
    const v = this._mainVideo;
    if (!v) return;
    v.muted = muted;
    if (muted) return;
    v.volume = 1;
    const paused = this._mode === 'live' ? this._livePausedState : this._followPaused;
    if (!paused && v.paused) v.play().catch(() => undefined);
  }

  /** Every session starts muted (a hide ends one). */
  private _resetAudioSession(): void {
    this._audioUserChoice = undefined;
    this._liveMuted = true;
    this._followMuted = true;
    this._liveAudioAttempted = false;
    this._liveAudioTrying = false;
    for (const v of [this._mainVideo, this._previewVidA, this._previewVidB]) if (v) v.muted = true;
  }

  /** A fresh live session: playing, muted unless the user chose sound, the
   *  scrub preview warmed again once it is on screen. */
  private _resetLiveSession(): void {
    this._liveEpoch++;
    this._liveSettled = false;
    this._livePausedState = false;
    this._liveMuted = this._audioUserChoice !== 'unmuted';
    clearTimeout(this._livePreviewWarmTimer);
    this._livePreviewWarmTimer = undefined;
    this._livePreviewWarmed = false;
    this._liveAudioAttempted = this._audioUserChoice !== undefined;
    this._liveAudioTrying = false;
  }

  /** `live_audio_start: auto`: try sound once per live session, and fall back
   *  to muted if the browser does not keep it playing. */
  private async _tryAutoLiveAudio(video: HTMLVideoElement): Promise<void> {
    if (this._liveAudioTrying || this._liveAudioAttempted) return;
    this._liveAudioAttempted = true;
    this._liveAudioTrying = true;
    const epoch = this._liveEpoch;
    const before = video.currentTime;
    try {
      video.muted = false;
      await video.play();
      await new Promise<void>((resolve) => setTimeout(resolve, LIVE_AUDIO_VERIFY_MS));
      if (
        epoch !== this._liveEpoch ||
        video !== this._mainVideo ||
        video.paused ||
        video.currentTime <= before + 0.01
      ) {
        throw new Error('audible autoplay did not remain active');
      }
      this._liveMuted = false;
    } catch {
      if (epoch === this._liveEpoch && video === this._mainVideo) {
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

  /** Rewind SKIP_MS off live: the card drops out of live, and the seek lands
   *  in the live footage already in the buffer — exactly that far before the
   *  frame on screen, not before the card's once-a-second clock. */
  private _liveSkipBack = (e: Event): void => {
    e.stopPropagation();
    const at = this._player.wallTime ?? Date.now();
    this.dispatchEvent(
      new CustomEvent('rewind', {
        detail: { time: at - SKIP_MS },
        bubbles: true,
        composed: true,
      }),
    );
    this._showFollowCtrl();
  };

  /** Pause stops the live stream on the frame on screen; Play goes back to
   *  the live edge (what the card's playhead assumes). */
  private _toggleLivePlay = (e: Event): void => {
    e.stopPropagation();
    if (this._livePausedState) {
      this._startLive();
    } else {
      this._player.pause();
      this._reportLivePlaying(false);
    }
    this._showFollowCtrl();
  };

  private _toggleLiveMute = (e: Event): void => {
    e.stopPropagation();
    this._setSessionMuted(!this._liveMuted);
    this._showFollowCtrl();
  };

  /** Tell the host we are jumping to `t` RIGHT NOW, before the seek lands: the
   *  ruler glides on the press, and the playback-time that eventually arrives
   *  is already where it is pointing. */
  private _announceSeek(t: number): void {
    this.dispatchEvent(
      new CustomEvent('playback-seek', { detail: { time: t }, bubbles: true, composed: true }),
    );
  }

  /** Jump exactly ±deltaMs from the frame on screen (or from the target of a
   *  seek still landing, so two quick presses add up). */
  private _followSkip(deltaMs: number): void {
    const cur = this._player.wallTime;
    if (cur == null) return;
    this._seekFollowTo(cur + deltaMs);
  }

  /** Near the recording edge: skip-forward goes live, speed stays at 1x. */
  private _followNearLive(): boolean {
    const c = this._player.wallTime;
    return c != null && Date.now() - c < NEAR_LIVE_MS;
  }

  private _skipBack = (e: Event): void => {
    e.stopPropagation();
    this._followSkip(-SKIP_MS);
  };
  private _skipFwd = (e: Event): void => {
    e.stopPropagation();
    const cur = this._player.wallTime;
    if (cur == null) return;
    const to = cur + SKIP_MS;
    // To (or past) the live edge it is LIVE. Into the running live session's
    // footage or its backfill (timeshift) or recordings older than
    // RECORDED_SAFE_MS it is an exact skip. In between, footage can't be played on without running into
    // the NVR's not-yet-recorded edge (a stall, or a fetch landing BEHIND the
    // press), so LIVE as well - same as the timeline's jump-to-live arrow.
    const playable = this._player.timeshiftable(to) || to <= Date.now() - RECORDED_SAFE_MS;
    if (to >= Date.now() - FWD_LIVE_MS || !playable) {
      this.dispatchEvent(new CustomEvent('go-live', { bubbles: true, composed: true }));
      return;
    }
    this._followSkip(SKIP_MS);
  };

  private _toggleFollowRate = (e: Event): void => {
    e.stopPropagation();
    if (this._followNearLive()) return; // capped at 1× near the live edge
    this._setFollowRate(this._followRate === 1 ? 2 : this._followRate === 2 ? 4 : 1);
    this._showFollowCtrl();
  };

  private _setFollowRate(rate: number): void {
    if (this._followRate === rate) return;
    this._followRate = rate;
    this._player.setRate(rate);
  }

  /** The custom control bar, the same for live and recorded footage. Live greys
   *  skip-forward + speed (nothing ahead of live); recorded greys speed near
   *  the recording edge (and its skip-forward goes live there). */
  private _renderCtrlBar(mode: 'live' | 'follow', inert = false) {
    if (!inert) this._ctrlMode = mode; // remembered for the scrub stage
    const live = mode === 'live';
    const paused = live ? this._livePausedState : this._followPaused;
    const muted = live ? this._liveMuted : this._followMuted;
    const rate = live ? 1 : this._followRate;
    const speedOn = !live && this._followRate > 1;
    const speedDisabled = live || this._nearLive;
    const back = live ? this._liveSkipBack : this._skipBack;
    const playPause = live ? this._toggleLivePlay : this._toggleFollowPlay;
    const fwd = this._skipFwd;
    const speed = this._toggleFollowRate;
    const mute = live ? this._toggleLiveMute : this._toggleFollowMute;
    const fwdTitle = !live && this._nearLive ? 'Go live' : `Forward ${SKIP_MS / 1000}s`;
    const backTitle = `Back ${SKIP_MS / 1000}s`;
    const talk = live && this.canTalk;
    const talkMsg = this.canTalk
      ? html`<div class="vtalk-msg ${this._talkMsgOn ? 'show' : ''}" role="status">${this._talkMsg}</div>`
      : nothing;
    const speedBtn = html`<button
      class="vctrl-speed ${speedOn ? 'on' : ''}"
      ?disabled=${speedDisabled}
      @click=${live ? undefined : speed}
      title="Playback speed"
    >
      ${rate}<span class="vx">×</span>
    </button>`;
    const muteBtn = html`<button
      class="vmute ${muted ? '' : 'on'}"
      @click=${mute}
      title=${muted ? 'Unmute' : 'Mute'}
    >
      <ha-icon icon=${muted ? 'mdi:volume-off' : 'mdi:volume-high'}></ha-icon>
    </button>`;
    // (The camera screen keeps talk in its row while away from live, hidden,
    // so it can shrink out and grow back - see _renderAxisGroup.)
    const talkButton = this.canTalk
      ? html`<button
          class="vtalk ${this._talk}"
          ?disabled=${this._talk === 'connecting'}
          @click=${this._toggleTalk}
          title=${this._talk === 'talking' ? 'Stop talking' : 'Talk'}
        >
          <ha-icon icon=${this._talk === 'idle' ? 'mdi:microphone-off' : 'mdi:microphone'}></ha-icon>
        </button>`
      : nothing;
    const talkBtn = talk ? talkButton : nothing;
    // The card-sized fullscreen (the tablet's camera screen): iOS / UniFi-app
    // style. Back / play-pause / forward are big round buttons in the middle;
    // the bar along the bottom keeps only speed, sound, talk and exit. Both
    // groups are centred in the picture area the timeline leaves free — left
    // of its time pill, its ruler and button lane, and of the events panel
    // while it is open (--upc-fs-shift: half of what the right takes). The
    // multi page's clip players (roundCtrl) get the same, with a seek bar over
    // the event and "View in Timeline" closing the row.
    if (this.cardFs || this.roundCtrl) {
      const show = `${this._followCtrl ? 'show' : ''} ${inert ? 'inert' : ''}`;
      const reach = this._tlReach || this.fsTimelineWidth;
      // What the right side takes: the timeline, and the events panel pushing
      // it aside - or, on the phone, the panel in its place (see .aside): there
      // the controls keep their place whichever is up, the wider of the two
      // (user, 2026-10-30: they shifted on every open and close).
      const ruler = this.fsTimeline ? reach + this.fsTimelineGutter : 0;
      const taken = !this.cardFs ? 0 : this.phone ? Math.max(ruler, this.fsSide) : ruler + this.fsSide;
      const seek = !this.cardFs && !live && this.clipEndTime > this.targetTime;
      const k = this.cardFs
        ? this.phone
          ? PHONE_CTRL_SCALE
          : 1
        : this.stacked
          ? PHONE_CLIP_CTRL_SCALE
          : CLIP_CTRL_SCALE;
      const rowW = VC_ROW_W * k;
      // The middle buttons sit VC_GAP apart — less only where the free area
      // can't hold that (the events panel open on a smaller tablet). Where it
      // can't hold the row at all (the phone's upright screen with the events
      // panel open) the row steps aside until there is room again.
      const fit = this._hostW ? (this._hostW - taken - rowW - 48) / 2 : VC_GAP * k;
      const gap = Math.max(28 * k, Math.min(VC_GAP * k, Math.floor(fit)));
      const crowded = !!this._hostW && this._hostW - taken < rowW + 2 * 28 * k + 8 ? 'crowded' : '';
      // The bar's own centre: in the free area too - except upright on a
      // phone, where it runs full width under the timeline.
      const barShift = this.upright ? 0 : taken / 2;
      // The phone's clip card holds its picture at the top (a landscape clip
      // has its control strip below): the middle row centres on the picture.
      const vcTop = this.stacked && this.roundCtrl && this._hostW ? `--upc-vc-top:${this._picCentreY()}px;` : '';
      const vars =
        `--upc-fs-shift:${taken / 2}px;--upc-bar-shift:${barShift}px;--upc-vc-gap:${gap}px;` +
        `--upc-vc-row:${rowW}px;--vc-k:${k};${vcTop}`;
      // The MDI skip glyph with its arrow nudged up and its number down (see
      // SKIP_DIGITS): ~3 units apart instead of ~1, still inside the grid. The
      // arrow is its own element (.arc) so it can spin on a skip (_spinArc);
      // the nudge sits on a wrapper because a CSS transform on the path itself
      // would replace its transform attribute.
      const skipIcon = (fwdIcon: boolean) =>
        html`<svg class="vc-skip-icon" viewBox="0 0 24 24" aria-hidden="true">
          <g transform="translate(0 -1)">
            <path class="arc ${fwdIcon ? 'fwd' : ''}" d=${fwdIcon ? SKIP_ARC_FWD : SKIP_ARC_BACK}></path>
          </g>
          <path transform="translate(0 1)" d=${SKIP_DIGITS}></path>
        </svg>`;
      // Back / play-pause / forward: the floating middle row - or, on the
      // phone's upright screen (portrait footage, where the timeline leaves
      // too narrow a strip beside it), the bar's own top row, iOS-player style.
      const centre = html`<button
          class="vc-skip press"
          @pointerdown=${this._pressFlash}
          @click=${(e: Event) => {
            this._spinArc(e);
            back(e);
          }}
          title=${backTitle}
        >
          ${skipIcon(false)}
        </button>
        <button
          class="vc-play press"
          @pointerdown=${this._pressFlash}
          @click=${playPause}
          title=${paused ? 'Play' : 'Pause'}
        >
          <ha-icon icon=${paused ? 'mdi:play' : 'mdi:pause'}></ha-icon>
        </button>
        <button
          class="vc-skip press"
          ?disabled=${live}
          @pointerdown=${this._pressFlash}
          @click=${(e: Event) => {
            if (live) return;
            this._spinArc(e);
            fwd(e);
          }}
          title=${fwdTitle}
        >
          ${skipIcon(true)}
        </button>`;
      return html`
        ${talkMsg}
        <div class="vshade ${show} ${seek ? 'seek' : ''}" style=${vars}></div>
        ${this.upright ? nothing : html`<div class="vcshade ${show} ${crowded}" style=${vars}></div>`}
        ${this.upright ? nothing : html`<div class="vcenter ${show} ${crowded}" style=${vars}>${centre}</div>`}
        <div
          class="vctrl fs card ${show} ${talk ? 'has-talk' : ''}"
          style=${vars}
          @click=${(e: Event) => e.stopPropagation()}
        >
          ${this.upright ? html`<div class="vc-row">${centre}</div>` : nothing}
          ${seek ? this._renderClipSeek() : nothing}
          ${this.cardFs
            ? this._renderAxisGroup(speedBtn, muteBtn, talkButton, talk)
            : this._renderClipGroup(speedBtn, muteBtn, talkBtn)}
        </div>
      `;
    }
    return html`
      ${talkMsg}
      <div
        class="vctrl ${this._followCtrl ? 'show' : ''} ${this._fsLook ? 'fs' : ''} ${this._fsStrip
          ? 'fs-inset'
          : ''} ${inert ? 'inert' : ''} ${talk ? 'has-talk' : ''}"
        style="--upc-fs-tl-w:${this.fsTimelineWidth}px;--upc-fs-tl-gut:${this
          .fsTimelineGutter}px;--upc-fs-tl-pad:${this.fsTimelinePadding}px;--upc-fs-side:${this
          .fsSide}px"
        @click=${(e: Event) => e.stopPropagation()}
      >
        <button @click=${back} title=${backTitle}>
          <ha-icon icon="mdi:rewind-10"></ha-icon>
        </button>
        <button @click=${playPause} title=${paused ? 'Play' : 'Pause'}>
          <ha-icon icon=${paused ? 'mdi:play' : 'mdi:pause'}></ha-icon>
        </button>
        <button ?disabled=${live} @click=${live ? undefined : fwd} title=${fwdTitle}>
          <ha-icon icon="mdi:fast-forward-10"></ha-icon>
        </button>
        ${speedBtn}${muteBtn}${talkBtn}
        <button class="vfs" @click=${this._toggleFs} title="Fullscreen">
          <ha-icon icon=${this._isFs ? 'mdi:fullscreen-exit' : 'mdi:fullscreen'}></ha-icon>
        </button>
        ${!live && this.clipEndTime > this.targetTime
          ? this._renderEventSeekRow()
          : html`<div class="vctrl-spacer"></div>`}
      </div>
    `;
  }

  /** The camera screen's bottom row (cardFs): speed, sound, talk (live only)
   *  and exit (when the host has somewhere to go back to), centred as a whole
   *  on the middle row's axis whichever of them it holds - each button placed
   *  by its index (.vg-slot). Talk keeps its slot while away, half a place
   *  past sound - right where it stands in the row it leaves or joins. */
  private _renderAxisGroup(speedBtn: unknown, muteBtn: unknown, talkBtn: unknown, talk: boolean) {
    const exit = this.cardFsExit;
    const n = 2 + (talk ? 1 : 0) + (exit ? 1 : 0);
    return html`<div class="vctrl-group axis" style=${`--n:${n}`}>
      <span class="vg-slot" style="--i:0">${speedBtn}</span>
      <span class="vg-slot" style="--i:1">${muteBtn}</span>
      ${this.canTalk
        ? html`<span class="vg-slot ${talk ? '' : 'off'}" style=${`--i:${talk ? 2 : 1.5}`}>${talkBtn}</span>`
        : nothing}
      ${exit
        ? html`<span class="vg-slot" style=${`--i:${n - 1}`}>
            <button class="press" @pointerdown=${this._pressFlash} @click=${this._exitCardFs} title="Exit full screen">
              <ha-icon icon="mdi:fullscreen-exit"></ha-icon>
            </button>
          </span>`
        : nothing}
    </div>`;
  }

  /** A clip player's bottom row (roundCtrl): speed, sound, "View in Timeline",
   *  Close. */
  private _renderClipGroup(speedBtn: unknown, muteBtn: unknown, talkBtn: unknown) {
    return html`<div class="vctrl-group">
      ${speedBtn}${muteBtn}${talkBtn}
      ${this.fsHandoff
        ? html`<button
            class="vc-tl press"
            @pointerdown=${this._pressFlash}
            @click=${this._toggleFs}
            title="Watch what happened before and after, on the camera's timeline"
          >
            View in Timeline
          </button>`
        : nothing}
      ${this.closable
        ? html`<button class="press" @pointerdown=${this._pressFlash} @click=${this._close} title="Close">
            <ha-icon icon="mdi:close"></ha-icon>
          </button>`
        : nothing}
    </div>`;
  }

  /** The phone's camera screen: its timeline steps aside while the events
   *  panel is open (user, 2026-10-28: "the list replaces the timeline") -
   *  sideways it would push the ruler into the middle of the picture, upright
   *  off the screen's left edge. */
  private _tlAside(): boolean {
    return this.cardFs && this.phone && this.fsSide > 0;
  }

  /** Where the event being played is, for its seek bar: `frac` of the way,
   *  `sec` whole seconds in of `secs` (its length as the events list rounds
   *  it - "8s" - so the bar never reads 0:07 at an 8-second event's end).
   *  An event that has played to its end reads as ended: the player stops it
   *  a little short of its last frame (END_MARGIN_MS - MSE stalls at the
   *  buffered end), which showed "−0:01" left at the end (user, 2026-10-31). */
  private _clipProgress(): { frac: number; sec: number; secs: number } {
    const start = this.targetTime;
    const total = Math.max(1, this.clipEndTime - start);
    const ended = this._seekDragAt === undefined && this._eventEndSent && this._player.atBound;
    const cur = ended ? start + total : (this._seekDragAt ?? this._followNow ?? start);
    const at = Math.min(total, Math.max(0, cur - start));
    const secs = Math.max(1, Math.round(total / 1000));
    return { frac: at / total, sec: at >= total ? secs : Math.min(secs, Math.floor(at / 1000)), secs };
  }

  /** Time readout + seek bar over the EVENT being played, start to end, in
   *  wall-clock time — the same timeline the footage is on, so a position on
   *  the bar IS an instant and seeking to it is _seekFollowTo. */
  private _renderEventSeekRow() {
    const { frac, sec, secs } = this._clipProgress();
    return html`<div class="vseek-row">
      <span class="vtime">${this._fmtClock(sec)} / ${this._fmtClock(secs)}</span>
      <div class="vseek" @pointerdown=${this._onEventSeekDown}>
        <div class="vseek-track">
          <div class="vseek-fill" style="width:${frac * 100}%"></div>
          <div class="vseek-knob" style="left:${frac * 100}%"></div>
        </div>
      </div>
    </div>`;
  }

  /** The round controls' seek bar over the event (.vc-seek): elapsed on the
   *  left, what is left on the right - the same drag as the classic bar. */
  private _renderClipSeek() {
    const { frac, sec, secs } = this._clipProgress();
    return html`<div class="vc-seek">
      <span class="vtime left">${this._fmtClock(sec)}</span>
      <div class="vseek ${this._seekDragAt !== undefined ? 'drag' : ''}" @pointerdown=${this._onEventSeekDown}>
        <div class="vseek-track">
          <div class="vseek-fill" style="width:${frac * 100}%"></div>
          <div class="vseek-knob" style="left:${frac * 100}%"></div>
        </div>
      </div>
      <span class="vtime">−${this._fmtClock(secs - sec)}</span>
    </div>`;
  }

  private _eventSeekAt(e: PointerEvent, bar: HTMLElement): number {
    const rect = bar.getBoundingClientRect();
    // Rotated (mobile landscape) fullscreen: the bar runs vertically on screen.
    const raw = this._forceRotate
      ? (e.clientY - rect.top) / rect.height
      : (e.clientX - rect.left) / rect.width;
    const frac = Math.min(1, Math.max(0, raw));
    return this.targetTime + frac * (this.clipEndTime - this.targetTime);
  }

  /** Drag the event seek bar. While the finger is down ONLY the knob and the
   *  time move; the footage seeks once, on release. Seeking on every move is
   *  what used to fire an export per pixel and land on whichever came back
   *  last. A cancelled gesture leaves playback where it was. */
  private _onEventSeekDown = (e: PointerEvent): void => {
    e.stopPropagation();
    const bar = e.currentTarget as HTMLElement;
    try {
      bar.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic pointer ids in tests */
    }
    this._seekDragAt = this._eventSeekAt(e, bar);
    const move = (ev: PointerEvent): void => {
      this._seekDragAt = this._eventSeekAt(ev, bar);
    };
    const finish = (commit: boolean): void => {
      bar.removeEventListener('pointermove', move);
      bar.removeEventListener('pointerup', up);
      bar.removeEventListener('pointercancel', cancel);
      const t = this._seekDragAt;
      this._seekDragAt = undefined;
      if (commit && t !== undefined) this._seekFollowTo(t);
      this._showFollowCtrl();
    };
    const up = (): void => finish(true);
    const cancel = (): void => finish(false);
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup', up);
    bar.addEventListener('pointercancel', cancel);
    this._showFollowCtrl();
  };

  /** A press inside the fullscreen strip. Its PADDING — the gutter right of the
   *  ruler (where the round buttons sit) and the bands above and below it — has
   *  no scrub surface under it, so a drag that started there did nothing while
   *  a tap there worked. Hand such a press to the timeline: it captures the
   *  pointer and runs the drag exactly as if it had started on the ruler. A
   *  press on the ruler, a thumbnail or a button is the timeline's already. */
  private _onStripPress = (e: PointerEvent): void => {
    e.stopPropagation();
    this._keepCtrlAlive();
    if (e.composedPath()[0] !== e.currentTarget) return;
    const tl = this.querySelector('[slot="fs-timeline"]') as
      | (Element & { beginDrag?: (ev: PointerEvent) => void })
      | null;
    tl?.beginDrag?.(e);
  };

  /** Where the picture is drawn in this element (object-fit contain), in its
   *  own coordinates: what a zoom transition flies into or out of. */
  videoBox(): Box {
    // The camera's own resolution first: right after a camera switch the
    // <video> still reports the previous camera's.
    const size = this._footageSize();
    const poster = this.poster instanceof HTMLCanvasElement ? this.poster : undefined;
    const aspect = size ? size[0] / size[1] : poster ? poster.width / poster.height : 16 / 9;
    // (The upright camera screen's picture sits above its control bar.)
    const h = this.cardFs && this.upright ? this.clientHeight - this._uprightBarH : this.clientHeight;
    const box = containBox({ x: 0, y: 0, w: this.clientWidth, h }, aspect);
    // The phone's clip card draws it at the top (object-position, see CSS).
    if (this.stacked && this.roundCtrl) box.y = 0;
    return box;
  }

  /** The phone's clip card: the middle of its (top-aligned) picture. */
  private _picCentreY(): number {
    const size = this._footageSize();
    const aspect = size ? size[0] / size[1] : 16 / 9;
    const h = this._hostH || this.clientHeight;
    return Math.min(h, this._hostW / aspect) / 2;
  }

  /** The frame on screen as a canvas, where that is safe (see frameOf). */
  snapshot(): HTMLCanvasElement | null {
    return frameOf(this._mainVideo);
  }

  /** The footage's pixel size, when known (see _footageSize). */
  footageSize(): [number, number] | undefined {
    return this._footageSize();
  }

  /** The poster, filling the box the video will fill. */
  private _renderPoster(poster: string | HTMLCanvasElement) {
    const b = this.videoBox();
    const cls = `poster ${this._posterGone ? 'gone' : ''} ${this._posterFadeIn ? 'in' : ''}`;
    const style = `left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px`;
    return poster instanceof HTMLCanvasElement
      ? html`<div class=${cls} style=${style}>${poster}</div>`
      : html`<img class=${cls} style=${style} src=${poster} alt="" />`;
  }

  /** Fullscreen, or its card-sized equivalent (cardFs): the same chrome. */
  private get _fsLook(): boolean {
    return this._isFs || this.cardFs;
  }

  /** True while the host's slotted overlay timeline is on screen. */
  private get _fsStrip(): boolean {
    return this._fsLook && this.fsTimeline;
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
    // Pointer traffic stops here (see below) and only KEEPS the controls up; a
    // tap's toggle is decided by the host-level detector (see _tap).
    const hold = (e: Event): void => {
      e.stopPropagation();
      this._keepCtrlAlive();
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
      class="fs-tl ${this._followCtrl ? 'show' : ''} ${this._tlAside() ? 'aside' : ''}"
      style="--upc-fs-tl-w:${this.fsTimelineWidth}px;--upc-fs-tl-boxw:${boxWidth};--upc-fs-tl-gut:${this
        .fsTimelineGutter}px;--upc-fs-tl-pad:${this
        .fsTimelinePadding}px;--upc-fs-tl-scrim-ext:${this
        .fsTimelineScrimExtend}px;--upc-fs-tl-bg:${scrim};--upc-fs-side:${this.fsSide}px"
      @pointerdown=${this._onStripPress}
      @pointermove=${hold}
      @wheel=${hold}
      @pointerup=${(e: Event) => e.stopPropagation()}
      @pointercancel=${(e: Event) => e.stopPropagation()}
      @click=${(e: Event) => e.stopPropagation()}
    >
      <slot name="fs-timeline"></slot>
    </div>`;
  }

  /** cardFs: the host's camera picker (top) and events panel (right). */
  private _renderCardChrome() {
    if (!this.cardFs) return nothing;
    const show = this._followCtrl ? 'show' : '';
    return html`<div class="fs-top ${show}"><slot name="fs-top"></slot></div>
      <div class="fs-side ${show}"><slot name="fs-side"></slot></div>`;
  }

  render() {
    const stage = this._stage();
    // DESKTOP/tablet fullscreen uses the real Fullscreen API on the host, so it
    // needs NO dialog — and wrapping a LIVE <video> in a <dialog> broke its
    // compositing on desktop Chrome (audio plays, the frame FREEZES). Only the
    // MOBILE (stacked) landscape fullscreen needs the top-layer showModal, so
    // only there does the player live inside the always-open <dialog>. (A
    // layout change moves the player between the two; NvrPlayer.attach picks
    // the new element up where the old one was.)
    // The freeze canvas sits next to the stage in BOTH layouts — inside the
    // dialog for the rotated phone fullscreen, so it rotates and fills with it.
    // It is always in the tree so _holdFrame can reveal it SYNCHRONOUSLY.
    const freeze = html`<canvas class="freeze" ?hidden=${!this._frozen}></canvas>`;
    if (!this.stacked) {
      return html`${stage}${freeze}${this._renderFsTimeline()}${this._renderCardChrome()}`;
    }
    return html`<dialog
      class="fs-wrap ${this._isFs ? 'fs-active' : ''} ${this._isFs
        ? this._forceRotate
          ? 'rotate'
          : 'upright'
        : ''}"
      @close=${this._onDlgClose}
    >
      ${stage}${freeze}${this._renderFsTimeline()}
    </dialog>`;
  }

  private _stage() {
    if (!this.nvrId || !this.cameraId) {
      return html`<div class="stage"><div class="msg error">Missing camera / nvr_id.</div></div>`;
    }
    // ONE stable stage. The player is always the same <video> at the same
    // place in the tree (NvrPlayer owns its source); what changes per mode is
    // only what is layered over it — so nothing is torn down and rebuilt when
    // going live, rewinding, seeking or scrubbing. Every state gets the
    // control bar and tap-to-toggle, so fullscreen is never a dead end.
    const live = this.live && !this.scrubbing;
    const missing = live && !this.hass?.states[this.cameraId];
    // Waiting at a time the camera was offline: say so (parity with the grey
    // timeline gap) instead of a spinner.
    const offline = !this.live && this._waiting && inGap(this.gaps, this.targetTime);
    const idle = !this.live && !this.scrubbing && this._mode === null;
    // (The phone's clip card: its spinner centres on the picture, too.)
    const picTop = this.stacked && this.roundCtrl && this._hostW ? `--upc-vc-top:${this._picCentreY()}px;` : '';
    return html`
      <div
        class="stage"
        style=${(this.accent ? `--upc-accent:${this.accent};` : '') + picTop}
        @pointermove=${this.scrubbing ? undefined : this._onStageHover}
      >
        <video class="main ${this._blank ? 'blank' : ''}" playsinline preload="auto" muted></video>
        ${this._posterOn && this.poster && this._hostW ? this._renderPoster(this.poster) : nothing}
        ${this.scrubbing
          ? html`
              <!-- SPRITE-PREVIEW-2026-08-04: the decoder-free surface. Always in
                   the tree while scrubbing so _drawSprite can paint it
                   synchronously, but only revealed once it holds a frame — until
                   then the paused footage underneath stays visible. -->
              <canvas class="sprite ${this._spriteReady ? 'preview-on' : 'preview-off'}"></canvas>
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
            `
          : nothing}
        ${this.scrubbing
          ? nothing
          : this._tapToPlay
            ? html`<button class="tap-play" @click=${this._onTapToPlay} title="Play">▶</button>`
            : missing
              ? html`<div class="msg error">Camera entity not found.</div>`
              : this._error
                ? html`<div class="msg error">${this._error}</div>`
                : offline
                  ? html`<div class="msg">Footage unavailable — camera was offline.</div>`
                  : idle
                    ? html`<div class="msg">Tap the timeline to play from a time.</div>`
                    : this._waiting && this._blank && !this._posterOn
                      ? html`<div class="overlay"><div class="spinner"></div></div>`
                      : this._waiting
                        ? html`<div class="overlay buffering" aria-label="Loading footage">
                            <div class="spinner"></div>
                          </div>`
                        : nothing}
        ${this.scrubbing
          ? this._renderCtrlBar(this._ctrlMode, true)
          : this._renderCtrlBar(live ? 'live' : 'follow')}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'upc-media-view': MediaView;
  }
}
