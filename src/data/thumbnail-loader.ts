// Shared, NVR-safe event-thumbnail loader used by both the timeline and the
// events-list views.
//
// Since manifest v2 the bands ARE the NVR's own events, and almost every band
// carries its exact cached thumbnail (`file`) — served as a static /local file
// with zero NVR traffic. This loader only handles the remaining case: an event
// whose thumbnail the sync job hasn't cached yet (brand-new / in-progress
// events, or a failed download). For those it fetches ONE NVR snapshot at the
// event start and keeps it as an in-memory blob: URL.
//
// NVR load is minimized four ways:
//  1. Each event's snapshot is fetched from the NVR AT MOST ONCE and reused as
//     a blob: URL across re-renders and view switches.
//  2. Loads are concurrency-limited (default 2) so we never fire a burst.
//  3. Every fetch is abortable and times out after FETCH_TIMEOUT_MS, so a stuck
//     NVR can't accumulate hung connections.
//  4. Failed fetches back off for RETRY_COOLDOWN_MS instead of retrying per render.
//
// The blob cache is FIFO-bounded so a long-running kiosk session can't grow it
// without limit; evicted blobs are revoked to free memory.

import type { DetectionBand, FootageGap, HomeAssistant } from './types';
import { buildSnapshotUrl, signPath } from './ha-urls';
import { inGap } from './gaps';

// After a snapshot fetch fails, wait this long before trying that event again.
const RETRY_COOLDOWN_MS = 60_000;
// Abort a snapshot fetch that hasn't completed by then — frees the connection
// on both ends instead of piling up requests against a slow NVR.
const FETCH_TIMEOUT_MS = 15_000;

export class ThumbnailLoader {
  private _cache = new Map<string, string>(); // key -> blob: object URL
  private _loading = new Set<string>();
  private _queue: DetectionBand[] = [];
  private _active = 0;
  private _hass?: HomeAssistant;
  private _nvrId = '';
  private _cameraId = '';
  private _maxCache = 600; // bound memory; oldest blobs are revoked when exceeded
  private _failed = new Map<string, number>(); // key -> last-fail timestamp (backoff)
  private _gaps: FootageGap[] = []; // camera-offline spans; never probe the NVR there
  private _controllers = new Set<AbortController>(); // in-flight fetches (cancelable)

  /** @param onLoaded called after each thumbnail resolves, to trigger a redraw. */
  constructor(
    private _maxConcurrent: number,
    private _onLoaded: () => void,
  ) {}

  configure(hass: HomeAssistant, nvrId: string, cameraId: string, maxConcurrent?: number): void {
    this._hass = hass;
    this._nvrId = nvrId;
    this._cameraId = cameraId;
    if (maxConcurrent && maxConcurrent > 0) this._maxConcurrent = maxConcurrent;
  }

  /** Camera-offline spans: snapshots inside them have no footage, so we never
   *  probe the NVR there (it would just 404/500 and re-fire every render). */
  setGaps(gaps: FootageGap[]): void {
    this._gaps = gaps;
  }

  /** Abort all in-flight snapshot fetches and drop the pending queue (card is
   *  disconnecting — nothing will consume the results). */
  cancelAll(): void {
    this._queue.length = 0;
    for (const c of this._controllers) c.abort();
  }

  private _key(b: DetectionBand): string {
    return b.id ?? `${b.type}@${b.start}`;
  }

  /** Thumbnail URL for an event. In order of preference:
   *  1. the event's own cached file (from the manifest) — exact, no NVR;
   *  2. an already-fetched blob: URL — no NVR;
   *  3. a one-time NVR snapshot fetch, cached as a blob URL. */
  get(b: DetectionBand): string | undefined {
    if (b.file) return b.file; // exact 1:1 cached thumbnail, browser-cached

    const key = this._key(b);
    const cached = this._cache.get(key);
    if (cached) return cached;
    // No NVR snapshot exists while the camera was offline — don't probe (the grey
    // gap band already shows why). A later manifest file still wins above.
    if (inGap(this._gaps, b.start)) return undefined;
    // Back off failed fetches: at most one retry per cooldown, not every render.
    const failedAt = this._failed.get(key);
    if (failedAt !== undefined && Date.now() - failedAt < RETRY_COOLDOWN_MS) return undefined;
    if (!this._loading.has(key) && this._hass && this._nvrId && this._cameraId) {
      this._loading.add(key);
      this._queue.push(b);
      this._drain();
    }
    return undefined;
  }

  private _store(key: string, url: string): void {
    this._cache.set(key, url);
    if (this._cache.size > this._maxCache) {
      // Evict the oldest-inserted entry (least likely to be on-screen).
      const oldest = this._cache.keys().next().value as string | undefined;
      if (oldest !== undefined) {
        const old = this._cache.get(oldest);
        this._cache.delete(oldest);
        if (old) URL.revokeObjectURL(old);
      }
    }
  }

  private _drain(): void {
    while (this._active < this._maxConcurrent && this._queue.length) {
      const b = this._queue.shift()!;
      const key = this._key(b);
      this._active++;
      // Multi-camera strip bands carry their own camera; single-camera bands
      // don't and fall back to the configured card camera.
      const camId = (b as DetectionBand & { camera?: string }).camera ?? this._cameraId;
      const raw = buildSnapshotUrl(this._nvrId, camId, b.start, { width: 320 });
      const controller = new AbortController();
      this._controllers.add(controller);
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      // Sign once, fetch the JPEG bytes once, keep them as a blob: URL.
      signPath(this._hass!, raw, 600)
        .then((signed) => fetch(signed, { signal: controller.signal }))
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((blob) => {
          this._store(key, URL.createObjectURL(blob));
          this._failed.delete(key); // recovered
        })
        .catch(() => {
          // Failure OR abort/timeout: back off instead of re-requesting this
          // snapshot on every render.
          this._failed.set(key, Date.now());
        })
        .finally(() => {
          clearTimeout(timeout);
          this._controllers.delete(controller);
          this._active--;
          this._loading.delete(key);
          this._drain();
          this._onLoaded();
        });
    }
  }
}
