// UniFi-style display consolidation of the raw NVR event list (pure, unit-tested).
//
// The Protect app does NOT show raw events: continuous activity (a person in the
// garden) produces dozens of back-to-back motion events with 5–30s gaps, and the
// app merges everything whose gap is under about a minute into ONE display event
// — one continuous timeline bar, one events-list row — while keeping each raw
// event's thumbnail available along the merged span. This module reproduces
// that: the manifest stays a 1:1 raw mirror (the event DB), and grouping is a
// presentation step in the card.

import { buildFootageSpans, type FootageSpan } from './footage-map';
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

// A merged group is a DISPLAY span, not a clip. The 2026-09-19 garden group was
// 43 raw events across 37m56s; asking the NVR for that as one export measured
// 34.9s and 1.29 GB on disk (plus the same again through the faststart remux),
// and every retap during that wait started another one. So a group is PLAYED as
// a playlist of short segments, each its own small clip session: measured 0.60s
// to prepare a 14s segment, 4.14s for a 120s one.
//
// `continuous` splits the whole span (idle included) so the seek bar stays 1:1
// with the clock; `activity` plays only the members' padded spans. Both cameras
// modes matter less than they look: every camera here records `always`, so idle
// footage costs the same ~50 MB/min as event footage — skipping it saves 21% on
// the worst group and 7% on a typical one.

export type MergedPlaybackMode = 'continuous' | 'activity';

export interface ClipSegmentOptions {
  mode: MergedPlaybackMode;
  /** Hard cap on one segment's length (ms) — the unit of one clip session. */
  maxMs: number;
  /** `activity`: neighbouring spans closer than this are played as one segment
   *  instead of paying a separate export for a few idle seconds. */
  joinMs: number;
  /** Camera recording padding, as the manifest reports it. */
  preMs: number;
  postMs: number;
  /** Latest instant the NVR can be asked for (now - availability lag): the tail
   *  of an ONGOING group is not flushed yet and exports short or not at all. */
  endCapMs: number;
}

// media-view refuses anything shorter than 1.5s, and a sub-second tail is not
// worth an export — fold it into its neighbour by splitting spans EVENLY.
const MIN_SEGMENT_MS = 1500;

/** Split one span into as few equal parts as the cap allows (even parts avoid a
 *  2-second tail segment after a 120s one). */
function splitSpan(span: FootageSpan, maxMs: number): FootageSpan[] {
  const len = span.end - span.start;
  if (len <= maxMs) return [span];
  const parts = Math.ceil(len / maxMs);
  const step = len / parts;
  return Array.from({ length: parts }, (_, i) => ({
    start: Math.round(span.start + i * step),
    end: Math.round(span.start + (i + 1) * step),
  }));
}

/** The ordered clip segments a merged group is played as. One segment = one
 *  clip session. Empty when nothing of the group is playable yet (an event that
 *  started seconds ago, still inside the NVR's un-flushed window). */
export function clipSegments(band: DetectionBand, opts: ClipSegmentOptions): FootageSpan[] {
  const cap = Math.max(MIN_SEGMENT_MS, opts.maxMs);
  const outerStart = Math.max(0, band.start - opts.preMs);
  const outerEnd = Math.min(band.end + opts.postMs, opts.endCapMs);
  if (outerEnd - outerStart < MIN_SEGMENT_MS) return [];

  let spans: FootageSpan[];
  if (opts.mode === 'activity' && band.members && band.members.length > 1) {
    // buildFootageSpans pads each member and merges the overlaps; joining then
    // closes the short idle gaps the padding did not already bridge.
    const padded = buildFootageSpans(band.members, opts.preMs, opts.postMs);
    spans = [];
    for (const s of padded) {
      const last = spans[spans.length - 1];
      if (last && s.start - last.end <= opts.joinMs) last.end = Math.max(last.end, s.end);
      else spans.push({ ...s });
    }
  } else {
    spans = [{ start: outerStart, end: outerEnd }];
  }

  return spans
    .map((s) => ({ start: Math.max(s.start, outerStart), end: Math.min(s.end, outerEnd) }))
    .filter((s) => s.end - s.start >= MIN_SEGMENT_MS)
    .flatMap((s) => splitSpan(s, cap));
}

/** Index of the segment covering `t`, else the nearest one — the seek bar maps
 *  a drag anywhere on the group back to a segment this way. */
export function segmentIndexAt(segments: readonly FootageSpan[], t: number): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    if (t >= s.start && t < s.end) return i;
    const d = t < s.start ? s.start - t : t - s.end;
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
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
