// Event-manifest loading (the pyscript protect_thumbs job's per-camera
// manifest.json — the NVR's own raw event list, mirrored 1:1), shared by the
// single-camera card and the multi-camera page (which fans out one load per
// camera). Pure fetch/parse; grouping and footage spans stay with the callers.

import type { DetectionBand, ThumbnailManifest, ThumbnailManifestEntry } from './types';
import { normalizeThumbUrl } from './ha-urls';

// The sync job runs every minute; a manifest older than this means it isn't
// running (or hasn't run yet) — callers then trigger the sync service.
export const MANIFEST_STALE_MS = 3 * 60_000;

// Label/color for each Protect event kind, used when building event bars from
// the manifest (the Protect event list) rather than binary_sensor history.
const KIND_META: Record<string, { label: string; color: string }> = {
  motion: { label: 'Motion', color: '#5c8aff' },
  person: { label: 'Person', color: '#3ddc84' },
  vehicle: { label: 'Vehicle', color: '#ffb300' },
  animal: { label: 'Animal', color: '#ab47bc' },
};

/** Map a manifest entry (a raw Protect event, 1:1) to a drawable band with its
 *  exact id + thumbnail file, so all views match thumbnails 1:1 by event id. */
export function manifestToBand(m: ThumbnailManifestEntry): DetectionBand {
  const meta = KIND_META[m.kind] ?? {
    label: m.kind ? m.kind[0].toUpperCase() + m.kind.slice(1) : 'Event',
    color: '#5c8aff',
  };
  return {
    type: `protect:${m.id}`,
    label: meta.label,
    color: meta.color,
    start: m.start,
    end: m.end,
    id: m.id,
    // Entries written before the cache moved out of www/ carry an absolute
    // /local/... URL — rewrite them onto the current base.
    file: m.file ? normalizeThumbUrl(m.file) : undefined,
    durMs: m.dur,
    ongoing: m.ongoing,
  };
}

export interface LoadedManifest {
  entries: ThumbnailManifestEntry[];
  preMs: number; // camera recording pre-padding (0 on legacy v1 manifests)
  postMs: number;
  // Manifest is missing its freshness stamp or is older than MANIFEST_STALE_MS
  // — the sync job isn't keeping it current, so callers should request a sync.
  stale: boolean;
}

/** Load `${dir}/manifest.json` (cheap static file). Returns undefined when the
 *  file is missing/unreadable/not a manifest — which callers treat as stale.
 *  Legacy v1 (bare entry array) renders but reports stale to trigger a resync. */
export async function loadManifest(dir: string): Promise<LoadedManifest | undefined> {
  try {
    const res = await fetch(`${dir}/manifest.json`, { cache: 'no-cache' });
    if (!res.ok) return undefined;
    const data = (await res.json()) as ThumbnailManifest | ThumbnailManifestEntry[];
    if (Array.isArray(data)) {
      return { entries: data, preMs: 0, postMs: 0, stale: true };
    }
    if (data && Array.isArray(data.events)) {
      return {
        entries: data.events,
        preMs: data.pre_ms ?? 0,
        postMs: data.post_ms ?? 0,
        stale: Date.now() - (data.generated ?? 0) > MANIFEST_STALE_MS,
      };
    }
  } catch {
    /* missing/unreadable manifest — fall through to undefined (= stale) */
  }
  return undefined;
}
