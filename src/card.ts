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
import { fetchFootageGaps } from './data/gaps';
import { navigate } from './data/navigate';
import { groupBands } from './data/event-groups';
import { buildFootageSpans, type FootageSpan } from './data/footage-map';
import { ThumbnailLoader } from './data/thumbnail-loader';
import { SCRUB_BASE, THUMBS_BASE } from './data/ha-urls';
import { dateFmt } from './data/fmt'; // PERF-SCRUB-2026-08-03
import { findMediumBridgeCamera } from './data/live-transport';
import { LatestValueScheduler } from './data/latest-value-scheduler';
import { swallowNextTap, type ScrubberTimeline } from './scrubber-timeline';
import type { EventsList } from './events-list';
import './events-list';
import './media-view';
import './multi-view';

const BAND_REFRESH_MS = 30_000;
// The card calls the sync service itself when the manifest is stale (job not
// running / not run yet), at most once per SYNC_THROTTLE_MS.
const SYNC_THROTTLE_MS = 2 * 60_000;
const VERSION = '2.0.2';

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
  private _drillFs = false; // drilled JUST to open a grid tile fullscreen (exit -> grid)
  private _swapDir = 0; // pending drill swap animation: 1 = in (from right), -1 = out
  // The media view is fullscreen (mobile: top-layer dialog; tablet: element
  // fullscreen), and whether that fullscreen is CSS-rotated to landscape. Both
  // come from the media view's `fs-change`; they gate the overlay timeline the
  // card slots INTO the player (the only place that renders inside fullscreen).
  @state() private _playerFs = false;
  @state() private _playerRotated = false;
  @state() private _galleryOpen = false; // camera strip expanded (drag DOWN on the video)
  @state() private _calOpen = false; // date-pill calendar popup
  @state() private _calCursor = { y: 0, m: 0 }; // calendar's displayed month
  // Own rendered width — drives layout:'auto' (stacked vs columns) and re-picks
  // live when a phone rotates or the card is resized.
  @state() private _hostWidth = 0;
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
  // Recorded-footage spans (padded raw events, merged): adaptive recording
  // keeps almost nothing between them, so exports splice these back to back —
  // media-view uses them to keep the playhead ON the footage across the
  // recording gaps (the marker jumps a gap together with the video).
  private _footageSpans: FootageSpan[] = [];
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
  private _gapRange?: TimeDomain;
  private _tick?: ReturnType<typeof setInterval>;
  private _bandInterval?: ReturnType<typeof setInterval>;

  static styles = css`
    :host {
      /* custom elements default to inline — inline boxes measure width 0 in
         ResizeObserver, which would wedge layout:auto in stacked mode */
      display: block;
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
    this._activeCamera = config.camera;
    this._drill = undefined;
    this._galleryOpen = false;
    this._closeCal();
    this._inited = false; // re-init domain on config change
  }

  private get _isMulti(): boolean {
    return this._config?.card_version === 'multi';
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
      this._drillOut();
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
  private _drillTo(camera: string, fullscreen = false): void {
    this._drill = camera;
    this._drillFs = fullscreen;
    this._activeCamera = camera;
    this._nvrId = this._resolveNvrId();
    this._loader.cancelAll();
    this._manifestBands = [];
    this._footageSpans = [];
    this._gaps = [];
    this._gapRange = undefined;
    this._preMs = 0;
    this._postMs = 0;
    this._lastSyncTrigger = 0;
    this._resetToLive();
    void this._fetchGaps(true);
    void this._fetchManifest();
    // Fullscreen drill (grid tile FS): skip the slide — the media-view goes
    // fullscreen immediately, so the inline timeline is never really seen.
    this._swapDir = fullscreen ? 0 : 1;
  }

  /** Drilled timeline → back to the multi page (slide in from the left). */
  private _drillOut(skipAnim = false): void {
    this._drill = undefined;
    this._drillFs = false;
    this._activeCamera = this._config?.camera ?? '';
    this._loader.cancelAll(); // in-flight thumbnails belong to the drilled camera
    this._swapDir = skipAnim ? 0 : -1;
  }

  /** The drilled media-view left fullscreen. If we drilled in JUST for a grid
   *  tile's fullscreen, pop straight back out to the multi grid. */
  private _onMediaFsExit = (): void => {
    if (this._drillFs) this._drillOut(true);
  };

  /** The player entered/left fullscreen: mount or drop the overlay timeline it
   *  hosts. Mounting it only while fullscreen keeps its lifecycle clean — a
   *  fresh element measures its own height with no previous one to rescale the
   *  shared zoom against (see the scrubber's _resize).
   *  The ZOOM is not touched in either direction: both placements render the
   *  one shared domain, so the zoom level (and the playhead) carries straight
   *  into fullscreen and whatever you zoom to in there comes back out with you.
   *  The strip is much taller than the card's column, so the same span simply
   *  gets a longer ruler — it has its own zoom control to change that. */
  private _onPlayerFs = (e: CustomEvent<{ fs: boolean; rotated: boolean }>): void => {
    this._playerFs = e.detail.fs;
    this._playerRotated = e.detail.rotated;
  };

  // Both mounted rulers: the card column's and the fullscreen overlay's. The
  // overlay one is SLOTTED into the media view but still lives in this shadow
  // root, so one query finds them both.
  @queryAll('upc-scrubber-timeline') private _timelines!: NodeListOf<ScrubberTimeline>;

  /** Where the playhead sits down the strip. Lower in a phone's fullscreen
   *  overlay so the active event's thumbnail clears the top fade (see
   *  PHONE_FS_PLAYHEAD_FRAC). ONE value for the card's domain math and for both
   *  timelines — they must agree, or the marker and the footage drift apart.
   *  The card column's timeline follows the overlay while it is up; it is
   *  behind the fullscreen player, so nobody sees it move. */
  private _phFrac(): number {
    return this._playerFs && this._isStacked() ? PHONE_FS_PLAYHEAD_FRAC : PLAYHEAD_FRAC;
  }

  /** Clearance the fullscreen ruler keeps from the top/bottom screen edges.
   *  Per layout — see the block in render(), its only caller. */
  private _fsPad(): number {
    return this._config?.fs_timeline_padding ?? (this._isStacked() ? 20 : 60);
  }

  /** The lane between the ruler and the right screen edge — it has to fit the
   *  zoom control and the jump-to-live arrow with room to breathe. On a phone
   *  that edge is also iOS's system-gesture strip: a button sitting in it never
   *  receives the touch at all, so the lane is wide enough to keep the whole
   *  control column clear of it. */
  private _fsGutter(): number {
    return this._config?.fs_timeline_gutter ?? (this._isStacked() ? 110 : 140);
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
      title: 'UniFi Protect Timeline',
      title_font_size: 24,
      title_font_color: '',
      title_font_weight: 500,
      default_timeline_zoom: 100,
      chunk_seconds: 300,
      delay_seconds: 15,
      live_audio_start: 'muted',
      live_transport: 'auto',
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
      autoplay_next_event: true,
      tick_color: '#4f4f4f',
      tick_size: 8,
      recorded_color: '#6e476a',
      future_color: '#7a7a84',
      show_footage_gaps: true,
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
      scrub_tip: true,
      scrub_preview_mode: 'sprites', // SPRITE-PREVIEW-2026-08-04 (temp; 'auto' long-term)
      scrub_fast_preview: 'always',
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
      const w = Math.round(entries[entries.length - 1].contentRect.width);
      if (w && w !== this._hostWidth) this._hostWidth = w;
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
    clearTimeout(this._scrubSettleTimer);
    this._scrubPreviewScheduler.reset();
    this._hostRo?.disconnect();
    window.removeEventListener('pointerdown', this._outsideCalClose, true);
    this._loader.cancelAll(); // nothing will consume in-flight snapshots anymore
  }

  protected updated(changed: PropertyValues): void {
    if ((changed.has('hass') || changed.has('_config')) && this.hass && this._config && !this._inited) {
      this._init();
    }
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
    // Timeline<->Events switch: the freshly-rendered view fades + slides IN from
    // the toggle's direction (its predecessor slid out in _setMode).
    if (changed.has('_mode') && this._modeSwapDir) {
      const dir = this._modeSwapDir;
      this._modeSwapDir = 0;
      const body = this.renderRoot.querySelector('.mode-body');
      if (body) {
        body.getAnimations().forEach((a) => a.cancel()); // clear the fill-forwards exit
        body.animate(
          [
            { opacity: 0, transform: `translateX(${dir * 18}px)` },
            { opacity: 1, transform: 'none' },
          ],
          { duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
        );
      }
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
    this._galleryOpen = false;
    this._calOpen = false;
    this._now = Date.now();
    this._domain = domainForPlayhead(this._now, this._initialSpan(), this._phFrac());
    this._targetTime = this._now;
    this._scrubbing = false;
    this._liveMode = true;
    this._livePaused = false;
    this._playingBand = undefined;
    this._clipEnd = 0;
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
      // Recorded spans come from the RAW events (padded), NOT the display
      // groups — grouping merges across real recording gaps.
      this._footageSpans = buildFootageSpans(loaded.entries, loaded.preMs, loaded.postMs);
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

  private _liveBridgeCamera(cameraId: string): string {
    const configured = this._cameraEntries().find((entry) => entry.camera === cameraId)?.live_camera;
    return findMediumBridgeCamera(this.hass, cameraId, configured) ?? '';
  }

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
    this._footageSpans = [];
    this._gaps = [];
    this._gapRange = undefined;
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
      clearTimeout(this._scrubSettleTimer);
      this._playingBand = undefined; // the band belonged to the old camera
      this._clipEnd = 0; // ...and so did any bounded event clip
      this._livePaused = false;
      this._scrubbing = false;
      this._targetTime = Math.min(playheadTimeOf(this._domain, this._phFrac()), Date.now());
    }
    void this._fetchGaps(true);
    void this._fetchManifest();
  }

  // Drag DOWN on the video opens the strip, drag UP closes it. One toggle per
  // gesture; plain taps (no movement) fall through to the native video
  // controls untouched. No pointer capture — capturing would retarget the
  // pointerup away from the video element and break its control taps.
  private _videoDrag?: { x: number; y: number; id: number; done: boolean };

  private _onVideoPointerDown = (e: PointerEvent): void => {
    if (!this._cameraEntries().length) return;
    this._videoDrag = { x: e.clientX, y: e.clientY, id: e.pointerId, done: false };
  };

  private _onVideoPointerMove = (e: PointerEvent): void => {
    const d = this._videoDrag;
    if (!d || d.done || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dy) > 50 && Math.abs(dy) > Math.abs(dx)) {
      d.done = true;
      this._galleryOpen = dy > 0;
    }
  };

  private _onVideoPointerEnd = (e: PointerEvent): void => {
    if (this._videoDrag?.id === e.pointerId) this._videoDrag = undefined;
  };

  // Header chevron: click alternative to the drag gesture (desktop/tablet).
  private _toggleGallery = (): void => {
    this._galleryOpen = !this._galleryOpen;
  };

  // ---- date pill + calendar popup -------------------------------------------

  private _toggleCal = (): void => {
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
    this._calOpen = false;
    window.removeEventListener('pointerdown', this._outsideCalClose, true);
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

  private _calShift(delta: number): void {
    const d = new Date(this._calCursor.y, this._calCursor.m + delta, 1);
    this._calCursor = { y: d.getFullYear(), m: d.getMonth() };
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
    clearTimeout(this._scrubSettleTimer); // date jump overrides a pending settle
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
    const t = new Date(y, m, day, 12, 0, 0, 0).getTime();
    if (t >= Date.now() - 20_000) {
      this._onLive();
      return;
    }
    this._playingBand = undefined;
    this._clipEnd = 0;
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

  /** Fetch camera-offline (footage-gap) spans for a large buffer around the
   *  visible window, guard-gated so panning inside the buffer is free. This is
   *  a cheap HA history query, NOT an NVR call. (Events themselves come from
   *  the manifest — see _fetchManifest.) */
  private async _fetchGaps(force = false): Promise<void> {
    if (!this.hass || !this._domain) return;
    if (!(this._config?.show_footage_gaps ?? true)) return;

    const span = spanOf(this._domain);
    const margin = Math.max(span * 2, 180 * MINUTE); // >= 3h buffer each side
    const since = this._domain.start - margin;
    const until = Math.min(this._domain.end + margin, this._now + 1000);
    const guard = margin * 0.5;
    const covered =
      !!this._gapRange &&
      this._domain.start - guard >= this._gapRange.start &&
      this._domain.end + guard <= this._gapRange.end;
    if (!force && covered) return;
    this._gapRange = { start: since, end: until };
    const cam = this._activeCamera || this._config!.camera;
    const gaps = await fetchFootageGaps(this.hass, cam, since, until, this._nvrId);
    if (cam !== this._activeCamera) return; // camera switched while fetching
    this._gaps = gaps;
  }

  // View-switch animation: the outgoing view fades + slides out (toward the
  // segment it's leaving), the incoming one fades + slides in from the other
  // side — a subtle directional push. Timeline is the LEFT segment, Events the
  // RIGHT, so switching to Events pushes leftward and vice-versa.
  private _modeSwapDir = 0; // 1 = switching to Events, -1 = to Timeline

  private async _setMode(mode: 'timeline' | 'list'): Promise<void> {
    if (this._mode === mode) return;
    const toEvents = mode === 'list';
    const body = this.renderRoot.querySelector('.mode-body');
    if (body) {
      await body
        .animate(
          [
            { opacity: 1, transform: 'none' },
            { opacity: 0, transform: `translateX(${(toEvents ? -1 : 1) * 18}px)` },
          ],
          { duration: 140, easing: 'ease-in', fill: 'forwards' },
        )
        .finished.catch(() => undefined);
    }
    this._modeSwapDir = toEvents ? 1 : -1; // the in-animation runs in updated()
    this._mode = mode;
  }
  private _showTimeline = (): void => {
    void this._setMode('timeline');
  };
  private _showEvents = (): void => {
    void this._setMode('list');
  };

  // ---- timeline events ----------------------------------------------------

  private _onScrubStart = (): void => {
    clearTimeout(this._scrubSettleTimer); // new gesture supersedes a pending settle
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
    clearTimeout(this._scrubSettleTimer);
    this._scrubPreviewScheduler.reset();
    this._scrubbing = false;
  };

  private _onScrub = (e: CustomEvent<{ time: number }>): void => {
    clearTimeout(this._scrubSettleTimer);
    this._scrubbing = true;
    this._liveMode = false; // any scrub motion (incl. wheel/trackpad) leaves live now
    this._playingBand = undefined;
    this._clipEnd = 0;
    this._scrubPreviewScheduler.push(e.detail.time);
  };

  // Scrub settle: after a drag/flick release, wait a beat before starting the
  // export/playback — feels natural and avoids loading a clip the user is
  // about to scrub away from.
  private _scrubSettleTimer?: ReturnType<typeof setTimeout>;

  private _onScrubEnd = (e: CustomEvent<{ time: number }>): void => {
    this._scrubPreviewScheduler.flush(e.detail.time);
    this._playingBand = undefined;
    clearTimeout(this._scrubSettleTimer);
    const commit = (): void => {
      this._scrubbing = false;
      this._clipEnd = 0;
      this._livePaused = false;
      // Released within ~3s of now => treat as live; otherwise historical, so a
      // small deliberate rewind (5s, 30s) plays a clip instead of snapping live.
      this._liveMode = Date.now() - e.detail.time < 3_000;
    };
    const delay = this._config?.scrub_settle_ms ?? 700;
    if (delay <= 0) commit();
    else this._scrubSettleTimer = setTimeout(commit, delay);
  };

  private _onDomainChange = (e: CustomEvent<TimeDomain>): void => {
    this._domain = e.detail;
    // Guard-gated: no-ops while inside the buffer, fetches once near the edge.
    void this._fetchGaps(false);
  };

  private _onLive = (): void => {
    if (!this._domain) return;
    this._scrubPreviewScheduler.reset();
    clearTimeout(this._scrubSettleTimer); // jump-to-live overrides a pending settle
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
    this._clipEnd = 0;
  };

  // The live view's "back 15s" control: drop out of live into delayed-follow at
  // the given time (mirrors a deliberate scrub-tap to that moment).
  private _onRewind = (e: CustomEvent<{ time: number }>): void => {
    if (!this._domain) return;
    this._scrubPreviewScheduler.reset();
    clearTimeout(this._scrubSettleTimer);
    this._liveMode = false;
    this._livePaused = false;
    this._scrubbing = false;
    this._playingBand = undefined;
    this._clipEnd = 0;
    this._targetTime = e.detail.time;
    const from = this._domain;
    const to = domainForPlayhead(e.detail.time, spanOf(from), this._phFrac());
    this._domain = to;
    this._glideRulers(from, to);
  };

  /** The next event NEWER than `after` (the row directly above it in the list). */
  private _nextNewerBand(after: DetectionBand): DetectionBand | undefined {
    let best: DetectionBand | undefined;
    for (const b of this._viewBands) {
      if (b.start > after.start && (!best || b.start < best.start)) best = b;
    }
    return best;
  }

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

  /** The skip buttons announce their target on the PRESS, before the player has
   *  re-exported and reloaded the footage (a second or two). Move the ruler
   *  now — waiting for playback-time left the timeline frozen until the video
   *  caught up, which read as the button not working. */
  private _onPlaybackSeek = (e: CustomEvent<{ time: number }>): void => {
    if (!this._domain) return;
    const from = this._domain;
    const to = domainForPlayhead(e.detail.time, spanOf(from), this._phFrac());
    this._domain = to;
    this._targetTime = e.detail.time;
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
    clearTimeout(this._scrubSettleTimer); // playing an event overrides a pending settle
    this._scrubbing = false;
    this._liveMode = false;
    this._playingBand = band;
    this._clipEnd = Math.min(band.end + this._postMs, Date.now());
    this._targetTime = Math.max(band.start - this._preMs, 0);
    this._domain = domainForPlayhead(band.start, spanOf(this._domain), this._phFrac());
  }

  // Tap on an events-list row -> play that event's (padded) clip.
  private _onEventSelected = (e: CustomEvent<DetectionBand>): void => {
    this._playBand(e.detail);
  };

  // A bounded event clip finished playing. In list mode, either step to the next
  // newer event (autoplay_next_event, default) or keep playing the timeline
  // footage continuously from where the clip ended. Switching to Timeline while
  // a clip runs takes the same continue-playing path (no jump to the next).
  private _onClipEnded = (): void => {
    if (!this._playingBand) return;
    if (this._mode === 'list' && (this._config?.autoplay_next_event ?? true)) {
      const next = this._nextNewerBand(this._playingBand);
      if (next) {
        this._playBand(next);
        return;
      }
    }
    // Keep playing the footage from where the clip ended (no jump to next event).
    this._targetTime = this._playingBand.end;
    this._playingBand = undefined;
    this._clipEnd = 0;
  };

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
    return html`
      <ha-card class=${stacked ? 'multi-stacked' : ''} style=${`height:${heightVal}`}>
        <div class="header" style=${titleStyle}>
          ${cfg.back_button
            ? html`<button
                class="back-btn"
                aria-label="Back"
                style=${`--upc-back-size:${cfg.back_button_size ?? 38}px`}
                @click=${this._goBack}
              >
                <ha-icon icon="mdi:chevron-left"></ha-icon>
              </button>`
            : nothing}
          <span class="title-text">${cfg.title ?? 'Cameras'}</span>
        </div>
        <upc-multi-view
          .hass=${this.hass}
          .config=${cfg}
          .stacked=${stacked}
          @camera-open=${(e: CustomEvent<string>) => this._drillTo(e.detail)}
          @camera-fullscreen=${(e: CustomEvent<string>) => this._drillTo(e.detail, true)}
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

  /** One gallery tile: snapshot (HA camera proxy) + uppercase name. */
  private _renderCamTile(entry: CameraEntry, activeId: string) {
    const pic = this.hass.states[entry.camera]?.attributes?.entity_picture as string | undefined;
    // Refresh tiles ~every 10s while the strip is open (driven by the 1s _now
    // tick); frozen when closed so hidden tiles don't keep hitting the proxy.
    const bust = this._galleryOpen ? Math.floor(this._now / 10_000) : 0;
    const src = pic ? `${pic}${pic.includes('?') ? '&' : '?'}upc=${bust}` : undefined;
    const name = this._cameraName(entry.camera);
    return html`<button
      class="cam-tile ${entry.camera === activeId ? 'active' : ''}"
      @click=${() => this._selectCamera(entry.camera)}
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
   *  mode-aware too (see _selectCalDay). */
  private _renderCalendar() {
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
    const monthIdx = y * 12 + m;
    let minMonthIdx = minDay.getFullYear() * 12 + minDay.getMonth();
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
    return html`<div class="cal-pop ${this._isStacked() ? '' : 'wide'}">
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
      <div class="cal-grid">
        ${wk.map((w) => html`<span class="cal-cell cal-wk">${w}</span>`)}
        ${cells}
      </div>
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
   *  for across-the-room reading, and its own jump-to-live arrow. */
  private _renderScrubber(overlay: boolean) {
    const cfg = this._config!;
    const ts = cfg.tick_size;
    const tickSizePx =
      typeof ts === 'number' ? ts : ({ small: 4, medium: 8, large: 14 }[ts ?? 'medium'] ?? 8);
    const stacked = this._isStacked();
    return html`
      <upc-scrubber-timeline
        slot=${overlay ? 'fs-timeline' : nothing}
        ?mirror=${overlay}
        .zoomUi=${true}
        .gutter=${overlay ? this._fsGutter() : 0}
        .rotated=${overlay && this._playerRotated}
        .liveArrow=${overlay}
        .compact=${stacked}
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
            (overlay ? (stacked ? FS_FONT_SCALE_PHONE : FS_FONT_SCALE) : 1),
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
        .thumbSize=${cfg.thumb_size ?? 87}
        .thumbSizeActive=${cfg.thumb_size_active ?? 105}
        .live=${this._liveMode}
        .livePaused=${this._livePaused}
        .indent=${overlay ? 0 : stacked ? 75 : 60}
        .pillIndent=${overlay ? 0 : stacked ? 35 : 0}
        @scrub-start=${this._onScrubStart}
        @scrub=${this._onScrub}
        @scrub-end=${this._onScrubEnd}
        @scrub-cancel=${this._onScrubCancel}
        @domain-change=${this._onDomainChange}
      ></upc-scrubber-timeline>
    `;
  }

  render() {
    if (!this._config) return nothing;
    // Multi page — unless drilled into a camera, which renders the normal
    // single-camera UI below (state prepared by _drillTo).
    if (this._isMulti && !this._drill) return this._renderMulti();
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
    // UniFi-style scrubber overlaid on the fullscreen player (slotted into the
    // media view — see _renderScrubber). Its defaults are per LAYOUT: a phone
    // plays fullscreen rotated, so the ruler gets the screen's SHORT side
    // (~390px) where the tablet gets ~800 — tablet paddings there would eat
    // half of it.
    const fsTimeline = this._config.fs_timeline ?? true;
    const fsPhone = this._isStacked();
    const fsTimelineWidth = this._config.fs_timeline_width ?? (fsPhone ? 120 : 165);
    const fsTimelinePadding = this._fsPad();
    const fsTimelineGutter = this._fsGutter();
    const fsTimelineGrabWidth = this._config.fs_timeline_grab_width ?? 0; // 0 = whole player
    const fsTimelineScrim = this._config.fs_timeline_scrim ?? 0.88;
    const fsTimelineScrimExtend = this._config.fs_timeline_scrim_extend ?? (fsPhone ? 130 : 170);
    // Date pill (bottom-left) follows the playhead — short form, e.g. "Jul 6".
    // PERF-SCRUB-2026-08-03: memoised formatter — this sits in render(), which
    // runs on EVERY pointermove of a scrub (~350 times per gesture).
    // Revert: `new Intl.DateTimeFormat(undefined, {...})` instead of dateFmt({...}).
    const dateStr = dateFmt({
      month: 'short',
      day: 'numeric',
    }).format(new Date(playheadTimeOf(this._domain, this._phFrac())));
    const stacked = this._isStacked();
    // Shared sizing so the timeline view's Events column MATCHES the multi
    // page's collapsed events (same pane width, thumb size, and font sizes).
    const tabW = this._config.tablet_events_thumbnail_size ?? 145;
    const camSize = this._config.list_text_size ?? 12;
    const subSize = Math.max(1, camSize - 1);
    const colW = tabW + 168; // pane width = thumbnail + a fixed text column
    // Vars consumed by the floating date pill + jump-to-live arrow (card-level)
    // and by the scrubber (accent). Wide layout fixes the column width to colW.
    const colStyle =
      (stacked ? '' : `flex-basis:${colW}px;min-width:${colW}px;`) +
      `--upc-accent:${accent};` +
      `--upc-arrow:${this._config.arrow_color ?? 'rgba(0,0,0,0.6)'};` +
      `--upc-arrow-bottom:${this._config.live_arrow_bottom ?? 14}px;` +
      `--upc-date-size:${this._config.date_font_size ?? 13}px;` +
      `--upc-date-color:${this._config.date_font_color ?? '#ffffff'};`;
    // Camera gallery strip entries; when configured, the header title follows
    // the ACTIVE camera (the YAML title would lie after a switch).
    const camEntries = this._cameraEntries();
    const title = camEntries.length
      ? this._cameraName(cameraId)
      : (this._config.title ?? 'UniFi Protect Timeline');
    // Stacked (phone) layout: video on top at `video_ratio` of the height.
    // Accept either a 0–1 fraction or a 0–100 percent.
    const vr = this._config.video_ratio ?? 0.45;
    const videoPct = Math.max(15, Math.min(85, vr > 1 ? vr : vr * 100));
    // Height of the WHOLE card (header + optional strip + video/timeline row).
    // Stacked fills the screen (behind the navbar) by default; columns keeps
    // the tall 80vh panel look. The row flexes inside, so the camera strip
    // opening never grows the card (see .row comment).
    const heightVal = this._config.height || (stacked ? '100dvh' : '80vh');
    const cardStyle = `height:${heightVal}`;
    const rowStyle = stacked ? `--upc-video-frac:${videoPct}%` : '';
    // Day-divider line in the events list defaults to the accent color.
    const dividerColor = this._config.list_divider_color || accent;
    // Segmented Timeline|Events toggle colors (only set what the user overrode).
    const toggleStyle =
      (this._config.toggle_bg ? `--upc-toggle-bg:${this._config.toggle_bg};` : '') +
      (this._config.toggle_active_bg ? `--upc-toggle-active-bg:${this._config.toggle_active_bg};` : '') +
      (this._config.toggle_active_color
        ? `--upc-toggle-active-color:${this._config.toggle_active_color};`
        : '') +
      (this._config.toggle_text_color ? `--upc-toggle-text:${this._config.toggle_text_color};` : '');
    // Stacked video sizing: by aspect ratio (fills exactly, no black bars) when
    // video_aspect is set, otherwise the video_ratio height fraction (below).
    const videoColStyle =
      stacked && this._config.video_aspect
        ? `flex:0 0 auto;aspect-ratio:${this._config.video_aspect};width:100%;`
        : '';
    // A dynamic CAMERA NAME (gallery configured) uses ONE fixed weight so it
    // looks identical whether the timeline is standalone or drilled from the
    // multi page (whose title_font_weight is set higher for its "Cameras"
    // header). Static titles keep the configured title_font_weight.
    const titleStyle =
      (camEntries.length
        ? `--upc-title-weight:${this._config.camera_name_font_weight ?? 600};`
        : this._config.title_font_weight
          ? `--upc-title-weight:${this._config.title_font_weight};`
          : '') +
      (this._config.title_font_size ? `--upc-title-size:${this._config.title_font_size}px;` : '') +
      (this._config.title_font_color ? `--upc-title-color:${this._config.title_font_color};` : '');

    return html`
      <ha-card style=${cardStyle}>
        <div class="header" style=${titleStyle}>
          ${this._config.back_button || this._drill
            ? html`<button
                class="back-btn"
                aria-label="Back"
                style=${`--upc-back-size:${this._config.back_button_size ?? 38}px`}
                @click=${this._goBack}
              >
                <ha-icon icon="mdi:chevron-left"></ha-icon>
              </button>`
            : nothing}
          <span class="title-text">${title}</span>
          ${camEntries.length
            ? html`<button
                class="strip-toggle"
                @click=${this._toggleGallery}
                title=${this._galleryOpen ? 'Hide cameras' : 'Show cameras'}
              >
                <ha-icon
                  icon=${this._galleryOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'}
                ></ha-icon>
              </button>`
            : nothing}
        </div>

        ${camEntries.length
          ? html`<div
              class="cam-strip ${this._galleryOpen ? 'open' : ''}"
              style="--upc-cam-tile-w:${tabW}px"
            >
              <div class="cam-strip-inner">
                ${camEntries.map((c) => this._renderCamTile(c, cameraId))}
              </div>
            </div>`
          : nothing}

        <div class="row ${stacked ? 'stacked' : ''}" style=${rowStyle}>
          <div class="timeline-col" style=${colStyle}>
            <div class="view-toggle" style=${toggleStyle}>
              <button
                class="seg ${this._mode === 'timeline' ? 'active' : ''}"
                @click=${this._showTimeline}
              >
                Timeline
              </button>
              <button
                class="seg ${this._mode === 'list' ? 'active' : ''}"
                @click=${this._showEvents}
              >
                Events
              </button>
            </div>

            <div class="mode-body">
              ${this._mode === 'timeline'
                ? this._renderScrubber(false)
                : html`
                    <upc-events-list
                      .bands=${this._viewBands}
                      .loader=${this._loader}
                      .thumbVersion=${this._thumbVersion}
                      .textSize=${camSize}
                      .textColor=${this._config.list_text_color ?? ''}
                      .durationSize=${subSize}
                      .durationColor=${this._config.list_duration_color ?? ''}
                      .thumbWidth=${tabW}
                      .line1White=${true}
                      .activeTextSize=${this._config.list_active_text_size ?? 12}
                      .activeTextColor=${this._config.list_active_text_color ?? '#000'}
                      .activeDurationSize=${this._config.list_active_duration_size ?? 12}
                      .activeDurationColor=${this._config.list_active_duration_color ?? '#000'}
                      .activeBg=${this._config.list_active_bg ??
                      this._config.list_highlight_color ??
                      '#fff'}
                      .playingKey=${this._playingBand
                        ? `${this._playingBand.type}@${this._playingBand.start}`
                        : ''}
                      .dateFontSize=${this._config.date_font_size ?? 13}
                      .dateFontColor=${this._config.date_font_color ?? '#ffffff'}
                      .dividerColor=${dividerColor}
                      @event-selected=${this._onEventSelected}
                    ></upc-events-list>
                  `}
            </div>

            <button class="date-pill" @click=${this._toggleCal} title="Jump to date">
              <ha-icon icon="mdi:calendar-month-outline"></ha-icon>
              <span>${dateStr}</span>
            </button>
            ${this._calOpen ? this._renderCalendar() : nothing}
            ${this._mode === 'timeline' && !this._liveMode
              ? html`<button class="live-arrow" @click=${this._onLive} title="Jump to live">
                  ↑
                </button>`
              : nothing}
          </div>

          <div
            class="video-col"
            style=${videoColStyle}
            @pointerdown=${this._onVideoPointerDown}
            @pointermove=${this._onVideoPointerMove}
            @pointerup=${this._onVideoPointerEnd}
            @pointercancel=${this._onVideoPointerEnd}
          >
            <upc-media-view
              .hass=${this.hass}
              .nvrId=${this._nvrId}
              .cameraId=${cameraId}
              .gaps=${gaps}
              .targetTime=${this._targetTime}
              .scrubbing=${this._scrubbing}
              .live=${this._liveMode}
              .stacked=${this._isStacked()}
              .chunkSeconds=${this._config.chunk_seconds ?? 300}
              .previewDir=${this._scrubDir()}
              .tipEnabled=${this._config.scrub_tip !== false}
              .previewMode=${this._config.scrub_preview_mode ?? 'sprites'}
              .fastPreview=${this._config.scrub_fast_preview ?? 'always'}
              .footageSpans=${this._footageSpans}
              .accent=${accent}
              .clipEndTime=${this._clipEnd}
              .now=${this._now}
              .delaySeconds=${this._config.delay_seconds ?? 15}
              .liveAudioStart=${this._config.live_audio_start ?? 'muted'}
              .liveTransport=${this._config.live_transport ?? 'auto'}
              .liveBridgeCameraId=${this._liveBridgeCamera(cameraId)}
              .startFs=${this._drillFs}
              .fsTimeline=${fsTimeline}
              .fsTimelineWidth=${fsTimelineWidth}
              .fsTimelinePadding=${fsTimelinePadding}
              .fsTimelineGutter=${fsTimelineGutter}
              .fsTimelineGrabWidth=${fsTimelineGrabWidth}
              .fsTimelineScrim=${fsTimelineScrim}
              .fsTimelineScrimExtend=${fsTimelineScrimExtend}
              @playback-time=${this._onPlaybackTime}
        @playback-seek=${this._onPlaybackSeek}
              @clip-ended=${this._onClipEnded}
              @live-playing=${this._onLivePlaying}
              @go-live=${this._onLive}
              @rewind=${this._onRewind}
              @fs-exit=${this._onMediaFsExit}
              @fs-change=${this._onPlayerFs}
            >
              ${fsTimeline && this._playerFs ? this._renderScrubber(true) : nothing}
            </upc-media-view>
          </div>
        </div>
      </ha-card>
    `;
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
