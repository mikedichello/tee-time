#!/usr/bin/env python3
"""
test_reader.py — Quick sanity check for a single RC522 reader.
Run this to confirm wiring before deploying all 18 readers.

Usage:
  python3 test_reader.py [--hole 1]
"""

import time
import argparse
import sys

try:
    import RPi.GPIO as GPIO
    from mfrc522 import SimpleMFRC522
    HARDWARE_AVAILABLE = True
except (ImportError, RuntimeError):
    HARDWARE_AVAILABLE = False

HOLE_CS_PINS = [8, 7, 4, 17, 27, 22, 5, 6, 13, 19, 26, 21, 20, 16, 12, 24, 1, 0]


def main():
    parser = argparse.ArgumentParser(description="Test a single RC522 reader")
    parser.add_argument("--hole", type=int, default=1, help="Hole number (1–18)")
    args = parser.parse_args()

    if not HARDWARE_AVAILABLE:
        print("ERROR: RPi.GPIO / mfrc522 not available. Run on Raspberry Pi.")
        sys.exit(1)

    hole_index = args.hole - 1
    cs_pin = HOLE_CS_PINS[hole_index]

    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)
    for pin in HOLE_CS_PINS:
        GPIO.setup(pin, GPIO.OUT)
        GPIO.output(pin, GPIO.HIGH)

    GPIO.output(cs_pin, GPIO.LOW)
    reader = SimpleMFRC522()

    print(f"Testing hole {args.hole} (CS=GPIO{cs_pin}) — hold a ball over the reader (Ctrl+C to quit)…")

    try:
        while True:
            uid, text = reader.read_no_block()
            if uid:
                print(f"  Detected UID: {uid}  text: {text!r}")
            time.sleep(0.1)
    except KeyboardInterrupt:
        pass
    finally:
        GPIO.cleanup()
        print("Done.")


if __name__ == "__main__":
    main()
