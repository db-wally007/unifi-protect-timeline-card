// Always-live camera grid (multi-camera page, below the event strip): one
// muted, control-less <ha-camera-stream> per configured camera — the tiles
// stream each entry's `live_camera` (e.g. the medium-resolution channel) so N
// simultaneous tiles don't decode N × the high-res stream. Overlays per tile, UniFi-app style:
// camera name bottom-left, "<Kind>: <relative time>" of the newest event
// bottom-right (re-rendered by the parent's minute tick).
//
// WIDE layout: the tiles FILL the whole box, NO SCROLLING — `columns` per row
// (default 2), rows = ceil(n/columns); the rows share the box's height and the
// tiles share their row's width (an orphan tile spans its whole row), so there
// is never an empty band whatever the box's shape. Each feed keeps its native
// aspect and is zoomed to cover its tile, cropped evenly around the centre
// (see _renderTile). Pure CSS flex: it follows every resize. Rows are EXPLICIT
// row elements, NOT flex-wrap/CSS grid, so each row holds exactly `columns`.
//
// STACKED (phone) layout: FULL-WIDTH tiles at the video's aspect (no
// letterboxing — the tile matches the 16:9 stream exactly), one per row, and
// the grid SCROLLS vertically instead of shrinking the tiles (UniFi mobile).
//
// Tapping a tile emits `tile-open` with the CameraEntry; the parent either
// navigates (entry.navigation_path) or drills into the in-card timeline.
//
// The grid is UNMOUNTED entirely while a clip plays (see multi-view) — the
// only reliable way to stop <ha-camera-stream>'s decode is to unmount it.

import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { CameraEntry, HomeAssistant } from './data/types';
import { relTime, type MultiBand } from './data/multi-events';
import { releaseVideosIn } from './data/media-release';
/** A tile's picture fades in this slowly once its stream has a frame. */
const TILE_FADE_MS = 800;
/** A stream with no frame after this long is shown anyway (HA's own message). */
const REVEAL_AFTER_MS = 4000;

/** Camera stills (HA's /api/camera_proxy/ URLs) that have come in - kept
 *  across grids: a tile mounted again gets the same still from the browser's
 *  memory cache, which makes no new request to see. Capped (each signed URL
 *  is new every few seconds). */
const POSTERS = new Set<string>();
const POSTERS_MAX = 200;

/** Under `root` (through shadow roots): a <video> with a decoded frame, or an
 *  <img> (MJPEG / still) that has loaded - the stream has a picture up. With
 *  `posters` (the camera stills that have come in), a <video> showing its
 *  poster counts too. */
function hasPicture(root: Element | ShadowRoot, posters?: Set<string>): boolean {
  for (const el of Array.from(root.querySelectorAll('*'))) {
    if (el instanceof HTMLVideoElement && el.readyState >= 2 && el.videoWidth > 0) return true;
    if (el instanceof HTMLVideoElement && el.poster && posters?.has(el.poster)) return true;
    if (el instanceof HTMLImageElement && el.complete && el.naturalWidth > 0) return true;
    if (el.shadowRoot && hasPicture(el.shadowRoot, posters)) return true;
  }
  return false;
}

@customElement('upc-live-grid')
export class LiveGrid extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @property({ attribute: false }) entries: CameraEntry[] = [];
  // Reflected so the stacked (phone) styling can key off :host([stacked]).
  @property({ type: Boolean, reflect: true }) stacked = false;
  // Newest display event per camera entity_id (for the bottom-right overlay).
  // A fresh object is passed on every parent render, so updates propagate.
  @property({ attribute: false }) newest: Record<string, MultiBand | undefined> = {};
  // Bumped once a minute by the parent so the relative times re-render.
  @property({ type: Number }) minuteTick = 0;
  @property({ type: Number }) columns = 2; // wide-layout tiles per row; 0 = all in one row
  // Experimental 1-column tablet view: fill the column width at aspect and
  // scroll vertically (like stacked) instead of fitting every tile on screen.
  // ('scroll' is reserved on Element — hence scrollMode / [scrollmode].)
  @property({ type: Boolean, reflect: true, attribute: 'scrollmode' }) scrollMode = false;
  // Tile aspect where tiles keep one (stacked + scroll mode); wide tiles fill.
  @property() aspect = '16/9';

  // True once HA's <ha-camera-stream> element is defined (lazy-loaded).
  @state() private _streamReady = false;
  // Not until the observer says so: a popup sliding in starts off screen, and
  // streams started at once were torn down and started again 0.1 s later.
  @state() private _visible = false;
  private _visibilityObserver?: IntersectionObserver;
  // When each stream element was first seen without a picture (_watchFrames).
  private _streamSince = new WeakMap<Element, number>();
  private _frameTimer?: ReturnType<typeof setTimeout>;
  // Phone: HA's players show the camera's latest snapshot (their <video>'s
  // poster) until the stream's first frame, which can take seconds - a tile
  // shows as soon as either is up. The stills are seen through Resource
  // Timing (POSTERS): the player's own request, no second one.
  private _posterObserver?: PerformanceObserver;

  static styles = css`
    :host {
      display: block;
      height: 100%;
      overflow: hidden; /* wide: the tiles fill the box — nothing to scroll */
    }
    /* Stacked (phone): full-width tiles at natural height — the PAGE
       (multi-view host) scrolls, not this element. */
    :host([stacked]) {
      height: auto;
      overflow: visible;
    }
    /* SCROLL mode (experimental 1-column tablet view): tiles fill the column
       width at their aspect and THIS element scrolls vertically instead of
       shrinking to fit — the hidden scrollbar keeps it clean. */
    :host([scrollmode]) {
      overflow-y: auto;
      scrollbar-width: none;
    }
    :host([scrollmode])::-webkit-scrollbar {
      display: none;
    }
    .grid {
      height: 100%;
      display: flex;
      flex-direction: column;
      gap: 0; /* flush tiles — no spacing, like the UniFi app */
    }
    :host([stacked]) .grid,
    :host([scrollmode]) .grid {
      height: auto; /* content-sized — scrolls instead of filling */
    }
    .row {
      display: flex;
      flex: 1 1 0; /* wide: the rows share the box's height */
      min-height: 0;
      gap: 0;
    }
    :host([stacked]) .row,
    :host([scrollmode]) .row {
      flex: 0 0 auto;
    }
    .tile {
      position: relative;
      flex: 1 1 0; /* wide: the tiles share their row (an orphan spans it) */
      min-width: 0;
      border-radius: 0; /* flush, like the UniFi app */
      overflow: hidden;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    :host([stacked]) .tile,
    :host([scrollmode]) .tile {
      aspect-ratio: var(--upc-grid-aspect, 16/9);
    }
    :host([stacked]) .tile {
      border-radius: 10px; /* phone: full-width cards read better rounded */
      background: #000;
      /* The whole tile - its black card, picture and labels - waits invisible
         until its stream has a picture, then fades in as one (see
         _watchFrames): black cards and names popping up first read as a
         flash. */
      opacity: 0;
      transition: opacity ${TILE_FADE_MS}ms ease;
    }
    :host([stacked]) .tile.ready {
      opacity: 1;
    }
    /* --video-max-height: see the long note in media-view.ts. HA's players cap
       their inner <video> at calc(100vh - 97px) and let it sit at the top of the
       box, which pins the picture high and shrinks it whenever a tile is taller
       than that cap. Same override here so grid tiles letterbox like everything
       else. */
    ha-camera-stream {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #000;
      --video-max-height: 100%;
      pointer-events: none; /* controls are off; the tile itself is the tap target */
      /* Shown once it has a picture, slowly (see _watchFrames). */
      opacity: 0;
      transition: opacity ${TILE_FADE_MS}ms ease;
    }
    ha-camera-stream.live,
    :host([stacked]) ha-camera-stream {
      opacity: 1; /* (the phone fades the whole tile instead) */
    }
    .connecting {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--secondary-text-color, #9aa0a6);
      font-size: 13px;
    }
    /* Dark-to-transparent scrim along the bottom so the name / motion overlays
       stay legible over light footage (text-shadow alone washes out). Sits above
       the video, below the text (z-index 2). */
    .tile::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 46px;
      background: linear-gradient(to top, rgba(0, 0, 0, 0.55), transparent);
      pointer-events: none;
      z-index: 1;
      /* ...with the picture it is for. */
      opacity: 0;
      transition: opacity ${TILE_FADE_MS}ms ease;
    }
    .tile:has(ha-camera-stream.live)::after {
      opacity: 1;
    }
    /* Overlays read on any footage thanks to the scrim + text shadow. */
    .name {
      position: absolute;
      left: 12px;
      bottom: 9px;
      font-size: 14px;
      font-weight: 700;
      color: #fff;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
      pointer-events: none;
      z-index: 2;
    }
    .last {
      position: absolute;
      right: 12px;
      bottom: 9px;
      font-size: 12px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.9);
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
      pointer-events: none;
      z-index: 2;
    }
    /* Phone (stacked): the tiles run full-width, so the overlays read a touch
       small — bump both up 1px. Tablet keeps 14/12. */
    :host([stacked]) .name {
      font-size: 15px;
    }
    :host([stacked]) .last {
      font-size: 13px;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    // Live tiles need HA's <ha-camera-stream>. It's defined lazily; load the
    // card helpers to pull it in, then flip _streamReady to render it.
    if (customElements.get('ha-camera-stream')) {
      this._streamReady = true;
    } else {
      const load = (window as unknown as { loadCardHelpers?: () => Promise<unknown> })
        .loadCardHelpers;
      load?.().then(() => {
        this._streamReady = !!customElements.get('ha-camera-stream');
      });
      // Also resolve when it appears on its own.
      customElements.whenDefined('ha-camera-stream').then(() => {
        this._streamReady = true;
      });
    }
    // Bubble popups and cached dashboard views can hide the grid with
    // display:none without disconnecting it. Stop all decoders in that state;
    // simply removing them during the following render is not enough.
    this._visibilityObserver = new IntersectionObserver((entries) => {
      const visible = entries[entries.length - 1].isIntersecting;
      if (visible === this._visible) return;
      if (!visible) releaseVideosIn(this.renderRoot as unknown as DocumentFragment);
      this._visible = visible;
    });
    this._visibilityObserver.observe(this);
    try {
      this._posterObserver = new PerformanceObserver((list) => {
        let any = false;
        for (const e of list.getEntries()) {
          if (!e.name.includes('/api/camera_proxy/') || POSTERS.has(e.name)) continue;
          POSTERS.add(e.name);
          if (POSTERS.size > POSTERS_MAX) POSTERS.delete(POSTERS.values().next().value!);
          any = true;
        }
        if (any) this._watchFrames();
      });
      this._posterObserver.observe({ type: 'resource', buffered: true });
    } catch {
      // No Resource Timing: the streams' frames alone show the tiles.
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this._frameTimer);
    this._frameTimer = undefined;
    this._visibilityObserver?.disconnect();
    this._visibilityObserver = undefined;
    this._posterObserver?.disconnect();
    this._posterObserver = undefined;
    // Unmounting the tiles does NOT stop them decoding: a detached <video>
    // holds its MediaSource and stays at NETWORK_LOADING, and HA caches the
    // view so it is never collected. On iOS those retained pipelines starve
    // whatever mounts next (the per-camera view's high-res live stream, its scrub
    // preview, its clip playback). See data/media-release.ts.
    releaseVideosIn(this.renderRoot as unknown as DocumentFragment);
  }

  protected updated(): void {
    this._watchFrames();
  }

  /** Each tile's picture fades in (ha-camera-stream.live; on the phone the
   *  whole tile, .tile.ready) once its stream has a frame: the streams start
   *  0.2-2 s apart, and pictures popping into the tiles one by one read as a
   *  flash. Polled - the frame is three shadow roots down, and HA may swap its
   *  player. */
  private _watchFrames = (): void => {
    clearTimeout(this._frameTimer);
    this._frameTimer = undefined;
    const now = performance.now();
    let waiting = false;
    for (const s of Array.from(this.renderRoot.querySelectorAll<HTMLElement>('ha-camera-stream:not(.live)'))) {
      let since = this._streamSince.get(s);
      if (since === undefined) {
        since = now;
        this._streamSince.set(s, since);
        s.closest('.tile')?.classList.remove('ready'); // a new stream: its tile waits again
      }
      const posters = this.stacked ? POSTERS : undefined;
      if ((s.shadowRoot && hasPicture(s.shadowRoot, posters)) || now - since > REVEAL_AFTER_MS) {
        s.classList.add('live');
        s.closest('.tile')?.classList.add('ready');
      } else waiting = true;
    }
    // A camera that is not found has no stream to wait for: its tile (and the
    // message in it) shows at once.
    for (const t of Array.from(this.renderRoot.querySelectorAll<HTMLElement>('.tile:not(.ready)'))) {
      if (t.querySelector('.connecting')) t.classList.add('ready');
    }
    if (waiting && this.isConnected) this._frameTimer = setTimeout(this._watchFrames, 100);
  };

  /** One camera's tile (a zoom transition flies to and from it - from the
   *  part of it inside this grid's viewport, see coverPart). */
  tileOf(camera: string): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(`.tile[data-camera="${CSS.escape(camera)}"]`);
  }

  private _open(entry: CameraEntry): void {
    this.dispatchEvent(
      new CustomEvent('tile-open', { detail: entry, bubbles: true, composed: true }),
    );
  }

  private _renderTile(entry: CameraEntry) {
    const streamId = entry.live_camera || entry.camera;
    const stateObj = this.hass?.states[streamId];
    const name =
      entry.name ||
      (this.hass?.states[entry.camera]?.attributes?.friendly_name as string | undefined) ||
      entry.camera.split('.')[1] ||
      entry.camera;
    const newest = this.newest[entry.camera];
    // Every feed FILLS its tile, like the UniFi app's overview - it keeps its
    // aspect and is zoomed until it covers the tile, cropped evenly around the
    // centre (object-fit cover), never letterboxed (on the phone's 16:9 tiles
    // that is the portrait doorbell: no black bars beside it). HA's players
    // apply `fitMode` to their <video>. The tile itself opens the camera, so
    // there is no fullscreen button.
    return html`
      <div class="tile" role="button" data-camera=${entry.camera} @click=${() => this._open(entry)}>
        ${this._visible && this._streamReady && stateObj
          ? html`<ha-camera-stream
              .hass=${this.hass}
              .stateObj=${stateObj}
              .controls=${false}
              .muted=${true}
              .fitMode=${'cover'}
              allow-exoplayer
            ></ha-camera-stream>`
          : stateObj
            ? nothing
            : html`<div class="connecting">${streamId} not found</div>`}
        <span class="name">${name}</span>
        ${newest
          ? html`<span class="last">${newest.label}: ${relTime(newest.start, Date.now())}</span>`
          : ''}
      </div>
    `;
  }

  render() {
    const cols = this.stacked ? 1 : this.columns || Math.max(1, this.entries.length);
    // Explicit rows of exactly `cols` tiles (see header comment).
    const rows: CameraEntry[][] = [];
    for (let i = 0; i < this.entries.length; i += cols) {
      rows.push(this.entries.slice(i, i + cols));
    }
    return html`
      <div class="grid" style="--upc-grid-aspect:${this.aspect}">
        ${rows.map((row) => html`<div class="row">${row.map((e) => this._renderTile(e))}</div>`)}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'upc-live-grid': LiveGrid;
  }
}
