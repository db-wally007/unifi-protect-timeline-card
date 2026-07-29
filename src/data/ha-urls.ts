// Builders for the unifiprotect HTTP proxy endpoints, plus auth-signing.
//
// Endpoints (verified against homeassistant/components/unifiprotect/views.py):
//   /api/unifiprotect/video/{nvr_id}/{camera_id}/{start}/{end}   -> MP4 (arbitrary range)
//   /api/unifiprotect/snapshot/{nvr_id}/{camera_id}/{timestamp}  -> JPEG at an instant
//
// {camera_id} accepts the HA camera entity_id (it falls back through the entity
// registry to the MAC), and {nvr_id} accepts the unifiprotect config-entry id.
//
// <video>/<img> src attributes do NOT send HA auth headers, so we turn each raw
// path into a short-lived signed path via the auth/sign_path WS command.

import type { HomeAssistant } from './types';

// Base URLs of the server-side caches maintained by the pyscript jobs. These
// are NOT under /local: the files live in config/.cache/ (the one directory HA
// Core's backup excludes) and are served by the small `protect_cache` custom
// component. See its docstring for why a symlink from www/ can't work.
export const SCRUB_BASE = '/protect_scrub';
export const THUMBS_BASE = '/protect_thumbs';
// Where the thumbnail cache used to be served from. protect_thumbs.py bakes an
// absolute URL into every manifest entry, so manifests written before the move
// still point at /local — rewrite those on read instead of migrating the files.
const LEGACY_THUMBS_BASE = '/local/protect_thumbs';

/** Map a cached-thumbnail URL from a pre-move manifest onto the current base. */
export function normalizeThumbUrl(url: string): string {
  return url.startsWith(`${LEGACY_THUMBS_BASE}/`)
    ? THUMBS_BASE + url.slice(LEGACY_THUMBS_BASE.length)
    : url;
}

function iso(t: number | Date): string {
  return (t instanceof Date ? t : new Date(t)).toISOString();
}

export function buildVideoUrl(
  nvrId: string,
  cameraId: string,
  start: number | Date,
  end: number | Date,
): string {
  return `/api/unifiprotect/video/${encodeURIComponent(nvrId)}/${encodeURIComponent(
    cameraId,
  )}/${encodeURIComponent(iso(start))}/${encodeURIComponent(iso(end))}`;
}

export function buildSnapshotUrl(
  nvrId: string,
  cameraId: string,
  timestamp: number | Date,
  size?: { width?: number; height?: number },
): string {
  let url = `/api/unifiprotect/snapshot/${encodeURIComponent(nvrId)}/${encodeURIComponent(
    cameraId,
  )}/${encodeURIComponent(iso(timestamp))}`;
  const params: string[] = [];
  if (size?.width) params.push(`width=${Math.round(size.width)}`);
  if (size?.height) params.push(`height=${Math.round(size.height)}`);
  if (params.length) url += `?${params.join('&')}`;
  return url;
}

// ---- clip sessions (protect_cache custom component) -------------------------
// A bounded event clip is NOT fetched from the export proxy any more: that
// endpoint ignores Range and the NVR writes the MP4 index last, so the only way
// to seek was to download the whole thing into a Blob — ~740 MB peak for a
// 7-minute 4K event, which kills the WKWebView content process on iOS (the app
// "returns to the dashboard" the instant the download completes).
//
// Instead the server exports + remuxes the clip to a faststart file in a
// throwaway session directory and serves it with real HTTP Range, so <video>
// streams and seeks natively while holding only its own buffer. Sessions are
// deleted when playback ends; the server sweeps orphans on every new session.

export interface ClipSession {
  session_id: string;
  /** Pre-signed and seekable — assign straight to <video>.src. */
  url: string;
  size: number;
  expires_in: number;
}

/** POST/DELETE can't use a signed path (sign_path only covers GET), so send the
 *  frontend's own auth: its fetchWithAuth if present, else a bearer token. */
export function authFetch(
  hass: HomeAssistant,
  url: string,
  init: RequestInit,
): Promise<Response> {
  if (hass.fetchWithAuth) return hass.fetchWithAuth(url, init);
  const token = hass.auth?.accessToken;
  return fetch(url, {
    ...init,
    headers: { ...init.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
}

/** Ask the server to prepare a clip. Resolves once it is ready to stream. */
export async function startClipSession(
  hass: HomeAssistant,
  nvrId: string,
  cameraId: string,
  start: number | Date,
  end: number | Date,
  signal?: AbortSignal,
): Promise<ClipSession> {
  const resp = await authFetch(hass, '/api/protect_clip/session', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nvr_id: nvrId,
      camera_id: cameraId,
      start: iso(start),
      end: iso(end),
    }),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    throw new Error(`clip session failed (${resp.status}) ${detail}`);
  }
  return (await resp.json()) as ClipSession;
}

/** Drop a session's working directory. Best-effort: the server sweeps anyway. */
export function endClipSession(hass: HomeAssistant, sessionId: string): void {
  void authFetch(hass, `/api/protect_clip/session/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    keepalive: true, // survives the view being torn down mid-flight
  }).catch(() => undefined);
}

/**
 * Return a signed, header-free URL usable directly as a <video>/<img> src.
 * Falls back to the raw path if signing fails (e.g. older HA), so the caller
 * can still attempt the request with cookie auth.
 */
export async function signPath(
  hass: HomeAssistant,
  path: string,
  expiresSeconds = 300,
): Promise<string> {
  try {
    const res = await hass.callWS<{ path: string }>({
      type: 'auth/sign_path',
      path,
      expires: expiresSeconds,
    });
    return res.path;
  } catch (err) {
    console.warn('[unifi-timeline] auth/sign_path failed, using raw path', err);
    return path;
  }
}
