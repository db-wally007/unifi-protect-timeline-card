// Footage-availability gaps for the timeline.
//
// UniFi's own timeline greys out spans where the camera has no recording
// ("Lost wired connection", NVR reboot, ...). The card gets them from the scrub
// job (custom_components/protect_cache/scrub.py), which reads EVERY keyframe
// the NVR holds for each camera and publishes the stretches with none as
// `gaps` in that camera's scrub index — the NVR's own record, nothing guessed.
//
// Two earlier sources were wrong, and must not come back:
//
//  * The camera entity's `unavailable` history. Home Assistant losing sight of
//    the NVR is not the NVR losing footage: a restart or an integration reload
//    flips every camera `unavailable` while recording goes on (measured
//    2026-07-29: 15 minutes of footage that plays fine). And the other way
//    round: on 2026-10-20 a hung UniFi console stopped recording at 22:43:06,
//    but the entities stayed `recording` until 22:48:01.
//  * Asking the NVR for a still inside a suspected gap. It answers 200 with the
//    nearest EARLIER frame (asked for 22:48:30, it returned 22:43:06), so a
//    still "exists" inside every gap. And the probing itself, re-run on every
//    pan, flooded the NVR (~230 full-size snapshots in two minutes) and took
//    the whole console down.
//
// The bands are display-only (the grey strip + the wording of the no-footage
// message) and never gate a load — media-view always asks the NVR. They also
// decide which of the calendar's days have footage, and where on a day a jump
// lands (2026-10-28: the calendar offered every day of `calendar_days`). For
// that the job publishes the NVR's oldest footage too, and maps the footage
// older than its photos once (scrub.py PROBE_*). The feature stays gated by
// show_footage_gaps.

import type { FootageGap } from './types';
import { fetchCurrentJson } from './fresh-json';

// The scrub job rewrites its index every 15 s; a copy older than this came
// from a cache (see fresh-json.ts) — the same bound the preview loader uses.
const INDEX_CURRENT_MS = 2 * 60_000;

/** The `gaps` of a scrub index as FootageGaps — malformed entries dropped,
 *  an index without the field (an older job) yields none. With the NVR's
 *  `recording_start` (the oldest footage it still holds), everything before it
 *  is one more gap, from 0 (see footageStart). */
export function scrubIndexGaps(index: { gaps?: unknown; recording_start?: unknown } | undefined): FootageGap[] {
  if (!index) return [];
  const out: FootageGap[] = [];
  if (typeof index.recording_start === 'number' && index.recording_start > 0) {
    out.push({ start: 0, end: index.recording_start });
  }
  for (const g of Array.isArray(index.gaps) ? index.gaps : []) {
    if (!Array.isArray(g) || g.length !== 2) continue;
    const [start, end] = g;
    if (typeof start === 'number' && typeof end === 'number' && end > start) {
      out.push({ start, end });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Where the camera's footage begins, when the gaps know (their gap from 0). */
export function footageStart(gaps: FootageGap[]): number | undefined {
  return gaps[0]?.start === 0 ? gaps[0].end : undefined;
}

/** The moment in [from, to] nearest `t` that has footage, preferring footage
 *  at or after `t` (where it resumes), else the last minute before it -
 *  undefined when the span has none. `gaps` sorted. */
export function nearestFootage(gaps: FootageGap[], from: number, to: number, t: number): number | undefined {
  const spans: [number, number][] = [];
  let s = from;
  for (const g of gaps) {
    if (g.end < s) continue;
    if (g.start > to) break;
    if (g.start > s) spans.push([s, g.start]);
    s = Math.max(s, g.end);
  }
  if (s < to) spans.push([s, to]);
  const after = spans.find(([, b]) => b > t);
  if (after) return Math.max(after[0], t);
  const last = spans[spans.length - 1];
  return last ? Math.max(last[0], last[1] - 60_000) : undefined;
}

/** The recording gaps of the camera whose scrub cache lives at `scrubDir`
 *  (e.g. /protect_scrub/<object_id>). [] when there is no cache or it can't be
 *  read — no band is better than a wrong one. */
export async function fetchFootageGaps(scrubDir: string): Promise<FootageGap[]> {
  if (!scrubDir) return [];
  try {
    const index = await fetchCurrentJson<{ generated?: number; gaps?: unknown; recording_start?: unknown }>(
      `${scrubDir}/index.json`,
      (d) => d.generated,
      INDEX_CURRENT_MS,
    );
    return scrubIndexGaps(index);
  } catch {
    return [];
  }
}

/** True when `t` (epoch ms) falls within any gap. */
export function inGap(gaps: FootageGap[], t: number): boolean {
  for (const g of gaps) if (t >= g.start && t <= g.end) return true;
  return false;
}
