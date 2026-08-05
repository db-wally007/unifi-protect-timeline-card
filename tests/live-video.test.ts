import { describe, expect, it } from 'vitest';
import { visibleLivePlayer, visibleLiveVideo } from '../src/data/live-video';

interface FakeElement {
  shadowRoot: FakeShadowRoot | null;
  classList: { contains: (name: string) => boolean };
  hasAttribute: (name: string) => boolean;
}

interface FakeShadowRoot {
  querySelector: (selector: string) => unknown;
  querySelectorAll: (selector: string) => FakeElement[];
}

function player(hidden: boolean, video: unknown = null): FakeElement {
  return {
    classList: { contains: (name) => name === 'hidden' && hidden },
    hasAttribute: () => false,
    shadowRoot: {
      querySelector: (selector) => (selector === 'video' ? video : null),
      querySelectorAll: () => [],
    },
  };
}

function stream(players: FakeElement[]): Element {
  return {
    shadowRoot: {
      querySelector: () => null,
      querySelectorAll: () => players,
    },
  } as unknown as Element;
}

describe('visibleLivePlayer', () => {
  it('selects visible HLS while WebRTC is hidden during startup', () => {
    const hls = player(false);
    const webRtc = player(true);
    expect(visibleLivePlayer(stream([hls, webRtc]))).toBe(hls);
  });

  it('switches to WebRTC when HA changes transport visibility', () => {
    const hls = player(true);
    const webRtc = player(false);
    expect(visibleLivePlayer(stream([hls, webRtc]))).toBe(webRtc);
  });

  it('does not fall back to a hidden player', () => {
    expect(visibleLivePlayer(stream([player(true), player(true)]))).toBeNull();
  });
});

describe('visibleLiveVideo', () => {
  it('returns only the visible transport video', () => {
    const hiddenVideo = { id: 'hls' };
    const visibleVideo = { id: 'webrtc' };
    const root = stream([player(true, hiddenVideo), player(false, visibleVideo)]);
    expect(visibleLiveVideo(root)).toBe(visibleVideo);
  });
});
