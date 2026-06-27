#!/usr/bin/env python3
"""
enroll_ball.py — Reads the UID of a golf ball and registers it with the server.

Run this once for each ball before a game. Hold the ball over a reader, enter
the player name or ball number, and the server stores the UID→player mapping.

Usage:
  python3 enroll_ball.py [--server http://localhost:3000]
"""

import sys
import json
import time
import argparse
import urllib.request
import urllib.error

try:
    import RPi.GPIO as GPIO
    from mfrc522 import SimpleMFRC522
    HARDWARE_AVAILABLE = True
except (ImportError, RuntimeError):
    HARDWARE_AVAILABLE = False


CS_PIN = 8  # use hole-1 reader for enrollment
RST_PIN = 25


def post_json(url: str, data: dict) -> dict:
    body = json.dumps(data).encode()
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        return json.loads(resp.read())


def read_uid_blocking(reader) -> str:
    print("Hold ball over reader…")
    while True:
        uid, _ = reader.read_no_block()
        if uid:
            return str(uid).strip()
        time.sleep(0.1)


def main():
    parser = argparse.ArgumentParser(description="Enroll a Tee Time golf ball")
    parser.add_argument("--server", default="http://localhost:3000", help="Server base URL")
    args = parser.parse_args()

    if not HARDWARE_AVAILABLE:
        print("ERROR: RPi.GPIO / mfrc522 not available. Run this on a Raspberry Pi.")
        sys.exit(1)

    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)
    GPIO.setup(CS_PIN, GPIO.OUT)
    GPIO.output(CS_PIN, GPIO.LOW)

    reader = SimpleMFRC522()
    enrolled = []

    try:
        while True:
            label = input("\nEnter ball label (e.g. 'Ball 1' or player name), or 'done': ").strip()
            if label.lower() == "done":
                break

            uid = read_uid_blocking(reader)
            print(f"  UID: {uid}")

            try:
                result = post_json(f"{args.server}/api/balls/enroll", {"uid": uid, "label": label})
                print(f"  Enrolled: {result}")
                enrolled.append({"uid": uid, "label": label})
            except urllib.error.URLError as exc:
                print(f"  Server error: {exc}")

            time.sleep(1)  # debounce

    finally:
        GPIO.cleanup()

    print(f"\nDone. {len(enrolled)} ball(s) enrolled:")
    for b in enrolled:
        print(f"  {b['label']} → {b['uid']}")


if __name__ == "__main__":
    main()
