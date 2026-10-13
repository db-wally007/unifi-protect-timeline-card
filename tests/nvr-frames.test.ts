import { describe, it, expect } from 'vitest';
import { NvrDeframer, initTimescale, moofKeyTimes, moofTime } from '../src/data/nvr-frames';

const enc = new TextEncoder();

function frame(type: number, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(4 + payload.length);
  out[0] = type;
  out[1] = (payload.length >> 16) & 0xff;
  out[2] = (payload.length >> 8) & 0xff;
  out[3] = payload.length & 0xff;
  out.set(payload, 4);
  return out;
}

function box(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + body.length);
  new DataView(out.buffer).setUint32(0, out.length);
  out.set(enc.encode(type), 4);
  out.set(body, 8);
  return out;
}

function cat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** An init segment whose first mdhd (version 0) carries `timescale`. */
function init(timescale: number): Uint8Array {
  const mdhd = new Uint8Array(4 + 4 + 4 + 4 + 4 + 4);
  new DataView(mdhd.buffer).setUint32(12, timescale); // version/flags, ctime, mtime, timescale
  return cat(box('ftyp', enc.encode('isom')), box('moov', box('trak', box('mdia', box('mdhd', mdhd)))));
}

/** A moof whose tfdt (version 1) is `seconds` at `timescale`. */
function moof(seconds: number, timescale: number): Uint8Array {
  const tfdt = new Uint8Array(4 + 8);
  tfdt[0] = 1;
  new DataView(tfdt.buffer).setBigUint64(4, BigInt(Math.round(seconds * timescale)));
  return box('moof', box('traf', box('tfdt', tfdt)));
}

const WALL = 1791826197.944;

function stream(): { bytes: Uint8Array; moofs: Uint8Array[]; initData: Uint8Array } {
  const initData = init(90000);
  // The NVR sends ONE moof in pieces; the first piece (header + mfhd) has no tfdt.
  const whole = moof(WALL, 90000);
  const moofs = [whole.subarray(0, 8), whole.subarray(8)];
  const mdat = new Uint8Array([0, 0, 0, 99, 0x6d, 0x64, 0x61, 0x74]);
  const bytes = cat(
    frame(248, enc.encode('avc1.4d0032,mp4a.40.2')),
    frame(250, initData),
    frame(249, new Uint8Array(0)),
    frame(251, moofs[0]),
    frame(251, moofs[1]),
    frame(254, mdat),
    frame(252, new Uint8Array([1, 1, 1])),
    frame(253, new Uint8Array([2, 2])),
    frame(252, new Uint8Array([3])),
    frame(247, new Uint8Array(8)),
    frame(255, new Uint8Array(0)),
  );
  return { bytes, moofs, initData };
}

describe('NvrDeframer', () => {
  it('emits the init with normalised codecs, then one media segment in Protect UI order', () => {
    const { bytes, moofs, initData } = stream();
    const segs = new NvrDeframer().push(bytes);
    expect(segs).toHaveLength(2);
    expect(segs[0]).toEqual({ kind: 'init', codecs: 'avc1.4d0032, mp4a.40.2', data: initData });
    const media = segs[1];
    expect(media.kind).toBe('media');
    if (media.kind !== 'media') return;
    // moofs, then the mdat header, then ALL video samples, then ALL audio samples.
    const mdat = new Uint8Array([0, 0, 0, 99, 0x6d, 0x64, 0x61, 0x74]);
    expect(Array.from(media.data)).toEqual(
      Array.from(cat(moofs[0], moofs[1], mdat, new Uint8Array([1, 1, 1, 3]), new Uint8Array([2, 2]))),
    );
    expect(media.time).toBeCloseTo(WALL, 3);
  });

  it('gives identical output however the bytes are split across messages', () => {
    const { bytes } = stream();
    const whole = new NvrDeframer().push(bytes);
    for (const step of [1, 2, 3, 5, 7, 13, 64]) {
      const d = new NvrDeframer();
      const got = [];
      for (let i = 0; i < bytes.length; i += step) got.push(...d.push(bytes.subarray(i, i + step)));
      expect(got).toEqual(whole);
    }
  });

  it('drops samples of a segment joined mid-way (no begin frame)', () => {
    const { bytes } = stream();
    // Cut everything up to (and including) the begin frame of the media segment.
    const d = new NvrDeframer();
    const begin = bytes.indexOf(249);
    const segs = d.push(bytes.subarray(begin + 4));
    expect(segs).toEqual([]);
  });

  it('reset() discards a partial frame so it cannot prefix the next stream', () => {
    const { bytes } = stream();
    const d = new NvrDeframer();
    d.push(bytes.subarray(0, 30)); // mid init frame
    d.reset();
    const segs = d.push(bytes);
    expect(segs.map((s) => s.kind)).toEqual(['init', 'media']);
  });
});

/** A moof with tfhd (default duration/flags) + tfdt + trun with per-sample flags. */
function moofWithSamples(seconds: number, timescale: number, nonSync: boolean[]): Uint8Array {
  const tfhd = new Uint8Array(4 + 4 + 4 + 4);
  const tdv = new DataView(tfhd.buffer);
  tdv.setUint32(0, 0x000028); // default-sample-duration (0x8) + default-sample-flags (0x20)
  tdv.setUint32(4, 1); // track_ID
  tdv.setUint32(8, 3000); // 1/30 s at 90 kHz
  tdv.setUint32(12, 0x10000); // default: non-sync
  const tfdt = new Uint8Array(12);
  tfdt[0] = 1;
  new DataView(tfdt.buffer).setBigUint64(4, BigInt(Math.round(seconds * timescale)));
  const trun = new Uint8Array(4 + 4 + 4 * nonSync.length);
  const rdv = new DataView(trun.buffer);
  rdv.setUint32(0, 0x000400); // sample-flags present
  rdv.setUint32(4, nonSync.length);
  nonSync.forEach((ns, i) => rdv.setUint32(8 + 4 * i, ns ? 0x10000 : 0));
  return box('moof', cat(box('mfhd', new Uint8Array(8)), box('traf', cat(box('tfhd', tfhd), box('tfdt', tfdt), box('trun', trun)))));
}

describe('moofKeyTimes', () => {
  it('finds a keyframe in the MIDDLE of a fragment (live, allowPartialGOP)', () => {
    const m = moofWithSamples(1000, 90000, [true, true, false, true]);
    expect(moofKeyTimes(m, 90000)).toEqual([1000 + 2 * (3000 / 90000)]);
  });

  it('uses the trex/tfhd default flags when samples carry none', () => {
    const tfhd = new Uint8Array(12);
    new DataView(tfhd.buffer).setUint32(0, 0x000008);
    new DataView(tfhd.buffer).setUint32(8, 3000);
    const tfdt = new Uint8Array(12);
    tfdt[0] = 1;
    new DataView(tfdt.buffer).setBigUint64(4, BigInt(90000 * 50));
    const trun = new Uint8Array(8);
    new DataView(trun.buffer).setUint32(4, 2);
    const m = box('moof', box('traf', cat(box('tfhd', tfhd), box('tfdt', tfdt), box('trun', trun))));
    expect(moofKeyTimes(m, 90000, 0x10000)).toEqual([]); // default non-sync
    expect(moofKeyTimes(m, 90000, 0)).toEqual([50, 50 + 3000 / 90000]); // default sync
  });
});

describe('box readers', () => {
  it('reads the first mdhd timescale and a version-1 tfdt', () => {
    expect(initTimescale(init(16000))).toBe(16000);
    expect(moofTime(moof(1000.25, 90000), 90000)).toBeCloseTo(1000.25, 6);
  });

  it('returns null when the box is missing', () => {
    expect(initTimescale(box('ftyp', enc.encode('isom')))).toBeNull();
    expect(moofTime(box('moof', new Uint8Array(20)), 90000)).toBeNull();
  });
});
