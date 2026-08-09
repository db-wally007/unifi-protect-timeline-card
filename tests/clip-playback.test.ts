import { describe, expect, it } from 'vitest';
import {
  clipWatchdogAction,
  isCurrentClipSource,
  isPresentedClipFrame,
} from '../src/data/clip-playback';

describe('isPresentedClipFrame', () => {
  it('accepts the requested frame even before seeking flips false', () => {
    expect(
      isPresentedClipFrame({
        mediaTime: 104.882,
        currentTime: 104.902,
        seekTarget: 104.902,
        seeking: true,
        readyState: 1,
      }),
    ).toBe(true);
  });

  it('rejects a stale pre-seek frame while seeking', () => {
    expect(
      isPresentedClipFrame({
        mediaTime: 107.046,
        currentTime: 104.902,
        seekTarget: 104.902,
        seeking: true,
        readyState: 1,
      }),
    ).toBe(false);
  });

  it('accepts an advancing current frame after the seek completes', () => {
    expect(
      isPresentedClipFrame({
        mediaTime: 106.8,
        currentTime: 106.82,
        seekTarget: 104.902,
        seeking: false,
        readyState: 4,
      }),
    ).toBe(true);
  });
});

describe('clipWatchdogAction', () => {
  it('always performs one recovery before terminating', () => {
    expect(
      clipWatchdogAction({
        recoveryAttempts: 0,
        hasFrameCallback: true,
        allowReadyStateFallback: true,
        seeking: true,
        readyState: 1,
      }),
    ).toBe('recover');
  });

  it('accepts ready-state fallback before recovery when rVFC is unavailable', () => {
    expect(
      clipWatchdogAction({
        recoveryAttempts: 0,
        hasFrameCallback: false,
        allowReadyStateFallback: true,
        seeking: false,
        readyState: 2,
      }),
    ).toBe('finish');
    expect(
      clipWatchdogAction({
        recoveryAttempts: 1,
        hasFrameCallback: false,
        allowReadyStateFallback: true,
        seeking: false,
        readyState: 2,
      }),
    ).toBe('finish');
    expect(
      clipWatchdogAction({
        recoveryAttempts: 1,
        hasFrameCallback: true,
        allowReadyStateFallback: true,
        seeking: false,
        readyState: 4,
      }),
    ).toBe('fail');
  });

  it('does not treat ready current data as recovery from a playback stall', () => {
    expect(
      clipWatchdogAction({
        recoveryAttempts: 0,
        hasFrameCallback: false,
        allowReadyStateFallback: false,
        seeking: false,
        readyState: 2,
      }),
    ).toBe('recover');
    expect(
      clipWatchdogAction({
        recoveryAttempts: 1,
        hasFrameCallback: false,
        allowReadyStateFallback: false,
        seeking: false,
        readyState: 2,
      }),
    ).toBe('fail');
  });

  it('fails after recovery when the seek is still unresolved', () => {
    expect(
      clipWatchdogAction({
        recoveryAttempts: 1,
        hasFrameCallback: false,
        allowReadyStateFallback: true,
        seeking: true,
        readyState: 1,
      }),
    ).toBe('fail');
  });
});

describe('isCurrentClipSource', () => {
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
    expect(isCurrentClipSource(valid)).toBe(true);
  });

  it('rejects every stale ownership dimension', () => {
    expect(isCurrentClipSource({ ...valid, eventVideo: {} as HTMLVideoElement })).toBe(false);
    expect(isCurrentClipSource({ ...valid, sourceToken: 6 })).toBe(false);
    expect(isCurrentClipSource({ ...valid, videoToken: 8 })).toBe(false);
    expect(isCurrentClipSource({ ...valid, sourceSession: 'old' })).toBe(false);
    expect(isCurrentClipSource({ ...valid, currentSession: 'replacement' })).toBe(false);
    expect(isCurrentClipSource({ ...valid, currentSession: undefined })).toBe(false);
    expect(isCurrentClipSource({ ...valid, expectedUrl: '' })).toBe(false);
    expect(isCurrentClipSource({ ...valid, actualUrl: 'https://example.test/old.mp4' })).toBe(false);
  });
});
