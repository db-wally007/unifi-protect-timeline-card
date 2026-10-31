// Reading a file that is REWRITTEN IN PLACE (the scrub index, the event
// manifest) past Home Assistant's service worker.
//
// HA's service worker answers every same-origin file it does not specifically
// know — anything outside /api, /auth, /static, /frontend_* — from its
// "file-cache" first (stale-while-revalidate, entries kept 24 h) and refreshes
// that copy in the background. So the FIRST read of index.json in a while gets
// whatever was cached the last time it was read: on a laptop whose tab stayed
// open overnight, yesterday's — and the scrub preview painted yesterday's
// newest photo for seconds until a later read got the refreshed copy
// (reported 2026-10-15, MacBook Chrome). `cache: 'no-cache'` does not reach a
// service worker. The worker only exists over HTTPS, which is why the tablet
// (plain http) and the iPhone app's web view never showed it.
//
// Every such file carries the time its writer produced it (`generated`). When
// the copy we got is older than the writer's own schedule allows, read it once
// more under a URL the worker has never cached, which it must fetch from the
// server. Rate-limited per file, so a writer that is really down (and a copy
// that really is old) cannot fill the worker's cache with one-off URLs.

const RETRY_EVERY_MS = 5 * 60_000;
const lastRetry = new Map<string, number>();

/** GET `url` as JSON; undefined when missing/unreadable. If `generatedOf(data)`
 *  is older than `maxAgeMs`, retry once past the service worker and keep the
 *  newer of the two. */
export async function fetchCurrentJson<T>(
  url: string,
  generatedOf: (data: T) => number | undefined,
  maxAgeMs: number,
  doFetch: typeof fetch = fetch,
): Promise<T | undefined> {
  const read = async (u: string): Promise<T | undefined> => {
    const res = await doFetch(u, { cache: 'no-cache' });
    return res.ok ? ((await res.json()) as T) : undefined;
  };
  const data = await read(url);
  if (data === undefined) return undefined;
  const generated = generatedOf(data);
  // No stamp (a legacy file) or current: nothing to second-guess.
  if (generated === undefined || Date.now() - generated <= maxAgeMs) return data;
  const now = Date.now();
  if (now - (lastRetry.get(url) ?? 0) < RETRY_EVERY_MS) return data;
  lastRetry.set(url, now);
  try {
    const again = await read(`${url}${url.includes('?') ? '&' : '?'}fresh=${now}`);
    if (again !== undefined && (generatedOf(again) ?? 0) > generated) return again;
  } catch {
    /* keep the copy we have */
  }
  return data;
}

/** Test hook: forget the per-file retry times. */
export function resetFreshJsonRetries(): void {
  lastRetry.clear();
}
