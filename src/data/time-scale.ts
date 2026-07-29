// Pure, side-effect-free mapping between time (epoch ms) and pixel-x within the
// timeline strip, plus pan/zoom domain transforms. Kept dependency-free and
// unit-tested — this is the math the whole scrubber relies on.

import type { TimeDomain } from './types';

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

// Zoom limits expressed as the visible span (end - start): 4 min fully
// zoomed-in, one hour fully zoomed-out. (UniFi's own widest is ~2 h, but that
// far out a whole evening's events collapse into an unreadable smear.)
export const ZOOM_MIN_SPAN = 4 * MINUTE; // most zoomed-in
export const ZOOM_MAX_SPAN = 60 * MINUTE; // most zoomed-out (one hour on screen)

// Discrete zoom levels (visible span). ~30 geometric steps from ZOOM_MIN to
// ZOOM_MAX (each step ~10% change), so it takes ~30 clicks end-to-end like
// UniFi rather than a few coarse jumps.
export const SPAN_STEPS: number[] = (() => {
  const n = 30;
  const r = Math.pow(ZOOM_MAX_SPAN / ZOOM_MIN_SPAN, 1 / (n - 1));
  return Array.from({ length: n }, (_, i) => Math.round(ZOOM_MIN_SPAN * Math.pow(r, i)));
})();

// The playhead sits this far down from the top of the (vertical) timeline:
// a little future above (≈ one label), mostly past below — like UniFi.
export const PLAYHEAD_FRAC = 0.15;

// A phone's FULLSCREEN overlay sits it slightly lower. The active event's
// thumbnail is centred on the playhead, and on that short rotated ruler 0.15
// puts the thumbnail's top edge inside the strip's fade band, so the picture is
// never shown whole. The extra 0.029 is 10px on a 350px ruler (a 390pt phone);
// across the phone range it varies by about a pixel, which is not perceptible.
export const PHONE_FS_PLAYHEAD_FRAC = 0.179;

export function spanOf(d: TimeDomain): number {
  return d.end - d.start;
}

export function centerTime(d: TimeDomain): number {
  return (d.start + d.end) / 2;
}

/** Time (ms) -> pixel x within [0, width]. */
export function timeToX(t: number, d: TimeDomain, width: number): number {
  const span = spanOf(d) || 1;
  return ((t - d.start) / span) * width;
}

/** Pixel x within [0, width] -> time (ms). */
export function xToTime(x: number, d: TimeDomain, width: number): number {
  const span = spanOf(d) || 1;
  return d.start + (x / (width || 1)) * span;
}

/**
 * Pan the domain by a pixel delta. A positive dx (drag to the right) pulls
 * older footage under the fixed center playhead — i.e. moves back in time,
 * matching UniFi Protect's scrub direction.
 */
export function panByPixels(d: TimeDomain, dx: number, width: number): TimeDomain {
  const msPerPixel = spanOf(d) / (width || 1);
  const deltaT = -dx * msPerPixel;
  return { start: d.start + deltaT, end: d.end + deltaT };
}

/** Clamp a span to the allowed zoom range. */
export function clampSpan(span: number): number {
  return Math.min(ZOOM_MAX_SPAN, Math.max(ZOOM_MIN_SPAN, span));
}

/**
 * Zoom by `factor` (>1 zooms in, <1 zooms out) while keeping the time currently
 * under `anchorX` pinned to that same pixel. Used for both pinch (anchor =
 * pinch origin) and wheel (anchor = cursor).
 */
export function zoomAround(
  d: TimeDomain,
  factor: number,
  anchorX: number,
  width: number,
): TimeDomain {
  const anchorTime = xToTime(anchorX, d, width);
  const frac = (width ? anchorX / width : 0.5);
  const newSpan = clampSpan(spanOf(d) / factor);
  const start = anchorTime - frac * newSpan;
  return { start, end: start + newSpan };
}

/**
 * The time under the playhead for the vertical layout. `end` is the newest
 * (top) edge; the playhead sits `frac` down from the top.
 */
export function playheadTimeOf(d: TimeDomain, frac = PLAYHEAD_FRAC): number {
  return d.end - spanOf(d) * frac;
}

// Hard safety bounds for domainForPlayhead — deliberately WIDER than the zoom
// UI's ZOOM_MIN/MAX_SPAN: viewport-height changes (camera strip opening,
// rotation) scale the span proportionally to preserve the px-per-ms scale, and
// that scaled span may legitimately sit outside the discrete zoom range.
export const SPAN_HARD_MIN = MINUTE;
export const SPAN_HARD_MAX = 6 * HOUR;

/** Build a domain of `spanMs` that puts `playheadTime` at the playhead fraction. */
export function domainForPlayhead(
  playheadTime: number,
  spanMs: number,
  frac = PLAYHEAD_FRAC,
): TimeDomain {
  const span = Math.min(SPAN_HARD_MAX, Math.max(SPAN_HARD_MIN, spanMs));
  const end = playheadTime + span * frac;
  return { start: end - span, end };
}

/** Snap to the nearest discrete zoom step, then move `dir` steps (+1 = zoom out). */
export function nextSpanStep(span: number, dir: 1 | -1): number {
  // index of the nearest step to the current span
  let nearest = 0;
  let best = Infinity;
  for (let i = 0; i < SPAN_STEPS.length; i++) {
    const d = Math.abs(SPAN_STEPS[i] - span);
    if (d < best) {
      best = d;
      nearest = i;
    }
  }
  const i = Math.min(SPAN_STEPS.length - 1, Math.max(0, nearest + dir));
  return SPAN_STEPS[i];
}

/** True when the playhead is within `toleranceMs` of `now` (i.e. live). */
export function isAtLiveEdge(d: TimeDomain, now: number, toleranceMs = 5 * SECOND): boolean {
  return Math.abs(playheadTimeOf(d) - now) <= toleranceMs;
}

// "Nice" tick interval selection for axis labels, scaled to the visible span.
const TICK_STEPS = [
  1 * SECOND, 5 * SECOND, 15 * SECOND, 30 * SECOND,
  1 * MINUTE, 2 * MINUTE, 5 * MINUTE, 10 * MINUTE, 15 * MINUTE, 30 * MINUTE,
  1 * HOUR, 2 * HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR,
  1 * DAY, 2 * DAY,
];

/** Pick a tick interval so roughly `targetTicks` labels fit across the span. */
export function chooseTickInterval(spanMs: number, targetTicks = 6): number {
  const ideal = spanMs / targetTicks;
  for (const step of TICK_STEPS) {
    if (step >= ideal) return step;
  }
  return TICK_STEPS[TICK_STEPS.length - 1];
}

/**
 * Epoch-ms tick positions aligned to the interval in LOCAL time (so a 6h tick
 * lands on local 00:00/06:00/12:00/18:00, not UTC), covering the domain.
 */
export function tickTimes(d: TimeDomain, intervalMs: number): number[] {
  const localOffset = -new Date(d.start).getTimezoneOffset() * 60_000;
  const first = Math.ceil((d.start + localOffset) / intervalMs) * intervalMs - localOffset;
  const out: number[] = [];
  for (let t = first; t <= d.end; t += intervalMs) out.push(t);
  return out;
}
