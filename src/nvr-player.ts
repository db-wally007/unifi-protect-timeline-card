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
import { dbg, dbgDecodeInfo, debugOn } from './data/debug-log';

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
/** Live is played this far behind the newest fragment, played slightly fast
 * when more than LIVE_BAND_S past it (it otherwise drifted ~5 ms/s later and
 * never recovered a stall: 0.54 -> 1.69 s in 40 s, measured 2026-10-22)... */
const LIVE_TARGET_S = 1.0;
const LIVE_BAND_S = 0.75;
/** ...and jumped to the newest keyframe when this far behind (after a stall). */
const LIVE_MAX_LAG_S = 4;
/** From Talk on (`setLowLatency`) live is held this close to the newest
 * fragment instead: the visitor's reply is the other half of the delay in a
 * conversation. Measured 2026-10-22 in Chrome: plain live sat ~0.6 s behind
 * the camera and drifted ~5 ms/s later until LIVE_MAX_LAG_S. Footage arrives
 * every ~133 ms but p99 286 ms / max 383 ms apart, and a 0.3 s target ran dry
 * on those (1.5 s of stalls in 40 s); this rides them out (0 stalls)... */
const TALK_TARGET_S = 0.45;
/** ...played slightly fast (pitch preserved) while more than this past it... */
const TALK_BAND_S = 0.15;
/** Catch-up speeds: more than 2 s behind target, the faster one. */
const CATCHUP_RATE = 1.1;
const FAST_CATCHUP_RATE = 1.25;
/** ...and jumped to when further behind than this (Talk pressed after a drift). */
const TALK_JUMP_S = 1.0;
/** A live join that has drawn nothing this long after its seek is aimed again... */
const LIVE_JOIN_STALL_MS = 2500;
/** ...live that stopped moving for this long while footage still arrives too... */
const LIVE_STALL_MS = 3000;
/** ...and after this many re-aims without a frame, live is restarted from scratch
 * (a fresh stream into a fresh buffer). */
const LIVE_MAX_REJOINS = 2;
/** One recorded request asks for at most this much (flow control throttles it). */
const WINDOW_MS = 10 * 60_000;
/** Footage newer than this is not asked for again until it can exist. */
const NEAR_LIVE_WAIT_MS = 1500;
/** A refused playback starting this recently is "not recorded yet", not a failure. */
const RECENT_REFUSAL_MS = 90_000;
/** How far behind real time the NVR's recorded footage is reliably available
 * (hosts use it for an ongoing event's end). */
export const RECORDED_LAG_MS = 20_000;
/** Recorded footage this old is always playable, and playback from it never
 * catches up with the NVR's edge. That edge advances in JUMPS as recording
 * segments close - measured 2026-10-26 (garage camera, probed every ~2 s for
 * 70 s): it trails real time by ~12 s right after a jump, falls behind to
 * ~35 s, then jumps again, every ~34 s. So a request "20 s ago" was refused
 * about half the time, and recorded playback nearer live than this runs into
 * the frozen edge and stalls until the next jump. Footage newer than this
 * comes from the live session's own stream (timeshift) or, from before the
 * session, its backfill (BACKFILL_MS) instead. */
export const RECORDED_SAFE_MS = 36_000;
/** A seek back into the LIVE session's own footage keeps the live stream
 * running ("timeshift"): it keeps filling the buffer ahead, so playback behind
 * live never runs into footage the NVR has not recorded yet, and going live
 * again rejoins the same stream. Once the playhead is this far behind the live
 * edge (paused, or rewound further) the stream stops - the buffer would only
 * grow - and, being past RECORDED_SAFE_MS, everything after it is fetched from
 * the recordings without ever waiting. 45 s behind + 45 s ahead of 2K is
 * ~75 MB, inside iOS's ~105 MB per SourceBuffer. */
const TIMESHIFT_MAX_S = 45;
/** A seek the NVR refuses as "not recorded yet" is asked again this much
 * further back, up to this many times - never landing LATER than asked. */
const NOTYET_STEP_S = 5;
const NOTYET_MAX_STEPS = 3;
/** History behind a live session ("backfill"). Live has none, and the NVR
 * only ACCEPTS a playback starting behind its saw-toothing accept edge (up to
 * ~35 s) - but a playback started there does not stop at that edge: it keeps
 * delivering the recording, one whole GOP (5 s on these cameras) ~5-8 s after
 * that GOP ends (measured 2026-10-26, garage; the stream never ends). So when
 * a live session starts, a playback on a SECOND relay socket fetches the
 * BACKFILL_MS before it and follows the recording until it meets the
 * session's first keyframe. A skip back from a young session then lands
 * exactly - at worst after a few seconds' wait for that GOP - where it used to
 * land ~36 s back (or, before that, on the session's start: "skip back did
 * nothing"). Footage older than this is always accepted from the NVR, so
 * after this long into the session the backfill is dropped.
 *
 * Its footage is kept OUT of the buffer while live plays: a SourceBuffer
 * takes one stream at a time - after another stream's append, MSE drops the
 * next fragments' video until a keyframe (a decode discontinuity), and
 * Chrome still reports the range as continuous. Interleaved with live it
 * froze live for up to a GOP and left seeks into the backfill drawing
 * nothing (measured 2026-10-26). It goes in only when the playhead is behind
 * the live GOP being built - see _planBackfillAppend. */
const BACKFILL_MS = RECORDED_SAFE_MS + 4_000;
/** A seek waiting for backfill footage longer than this gives up on it. */
const BACKFILL_WAIT_MS = 12_000;
/** A backfill that has delivered nothing this long is asked again (its first
 * footage comes 0.1-0.3 s after the request)... */
const BACKFILL_FIRST_DATA_MS = 4_000;
/** ...and one that has had nothing new this long: it tails the recording in
 * flushes up to ~10 s apart (measured 2026-10-26), and twice in ~100
 * sessions it went silent after its first burst - the skip waiting on it
 * fell back after 12 s. */
const BACKFILL_STALL_MS = 11_000;
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

/** <video> events recorded with `debug: true`. */
const DBG_VIDEO_EVENTS = ['waiting', 'stalled', 'playing', 'pause', 'seeking', 'seeked', 'error', 'emptied', 'ended', 'loadedmetadata', 'resize'];

interface Stream {
  gen: number;
  kind: StreamKind;
  /** The camera channel it streams. */
  channel: number;
  /** performance.now() when it was asked for (telemetry). */
  askedAt: number;
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

/** The backfill (see BACKFILL_MS): a playback on its own relay socket. */
interface Backfill {
  ws: WebSocket | null;
  /** Its stream is on (until it meets live, fails or is stopped). */
  running: boolean;
  /** Its request on its own socket (bumped per retry), when it was sent,
   *  and when footage last arrived (or it was sent). */
  gen: number;
  askedAt: number;
  lastDataAt: number;
  /** Wall-clock ms it asks from (moves back on a "not recorded yet"). */
  from: number;
  /** Where it ends: the live session's first keyframe (media s). */
  session: number;
  deframer: NvrDeframer;
  /** "Not recorded yet" refusals, each asked NOTYET_STEP_S further back. */
  steps: number;
  /** Requests asked again after delivering nothing (BACKFILL_STALL_MS). */
  retries: number;
  /** Its latest connection attempt (a retry supersedes one still opening). */
  conn: number;
  init: InitOp | null;
  /** Delivered, not in the buffer yet. */
  held: Array<{ data: Uint8Array; time: number; end: number }>;
  /** Media time its delivered footage reaches. */
  end: number | null;
}

type InitOp = { t: 'init'; gen: number; data: Uint8Array; codecs: string };
type MediaOp = {
  t: 'media';
  gen: number;
  data: Uint8Array;
  /** Its first keyframe (media s), if it has one. */
  key?: number;
  /** Only its frames ending by this media time go in (appendWindowEnd). */
  windowEnd?: number;
};
type Op = InitOp | MediaOp | { t: 'remove'; start: number; end: number };

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
  /** The backfill's footage going in (see _planBackfillAppend): runs before
   *  `_ops`, start to end, so no live fragment lands in the middle of it. */
  private _bfOps: Op[] = [];
  /** The init last appended from `_ops`. */
  private _initMain: InitOp | null = null;
  /** The live GOP being built: appended from its keyframe's fragment on. */
  private _liveGop: { start: number; ops: MediaOp[] } | null = null;
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
  /** The live session's first keyframe: where its footage starts in the buffer. */
  private _liveKey0: number | null = null;
  private _liveJoined = false;
  /** When the live join's seek was issued (performance.now()). */
  private _joinAt = 0;
  /** Live watchdog: the last media time seen moving, when, and re-aims spent. */
  private _liveMovedCt = -1;
  private _liveMovedAt = 0;
  private _rejoins = 0;
  /** Watchdog restarts since live last moved (or since `live()` was asked for). */
  private _liveRestarts = 0;
  private _wantPlay = false;
  private _bound: number | null = null;
  private _boundHit = false;
  private _rate = 1;
  private _lowLatency = false;
  /** Channel live is played from when not `_channel` (see setLiveChannel). */
  private _liveChannel: number | null = null;

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
  /** "Not recorded yet" refusals of the current seek, each asked further back. */
  private _notYetSteps = 0;
  /** The backfill (see BACKFILL_MS), and the live session one was last started for. */
  private _bf: Backfill | null = null;
  private _bfFor: number | null = null;
  /** A seek the backfill could not serve, aimed again: from the NVR only. */
  private _viaNvr = false;
  /** Media times of the keyframes in what is loaded (sorted). */
  private _keys: number[] = [];
  private _lastWall: number | undefined;
  private _failedMsg: string | undefined;
  private _rvfc = 0;
  private _tickTimer?: number;
  private _destroyed = false;
  /** When the current epoch (seek / live switch) began, and the last snapshot (telemetry). */
  private _epochAt = 0;
  private _snapAt = 0;

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
    this._stopBackfill('camera changed');
    this._bfFor = null;
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

  /** Play LIVE from another of the camera's channels than recordings (which
   *  exist only on channel 0); null = the same. Takes effect at the next
   *  `live()` - or, behind live, at the next seek (the live stream filling
   *  ahead restarts on it) - into the same buffer: the timeline is wall
   *  clock, so the new channel's footage lands where the old one's would, and
   *  the frame on screen stays until its first frame presents. */
  setLiveChannel(ch: number | null): void {
    if (ch === this._liveChannel) return;
    this._liveChannel = ch;
    this._log('liveChannel', { ch });
  }

  /** Hold live as close to real time as is safe (on from Talk until the live
   *  session ends). Off restores the normal rate; the lag stays where it is. */
  setLowLatency(on: boolean): void {
    if (this._lowLatency === on) return;
    this._lowLatency = on;
    if (!on && this._video) this._video.playbackRate = this._rate;
  }

  /** Follow the live edge. */
  live(): void {
    this._log('live');
    this._liveRestarts = 0;
    this._goLive();
  }

  private _goLive(): void {
    if (!this._video || this._destroyed) return;
    // Behind live in the live session's own footage (timeshift), its stream
    // still running on the wanted channel: back to its edge, same stream - the
    // session's history stays in the buffer for the next skip back.
    if (this._liveStreaming() && this._stream!.channel === (this._liveChannel ?? this._channel)) {
      this._log('resumeLive');
      this._failedMsg = undefined;
      this._live = true;
      this._liveJoined = false;
      this._rejoins = 0;
      this._bound = null;
      this._boundHit = false;
      this._wantPlay = true;
      this._skipFrom = null;
      this._newEpoch(null);
      this._tick(); // joins at once: no stale frame can settle the switch first
      this._hooks.change?.();
      return;
    }
    this._failedMsg = undefined;
    this._live = true;
    this._liveFirst = null;
    this._liveKey0 = null;
    this._liveJoined = false;
    this._rejoins = 0;
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
    let t = wallMs / 1000 - this.base;
    if (this._bound != null) t = Math.min(t, (this._bound - END_MARGIN_MS) / 1000 - this.base);
    // Into the live session's own footage - or other footage still loaded not
    // far behind its edge (an earlier session's: playback steps over the hole
    // into this one's) - the live stream keeps running (timeshift, see
    // TIMESHIFT_MAX_S). Anywhere else it stops.
    const timeshift = this._keepLiveFor(t);
    this._log('seek', { to: Math.round(wallMs), play: opts.play, timeshift });
    if (this._stream?.kind === 'live' && !timeshift) this._stopStream();
    this._live = false;
    this._liveJoined = false;
    v.playbackRate = this._rate; // a low-latency catch-up must not carry into recordings
    this._boundHit = false;
    this._skipFrom = null;
    this._idleUntil = 0;
    this._newEpoch(t);
    this._ensureMedia();
    // Behind live on another channel than the wanted one (Talk's, after the
    // host went back to the normal one): the live stream that fills ahead
    // restarts on it, into the same buffer - what is loaded, the backfill
    // and `_liveFirst` (until the new stream's first fragment) all stay.
    const ls = this._stream;
    if (timeshift && ls?.kind === 'live' && ls.channel !== (this._liveChannel ?? this._channel)) {
      this._log('timeshiftChannel', { from: ls.channel });
      this._openStream('live', Date.now());
    }
    const r = this._rangeAt(t);
    const loaded = !!r && r[1] - t >= MIN_AHEAD_FOR_NATIVE_S;
    const s = this._stream;
    if (s && s.kind === 'play' && !this._feeds(s, loaded ? r : null, t)) this._stopStream();
    this._awaitSeeked = true;
    v.currentTime = t;
    if (!loaded && !this._stream) {
      if (!this._viaNvr && this._behindLiveReach(t)) {
        // Too recent for the NVR to start a playback there (RECORDED_SAFE_MS):
        // the live stream and its backfill deliver it, as right after opening
        // a camera - the live stream fills ahead, the backfill starts with
        // its first keyframe (_accept).
        this._log('behindLive', { at: this._wall(t) });
        this._openStream('live', Date.now());
      } else {
        this._openPlay((t + this.base) * 1000);
      }
    }
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

  /** Pause. Pausing LIVE leaves live: the paused frame becomes recorded
   *  footage - with the live stream still filling behind it (timeshift), so
   *  play carries on from the paused frame and live is rejoined in the same
   *  stream; it stops once the frame is TIMESHIFT_MAX_S behind. */
  pause(): void {
    this._log('pause', { live: this._live });
    this._wantPlay = false;
    this._video?.pause();
    if (this._live) {
      this._live = false;
      this._liveJoined = false;
      if (this._video) this._video.playbackRate = this._rate;
      if (this._video) this._target = this._video.currentTime;
    }
    this._hooks.change?.();
  }

  /** Is this wall-clock instant loaded (so a seek to it is native)? */
  isLoaded(wallMs: number): boolean {
    return this._loadedAt(wallMs / 1000 - this.base);
  }

  /** Media time t is loaded, with a little footage after it. */
  private _loadedAt(t: number): boolean {
    const r = this._rangeAt(t);
    return !!r && r[1] - t >= MIN_AHEAD_FOR_NATIVE_S;
  }

  /** Does a seek to media time t keep the live stream running (timeshift)? In
   *  the live session's footage, in what its backfill holds or delivers (or
   *  will, once it starts), or in other footage still loaded not far behind
   *  its edge. */
  private _keepLiveFor(t: number): boolean {
    const s = this._stream;
    if (!s || s.kind !== 'live' || s.ended) return false;
    const reach = !this._viaNvr && this._behindLiveReach(t);
    if (this._liveFirst == null) return reach; // just asked for
    if (this._inLiveSession(t) || (!this._viaNvr && this._bfWillFill(t))) return true;
    if (this._bfStarting() && reach) return true;
    const lr = this._liveRange();
    return !!lr && this._loadedAt(t) && lr[1] - t <= TIMESHIFT_MAX_S;
  }

  /** Media time t is recent enough that the NVR may refuse a playback starting
   *  there (RECORDED_SAFE_MS), but within what a backfill covers: the live
   *  stream and its backfill deliver it exactly (see BACKFILL_MS). */
  private _behindLiveReach(t: number): boolean {
    const age = Date.now() - (t + this.base) * 1000;
    return age > 0 && age <= BACKFILL_MS - 3_000;
  }

  /** The live stream's backfill is still to start: no footage yet to place
   *  it, or not started for this session. */
  private _bfStarting(): boolean {
    return !this._bf && (this._liveFirst == null || this._bfFor !== this._liveFirst);
  }

  /** Can a seek reach this instant exactly - loaded, delivered behind live
   *  (its session's stream or backfill), or recent enough to be fetched that
   *  way (a seek there starts the live stream and its backfill)? */
  isAvailable(wallMs: number): boolean {
    const t = wallMs / 1000 - this.base;
    return this.isLoaded(wallMs) || this.timeshiftable(wallMs) || this._behindLiveReach(t);
  }

  /** Is this instant playable behind live on the running live stream and its
   *  backfill - never waiting on the NVR's accept edge (timeshift)? */
  timeshiftable(wallMs: number): boolean {
    return this._keepLiveFor(wallMs / 1000 - this.base);
  }

  /** The live stream is running (live, or timeshifted behind it). */
  private _liveStreaming(): boolean {
    const s = this._stream;
    return !!s && s.kind === 'live' && !s.ended && this._liveFirst != null;
  }

  /** Media time t is in the running live session's footage (from its first
   *  keyframe on), so its stream delivers it - nothing to ask the NVR for. */
  private _inLiveSession(t: number): boolean {
    return this._liveStreaming() && t >= (this._liveKey0 ?? this._liveFirst!) - 0.05;
  }

  /** Release the decoder and the socket (hidden card). The next live()/seek() rebuilds. */
  suspend(): void {
    this._log('suspend');
    this._stopBackfill('suspended');
    this._bfFor = null;
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
    if (debugOn()) {
      for (const type of ['sourceopen', 'sourceended', 'sourceclose']) {
        ms.addEventListener(type, () => this._log(`ms:${type}`, { current: this._ms === ms }));
      }
    }
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
    this._stopBackfill('media dropped'); // it serves the session in this buffer
    this._ops = [];
    this._bfOps = [];
    this._initMain = null;
    this._liveGop = null;
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
    this._liveKey0 = null;
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

  /** Run the next queued append/remove: a backfill append in progress first
   *  (to its end - see _planBackfillAppend; evictions may cut in, a quota
   *  error needs them), then the stream's. */
  private _pump(): void {
    const ms = this._ms;
    if (!ms || !this._msOpen || this._busy || this._quotaHold) return;
    if (!this._bfOps.length) this._planBackfillAppend();
    for (;;) {
      const bf = this._bfOps.length > 0 && this._ops[0]?.t !== 'remove';
      const q = bf ? this._bfOps : this._ops;
      if (!q.length) return;
      const op = q[0];
      if (!bf && op.t !== 'remove' && op.gen !== this._gen) {
        q.shift(); // superseded by a newer seek / switch
        continue;
      }
      if (op.t === 'init' && !this._prepareBuffer(op.codecs)) {
        q.shift();
        return;
      }
      const sb = this._sb;
      if (!sb) {
        q.shift(); // media before any init: unusable
        continue;
      }
      if (sb.updating) return;
      try {
        if (op.t === 'remove') {
          q.shift();
          if (op.end > op.start) {
            this._busy = true;
            sb.remove(op.start, op.end);
            return;
          }
          continue;
        }
        const windowEnd = (op.t === 'media' && op.windowEnd) || Infinity;
        if (sb.appendWindowEnd !== windowEnd) sb.appendWindowEnd = windowEnd;
        let data = op.data;
        let n = 1;
        if (op.t === 'media') {
          // Merge the queued fragments of this stream into one append: live
          // arrives in 100 ms pieces, and every append costs a round trip.
          const parts = [op.data];
          let bytes = op.data.length;
          while (n < q.length) {
            const next = q[n];
            if (next.t !== 'media' || next.gen !== op.gen || next.windowEnd || op.windowEnd) break;
            if (bytes + next.data.length > MAX_APPEND_BYTES) break;
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
          if (!bf) this._trackLiveGop(q.slice(0, n) as MediaOp[]);
        } else if (!bf) {
          this._initMain = op;
        }
        this._busy = true;
        sb.appendBuffer(data as BufferSource);
        q.splice(0, n);
        return;
      } catch (err) {
        this._busy = false;
        if ((err as DOMException)?.name === 'QuotaExceededError') {
          this._onQuota();
          return;
        }
        q.shift();
        // A backfill append that fails is lost footage, nothing more: the
        // rest of it - the live GOP put back - still has to go in.
        if (bf) {
          this._log('bf:appendFailed', { message: (err as Error)?.message ?? String(err) });
          continue;
        }
        const s = this._stream;
        if (s) this._streamFailed(s, `append failed: ${(err as Error)?.message ?? err}`);
        return;
      }
    }
  }

  /** Remember the live GOP being built, from its keyframe's fragment on
   *  (the backfill puts it back after its own footage). */
  private _trackLiveGop(ops: MediaOp[]): void {
    const s = this._stream;
    if (!s || s.kind !== 'live' || ops[0]?.gen !== s.gen) return;
    for (const op of ops) {
      if (op.key != null) this._liveGop = { start: op.key, ops: [op] };
      else if (this._liveGop && this._liveGop.ops.length < 600) this._liveGop.ops.push(op);
      else this._liveGop = null; // no keyframe in sight: nothing to put back
    }
  }

  /**
   * Put the backfill's delivered footage into the buffer - only while the
   * playhead (or the seek heading for it) is behind the live GOP being built,
   * since that GOP has to go back in after it: MSE takes one stream at a
   * time, and live fragments appended after the backfill would lose their
   * video until the next live keyframe (see BACKFILL_MS). So: remove the
   * current live GOP, append the backfill (its fragments are whole GOPs,
   * each from a keyframe), then the GOP again from its keyframe - and live
   * carries on seamlessly from there. While live plays, it waits; and only
   * what the playhead needs goes in (from its GOP on - ~4 MB a GOP).
   */
  private _planBackfillAppend(): void {
    const bf = this._bf;
    const v = this._video;
    const gop = this._liveGop;
    const s = this._stream;
    if (!bf || !bf.held.length || !v || this._live || !gop || !this._initMain) return;
    if (!s || s.kind !== 'live' || s.ended || gop.ops[0].gen !== s.gen) return;
    const at = this._settled ? v.currentTime : (this._target ?? v.currentTime);
    if (at > gop.start - 0.5 || at > bf.session + 1) return;
    const take = bf.held.filter((h) => h.end > at - 0.05);
    if (!take.length) return;
    // Live on another codec (Talk's channel): the buffer switches between
    // them, which needs changeType.
    const sb = this._sb as (SourceBuffer & { changeType?(t: string): void }) | null;
    if (bf.init && bf.init.codecs !== this._initMain.codecs && !sb?.changeType) {
      this._stopBackfill('no changeType');
      return;
    }
    bf.held = bf.held.filter((h) => h.end <= at - 0.05); // earlier: for a later skip back
    const ops: Op[] = [{ t: 'remove', start: gop.start - 0.0005, end: Infinity }];
    if (bf.init) ops.push(bf.init);
    for (const h of take) {
      // The GOP reaching into the session: only its part before the session's
      // first keyframe (the rest would overwrite live frames and orphan the
      // live frames after them).
      ops.push({ t: 'media', gen: -1, data: h.data, windowEnd: h.end > bf.session ? bf.session : undefined });
    }
    ops.push(this._initMain, ...gop.ops);
    this._log('bf:append', {
      from: this._wall(take[0].time),
      to: this._wall(take[take.length - 1].end),
      gops: take.length,
      live: gop.ops.length,
    });
    this._bfOps = ops;
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
    this._log('quota', { ranges: this._rangesWall() });
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
    // Until live has joined, the playhead still stands where it was - minutes
    // back after a scrub, 0 in a fresh buffer - so the new live footage looks
    // like a far island. Evicting it removed its first keyframe, the join
    // then sought into the hole and waited forever while MSE dropped
    // everything up to the next keyframe 5 s later (reproduced 2026-10-25:
    // 3 of 16 scrub -> live joins hung, every one right after such a remove).
    const joining = this._live && !this._liveJoined;
    if (joining && !aggressive) return false;
    const now = performance.now();
    if (!aggressive && now - this._lastEvict < 2000) return false;
    this._lastEvict = now;
    const t = v.currentTime;
    const keep = aggressive ? 4 : BACK_KEEP_S;
    const target = this._settled ? null : this._target;
    const liveFrom = joining && this._liveFirst != null ? this._liveFirst - 0.1 : null;
    const removes: Array<[number, number]> = [];
    for (let i = 0; i < sb.buffered.length; i++) {
      const s = sb.buffered.start(i);
      const e = sb.buffered.end(i);
      if (target != null && s <= target && target <= e) continue;
      if (liveFrom != null && e >= liveFrom) continue; // never the live footage being joined
      if (e < t - keep) removes.push([s, e]);
      else if (s < t - keep) removes.push([s, t - keep]);
      else if (s > t + FAR_KEEP_S) removes.push([s, e]);
    }
    if (!removes.length) return false;
    if (debugOn()) {
      this._log('evict', {
        aggressive,
        ct: this._wall(t),
        removes: removes.map(([a, b]) => [this._wall(a), this._wall(b)]),
      });
    }
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
    this._stopStream(kind === 'live');
    const gen = ++this._gen;
    this._deframer.reset();
    const channel = kind === 'live' ? (this._liveChannel ?? this._channel) : this._channel;
    const s: Stream = {
      gen,
      kind,
      channel,
      askedAt: performance.now(),
      from: fromWall,
      end,
      opened: false,
      paused: false,
      ended: false,
      first: null,
      last: null,
    };
    this._log('open', { kind, gen, ch: channel, from: Math.round(fromWall), end: end && Math.round(end) });
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
          channel,
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

  /** Drop the stream in flight; anything it still sends is ignored. A live
   *  stream replaced by another live stream (a channel switch - Talk - or a
   *  restart) keeps the backfill: the footage before it stays in the buffer. */
  private _stopStream(nextIsLive = false): void {
    const s = this._stream;
    if (!s) return;
    if (s.kind === 'live') {
      if (!nextIsLive) this._stopBackfill('live stopped'); // it serves that footage
      this._liveGop = null;
    }
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

  // ---- backfill: the history behind a live session (see BACKFILL_MS) -------

  /** Start the backfill for the live session that just presented its first
   *  frame - once per session. It always fetches the recordings' channel
   *  (Talk plays live from channel 1, which is not recorded; the buffer
   *  switches codec between them with changeType). */
  private _startBackfill(): void {
    const first = this._liveFirst;
    if (this._bf || this._destroyed || first == null || this._bfFor === first) return;
    if (!this._liveStreaming()) return;
    this._bfFor = first;
    // The session's footage starts at its first keyframe (MSE drops the
    // frames before it) - or earlier, where an earlier session's footage
    // runs into it (a channel switch): the backfill runs up to there, and
    // isn't needed once that is old enough for the NVR.
    const session = this._blockStart(this._liveKey0 ?? first);
    if (Date.now() - (session + this.base) * 1000 >= BACKFILL_MS) return;
    const bf: Backfill = {
      ws: null,
      running: true,
      gen: 0,
      askedAt: performance.now(),
      lastDataAt: performance.now(),
      from: (session + this.base) * 1000 - BACKFILL_MS,
      session,
      deframer: new NvrDeframer(),
      steps: 0,
      retries: 0,
      conn: 0,
      init: null,
      held: [],
      end: null,
    };
    this._bf = bf;
    this._log('bf:start', { from: Math.round(bf.from), session: this._wall(session) });
    void this._bfConnect(bf);
  }

  private async _bfConnect(bf: Backfill): Promise<void> {
    const conn = ++bf.conn;
    try {
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
          reject(new Error('closed'));
        };
      });
      if (this._bf !== bf || !bf.running || bf.conn !== conn) {
        ws.close();
        return;
      }
      bf.ws = ws;
      ws.onmessage = (e) => this._onBfMessage(bf, e);
      ws.onclose = () => this._bfFailed(bf, 'connection lost');
      this._bfRequest(bf);
    } catch (err) {
      if (bf.conn === conn) this._bfFailed(bf, `relay unreachable: ${(err as Error)?.message ?? err}`);
    }
  }

  private _bfRequest(bf: Backfill): void {
    bf.gen++;
    bf.askedAt = performance.now();
    bf.lastDataAt = bf.askedAt;
    bf.deframer.reset();
    bf.ws?.send(
      JSON.stringify({
        op: 'play',
        gen: bf.gen,
        nvr_id: this._nvrId,
        camera_id: this._cameraId,
        channel: this._channel,
        start: Math.round(bf.from),
      }),
    );
  }

  /** A backfill that stopped delivering (see BACKFILL_STALL_MS) asks again
   *  from the start on a fresh socket - what it already has is skipped. */
  private _bfRetry(bf: Backfill): void {
    if (bf.retries >= 2) {
      this._bfFailed(bf, 'stalled');
      return;
    }
    bf.retries++;
    bf.lastDataAt = performance.now();
    this._log('bf:retry', { retries: bf.retries, got: bf.end != null });
    const ws = bf.ws;
    bf.ws = null;
    if (ws) {
      ws.onclose = null;
      ws.onmessage = null;
      try {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ op: 'stop' }));
        ws.close();
      } catch {
        /* already closed */
      }
    }
    void this._bfConnect(bf);
  }

  private _onBfMessage(bf: Backfill, e: MessageEvent): void {
    if (this._bf !== bf || !bf.running) return;
    if (typeof e.data === 'string') {
      let m: { ev?: string; gen?: number; message?: string };
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }
      if (m.gen !== bf.gen) return;
      if (m.ev === 'open') {
        this._log('bf:open', { ms: Math.round(performance.now() - bf.askedAt) });
      } else if (m.ev === 'error') {
        if (/refused/.test(m.message ?? '') && bf.steps < NOTYET_MAX_STEPS) {
          bf.steps++;
          bf.from -= NOTYET_STEP_S * 1000;
          this._log('bf:notyet', { steps: bf.steps });
          this._bfRequest(bf);
          return;
        }
        this._bfFailed(bf, m.message || 'stream error');
      } else if (m.ev === 'end') {
        this._bfFailed(bf, 'the NVR ended it');
      }
      return;
    }
    const buf = e.data as ArrayBuffer;
    if (buf.byteLength < 4 || new DataView(buf).getUint32(0) !== bf.gen) return;
    for (const seg of bf.deframer.push(new Uint8Array(buf, 4))) {
      if (this._bf !== bf || !bf.running) return;
      this._acceptBf(bf, seg);
    }
    this._pump();
  }

  private _acceptBf(bf: Backfill, seg: NvrSegment): void {
    if (seg.kind === 'init') {
      bf.init = { t: 'init', gen: -1, data: seg.data, codecs: seg.codecs };
      return;
    }
    if (seg.time == null) return;
    const time = seg.time - this.base;
    const end = (seg.end ?? seg.time) - this.base;
    if (bf.end == null) this._log('bf:data1', { ms: Math.round(performance.now() - bf.askedAt), at: this._wall(time) });
    bf.lastDataAt = performance.now();
    if (bf.end != null && end <= bf.end + 0.05) return; // asked again: already have it
    if (time < bf.session - 0.02) {
      for (const k of seg.keys) this._addKey(k - this.base);
      bf.held.push({ data: seg.data, time, end });
      bf.end = end;
    }
    // Reached the live session's own footage: the history is complete.
    if (end >= bf.session - 0.02) {
      this._log('bf:done', { at: this._wall(time) });
      this._bfEnd(bf, 'met live');
    }
  }

  /** Stop the backfill's stream; what it delivered stays (held or loaded). */
  private _bfEnd(bf: Backfill, why: string): void {
    if (!bf.running) return;
    bf.running = false;
    this._log('bf:end', { why });
    const ws = bf.ws;
    bf.ws = null;
    if (ws) {
      ws.onclose = null;
      ws.onmessage = null;
      try {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ op: 'stop' }));
        ws.close();
      } catch {
        /* already closed */
      }
    }
  }

  /** Drop the backfill: its stream and what it holds. One going into the
   *  buffer finishes (it has the live GOP to put back). */
  private _stopBackfill(why: string): void {
    const bf = this._bf;
    if (!bf) return;
    this._bfEnd(bf, why);
    this._bf = null;
    this._log('bf:stop', { why, held: bf.held.length });
  }

  /** The backfill can't deliver any more; a seek waiting for its footage is
   *  aimed the ordinary way on the next tick. */
  private _bfFailed(bf: Backfill, why: string): void {
    if (this._bf !== bf || !bf.running) return;
    this._bfEnd(bf, `failed: ${why}`);
    this._tick();
  }

  /** The backfill holds footage at media time t, or is yet to deliver it (or
   *  the footage just after it, which t needs to count as loaded). */
  private _bfWillFill(t: number): boolean {
    const bf = this._bf;
    if (!bf || t > bf.session + 0.05) return false;
    if (bf.held.some((h) => t >= h.time - 0.05 && t < h.end)) return true;
    const delivered = bf.end ?? bf.from / 1000 - this.base;
    return bf.running && t >= delivered - MIN_AHEAD_FOR_NATIVE_S - 0.05;
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
      if (debugOn()) {
        const ch = s.kind === 'live' ? (this._liveChannel ?? this._channel) : this._channel;
        this._log('init', { gen: s.gen, codecs: seg.codecs, ch });
        // The entity's size is channel 0's; other channels are checked on their own.
        const a = this._hass()?.states?.[this._cameraId]?.attributes;
        const w = Number(a?.width) || this._video?.videoWidth || 0;
        const h = Number(a?.height) || this._video?.videoHeight || 0;
        if (ch === 0) dbgDecodeInfo(this._cameraId, seg.codecs, w, h);
      }
    } else {
      if (seg.time != null) {
        const t = seg.time - this.base;
        if (s.first == null) {
          s.first = t;
          if (s.kind === 'live') {
            this._liveFirst = t;
            this._liveKey0 = null;
          }
          clearTimeout(this._firstDataTimer);
          this._log('data1', {
            gen: s.gen,
            kind: s.kind,
            ms: Math.round(performance.now() - s.askedAt),
            at: this._wall(t),
            keys: seg.keys.length,
          });
        }
        s.last = t;
      }
      for (const k of seg.keys) this._addKey(k - this.base);
      const key = seg.keys.length ? seg.keys[0] - this.base : undefined;
      if (s.kind === 'live' && this._liveKey0 == null && key != null) this._liveKey0 = key;
      this._ops.push({ t: 'media', gen: s.gen, data: seg.data, key });
      // Behind live (a seek before the session - see seek()): the backfill is
      // what the seek waits for, so it starts with the first keyframe, not at
      // a live settle.
      if (s.kind === 'live' && !this._live && this._liveKey0 != null) this._startBackfill();
    }
    this._pump();
  }

  private _onStreamEnd(s: Stream): void {
    if (this._stream !== s) return;
    this._log('end', { gen: s.gen, kind: s.kind, got: s.last != null });
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
    this._log('fail', { gen: s.gen, kind: s.kind, message, fails: this._fails });
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
   * failure. A pending seek whose target is NOT loaded (this was its own
   * request) is asked again further back (NOTYET_STEP_S, up to
   * NOTYET_MAX_STEPS), and only then lands on the nearest footage after it.
   * A seek whose target IS loaded is left alone - the refusal was for the
   * footage after it. Both used to land on the nearest footage AFTER the
   * target: the start of the live buffer after a rewind from live, a second
   * or two back, which read as "skip back did nothing" (measured 2026-10-26:
   * 3.0, 1.5, 2.6 and 0 s for a 10 s skip). Playback that caught up with the
   * edge waits for it to move on.
   */
  private _notRecordedYet(s: Stream): void {
    this._log('notyet', { gen: s.gen, steps: this._notYetSteps });
    this._stopStream();
    this._idleUntil = performance.now() + 2000;
    const v = this._video;
    const t = this._target;
    if (!v || this._settled || t == null || this._loadedAt(t)) {
      this._hooks.change?.();
      return;
    }
    if (this._notYetSteps < NOTYET_MAX_STEPS) {
      this._notYetSteps++;
      const back = t - NOTYET_STEP_S;
      this._target = back;
      this._awaitSeeked = true;
      v.currentTime = back;
      this._idleUntil = 0;
      this._openPlay((back + this.base) * 1000);
      this._hooks.change?.();
      return;
    }
    const next = this._nextRangeAfter(t);
    if (next != null) {
      this._target = next;
      this._awaitSeeked = true;
      v.currentTime = next;
    }
    this._hooks.change?.();
  }

  private _giveUp(message: string): void {
    this._log('giveup', { message });
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
    if (debugOn()) this._snapshot(v);
    // Old enough, the footage before the session comes from the NVR at once.
    const bf = this._bf;
    if (bf && !this._bfOps.length && Date.now() - (bf.session + this.base) * 1000 > BACKFILL_MS) {
      this._stopBackfill('expired');
    } else if (
      bf?.running &&
      performance.now() - bf.lastDataAt > (bf.end == null ? BACKFILL_FIRST_DATA_MS : BACKFILL_STALL_MS)
    ) {
      this._bfRetry(bf);
    }
    if (this._live) {
      this._liveTick(v);
      this._queueEvict();
      this._pump();
      return;
    }
    // A seek waiting behind live for footage only the backfill could deliver,
    // which it no longer will (failed, never started, or too slow): aim it the
    // ordinary way (the live stream stops, the NVR is asked).
    const tt = this._target;
    if (
      !this._settled &&
      tt != null &&
      this._stream?.kind === 'live' &&
      !this._loadedAt(tt) &&
      !this._inLiveSession(tt) &&
      !this._bfOps.length
    ) {
      const late = performance.now() - this._epochAt > BACKFILL_WAIT_MS;
      const coming =
        this._bfWillFill(tt) || ((this._liveFirst == null || this._bfStarting()) && this._behindLiveReach(tt));
      if (!coming || late) {
        this._stopBackfill(coming ? 'too slow' : 'cannot serve');
        this._log('bf:reaim', { at: this._wall(tt) });
        this._viaNvr = true;
        try {
          this.seek((tt + this.base) * 1000, { play: this._wantPlay });
        } finally {
          this._viaNvr = false;
        }
        return;
      }
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
    // over it to the next footage. Not a hole: what the backfill holds or is
    // still delivering - stepping there jumped a skip back from a young live
    // session forward to the session's start (it moved ~0.4 s, not 10).
    if (!v.seeking) {
      const next = this._nextRangeAfter(r ? r[1] : t);
      const stuck = r ? r[1] - t < 0.3 : true;
      const filling =
        (s && !s.ended && (s.last == null || (r ? s.last <= r[1] + 0.5 : s.last < t))) ||
        this._bfWillFill(r ? r[1] : t) ||
        this._bfOps.length > 0;
      if (stuck && next != null && !filling && (this._settled || (s?.first != null && s.first > t))) {
        if (!this._settled) this._target = next;
        this._awaitSeeked = true;
        v.currentTime = next;
        return;
      }
    }

    if (s?.kind === 'live' && !s.ended) {
      // Timeshift: the live stream fills ahead of a playhead behind live. Too
      // far behind its edge it would only grow the buffer: stop it, and what
      // follows is fetched from the recordings (that old, they exist).
      const lr = this._liveRange();
      const behind = lr ? lr[1] - t : 0;
      if (behind > TIMESHIFT_MAX_S) {
        this._log('timeshiftEnd', { behind: +behind.toFixed(1) });
        this._stopStream();
      }
    } else if (s?.kind === 'play' && !s.ended) {
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

  /** Where the buffered footage running into media time t starts, stepping
   *  back over gaps under 2 s (a live channel switch leaves ~0.2-0.7 s). */
  private _blockStart(t: number): number {
    const b = this._sb?.buffered;
    let start = t;
    if (!b) return start;
    for (let i = b.length - 1; i >= 0; i--) {
      if (b.start(i) > start + 0.05) continue;
      if (b.end(i) < start - 2) break;
      start = Math.min(start, b.start(i));
    }
    return start;
  }

  private _nextRangeAfter(t: number): number | null {
    const sb = this._sb;
    if (!sb) return null;
    const b = sb.buffered;
    for (let i = 0; i < b.length; i++) if (b.start(i) > t + 0.05) return b.start(i);
    return null;
  }

  /** The buffered LIVE footage: the newest range reaching past the first live
   *  fragment, clipped to start there (null until some is buffered). Its
   *  start is decodable: MSE drops every frame before a range's keyframe. */
  private _liveRange(): [number, number] | null {
    const b = this._sb?.buffered;
    const first = this._liveFirst;
    if (!b || first == null || !b.length) return null;
    const i = b.length - 1;
    if (b.end(i) < first + 0.05) return null;
    return [Math.max(b.start(i), first - 0.05), b.end(i)];
  }

  /** Where to land in [start, end] for a lag of `behind`: the newest keyframe
   *  at or before it (decodes at once, even on a slow tablet), else the start. */
  private _liveTarget(start: number, end: number, behind: number): number {
    const k = this._keyBefore(end - behind, start);
    return k != null && k >= start ? k : start;
  }

  private _liveTick(v: HTMLVideoElement): void {
    const range = this._liveRange();
    if (!range) return; // no live footage buffered yet (its first keyframe is coming)
    const [start, end] = range;
    const now = performance.now();
    if (!this._liveJoined) {
      // Join once there is a little live footage: the frame on screen stays
      // until the first live frame presents. Land ON a keyframe INSIDE the
      // buffered live footage - nothing to decode before the first frame,
      // and never a hole the element would wait in forever.
      if (end - start < 0.3) return;
      this._join(v, this._liveTarget(start, end, this._lowLatency ? TALK_TARGET_S : LIVE_TARGET_S), now);
      return;
    }
    // Watchdog. A join that never presents, or live that stopped moving while
    // footage keeps arriving, is aimed again at the newest keyframe; after
    // LIVE_MAX_REJOINS without a frame, live restarts from scratch.
    if (!this._settled) {
      // A seek that never lands is stuck whatever the play state; a paused
      // element that has not drawn yet is waiting for a tap (autoplay).
      if (now - this._joinAt > LIVE_JOIN_STALL_MS && (v.seeking || !v.paused)) {
        this._rejoin(v, start, end, 'live did not start', now);
      }
      return;
    }
    if (v.paused) return;
    if (Math.abs(v.currentTime - this._liveMovedCt) > 0.01) {
      this._liveMovedCt = v.currentTime;
      this._liveMovedAt = now;
      this._rejoins = 0;
      this._liveRestarts = 0;
    } else if (now - this._liveMovedAt > LIVE_STALL_MS && end > v.currentTime + 0.5) {
      this._rejoin(v, start, end, 'live stalled', now);
      return;
    }
    if (v.seeking) return;
    const target = this._lowLatency ? TALK_TARGET_S : LIVE_TARGET_S;
    // Playing out of an older piece of footage into a hole (a gap in what the
    // NVR sent): straight on to the newest live footage instead of waiting.
    const r = this._rangeAt(v.currentTime);
    if (r && r[1] < start - 0.01 && r[1] - v.currentTime < 0.3) {
      this._jump(v, this._liveTarget(start, end, target));
      return;
    }
    // Hold the lag at `target`: far behind, jump to the newest keyframe if
    // that is meaningfully closer (keyframes are ~5 s apart, so often it is
    // not); otherwise play slightly fast until back on target. The element
    // keeps the pitch, so voices stay natural.
    const lag = end - v.currentTime;
    if (lag > (this._lowLatency ? TALK_JUMP_S : LIVE_MAX_LAG_S) && this._jump(v, this._liveTarget(start, end, target))) {
      return;
    }
    const band = this._lowLatency ? TALK_BAND_S : LIVE_BAND_S;
    let rate = v.playbackRate;
    if (lag > target + band) rate = lag > target + 2 ? FAST_CATCHUP_RATE : CATCHUP_RATE;
    else if (lag <= target) rate = this._rate;
    if (rate !== v.playbackRate) {
      v.playbackRate = rate;
      this._log('rate', { rate, lag: +lag.toFixed(2) });
    }
  }

  private _join(v: HTMLVideoElement, target: number, now: number): void {
    const b = this._sb?.buffered;
    this._log('join', {
      target: this._wall(target),
      from: this._wall(v.currentTime),
      liveFirst: this._liveFirst != null ? this._wall(this._liveFirst) : null,
      edge: b && b.length ? this._wall(b.end(b.length - 1)) : null,
      rejoin: this._liveJoined,
    });
    this._liveJoined = true;
    this._awaitSeeked = true;
    this._joinAt = now;
    this._liveMovedCt = target;
    this._liveMovedAt = now;
    v.currentTime = target;
    if (this._wantPlay) this._play();
  }

  /** Catch up inside the live footage - only forward, only to a keyframe the
   *  element can show at once (a mid-GOP target made a slow decoder chew
   *  through up to 5 s of frames, showing a spinner). */
  private _jump(v: HTMLVideoElement, target: number): boolean {
    if (target <= v.currentTime + 0.3) return false;
    this._log('jump', { from: this._wall(v.currentTime), to: this._wall(target) });
    v.currentTime = target;
    return true;
  }

  private _rejoin(v: HTMLVideoElement, start: number, end: number, why: string, now: number): void {
    this._rejoins++;
    this._log('rejoin', { why, n: this._rejoins, restarts: this._liveRestarts, seeking: v.seeking, rs: v.readyState });
    if (this._rejoins > LIVE_MAX_REJOINS) {
      if (++this._liveRestarts > LIVE_MAX_REJOINS) {
        this._giveUp('Live video could not be played. Tap LIVE to try again.');
        return;
      }
      this._hooks.problem?.(`${why}: restarting live`);
      this._stopStream();
      this._dropMedia();
      this._goLive();
      return;
    }
    this._hooks.problem?.(`${why}: re-joining live`);
    this._join(v, this._liveTarget(start, end, LIVE_TARGET_S), now);
  }

  // ---- telemetry (debug: true) -----------------------------------------------

  private _log(ev: string, data: Record<string, unknown> = {}): void {
    if (debugOn()) dbg(ev, { cam: this._cameraId, ...data });
  }

  /** Media time -> wall-clock seconds (2 decimals), for telemetry. */
  private _wall(t: number): number {
    return Math.round((t + this.base) * 100) / 100;
  }

  private _rangesWall(): Array<[number, number]> {
    const b = this._sb?.buffered;
    const out: Array<[number, number]> = [];
    if (!b) return out;
    for (let i = 0; i < b.length; i++) out.push([this._wall(b.start(i)), this._wall(b.end(i))]);
    return out.slice(-4);
  }

  private _snapshot(v: HTMLVideoElement): void {
    const now = performance.now();
    if (now - this._snapAt < 2000) return;
    this._snapAt = now;
    const q = (v as HTMLVideoElement & { getVideoPlaybackQuality?(): VideoPlaybackQuality }).getVideoPlaybackQuality?.();
    const b = this._sb?.buffered;
    const end = b && b.length ? b.end(b.length - 1) : null;
    this._log('snap', {
      live: this._live,
      joined: this._liveJoined,
      settled: this._settled,
      ct: this._wall(v.currentTime),
      lag: this._live ? +(Date.now() / 1000 - (v.currentTime + this.base)).toFixed(2) : undefined,
      buf: end != null ? +(end - v.currentTime).toFixed(2) : null,
      ranges: this._rangesWall(),
      rate: v.playbackRate,
      paused: v.paused,
      seeking: v.seeking,
      rs: v.readyState,
      muted: v.muted,
      dropped: q?.droppedVideoFrames,
      frames: q?.totalVideoFrames,
      size: `${v.videoWidth}x${v.videoHeight}`,
      ws: this._ws?.readyState,
      stream: this._stream ? `${this._stream.kind}#${this._stream.gen}` : null,
      fails: this._fails,
      failed: this._failedMsg,
    });
  }

  private _onDbgVideoEvent = (e: Event): void => {
    const v = this._video;
    if (!v) return;
    const err = e.type === 'error' && v.error ? `${v.error.code} ${v.error.message}` : undefined;
    this._log(`v:${e.type}`, { ct: this._wall(v.currentTime), rs: v.readyState, seeking: v.seeking, err });
  };

  private _newEpoch(target: number | null): void {
    this._epoch++;
    this._epochAt = performance.now();
    this._settled = false;
    this._target = target;
    this._twoStep = null;
    this._recoveries = 0;
    this._notYetSteps = 0;
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
    if (debugOn()) {
      for (const type of DBG_VIDEO_EVENTS) v.addEventListener(type, this._onDbgVideoEvent);
    }
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
    for (const type of DBG_VIDEO_EVENTS) v.removeEventListener(type, this._onDbgVideoEvent);
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
      this._log('settled', { live: this._live, ms: Math.round(performance.now() - this._epochAt), at: this._wall(mediaTime) });
      this._hooks.change?.();
      // Live is on screen: fetch the history behind it (once per session).
      if (this._live) this._startBackfill();
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
