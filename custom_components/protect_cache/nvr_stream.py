"""Relay the NVR's own fMP4 streams to the card (the single-player engine).

Why this exists
---------------
The UniFi Protect web app never downloads clip files. It plays recorded and live
footage into ONE `<video>` (MediaSource) from two NVR websockets:

    /proxy/protect/api/ws/playback    recorded footage from any instant
    /proxy/protect/api/ws/livestream  live footage

Both carry wall-clock timestamps, so recorded and live footage share one
timeline: a seek is a seek inside one buffer, and nothing is ever handed from
one player to another. Measured from inside HA (2026-10-12): a playback socket
opens in ~60 ms and streams 60 s of 2K footage in ~1.5 s; a live socket's first
keyframe arrives 0.10-0.15 s after the request. The clip-session path this
replaces needed an export, a remux and a second `<video>` for every piece.

The browser cannot reach the NVR itself (Protect login, self-signed
certificate, remote access through HA), so this view relays bytes with the
unifiprotect integration's own authenticated session. It does NOT parse or
repack the media - the card deframes it - so relaying costs only a copy.

Protocol (card <-> this view, one websocket per player)
-------------------------------------------------------
Client -> server, text JSON:
    {"op": "live", "gen": n, "nvr_id", "camera_id", "channel"}
    {"op": "play", "gen": n, "nvr_id", "camera_id", "channel", "start", "end"?}
    {"op": "pause"} | {"op": "resume"}      flow control for "play" streams
    {"op": "stop"}
A new "live"/"play" replaces the stream in flight. `gen` is chosen by the
card and tags everything that stream produces.

Server -> client:
    binary: 4-byte big-endian gen + the NVR's bytes, unmodified
    text:   {"ev": "open", "gen", "start", "end"}   playback range granted
            {"ev": "end", "gen"}                     the NVR closed the stream
            {"ev": "error", "gen", "message"}

The NVR's stream framing (decoded by the card) is `[type:1][len:3][payload]`:
248 codec string, 250 init segment, 249/255 begin/end of a media segment, 251
moof, 254 mdat header, 252 video samples, 253 audio samples, 247 timestamps.
A playback stream first sends one Protect packet (`{"success":true}` +
`{channelName,start,end}`) and then waits for a `resume` command.
"""

from __future__ import annotations

import asyncio
import json
import logging
import struct
import zlib
from contextlib import suppress
from typing import Any
from urllib.parse import urlencode, urlsplit, urlunsplit

import aiohttp
from aiohttp import web

from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr, entity_registry as er

_LOGGER = logging.getLogger(__name__)

# Upstream NVR sockets open at once across all viewers. Each live 2K stream is
# ~1 MB/s; a recorded stream is throttled by the card's pause/resume.
MAX_UPSTREAMS = 12
# Negotiating and connecting an upstream: ~60 ms measured; anything near this
# is a wedged NVR, and uiprotect itself calls the NVR with no timeout at all.
CONNECT_TIMEOUT_S = 10
# A resumed upstream that sends nothing for this long is reported, so the card
# can retry instead of waiting on a silent socket.
UPSTREAM_SILENT_S = 20
# Detects a client that vanished without closing (phone locked, Wi-Fi lost).
CLIENT_HEARTBEAT_S = 30

PLAYBACK_PATH = "/proxy/protect/api/ws/playback"
LIVESTREAM_PATH = "/proxy/protect/api/ws/livestream"

# The Protect web UI's own livestream parameters. `useWallClock` without
# `rebaseTimestampsToZero` is what puts live on the same timeline as playback.
LIVE_PARAMS = {
    "progressive": "",
    "allowPartialGOP": "",
    "fragmentDurationMillis": "100",
    "extendedVideoMetadata": "",
    "chunkSize": "4096",
    "rebaseTimestampsToZero": "false",
    "useWallClock": "true",
    "type": "fmp4",
}

_active_upstreams = 0


def _packet(header: dict[str, Any], body: dict[str, Any]) -> bytes:
    """A Protect command packet: two frames `[type, format=JSON, deflated, 0, len32]`."""
    h = zlib.compress(json.dumps(header).encode())
    b = zlib.compress(json.dumps(body).encode())
    return (
        struct.pack(">BBBBI", 1, 1, 1, 0, len(h)) + h
        + struct.pack(">BBBBI", 2, 1, 1, 0, len(b)) + b
    )


def _parse_packet(data: bytes) -> tuple[dict[str, Any], dict[str, Any]] | None:
    """The playback socket's opening packet -> (header, body), or None."""
    frames: list[Any] = []
    off = 0
    try:
        for _ in range(2):
            ftype, fmt, deflated, _pad, size = struct.unpack(">BBBBI", data[off:off + 8])
            payload = data[off + 8:off + 8 + size]
            off += 8 + size
            if deflated:
                payload = zlib.decompress(payload)
            frames.append(json.loads(payload) if fmt == 1 else payload.decode(errors="replace"))
    except (struct.error, zlib.error, ValueError):
        return None
    header, body = frames
    return (header if isinstance(header, dict) else {}), (body if isinstance(body, dict) else {})


def resolve_camera(hass: HomeAssistant, data: Any, camera_id: str) -> str | None:
    """A Protect camera id or an HA camera entity_id -> the Protect camera id.

    Same resolution as clip_session.py (and core's VideoProxyView): entity ->
    device -> MAC -> Protect device.
    """
    from uiprotect.data import Camera  # noqa: PLC0415

    if camera_id in data.api.bootstrap.cameras:
        return camera_id
    entity_registry = er.async_get(hass)
    device_registry = dr.async_get(hass)
    if (entity := entity_registry.async_get(camera_id)) is None or (
        device := device_registry.async_get(entity.device_id or "")
    ) is None:
        return None
    for kind, mac in device.connections:
        if kind != dr.CONNECTION_NETWORK_MAC:
            continue
        ufp_device = data.api.bootstrap.get_device_from_mac(mac)
        if isinstance(ufp_device, Camera):
            return ufp_device.id
    return None


class _Relay:
    """One card player's websocket and the (at most one) NVR stream behind it."""

    def __init__(self, hass: HomeAssistant, client: web.WebSocketResponse) -> None:
        self.hass = hass
        self.client = client
        self.task: asyncio.Task[None] | None = None
        self.upstream: aiohttp.ClientWebSocketResponse | None = None
        self.kind: str | None = None
        self.gen = 0
        # The card's flow-control wish. Kept here because a pause can arrive
        # while the upstream is still connecting, before there is anything to
        # send it to.
        self.paused = False

    async def send_event(self, event: dict[str, Any]) -> None:
        if not self.client.closed:
            with suppress(ConnectionError, RuntimeError):
                await self.client.send_str(json.dumps(event))

    async def stop(self) -> None:
        """Cancel the stream in flight and wait until its upstream is closed."""
        task, self.task = self.task, None
        if task is not None:
            task.cancel()
            with suppress(asyncio.CancelledError, Exception):
                await task

    async def command(self, op: dict[str, Any]) -> None:
        """Flow control for the current playback stream."""
        paused = op["op"] == "pause"
        if paused == self.paused:
            return
        self.paused = paused
        if self.kind != "play" or self.upstream is None or self.upstream.closed:
            return
        with suppress(ConnectionError, RuntimeError):
            await self.upstream.send_bytes(_packet({"command": op["op"]}, {}))

    async def start(self, op: dict[str, Any]) -> None:
        await self.stop()
        self.gen = int(op.get("gen") or 0)
        self.kind = op["op"]
        self.paused = bool(op.get("paused"))
        self.task = asyncio.create_task(self._run(self.gen, op))

    async def _run(self, gen: int, op: dict[str, Any]) -> None:
        global _active_upstreams  # noqa: PLW0603 - a process-wide cap
        if _active_upstreams >= MAX_UPSTREAMS:
            await self.send_event({"ev": "error", "gen": gen, "message": "too many streams"})
            return
        _active_upstreams += 1
        try:
            await self._stream(gen, op)
        except asyncio.CancelledError:
            raise
        except Exception as err:  # noqa: BLE001 - every failure goes back to the card
            _LOGGER.warning("Protect stream failed (%s %s): %s", op.get("op"), op.get("camera_id"), err)
            await self.send_event({"ev": "error", "gen": gen, "message": str(err) or type(err).__name__})
        finally:
            _active_upstreams -= 1
            upstream, self.upstream = self.upstream, None
            if upstream is not None and not upstream.closed:
                with suppress(Exception):
                    await upstream.close()

    async def _stream(self, gen: int, op: dict[str, Any]) -> None:
        # Imported lazily: unifiprotect may still be loading when this module is.
        from homeassistant.components.unifiprotect.data import (  # noqa: PLC0415
            async_get_data_for_entry_id,
            async_get_data_for_nvr_id,
        )

        nvr_id = str(op.get("nvr_id") or "")
        data = async_get_data_for_nvr_id(self.hass, nvr_id) or async_get_data_for_entry_id(
            self.hass, nvr_id
        )
        if data is None:
            raise ValueError("unknown NVR")
        camera = resolve_camera(self.hass, data, str(op.get("camera_id") or ""))
        if camera is None:
            raise ValueError("unknown camera")
        channel = int(op.get("channel") or 0)
        if channel not in (0, 1, 2):
            raise ValueError("bad channel")

        if op["op"] == "live":
            path = LIVESTREAM_PATH
            params = {"camera": camera, "channel": str(channel), **LIVE_PARAMS,
                      "requestId": f"upc-{camera}-{channel}"}
        else:
            path = PLAYBACK_PATH
            params = {"format": "FMP4", "camera": camera, "channel": str(channel),
                      "start": str(int(op["start"]))}
            if op.get("end"):
                params["end"] = str(int(op["end"]))

        api = data.api
        async with asyncio.timeout(CONNECT_TIMEOUT_S):
            response = await api.request(
                "get", f"{path}?{urlencode(params)}", require_auth=True, auto_close=False
            )
            try:
                if response.status != 200:
                    raise ValueError(f"NVR refused the stream ({response.status})")
                url = (await response.json(content_type=None))["url"]
            finally:
                response.release()
            # The NVR mints the URL with its own idea of its address; keep its
            # port, path and query (they carry the token) and use the configured host.
            parts = urlsplit(url)
            host = getattr(api, "_host", None) or parts.hostname
            netloc = f"{host}:{parts.port}" if parts.port else host
            url = urlunsplit((parts.scheme, netloc, parts.path, parts.query, ""))
            session = await api.get_session()
            self.upstream = await session.ws_connect(
                url, ssl=False if not getattr(api, "_verify_ssl", False) else None,
                max_msg_size=0, heartbeat=CLIENT_HEARTBEAT_S,
            )

        upstream = self.upstream
        if op["op"] == "play":
            # The playback socket opens with one packet saying what it granted,
            # then sits idle until it is told to resume.
            async with asyncio.timeout(CONNECT_TIMEOUT_S):
                first = await upstream.receive()
            if first.type != aiohttp.WSMsgType.BINARY or (parsed := _parse_packet(first.data)) is None:
                raise ValueError("unexpected playback reply")
            header, body = parsed
            if not header.get("success", False):
                raise ValueError(str(body.get("error") or "playback refused"))
            await self.send_event({"ev": "open", "gen": gen,
                                   "start": body.get("start"), "end": body.get("end")})
            if not self.paused:
                await upstream.send_bytes(_packet({"command": "resume"}, {}))
        else:
            await self.send_event({"ev": "open", "gen": gen, "start": None, "end": None})

        tag = struct.pack(">I", gen & 0xFFFFFFFF)
        while True:
            try:
                async with asyncio.timeout(UPSTREAM_SILENT_S if op["op"] == "live" else None):
                    msg = await upstream.receive()
            except TimeoutError:
                raise ValueError("the NVR stopped sending") from None
            if msg.type == aiohttp.WSMsgType.BINARY:
                if self.client.closed:
                    return
                # Awaiting the send is the backpressure: a slow client stops
                # this loop reading, and TCP slows the NVR down.
                await self.client.send_bytes(tag + msg.data)
            elif msg.type in (aiohttp.WSMsgType.CLOSE, aiohttp.WSMsgType.CLOSED,
                              aiohttp.WSMsgType.CLOSING):
                await self.send_event({"ev": "end", "gen": gen})
                return
            elif msg.type == aiohttp.WSMsgType.ERROR:
                raise ValueError(f"NVR stream error: {upstream.exception()}")


class ProtectStreamView(HomeAssistantView):
    """The card's player websocket (`/api/protect_stream/ws`)."""

    url = "/api/protect_stream/ws"
    name = "api:protect_stream:ws"
    # A browser websocket cannot send an Authorization header, so the card
    # signs this path (auth/sign_path) and opens it with ?authSig=...
    requires_auth = True

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass

    async def get(self, request: web.Request) -> web.StreamResponse:
        client = web.WebSocketResponse(heartbeat=CLIENT_HEARTBEAT_S, max_msg_size=64 * 1024)
        await client.prepare(request)
        relay = _Relay(self.hass, client)
        try:
            async for msg in client:
                if msg.type != aiohttp.WSMsgType.TEXT:
                    continue
                try:
                    op = json.loads(msg.data)
                except ValueError:
                    continue
                if not isinstance(op, dict):
                    continue
                kind = op.get("op")
                if kind in ("live", "play"):
                    if kind == "play" and not isinstance(op.get("start"), (int, float)):
                        await relay.send_event({"ev": "error", "gen": op.get("gen"),
                                                "message": "start is required"})
                        continue
                    await relay.start(op)
                elif kind in ("pause", "resume"):
                    await relay.command(op)
                elif kind == "stop":
                    await relay.stop()
        finally:
            await relay.stop()
        return client


def async_setup_nvr_stream(hass: HomeAssistant) -> None:
    """Register the player websocket."""
    hass.http.register_view(ProtectStreamView(hass))
