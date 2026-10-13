// Builders for the unifiprotect HTTP proxy endpoints, plus auth-signing.
//
// Endpoint (verified against homeassistant/components/unifiprotect/views.py):
//   /api/unifiprotect/snapshot/{nvr_id}/{camera_id}/{timestamp}  -> JPEG at an instant
//
// {camera_id} accepts the HA camera entity_id (it falls back through the entity
// registry to the MAC), and {nvr_id} accepts the unifiprotect config-entry id.
//
// <video>/<img> src attributes and websockets do NOT send HA auth headers, so we
// turn each raw path into a short-lived signed path via the auth/sign_path WS
// command (the player's relay socket is opened that way too).

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

/** A fetch() made by the card itself (not a src attribute) can carry auth
 *  directly — no per-request signing round trip: the frontend's own
 *  fetchWithAuth if present, else a bearer token. */
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
