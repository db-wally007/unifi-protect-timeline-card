export type ClipWatchdogAction = 'recover' | 'finish' | 'fail';

export function isPresentedClipFrame(options: {
  mediaTime: number;
  currentTime: number;
  seekTarget: number;
  seeking: boolean;
  readyState: number;
  tolerance?: number;
}): boolean {
  const tolerance = options.tolerance ?? 0.75;
  const atRequestedTarget = Math.abs(options.mediaTime - options.seekTarget) <= tolerance;
  const atCurrentPlayback =
    !options.seeking &&
    options.readyState >= 2 &&
    Math.abs(options.mediaTime - options.currentTime) <= tolerance;
  return atRequestedTarget || atCurrentPlayback;
}

export function clipWatchdogAction(options: {
  recoveryAttempts: number;
  hasFrameCallback: boolean;
  allowReadyStateFallback: boolean;
  seeking: boolean;
  readyState: number;
}): ClipWatchdogAction {
  if (
    options.allowReadyStateFallback &&
    !options.hasFrameCallback &&
    !options.seeking &&
    options.readyState >= 2
  ) {
    return 'finish';
  }
  if (options.recoveryAttempts === 0) return 'recover';
  return 'fail';
}

export function isCurrentClipSource(options: {
  eventVideo: HTMLVideoElement | null;
  currentVideo: HTMLVideoElement | undefined;
  sourceToken: number;
  videoToken: number;
  sourceSession?: string;
  currentSession?: string;
  expectedUrl: string;
  actualUrl: string;
}): boolean {
  return (
    !!options.eventVideo &&
    options.eventVideo === options.currentVideo &&
    options.sourceToken === options.videoToken &&
    !!options.currentSession &&
    options.sourceSession === options.currentSession &&
    !!options.expectedUrl &&
    options.actualUrl === options.expectedUrl
  );
}
