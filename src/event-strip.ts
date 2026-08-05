// UniFi-app-style merged events (multi-camera page, top row), TWO presentations
// toggled by the chevron in the "Events 260" header (emits `toggle-expand`;
// the parent owns the state and passes `expanded` back):
//  • collapsed (default): a horizontally scrollable carousel of event-clip
//    thumbnails across ALL cameras, newest-first — each thumb overlays its
//    start time and carries the camera name below the image.
//  • expanded: a UniFi-app-style GRID list (square cells, camera name +
//    "Today, 4:41 PM" chip top-left) — the parent unmounts the live cameras
//    while expanded, so browsing events costs no video decode.
// Clicking a thumb/cell emits `strip-select`; the playing item gets a white
// border (same active affordance as the camera gallery).
//
// NVR-friendly thumbnails, same discipline as the events list: nearly every
// band has a locally cached file; the rest are only sent to the shared
// ThumbnailLoader when they scroll into view (IntersectionObserver — root is
// the carousel scroller when collapsed, the viewport when expanded), so
// off-screen events never hit the NVR.

import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import type { MultiBand } from './data/multi-events';
import type { ThumbnailLoader } from './data/thumbnail-loader';
import { fmtTime } from './data/fmt'; // PERF-SCRUB-2026-08-03

@customElement('upc-event-strip')
export class EventStrip extends LitElement {
  @property({ attribute: false }) bands: MultiBand[] = [];
  @property({ attribute: false }) loader?: ThumbnailLoader;
  @property({ type: Number }) thumbVersion = 0; // bump => re-render when thumbs load
  // Header text; the merged event count is appended ("Events 260").
  // (Named headerText because `title` is already a global HTMLElement property.)
  @property() headerText = 'Events';
  // Carousel thumb width px (16/10 aspect). 0 = AUTO: exactly two thumbs fit
  // the screen between the edge insets — and the expanded grid's 2 columns
  // are the same width, so toggling only changes the orientation.
  @property({ type: Number }) thumbSize = 0;
  @property({ type: Number }) timeSize = 12; // time label px
  @property() playingKey = ''; // `${type}@${start}` of the clip being played
  // Last clip PLAYED this session — the expanded grid keeps its border after
  // the playback overlay closes, so you can tell which clip you just watched
  // (the carousel doesn't need it: its player never overlays the clips).
  @property() lastPlayedKey = '';
  // Grid-list presentation (reflected so the parent can size the pane).
  @property({ type: Boolean, reflect: true }) expanded = false;
  @property({ type: Number }) gridColumns = 2; // expanded grid columns
  @property() accent = '#fc9df3'; // day-divider line color (matches the timeline)
  // Hide the built-in "Events N + chevron" header. The tablet multi page owns a
  // single header/chevron itself (left events list ↔ full-width grid), so the
  // embedded strip must not render a second one.
  @property({ type: Boolean }) hideHead = false;
  // Expanded grid tuning (tablet). The grid auto-fills cells of this thumb width
  // so the clips are small and match the collapsed list thumbnails; the item
  // texts (camera / time+duration) and the day divider match the collapsed list.
  @property({ type: Number }) gridThumbWidth = 120;
  @property({ type: Number }) dateFontSize = 13; // day-divider label
  @property({ type: Number }) itemTextSize = 12; // grid item camera + time+duration
  // Caption FORMAT (independent of grid geometry): camera name on line 1 +
  // "time · duration" on line 2 UNDER each thumb, no time overlay, and the
  // active clip becomes a white framed card. Used by BOTH the tablet expanded
  // grid and the mobile carousel/grid so their clip captions match. Off = the
  // original compact style (time overlaid on the thumb, camera name below).
  @property({ type: Boolean, reflect: true }) captions = false;
  // Tablet grid GEOMETRY: small fixed-width auto-fill cells (vs mobile's 2×1fr
  // columns). Independent of `captions` — the tablet sets both.
  @property({ type: Boolean, reflect: true }) gridCaptions = false;

  private _prevExpanded?: boolean; // animate only on actual toggles, not mount

  @query('.strip') private _stripEl?: HTMLElement;
  private _io?: IntersectionObserver;
  private _requested = new Set<string>(); // thumbs that entered view (fetch requested)
  private _bandByKey = new Map<string, MultiBand>();

  static styles = css`
    :host {
      display: block;
    }
    /* Header type matches the camera-name captions/overlays (14px/700). */
    .head {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 2px 8px;
      font-size: 14px;
      font-weight: 700;
      color: var(--secondary-text-color);
    }
    .head-count {
      color: var(--primary-text-color);
    }
    /* Carousel <-> grid-list toggle chevron, right after the count. The
       chevron ROTATES on toggle (one icon + transform) instead of swapping
       icons — the smooth turn is half the iOS feel. */
    .expand {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: transparent;
      padding: 0;
      margin: 0;
      color: var(--secondary-text-color);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .expand ha-icon {
      --mdc-icon-size: 22px;
      display: block;
      transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    :host([expanded]) .expand ha-icon {
      transform: rotate(180deg);
    }
    /* iOS-native carousel feel: the SCROLLER runs edge to edge (negative
       margins escape the ha-card's 12px side padding — matches the padding
       constant in card.ts styles) while a leading content inset keeps the
       first thumb 12px off the edge AT REST and scrolls away WITH the content.
       At rest the thumbs bleed under the right screen edge (shows there's
       more); fully scrolled, the last thumb settles 12px from the edge. */
    .strip {
      display: flex;
      gap: 12px; /* same as the edge insets — uniform rhythm, and it makes the
                    auto fit-2 layout symmetric (see thumbW derivation) */
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none; /* hide scrollbar, keep scrolling */
      -ms-overflow-style: none;
      margin: 0 -12px;
      padding: 0 12px 2px;
    }
    .strip::-webkit-scrollbar {
      display: none;
    }
    .empty {
      color: var(--secondary-text-color);
      font-size: 13px;
      padding: 8px 2px;
    }
    .clip {
      flex: 0 0 auto;
      position: relative;
      width: var(--upc-strip-thumb, 104px);
      box-sizing: border-box; /* the active card's padding insets inward */
      border: none;
      background: transparent;
      padding: 0;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .thumb {
      position: relative; /* anchors the .time overlay to the image */
      width: 100%;
      aspect-ratio: 16 / 10;
      border-radius: 8px;
      overflow: hidden;
      background: #000;
      border: 2px solid transparent;
      box-sizing: border-box;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
    }
    .clip.playing .thumb {
      border-color: #fff;
    }
    .thumb img,
    .thumb .ph {
      width: 100%;
      height: 100%;
      display: block;
    }
    .thumb img {
      object-fit: cover;
    }
    .thumb .ph {
      background: var(--divider-color, rgba(255, 255, 255, 0.1));
    }
    /* Time overlay reads on any footage thanks to the text shadow (UniFi-style).
       Anchored to the IMAGE (.thumb is position:relative), not the whole clip
       button, so it stays on the footage above the caption. */
    .time {
      position: absolute;
      left: 7px;
      bottom: 6px;
      font-size: var(--upc-strip-time, 12px);
      font-weight: 600;
      color: #fff;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
      pointer-events: none;
    }
    /* Camera name BELOW the thumbnail — same type as the live tiles' name
       overlay (14px/700 white, normal case), so the strip and the grid read
       as one family. */
    .cam {
      display: block;
      margin-top: 5px;
      font-size: 14px;
      font-weight: 700;
      text-align: left;
      color: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      pointer-events: none;
    }
    /* ---- expanded grid list: the SAME items as the carousel, just laid out
       vertically — 2 columns match the carousel's fit-2 width, so the first
       row doesn't change size when toggling, only the orientation. ---- */
    :host([expanded]) {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    :host([expanded]) .head {
      flex: 0 0 auto;
    }
    .gridlist {
      display: grid;
      grid-template-columns: repeat(var(--upc-egrid-cols, 2), 1fr);
      gap: 12px;
      align-content: start;
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto; /* no-op when unconstrained (stacked: the page scrolls) */
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    .gridlist::-webkit-scrollbar {
      display: none;
    }
    .gridlist .clip {
      width: 100%; /* the grid column defines the width */
      display: flex;
      flex-direction: column; /* thumb on top, camera (+ caption) below */
    }
    /* Tablet grid: FIXED-width cells (not 1fr) so the thumb width is exactly
       --upc-egrid-w — matching the collapsed list thumbnails — instead of
       stretching to fill (which ignored width changes). */
    :host([gridcaptions]) .gridlist {
      grid-template-columns: repeat(auto-fill, var(--upc-egrid-w, 132px));
      justify-content: start;
      gap: 14px 12px;
    }
    /* Caption mode item texts BELOW the thumb: camera on line 1, time +
       duration on line 2 — same size across tablet grid and mobile. */
    :host([captions]) .cam {
      font-size: var(--upc-egrid-item, 12px);
      font-weight: 600;
      margin-top: 4px;
    }
    .sub {
      display: block;
      margin-top: 1px;
      font-size: var(--upc-egrid-sub, 11px); /* 1px under the camera name */
      color: #d0d0d0; /* light inactive grey (lighter than theme secondary ~#b0) */
      text-align: left; /* align with the (left-aligned) camera name above */
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      pointer-events: none;
    }
    /* Caption mode: the PLAYING / last-played clip becomes a white FRAMED card
       (same look as the timeline camera gallery) — the thumbnail is inset by
       the clip's padding so the white mats it on ALL sides (not just a thin
       border), and the caption goes dark on the white. Applies to both the
       tablet grid and the mobile carousel/grid. */
    :host([captions]) .clip.playing {
      background: #fff;
      border-radius: 11px;
      padding: 5px;
    }
    :host([captions]) .clip.playing .thumb {
      border-color: transparent; /* the frame is the padding now, not a border */
      border-radius: 7px; /* concentric inside the 11px card */
      box-shadow: none;
    }
    :host([captions]) .clip.playing .cam {
      color: #000; /* line 1: black on the white card */
    }
    :host([captions]) .clip.playing .sub {
      color: #444; /* line 2: dark-ish grey (was light grey) */
    }
    /* Day separator between events from different days — same look as the
       timeline view's events list (accent rule, white centered date). */
    .day-divider {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 4px 2px;
    }
    .day-divider::before,
    .day-divider::after {
      content: '';
      flex: 1 1 auto;
      height: 1px;
      background: var(--upc-strip-divider, #fc9df3);
    }
    .day-label {
      flex: 0 0 auto;
      font-size: var(--upc-egrid-date, 13px);
      font-weight: 600;
      color: #fff;
      white-space: nowrap;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    // Cached-view reconnect: firstUpdated does not run again, and
    // disconnectedCallback tore down the observer — recreate it so lazy
    // thumbnail loading keeps working after navigating away and back.
    if (this.hasUpdated && !this._io) this._setupObserver();
  }

  firstUpdated(): void {
    this._setupObserver();
  }

  private _setupObserver(): void {
    // Observe thumbs/cells; preload a little on each side. Collapsed: root is
    // the horizontal scroller. Expanded: no .strip exists — root null (the
    // viewport) works for ANY ancestor scroller (page or .gridlist).
    this._io = new IntersectionObserver((entries) => this._onIntersect(entries), {
      root: this._stripEl ?? null,
      rootMargin: '300px 300px',
    });
    this._observeThumbs();
  }

  updated(changed: PropertyValues): void {
    // The scroll root changes between the two presentations — rebuild the
    // observer against the right one (already-requested keys are remembered).
    if (changed.has('expanded')) {
      this._io?.disconnect();
      this._setupObserver();
      // The OTHER of the two toggle animations — expand: the grid unfolds
      // DOWNWARD from the carousel's position at the top (fade + slide down),
      // iOS disclosure style. Collapse has no entry animation at all (the
      // grid's exit in _toggle() is the whole transition). Never animates on
      // first mount.
      if (this._prevExpanded !== undefined && this._prevExpanded !== this.expanded && this.expanded) {
        this.renderRoot.querySelector('.gridlist')?.animate(
          [
            { opacity: 0, transform: 'translateY(-10px)' },
            { opacity: 1, transform: 'none' },
          ],
          { duration: 400, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
        );
      }
      this._prevExpanded = this.expanded;
    }
    this._observeThumbs();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._io?.disconnect();
    this._io = undefined;
  }

  /** A thumb scrolled into view -> request its thumbnail (once). */
  private _onIntersect(entries: IntersectionObserverEntry[]): void {
    let changed = false;
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const key = (e.target as HTMLElement).dataset.key;
      if (!key || this._requested.has(key)) continue;
      this._requested.add(key);
      const b = this._bandByKey.get(key);
      if (b) this.loader?.get(b); // queues the NVR snapshot (concurrency-limited)
      this._io?.unobserve(e.target);
      changed = true;
    }
    if (changed) this.requestUpdate();
  }

  private _observeThumbs(): void {
    if (!this._io) return;
    this.renderRoot.querySelectorAll('[data-key]').forEach((el) => {
      const key = (el as HTMLElement).dataset.key!;
      if (!this._requested.has(key)) this._io!.observe(el);
    });
  }

  // PERF-SCRUB-2026-08-03: memoised formatters — these run once per rendered
  // ROW, so a strip re-render used to build dozens. Revert: inline
  // `new Intl.DateTimeFormat(undefined, {...}).format(new Date(t))`.
  private _fmtTime(t: number): string {
    // Short form like the app's strip labels ("8:11 PM" / "20:11" by locale).
    return fmtTime(t, {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  /* Day-divider helpers — same formats as the timeline view's events list. */
  private _fmtDay(t: number): string {
    return fmtTime(t, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  private _sameDay(a: number, b: number): boolean {
    const da = new Date(a);
    const db = new Date(b);
    return (
      da.getFullYear() === db.getFullYear() &&
      da.getMonth() === db.getMonth() &&
      da.getDate() === db.getDate()
    );
  }

  /* Expanded-grid item texts: long time (matches the collapsed list) + duration. */
  private _fmtTimeLong(t: number): string {
    // PERF-SCRUB-2026-08-03: memoised (see _fmtTime above).
    return fmtTime(t, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  private _fmtDur(ms: number): string {
    const s = Math.max(1, Math.round(ms / 1000));
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const r = s % 60;
    return r ? `${m}m ${r}s` : `${m}m`;
  }

  private _select(b: MultiBand): void {
    this.dispatchEvent(
      new CustomEvent('strip-select', { detail: b, bubbles: true, composed: true }),
    );
  }

  private _toggle = async (): Promise<void> => {
    // Exactly TWO toggle animations exist. Collapse is this one: the grid
    // slides UP and fades OUT (mirror of its entry), then the parent flips
    // the state and the carousel + cameras simply appear — no re-entry
    // animation. Expand dispatches immediately (the grid animates its entry
    // in updated()).
    if (this.expanded) {
      const pane = this.renderRoot.querySelector('.gridlist');
      if (pane) {
        await pane
          .animate(
            [
              { opacity: 1, transform: 'none' },
              { opacity: 0, transform: 'translateY(-10px)' },
            ],
            { duration: 400, easing: 'ease-in', fill: 'forwards' },
          )
          .finished.catch(() => undefined);
      }
    }
    this.dispatchEvent(new CustomEvent('toggle-expand', { bubbles: true, composed: true }));
  };

  /** One event item — identical in both presentations (the expanded grid only
   *  changes the layout around it, never the item itself). */
  private _renderClip(b: MultiBand, key: string, url: string | undefined) {
    // The grid also keeps the border on the LAST-played clip (after the
    // overlay closed); the carousel highlights only while actually playing.
    const highlighted =
      this.playingKey === key || (this.expanded && this.lastPlayedKey === key);
    return html`
      <button
        class="clip ${highlighted ? 'playing' : ''}"
        @click=${() => this._select(b)}
      >
        <div class="thumb" data-key=${key}>
          ${url
            ? html`<img src=${url} alt=${b.label} loading="lazy" />`
            : html`<span class="ph"></span>`}
          <!-- Caption mode moves the time to the line below (with the
               duration); the compact mode overlays it on the footage. -->
          ${this.captions ? nothing : html`<span class="time">${this._fmtTime(b.start)}</span>`}
        </div>
        <span class="cam">${b.cameraName}</span>
        ${this.captions
          ? html`<span class="sub"
              >${this._fmtTimeLong(b.start)} ·
              ${b.ongoing ? 'In progress' : this._fmtDur(b.durMs ?? b.end - b.start)}</span
            >`
          : nothing}
      </button>
    `;
  }

  render() {
    this._bandByKey.clear();
    // 0 = auto: exactly two thumbs, CENTERED — 12px inset on BOTH sides at
    // rest, and the third thumb starts exactly at the screen edge (hidden, no
    // sliver) because the gap equals the inset. Derivation: scroller W,
    // insets 12+12, gap 12 → 12 + w + 12 + w + 12 = W → w = (W - 36)/2;
    // % resolves against the content box (W - 24) → w = (100% - 12px)/2.
    const thumbW = this.thumbSize > 0 ? `${this.thumbSize}px` : 'calc((100% - 12px) / 2)';
    const items = repeat(
      this.bands,
      (b) => `${b.type}@${b.start}`,
      (b, i) => {
        const key = `${b.type}@${b.start}`;
        this._bandByKey.set(key, b);
        // Only fetch once the thumb has scrolled into view.
        const url = this._requested.has(key) ? this.loader?.get(b) : undefined;
        // Expanded grid: a full-row day separator before each day's first
        // event (the divider spans both columns; grid auto-placement resumes
        // the cells after it) — mirrors the timeline view's events list.
        const showDay =
          this.expanded && (i === 0 || !this._sameDay(this.bands[i - 1].start, b.start));
        return html`
          ${showDay
            ? html`<div class="day-divider">
                <span class="day-label">${this._fmtDay(b.start)}</span>
              </div>`
            : nothing}
          ${this._renderClip(b, key, url)}
        `;
      },
    );
    return html`
      ${this.hideHead
        ? nothing
        : html`<div class="head">
            <span>${this.headerText}</span>
            <span class="head-count">${this.bands.length}</span>
            <button
              class="expand"
              title=${this.expanded ? 'Show cameras' : 'Browse all events'}
              @click=${this._toggle}
            >
              <!-- ONE static icon; :host([expanded]) rotates it 180° (swapping to
                   chevron-up here would cancel the rotation out = always-down). -->
              <ha-icon icon="mdi:chevron-down"></ha-icon>
            </button>
          </div>`}
      ${this.bands.length === 0
        ? html`<div class="empty">No events</div>`
        : this.expanded
          ? html`<div
              class="gridlist"
              style="--upc-egrid-cols:${this.gridColumns};--upc-egrid-w:${this
                .gridThumbWidth}px;--upc-egrid-date:${this.dateFontSize}px;--upc-egrid-item:${this
                .itemTextSize}px;--upc-egrid-sub:${Math.max(1, this.itemTextSize - 1)}px;--upc-strip-time:${this
                .timeSize}px;--upc-strip-divider:${this.accent}"
            >
              ${items}
            </div>`
          : html`<div
              class="strip"
              style="--upc-strip-thumb:${thumbW};--upc-strip-time:${this
                .timeSize}px;--upc-egrid-item:${this.itemTextSize}px;--upc-egrid-sub:${Math.max(
                1,
                this.itemTextSize - 1,
              )}px"
            >
              ${items}
            </div>`}
      ${nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'upc-event-strip': EventStrip;
  }
}
