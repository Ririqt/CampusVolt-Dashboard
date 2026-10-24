"""CampusVolt local web server with shared charging-session state.

Run with: python server.py
Devices on the same network can then open the server's LAN address.  Session
changes are kept here instead of in one browser's localStorage, which lets all
connected dashboards see the same port availability.
"""

from __future__ import annotations

import argparse
import hmac
import json
import mimetypes
import os
import threading
import time
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse


ROOT = Path(__file__).resolve().parent
STATE_FILE = ROOT / ".campusvolt-state.json"
PORT_IDS = {
    "outlet-1",
    "outlet-2",
    "dc-type-c",
    "dc-micro-usb",
    "dc-lightning",
    "wireless-pad",
}
STATE_LOCK = threading.RLock()
HARDWARE_TTL_MS = 30_000
STATION_ID = os.environ.get("CAMPUSVOLT_STATION_ID", "station-01")
STATION_API_KEY = os.environ.get("CAMPUSVOLT_STATION_API_KEY", "")


def _load_state() -> dict:
    try:
        payload = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        return payload if isinstance(payload, dict) else {}
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return {}


def _save_state(payload: dict) -> None:
    temporary = STATE_FILE.with_suffix(".tmp")
    temporary.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    temporary.replace(STATE_FILE)


def _load_sessions() -> list[dict]:
    sessions = _load_state().get("sessions", [])
    return sessions if isinstance(sessions, list) else []


def _save_sessions(sessions: list[dict]) -> None:
    payload = _load_state()
    payload["sessions"] = sessions
    _save_state(payload)


def _active_sessions() -> list[dict]:
    now_ms = int(time.time() * 1000)
    sessions = _load_sessions()
    active = [
        session
        for session in sessions
        if session.get("portId") in PORT_IDS
        and int(session.get("endTime", 0)) > now_ms
    ]
    if len(active) != len(sessions):
        _save_sessions(active)
    return active


def _hardware_status() -> dict:
    hardware = _load_state().get("hardware", {})
    updated_at = int(hardware.get("updatedAt", 0)) if isinstance(hardware, dict) else 0
    online = bool(updated_at and int(time.time() * 1000) - updated_at <= HARDWARE_TTL_MS)
    channels = {}
    for port_id in PORT_IDS:
        source = hardware.get("channels", {}).get(port_id, {}) if online else {}
        channels[port_id] = {
            "inUse": bool(source.get("inUse", False)),
            "watts": max(0, float(source.get("watts", 0) or 0)),
            "voltageV": max(0, float(source.get("voltageV", 0) or 0)),
            "currentA": max(0, float(source.get("currentA", 0) or 0)),
            "relayOn": bool(source.get("relayOn", False)),
            "fault": str(source.get("fault"))[:80] if source.get("fault") else None,
        }
    return {
        "online": online,
        "stationId": STATION_ID,
        "updatedAt": updated_at if online else None,
        "firmwareVersion": str(hardware.get("firmwareVersion", "unknown"))[:40] if online else None,
        "rssi": hardware.get("rssi") if online else None,
        "channels": channels,
    }


def _save_hardware(hardware: dict) -> None:
    payload = _load_state()
    payload["hardware"] = hardware
    _save_state(payload)


class CampusVoltHandler(SimpleHTTPRequestHandler):
    server_version = "CampusVolt/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self) -> None:
        if self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-store")
        elif Path(urlparse(self.path).path).suffix in {".html", ".js", ".css"}:
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > 16_384:
            raise ValueError("Invalid request body")
        payload = json.loads(self.rfile.read(length).decode("utf-8"))
        if not isinstance(payload, dict):
            raise ValueError("JSON object required")
        return payload

    def do_GET(self) -> None:
        if urlparse(self.path).path == "/api/sessions":
            with STATE_LOCK:
                self._send_json(
                    HTTPStatus.OK,
                    {"stationId": STATION_ID, "sessions": _active_sessions(), "station": _hardware_status()},
                )
            return
        super().do_GET()

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/station-status":
            self._handle_station_status()
            return
        if path != "/api/sessions":
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        try:
            request = self._read_json()
            port_id = str(request.get("portId", ""))
            duration = int(request.get("durationMinutes", 0))
            if port_id not in PORT_IDS or not 1 <= duration <= 120:
                raise ValueError("Invalid port or duration")
        except (ValueError, TypeError, json.JSONDecodeError) as error:
            self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
            return

        with STATE_LOCK:
            sessions = _active_sessions()
            hardware_channel = _hardware_status()["channels"].get(port_id, {})
            if hardware_channel.get("inUse") or hardware_channel.get("fault"):
                self._send_json(
                    HTTPStatus.CONFLICT,
                    {"error": "Station sensors report that this channel is unavailable.", "sessions": sessions, "station": _hardware_status()},
                )
                return
            if any(session["portId"] == port_id for session in sessions):
                self._send_json(
                    HTTPStatus.CONFLICT,
                    {"error": "That port is already in use.", "sessions": sessions},
                )
                return

            now_ms = int(time.time() * 1000)
            watts = 10 if port_id == "wireless-pad" else 9
            session = {
                "portId": port_id,
                "portName": str(request.get("portName", port_id)),
                "portType": str(request.get("portType", "outlet")),
                "spec": str(request.get("spec", "")),
                "device": str(request.get("device", "Phone")),
                "watts": watts,
                "paid": f"PHP {duration} - {str(request.get('method', 'Cash'))}",
                "durationMinutes": duration,
                "totalSeconds": duration * 60,
                "remainingSeconds": duration * 60,
                "cost": float(duration),
                "startTime": now_ms,
                "endTime": now_ms + duration * 60_000,
                "energyKWh": 0.0,
            }
            sessions.append(session)
            _save_sessions(sessions)
            self._send_json(HTTPStatus.CREATED, {"session": session, "sessions": sessions})

    def _handle_station_status(self) -> None:
        if not STATION_API_KEY:
            self._send_json(HTTPStatus.SERVICE_UNAVAILABLE, {"error": "CAMPUSVOLT_STATION_API_KEY is not configured."})
            return
        authorization = self.headers.get("Authorization", "")
        bearer = authorization[7:] if authorization.startswith("Bearer ") else ""
        supplied_key = self.headers.get("X-CampusVolt-Key", "") or bearer
        if not supplied_key or not hmac.compare_digest(supplied_key, STATION_API_KEY):
            self._send_json(HTTPStatus.UNAUTHORIZED, {"error": "Invalid station credentials."})
            return

        try:
            request = self._read_json()
            if request.get("stationId") and str(request["stationId"]) != STATION_ID:
                self._send_json(HTTPStatus.CONFLICT, {"error": f"This endpoint is configured for {STATION_ID}."})
                return
            channels = {}
            supplied_channels = request.get("channels", {})
            for port_id in PORT_IDS:
                source = supplied_channels.get(port_id, {}) if isinstance(supplied_channels, dict) else {}
                watts = min(500, max(0, float(source.get("watts", 0) or 0)))
                channels[port_id] = {
                    "inUse": bool(source.get("inUse", watts >= 1)),
                    "watts": watts,
                    "voltageV": min(300, max(0, float(source.get("voltageV", 0) or 0))),
                    "currentA": min(20, max(0, float(source.get("currentA", 0) or 0))),
                    "relayOn": bool(source.get("relayOn", False)),
                    "fault": str(source.get("fault"))[:80] if source.get("fault") else None,
                }
        except (ValueError, TypeError, json.JSONDecodeError) as error:
            self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
            return

        hardware = {
            "stationId": STATION_ID,
            "updatedAt": int(time.time() * 1000),
            "firmwareVersion": str(request.get("firmwareVersion", "unknown"))[:40],
            "rssi": request.get("rssi"),
            "channels": channels,
        }
        with STATE_LOCK:
            _save_hardware(hardware)
        self._send_json(
            HTTPStatus.ACCEPTED,
            {"accepted": True, "heartbeatTtlSeconds": HARDWARE_TTL_MS // 1000, "station": _hardware_status()},
        )

    def do_DELETE(self) -> None:
        path = unquote(urlparse(self.path).path)
        if path == "/api/sessions":
            try:
                port_id = str(self._read_json().get("portId", ""))
            except (ValueError, TypeError, json.JSONDecodeError) as error:
                self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
                return
        elif path.startswith("/api/sessions/"):
            port_id = path[len("/api/sessions/") :]
        else:
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        if port_id not in PORT_IDS:
            self._send_json(HTTPStatus.NOT_FOUND, {"error": "Port not found"})
            return

        with STATE_LOCK:
            sessions = _active_sessions()
            updated = [session for session in sessions if session["portId"] != port_id]
            _save_sessions(updated)
            self._send_json(HTTPStatus.OK, {"sessions": updated})

    def log_message(self, message: str, *args) -> None:
        print(f"{self.address_string()} - {message % args}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve the CampusVolt dashboard")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=5500)
    args = parser.parse_args()

    mimetypes.add_type("text/javascript", ".js")
    server = ThreadingHTTPServer((args.host, args.port), CampusVoltHandler)
    print(f"CampusVolt is running on http://{args.host}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
