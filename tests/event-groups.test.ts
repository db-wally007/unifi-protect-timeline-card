import { describe, it, expect } from 'vitest';
import { groupBands, nearestMember } from '../src/data/event-groups';
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
