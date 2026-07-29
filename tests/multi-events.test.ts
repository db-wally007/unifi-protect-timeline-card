import { describe, it, expect } from 'vitest';
import { mergeStrip, relTime, tagBands, type MultiBand } from '../src/data/multi-events';
import type { DetectionBand } from '../src/data/types';

const S = 1000;

let seq = 0;
function band(startS: number, endS: number, over: Partial<DetectionBand> = {}): DetectionBand {
  const id = over.id ?? `e${seq++}`;
  return {
    type: `protect:${id}`,
    label: 'Motion',
    color: '#5c8aff',
    start: startS * S,
    end: endS * S,
    id,
    durMs: (endS - startS) * S,
    ...over,
  };
}

describe('tagBands', () => {
  it('stamps every band with its camera identity without mutating the input', () => {
    const raw = [band(0, 10), band(20, 30)];
    const tagged = tagBands(raw, 'camera.garden', 'Garden');
    expect(tagged).toHaveLength(2);
    for (const t of tagged) {
      expect(t.camera).toBe('camera.garden');
      expect(t.cameraName).toBe('Garden');
    }
    expect((raw[0] as Partial<MultiBand>).camera).toBeUndefined();
  });
});

describe('mergeStrip', () => {
  it('interleaves per-camera lists newest-first', () => {
    const garden = tagBands([band(100, 110), band(0, 10)], 'camera.garden', 'Garden');
    const garage = tagBands([band(200, 210), band(50, 60)], 'camera.garage', 'Garage');
    const merged = mergeStrip([garden, garage]);
    expect(merged.map((b) => b.start / S)).toEqual([200, 100, 50, 0]);
    expect(merged.map((b) => b.cameraName)).toEqual(['Garage', 'Garden', 'Garage', 'Garden']);
  });

  it('handles empty camera lists (manifest not loaded yet)', () => {
    const garden = tagBands([band(0, 10)], 'camera.garden', 'Garden');
    expect(mergeStrip([[], garden, []])).toHaveLength(1);
  });
});

describe('relTime', () => {
  const NOW = 1_000_000_000_000;
  it('buckets seconds/minutes/hours/days like the UniFi app', () => {
    expect(relTime(NOW - 30 * S, NOW)).toBe('just now');
    expect(relTime(NOW - 60 * S, NOW)).toBe('1 minute ago');
    expect(relTime(NOW - 5 * 60 * S, NOW)).toBe('5 minutes ago');
    expect(relTime(NOW - 60 * 60 * S, NOW)).toBe('1 hour ago');
    expect(relTime(NOW - 2 * 60 * 60 * S, NOW)).toBe('2 hours ago');
    expect(relTime(NOW - 24 * 60 * 60 * S, NOW)).toBe('1 day ago');
    expect(relTime(NOW - 3 * 24 * 60 * 60 * S, NOW)).toBe('3 days ago');
  });

  it('clamps future timestamps (clock skew) to "just now"', () => {
    expect(relTime(NOW + 10 * S, NOW)).toBe('just now');
  });
});
