// Keep the high-resolution live streams warm while a camera page is on screen.
//
// A cold Home Assistant stream cannot answer its first playlist until a whole
// segment exists, i.e. one full UniFi keyframe interval after it connects:
// 6-7 s measured on the wall tablet before the first high-resolution frame,
// ~12 s before the medium bridge handed over. `protect_cache` exposes
// POST /api/protect_clip/warm, which starts the stream and pushes HA's 30 s idle
// deadline out; this module calls it every WARM_EVERY_MS for the union of what
// every VISIBLE camera page asked for, and stops the moment nothing does — the
// streams then go cold on their own 30 s later. The client downloads nothing.
//
// Without protect_cache (a HACS-only install) the endpoint 404s once and the
// warmer switches itself off: live simply starts cold, as it always did.

import type { HomeAssistant } from './types';
import { authFetch } from './ha-urls';

const WARM_EVERY_MS = 20_000;
// A stream answered by the warmer this long ago has produced segments: opening
// it now reaches a picture about as fast as a medium bridge would.
const HOT_AFTER_MS = 8_000;
// HA drops an HLS output 30 s after its last wake-up; stay a little inside that.
const STAYS_WARM_MS = 25_000;

const holders = new Map<object, string[]>();
// Per stream: when the warmer first got it going, and when it last woke it. Kept
// past a release on purpose — drilling from the grid into a camera releases the
// grid's hold a moment BEFORE the player takes its own, and the stream is just
// as warm on the server during that gap.
const warmth = new Map<string, { since: number; last: number }>();
let hassRef: HomeAssistant | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
let unsupported = false;
let inFlight = false;

function wanted(): string[] {
  const all = new Set<string>();
  for (const ids of holders.values()) for (const id of ids) all.add(id);
  return [...all];
}

async function ping(): Promise<void> {
  const ids = wanted();
  if (!ids.length || unsupported || !hassRef || inFlight) return;
  inFlight = true;
  try {
    const resp = await authFetch(hassRef, '/api/protect_clip/warm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_ids: ids }),
    });
    if (resp.status === 404) {
      unsupported = true;
      stop();
      return;
    }
    if (!resp.ok) return;
    const body = (await resp.json()) as { warm?: string[] };
    const now = Date.now();
    for (const id of body.warm ?? []) {
      const w = warmth.get(id);
      if (w && now - w.last < STAYS_WARM_MS) w.last = now;
      else warmth.set(id, { since: now, last: now }); // (re)started cold
    }
  } catch {
    // Offline for a moment: the next tick tries again.
  } finally {
    inFlight = false;
  }
}

function stop(): void {
  clearInterval(timer);
  timer = undefined;
}

/** `owner` wants these camera streams warm (replaces what it asked for before). */
export function holdWarm(owner: object, hass: HomeAssistant, ids: string[]): void {
  if (!ids.length) {
    releaseWarm(owner);
    return;
  }
  hassRef = hass;
  const before = new Set(wanted());
  holders.set(owner, ids);
  if (unsupported) return;
  const added = ids.some((id) => !before.has(id));
  if (!timer) timer = setInterval(() => void ping(), WARM_EVERY_MS);
  if (added) void ping();
}

/** `owner` no longer needs anything warm (hidden, closed, torn down). */
export function releaseWarm(owner: object): void {
  if (!holders.delete(owner)) return;
  if (!holders.size) stop();
}

/** The stream has been kept warm long enough to start without a cold wait,
 *  and the server has not let it go since. */
export function isStreamHot(id: string): boolean {
  const w = warmth.get(id);
  const now = Date.now();
  return !!w && now - w.last < STAYS_WARM_MS && now - w.since >= HOT_AFTER_MS;
}
