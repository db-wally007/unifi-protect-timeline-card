import { describe, it, expect } from 'vitest';
import { buildFootageSpans, segmentEndFor } from '../src/data/footage-map';

// Real numbers from the 2026-07-10 garden watering session (pre=2s, post=5s):
// the tier switch 21:46:31 -> 21:47:48 is the user-reported playback jump.
const T = (hms: string): number => {
  const [h, m, s] = hms.split(':').map(Number);
  return Date.UTC(2026, 6, 10, h, m, s);
};
const EVENTS = [
  { start: T('19:44:38'), end: T('19:46:01') },
  { start: T('19:46:06'), end: T('19:46:26') },
  { start: T('19:47:50'), end: T('19:48:14') },
];
const SPANS = buildFootageSpans(EVENTS, 2000, 5000);

describe('buildFootageSpans', () => {
  it('pads, merges overlaps, sorts', () => {
    // 19:44:36–19:46:06 and 19:46:04–19:46:31 overlap -> one span
    expect(SPANS).toEqual([
      { start: T('19:44:36'), end: T('19:46:31') },
      { start: T('19:47:48'), end: T('19:48:19') },
    ]);
  });

  it('empty input -> no spans', () => {
    expect(buildFootageSpans([], 2000, 5000)).toEqual([]);
  });
});

describe('segmentEndFor', () => {
  const WINDOW = 300_000; // 5-min playback chunk

  it('no span data -> the full window (old footage / no manifest)', () => {
    expect(segmentEndFor(T('19:46:28'), T('19:46:28') + WINDOW, [])).toBe(
      T('19:46:28') + WINDOW,
    );
  });

  it('inside an event span: cut at the span end (stay on the 4K tier)', () => {
    expect(segmentEndFor(T('19:45:00'), T('19:45:00') + WINDOW, SPANS)).toBe(T('19:46:31'));
  });

  it('inside an idle stretch: cut at the next span start (stay on the low tier)', () => {
    expect(segmentEndFor(T('19:47:00'), T('19:47:00') + WINDOW, SPANS)).toBe(T('19:47:48'));
  });

  it('the user-reported case: playing from 19:46:28 cuts at 19:46:31? no — sliver skipped, cut at next boundary', () => {
    // 19:46:31 is only 3s away (< MIN_SEGMENT_MS is 3000, so exactly 3s counts);
    // boundary at +3000 is allowed -> cut at 19:46:31.
    expect(segmentEndFor(T('19:46:28'), T('19:46:28') + WINDOW, SPANS)).toBe(T('19:46:31'));
    // one second later the 19:46:31 boundary is a sliver -> next boundary 19:47:48
    expect(segmentEndFor(T('19:46:29'), T('19:46:29') + WINDOW, SPANS)).toBe(T('19:47:48'));
  });

  it('chained segment starting exactly at a boundary: runs to the next one', () => {
    expect(segmentEndFor(T('19:46:31'), T('19:46:31') + WINDOW, SPANS)).toBe(T('19:47:48'));
    expect(segmentEndFor(T('19:47:48'), T('19:47:48') + WINDOW, SPANS)).toBe(T('19:48:19'));
  });

  it('boundary beyond the window: plain window end', () => {
    expect(segmentEndFor(T('19:45:00'), T('19:45:30'), SPANS)).toBe(T('19:45:30'));
  });

  it('long quiet stretch after the last span: full window', () => {
    expect(segmentEndFor(T('20:30:00'), T('20:30:00') + WINDOW, SPANS)).toBe(
      T('20:30:00') + WINDOW,
    );
  });
});
