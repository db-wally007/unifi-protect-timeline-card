// Footage-availability gaps for the timeline.
//
// UniFi's own timeline greys out spans where the camera had no recording
// ("Lost wired connection", NVR reboot, ...). The card talks only to Home
// Assistant, so it finds those spans in TWO STAGES:
//
//   1. SUSPECT — the camera entity's `unavailable` intervals from the recorder.
//      One cheap history round-trip, continuous coverage, no NVR load. This is
//      a suspicion, not a verdict (see the caveat below).
//   2. CONFIRM — ask the NVR for a still frame inside each suspected interval
//      (verifyGaps). One frame proves the camera was recording, so the
//      suspicion is dropped. Only intervals the NVR cannot produce a frame for
//      are shown as gaps.
//
// Stage 1 alone used to BE the answer, and that was wrong:
//
// Caveat — BIGGER THAN IT FIRST LOOKED. A Home Assistant restart flips the
// entity to `unavailable` even though the NVR kept recording, and so does any
// wobble in the integration's link to the NVR. Measured here 2026-07-29: two
// cameras went `unavailable` at 10:19:17.98 and came back at 10:34:09.030 and
// .044 — fourteen MILLISECONDS apart. Cameras do not fail and recover in
// lockstep; that was the integration losing the NVR, and the footage for those
// 15 minutes exists and plays fine.
//
// So these intervals are a HINT, not a fact: "Home Assistant could not see the
// camera" is a different statement from "the NVR recorded nothing". They are
// therefore DISPLAY-ONLY (the grey band + the wording of the no-footage
// message) and must never gate a load — the NVR is the only authority on what
// it holds, and media-view always asks it. Correlating cameras to spot
// integration-wide blips was considered and rejected: an NVR reboot ALSO takes
// every camera down at once, and that one really does lose footage, so the
// correlation cannot tell the two apart.
//
// The whole feature stays gated by show_footage_gaps.

import type { FootageGap, HomeAssistant, RawHistoryState } from './types';
import { authFetch, buildSnapshotUrl } from './ha-urls';

// Ignore `unavailable` blips shorter than this (sub-second recorder flaps) — not
// meaningful footage gaps, and they'd draw as zero-width slivers.
const MIN_GAP_MS = 1_500;

/** Normalize a raw history row (verbose or compressed) to { state, ts(ms) }. */
export function normalizeState(row: RawHistoryState): { state: string; ts: number } | null {
  const state = (row.s ?? row.state ?? '').toString();
  let ts: number | undefined;
  if (typeof row.lu === 'number') ts = row.lu * 1000;
  else if (typeof row.lc === 'number') ts = row.lc * 1000;
  else if (row.last_updated) ts = Date.parse(row.last_updated);
  else if (row.last_changed) ts = Date.parse(row.last_changed);
  if (ts === undefined || Number.isNaN(ts) || !state) return null;
  return { state, ts };
}

// States that mean "no footage": the camera isn't reporting to the NVR.
const OFFLINE = new Set(['unavailable', 'unknown']);

/**
 * Turn a camera entity's history rows into [start, end] `unavailable` intervals,
 * clamped to [since, until]. An interval still open at the end of the window is
 * closed at `until`. Blips shorter than minGapMs are dropped.
 */
export function unavailableIntervals(
  rows: RawHistoryState[],
  since: number,
  until: number,
  minGapMs = MIN_GAP_MS,
): FootageGap[] {
  const points = rows
    .map(normalizeState)
    .filter((p): p is { state: string; ts: number } => p !== null)
    .sort((a, b) => a.ts - b.ts);

  const out: FootageGap[] = [];
  let openStart: number | null = null;
  for (const p of points) {
    if (OFFLINE.has(p.state)) {
      if (openStart === null) openStart = Math.max(p.ts, since);
    } else if (openStart !== null) {
      const end = Math.min(p.ts, until);
      if (end - openStart >= minGapMs) out.push({ start: openStart, end });
      openStart = null;
    }
  }
  if (openStart !== null && until - openStart >= minGapMs) {
    out.push({ start: openStart, end: until });
  }
  return out;
}

// ---- stage 2: ask the NVR whether the footage is really missing ------------
//
// Where in a suspected gap to sample. Middle first: one frame anywhere in the
// window already proves the camera was recording, and the middle is the least
// likely to sit on a ragged edge. The other two only run if the middle came
// back empty.
const PROBE_FRACTIONS = [0.5, 0.15, 0.85];

// Verdicts are cached per camera+interval: the card re-fetches gaps whenever
// the visible window moves, and the intervals are stable (recorder timestamps),
// so without this the same blip would be re-probed all day.
const verdicts = new Map<string, boolean>();
const MAX_VERDICTS = 500;

/** True = the NVR returned a frame at `t` (so it HAS footage there).
 *  null = we could not tell (network/auth failure), which is not a denial. */
async function nvrHasFrame(
  hass: HomeAssistant,
  nvrId: string,
  cameraId: string,
  t: number,
): Promise<boolean | null> {
  const ac = new AbortController();
  try {
    const res = await authFetch(hass, buildSnapshotUrl(nvrId, cameraId, t), {
      signal: ac.signal,
    });
    const ok = res.status === 200;
    // The status is the whole answer. Measured: a hit is a 1.2 MB 4K JPEG (the
    // endpoint ignores ?width=), so never pull the body — aborting here leaves
    // the transfer at 0 bytes, which matters on a phone.
    ac.abort();
    return ok;
  } catch {
    return null;
  }
}

/**
 * Second opinion on stage-1 suspicions. A camera entity going `unavailable`
 * means Home Assistant lost sight of the camera, which is NOT the same as the
 * NVR losing the recording — see the header. So before a suspected gap is shown
 * as one, ask the NVR for a still frame inside it; if it produces one, the
 * footage exists and the suspicion is dropped.
 *
 * Cost is self-limiting and falls the wrong way round in our favour: a REAL gap
 * 404s in ~20ms per probe, while a false one is dismissed by the first probe
 * that returns a frame (~900ms, the NVR generating it) and never runs the rest.
 *
 * Anything we cannot positively disprove is KEPT — an unverifiable suspicion
 * still gets its grey band, because the band is a hint and silence is not
 * evidence of footage.
 */
export async function verifyGaps(
  hass: HomeAssistant,
  nvrId: string,
  cameraId: string,
  gaps: FootageGap[],
  maxProbes = 24,
): Promise<FootageGap[]> {
  if (!nvrId || !cameraId || !gaps.length) return gaps;
  const out: FootageGap[] = [];
  let budget = maxProbes;
  for (const g of gaps) {
    const key = `${cameraId}|${g.start}|${g.end}`;
    const cached = verdicts.get(key);
    if (cached !== undefined) {
      if (cached) out.push(g); // cached verdict: a real gap
      continue;
    }
    let hasFootage = false;
    for (const f of PROBE_FRACTIONS) {
      if (budget <= 0) break;
      budget--;
      const hit = await nvrHasFrame(hass, nvrId, cameraId, g.start + (g.end - g.start) * f);
      if (hit === null) continue; // inconclusive — try the next point
      if (hit) {
        hasFootage = true;
        break;
      }
    }
    if (!hasFootage) out.push(g);
    // Only remember decided verdicts: a probe run cut short by the budget, or
    // one that only ever errored, must be re-tried later rather than frozen in.
    if (hasFootage || budget > 0) {
      if (verdicts.size >= MAX_VERDICTS) verdicts.clear();
      verdicts.set(key, !hasFootage);
    }
  }
  return out;
}

/**
 * Fetch the camera entity's `unavailable` intervals over [since, until] as
 * SUSPECTED footage gaps, then confirm each one against the NVR (see
 * verifyGaps) so a Home Assistant blip doesn't grey out footage that exists.
 * Stage 1 is one cheap history WS round-trip; stage 2 only probes suspicions.
 */
export async function fetchFootageGaps(
  hass: HomeAssistant,
  cameraEntityId: string,
  since: number,
  until: number,
  nvrId = '',
): Promise<FootageGap[]> {
  if (!cameraEntityId) return [];
  let resp: Record<string, RawHistoryState[]>;
  try {
    resp = await hass.callWS<Record<string, RawHistoryState[]>>({
      type: 'history/history_during_period',
      start_time: new Date(since).toISOString(),
      end_time: new Date(until).toISOString(),
      entity_ids: [cameraEntityId],
      minimal_response: true,
      no_attributes: true,
      significant_changes_only: false,
    });
  } catch (err) {
    console.error('[unifi-timeline] gap history fetch failed', err);
    return [];
  }
  const suspected = unavailableIntervals(resp[cameraEntityId] ?? [], since, until);
  return verifyGaps(hass, nvrId, cameraEntityId, suspected);
}

/** True when `t` (epoch ms) falls within any gap. */
export function inGap(gaps: FootageGap[], t: number): boolean {
  for (const g of gaps) if (t >= g.start && t <= g.end) return true;
  return false;
}
