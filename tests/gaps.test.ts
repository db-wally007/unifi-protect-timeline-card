import { describe, it, expect } from 'vitest';
import { unavailableIntervals, inGap } from '../src/data/gaps';
import type { RawHistoryState } from '../src/data/types';

const S = 1000;

describe('unavailableIntervals', () => {
  it('extracts an unavailable span between two recording states', () => {
    const rows: RawHistoryState[] = [
      { s: 'recording', lu: 0 },
      { s: 'unavailable', lu: 100 },
      { s: 'recording', lu: 160 },
    ];
    expect(unavailableIntervals(rows, 0, 1_000_000)).toEqual([{ start: 100_000, end: 160_000 }]);
  });

  it('matches the real garden-camera outage (07:59:11 → 08:00:31 local)', () => {
    // The exact history rows observed during the console outage (UTC epochs).
    const start = Date.parse('2026-07-04T05:50:00Z');
    const until = Date.parse('2026-07-04T06:20:00Z');
    const at = (iso: string) => Date.parse(iso) / 1000; // lu is epoch SECONDS
    const rows: RawHistoryState[] = [
      { s: 'recording', lu: at('2026-07-04T05:50:00Z') },
      { s: 'unavailable', lu: at('2026-07-04T05:59:11.258Z') },
      { s: 'recording', lu: at('2026-07-04T06:00:31.872Z') },
      { s: 'unavailable', lu: at('2026-07-04T06:11:11.036Z') },
      { s: 'recording', lu: at('2026-07-04T06:11:15.368Z') },
      { s: 'unavailable', lu: at('2026-07-04T06:15:06.334Z') },
      { s: 'recording', lu: at('2026-07-04T06:15:08.219Z') },
    ];
    const gaps = unavailableIntervals(rows, start, until);
    // The main ~80s outage + the two short (4s, 2s) flaps — all above MIN_GAP_MS.
    expect(gaps).toEqual([
      { start: Date.parse('2026-07-04T05:59:11.258Z'), end: Date.parse('2026-07-04T06:00:31.872Z') },
      { start: Date.parse('2026-07-04T06:11:11.036Z'), end: Date.parse('2026-07-04T06:11:15.368Z') },
      { start: Date.parse('2026-07-04T06:15:06.334Z'), end: Date.parse('2026-07-04T06:15:08.219Z') },
    ]);
  });

  it('drops sub-threshold blips (< 1.5s)', () => {
    const rows: RawHistoryState[] = [
      { s: 'recording', lu: 0 },
      { s: 'unavailable', lu: 10 },
      { s: 'recording', lu: 11 }, // 1s blip — dropped
    ];
    expect(unavailableIntervals(rows, 0, 1_000_000)).toEqual([]);
  });

  it('clamps an interval already open at the window start to `since`', () => {
    const rows: RawHistoryState[] = [
      { s: 'unavailable', lu: 5 }, // before `since`
      { s: 'recording', lu: 40 },
    ];
    expect(unavailableIntervals(rows, 10_000, 1_000_000)).toEqual([{ start: 10_000, end: 40_000 }]);
  });

  it('closes an interval still open at the end at `until`', () => {
    const rows: RawHistoryState[] = [
      { s: 'recording', lu: 0 },
      { s: 'unavailable', lu: 10 },
    ];
    expect(unavailableIntervals(rows, 0, 100_000)).toEqual([{ start: 10_000, end: 100_000 }]);
  });

  it('treats "unknown" as offline too', () => {
    const rows: RawHistoryState[] = [
      { s: 'recording', lu: 0 },
      { s: 'unknown', lu: 10 },
      { s: 'recording', lu: 20 },
    ];
    expect(unavailableIntervals(rows, 0, 1_000_000)).toEqual([{ start: 10_000, end: 20_000 }]);
  });
});

describe('inGap', () => {
  const gaps = [
    { start: 100 * S, end: 200 * S },
    { start: 500 * S, end: 600 * S },
  ];
  it('is true inside a gap (inclusive bounds)', () => {
    expect(inGap(gaps, 150 * S)).toBe(true);
    expect(inGap(gaps, 100 * S)).toBe(true);
    expect(inGap(gaps, 600 * S)).toBe(true);
  });
  it('is false outside every gap', () => {
    expect(inGap(gaps, 50 * S)).toBe(false);
    expect(inGap(gaps, 300 * S)).toBe(false);
    expect(inGap([], 150 * S)).toBe(false);
  });
});
