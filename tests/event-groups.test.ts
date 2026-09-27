import { describe, it, expect } from 'vitest';
import { clipSegments, groupBands, nearestMember, segmentIndexAt } from '../src/data/event-groups';
import type { DetectionBand } from '../src/data/types';

const S = 1000;
const GAP = 60 * S; // the card's default merge gap

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

describe('groupBands', () => {
  it('passes through untouched when grouping is disabled (gapMs <= 0)', () => {
    const bands = [band(0, 10), band(20, 30)];
    expect(groupBands(bands, 0)).toBe(bands);
  });

  it('merges events whose gap is within the threshold, splits beyond it', () => {
    // 30s gaps merge (continuous activity), a 90s gap starts a new event —
    // the pattern of the real garden-camera 19:41–20:02 stretch.
    const g = groupBands(
      [band(0, 40), band(70, 100), band(130, 160), band(250, 280)],
      GAP,
    );
    expect(g).toHaveLength(2);
    // Newest first.
    expect(g[0].start).toBe(250 * S);
    expect(g[1].start).toBe(0);
    expect(g[1].end).toBe(160 * S);
    expect(g[1].durMs).toBe(160 * S);
    expect(g[1].members).toHaveLength(3);
  });

  it('absorbs overlapping events (motion + smart detect of the same activity)', () => {
    const g = groupBands([band(0, 60), band(50, 70)], GAP);
    expect(g).toHaveLength(1);
    expect(g[0].end).toBe(70 * S);
  });

  it('extends a group through a member that ends before an earlier one', () => {
    // Second event is contained in the first; a third within gap of the FIRST's
    // end must still merge (group end tracks the max end, not the last end).
    const g = groupBands([band(0, 100), band(10, 20), band(130, 150)], GAP);
    expect(g).toHaveLength(1);
  });

  it('names a mixed group after the highest-priority member and keeps a stable identity', () => {
    const motion = band(0, 30);
    const person = band(20, 50, { label: 'Person', color: '#3ddc84' });
    const g = groupBands([motion, person], GAP);
    expect(g[0].label).toBe('Person');
    expect(g[0].color).toBe('#3ddc84');
    // Identity/type stays the OLDEST member's — new events extend the end,
    // so the key survives manifest refreshes.
    expect(g[0].type).toBe(motion.type);
  });

  it('uses the oldest cached thumbnail as the representative file', () => {
    const g = groupBands(
      [band(0, 10), band(30, 40, { file: '/local/a.jpg' }), band(60, 70, { file: '/local/b.jpg' })],
      GAP,
    );
    expect(g[0].file).toBe('/local/a.jpg');
  });

  it('marks the group ongoing while any member is, and keeps members oldest-first', () => {
    const g = groupBands([band(30, 60, { ongoing: true }), band(0, 20)], GAP);
    expect(g[0].ongoing).toBe(true);
    expect(g[0].members!.map((m) => m.start)).toEqual([0, 30 * S]);
  });

  it('a lone event keeps its raw fields and lists itself as its only member', () => {
    const b = band(0, 10, { file: '/local/x.jpg' });
    const g = groupBands([b], GAP);
    expect(g[0]).toMatchObject({ start: 0, end: 10 * S, file: '/local/x.jpg', durMs: 10 * S });
    expect(g[0].members).toEqual([b]);
  });
});

describe('nearestMember', () => {
  it('picks the member containing the time, else the nearest one', () => {
    const g = groupBands([band(0, 10), band(40, 50)], GAP)[0];
    expect(nearestMember(g, 45 * S).start).toBe(40 * S);
    expect(nearestMember(g, 12 * S).start).toBe(0);
    expect(nearestMember(g, 35 * S).start).toBe(40 * S);
  });

  it('falls back to the band itself when there are no members', () => {
    const b = band(0, 10);
    expect(nearestMember(b, 5 * S)).toBe(b);
  });
});

describe('clipSegments', () => {
  const base = {
    mode: 'continuous' as const,
    maxMs: 120 * S,
    joinMs: 10 * S,
    preMs: 2 * S,
    postMs: 2 * S,
    endCapMs: Number.MAX_SAFE_INTEGER,
  };

  it('plays a short lone event as exactly one padded segment', () => {
    const g = groupBands([band(100, 110)], GAP)[0];
    expect(clipSegments(g, base)).toEqual([{ start: 98 * S, end: 112 * S }]);
  });

  it('continuous: covers the whole span, gaps included, capped and contiguous', () => {
    // The shape that broke: one row, span far longer than any single export.
    const g = groupBands([band(1000, 1030), band(1300, 1330), band(1600, 1630)], GAP * 10)[0];
    const segs = clipSegments(g, base);
    expect(segs.length).toBeGreaterThan(1);
    for (const s of segs) expect(s.end - s.start).toBeLessThanOrEqual(base.maxMs);
    // No holes: each segment starts where the previous ended.
    for (let i = 1; i < segs.length; i++) expect(segs[i].start).toBe(segs[i - 1].end);
    expect(segs[0].start).toBe(998 * S); // band.start - preMs
    expect(segs[segs.length - 1].end).toBe(1632 * S);
  });

  it('continuous: splits EVENLY so a long span has no runt tail segment', () => {
    const g = groupBands([band(0, 250)], GAP)[0];
    const segs = clipSegments(g, base);
    expect(segs).toHaveLength(3); // 254s / 120s -> 3 parts, not 2 + a 14s runt
    const lengths = segs.map((s) => s.end - s.start);
    expect(Math.max(...lengths) - Math.min(...lengths)).toBeLessThanOrEqual(1);
  });

  it('activity: skips the idle stretches between members', () => {
    const g = groupBands([band(1000, 1030), band(1300, 1330)], GAP * 10)[0];
    const segs = clipSegments(g, { ...base, mode: 'activity' });
    expect(segs).toEqual([
      { start: 998 * S, end: 1032 * S },
      { start: 1298 * S, end: 1332 * S },
    ]);
  });

  it('activity: joins members separated by less than joinMs into one export', () => {
    // 8s apart after padding -> one segment; a separate 60s gap stays split.
    const g = groupBands([band(1000, 1030), band(1042, 1060), band(1120, 1150)], GAP)[0];
    const segs = clipSegments(g, { ...base, mode: 'activity' });
    expect(segs).toEqual([
      { start: 998 * S, end: 1062 * S },
      { start: 1118 * S, end: 1152 * S },
    ]);
  });

  it('clamps the tail of an ONGOING group to what the NVR has flushed', () => {
    const g = groupBands([band(0, 300)], GAP)[0];
    const segs = clipSegments(g, { ...base, endCapMs: 200 * S });
    expect(segs[segs.length - 1].end).toBe(200 * S);
  });

  it('returns nothing when the flushed part is too short to play', () => {
    const g = groupBands([band(100, 130)], GAP)[0];
    expect(clipSegments(g, { ...base, endCapMs: 99 * S })).toEqual([]);
  });
});

describe('segmentIndexAt', () => {
  const segs = [
    { start: 0, end: 10 * S },
    { start: 10 * S, end: 20 * S },
    { start: 60 * S, end: 70 * S },
  ];

  it('finds the segment containing the time', () => {
    expect(segmentIndexAt(segs, 15 * S)).toBe(1);
  });

  it('falls to the nearest segment for a time inside a skipped gap', () => {
    expect(segmentIndexAt(segs, 25 * S)).toBe(1);
    expect(segmentIndexAt(segs, 55 * S)).toBe(2);
  });
});
