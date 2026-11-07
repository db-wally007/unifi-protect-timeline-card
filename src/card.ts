// UniFi Protect Timeline Card — root Lovelace element.
//
// Orchestrates the media view (top) and the scrubber timeline (bottom):
//  - initial visible window is centered on now (playhead = now = live), span from
//    default_timeline_zoom / default_span_minutes; the right half is the empty
//    future, UniFi center-needle style
//  - renders events from the pyscript sync job's manifest (the NVR's own raw
//    event list), consolidated UniFi-style for display (data/event-groups.ts),
//    refreshed on a slow interval; if the manifest is missing or stale, the
//    card triggers the sync service itself
//  - relays scrub / scrub-end / domain-change / live events to the media view
//
// nvr_id and camera_id need no manual ID lookup: camera_id = the HA camera
// entity_id, nvr_id = the unifiprotect config-entry id (auto-resolved from the
// camera's entity-registry entry when not given in YAML).

import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, queryAll, state } from 'lit/decorators.js';
import { cache } from 'lit/directives/cache.js';
import type {
  CameraEntry,
  CardConfig,
  DetectionBand,
  FootageGap,
  HomeAssistant,
  TimeDomain,
} from './data/types';
import { loadManifest, manifestToBand } from './data/manifest';
import {
  MINUTE,
  PHONE_FS_PLAYHEAD_FRAC,
  PLAYHEAD_FRAC,
  SPAN_STEPS,
  clampSpan,
  domainForPlayhead,
  playheadTimeOf,
  spanOf,
} from './data/time-scale';
import { fetchFootageGaps, footageStart, nearestFootage } from './data/gaps';
import { cameraCanTalk } from './talk';
import { enableDebug } from './data/debug-log';
import { navigate } from './data/navigate';
import { groupBands } from './data/event-groups';
import { ThumbnailLoader } from './data/thumbnail-loader';
import { SCRUB_BASE, THUMBS_BASE } from './data/ha-urls';
import { dateFmt } from './data/fmt'; // PERF-SCRUB-2026-08-03
import { LatestValueScheduler } from './data/latest-value-scheduler';
import { darken, swallowNextTap, type ScrubberTimeline } from './scrubber-timeline';
import type { EventsList } from './events-list';
import {
  GRID_EDGE,
  TABLET_GAP,
  tabletPaneWidth,
  type MultiHead,
  type MultiView,
} from './multi-view';
import './events-list';
import './event-strip';
import { tagBands, type MultiBand } from './data/multi-events';
import './media-view';
import type { MediaView } from './media-view';
import {
  POP_IN_MS,
  POP_OUT_MS,
  ZOOM_MS,
  boxOf,
  clipBox,
  iosEase,
  popFlight,
  rectBox,
  sourceBox,
  turnZoom,
  turnedLocal,
  zoom,
  type Box,
  type ZoomSource,
} from './data/motion';

const BAND_REFRESH_MS = 30_000;
// How dark the page behind the camera screen gets while it zooms over it.
const XF_DIM = 0.4;
// Multi page grid-density icons (wide layout header): rows-only (1 full-width
// column, scrolls) and 2 columns. Drawn inline so they read exactly like the
// segmented control mock — filled bars via currentColor.
const V_ROWS = html`<svg viewBox="0 0 24 24">
  <rect x="4" y="5" width="16" height="5.5" rx="1.5"></rect>
  <rect x="4" y="13.5" width="16" height="5.5" rx="1.5"></rect>
</svg>`;
const V_2COL = html`<svg viewBox="0 0 24 24">
  <rect x="4" y="5" width="6.6" height="14" rx="1.5"></rect>
  <rect x="13.4" y="5" width="6.6" height="14" rx="1.5"></rect>
</svg>`;
// Re-read the recording gaps (scrub index) at most this often while panning.
const GAPS_REFRESH_MS = 60_000;
// Upright phone fullscreen (portrait footage): the right-edge lane's gutter and
// how far the scrim reaches over the picture (see _fsUpright).
const FS_UPRIGHT_WIDTH = 100; // ~ the ruler itself: ticks + time labels + track
const FS_UPRIGHT_GUTTER = 52; // the zoom control and the jump-to-live arrow
const FS_UPRIGHT_SCRIM_EXTEND = 40;
// ...and its event thumbnails: on a ~340px lane the playhead pill (which steps
// left of a thumbnail on its row) only fits beside a slightly smaller one.
const FS_UPRIGHT_THUMB = 72;
const FS_UPRIGHT_THUMB_ACTIVE = 84;
// The camera screen's events panel: one column of the multi page's events
// grid items (user, 2026-10-30), with these margins either side; upright
// (the phone) its list fades out over this much at either end.
const PHONE_EVENTS_PAD = 12;
const TABLET_EVENTS_PAD = 24;
const FS_LIST_FADE = 28;
// The phone's camera screen (stacked layout) - the tablet's, scaled down.
// Sideways (landscape footage): the camera picker's tiles, on an ~844 x 390
// screen; upright (portrait footage), ~390px wide: two to a row.
const PHONE_PICKER_TILE = 150;
const PHONE_UPRIGHT_PICKER_TILE = 160;
// A card shorter than this is a phone's screen however wide it is (a phone in
// landscape): its camera screen takes the phone's sizes (see _phoneScreen).
const PHONE_SCREEN_MAX_H = 500;
// The card calls the sync service itself when the manifest is stale (job not
// running / not run yet), at most once per SYNC_THROTTLE_MS.
const SYNC_THROTTLE_MS = 2 * 60_000;
const VERSION = '3.2.0';

// A playback-time step at least this large is a SKIP, not playback advancing;
// the ruler glides across it. Well above the sub-second cadence of normal
// playback reporting, well below the 15s the skip buttons move.
const SKIP_GLIDE_MIN_MS = 2_000;

// How long the pill stays big when jumping to LIVE. Longer than the glide, so
// the swollen "LIVE" is readable for a beat after the ruler arrives.
const LIVE_GLIDE_HOLD_MS = 1_000;
const SCRUB_PREVIEW_INTERVAL_MS = 33;
// The fullscreen overlay ruler is read at arm's length on a wall tablet, so its
// labels are scaled up from the card's timeline_font_size. A phone is held much
// closer and its rotated ruler is short, so it takes a gentler bump.
const FS_FONT_SCALE = 1.3;
const FS_FONT_SCALE_PHONE = 1.15;

// ---- refcounted page-canvas override (page_background) ---------------------
// A view swap disconnects the old card and connects the new one within the
// same task; refcounting keeps the html canvas stable across that handover
// (no flash back to the theme color between two camera views).
let pageBgCount = 0;
let pageBgPrev = '';

@customElement('unifi-protect-timeline-card')
export class UnifiProtectTimelineCard extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;

  @state() private _config?: CardConfig;
  @state() private _domain?: TimeDomain;
  @state() private _gaps: FootageGap[] = []; // camera-offline spans in the fetched window
  @state() private _targetTime = Date.now();
  @state() private _scrubbing = false;
  @state() private _liveMode = true; // showing the live stream (vs historical)
  @state() private _livePaused = false; // live stream is mounted but paused by the user
  @state() private _now = Date.now();
  @state() private _nvrId = '';
  @state() private _mode: 'timeline' | 'list' = 'timeline';
  // The camera currently shown. Starts as config.camera; the gallery strip
  // (config `cameras:`) can switch it at runtime — live stream, events,
  // gaps, thumbnails and the header title all follow it.
  @state() private _activeCamera = '';
  // Multi mode, IN-CARD drill-down: set (to the tapped camera) when a live
  // tile without a navigation_path is opened — the card then renders the full
  // single-camera timeline IN PLACE of the multi page (no HA navigation, so a
  // hosting popup stays open); the back chevron returns to the multi page.
  @state() private _drill?: string;
  private _swapDir = 0; // pending drill swap animation: 1 = in (from right), -1 = out
  // The camera screen zooms open out of what was tapped (a live tile, a
  // clip's player) and back into it on exit (see data/motion.ts) - turning
  // as it flies on the phone, where it stands sideways - with both pages
  // mounted meanwhile ('in': the multi page under it, 'out': the multi page
  // back under it), the page behind dimmed, the camera screen's chrome hidden
  // while it flies and its poster (the picture it flew from) shown until its
  // own first frame.
  @state() private _xf: 'in' | 'out' | null = null;
  @state() private _panelPoster?: string | HTMLCanvasElement;
  @state() private _panelChromeHidden = false;
  private _xfToken = 0;
  @state() private _galleryOpen = false; // the camera screen's camera picker is open
  // Wide layout's events panel (right edge) — open, and mounted at least once
  // (it stays mounted so it can slide back out with its rows on).
  @state() private _eventsOpen = false;
  private _eventsMounted = false;
  @state() private _calOpen = false; // date-pill calendar popup
  @state() private _zoomPanel = false; // the timeline's zoom slider is open (camera screen)
  @state() private _calCursor = { y: 0, m: 0 }; // calendar's displayed month
  // Own rendered width — drives layout:'auto' (stacked vs columns) and re-picks
  // live when a phone rotates or the card is resized.
  @state() private _hostWidth = 0;
  // ...and height: the phone's sideways camera screen is laid out the other
  // way round (see _renderPanel).
  @state() private _hostHeight = 0;
  private _hostRo?: ResizeObserver;
  @state() private _thumbVersion = 0; // bumped when a thumbnail finishes loading
  @state() private _playingBand?: DetectionBand; // event currently being played
  @state() private _clipEnd = 0; // when playing an event, its end (epoch ms); 0 = unbounded
  // The NVR's event list, consolidated for display (UniFi-style gap-merge):
  // each band may carry `members` = the raw events it merges.
  @state() private _manifestBands: DetectionBand[] = [];
  // Camera recording padding (from the manifest): clip playback covers
  // start - _preMs .. end + _postMs, matching what the UniFi app plays.
  private _preMs = 0;
  private _postMs = 0;
  private _lastSyncTrigger = 0; // throttles card-initiated sync service calls
  private _syncRefetchTimer?: ReturnType<typeof setTimeout>;

  /** Events both views render: the manifest's raw NVR events, gap-merged into
   *  UniFi-style display groups (see _fetchManifest / data/event-groups.ts). */
  private get _viewBands(): DetectionBand[] {
    return this._manifestBands;
  }

  // Shared, NVR-safe thumbnail loader used by both the timeline and list views.
  private _loader = new ThumbnailLoader(2, () => {
    this._thumbVersion++;
  });

  private _inited = false;
  private _gapsAt = 0; // when _gaps was last read (0 = never / reset)
  private _gapsDir = ''; // the scrub dir it was read from
  private _tick?: ReturnType<typeof setInterval>;
  private _bandInterval?: ReturnType<typeof setInterval>;

  static styles = css`
    :host {
      /* custom elements default to inline — inline boxes measure width 0 in
         ResizeObserver, which would wedge layout:auto in stacked mode */
      display: block;
    }
    /* A zoom between the multi page and the camera screen (see _xf): both are
       mounted, one over the other. The page that stays sets the height; the
       other rides on top of it ('in': the camera screen over the multi page,
       which stays under; 'out': the camera screen leaving over it). The host
       holds them (layout containment: a containing block without touching
       its own position - on the phone it is pinned fixed to the screen). */
    :host([xf]) {
      contain: layout;
    }
    :host([xf='in']) ha-card.multi-wide,
    :host([xf='in']) ha-card.multi-stacked {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
    }
    /* ...and a stacking context of its own, or its overlays (a clip player's
       controls at z 6) paint over the camera screen. */
    :host([xf]) ha-card.multi-wide,
    :host([xf]) ha-card.multi-stacked {
      z-index: 0;
    }
    :host([xf='out']) ha-card.multi-wide,
    :host([xf='out']) ha-card.multi-stacked {
      position: relative;
    }
    /* The containing block of the page's fixed lightbox: its scrim covers the
       card - in a popup or a view alike - never the sidebar beside it. */
    ha-card.multi-wide {
      contain: layout;
    }
    :host([xf]) ha-card.panel {
      position: relative;
      z-index: 2;
      /* Only the player flies, not the card's own background around it. */
      background: transparent;
      box-shadow: none;
    }
    :host([xf='out']) ha-card.panel {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
    }
    .xf-dim {
      position: absolute;
      inset: 0;
      z-index: 1;
      background: #000;
      opacity: 0;
      pointer-events: none;
    }
    ha-card {
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      box-sizing: border-box; /* inline height includes the padding */
    }
    /* Multi page body fills the card under the header, like .row does. */
    upc-multi-view {
      flex: 1 1 auto;
      min-height: 0;
    }
    /* Stacked multi page: the SCROLLER (upc-multi-view) must own the side
       padding, or the edge-to-edge strip/tiles overflow it horizontally and
       the whole page pans sideways. The card gives up its side padding here;
       multi-view re-applies it inside (see its :host([stacked]) rule). */
    ha-card.multi-stacked {
      padding-left: 0;
      padding-right: 0;
    }
    ha-card.multi-stacked .header {
      padding: 0 12px; /* header keeps the visual inset the card padding gave it */
    }
    /* Wide multi page: the header row lines up with the page below it - the
       heading over the events pane (.head-events, the pane's width), the
       grid-density control centred over the cameras (.head-cams, ending where
       the camera grid does). */
    ha-card.multi-wide .header {
      padding-top: 10px; /* a little more air above the heading */
      gap: ${TABLET_GAP}px;
    }
    .head-events {
      flex: 0 0 auto; /* flex-basis = the events pane's width (inline) */
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .head-cams {
      flex: 1 1 auto;
      align-self: stretch; /* the title's line: the control centres on it */
      position: relative;
      margin-right: ${GRID_EDGE - 12}px; /* 12 = the card padding above */
    }
    /* Segmented control: rows / 2 columns. Absolutely centred so its height
       doesn't grow the header row; fades out while the cameras are away
       (events grid open, a clip playing). The active step reads white. */
    .grid-view {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      display: inline-flex;
      gap: 2px;
      padding: 3px;
      border-radius: 11px;
      background: rgba(0, 0, 0, 0.5);
      transition:
        opacity 0.24s,
        visibility 0.24s;
    }
    .grid-view.hidden {
      opacity: 0;
      visibility: hidden;
    }
    .grid-view button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 40px; /* portrait — a bit taller than wide */
      padding: 0;
      border: none;
      border-radius: 9px;
      background: transparent;
      color: rgba(255, 255, 255, 0.55);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      transition:
        color 0.15s,
        background 0.15s;
    }
    .grid-view button:hover {
      color: rgba(255, 255, 255, 0.85);
    }
    .grid-view button.on {
      background: rgba(255, 255, 255, 0.18);
      color: #fff;
    }
    .grid-view svg {
      width: 21px;
      height: 26px; /* portrait glyph to fill the taller button */
      fill: currentColor;
      display: block;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 8px; /* space between the back button and the title (no button → no effect) */
      /* Defaults match the rooms-overview room name (headline5 / 500);
         overridable via title_font_size / _color / _weight. */
      font-weight: var(--upc-title-weight, 500);
      font-size: var(--upc-title-size, var(--mdc-typography-headline5-font-size, 24px));
      color: var(--upc-title-color, var(--primary-text-color));
    }
    .title-text {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    /* Multi page, wide layout: "Events (N) >" as the heading - ONE button that
       opens/closes the events grid, in the title's own type and colour; the
       count is set smaller in brackets so it doesn't read as part of the title.
       The chevron turns to point back while the events grid is open. */
    .head-link {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      padding: 0 0 0 8px; /* the title's ink starts where the list rows' text does */
      margin: 0;
      border: none;
      background: transparent;
      color: inherit;
      font: inherit; /* a <button> doesn't inherit it - the count and icon are sized in em */
      cursor: pointer;
      outline: none; /* a tap left a focus ring round the whole heading */
      -webkit-tap-highlight-color: transparent;
    }
    /* The count is centred on the title (not on its baseline, where the smaller
       type looked dropped). */
    .head-count {
      flex: 0 0 auto;
      font-size: 0.625em;
      font-weight: 500;
      transition: opacity 0.3s ease-out;
    }
    /* Until the events are in, the count (and the chevron after it) wait,
       invisible - then fade in together, so nothing reads "(0)" first. */
    .head-count.pending,
    .head-chev.pending {
      opacity: 0;
    }
    .head-chev {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      height: 1em; /* the 1.15em icon overflows it rather than growing the header row */
      transition: opacity 0.3s ease-out;
    }
    .head-chev ha-icon {
      --mdc-icon-size: 1.15em;
      display: block;
      transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .head-chev.open ha-icon {
      transform: rotate(180deg);
    }
    /* In-card back button — a chevron in a dark circle (matches the dashboards'
       bubble back button). Sized by --upc-back-size (back_button_size). */
    .back-btn {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      padding: 4px;
      margin: 0;
      border: none;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.6);
      color: var(--primary-text-color);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .back-btn ha-icon {
      display: block;
      --mdc-icon-size: var(--upc-back-size, 38px);
      width: var(--upc-back-size, 38px);
      height: var(--upc-back-size, 38px);
    }
    /* Camera-carousel toggle next to the title: mouse/desktop affordance for
       what drag-down-on-the-video does on touch. Chevron flips with state.
       Deliberately NO background — a second pill next to the back button reads
       as clutter; the bare glyph is enough. */
    .strip-toggle {
      flex: 0 0 auto;
      width: 34px;
      height: 34px;
      border: none;
      background: transparent;
      padding: 0;
      color: var(--primary-text-color);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      -webkit-tap-highlight-color: transparent;
    }
    .strip-toggle ha-icon {
      --mdc-icon-size: 26px;
      display: block;
    }
    /* UniFi-style: vertical timeline on the left, large video on the right.
       Tall by design so it fills a full-width / panel dashboard view.
       BOTH layouts: the CARD carries the height (set inline) and the row
       flexes to fill what's left under the header — so opening the camera
       strip shrinks the row instead of growing the card (a growing card
       overflowed height-capped containers like the bubble pop-up, cropping
       the header off the top). */
    .row {
      display: flex;
      gap: 10px;
      align-items: stretch;
      flex: 1 1 auto;
      min-height: 0;
    }
    .timeline-col {
      flex: 0 0 220px;
      min-width: 220px;
      position: relative;
      z-index: 2; /* enlarged thumbnails overflow over the video */
      display: flex;
      flex-direction: column;
      gap: 10px; /* matches the card's global 10px rhythm (video->toggle->timeline) */
    }
    /* Segmented Timeline | Events switch (UniFi-style), shared by both views.
       Track matches the bubble-card pop-up close button background (same var
       chain) so it blends with the popup; the active segment is a lighter
       raised fill so it stands out regardless of what the track resolves to. */
    .view-toggle {
      display: flex;
      gap: 3px;
      flex: 0 0 auto;
      padding: 3px;
      border-radius: 10px;
      /* subtle border so the two buttons read as one grouped control */
      border: 1px solid rgba(255, 255, 255, 0.1);
      /* Track behind both buttons. Overridable via toggle_bg; default = the
         bubble-card pop-up close-button background chain so it blends in. */
      background: var(
        --upc-toggle-bg,
        var(
          --bubble-sub-button-background-color,
          var(
            --bubble-icon-background-color,
            var(
              --bubble-secondary-background-color,
              var(--card-background-color, var(--ha-card-background, rgba(127, 127, 127, 0.14)))
            )
          )
        )
      );
    }
    .seg {
      flex: 1 1 0;
      border: none;
      border-radius: 8px;
      padding: 7px 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      background: transparent;
      color: var(--upc-toggle-text, var(--secondary-text-color));
      transition:
        background 0.15s ease,
        color 0.15s ease;
    }
    .seg:hover {
      color: var(--primary-text-color);
    }
    .seg.active {
      /* default matches the dark floating pills (date / zoom / live arrow) */
      background: var(--upc-toggle-active-bg, rgba(0, 0, 0, 0.6));
      color: var(--upc-toggle-active-color, #fff);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
    }
    /* Fills the column under the header; the chosen view manages its own scroll. */
    .mode-body {
      flex: 1 1 auto;
      min-height: 0;
      position: relative;
    }
    .video-col {
      flex: 1 1 auto;
      min-width: 0;
      position: relative;
      z-index: 1;
      /* The open/close-gallery drag lives here; nothing scrolls in this pane,
         so opting out of native touch handling costs nothing and makes iOS
         Safari deliver every pointermove. Taps still reach the video controls. */
      touch-action: none;
    }
    /* Camera gallery strip (config \`cameras:\`): a horizontal carousel between
       the header and the video. Opened by dragging DOWN on the video, closed
       ONLY by dragging UP (picking a camera keeps it open). Everything below
       (video + timeline) just slides down; the timeline stays visible and
       fully usable while the strip is open. Animated via max-height. */
    .cam-strip {
      flex: 0 0 auto;
      max-height: 0;
      opacity: 0;
      overflow: hidden;
      /* Collapsed: cancel one of the two ha-card flex gaps this extra child
         introduces, so header->video spacing is unchanged. Open: margin back
         to 0 so header->strip and strip->video get the SAME 10px gap. */
      margin-top: -10px;
      transition:
        max-height 0.22s ease,
        margin-top 0.22s ease,
        opacity 0.22s ease;
    }
    .cam-strip.open {
      max-height: 132px;
      margin-top: 0;
      opacity: 1;
    }
    .cam-strip-inner {
      display: flex;
      gap: 12px;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      /* symmetric so the strip sits evenly between header and video */
      padding: 4px 2px;
    }
    .cam-strip-inner::-webkit-scrollbar {
      display: none;
    }
    .cam-tile {
      flex: 0 0 auto;
      /* Same width as the event thumbnails (universal across the card). */
      width: var(--upc-cam-tile-w, 145px);
      box-sizing: border-box; /* active padding insets inward, tile stays 145px */
      padding: 0;
      margin: 0;
      border: none;
      background: transparent;
      cursor: pointer;
      text-align: left;
      -webkit-tap-highlight-color: transparent;
    }
    .cam-tile img,
    .cam-tile .cam-ph {
      display: block;
      width: 100%;
      aspect-ratio: 16 / 10; /* match the event thumbnails' aspect */
      object-fit: cover;
      border-radius: 10px;
      background: #000;
      border: 2px solid transparent;
      box-sizing: border-box;
    }
    /* Selected camera: the WHOLE tile becomes a white card (like a currently-
       playing event row), name goes black. The thumbnail is INSET by the tile's
       padding so the white reads as an even frame/mat on all sides (not just a
       strip under the name) — a framed-photo look. */
    .cam-tile.active {
      background: #fff;
      border-radius: 12px;
      padding: 5px; /* the white frame around the inset thumbnail + name */
    }
    .cam-tile.active img,
    .cam-tile.active .cam-ph {
      border: none; /* the frame is the tile padding now */
      border-radius: 7px; /* concentric inside the 12px card */
    }
    /* Same type as the multi page's live-tile name overlay (14px/700 white,
       normal case) — the active tile is marked by its white border instead. */
    .cam-name {
      display: block;
      margin-top: 5px;
      font-size: 14px;
      font-weight: 700;
      color: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cam-tile.active .cam-name {
      color: #000; /* black on the white card */
      margin-top: 4px;
      padding: 0; /* the tile's 5px padding already frames the name */
    }
    /* Floating date pill (bottom-left, over the timeline — UniFi style).
       Rendered by the CARD, not the scrubber, so it floats over either view.
       Same baseline as the jump-to-live arrow. */
    .date-pill {
      position: absolute;
      left: 10px;
      bottom: calc(var(--upc-arrow-bottom, 14px) + 15px);
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 9px 16px 9px 12px;
      border: none;
      border-radius: 22px;
      cursor: pointer;
      color: var(--upc-date-color, #fff);
      font-size: var(--upc-date-size, 13px);
      font-weight: 600;
      background: rgba(0, 0, 0, 0.6);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
      z-index: 10;
      -webkit-tap-highlight-color: transparent;
    }
    .date-pill ha-icon {
      --mdc-icon-size: 18px;
      display: block;
    }
    /* Jump-to-live arrow (bottom-right, same line as the date pill), rendered
       by the CARD so it floats over either view. Background matches the dark
       pills (overridable via arrow_color). Shown only when not live. */
    .live-arrow {
      position: absolute;
      right: 8px;
      bottom: calc(var(--upc-arrow-bottom, 14px) + 15px);
      /* same size as the collapsed zoom button */
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
      background: var(--upc-arrow, rgba(0, 0, 0, 0.6));
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
      z-index: 10;
    }
    /* Dark mini-calendar popped up from the date pill. Stacked (phone): full
       card width so the day grid reads comfortably. Columns (tablet): the
       220px timeline column can't fit the 44px day cells, so .wide breaks out
       to a fixed width and overlays the video (timeline-col z-index wins). */
    .cal-pop {
      position: absolute;
      left: 10px;
      right: 10px;
      bottom: calc(var(--upc-arrow-bottom, 14px) + 63px);
      padding: 16px;
      box-sizing: border-box;
      border-radius: 16px;
      background: var(--upc-cal-bg, rgb(38, 33, 43));
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.6);
      z-index: 11;
    }
    .cal-pop.wide {
      right: auto;
      width: 366px; /* 7×44px cells + 6×4px gaps + 2×16px padding */
    }
    .cal-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .cal-title {
      font-size: 18px;
      font-weight: 600;
      color: var(--primary-text-color);
      padding-left: 4px;
    }
    .cal-chev {
      width: 40px;
      height: 40px;
      border: none;
      border-radius: 50%;
      background: transparent;
      color: var(--primary-text-color);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .cal-chev[disabled] {
      opacity: 0.3;
      cursor: default;
    }
    .cal-chev ha-icon {
      --mdc-icon-size: 26px;
      display: block;
      margin: 0 auto;
    }
    .cal-grid {
      display: grid;
      /* minmax(0, 1fr): columns may shrink below the cells' preferred size on
         narrow phones — fixed 44px cells need 366px and overflowed the popup
         on the right on real (375-390pt) iPhones. */
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 4px;
      justify-items: center;
    }
    /* The days: a grid of their own under the weekdays, so a month change
       slides them (and the title) alone - see _calShift, whose leaving copies
       are .cal-ghost. */
    .cal-days {
      margin-top: 4px;
    }
    .cal-ghost {
      position: absolute;
      margin: 0;
      pointer-events: none;
    }
    .cal-cell {
      width: 100%;
      max-width: 44px;
      aspect-ratio: 1 / 1; /* shrinks with the column, stays circular */
      height: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    }
    .cal-wk {
      aspect-ratio: auto;
      height: 28px;
      color: var(--secondary-text-color);
      font-size: 13px;
      font-weight: 600;
    }
    .cal-day {
      border: none;
      border-radius: 50%;
      background: transparent;
      color: var(--primary-text-color);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .cal-day[disabled] {
      opacity: 0.3;
      cursor: default;
    }
    .cal-day.sel {
      background: var(--upc-accent, var(--primary-color, #03a9f4));
      color: #fff;
      font-weight: 700;
    }
    /* ---- Wide layout: the camera screen IS the player (see _renderPanel).
       Everything below is slotted into the media view, which places it. ---- */
    ha-card.panel {
      position: relative; /* the .hero layer's box */
      padding: 0;
      overflow: hidden; /* the card's corners clip the picture and the panels */
      transition: background-color 0.24s ease-out;
    }
    /* Pictures in flight (a camera picked in the picker flying into the
       screen): over everything in the camera screen, taking no taps. */
    ha-card.panel .hero {
      position: absolute;
      inset: 0;
      z-index: 10;
      pointer-events: none;
    }
    ha-card.panel .hero > .ghost {
      position: absolute;
      object-fit: cover;
    }
    ha-card.panel upc-media-view {
      flex: 1 1 auto;
      min-height: 0;
    }
    /* The phone's camera screen: edge to edge, in a frame of its own (what a
       zoom flies) - turned sideways about its centre for landscape footage,
       the frame laid out the other way round (inline size) so it fills the
       card once turned. */
    ha-card.panel.phone {
      border-radius: 0;
    }
    ha-card.panel.phone > .frame {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
    }
    ha-card.panel.phone.turned > .frame {
      inset: auto;
      transform: rotate(90deg);
      transform-origin: 50% 50%;
    }
    /* The frame's left edge the system covers (media-view centres the play
       controls right of it): the side cutout held in landscape - and turned
       sideways, the screen's TOP, the status bar and camera cutout (user,
       2026-10-31: skip-back sat under it on an iPhone; the simulator has no
       inset). */
    ha-card.panel.phone {
      --upc-fs-left: env(safe-area-inset-left, 0px);
    }
    ha-card.panel.phone.turned {
      --upc-fs-left: env(safe-area-inset-top, 0px);
    }
    /* Its chrome, sized for a phone: the picker's tiles and names, the
       chevrons, the events column's margins. */
    ha-card.panel.phone .fs-cams {
      transform: translateY(calc(-100% + 40px));
    }
    ha-card.panel.phone .fs-cams.open {
      transform: none;
    }
    ha-card.panel.phone .fs-cams-body {
      padding: 12px 12px 2px;
    }
    ha-card.panel.phone .fs-cams-foot {
      height: 40px;
    }
    /* Open, it covers the top of the ruler: the rest of the screen dims
       under it, like under the calendar - the sheet is over everything, not
       on top of some of it. */
    ha-card.panel.phone .fs-cams-foot::before {
      height: 200vmax;
      background: linear-gradient(to bottom, rgba(0, 0, 0, 0.88), rgba(0, 0, 0, 0.55) 90px);
    }
    ha-card.panel.phone .fs-cams-row {
      gap: 12px;
    }
    ha-card.panel.phone .fs-cams .cam-name {
      font-size: 14px;
      margin-top: 4px;
    }
    ha-card.panel.phone .fs-cams .cam-tile.active {
      padding: 5px;
      border-radius: 12px;
    }
    ha-card.panel.phone .fs-cams .cam-tile.active img,
    ha-card.panel.phone .fs-cams .cam-tile.active .cam-ph {
      border-radius: 7px;
    }
    ha-card.panel.phone .fs-cams-handle {
      width: 64px;
      height: 34px;
      margin-top: 4px;
    }
    ha-card.panel.phone .fs-cams-handle svg {
      width: 32px;
      height: 12px;
    }
    ha-card.panel.phone .fs-events-handle {
      width: 32px;
      height: 64px;
      transition: opacity 0.2s ease;
    }
    /* The zoom slider opens right beside it: the chevron steps out of its
       way until it closes. */
    ha-card.panel.phone .fs-events.zooming .fs-events-handle {
      opacity: 0;
      pointer-events: none;
    }
    ha-card.panel.phone .fs-events-handle svg {
      width: 12px;
      height: 32px;
    }
    ha-card.panel.phone .fs-events-list {
      left: ${PHONE_EVENTS_PAD}px;
      right: ${PHONE_EVENTS_PAD}px;
    }
    /* Sideways, the frame's right edge is the screen's BOTTOM - iOS's
       system-gesture strip, where a button never gets the touch - so the
       events chevron keeps clear of it. */
    ha-card.panel.phone.turned .fs-events-handle {
      right: calc(100% + 10px + env(safe-area-inset-bottom, 0px));
    }
    /* Upright, the top edge is under the status bar / camera cutout: the
       picker's chevron and tiles and the events list start below it; the
       picker shows two tiles to a row. */
    ha-card.panel.phone.upright .fs-cams {
      transform: translateY(calc(-100% + 40px + env(safe-area-inset-top, 0px)));
    }
    ha-card.panel.phone.upright .fs-cams.open {
      transform: none;
    }
    ha-card.panel.phone.upright .fs-cams-body {
      padding-top: calc(12px + env(safe-area-inset-top, 0px));
    }
    ha-card.panel.phone.upright .fs-cams-row {
      flex-wrap: wrap;
      row-gap: 10px;
    }
    /* Upright the events list scrolls between the top and the control bar:
       it fades out at both ends (user, 2026-10-31: the items were cut off
       sharply there), its first and last items clear of the fades at rest -
       the first one also below the cameras chevron, which stays put. */
    ha-card.panel.phone.upright .fs-events-list {
      top: calc(var(--upc-fs-pad, 20px) + env(safe-area-inset-top, 0px));
      --upc-fs-list-pad-top: ${FS_LIST_FADE}px;
      --upc-fs-list-pad-bottom: ${FS_LIST_FADE}px;
      -webkit-mask-image: linear-gradient(
        to bottom,
        transparent,
        #000 ${FS_LIST_FADE}px,
        #000 calc(100% - ${FS_LIST_FADE}px),
        transparent
      );
      mask-image: linear-gradient(
        to bottom,
        transparent,
        #000 ${FS_LIST_FADE}px,
        #000 calc(100% - ${FS_LIST_FADE}px),
        transparent
      );
    }
    /* Sideways it scrolls on to the top of the screen (the frame's top: no
       safe area there), its first item where it was at rest. */
    ha-card.panel.phone.turned .fs-events-list {
      top: 0;
      --upc-fs-list-pad-top: var(--upc-fs-pad, 20px);
    }
    /* The date pill's calendar, compact: it opens over the pill inside a
       ~390px-tall screen (sideways) - and upright it hangs from the pill's
       right edge, which sits near the screen's. */
    ha-card.panel.phone .cal-pop.fs {
      width: 262px; /* 7 x 30px cells + 6 x 4px gaps + 2 x 14px padding */
      padding: 12px 14px;
    }
    ha-card.panel.phone .cal-pop.fs .cal-head {
      margin-bottom: 4px;
    }
    ha-card.panel.phone .cal-pop.fs .cal-title {
      font-size: 15px;
    }
    ha-card.panel.phone .cal-pop.fs .cal-chev {
      width: 32px;
      height: 32px;
    }
    ha-card.panel.phone .cal-pop.fs .cal-chev ha-icon {
      --mdc-icon-size: 22px;
    }
    ha-card.panel.phone .cal-pop.fs .cal-cell {
      max-width: 30px;
      font-size: 14px;
    }
    ha-card.panel.phone .cal-pop.fs .cal-wk {
      height: 20px;
      font-size: 12px;
    }
    ha-card.panel.phone.upright .cal-pop.fs {
      left: auto;
      right: 0;
      translate: none;
      transform-origin: 85% 100%;
    }
    /* The camera screen's calendar (phone and tablet): in the middle of the
       screen over the picture dimmed, the player's chrome faded away (user,
       2026-10-28/30: it covered the ruler, then the tablet's play controls)
       - it flies out of the date pill and back (_calFlight). Solid: nothing
       shows through it. */
    .cal-modal {
      position: absolute;
      inset: 0;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .cal-scrim {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
    }
    ha-card.panel .cal-modal > .cal-pop.fs {
      position: relative;
      left: auto;
      right: auto;
      bottom: auto;
      translate: none;
      animation: none;
      background: rgb(28, 28, 30);
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
    }
    /* Panel handles: thin, rounded UniFi/Apple-style chevrons straight on the
       footage, a soft shadow keeping them readable on any picture. Each turns
       to point back while its panel is open. */
    .fs-chev {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      margin: 0;
      border: none;
      background: transparent;
      color: #fff;
      cursor: pointer;
      pointer-events: auto;
      outline: none;
      isolation: isolate; /* its shade (::before) stays behind its glyph */
      -webkit-tap-highlight-color: transparent;
    }
    /* A soft dark shade behind each chevron, so it reads on bright footage
       too (user, 2026-10-31) - the same kind of radial shade the play
       controls sit on; no blur. */
    .fs-chev::before {
      content: '';
      position: absolute;
      inset: -12px;
      z-index: -1;
      border-radius: 50%;
      background: radial-gradient(closest-side, rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0.32) 55%, transparent);
      pointer-events: none;
    }
    .fs-chev svg {
      display: block;
      fill: none;
      stroke: currentColor;
      stroke-width: 3.2;
      stroke-linecap: round;
      stroke-linejoin: round;
      filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.85));
      transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    /* Camera picker: a sheet sliding down from the top edge. Closed, only its
       foot — the chevron, top middle — is on screen. Same shadow as the
       timeline strip, falling from the top: solid under the tiles, fading out
       below them. The active camera reads in the overlay's deep accent. */
    .fs-cams {
      display: flex;
      flex-direction: column;
      transform: translateY(calc(-100% + 46px)); /* the foot's height */
      transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .fs-cams.open {
      transform: none;
    }
    .fs-cams-body {
      padding: 18px 16px 4px;
      background: rgba(0, 0, 0, 0.88);
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: auto;
    }
    .fs-cams-foot {
      position: relative;
      display: flex;
      justify-content: center;
      height: 46px;
    }
    .fs-cams-foot::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 90px;
      background: linear-gradient(to bottom, rgba(0, 0, 0, 0.88), transparent);
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;
    }
    .fs-cams.open .fs-cams-body,
    .fs-cams.open .fs-cams-foot::before {
      opacity: 1;
    }
    .fs-cams-row {
      display: flex;
      gap: 14px;
      justify-content: safe center;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .fs-cams-row::-webkit-scrollbar {
      display: none;
    }
    /* Read across the room: bigger names, and a heavier frame on the active
       camera than the timeline view's 5px. */
    .fs-cams .cam-name {
      font-size: 18px;
      margin-top: 6px;
    }
    .fs-cams .cam-tile.active {
      background: var(--upc-accent-deep, rgb(106, 66, 102));
      padding: 9px;
      border-radius: 16px;
    }
    .fs-cams .cam-tile.active img,
    .fs-cams .cam-tile.active .cam-ph {
      border-radius: 8px; /* concentric inside the 16px frame */
    }
    .fs-cams .cam-tile.active .cam-name {
      color: #fff;
      margin-top: 6px;
    }
    .fs-cams-handle {
      position: relative; /* above the foot's shadow */
      width: 88px;
      height: 40px;
      margin-top: 6px; /* clear of the top edge */
    }
    .fs-cams-handle svg {
      width: 40px;
      height: 14px;
    }
    .fs-cams.open .fs-cams-handle svg {
      transform: rotate(180deg);
    }
    /* Events: a panel sliding in from the right edge while the strip and the
       controls make way (media-view fsSide). Closed, only its handle — hung off
       its left edge — is on screen, at the middle of the right edge. The
       strip's shadow carries on left of it, so the two read as one. */
    .fs-events {
      position: relative;
      width: var(--upc-side-w, 337px);
      height: 100%;
      transform: translateX(100%);
      transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .fs-events.open {
      transform: none;
    }
    .fs-events-body {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.88);
      pointer-events: auto;
    }
    .fs-events-list {
      position: absolute; /* the events (upc-event-strip) fill it */
      top: var(--upc-fs-pad, 60px); /* starts level with the ruler */
      bottom: 0;
      left: 12px;
      right: 12px;
    }
    .fs-events-list > upc-event-strip {
      height: 100%;
    }
    .fs-events-handle {
      position: absolute;
      right: calc(100% + 10px); /* clear of the right edge (or the open panel) */
      top: 50%;
      width: 40px;
      height: 88px;
      transform: translateY(-50%);
    }
    .fs-events-handle svg {
      width: 14px;
      height: 40px;
    }
    .fs-events.open .fs-events-handle svg {
      transform: rotate(180deg);
    }
    /* Date pill at the foot of the overlay ruler (the timeline's foot slot:
       level with the jump-to-live arrow, centred under the playhead pill) —
       the timeline view's pill in the overlay's colours. Its calendar opens
       upward, centred over it. */
    .fs-datebox {
      position: relative;
    }
    .date-pill.fs {
      position: relative;
      left: auto;
      bottom: auto;
      color: #fff;
      background: var(--upc-accent-deep, rgba(0, 0, 0, 0.6));
      white-space: nowrap;
      outline: none;
    }
    .cal-pop.fs {
      left: 50%;
      right: auto;
      translate: -50% 0; /* (not transform: the pop-in animates scale) */
      bottom: calc(100% + 12px);
      width: 366px; /* 7×44px cells + 6×4px gaps + 2×16px padding */
      background: rgba(0, 0, 0, 0.82);
      -webkit-backdrop-filter: blur(8px);
      backdrop-filter: blur(8px);
      /* Pops out of the date pill under it, iOS-menu style (and shrinks back
         into it - _closeCal). */
      transform-origin: 50% 100%;
      animation: upc-cal-in 0.34s cubic-bezier(0.25, 0.8, 0.3, 1);
    }
    @keyframes upc-cal-in {
      from {
        opacity: 0;
        scale: 0.9;
      }
    }
    .cal-pop.fs .cal-day.sel {
      color: #000; /* on the bright accent */
    }
    /* Stacked layout (phones): video on top, timeline/events full-width below.
       DOM order stays timeline-col -> video-col (so 'columns' is unchanged); we
       reorder visually with the order property. Video height = --upc-video-frac. */
    .row.stacked {
      flex-direction: column;
    }
    .row.stacked > .video-col {
      flex: 0 0 var(--upc-video-frac, 45%);
      order: 0;
      min-height: 0;
    }
    .row.stacked > .timeline-col {
      flex: 1 1 auto;
      order: 1;
      width: 100%;
      min-width: 0;
      min-height: 0;
    }
    .legend {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      font-size: 11px;
      color: var(--secondary-text-color);
      padding: 0 2px;
    }
    .legend span {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .legend i {
      width: 10px;
      height: 10px;
      border-radius: 2px;
      display: inline-block;
    }
  `;

  public setConfig(config: CardConfig): void {
    if (config.card_version === 'multi') {
      // Multi page: `cameras:` is the source of truth; `camera` defaults to the
      // first entry so shared machinery (nvr_id auto-resolve, loader) keeps
      // working without extra YAML.
      const first = (config.cameras ?? [])
        .map((c) => (typeof c === 'string' ? c : c?.camera))
        .find((c) => !!c);
      if (!first) {
        throw new Error(
          'unifi-protect-timeline-card: card_version: multi requires a non-empty "cameras" list',
        );
      }
      config = config.camera ? config : { ...config, camera: first };
    } else if (!config.camera) {
      throw new Error('unifi-protect-timeline-card: "camera" (a camera entity_id) is required');
    }
    this._config = config;
    if (config.debug) enableDebug(() => this.hass);
    this._activeCamera = config.camera;
    this._drill = undefined;
    this._galleryOpen = false;
    this._closeCal();
    this._inited = false; // re-init domain on config change
  }

  private get _isMulti(): boolean {
    return this._config?.card_version === 'multi';
  }

  // Multi page, wide layout: the header row's "Events (N) >" and grid-density
  // control (state reported by the page).
  @state() private _multiHead: MultiHead = {
    loaded: false,
    count: 0,
    expanded: false,
    gridView: 2,
    liveGrid: true,
  };

  private _toggleMultiEvents = (): void => {
    this.renderRoot.querySelector<MultiView>('upc-multi-view')?.toggleExpand();
  };

  private _setMultiGridView(n: number): void {
    this.renderRoot.querySelector<MultiView>('upc-multi-view')?.setGridView(n);
  }

  public getCardSize(): number {
    return 6;
  }

  // In-card back button. Drilled into a camera from the multi page → return
  // to the multi page (in-card, keeps a hosting popup open). Otherwise →
  // previous view/page via the browser history — EXCEPT when this view is the
  // FIRST page of the session (deep link / companion-app cold start restoring
  // its last path): there is no in-app history to pop, history.back() would
  // silently do nothing and the user would be stuck (subviews have no other
  // navigation). With no stack to pop — or a pop that changed nothing after a
  // beat — navigate to the fallback path instead.
  private _goBack = (): void => {
    if (this._isMulti && this._drill) {
      if (this._xf !== 'out') void this._zoomOut();
      return;
    }
    // Explicit destination wins over the history entirely (deterministic back).
    const direct = this._config?.back_button_path;
    if (direct) {
      navigate(direct);
      return;
    }
    const fallback =
      this._config?.back_fallback_path ||
      `/${window.location.pathname.split('/')[1] ?? ''}`; // the dashboard's default view
    if (window.history.length <= 1) {
      navigate(fallback);
      return;
    }
    const before = window.location.href;
    window.history.back();
    window.setTimeout(() => {
      if (window.location.href === before && this.isConnected) navigate(fallback);
    }, 400);
  };

  /** Multi page → full single-camera timeline, in-card (slide in from the
   *  right). Same per-camera reset as _selectCamera + the single-mode init
   *  that _init() skips for multi. */
  /** `at`: open at that moment and play on from it instead of opening live —
   *  the multi page's clip player hands off here when its fullscreen button is
   *  pressed, so the fullscreen timeline continues the clip where it was. */
  private _drillTo(camera: string, fullscreen = false, at?: number, from?: ZoomSource): void {
    this._xfToken++; // a zoom still running is superseded
    this._xf = null;
    this._drill = camera;
    this._activeCamera = camera;
    this._nvrId = this._resolveNvrId();
    this._loader.cancelAll();
    this._manifestBands = [];
    this._gaps = [];
    this._gapsAt = 0;
    this._preMs = 0;
    this._postMs = 0;
    this._lastSyncTrigger = 0;
    this._resetToLive();
    if (at !== undefined && this._domain && at < Date.now() - 3_000) {
      // Same state a deliberate seek leaves behind (see _onRewind): not live,
      // no clip, the ruler centred on `at` — continuous playback starts there.
      this._liveMode = false;
      this._targetTime = at;
      this._domain = domainForPlayhead(at, spanOf(this._domain), this._phFrac());
    }
    void this._fetchGaps(true);
    void this._fetchManifest();
    // Zoom open out of what was tapped; with nothing to zoom from, slide in -
    // except a fullscreen drill, which appears in place.
    if (from) {
      this._swapDir = 0;
      void this._zoomIn(from);
    } else {
      this._swapDir = fullscreen ? 0 : 1;
    }
  }

  /** What a camera-screen flight moves - the tablet's panel itself, the
   *  phone's frame inside it - and the angle it stands at (90: sideways). */
  private _flyer(panel: HTMLElement): { el: HTMLElement; angle: number } {
    const frame = panel.querySelector<HTMLElement>(':scope > .frame');
    if (!frame) return { el: panel, angle: 0 };
    return { el: frame, angle: panel.classList.contains('turned') ? 90 : 0 };
  }

  /** A screen rect in the coordinates of a flyer's own layer (its .hero,
   *  which fills it): plain offsets, or - the phone's sideways frame - turned
   *  back with it. */
  private _layerBox(fly: { el: HTMLElement; angle: number }, r: DOMRect): Box {
    const f = fly.el.getBoundingClientRect();
    return fly.angle
      ? turnedLocal(r, f, fly.el.offsetWidth, fly.el.offsetHeight)
      : { x: r.left - f.left, y: r.top - f.top, w: r.width, h: r.height };
  }

  /** A camera picked in the camera screen's picker: its picture flies out of
   *  the tile into the screen as the picker closes, and stays there (the
   *  player's poster) until the camera's first frame. */
  private async _pickCamera(camera: string, tile: HTMLElement): Promise<void> {
    if (camera === this._activeCamera) {
      this._closeCamSheet();
      return;
    }
    const img = tile.querySelector('img');
    const picture = img?.currentSrc || img?.src;
    const panel0 = this.renderRoot.querySelector<HTMLElement>('ha-card.panel');
    const fly0 = panel0 ? this._flyer(panel0) : undefined;
    // Where the picture starts, in the layer it flies in (the tile is in the
    // same screen, so in the same - possibly sideways - coordinates).
    const src = img && picture && fly0 ? this._layerBox(fly0, img.getBoundingClientRect()) : null;
    const token = ++this._xfToken;
    this._panelPoster = undefined;
    this._selectCamera(camera);
    this._closeCamSheet();
    if (!src || !picture || !fly0) return;
    await this.updateComplete;
    const panel = this.renderRoot.querySelector<HTMLElement>('ha-card.panel');
    const mv = panel?.querySelector('upc-media-view') as MediaView | null;
    const layer = panel?.querySelector('.hero');
    if (token !== this._xfToken || !panel || !mv || !layer) return;
    const fly = this._flyer(panel);
    // The phone's screen turned (or stood up) for the new camera's footage:
    // the frame changed shape under the tile, so it fades in instead.
    if (fly.angle !== fly0.angle) {
      fly.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ZOOM_MS, easing: 'ease-out' });
      return;
    }
    await mv.updateComplete;
    const vb = mv.videoBox(); // the media view fills the layer: the same coordinates
    const ghost = document.createElement('img');
    ghost.src = picture;
    ghost.className = 'ghost';
    Object.assign(ghost.style, { left: `${vb.x}px`, top: `${vb.y}px`, width: `${vb.w}px`, height: `${vb.h}px` });
    layer.append(ghost);
    await zoom(ghost, src, vb, { x: 0, y: 0, w: vb.w, h: vb.h }).finished.catch(() => undefined);
    // Landed: the player shows the same picture in the same place (it fades
    // in under the ghost, which then goes).
    if (token === this._xfToken) this._panelPoster = picture;
    setTimeout(() => ghost.remove(), 300);
  }

  /** The camera screen zooms open out of `from` (see _xf) - turning as it
   *  grows, into the phone's sideways screen. */
  private async _zoomIn(from: ZoomSource): Promise<void> {
    const token = ++this._xfToken;
    // Measured now, while the page is as tapped (screen coordinates). A tile
    // half scrolled away: out of the part of it that was on screen.
    const o = this.getBoundingClientRect();
    const s = sourceBox(from, this);
    const view = from.view ? boxOf(from.view, this) : null;
    const start = (view && clipBox(s, view)) || s;
    const src = { x: start.x + o.left, y: start.y + o.top, w: start.w, h: start.h };
    this._panelPoster = from.poster;
    this._panelChromeHidden = true;
    this._xf = 'in';
    await this.updateComplete;
    const panel = this.renderRoot.querySelector<HTMLElement>('ha-card.panel');
    const mv = panel?.querySelector('upc-media-view') as MediaView | null;
    if (token !== this._xfToken || !panel || !mv) return this._settleZoom(token);
    await mv.updateComplete;
    const fly = this._flyer(panel);
    // A clip handed off flies its picture onto the same picture; otherwise
    // the whole screen grows out of what was tapped (dissolving out of it).
    const content = from.poster
      ? mv.videoBox()
      : { x: 0, y: 0, w: fly.el.offsetWidth, h: fly.el.offsetHeight };
    const run = turnZoom(fly.el, src, content, fly.angle);
    this.renderRoot
      .querySelector('.xf-dim')
      ?.animate([{ opacity: 0 }, { opacity: XF_DIM }], { duration: ZOOM_MS, easing: iosEase(), fill: 'forwards' });
    await run.finished.catch(() => undefined);
    this._settleZoom(token);
  }

  private _settleZoom(token: number): void {
    if (token !== this._xfToken) return;
    this._xf = null;
    this._panelChromeHidden = false; // the controls fade in
  }

  /** The camera screen zooms back into where it came from (the clip it was
   *  opened from, else its camera's live tile) - or, with neither on screen,
   *  shrinks away - over the multi page coming back under it. */
  private async _zoomOut(): Promise<void> {
    const token = ++this._xfToken;
    const camera = this._activeCamera;
    const panel = this.renderRoot.querySelector<HTMLElement>('ha-card.panel');
    const mv = panel?.querySelector('upc-media-view') as MediaView | null;
    if (!panel || !mv) {
      this._drillOut(true);
      return;
    }
    const fly = this._flyer(panel);
    const content = mv.videoBox();
    this._panelChromeHidden = true;
    this._xf = 'out';
    await this.updateComplete;
    const multi = this.renderRoot.querySelector('upc-multi-view') as MultiView | null;
    const target = multi ? await multi.zoomTarget(camera) : null;
    if (token !== this._xfToken) return;
    // A tile half scrolled away: into the part of it on screen (screen
    // coordinates).
    const box = target ? rectBox(target.el.getBoundingClientRect()) : null;
    const end = box && target?.view ? clipBox(box, rectBox(target.view.getBoundingClientRect())) : box;
    let run: Animation;
    if (end) {
      // ...its picture dissolving into the tile / thumbnail as it lands (and
      // standing back up, on the phone).
      run = turnZoom(fly.el, end, content, fly.angle, { out: true });
    } else {
      const rest = `rotate(${fly.angle}deg)`;
      run = fly.el.animate(
        [
          { opacity: 1, transform: `${rest} scale(1)` },
          { opacity: 0, transform: `${rest} scale(0.94)` },
        ],
        { duration: ZOOM_MS, easing: iosEase(), fill: 'forwards' },
      );
    }
    this.renderRoot
      .querySelector('.xf-dim')
      ?.animate([{ opacity: XF_DIM }, { opacity: 0 }], { duration: ZOOM_MS, easing: iosEase(), fill: 'forwards' });
    await run.finished.catch(() => undefined);
    if (token !== this._xfToken) return;
    this._xf = null;
    this._panelChromeHidden = false;
    this._panelPoster = undefined;
    this._drillOut(true);
  }

  /** Drilled timeline → back to the multi page (slide in from the left). */
  private _drillOut(skipAnim = false): void {
    this._drill = undefined;
    this._activeCamera = this._config?.camera ?? '';
    this._loader.cancelAll(); // in-flight thumbnails belong to the drilled camera
    this._swapDir = skipAnim ? 0 : -1;
  }

  /** The camera screen IS the (card-sized) fullscreen, on both layouts: its
   *  exit button goes back - to the multi page, or the configured back
   *  target. */
  private _onMediaFsExit = (): void => {
    this._goBack();
  };

  // The mounted ruler(s) - the overlay is SLOTTED into the media view but
  // still lives in this shadow root, so one query finds it.
  @queryAll('upc-scrubber-timeline') private _timelines!: NodeListOf<ScrubberTimeline>;

  /** Where the playhead sits down the strip. Lower on the phone's camera
   *  screen so the active event's thumbnail clears the top fade (see
   *  PHONE_FS_PLAYHEAD_FRAC). ONE value for the card's domain math and the
   *  timeline — they must agree, or the marker and the footage drift apart. */
  private _phFrac(): number {
    // (Measured only: an unmeasured card counts as stacked - see _isStacked.)
    return this._hostWidth && this._phoneScreen() ? PHONE_FS_PLAYHEAD_FRAC : PLAYHEAD_FRAC;
  }

  /** The phone's camera screen (stacked layout) turns sideways for landscape
   *  footage on an upright phone - you turn the phone to watch (iOS can't lock
   *  the orientation from a web page) - and stays upright for PORTRAIT footage,
   *  which would play sideways in a small band. Decided by the camera's own
   *  resolution (its entity's width/height, else the video's), never per
   *  camera; unknown footage turns. A landscape window never turns. */
  private _phoneTurned(): boolean {
    if (!this._isStacked() || window.innerHeight <= window.innerWidth) return false;
    const size = this._footageSize(this._activeCamera || this._config?.camera || '');
    return !(size && size[1] > size[0]);
  }

  /** A camera's footage size: its entity's resolution (what the player shows),
   *  else the camera screen's video once it has a frame. */
  private _footageSize(cameraId: string): [number, number] | undefined {
    const attrs = this.hass?.states?.[cameraId]?.attributes as
      | { width?: unknown; height?: unknown }
      | undefined;
    const w = Number(attrs?.width) || 0;
    const h = Number(attrs?.height) || 0;
    if (w > 0 && h > 0) return [w, h];
    const mv = this.renderRoot?.querySelector('ha-card.panel upc-media-view') as MediaView | null;
    return mv?.footageSize();
  }

  /** Does `cameraId` have a speaker (Talk button)? Cached per camera against
   *  the entity registry snapshot — render() runs on every scrub pointermove,
   *  and the check walks the whole registry. */
  private _talkCache?: { entities: unknown; camera: string; can: boolean };
  private _canTalk(cameraId: string): boolean {
    const entities = this.hass?.entities;
    const c = this._talkCache;
    if (c && c.entities === entities && c.camera === cameraId) return c.can;
    const can = cameraCanTalk(this.hass, cameraId);
    this._talkCache = { entities, camera: cameraId, can };
    return can;
  }

  /** The phone's camera screen kept UPRIGHT (portrait footage, see
   *  _phoneTurned): the ruler runs down the right edge of a ~390px-wide screen
   *  instead of along the turned screen's ~840px one, so its lane is slimmer. */
  private _fsUpright(): boolean {
    return this._isStacked() && !this._phoneTurned();
  }

  /** Clearance the fullscreen ruler keeps from the top/bottom screen edges.
   *  Per layout — see the block in render(), its only caller. */
  private _fsPad(): number {
    return this._config?.fs_timeline_padding ?? (this._phoneScreen() ? 20 : 60);
  }

  /** The lane between the ruler and the right screen edge — it has to fit the
   *  zoom control and the jump-to-live arrow with room to breathe. On a phone
   *  that edge is also iOS's system-gesture strip: a button sitting in it never
   *  receives the touch at all, so the lane is wide enough to keep the whole
   *  control column clear of it. (Upright, that edge is a plain screen edge —
   *  iOS's strip is the bottom one — so the lane only has to fit the controls.) */
  private _fsGutter(): number {
    if (this._config?.fs_timeline_gutter !== undefined) return this._config.fs_timeline_gutter;
    if (this._fsUpright()) return FS_UPRIGHT_GUTTER;
    return this._phoneScreen() ? 110 : 140;
  }

  static getStubConfig(): CardConfig {
    return {
      type: 'custom:unifi-protect-timeline-card',
      card_version: 'single',
      camera: 'camera.front_door',
      cameras: [],
      strip_title: 'Events',
      mobile_events_thumbnail_size: 0,
      tablet_events_thumbnail_size: 145,
      tablet_events_grid_thumbnail_size: 218,
      strip_time_size: 12,
      grid_aspect: '16/9',
      page_background: '',
      calendar_days: 30,
      nvr_id: '',
      layout: 'auto',
      layout_breakpoint: 600,
      video_ratio: 0.45,
      video_aspect: '',
      height: '',
      back_button: false,
      back_button_size: 38,
      back_button_path: '',
      back_fallback_path: '',
      fs_close_button: false,
      title: 'UniFi Protect Timeline',
      title_font_size: 24,
      title_font_color: '',
      title_font_weight: 500,
      default_timeline_zoom: 100,
      live_audio_start: 'muted',
      scrub_settle_ms: 700,
      timeline_font_size: 12,
      timeline_font_color: '#d0d0d0',
      date_font_size: 13,
      date_font_color: '#ffffff',
      accent_color: '#fc9df3',
      toggle_bg: '',
      toggle_active_bg: '',
      toggle_active_color: '',
      toggle_text_color: '',
      list_divider_color: '',
      arrow_color: 'rgba(0,0,0,0.6)',
      live_arrow_bottom: 14,
      tick_color: '#4f4f4f',
      tick_size: 8,
      recorded_color: '#6e476a',
      future_color: '#7a7a84',
      show_footage_gaps: true,
      talk_button: true,
      debug: false,
      gap_color: '#4a4a52',
      thumb_size: 87,
      thumb_size_active: 105,
      event_merge_gap_seconds: 60,
      list_text_size: 12,
      list_text_color: '',
      list_duration_color: '',
      list_active_text_size: 12,
      list_active_text_color: '#000',
      list_active_duration_size: 12,
      list_active_duration_color: '#000',
      list_active_bg: '#fff',
      thumbnail_concurrency: 2,
      thumbnail_cache_dir: '',
      scrub_preview: true,
      scrub_preview_dir: '',
      scrub_fast_preview: 'speed',
      fs_timeline: true,
      fs_timeline_width: 165,
      fs_timeline_grab_width: 0,
      fs_timeline_padding: 60,
      fs_timeline_gutter: 140,
      fs_timeline_scrim: 0.88,
      fs_timeline_scrim_extend: 170,
    };
  }

  // page_background bookkeeping (see connectedCallback).
  private _pageBgApplied = false;
  private _scrubPreviewScheduler = new LatestValueScheduler<number>(
    SCRUB_PREVIEW_INTERVAL_MS,
    (time) => {
      this._targetTime = time;
    },
  );

  /** page_background: pin the page canvas (<html>) to the configured color for
   *  this card's lifetime. The canvas is what shows through while HA's
   *  view-transition helpers fade the view container (the view's own
   *  background fades WITH the container) — on themes whose canvas is lighter
   *  than the card views, that reads as a flicker between two dark views. */
  private _applyPageBackground(): void {
    const bg = this._config?.page_background;
    if (!bg) return;
    const el = document.documentElement;
    if (pageBgCount === 0) pageBgPrev = el.style.backgroundColor;
    pageBgCount++;
    el.style.backgroundColor = bg;
    this._pageBgApplied = true;
  }

  private _removePageBackground(): void {
    if (!this._pageBgApplied) return;
    this._pageBgApplied = false;
    pageBgCount--;
    if (pageBgCount <= 0) {
      pageBgCount = 0;
      document.documentElement.style.backgroundColor = pageBgPrev;
    }
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._applyPageBackground();
    this._tick = setInterval(() => this._onTick(), 1_000);
    this._bandInterval = setInterval(() => {
      // The multi PAGE fetches its own manifests; a drilled-in timeline uses
      // the normal single-camera refresh below.
      if (this._isMulti && !this._drill) return;
      void this._fetchGaps(true);
      void this._fetchManifest();
    }, BAND_REFRESH_MS);
    this._hostRo = new ResizeObserver((entries) => {
      const r = entries[entries.length - 1].contentRect;
      const w = Math.round(r.width);
      const h = Math.round(r.height);
      if (w && w !== this._hostWidth) this._hostWidth = w;
      if (h && h !== this._hostHeight) this._hostHeight = h;
    });
    this._hostRo.observe(this);
    // Re-entry: a single-camera timeline that was navigated away from and back
    // (a cached subview re-shown, e.g. house → camera → back → camera) keeps
    // its last state (Events/list mode, a played clip, a scrubbed-back time).
    // It must ALWAYS reopen on LIVE and forget the previous session. Skip the
    // very first mount (updated() → _init handles it) and the multi page (which
    // owns its own state via <upc-multi-view>).
    if (this.hasUpdated && this._config && !this._isMulti) {
      this._resetToLive();
      void this._fetchGaps(true);
      void this._fetchManifest();
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._removePageBackground();
    clearInterval(this._tick);
    clearInterval(this._bandInterval);
    clearTimeout(this._syncRefetchTimer);
    // A pending settle is a release that already HAPPENED — commit it rather
    // than drop it, or `_scrubbing` stays true and the view comes back parked on
    // the scrub preview's frozen frame (the multi page keeps its state across a
    // re-attach, so nothing else would clear it).
    clearTimeout(this._scrubSettleTimer);
    const commit = this._pendingScrubCommit;
    this._pendingScrubCommit = undefined;
    commit?.();
    this._scrubPreviewScheduler.reset();
    this._hostRo?.disconnect();
    window.removeEventListener('pointerdown', this._outsideCalClose, true);
    window.removeEventListener('pointerdown', this._outsideSheetClose, true);
    this._loader.cancelAll(); // nothing will consume in-flight snapshots anymore
  }

  protected updated(changed: PropertyValues): void {
    if ((changed.has('hass') || changed.has('_config')) && this.hass && this._config && !this._inited) {
      this._init();
    }
    if (changed.has('_xf')) {
      if (this._xf) this.setAttribute('xf', this._xf);
      else this.removeAttribute('xf');
    }
    if (changed.has('_calOpen') && this._calOpen) this._calFlight(true);
    // Drill swap: slide the freshly-rendered page in over the old one's spot
    // (in from the right when drilling into a camera, from the left on the
    // way back) — an iOS push/pop entirely inside the card, so a hosting
    // bubble popup never closes and no HA view machinery is involved.
    if (this._swapDir) {
      const dir = this._swapDir;
      this._swapDir = 0;
      this.renderRoot.querySelector('ha-card')?.animate(
        [{ transform: `translateX(${dir * 100}%)` }, { transform: 'translateX(0)' }],
        { duration: 450, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      );
    }
  }

  private _init(): void {
    this._inited = true;
    // Multi page: <upc-multi-view> owns all fetching/state; none of the
    // timeline machinery (domain, gaps, manifest) applies.
    if (this._isMulti) return;
    this._nvrId = this._resolveNvrId();
    this._resetToLive();
    void this._fetchGaps(true);
    void this._fetchManifest();
  }

  /** Reset the single-camera timeline to a fresh LIVE session — forget the
   *  previous mode / played clip / scrub position so the view ALWAYS opens on
   *  live no matter how it was entered (first mount, in-card drill from the
   *  multi page, or a cached subview re-shown). Camera data re-fetches. */
  private _resetToLive(): void {
    this._mode = 'timeline';
    this._closeCamSheet();
    this._eventsOpen = false;
    this._calOpen = false;
    this._now = Date.now();
    this._domain = domainForPlayhead(this._now, this._initialSpan(), this._phFrac());
    this._targetTime = this._now;
    this._scrubbing = false;
    this._liveMode = true;
    this._livePaused = false;
    this._playingBand = undefined;
    this._clearClip();
  }

  /** Server-side cache dir: explicit config, else /protect_thumbs/<cam id>.
   *  The explicit dir only applies to the CONFIG camera — when the gallery strip
   *  switched to another camera, its cache dir must be derived from that
   *  camera's object_id or every camera would share one manifest. */
  private _cacheDir(): string {
    if (this._config?.thumbnail_cache_dir && this._activeCamera === this._config.camera) {
      return this._config.thumbnail_cache_dir;
    }
    const obj = this._activeCamera?.split('.')[1];
    return obj ? `${THUMBS_BASE}/${obj}` : '';
  }

  /** Scrub-preview cache dir (pyscript protect_scrub job): explicit config for
   *  the CONFIG camera, else /protect_scrub/<object_id> — same per-camera
   *  derivation as _cacheDir. Empty string = preview disabled. */
  private _scrubDir(): string {
    if (this._config?.scrub_preview === false) return '';
    if (this._config?.scrub_preview_dir && this._activeCamera === this._config.camera) {
      return this._config.scrub_preview_dir;
    }
    const obj = this._activeCamera?.split('.')[1];
    return obj ? `${SCRUB_BASE}/${obj}` : '';
  }

  /** Load the event manifest (the NVR's own event list, mirrored by the pyscript
   *  sync job). Cheap static file. If it's missing or stale (job not running /
   *  not run yet), ask the sync service to run now — that's the "event exists on
   *  the NVR but isn't cached yet" retrieval path. */
  private async _fetchManifest(): Promise<void> {
    const dir = this._cacheDir();
    if (!dir) return;
    const cam = this._activeCamera; // guard: drop the result if the strip switched cameras
    const loaded = await loadManifest(dir);
    if (cam !== this._activeCamera) return;
    if (loaded) {
      this._preMs = loaded.preMs;
      this._postMs = loaded.postMs;
      // Consolidate raw events into UniFi-style display groups: activity
      // with gaps under event_merge_gap_seconds reads as ONE event (one
      // bar, one list row), exactly like the Protect app.
      const gapMs = (this._config?.event_merge_gap_seconds ?? 60) * 1000;
      this._manifestBands = groupBands(loaded.entries.map(manifestToBand), gapMs);
      this._thumbVersion++; // re-render so cached thumbs appear
    }
    if (!loaded || loaded.stale) this._requestSync();
  }

  /** Fire the pyscript sync service (throttled) and re-check the manifest a few
   *  seconds later. No-ops silently when pyscript isn't installed. */
  private _requestSync(): void {
    if (!this.hass) return;
    const now = Date.now();
    if (now - this._lastSyncTrigger < SYNC_THROTTLE_MS) return;
    this._lastSyncTrigger = now;
    this.hass
      .callWS({ type: 'call_service', domain: 'pyscript', service: 'protect_thumbs_sync' })
      .catch(() => {
        /* pyscript not installed / service unavailable — the card still works,
           just without the local event cache */
      });
    clearTimeout(this._syncRefetchTimer);
    this._syncRefetchTimer = setTimeout(() => void this._fetchManifest(), 8_000);
  }

  /** Initial visible span: default_timeline_zoom (0–100) wins, else minutes. */
  private _initialSpan(): number {
    const zoom = this._config?.default_timeline_zoom;
    if (zoom != null) {
      const pct = Math.max(0, Math.min(100, zoom));
      // 0% = widest (last step), 100% = narrowest (first step).
      const idx = Math.round((1 - pct / 100) * (SPAN_STEPS.length - 1));
      return SPAN_STEPS[idx];
    }
    if (this._config?.default_span_minutes != null) {
      return clampSpan(this._config.default_span_minutes * MINUTE);
    }
    return SPAN_STEPS[0]; // default: fully zoomed in (narrowest span)
  }

  private _resolveNvrId(): string {
    if (this._config?.nvr_id) return this._config.nvr_id;
    const entry = this.hass?.entities?.[this._activeCamera || this._config!.camera];
    return entry?.config_entry_id ?? '';
  }

  // ---- camera gallery strip ------------------------------------------------

  /** Normalized `cameras:` entries (strings become { camera }). Empty when the
   *  option is absent -> single-camera card, no strip, no drag gesture. */
  private _cameraEntries(): CameraEntry[] {
    const raw = this._config?.cameras ?? [];
    return raw
      .map((c) => (typeof c === 'string' ? { camera: c } : c))
      .filter((c) => !!c?.camera);
  }

  /** The camera screen's events panel's items: this camera's events as the
   *  multi page's grid shows them (camera name, time · duration) - re-made
   *  only when the events or the camera change. */
  private _panelBands(cameraId: string): MultiBand[] {
    const memo = this._panelBandsMemo;
    if (memo?.bands === this._viewBands && memo.camera === cameraId) return memo.out;
    const out = tagBands(this._viewBands, cameraId, this._cameraName(cameraId));
    this._panelBandsMemo = { bands: this._viewBands, camera: cameraId, out };
    return out;
  }
  private _panelBandsMemo?: { bands: DetectionBand[]; camera: string; out: MultiBand[] };

  /** Display name for a camera: config override -> friendly_name -> object_id. */
  private _cameraName(entityId: string): string {
    const entry = this._cameraEntries().find((c) => c.camera === entityId);
    if (entry?.name) return entry.name;
    const fn = this.hass?.states[entityId]?.attributes?.friendly_name;
    if (typeof fn === 'string' && fn) return fn;
    return entityId.split('.')[1] ?? entityId;
  }

  /** Switch the whole card to another camera (gallery tap). Clears every
   *  per-camera slice of state, jumps to live, and refetches gaps + manifest
   *  (the cache dir follows the camera). Deliberately does NOT close the strip
   *  — only dragging UP on the video does. */
  private _selectCamera(entityId: string): void {
    if (entityId === this._activeCamera) return;
    this._activeCamera = entityId;
    this._nvrId = this._resolveNvrId();
    this._loader.cancelAll(); // in-flight thumbnails belong to the old camera
    this._manifestBands = [];
    this._gaps = [];
    this._gapsAt = 0;
    this._preMs = 0;
    this._postMs = 0;
    this._lastSyncTrigger = 0; // allow an immediate sync for the new camera
    // The timeline position CARRIES ACROSS the switch: watching 11:00 on one
    // camera and picking another shows 11:00 on that one, which is the whole
    // point of having several cameras on one ruler. Only a camera that was
    // showing live opens live. (The domain is left exactly as it is — the ruler
    // must not move under the user just because the picture changed.)
    if (this._liveMode || !this._domain) {
      this._onLive();
    } else {
      this._cancelSettle();
      this._playingBand = undefined; // the band belonged to the old camera
      this._clearClip(); // ...and so did any bounded event clip
      this._livePaused = false;
      this._scrubbing = false;
      this._targetTime = Math.min(playheadTimeOf(this._domain, this._phFrac()), Date.now());
    }
    void this._fetchGaps(true);
    void this._fetchManifest();
  }

  // ---- date pill + calendar popup -------------------------------------------

  private _toggleCal = (): void => {
    if (this._calOpen && this.renderRoot?.querySelector('.cal-pop.fs')?.getAnimations().length) {
      // Tapped again while it shrinks away: it opens again.
      this._calToken++;
      this._calClosing = false;
      this.renderRoot.querySelector('.cal-pop.fs')?.getAnimations().forEach((a) => a.cancel());
      window.addEventListener('pointerdown', this._outsideCalClose, true);
      return;
    }
    if (this._calOpen) {
      this._closeCal();
      return;
    }
    // Open on the month currently under the playhead.
    const d = new Date(this._domain ? playheadTimeOf(this._domain, this._phFrac()) : Date.now());
    this._calCursor = { y: d.getFullYear(), m: d.getMonth() };
    this._calOpen = true;
    // Added mid-dispatch: the opening tap's window CAPTURE phase already ran,
    // so this only sees the NEXT pointerdown.
    window.addEventListener('pointerdown', this._outsideCalClose, true);
  };

  private _closeCal(): void {
    window.removeEventListener('pointerdown', this._outsideCalClose, true);
    // The camera screen's calendar shrinks back into its date pill (it popped
    // out of it - see .cal-pop.fs); elsewhere it simply goes.
    // (Also called while the card sets up - before it has rendered at all.)
    const pop = this.renderRoot?.querySelector<HTMLElement>('.cal-pop.fs');
    if (!pop || !this._calOpen) {
      this._calOpen = false;
      return;
    }
    const token = ++this._calToken;
    // The player's chrome comes back as it goes, so the pill it shrinks into
    // is there when it lands.
    this._calClosing = true;
    const anim =
      this._calFlight(false) ??
      pop.animate([{ opacity: 1, scale: '1' }, { opacity: 0, scale: '0.92' }], {
        duration: 170,
        easing: 'ease-in',
        fill: 'forwards',
      });
    anim.finished
      .catch(() => undefined)
      .then(() => {
        if (token !== this._calToken) return;
        this._calOpen = false;
        this._calClosing = false;
      });
  }
  private _calToken = 0;
  @state() private _calClosing = false; // the calendar on its way out

  /** The phone's calendar (.cal-modal) between its date pill and the middle
   *  of the screen: opening, it grows out of the pill and the backdrop dims
   *  in; closing, it shrinks back into the pill as the backdrop clears.
   *  Undefined where there is no modal (the tablet's pops over its pill). */
  private _calFlight(open: boolean): Animation | undefined {
    const modal = this.renderRoot.querySelector<HTMLElement>('.cal-modal');
    const pop = modal?.querySelector<HTMLElement>('.cal-pop');
    const panel = this.renderRoot.querySelector<HTMLElement>('ha-card.panel');
    if (!modal || !pop || !panel) return undefined;
    const fill: FillMode = open ? 'none' : 'forwards';
    modal.style.pointerEvents = open ? '' : 'none'; // on its way out: taps go through
    const scrim = modal.querySelector('.cal-scrim');
    scrim?.getAnimations().forEach((a) => a.cancel());
    pop.getAnimations().forEach((a) => a.cancel());
    // The dimming follows the calendar: in quickly as it springs out, away
    // as it starts back (both decelerating - never a dark hold, then a drop).
    scrim?.animate([{ opacity: open ? 0 : 1 }, { opacity: open ? 1 : 0 }], {
      duration: open ? Math.round(POP_IN_MS * 0.7) : POP_OUT_MS,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fill,
    });
    // The pill sits in the (possibly sideways) screen: its box in the frame's
    // own coordinates, like the calendar's (the modal fills the frame).
    const pill = this.renderRoot.querySelector<HTMLElement>('.date-pill.fs')?.getBoundingClientRect();
    const at = { x: pop.offsetLeft, y: pop.offsetTop, w: pop.offsetWidth, h: pop.offsetHeight };
    // No pill to fly from (not laid out): the same springs, from a little
    // smaller in its own place.
    const src = pill?.width
      ? this._layerBox(this._flyer(panel), pill)
      : { x: at.x + at.w * 0.04, y: at.y + at.h * 0.04, w: at.w * 0.92, h: at.h * 0.92 };
    return popFlight(pop, src, at, { x: 0, y: 0, w: at.w, h: at.h }, open);
  }

  /** Close the calendar on any tap outside it (the pill itself is excluded so
   *  its own click handler can toggle instead of reopen). The closing tap is
   *  SWALLOWED — it must only dismiss the popup, never also seek the timeline
   *  or hit the video controls underneath. */
  private _outsideCalClose = (e: PointerEvent): void => {
    const path = e.composedPath();
    const pop = this.renderRoot.querySelector('.cal-pop');
    const pill = this.renderRoot.querySelector('.date-pill');
    if ((pop && path.includes(pop)) || (pill && path.includes(pill))) return;
    e.preventDefault();
    e.stopPropagation();
    swallowNextTap();
    this._closeCal();
  };

  /** Previous / next month: the month on show slides away and the new one
   *  slides in behind it, from the side it comes from - a copy of the old
   *  title and days leaves while the real ones, already showing the new
   *  month, come in (so quick taps simply chain). */
  private _calShift(delta: number): void {
    const pop = this.renderRoot.querySelector<HTMLElement>('.cal-pop');
    pop?.querySelectorAll('.cal-ghost').forEach((g) => g.remove());
    const parts = pop ? Array.from(pop.querySelectorAll<HTMLElement>('.cal-title, .cal-days')) : [];
    const dx = 28 * delta;
    for (const el of parts) {
      const ghost = el.cloneNode(true) as HTMLElement;
      ghost.classList.add('cal-ghost');
      Object.assign(ghost.style, { left: `${el.offsetLeft}px`, top: `${el.offsetTop}px`, width: `${el.offsetWidth}px` });
      pop!.append(ghost);
      ghost
        .animate(
          [
            { opacity: 1, transform: 'none' },
            { opacity: 0, transform: `translateX(${-dx}px)` },
          ],
          { duration: 200, easing: 'ease-in', fill: 'forwards' },
        )
        .finished.catch(() => undefined)
        .then(() => ghost.remove());
    }
    const d = new Date(this._calCursor.y, this._calCursor.m + delta, 1);
    this._calCursor = { y: d.getFullYear(), m: d.getMonth() };
    void this.updateComplete.then(() => {
      for (const el of parts) {
        el.getAnimations().forEach((a) => a.cancel());
        el.animate(
          [
            { opacity: 0, transform: `translateX(${dx}px)` },
            { opacity: 0, transform: `translateX(${dx}px)`, offset: 0.25 },
            { opacity: 1, transform: 'none' },
          ],
          { duration: 340, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
        );
      }
    });
  }

  /** Calendar day tap.
   *  Timeline view: jump the playhead to NOON of that day (today's noon may
   *  still be in the future -> just go live instead), reusing the scrub-end
   *  state transitions so playback starts exactly like a manual seek.
   *  Events view: scroll the LIST to that day's section and play the day's
   *  latest event (today = scroll to top + live) — never a bare noon seek. */
  private _selectCalDay(y: number, m: number, day: number): void {
    this._closeCal();
    if (!this._domain) return;
    this._cancelSettle(); // date jump overrides a pending settle
    const dayStart = new Date(y, m, day, 0, 0, 0, 0).getTime();
    if (this._mode === 'list') {
      const list = this.renderRoot.querySelector('upc-events-list') as EventsList | null;
      list?.scrollToDay(dayStart);
      const dayEnd = dayStart + 86_400_000;
      if (dayEnd > Date.now()) {
        this._onLive(); // today: newest content is live
        return;
      }
      let latest: DetectionBand | undefined;
      for (const b of this._viewBands) {
        if (b.start >= dayStart && b.start < dayEnd && (!latest || b.start > latest.start)) {
          latest = b;
        }
      }
      if (latest) this._playBand(latest); // highlights the row + plays its clip
      return;
    }
    // Noon - or, where the camera has no footage at noon, the nearest it has
    // that day (where it resumes after the gap, else the last of it before).
    const noon = new Date(y, m, day, 12, 0, 0, 0).getTime();
    const dayEnd = Math.min(Date.now(), new Date(y, m, day + 1).getTime());
    const t =
      footageStart(this._gaps) !== undefined ? (nearestFootage(this._gaps, dayStart, dayEnd, noon) ?? noon) : noon;
    if (t >= Date.now() - 20_000) {
      this._onLive();
      return;
    }
    this._playingBand = undefined;
    this._clearClip();
    this._scrubbing = false;
    this._livePaused = false;
    this._liveMode = false;
    this._targetTime = t;
    this._domain = domainForPlayhead(t, spanOf(this._domain), this._phFrac());
    void this._fetchGaps(false); // guard-gated; refetches when outside the buffer
  }

  // ---- live tick & band fetching -----------------------------------------

  private _onTick(): void {
    this._now = Date.now();
    // In live mode keep the playhead pinned to now (the live stream is now) —
    // BUT only while the live video is actually playing. If the user pauses it,
    // the frame freezes, so the playhead/LIVE marker must freeze too instead of
    // drifting ahead of the paused frame.
    if (this._liveMode && !this._scrubbing && !this._livePaused && this._domain) {
      this._domain = domainForPlayhead(this._now, spanOf(this._domain), this._phFrac());
    }
  }

  // The live <ha-camera-stream> is a black box; media-view watches its inner
  // <video> and tells us when it's paused/playing so we can freeze (or re-pin)
  // the playhead accordingly.
  private _onLivePlaying = (e: CustomEvent<{ playing: boolean }>): void => {
    this._livePaused = !e.detail.playing;
    // Resuming a paused live HLS stream jumps back to the live edge — snap the
    // playhead to now immediately (don't wait up to 1s for the next tick).
    if (e.detail.playing && this._liveMode && !this._scrubbing && this._domain) {
      this._now = Date.now();
      this._domain = domainForPlayhead(this._now, spanOf(this._domain), this._phFrac());
    }
  };

  /** Fetch the camera's recording gaps (the grey "no footage" spans) from its
   *  scrub index — every span the NVR holds no footage for, across the whole
   *  cache window, so panning needs no refetch. One small static file, NOT an
   *  NVR call, re-read at most every GAPS_REFRESH_MS (the job rewrites it every
   *  15 s) unless forced. (Events themselves come from the manifest — see
   *  _fetchManifest.) */
  private async _fetchGaps(force = false): Promise<void> {
    if (!this.hass || !this._domain) return;
    if (!(this._config?.show_footage_gaps ?? true)) return;
    const dir = this._scrubDir();
    const now = Date.now();
    if (!force && dir === this._gapsDir && now - this._gapsAt < GAPS_REFRESH_MS) return;
    this._gapsDir = dir;
    this._gapsAt = now;
    const gaps = await fetchFootageGaps(dir);
    if (dir !== this._scrubDir()) return; // camera switched while fetching
    this._gaps = gaps;
  }

  // ---- timeline events ----------------------------------------------------

  private _onScrubStart = (): void => {
    this._cancelSettle(); // new gesture supersedes a pending settle
    this._scrubPreviewScheduler.reset();
    this._scrubbing = true;
    // Deliberately does NOT leave live: merely grabbing the timeline must not
    // interrupt live playback — a gesture that only pushes against the live
    // edge (rubber-band) ends with `scrub-cancel` and live never stopped.
    // Actual scrub MOTION (`scrub`) is what leaves live / cancels a clip.
  };

  /** Gesture ended still pinned at the live edge (rubber-band): nothing was
   *  scrubbed, live playback was never interrupted — just drop the scrub flag. */
  private _onScrubCancel = (): void => {
    this._cancelSettle();
    this._scrubPreviewScheduler.reset();
    this._scrubbing = false;
  };

  private _onScrub = (e: CustomEvent<{ time: number }>): void => {
    this._cancelSettle();
    this._scrubbing = true;
    this._liveMode = false; // any scrub motion (incl. wheel/trackpad) leaves live now
    this._playingBand = undefined;
    this._clearClip();
    this._scrubPreviewScheduler.push(e.detail.time);
  };

  // Scrub settle: after a drag/flick release, wait a beat before starting the
  // export/playback — feels natural and avoids loading a clip the user is
  // about to scrub away from.
  private _scrubSettleTimer?: ReturnType<typeof setTimeout>;
  // The commit that timer will run. Kept so a detach can still COMMIT it: the
  // release already happened, and throwing it away left `_scrubbing` true for
  // good — the stage parked on the scrub preview's frozen frame after HA
  // re-attached the cached view.
  private _pendingScrubCommit?: () => void;

  /** Supersede a pending settle (a newer action decides the state instead). */
  private _cancelSettle(): void {
    clearTimeout(this._scrubSettleTimer);
    this._pendingScrubCommit = undefined;
  }

  private _onScrubEnd = (e: CustomEvent<{ time: number }>): void => {
    this._scrubPreviewScheduler.flush(e.detail.time);
    this._playingBand = undefined;
    this._cancelSettle();
    const commit = (): void => {
      this._pendingScrubCommit = undefined;
      this._scrubbing = false;
      this._clearClip();
      this._livePaused = false;
      // Released within ~3s of now => treat as live; otherwise historical, so a
      // small deliberate rewind (5s, 30s) plays a clip instead of snapping live.
      this._liveMode = Date.now() - e.detail.time < 3_000;
    };
    const delay = this._config?.scrub_settle_ms ?? 700;
    if (delay <= 0) commit();
    else {
      this._pendingScrubCommit = commit;
      this._scrubSettleTimer = setTimeout(commit, delay);
    }
  };

  private _onDomainChange = (e: CustomEvent<TimeDomain>): void => {
    this._domain = e.detail;
    // Guard-gated: no-ops while inside the buffer, fetches once near the edge.
    void this._fetchGaps(false);
  };

  private _onLive = (): void => {
    if (!this._domain) return;
    this._scrubPreviewScheduler.reset();
    this._cancelSettle(); // jump-to-live overrides a pending settle
    this._now = Date.now();
    const from = this._domain;
    const to = domainForPlayhead(this._now, spanOf(from), this._phFrac());
    this._domain = to;
    this._targetTime = this._now;
    // Held past the glide so the pill is still big when it flips to LIVE —
    // otherwise it shrinks at the exact moment the word appears.
    this._glideRulers(from, to, LIVE_GLIDE_HOLD_MS);
    this._scrubbing = false;
    this._liveMode = true;
    this._livePaused = false;
    this._playingBand = undefined;
    this._clearClip();
  };

  // The live view's "back 15s" control: drop out of live into delayed-follow at
  // the given time (mirrors a deliberate scrub-tap to that moment).
  private _onRewind = (e: CustomEvent<{ time: number }>): void => {
    this._rewindTo(e.detail.time);
  };

  /** Continuous footage from `t` — no clip, no seek bar, playing on — with the
   *  ruler gliding there. */
  private _rewindTo(t: number): void {
    if (!this._domain) return;
    this._scrubPreviewScheduler.reset();
    this._cancelSettle();
    this._liveMode = false;
    this._livePaused = false;
    this._scrubbing = false;
    this._playingBand = undefined;
    this._clearClip();
    this._targetTime = t;
    const from = this._domain;
    const to = domainForPlayhead(t, spanOf(from), this._phFrac());
    this._domain = to;
    this._glideRulers(from, to);
  }

  /** Wide camera screen's events panel: a row winds the timeline to the
   *  event's start and plays on from there — exactly what tapping its
   *  thumbnail on the ruler does (the timeline view's bounded clip is the
   *  phone's Events tab only). The row stays lit. */
  private _onPanelEventSelected = (e: CustomEvent<DetectionBand>): void => {
    this._rewindTo(Math.min(e.detail.start, Date.now()));
    this._playingBand = e.detail;
  };

  // The playing footage drives the timeline position/time (not the HASS clock):
  // the video is buffered/delayed, so we follow the actual frame being shown.
  // In live mode the playhead is pinned to now (by the tick), so skip.
  private _onPlaybackTime = (e: CustomEvent<{ time: number }>): void => {
    if (this._liveMode || this._scrubbing || !this._domain) return;
    const from = this._domain;
    const to = domainForPlayhead(e.detail.time, spanOf(from), this._phFrac());
    this._domain = to;
    // Playback normally advances this by a fraction of a second per tick, which
    // reads as continuous motion. The 15s skip buttons arrive on the SAME
    // channel as one big step — for the clip player and the follow engine alike,
    // since both just seek and report the new time. Glide the ruler across that
    // step instead of teleporting, the way tapping an event thumbnail does.
    const jump = Math.abs(
      playheadTimeOf(to, this._phFrac()) - playheadTimeOf(from, this._phFrac()),
    );
    if (jump >= SKIP_GLIDE_MIN_MS) this._glideRulers(from, to);
  };

  /** The skip buttons announce their target on the press. Move the ruler now,
   *  but do NOT feed that time back through the media-view's `targetTime`: the
   *  clip and follow players already own their seek, and treating it as a new
   *  external target destroys/rebuilds the active seekable clip session. */
  private _onPlaybackSeek = (e: CustomEvent<{ time: number }>): void => {
    if (!this._domain) return;
    const from = this._domain;
    const to = domainForPlayhead(e.detail.time, spanOf(from), this._phFrac());
    this._domain = to;
    this._glideRulers(from, to);
  };

  private _glideRulers(from: TimeDomain, to: TimeDomain, holdMs?: number): void {
    for (const t of this._timelines) t.glideDomain(from, to, holdMs);
  }

  /** Play one event's clip, padded with the camera's recording pre/post roll
   *  (from the manifest) so the player covers what the UniFi app plays. The
   *  listed duration stays the raw event duration (end - start).
   *  Reached from the EVENTS view only (a row tap, the autoplay chain, the
   *  calendar's day pick): a bounded clip is that view's playback mode. The
   *  timeline never gets here — tapping a thumbnail there seeks the ruler and
   *  keeps playing the continuous footage. */
  private _playBand(band: DetectionBand): void {
    if (!this._domain) return;
    this._scrubPreviewScheduler.reset();
    this._cancelSettle(); // playing an event overrides a pending settle
    this._scrubbing = false;
    this._liveMode = false;
    this._playingBand = band;
    // The whole event, any length — a merged row too. The media view plays it
    // on its chunk engine, so its span is just the seek bar's range; the end
    // cap is wall-clock for an event still in progress.
    this._clipEnd = Math.min(band.end + this._postMs, Date.now());
    this._targetTime = Math.max(band.start - this._preMs, 0);
    this._domain = domainForPlayhead(band.start, spanOf(this._domain), this._phFrac());
  }

  /** Leave event playback: no event end (the media view plays on regardless). */
  private _clearClip(): void {
    this._clipEnd = 0;
  }

  /** The multi-camera page (card_version: multi): same ha-card + header shell
   *  (title, optional back button) as the single card, with <upc-multi-view>
   *  (event strip + live grid / clip playback) filling the rest. */
  private _renderMulti() {
    const cfg = this._config!;
    const stacked = this._isStacked();
    const heightVal = cfg.height || (stacked ? '100dvh' : '80vh');
    const titleStyle =
      (cfg.title_font_weight ? `--upc-title-weight:${cfg.title_font_weight};` : '') +
      (cfg.title_font_size ? `--upc-title-size:${cfg.title_font_size}px;` : '') +
      (cfg.title_font_color ? `--upc-title-color:${cfg.title_font_color};` : '');
    const head = this._multiHead;
    const back = cfg.back_button
      ? html`<button
          class="back-btn"
          aria-label="Back"
          style=${`--upc-back-size:${cfg.back_button_size ?? 38}px`}
          @click=${this._goBack}
        >
          <ha-icon icon="mdi:chevron-left"></ha-icon>
        </button>`
      : nothing;
    const gridBtn = (n: number, title: string, icon: unknown) => html`
      <button
        class=${head.gridView === n ? 'on' : ''}
        title=${title}
        @click=${() => this._setMultiGridView(n)}
      >
        ${icon}
      </button>
    `;
    // The page's heading IS the events' ("Events (N) >", where the title used
    // to be, in its type) - all of it opens the events grid. State comes from
    // the page (events-head).
    const headLink = html`<button
      class="head-link"
      title=${head.expanded ? 'Show cameras' : 'Browse all events'}
      @click=${this._toggleMultiEvents}
    >
      <span class="title-text">${cfg.strip_title ?? 'Events'}</span>
      <span class="head-count ${head.loaded ? '' : 'pending'}">(${head.count})</span>
      <span class="head-chev ${head.expanded ? 'open' : ''} ${head.loaded ? '' : 'pending'}">
        <ha-icon icon="mdi:chevron-right"></ha-icon>
      </span>
    </button>`;
    return html`
      <ha-card class=${stacked ? 'multi-stacked' : 'multi-wide'} style=${`height:${heightVal}`}>
        <div class="header" style=${titleStyle}>
          ${stacked
            ? html`${back}${headLink}`
            : // Wide layout: the heading sits over the events pane, and the live
              // cameras' density control over the cameras.
              html`<div class="head-events" style=${`flex-basis:${tabletPaneWidth(cfg)}px`}>
                  ${back} ${headLink}
                </div>
                <div class="head-cams">
                  <div class="grid-view ${head.liveGrid ? '' : 'hidden'}">
                    ${gridBtn(1, 'Single column', V_ROWS)} ${gridBtn(2, 'Two columns', V_2COL)}
                  </div>
                </div>`}
        </div>
        <upc-multi-view
          .hass=${this.hass}
          .config=${cfg}
          .stacked=${stacked}
          @events-head=${(e: CustomEvent<MultiHead>) => {
            this._multiHead = e.detail;
          }}
          @camera-open=${(e: CustomEvent<{ camera: string; from?: ZoomSource }>) =>
            this._drillTo(e.detail.camera, false, undefined, e.detail.from)}
          @camera-fullscreen-at=${(e: CustomEvent<{ camera: string; time: number; from?: ZoomSource }>) =>
            this._drillTo(e.detail.camera, true, e.detail.time, e.detail.from)}
        ></upc-multi-view>
      </ha-card>
    `;
  }

  /** Resolved layout. Explicit config pins it; 'auto' (the default) picks by
   *  the card's own measured width — stacked below layout_breakpoint
   *  (portrait phone), columns at/above it (tablet / desktop / landscape
   *  phone). Rotation resizes the card, the ResizeObserver re-measures, and
   *  the layout flips live. Unmeasured (first paint) = stacked. */
  private _isStacked(): boolean {
    const layout = this._config?.layout ?? 'auto';
    if (layout === 'stacked') return true;
    if (layout === 'columns') return false;
    return this._hostWidth === 0 || this._hostWidth < (this._config?.layout_breakpoint ?? 600);
  }

  /** A phone's screen, for the camera screen's SIZES: the stacked layout, or
   *  a card too short for the tablet's (a phone held in landscape with its
   *  rotation unlocked - the same ~844 x 390 the sideways screen gets). */
  private _phoneScreen(): boolean {
    return this._isStacked() || (this._hostHeight > 0 && this._hostHeight < PHONE_SCREEN_MAX_H);
  }

  /** One gallery tile: snapshot (HA camera proxy) + uppercase name. `closes`:
   *  picking it also closes the picker (the wide layout's camera sheet). */
  private _renderCamTile(entry: CameraEntry, activeId: string, closes = false) {
    const pic = this.hass.states[entry.camera]?.attributes?.entity_picture as string | undefined;
    // Refresh tiles ~every 10s while the strip is open (driven by the 1s _now
    // tick); frozen when closed so hidden tiles don't keep hitting the proxy.
    const bust = this._galleryOpen ? Math.floor(this._now / 10_000) : 0;
    const src = pic ? `${pic}${pic.includes('?') ? '&' : '?'}upc=${bust}` : undefined;
    const name = this._cameraName(entry.camera);
    return html`<button
      class="cam-tile ${entry.camera === activeId ? 'active' : ''}"
      @click=${(e: Event) => {
        if (closes) {
          void this._pickCamera(entry.camera, e.currentTarget as HTMLElement);
          return;
        }
        this._selectCamera(entry.camera);
      }}
    >
      ${src ? html`<img src=${src} alt=${name} />` : html`<div class="cam-ph"></div>`}
      <span class="cam-name">${name}</span>
    </button>`;
  }

  /** Days (encoded y*10000 + m*100 + d) that have at least one event — the
   *  Events view's calendar only offers these for selection. */
  private _eventDayKeys(): Set<number> {
    const days = new Set<number>();
    for (const b of this._viewBands) {
      for (const t of [b.start, b.end]) {
        const dt = new Date(t);
        days.add(dt.getFullYear() * 10000 + dt.getMonth() * 100 + dt.getDate());
      }
    }
    return days;
  }

  /** The dark mini-calendar above the date pill. Day availability follows the
   *  active view: Timeline = [today - calendar_days, today] (the footage
   *  window); Events = only days that actually HAVE events (the manifest
   *  window, ~7 days). The playhead's day is highlighted. Tapping a day is
   *  mode-aware too (see _selectCalDay). `fs`: the wide camera screen's, opening
   *  up from the date pill at the foot of the overlay ruler. `modal`: the
   *  phone's, in the middle of its screen (always six week rows, so a month
   *  change never resizes it). */
  private _renderCalendar(fs = false, modal = false) {
    const { y, m } = this._calCursor;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const minDay = new Date(today);
    minDay.setDate(minDay.getDate() - (this._config?.calendar_days ?? 30));
    const first = new Date(y, m, 1);
    const offset = first.getDay(); // 0 = Sunday (grid starts SUN, like UniFi)
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const ph = new Date(this._domain ? playheadTimeOf(this._domain, this._phFrac()) : Date.now());
    const isSel = (d: number) =>
      ph.getFullYear() === y && ph.getMonth() === m && ph.getDate() === d;
    // PERF-SCRUB-2026-08-03: memoised formatters (the weekday row built seven
    // of them per calendar render). Revert: plain `new Intl.DateTimeFormat`.
    const monthLabel = dateFmt({
      month: 'long',
      year: 'numeric',
    }).format(first);
    // Localized SUN..SAT header row (2023-01-01 was a Sunday).
    const wk = Array.from({ length: 7 }, (_, i) =>
      dateFmt({ weekday: 'narrow' }).format(new Date(2023, 0, i + 1)),
    );
    // Events view: only days with events are selectable (empty set — manifest
    // not loaded yet — falls back to the timeline window rather than a dead UI).
    const eventDays = this._mode === 'list' ? this._eventDayKeys() : undefined;
    const useEventDays = !!eventDays && eventDays.size > 0;
    // Timeline: the days the camera has footage on, once its scrub index says
    // where the NVR's footage begins and where it has none (see data/gaps) -
    // else the configured window.
    const gaps = this._gaps;
    const footageFrom = footageStart(gaps);
    const now = Date.now();
    const footageOn = (d: Date): boolean => {
      const from = d.getTime();
      const to = Math.min(now, new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime());
      return from < to && nearestFootage(gaps, from, to, from) !== undefined;
    };
    const monthIdx = y * 12 + m;
    const fromDay = footageFrom !== undefined ? new Date(footageFrom) : minDay;
    let minMonthIdx = fromDay.getFullYear() * 12 + fromDay.getMonth();
    if (useEventDays) {
      let minKey = Infinity;
      for (const k of eventDays) if (k < minKey) minKey = k;
      minMonthIdx = Math.floor(minKey / 10000) * 12 + Math.floor((minKey % 10000) / 100);
    }
    const canPrev = monthIdx > minMonthIdx;
    const canNext = monthIdx < today.getFullYear() * 12 + today.getMonth();
    const cells = [];
    for (let i = 0; i < offset; i++) cells.push(html`<span class="cal-cell"></span>`);
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(y, m, d);
      const enabled = useEventDays
        ? eventDays.has(y * 10000 + m * 100 + d)
        : footageFrom !== undefined
          ? footageOn(dt)
          : dt <= today && dt >= minDay;
      cells.push(
        html`<button
          class="cal-cell cal-day ${isSel(d) ? 'sel' : ''}"
          ?disabled=${!enabled}
          @click=${() => this._selectCalDay(y, m, d)}
        >
          ${d}
        </button>`,
      );
    }
    if (modal) while (cells.length < 42) cells.push(html`<span class="cal-cell"></span>`);
    return html`<div class="cal-pop ${fs ? 'fs' : this._isStacked() ? '' : 'wide'}">
      <div class="cal-head">
        <span class="cal-title">${monthLabel}</span>
        <span>
          <button class="cal-chev" ?disabled=${!canPrev} @click=${() => this._calShift(-1)}>
            <ha-icon icon="mdi:chevron-left"></ha-icon>
          </button>
          <button class="cal-chev" ?disabled=${!canNext} @click=${() => this._calShift(1)}>
            <ha-icon icon="mdi:chevron-right"></ha-icon>
          </button>
        </span>
      </div>
      <div class="cal-grid">${wk.map((w) => html`<span class="cal-cell cal-wk">${w}</span>`)}</div>
      <div class="cal-grid cal-days">${cells}</div>
    </div>`;
  }

  /** The scrubber, in either of its two placements: the card's own timeline
   *  column, or — `overlay` — the strip slotted into the FULLSCREEN player
   *  (`slot="fs-timeline"`, rendered by the media view inside the dialog /
   *  fullscreen element, the only place visible there). Same element on the
   *  same shared domain — including its ZOOM — so the two stay in lockstep,
   *  and both behave identically: tapping an event thumbnail winds the ruler to
   *  that event and plays the continuous footage from there. Bounded event
   *  CLIPS are the Events list's job alone — no timeline starts one. The
   *  overlay differs only in look: mirrored onto the screen edge, chrome scaled
   *  for across-the-room reading, and its own jump-to-live arrow. `foot`: what
   *  the overlay carries at the foot of its ruler (the wide camera screen's
   *  date pill). */
  private _renderScrubber(overlay: boolean, foot: unknown = nothing) {
    const cfg = this._config!;
    const ts = cfg.tick_size;
    const tickSizePx =
      typeof ts === 'number' ? ts : ({ small: 4, medium: 8, large: 14 }[ts ?? 'medium'] ?? 8);
    const phone = this._phoneScreen();
    return html`
      <upc-scrubber-timeline
        slot=${overlay ? 'fs-timeline' : nothing}
        ?mirror=${overlay}
        .zoomUi=${true}
        .gutter=${overlay ? this._fsGutter() : 0}
        .rotated=${overlay && this._phoneTurned()}
        .liveArrow=${overlay}
        .compact=${phone}
        .playheadFrac=${this._phFrac()}
        .domain=${this._domain}
        .bands=${this._viewBands}
        .gaps=${(cfg.show_footage_gaps ?? true) ? this._gaps : []}
        .gapColor=${cfg.gap_color ?? '#4a4a52'}
        .now=${this._now}
        .hass=${this.hass}
        .nvrId=${this._nvrId}
        .cameraId=${this._activeCamera || cfg.camera}
        .loader=${this._loader}
        .thumbVersion=${this._thumbVersion}
        .fontSize=${Math.round(
          (cfg.timeline_font_size ?? 12) *
            (overlay ? (phone ? FS_FONT_SCALE_PHONE : FS_FONT_SCALE) : 1),
        )}
        .fontColor=${cfg.timeline_font_color ?? '#d0d0d0'}
        .accentColor=${cfg.accent_color ?? '#fc9df3'}
        .tickColor=${overlay
          ? // The card's tick color is picked against the timeline column's dark
            // background; over bright footage it disappears. The overlay's ruler
            // matches its own labels instead (light, like the UniFi app).
            (cfg.timeline_font_color ?? '#d0d0d0')
          : (cfg.tick_color ?? '#4f4f4f')}
        .tickSize=${tickSizePx}
        .recordedColor=${cfg.recorded_color ?? '#6e476a'}
        .futureColor=${cfg.future_color ?? '#7a7a84'}
        .thumbSize=${overlay && this._fsUpright()
          ? Math.min(cfg.thumb_size ?? 87, FS_UPRIGHT_THUMB)
          : (cfg.thumb_size ?? 87)}
        .thumbSizeActive=${overlay && this._fsUpright()
          ? Math.min(cfg.thumb_size_active ?? 105, FS_UPRIGHT_THUMB_ACTIVE)
          : (cfg.thumb_size_active ?? 105)}
        .live=${this._liveMode}
        .livePaused=${this._livePaused}
        .indent=${overlay ? 0 : phone ? 75 : 60}
        .pillIndent=${overlay ? 0 : phone ? 35 : 0}
        @scrub-start=${this._onScrubStart}
        @scrub=${this._onScrub}
        @scrub-end=${this._onScrubEnd}
        @scrub-cancel=${this._onScrubCancel}
        @domain-change=${this._onDomainChange}
        >${foot}</upc-scrubber-timeline
      >
    `;
  }

  render() {
    if (!this._config) return nothing;
    // Multi page — unless drilled into a camera, which renders the normal
    // single-camera UI (state prepared by _drillTo). The multi page is CACHED
    // across a drill rather than rebuilt: its DOM is set aside while the
    // camera page is up and reinserted afterwards, so coming back from a clip's
    // fullscreen hand-off shows the same page — same grid/strip, same loaded
    // pages, same highlight (multi-view restores the scroll itself). The camera
    // page stays in its own part, built fresh on every drill exactly as before.
    if (this._isMulti) {
      // A zoom between the two (wide layout) has both mounted, the page
      // behind dimmed (see _xf).
      return html`${cache(this._drill && !this._xf ? nothing : this._renderMulti())}${this._xf
          ? html`<div class="xf-dim"></div>`
          : nothing}${this._drill ? this._renderSingle() : nothing}`;
    }
    return this._renderSingle();
  }

  /** The single-camera page: a camera card, or the multi page drilled in. */
  private _renderSingle() {
    if (!this._config) return nothing;
    if (!this._domain) return html`<ha-card><div class="header">Loading…</div></ha-card>`;
    if (!this._nvrId) {
      return html`
        <ha-card>
          <div class="header">${this._config.title ?? 'UniFi Protect Timeline'}</div>
          <div style="padding:8px;color:var(--error-color)">
            Could not resolve <code>nvr_id</code> for ${this._config.camera}. Add
            <code>nvr_id:</code> (your unifiprotect config-entry id) to the card config.
          </div>
        </ha-card>
      `;
    }

    const cameraId = this._activeCamera || this._config.camera;

    // Keep the shared thumbnail loader pointed at the current hass/camera, and
    // tell it which spans the camera was offline so it never probes the NVR there.
    this._loader.configure(
      this.hass,
      this._nvrId,
      cameraId,
      this._config.thumbnail_concurrency ?? 2,
    );
    const gaps = (this._config.show_footage_gaps ?? true) ? this._gaps : [];
    this._loader.setGaps(gaps);

    const accent = this._config.accent_color ?? '#fc9df3';
    // The camera screen is the player itself (see _renderPanel), on both
    // layouts. The overlay ruler's defaults are per screen: a phone's (sideways
    // or held in landscape) gives it the SHORT side (~390px) where the tablet
    // gives ~800 - tablet paddings there would eat half of it - and upright
    // (portrait footage) it runs down a ~390px-wide screen, in a slimmer lane.
    const phone = this._phoneScreen();
    const upright = this._fsUpright();
    // Date pill follows the playhead — short form, e.g. "Jul 6".
    // PERF-SCRUB-2026-08-03: memoised formatter — this sits in render(), which
    // runs on EVERY pointermove of a scrub (~350 times per gesture).
    // Revert: `new Intl.DateTimeFormat(undefined, {...})` instead of dateFmt({...}).
    const dateStr = dateFmt({
      month: 'short',
      day: 'numeric',
    }).format(new Date(playheadTimeOf(this._domain, this._phFrac())));
    return this._renderPanel(cameraId, gaps, accent, dateStr, {
      width: this._config.fs_timeline_width ?? (upright ? FS_UPRIGHT_WIDTH : phone ? 120 : 165),
      pad: this._fsPad(),
      gutter: this._fsGutter(),
      grab: this._config.fs_timeline_grab_width ?? 0, // 0 = the whole player
      scrim: this._config.fs_timeline_scrim ?? 0.88,
      scrimExtend:
        this._config.fs_timeline_scrim_extend ?? (upright ? FS_UPRIGHT_SCRIM_EXTEND : phone ? 130 : 170),
    });
  }

  private _toggleEvents = (): void => {
    this._eventsOpen = !this._eventsOpen;
  };

  // ---- wide camera screen: the camera sheet ----------------------------------

  /** Its chevron. Open, any tap outside it closes it (like the calendar); the
   *  events panel, by contrast, only closes from its own chevron. */
  private _toggleCamSheet = (): void => {
    if (this._galleryOpen) {
      this._closeCamSheet();
      return;
    }
    this._galleryOpen = true;
    // Added mid-dispatch: only sees the NEXT pointerdown (see _toggleCal).
    window.addEventListener('pointerdown', this._outsideSheetClose, true);
  };

  private _closeCamSheet(): void {
    this._galleryOpen = false;
    window.removeEventListener('pointerdown', this._outsideSheetClose, true);
  }

  /** A tap outside the sheet's tiles and chevron closes it, and does nothing
   *  else (swallowed, like the calendar's): it must not also hide the controls,
   *  seek the timeline or press a button under it. */
  private _outsideSheetClose = (e: PointerEvent): void => {
    const path = e.composedPath();
    const body = this.renderRoot.querySelector('.fs-cams-body');
    const handle = this.renderRoot.querySelector('.fs-cams-handle');
    if (!this._galleryOpen || !body) {
      window.removeEventListener('pointerdown', this._outsideSheetClose, true);
      return;
    }
    if (path.includes(body) || (handle && path.includes(handle))) return;
    e.preventDefault();
    e.stopPropagation();
    swallowNextTap();
    this._closeCamSheet();
  };

  /** The camera screen: the player fills the card in its card-sized
   *  fullscreen (media-view `cardFs`) — the overlay ruler down the right, the
   *  controls along the bottom, the exit button back to the multi page — and
   *  the rest of the old timeline view comes into it as overlay chrome that
   *  shows and hides with the controls: the camera picker sliding down from a
   *  chevron at the top (`fs-top`), the events list sliding in from a chevron
   *  on the right edge and pushing the ruler left (`fs-side`; a row winds the
   *  timeline to its event), and the date pill + calendar at the foot of the
   *  ruler (the timeline's own `foot` slot).
   *  PHONE (stacked layout): the same screen scaled down, in a frame of its
   *  own (.frame) - turned 90° clockwise for landscape footage on an upright
   *  phone (laid out the card's height wide and its width tall, so it fills
   *  the card once turned: you turn the phone to watch), upright for portrait
   *  footage (see _phoneTurned). */
  private _renderPanel(
    cameraId: string,
    gaps: FootageGap[],
    accent: string,
    dateStr: string,
    fs: { width: number; pad: number; gutter: number; grab: number; scrim: number; scrimExtend: number },
  ) {
    const cfg = this._config!;
    const camEntries = this._cameraEntries();
    // The overlay's own deeper accent (its pills, zoom and live buttons).
    const deep = darken(accent, 0.58) || accent;
    // A phone's screen (sizes), turned sideways or upright (portrait screens
    // only - held in landscape it is neither).
    const phone = this._phoneScreen();
    const turned = this._phoneTurned();
    const upright = this._fsUpright();
    const camSize = cfg.list_text_size ?? 12;
    // The multi page's events grid thumbnail (the events panel is one column
    // of that grid's items): the phone's two columns across its portrait width,
    // the tablet's configured grid size.
    const tabletGrid = cfg.tablet_events_grid_thumbnail_size ?? Math.round((cfg.tablet_events_thumbnail_size ?? 145) * 1.5);
    const portraitW = Math.min(this._hostWidth || 390, this._hostHeight || 844);
    const gridThumb = phone ? Math.round((portraitW - 36) / 2) : tabletGrid;
    // Events panel: that thumbnail and its margins.
    const sideW = gridThumb + (phone ? 2 * PHONE_EVENTS_PAD : 2 * TABLET_EVENTS_PAD);
    // Camera picker tiles: the size of the multi page's events grid thumbnails.
    const gridW = upright ? PHONE_UPRIGHT_PICKER_TILE : phone ? PHONE_PICKER_TILE : tabletGrid;
    if (this._eventsOpen) this._eventsMounted = true;
    const cardStyle =
      `height:${cfg.height || (this._isStacked() ? '100dvh' : '80vh')};--upc-accent:${accent};--upc-accent-deep:${deep};` +
      `--upc-date-size:${cfg.date_font_size ?? 13}px;` +
      `--upc-date-color:${cfg.date_font_color ?? '#ffffff'};--upc-fs-pad:${fs.pad}px`;
    const media = html`<upc-media-view
          .hass=${this.hass}
          .nvrId=${this._nvrId}
          .cameraId=${cameraId}
          .gaps=${gaps}
          .targetTime=${this._targetTime}
          .scrubbing=${this._scrubbing}
          .live=${this._liveMode}
          .canTalk=${(cfg.talk_button ?? true) && this._canTalk(cameraId)}
          .stacked=${false}
          .phone=${phone}
          .upright=${upright}
          .previewDir=${this._scrubDir()}
          .fastPreview=${cfg.scrub_fast_preview ?? 'speed'}
          .accent=${accent}
          .clipEndTime=${this._clipEnd}
          .now=${this._now}
          .liveAudioStart=${cfg.live_audio_start ?? 'muted'}
          .cardFs=${true}
          .cardFsExit=${!!this._drill || !!cfg.back_button}
          .cardFsClose=${!!cfg.fs_close_button}
          .poster=${this._panelPoster}
          .chromeHidden=${this._panelChromeHidden}
          .chromeAside=${this._calOpen && !this._calClosing}
          .holdCtrl=${this._galleryOpen || this._eventsOpen || this._calOpen}
          .fsSide=${this._eventsOpen ? sideW : 0}
          .fsTimeline=${true}
          .fsTimelineWidth=${fs.width}
          .fsTimelinePadding=${fs.pad}
          .fsTimelineGutter=${fs.gutter}
          .fsTimelineGrabWidth=${fs.grab}
          .fsTimelineScrim=${fs.scrim}
          .fsTimelineScrimExtend=${fs.scrimExtend}
          @playback-time=${this._onPlaybackTime}
          @playback-seek=${this._onPlaybackSeek}
          @live-playing=${this._onLivePlaying}
          @go-live=${this._onLive}
          @rewind=${this._onRewind}
          @fs-exit=${this._onMediaFsExit}
          @zoom-panel=${(e: CustomEvent<{ open: boolean }>) => (this._zoomPanel = e.detail.open)}
        >
          ${this._renderScrubber(
            true,
            html`<div slot="foot" class="fs-datebox">
              <button class="date-pill fs" @click=${this._toggleCal} title="Jump to date">
                <ha-icon icon="mdi:calendar-month-outline"></ha-icon>
                <span>${dateStr}</span>
              </button>
            </div>`,
          )}
          ${camEntries.length > 1
            ? html`<div slot="fs-top" class="fs-cams ${this._galleryOpen ? 'open' : ''}">
                <div class="fs-cams-body">
                  <div class="fs-cams-row" style=${`--upc-cam-tile-w:${gridW}px`}>
                    ${camEntries.map((c) => this._renderCamTile(c, cameraId, true))}
                  </div>
                </div>
                <div class="fs-cams-foot">
                  <button
                    class="fs-chev fs-cams-handle"
                    title=${this._galleryOpen ? 'Hide cameras' : 'Cameras'}
                    @click=${this._toggleCamSheet}
                  >
                    <svg viewBox="0 0 40 14"><polyline points="4,3 20,11 36,3"></polyline></svg>
                  </button>
                </div>
              </div>`
            : nothing}
          <div
            slot="fs-side"
            class="fs-events ${this._eventsOpen ? 'open' : ''} ${this._zoomPanel ? 'zooming' : ''}"
            style=${`--upc-side-w:${sideW}px`}
          >
            <button
              class="fs-chev fs-events-handle"
              title=${this._eventsOpen ? 'Hide events' : 'Events'}
              @click=${this._toggleEvents}
            >
              <svg viewBox="0 0 14 40"><polyline points="11,4 3,20 11,36"></polyline></svg>
            </button>
            <div class="fs-events-body">
              ${this._eventsMounted
                ? html`<div class="fs-events-list">
                    <upc-event-strip
                      expanded
                      hideHead
                      captions
                      fs
                      ?gridCaptions=${!phone}
                      .bands=${this._panelBands(cameraId)}
                      .loader=${this._loader}
                      .thumbVersion=${this._thumbVersion}
                      .timeSize=${cfg.strip_time_size ?? 12}
                      .playingKey=${this._playingBand
                        ? `${this._playingBand.type}@${this._playingBand.start}`
                        : ''}
                      .expanded=${true}
                      .gridColumns=${1}
                      .gridThumbWidth=${gridThumb}
                      .dateFontSize=${cfg.date_font_size ?? 13}
                      .itemTextSize=${phone ? camSize + 1 : camSize}
                      .accent=${cfg.list_divider_color || accent}
                      @strip-select=${this._onPanelEventSelected}
                    ></upc-event-strip>
                  </div>`
                : nothing}
            </div>
          </div>
        </upc-media-view>`;
    // The calendar opens in the middle of the screen over the picture dimmed,
    // the player's controls, timeline and panels faded away (chromeAside) -
    // see _calFlight.
    const calModal = this._calOpen
      ? html`<div class="cal-modal"><div class="cal-scrim"></div>${this._renderCalendar(true, true)}</div>`
      : nothing;
    if (!phone) {
      return html`<ha-card class="panel" style=${cardStyle}>${media}<div class="hero"></div>${calModal}</ha-card>`;
    }
    // The sideways frame: the card's height wide and its width tall, centred on
    // the card and turned about its centre (CSS), so it fills the card exactly.
    const w = this._hostWidth;
    const h = this._hostHeight;
    const frameStyle =
      turned && w && h ? `width:${h}px;height:${w}px;left:${(w - h) / 2}px;top:${(h - w) / 2}px` : '';
    return html`<ha-card class="panel phone ${turned ? 'turned' : upright ? 'upright' : ''}" style=${cardStyle}>
      <div class="frame" style=${frameStyle}>${media}<div class="hero"></div>${calModal}</div>
    </ha-card>`;
  }
}

// Register in the Lovelace "Add card" picker.
declare global {
  interface Window {
    customCards?: Array<{ type: string; name: string; description: string; preview: boolean }>;
  }
}
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'unifi-protect-timeline-card',
  name: 'UniFi Protect Timeline',
  description: 'UniFi Protect-style touch scrubber for camera footage and detections',
  preview: false,
});

// eslint-disable-next-line no-console
console.info(
  `%c UNIFI-PROTECT-TIMELINE-CARD %c v${VERSION} `,
  'color:#fff;background:#03a9f4;font-weight:700;border-radius:3px 0 0 3px;padding:2px 4px',
  'color:#03a9f4;background:#222;border-radius:0 3px 3px 0;padding:2px 4px',
);
