// UniFi-style display consolidation of the raw NVR event list (pure, unit-tested).
//
// The Protect app does NOT show raw events: continuous activity (a person in the
// garden) produces dozens of back-to-back motion events with 5–30s gaps, and the
// app merges everything whose gap is under about a minute into ONE display event
// — one continuous timeline bar, one events-list row — while keeping each raw
// event's thumbnail available along the merged span. This module reproduces
// that: the manifest stays a 1:1 raw mirror (the event DB), and grouping is a
// presentation step in the card.

import type { DetectionBand } from './types';

// Smart-detect labels outrank plain motion when naming a merged group (matches
// the pyscript KIND_PRIORITY). Unknown labels rank with motion (last).
const LABEL_RANK = ['person', 'vehicle', 'animal', 'package', 'license plate'];

function rank(b: DetectionBand): number {
  const i = LABEL_RANK.indexOf(b.label.toLowerCase());
  return i === -1 ? LABEL_RANK.length : i;
}

/** Merge raw event bands into display groups: events whose gap to the group so
 *  far is <= gapMs (or that overlap it) join the group. gapMs <= 0 disables
 *  grouping (raw 1:1 passthrough). Returns groups newest-first; each group's
 *  `members` are the raw bands oldest-first. */
export function groupBands(bands: DetectionBand[], gapMs: number): DetectionBand[] {
  if (gapMs <= 0 || bands.length === 0) return bands;
  const sorted = [...bands].sort((a, b) => a.start - b.start);
  const groups: DetectionBand[][] = [];
  let cur: DetectionBand[] = [sorted[0]];
  let curEnd = sorted[0].end;
  for (let i = 1; i < sorted.length; i++) {
    const b = sorted[i];
    if (b.start - curEnd <= gapMs) {
      cur.push(b);
      curEnd = Math.max(curEnd, b.end);
    } else {
      groups.push(cur);
      cur = [b];
      curEnd = b.end;
    }
  }
  groups.push(cur);
  return groups.map(toGroup).sort((a, b) => b.start - a.start); // newest first
}

/** One display band spanning all members. Label/color come from the highest-
 *  ranked member (Person beats Motion — how the app names mixed groups); the
 *  representative thumbnail is the oldest member that has a cached file (the
 *  app's event card shows a frame from the start of the activity); `type`
 *  (stable identity across refetches) is the oldest member's — new events
 *  extend a group at its END, so the oldest member never changes. */
function toGroup(members: DetectionBand[]): DetectionBand {
  const first = members[0];
  if (members.length === 1) return { ...first, members };
  const end = members.reduce((m, b) => Math.max(m, b.end), first.end);
  const rep = members.reduce((best, b) => (rank(b) < rank(best) ? b : best), first);
  const withFile = members.find((m) => m.file);
  const ongoing = members.some((m) => m.ongoing);
  return {
    type: first.type,
    label: rep.label,
    color: rep.color,
    start: first.start,
    end,
    id: first.id,
    file: withFile?.file,
    durMs: end - first.start,
    ongoing: ongoing || undefined,
    members,
  };
}

/** The member a time falls in, else the member nearest to it — which thumbnail
 *  the playhead / a track hover should enlarge inside a merged group. */
export function nearestMember(group: DetectionBand, t: number): DetectionBand {
  const ms = group.members ?? [group];
  let best = ms[0];
  let bestDist = Infinity;
  for (const m of ms) {
    const d = t < m.start ? m.start - t : t > m.end ? t - m.end : 0;
    if (d < bestDist) {
      bestDist = d;
      best = m;
    }
  }
  return best;
}
