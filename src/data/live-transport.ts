import type { HomeAssistant } from './types';

export type LiveTransport = 'auto' | 'hls' | 'webrtc';

interface NavigatorIdentity {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
}

export function isAppleMobile(identity: NavigatorIdentity): boolean {
  return (
    /iPad|iPhone|iPod/.test(identity.userAgent) ||
    (identity.platform === 'MacIntel' && (identity.maxTouchPoints ?? 0) > 1)
  );
}

export function shouldUseWebRtcLive(
  transport: LiveTransport,
  identity: NavigatorIdentity,
): boolean {
  if (transport !== 'auto') return transport === 'webrtc';
  return isAppleMobile(identity);
}

export function findMediumBridgeCamera(
  hass: HomeAssistant,
  highCameraId: string,
  configuredCameraId?: string,
): string | undefined {
  if (configuredCameraId && hass.states[configuredCameraId]) return configuredCameraId;

  const deviceId = hass.entities?.[highCameraId]?.device_id;
  if (!deviceId) return undefined;

  return Object.entries(hass.entities ?? {}).find(
    ([entityId, entry]) =>
      entityId !== highCameraId &&
      entityId.startsWith('camera.') &&
      entityId.endsWith('_medium_resolution_channel') &&
      entry.device_id === deviceId &&
      !!hass.states[entityId],
  )?.[0];
}
