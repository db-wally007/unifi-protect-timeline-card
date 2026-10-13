// `live_audio_start`: whether a live session tries to start with sound.

export type LiveAudioStart = 'auto' | 'muted';

/** Whether this LIVE session should make one best-effort automatic audio
 *  attempt. `stable`: live footage is on screen. An explicit choice wins:
 *  muted stays muted, unmuted is re-applied on every live session. */
export function shouldAttemptLiveAudio(
  mode: LiveAudioStart,
  userChoice: 'muted' | 'unmuted' | undefined,
  attempted: boolean,
  stable: boolean,
): boolean {
  if (attempted || !stable || userChoice === 'muted') return false;
  return mode === 'auto' || userChoice === 'unmuted';
}
