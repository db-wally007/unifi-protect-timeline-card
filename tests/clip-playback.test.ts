import { describe, expect, it } from 'vitest';
import { clipWatchdogAction, isCurrentClipEnd } from '../src/data/clip-playback';

describe('clipWatchdogAction', () => {
  it('always performs one recovery before terminating', () => {
    expect(
      clipWatchdogAction({
        recoveryAttempts: 0,
        hasFrameCallback: true,
        seeking: true,
        readyState: 1,
      }),
    ).toBe('recover');
  });

  it('accepts ready-state fallback only when rVFC is unavailable', () => {
    expect(
      clipWatchdogAction({
        recoveryAttempts: 1,
        hasFrameCallback: false,
        seeking: false,
        readyState: 2,
      }),
    ).toBe('finish');
    expect(
      clipWatchdogAction({
        recoveryAttempts: 1,
        hasFrameCallback: true,
        seeking: false,
        readyState: 4,
      }),
    ).toBe('fail');
  });

  it('fails after recovery when the seek is still unresolved', () => {
    expect(
      clipWatchdogAction({
        recoveryAttempts: 1,
        hasFrameCallback: false,
        seeking: true,
        readyState: 1,
      }),
    ).toBe('fail');
  });
});

describe('isCurrentClipEnd', () => {
  const currentVideo = {} as HTMLVideoElement;
  const valid = {
    eventVideo: currentVideo,
    currentVideo,
    sourceToken: 7,
    videoToken: 7,
    sourceSession: 'current',
    currentSession: 'current',
    expectedUrl: 'https://example.test/clip.mp4',
    actualUrl: 'https://example.test/clip.mp4',
  };

  it('accepts only the current video, token, session, and source', () => {
    expect(isCurrentClipEnd(valid)).toBe(true);
  });

  it('rejects every stale ownership dimension', () => {
    expect(isCurrentClipEnd({ ...valid, eventVideo: {} as HTMLVideoElement })).toBe(false);
    expect(isCurrentClipEnd({ ...valid, sourceToken: 6 })).toBe(false);
    expect(isCurrentClipEnd({ ...valid, sourceSession: 'old' })).toBe(false);
    expect(isCurrentClipEnd({ ...valid, actualUrl: 'https://example.test/old.mp4' })).toBe(false);
  });
});
