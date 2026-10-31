// Talk: the device's microphone to a camera's speaker (the doorbell).
//
// The browser captures the microphone (getUserMedia: echo cancellation on, so
// the visitor's voice from this device's loudspeaker is not sent back to the
// door — the talker's OWN voice coming back is the doorbell's to cancel, and
// it only does that on its channel 1 audio, so media-view plays live from
// that channel while talking; measured 2026-10-25) and an AudioWorklet cuts
// it into 20 ms
// frames of mono signed 16-bit PCM, sent over protect_cache's talk websocket
// (custom_components/protect_cache/talk.py), which encodes each frame to what
// Protect's talkback session asks for and sends it straight to the camera.
// Measured server side: one Opus frame (~21 ms) from PCM in to RTP out.
//
// Browsers only hand out the microphone on a SECURE page (https, or localhost),
// and iOS only lets an AudioContext run if it was created in the tap itself —
// so start() makes the context before its first await.

import { signPath } from './data/ha-urls';
import type { HomeAssistant } from './data/types';
import { dbg, debugClient, debugOn } from './data/debug-log';

/** Telemetry (debug: true): the microphone level per 20 ms frame, one event a
 *  second - enough to line the talker's speech up against the doorbell's own
 *  audio when looking for an echo, without recording any sound. */
const LEVEL_BATCH = 50;

const TALK_PATH = '/api/protect_talk/ws';
const READY_TIMEOUT_MS = 10_000;

// The capture processor: 20 ms of Int16 per message, transferred, not copied.
// Inline (a Blob URL) so the card stays one file.
const WORKLET = `
class UpcTalk extends AudioWorkletProcessor {
  constructor() {
    super();
    this.n = Math.round(sampleRate / 50);
    this.buf = new Int16Array(this.n);
    this.i = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      for (let k = 0; k < ch.length; k++) {
        const s = Math.max(-1, Math.min(1, ch[k]));
        this.buf[this.i++] = s < 0 ? s * 32768 : s * 32767;
        if (this.i === this.n) {
          this.port.postMessage(this.buf.buffer, [this.buf.buffer]);
          this.buf = new Int16Array(this.n);
          this.i = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('upc-talk', UpcTalk);
`;

/** Can this camera talk? It has a speaker exactly when the UniFi Protect
 *  integration gave its device a media_player (the speaker entity). */
export function cameraCanTalk(hass: HomeAssistant | undefined, cameraId: string): boolean {
  const entities = hass?.entities;
  const device = entities?.[cameraId]?.device_id;
  if (!entities || !device) return false;
  for (const id in entities) {
    const e = entities[id];
    if (e.device_id === device && e.platform === 'unifiprotect' && id.startsWith('media_player.')) {
      return true;
    }
  }
  return false;
}

export class Talker {
  private _ws?: WebSocket;
  private _ctx?: AudioContext;
  private _stream?: MediaStream;
  private _node?: AudioWorkletNode;
  private _ended = false;
  private _levels: number[] = [];
  private _levelsAt = 0;

  /** `onEnd` runs once when talking stops for any reason; `error` is a
   *  message for the user when it stopped by itself. */
  constructor(
    private readonly _hass: HomeAssistant,
    private readonly _nvrId: string,
    private readonly _cameraId: string,
    private readonly _onEnd: (error?: string) => void,
  ) {}

  /** Microphone on, session open, audio flowing. Rejects with a message for
   *  the user (and has already cleaned up) if any step fails. */
  async start(): Promise<void> {
    const t0 = performance.now();
    dbg('talk:start', { cam: this._cameraId });
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('Talking needs Home Assistant opened over https');
      }
      const ctx = new AudioContext();
      this._ctx = ctx;
      void ctx.resume();
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          },
        });
      } catch (err) {
        const name = (err as { name?: string }).name;
        throw new Error(
          name === 'NotAllowedError'
            ? 'Microphone access was not allowed'
            : name === 'NotFoundError'
              ? 'No microphone found'
              : 'Could not open the microphone',
        );
      }
      this._stream = stream;
      if (debugOn()) {
        // What the device REALLY applied (a device may ignore echoCancellation).
        const track = stream.getAudioTracks()[0];
        const c = ctx as AudioContext & { outputLatency?: number };
        dbg('talk:mic', {
          cam: this._cameraId,
          ms: Math.round(performance.now() - t0),
          settings: track?.getSettings?.(),
          label: track?.label,
          ctxRate: ctx.sampleRate,
          baseLatency: ctx.baseLatency,
          outputLatency: c.outputLatency,
          state: ctx.state,
        });
      }
      if (this._ended) throw new Error('stopped');

      const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
      try {
        await ctx.audioWorklet.addModule(url);
      } finally {
        URL.revokeObjectURL(url);
      }
      const ws = await this._open();
      ws.send(
        JSON.stringify({
          op: 'start',
          nvr_id: this._nvrId,
          camera_id: this._cameraId,
          rate: ctx.sampleRate,
          debug: debugClient(), // telemetry: the server logs its side under this id
        }),
      );
      await this._ready(ws);
      dbg('talk:ready', { cam: this._cameraId, ms: Math.round(performance.now() - t0) });
      if (this._ended) throw new Error('stopped');

      // The node has to reach the destination to be pulled; a muted gain keeps
      // the microphone from playing back out of this device's own speaker.
      const node = new AudioWorkletNode(ctx, 'upc-talk', { numberOfInputs: 1, numberOfOutputs: 1 });
      const silent = ctx.createGain();
      silent.gain.value = 0;
      ctx.createMediaStreamSource(stream).connect(node);
      node.connect(silent).connect(ctx.destination);
      node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
        if (debugOn()) {
          if (!this._levels.length) this._levelsAt = Date.now() - 20;
          const pcm = new Int16Array(e.data);
          let sum = 0;
          for (let i = 0; i < pcm.length; i++) sum += pcm[i] * pcm[i];
          const rms = Math.sqrt(sum / Math.max(1, pcm.length)) / 32768;
          this._levels.push(Math.max(-99, Math.round(20 * Math.log10(rms + 1e-9))));
          if (this._levels.length >= LEVEL_BATCH) this._flushLevels(ws.bufferedAmount);
        }
        if (ws.readyState === WebSocket.OPEN) ws.send(e.data);
      };
      this._node = node;
      ws.onmessage = (e) => {
        const ev = typeof e.data === 'string' ? (JSON.parse(e.data) as { ev?: string; message?: string; reason?: string }) : {};
        if (ev.ev === 'error') this.stop(ev.message || 'Talking failed');
        else if (ev.ev === 'ended')
          this.stop(ev.reason === 'time limit' ? 'Talk time limit reached' : undefined);
      };
      ws.onclose = () => this.stop();
    } catch (err) {
      const message = (err as Error).message;
      dbg('talk:failed', { cam: this._cameraId, message, ms: Math.round(performance.now() - t0) });
      this._teardown();
      if (!this._ended) {
        this._ended = true;
        throw new Error(message);
      }
      throw err;
    }
  }

  /** Stop talking (idempotent). */
  stop(error?: string): void {
    if (this._ended) return;
    this._flushLevels();
    dbg('talk:stop', { cam: this._cameraId, error });
    this._ended = true;
    this._teardown();
    this._onEnd(error);
  }

  private _flushLevels(wsBuf?: number): void {
    if (!this._levels.length) return;
    dbg('talk:lv', { cam: this._cameraId, at: this._levelsAt, ms: 20, lv: this._levels.splice(0), wsBuf });
  }

  private _teardown(): void {
    const ws = this._ws;
    this._ws = undefined;
    if (ws) {
      ws.onclose = null;
      ws.onmessage = null;
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ op: 'stop' }));
        } catch {
          /* closing anyway */
        }
      }
      try {
        ws.close();
      } catch {
        /* already closed */
      }
    }
    this._node?.port.close();
    this._node?.disconnect();
    this._node = undefined;
    this._stream?.getTracks().forEach((t) => t.stop());
    this._stream = undefined;
    void this._ctx?.close().catch(() => undefined);
    this._ctx = undefined;
  }

  private async _open(): Promise<WebSocket> {
    const signed = await signPath(this._hass, TALK_PATH, 30);
    const origin =
      (this._hass as unknown as { auth?: { data?: { hassUrl?: string } } }).auth?.data?.hassUrl ||
      window.location.origin;
    const url = new URL(signed, origin);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(url.toString());
    ws.binaryType = 'arraybuffer';
    this._ws = ws;
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('Talk connection timed out')), READY_TIMEOUT_MS);
      ws.onopen = () => {
        clearTimeout(timer);
        resolve();
      };
      ws.onclose = () => {
        clearTimeout(timer);
        reject(new Error('Talk is not available (is protect_cache up to date?)'));
      };
    });
    return ws;
  }

  /** The server's answer to "start": ready (session open) or an error. */
  private _ready(ws: WebSocket): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('The camera did not answer')), READY_TIMEOUT_MS);
      ws.onmessage = (e) => {
        if (typeof e.data !== 'string') return;
        const ev = JSON.parse(e.data) as { ev?: string; message?: string };
        if (ev.ev === 'ready') {
          clearTimeout(timer);
          resolve();
        } else if (ev.ev === 'error' || ev.ev === 'ended') {
          clearTimeout(timer);
          reject(new Error(ev.message || 'Talking failed'));
        }
      };
      ws.onclose = () => {
        clearTimeout(timer);
        reject(new Error('Talk connection closed'));
      };
    });
  }
}
