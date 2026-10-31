import { describe, it, expect, afterEach, vi } from 'vitest';
import { scrubIndexGaps, fetchFootageGaps, inGap, footageStart, nearestFootage } from '../src/data/gaps';

const S = 1000;

describe('scrubIndexGaps', () => {
  it('reads the [start, end] spans the scrub job publishes, sorted', () => {
    expect(
      scrubIndexGaps({
        gaps: [
          [500 * S, 600 * S],
          [100 * S, 200 * S],
        ],
      }),
    ).toEqual([
      { start: 100 * S, end: 200 * S },
      { start: 500 * S, end: 600 * S },
    ]);
  });

  it('the 2026-10-20 console hang: Corner had no footage 22:43:11 → 22:49:46', () => {
    const start = Date.parse('2026-10-20T22:43:11+02:00');
    const end = Date.parse('2026-10-20T22:49:46+02:00');
    const gaps = scrubIndexGaps({ gaps: [[start, end]] });
    expect(inGap(gaps, Date.parse('2026-10-20T22:45:00+02:00'))).toBe(true);
    expect(inGap(gaps, Date.parse('2026-10-20T22:48:30+02:00'))).toBe(true);
    expect(inGap(gaps, Date.parse('2026-10-20T22:43:05+02:00'))).toBe(false);
    expect(inGap(gaps, Date.parse('2026-10-20T22:49:50+02:00'))).toBe(false);
  });

  it('yields nothing for an index from an older job (no `gaps`) or no index', () => {
    expect(scrubIndexGaps({})).toEqual([]);
    expect(scrubIndexGaps(undefined)).toEqual([]);
  });

  it('drops malformed entries', () => {
    expect(
      scrubIndexGaps({ gaps: [[1, 2, 3], ['a', 5], [9, 4], null, [10 * S, 20 * S]] }),
    ).toEqual([{ start: 10 * S, end: 20 * S }]);
  });

  it('everything before the NVR\'s oldest footage is a gap from 0', () => {
    const gaps = scrubIndexGaps({ recording_start: 300 * S, gaps: [[500 * S, 600 * S]] });
    expect(gaps).toEqual([
      { start: 0, end: 300 * S },
      { start: 500 * S, end: 600 * S },
    ]);
    expect(footageStart(gaps)).toBe(300 * S);
    expect(footageStart(scrubIndexGaps({ gaps: [[500 * S, 600 * S]] }))).toBeUndefined();
    expect(footageStart(scrubIndexGaps({ recording_start: null, gaps: [] }))).toBeUndefined();
  });
});

describe('nearestFootage', () => {
  // The doorbell, 2026-10: footage on Oct 3 afternoon, then none until it was
  // mounted on Oct 20 at 19:50.
  const at = (s: string) => Date.parse(`2026-10-${s}+02:00`);
  const gaps = scrubIndexGaps({
    recording_start: at('03T16:08:00'),
    gaps: [[at('03T18:00:00'), at('20T19:50:00')]],
  });
  const day = (d: string) => [at(`${d}T00:00:00`), at(`${d}T00:00:00`) + 86_400_000] as const;

  it('is the moment itself where there is footage', () => {
    expect(nearestFootage(gaps, ...day('21'), at('21T12:00:00'))).toBe(at('21T12:00:00'));
  });
  it('is where footage resumes when the moment is in a gap', () => {
    expect(nearestFootage(gaps, ...day('20'), at('20T12:00:00'))).toBe(at('20T19:50:00'));
  });
  it('else the last minute before the moment', () => {
    // Oct 3: footage 16:08-18:00 only - a noon jump lands on its start.
    expect(nearestFootage(gaps, ...day('03'), at('03T12:00:00'))).toBe(at('03T16:08:00'));
    expect(nearestFootage(gaps, ...day('03'), at('03T20:00:00'))).toBe(at('03T17:59:00'));
  });
  it('is undefined for a day without footage', () => {
    expect(nearestFootage(gaps, ...day('10'), at('10T12:00:00'))).toBeUndefined();
    expect(nearestFootage(gaps, ...day('02'), at('02T12:00:00'))).toBeUndefined();
  });
});

describe('fetchFootageGaps', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads <scrubDir>/index.json and never asks the NVR anything', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      urls.push(url);
      return new Response(JSON.stringify({ generated: Date.now(), gaps: [[100 * S, 200 * S]] }));
    });
    const gaps = await fetchFootageGaps('/protect_scrub/garden_camera_high_resolution_channel');
    expect(gaps).toEqual([{ start: 100 * S, end: 200 * S }]);
    expect(urls).toEqual(['/protect_scrub/garden_camera_high_resolution_channel/index.json']);
  });

  it('is empty (no band) when there is no scrub cache or it cannot be read', async () => {
    vi.stubGlobal('fetch', async () => new Response('', { status: 404 }));
    expect(await fetchFootageGaps('/protect_scrub/x')).toEqual([]);
    expect(await fetchFootageGaps('')).toEqual([]);
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
