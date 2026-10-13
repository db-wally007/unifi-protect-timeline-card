import { describe, expect, it } from 'vitest';
import { shouldAttemptLiveAudio } from '../src/data/live-audio';

describe('shouldAttemptLiveAudio', () => {
  it('attempts auto audio once after stable video', () => {
    expect(shouldAttemptLiveAudio('auto', undefined, false, true)).toBe(true);
    expect(shouldAttemptLiveAudio('auto', undefined, true, true)).toBe(false);
  });

  it('honors explicit user choices', () => {
    expect(shouldAttemptLiveAudio('auto', 'muted', false, true)).toBe(false);
    expect(shouldAttemptLiveAudio('muted', 'unmuted', false, true)).toBe(true);
  });

  it('never attempts before video is stable', () => {
    expect(shouldAttemptLiveAudio('auto', undefined, false, false)).toBe(false);
  });
});
