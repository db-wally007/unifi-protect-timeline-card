// Multi-camera event merging + relative-time formatting (pure, unit-tested).
//
// The multi page fetches one manifest per camera and gap-merges each camera's
// raw events with the existing groupBands() — grouping stays PER CAMERA (two
// cameras seeing the same person are two clips, like the UniFi app). This
// module only tags bands with their camera and interleaves the per-camera
// groups newest-first for the merged strip.

import type { DetectionBand } from './types';

// A display band that knows which camera it belongs to — the strip needs the
// name for its caption, playback needs the entity_id for the export URL.
export interface MultiBand extends DetectionBand {
  camera: string; // HA camera entity_id (the events/clip key, NOT live_camera)
  cameraName: string;
}

/** Tag one camera's (already grouped) bands with its identity. */
export function tagBands(
  bands: DetectionBand[],
  camera: string,
  cameraName: string,
): MultiBand[] {
  return bands.map((b) => ({ ...b, camera, cameraName }));
}

/** Interleave the per-camera group lists into one strip, newest-first. */
export function mergeStrip(perCamera: MultiBand[][]): MultiBand[] {
  return perCamera.flat().sort((a, b) => b.start - a.start);
}

/** UniFi-app-style relative time for the tile overlays: "just now",
 *  "5 minutes ago", "2 hours ago", "3 days ago". */
export function relTime(ms: number, now: number): string {
  const s = Math.max(0, Math.floor((now - ms) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return m === 1 ? '1 minute ago' : `${m} minutes ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return h === 1 ? '1 hour ago' : `${h} hours ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? '1 day ago' : `${d} days ago`;
}
