export type ClipWatchdogAction = 'recover' | 'finish' | 'fail';

export function clipWatchdogAction(options: {
  recoveryAttempts: number;
  hasFrameCallback: boolean;
  seeking: boolean;
  readyState: number;
}): ClipWatchdogAction {
  if (options.recoveryAttempts === 0) return 'recover';
  if (!options.hasFrameCallback && !options.seeking && options.readyState >= 2) return 'finish';
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
