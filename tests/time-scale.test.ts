import { describe, it, expect } from 'vitest';
import {
  HOUR,
  MINUTE,
  ZOOM_MAX_SPAN,
  ZOOM_MIN_SPAN,
  centerTime,
  chooseTickInterval,
  clampSpan,
  isAtLiveEdge,
  panByPixels,
  spanOf,
  tickTimes,
  timeToX,
  xToTime,
  domainForPlayhead,
  playheadTimeOf,
  nextSpanStep,
  PLAYHEAD_FRAC,
  SPAN_STEPS,
  zoomAround,
} from '../src/data/time-scale';
import type { TimeDomain } from '../src/data/types';

const WIDTH = 1000;
const base: TimeDomain = { start: 0, end: HOUR }; // 1h across 1000px

describe('timeToX / xToTime', () => {
  it('maps endpoints and midpoint', () => {
    expect(timeToX(0, base, WIDTH)).toBe(0);
    expect(timeToX(HOUR, base, WIDTH)).toBe(WIDTH);
    expect(timeToX(HOUR / 2, base, WIDTH)).toBe(WIDTH / 2);
  });
  it('round-trips', () => {
    for (const x of [0, 137, 500, 999, 1000]) {
      expect(xToTime(timeToX(xToTime(x, base, WIDTH), base, WIDTH), base, WIDTH)).toBeCloseTo(
        xToTime(x, base, WIDTH),
        6,
      );
    }
  });
});

describe('panByPixels', () => {
  it('drag right moves back in time (UniFi direction)', () => {
    const c0 = centerTime(base);
    const panned = panByPixels(base, 100, WIDTH); // dragged 100px right
    expect(centerTime(panned)).toBeLessThan(c0);
    // 100px of a 1h/1000px scale = 6 minutes back
    expect(c0 - centerTime(panned)).toBeCloseTo(6 * MINUTE, 6);
  });
  it('drag left moves forward in time', () => {
    expect(centerTime(panByPixels(base, -100, WIDTH))).toBeGreaterThan(centerTime(base));
  });
  it('preserves span', () => {
    expect(spanOf(panByPixels(base, 250, WIDTH))).toBeCloseTo(spanOf(base), 6);
  });
});

describe('zoomAround', () => {
  it('keeps the anchored time pinned to its pixel', () => {
    const anchorX = 300;
    const anchorTime = xToTime(anchorX, base, WIDTH);
    const zoomed = zoomAround(base, 2, anchorX, WIDTH); // zoom in 2x
    expect(spanOf(zoomed)).toBeCloseTo(spanOf(base) / 2, 6);
    expect(xToTime(anchorX, zoomed, WIDTH)).toBeCloseTo(anchorTime, 6);
  });
  it('clamps zoom-in to ZOOM_MIN_SPAN', () => {
    const tiny = zoomAround({ start: 0, end: ZOOM_MIN_SPAN }, 100, WIDTH / 2, WIDTH);
    expect(spanOf(tiny)).toBeCloseTo(ZOOM_MIN_SPAN, 6);
  });
  it('clamps zoom-out to ZOOM_MAX_SPAN', () => {
    const huge = zoomAround({ start: 0, end: ZOOM_MAX_SPAN }, 0.01, WIDTH / 2, WIDTH);
    expect(spanOf(huge)).toBeCloseTo(ZOOM_MAX_SPAN, 6);
  });
});

describe('clampSpan / withSpan', () => {
  it('clamps to bounds', () => {
    expect(clampSpan(1)).toBe(ZOOM_MIN_SPAN);
    expect(clampSpan(ZOOM_MAX_SPAN * 10)).toBe(ZOOM_MAX_SPAN);
    expect(clampSpan(HOUR)).toBe(HOUR);
  });
  it('domainForPlayhead puts the playhead at the configured fraction', () => {
    const t = 1000 * HOUR;
    const d = domainForPlayhead(t, 30 * MINUTE);
    expect(spanOf(d)).toBe(30 * MINUTE);
    expect(playheadTimeOf(d)).toBeCloseTo(t, 6);
    // playhead is PLAYHEAD_FRAC down from the top (end)
    expect(d.end - t).toBeCloseTo(30 * MINUTE * PLAYHEAD_FRAC, 6);
  });
});

describe('ticks', () => {
  it('chooses a coarser interval for wider spans', () => {
    const narrow = chooseTickInterval(2 * MINUTE);
    const wide = chooseTickInterval(24 * HOUR);
    expect(wide).toBeGreaterThan(narrow);
  });
  it('tick times are aligned to the interval and within domain', () => {
    const d: TimeDomain = { start: 90_000, end: 90_000 + 10 * MINUTE };
    const ticks = tickTimes(d, 5 * MINUTE);
    expect(ticks.length).toBeGreaterThan(0);
    for (const t of ticks) {
      expect(t % (5 * MINUTE)).toBe(0);
      expect(t).toBeGreaterThanOrEqual(d.start);
      expect(t).toBeLessThanOrEqual(d.end);
    }
  });
});

describe('isAtLiveEdge', () => {
  it('true when the playhead ~ now', () => {
    const now = 10 * HOUR;
    expect(isAtLiveEdge(domainForPlayhead(now, 30 * MINUTE), now)).toBe(true);
    expect(isAtLiveEdge(domainForPlayhead(now - 30 * MINUTE, 30 * MINUTE), now)).toBe(false);
  });
});

describe('nextSpanStep', () => {
  it('steps out (larger) and in (smaller), clamped to the step list', () => {
    expect(nextSpanStep(SPAN_STEPS[5], 1)).toBe(SPAN_STEPS[6]); // out
    expect(nextSpanStep(SPAN_STEPS[5], -1)).toBe(SPAN_STEPS[4]); // in
    expect(nextSpanStep(SPAN_STEPS[SPAN_STEPS.length - 1], 1)).toBe(
      SPAN_STEPS[SPAN_STEPS.length - 1],
    ); // clamp out
    expect(nextSpanStep(SPAN_STEPS[0], -1)).toBe(SPAN_STEPS[0]); // clamp in
  });
  it('has ~30 steps spanning the full zoom range', () => {
    expect(SPAN_STEPS.length).toBe(30);
    expect(SPAN_STEPS[0]).toBe(ZOOM_MIN_SPAN);
    expect(SPAN_STEPS[SPAN_STEPS.length - 1]).toBe(ZOOM_MAX_SPAN);
  });
  it('snaps a between-steps span to the nearest step first', () => {
    const justAboveStep3 = SPAN_STEPS[3] + (SPAN_STEPS[4] - SPAN_STEPS[3]) * 0.2;
    expect(nextSpanStep(justAboveStep3, 0 as 1)).toBe(SPAN_STEPS[3]);
  });
});
