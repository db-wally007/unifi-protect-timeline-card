"""Talk: the card's microphone to a camera's speaker.

The talk half of two-way audio, for cameras whose Protect `featureFlags` say
`hasSpeaker` (the doorbell). Home Assistant has no live talkback for UniFi
Protect - the integration's speaker entity only plays files / TTS - so this
does what the Protect app, Scrypted and go2rtc's unifi-talkback PR all do:
Protect hands out a talkback session (a codec, a sample rate and an RTP/UDP
address on the camera) and the microphone audio is encoded and sent there.

The browser captures the microphone (getUserMedia, echo cancellation on, so
the visitor's voice from the phone's loudspeaker is not sent back to the door)
and streams raw
PCM over this websocket; talk_sender.py (one small process per session)
encodes each frame with PyAV (the library uiprotect's own talkback uses) to
what the session asked for (measured 2026-10-21: the G6 Entry wants Opus,
24 kHz, mono, at rtp://<camera>:7004) and sends it straight to the camera on a
steady 20 ms clock - why a clock and why its own process: see talk_sender.py.

Why PyAV and not an FFmpeg subprocess, measured 2026-10-21 from PCM in to RTP
out on a local listener: FFmpeg's raw-PCM input reads ~85 ms blocks, so its
packets left in bursts of four (~81 ms behind); a WAV input paced them but took
~0.7 s to start; AU burst too. PyAV: 21 ms behind (one Opus frame). Opus
frames stay at 20 ms: the G6 Entry plays NOTHING sent in 10 ms frames.

Protocol, `/api/protect_talk/ws` (signed path, exactly like the stream relay):
    client -> {"op": "start", "nvr_id", "camera_id", "rate"}
              then BINARY frames: mono signed 16-bit little-endian PCM at
              `rate` Hz, ~20 ms each
           -> {"op": "stop"}, or just close the socket
    server -> {"ev": "ready", "codec", "rate"}
              {"ev": "error", "message"}
              {"ev": "ended", "reason"}
The speaker is only engaged once audio arrives: the sender waits for the
first frame, so opening the socket alone sends nothing to the door.

Also `protect_cache.talk_test`: a short, quiet tone through the same path, to
check a camera's talkback without a browser.
"""

from __future__ import annotations

import asyncio
from contextlib import suppress
import json
import logging
import math
from pathlib import Path
import struct
import sys
import time
from typing import Any

import aiohttp
from aiohttp import web

from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant, ServiceCall, ServiceResponse, SupportsResponse

from .nvr_stream import resolve_camera

_LOGGER = logging.getLogger(__name__)

DOMAIN = "protect_cache"

CLIENT_HEARTBEAT_S = 30
MAX_TALK_S = 300          # one press of Talk talks for at most this long
IDLE_S = 15               # no audio for this long (tab hidden, mic gone) = done
MIN_RATE, MAX_RATE = 8_000, 96_000
MAX_PIPE_BYTES = 64 * 1024  # unread PCM queued for the sender (~0.7 s at 48 kHz): past
                            # this it is stuck, and frames are dropped, not piled up
SENDER_READY_S = 5          # the sender process says "ready" in ~60 ms
SENDER = str(Path(__file__).with_name("talk_sender.py"))
TEST_TONE_HZ = 1_500
TEST_VOLUME = 0.12        # of full scale - a quiet beep

# Cameras being talked to right now -> the session doing it: one talker per door.
_talking: dict[str, TalkSession] = {}


class TalkError(Exception):
    """A talk request that cannot be served (reported to the card)."""


# Talkback codecs talk_sender.py can encode (as Protect names them).
CODECS = ("opus", "aac")


class _Sender:
    """talk_sender.py for one session: encodes and sends on a steady clock in
    its OWN process (see its docstring: in a thread here, Home Assistant's
    interpreter lock bunched the packets and the doorbell played ~0.17 s later)."""

    def __init__(self, url: str, codec: str, out_rate: int, in_rate: int) -> None:
        self.args = [url, codec, str(out_rate), str(in_rate)]
        self.proc: asyncio.subprocess.Process | None = None
        self.errors: list[str] = []
        self.dropped = 0
        self._stderr: asyncio.Task | None = None

    async def start(self) -> None:
        # -I: the config directory must not land on sys.path (a custom
        # component there shadows stdlib modules).
        self.proc = await asyncio.create_subprocess_exec(
            sys.executable, "-I", SENDER, *self.args,
            stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE)
        self._stderr = asyncio.create_task(self._read_stderr())
        assert self.proc.stdout is not None
        try:
            line = await asyncio.wait_for(self.proc.stdout.readline(), SENDER_READY_S)
        except TimeoutError:
            line = b""
        if line.strip() != b"ready":
            await self.close()
            raise TalkError(f"talkback sender failed to start: {self.error}")

    async def _read_stderr(self) -> None:
        assert self.proc is not None and self.proc.stderr is not None
        async for raw in self.proc.stderr:
            line = raw.decode(errors="replace").rstrip()
            if line:
                self.errors = [*self.errors[-9:], line]
                _LOGGER.warning("protect talk sender: %s", line)

    @property
    def alive(self) -> bool:
        return self.proc is not None and self.proc.returncode is None

    @property
    def error(self) -> str:
        return self.errors[-1] if self.errors else "exited"

    def put(self, pcm: bytes) -> None:
        """Queue one frame (never blocks the event loop)."""
        assert self.proc is not None and self.proc.stdin is not None
        transport = self.proc.stdin.transport
        if transport.get_write_buffer_size() > MAX_PIPE_BYTES:
            self.dropped += 1
            return  # the sender is stuck: drop rather than pile up
        self.proc.stdin.write(struct.pack("<I", len(pcm)) + pcm)

    async def close(self) -> None:
        proc, self.proc = self.proc, None
        if proc is None:
            return
        if proc.stdin is not None and not proc.stdin.is_closing():
            proc.stdin.close()  # end of stdin: the sender flushes and exits
        try:
            await asyncio.wait_for(proc.wait(), 2)
        except TimeoutError:
            with suppress(ProcessLookupError):
                proc.kill()
            await proc.wait()
        if self._stderr is not None:
            with suppress(Exception):
                await asyncio.wait_for(self._stderr, 1)


def _protect_data(hass: HomeAssistant, nvr_id: str) -> Any:
    # Imported lazily: unifiprotect may still be loading when this module is.
    from homeassistant.components.unifiprotect.data import (  # noqa: PLC0415
        async_get_data_for_entry_id,
        async_get_data_for_nvr_id,
    )

    data = async_get_data_for_nvr_id(hass, nvr_id) or async_get_data_for_entry_id(hass, nvr_id)
    if data is None and not nvr_id:
        for entry in hass.config_entries.async_entries("unifiprotect"):
            if (data := async_get_data_for_entry_id(hass, entry.entry_id)) is not None:
                break
    if data is None:
        raise TalkError("unknown NVR")
    return data


class TalkSession:
    """One talker's path to one camera's speaker."""

    def __init__(self, hass: HomeAssistant, nvr_id: str, camera: str) -> None:
        self.hass = hass
        self.nvr_id = nvr_id
        self.camera = camera
        self.camera_id = ""
        self.codec = ""
        self.rate = 0
        self.url = ""
        self.in_rate = 48_000
        self.sender: _Sender | None = None
        self.started = 0.0
        self.last_audio = 0.0
        self.closed = False
        # Telemetry (the card's `debug: true` sends its client id): when frames
        # arrived here, by the server's clock - an uneven arrival is what made
        # the doorbell grow its buffer, and these times line the session up
        # with the doorbell's own recording.
        self.debug_client: str | None = None
        self.opened_ms = 0
        self.frames = 0
        self.first_ms = 0
        self.last_ms = 0
        self.max_gap_ms = 0.0
        self.late = 0

    async def open(self, in_rate: int) -> dict[str, Any]:
        """Resolve the camera, claim its speaker and get its talkback session."""
        if not MIN_RATE <= in_rate <= MAX_RATE:
            raise TalkError(f"bad sample rate {in_rate}")
        self.in_rate = in_rate
        data = _protect_data(self.hass, self.nvr_id)
        camera_id = resolve_camera(self.hass, data, self.camera)
        if camera_id is None:
            raise TalkError("unknown camera")
        cam = data.api.bootstrap.cameras.get(camera_id)
        if cam is None or not cam.feature_flags.has_speaker:
            raise TalkError("this camera has no speaker")
        if camera_id in _talking:
            raise TalkError("someone is already talking to this camera")
        self.camera_id = camera_id
        _talking[camera_id] = self
        try:
            session = await data.api.create_talkback_session_public(camera_id)
            self.codec, self.rate, self.url = session.codec, session.sampling_rate, session.url
        except Exception as err:  # noqa: BLE001 - no public API key: the camera's own settings
            _LOGGER.debug("protect talk: no public talkback session (%s), using camera settings", err)
            ts = cam.talkback_settings
            self.codec, self.rate = ts.type_fmt.value, ts.sampling_rate
            scheme = "rtp" if self.codec == "opus" else "udp"
            self.url = f"{scheme}://{cam.host}:{ts.bind_port}"
        if self.codec not in CODECS:
            raise TalkError(f"unsupported talkback codec: {self.codec}")
        # Started now and ready in ~60 ms, so the first frame is sent at once;
        # it sends nothing to the camera until that first frame.
        self.sender = _Sender(self.url, self.codec, self.rate, self.in_rate)
        await self.sender.start()
        self.started = self.last_audio = time.monotonic()
        self.opened_ms = round(time.time() * 1000)
        return {"codec": self.codec, "rate": self.rate}

    async def feed(self, pcm: bytes) -> None:
        """One frame of microphone PCM."""
        if self.closed:
            return
        sender = self.sender
        if sender is None or not sender.alive:
            raise TalkError(f"talkback sender stopped: {sender.error if sender else 'not started'}")
        sender.put(pcm)
        self.last_audio = time.monotonic()
        if self.debug_client:
            now = time.time() * 1000
            if self.frames:
                gap = now - self.last_ms
                self.max_gap_ms = max(self.max_gap_ms, gap)
                if gap > 60:
                    self.late += 1
            else:
                self.first_ms = round(now)
            self.frames += 1
            self.last_ms = round(now)

    async def close(self) -> None:
        if self.closed:
            return
        self.closed = True
        if _talking.get(self.camera_id) is self:
            del _talking[self.camera_id]
        sender, self.sender = self.sender, None
        if sender is not None:
            await sender.close()
        if self.debug_client:
            from .debug import async_write_debug  # noqa: PLC0415

            await async_write_debug(self.hass, self.debug_client, {
                "ev": "talk-session", "camera": self.camera, "codec": self.codec,
                "rate": self.rate, "in_rate": self.in_rate, "opened": self.opened_ms,
                "first": self.first_ms, "last": self.last_ms, "frames": self.frames,
                "max_gap_ms": round(self.max_gap_ms), "late_frames": self.late,
                "dropped": sender.dropped if sender is not None else 0,
            })


class ProtectTalkView(HomeAssistantView):
    """The card's Talk websocket (`/api/protect_talk/ws`)."""

    url = "/api/protect_talk/ws"
    name = "api:protect_talk:ws"
    # A browser websocket cannot send an Authorization header, so the card
    # signs this path (auth/sign_path) and opens it with ?authSig=...
    requires_auth = True

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass

    async def get(self, request: web.Request) -> web.StreamResponse:
        client = web.WebSocketResponse(
            heartbeat=CLIENT_HEARTBEAT_S, max_msg_size=64 * 1024, compress=False
        )
        await client.prepare(request)
        talk: TalkSession | None = None
        reason = "stopped"

        async def send(event: dict[str, Any]) -> None:
            if not client.closed:
                with suppress(ConnectionError, RuntimeError):
                    await client.send_str(json.dumps(event))

        async def watchdog() -> None:
            nonlocal reason
            while True:
                await asyncio.sleep(1)
                if talk is None:
                    continue
                now = time.monotonic()
                if now - talk.started > MAX_TALK_S:
                    reason = "time limit"
                elif now - talk.last_audio > IDLE_S:
                    reason = "no audio"
                else:
                    continue
                await client.close()
                return

        dog = asyncio.create_task(watchdog())
        try:
            async for msg in client:
                if msg.type == aiohttp.WSMsgType.TEXT:
                    try:
                        op = json.loads(msg.data)
                    except ValueError:
                        continue
                    if not isinstance(op, dict):
                        continue
                    if op.get("op") == "start" and talk is None:
                        talk = TalkSession(self.hass, str(op.get("nvr_id") or ""),
                                           str(op.get("camera_id") or ""))
                        if isinstance(op.get("debug"), str):
                            talk.debug_client = op["debug"]
                        try:
                            info = await talk.open(int(op.get("rate") or 48_000))
                        except (TalkError, ValueError) as err:
                            await send({"ev": "error", "message": str(err)})
                            await talk.close()  # releases the camera if it was claimed
                            talk = None
                            break
                        await send({"ev": "ready", **info})
                    elif op.get("op") == "stop":
                        break
                elif msg.type == aiohttp.WSMsgType.BINARY and talk is not None:
                    try:
                        await talk.feed(msg.data)
                    except (TalkError, ConnectionError, BrokenPipeError) as err:
                        await send({"ev": "error", "message": str(err) or "talkback failed"})
                        break
        finally:
            dog.cancel()
            if talk is not None:
                await talk.close()
            await send({"ev": "ended", "reason": reason})
        return client


def test_tone(rate: int, ms: int, hz: int = TEST_TONE_HZ, volume: float = TEST_VOLUME) -> bytes:
    """`ms` of a sine tone, mono s16le at `rate`, with 10 ms fades (no click)."""
    n = rate * ms // 1000
    fade = rate // 100
    out = bytearray()
    for i in range(n):
        env = min(1.0, i / fade, (n - 1 - i) / fade)
        out += struct.pack("<h", int(32767 * volume * env * math.sin(2 * math.pi * hz * i / rate)))
    return bytes(out)


# Why talk_test cannot MEASURE the delay with the camera's own microphone
# (tried 2026-10-21): its echo-cancelled audio (below) has no trace of the
# tone, and its live audio's wall-clock stamps wander ~100 ms against the
# host's. The delay this module adds was measured on a local RTP listener
# instead (see the module docstring), the doorbell's on the other cameras'
# microphones (see talk_sender.py).
#
# ECHO (measured 2026-10-25, relay recordings of all three channels in the
# same seconds while a TTS phrase went through this path): the G6 Entry runs
# its echo canceller ONLY on channel 1's audio. On channels 0 and 2 every word
# comes back ~0.5 s after it was sent, ~30 dB over the street noise (envelope
# correlation 0.72-0.79); channel 1 keeps the street noise and drops the words
# (0.10). Same through the Protect app's WebRTC path - which is why that app
# switches its player to channel 1 ("Auto") while talking, and why the card
# does too (media-view `TALK_LIVE_CHANNEL`). An earlier test here (2026-10-22)
# concluded "the doorbell mutes its mic" because it recorded channel 1.


async def _talk_test(hass: HomeAssistant, camera: str, ms: int,
                     volume: float = TEST_VOLUME) -> dict[str, Any]:
    """Play a tone through `camera`'s speaker via the real talk path, paced in
    20 ms frames exactly like the card sends them."""
    rate = 48_000
    talk = TalkSession(hass, "", camera)
    try:
        info = await talk.open(rate)
        frame = rate * 2 // 50  # 20 ms of s16le
        lead = rate * 2 // 5  # 400 ms of silence before the tone
        pcm = bytes(lead) + test_tone(rate, ms, volume=volume) + bytes(lead)
        t0 = time.monotonic()
        for i in range(0, len(pcm), frame):
            await talk.feed(pcm[i:i + frame])
            # Real time, like a microphone: the next frame is due 20 ms after the last.
            await asyncio.sleep(max(0.0, t0 + (i // frame + 1) * 0.02 - time.monotonic()))
        return {"ok": True, **info, "url": talk.url, "tone_ms": ms, "volume": volume}
    except TalkError as err:
        return {"ok": False, "error": str(err)}
    finally:
        await talk.close()


def async_setup_talk(hass: HomeAssistant) -> None:
    """Register the Talk websocket and the talk_test action."""
    hass.http.register_view(ProtectTalkView(hass))

    async def _service(call: ServiceCall) -> ServiceResponse:
        ms = max(100, min(2_000, int(call.data.get("duration_ms") or 400)))
        volume = max(0.01, min(0.8, float(call.data.get("volume") or TEST_VOLUME)))
        return await _talk_test(hass, str(call.data.get("camera") or ""), ms, volume)

    hass.services.async_register(DOMAIN, "talk_test", _service,
                                 supports_response=SupportsResponse.OPTIONAL)
