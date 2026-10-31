import { beforeEach, describe, expect, it } from 'vitest';
import { fetchCurrentJson, resetFreshJsonRetries } from '../src/data/fresh-json';

type Doc = { generated?: number; v: string };

/** A fetch that answers from `responses` by URL prefix and records the URLs. */
function fakeFetch(answer: (url: string) => Doc | null) {
  const urls: string[] = [];
  const f = (async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    const body = answer(url);
    return {
      ok: body !== null,
      json: async () => body,
    } as Response;
  }) as typeof fetch;
  return { f, urls };
}

const gen = (d: Doc) => d.generated;

describe('fetchCurrentJson', () => {
  beforeEach(() => resetFreshJsonRetries());

  it('returns a current copy without a second read', async () => {
    const { f, urls } = fakeFetch(() => ({ generated: Date.now() - 10_000, v: 'now' }));
    const d = await fetchCurrentJson<Doc>('/x/index.json', gen, 120_000, f);
    expect(d?.v).toBe('now');
    expect(urls).toEqual(['/x/index.json']);
  });

  it('re-reads a stale (service-worker) copy under a one-off URL and keeps the newer', async () => {
    const { f, urls } = fakeFetch((u) =>
      u.includes('fresh=')
        ? { generated: Date.now() - 5_000, v: 'server' }
        : { generated: Date.now() - 22 * 3_600_000, v: 'yesterday' },
    );
    const d = await fetchCurrentJson<Doc>('/x/index.json', gen, 120_000, f);
    expect(d?.v).toBe('server');
    expect(urls.length).toBe(2);
    expect(urls[1]).toMatch(/^\/x\/index\.json\?fresh=\d+$/);
  });

  it('keeps the first copy when the re-read is not newer (the writer really is down)', async () => {
    const old = Date.now() - 3_600_000;
    const { f } = fakeFetch((u) => ({ generated: old, v: u.includes('fresh=') ? 'again' : 'first' }));
    const d = await fetchCurrentJson<Doc>('/x/index.json', gen, 120_000, f);
    expect(d?.v).toBe('first');
  });

  it('re-reads at most once per file per 5 minutes', async () => {
    const { f, urls } = fakeFetch(() => ({ generated: Date.now() - 3_600_000, v: 'old' }));
    await fetchCurrentJson<Doc>('/x/index.json', gen, 120_000, f);
    await fetchCurrentJson<Doc>('/x/index.json', gen, 120_000, f);
    expect(urls.filter((u) => u.includes('fresh=')).length).toBe(1);
  });

  it('leaves files without a stamp alone, and reports a missing file as undefined', async () => {
    const { f, urls } = fakeFetch((u) => (u.startsWith('/missing') ? null : { v: 'legacy' }));
    expect((await fetchCurrentJson<Doc>('/x/manifest.json', gen, 1, f))?.v).toBe('legacy');
    expect(await fetchCurrentJson<Doc>('/missing/index.json', gen, 1, f)).toBeUndefined();
    expect(urls).toEqual(['/x/manifest.json', '/missing/index.json']);
  });
});
