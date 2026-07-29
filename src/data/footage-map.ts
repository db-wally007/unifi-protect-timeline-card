// Recorded-footage spans and playback-segment boundaries.
//
// Adaptive recording keeps TWO tiers on the NVR: full-quality (4K) around
// detections (event span ± recording padding), and a continuous lower-quality
// (640×360, real-time 30fps) track in between. The export API serves ONE tier
// per request — a request overlapping an event comes from the 4K track, where
// the idle stretches exist only as sparse keyframes (so they play absurdly
// fast and the timeline marker drifts off the footage).
//
// The card therefore CUTS its playback requests at the event boundaries it
// already knows from the manifest: an event-span request streams real-time 4K,
// an idle-span request streams the real-time low-quality tier — chained they
// play continuously with correct time, exactly like the UniFi app (which also
// switches quality tiers between events).
//
// Pure functions — unit-tested.

export interface FootageSpan {
  start: number; // epoch ms
  end: number;
}

// Segments shorter than this are pointless exports: a boundary closer to the
// segment start is skipped, accepting a couple of mixed-tier seconds instead.
const MIN_SEGMENT_MS = 3000;

/** Merge raw manifest events (each padded by the camera's recording padding)
 *  into sorted, disjoint full-quality recorded spans. */
export function buildFootageSpans(
  events: Array<{ start: number; end: number }>,
  preMs: number,
  postMs: number,
): FootageSpan[] {
  const padded = events
    .map((e) => ({ start: e.start - preMs, end: e.end + postMs }))
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start);
  const merged: FootageSpan[] = [];
  for (const s of padded) {
    const last = merged[merged.length - 1];
    if (last && s.start <= last.end) last.end = Math.max(last.end, s.end);
    else merged.push({ ...s });
  }
  return merged;
}

/** Where the playback segment starting at `startMs` must end so the request
 *  stays within ONE recording tier: the first event-span boundary after the
 *  start (ignoring boundaries closer than MIN_SEGMENT_MS), capped at
 *  `windowEndMs`. No span data (old footage / no manifest) => the full window. */
export function segmentEndFor(
  startMs: number,
  windowEndMs: number,
  spans: FootageSpan[],
): number {
  for (const sp of spans) {
    // Boundaries ascend across the sorted, disjoint spans.
    for (const b of [sp.start, sp.end]) {
      if (b >= windowEndMs) return windowEndMs;
      if (b >= startMs + MIN_SEGMENT_MS) return b;
    }
  }
  return windowEndMs;
}
