// Scrub-preview loader: the low-res timelapse blocks written by the pyscript
// protect_scrub job, shown on the stage while the user scrubs the timeline
// (the same mechanism the UniFi app uses for its scrub preview).
//
// The sync job exports fixed epoch-aligned blocks (default 10 min) of the NVR's
// own 640×360 timelapse export into <dir>/ (e.g. /protect_scrub/<object_id>):
//   <start_ms>.mp4        — completed block, immutable once written
//   o<start_ms>.mp4       — coarse hour-long overview unit, immutable
//   h<start>-<end>.mp4    — the in-progress block, re-exported every run under a
//                           NEW name; the range it covers is IN the name
//   index.json            — { generated, block_ms, blocks, overview, maps, head }
// This loader mirrors the index (so missing blocks never 404-spam) and hands out
// blob: URLs for the block covering any scrub time.
//
// EVERY playable file here is immutable and named after the range it covers.
// That is what makes the linear time mapping safe: the head used to be a single
// head.mp4 overwritten every minute while its range came from this separately
// cached index, so a stale index seeked proportionally into bytes from another
// time entirely — worst at a block boundary, where the file jumps a full block
// and the shown frame landed up to ~9 minutes from its own label. With the range
// in the name a stale index can only serve an OLDER generation, never a wrong
// one. Immutability also means a small LRU of blobs makes revisited times
// instant and the HTTP cache can be trusted (no no-store re-downloads).

import type { HomeAssistant } from './types';

// Re-read index.json at most this often — the sync job runs once a minute, so
// this is also how quickly the rolling head block's coverage advances here.
const INDEX_TTL_MS = 60_000;
// ...except while the scrub target is in the HEAD region, where the index age is
// exactly how far behind live the preview sits (completed blocks and overview
// hours only change every 10 min / 1 h, so they don't need this). That refresh
// runs in the BACKGROUND: heads are immutable now, so a stale index only costs
// freshness, never correctness — and _updatePreview AWAITS ensureIndex, so an
// ~18 KB fetch (whose `generated` changes every run, so ETags never 304) must
// never sit on the critical path of a drag.
const HEAD_TTL_MS = 10_000;
// A failed index read retries this soon instead of burning a whole TTL.
const INDEX_RETRY_MS = 5_000;

// ---- tip tier (EXPERIMENTAL) ----------------------------------------------
// The cron-driven head can only ever be as fresh as the last run (10-70s), and
// it is a timelapse: one frame per ~2.4s. Measured on the NVR, footage is
// actually available 1 SECOND behind live and a plain low-res export of the
// last 60s costs ~0.9 MB and ~1.1s end to end. So when a scrub gesture STARTS
// near the live edge the card asks for one: `tip.json` then names an immutable
// t<start>-<end>.mp4 covering the newest minute at ~30fps.
const TIP_TTL_MS = 5_000; // don't re-read tip.json faster than this when idle
const TIP_REQUEST_THROTTLE_MS = 8_000; // min gap between NVR export requests
// A tip already reaching this close to live is good enough — re-exporting for a
// couple of seconds of extra freshness just burns NVR calls mid-drag.
const TIP_FRESH_MS = 15_000;
// After requesting one, poll for the publish (measured ~1.1s) rather than
// waiting for the next TTL — this is the whole latency the user feels.
const TIP_POLL_MS = 400;
const TIP_POLL_TRIES = 15; // ~6s, then give up until the next request
// index.json `generated` older than this means the sync job isn't running
// (it rewrites the index every run as a heartbeat) -> ask it to run.
const INDEX_STALE_MS = 25 * 60_000;
const SYNC_THROTTLE_MS = 5 * 60_000;
// Cached block blobs (the two on-screen slots + neighbours + recently visited).
// Bounded so a long kiosk session can't grow it; evicted blobs are revoked to
// free memory. Blobs currently assigned to a <video> are pinned (setPinned) —
// revoking one under a mounted element makes it error out to black.
// Raised from 12 with the overview tier: a drag now keeps ~3 overview hours
// warm alongside the fine block and its neighbours, and thrashing that cache is
// exactly the freeze the tier exists to prevent. ~16 x ~650 KB = ~10 MB, which
// is nowhere near the iOS memory ceiling this code has hit before.
const MAX_BLOBS = 16;
// SPRITE-PREVIEW-2026-08-04: decoded sheets kept warm. Small on purpose — see
// the field comment; ~13 MB of RGBA each.
const MAX_SHEETS = 6;
// Concurrent sheet downloads. Sheets are ~700 KB each and the LIVE stream this
// competes with survives on a ~2 s buffer, so an unbounded fan-out (measured:
// 88 requests from ONE 0.5 s drag) is what made live stutter. Two keeps the
// shown sheet responsive without monopolising the connection pool.
const MAX_SHEET_INFLIGHT = 2;

/** One playable preview unit: a completed <start>.mp4, an overview hour, one
 *  head generation (h<start>-<end>.mp4), or a single part of a mapped block.
 *  All are immutable and cover exactly [start, end], so the filename is the
 *  cache key and the video maps linearly onto that range. */
export interface PreviewBlock {
  key: string;
  start: number; // covered range (epoch ms); the video maps linearly onto it
  end: number;
  url: string;
  head?: boolean;
  part?: boolean; // one segment of a mapped block, not a whole unit
  tip?: boolean; // on-demand real-time clip of the newest ~minute
  // Block was exported in SEGMENTS cut at event boundaries (the NVR's
  // timelapse packs frames at content-driven density with no real-time info,
  // so one linear mapping would skew by minutes around events). A mapped
  // block is not itself playable — resolvePart() picks the covering part.
  mapped?: boolean;
  // SPRITE-PREVIEW-2026-08-04: a coarse overview hour. Only blocks and overview
  // hours have sprite sheets, and their stems differ, so the tier has to be
  // distinguishable from the unit alone.
  overview?: boolean;
}

/** SPRITE-PREVIEW-2026-08-04. The decoder-free form of a unit: its frames as
 *  JPEG mosaics. `count` is PER UNIT (it varies — a 10-min block holds ~251
 *  frames, an overview hour ~299) and is the ground truth for time -> tile,
 *  which is why this sidecar exists at all rather than the geometry living in
 *  index.json. Time maps exactly as the video path maps seconds:
 *    tile  = floor(frac * count)
 *    sheet = floor(tile / (cols * rows))
 *    pos   = tile % (cols * rows)   -> sx = (pos % cols) * tileW, etc. */
export interface SpriteSet {
  count: number;
  cols: number;
  rows: number;
  tileW: number;
  tileH: number;
  sheets: string[];
}

/** One sidecar map entry: real range [s, e] is the standalone part file `f`. */
export interface PreviewSegment {
  s: number;
  e: number;
  f: string;
}

export class ScrubPreviewLoader {
  private _hass?: HomeAssistant;
  private _dir = '';
  private _blocks = new Set<number>(); // completed block starts (epoch ms)
  private _blockMs = 600_000;
  // Coarse overview tier (o<start>.mp4, one file per hour): what a fast drag
  // shows while the fine block is still downloading. Same blob cache/LRU.
  private _overview = new Set<number>();
  private _overviewMs = 3_600_000;
  // Rolling head coverage. `file` is the immutable name of the generation that
  // covers exactly [start, end]; a head without one comes from a pre-immutable
  // sync job and is IGNORED (see blockFor).
  private _head?: { start: number; end: number; map?: boolean; file?: string };
  private _mapped = new Set<number>(); // block starts with a .map.json sidecar
  private _indexAt = 0; // when the index was last (re)fetched
  private _indexLoading?: Promise<void>;
  private _blobs = new Map<string, string>(); // block key -> blob: URL (LRU)
  private _loading = new Map<string, Promise<string | undefined>>();
  private _maps = new Map<string, PreviewSegment[] | null>(); // key -> sidecar (null = failed)
  private _lastSync = 0;
  private _pinned = new Set<string>(); // blob URLs a mounted <video> still points at
  // The head generation whose bytes we already hold, so a new generation every
  // ~60s doesn't restage the slot mid-gesture. Safe because generations NEST
  // ([start, end_n] is inside [start, end_n+1]) and each is its own immutable
  // file: reusing it can only show a slightly older frame within its own range.
  private _headHeld?: PreviewBlock;
  private _warnedNoHeadFile = false;
  // ---- sprite tier (SPRITE-PREVIEW-2026-08-04) ----
  // Which units the sync job also published as JPEG mosaics, plus the decoded
  // sheets. A sheet is 2400x1350 -> ~13 MB of RGBA once decoded, so this LRU is
  // deliberately small and evicted bitmaps are close()d: holding a dozen would
  // be ~150 MB, which is exactly the kind of pressure that has blacked out iOS
  // before. Six covers the on-screen sheet plus its neighbours either side.
  private _spriteBlocks = new Set<number>();
  private _spriteOverview = new Set<number>();
  private _sprites = new Map<string, SpriteSet | null>(); // unit key -> sidecar (null = none)
  private _spriteLoading = new Map<string, Promise<SpriteSet | undefined>>();
  private _sheets = new Map<string, ImageBitmap>();
  private _sheetLoading = new Map<string, Promise<ImageBitmap | undefined>>();
  private _sheetAborts = new Map<string, AbortController>();
  private _sheetInflight = 0;
  // ---- tip tier (EXPERIMENTAL) ----
  private _tip?: { start: number; end: number; file: string };
  private _tipHeld?: PreviewBlock; // generation whose bytes we already hold
  private _tipAt = 0; // when tip.json was last read
  private _tipReqAt = 0; // when an export was last requested
  private _tipPolling = false;
  private _tipEnabled = false;
  /** Called when a fresher tip lands, so the view can re-resolve without the
   *  user having to move the pointer (a held scrub gets the upgrade too). */
  onTipUpdate?: () => void;

  /** Point the loader at a camera's cache dir; a dir change drops everything. */
  configure(hass: HomeAssistant, dir: string): void {
    this._hass = hass;
    if (dir === this._dir) return;
    this._dir = dir;
    this._reset();
  }

  destroy(): void {
    this._reset();
  }

  private _reset(): void {
    for (const url of this._blobs.values()) URL.revokeObjectURL(url);
    this._blobs.clear();
    this._loading.clear();
    this._blocks.clear();
    this._overview.clear();
    this._maps.clear();
    this._mapped.clear();
    this._head = undefined;
    this._headHeld = undefined;
    this._tip = undefined;
    this._tipHeld = undefined;
    this._tipAt = 0;
    this._tipReqAt = 0;
    this._pinned.clear();
    this._indexAt = 0;
    // SPRITE-PREVIEW-2026-08-04: decoded bitmaps are not garbage — close them.
    for (const bmp of this._sheets.values()) bmp.close();
    this._sheets.clear();
    this._sheetLoading.clear();
    this._sprites.clear();
    this._spriteLoading.clear();
    this._spriteBlocks.clear();
    this._spriteOverview.clear();
  }

  // ---- sprite tier (SPRITE-PREVIEW-2026-08-04) ------------------------------

  /** Whether this unit was also published as JPEG mosaics. Only whole fine
   *  blocks and overview hours are: the head is re-exported every minute and
   *  the tip is on demand, so neither has sheets and both stay on the video
   *  path (near-live scrubbing is unchanged by this tier). */
  hasSprites(b: PreviewBlock): boolean {
    if (b.head || b.tip || b.part) return false;
    if (b.overview) return this._spriteOverview.has(b.start);
    return this._spriteBlocks.has(b.start);
  }

  /** The sidecar if it is already in hand (synchronous — for "can I paint this
   *  unit right now?" checks that must not await). */
  spriteIfLoaded(b: PreviewBlock): SpriteSet | undefined {
    return this._sprites.get(b.key) ?? undefined;
  }

  /** The sidecar for a unit — cached + deduped, exactly like getMap(). */
  async getSprite(b: PreviewBlock): Promise<SpriteSet | undefined> {
    if (!this.hasSprites(b)) return undefined;
    const hit = this._sprites.get(b.key);
    if (hit !== undefined) return hit ?? undefined;
    let p = this._spriteLoading.get(b.key);
    if (!p) {
      p = this._fetchSprite(b).finally(() => this._spriteLoading.delete(b.key));
      this._spriteLoading.set(b.key, p);
    }
    return p;
  }

  private async _fetchSprite(b: PreviewBlock): Promise<SpriteSet | undefined> {
    try {
      // Sits beside its unit under the same stem, like the .map.json sidecar.
      const res = await fetch(b.url.replace(/\.mp4$/, '.sprite.json'));
      const d = res.ok
        ? ((await res.json()) as {
            version?: number;
            count?: number;
            cols?: number;
            rows?: number;
            tile_w?: number;
            tile_h?: number;
            sheets?: string[];
          })
        : undefined;
      let set: SpriteSet | null = null;
      if (
        d?.version === 1 &&
        d.count &&
        d.cols &&
        d.rows &&
        d.tile_w &&
        d.tile_h &&
        Array.isArray(d.sheets) &&
        d.sheets.length
      ) {
        set = {
          count: d.count,
          cols: d.cols,
          rows: d.rows,
          tileW: d.tile_w,
          tileH: d.tile_h,
          sheets: d.sheets,
        };
      }
      this._sprites.set(b.key, set);
      return set ?? undefined;
    } catch {
      this._sprites.set(b.key, null);
      return undefined;
    }
  }

  /** Tile index within the unit for `t`. `count - 1` is the last REAL frame:
   *  the trailing tiles of the final sheet are ffmpeg's padding and must never
   *  be shown. */
  tileIndexFor(b: PreviewBlock, set: SpriteSet, t: number): number {
    const span = b.end - b.start;
    if (span <= 0) return 0;
    const frac = Math.min(1, Math.max(0, (t - b.start) / span));
    return Math.min(set.count - 1, Math.floor(frac * set.count));
  }

  /** Which sheet a tile index lives in, and where inside it. */
  tileAt(set: SpriteSet, index: number): { sheet: string; sx: number; sy: number } | undefined {
    const per = set.cols * set.rows;
    const i = Math.min(set.count - 1, Math.max(0, index));
    const sheet = set.sheets[Math.floor(i / per)];
    if (!sheet) return undefined;
    const pos = i % per;
    return { sheet, sx: (pos % set.cols) * set.tileW, sy: Math.floor(pos / set.cols) * set.tileH };
  }

  /** The footage time a tile represents (its centre), so a caller can tell
   *  whether one candidate frame is closer to the wanted time than another. */
  tileTime(b: PreviewBlock, set: SpriteSet, index: number): number {
    return b.start + ((index + 0.5) / set.count) * (b.end - b.start);
  }

  /** Which sheet (and where in it) shows `t` for a unit. */
  tileFor(b: PreviewBlock, set: SpriteSet, t: number): { sheet: string; sx: number; sy: number } | undefined {
    return this.tileAt(set, this.tileIndexFor(b, set, t));
  }

  /** Whether a sheet's bitmap is already decoded and resident. */
  hasSheet(name: string): boolean {
    return this._sheets.has(name);
  }

  /** Abort every sheet download still in flight.
   *
   *  Called the moment a gesture ends. A fast drag queues a LOT of sheets and
   *  they keep arriving long after the user has gone back to LIVE — measured on
   *  one 0.5 s drag: 88 requests / 44 MB total, of which 37 requests / 27 MB
   *  landed AFTER the gesture had finished. The live HLS stream carries only a
   *  ~2 s buffer (PART-HOLD-BACK=2.0) at ~7 Mbps, so that tail starves it and
   *  live stutters for several seconds — which is exactly the regression this
   *  tier introduced. Nothing is lost by aborting: the sheets are immutable and
   *  long-cached, so anything genuinely needed later re-fetches (usually from
   *  the HTTP cache). */
  abortSheets(): void {
    for (const c of this._sheetAborts.values()) {
      try {
        c.abort();
      } catch {
        /* already settled */
      }
    }
    this._sheetAborts.clear();
    this._sheetLoading.clear();
    this._sheetInflight = 0;
  }

  /** Decoded sheet bitmap — cached, deduped, LRU-bounded.
   *
   *  `prefetch` marks a speculative neighbour: those are DROPPED rather than
   *  queued when enough downloads are already in flight, so warming can never
   *  crowd out the sheet actually being shown (or the live stream). */
  async getSheet(name: string, prefetch = false): Promise<ImageBitmap | undefined> {
    const hit = this._sheets.get(name);
    if (hit) {
      this._sheets.delete(name); // refresh LRU position
      this._sheets.set(name, hit);
      return hit;
    }
    let p = this._sheetLoading.get(name);
    if (!p) {
      if (prefetch && this._sheetInflight >= MAX_SHEET_INFLIGHT) return undefined;
      p = this._fetchSheet(name).finally(() => this._sheetLoading.delete(name));
      this._sheetLoading.set(name, p);
    }
    return p;
  }

  private async _fetchSheet(name: string): Promise<ImageBitmap | undefined> {
    const ctrl = new AbortController();
    this._sheetAborts.set(name, ctrl);
    this._sheetInflight++;
    try {
      // Immutable and long-cached by the static mount, like every other unit
      // here, so the HTTP cache does the repeat work for free.
      const res = await fetch(`${this._dir}/${name}`, { signal: ctrl.signal });
      if (!res.ok) return undefined;
      const bmp = await createImageBitmap(await res.blob());
      this._sheets.set(name, bmp);
      while (this._sheets.size > MAX_SHEETS) {
        const oldest = this._sheets.keys().next().value as string | undefined;
        if (oldest === undefined || oldest === name) break;
        const old = this._sheets.get(oldest);
        this._sheets.delete(oldest);
        old?.close(); // frees the decoded pixels; drawing a closed bitmap throws
      }
      return bmp;
    } catch {
      // Includes AbortError from abortSheets() — the caller simply keeps the
      // frame already on screen, which is the same as any other miss.
      return undefined;
    } finally {
      this._sheetAborts.delete(name);
      this._sheetInflight = Math.max(0, this._sheetInflight - 1);
    }
  }

  /** Blob URLs that are currently assigned to a mounted <video>. These are never
   *  evicted — revoking a URL under a live element makes it error to black. */
  setPinned(urls: (string | undefined)[]): void {
    this._pinned = new Set(urls.filter((u): u is string => !!u));
  }

  /** Refresh the index if due. Resolves once an attempt has completed (missing
   *  index just leaves the block set empty — the preview stays off).
   *
   *  Pass the scrub target so a time in the head region can trigger the shorter
   *  HEAD_TTL_MS refresh — fired but NOT awaited, so it only ever makes the next
   *  retarget fresher and never stalls this one. */
  async ensureIndex(t?: number): Promise<void> {
    if (!this._dir) return;
    const age = Date.now() - this._indexAt;
    if (age < INDEX_TTL_MS) {
      const h = this._head;
      if (h && t !== undefined && t >= h.start && age >= HEAD_TTL_MS) void this._refreshIndex();
      return;
    }
    return this._refreshIndex();
  }

  private _refreshIndex(): Promise<void> {
    if (!this._indexLoading) {
      this._indexLoading = this._fetchIndex().finally(() => {
        this._indexLoading = undefined;
      });
    }
    return this._indexLoading;
  }

  private async _fetchIndex(): Promise<void> {
    let ok = false;
    let stale = true;
    try {
      const res = await fetch(`${this._dir}/index.json`, { cache: 'no-cache' });
      if (res.ok) {
        const data = (await res.json()) as {
          generated?: number;
          block_ms?: number;
          blocks?: number[];
          maps?: number[];
          overview_block_ms?: number;
          overview?: number[];
          head?: { start?: number; end?: number; map?: boolean; file?: string } | null;
          // SPRITE-PREVIEW-2026-08-04 (absent on an older sync job -> the sets
          // stay empty and every unit simply resolves to its mp4, as before).
          sprites?: number[];
          osprites?: number[];
        };
        if (Array.isArray(data.blocks)) {
          ok = true;
          this._blocks = new Set(data.blocks);
          this._mapped = new Set(data.maps ?? []);
          if (data.block_ms && data.block_ms > 0) this._blockMs = data.block_ms;
          // Absent on an index written before the overview tier existed — the
          // set just stays empty and the card behaves exactly as it used to.
          this._overview = new Set(data.overview ?? []);
          this._spriteBlocks = new Set(data.sprites ?? []); // SPRITE-PREVIEW-2026-08-04
          this._spriteOverview = new Set(data.osprites ?? []);
          if (data.overview_block_ms && data.overview_block_ms > 0) {
            this._overviewMs = data.overview_block_ms;
          }
          const h = data.head;
          this._head =
            h && typeof h.start === 'number' && typeof h.end === 'number' && h.end > h.start
              ? { start: h.start, end: h.end, map: !!h.map, file: h.file }
              : undefined;
          if (this._head && !this._head.file && !this._warnedNoHeadFile) {
            this._warnedNoHeadFile = true;
            console.warn(
              '[unifi-protect-timeline-card] scrub preview: protect_scrub.py is out of date ' +
                '(head has no immutable `file`) — near-live preview disabled. Update the pyscript job.',
            );
          }
          stale = Date.now() - (data.generated ?? 0) > INDEX_STALE_MS;
        }
      }
    } catch {
      /* missing/unreadable index -> stays stale -> sync requested below */
    }
    // Only a SUCCESSFUL read resets the TTL. Stamping it up front (as this used
    // to) meant one transient failure kept the stale index AND burned the whole
    // interval before anything would retry.
    this._indexAt = ok ? Date.now() : Date.now() - Math.max(0, INDEX_TTL_MS - INDEX_RETRY_MS);
    if (stale) this._requestSync();
  }

  /** Fire the pyscript sync service (throttled). No-ops when pyscript isn't
   *  installed — the card just keeps the plain black scrub stage. */
  private _requestSync(): void {
    if (!this._hass) return;
    const now = Date.now();
    if (now - this._lastSync < SYNC_THROTTLE_MS) return;
    this._lastSync = now;
    this._hass
      .callWS({ type: 'call_service', domain: 'pyscript', service: 'protect_scrub_sync' })
      .catch(() => {
        /* pyscript not installed / service unavailable */
      });
  }

  /** The block covering `t`, if any. Completed blocks win; the rolling head
   *  covers everything from its start onward (times past its end clamp to the
   *  newest exported frame — that's the last ~minute behind live). */
  blockFor(t: number): PreviewBlock | undefined {
    const start = Math.floor(t / this._blockMs) * this._blockMs;
    if (this._blocks.has(start)) {
      return {
        key: `b${start}`,
        start,
        end: start + this._blockMs,
        url: `${this._dir}/${start}.mp4`,
        mapped: this._mapped.has(start),
      };
    }
    const h = this._head;
    // No `file` -> a sync job predating the immutable head naming. Deliberately
    // NO fallback to head.mp4: that file is rewritten in place (and jumps a full
    // block at every boundary) while its range comes from this cached index, so
    // mapping it showed frames minutes from their own label. No head is better
    // than a lying one — the region just has no coverage and the card holds the
    // last frame, which is its normal no-coverage behaviour.
    if (h && h.file && t >= h.start) {
      // Prefer a generation we already hold while it still covers the wanted
      // time: a new one lands every sync run, and restaging the slot mid-gesture
      // for footage we can already show is pure churn. Safe because generations
      // nest and each is its own immutable file — worst case a slightly older
      // frame, never a frame from outside [start, end].
      const held = this._headHeld;
      if (held && held.start === h.start && t <= held.end && this._blobs.has(held.key)) {
        return held;
      }
      return {
        // The filename carries the covered range, so it IS the identity.
        key: h.file,
        start: h.start,
        end: h.end,
        url: `${this._dir}/${h.file}`,
        head: true,
        mapped: !!h.map,
      };
    }
    return undefined;
  }

  // ---- tip tier (EXPERIMENTAL) ---------------------------------------------

  /** Turn the on-demand tip on/off (card config `scrub_tip`). Off = nothing
   *  here ever runs: no service calls, no tip.json reads. */
  setTipEnabled(on: boolean): void {
    this._tipEnabled = on;
    if (!on) this._tip = undefined;
  }

  /** The camera slug the pyscript service wants — the last path segment of the
   *  cache dir, which is the HA camera entity's object_id by construction. */
  private _slug(): string {
    return this._dir.split('/').filter(Boolean).pop() ?? '';
  }

  /** Ask the NVR for a fresh clip of the newest ~minute, then poll for it.
   *  Called when a scrub STARTS near the live edge. Throttled; a no-op when
   *  the tip is disabled or pyscript isn't running the newer job. */
  requestTip(): void {
    if (!this._tipEnabled || !this._hass || !this._dir) return;
    const now = Date.now();
    if (now - this._tipReqAt < TIP_REQUEST_THROTTLE_MS) return;
    // Already have footage within seconds of live: another export would cost an
    // NVR round trip to move the edge by a couple of seconds, and every new
    // generation is a fresh 0.9 MB download for the card.
    if (this._tip && this._tip.end > now - TIP_FRESH_MS) return;
    this._tipReqAt = now;
    this._hass
      .callWS({
        type: 'call_service',
        domain: 'pyscript',
        service: 'protect_scrub_tip',
        service_data: { slug: this._slug() },
      })
      // Only poll once the service actually exists — otherwise an install
      // without the newer pyscript job would 404 tip.json TIP_POLL_TRIES times
      // per gesture just to learn what the rejection already told us.
      .then(() => this._pollTip())
      .catch(() => {
        /* older pyscript job / service unavailable — the head still serves */
      });
  }

  /** Poll tip.json until the requested export shows up (~1.1s measured). */
  private async _pollTip(): Promise<void> {
    if (this._tipPolling) return;
    this._tipPolling = true;
    try {
      const before = this._tip?.end ?? 0;
      for (let i = 0; i < TIP_POLL_TRIES; i++) {
        await new Promise((r) => setTimeout(r, TIP_POLL_MS));
        if (!this._tipEnabled) return;
        await this._fetchTip();
        if ((this._tip?.end ?? 0) > before) {
          this.onTipUpdate?.();
          return;
        }
      }
    } finally {
      this._tipPolling = false;
    }
  }

  /** Refresh tip.json if due (cheap: a few hundred bytes). */
  async ensureTip(): Promise<void> {
    if (!this._tipEnabled || !this._dir) return;
    if (Date.now() - this._tipAt < TIP_TTL_MS) return;
    await this._fetchTip();
  }

  private async _fetchTip(): Promise<void> {
    this._tipAt = Date.now();
    try {
      // Rewritten on every export — never serve it from the HTTP cache. The
      // FILE it names is immutable, which is what keeps the mapping honest.
      const res = await fetch(`${this._dir}/tip.json`, { cache: 'no-store' });
      if (!res.ok) return;
      const d = (await res.json()) as {
        start?: number;
        end?: number;
        file?: string;
      };
      if (typeof d.start === 'number' && typeof d.end === 'number' && d.end > d.start && d.file) {
        this._tip = { start: d.start, end: d.end, file: d.file };
      }
    } catch {
      /* no tip.json yet (job never asked, or older pyscript) */
    }
  }

  /** The tip unit for `t`, when the tip is the best thing available.
   *
   *  Inside its own range it always wins: it is real-time (~30fps) where every
   *  other tier is a timelapse at one frame per 2.4s or worse. PAST its end it
   *  only wins while nothing fresher exists — once a cron head has caught up
   *  past it, clamping to a minutes-old tip frame would be worse than the head.
   *  `head` is the head's advertised end (0 when there is none). */
  tipBlockFor(t: number, headEnd: number): PreviewBlock | undefined {
    const tip = this._tip;
    if (!this._tipEnabled || !tip || t < tip.start) return undefined;
    if (t > tip.end && tip.end <= headEnd) return undefined;
    const b: PreviewBlock = {
      key: tip.file,
      start: tip.start,
      end: tip.end,
      url: `${this._dir}/${tip.file}`,
      tip: true,
    };
    if (this._blobs.has(b.key)) {
      this._tipHeld = b;
      return b;
    }
    // A newer generation was just published but its ~0.9 MB is still coming
    // down. Keep serving the one we already hold while it covers `t` — tips
    // overlap heavily (each is the newest 60s), and dropping back to the
    // timelapse head for a second is a visible quality flicker mid-drag.
    const held = this._tipHeld;
    if (held && t >= held.start && this._blobs.has(held.key)) {
      if (t <= held.end || held.end > headEnd) {
        // Still pull the newer one in the background and announce it when it
        // lands. Returning `held` makes the caller see a CACHED unit, so it
        // would never start this download itself — and the held tip would then
        // stay on screen forever, stuck at its own end near the live edge.
        void this.getBlock(b).then((u) => {
          if (u) this.onTipUpdate?.();
        });
        return held;
      }
    }
    return b;
  }

  /** The head's advertised end, for tipBlockFor's freshness comparison. */
  headEnd(): number {
    return this._head?.end ?? 0;
  }

  /** Fine block length in ms (from index.json). PERF-SCRUB-2026-08-03: the
   *  media-view compares it against the scrub velocity to decide whether a fine
   *  unit could even be staged before the playhead has left it. */
  blockMs(): number {
    return this._blockMs;
  }

  /** The coarse overview unit covering `t`, if that hour has been exported.
   *  Never `mapped` (uniform density by construction at this speedup), so it is
   *  always directly playable — no sidecar round trip before a frame can show.
   *  Undefined inside the current incomplete hour; the fine blocks and the
   *  rolling head cover that region. */
  overviewBlockFor(t: number): PreviewBlock | undefined {
    const start = Math.floor(t / this._overviewMs) * this._overviewMs;
    if (!this._overview.has(start)) return undefined;
    return {
      key: `o${start}`,
      start,
      end: start + this._overviewMs,
      url: `${this._dir}/o${start}.mp4`,
      overview: true, // SPRITE-PREVIEW-2026-08-04
    };
  }

  /** The sidecar segment map for a mapped block (cached + deduped; undefined
   *  when the sidecar is missing/invalid). */
  private _mapLoading = new Map<string, Promise<PreviewSegment[] | undefined>>();

  async getMap(b: PreviewBlock): Promise<PreviewSegment[] | undefined> {
    if (!b.mapped) return undefined;
    const hit = this._maps.get(b.key);
    if (hit !== undefined) return hit ?? undefined;
    let p = this._mapLoading.get(b.key);
    if (!p) {
      p = this._fetchMap(b).finally(() => this._mapLoading.delete(b.key));
      this._mapLoading.set(b.key, p);
    }
    return p;
  }

  private async _fetchMap(b: PreviewBlock): Promise<PreviewSegment[] | undefined> {
    try {
      // Sidecar sits beside its unit under the same stem — true for both
      // <start>.mp4 and h<start>-<end>.mp4, so no head special case.
      const url = b.url.replace(/\.mp4$/, '.map.json');
      // A block sidecar is rewritten if the block is ever re-exported, so
      // revalidate (cheap ETag roundtrip on a tiny file). Head sidecars are
      // uniquely named now and would be fine either way.
      const res = await fetch(url, { cache: 'no-cache' });
      const data = res.ok
        ? ((await res.json()) as { version?: number; segments?: PreviewSegment[] })
        : undefined;
      let segs: PreviewSegment[] | null = null;
      if (data?.version === 2 && Array.isArray(data.segments) && data.segments.length) {
        segs = data.segments.filter((g) => typeof g?.f === 'string' && g.e > g.s);
        if (!segs.length) segs = null;
      }
      this._maps.set(b.key, segs);
      return segs ?? undefined;
    } catch {
      this._maps.set(b.key, null);
      return undefined;
    }
  }

  /** Resolve a mapped block + time to the playable PART covering that time
   *  (a standalone small MP4 spanning exactly [s, e] — the <video> element's
   *  duration is the ground truth for the linear seek within it). Times in an
   *  unexported gap resolve to the nearest earlier part (its end frame).
   *  Neighbour parts are prefetched fire-and-forget. */
  async resolvePart(b: PreviewBlock, t: number): Promise<PreviewBlock | undefined> {
    const map = await this.getMap(b);
    if (!map) return undefined;
    let i = 0;
    for (let k = 0; k < map.length; k++) {
      if (t >= map[k].s) i = k;
      else break;
    }
    for (const j of [i - 1, i + 1]) {
      if (j >= 0 && j < map.length) void this.getBlock(this._partBlock(b, map[j]));
    }
    return this._partBlock(b, map[i]);
  }

  private _partBlock(b: PreviewBlock, seg: PreviewSegment): PreviewBlock {
    return {
      // Part filenames embed their unit's stem — including the head generation's
      // — so the name alone is unique and immutable for heads and blocks alike.
      key: `p${seg.f}`,
      start: seg.s,
      end: seg.e,
      url: `${this._dir}/${seg.f}`,
      head: b.head,
      part: true,
    };
  }

  /** Whether a block's bytes are already held as a blob (no fetch needed). */
  isCached(b: PreviewBlock): boolean {
    return this._blobs.has(b.key);
  }

  /** blob: URL for a block — cached, deduped; undefined if the fetch fails. */
  async getBlock(b: PreviewBlock): Promise<string | undefined> {
    const hit = this._blobs.get(b.key);
    if (hit) {
      // Refresh the LRU position so the on-screen block is never the eviction pick.
      this._blobs.delete(b.key);
      this._blobs.set(b.key, hit);
      return hit;
    }
    let p = this._loading.get(b.key);
    if (!p) {
      p = this._fetchBlock(b).finally(() => this._loading.delete(b.key));
      this._loading.set(b.key, p);
    }
    return p;
  }

  private async _fetchBlock(b: PreviewBlock): Promise<string | undefined> {
    try {
      // Every preview file is immutable and named after the range it covers —
      // completed blocks, overview hours, parts and head generations alike — so
      // the static mount's long Cache-Control is exactly right and no override
      // is needed. (The head used to need no-store because it was rewritten
      // under a fixed name; that is the whole bug this naming removes.)
      const res = await fetch(b.url);
      if (!res.ok) {
        // A head generation the index named has since been reaped (index went
        // stale while the card was backgrounded): force a refresh so the next
        // retarget names the current generation instead of re-404ing this one.
        if (b.head) this._indexAt = 0;
        return undefined;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      this._blobs.set(b.key, url);
      // Remember the generation we hold so blockFor can keep serving it (see
      // there). Parts are excluded — they cover one segment, not the head.
      if (b.head && !b.part) this._headHeld = b;
      // Evict oldest-first, but skip anything a mounted <video> still points at
      // (they'd error to black); those are re-checked on the next insert.
      while (this._blobs.size > MAX_BLOBS) {
        let evicted = false;
        for (const [key, old] of this._blobs) {
          if (this._pinned.has(old)) continue;
          this._blobs.delete(key);
          URL.revokeObjectURL(old);
          evicted = true;
          break;
        }
        if (!evicted) break; // everything left is on screen
      }
      return url;
    } catch {
      return undefined;
    }
  }
}
