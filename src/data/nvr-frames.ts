// Decodes the UniFi NVR's fMP4 stream framing (ws/playback and ws/livestream,
// relayed unmodified by protect_cache/nvr_stream.py) into segments a
// SourceBuffer can take.
//
// Wire format: a sequence of frames `[type:1][length:3 big-endian][payload]`,
// split across websocket messages at arbitrary byte boundaries:
//   248 codec string ("avc1.4d0032,mp4a.40.2")
//   250 init segment (ftyp + moov)
//   249 begin of a media segment, 255 end of it
//   251 a PIECE of the moof (it comes in several: header+mfhd, then per
//       track its traf header and its trun), 254 mdat HEADER only,
//   252 video samples, 253 audio samples
//   247 timestamps (ignored)
// A media segment is assembled the way the Protect web UI does it: every moof,
// then the mdat header, then the video samples, then the audio samples. The
// moofs' data offsets already assume that order (verified: Chrome and iOS
// play the result, and the packets match an export byte for byte).

export const FRAME_TIMESTAMPS = 247;
export const FRAME_CODEC = 248;
export const FRAME_BEGIN = 249;
export const FRAME_INIT = 250;
export const FRAME_MOOF = 251;
export const FRAME_VIDEO = 252;
export const FRAME_AUDIO = 253;
export const FRAME_MDAT = 254;
export const FRAME_END = 255;

export interface NvrInit {
  kind: 'init';
  /** RFC 6381 codecs for `addSourceBuffer`, e.g. `avc1.4d0032, mp4a.40.2`. */
  codecs: string;
  data: Uint8Array;
}

export interface NvrMedia {
  kind: 'media';
  data: Uint8Array;
  /** Wall-clock seconds of the segment's first sample (the first tfdt). */
  time: number | null;
  /** Wall-clock seconds of every keyframe (sync sample) in the segment. A
   * live 100 ms fragment can hold its keyframe anywhere, not just first. */
  keys: number[];
}

interface Box {
  type: string;
  start: number; // payload start
  end: number;
}

function* boxes(buf: Uint8Array, from: number, to: number): Generator<Box> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let off = from;
  while (off + 8 <= to) {
    let size = dv.getUint32(off);
    let header = 8;
    if (size === 1) {
      if (off + 16 > to) return;
      size = Number(dv.getBigUint64(off + 8));
      header = 16;
    } else if (size === 0) {
      size = to - off;
    }
    if (size < header || off + size > to) return;
    const type = String.fromCharCode(buf[off + 4], buf[off + 5], buf[off + 6], buf[off + 7]);
    yield { type, start: off + header, end: off + size };
    off += size;
  }
}

/**
 * Keyframe times (seconds) in the FIRST track of a moof, from its tfhd/trun
 * sample flags (bit 0x10000 = sample_is_non_sync_sample). Exact and
 * codec-agnostic. `defaultFlags` is the init segment's trex default.
 */
export function moofKeyTimes(moof: Uint8Array, timescale: number, defaultFlags = 0): number[] {
  const dv = new DataView(moof.buffer, moof.byteOffset, moof.byteLength);
  const top = boxes(moof, 0, moof.length).next().value;
  if (!top || top.type !== 'moof') return [];
  for (const traf of boxes(moof, top.start, top.end)) {
    if (traf.type !== 'traf') continue;
    let defDuration = 0;
    let defFlags = defaultFlags;
    let base: number | null = null;
    const keys: number[] = [];
    for (const b of boxes(moof, traf.start, traf.end)) {
      const flags = dv.getUint32(b.start) & 0xffffff;
      if (b.type === 'tfhd') {
        let o = b.start + 8; // version/flags + track_ID
        if (flags & 0x1) o += 8; // base_data_offset
        if (flags & 0x2) o += 4; // sample_description_index
        if (flags & 0x8) {
          defDuration = dv.getUint32(o);
          o += 4;
        }
        if (flags & 0x10) o += 4; // default_sample_size
        if (flags & 0x20) defFlags = dv.getUint32(o);
      } else if (b.type === 'tfdt') {
        const version = moof[b.start];
        base = version === 1 ? Number(dv.getBigUint64(b.start + 4)) : dv.getUint32(b.start + 4);
      } else if (b.type === 'trun' && base != null) {
        const count = dv.getUint32(b.start + 4);
        let o = b.start + 8;
        if (flags & 0x1) o += 4; // data_offset
        let firstFlags: number | null = null;
        if (flags & 0x4) {
          firstFlags = dv.getUint32(o);
          o += 4;
        }
        let t = base;
        for (let i = 0; i < count && o <= b.end; i++) {
          let dur = defDuration;
          let sf = i === 0 && firstFlags != null ? firstFlags : defFlags;
          if (flags & 0x100) {
            dur = dv.getUint32(o);
            o += 4;
          }
          if (flags & 0x200) o += 4; // sample_size
          if (flags & 0x400) {
            sf = dv.getUint32(o);
            o += 4;
          }
          if (flags & 0x800) o += 4; // composition offset
          if (!(sf & 0x10000)) keys.push(t / timescale);
          t += dur;
        }
      }
    }
    return keys; // first track only (the video track)
  }
  return [];
}

export type NvrSegment = NvrInit | NvrMedia;

/** The first `tfdt` in a moof, as seconds at the given timescale (null if absent). */
export function moofTime(moof: Uint8Array, timescale: number): number | null {
  for (let i = 4; i + 16 <= moof.length; i++) {
    // 'tfdt' = 74 66 64 74
    if (moof[i] !== 0x74 || moof[i + 1] !== 0x66 || moof[i + 2] !== 0x64 || moof[i + 3] !== 0x74) continue;
    const version = moof[i + 4];
    const dv = new DataView(moof.buffer, moof.byteOffset + i + 8);
    const value = version === 1 ? Number(dv.getBigUint64(0)) : dv.getUint32(0);
    return value / timescale;
  }
  return null;
}

/** The FIRST track's default sample flags (trex) in an init segment, or 0. */
export function initDefaultFlags(init: Uint8Array): number {
  for (let i = 4; i + 28 <= init.length; i++) {
    // 'trex' = 74 72 65 78: version/flags, track_ID, description index,
    // default duration, default size, default FLAGS
    if (init[i] !== 0x74 || init[i + 1] !== 0x72 || init[i + 2] !== 0x65 || init[i + 3] !== 0x78) continue;
    return new DataView(init.buffer, init.byteOffset + i + 24).getUint32(0);
  }
  return 0;
}

/** The media timescale of the FIRST track in an init segment (its mdhd). */
export function initTimescale(init: Uint8Array): number | null {
  for (let i = 4; i + 24 <= init.length; i++) {
    // 'mdhd' = 6d 64 68 64
    if (init[i] !== 0x6d || init[i + 1] !== 0x64 || init[i + 2] !== 0x68 || init[i + 3] !== 0x64) continue;
    const version = init[i + 4];
    // version 1: creation(8) modification(8) timescale(4); version 0: 4 4 4.
    const at = i + 8 + (version === 1 ? 16 : 8);
    if (at + 4 > init.length) return null;
    return new DataView(init.buffer, init.byteOffset + at).getUint32(0);
  }
  return null;
}

function concat(parts: Uint8Array[]): Uint8Array {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Normalises the NVR's `avc1.4d0032,mp4a.40.2` into a MIME codecs list. */
function codecList(raw: string): string {
  return raw
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .join(', ');
}

/**
 * Incremental decoder for ONE stream. Feed it each websocket message's
 * payload (after the relay's 4-byte generation tag); it returns whatever
 * segments those bytes completed. Make a new one (or `reset()`) per stream:
 * a frame can be split across messages, and a carry-over from a stream that
 * was replaced must never prefix the next one.
 */
export class NvrDeframer {
  private _carry: Uint8Array | null = null;
  private _codecs = '';
  private _timescale = 90000;
  private _trexFlags = 0;
  private _parts: Record<number, Uint8Array[]> | null = null;

  reset(): void {
    this._carry = null;
    this._parts = null;
  }

  push(chunk: Uint8Array): NvrSegment[] {
    let buf = chunk;
    if (this._carry) {
      const merged = new Uint8Array(this._carry.length + chunk.length);
      merged.set(this._carry);
      merged.set(chunk, this._carry.length);
      buf = merged;
      this._carry = null;
    }
    const out: NvrSegment[] = [];
    let off = 0;
    while (buf.length - off >= 4) {
      const type = buf[off];
      const len = (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3];
      if (buf.length - off - 4 < len) break;
      const payload = buf.subarray(off + 4, off + 4 + len);
      off += 4 + len;
      this._frame(type, payload, out);
    }
    if (off < buf.length) this._carry = buf.slice(off);
    return out;
  }

  private _frame(type: number, payload: Uint8Array, out: NvrSegment[]): void {
    switch (type) {
      case FRAME_CODEC:
        this._codecs = codecList(new TextDecoder().decode(payload));
        return;
      case FRAME_INIT: {
        // Copy: the payload is a view into a websocket message we don't own.
        const data = payload.slice();
        this._timescale = initTimescale(data) ?? this._timescale;
        this._trexFlags = initDefaultFlags(data);
        out.push({ kind: 'init', codecs: this._codecs, data });
        return;
      }
      case FRAME_BEGIN:
        this._parts = { [FRAME_MOOF]: [], [FRAME_MDAT]: [], [FRAME_VIDEO]: [], [FRAME_AUDIO]: [] };
        return;
      case FRAME_MOOF:
      case FRAME_MDAT:
      case FRAME_VIDEO:
      case FRAME_AUDIO:
        // Frames outside a begin/end pair are a stream joined mid-segment;
        // they cannot form a decodable segment, so they are dropped.
        this._parts?.[type].push(payload.slice());
        return;
      case FRAME_END: {
        const p = this._parts;
        this._parts = null;
        if (!p || !p[FRAME_MOOF].length) return;
        // The moof frames are PIECES of one moof box (header+mfhd, video traf,
        // video trun, audio traf, audio trun), so its tfdt is in a later piece.
        const moof = concat(p[FRAME_MOOF]);
        out.push({
          kind: 'media',
          data: concat([moof, ...p[FRAME_MDAT], ...p[FRAME_VIDEO], ...p[FRAME_AUDIO]]),
          time: moofTime(moof, this._timescale),
          keys: moofKeyTimes(moof, this._timescale, this._trexFlags),
        });
        return;
      }
      default:
        // 247 timestamps and anything new: not needed to play.
        return;
    }
  }
}
