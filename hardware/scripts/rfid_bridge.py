#!/usr/bin/env python3
"""
rfid_bridge.py — Reads RFID tags from RC522 modules and forwards
ball-detection events to the Tee Time Node.js server via WebSocket.

One process runs on the Raspberry Pi and polls all hole readers in
a round-robin loop. When a tag is detected it sends:
  { "event": "rfid_event", "ballUid": "...", "hole": N, "secret": "..." }

Usage:
  python3 rfid_bridge.py [--server ws://localhost:3000] [--holes 18]
"""

import sys
import time
import json
import signal
import logging
import argparse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("rfid_bridge")

try:
    import RPi.GPIO as GPIO
    from mfrc522 import SimpleMFRC522
    HARDWARE_AVAILABLE = True
except (ImportError, RuntimeError):
    HARDWARE_AVAILABLE = False
    log.warning("RPi.GPIO / mfrc522 not available — running in stub mode (no reads will occur)")

try:
    import websocket
    WS_AVAILABLE = True
except ImportError:
    WS_AVAILABLE = False
    log.warning("websocket-client not installed — events will be logged only")

# CS GPIO pins for each hole (index 0 = hole 1)
HOLE_CS_PINS = [8, 7, 4, 17, 27, 22, 5, 6, 13, 19, 26, 21, 20, 16, 12, 24, 1, 0]
RST_PIN = 25

DEBOUNCE_SECONDS = 5  # ignore same ball on same hole within this window


class RFIDBridge:
    def __init__(self, server_url: str, secret: str, num_holes: int):
        self.server_url = server_url
        self.secret = secret
        self.num_holes = min(num_holes, len(HOLE_CS_PINS))
        self.ws = None
        self.running = False
        self._last_seen: dict[tuple, float] = {}  # (hole, uid) -> timestamp

        if HARDWARE_AVAILABLE:
            GPIO.setmode(GPIO.BCM)
            GPIO.setwarnings(False)
            for pin in HOLE_CS_PINS[:self.num_holes]:
                GPIO.setup(pin, GPIO.OUT)
                GPIO.output(pin, GPIO.HIGH)  # deselect all

    def _select_hole(self, hole_index: int):
        if not HARDWARE_AVAILABLE:
            return
        for i, pin in enumerate(HOLE_CS_PINS[:self.num_holes]):
            GPIO.output(pin, GPIO.LOW if i == hole_index else GPIO.HIGH)

    def _deselect_all(self):
        if not HARDWARE_AVAILABLE:
            return
        for pin in HOLE_CS_PINS[:self.num_holes]:
            GPIO.output(pin, GPIO.HIGH)

    def _connect_ws(self):
        if not WS_AVAILABLE:
            return
        try:
            self.ws = websocket.create_connection(
                self.server_url,
                timeout=5,
            )
            log.info("Connected to server at %s", self.server_url)
        except Exception as exc:
            log.warning("WebSocket connect failed: %s — will retry", exc)
            self.ws = None

    def _send_event(self, ball_uid: str, hole: int):
        payload = json.dumps({
            "event": "rfid_event",
            "ballUid": ball_uid,
            "hole": hole,
            "secret": self.secret,
            "timestamp": time.time(),
        })
        log.info("Ball %s detected at hole %d", ball_uid, hole)

        if not WS_AVAILABLE or self.ws is None:
            log.info("(no WebSocket) payload: %s", payload)
            return
        try:
            self.ws.send(payload)
        except Exception as exc:
            log.warning("Send failed (%s) — reconnecting", exc)
            self.ws = None
            self._connect_ws()

    def _is_debounced(self, hole: int, uid: str) -> bool:
        key = (hole, uid)
        now = time.time()
        last = self._last_seen.get(key, 0)
        if now - last < DEBOUNCE_SECONDS:
            return True
        self._last_seen[key] = now
        return False

    def _poll_hole(self, reader, hole_index: int):
        self._select_hole(hole_index)
        try:
            uid, _ = reader.read_no_block()
            if uid:
                uid_str = str(uid).strip()
                hole_number = hole_index + 1
                if not self._is_debounced(hole_number, uid_str):
                    self._send_event(uid_str, hole_number)
        except Exception as exc:
            log.debug("Read error on hole %d: %s", hole_index + 1, exc)
        finally:
            self._deselect_all()

    def run(self):
        self.running = True
        self._connect_ws()

        if not HARDWARE_AVAILABLE:
            log.info("Hardware not available — bridge idle. Deploy on Raspberry Pi to read real tags.")
            while self.running:
                time.sleep(1)
            return

        reader = SimpleMFRC522()
        try:
            log.info("Polling %d holes…", self.num_holes)
            while self.running:
                for i in range(self.num_holes):
                    self._poll_hole(reader, i)
                    time.sleep(0.02)  # 20 ms between readers
                if self.ws is None:
                    time.sleep(2)
                    self._connect_ws()
        finally:
            self._deselect_all()
            GPIO.cleanup()
            if self.ws:
                self.ws.close()

    def stop(self):
        self.running = False


def main():
    parser = argparse.ArgumentParser(description="Tee Time RFID Bridge")
    parser.add_argument("--server", default="ws://localhost:3000", help="WebSocket server URL")
    parser.add_argument("--secret", default="changeme", help="Shared auth secret")
    parser.add_argument("--holes", type=int, default=18, help="Number of holes")
    args = parser.parse_args()

    bridge = RFIDBridge(args.server, args.secret, args.holes)

    def _shutdown(sig, frame):
        log.info("Shutting down…")
        bridge.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    bridge.run()


if __name__ == "__main__":
    main()
