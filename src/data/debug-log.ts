// Field telemetry (opt-in: `debug: true` in the card's config).
//
// Problems that only happen on a real device - the wall tablet's decoder, an
// iPhone's ManagedMediaSource, a talk session's echo - cannot be reproduced in
// a headless browser. With `debug` on, the player, Talk and media-view report
// what they actually do here; batches go to protect_cache
// (`POST /api/protect_cache/debug`, custom_components/protect_cache/debug.py),
// which appends them to config/.cache/protect_debug/<day>/<client>.jsonl.
// Only timings, states and levels - never footage or microphone audio.

import type { HomeAssistant } from './types';

const FLUSH_MS = 2000;
const MAX_QUEUE = 3000;

interface Batch {
  client: string;
  sent: number;
  device?: Record<string, unknown>;
  events: Array<Record<string, unknown>>;
}

let getHass: (() => HomeAssistant | undefined) | null = null;
let queue: Array<Record<string, unknown>> = [];
let timer: number | undefined;
let sending = false;
let device: Record<string, unknown> | null = null;
const decodeAsked = new Set<string>();

/** Telemetry is on (some card on the page has `debug: true`). */
export function debugOn(): boolean {
  return getHass != null;
}

/** This device's telemetry id (servers write their side of a session under it). */
export function debugClient(): string | undefined {
  if (!getHass) return undefined;
  if (!client) client = clientId();
  return client;
}

/** Record one event (a no-op unless enabled). */
export function dbg(ev: string, data: Record<string, unknown> = {}): void {
  if (!getHass) return;
  queue.push({ t: Date.now(), ev, ...data });
  if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
}

/** Turn telemetry on for this page (idempotent). */
export function enableDebug(hass: () => HomeAssistant | undefined): void {
  const first = !getHass;
  getHass = hass;
  if (!first) return;
  device = describeDevice();
  dbg('page', { path: location.pathname + location.hash, visible: document.visibilityState });
  timer = window.setInterval(() => void flush(), FLUSH_MS);
  document.addEventListener('visibilitychange', () => {
    dbg('page:visibility', { state: document.visibilityState });
    if (document.visibilityState === 'hidden') void flush();
  });
  window.addEventListener('pagehide', () => {
    dbg('page:hide');
    void flush();
  });
}

/** What this device says it can decode, once per codec + size. */
export function dbgDecodeInfo(cam: string, codecs: string, width: number, height: number): void {
  if (!getHass || !codecs) return;
  const key = `${codecs}|${width}x${height}`;
  if (decodeAsked.has(key)) return;
  decodeAsked.add(key);
  const mc = (navigator as Navigator & { mediaCapabilities?: MediaCapabilities }).mediaCapabilities;
  if (!mc?.decodingInfo) {
    dbg('decode', { cam, codecs, width, height, api: false });
    return;
  }
  const video = codecs.split(',').find((c) => /^(avc|hvc|hev|av01|vp)/.test(c.trim()))?.trim() ?? codecs;
  mc.decodingInfo({
    type: 'media-source',
    video: { contentType: `video/mp4; codecs="${video}"`, width, height, bitrate: 6_000_000, framerate: 30 },
  }).then(
    (r) => dbg('decode', { cam, codecs, width, height, supported: r.supported, smooth: r.smooth, powerEfficient: r.powerEfficient }),
    (err: Error) => dbg('decode', { cam, codecs, width, height, error: String(err?.message ?? err) }),
  );
}

function clientId(): string {
  const key = 'upc_debug_client';
  try {
    const have = localStorage.getItem(key);
    if (have) return have;
  } catch {
    /* private mode: a per-page id */
  }
  const ua = navigator.userAgent;
  const kind = /iPhone/.test(ua) ? 'iphone' : /iPad/.test(ua) ? 'ipad' : /Android/.test(ua) ? 'android' : /Mac/.test(ua) ? 'mac' : /Linux/.test(ua) ? 'linux' : 'other';
  const id = `${kind}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    localStorage.setItem(key, id);
  } catch {
    /* ignore */
  }
  return id;
}

function describeDevice(): Record<string, unknown> {
  const n = navigator as Navigator & { deviceMemory?: number; connection?: { effectiveType?: string; downlink?: number } };
  const w = window as unknown as { ManagedMediaSource?: unknown; MediaSource?: unknown };
  return {
    ua: navigator.userAgent,
    screen: `${screen.width}x${screen.height}@${devicePixelRatio}`,
    viewport: `${innerWidth}x${innerHeight}`,
    cores: navigator.hardwareConcurrency,
    memory: n.deviceMemory,
    net: n.connection ? `${n.connection.effectiveType ?? ''} ${n.connection.downlink ?? ''}` : undefined,
    mms: !!w.ManagedMediaSource,
    mse: !!w.MediaSource,
    secure: window.isSecureContext,
  };
}

let client = '';

async function flush(): Promise<void> {
  const hass = getHass?.();
  if (sending || !hass || !queue.length) return;
  sending = true;
  const events = queue;
  queue = [];
  if (!client) client = clientId();
  const batch: Batch = { client, sent: Date.now(), events };
  if (device) {
    batch.device = device;
    device = null;
  }
  try {
    if (hass.callApi) {
      await hass.callApi('POST', 'protect_cache/debug', batch as unknown as Record<string, unknown>);
    } else if (hass.fetchWithAuth) {
      const r = await hass.fetchWithAuth('/api/protect_cache/debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    }
  } catch {
    // Server not updated / offline: keep the newest events for the next try.
    queue = [...events, ...queue].slice(-MAX_QUEUE);
    if (batch.device) device = batch.device;
  } finally {
    sending = false;
  }
}

/** For tests: drop everything (and stop the flush timer). */
export function _resetDebugForTests(): void {
  clearInterval(timer);
  getHass = null;
  queue = [];
  device = null;
  decodeAsked.clear();
  client = '';
}
