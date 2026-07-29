// UniFi-style "events list" view: a chronological (newest-first) list of the
// NVR's own events (1:1 from the manifest — the whole window renders at once).
// Each row shows the start time + duration on the left and the event thumbnail
// on the right. Clicking a row plays that event (emits `event-selected`). The
// currently-playing row is highlighted. In-progress events show "In progress"
// instead of a duration until the NVR finalizes them.
//
// NVR-friendly thumbnails: almost every row has a locally cached thumbnail
// (band.file); the rest are only sent to the shared ThumbnailLoader when they
// scroll into view (IntersectionObserver), so off-screen events never hit the NVR.

import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import type { DetectionBand } from './data/types';
import type { ThumbnailLoader } from './data/thumbnail-loader';

@customElement('upc-events-list')
export class EventsList extends LitElement {
  @property({ attribute: false }) bands: DetectionBand[] = [];
  @property({ attribute: false }) loader?: ThumbnailLoader;
  @property({ type: Number }) thumbVersion = 0; // bump => re-render when thumbs load
  // Inactive (non-playing) row styling.
  @property({ type: Number }) textSize = 12; // row 1: event start time
  @property() textColor = ''; // row 1 color (default theme secondary text)
  @property({ type: Number }) durationSize = 12; // row 2: duration
  @property() durationColor = ''; // row 2 color (default = time color, dimmed)
  // Active (currently-playing) row styling — independent of the inactive set.
  @property({ type: Number }) activeTextSize = 12;
  @property() activeTextColor = '#000';
  @property({ type: Number }) activeDurationSize = 12;
  @property() activeDurationColor = '#000';
  @property() activeBg = '#fff'; // playing-row background
  @property() playingKey = ''; // `${type}@${start}` of the row being played
  // Day-divider label styling — matches the timeline date (white-ish, same font).
  @property({ type: Number }) dateFontSize = 13;
  @property() dateFontColor = '';
  @property() dividerColor = ''; // day-divider line color ("" = theme divider)
  @property({ type: Number }) thumbWidth = 104; // row thumbnail width (px)
  // Multi-camera list: line 1 = camera name, line 2 = time + duration. Single-
  // camera timeline (default) keeps line 1 = time, line 2 = duration.
  @property({ type: Boolean, reflect: true }) showCamera = false;
  // Prominent first line: line 1 rendered white and line 2 at full opacity
  // (the multi-camera events styling). Independent of showCamera so the timeline
  // (line 1 = time) can adopt the exact same look.
  @property({ type: Boolean, reflect: true }) line1White = false;

  @query('.list') private _listEl?: HTMLElement;
  private _io?: IntersectionObserver;
  private _requested = new Set<string>(); // rows that have entered view (thumb requested)
  private _bandByKey = new Map<string, DetectionBand>();

  static styles = css`
    :host {
      /* Fill the (position:relative) mode-body via absolute inset:0 rather than
         height:100%. This way the list can NEVER content-expand and blow up the
         card layout if an ancestor height is momentarily indefinite — it just
         fills whatever box it's given and scrolls internally. */
      display: block;
      position: absolute;
      inset: 0;
    }
    .list {
      height: 100%;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 2px;
      scrollbar-width: none; /* Firefox: hide scrollbar, keep scrolling */
      -ms-overflow-style: none;
    }
    .list::-webkit-scrollbar {
      width: 0;
      height: 0;
      display: none;
    }
    .empty {
      color: var(--secondary-text-color);
      padding: 16px 8px;
      text-align: center;
    }
    /* Day separator between events from different days: a 1px grey rule with the
       date centered in the middle. */
    .day-divider {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 4px 4px;
    }
    .day-divider::before,
    .day-divider::after {
      content: '';
      flex: 1 1 auto;
      height: 1px;
      background: var(--upc-divider, var(--divider-color, rgba(255, 255, 255, 0.15)));
    }
    .day-label {
      flex: 0 0 auto;
      font-weight: 600;
      white-space: nowrap;
    }
    .row {
      display: flex;
      align-items: stretch;
      gap: 6px;
      border: none;
      background: transparent;
      cursor: pointer;
      padding: 8px 4px;
      text-align: left;
      border-radius: 8px;
      /* Default inactive grey — a light grey (lighter than the theme's
         --secondary-text-color ~#b0), matching the timeline's label color. */
      color: var(--list-color, #d0d0d0);
      font-family: inherit;
    }
    .row:hover {
      background: rgba(255, 255, 255, 0.06);
    }
    /* The currently-playing row: fully independent active styling. */
    .row.playing {
      background: var(--list-active-bg, #fff);
    }
    .row.playing .t1 {
      font-size: var(--list-active-size, 12px);
      color: var(--list-active-color, #000);
    }
    .row.playing .t2 {
      font-size: var(--list-active-dur-size, 12px);
      color: var(--list-active-dur-color, #000);
      opacity: 1;
    }
    .info {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 2px;
      padding-left: 4px; /* breathing room now the left bar is gone */
    }
    .t1 {
      font-size: var(--list-size, 12px);
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .t2 {
      font-size: var(--list-dur-size, 12px);
      /* Defaults to the time color (inherited), dimmed; full color if set. */
      color: var(--list-dur-color, currentColor);
      opacity: var(--list-dur-op, 0.7);
      white-space: nowrap;
    }
    /* Prominent first line (multi list + timeline): line 1 white, line 2 full
       opacity — matching the expanded grid captions exactly. Only the inactive
       rows; the playing row keeps its active colors. */
    :host([line1white]) .row:not(.playing) .t1 {
      color: #fff;
    }
    :host([line1white]) .t2 {
      opacity: 1;
    }
    .thumb {
      flex: 0 0 auto;
      width: var(--list-thumb-w, 104px);
      aspect-ratio: 16 / 10;
      border-radius: 6px;
      overflow: hidden;
      background: #000;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
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
    // Observe rows within the scroll container; preload a little ahead/below.
    this._io = new IntersectionObserver((entries) => this._onIntersect(entries), {
      root: this._listEl ?? null,
      rootMargin: '300px 0px',
    });
    this._observeRows();
  }

  updated(): void {
    this._observeRows();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._io?.disconnect();
    this._io = undefined;
  }

  /** A row scrolled into view -> request its thumbnail (once). */
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

  private _observeRows(): void {
    if (!this._io) return;
    this.renderRoot.querySelectorAll('.thumb[data-key]').forEach((el) => {
      const key = (el as HTMLElement).dataset.key!;
      if (!this._requested.has(key)) this._io!.observe(el);
    });
  }

  private _fmtTime(t: number): string {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(t));
  }

  private _fmtDay(t: number): string {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(new Date(t));
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

  private _fmtDur(ms: number): string {
    const s = Math.max(1, Math.round(ms / 1000));
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const r = s % 60;
    return r ? `${m}m ${r}s` : `${m}m`;
  }

  private _play(b: DetectionBand): void {
    this.dispatchEvent(
      new CustomEvent('event-selected', { detail: b, bubbles: true, composed: true }),
    );
  }

  /** Scroll so the given day's section starts at the top of the list. Called
   *  by the card when a calendar day is picked while the Events view is open.
   *  The whole event window is always rendered, so the target row exists; a
   *  day with no events scrolls to where it would be (the next older row). */
  scrollToDay(dayStart: number): void {
    const dayEnd = dayStart + 86_400_000;
    // Newest-first: the day's first row is the newest band starting before the
    // day's end.
    const target = [...this.bands].sort((a, b) => b.start - a.start).find((b) => b.start < dayEnd);
    if (!target || !this._listEl) return;
    const thumb = this.renderRoot.querySelector(`.thumb[data-key="${target.type}@${target.start}"]`);
    const row = thumb?.closest('.row') as HTMLElement | null;
    if (!row) return;
    // Land on the day divider right above the row when there is one.
    const prev = row.previousElementSibling as HTMLElement | null;
    const top = prev?.classList.contains('day-divider') ? prev : row;
    this._listEl.scrollTop = top.offsetTop;
  }

  render() {
    const events = [...this.bands].sort((a, b) => b.start - a.start); // newest first
    const vars =
      `--list-size:${this.textSize}px;--list-dur-size:${this.durationSize}px;` +
      `--list-active-size:${this.activeTextSize}px;--list-active-dur-size:${this.activeDurationSize}px;` +
      `--list-active-color:${this.activeTextColor};--list-active-dur-color:${this.activeDurationColor};` +
      `--list-active-bg:${this.activeBg};` +
      `--list-thumb-w:${this.thumbWidth}px;` +
      (this.dividerColor ? `--upc-divider:${this.dividerColor};` : '') +
      (this.textColor ? `--list-color:${this.textColor};` : '') +
      (this.durationColor ? `--list-dur-color:${this.durationColor};--list-dur-op:1;` : '');
    this._bandByKey.clear();
    return html`
      <div class="list" style=${vars}>
        ${events.length === 0
          ? html`<div class="empty">No events in this range</div>`
          : repeat(
              events,
              (b) => `${b.type}@${b.start}`,
              (b, i) => {
                const key = `${b.type}@${b.start}`;
                this._bandByKey.set(key, b);
                // Only fetch once the row has scrolled into view (it's in _requested).
                const url = this._requested.has(key) ? this.loader?.get(b) : undefined;
                const playing = this.playingKey === key;
                // Raw event duration exactly as the NVR reports it; an event the
                // NVR hasn't finalized yet has no duration to show.
                const durText = b.ongoing ? 'In progress' : this._fmtDur(b.durMs ?? b.end - b.start);
                // Multi list: camera on line 1, "time · duration" on line 2.
                const withCam = this.showCamera && !!b.cameraName;
                const line1 = withCam ? b.cameraName! : this._fmtTime(b.start);
                const line2 = withCam ? `${this._fmtTime(b.start)} · ${durText}` : durText;
                // Day separator before the first event of each day.
                const showDay = i === 0 || !this._sameDay(events[i - 1].start, b.start);
                return html`
                  ${showDay
                    ? html`<div class="day-divider">
                        <span
                          class="day-label"
                          style="font-size:${this.dateFontSize}px;color:${this.dateFontColor ||
                          '#fff'}"
                          >${this._fmtDay(b.start)}</span
                        >
                      </div>`
                    : nothing}
                  <button class="row ${playing ? 'playing' : ''}" @click=${() => this._play(b)}>
                    <div class="info">
                      <div class="t1">${line1}</div>
                      <div class="t2">${line2}</div>
                    </div>
                    <div class="thumb" data-key=${key}>
                      ${url
                        ? html`<img src=${url} alt=${b.label} />`
                        : html`<span class="ph"></span>`}
                    </div>
                  </button>
                `;
              },
            )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'upc-events-list': EventsList;
  }
}
