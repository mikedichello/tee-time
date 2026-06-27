#!/usr/bin/env python3
"""
rfid_bridge.py — Reads active smart balls (NTAG I2C) at each hole cup.

Each ball contains a microcontroller that counts impacts via an accelerometer
and writes the running stroke count into the NFC tag's user-data memory
(NTAG I2C NT3H2111, page 4, bytes 0-1).

When the ball drops into the cup this bridge:
  1. Reads the ball UID (player identity)
  2. Reads the stroke count from tag page 4
  3. Sends { ballUid, hole, strokeCount } to the Node.js server
  4. Writes 0x0000 back to page 4 (resets ball for the next hole)

Usage:
  python3 rfid_bridge.py [--server ws://localhost:3000] [--holes 18]
"""

import sys
import time
import json
import struct
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
    from mfrc522 import MFRC522
    HARDWARE_AVAILABLE = True
except (ImportError, RuntimeError):
    HARDWARE_AVAILABLE = False
    log.warning("RPi.GPIO / mfrc522 not available — stub mode")

try:
    import websocket
    WS_AVAILABLE = True
except ImportError:
    WS_AVAILABLE = False
    log.warning("websocket-client not installed — logging only")

# BCM GPIO CS pins for each hole (index 0 = hole 1)
HOLE_CS_PINS = [8, 7, 4, 17, 27, 22, 5, 6, 13, 19, 26, 21, 20, 16, 12, 24, 1, 0]
RST_PIN = 25

# NTAG user-data starts at page 4.
# Ball firmware writes stroke count as a uint16 at bytes 0-1 of page 4.
STROKE_PAGE = 4

DEBOUNCE_SECONDS = 8  # ball must leave and re-enter before re-reading same hole


def _uid_to_str(uid_bytes: list) -> str:
    return "".join(f"{b:02X}" for b in uid_bytes)


class SmartBallReader:
    """Low-level MFRC522 wrapper that reads NTAG stroke count and resets it."""

    def __init__(self, rdr: "MFRC522"):
        self._rdr = rdr

    def read_ball(self) -> tuple[str | None, int]:
        """
        Returns (uid_str, stroke_count) or (None, 0) if no tag present.
        On success also resets the stroke count on the ball to 0.
        """
        rdr = self._rdr
        status, tag_type = rdr.MFRC522_Request(rdr.PICC_REQIDL)
        if status != rdr.MI_OK:
            return None, 0

        status, uid = rdr.MFRC522_Anticoll()
        if status != rdr.MI_OK:
            return None, 0

        uid_str = _uid_to_str(uid)
        rdr.MFRC522_SelectTag(uid)

        # Read page 4 (returns 16 bytes = pages 4-7 for NTAG)
        status, data = rdr.MFRC522_Read(STROKE_PAGE)
        stroke_count = 0
        if status == rdr.MI_OK and data:
            # stroke count stored as uint16 little-endian in bytes 0-1
            stroke_count = struct.unpack_from("<H", bytes(data[:2]))[0]
            log.debug("  raw page 4: %s → strokes=%d", data[:4], stroke_count)

            # Reset stroke count on ball for next hole
            reset_page = [0x00, 0x00, 0x00, 0x00]
            rdr.MFRC522_Write(STROKE_PAGE, reset_page)
            log.debug("  stroke counter reset on ball %s", uid_str)
        else:
            log.warning("  could not read page 4 from ball %s", uid_str)

        rdr.MFRC522_StopCrypto1()
        return uid_str, stroke_count


class RFIDBridge:
    def __init__(self, server_url: str, secret: str, num_holes: int):
        self.server_url = server_url
        self.secret = secret
        self.num_holes = min(num_holes, len(HOLE_CS_PINS))
        self.ws = None
        self.running = False
        self._last_seen: dict[tuple, float] = {}

        if HARDWARE_AVAILABLE:
            GPIO.setmode(GPIO.BCM)
            GPIO.setwarnings(False)
            for pin in HOLE_CS_PINS[:self.num_holes]:
                GPIO.setup(pin, GPIO.OUT)
                GPIO.output(pin, GPIO.HIGH)

    def _select_hole(self, hole_index: int):
        for i, pin in enumerate(HOLE_CS_PINS[:self.num_holes]):
            GPIO.output(pin, GPIO.LOW if i == hole_index else GPIO.HIGH)

    def _deselect_all(self):
        for pin in HOLE_CS_PINS[:self.num_holes]:
            GPIO.output(pin, GPIO.HIGH)

    def _connect_ws(self):
        if not WS_AVAILABLE:
            return
        try:
            self.ws = websocket.create_connection(self.server_url, timeout=5)
            log.info("Connected to server at %s", self.server_url)
        except Exception as exc:
            log.warning("WebSocket connect failed: %s", exc)
            self.ws = None

    def _send_event(self, ball_uid: str, hole: int, stroke_count: int):
        payload = json.dumps({
            "event": "rfid_event",
            "ballUid": ball_uid,
            "hole": hole,
            "strokeCount": stroke_count,
            "secret": self.secret,
            "timestamp": time.time(),
        })
        log.info("Hole %d — ball %s — %d stroke(s)", hole, ball_uid, stroke_count)

        if not WS_AVAILABLE or self.ws is None:
            log.info("(no WS) %s", payload)
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
        if now - self._last_seen.get(key, 0) < DEBOUNCE_SECONDS:
            return True
        self._last_seen[key] = now
        return False

    def _poll_hole(self, ball_reader: SmartBallReader, hole_index: int):
        self._select_hole(hole_index)
        try:
            uid, stroke_count = ball_reader.read_ball()
            if uid:
                hole_number = hole_index + 1
                if not self._is_debounced(hole_number, uid):
                    self._send_event(uid, hole_number, stroke_count)
        except Exception as exc:
            log.debug("Read error on hole %d: %s", hole_index + 1, exc)
        finally:
            self._deselect_all()

    def run(self):
        self.running = True
        self._connect_ws()

        if not HARDWARE_AVAILABLE:
            log.info("No hardware — deploy on Raspberry Pi to read smart balls.")
            while self.running:
                time.sleep(1)
            return

        rdr = MFRC522()
        ball_reader = SmartBallReader(rdr)
        try:
            log.info("Polling %d hole readers for active smart balls…", self.num_holes)
            while self.running:
                for i in range(self.num_holes):
                    self._poll_hole(ball_reader, i)
                    time.sleep(0.02)
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
    parser = argparse.ArgumentParser(description="Tee Time Smart Ball RFID Bridge")
    parser.add_argument("--server", default="ws://localhost:3000")
    parser.add_argument("--secret", default="changeme")
    parser.add_argument("--holes", type=int, default=18)
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
