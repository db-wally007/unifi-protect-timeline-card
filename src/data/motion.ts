// iOS-style motion shared by the card's screen transitions (tablet layout).
//
// A player opens by ZOOMING out of the thumbnail or tile it was tapped in and
// closes by zooming back into it; what has no source fades. Every move rides
// the same curve, quick to start with a long soft landing.
//
// CHEAP BY DESIGN (the wall tablet lagged): only transform and opacity are
// animated - the compositor runs those on its own, so a busy main thread
// (a player starting, footage arriving) cannot stutter a flight. No
// clip-path, no colours, no layout per frame, no canvas readbacks.

import { APPLE_WEBKIT } from './platform';

/** A zoom between a thumbnail / tile and its player. */
export const ZOOM_MS = 500;
/** A fade with no geometry to it (scrims, content swaps). */
export const FADE_MS = 240;

/** UIKit's default spring (critically damped, response `response` s) over
 *  `ms`, as a CSS linear() easing: half the way after a quarter of the time,
 *  a long soft landing. (A cubic-bezier fast enough to feel like it put 77%
 *  of a zoom into its first quarter - in a 0.46 s close the picture all but
 *  jumped into its thumbnail.) */
function springEasing(ms: number, response = 0.45): string {
  const w = (2 * Math.PI) / response;
  const pts: string[] = [];
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const s = ((i / n) * ms) / 1000;
    const x = i === n ? 1 : 1 - (1 + w * s) * Math.exp(-w * s);
    pts.push(`${x.toFixed(4)} ${((i / n) * 100).toFixed(1)}%`);
  }
  return `linear(${pts.join(', ')})`;
}
const SPRING = springEasing(ZOOM_MS);
/** Where linear() is not supported (WebKit before 17.2): the closest curve. */
const SPRING_FALLBACK = 'cubic-bezier(0.25, 0.8, 0.3, 1)';
let springOk: boolean | undefined;

/** The spring easing - every zoom, and what moves with one (scrims, dims). */
export function iosEase(): string {
  springOk ??= typeof CSS !== 'undefined' && CSS.supports?.('animation-timing-function', SPRING) === true;
  return springOk ? SPRING : SPRING_FALLBACK;
}

/** A popover (the calendar) out of the control that opened it and back. */
export const POP_IN_MS = 460;
export const POP_OUT_MS = 300;

/** UIKit's bouncy spring (`damping` < 1: it overshoots a touch, then
 *  settles), over `ms`, as a CSS linear() easing - finer sampled than the
 *  critically damped one, the overshoot needs it. */
export function bouncyEasing(ms: number, response: number, damping: number): string {
  const w = (2 * Math.PI) / response;
  const wd = w * Math.sqrt(1 - damping * damping);
  const pts: string[] = [];
  const n = 40;
  for (let i = 0; i <= n; i++) {
    const s = ((i / n) * ms) / 1000;
    const x =
      i === n
        ? 1
        : 1 - Math.exp(-damping * w * s) * (Math.cos(wd * s) + ((damping * w) / wd) * Math.sin(wd * s));
    pts.push(`${x.toFixed(4)} ${((i / n) * 100).toFixed(1)}%`);
  }
  return `linear(${pts.join(', ')})`;
}
// Open: ~3% past and back (response 0.36 s, damping 0.75); close: quicker,
// no overshoot - most of the way in its first half.
const POP_IN = bouncyEasing(POP_IN_MS, 0.36, 0.75);
const POP_OUT = springEasing(POP_OUT_MS, 0.27);
// Closing, it holds for the first tenth, then fades out and is gone by this
// point of the flight, while still a fair size: a miniature calendar over the
// control it shrinks into looked wrong, gone by 0.4 of a 260 ms close was
// "nearly instant" (user, 2026-10-31).
const POP_OUT_GONE = 0.6;

/** A popover flying out of the control that opened it (`src`) to its own
 *  place (`at`, its `content` the region that maps onto `src`), or back:
 *  out on a spring that overshoots a touch and settles, fading in over its
 *  first fifth; back on a quicker spring, faded out early on (fill:
 *  forwards - the caller removes it). Transform + opacity only. */
export function popFlight(el: HTMLElement, src: Box, at: Box, content: Box, open: boolean): Animation {
  const ok = springOk ?? iosEase() === SPRING;
  const from = { transformOrigin: '0 0', transform: zoomTransform(src, at, content) };
  const to = { transformOrigin: '0 0', transform: 'none' };
  if (open) {
    el.animate([{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1 }], { duration: POP_IN_MS });
    return el.animate([from, to], {
      duration: POP_IN_MS,
      easing: ok ? POP_IN : 'cubic-bezier(0.34, 1.3, 0.64, 1)',
    });
  }
  el.animate([{ opacity: 1 }, { opacity: 1, offset: 0.1 }, { opacity: 0, offset: POP_OUT_GONE }, { opacity: 0 }], {
    duration: POP_OUT_MS,
    fill: 'forwards',
  });
  return el.animate([to, from], {
    duration: POP_OUT_MS,
    easing: ok ? POP_OUT : SPRING_FALLBACK,
    fill: 'forwards',
  });
}

/** A rectangle in some element's coordinate space. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where a zoom transition starts (or ends): an element, the region of it
 *  the flight maps onto (element-relative: the picture, or all of it), and -
 *  only where it is the very picture the other end starts on - a `poster`
 *  for that end to show until its own video has a frame. */
export interface ZoomSource {
  el: Element;
  content: Box;
  poster?: string | HTMLCanvasElement;
  // A tile in a scroller: the flight uses the part of it inside this
  // element (see clipBox).
  view?: Element;
}

/** A ZoomSource's region as a box relative to `origin`. */
export function sourceBox(src: ZoomSource, origin: Element): Box {
  const b = boxOf(src.el, origin);
  const c = src.content;
  return { x: b.x + c.x, y: b.y + c.y, w: c.w, h: c.h };
}

/** A client rect as a Box (screen coordinates). */
export function rectBox(r: DOMRect): Box {
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

/** An element's box relative to `origin` (both measured now). */
export function boxOf(el: Element, origin: Element): Box {
  const a = el.getBoundingClientRect();
  const o = origin.getBoundingClientRect();
  return { x: a.left - o.left, y: a.top - o.top, w: a.width, h: a.height };
}

/** Is `el` wholly visible inside `scroller` (its scroll viewport)? A thumbnail
 *  half scrolled away is no place to zoom into. */
export function onScreen(el: Element, scroller: Element | null | undefined): boolean {
  const a = el.getBoundingClientRect();
  if (!a.width || !a.height) return false;
  // ...and inside the window: on the phone the whole page scrolls, not the
  // grid holding the thumbnail.
  if (a.top < -1 || a.bottom > window.innerHeight + 1) return false;
  if (!scroller) return true;
  const s = scroller.getBoundingClientRect();
  return a.top >= s.top - 1 && a.bottom <= s.bottom + 1 && a.left >= s.left - 1 && a.right <= s.right + 1;
}

/** The part of `box` inside `view` (same space) - a tile half scrolled out
 *  of its grid zooms from/to what is on screen. null when none of it is. */
export function clipBox(box: Box, view: Box): Box | null {
  const x0 = Math.max(box.x, view.x);
  const y0 = Math.max(box.y, view.y);
  const x1 = Math.min(box.x + box.w, view.x + view.w);
  const y1 = Math.min(box.y + box.h, view.y + view.h);
  return x1 - x0 < 1 || y1 - y0 < 1 ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Where content of aspect `aspect` (w/h) is drawn inside `box` with
 *  object-fit: contain. */
export function containBox(box: Box, aspect: number): Box {
  if (!(aspect > 0) || !box.w || !box.h) return box;
  if (box.w / box.h > aspect) {
    const w = box.h * aspect;
    return { x: box.x + (box.w - w) / 2, y: box.y, w, h: box.h };
  }
  const h = box.w / aspect;
  return { x: box.x, y: box.y + (box.h - h) / 2, w: box.w, h };
}

/** The transform putting an element laid out at `at` so that its `content`
 *  region (element-relative) sits inside `src` (same space as `at`), scaled
 *  uniformly to fit and centred on it. Needs transform-origin 0 0. */
export function zoomTransform(src: Box, at: Box, content: Box): string {
  const k = Math.min(src.w / Math.max(1, content.w), src.h / Math.max(1, content.h));
  const tx = src.x + src.w / 2 - at.x - k * (content.x + content.w / 2);
  const ty = src.y + src.h / 2 - at.y - k * (content.y + content.h / 2);
  return `translate(${tx}px, ${ty}px) scale(${k})`;
}

/**
 * Zoom an element between `src` (a thumbnail or tile) and its own box `at`:
 * opening, it grows out of `src` while fading in over the first 30% - so it
 * dissolves out of what was tapped instead of showing it blown up; `out`
 * plays it back into `src`, dissolving over the last 40% (fill: forwards -
 * the caller removes the element). Transform + opacity only.
 */
export function zoom(el: HTMLElement, src: Box, at: Box, content: Box, opts: { out?: boolean } = {}): Animation {
  const frames: Keyframe[] = [
    { transformOrigin: '0 0', transform: zoomTransform(src, at, content) },
    { transformOrigin: '0 0', transform: 'none' },
  ];
  if (opts.out) frames.reverse();
  el.animate(
    opts.out
      ? [{ opacity: 1 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }]
      : [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 1 }],
    { duration: ZOOM_MS, fill: opts.out ? 'forwards' : 'none' },
  );
  return el.animate(frames, { duration: ZOOM_MS, easing: iosEase(), fill: opts.out ? 'forwards' : 'none' });
}

/** The flight of an element between `src` (SCREEN coordinates: a thumbnail or
 *  tile, upright) and its own place at rest, where it stands turned `angle`
 *  degrees about its centre (90: the phone's sideways camera screen, 0:
 *  upright). Same function list at both ends, so the browser interpolates each
 *  part on its own: the centre travels a straight line while the element turns
 *  and grows. At the start, unturned, its `content` region (element-local)
 *  fits inside `src`, centred on it. Needs the element at rest when called
 *  (its centre is measured), transform-origin at its centre. */
export function turnFrames(el: HTMLElement, src: Box, content: Box, angle: number): Keyframe[] {
  const r = el.getBoundingClientRect(); // a turn about the centre keeps the centre
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const k = Math.min(src.w / Math.max(1, content.w), src.h / Math.max(1, content.h));
  const tx = src.x + src.w / 2 - (r.left + r.width / 2) - k * (content.x + content.w / 2 - w / 2);
  const ty = src.y + src.h / 2 - (r.top + r.height / 2) - k * (content.y + content.h / 2 - h / 2);
  return [
    { transformOrigin: '50% 50%', transform: `translate(${tx}px, ${ty}px) rotate(0deg) scale(${k})` },
    { transformOrigin: '50% 50%', transform: `translate(0px, 0px) rotate(${angle}deg) scale(1)` },
  ];
}

/** Run a turnFrames flight, with the same dissolve as zoom(): in over the
 *  first 30% opening, out over the last 40% closing (`out`: from rest into
 *  `src`, fill: forwards - the caller removes the element). */
export function turnZoom(
  el: HTMLElement,
  src: Box,
  content: Box,
  angle: number,
  opts: { out?: boolean } = {},
): Animation {
  const frames = turnFrames(el, src, content, angle);
  if (opts.out) frames.reverse();
  el.animate(
    opts.out
      ? [{ opacity: 1 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }]
      : [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 1 }],
    { duration: ZOOM_MS, fill: opts.out ? 'forwards' : 'none' },
  );
  return el.animate(frames, { duration: ZOOM_MS, easing: iosEase(), fill: opts.out ? 'forwards' : 'none' });
}

/** A SCREEN rectangle in the local coordinates of an element turned 90°
 *  clockwise about its centre (the phone's sideways camera screen), whose
 *  untransformed size is `w` x `h`: local (x, y) paints at screen offset
 *  (-y, x) from the centre, so screen (X, Y) is local (w/2 + Y - cy, h/2 -
 *  X + cx). `frame` is the element's own screen rect. */
export function turnedLocal(rect: DOMRect | Box, frame: DOMRect, w: number, h: number): Box {
  const x = 'left' in rect ? rect.left : rect.x;
  const y = 'top' in rect ? rect.top : rect.y;
  const rw = 'width' in rect ? rect.width : rect.w;
  const rh = 'height' in rect ? rect.height : rect.h;
  const cx = frame.left + frame.width / 2;
  const cy = frame.top + frame.height / 2;
  return { x: w / 2 + (y - cy), y: h / 2 - (x + rw - cx), w: rh, h: rw };
}

/** A fade (in, or out with fill: forwards). */
export function fade(el: Element, show: boolean, duration = FADE_MS, delay = 0): Animation {
  return el.animate([{ opacity: show ? 0 : 1 }, { opacity: show ? 1 : 0 }], {
    duration,
    delay,
    easing: show ? 'cubic-bezier(0.22, 1, 0.36, 1)' : 'ease-in',
    fill: show ? 'backwards' : 'forwards',
  });
}

/** The frame a <video> shows, as a canvas - or null: never on Apple WebKit (a
 *  synchronous readback of a hardware frame hung the iPhone app,
 *  IOS-FREEZE-2026-09-26), or nothing decoded yet. A GPU-side copy only: it
 *  is never read back (a readback stalls the GPU - on the tablet, mid
 *  transition); a decoder that can't be copied just gives a black picture. */
export function frameOf(video: HTMLVideoElement | null | undefined): HTMLCanvasElement | null {
  if (APPLE_WEBKIT || !video || video.readyState < 2 || !video.videoWidth) return null;
  const c = document.createElement('canvas');
  // A modest copy is plenty for one flight.
  const scale = Math.min(1, 960 / video.videoWidth);
  c.width = Math.round(video.videoWidth * scale);
  c.height = Math.round(video.videoHeight * scale);
  try {
    c.getContext('2d')?.drawImage(video, 0, 0, c.width, c.height);
  } catch {
    return null;
  }
  return c;
}
