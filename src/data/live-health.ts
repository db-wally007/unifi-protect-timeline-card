export type LiveAudioStart = 'auto' | 'muted';

export interface LiveHealthSample {
  identity: object;
  nowMs: number;
  currentTime: number;
  readyState: number;
  paused: boolean;
  seeking: boolean;
  videoWidth: number;
}

export interface LiveHealthStatus {
  progressing: boolean;
  continuousMs: number;
  stable: boolean;
  stalled: boolean;
}

interface VideoProgressSource {
  currentTime: number;
  getVideoPlaybackQuality?: () => { totalVideoFrames: number };
  webkitDecodedFrameCount?: number;
}

export function liveProgressValue(video: VideoProgressSource, preferFrames: boolean): number {
  if (!preferFrames) return video.currentTime;
  const qualityFrames = video.getVideoPlaybackQuality?.().totalVideoFrames;
  const webkitFrames = video.webkitDecodedFrameCount;
  if (Number.isFinite(qualityFrames) && Number.isFinite(webkitFrames)) {
    return Math.max(qualityFrames as number, webkitFrames as number);
  }
  if (Number.isFinite(qualityFrames)) return qualityFrames as number;
  if (Number.isFinite(webkitFrames)) return webkitFrames as number;
  return video.currentTime;
}

/** Tracks one video element's continuous progress without depending on the DOM. */
export class LiveHealthTracker {
  private _identity?: object;
  private _lastTime = 0;
  private _continuousSince?: number;
  private _lastProgressAt?: number;
  private _wasStable = false;

  constructor(
    private readonly _stableAfterMs: number,
    private readonly _stallAfterMs: number,
  ) {}

  reset(): void {
    this._identity = undefined;
    this._lastTime = 0;
    this._continuousSince = undefined;
    this._lastProgressAt = undefined;
    this._wasStable = false;
  }

  sample(sample: LiveHealthSample): LiveHealthStatus {
    if (sample.identity !== this._identity) {
      this._identity = sample.identity;
      this._lastTime = sample.currentTime;
      this._continuousSince = undefined;
      this._lastProgressAt = undefined;
      this._wasStable = false;
    }

    const playable =
      sample.readyState >= 3 &&
      !sample.paused &&
      !sample.seeking &&
      sample.videoWidth > 0;
    const progressing = playable && sample.currentTime > this._lastTime + 0.005;

    if (progressing) {
      if (
        this._lastProgressAt === undefined ||
        sample.nowMs - this._lastProgressAt >= this._stallAfterMs
      ) {
        this._continuousSince = sample.nowMs;
      }
      this._lastProgressAt = sample.nowMs;
    } else if (!playable && !this._wasStable) {
      this._continuousSince = undefined;
    }

    this._lastTime = sample.currentTime;
    const continuousMs =
      this._continuousSince === undefined ? 0 : sample.nowMs - this._continuousSince;
    const stable = progressing && continuousMs >= this._stableAfterMs;
    if (stable) this._wasStable = true;
    const stalled =
      this._wasStable &&
      this._lastProgressAt !== undefined &&
      sample.nowMs - this._lastProgressAt >= this._stallAfterMs;

    return { progressing, continuousMs, stable, stalled };
  }
}

/** Whether this LIVE session should make one best-effort automatic audio attempt. */
export function shouldAttemptLiveAudio(
  mode: LiveAudioStart,
  userChoice: 'muted' | 'unmuted' | undefined,
  attempted: boolean,
  stable: boolean,
): boolean {
  if (attempted || !stable || userChoice === 'muted') return false;
  return mode === 'auto' || userChoice === 'unmuted';
}
