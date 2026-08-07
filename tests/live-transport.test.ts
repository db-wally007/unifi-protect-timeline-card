import { describe, expect, it } from 'vitest';
import {
  findMediumBridgeCamera,
  isAppleMobile,
  shouldUseWebRtcLive,
} from '../src/data/live-transport';
import type { HomeAssistant } from '../src/data/types';

describe('isAppleMobile', () => {
  it('detects an iPhone user agent', () => {
    expect(
      isAppleMobile({
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15',
        platform: 'iPhone',
        maxTouchPoints: 5,
      }),
    ).toBe(true);
  });

  it('detects an iPad using its desktop identity', () => {
    expect(
      isAppleMobile({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15',
        platform: 'MacIntel',
        maxTouchPoints: 5,
      }),
    ).toBe(true);
  });

  it('does not classify a Mac as Apple mobile', () => {
    expect(
      isAppleMobile({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15',
        platform: 'MacIntel',
        maxTouchPoints: 0,
      }),
    ).toBe(false);
  });
});


describe('shouldUseWebRtcLive', () => {
  const iphone = { userAgent: 'Mozilla/5.0 (iPhone)', platform: 'iPhone' };

  it('uses WebRTC automatically on iPhone', () => {
    expect(shouldUseWebRtcLive('auto', iphone)).toBe(true);
  });

  it('honors explicit transport overrides', () => {
    expect(shouldUseWebRtcLive('hls', iphone)).toBe(false);
    expect(shouldUseWebRtcLive('webrtc', { userAgent: 'Desktop' })).toBe(true);
  });
});

describe('findMediumBridgeCamera', () => {
  const hass = {
    entities: {
      'camera.garden_high_resolution_channel': { device_id: 'garden' },
      'camera.unrelated_medium_resolution_channel': { device_id: 'other' },
      'camera.garden_medium_resolution_channel': { device_id: 'garden' },
    },
    states: {
      'camera.garden_high_resolution_channel': { state: 'recording', attributes: {} },
      'camera.unrelated_medium_resolution_channel': { state: 'recording', attributes: {} },
      'camera.garden_medium_resolution_channel': { state: 'recording', attributes: {} },
      'camera.configured_bridge': { state: 'recording', attributes: {} },
    },
  } as unknown as HomeAssistant;

  it('selects only an available medium entity from the same device', () => {
    expect(findMediumBridgeCamera(hass, 'camera.garden_high_resolution_channel')).toBe(
      'camera.garden_medium_resolution_channel',
    );
  });

  it('prefers an explicitly configured bridge', () => {
    expect(
      findMediumBridgeCamera(
        hass,
        'camera.garden_high_resolution_channel',
        'camera.configured_bridge',
      ),
    ).toBe('camera.configured_bridge');
  });
});