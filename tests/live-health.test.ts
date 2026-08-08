import { describe, expect, it } from 'vitest';
import {
  LiveHealthTracker,
  liveProgressValue,
  shouldRetryLiveStartup,
  shouldAttemptLiveAudio,
  type LiveHealthSample,
} from '../src/data/live-health';

const videoA = {};
const videoB = {};

function sample(
  nowMs: number,
  currentTime: number,
  overrides: Partial<LiveHealthSample> = {},
): LiveHealthSample {
  return {
    identity: videoA,
    nowMs,
    currentTime,
    readyState: 4,
    paused: false,
    seeking: false,
    videoWidth: 2688,
    ...overrides,
  };
}

describe('LiveHealthTracker', () => {
  it('requires sustained progress before reporting stable', () => {
    const tracker = new LiveHealthTracker(750, 1500);
    expect(tracker.sample(sample(0, 0)).stable).toBe(false);
    expect(tracker.sample(sample(250, 0.25)).stable).toBe(false);
    expect(tracker.sample(sample(750, 0.75)).stable).toBe(false);
    expect(tracker.sample(sample(1000, 1)).stable).toBe(true);
  });

  it('reports a stall only after a previously stable video stops progressing', () => {
    const tracker = new LiveHealthTracker(500, 1000);
    tracker.sample(sample(0, 0));
    tracker.sample(sample(250, 0.25));
    expect(tracker.sample(sample(750, 0.75)).stable).toBe(true);
    expect(tracker.sample(sample(1500, 0.75)).stalled).toBe(false);
    expect(tracker.sample(sample(1750, 0.75)).stalled).toBe(true);
  });

  it('resets progress when the video element identity changes', () => {
    const tracker = new LiveHealthTracker(500, 1000);
    tracker.sample(sample(0, 0));
    tracker.sample(sample(250, 0.25));
    expect(tracker.sample(sample(750, 0.75)).stable).toBe(true);
    expect(
      tracker.sample(sample(800, 0, { identity: videoB })).stable,
    ).toBe(false);
  });

  it('does not count paused or undecoded samples as progress', () => {
    const tracker = new LiveHealthTracker(500, 1000);
    tracker.sample(sample(0, 0));
    expect(tracker.sample(sample(600, 1, { paused: true })).progressing).toBe(false);
    expect(tracker.sample(sample(1200, 2, { readyState: 1 })).stable).toBe(false);
  });
});

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

describe('liveProgressValue', () => {
  it('uses decoded frames for WebRTC health', () => {
    expect(
      liveProgressValue(
        {
          currentTime: 20,
          getVideoPlaybackQuality: () => ({ totalVideoFrames: 600 }),
        },
        true,
      ),
    ).toBe(600);
  });

  it('keeps media time for HLS and as the WebRTC fallback', () => {
    expect(liveProgressValue({ currentTime: 20 }, false)).toBe(20);
    expect(liveProgressValue({ currentTime: 20 }, true)).toBe(20);
  });

  it('uses Safari decoded frames when playback quality remains zero', () => {
    expect(
      liveProgressValue(
        {
          currentTime: 20,
          getVideoPlaybackQuality: () => ({ totalVideoFrames: 0 }),
          webkitDecodedFrameCount: 42,
        },
        true,
      ),
    ).toBe(42);
  });
});

describe('shouldRetryLiveStartup', () => {
  it('retries nonfatal player errors on bounded backoff', () => {
    expect(shouldRetryLiveStartup('Stream never started', false, 0, 749)).toBe(false);
    expect(shouldRetryLiveStartup('Stream never started', false, 0, 750)).toBe(true);
    expect(shouldRetryLiveStartup('Stream never started', false, 1, 1_499)).toBe(false);
    expect(shouldRetryLiveStartup('Stream never started', false, 1, 1_500)).toBe(true);
    expect(shouldRetryLiveStartup('Stream never started', false, 2, 3_000)).toBe(true);
  });

  it('does not retry fatal, absent, or exhausted errors', () => {
    expect(shouldRetryLiveStartup(undefined, false, 0, 10_000)).toBe(false);
    expect(shouldRetryLiveStartup('Unsupported', true, 0, 10_000)).toBe(false);
    expect(shouldRetryLiveStartup('Stream never started', false, 3, 10_000)).toBe(false);
  });
});
