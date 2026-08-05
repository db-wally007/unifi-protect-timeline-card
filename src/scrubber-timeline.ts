// Vertical UniFi-style scrubber. Time runs top(newer) -> bottom(older); the
// playhead sits ~20% down from the top (a little future above, mostly past
// below). Drag up = go back in time, drag down = toward now. Zoom is STEPPED
// and lives behind a collapsible magnifier button at the top-right (UniFi
// mobile style): tap -> a vertical slider flyout with +/- step buttons; tap
// anywhere outside -> it collapses. Detection events are drawn as accent bars
// spanning their full duration. Dragging scrolls the footage past the playhead;
// tapping an event's THUMBNAIL winds the ruler to that event's start (an
// animated seek — see _seekTo) and plays on from there. The timeline never
// starts a bounded event clip: that is the events list's job.
// No snapping/sticky behavior. The date pill + jump-to-live arrow are rendered
// by the CARD (they float over this element and must survive it being hidden).

import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import type { DetectionBand, FootageGap, HomeAssistant, TimeDomain } from './data/types';
import {
  MINUTE,
  SECOND,
  SPAN_STEPS,
  PLAYHEAD_FRAC,
  domainForPlayhead,
  nextSpanStep,
  playheadTimeOf,
  spanOf,
  tickTimes,
} from './data/time-scale';
import type { ThumbnailLoader } from './data/thumbnail-loader';
import { fmtTime } from './data/fmt'; // PERF-SCRUB-2026-08-03

// Canvas layout (CSS px). The column is ~200px wide; stacked (phone) mode
// shifts everything right via `indent` (the bottom-left area stays clear for
// the card's floating date pill).
const LABEL_RIGHT = 62; // time labels right-aligned here
const TICK_RIGHT = 80; // ticks anchored here, extend left by their length
const TRACK_X0 = 86;
const TRACK_X1 = 98;
const EVENT_X0 = 104; // x where the event connector line starts (right of track)

// MIRRORED layout (`mirror`, the fullscreen overlay): everything hugs the RIGHT
// edge instead — ticks at the very edge, time labels to their left, then the
// track, with the event thumbnails hanging OUTSIDE the strip over the video.
// That's the order the UniFi app's fullscreen scrubber uses.
const MIRROR_EDGE = 2; // right margin of the tick column
const MIRROR_TICK_GAP = 6; // ticks -> labels
const MIRROR_LABEL_GAP = 8; // labels -> track
const MIRROR_EVT_GAP = 8; // track -> thumbnails
// Playhead pill (mirror): it seats one gap further left than the thumbnail
// column, and STEPS CLEAR of a thumbnail sharing its row rather than sitting on
// top of it — the playhead line stretches to follow it either way.
const PILL_GAP = 20;
const PILL_DODGE_GAP = 12;

/** Resolved x positions for one draw pass (see the two blocks above). */
interface Geo {
  labelRight: number;
  tickRight: number;
  trackX0: number;
  trackX1: number;
  // DOM anchor for the thumbnails / LIVE pill / gap tip: a `left` offset in the
  // normal layout, a `right` offset (from the host's right edge) when mirrored.
  evtAnchor: number;
}
const MIN_EVENT_PX = 5;
const HOVER_PX = 24; // hover/active within this enlarges the event thumbnail
const LIVE_EDGE_MS = 5_000; // show the LIVE pill only while the playhead is within this of now

// Flick momentum (iOS-style inertia after a fast drag release).
const FLICK_MIN_PXS = 80; // release velocity below this = plain stop, no glide
const MOMENTUM_TAU_S = 0.325; // exponential decay time constant (~iOS scroll feel)
const MOMENTUM_STOP_PXS = 20; // glide ends below this velocity
const MOMENTUM_MAX_PXS = 4000; // clamp absurd flick velocities
const VEL_WINDOW_MS = 120; // release velocity = average over this trailing window
// Rubber-band overscroll past the live edge: the visual overshoot approaches
// this asymptote (px) no matter how far the finger drags — iOS overscroll feel.
const RUBBER_MAX_PX = 48;

// Tap-an-event seek (overlay): how long the ruler takes to wind to the target.
// Long enough to read as travel in a direction — the point of the animation —
// without making the wait for the footage feel like part of it.
const SEEK_MS = 520;

// One surviving timeline thumbnail: which thumbs exist is decided purely by
// geometry (zoom), so the set is identical whether or not anything is playing
// or hovered — hidden thumbs are NEVER resurrected by the playhead or mouse.
interface KeptThumb {
  m: DetectionBand; // the raw member event the thumbnail depicts
  g: DetectionBand; // its display group (caption / click-to-play context)
  y: number; // anchored center in canvas px — a thumb never moves from here
}

interface EventHit {
  band: DetectionBand;
  colX: number; // left x of the marker column
  yTop: number;
  yBot: number;
}

/** Stable identity of one thumbnail: the `repeat` key, and the `data-key` the
 *  tap hit-test maps a DOM node back to its event with. */
function thumbKey(m: DetectionBand): string {
  return m.id ?? `${m.type}@${m.start}`;
}

/** Eat the pointerup/click that follow a swallowed pointerdown, so a tap that
 *  only meant "close this flyout" can't also seek the timeline or hit the
 *  video controls underneath. One-shot window capture listeners that also
 *  SELF-EXPIRE: if the tap never produces one of the events (possible with
 *  preventDefault-ed pointerdowns), a stale armed listener must not eat an
 *  unrelated tap seconds later. Shared with the card's calendar popup. */
export function swallowNextTap(): void {
  const eat = (ev: Event): void => {
    ev.stopPropagation();
    ev.preventDefault();
  };
  window.addEventListener('pointerup', eat, { capture: true, once: true });
  window.addEventListener('click', eat, { capture: true, once: true });
  setTimeout(() => {
    window.removeEventListener('pointerup', eat, true);
    window.removeEventListener('click', eat, true);
  }, 700);
}

/** Darken a hex color toward black. The accent is chosen to read as a thin
 *  bright line on the timeline, which leaves white text on a FILLED pill of it
 *  barely legible — the overlay's pills and arrow use this deeper mix instead.
 *  Non-hex accents (a CSS var, a named color) return '' and are left alone. */
function darken(color: string, f: number): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return '';
  const hex =
    m[1].length === 3
      ? m[1]
          .split('')
          .map((c) => c + c)
          .join('')
      : m[1];
  const n = parseInt(hex, 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * f));
  return `rgb(${ch[0]}, ${ch[1]}, ${ch[2]})`;
}

// Major (labeled) and minor (dash) tick intervals for a given visible span,
// tuned to mirror UniFi: per-minute labels + 15s dashes when zoomed in,
// 10-min labels + 1-min dashes when zoomed out. (15s, not 10s, because ~15s is
// the finest rewind resolution the recording export can serve — see
// delayed-follow — so a finer divider would imply a precision that isn't real.)
function majorMinorFor(span: number): { major: number; minor: number } {
  const M = MINUTE;
  const S = SECOND;
  if (span <= 5 * M) return { major: 1 * M, minor: 15 * S };
  if (span <= 10 * M) return { major: 1 * M, minor: 30 * S };
  if (span <= 20 * M) return { major: 2 * M, minor: 30 * S };
  if (span <= 40 * M) return { major: 5 * M, minor: 1 * M };
  if (span <= 80 * M) return { major: 10 * M, minor: 1 * M };
  return { major: 10 * M, minor: 1 * M };
}

@customElement('upc-scrubber-timeline')
export class ScrubberTimeline extends LitElement {
  @property({ attribute: false }) domain!: TimeDomain;
  @property({ attribute: false }) bands: DetectionBand[] = [];
  @property({ attribute: false }) gaps: FootageGap[] = []; // camera-offline spans (grey)
  @property() gapColor = ''; // unavailable-footage band color
  @property({ attribute: false }) now = Date.now();
  @property({ attribute: false }) hass?: HomeAssistant;
  @property() nvrId = '';
  @property() cameraId = '';
  @property({ type: Number }) fontSize = 11;
  @property() fontColor = '';
  @property() accentColor = '';
  @property() tickColor = '';
  @property({ type: Number }) tickSize = 7;
  @property() recordedColor = '';
  @property() futureColor = '';
  @property({ type: Number }) thumbSize = 79; // inactive thumbnail width (px)
  // Hovered/active width (px). Kept-thumb spacing accounts for this, so an
  // enlarged thumbnail can NEVER touch its neighbours (UniFi: subtle grow, no
  // fading/hiding of anything around it).
  @property({ type: Number }) thumbSizeActive = 95;
  @property({ attribute: false }) loader?: ThumbnailLoader;
  @property({ type: Number }) thumbVersion = 0; // bump => re-render when thumbs load
  // Driven by the card: true while the live stream is showing (hides the arrow).
  @property({ type: Boolean }) live = false;
  @property({ type: Boolean }) livePaused = false; // live stream mounted but paused
  // px to shift the timeline content (labels/ticks/track/events) right. The
  // LIVE pill does NOT follow it — see pillIndent.
  @property({ type: Number }) indent = 0;
  // px added to the LIVE pill's base 4px left. Decoupled from `indent` so the
  // pill keeps its own position when the timeline is shifted.
  @property({ type: Number }) pillIndent = 0;
  // ---- fullscreen-overlay mode (see the MIRROR_* constants) -----------------
  // Mirror the ruler onto the RIGHT edge, thumbnails hanging left over the
  // video. Reflected so the CSS below can key off :host([mirror]).
  @property({ type: Boolean, reflect: true }) mirror = false;
  // Render the zoom magnifier/flyout.
  @property({ type: Boolean }) zoomUi = true;
  // The element sits inside a CSS `rotate(90deg)` box (the mobile fullscreen
  // player), so the finger's perceived-vertical motion arrives as clientX.
  @property({ type: Boolean }) rotated = false;
  // Render the jump-to-live arrow (the card draws its own next to the timeline
  // column; the fullscreen overlay has no card chrome around it, so it carries
  // its own). Emits `go-live`, which bubbles to the host.
  @property({ type: Boolean }) liveArrow = false;
  // Phone layout: same structure, smaller chrome (the overlay strip is a
  // fraction of a rotated phone's short side, where tablet-sized pills dominate
  // it). Set for the phone's CARD COLUMN too, not only its overlay, so controls
  // that must be identical in both — the zoom flyout — can key off it; the
  // rules that are overlay-only stay scoped to [mirror][compact].
  @property({ type: Boolean, reflect: true }) compact = false;
  // How far down the strip the playhead sits. The HOST owns this: it drives the
  // time<->pixel mapping, so the card's own domain math has to use the very same
  // value or the marker would point at a different moment than the one playing.
  @property({ type: Number }) playheadFrac = PLAYHEAD_FRAC;
  // Width (px) of the clear lane between the ruler and the screen edge in the
  // fullscreen overlay. The zoom control and the jump-to-live arrow sit in it,
  // centered — outside the element's own box, over the strip's scrim.
  @property({ type: Number }) gutter = 0;

  @state() private _hoverBand?: DetectionBand;
  @state() private _hoverGap?: { gap: FootageGap; y: number };
  @state() private _zoomOpen = false; // magnifier flyout expanded

  @query('canvas') private _canvas!: HTMLCanvasElement;
  @query('.scrub') private _scrubEl!: HTMLElement;

  private _ro?: ResizeObserver;
  private _dpr = 1;
  private _width = 0;
  private _height = 0;
  private _setupTs = 0; // (re)mount time — gates the resize scale-preserve
  private _frame = 0;
  private _rect?: DOMRect;
  private _evtAnchor = EVENT_X0; // DOM thumbnail anchor from the last draw
  private _hits: EventHit[] = [];
  private _gapHits: { gap: FootageGap; yTop: number; yBot: number }[] = [];
  private _animDomain?: TimeDomain; // interpolated domain during a zoom animation
  private _animRaf = 0;

  // pointer state (single-finger / mouse drag = scroll; zoom is buttons only)
  private _pointers = new Map<number, { x: number; y: number }>();
  private _dragStartY = 0;
  private _dragStartDomain?: TimeDomain;
  private _moved = false;
  // `scrub-start` has been announced for the gesture in progress.
  private _gestureStarted = false;
  // Whether the current gesture ever emitted a `scrub` (i.e. actually moved the
  // playhead into the past). A gesture that only pushed against the live edge
  // (rubber-band) never scrubs — release emits `scrub-cancel` and live playback
  // is never interrupted.
  private _gestureScrubbed = false;
  private _scrubEndTimer?: ReturnType<typeof setTimeout>;
  // flick momentum: recent pointer positions for release velocity + glide state
  private _velSamples: { t: number; y: number }[] = [];
  // A scrub-start has been announced to the host and not yet closed by a
  // scrub-end/scrub-cancel. It OUTLIVES the pointer gesture: a flick defers its
  // scrub-end until the momentum glide stops, so between the finger lifting and
  // the glide settling there is an open session with no pointer down at all.
  private _scrubOpen = false;
  // The playhead pill swells to stage-timestamp size whenever the ruler is
  // MOVING under the user — drag, flick glide, thumbnail seek, skip-button
  // glide. It replaces the timestamp that used to sit on the video itself,
  // where the control bar covered it on a phone and on a small tablet.
  @state() private _pillBig = false;
  // A skip glide has no gesture behind it, so it needs its own flag with a
  // timer. DERIVED, never assigned directly: the timer used to force _pillBig
  // false, which killed the swell mid-DRAG whenever a glide happened to be
  // pending — and after every scrub-end playback resumes with a jump, so one
  // usually was. Both sources feed _syncPillBig instead.
  private _glideBig = false;
  private _pillBigTimer?: ReturnType<typeof setTimeout>;

  /** The pill is big while the ruler is moving, from EITHER source. */
  private _syncPillBig(): void {
    this._pillBig = this._scrubOpen || this._glideBig;
  }

  /** Hold the pill big for `ms` on behalf of ruler motion that has no pointer
   *  gesture behind it — a skip-button glide, or a wheel/trackpad scroll (which
   *  emits `scrub` without ever opening a session). Re-armable: each new wheel
   *  notch pushes the release back, so a long scroll stays big throughout. */
  private _holdPillBig(ms = SEEK_MS): void {
    this._glideBig = true;
    this._syncPillBig();
    clearTimeout(this._pillBigTimer);
    this._pillBigTimer = setTimeout(() => {
      this._pillBigTimer = undefined;
      this._glideBig = false;
      this._syncPillBig(); // a drag that started meanwhile KEEPS the pill big
    }, ms);
  }
  private _momentumRaf = 0;
  private _momentumV = 0; // px/s in clientY direction (positive = toward now)
  private _momentumLast = 0;
  private _seekRaf = 0; // animated seek to a tapped event (see _seekTo)

  static styles = css`
    :host {
      display: block;
      height: 100%;
      width: 100%;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
      overflow: visible;
    }
    .col {
      display: flex;
      flex-direction: column;
      height: 100%;
      gap: 6px;
    }
    /* Collapsed zoom control: a round magnifier button at the top-right of the
       timeline (same right-edge column as the jump-to-live arrow, but at the
       top). Tapping it expands .zoom-panel; tapping anywhere outside closes. */
    .zoom-fab {
      position: absolute;
      top: 14px;
      right: 8px;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      background: rgba(0, 0, 0, 0.6);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
      z-index: 9;
      -webkit-tap-highlight-color: transparent;
    }
    .zoom-fab ha-icon {
      --mdc-icon-size: 24px;
      display: block;
    }
    /* Expanded zoom flyout: vertical slider pill, + on top, − at the bottom
       (UniFi mobile; plain glyphs — the loupe icons read too small). Fully
       custom slider — native vertical range inputs are unreliable on iOS. */
    .zoom-panel {
      position: absolute;
      top: 14px;
      right: 8px;
      width: 44px;
      /* A FIXED length, not a percentage of the ruler: this is one control and
         it must be the same size wherever it appears, but the card column's
         ruler and the fullscreen one are wildly different heights, so a
         percentage made the in-card flyout markedly the smaller of the two.
         224px is what 35% used to resolve to on a tablet's fullscreen ruler,
         so the overlay there is unchanged and the card column now matches it. */
      height: 224px;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 6px 0;
      box-sizing: border-box;
      border-radius: 22px;
      background: rgba(0, 0, 0, 0.6);
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.6);
      z-index: 9;
    }
    .zpbtn {
      flex: 0 0 auto;
      width: 36px;
      height: 36px;
      border: none;
      border-radius: 50%;
      background: transparent;
      color: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 26px;
      font-weight: 400;
      line-height: 1;
      padding: 0;
      -webkit-tap-highlight-color: transparent;
    }
    .zslider {
      position: relative;
      flex: 1 1 auto;
      width: 100%;
      min-height: 60px;
      cursor: pointer;
      touch-action: none;
    }
    .zslider::before {
      /* the thin track line */
      content: '';
      position: absolute;
      left: 50%;
      top: 8px;
      bottom: 8px;
      width: 4px;
      transform: translateX(-50%);
      border-radius: 2px;
      background: rgba(255, 255, 255, 0.25);
    }
    .zthumb {
      position: absolute;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 22px;
      height: 16px;
      border-radius: 5px;
      background: var(--upc-accent, var(--primary-color, #03a9f4));
      box-shadow: 0 1px 5px rgba(0, 0, 0, 0.45);
      pointer-events: none;
    }
    .scrub {
      position: relative;
      flex: 1 1 auto;
      min-height: 140px;
      overflow: visible;
      /* Clip thumbnails to the track's TOP/BOTTOM so they roll out gradually
         (like the canvas ticks/bars), while the big negative left/right outset
         leaves the enlarged thumbnail free to overflow sideways over the video. */
      clip-path: inset(0 -100vw 0 -100vw);
      touch-action: none;
    }
    canvas {
      display: block;
      width: 100%;
      height: 100%;
      touch-action: none;
      cursor: grab;
      background: var(--upc-track-bg, var(--card-background-color, #111));
      border-radius: 8px;
    }
    /* Fullscreen overlay: the strip floats ON the video, so it brings no
       background of its own (the host supplies the scrim gradient). Everything
       it draws runs edge to edge over the picture, so without a mask it ends in
       a hard cut at the top and bottom; fade both ends out instead. The gradient
       is resolved ONCE on the host (so --upc-fs-fade is picked up from whichever
       host rule wins) and reused by every layer that has to fade in step: the
       ruler canvas and the thumbnail layer. (calc() sits in a LENGTH position
       here, not inside a color function, so it is safe on the old tablet
       WebView.) */
    :host([mirror]) {
      --upc-fs-fade: 60px;
      --upc-fade-mask: linear-gradient(
        to bottom,
        transparent 0,
        #000 var(--upc-fs-fade),
        #000 calc(100% - var(--upc-fs-fade)),
        transparent 100%
      );
    }
    /* Shorter fade on a phone — the ruler is a fraction of the short side of a
       rotated screen, so the tablet's band would eat a fifth of it at each end. */
    :host([mirror][compact]) {
      --upc-fs-fade: 20px;
    }
    /* Masking these two and not .scrub is deliberate — the LIVE pill, the zoom
       control and the jump-to-live arrow are siblings inside .scrub; the arrow
       rides 8px off its bottom edge, i.e. right in the fade band, and both round
       buttons sit OUTSIDE .scrub's box (negative right), which a mask would clip
       away entirely. */
    :host([mirror]) canvas,
    :host([mirror]) .evt-layer {
      -webkit-mask-image: var(--upc-fade-mask);
      mask-image: var(--upc-fade-mask);
    }
    :host([mirror]) canvas {
      background: transparent;
      border-radius: 0;
    }
    :host([mirror]) .col {
      gap: 0;
    }
    :host([mirror]) .scrub {
      min-height: 0;
    }
    canvas:active {
      cursor: grabbing;
    }
    /* UniFi-style LIVE pill on the playhead while the live stream is showing.
       Anchored by --upc-pill-left (pillIndent), NOT --upc-indent: the timeline
       ruler can be shifted without dragging the pill along. */
    .live-pill {
      position: absolute;
      left: calc(4px + var(--upc-pill-left, 0px));
      transform: translateY(-50%);
      /* The DEEP accent, matching the overlay. The plain accent is tuned for
         thin lines on the ruler; behind white text it is too bright to read. */
      background: var(--upc-accent-deep, var(--upc-accent, var(--primary-color, #03a9f4)));
      color: #fff;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.5px;
      padding: 3px 12px;
      border-radius: 7px;
      pointer-events: none;
      /* Anchored by its RIGHT edge inside a narrow column, so without this a
         clock time wraps onto two lines instead of overhanging to the left. */
      white-space: nowrap;
      z-index: 5;
      box-shadow: 0 1px 5px rgba(0, 0, 0, 0.45);
      /* Fade in when it first appears (e.g. switching back to Timeline) rather
         than snapping in — it's only rendered once the canvas height is
         measured, so it never flashes at the top first. */
      animation: upc-pill-in 0.35s ease both;
    }
    /* Same pill, off the live edge: the playhead's clock time. Identical accent
       to LIVE — it is the same marker in another state, and swapping its color
       under you reads as a different control. Tabular figures so the seconds
       ticking over don't jiggle its width. */
    :host([mirror]) .live-pill.at-time {
      font-size: 16px;
      letter-spacing: 0.2px;
    }
    /* Tabular figures everywhere the pill shows a clock: without them the
       seconds ticking over jiggle its width, and the swell below makes any
       jitter far more obvious. */
    .live-pill.at-time {
      font-variant-numeric: tabular-nums;
    }
    /* The swell itself lives further down, after every other pill rule — see
       "PILL SWELL". Putting it here would lose to the [mirror] and
       [mirror][compact] sizes, which are more specific or simply later. */
    /* Phone: the strip is a fraction of the short side of a rotated screen, and
       the picture is held at arm's length — scale the chrome down to match. */
    :host([mirror][compact]) .live-pill {
      font-size: 13px;
      padding: 4px 11px;
      border-radius: 8px;
    }
    :host([mirror][compact]) .live-pill.at-time {
      font-size: 14px;
    }
    :host([mirror][compact]) .live-arrow,
    :host([mirror][compact]) .zoom-fab {
      width: 38px;
      height: 38px;
    }
    :host([mirror][compact]) .live-arrow {
      font-size: 19px;
    }
    :host([mirror][compact]) .zoom-fab ha-icon {
      --mdc-icon-size: 21px;
    }
    /* Phone-sized flyout — shorter than the tablet's, since it has to fit a
       rotated phone's short side. The compact flag is set for the whole phone
       layout, not just its overlay, so the card column gets the same control. */
    :host([compact]) .zoom-panel {
      height: 206px;
    }
    @keyframes upc-pill-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
    /* "Camera offline" tip shown while hovering an unavailable-footage gap
       (UniFi's "Lost wired connection" tooltip). Anchored right of the track at
       the gap's vertical center. */
    .gap-tip {
      position: absolute;
      left: calc(${EVENT_X0}px + var(--upc-indent, 0px));
      transform: translateY(-50%);
      background: rgba(0, 0, 0, 0.82);
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.3;
      padding: 5px 9px;
      border-radius: 6px;
      white-space: nowrap;
      pointer-events: none;
      z-index: 8;
      box-shadow: 0 1px 5px rgba(0, 0, 0, 0.5);
    }
    .gap-tip .gap-sub {
      font-weight: 400;
      opacity: 0.85;
    }
    /* The thumbnails get their own layer purely so the overlay can fade them
       with the SAME mask as the ruler: masking each thumbnail individually would
       fade every picture into itself, where what's wanted is a fade by POSITION
       on the strip. The layer is the exact box .scrub is, so every .evt keeps its
       containing block, offsets and animations unchanged. Transparent to
       hit-testing — gestures are bound to .scrub and .evt-wrap opts back in. */
    .evt-layer {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    /* Only the overlay's mask makes this a stacking context, so the card column
       keeps .evt's own z-indexes exactly as they were. 4 is .evt's base: it holds
       the whole layer above the LIVE pill (3) and below the gap tip (8) and the
       round buttons (9/10) — where the thumbnails already sat. */
    :host([mirror]) .evt-layer {
      z-index: 4;
    }
    /* Inline event thumbnail: dot (on the track, canvas) — line — image.
       The image itself is interactive (hover), but drag/scroll bubble to .scrub
       so scrolling over a thumbnail still pans the timeline. */
    .evt {
      position: absolute;
      left: calc(${EVENT_X0}px + var(--upc-indent, 0px));
      transform: translateY(-50%);
      display: flex;
      align-items: center;
      pointer-events: none;
      z-index: 4;
    }
    .evt-line {
      width: 14px;
      height: 2px;
      flex: 0 0 auto;
      background: var(--upc-accent, var(--primary-color, #03a9f4));
      opacity: 0.6;
    }
    .evt-wrap {
      position: relative;
      pointer-events: auto;
    }
    .evt-thumb {
      width: var(--upc-thumb-w, 79px);
      height: calc(var(--upc-thumb-w, 79px) * 0.75); /* 4:3, explicit so it animates */
      object-fit: cover;
      border-radius: 5px;
      background: #000;
      display: block;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
      border: 1.5px solid transparent;
      will-change: width, height;
      /* Modern decelerate (easeOutQuint): width AND height ease together for a
         smooth proportional grow/shrink on hover or under the playhead. */
      transition:
        width 0.26s cubic-bezier(0.22, 1, 0.36, 1),
        height 0.26s cubic-bezier(0.22, 1, 0.36, 1),
        border-color 0.2s ease,
        box-shadow 0.26s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .evt-ph {
      background: var(--upc-accent, var(--primary-color, #03a9f4));
      opacity: 0.5;
    }
    /* Enlarge when the event is under the playhead or hovered. */
    .evt.active .evt-thumb,
    .evt.hovered .evt-thumb {
      width: var(--upc-thumb-w-lg, 115px);
      height: calc(var(--upc-thumb-w-lg, 115px) * 0.75);
      border-color: var(--upc-accent, var(--primary-color, #03a9f4));
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.7);
    }
    .evt.active,
    .evt.hovered {
      z-index: 7;
    }
    /* MIRRORED: everything that is anchored LEFT of the track in the normal
       layout hangs off the RIGHT edge instead (--upc-evt-right, measured in
       _draw), and the event's connector line runs from the thumbnail rightward
       toward the track. */
    :host([mirror]) .evt,
    :host([mirror]) .gap-tip {
      left: auto;
      right: var(--upc-evt-right, ${EVENT_X0}px);
    }
    :host([mirror]) .evt {
      flex-direction: row-reverse;
    }
    /* Bigger pill in the overlay — it is read across a room, not at desk
       distance like the card's own column. It rides at --upc-pill-right, which
       steps further left when a thumbnail shares its row (see _pillDodge). */
    :host([mirror]) .live-pill {
      left: auto;
      right: var(--upc-pill-right, ${EVENT_X0}px);
      font-size: 15px;
      padding: 5px 14px;
      border-radius: 9px;
      /* Under every thumbnail (which sit at 4, or 7 while active/hovered): the
         dodge keeps them apart, and if they ever do meet, the picture wins. */
      z-index: 3;
      background: var(--upc-accent-deep, var(--upc-accent, var(--primary-color, #03a9f4)));
      /* iOS-style: overshoots a touch and settles, rather than easing flatly. */
      transition: right 0.3s cubic-bezier(0.3, 1.8, 0.5, 1);
    }
    /* The playhead line continues from the pill back to the ruler, however far
       out the pill has stepped: the canvas draws it across the strip, this
       covers the rest. Same accent + thickness, so the join is invisible. */
    :host([mirror]) .live-pill::after {
      content: '';
      position: absolute;
      left: 100%;
      top: 50%;
      width: var(--upc-pill-right, 0px);
      height: 3px;
      transform: translateY(-50%);
      background: var(--upc-accent, var(--primary-color, #03a9f4));
      /* Must match the pill's transition exactly or the line lags behind it. */
      transition: width 0.3s cubic-bezier(0.3, 1.8, 0.5, 1);
    }
    /* ---- PILL SWELL --------------------------------------------------------
       While the ruler is MOVING under the user — drag, flick glide, thumbnail
       seek, skip-button glide — the pill grows to what the on-video timestamp
       used to be. That stamp is gone: on a phone and on a small tablet the
       control bar sat right on top of it, and the pill already says the same
       thing. So this is now the ONLY readout of the moment being scrubbed to,
       and it has to be legible at arm's length.
       In the overlay it grows to the LEFT (it is right-anchored) — away from
       the screen edge and out over the video, which .scrub's negative inset
       clip-path already allows, so nothing clips and no offset has to change.
       Padding and radius scale with the text so the pill stays wrapped around
       it, and every property eases on the pill's own overshoot-and-settle
       curve. Must come after ALL the size rules above: [mirror] and
       [mirror][compact] would otherwise win on specificity or order. */
    .live-pill {
      transition:
        font-size 0.3s cubic-bezier(0.3, 1.8, 0.5, 1),
        padding 0.3s cubic-bezier(0.3, 1.8, 0.5, 1),
        border-radius 0.3s cubic-bezier(0.3, 1.8, 0.5, 1);
    }
    :host([mirror]) .live-pill {
      transition:
        right 0.3s cubic-bezier(0.3, 1.8, 0.5, 1),
        font-size 0.3s cubic-bezier(0.3, 1.8, 0.5, 1),
        padding 0.3s cubic-bezier(0.3, 1.8, 0.5, 1),
        border-radius 0.3s cubic-bezier(0.3, 1.8, 0.5, 1);
    }
    /* The card column is narrower than the overlay, so it takes a smaller
       swell — big enough to read while dragging without overrunning the
       column's width. */
    .live-pill.big,
    .live-pill.at-time.big {
      font-size: 20px;
      padding: 6px 15px;
      border-radius: 11px;
    }
    /* Fullscreen, phone and tablet alike: exactly the 26px the stage timestamp
       used to be. */
    :host([mirror]) .live-pill.big,
    :host([mirror]) .live-pill.at-time.big,
    :host([mirror][compact]) .live-pill.big,
    :host([mirror][compact]) .live-pill.at-time.big {
      font-size: 26px;
      padding: 8px 18px;
      border-radius: 13px;
    }
    /* Fullscreen overlay: the zoom control and the jump-to-live arrow share the
       clear lane between the ruler and the screen edge — zoom at the top, arrow
       at the bottom, both centered in it (--upc-fab-right is negative: they sit
       OUTSIDE the ruler's own box). */
    /* Level with the playhead pill rather than at the top of the strip, so the
       two controls read as one row across the timeline; the flyout opens
       downward from there. */
    :host([mirror]) .zoom-fab,
    :host([mirror]) .zoom-panel {
      right: var(--upc-fab-right, 8px);
      top: calc(var(--upc-ph-y, 36px) - 22px);
    }
    :host([mirror][compact]) .zoom-fab,
    :host([mirror][compact]) .zoom-panel {
      top: calc(var(--upc-ph-y, 33px) - 19px);
    }
    :host([mirror]) .zoom-fab {
      background: var(--upc-accent-deep, var(--upc-accent, var(--primary-color, #03a9f4)));
    }
    :host([mirror]) .live-arrow {
      position: absolute;
      right: var(--upc-fab-right, 8px);
      bottom: 8px;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 22px;
      line-height: 1;
      /* Accent, like the LIVE pill it takes you back to — not the card's dark
         --upc-arrow, which is meant to read against the timeline column. */
      background: var(--upc-accent-deep, var(--upc-accent, var(--primary-color, #03a9f4)));
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
      z-index: 10;
      -webkit-tap-highlight-color: transparent;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    // HA caches views: navigating away DISCONNECTS this element (teardown in
    // disconnectedCallback removes the gesture listeners + ResizeObserver), and
    // returning RECONNECTS the same element WITHOUT re-running firstUpdated. So
    // re-initialise here — otherwise scrubbing silently stops working after a
    // back-and-forth until a re-render (e.g. toggling Timeline/Events) recreates
    // the element. (hasUpdated is false on the very first connect; firstUpdated
    // handles that.)
    if (this.hasUpdated) this._setup();
  }

  protected firstUpdated(): void {
    this._setup();
  }

  /** (Re)bind gestures + ResizeObserver and measure. Safe to call repeatedly. */
  private _setup(): void {
    if (!this._canvas) return;
    this._setupTs = performance.now();
    this._dpr = window.devicePixelRatio || 1;
    this._ro?.disconnect();
    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(this._canvas);
    this._bindPointer();
    this._resize();
    // The first measurement can land mid-layout (view just switched / re-shown).
    // Re-measure once layout settles so the canvas backing store matches its
    // final box (a stale size breaks hit-testing and draws at the wrong scale).
    requestAnimationFrame(() => requestAnimationFrame(() => this._resize()));
  }

  private static _redrawProps = [
    'domain',
    'bands',
    'gaps',
    'gapColor',
    'now',
    'fontSize',
    'fontColor',
    'tickColor',
    'tickSize',
    'accentColor',
    'recordedColor',
    'futureColor',
    'indent',
  ];

  protected updated(changed: PropertyValues): void {
    if (ScrubberTimeline._redrawProps.some((p) => changed.has(p))) {
      this._scheduleDraw();
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    const el = this._scrubEl;
    if (el) {
      el.removeEventListener('pointerdown', this._onPointerDown);
      el.removeEventListener('pointermove', this._onPointerMove);
      el.removeEventListener('pointerup', this._onPointerUp);
      el.removeEventListener('pointercancel', this._onPointerUp);
      el.removeEventListener('pointerleave', this._onPointerLeave);
      el.removeEventListener('wheel', this._onWheel);
    }
    this._ro?.disconnect();
    cancelAnimationFrame(this._frame);
    cancelAnimationFrame(this._animRaf);
    this._cancelMomentum();
    this._cancelSeek();
    window.removeEventListener('pointerdown', this._outsideZoomClose, true);
  }

  // ---- geometry -----------------------------------------------------------

  // The domain used for drawing — equals `domain`, except mid zoom-animation
  // when it's the interpolated value, so labels/events glide to their new spots.
  private get _dd(): TimeDomain {
    return this._animDomain ?? this.domain;
  }

  private _timeToY(t: number): number {
    const span = spanOf(this._dd) || 1;
    return ((this._dd.end - t) / span) * this._height;
  }

  private _yToTime(y: number): number {
    const span = spanOf(this._dd) || 1;
    return this._dd.end - (y / (this._height || 1)) * span;
  }

  private get _playheadY(): number {
    return this._height * this.playheadFrac;
  }

  // ---- gestures -----------------------------------------------------------

  private _bindPointer(): void {
    // Bind to the .scrub container (not the canvas) so gestures also work when
    // the cursor is over a thumbnail (and over the part overflowing the video).
    const el = this._scrubEl;
    if (!el) return;
    // Remove first so re-setup (cached-view reconnect) never double-binds.
    el.removeEventListener('pointerdown', this._onPointerDown);
    el.removeEventListener('pointermove', this._onPointerMove);
    el.removeEventListener('pointerup', this._onPointerUp);
    el.removeEventListener('pointercancel', this._onPointerUp);
    el.removeEventListener('pointerleave', this._onPointerLeave);
    el.removeEventListener('wheel', this._onWheel);
    el.addEventListener('pointerdown', this._onPointerDown);
    el.addEventListener('pointermove', this._onPointerMove);
    el.addEventListener('pointerup', this._onPointerUp);
    el.addEventListener('pointercancel', this._onPointerUp);
    el.addEventListener('pointerleave', this._onPointerLeave);
    el.addEventListener('wheel', this._onWheel, { passive: false });
  }

  private _refreshRect(): void {
    this._rect = this._scrubEl.getBoundingClientRect();
  }

  /** A pointer's position along the element's OWN vertical axis (px from its
   *  top edge) — the only axis every gesture below cares about.
   *  When `rotated`, the player is CSS-rotated 90°: local (x, y) paints at
   *  screen (−y, x), so the finger's perceived-vertical motion arrives as
   *  clientX and local y grows leftward from the transformed box's right edge.
   *  The rotation is exactly 90°, so the axis-aligned client rect is exact. */
  private _localY(e: { clientX: number; clientY: number }): number {
    const r = this._rect;
    if (!r) return 0;
    return this.rotated ? r.right - e.clientX : e.clientY - r.top;
  }

  /** The kept thumbnail whose rendered box contains a pointer, if any.
   *  Hit-tested against the LIVE DOM rects rather than re-deriving the
   *  thumbnail geometry here: that stays exact in the mirrored layout, at the
   *  enlarged size, and inside the CSS-rotated mobile player (a 90° rotation
   *  leaves the axis-aligned client rect exact). Only on-screen thumbs exist,
   *  so this walks a handful of nodes. */
  private _thumbAt(e: { clientX: number; clientY: number }): KeptThumb | undefined {
    const wraps = this.renderRoot.querySelectorAll<HTMLElement>('.evt-wrap');
    for (const el of wraps) {
      const r = el.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right) continue;
      if (e.clientY < r.top || e.clientY > r.bottom) continue;
      const key = el.dataset.key;
      const k = this._kept.find((x) => thumbKey(x.m) === key);
      if (k) return k;
    }
    return undefined;
  }

  private _nearestEvent(canvasY: number): { hit: EventHit; dist: number } | undefined {
    let best: EventHit | undefined;
    let bestDist = Infinity;
    for (const h of this._hits) {
      const d = canvasY < h.yTop ? h.yTop - canvasY : canvasY > h.yBot ? canvasY - h.yBot : 0;
      if (d < bestDist) {
        bestDist = d;
        best = h;
      }
    }
    return best ? { hit: best, dist: bestDist } : undefined;
  }

  private _onPointerDown = (e: PointerEvent): void => {
    const el = this._scrubEl;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* pointer already gone — the drag/tap logic below still works */
    }
    this._refreshRect();
    // Grabbing the timeline stops any in-flight glide (flick or event seek).
    this._cancelMomentum();
    this._cancelSeek();
    this._velSamples = [];
    this._gestureScrubbed = false;
    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this._moved = false;
    this._hoverBand = undefined;
    this._hoverGap = undefined;
    // Single-finger / mouse drag = scroll. Only the first pointer drives it;
    // extra fingers are ignored (zoom is buttons only).
    if (this._pointers.size === 1) {
      this._dragStartY = this._localY(e);
      this._dragStartDomain = { ...this.domain };
      this._gestureStarted = false; // scrub-start waits for actual motion
    }
  };

  private _onPointerMove = (e: PointerEvent): void => {
    if (this._pointers.size === 0) {
      this._updateHover(e);
      return;
    }
    if (!this._pointers.has(e.pointerId)) return;
    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this._pointers.size !== 1 || !this._dragStartDomain) return;

    // Everything below works in the element's own vertical axis (see _localY).
    const localY = this._localY(e);
    const dy = localY - this._dragStartY;
    if (Math.abs(dy) > 2) this._moved = true;
    // A scrub starts at the first MOTION, not at the press. The fullscreen
    // overlay covers the whole player, so every tap on the video lands here —
    // announcing a scrub on pointer-down would tear playback down and rebuild
    // it (a black flash) for what turns out to be a tap on the controls.
    if (this._moved && !this._gestureStarted) {
      this._gestureStarted = true;
      this._scrubOpen = true;
      this._syncPillBig();
      this.dispatchEvent(new CustomEvent('scrub-start', { bubbles: true, composed: true }));
    }
    // Trailing position window -> release velocity for the flick glide.
    const nowMs = performance.now();
    this._velSamples.push({ t: nowMs, y: localY });
    while (this._velSamples.length > 1 && nowMs - this._velSamples[0].t > VEL_WINDOW_MS) {
      this._velSamples.shift();
    }
    const span = spanOf(this._dragStartDomain);
    const deltaT = (dy / (this._height || 1)) * span; // drag down = newer, up = older
    let d = {
      start: this._dragStartDomain.start + deltaT,
      end: this._dragStartDomain.end + deltaT,
    };
    const h = this._height || 1;
    const over = playheadTimeOf(d, this.playheadFrac) - this.now;
    if (over > 0) {
      // Past the live edge: rubber-band (compressed overshoot, springs back on
      // release). While the gesture is pinned here and has never scrubbed into
      // the past, NO scrub events fire — pushing "into the future" from live
      // must not interrupt live playback.
      const overPx = (over / span) * h;
      const rubberPx = (RUBBER_MAX_PX * overPx) / (overPx + RUBBER_MAX_PX);
      const allowT = (rubberPx / h) * span;
      const shift = over - allowT;
      d = { start: d.start - shift, end: d.end - shift };
      this._setDomain(d, allowT);
      if (!this._gestureScrubbed) return;
    } else {
      this._setDomain(d);
      this._gestureScrubbed = true;
    }
    this.dispatchEvent(
      new CustomEvent('scrub', {
        detail: { time: Math.min(playheadTimeOf(this.domain, this.playheadFrac), this.now) },
        bubbles: true,
        composed: true,
      }),
    );
  };

  private _onPointerUp = (e: PointerEvent): void => {
    if (!this._pointers.has(e.pointerId)) return;
    const wasMulti = this._pointers.size >= 2;
    this._pointers.delete(e.pointerId);
    try {
      this._scrubEl.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    if (this._pointers.size === 1) {
      const remaining = [...this._pointers.values()][0];
      this._dragStartY = this._localY({ clientX: remaining.x, clientY: remaining.y });
      this._dragStartDomain = { ...this.domain };
      return;
    }
    if (this._pointers.size === 0) {
      this._dragStartDomain = undefined;
      if (!this._moved && !wasMulti) {
        // A tap never moves this timeline — scrolling does. Taps belong to the
        // things ON it (an event's thumbnail) and, in the fullscreen overlay
        // which spans the whole player, to the video underneath: report it and
        // let the host decide. No scrub was started (see _onPointerMove), so
        // there is nothing to cancel here either.
        // A thumbnail never swallows the press (a drag starting on one still
        // has to scrub), so a tap that landed on one is resolved here: wind the
        // timeline to that event's start.
        const k = this._thumbAt(e);
        if (k) {
          // _seekTo opens and closes its own session, so a stale one left by an
          // interrupted glide is superseded rather than leaked.
          this._seekTo(k.m.start);
          return;
        }
        // ...but a tap that lands on nothing has no session of its own, and it
        // may just have INTERRUPTED one: _onPointerDown cancels an in-flight
        // glide (flick momentum or an event seek) silently, and that glide's
        // deferred scrub-end dies with it. Close it here, at wherever the
        // playhead was stopped — exactly what letting the glide settle does.
        // Leaving it open wedges the card in scrub mode for good: the stage
        // keeps showing the frozen preview frame instead of resuming playback,
        // and every `scrubbing`-keyed transition stops firing, including the
        // media-slot release, so the <video> pairs start leaking again.
        if (this._scrubOpen) this._emitScrubEnd();
        this.dispatchEvent(new CustomEvent('tap-through', { bubbles: true, composed: true }));
        return;
      }
      // Spring back from any rubber-band overshoot to the live edge.
      if (playheadTimeOf(this.domain, this.playheadFrac) > this.now) {
        this._animateFrom({ ...this.domain }, this._applyDomain(domainForPlayhead(this.now, spanOf(this.domain), this.playheadFrac)));
      }
      if (!this._gestureScrubbed) {
        // The whole gesture stayed pinned at the live edge — nothing was
        // scrubbed and live playback never stopped. Tell the card to drop its
        // scrub state; no momentum, no scrub-end.
        this._velSamples = [];
        this._scrubOpen = false;
        this._syncPillBig();
        this.dispatchEvent(new CustomEvent('scrub-cancel', { bubbles: true, composed: true }));
        return;
      }
      // Fast release -> glide with momentum; scrub-end is deferred until the
      // glide stops (the card keeps showing the scrub timestamp meanwhile).
      const v = this._releaseVelocity();
      if (!wasMulti && Math.abs(v) >= FLICK_MIN_PXS) {
        this._startMomentum(v);
        return;
      }
      this._emitScrubEnd();
    }
  };

  // ---- flick momentum -------------------------------------------------------

  /** Average pointer velocity (px/s, clientY direction) over the trailing
   *  sample window at release. 0 when the finger paused before lifting. */
  private _releaseVelocity(): number {
    const s = this._velSamples;
    this._velSamples = [];
    if (s.length < 2) return 0;
    const dt = s[s.length - 1].t - s[0].t;
    if (dt < 20) return 0;
    return ((s[s.length - 1].y - s[0].y) / dt) * 1000;
  }

  /** iOS-style inertia: keep panning in the flick direction, velocity decaying
   *  exponentially (tau ~325ms), emitting `scrub` per frame. Ends (and emits
   *  `scrub-end`) when slow enough or when the playhead hits the live edge. */
  private _startMomentum(v: number): void {
    this._momentumV = Math.max(-MOMENTUM_MAX_PXS, Math.min(MOMENTUM_MAX_PXS, v));
    this._momentumLast = performance.now();
    const step = (now: number): void => {
      const dt = Math.min(0.1, (now - this._momentumLast) / 1000); // clamp hiccups
      this._momentumLast = now;
      this._panByPixels(this._momentumV * dt);
      // Draw synchronously (like the zoom animation): _scheduleDraw's rAF would
      // be CANCELLED by this loop's own next-frame reschedule before it ever
      // ran, leaving the canvas frozen for the whole glide.
      this._draw();
      this.dispatchEvent(
        new CustomEvent('scrub', {
          detail: { time: playheadTimeOf(this.domain, this.playheadFrac) },
          bubbles: true,
          composed: true,
        }),
      );
      this._momentumV *= Math.exp(-dt / MOMENTUM_TAU_S);
      // Positive v pans toward now; the domain clamps at the live edge, so
      // gliding against the clamp would just spin — stop there.
      const atLiveEdge = this._momentumV > 0 && playheadTimeOf(this.domain, this.playheadFrac) >= this.now - 250;
      if (Math.abs(this._momentumV) < MOMENTUM_STOP_PXS || atLiveEdge) {
        this._momentumRaf = 0;
        this._emitScrubEnd();
        return;
      }
      this._momentumRaf = requestAnimationFrame(step);
    };
    cancelAnimationFrame(this._momentumRaf);
    this._momentumRaf = requestAnimationFrame(step);
  }

  private _cancelMomentum(): void {
    if (!this._momentumRaf) return;
    cancelAnimationFrame(this._momentumRaf);
    this._momentumRaf = 0;
  }

  // ---- animated seek --------------------------------------------------------

  /** Wind the timeline to `t` and play the footage there — the tap-an-event
   *  gesture of the fullscreen overlay. Deliberately NOT a domain swap: the
   *  ruler SCROLLS to the moment (easing out, like a flick that lands on it),
   *  and the whole way it emits the same scrub-start / scrub / scrub-end stream
   *  a finger would, so the preview follows the motion and the footage loads
   *  once it settles. Snapping the domain instead read as a hard cut — you
   *  couldn't see which way, or how far, the timeline had gone.
   *  Per-frame draws are SYNCHRONOUS: _scheduleDraw's rAF would be cancelled by
   *  this loop's own next-frame request before it ever ran (same trap as the
   *  momentum glide). */
  private _seekTo(t: number): void {
    this._cancelMomentum();
    this._cancelSeek();
    cancelAnimationFrame(this._animRaf);
    this._animDomain = undefined;
    const from = playheadTimeOf(this.domain, this.playheadFrac);
    const to = Math.min(t, this.now);
    this._scrubOpen = true;
    this._syncPillBig();
    this.dispatchEvent(new CustomEvent('scrub-start', { bubbles: true, composed: true }));
    const t0 = performance.now();
    const step = (now: number): void => {
      const k = Math.min(1, (now - t0) / SEEK_MS);
      const e = 1 - Math.pow(1 - k, 3); // easeOutCubic — matches the zoom glide
      this._applyDomain(domainForPlayhead(from + (to - from) * e, spanOf(this.domain), this.playheadFrac));
      this._draw();
      this.dispatchEvent(
        new CustomEvent('scrub', {
          detail: { time: Math.min(playheadTimeOf(this.domain, this.playheadFrac), this.now) },
          bubbles: true,
          composed: true,
        }),
      );
      if (k < 1) {
        this._seekRaf = requestAnimationFrame(step);
        return;
      }
      this._seekRaf = 0;
      this._emitScrubEnd();
    };
    this._seekRaf = requestAnimationFrame(step);
  }

  /** Drop an in-flight seek glide (a new gesture always wins over it). */
  private _cancelSeek(): void {
    if (!this._seekRaf) return;
    cancelAnimationFrame(this._seekRaf);
    this._seekRaf = 0;
  }

  private _onPointerLeave = (): void => {
    // Clear track-hover when leaving the canvas. If the cursor is moving onto a
    // thumbnail, its mouseenter fires next and re-sets the hover.
    if (this._pointers.size === 0) {
      this._clearHover();
      this._hoverGap = undefined;
    }
  };

  // Wheel / two-finger trackpad = scroll the timeline (NOT zoom). Matches the
  // drag feel: content follows the gesture.
  private _onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this._cancelMomentum(); // wheel takes over from any in-flight glide
    this._cancelSeek();
    const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY; // lines -> px
    const phBefore = playheadTimeOf(this.domain, this.playheadFrac);
    this._panByPixels(-px);
    // Wheeling "into the future" while already AT the live edge (and no wheel
    // scrub session in flight): stay pinned, keep live playing, emit nothing —
    // the wheel counterpart of the drag rubber-band.
    if (px < 0 && phBefore >= this.now - 50 && !this._scrubEndTimer) return;
    this.dispatchEvent(
      new CustomEvent('scrub', {
        detail: { time: Math.min(playheadTimeOf(this.domain, this.playheadFrac), this.now) },
        bubbles: true,
        composed: true,
      }),
    );
    this._holdPillBig();
    this._debouncedScrubEnd();
  };

  private _panByPixels(dy: number): void {
    const span = spanOf(this.domain);
    const deltaT = (dy / (this._height || 1)) * span;
    this._setDomain({ start: this.domain.start + deltaT, end: this.domain.end + deltaT });
  }

  private _debouncedScrubEnd(): void {
    clearTimeout(this._scrubEndTimer);
    // Cleared on fire: a truthy _scrubEndTimer means "wheel scrub session in
    // flight" (the live-edge suppression in _onWheel keys off it).
    this._scrubEndTimer = setTimeout(() => {
      this._scrubEndTimer = undefined;
      this._emitScrubEnd();
    }, 500);
  }

  private _updateHover(e: { clientX: number; clientY: number }): void {
    this._refreshRect();
    const canvasY = this._localY(e);
    const near = this._nearestEvent(canvasY);
    const band = near && near.dist <= HOVER_PX ? near.hit.band : undefined;
    // Track hits are display GROUPS; the thumbnail that enlarges is the group's
    // nearest VISIBLE (kept) one — hovering never resurrects a hidden thumb.
    const member = band ? this._nearestKeptMember(band, this._yToTime(canvasY)) : undefined;
    if (member) {
      this._setHover(member);
      if (this._hoverGap) this._hoverGap = undefined; // an event wins over a gap tip
      return;
    }
    if (this._hoverBand) this._clearHover();
    this._updateGapHover(canvasY); // no event under the cursor — try an offline span
  }

  /** The group's kept (visible) member nearest to time t, if any. */
  private _nearestKeptMember(g: DetectionBand, tt: number): DetectionBand | undefined {
    let best: DetectionBand | undefined;
    let bestD = Infinity;
    for (const k of this._kept) {
      if (k.g !== g) continue;
      const d = tt < k.m.start ? k.m.start - tt : tt > k.m.end ? tt - k.m.end : 0;
      if (d < bestD) {
        bestD = d;
        best = k.m;
      }
    }
    return best;
  }

  /** Show the "camera offline" tip when the cursor is over an unavailable span. */
  private _updateGapHover(canvasY: number): void {
    let hit: { gap: FootageGap; yTop: number; yBot: number } | undefined;
    for (const g of this._gapHits) {
      if (canvasY >= g.yTop - 3 && canvasY <= g.yBot + 3) {
        hit = g;
        break;
      }
    }
    if (hit) {
      if (this._hoverGap?.gap !== hit.gap) {
        this._hoverGap = { gap: hit.gap, y: (hit.yTop + hit.yBot) / 2 };
      }
    } else if (this._hoverGap) {
      this._hoverGap = undefined;
    }
  }

  private _setHover = (band: DetectionBand): void => {
    this._hoverBand = band;
    this.loader?.get(band); // ensure its snapshot is loading/cached
  };

  private _clearHover = (): void => {
    this._hoverBand = undefined;
  };

  private _zoomStep(dir: 1 | -1): void {
    const newSpan = nextSpanStep(spanOf(this.domain), dir);
    this._setSpan(newSpan);
  }

  private _setSpan(span: number): void {
    // Commit the new span immediately (playhead time unchanged → no video
    // reload), but animate the visual from the old span to the new one so the
    // labels/events glide and you can see where you landed.
    // `zoom-change` marks this as a DELIBERATE zoom (vs. a pan or a resize), so
    // a host can tell a user's choice from its own bookkeeping.
    this.dispatchEvent(new CustomEvent('zoom-change', { bubbles: true, composed: true }));
    // Zooming mid-glide would fight the zoom animation.
    this._cancelMomentum();
    this._cancelSeek();
    const from = this._animDomain ?? { ...this.domain };
    const to = this._applyDomain(domainForPlayhead(playheadTimeOf(this.domain, this.playheadFrac), span, this.playheadFrac));
    this._animateFrom(from, to);
  }

  /** Glide the ruler between two domains without touching the scrub stream —
   *  the HOST calls this when the footage POSITION jumps rather than advances
   *  (the 15s skip buttons), so the ruler scrolls to the new time the same way
   *  tapping an event thumbnail does instead of teleporting. Declined while a
   *  gesture owns the ruler: the finger, a glide or a seek must always win. */
  glideDomain(from: TimeDomain, to: TimeDomain, holdMs = SEEK_MS): void {
    if (this._scrubOpen || this._seekRaf || this._momentumRaf) return;
    this._holdPillBig(holdMs);
    this._animateFrom(from, to, SEEK_MS);
  }

  private _animateFrom(from: TimeDomain, to: TimeDomain, dur = 170): void {
    cancelAnimationFrame(this._animRaf);
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3); // easeOutCubic
      this._animDomain = {
        start: from.start + (to.start - from.start) * e,
        end: from.end + (to.end - from.end) * e,
      };
      this._draw();
      this.requestUpdate(); // keep DOM thumbnails gliding with the canvas
      if (k < 1) {
        this._animRaf = requestAnimationFrame(tick);
      } else {
        this._animDomain = undefined;
        this._draw();
        this.requestUpdate();
      }
    };
    this._animRaf = requestAnimationFrame(tick);
  }

  private _zoomIn = (): void => this._zoomStep(-1);
  private _zoomOut = (): void => this._zoomStep(1);

  // Slider value 0..N-1 maps 0=zoomed-out (widest span) -> N-1=zoomed-in.
  private get _sliderValue(): number {
    const span = spanOf(this.domain);
    let nearest = 0;
    let best = Infinity;
    SPAN_STEPS.forEach((s, i) => {
      const d = Math.abs(s - span);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    return SPAN_STEPS.length - 1 - nearest;
  }

  // ---- collapsible zoom flyout ---------------------------------------------

  /** Capture-phase window listener, live only while the flyout is open. Any
   *  pointerdown whose composed path doesn't include the panel closes it —
   *  composedPath crosses the shadow boundary, so in-panel taps are safe.
   *  The closing tap is SWALLOWED entirely (down + up + click): it must only
   *  close the flyout, never also seek the timeline or hit what's under it. */
  private _outsideZoomClose = (e: PointerEvent): void => {
    const panel = this.renderRoot.querySelector('.zoom-panel');
    if (panel && e.composedPath().includes(panel)) return;
    e.preventDefault();
    e.stopPropagation();
    swallowNextTap();
    this._closeZoom();
  };

  private _openZoom = (): void => {
    if (this._zoomOpen) return;
    this._zoomOpen = true;
    // Safe to add during the opening tap's dispatch: its window CAPTURE phase
    // has already run, so this listener only sees the NEXT pointerdown.
    window.addEventListener('pointerdown', this._outsideZoomClose, true);
  };

  private _closeZoom(): void {
    this._zoomOpen = false;
    window.removeEventListener('pointerdown', this._outsideZoomClose, true);
  }

  // Vertical slider drag state (the flyout's custom slider — native vertical
  // range inputs are unreliable on iOS Safari, so it's pointer-driven).
  private _zoomDragging = false;

  /** Map a pointer y on the .zslider to a SPAN_STEPS index and apply it.
   *  Top = most zoomed in (narrowest span), bottom = most zoomed out.
   *  In the CSS-rotated (mobile fullscreen) player the slider's own vertical
   *  axis runs along the screen's X, and its client rect reports that axis as
   *  WIDTH — reading clientY there mapped a 44px axis onto the whole range and
   *  ran backwards. Same mapping as _localY. */
  private _zoomSliderFromEvent(e: PointerEvent): void {
    const el = this.renderRoot.querySelector('.zslider');
    if (!el) return;
    const r = el.getBoundingClientRect();
    const inset = 8; // matches the track line's top/bottom inset
    const len = this.rotated ? r.width : r.height;
    const pos = this.rotated ? r.right - e.clientX : e.clientY - r.top;
    const usable = Math.max(1, len - inset * 2);
    const f = Math.min(1, Math.max(0, (pos - inset) / usable));
    const v = Math.round((1 - f) * (SPAN_STEPS.length - 1));
    if (v === this._sliderValue) return; // step unchanged — don't restart the anim
    this._setSpan(SPAN_STEPS[SPAN_STEPS.length - 1 - v]);
  }

  // stopPropagation everywhere: the slider lives inside .scrub, whose own
  // pointer listeners would otherwise treat the drag as a timeline scrub.
  private _onZoomSliderDown = (e: PointerEvent): void => {
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* pointer already gone — the tap still lands below */
    }
    this._zoomDragging = true;
    this._zoomSliderFromEvent(e);
  };
  private _onZoomSliderMove = (e: PointerEvent): void => {
    e.stopPropagation();
    if (this._zoomDragging) this._zoomSliderFromEvent(e);
  };
  private _onZoomSliderUp = (e: PointerEvent): void => {
    e.stopPropagation();
    this._zoomDragging = false;
  };

  /** Commit a domain (clamped so the playhead can't pass `now` — plus an
   *  optional allowance for the rubber-band overshoot); no redraw. */
  private _applyDomain(d: TimeDomain, allowOver = 0): TimeDomain {
    const ph = playheadTimeOf(d, this.playheadFrac);
    if (ph > this.now + allowOver) {
      const shift = ph - (this.now + allowOver);
      d = { start: d.start - shift, end: d.end - shift };
    }
    this.domain = d;
    this.dispatchEvent(
      new CustomEvent('domain-change', { detail: d, bubbles: true, composed: true }),
    );
    return d;
  }

  /** Instant domain change (drag/wheel/tap): commit + redraw, cancel any anim. */
  private _setDomain(d: TimeDomain, allowOver = 0): void {
    cancelAnimationFrame(this._animRaf);
    this._animDomain = undefined;
    this._applyDomain(d, allowOver);
    this._scheduleDraw();
  }

  private _emitScrubEnd(): void {
    this._scrubOpen = false;
    this._syncPillBig();
    // Always play from wherever the playhead landed — no snapping to events.
    // Clamped to now: the domain may still be springing back from a rubber-band
    // overshoot when this fires.
    this.dispatchEvent(
      new CustomEvent('scrub-end', {
        detail: { time: Math.min(playheadTimeOf(this.domain, this.playheadFrac), this.now) },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // ---- rendering ----------------------------------------------------------

  private _resize(): void {
    const c = this._canvas;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    // Own size comes from the LAYOUT box, not the client rect: the mobile
    // fullscreen player is CSS-rotated 90°, and a rotated element's client rect
    // reports its bounding box — width and height SWAPPED. The rect is still
    // what pointer coordinates are relative to (see _localY), so keep both.
    const bw = c.clientWidth;
    const bh = c.clientHeight;
    // Ignore transient pre-layout measurements (popup opening, view switch,
    // page load). Drawing at a stale size and letting the backing store get
    // stretched to the real box is what made the tick labels flash "too big"
    // before settling — wait until we have a real size; the ResizeObserver
    // redraws once layout lands.
    if (bw < 1 || bh < 1) return;
    const prevH = this._height;
    this._width = bw;
    this._height = bh;
    this._rect = rect;
    this._dpr = window.devicePixelRatio || 1;
    // Viewport height changed (camera strip opened/closed, rotation): scale
    // the visible span by the same ratio so the px-per-ms zoom level stays
    // CONSTANT — the timeline gets clipped shorter, not squeezed. Skipped on
    // the first real measurement (prevH 0) and during the settle window right
    // after (re)mount, where transient mid-layout heights would otherwise
    // corrupt the configured initial zoom.
    const settled = performance.now() - this._setupTs > 500;
    if (settled && prevH > 0 && this.domain && Math.abs(bh - prevH) > 0.5) {
      const span = spanOf(this.domain) * (bh / prevH);
      const ph = playheadTimeOf(this.domain, this.playheadFrac);
      const end = ph + span * this.playheadFrac;
      this._applyDomain({ start: end - span, end });
    }
    c.width = Math.max(1, Math.round(bw * this._dpr));
    c.height = Math.max(1, Math.round(bh * this._dpr));
    // Draw synchronously: setting c.width/height clears + resizes the backing
    // store, so paint it in the SAME frame the box changed. The rAF path leaves
    // a blank/stretched intermediate frame, which reads as a font-size flicker
    // during open/resize transitions.
    this._draw();
    // The Lit template (LIVE pill + thumbnail positions) reads _height; re-render
    // once it's known so those land at the measured height instead of waiting
    // for the next prop tick — and so the height-gated LIVE pill appears promptly
    // (faded in) rather than briefly at top:0.
    if (prevH !== this._height) this.requestUpdate();
  }

  private _scheduleDraw(): void {
    cancelAnimationFrame(this._frame);
    this._frame = requestAnimationFrame(() => this._draw());
  }

  /** The x positions for one draw pass. Normal = the fixed left-anchored
   *  column; mirrored = the same parts anchored to the right edge, with the
   *  label column sized by the MEASURED label width so it adapts to
   *  timeline_font_size and to locales that render "19:30" vs "7:30 PM". */
  private _geo(labelW: number): Geo {
    if (!this.mirror) {
      return {
        labelRight: LABEL_RIGHT,
        tickRight: TICK_RIGHT,
        trackX0: TRACK_X0,
        trackX1: TRACK_X1,
        evtAnchor: EVENT_X0,
      };
    }
    const w = this._width || 1;
    const majorLen = Math.max(2, Math.min(this.tickSize + 5, 18));
    const tickRight = w - MIRROR_EDGE;
    const labelRight = tickRight - majorLen - MIRROR_TICK_GAP;
    const trackW = TRACK_X1 - TRACK_X0;
    const trackX1 = Math.max(trackW, labelRight - labelW - MIRROR_LABEL_GAP);
    const trackX0 = trackX1 - trackW;
    // Anchored from the host's RIGHT edge: the thumbnails hang outside the
    // strip, over the video.
    return { labelRight, tickRight, trackX0, trackX1, evtAnchor: w - trackX0 + MIRROR_EVT_GAP };
  }

  private _draw(): void {
    const c = this._canvas;
    if (!c || !this.domain) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    const w = this._width;
    const h = this._height;
    ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    // Shift the whole drawn timeline (labels/ticks/track/playhead/events) right
    // by `indent` (stacked layout) — the zoom slider/toggle live outside the
    // canvas and stay put. Thumbnails + LIVE pill are offset via --upc-indent.
    if (this.indent) ctx.translate(this.indent, 0);

    const cs = getComputedStyle(this);
    const textColor = cs.getPropertyValue('--secondary-text-color').trim() || '#9aa0a6';
    const trackColor = cs.getPropertyValue('--divider-color').trim() || 'rgba(255,255,255,0.12)';
    const accent =
      this.accentColor || cs.getPropertyValue('--primary-color').trim() || '#03a9f4';

    // The label font has to be set before anything else: the mirrored layout
    // sizes its label column from the MEASURED width of a real label.
    // Canvas font strings must be concrete — CSS var() is invalid and silently
    // makes the whole assignment fail (font stuck at default). Resolve the family.
    const fs = this.fontSize || 11;
    const fontFamily = cs.fontFamily || 'sans-serif';
    ctx.font = `${fs}px ${fontFamily}`;
    const geo = this._geo(
      this.mirror
        ? ctx.measureText(this._fmt(this._dd.end, { hour: '2-digit', minute: '2-digit' })).width
        : 0,
    );
    // The DOM overlays (thumbnails / LIVE pill / gap tip) follow the same
    // geometry; re-render when it moves (width or font change), never per frame.
    if (this._evtAnchor !== geo.evtAnchor) {
      this._evtAnchor = geo.evtAnchor;
      this.requestUpdate();
    }

    // Track: recorded (past, below now) + dimmer future (above now).
    const recordedCol = this.recordedColor || trackColor;
    const yNow = Math.max(0, Math.min(this._timeToY(this.now), h));
    const trackW = geo.trackX1 - geo.trackX0;
    if (yNow > 0) {
      // Future portion above the playhead.
      this._roundRect(ctx, geo.trackX0, 0, trackW, yNow, 3);
      if (this.futureColor) {
        ctx.fillStyle = this.futureColor;
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = recordedCol;
        ctx.globalAlpha = 0.7; // ~30% dimmer than recorded
      }
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (yNow < h) {
      // Recorded (past) portion.
      this._roundRect(ctx, geo.trackX0, yNow, trackW, h - yNow, 3);
      ctx.fillStyle = recordedCol;
      ctx.fill();
    }

    // "Unavailable footage" gaps (camera offline): grey over the track, UniFi
    // style. Drawn on top of the recorded fill so the missing span reads as a
    // distinct no-data segment; also collected as hit rects for the hover tip.
    this._gapHits = [];
    if (this.gaps && this.gaps.length) {
      const gapCol = this.gapColor || '#4a4a52';
      ctx.fillStyle = gapCol;
      ctx.globalAlpha = 1;
      for (const g of this.gaps) {
        let gy0 = this._timeToY(g.end); // newer end is higher (smaller y)
        let gy1 = this._timeToY(g.start);
        if (gy1 < 0 || gy0 > h) continue;
        if (gy1 - gy0 < 3) {
          const mid = (gy0 + gy1) / 2; // keep a sub-second gap visible
          gy0 = mid - 1.5;
          gy1 = mid + 1.5;
        }
        this._roundRect(ctx, geo.trackX0, gy0, trackW, gy1 - gy0, 3);
        ctx.fill();
        this._gapHits.push({ gap: g, yTop: gy0, yBot: gy1 });
      }
    }

    // Time-axis ticks: minor dashes + major labeled ticks.
    const { major, minor } = majorMinorFor(spanOf(this._dd));
    const tickCol = this.tickColor || textColor;
    const minorLen = Math.max(2, Math.min(this.tickSize, 16));
    const majorLen = Math.max(2, Math.min(this.tickSize + 5, 18));
    const tickWidth = Math.max(1, Math.min(this.tickSize / 5, 2.5));

    ctx.strokeStyle = tickCol;
    ctx.lineWidth = tickWidth;
    ctx.globalAlpha = 0.7;
    for (const t of tickTimes(this._dd, minor)) {
      const y = this._timeToY(t);
      if (y < 4 || y > h - 4) continue;
      ctx.beginPath();
      ctx.moveTo(geo.tickRight - minorLen, y);
      ctx.lineTo(geo.tickRight, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    const labelMargin = fs * 0.55;
    for (const t of tickTimes(this._dd, major)) {
      const y = this._timeToY(t);
      if (y < labelMargin || y > h - labelMargin) continue;
      ctx.strokeStyle = tickCol;
      ctx.lineWidth = Math.max(tickWidth, 1.5);
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.moveTo(geo.tickRight - majorLen, y);
      ctx.lineTo(geo.tickRight, y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1;
      ctx.fillStyle = this.fontColor || textColor;
      ctx.fillText(this._fmt(t, { hour: '2-digit', minute: '2-digit' }), geo.labelRight, y);
    }

    // Detection events: a colored dot on the track + a hit target. The
    // connector line + thumbnail are DOM (rendered in render()).
    this._hits = [];
    const barW = trackW;
    for (const b of this.bands) {
      let yTop = this._timeToY(b.end); // newer end is higher (smaller y)
      let yBot = this._timeToY(b.start);
      if (yBot < 0 || yTop > h) continue;
      if (yBot - yTop < MIN_EVENT_PX) {
        const mid = (yTop + yBot) / 2;
        yTop = mid - MIN_EVENT_PX / 2;
        yBot = mid + MIN_EVENT_PX / 2;
      }
      this._hits.push({ band: b, colX: geo.trackX1, yTop, yBot });
      // Accent bar spanning the event's full duration (UniFi-style), not a dot —
      // a long detection reads as a long segment matching its thumbnail length.
      ctx.fillStyle = accent;
      const r = Math.min(barW / 2, (yBot - yTop) / 2);
      ctx.beginPath();
      ctx.roundRect(geo.trackX0, yTop, barW, yBot - yTop, r);
      ctx.fill();
    }

    // Fixed playhead: full-width line + highlight band. Drawn in SCREEN coords
    // (reset the indent translate) so the line always spans the full width. No
    // knob dot on the track — a round blob there reads as a tiny event clip.
    // Must be the last canvas draw.
    // Mirrored: stop at the ruler. The canvas is as wide as the GRAB area, which
    // reaches far left over the video, and a playhead line running that whole
    // way reads as a stray stripe. Everything further left is the pill's own
    // connector (which follows it when it dodges) — see .live-pill::after.
    ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
    const py = this._playheadY;
    const phX0 = this.mirror ? Math.max(0, geo.trackX0 - 6) : 0;
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.18;
    ctx.fillRect(phX0, py - 6, w - phX0, 12); // soft highlight band
    ctx.globalAlpha = 1;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(phX0, py);
    ctx.lineTo(w, py);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  private _roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  // PERF-SCRUB-2026-08-03: was `new Intl.DateTimeFormat(undefined, opts)` on
  // every call — i.e. once per major tick label per canvas frame, once per frame
  // for the mirror layout's measureText, and once per Lit render for the
  // playhead pill. See data/fmt.ts for the measurements.
  // Revert: `return new Intl.DateTimeFormat(undefined, opts).format(new Date(t));`
  private _fmt(t: number, opts: Intl.DateTimeFormatOptions): string {
    return fmtTime(t, opts);
  }

  render() {
    const accent = this.accentColor || 'var(--primary-color, #03a9f4)';
    // Filled chrome (pills, zoom, jump-to-live) carries white text, so it needs
    // a deeper mix of the accent than the lines drawn on the ruler.
    const deepAccent = darken(this.accentColor, 0.58);
    // Centre the round buttons in the overlay's gutter (see the `gutter` prop):
    // a negative `right`, half the gutter plus half the button.
    const fabRight = this.gutter ? -(this.gutter / 2 + (this.compact ? 19 : 22)) : 8;
    // Live MODE keeps the <ha-camera-stream> mounted even when paused, but the
    // LIVE pill must reflect ACTUAL live playback: hide it the moment the live
    // video is paused (livePaused), and also if the playhead has drifted from
    // now for any other reason. Paused => not live, so drop the pill.
    const atLiveEdge =
      this.live &&
      !this.livePaused &&
      this.domain &&
      this.now - playheadTimeOf(this.domain, this.playheadFrac) < LIVE_EDGE_MS; // 5s grace
    // Off the live edge the pill keeps marking the playhead, showing WHERE it
    // is — the fullscreen overlay has no date pill or timestamp of its own, so
    // this is the only readout of the moment being played. Dark, not accent, so
    // it never reads as "LIVE" at a glance.
    const pillTime =
      !atLiveEdge && this.domain
        ? this._fmt(Math.min(playheadTimeOf(this.domain, this.playheadFrac), this.now), {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        : '';
    const showPill = this._height > 0 && (atLiveEdge || !!pillTime);
    const thumbVars = `--upc-thumb-w:${this.thumbSize}px;--upc-thumb-w-lg:${this.thumbSizeActive}px;`;
    // Thumb position on the vertical zoom slider: 0 (top, zoomed in) .. 1.
    const thumbF = 1 - this._sliderValue / (SPAN_STEPS.length - 1);
    // Render the thumbnails FIRST: it refreshes _kept, which the pill's dodge
    // reads, so both agree on where the thumbnails are this frame.
    const thumbs = this._renderThumbs();
    const pillRight =
      this._evtAnchor +
      PILL_GAP +
      (this._pillDodge() ? this.thumbSizeActive + PILL_DODGE_GAP : 0);
    return html`
      <div
        class="col"
        style="--upc-accent:${accent};${deepAccent
          ? `--upc-accent-deep:${deepAccent};`
          : ''}--upc-indent:${this.indent}px;--upc-pill-left:${this
          .pillIndent}px;--upc-evt-right:${this._evtAnchor}px;--upc-pill-right:${pillRight}px;--upc-fab-right:${fabRight}px;--upc-ph-y:${this
          ._height * this.playheadFrac}px;${thumbVars}"
      >
        <div class="scrub">
          <canvas></canvas>
          <div class="evt-layer">${thumbs}</div>
          ${showPill
            ? html`<div
                class="live-pill ${atLiveEdge ? '' : 'at-time'} ${this._pillBig ? 'big' : ''}"
                style="top:${this._height * this.playheadFrac}px"
              >
                ${atLiveEdge ? 'LIVE' : pillTime}
              </div>`
            : nothing}
          ${this._hoverGap
            ? html`<div class="gap-tip" style="top:${this._hoverGap.y}px">
                Camera offline
                <div class="gap-sub">
                  ${this._fmt(this._hoverGap.gap.start, { hour: '2-digit', minute: '2-digit' })} –
                  ${this._fmt(this._hoverGap.gap.end, { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>`
            : nothing}
          ${this.zoomUi ? this._renderZoom(thumbF) : nothing}
          ${this.liveArrow && !this.live
            ? html`<button
                class="live-arrow"
                title="Jump to live"
                @pointerdown=${(e: Event) => e.stopPropagation()}
                @click=${this._goLive}
              >
                ↑
              </button>`
            : nothing}
        </div>
      </div>
    `;
  }

  /** Jump-to-live. Bubbles composed, so the host catches it on whatever element
   *  this timeline is mounted in (the card already listens for `go-live`). */
  private _goLive = (e: Event): void => {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent('go-live', { bubbles: true, composed: true }));
  };

  /** True when a visible thumbnail crosses the playhead pill's row, so the pill
   *  should step left of the thumbnail column instead of colliding with it.
   *  Measured against the ENLARGED thumbnail height (plus a margin), so a thumb
   *  growing under the playhead or on hover can't reach the pill either. */
  private _pillDodge(): boolean {
    if (!this.mirror || !this._height) return false;
    const py = this._playheadY;
    const reach = (this.thumbSizeActive * 0.75) / 2 + 25;
    return this._kept.some((k) => Math.abs(k.y - py) < reach);
  }

  /** The collapsible zoom control (magnifier fab -> vertical slider flyout).
   *  Dropped entirely in the fullscreen overlay, which has no zoom. */
  private _renderZoom(thumbF: number) {
    return html`
      ${this._zoomOpen
        ? html`<div class="zoom-panel">
            <button
              class="zpbtn"
              @pointerdown=${(e: Event) => e.stopPropagation()}
              @click=${this._zoomIn}
              title="Zoom in"
            >
              +
            </button>
            <div
              class="zslider"
              @pointerdown=${this._onZoomSliderDown}
              @pointermove=${this._onZoomSliderMove}
              @pointerup=${this._onZoomSliderUp}
              @pointercancel=${this._onZoomSliderUp}
            >
              <div class="zthumb" style="top:calc(8px + ${thumbF} * (100% - 16px))"></div>
            </div>
            <button
              class="zpbtn"
              @pointerdown=${(e: Event) => e.stopPropagation()}
              @click=${this._zoomOut}
              title="Zoom out"
            >
              −
            </button>
          </div>`
        : html`<button
            class="zoom-fab"
            @pointerdown=${(e: Event) => e.stopPropagation()}
            @click=${this._openZoom}
            title="Zoom"
          >
            <ha-icon icon="mdi:magnify-plus-outline"></ha-icon>
          </button>`}
    `;
  }

  // Flat member list (raw NVR events across all display groups) newest-first,
  // memoized per bands array — _renderThumbs runs per frame while panning.
  private _flatMembers?: { bands: DetectionBand[]; flat: { m: DetectionBand; g: DetectionBand }[] };

  // The thumbnails that survived the last occlusion pass; track-hover picks
  // from this same set so it can never reveal a hidden one.
  private _kept: KeptThumb[] = [];

  // PERF-SCRUB-2026-08-03: memoised occlusion pass — see _renderThumbs. Keyed
  // by everything the SELECTION depends on (never the pan offset).
  private _keptSel?: {
    bands: DetectionBand[];
    span: number;
    height: number;
    spacing: number;
    sel: { m: DetectionBand; g: DetectionBand }[];
  };

  private _members(): { m: DetectionBand; g: DetectionBand }[] {
    if (this._flatMembers?.bands !== this.bands) {
      const flat: { m: DetectionBand; g: DetectionBand }[] = [];
      for (const g of this.bands) for (const m of g.members ?? [g]) flat.push({ m, g });
      // OLDEST first: the greedy occlusion pass keeps the first thumb it
      // meets, so within a dense merged group the EARLIEST member survives —
      // its lone thumbnail then represents (and plays) the activity from the
      // START, matching the group's bar/list identity. (Newest-first here once
      // made a merged bar's thumb play from its 2nd/3rd burst.)
      flat.sort((a, b) => a.m.start - b.m.start);
      this._flatMembers = { bands: this.bands, flat };
    }
    return this._flatMembers.flat;
  }

  /** Inline thumbnails: one per raw NVR event (group member) along its group's
   *  bar. Which thumbs EXIST is decided purely by geometry — greedy OLDEST-
   *  first (so a dense merged group is represented by its EARLIEST member,
   *  which plays the activity from the start), keeping a thumb only when it
   *  clears the previous kept one by an ENLARGED-vs-inactive height — so
   *  nothing can ever overlap OR need hiding: the active/hovered thumb grows
   *  in place without touching its neighbours, and, like UniFi, a hidden
   *  thumbnail STAYS hidden until you zoom in.
   *  Rendered keyed by event id so a thumb entering/leaving the viewport never
   *  rebinds another thumb's <img> (that rebinding read as content "flicker"
   *  while scrubbing).
   *  A thumbnail never swallows the pointerdown — the press has to reach the
   *  .scrub gestures so a drag starting on it still scrubs — and a TAP on one
   *  winds the timeline to that event from _onPointerUp instead. */
  private _renderThumbs() {
    if (!this._height || !this.domain) return nothing;
    const ph = playheadTimeOf(this.domain, this.playheadFrac);
    const actHalf = (this.thumbSizeActive * 0.75) / 2; // enlarged thumb half-height
    const inHalf = (this.thumbSize * 0.75) / 2; // inactive thumb half-height
    // Min center-gap between kept thumbs: an ENLARGED thumb beside an inactive
    // one must still clear it — guarantees zero overlap at any moment.
    const spacing = actHalf + inHalf + 6;

    // The kept set, over ALL members (not just visible ones). y is linear in
    // time, so which thumbs survive depends on the ZOOM only, never the pan
    // offset or the playhead: the set is rock-stable while scrolling and while
    // footage plays; zooming in reveals more. Members iterate OLDEST first —
    // bottom of the timeline upward (older = larger y) — so lastKeptY walks
    // DOWN from +Infinity.
    // PERF-SCRUB-2026-08-03: the greedy pass is memoised, the positions are not.
    // This render runs on every pointermove of a scrub and used to walk EVERY
    // group member each time. As the comment above already states, which thumbs
    // survive depends on the ZOOM only — the test is `lastKeptY - y < spacing`,
    // and y is linear in time, so a pan shifts every y by the same amount and
    // cannot change a single comparison. So cache the SELECTION against the
    // inputs that can change it and recompute only the (cheap) y positions.
    // Revert: drop _keptSel and inline the greedy loop below again.
    const span = spanOf(this._dd);
    const c = this._keptSel;
    let sel: { m: DetectionBand; g: DetectionBand }[];
    if (
      c &&
      c.bands === this.bands &&
      c.span === span &&
      c.height === this._height &&
      c.spacing === spacing
    ) {
      sel = c.sel;
    } else {
      sel = [];
      let lastKeptY = Infinity;
      for (const { m, g } of this._members()) {
        const y = (this._timeToY(m.end) + this._timeToY(m.start)) / 2;
        if (lastKeptY - y < spacing) continue; // too close to the previous kept thumb
        lastKeptY = y;
        sel.push({ m, g });
      }
      this._keptSel = { bands: this.bands, span, height: this._height, spacing, sel };
    }
    const kept: KeptThumb[] = sel.map(({ m, g }) => ({
      m,
      g,
      y: (this._timeToY(m.end) + this._timeToY(m.start)) / 2,
    }));
    this._kept = kept; // track-hover hit-testing picks from this same set

    // The active thumb: the playhead's group plays as ONE event, and the kept
    // thumb nearest the playhead inside it is the one that grows — stepping
    // kept-thumb to kept-thumb as playback moves through the group, never
    // pulling a hidden member into view.
    let active: KeptThumb | undefined;
    let bestD = Infinity;
    for (const k of kept) {
      if (ph < k.g.start || ph > k.g.end) continue;
      const d = ph < k.m.start ? k.m.start - ph : ph > k.m.end ? ph - k.m.end : 0;
      if (d < bestD) {
        bestD = d;
        active = k;
      }
    }

    // Render the on-screen kept thumbs (drop only once fully past an edge, so
    // thumbs clip gradually on the way out like the canvas bars).
    const visible = kept.filter((k) => {
      const halfH = k === active || this._hoverBand === k.m ? actHalf : inHalf;
      return k.y + halfH >= 0 && k.y - halfH <= this._height;
    });
    return repeat(
      visible,
      (k) => thumbKey(k.m),
      (k) => {
        const isActive = k === active;
        const hovered = this._hoverBand === k.m;
        const url = this.loader?.get(k.m);
        return html`<div
          class="evt ${isActive ? 'active' : ''} ${hovered ? 'hovered' : ''}"
          style="top:${k.y}px"
        >
          <span class="evt-line"></span>
          <div
            class="evt-wrap"
            data-key=${thumbKey(k.m)}
            @mouseenter=${() => this._setHover(k.m)}
            @mouseleave=${this._clearHover}
          >
            ${url
              ? html`<img class="evt-thumb" .src=${url} alt=${k.g.label} />`
              : html`<span class="evt-thumb evt-ph"></span>`}
          </div>
        </div>`;
      },
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'upc-scrubber-timeline': ScrubberTimeline;
  }
}
