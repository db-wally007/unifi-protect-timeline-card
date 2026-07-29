// HA-frontend SPA navigation: push the new path and fire `location-changed`
// so Home Assistant swaps views without a page load. Because this is a real
// history push, the target view's back button (history.back()) returns here.

export function navigate(path: string): void {
  history.pushState(null, '', path);
  window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
}
