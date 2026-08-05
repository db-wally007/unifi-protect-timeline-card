// Memoised Intl date/time formatters.
//
// PERF-SCRUB-2026-08-03 — added whole file. Revert: delete this file and put
// the inline `new Intl.DateTimeFormat(undefined, opts).format(...)` calls back
// at the call sites tagged with the same marker.
//
// WHY: constructing an Intl.DateTimeFormat is one of the most expensive routine
// calls in a browser — measured 0.15 ms each at 6x CPU throttle, vs 0.004 ms to
// `.format()` an already-built one (37x). The scrubber built a fresh one for
// EVERY major tick label on EVERY canvas frame, plus one per frame for the
// mirror-layout `measureText`, plus one per Lit render for the playhead pill
// clock, plus one per card render for the date pill: ~2600 constructions per
// 2.5 s scrub gesture, which on a slow tablet core is the single largest cost
// in the whole gesture (canvas DRAWING ops were only 0.3 ms of a 4.8 ms draw).
// Memoising took the per-gesture canvas draw cost from 398 ms to 108 ms (-73%)
// and raised the number of preview frames actually delivered by 52%.
//
// Keyed by the SERIALISED options, deliberately, not by object identity: an
// identity-keyed cache silently misses (and grows without bound) the moment a
// call site passes an object literal, which is exactly how every call site here
// is written. JSON.stringify of these tiny objects is ~0.001 ms — still ~100x
// cheaper than the constructor it replaces.
//
// TRADE-OFF: formatters bind the locale/time zone resolved when they were first
// built. Changing the Home Assistant profile language or time zone therefore
// only takes effect in the card after a page reload, where it used to apply on
// the next repaint. Accepted deliberately — that setting changes ~never, and it
// reloads the frontend in practice.

const cache = new Map<string, Intl.DateTimeFormat>();

/** An Intl.DateTimeFormat for `opts`, built once and reused. */
export function dateFmt(opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(opts);
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(undefined, opts);
    cache.set(key, f);
  }
  return f;
}

/** Shorthand for the common "format this epoch-ms" case. */
export function fmtTime(t: number, opts: Intl.DateTimeFormatOptions): string {
  return dateFmt(opts).format(new Date(t));
}
