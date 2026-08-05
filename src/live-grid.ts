// Always-live camera grid (multi-camera page, below the event strip): one
// muted, control-less <ha-camera-stream> per configured camera — the tiles
// stream each entry's `live_camera` (e.g. the medium-resolution channel) so N
// simultaneous tiles don't decode N × the high-res stream. Overlays per tile, UniFi-app style:
// camera name bottom-left, "<Kind>: <relative time>" of the newest event
// bottom-right (re-rendered by the parent's minute tick).
//
// WIDE layout: FIT-TO-BOX, NO SCROLLING (UniFi-app behavior) — tiles are
// sized in JS from the grid box's measured width AND height: `columns` per
// row (default 2), rows = ceil(n/columns), tile width = min(width-split,
// height-split × aspect) — every camera always on screen. Rows are EXPLICIT
// row elements (a flex column of centered flex rows), NOT flex-wrap/CSS grid:
// wrap only breaks on overflow (height-constrained tiles can be narrow enough
// that all cameras flow into ONE row) and grid can't center an orphan tile —
// explicit rows force exactly `columns` per row with the last row centered.
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

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { CameraEntry, HomeAssistant } from './data/types';
import { relTime, type MultiBand } from './data/multi-events';
import { releaseVideosIn } from './data/media-release';

const GAP = 0; // px between tiles (both axes) — flush, like the UniFi app

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
  @property() aspect = '16/9';
  // Fit-mode only: reserve this many px at the TOP so a floating overlay (the
  // multi-view density control) never sits on the first row of cameras. The
  // fit-to-box height is reduced by it, so tiles still fit. Ignored in scroll
  // mode (there the overlay floating over scrolled content is fine).
  @property({ type: Number }) padTop = 0;

  // True once HA's <ha-camera-stream> element is defined (lazy-loaded).
  @state() private _streamReady = false;
  // Own measured box — drives the fit-to-box tile size.
  @state() private _boxW = 0;
  @state() private _boxH = 0;
  private _ro?: ResizeObserver;

  static styles = css`
    :host {
      display: block;
      height: 100%;
      overflow: hidden; /* wide: fit-to-box sizing — nothing to scroll */
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
      box-sizing: border-box; /* padding-top (below) counts inside the 100% */
      padding-top: var(--upc-pad-top, 0px); /* fit-mode top reserve (see padTop) */
      display: flex;
      flex-direction: column;
      justify-content: center; /* centers the rows vertically in the box */
      align-items: center;
      gap: 0; /* flush tiles — no spacing, like the UniFi app */
    }
    :host([stacked]) .grid,
    :host([scrollmode]) .grid {
      height: auto; /* content-sized — scrolls instead of fitting */
      justify-content: flex-start;
    }
    .row {
      display: flex;
      justify-content: center; /* centers an orphan tile on its row */
      gap: 0;
      width: 100%;
    }
    .tile {
      position: relative;
      flex: 0 0 auto;
      width: var(--upc-tile-w, 320px);
      aspect-ratio: var(--upc-grid-aspect, 16/9);
      border-radius: 0; /* flush, like the UniFi app */
      overflow: hidden;
      background: #000;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    :host([stacked]) .tile {
      border-radius: 10px; /* phone: full-width cards read better rounded */
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
    /* Per-tile fullscreen button, top-right. Above the scrim/overlays; the
       stream has pointer-events:none and the tile opens on tap, so the button
       just stops propagation. */
    .fs-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 3;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 0;
      border: none;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.4);
      color: #fff;
      cursor: pointer;
      opacity: 0.85;
      -webkit-tap-highlight-color: transparent;
    }
    .fs-btn:hover {
      background: rgba(0, 0, 0, 0.6);
      opacity: 1;
    }
    .fs-btn ha-icon {
      --mdc-icon-size: 20px;
      display: block;
    }
    /* Phone: slightly larger tap target, matching the bumped overlays. */
    :host([stacked]) .fs-btn {
      top: 10px;
      right: 10px;
      width: 36px;
      height: 36px;
    }
    :host([stacked]) .fs-btn ha-icon {
      --mdc-icon-size: 22px;
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
    this._ro = new ResizeObserver((es) => {
      const r = es[es.length - 1].contentRect;
      if (r.width && r.height && (r.width !== this._boxW || r.height !== this._boxH)) {
        this._boxW = r.width;
        this._boxH = r.height;
      }
    });
    this._ro.observe(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._ro?.disconnect();
    // Unmounting the tiles does NOT stop them decoding: a detached <video>
    // holds its MediaSource and stays at NETWORK_LOADING, and HA caches the
    // view so it is never collected. On iOS those retained pipelines starve
    // whatever mounts next (the per-camera view's high-res live stream, its scrub
    // preview, its clip playback). See data/media-release.ts.
    releaseVideosIn(this.renderRoot as unknown as DocumentFragment);
  }

  /** Aspect "16/9" -> 16/9 (safe fallback on garbage). */
  private _ratio(): number {
    const [w, h] = this.aspect.split('/').map((s) => parseFloat(s));
    return w > 0 && h > 0 ? w / h : 16 / 9;
  }

  /** Tile width that fits `columns` per row AND all rows in the box height. */
  private _tileWidth(cols: number): number {
    const n = Math.max(1, this.entries.length);
    const rows = Math.ceil(n / cols);
    const w = this._boxW || 320;
    const h = this._boxH || 240;
    const wMax = (w - (cols - 1) * GAP) / cols;
    // Scroll mode: fill the column width (height follows the aspect); the box
    // scrolls when the rows overflow, so don't clamp to the visible height.
    if (this.scrollMode) return Math.max(80, wMax);
    // Fit mode: the top reserve shrinks the usable height, so tiles still fit.
    const hMax = (h - this.padTop - (rows - 1) * GAP) / rows;
    return Math.max(80, Math.min(wMax, hMax * this._ratio()));
  }

  private _open(entry: CameraEntry): void {
    this.dispatchEvent(
      new CustomEvent('tile-open', { detail: entry, bubbles: true, composed: true }),
    );
  }

  /** Per-tile fullscreen button. MOBILE: promote the tile (an always-open
   *  <dialog>) to the top layer via showModal() and CSS-rotate it to LANDSCAPE —
   *  iPhone's native video fullscreen ignores our wish and stays portrait on an
   *  orientation-locked phone, and JS can't lock orientation on iOS. DESKTOP:
   *  real element fullscreen of the tile. Both return to the grid on exit. */
  /** The tile's fullscreen button hands off to the multi page, which opens the
   *  SAME <upc-media-view> player (live) fullscreen as the timeline view — with
   *  its controls, and with tap-toggles-controls (not tap-navigates). */
  private _fullscreen = (e: Event, entry: CameraEntry): void => {
    e.stopPropagation(); // don't also drill into the timeline
    this.dispatchEvent(
      new CustomEvent('tile-fullscreen', { detail: entry, bubbles: true, composed: true }),
    );
  };

  private _renderTile(entry: CameraEntry) {
    const streamId = entry.live_camera || entry.camera;
    const stateObj = this.hass?.states[streamId];
    const name =
      entry.name ||
      (this.hass?.states[entry.camera]?.attributes?.friendly_name as string | undefined) ||
      entry.camera.split('.')[1] ||
      entry.camera;
    const newest = this.newest[entry.camera];
    return html`
      <div class="tile" role="button" @click=${() => this._open(entry)}>
        ${this._streamReady && stateObj
          ? html`<ha-camera-stream
              .hass=${this.hass}
              .stateObj=${stateObj}
              .controls=${false}
              .muted=${true}
              allow-exoplayer
            ></ha-camera-stream>`
          : html`<div class="connecting">
              ${stateObj ? 'Connecting…' : `${streamId} not found`}
            </div>`}
        <span class="name">${name}</span>
        ${newest
          ? html`<span class="last">${newest.label}: ${relTime(newest.start, Date.now())}</span>`
          : ''}
        <button class="fs-btn" title="Fullscreen" @click=${(e: Event) => this._fullscreen(e, entry)}>
          <ha-icon icon="mdi:fullscreen"></ha-icon>
        </button>
      </div>
    `;
  }

  render() {
    const cols = this.stacked ? 1 : this.columns || Math.max(1, this.entries.length);
    // Stacked: full row width (the tile matches the stream's aspect exactly —
    // no letterboxing); wide: fit-to-box (see header comment).
    const tileW = this.stacked ? '100%' : `${this._tileWidth(cols).toFixed(1)}px`;
    // Explicit rows of exactly `cols` tiles (see header comment).
    const rows: CameraEntry[][] = [];
    for (let i = 0; i < this.entries.length; i += cols) {
      rows.push(this.entries.slice(i, i + cols));
    }
    const padTop = this.scrollMode ? 0 : this.padTop;
    return html`
      <div
        class="grid"
        style="--upc-tile-w:${tileW};--upc-grid-aspect:${this.aspect};--upc-pad-top:${padTop}px"
      >
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
