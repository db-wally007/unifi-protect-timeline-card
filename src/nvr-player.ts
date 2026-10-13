// The single-element player: ONE <video>, ONE MediaSource (ManagedMediaSource
// on iOS) for live AND recorded footage, fed with the NVR's own fMP4 streams
// through protect_cache's relay (custom_components/protect_cache/nvr_stream.py).
//
// Why one element: every hand-over between two players (the medium->high
// bridge, live->recorded, chunk A->chunk B) showed on the wall tablet as a jump
// back or forward, and the UniFi app has none. The NVR's streams carry
// WALL-CLOCK timestamps, so recorded and live fragments land on one media
// timeline (media time = wall seconds - `base`): a seek inside what is loaded
// is a native seek, a seek outside it asks the NVR for footage from that
// instant and appends it to the same buffer while the current frame stays on
// screen, and recorded playback flows into live without a seam.
//
// Measured (2026-10-12/13): a playback stream answers in ~60 ms and delivers
// 60 s of 2K footage in ~1.5 s; a live stream's first keyframe arrives
// 0.10-0.15 s after the request; Chrome, the iPhone app (iOS 26,
// ManagedMediaSource) and the wall tablet (Android WebView) all played two
// separately initialised pieces as ONE buffered range with no time jump.

import type { HomeAssistant } from './data/types';
import { signPath } from './data/ha-urls';
import { NvrDeframer, type NvrSegment } from './data/nvr-frames';
import { APPLE_WEBKIT } from './data/platform';
import { releaseVideo } from './data/media-release';

const RELAY_PATH = '/api/protect_stream/ws';

/** Media time 0 is this long before the player was made. Recordings older than
 * this cannot be shown; MSE drops frames at negative media times. */
const BASE_LOOKBACK_S = 45 * 86400;
/** Recorded footage is fetched until this far ahead of the playhead... */
const AHEAD_HIGH_S = 30;
/** ...and fetching resumes below this. */
const AHEAD_LOW_S = 12;
/** Footage kept behind the playhead (skip back, small drags) - the rest is
 * evicted. iOS gives one SourceBuffer ~105 MB (~2 min of 2K): 45 s behind +
 * 30 s ahead + flow-control overshoot stays well inside it. */
const BACK_KEEP_S = 45;
/** A loaded island further ahead than this (from an earlier seek) is dropped. */
const FAR_KEEP_S = 90;
/** Live is played this far behind the newest fragment... */
const LIVE_TARGET_S = 1.0;
/** ...and caught up when it falls this far behind (after a stall). */
const LIVE_MAX_LAG_S = 4;
/** One recorded request asks for at most this much (flow control throttles it). */
const WINDOW_MS = 10 * 60_000;
/** Footage newer than this is not asked for again until it can exist. */
const NEAR_LIVE_WAIT_MS = 1500;
/** A refused playback starting this recently is "not recorded yet", not a failure. */
const RECENT_REFUSAL_MS = 90_000;
/** How far behind real time the NVR's recorded footage is reliably available
 * (hosts use it for an ongoing event's end). */
export const RECORDED_LAG_MS = 20_000;
/** Retries per failure run; the run resets only on real playback progress. */
const RETRY_DELAYS_MS = [1000, 3000, 8000];
/** A stream that delivers nothing for this long is a failure. */
const FIRST_DATA_TIMEOUT_MS = 15_000;
/** Consecutive media fragments are merged into one append up to this size. */
const MAX_APPEND_BYTES = 4 * 1024 * 1024;
/** After its `seeked`, a presented frame from this far before the target... */
const PRESENT_TOLERANCE_S = 0.75;
/** ...to this far after it is the seek landing (playback may have moved on
 * before a slow decoder reported its first frame). */
const SETTLE_AHEAD_S = 3;
/** A landed seek (`seeked`) that has drawn nothing after this long is recovered. */
const SEEK_STALL_MS = 1200;
/** A seek target needs at least this much footage after it to be "loaded". */
const MIN_AHEAD_FOR_NATIVE_S = 0.2;
/** Stop this far before an event's end (WebKit reports time every ~250 ms). */
const END_MARGIN_MS = APPLE_WEBKIT ? 450 : 250;

type StreamKind = 'live' | 'play';

interface Stream {
  gen: number;
  kind: StreamKind;
  /** Wall-clock ms the request started at (play). */
  from: number;
  end?: number;
  opened: boolean;
  paused: boolean;
  ended: boolean;
  /** Media time of the first / last media fragment appended. */
  first: number | null;
  last: number | null;
}

type Op =
  | { t: 'init'; gen: number; data: Uint8Array; codecs: string }
  | { t: 'media'; gen: number; data: Uint8Array }
  | { t: 'remove'; start: number; end: number };

export interface NvrPlayerHooks {
  /** Every presented frame of the CURRENT seek/live switch, as wall-clock ms. */
  frame?(wallMs: number): void;
  /** Loading / settled / failed state changed. */
  change?(): void;
  /** Recorded playback reached the bound set with `setBound()` and paused. */
  boundReached?(): void;
  /** Gave up after the retry budget. */
  failed?(message: string): void;
  /** Worth writing to the HA log (the host budgets these). */
  problem?(message: string): void;
  /** Start playback (the host owns the autoplay policy: muted retry, tap-to-play). */
  play?(video: HTMLVideoElement): void;
}

/** True if this browser can run the engine at all. */
export function nvrPlayerSupported(): boolean {
  const w = window as unknown as { ManagedMediaSource?: unknown; MediaSource?: unknown };
  return !!(w.ManagedMediaSource || w.MediaSource);
}

export class NvrPlayer {
  /** Wall-clock seconds at media time 0. */
  readonly base = Math.floor(Date.now() / 1000) - BASE_LOOKBACK_S;

  private _video: HTMLVideoElement | null = null;
  private _nvrId = '';
  private _cameraId = '';
  private _channel = 0;

  private _ms: MediaSource | null = null;
  private _msUrl: string | null = null;
  private _msOpen = false;
  private _mmsStreaming = true;
  private _sb: SourceBuffer | null = null;
  private _codecs = '';
  private _ops: Op[] = [];
  private _busy = false;
  private _lastEvict = 0;
  private _quotaHold = false;

  private _ws: WebSocket | null = null;
  private _wsOpening: Promise<WebSocket> | null = null;
  private _gen = 0;
  private _stream: Stream | null = null;
  private _deframer = new NvrDeframer();
  private _firstDataTimer?: number;
  private _retryTimer?: number;
  /** A failed stream's retry is scheduled: nothing else may open one meanwhile. */
  private _retryPending = false;
  private _fails = 0;
  private _progressMark = -Infinity;
  private _idleUntil = 0;
  private _skipFrom: number | null = null;

  private _live = false;
  private _liveFirst: number | null = null;
  private _liveJoined = false;
  private _wantPlay = false;
  private _bound: number | null = null;
  private _boundHit = false;
  private _rate = 1;

  /** Bumped by every seek / live switch / source change. */
  private _epoch = 0;
  private _settled = false;
  /** Media time the current epoch is heading for (seek), or null (live). */
  private _target: number | null = null;
  /** A seek was issued and its `seeked` has not fired: frames now are old. */
  private _awaitSeeked = false;
  /** When the last `seeked` fired (performance.now()). */
  private _seekedAt = 0;
  /** Second half of a keyframe-first seek: where to go once the keyframe lands. */
  private _twoStep: number | null = null;
  /** Keyframe-first recoveries spent on the current seek. */
  private _recoveries = 0;
  /** Media times of the keyframes in what is loaded (sorted). */
  private _keys: number[] = [];
  private _lastWall: number | undefined;
  private _failedMsg: string | undefined;
  private _rvfc = 0;
  private _tickTimer?: number;
  private _destroyed = false;

  constructor(
    private readonly _hass: () => HomeAssistant | undefined,
    private readonly _hooks: NvrPlayerHooks = {},
  ) {}

  // ---- public surface ------------------------------------------------------

  get video(): HTMLVideoElement | null {
    return this._video;
  }

  /** True while following the live edge. */
  get isLive(): boolean {
    return this._live;
  }

  /** The current seek / live switch has presented its frame. */
  get settled(): boolean {
    return this._settled;
  }

  /** Waiting for footage (a seek or switch not presented yet, or a stall). */
  get loading(): boolean {
    const v = this._video;
    if (!v || this._failedMsg) return false;
    if (!this._settled) return true;
    return this._wantPlay && !v.paused && v.readyState < 3;
  }

  get failedMessage(): string | undefined {
    return this._failedMsg;
  }

  /** Recorded playback is paused at the bound set with setBound(). */
  get atBound(): boolean {
    return this._boundHit;
  }

  /**
   * Wall-clock ms of the frame on screen. While a seek is pending this is the
   * seek TARGET, so a second skip pressed before the first lands adds up.
   */
  get wallTime(): number | undefined {
    if (!this._settled && this._target != null) return (this._target + this.base) * 1000;
    return this._lastWall;
  }

  /** Bind (or re-bind) the <video>. A re-bind rebuilds at the same position. */
  attach(video: HTMLVideoElement): void {
    if (this._video === video) return;
    const prev = this._video;
    const resume = prev ? { live: this._live, wall: this.wallTime, play: this._wantPlay } : null;
    if (prev) this._unbindVideo(prev);
    this._dropMedia();
    this._video = video;
    this._bindVideo(video);
    if (resume?.live) this.live();
    else if (resume?.wall != null) this.seek(resume.wall, { play: resume.play });
  }

  /** Camera (and channel). A change drops everything loaded. */
  setSource(nvrId: string, cameraId: string, channel = 0): boolean {
    if (nvrId === this._nvrId && cameraId === this._cameraId && channel === this._channel) return false;
    this._nvrId = nvrId;
    this._cameraId = cameraId;
    this._channel = channel;
    this._stopStream();
    this._dropMedia();
    this._lastWall = undefined;
    this._epoch++;
    this._settled = false;
    this._target = null;
    return true;
  }

  /** Recorded playback stops (paused) here; nothing is fetched past it. */
  setBound(wallMs: number | null): void {
    this._bound = wallMs && wallMs > 0 ? wallMs : null;
    this._boundHit = false;
  }

  setRate(rate: number): void {
    this._rate = rate;
    if (this._video) this._video.playbackRate = rate;
  }

  /** Follow the live edge. */
  live(): void {
    if (!this._video || this._destroyed) return;
    this._failedMsg = undefined;
    this._live = true;
    this._liveFirst = null;
    this._liveJoined = false;
    this._bound = null;
    this._boundHit = false;
    this._wantPlay = true;
    this._skipFrom = null;
    this._newEpoch(null);
    this._ensureMedia();
    this._openStream('live', Date.now());
    this._hooks.change?.();
  }

  /**
   * Show the frame at `wallMs` exactly. Inside what is loaded this is a native
   * seek; outside it the NVR streams from the keyframe before `wallMs` into
   * the same buffer, and the frame on screen stays until the target presents.
   */
  seek(wallMs: number, opts: { play?: boolean } = {}): void {
    const v = this._video;
    if (!v || this._destroyed) return;
    this._failedMsg = undefined;
    if (opts.play !== undefined) this._wantPlay = opts.play;
    if (this._live && this._stream?.kind === 'live') this._stopStream();
    this._live = false;
    this._liveJoined = false;
    this._boundHit = false;
    this._skipFrom = null;
    this._idleUntil = 0;
    let t = wallMs / 1000 - this.base;
    if (this._bound != null) t = Math.min(t, (this._bound - END_MARGIN_MS) / 1000 - this.base);
    this._newEpoch(t);
    this._ensureMedia();
    const r = this._rangeAt(t);
    const loaded = !!r && r[1] - t >= MIN_AHEAD_FOR_NATIVE_S;
    const s = this._stream;
    if (s && s.kind === 'play' && !this._feeds(s, loaded ? r : null, t)) this._stopStream();
    this._awaitSeeked = true;
    v.currentTime = t;
    if (!loaded && !this._stream) this._openPlay((t + this.base) * 1000);
    if (this._wantPlay) this._play();
    else v.pause();
    this._tick();
    this._hooks.change?.();
  }

  play(): void {
    this._wantPlay = true;
    if (this._boundHit) return;
    this._play();
    this._tick();
  }

  /** Pause. Pausing LIVE leaves live: the paused frame becomes recorded footage. */
  pause(): void {
    this._wantPlay = false;
    this._video?.pause();
    if (this._live) {
      this._live = false;
      this._liveJoined = false;
      if (this._stream?.kind === 'live') this._stopStream();
      if (this._video) this._target = this._video.currentTime;
    }
    this._hooks.change?.();
  }

  /** Is this wall-clock instant loaded (so a seek to it is native)? */
  isLoaded(wallMs: number): boolean {
    const t = wallMs / 1000 - this.base;
    const r = this._rangeAt(t);
    return !!r && r[1] - t >= MIN_AHEAD_FOR_NATIVE_S;
  }

  /** Release the decoder and the socket (hidden card). The next live()/seek() rebuilds. */
  suspend(): void {
    this._stopStream();
    this._closeSocket();
    this._dropMedia();
    this._settled = false;
  }

  destroy(): void {
    this._destroyed = true;
    this.suspend();
    if (this._video) this._unbindVideo(this._video);
    this._video = null;
    clearInterval(this._tickTimer);
  }

  // ---- media source --------------------------------------------------------

  private _ensureMedia(): void {
    const v = this._video;
    if (!v || this._ms) return;
    const w = window as unknown as { ManagedMediaSource?: typeof MediaSource };
    const Managed = w.ManagedMediaSource;
    const ms = new (Managed ?? MediaSource)();
    this._ms = ms;
    this._msOpen = false;
    this._mmsStreaming = true;
    // ManagedMediaSource is only available without an AirPlay alternative.
    (v as HTMLVideoElement & { disableRemotePlayback: boolean }).disableRemotePlayback = true;
    ms.addEventListener(
      'sourceopen',
      () => {
        if (this._ms !== ms) return;
        this._msOpen = true;
        this._pump();
      },
      { once: true },
    );
    if (Managed) {
      // The UA asks us to stop / resume fetching (memory, power).
      ms.addEventListener('startstreaming', () => {
        this._mmsStreaming = true;
        this._tick();
      });
      ms.addEventListener('endstreaming', () => {
        this._mmsStreaming = false;
        this._tick();
      });
      (v as HTMLVideoElement & { srcObject: unknown }).srcObject = ms;
    } else {
      this._msUrl = URL.createObjectURL(ms);
      v.src = this._msUrl;
    }
    v.playbackRate = this._rate;
  }

  /** Detach the MediaSource and free the decoder (a detached element keeps it). */
  private _dropMedia(): void {
    this._ops = [];
    this._busy = false;
    this._sb = null;
    this._codecs = '';
    this._msOpen = false;
    this._quotaHold = false;
    if (this._ms) {
      this._ms = null;
      if (this._video) releaseVideo(this._video);
      if (this._msUrl) URL.revokeObjectURL(this._msUrl);
      this._msUrl = null;
    }
    this._liveFirst = null;
    this._liveJoined = false;
  }

  private _onSbUpdateEnd = (): void => {
    this._busy = false;
    this._extendDuration();
    this._tick();
    this._pump();
  };

  private _onSbError = (): void => {
    this._busy = false;
    const s = this._stream;
    if (s) this._streamFailed(s, 'the browser rejected the footage (SourceBuffer error)');
  };

  /** Run the next queued append/remove. */
  private _pump(): void {
    const ms = this._ms;
    if (!ms || !this._msOpen || this._busy || this._quotaHold) return;
    while (this._ops.length) {
      const op = this._ops[0];
      if (op.t !== 'remove' && op.gen !== this._gen) {
        this._ops.shift(); // superseded by a newer seek / switch
        continue;
      }
      if (op.t === 'init' && !this._prepareBuffer(op.codecs)) {
        this._ops.shift();
        return;
      }
      const sb = this._sb;
      if (!sb) {
        this._ops.shift(); // media before any init: unusable
        continue;
      }
      if (sb.updating) return;
      try {
        if (op.t === 'remove') {
          this._ops.shift();
          if (op.end > op.start) {
            this._busy = true;
            sb.remove(op.start, op.end);
            return;
          }
          continue;
        }
        let data = op.data;
        let n = 1;
        if (op.t === 'media') {
          // Merge the queued fragments of this stream into one append: live
          // arrives in 100 ms pieces, and every append costs a round trip.
          const parts = [op.data];
          let bytes = op.data.length;
          while (n < this._ops.length) {
            const next = this._ops[n];
            if (next.t !== 'media' || next.gen !== op.gen || bytes + next.data.length > MAX_APPEND_BYTES) break;
            parts.push(next.data);
            bytes += next.data.length;
            n++;
          }
          if (n > 1) {
            data = new Uint8Array(bytes);
            let o = 0;
            for (const p of parts) {
              data.set(p, o);
              o += p.length;
            }
          }
        }
        this._busy = true;
        sb.appendBuffer(data as BufferSource);
        this._ops.splice(0, n);
        return;
      } catch (err) {
        this._busy = false;
        if ((err as DOMException)?.name === 'QuotaExceededError') {
          this._onQuota();
          return;
        }
        this._ops.shift();
        const s = this._stream;
        if (s) this._streamFailed(s, `append failed: ${(err as Error)?.message ?? err}`);
        return;
      }
    }
  }

  /** Create the SourceBuffer on the first init, or switch codecs. */
  private _prepareBuffer(codecs: string): boolean {
    const ms = this._ms;
    if (!ms) return false;
    const mime = `video/mp4; codecs="${codecs}"`;
    if (this._sb) {
      if (codecs === this._codecs) return true;
      const sb = this._sb as SourceBuffer & { changeType?(t: string): void };
      if (sb.changeType && !sb.updating) {
        try {
          sb.changeType(mime);
          this._codecs = codecs;
          return true;
        } catch {
          /* fall through to a failure */
        }
      }
      const s = this._stream;
      if (s) this._streamFailed(s, `codec changed to ${codecs}`);
      return false;
    }
    const Ctor = ms.constructor as typeof MediaSource;
    if (Ctor.isTypeSupported && !Ctor.isTypeSupported(mime)) {
      this._giveUp(`This device cannot play this camera's video (${codecs}).`);
      return false;
    }
    try {
      const sb = ms.addSourceBuffer(mime);
      sb.mode = 'segments';
      sb.timestampOffset = -this.base;
      sb.addEventListener('updateend', this._onSbUpdateEnd);
      sb.addEventListener('error', this._onSbError);
      this._sb = sb;
      this._codecs = codecs;
      this._extendDuration();
      return true;
    } catch (err) {
      this._giveUp(`Could not start the player: ${(err as Error)?.message ?? err}`);
      return false;
    }
  }

  /**
   * Keep the MediaSource's duration a day past now. It otherwise only grows
   * with what has been appended, and a seek past it is CLAMPED to the
   * buffered end, where the element then waits forever (reproduced: a seek
   * two minutes ahead of everything loaded sat `seeking` at the old end
   * while the new footage arrived). Only valid while nothing is updating.
   */
  private _extendDuration(): void {
    const ms = this._ms;
    const sb = this._sb;
    if (!ms || !sb || ms.readyState !== 'open' || sb.updating) return;
    const want = Date.now() / 1000 - this.base + 86400;
    if (!Number.isNaN(ms.duration) && ms.duration >= want - 3600) return;
    try {
      ms.duration = want;
    } catch {
      return;
    }
    // A seek issued before this was clamped: aim it again.
    const v = this._video;
    if (v && !this._settled && this._target != null && Math.abs(v.currentTime - this._target) > 0.25) {
      this._awaitSeeked = true;
      v.currentTime = this._target;
    }
  }

  /** The buffer is full: drop what is behind the playhead and try again. */
  private _onQuota(): void {
    this._quotaHold = true;
    this._flow(true);
    const freed = this._queueEvict(true);
    window.setTimeout(() => {
      this._quotaHold = false;
      this._pump();
    }, freed ? 0 : 1000);
  }

  /**
   * Queue removals: footage more than BACK_KEEP_S behind the playhead, and
   * islands far ahead of it. Never the range a pending seek is heading for.
   */
  private _queueEvict(aggressive = false): boolean {
    const sb = this._sb;
    const v = this._video;
    if (!sb || !v) return false;
    const now = performance.now();
    if (!aggressive && now - this._lastEvict < 2000) return false;
    this._lastEvict = now;
    const t = v.currentTime;
    const keep = aggressive ? 4 : BACK_KEEP_S;
    const target = this._settled ? null : this._target;
    const removes: Array<[number, number]> = [];
    for (let i = 0; i < sb.buffered.length; i++) {
      const s = sb.buffered.start(i);
      const e = sb.buffered.end(i);
      if (target != null && s <= target && target <= e) continue;
      if (e < t - keep) removes.push([s, e]);
      else if (s < t - keep) removes.push([s, t - keep]);
      else if (s > t + FAR_KEEP_S) removes.push([s, e]);
    }
    if (!removes.length) return false;
    // Ahead of any append: removals free the space the append needs.
    this._ops.unshift(...removes.map(([start, end]) => ({ t: 'remove' as const, start, end })));
    return true;
  }

  // ---- streams -------------------------------------------------------------

  private _openPlay(fromWall: number): void {
    let end: number | undefined = fromWall + WINDOW_MS;
    if (this._bound != null) end = Math.min(end, this._bound);
    // Open-ended asks for "up to now"; the NVR answers exactly that.
    if (this._bound == null && end > Date.now() - 1000) end = undefined;
    this._openStream('play', fromWall, end);
  }

  private _openStream(kind: StreamKind, fromWall: number, end?: number): void {
    this._stopStream();
    const gen = ++this._gen;
    this._deframer.reset();
    const s: Stream = { gen, kind, from: fromWall, end, opened: false, paused: false, ended: false, first: null, last: null };
    this._stream = s;
    clearTimeout(this._firstDataTimer);
    this._firstDataTimer = window.setTimeout(() => {
      if (this._stream === s && s.last == null && !s.ended) this._streamFailed(s, 'the NVR sent no footage');
    }, FIRST_DATA_TIMEOUT_MS);
    this._socket().then(
      (ws) => {
        if (this._stream !== s) return;
        const msg: Record<string, unknown> = {
          op: kind,
          gen,
          nvr_id: this._nvrId,
          camera_id: this._cameraId,
          channel: this._channel,
        };
        if (kind === 'play') {
          msg.start = Math.round(fromWall);
          if (end) msg.end = Math.round(end);
        }
        ws.send(JSON.stringify(msg));
      },
      (err) => {
        if (this._stream === s) this._streamFailed(s, `relay unreachable: ${(err as Error)?.message ?? err}`);
      },
    );
  }

  /** Drop the stream in flight; anything it still sends is ignored. */
  private _stopStream(): void {
    const s = this._stream;
    if (!s) return;
    this._stream = null;
    this._gen++;
    clearTimeout(this._firstDataTimer);
    clearTimeout(this._retryTimer);
    this._retryPending = false;
    if (!s.ended && this._ws?.readyState === WebSocket.OPEN) this._ws.send(JSON.stringify({ op: 'stop' }));
  }

  /** Pause / resume the NVR (recorded only; live cannot be throttled). */
  private _flow(pause: boolean): void {
    const s = this._stream;
    if (!s || s.kind !== 'play' || s.ended || s.paused === pause) return;
    s.paused = pause;
    if (this._ws?.readyState === WebSocket.OPEN) this._ws.send(JSON.stringify({ op: pause ? 'pause' : 'resume' }));
  }

  private _socket(): Promise<WebSocket> {
    if (this._ws?.readyState === WebSocket.OPEN) return Promise.resolve(this._ws);
    if (this._wsOpening) return this._wsOpening;
    const opening = (async () => {
      const hass = this._hass();
      if (!hass) throw new Error('Home Assistant not connected');
      const signed = await signPath(hass, RELAY_PATH, 30);
      const origin =
        (hass as unknown as { auth?: { data?: { hassUrl?: string } } }).auth?.data?.hassUrl || window.location.origin;
      const url = new URL(signed, origin);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(url.toString());
      ws.binaryType = 'arraybuffer';
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error('timed out')), 10_000);
        ws.onopen = () => {
          clearTimeout(timer);
          resolve();
        };
        ws.onclose = () => {
          clearTimeout(timer);
          reject(new Error('closed (is protect_cache installed and up to date?)'));
        };
      });
      ws.onmessage = this._onMessage;
      ws.onclose = () => {
        if (this._ws !== ws) return;
        this._ws = null;
        const s = this._stream;
        if (s && !s.ended) this._streamFailed(s, 'connection to Home Assistant lost');
      };
      this._ws = ws;
      return ws;
    })();
    this._wsOpening = opening;
    opening.then(
      () => {
        if (this._wsOpening === opening) this._wsOpening = null;
      },
      () => {
        if (this._wsOpening === opening) this._wsOpening = null;
      },
    );
    return opening;
  }

  private _closeSocket(): void {
    const ws = this._ws;
    this._ws = null;
    this._wsOpening = null;
    if (ws) {
      ws.onclose = null;
      ws.onmessage = null;
      try {
        ws.close();
      } catch {
        /* already closed */
      }
    }
  }

  private _onMessage = (e: MessageEvent): void => {
    const s = this._stream;
    if (typeof e.data === 'string') {
      let m: { ev?: string; gen?: number; message?: string };
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }
      if (!s || m.gen !== s.gen) return;
      if (m.ev === 'open') {
        s.opened = true;
      } else if (m.ev === 'end') {
        s.ended = true;
        this._onStreamEnd(s);
      } else if (m.ev === 'error') {
        this._streamFailed(s, m.message || 'stream error');
      }
      return;
    }
    const buf = e.data as ArrayBuffer;
    if (!s || buf.byteLength < 4 || new DataView(buf).getUint32(0) !== s.gen) return;
    for (const seg of this._deframer.push(new Uint8Array(buf, 4))) this._accept(s, seg);
  };

  private _accept(s: Stream, seg: NvrSegment): void {
    if (seg.kind === 'init') {
      this._ops.push({ t: 'init', gen: s.gen, data: seg.data, codecs: seg.codecs });
    } else {
      if (seg.time != null) {
        const t = seg.time - this.base;
        if (s.first == null) {
          s.first = t;
          if (s.kind === 'live') this._liveFirst = t;
          clearTimeout(this._firstDataTimer);
        }
        s.last = t;
      }
      for (const k of seg.keys) this._addKey(k - this.base);
      this._ops.push({ t: 'media', gen: s.gen, data: seg.data });
    }
    this._pump();
  }

  private _onStreamEnd(s: Stream): void {
    if (this._stream !== s) return;
    clearTimeout(this._firstDataTimer);
    if (s.kind === 'live') {
      this._streamFailed(s, 'the NVR ended the live stream');
      return;
    }
    if (s.last == null) {
      // Nothing recorded in [from, end]: near live it isn't there yet (wait);
      // further back the camera was offline (continue from the end).
      if (s.end && s.end < Date.now() - 60_000) this._skipFrom = s.end / 1000 - this.base;
      else this._idleUntil = performance.now() + 2000;
    } else if (!s.end) {
      // An open-ended request ends at the recording edge: the next footage
      // takes a few seconds to exist.
      this._idleUntil = performance.now() + 3000;
    }
    this._stream = null;
    this._tick();
  }

  private _streamFailed(s: Stream, message: string): void {
    if (this._stream !== s) return;
    if (s.kind === 'play' && /refused/.test(message) && s.from > Date.now() - RECENT_REFUSAL_MS) {
      this._notRecordedYet(s);
      return;
    }
    this._hooks.problem?.(message);
    this._stopStream();
    const v = this._video;
    if (v) this._progressMark = Math.max(this._progressMark, v.currentTime);
    this._fails++;
    if (this._fails > RETRY_DELAYS_MS.length) {
      this._giveUp('This footage could not be played. Tap an event or the timeline to try again.');
      return;
    }
    const delay = RETRY_DELAYS_MS[this._fails - 1];
    clearTimeout(this._retryTimer);
    this._retryPending = true;
    this._retryTimer = window.setTimeout(() => {
      this._retryPending = false;
      if (this._destroyed || this._stream) return;
      if (this._live) this._openStream('live', Date.now());
      else this._tick();
    }, delay);
    this._hooks.change?.();
  }

  /**
   * The NVR refuses a playback that starts after its recording edge - footage
   * reaches its disk ~13-20 s after it happens (measured: a request ending
   * "10 s ago" was granted up to 19.4 s ago), and live has no history. Not a
   * failure: a pending seek lands on the nearest footage there is (the start
   * of the live buffer after a rewind from live), and playback that caught up
   * with the edge waits for it to move on.
   */
  private _notRecordedYet(s: Stream): void {
    this._stopStream();
    this._idleUntil = performance.now() + 2000;
    const v = this._video;
    if (v && !this._settled && this._target != null) {
      const next = this._nextRangeAfter(this._target);
      if (next != null) {
        this._target = next;
        this._awaitSeeked = true;
        v.currentTime = next;
      }
    }
    void s;
    this._hooks.change?.();
  }

  private _giveUp(message: string): void {
    this._stopStream();
    this._failedMsg = message;
    this._hooks.failed?.(message);
    this._hooks.change?.();
  }

  // ---- playback control loop -----------------------------------------------

  /** Range [start, end] (media s) containing t, or null. */
  private _rangeAt(t: number): [number, number] | null {
    const sb = this._sb;
    if (!sb) return null;
    const b = sb.buffered;
    for (let i = 0; i < b.length; i++) {
      if (b.start(i) - 0.05 <= t && t <= b.end(i)) return [b.start(i), b.end(i)];
    }
    return null;
  }

  /** Does this recorded stream feed the footage around t? */
  private _feeds(s: Stream, r: [number, number] | null, t: number): boolean {
    const at = s.last ?? s.from / 1000 - this.base;
    const lo = (r ? r[0] : t) - 1;
    const hi = (r ? r[1] : t) + 1;
    return at >= lo && at <= hi;
  }

  private _tick = (): void => {
    const v = this._video;
    if (!v || !this._sb || this._destroyed || this._failedMsg) return;
    if (this._live) {
      this._liveTick(v);
      this._queueEvict();
      this._pump();
      return;
    }
    // A seek made before the MediaSource had its init segment is lost: the
    // element resets to 0 when the metadata arrives. Re-apply the target only
    // when the element has clearly lost it - NOT when playback has merely
    // moved past it before the first decoded frame was reported (a slow 2K
    // decode), which re-seeking would turn into a loop that never presents.
    if (
      !this._settled &&
      this._target != null &&
      this._twoStep == null &&
      v.readyState >= 1 &&
      !v.seeking &&
      (v.currentTime < this._target - 0.25 || v.currentTime > this._target + SETTLE_AHEAD_S)
    ) {
      this._awaitSeeked = true;
      v.currentTime = this._target;
    } else if (
      !this._settled &&
      this._target != null &&
      this._twoStep == null &&
      !this._awaitSeeked &&
      !v.seeking &&
      this._recoveries < 2 &&
      performance.now() - this._seekedAt > SEEK_STALL_MS
    ) {
      this._recoverSeek(v);
    }
    const t = this._settled ? v.currentTime : (this._target ?? v.currentTime);
    const r = this._rangeAt(t);
    const s = this._stream;
    const ahead = r ? r[1] - t : 0;

    // A hole: playback sits at the end of a range and nothing is coming to
    // fill it (camera offline, or the NVR started later than asked). Step
    // over it to the next footage.
    if (!v.seeking) {
      const next = this._nextRangeAfter(r ? r[1] : t);
      const stuck = r ? r[1] - t < 0.3 : true;
      const filling = s && !s.ended && (s.last == null || (r ? s.last <= r[1] + 0.5 : s.last < t));
      if (stuck && next != null && !filling && (this._settled || (s?.first != null && s.first > t))) {
        if (!this._settled) this._target = next;
        this._awaitSeeked = true;
        v.currentTime = next;
        return;
      }
    }

    if (s?.kind === 'play' && !s.ended) {
      const throttle = !this._mmsStreaming && ahead > 2;
      if (!s.paused && (ahead > AHEAD_HIGH_S || throttle)) this._flow(true);
      else if (s.paused && ahead < AHEAD_LOW_S && !throttle) this._flow(false);
    } else if (!s && ahead < AHEAD_LOW_S && this._mmsStreaming && !this._retryPending) {
      let from = r ? r[1] : t;
      if (this._skipFrom != null && this._skipFrom > from) from = this._skipFrom;
      const boundT = this._bound != null ? this._bound / 1000 - this.base : Infinity;
      const fromWall = (from + this.base) * 1000;
      if (from < boundT - 0.3 && fromWall < Date.now() - NEAR_LIVE_WAIT_MS && performance.now() >= this._idleUntil) {
        this._openPlay(fromWall);
      }
    }
    this._queueEvict();
    this._pump();
  };

  private _nextRangeAfter(t: number): number | null {
    const sb = this._sb;
    if (!sb) return null;
    const b = sb.buffered;
    for (let i = 0; i < b.length; i++) if (b.start(i) > t + 0.05) return b.start(i);
    return null;
  }

  private _liveTick(v: HTMLVideoElement): void {
    const sb = this._sb;
    if (!sb || this._liveFirst == null) return;
    const n = sb.buffered.length;
    if (!n) return;
    const end = sb.buffered.end(n - 1);
    if (end < this._liveFirst) return;
    if (!this._liveJoined) {
      // Join once there is a little live footage: the frame on screen stays
      // until the first live frame presents.
      if (end - this._liveFirst < 0.3) return;
      this._liveJoined = true;
      this._awaitSeeked = true;
      // Land ON a keyframe (the live stream starts with one): nothing to
      // decode before the first frame, which is what stalls a seek. That is
      // at most a second or so behind the edge here, which LIVE_TARGET_S allows.
      const key = this._keyBefore(end - LIVE_TARGET_S, this._liveFirst);
      v.currentTime = key ?? this._liveFirst;
      if (this._wantPlay) this._play();
      return;
    }
    if (!v.paused && !v.seeking && end - v.currentTime > LIVE_MAX_LAG_S) v.currentTime = end - LIVE_TARGET_S;
  }

  private _newEpoch(target: number | null): void {
    this._epoch++;
    this._settled = false;
    this._target = target;
    this._twoStep = null;
    this._recoveries = 0;
  }

  private _addKey(k: number): void {
    const keys = this._keys;
    let i = keys.length;
    while (i > 0 && keys[i - 1] > k) i--;
    if ((i > 0 && Math.abs(keys[i - 1] - k) < 0.005) || (i < keys.length && Math.abs(keys[i] - k) < 0.005)) return;
    keys.splice(i, 0, k);
    // Keyframes of evicted footage are useless; keep the list short.
    if (keys.length > 400) keys.splice(0, keys.length - 400);
  }

  /** The last keyframe at or before t, not before `from` (null if unknown). */
  private _keyBefore(t: number, from: number): number | null {
    for (let i = this._keys.length - 1; i >= 0; i--) {
      const k = this._keys[i];
      if (k <= t + 0.001) return k >= from - 0.05 ? k : null;
    }
    return null;
  }

  /**
   * A seek that has to decode from a keyframe seconds back can stall in
   * MSE: `seeked` fires, the clock runs, and no new frame is ever drawn
   * (reproduced with Chrome's software decoder on these 2K and 720p streams,
   * plain MSE, no engine involved). Landing on the keyframe first and then
   * seeking FORWARD to the target plays at once. Used only as a recovery,
   * so a device that seeks directly never flashes the keyframe's picture.
   */
  private _recoverSeek(v: HTMLVideoElement): void {
    const t = this._target;
    if (t == null) return;
    const r = this._rangeAt(t);
    if (!r || r[1] - t < MIN_AHEAD_FOR_NATIVE_S) return;
    this._recoveries++;
    const k = this._keyBefore(t, r[0]);
    this._awaitSeeked = true;
    if (k != null && t - k > 0.05) {
      this._twoStep = t;
      v.currentTime = k;
    } else {
      v.currentTime = t;
    }
  }

  private _play(): void {
    const v = this._video;
    if (!v) return;
    if (this._hooks.play) this._hooks.play(v);
    else v.play().catch(() => {});
  }

  // ---- the <video> ---------------------------------------------------------

  private _bindVideo(v: HTMLVideoElement): void {
    v.addEventListener('seeked', this._onSeeked);
    v.addEventListener('timeupdate', this._onTimeUpdate);
    v.addEventListener('waiting', this._onMediaEvent);
    v.addEventListener('playing', this._onMediaEvent);
    v.addEventListener('pause', this._onMediaEvent);
    v.addEventListener('error', this._onVideoError);
    this._armFrameCallback(v);
    clearInterval(this._tickTimer);
    this._tickTimer = window.setInterval(this._tick, 250);
  }

  private _unbindVideo(v: HTMLVideoElement): void {
    v.removeEventListener('seeked', this._onSeeked);
    v.removeEventListener('timeupdate', this._onTimeUpdate);
    v.removeEventListener('waiting', this._onMediaEvent);
    v.removeEventListener('playing', this._onMediaEvent);
    v.removeEventListener('pause', this._onMediaEvent);
    v.removeEventListener('error', this._onVideoError);
    const vv = v as HTMLVideoElement & { cancelVideoFrameCallback?(h: number): void };
    if (this._rvfc && vv.cancelVideoFrameCallback) vv.cancelVideoFrameCallback(this._rvfc);
    this._rvfc = 0;
  }

  private _armFrameCallback(v: HTMLVideoElement): void {
    const vv = v as HTMLVideoElement & {
      requestVideoFrameCallback?(cb: (now: number, md: { mediaTime: number }) => void): number;
    };
    if (!vv.requestVideoFrameCallback) return;
    const cb = (_now: number, md: { mediaTime: number }): void => {
      if (this._video !== v) return;
      this._presented(md.mediaTime);
      this._rvfc = vv.requestVideoFrameCallback!(cb);
    };
    this._rvfc = vv.requestVideoFrameCallback(cb);
  }

  private _hasRvfc(): boolean {
    return !!this._video && 'requestVideoFrameCallback' in this._video;
  }

  private _onSeeked = (): void => {
    const v = this._video;
    if (v && this._twoStep != null) {
      // On the keyframe: now forward to the real target.
      const t = this._twoStep;
      this._twoStep = null;
      this._awaitSeeked = true;
      v.currentTime = t;
      return;
    }
    this._awaitSeeked = false;
    this._seekedAt = performance.now();
    // Without rVFC, a completed seek is the presentation signal.
    if (v && !this._hasRvfc()) this._presented(v.currentTime);
    this._tick();
  };

  private _onTimeUpdate = (): void => {
    const v = this._video;
    if (v && !this._hasRvfc() && !v.seeking) this._presented(v.currentTime);
  };

  private _onMediaEvent = (): void => {
    this._tick();
    this._hooks.change?.();
  };

  private _onVideoError = (): void => {
    const v = this._video;
    if (!v?.error || !this._ms) return;
    const s = this._stream;
    const message = `video error ${v.error.code}${v.error.message ? `: ${v.error.message}` : ''}`;
    // The MediaSource is dead after a decode error: rebuild it at the frame on screen.
    const wall = this.wallTime;
    const live = this._live;
    this._dropMedia();
    if (s) this._streamFailed(s, message);
    else this._hooks.problem?.(message);
    if (this._failedMsg) return;
    if (live) this.live();
    else if (wall != null) this.seek(wall);
  };

  private _presented(mediaTime: number): void {
    const v = this._video;
    if (!v) return;
    if (!this._settled) {
      // A frame from before the seek/switch (the old position) is not it.
      if (this._awaitSeeked) return;
      const ok = this._live
        ? this._liveFirst != null && mediaTime >= this._liveFirst - 0.05
        : this._target != null &&
          mediaTime >= this._target - PRESENT_TOLERANCE_S &&
          mediaTime <= this._target + SETTLE_AHEAD_S;
      if (!ok) return;
      this._settled = true;
      this._hooks.change?.();
    }
    const wall = (mediaTime + this.base) * 1000;
    this._lastWall = wall;
    if (mediaTime > this._progressMark + 1) {
      this._fails = 0;
      this._progressMark = mediaTime;
    }
    if (
      !this._live &&
      this._bound != null &&
      !this._boundHit &&
      !v.paused &&
      wall >= this._bound - END_MARGIN_MS * Math.max(1, v.playbackRate)
    ) {
      // Never let MSE reach the buffered end of an event: stop on its last frame.
      this._boundHit = true;
      this._wantPlay = false;
      v.pause();
      this._hooks.frame?.(wall);
      this._hooks.boundReached?.();
      this._hooks.change?.();
      return;
    }
    this._hooks.frame?.(wall);
  }
}
