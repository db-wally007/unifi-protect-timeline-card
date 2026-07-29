// Forcibly release <video> decoders / network pipelines.
//
// Removing a media element from the document is NOT enough to free it. A
// detached <video> keeps its srcObject (the MediaSource hls.js feeds) and sits
// at networkState NETWORK_LOADING indefinitely — measured in-browser: three
// live camera tiles were still readyState 4 / networkState 2 twelve seconds
// after their view was navigated away from. Home Assistant also CACHES
// dashboard views, so the detached elements aren't garbage collected either;
// they simply stay alive until the user returns.
//
// Chromium has no practical limit, so this is invisible on the Android tablet.
// iOS/WebKit caps concurrent media pipelines, and the leftovers starve whatever
// mounts next: opening a per-camera view (which starts a 4K live stream) while
// three grid tiles still hold theirs leaves live, the scrub preview and the
// clip playback all black until WebKit reclaims the old ones on its own.
//
// load() is the part that actually does the work — it runs the media load
// algorithm with no source, resetting the element to NETWORK_EMPTY.

/** Reset one <video> to NETWORK_EMPTY, freeing its decoder and any MediaSource. */
export function releaseVideo(v: HTMLVideoElement): void {
  try {
    v.pause();
  } catch {
    /* already torn down */
  }
  try {
    // hls.js / HA attach the stream as a srcObject, not a src attribute.
    v.srcObject = null;
  } catch {
    /* not settable on this element */
  }
  v.removeAttribute('src');
  try {
    v.load();
  } catch {
    /* the element is going away underneath us — nothing left to release */
  }
}

/** Release every <video> at or under `root`, descending into shadow roots —
 *  HA keeps its player's <video> two shadow roots below <ha-camera-stream>. */
export function releaseVideosIn(root: Element | DocumentFragment | null | undefined): void {
  if (!root) return;
  if (root instanceof HTMLVideoElement) releaseVideo(root);
  const walk = (node: Element | DocumentFragment): void => {
    for (const el of Array.from(node.querySelectorAll('*'))) {
      if (el instanceof HTMLVideoElement) releaseVideo(el);
      if (el.shadowRoot) walk(el.shadowRoot);
    }
  };
  walk(root);
  if ('shadowRoot' in root && root.shadowRoot) walk(root.shadowRoot);
}
