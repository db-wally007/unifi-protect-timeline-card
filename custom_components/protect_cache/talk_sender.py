"""Talk sender: encodes the card's microphone PCM and sends it to a camera's
talkback address ON A STEADY CLOCK, in its own process.

Started by talk.py once per talk session:
    python3 -I talk_sender.py <url> <codec> <out_rate> <in_rate>
prints "ready" once it can send; stdin then carries frames as
[length: 4 bytes little-endian][mono s16le PCM at in_rate]; end of stdin =
done. Errors go to stderr (talk.py logs them). Nothing reaches the camera
before the first frame.

Why a separate process (measured 2026-10-22 on the wire with tcpdump): the
same steady-clock loop as a thread INSIDE Home Assistant sent packets 0.4 to
81 ms apart (13 gaps over 30 ms, up to 92 ms late in 10 s) because its 20 ms
wake-ups wait for Home Assistant's interpreter lock; in its own process every
interval stayed 16-24 ms. The doorbell grows its playback buffer to ride out
uneven packets: through Home Assistant's thread it played 0.94-1.01 s after
the audio, from a steady sender 0.81-0.82 s (same run), the same as the
Protect app's own WebRTC talk (0.77-0.82 s). ~0.8 s is the doorbell's floor.

Only the standard library and PyAV: `-I` keeps the config directory off
sys.path (a custom component there shadows stdlib modules).
"""

from __future__ import annotations

import queue
import struct
import sys
import threading
import time

FRAME_S = 0.02            # the card's frames are 20 ms
JITTER_FRAMES = 4         # held before the clock starts: Home Assistant's own event
                          # loop delivers frames up to ~80 ms late now and then
SLACK_FRAMES = 2          # backlog past JITTER + SLACK is dropped (bursts, clock drift)
BITRATE = 32_000          # speech

# Talkback codec (as Protect names it) -> PyAV encoder, output format, options.
# Same mapping as uiprotect's own TalkbackStream (minus vorbis). Opus frames stay
# at 20 ms: the G6 Entry plays NOTHING sent in 10 ms frames.
CODECS: dict[str, tuple[str, str, dict[str, str]]] = {
    "opus": ("libopus", "rtp", {"application": "lowdelay", "frame_duration": "20"}),
    "aac": ("aac", "adts", {}),
}


def _reader(frames: queue.Queue) -> None:
    """stdin -> frames; None at the end."""
    stdin = sys.stdin.buffer
    try:
        while (head := stdin.read(4)) and len(head) == 4:
            (n,) = struct.unpack("<I", head)
            pcm = stdin.read(n)
            if len(pcm) < n:
                break
            frames.put(pcm)
    finally:
        frames.put(None)


def _next(frames: queue.Queue, silence: bytes) -> bytes | None:
    """The frame due now: backlog past the jitter allowance dropped (keeping the
    end marker), then whatever is queued - silence if nothing arrived in time,
    because a hole would make the camera grow its buffer too."""
    while frames.qsize() > JITTER_FRAMES + SLACK_FRAMES:
        try:
            if frames.get_nowait() is None:
                return None
        except queue.Empty:
            break
    try:
        return frames.get_nowait()
    except queue.Empty:
        return silence


def main(url: str, codec: str, out_rate: int, in_rate: int) -> None:
    import av  # noqa: PLC0415

    frames: queue.Queue = queue.Queue()
    threading.Thread(target=_reader, args=(frames,), daemon=True).start()

    encoder, fmt, options = CODECS[codec]
    out = av.open(url, "w", format=fmt)
    try:
        stream = out.add_stream(encoder, rate=out_rate, options=options)
        stream.layout = "mono"
        stream.bit_rate = BITRATE
        resampler = av.AudioResampler(format="s16", layout="mono", rate=out_rate)
        # talk.py waits for this before telling the card to start sending
        # (~60 ms after start): no first syllable is lost to the start-up.
        print("ready", flush=True)

        def send(pcm: bytes) -> float:
            samples = len(pcm) // 2
            frame = av.AudioFrame(format="s16", layout="mono", samples=samples)
            frame.sample_rate = in_rate
            frame.planes[0].update(pcm[:samples * 2])
            for resampled in resampler.resample(frame):
                for packet in stream.encode(resampled):
                    out.mux(packet)
            return samples / in_rate

        # The first frame starts the clock, after a little backlog has gathered
        # for frames that arrive late to be taken from.
        pcm = frames.get()
        if pcm is not None:
            time.sleep(JITTER_FRAMES * FRAME_S)
        due = time.perf_counter()
        silence = bytes(2 * round(in_rate * FRAME_S))
        while pcm is not None:
            if len(pcm) >= 2:
                due += send(pcm)
            now = time.perf_counter()
            if now - due > 10 * FRAME_S:  # starved (a busy host): restart the clock
                due = now
            elif due > now:
                time.sleep(due - now)
            pcm = _next(frames, silence)
        for packet in stream.encode(None):
            out.mux(packet)
    finally:
        out.close()


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]))
