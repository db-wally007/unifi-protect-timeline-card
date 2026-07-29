// Multi-camera page body (card_version: multi): the merged event strip on top,
// and below it EITHER the always-live camera grid OR — while a strip clip is
// selected — a single playback surface in the grid's place. The live streams
// are unmounted during playback on purpose: one decode instead of N, so a
// low-end tablet never has to run the clip AND the live tiles together.
//
// Data: one manifest per camera (same pyscript protect_thumbs cache the single
// card uses), fanned out in parallel every REFRESH_MS. Each camera's raw events
// are gap-merged per camera (two cameras seeing the same person = two clips,
// like the UniFi app) and interleaved newest-first for the strip. Stale/missing
// manifests trigger the sync service, throttled — the service syncs all cameras
// in one run, so one call covers every stale manifest.
//
// Playback reuses <upc-media-view> with the single card's event-clip contract
// (see card.ts _playBand): padded start/end, that camera's footage spans for
// tier-aware segment cutting, live=false. keyed() forces a remount per clip so
// no media-view state can leak between clips/cameras.

import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import type { CameraEntry, CardConfig, HomeAssistant } from './data/types';
import { loadManifest, manifestToBand } from './data/manifest';
import { groupBands } from './data/event-groups';
import { buildFootageSpans, type FootageSpan } from './data/footage-map';
import { mergeStrip, tagBands, type MultiBand } from './data/multi-events';
import { ThumbnailLoader } from './data/thumbnail-loader';
import { THUMBS_BASE } from './data/ha-urls';
import { navigate } from './data/navigate';
import './event-strip';
import './events-list';
import './live-grid';
import './media-view';

const REFRESH_MS = 30_000;
const SYNC_THROTTLE_MS = 2 * 60_000;
// Fit-mode (2-column) top reserve so the density control (top-right, ~54px
// tall incl. its 8px offset) never overlaps the first row of live cameras when
// the card opens. Scroll mode (step 1) passes 0 — floating over scroll is fine.
const GRID_PAD_TOP = 56;

// Grid-view icons (tablet live-grid density control): rows-only (1 full-width
// column, scrolls) and 2 columns (fit-to-box). Drawn inline so they read
// exactly like the segmented control mock — filled bars via currentColor.
const V_ROWS = html`<svg viewBox="0 0 24 24">
  <rect x="4" y="5" width="16" height="5.5" rx="1.5"></rect>
  <rect x="4" y="13.5" width="16" height="5.5" rx="1.5"></rect>
</svg>`;
const V_2COL = html`<svg viewBox="0 0 24 24">
  <rect x="4" y="5" width="6.6" height="14" rx="1.5"></rect>
  <rect x="13.4" y="5" width="6.6" height="14" rx="1.5"></rect>
</svg>`;

interface CameraData {
  bands: MultiBand[]; // grouped display events, newest-first
  spans: FootageSpan[]; // padded raw events (tier-aware playback segment cuts)
  preMs: number; // camera recording padding (clip covers start-pre .. end+post)
  postMs: number;
}

@customElement('upc-multi-view')
export class MultiView extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @property({ attribute: false }) config!: CardConfig;
  // Computed by the card's existing width machinery (_isStacked) — no second
  // ResizeObserver here. Reflected so styling can key off :host([stacked]).
  @property({ type: Boolean, reflect: true }) stacked = false;

  @state() private _data = new Map<string, CameraData>(); // by camera entity_id
  @state() private _strip: MultiBand[] = []; // merged, newest-first
  @state() private _playback?: MultiBand; // undefined = live grid
  // Events browsing mode (header chevron): the strip becomes a grid LIST and
  // the live cameras are UNMOUNTED (no video decode while browsing events).
  @state() private _expanded = false;
  // Last clip played this session — the expanded grid keeps its border after
  // the playback overlay closes (hard to tell which clip you just watched).
  @state() private _lastPlayedKey = '';
  @state() private _minuteTick = 0; // drives the tiles' relative-time overlays
  @state() private _thumbVersion = 0; // bumped when a thumbnail finishes loading
  // Tablet live-grid density: 1 = single full-width scrolling column, 2 = two
  // fit-to-box columns. Always defaults to 2 when the card first opens (a live
  // toggle, not remembered and not configurable).
  @state() private _gridView = 2;

  // Shared, NVR-safe thumbnail loader (strip bands carry their own camera).
  private _loader = new ThumbnailLoader(2, () => {
    this._thumbVersion++;
  });

  private _refreshTimer?: ReturnType<typeof setInterval>;
  private _minuteTimer?: ReturnType<typeof setInterval>;
  private _lastSyncTrigger = 0; // throttles card-initiated sync service calls
  private _syncRefetchTimer?: ReturnType<typeof setTimeout>;
  private _fetchSeq = 0; // invalidates in-flight fan-outs on config change

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 20px; /* clear separation between the event strip and the live grid */
      min-height: 0;
    }
    /* Stacked (phone): ONE page scroll — the strip and the camera tiles are
       normal flow content and scroll away together (hidden scrollbar). The
       host owns the 12px side padding (the card dropped its own — see
       ha-card.multi-stacked in card.ts): the -12px edge bleeds then land
       EXACTLY on the host edges, so nothing overflows horizontally and the
       page can never pan sideways (overflow-x hidden as the backstop). */
    :host([stacked]) {
      overflow-y: auto;
      overflow-x: hidden;
      padding: 0 12px;
      box-sizing: border-box;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    :host([stacked])::-webkit-scrollbar {
      display: none;
    }
    upc-event-strip {
      flex: 0 0 auto;
    }
    /* Expanded events grid (wide layout): the strip becomes the flexing,
       internally-scrolling pane. Stacked keeps natural height (page scrolls). */
    upc-event-strip[expanded] {
      flex: 1 1 auto;
      min-height: 0;
    }
    :host([stacked]) upc-event-strip[expanded] {
      flex: 0 0 auto;
    }
    .body {
      flex: 1 1 auto;
      min-height: 0;
      position: relative;
    }
    :host([stacked]) .body {
      flex: 0 0 auto; /* natural height — part of the page scroll */
    }
    upc-live-grid,
    .playwrap {
      position: absolute;
      inset: 0;
    }
    /* Stacked: grid and player sit in normal flow at their natural height. */
    :host([stacked]) upc-live-grid {
      position: static;
      height: auto;
    }
    :host([stacked]) .playwrap {
      position: relative;
      inset: auto;
      aspect-ratio: 16 / 9; /* full-width player pane while a clip plays */
    }
    /* Stacked: the live tiles run EDGE TO EDGE — escape the ha-card's
       12px side padding (matches the padding constant in card.ts styles). */
    upc-live-grid.bleed {
      left: -12px;
      right: -12px;
    }
    :host([stacked]) upc-live-grid.bleed {
      left: auto;
      right: auto;
      margin: 0 -12px; /* static flow: escape the padding via margins */
    }
    upc-media-view {
      position: absolute;
      inset: 0;
    }
    /* Back-to-live pill over the playback surface (top-right, above the video
       but clear of its bottom controls). Matches the dark floating pills. */
    .live-pill {
      position: absolute;
      top: 10px;
      right: 10px;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 9px 16px;
      border: none;
      border-radius: 22px;
      cursor: pointer;
      color: #fff;
      font-size: 13px;
      font-weight: 600;
      background: rgba(0, 0, 0, 0.6);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
      z-index: 3;
      -webkit-tap-highlight-color: transparent;
    }
    /* Which camera's clip is playing (top-left, mirrors the tiles' name spot). */
    .play-cam {
      position: absolute;
      top: 14px;
      left: 12px;
      font-size: 14px;
      font-weight: 700;
      color: #fff;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
      pointer-events: none;
      z-index: 3;
    }
    /* Expanded-grid playback: a lightbox OVER the grid (the grid stays put).
       position:fixed resolves against the nearest transformed ancestor — the
       mobile view's fixed card / the bubble popup — so the scrim covers the
       card/popup; with no such ancestor it covers the viewport (also fine). */
    .playoverlay {
      position: fixed;
      inset: 0;
      z-index: 5;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background: rgba(0, 0, 0, 0.6);
    }
    .playbox {
      position: relative;
      width: min(100%, 900px);
      aspect-ratio: 16 / 9;
    }
    /* ---- Tablet (wide) layout: a UniFi-app split — events LIST on the left,
       live camera grid on the right. The chevron expands the events to a
       full-width grid (cameras hidden). Mobile/stacked keeps the top-strip
       layout above; this block only applies to the non-stacked render. ---- */
    .tablet {
      display: flex;
      flex-direction: row;
      gap: 16px;
      flex: 1 1 auto;
      min-height: 0;
      height: 100%;
    }
    .events-pane {
      flex: 0 0 302px; /* fixed sidebar width; the grid takes the rest */
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .tablet.expanded .events-pane {
      flex: 1 1 auto; /* expanded: the events grid fills the whole page */
    }
    .ev-head {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 2px 8px;
      font-size: 14px;
      font-weight: 700;
      color: var(--secondary-text-color);
      flex: 0 0 auto;
    }
    .ev-count {
      color: var(--primary-text-color);
    }
    .ev-chev {
      /* Sits right after the "Events N" text (no margin-left:auto) so it stays
         with the title in BOTH the narrow list and the full-width grid. */
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: transparent;
      padding: 4px;
      color: var(--secondary-text-color);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .ev-chev ha-icon {
      --mdc-icon-size: 22px;
      display: block;
      transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .tablet.expanded .ev-chev ha-icon {
      transform: rotate(180deg); /* chevron-right -> chevron-left (collapse) */
    }
    .events-scroll {
      position: relative; /* upc-events-list fills it via absolute inset:0 */
      flex: 1 1 auto;
      min-height: 0;
    }
    .events-scroll.grid {
      display: flex;
      flex-direction: column; /* the expanded event-strip fills the height */
    }
    .events-scroll.grid upc-event-strip {
      flex: 1 1 auto;
      min-height: 0;
    }
    /* Right pane: the live grid / clip player fills it (children are inset:0). */
    .tablet .body {
      flex: 1 1 auto;
      position: relative;
      min-height: 0;
    }
    /* Grid-density control — a segmented button floating over the top-RIGHT of
       the live grid (rows / 2-col). The active step reads white. Sits LEFT of
       the top tile's fullscreen button (which keeps the corner). */
    .grid-view {
      position: absolute;
      top: 8px;
      right: 48px;
      z-index: 4;
      display: inline-flex;
      gap: 2px;
      padding: 3px;
      border-radius: 11px;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(2px);
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
  `;

  connectedCallback(): void {
    super.connectedCallback();
    this._refreshTimer = setInterval(() => void this._fetchAll(), REFRESH_MS);
    this._minuteTimer = setInterval(() => {
      this._minuteTick++;
    }, 60_000);
    // Cached-view reconnect (multicamera view navigated away from and back):
    // ALWAYS re-open on the MAIN screen — events on top + the live camera grid.
    // A cached element keeps its last state, which would otherwise re-show the
    // previously-selected clip (paused, not playing). Forget it entirely and
    // drop back to the live grid (the stale player is unmounted). Skip the very
    // first mount (defaults already hold; render handles it).
    if (this.hasUpdated) {
      this._resetToMain();
      void this._fetchAll();
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._refreshTimer);
    clearInterval(this._minuteTimer);
    clearTimeout(this._syncRefetchTimer);
    this._loader.cancelAll(); // nothing will consume in-flight snapshots anymore
    // Leaving the view: drop any selected clip so the media-view unmounts NOW
    // (cancels its NVR export / stops playback) instead of lingering in state.
    this._resetToMain();
  }

  /** Return to the default main screen: no clip selected (live grid shown), not
   *  in the expanded events browser, default 2-column density, no last-played
   *  highlight. Used on every (re)entry so the view never resumes mid-clip. */
  private _resetToMain(): void {
    this._playback = undefined;
    this._expanded = false;
    this._lastPlayedKey = '';
    this._gridView = 2;
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('config') && this.config) {
      this._playback = undefined;
      this._expanded = false;
      this._lastPlayedKey = '';
      void this._fetchAll();
    }
    // Tablet expand: the freshly-mounted grid slides IN from the left + fades.
    // (Collapse animates the grid out in _onToggleExpand before the state flip.)
    if (changed.has('_expanded') && this._expanded && !this.stacked) {
      this.renderRoot.querySelector('.events-scroll.grid')?.animate(
        [
          { opacity: 0, transform: 'translateX(-30px)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 300, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
      );
    }
    // Tablet collapse: the returning live cameras fade in + slide from the right.
    // The fade is the point — it masks the flash while each live stream is
    // establishing its first frame (otherwise the tiles snap in mid-startup).
    if (
      changed.has('_expanded') &&
      !this._expanded &&
      changed.get('_expanded') === true &&
      !this.stacked
    ) {
      this.renderRoot.querySelector('.tablet .body')?.animate(
        [
          // The SLIDE finishes early (~offset 0.45 = ~315ms) so it stays snappy,
          // while the OPACITY keeps ramping over the full duration — a longer
          // fade masks more of the live-stream startup flash without the motion
          // feeling sluggish.
          { opacity: 0, transform: 'translateX(24px)', offset: 0 },
          { transform: 'none', offset: 0.45 },
          { opacity: 1, transform: 'none', offset: 1 },
        ],
        { duration: 700, easing: 'ease-out' },
      );
    }
  }

  /** Normalized `cameras:` entries (strings become { camera }). */
  private _entries(): CameraEntry[] {
    const raw = this.config?.cameras ?? [];
    return raw
      .map((c) => (typeof c === 'string' ? { camera: c } : c))
      .filter((c) => !!c?.camera);
  }

  /** Display name: config override -> friendly_name -> object_id. */
  private _name(e: CameraEntry): string {
    if (e.name) return e.name;
    const fn = this.hass?.states[e.camera]?.attributes?.friendly_name;
    if (typeof fn === 'string' && fn) return fn;
    return e.camera.split('.')[1] ?? e.camera;
  }

  private _nvrIdFor(camera: string): string {
    if (this.config?.nvr_id) return this.config.nvr_id;
    return this.hass?.entities?.[camera]?.config_entry_id ?? '';
  }

  /** Fan out one manifest load per camera (cheap static JSON), group each
   *  camera's events, rebuild the merged strip. Per-camera cache dirs are
   *  always derived from the entry's `camera` object_id — an explicit
   *  thumbnail_cache_dir can't apply to N cameras and is ignored here. */
  private async _fetchAll(): Promise<void> {
    const entries = this._entries();
    if (!entries.length) return;
    const seq = ++this._fetchSeq;
    const results = await Promise.all(
      entries.map(async (e) => {
        const obj = e.camera.split('.')[1];
        return { e, loaded: obj ? await loadManifest(`${THUMBS_BASE}/${obj}`) : undefined };
      }),
    );
    if (seq !== this._fetchSeq) return; // superseded by a config change
    const gapMs = (this.config?.event_merge_gap_seconds ?? 60) * 1000;
    const data = new Map<string, CameraData>();
    let anyStale = false;
    for (const { e, loaded } of results) {
      if (!loaded || loaded.stale) anyStale = true;
      if (!loaded) continue;
      data.set(e.camera, {
        bands: tagBands(groupBands(loaded.entries.map(manifestToBand), gapMs), e.camera, this._name(e)),
        spans: buildFootageSpans(loaded.entries, loaded.preMs, loaded.postMs),
        preMs: loaded.preMs,
        postMs: loaded.postMs,
      });
    }
    this._data = data;
    this._strip = mergeStrip([...data.values()].map((d) => d.bands));
    this._thumbVersion++; // re-render so cached thumbs appear
    if (anyStale) this._requestSync();
  }

  /** Fire the pyscript sync service (throttled; it syncs ALL cameras) and
   *  re-check the manifests a few seconds later. No-ops without pyscript. */
  private _requestSync(): void {
    if (!this.hass) return;
    const now = Date.now();
    if (now - this._lastSyncTrigger < SYNC_THROTTLE_MS) return;
    this._lastSyncTrigger = now;
    this.hass
      .callWS({ type: 'call_service', domain: 'pyscript', service: 'protect_thumbs_sync' })
      .catch(() => {
        /* pyscript not installed / service unavailable — no local cache, fine */
      });
    clearTimeout(this._syncRefetchTimer);
    this._syncRefetchTimer = setTimeout(() => void this._fetchAll(), 8_000);
  }

  private _onStripSelect = (e: CustomEvent<MultiBand>): void => {
    // Collapsed: the player mounts where the live grid was. Expanded: the grid
    // STAYS and the player opens as an overlay on top of it (see render).
    this._playback = e.detail;
    this._lastPlayedKey = `${e.detail.type}@${e.detail.start}`;
  };

  private _onToggleExpand = async (): Promise<void> => {
    // Mobile keeps the event-strip's own up/down animation.
    if (this.stacked) {
      this._expanded = !this._expanded;
      if (this._expanded) this._playback = undefined;
      return;
    }
    // Tablet: the grid fades + slides horizontally (in from the left on expand,
    // out to the left on collapse). Collapse animates BEFORE the state flip.
    if (this._expanded) {
      const grid = this.renderRoot.querySelector('.events-scroll.grid');
      if (grid) {
        await grid
          .animate(
            [
              { opacity: 1, transform: 'none' },
              { opacity: 0, transform: 'translateX(-30px)' },
            ],
            { duration: 240, easing: 'ease-in', fill: 'forwards' },
          )
          .finished.catch(() => undefined);
      }
      this._expanded = false;
    } else {
      this._playback = undefined;
      this._expanded = true; // the expand-in animation runs in updated()
    }
  };

  private _closePlayback = (): void => {
    this._playback = undefined; // media-view unmounts (cancels the NVR export)
  };

  // Change the tablet live-grid density (1 = full-width scroll, 2 = columns).
  private _setGridView(n: number): void {
    this._gridView = n;
  }

  /** Segmented control that resizes the tablet live grid (1 or 2 columns). */
  private _renderGridView(view: number) {
    const btn = (n: number, title: string, icon: unknown) => html`
      <button
        class=${view === n ? 'on' : ''}
        title=${title}
        @click=${() => this._setGridView(n)}
      >
        ${icon}
      </button>
    `;
    return html`<div class="grid-view">
      ${btn(1, 'Single column', V_ROWS)} ${btn(2, 'Two columns', V_2COL)}
    </div>`;
  }

  private _onTileOpen = (e: CustomEvent<CameraEntry>): void => {
    const path = e.detail.navigation_path;
    if (path) {
      navigate(path); // SPA nav; that view's back button returns here
      return;
    }
    // No path -> IN-CARD drill: the root card swaps this page for the full
    // single-camera timeline (no HA navigation — popup-safe, see card.ts).
    this.dispatchEvent(
      new CustomEvent('camera-open', { detail: e.detail.camera, bubbles: true, composed: true }),
    );
  };

  // A grid tile's fullscreen button -> drill into that camera's single-camera
  // timeline (fully orchestrated by the card: live tick, rewind→delayed-follow)
  // and auto-enter fullscreen, so it's EXACTLY the timeline fullscreen. The card
  // drills back out to this grid when fullscreen is left.
  private _onTileFs = (e: CustomEvent<CameraEntry>): void => {
    this.dispatchEvent(
      new CustomEvent('camera-fullscreen', {
        detail: e.detail.camera,
        bubbles: true,
        composed: true,
      }),
    );
  };

  render() {
    if (!this.hass || !this.config) return nothing;
    const entries = this._entries();
    const firstCam = entries[0]?.camera ?? '';
    // Loader fallback camera only serves single-camera bands; strip bands carry
    // their own. nvr_id is shared (one Protect NVR per card).
    this._loader.configure(
      this.hass,
      this._nvrIdFor(firstCam),
      firstCam,
      this.config.thumbnail_concurrency ?? 2,
    );
    const accent = this.config.accent_color ?? '#fc9df3';
    const b = this._playback;
    const playKey = b ? `${b.type}@${b.start}` : '';
    const d = b ? this._data.get(b.camera) : undefined;
    // Fresh object each render so the grid re-renders when data/minute change.
    const newest: Record<string, MultiBand | undefined> = {};
    for (const e of entries) newest[e.camera] = this._data.get(e.camera)?.bands[0];

    // Tablet (wide): UniFi-app split — events LIST on the left, cameras on the
    // right. Mobile (stacked) keeps the top-strip layout below.
    if (!this.stacked) return this._renderTablet(entries, accent, b, playKey, d, newest);

    return html`
      <upc-event-strip
        captions
        .bands=${this._strip}
        .loader=${this._loader}
        .thumbVersion=${this._thumbVersion}
        .headerText=${this.config.strip_title ?? 'Events'}
        .thumbSize=${this.config.mobile_events_thumbnail_size ?? 0}
        .timeSize=${this.config.strip_time_size ?? 12}
        .itemTextSize=${(this.config.list_text_size ?? 12) + 1}
        .playingKey=${playKey}
        .lastPlayedKey=${this._lastPlayedKey}
        .expanded=${this._expanded}
        .gridColumns=${2}
        .accent=${accent}
        @strip-select=${this._onStripSelect}
        @toggle-expand=${this._onToggleExpand}
      ></upc-event-strip>
      ${this._expanded
        ? b
          ? html`<div class="playoverlay" @click=${this._closePlayback}>
              ${keyed(
                playKey,
                html`<div class="playbox" @click=${(ev: Event) => ev.stopPropagation()}>
                  ${this._renderPlayer(b, d, accent)}
                  <span class="play-cam">${b.cameraName}</span>
                  <button class="live-pill" @click=${this._closePlayback}>✕</button>
                </div>`,
              )}
            </div>`
          : nothing
        : html`<div class="body">
        ${b
          ? keyed(
              playKey,
              html`<div class="playwrap">
                ${this._renderPlayer(b, d, accent)}
                <span class="play-cam">${b.cameraName}</span>
                <button class="live-pill" @click=${this._closePlayback}>✕&nbsp;&nbsp;Live</button>
              </div>`,
            )
          : html`<upc-live-grid
              class=${this.stacked ? 'bleed' : ''}
              .hass=${this.hass}
              .entries=${entries}
              .stacked=${this.stacked}
              .newest=${newest}
              .minuteTick=${this._minuteTick}
              .aspect=${this.config.grid_aspect ?? '16/9'}
              @tile-open=${this._onTileOpen}
              @tile-fullscreen=${this._onTileFs}
            ></upc-live-grid>`}
          </div>`}
    `;
  }

  /** Tablet (wide) layout. Collapsed: the timeline-identical events LIST on the
   *  left (ALL cameras merged) + the live grid (or the clip player) on the right
   *  — click an event to play it on the right. Expanded (chevron): the events
   *  become a full-width grid to browse, cameras unmounted. */
  private _renderTablet(
    entries: CameraEntry[],
    accent: string,
    b: MultiBand | undefined,
    playKey: string,
    d: CameraData | undefined,
    newest: Record<string, MultiBand | undefined>,
  ) {
    const cfg = this.config;
    // One thumbnail size shared by the collapsed list and the expanded grid, so
    // they match exactly. The pane widens with it (thumb + a fixed text column).
    const tabW = cfg.tablet_events_thumbnail_size ?? 145;
    // Camera-name size (line 1) drives BOTH views; the time+duration line is one
    // px smaller in BOTH — derived rather than configured, so the collapsed list
    // and the expanded grid captions are always identical.
    const camSize = cfg.list_text_size ?? 12;
    const subSize = Math.max(1, camSize - 1);
    // Live-grid density: 1 = a single full-width scrolling column, 2 = fit-to-
    // box columns (the default). Also lights up the matching control button.
    const gridCols = this._gridView === 1 ? 1 : 2;
    const gridView = gridCols;
    const head = html`
      <div class="ev-head">
        <span>${cfg.strip_title ?? 'Events'}</span>
        <span class="ev-count">${this._strip.length}</span>
        <button
          class="ev-chev"
          title=${this._expanded ? 'Show cameras' : 'Browse all events'}
          @click=${this._onToggleExpand}
        >
          <ha-icon icon="mdi:chevron-right"></ha-icon>
        </button>
      </div>
    `;

    if (this._expanded) {
      // Full-width events grid (browse). The player opens as a lightbox over it.
      return html`
        <div class="tablet expanded">
          <div class="events-pane">
            ${head}
            <div class="events-scroll grid">
              <upc-event-strip
                expanded
                hideHead
                gridCaptions
                captions
                .bands=${this._strip}
                .loader=${this._loader}
                .thumbVersion=${this._thumbVersion}
                .timeSize=${cfg.strip_time_size ?? 12}
                .playingKey=${playKey}
                .lastPlayedKey=${this._lastPlayedKey}
                .expanded=${true}
                .gridThumbWidth=${tabW}
                .dateFontSize=${cfg.date_font_size ?? 13}
                .itemTextSize=${camSize}
                .accent=${accent}
                @strip-select=${this._onStripSelect}
              ></upc-event-strip>
            </div>
          </div>
          ${b
            ? html`<div class="playoverlay" @click=${this._closePlayback}>
                ${keyed(
                  playKey,
                  html`<div class="playbox" @click=${(ev: Event) => ev.stopPropagation()}>
                    ${this._renderPlayer(b, d, accent)}
                    <span class="play-cam">${b.cameraName}</span>
                    <button class="live-pill" @click=${this._closePlayback}>✕</button>
                  </div>`,
                )}
              </div>`
            : nothing}
        </div>
      `;
    }

    return html`
      <div class="tablet">
        <div class="events-pane" style="flex-basis:${tabW + 168}px">
          ${head}
          <div class="events-scroll">
            <upc-events-list
              .bands=${this._strip}
              .loader=${this._loader}
              .thumbVersion=${this._thumbVersion}
              .textSize=${camSize}
              .textColor=${cfg.list_text_color ?? ''}
              .durationSize=${subSize}
              .durationColor=${cfg.list_duration_color ?? ''}
              .showCamera=${true}
              .line1White=${true}
              .activeTextSize=${cfg.list_active_text_size ?? 12}
              .activeTextColor=${cfg.list_active_text_color ?? '#000'}
              .activeDurationSize=${cfg.list_active_duration_size ?? 12}
              .activeDurationColor=${cfg.list_active_duration_color ?? '#000'}
              .activeBg=${cfg.list_active_bg ?? cfg.list_highlight_color ?? '#fff'}
              .playingKey=${playKey}
              .dateFontSize=${cfg.date_font_size ?? 13}
              .dateFontColor=${cfg.date_font_color ?? '#ffffff'}
              .dividerColor=${accent}
              .thumbWidth=${tabW}
              @event-selected=${this._onStripSelect}
            ></upc-events-list>
          </div>
        </div>
        <div class="body">
          ${b
            ? keyed(
                playKey,
                html`<div class="playwrap">
                  ${this._renderPlayer(b, d, accent)}
                  <span class="play-cam">${b.cameraName}</span>
                  <button class="live-pill" @click=${this._closePlayback}>✕&nbsp;&nbsp;Live</button>
                </div>`,
              )
            : html`<upc-live-grid
                  .hass=${this.hass}
                  .entries=${entries}
                  .stacked=${false}
                  .newest=${newest}
                  .minuteTick=${this._minuteTick}
                  .columns=${gridCols}
                  .scrollMode=${gridCols === 1}
                  .padTop=${gridCols === 1 ? 0 : GRID_PAD_TOP}
                  .aspect=${this.config.grid_aspect ?? '16/9'}
                  @tile-open=${this._onTileOpen}
                  @tile-fullscreen=${this._onTileFs}
                ></upc-live-grid>
                ${this._renderGridView(gridView)}`}
        </div>
      </div>
    `;
  }

  /** The clip player, identical in both homes: the in-place .playwrap
   *  (collapsed page) and the .playbox lightbox over the expanded grid. */
  private _renderPlayer(b: MultiBand, d: CameraData | undefined, accent: string) {
    return html`<upc-media-view
      .hass=${this.hass}
      .nvrId=${this._nvrIdFor(b.camera)}
      .cameraId=${b.camera}
      .gaps=${[]}
      .footageSpans=${d?.spans ?? []}
      .targetTime=${Math.max(b.start - (d?.preMs ?? 0), 0)}
      .clipEndTime=${Math.min(b.end + (d?.postMs ?? 0), Date.now())}
      .scrubbing=${false}
      .live=${false}
      .stacked=${this.stacked}
      .chunkSeconds=${this.config.chunk_seconds ?? 300}
      .previewDir=${''}
      .accent=${accent}
      .now=${Date.now()}
    ></upc-media-view>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'upc-multi-view': MultiView;
  }
}
