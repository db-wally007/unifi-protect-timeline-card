import { describe, it, expect } from 'vitest';
import { cameraCanTalk } from '../src/talk';
import type { HomeAssistant } from '../src/data/types';

// The entity registry as the frontend has it (hass.entities): the doorbell's
// device carries a unifiprotect media_player (its speaker); a bullet's doesn't.
const hass = {
  entities: {
    'camera.g6_entry_high_resolution_channel': { device_id: 'door', platform: 'unifiprotect' },
    'media_player.doorbell_camera_speaker': { device_id: 'door', platform: 'unifiprotect' },
    'camera.garden_camera_high_resolution_channel': { device_id: 'garden', platform: 'unifiprotect' },
    'binary_sensor.garden_camera_motion': { device_id: 'garden', platform: 'unifiprotect' },
    'media_player.kitchen_speaker': { device_id: 'kitchen', platform: 'sonos' },
  },
} as unknown as HomeAssistant;

describe('cameraCanTalk', () => {
  it('is true for a camera whose device has the Protect speaker entity', () => {
    expect(cameraCanTalk(hass, 'camera.g6_entry_high_resolution_channel')).toBe(true);
  });
  it('is false for a camera without one', () => {
    expect(cameraCanTalk(hass, 'camera.garden_camera_high_resolution_channel')).toBe(false);
  });
  it('ignores a media_player from another integration on another device', () => {
    expect(cameraCanTalk(hass, 'media_player.kitchen_speaker')).toBe(false);
  });
  it('is false when the registry or the camera is unknown', () => {
    expect(cameraCanTalk(undefined, 'camera.x')).toBe(false);
    expect(cameraCanTalk(hass, 'camera.unknown')).toBe(false);
  });
});
