const LIVE_PLAYER_SELECTOR = 'ha-hls-player,ha-web-rtc-player';

/** The HA camera player that is currently painted, excluding its hidden standby. */
export function visibleLivePlayer(stream: Element): Element | null {
  const root = stream.shadowRoot;
  if (!root) return null;
  const players = Array.from(root.querySelectorAll(LIVE_PLAYER_SELECTOR));
  return (
    players.find(
      (player) => !player.classList.contains('hidden') && !player.hasAttribute('hidden'),
    ) ?? null
  );
}

/** First video below one known player, descending through its shadow roots. */
export function shadowVideo(player: Element): HTMLVideoElement | null {
  const root = player.shadowRoot;
  if (!root) return null;
  const direct = root.querySelector('video') as HTMLVideoElement | null;
  if (direct) return direct;
  for (const child of Array.from(root.querySelectorAll('*'))) {
    const video = shadowVideo(child);
    if (video) return video;
  }
  return null;
}

/** The video belonging to HA's currently visible HLS/WebRTC transport. */
export function visibleLiveVideo(stream: Element): HTMLVideoElement | null {
  const player = visibleLivePlayer(stream);
  return player ? shadowVideo(player) : null;
}
