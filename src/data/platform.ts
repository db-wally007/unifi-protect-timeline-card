// IOS-FREEZE-2026-09-26: Apple WebKit (the iPhone Companion app, Safari).
//
// The iPhone app's web view HUNG — stopped reading from Home Assistant
// entirely, "Connection lost" for minutes — right after the card moved on from
// a clip it had played (rollover into continuous footage, autoplay of the next
// clip, or picking another clip). Captured 2026-09-26 with request logging and
// in-page breadcrumbs: every hang followed the clip session's DELETE, and the
// first clip after opening the page — the one case with no DELETE before it —
// never hung. Chromium never hangs on any of this.
//
// Deliberately a UA test: this is a specific engine's behaviour, and there is
// no feature test for "hangs after this request".
export const APPLE_WEBKIT =
  typeof navigator !== 'undefined' &&
  /AppleWebKit/.test(navigator.userAgent) &&
  !/Chrome|Chromium|CriOS|Edg|Android/.test(navigator.userAgent);
