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
// (see card.ts _playBand): padded start/end, live=false. keyed() remounts it
// per CAMERA, not per clip — see the note on mountKey in render().

import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import type { CameraEntry, CardConfig, HomeAssistant } from './data/types';
import { loadManifest, manifestToBand } from './data/manifest';
import { groupBands } from './data/event-groups';
import { mergeStrip, tagBands, type MultiBand } from './data/multi-events';
import { ThumbnailLoader } from './data/thumbnail-loader';
import { THUMBS_BASE } from './data/ha-urls';
import { navigate } from './data/navigate';
import { darken } from './scrubber-timeline';
import { ZOOM_MS, boxOf, fade, iosEase, zoom, type Box, type ZoomSource } from './data/motion';
import type { MediaView } from './media-view';
import type { LiveGrid } from './live-grid';
import type { EventStrip } from './event-strip';
import './event-strip';
import './events-list';
import './live-grid';
import './media-view';

const REFRESH_MS = 30_000;
const SYNC_THROTTLE_MS = 2 * 60_000;
// The phone's clip card: the strip under a landscape picture that holds its
// seek bar and buttons - media-view's bottom group there: 8 clear + 40 seek
// + 6 more for the times under it + 12 gap + 46 buttons (0.8 scale) + 24.
const PHONE_CLIP_STRIP = 136;
// Opening the phone's events grid: its first pictures are asked for this many
// at once, and the grid waits up to this long for those on screen.
const GRID_PRELOAD = 12;
const GRID_WAIT_MS = 450;

// Wide-layout geometry, shared with the card's header row, which lines up
// with it: "Events (N) >" over the events pane, the grid-density control
// centred over the cameras.
export const TABLET_GAP = 16; // events pane <-> cameras
export const GRID_EDGE = 14; // cameras clear of the pane top + the card's right/bottom edges
/** Events pane width: the list's thumbnail + a fixed text column. */
export const tabletPaneWidth = (cfg: CardConfig): number =>
  (cfg.tablet_events_thumbnail_size ?? 145) + 168;

/** What the wide layout reports to the card's header row (`events-head`). */
export interface MultiHead {
  loaded: boolean; // the events have come in (the count is real)
  count: number; // events in the list
  expanded: boolean; // the events grid is open
  gridView: number; // live-grid density, 1 or 2 columns
  liveGrid: boolean; // the live cameras are showing (not the grid or a clip)
}

interface CameraData {
  bands: MultiBand[]; // grouped display events, newest-first
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
  // The first fetch has come back (until then the strip only holds its place
  // and the heading shows no count - no "No events" / "(0)" before there is
  // anything to say).
  @state() private _loaded = false;
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
  // Zoom transitions (wide layout, see data/motion.ts). A clip's player grows
  // out of the thumbnail it was tapped in and shrinks back into it; meanwhile
  // the live tiles stay mounted under it (fading out / in), the lightbox's
  // scrim fades, and the player's controls stay hidden.
  @state() private _gridUnder = false; // tiles kept under a player zooming open
  @state() private _closing = false; // a player zooming shut, still mounted
  @state() private _chromeHidden = false;
  private _xfToken = 0; // a newer transition supersedes a running one
  private _lastPlayedCam = ''; // the camera of _lastPlayedKey's clip
  private _revealing?: Promise<void>; // _revealLastPlayed in flight

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
    /* What a camera switch leaves UNDER the next player while it zooms in
       (see _dissolve): the old player's black box and its last frame (one
       GPU-side copy, fading out), where they were. */
    .under {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .under > .backdrop {
      position: absolute;
      background: #000;
      border-radius: 10px; /* the player's stage */
    }
    .under > .ghost {
      position: absolute;
      object-fit: contain;
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
    /* ...while a clip plays: the rest of the page under the strip (its card's
       height is capped to it - a portrait clip at full width can be taller). */
    :host([stacked]) .body.playing {
      flex: 1 1 auto;
      min-height: 0;
    }
    upc-live-grid,
    .playwrap {
      position: absolute;
      inset: 0;
    }
    /* Stacked: the grid sits in normal flow at its natural height. */
    :host([stacked]) upc-live-grid {
      position: static;
      height: auto;
    }
    /* The phone's clip card: edge to edge like the tiles, black, in the clip's
       own shape (--upc-clip-ar: full width at its aspect) plus - landscape
       footage - a strip below the picture for its seek bar and buttons
       (--upc-clip-strip; the picture is drawn at the top, see media-view), so
       they have room and leave the picture alone. Positioned: it paints over
       tiles still under it. */
    :host([stacked]) .playwrap {
      position: relative;
      inset: auto;
      margin: 0 -12px;
      aspect-ratio: var(--upc-clip-ar, 16 / 9);
      padding-bottom: var(--upc-clip-strip, 0px);
      max-height: calc(100% - var(--upc-clip-strip, 0px));
    }
    /* Its black: the picture's box, and the control strip below it - a layer
       of its own, so a zoom flies the picture alone (the strip fades in once
       it lands and out as it leaves). The strip reaches up behind the
       picture's rounded foot, so at rest they read as one card. */
    .card-pic,
    .card-strip {
      position: absolute;
      left: 0;
      right: 0;
      background: #000;
    }
    .card-pic {
      top: 0;
      bottom: var(--upc-clip-strip, 0px);
      border-radius: 10px;
    }
    .card-strip {
      bottom: 0;
      height: calc(var(--upc-clip-strip, 0px) + 10px);
      border-radius: 0 0 10px 10px;
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
    /* Tiles kept under a clip's card zooming open or shut (see _gridUnder)
       ride out of the flow from the top of the body, fading. */
    :host([stacked]) .body.playing upc-live-grid.bleed {
      position: absolute;
      top: 0;
      left: -12px;
      right: -12px;
      margin: 0;
    }
    /* The page's foot: clear of the screen's rounded bottom corners (and the
       home indicator) - with the gap before it, max(20px, the safe area). */
    :host([stacked]) .foot {
      flex: 0 0 auto;
      height: max(0px, calc(env(safe-area-inset-bottom, 0px) - 20px));
    }
    upc-media-view {
      position: absolute;
      inset: 0;
    }
    /* Expanded-grid playback: a lightbox OVER the grid (the grid stays put).
       position:fixed resolves against the nearest containing ancestor — the
       mobile view's fixed card, the wide card (contain: layout, card.ts) — so
       the scrim covers the card, not the sidebar beside it. */
    .playoverlay {
      position: fixed;
      inset: 0;
      z-index: 5;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    /* Its dimming: a layer of its own, so it fades by opacity alone. */
    .playoverlay > .scrim {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
    }
    .playbox {
      position: relative;
      width: min(100%, 900px);
      aspect-ratio: 16 / 9;
    }
    /* Tablet: the lightbox scales with the space it has instead of stopping at
       900px — 90% of whichever side binds, kept 16:9, so a full-width popup gets
       a proportionally bigger player while a scrim margin (tap to close) stays.
       The overlay is the size container, so this tracks the popup, not the
       window. Phones keep the plain full-width rule above. */
    .tablet .playoverlay {
      container-type: size;
    }
    /* Phone: the same card as in place of the tiles (full width, the clip's
       shape and control strip), centred in the page under the header - which
       stays visible, dimmed - and clear of the screen's foot. */
    :host([stacked]) .playoverlay {
      padding: calc(env(safe-area-inset-top, 0px) + 68px) 0 max(20px, env(safe-area-inset-bottom, 0px));
    }
    :host([stacked]) .playbox {
      width: 100%;
      aspect-ratio: var(--upc-clip-ar, 16 / 9);
      padding-bottom: var(--upc-clip-strip, 0px);
      max-height: calc(100% - var(--upc-clip-strip, 0px));
    }
    .tablet .playbox {
      width: min(90cqw, 90cqh * 16 / 9);
    }
    /* ---- Tablet (wide) layout: a UniFi-app split — events LIST on the left,
       live camera grid on the right. The chevron expands the events to a
       full-width grid (cameras hidden). Mobile/stacked keeps the top-strip
       layout above; this block only applies to the non-stacked render. ---- */
    .tablet {
      display: flex;
      flex-direction: row;
      gap: ${TABLET_GAP}px;
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
    /* ...and the live cameras fill the whole right of the card, like the UniFi
       app: GRID_EDGE clear of the pane's top and of the card's right and bottom
       edges (12 = the card's padding, card.ts styles). The left needs nothing -
       the events pane's own padding already separates them. height:auto lets
       the insets size it (the grid's own height:100% would win over bottom).
       The grid-density control lives in the card's header row. */
    .tablet upc-live-grid {
      top: ${GRID_EDGE}px;
      right: ${GRID_EDGE - 12}px;
      bottom: ${GRID_EDGE - 12}px;
      height: auto;
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
      if (this._suspendedFor) {
        // Back from the camera screen a clip handed off to, or a tile opened:
        // this is not a re-entry, it is the same page resuming — keep the
        // grid/strip, the density and the loaded pages, and put the scroll
        // back (the zoom home lands where it left). A clip comes back
        // highlighted.
        const clip = this._suspendedFor === 'clip';
        this._suspendedFor = undefined;
        if (clip) this._keepLastPlayed = true;
        this._revealing = this._revealLastPlayed(clip);
      } else {
        this._resetToMain();
      }
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
    // Not when the camera screen was opened from here (a clip handed off to
    // it, or a tile) — the card keeps this page alive (cached) exactly so it
    // can come back as it was - minus a clip, which stayed on screen under the
    // zoom into the camera screen.
    this._xfToken++;
    this._gridUnder = false;
    this._closing = false;
    this._chromeHidden = false;
    this._clearUnder();
    if (!this._suspendedFor) this._resetToMain();
    else this._closePlayback();
  }

  // Set by _onFsHandoff ('clip') and _onTileOpen ('tile', wide layout): the
  // next detach is a trip to the camera screen and back, not leaving the page.
  private _suspendedFor?: 'clip' | 'tile';
  // ...and what that camera screen was opened from, for its way back (zoomTarget).
  private _openedFrom?: 'clip' | 'tile';
  private _savedScroll: Array<[Element, number, number]> = [];

  /** Remember every scrolled element in this page, and every scrolled
   *  ancestor (a popup or view that scrolls the page itself). Detaching the
   *  page — which the card does while the fullscreen timeline is up — resets
   *  scroll offsets, so "10 pages down, five days back" has to be put back by
   *  hand. The elements themselves survive (the card caches this page). */
  private _saveScroll(): void {
    const saved: Array<[Element, number, number]> = [];
    const walk = (root: ParentNode): void => {
      for (const el of Array.from(root.querySelectorAll('*'))) {
        if (el.scrollTop || el.scrollLeft) saved.push([el, el.scrollTop, el.scrollLeft]);
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    walk(this.renderRoot);
    // The page itself: on the phone the expanded grid scrolls THIS element.
    if (this.scrollTop || this.scrollLeft) saved.push([this, this.scrollTop, this.scrollLeft]);
    let n: Node | null = this;
    while (n) {
      const parent: Node | null =
        (n as Element).parentElement ?? ((n.getRootNode() as ShadowRoot).host || null);
      if (parent instanceof Element && (parent.scrollTop || parent.scrollLeft)) {
        saved.push([parent, parent.scrollTop, parent.scrollLeft]);
      }
      n = parent;
    }
    const doc = document.scrollingElement;
    if (doc && doc.scrollTop) saved.push([doc, doc.scrollTop, doc.scrollLeft]);
    this._savedScroll = saved;
  }

  private _restoreScroll(): void {
    const saved = this._savedScroll;
    this._savedScroll = [];
    for (const [el, top, left] of saved) {
      el.scrollTop = top;
      el.scrollLeft = left;
    }
  }

  // After a fullscreen hand-off: keep the watched clip highlighted in the strip
  // as well as the grid, until another clip is picked or the page is left.
  @state() private _keepLastPlayed = false;

  /** Back from the fullscreen timeline: put the page back where it was, then
   *  (`reveal`) bring the clip that was playing into view and highlight it —
   *  in the grid, the tablet column, the phone carousel, whichever this page
   *  is showing. Restoring the old offsets alone is not enough: the strip had
   *  nothing to highlight and the exact item is what the viewer is looking
   *  for. */
  private async _revealLastPlayed(reveal = true): Promise<void> {
    await this.updateComplete;
    // Both presentations: the event strip (phone carousel, both grids) and the
    // tablet's events-list column. Each can reveal a clip by its key.
    const lists = Array.from(this.renderRoot.querySelectorAll('upc-event-strip, upc-events-list'));
    await Promise.all(lists.map((s) => (s as LitElement).updateComplete));
    await new Promise((r) => requestAnimationFrame(r));
    this._restoreScroll();
    if (!reveal) return;
    for (const s of lists) {
      if ((s as unknown as { revealKey(k: string): boolean }).revealKey(this._lastPlayedKey)) break;
    }
  }

  /** Return to the default main screen: no clip selected (live grid shown), not
   *  in the expanded events browser, default 2-column density, no last-played
   *  highlight. Used on every (re)entry so the view never resumes mid-clip. */
  private _resetToMain(): void {
    this._closePlayback();
    this._expanded = false;
    this._lastPlayedKey = '';
    this._keepLastPlayed = false;
    this._gridView = 2;
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('config') && this.config) {
      this._resetToMain();
      void this._fetchAll();
    }
    // The card's header row carries the "Events (N) >" heading (and, wide,
    // the grid-density control - see card.ts _renderMulti) - tell it the
    // count, whether the events grid is open (the chevron turns), the density,
    // and whether the live cameras are showing (the control is theirs).
    if (
      changed.has('_strip') ||
      changed.has('_loaded') ||
      changed.has('_expanded') ||
      changed.has('_gridView') ||
      changed.has('_playback') ||
      changed.has('stacked')
    ) {
      this.dispatchEvent(
        new CustomEvent<MultiHead>('events-head', {
          detail: {
            loaded: this._loaded,
            count: this._strip.length,
            expanded: this._expanded,
            gridView: this._gridView,
            liveGrid: !this._expanded && !this._playback,
          },
          bubbles: true,
          composed: true,
        }),
      );
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
      // ...and the list comes back from the left, the way the grid went.
      this.renderRoot.querySelector('.events-pane')?.animate(
        [
          { opacity: 0, transform: 'translateX(-30px)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 300, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
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
        preMs: loaded.preMs,
        postMs: loaded.postMs,
      });
    }
    this._data = data;
    this._strip = mergeStrip([...data.values()].map((d) => d.bands));
    this._loaded = true;
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

  private _playBand(band: MultiBand): void {
    // Collapsed: the player mounts where the live grid was. Expanded: the grid
    // STAYS and the player opens as an overlay on top of it (see render).
    this._playback = band;
    this._lastPlayedKey = `${band.type}@${band.start}`;
    this._lastPlayedCam = band.camera;
    this._keepLastPlayed = false; // a new pick: back to the normal highlight rule
    // The whole event, any length — the media view plays it on its chunk
    // engine. Fixed ONCE per selection: the end cap is wall-clock, and a range
    // recomputed per render would be a moving seek bar.
    const d = this._data.get(band.camera);
    this._eventSpan = {
      start: Math.max(band.start - (d?.preMs ?? 0), 0),
      end: Math.min(band.end + (d?.postMs ?? 0), Date.now()),
    };
  }

  @state() private _eventSpan?: { start: number; end: number };

  private _onStripSelect = (e: CustomEvent<MultiBand>): void => {
    void this._openClip(e.detail);
  };

  // ---- zoom transitions ----------------------------------------------------

  /** The player's box: in place of the cameras, or the lightbox. */
  private _wrapEl(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.playwrap, .playbox');
  }

  /** A clip's thumbnail where it is on screen: the events list beside the
   *  cameras, or the events grid. */
  private _thumbEl(key: string): HTMLElement | null {
    const list = this.renderRoot.querySelector('upc-events-list, upc-event-strip') as
      | (Element & { thumbOf(k: string): HTMLElement | null })
      | null;
    return list?.thumbOf(key) ?? null;
  }

  /** A clip picked: the player's black box grows out of its thumbnail,
   *  dissolving out of it (the thumbnail is not the clip's first frame - often
   *  a square crop round the detection - so it is never shown blown up), and
   *  the clip fades in on its first frame. Already open on the same camera,
   *  the clip just fades in there. Tiles stay under the zoom, fading out. */
  private async _openClip(band: MultiBand): Promise<void> {
    const token = ++this._xfToken;
    // A close still running ends here: nothing it froze may stay applied.
    const was = this._wrapEl();
    for (const el of [was, was?.querySelector('.card-strip'), this.renderRoot.querySelector('.playoverlay .scrim')]) {
      el?.getAnimations().forEach((a) => a.cancel());
    }
    const key = `${band.type}@${band.start}`;
    const thumb = this._thumbEl(key);
    const wasOpen = !!this._playback && !this._closing;
    const sameCam = wasOpen && this._playback!.camera === band.camera;
    // Another camera remounts the player: what it showed stays under the zoom.
    const oldWrap = wasOpen && !sameCam ? this._wrapEl() : null;
    const oldMv = oldWrap?.querySelector('upc-media-view') as MediaView | null | undefined;
    const under = oldWrap && oldMv ? this._dissolve(oldMv.snapshot(), oldWrap, oldMv.videoBox()) : this._clearUnder();
    const src = thumb ? boxOf(thumb, this) : null;
    // Phone: the card fits the page at its top, so a page scrolled down goes
    // back up as it opens - the strip and the card's place slide down together
    // (the card still growing out of its thumbnail where that was).
    const lift = this.stacked && !wasOpen && !this._expanded ? this.scrollTop : 0;
    this._closing = false;
    this._gridUnder = !wasOpen && !this._expanded;
    this._chromeHidden = !sameCam;
    this._playBand(band);
    await this.updateComplete;
    const wrap = this._wrapEl();
    const mv = wrap?.querySelector('upc-media-view') as MediaView | null;
    if (token !== this._xfToken || !wrap || !mv) return this._settleOpen(token);
    if (sameCam) return this._settleOpen(token);
    await mv.updateComplete;
    if (lift) this.scrollTop = 0;
    const at = boxOf(wrap, this);
    const anims: Animation[] = [];
    if (lift) {
      for (const el of [this.renderRoot.querySelector('upc-event-strip'), wrap.parentElement]) {
        el?.animate([{ transform: `translateY(${-lift}px)` }, { transform: 'none' }], {
          duration: ZOOM_MS,
          easing: iosEase(),
        });
      }
    }
    if (src) {
      // Wide: the whole player grows out of the thumbnail. Phone: its picture
      // does - the card around it (its control strip) comes along with it.
      // (Lifted, its place starts `lift` higher: the flight starts lower.)
      const content = this.stacked ? mv.videoBox() : { x: 0, y: 0, w: at.w, h: at.h };
      anims.push(zoom(wrap, { ...src, y: src.y + lift }, at, content));
      // (...its control strip comes in as it lands.)
      wrap.querySelector('.card-strip')?.animate([{ opacity: 0 }, { opacity: 0, offset: 0.55 }, { opacity: 1 }], {
        duration: ZOOM_MS,
      });
    } else {
      anims.push(
        wrap.animate([{ opacity: 0, transform: 'scale(0.94)' }, { opacity: 1, transform: 'none' }], {
          duration: ZOOM_MS,
          easing: iosEase(),
        }),
      );
    }
    under?.ghost?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ZOOM_MS, easing: 'ease-in', fill: 'forwards' });
    // Phone: the next card can be smaller (a portrait clip's card is taller) -
    // the old one is gone by the time it lands.
    if (this.stacked) {
      under?.box?.animate([{ opacity: 1 }, { opacity: 1, offset: 0.4 }, { opacity: 0 }], {
        duration: ZOOM_MS,
        fill: 'forwards',
      });
    }
    const scrim = this.renderRoot.querySelector<HTMLElement>('.playoverlay .scrim');
    if (scrim && !wasOpen) {
      anims.push(scrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ZOOM_MS, easing: iosEase() }));
    }
    const grid = this._gridUnder ? this.renderRoot.querySelector('upc-live-grid') : null;
    if (grid) {
      grid.getAnimations().forEach((a) => a.cancel());
      fade(grid, false, ZOOM_MS);
    }
    await Promise.all(anims.map((a) => a.finished.catch(() => undefined)));
    this._settleOpen(token);
  }

  private _settleOpen(token: number): void {
    if (token !== this._xfToken) return;
    this._gridUnder = false;
    this._chromeHidden = false;
    this._clearUnder();
  }

  /** The previous camera's player (`wrap`, `content` its picture box),
   *  replaced: its black box stays where it was and its last frame dissolves
   *  on it, UNDER the next player zooming in - the new picture flies in over
   *  the old one. Cleared once it has landed. */
  private _dissolve(
    frame: HTMLCanvasElement | null,
    wrap: Element,
    content: Box,
  ): { box?: HTMLElement; ghost?: HTMLCanvasElement } | undefined {
    const layer = this.renderRoot.querySelector('.under');
    if (!layer) return undefined;
    const w = boxOf(wrap, layer);
    const box = document.createElement('div');
    box.className = 'backdrop';
    Object.assign(box.style, { left: `${w.x}px`, top: `${w.y}px`, width: `${w.w}px`, height: `${w.h}px` });
    layer.replaceChildren(box);
    if (!frame) return { box };
    frame.className = 'ghost';
    Object.assign(frame.style, {
      left: `${w.x + content.x}px`,
      top: `${w.y + content.y}px`,
      width: `${content.w}px`,
      height: `${content.h}px`,
    });
    layer.append(frame);
    return { box, ghost: frame };
  }

  private _clearUnder(): undefined {
    this.renderRoot?.querySelector('.under')?.replaceChildren();
    return undefined;
  }

  /** Close the player the way it opened: zooming back into its clip's
   *  thumbnail (or shrinking away when that is off screen), the tiles fading
   *  back in under it, the lightbox's scrim fading out. */
  private _dismiss = async (): Promise<void> => {
    if (!this._playback || this._closing) return;
    const wrap = this._wrapEl();
    const mv = wrap?.querySelector('upc-media-view') as MediaView | null;
    if (!wrap || !mv) {
      this._closePlayback();
      return;
    }
    const token = ++this._xfToken;
    const at = boxOf(wrap, this);
    const content = mv.videoBox();
    this._closing = true;
    this._chromeHidden = true;
    this._gridUnder = false;
    this._clearUnder();
    await this.updateComplete;
    if (token !== this._xfToken) return;
    const thumb = this._thumbEl(this._lastPlayedKey);
    let anim: Animation;
    if (thumb) {
      // ...dissolving into the thumbnail as it lands (see zoom); the phone's
      // control strip goes first, leaving the picture to fly.
      anim = zoom(wrap, boxOf(thumb, this), at, content, { out: true });
      wrap.querySelector('.card-strip')?.animate([{ opacity: 1 }, { opacity: 0, offset: 0.3 }, { opacity: 0 }], {
        duration: ZOOM_MS,
        fill: 'forwards',
      });
    } else {
      anim = wrap.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.94)' }], {
        duration: ZOOM_MS,
        easing: iosEase(),
        fill: 'forwards',
      });
    }
    this.renderRoot
      .querySelector('.playoverlay .scrim')
      ?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ZOOM_MS, easing: iosEase(), fill: 'forwards' });
    // The tiles start their streams as they mount: a long fade hides that.
    const grid = this.renderRoot.querySelector('upc-live-grid');
    if (grid) {
      grid.getAnimations().forEach((a) => a.cancel());
      fade(grid, true, 700);
    }
    await anim.finished.catch(() => undefined);
    if (token !== this._xfToken) return;
    this._closing = false;
    this._chromeHidden = false;
    this._closePlayback();
  };

  /** Where the camera screen zooms back to on its way out: the clip it was
   *  opened from (that camera's), else - and always when a tile opened it -
   *  the camera's live tile (`view`: the grid it may be half scrolled out of),
   *  after the page has come back and scrolled to it. */
  async zoomTarget(camera: string): Promise<{ el: HTMLElement; view?: Element } | null> {
    const from = this._openedFrom;
    this._openedFrom = undefined;
    this._suspendedFor = undefined; // a zoom reversed before this page was set aside
    await this.updateComplete;
    await this._revealing;
    if (from !== 'tile' && this._keepLastPlayed && this._lastPlayedCam === camera) {
      const thumb = this._thumbEl(this._lastPlayedKey);
      if (thumb) return { el: thumb };
    }
    const grid = this.renderRoot.querySelector('upc-live-grid') as LiveGrid | null;
    if (!grid) return null;
    await grid.updateComplete;
    const tile = grid.tileOf(camera);
    return tile ? { el: tile, view: this._tileView(grid) } : null;
  }

  /** What a live tile can be scrolled out of: the wide grid (it scrolls in
   *  its one-column mode), or - phone - this page, which scrolls as a whole. */
  private _tileView(grid: LiveGrid): Element {
    return this.stacked ? this : grid;
  }

  /** The card's heading: events grid <-> cameras. */
  toggleExpand(): void {
    void this._onToggleExpand();
  }

  private _toggling = false; // the phone's switch is running

  private _onToggleExpand = async (): Promise<void> => {
    if (this.stacked) return this._toggleStacked();
    // Tablet: the grid fades + slides horizontally (in from the left on expand,
    // out to the left on collapse); what it replaces fades out first, and
    // comes back after it (see updated()). The outgoing side animates BEFORE
    // the state flip.
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
      // The list and the cameras fade away first, as the grid does on collapse.
      const going = [this.renderRoot.querySelector('.events-pane'), this.renderRoot.querySelector('.tablet .body')];
      await Promise.all(
        going.map((el) =>
          el
            ?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-in', fill: 'forwards' })
            .finished.catch(() => undefined),
        ),
      );
      this._closePlayback();
      this._expanded = true; // the expand-in animation runs in updated()
    }
  };

  /** Phone: carousel + tiles <-> events grid, faded through. What shows fades
   *  out, the page swaps and goes back to its top; the grid then comes in -
   *  rising slightly - once the pictures on its first screen are in (asked for
   *  before it fades out), and the carousel simply fades back in, the tiles
   *  each on their own first frame (see live-grid). */
  private async _toggleStacked(): Promise<void> {
    if (this._toggling) return;
    this._toggling = true;
    try {
      const opening = !this._expanded;
      const strip = this.renderRoot.querySelector('upc-event-strip') as EventStrip | null;
      if (opening) strip?.preload(GRID_PRELOAD);
      const going = [strip, this.renderRoot.querySelector('.body')].map((el) =>
        el?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease-in', fill: 'forwards' }),
      );
      await Promise.all(going.map((a) => a?.finished.catch(() => undefined)));
      if (opening) this._closePlayback();
      this._expanded = opening;
      await this.updateComplete;
      this.scrollTop = 0;
      if (opening) await strip?.firstScreenReady(GRID_WAIT_MS);
      // (Started before the fade-out's hold is dropped: no frame in between.)
      const coming = strip?.animate(
        opening
          ? [
              { opacity: 0, transform: 'translateY(14px)' },
              { opacity: 1, transform: 'none' },
            ]
          : [{ opacity: 0 }, { opacity: 1 }],
        { duration: opening ? 380 : 300, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
      );
      going.forEach((a) => a?.cancel());
      await coming?.finished.catch(() => undefined);
    } finally {
      this._toggling = false;
    }
  }

  private _closePlayback = (): void => {
    this._playback = undefined; // media-view unmounts (cancels the NVR export)
    this._eventSpan = undefined;
  };

  /** The card's grid-density control (wide layout): the tablet live grid's
   *  density, 1 = full-width scroll, 2 = columns. The tiles re-flow (and
   *  restart their streams): out, switch, back in. */
  async setGridView(n: number): Promise<void> {
    if (n === this._gridView) return;
    const grid = this.renderRoot.querySelector('upc-live-grid');
    if (grid) await fade(grid, false, 140).finished.catch(() => undefined);
    this._gridView = n;
    await this.updateComplete;
    const next = this.renderRoot.querySelector('upc-live-grid');
    if (next) {
      next.getAnimations().forEach((a) => a.cancel());
      fade(next, true, 520);
    }
  }

  private _onTileOpen = (e: CustomEvent<CameraEntry>): void => {
    const path = e.detail.navigation_path;
    if (path) {
      navigate(path); // SPA nav; that view's back button returns here
      return;
    }
    // No path -> IN-CARD drill: the root card swaps this page for the camera
    // screen (no HA navigation — popup-safe, see card.ts), which zooms open
    // out of the tile - and comes back to this page as it is (_suspendedFor).
    let from: ZoomSource | undefined;
    const grid = e.composedPath()[0] as LiveGrid;
    const tile = grid.tileOf?.(e.detail.camera);
    this._saveScroll();
    this._suspendedFor = this._openedFrom = 'tile';
    if (tile) {
      const b = tile.getBoundingClientRect();
      from = { el: tile, content: { x: 0, y: 0, w: b.width, h: b.height }, view: this._tileView(grid) };
    }
    this.dispatchEvent(
      new CustomEvent('camera-open', { detail: { camera: e.detail.camera, from }, bubbles: true, composed: true }),
    );
  };

  // The clip player's fullscreen button: open that camera's fullscreen TIMELINE
  // (the same one a tile's fullscreen opens) at the moment on screen, so the
  // footage carries on from there with the ruler alongside it. The clip here is
  // closed first — leaving fullscreen returns to this page, not to a clip that
  // would restart.
  private _onFsHandoff = (e: CustomEvent<{ camera: string; time: number }>): void => {
    // Come back to THIS page as it is (see _suspendedFor): the scroll must be
    // captured now, while the page is still attached and laid out.
    this._saveScroll();
    this._suspendedFor = this._openedFrom = 'clip';
    // The clip stays on screen while the camera screen zooms open out of it
    // (the card animates; the clip closes once this page is set aside - see
    // disconnectedCallback), starting from its frame - the very picture the
    // camera screen opens on, so the one frame copy is worth it.
    const mv = e.composedPath()[0] as MediaView;
    const from: ZoomSource = { el: mv, content: mv.videoBox(), poster: mv.snapshot() ?? undefined };
    this._xfToken++; // nothing running here may bring the controls back
    this._chromeHidden = true; // only its picture stays, under the zoom
    this._clearUnder();
    this.dispatchEvent(
      new CustomEvent('camera-fullscreen-at', {
        detail: { ...e.detail, from },
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
    // Which row the strip/list highlights — identifies the CLIP.
    const playKey = b ? `${b.type}@${b.start}` : '';
    // What the player is keyed on — identifies the CAMERA. Keying the player
    // per clip remounted it, and a fresh <video> with it, on every autoplay
    // advance, which is the one thing iOS punishes: detaching a <video> does
    // not free its decoder, the pipelines are capped, and the app wedges (one
    // orphaned clip session at 17:02 on 2026-09-22, app silent from 17:01:24,
    // while the BACKEND stayed provably healthy throughout). Advancing between
    // events is the same move the segment playlist already makes without a
    // remount: new targetTime/clipEndTime, and _loadSegment resets every
    // per-clip field at its top. A CAMERA change still remounts, which is what
    // the original key was really protecting (the poster/hold-frame latches).
    const mountKey = b ? b.camera : '';
    const d = b ? this._data.get(b.camera) : undefined;
    // Fresh object each render so the grid re-renders when data/minute change.
    const newest: Record<string, MultiBand | undefined> = {};
    for (const e of entries) newest[e.camera] = this._data.get(e.camera)?.bands[0];

    // Tablet (wide): UniFi-app split — events LIST on the left, cameras on the
    // right. Mobile (stacked) keeps the top-strip layout below.
    if (!this.stacked) return this._renderTablet(entries, accent, b, playKey, mountKey, d, newest);

    // Phone (stacked): the strip on top, the live tiles (or the clip's card in
    // their place) below - one page scroll - and the page's foot. The heading
    // ("Events (N) >") is the card's, so the strip shows none of its own. The
    // tiles stay mounted under a card zooming open or shut (see _gridUnder).
    const clip = b ? this._clipShape(b.camera) : '';
    return html`
      <upc-event-strip
        captions
        hideHead
        .loaded=${this._loaded}
        .bands=${this._strip}
        .loader=${this._loader}
        .thumbVersion=${this._thumbVersion}
        .headerText=${this.config.strip_title ?? 'Events'}
        .thumbSize=${this.config.mobile_events_thumbnail_size ?? 0}
        .timeSize=${this.config.strip_time_size ?? 12}
        .itemTextSize=${(this.config.list_text_size ?? 12) + 1}
        .playingKey=${playKey}
        .lastPlayedKey=${this._lastPlayedKey}
        .keepLastPlayed=${this._keepLastPlayed}
        .expanded=${this._expanded}
        .gridColumns=${2}
        .accent=${accent}
        @strip-select=${this._onStripSelect}
        @toggle-expand=${this._onToggleExpand}
      ></upc-event-strip>
      ${this._expanded
        ? b
          ? html`<div class="playoverlay" @click=${this._dismiss}>
              <div class="scrim"></div>
              ${keyed(
                mountKey,
                html`<div class="playbox" style=${clip} @click=${(ev: Event) => ev.stopPropagation()}>
                  <div class="card-pic"></div>
                  <div class="card-strip"></div>
                  ${this._renderPlayer(b, d, accent)}
                </div>`,
              )}
            </div>`
          : nothing
        : html`<div class="body ${b ? 'playing' : ''}">
            <div class="under"></div>
            ${!b || this._gridUnder || this._closing
              ? html`<upc-live-grid
                  class="bleed"
                  .hass=${this.hass}
                  .entries=${entries}
                  .stacked=${true}
                  .newest=${newest}
                  .minuteTick=${this._minuteTick}
                  .aspect=${this.config.grid_aspect ?? '16/9'}
                  @tile-open=${this._onTileOpen}
                ></upc-live-grid>`
              : nothing}
            ${b
              ? keyed(
                  mountKey,
                  html`<div class="playwrap" style=${clip}>
                    <div class="card-pic"></div>
                    <div class="card-strip"></div>
                    ${this._renderPlayer(b, d, accent)}
                  </div>`,
                )
              : nothing}
          </div>`}
      <div class="foot"></div>
    `;
  }

  /** The phone's clip card for a camera's footage: full width at its aspect,
   *  plus the control strip below the picture for landscape footage (portrait
   *  footage is tall enough to carry its controls over its foot). */
  private _clipShape(camera: string): string {
    const attrs = this.hass?.states?.[camera]?.attributes as { width?: unknown; height?: unknown } | undefined;
    const w = Number(attrs?.width) || 16;
    const h = Number(attrs?.height) || 9;
    return `--upc-clip-ar:${w} / ${h};--upc-clip-strip:${h > w ? 0 : PHONE_CLIP_STRIP}px`;
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
    mountKey: string,
    d: CameraData | undefined,
    newest: Record<string, MultiBand | undefined>,
  ) {
    const cfg = this.config;
    // The collapsed list's thumbnail size (the pane widens with it: thumb + a
    // fixed text column); the expanded grid shows them 1.5x larger by default -
    // it is for browsing, the list beside the cameras for glancing.
    const tabW = cfg.tablet_events_thumbnail_size ?? 145;
    const gridW = cfg.tablet_events_grid_thumbnail_size ?? Math.round(tabW * 1.5);
    // Camera-name size (line 1) drives BOTH views; the time+duration line is one
    // px smaller in BOTH — derived rather than configured, so the collapsed list
    // and the expanded grid captions are always identical.
    const camSize = cfg.list_text_size ?? 12;
    const subSize = Math.max(1, camSize - 1);
    // Live-grid density: 1 = a single full-width scrolling column, 2 = columns
    // filling the pane (the default).
    const gridCols = this._gridView === 1 ? 1 : 2;
    // The "Events (N) >" heading and the density control are the CARD's header
    // row here (where the page title used to be): this page reports its state
    // up (`events-head`, see updated()); the card calls toggleExpand() and
    // setGridView().

    if (this._expanded) {
      // Full-width events grid (browse). The player opens as a lightbox over it.
      return html`
        <div class="tablet expanded">
          <div class="events-pane">
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
                .keepLastPlayed=${this._keepLastPlayed}
                .expanded=${true}
                .gridThumbWidth=${gridW}
                .dateFontSize=${cfg.date_font_size ?? 13}
                .itemTextSize=${camSize}
                .accent=${accent}
                @strip-select=${this._onStripSelect}
              ></upc-event-strip>
            </div>
          </div>
          ${b
            ? html`<div class="playoverlay" @click=${this._dismiss}>
                <div class="scrim"></div>
                ${keyed(
                  mountKey,
                  html`<div class="playbox" @click=${(ev: Event) => ev.stopPropagation()}>
                    ${this._renderPlayer(b, d, accent)}
                  </div>`,
                )}
              </div>`
            : nothing}
        </div>
      `;
    }

    return html`
      <div class="tablet">
        <div class="events-pane" style="flex-basis:${tabletPaneWidth(cfg)}px">
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
              .playingKey=${playKey || (this._keepLastPlayed ? this._lastPlayedKey : '')}
              .dateFontSize=${cfg.date_font_size ?? 13}
              .dateFontColor=${cfg.date_font_color ?? '#ffffff'}
              .dividerColor=${accent}
              .thumbWidth=${tabW}
              @event-selected=${this._onStripSelect}
            ></upc-events-list>
          </div>
        </div>
        <div class="body">
          <div class="under"></div>
          ${!b || this._gridUnder || this._closing
            ? html`<upc-live-grid
                .hass=${this.hass}
                .entries=${entries}
                .stacked=${false}
                .newest=${newest}
                .minuteTick=${this._minuteTick}
                .columns=${gridCols}
                .scrollMode=${gridCols === 1}
                .aspect=${this.config.grid_aspect ?? '16/9'}
                @tile-open=${this._onTileOpen}
              ></upc-live-grid>`
            : nothing}
          ${b ? keyed(mountKey, html`<div class="playwrap">${this._renderPlayer(b, d, accent)}</div>`) : nothing}
        </div>
      </div>
    `;
  }

  /** The clip player, identical in both homes: the in-place .playwrap
   *  (collapsed page) and the .playbox lightbox over the expanded grid. */
  private _renderPlayer(b: MultiBand, d: CameraData | undefined, accent: string) {
    // The event's span, fixed for the life of the selection: the media view
    // seeks within it itself and stops at its end (paused on the last frame).
    const span = this._eventSpan ?? {
      start: Math.max(b.start - (d?.preMs ?? 0), 0),
      end: Math.min(b.end + (d?.postMs ?? 0), Date.now()),
    };
    // The camera screen's deeper accent (speed above 1x), as its controls are.
    return html`<upc-media-view
      style="--upc-accent-deep:${darken(accent, 0.58) || accent}"
      .hass=${this.hass}
      .nvrId=${this._nvrIdFor(b.camera)}
      .cameraId=${b.camera}
      .gaps=${[]}
      .targetTime=${span.start}
      .clipEndTime=${span.end}
      .scrubbing=${false}
      .live=${false}
      .stacked=${this.stacked}
      .previewDir=${''}
      .accent=${accent}
      .now=${Date.now()}
      .fsHandoff=${true}
      .roundCtrl=${true}
      .closable=${true}
      .chromeHidden=${this._chromeHidden}
      @fullscreen-handoff=${this._onFsHandoff}
      @player-close=${this._dismiss}
    ></upc-media-view>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'upc-multi-view': MultiView;
  }
}
