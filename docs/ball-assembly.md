# Smart Ball Assembly Guide

## Overview

Each smart ball contains a 35 mm circular PCB with:
- ATtiny85 MCU (sleeping most of the time, < 1 µA)
- LIS3DH accelerometer (interrupt-driven impact detection)
- NT3H2111 NTAG I2C chip (NFC tag + I2C interface in one IC)
- LIR2032 rechargeable coin cell (months of battery life)

---

## Step 1 — Order PCBs

Upload `hardware/ball-firmware/ball_pcb_gerbers.zip` to JLCPCB or PCBWay.
Specs: 35 mm diameter circle, 2-layer, 1.0 mm thickness, HASL finish.

Place components on top side only. Bottom side is bare (faces ball cavity wall).

### PCB Schematic Summary

```
LIR2032 (+) ──┬── VCC (3.3V rail)
              │     │
              │   100nF cap to GND (×3, near each IC)
              │
              ├── VCC of ATtiny85 (pin 8)
              ├── VCC of LIS3DH (VDD_IO + VDD)
              └── VCC of NT3H2111

ATtiny85 PB0 ──┬── SDA (4.7kΩ pull-up to VCC)
               ├── SDA of NT3H2111
               └── SDA of LIS3DH

ATtiny85 PB2 ──┬── SCL (4.7kΩ pull-up to VCC)
               ├── SCL of NT3H2111
               └── SCL of LIS3DH

ATtiny85 PB1 ← INT1 of LIS3DH (open-drain, active low)

NT3H2111 LA, LB pins → NFC antenna coil (tuned to 13.56 MHz)

ISP header (6-pin): MOSI/MISO/SCK/RESET/VCC/GND (for programming ATtiny85)
```

---

## Step 2 — Program the ATtiny85

Program before assembly while the ISP header is accessible.

```bash
# Using USBtinyISP or similar AVR ISP programmer
avrdude -c usbtiny -p attiny85 \
  -U lfuse:w:0xE2:m \           # 8 MHz internal oscillator
  -U hfuse:w:0xD7:m \           # preserve EEPROM, no watchdog
  -U flash:w:ball_firmware.hex:i
```

Compile the sketch in Arduino IDE:
- Board: "ATtiny85" (via ATTinyCore package)
- Clock: "8 MHz (internal)"
- Sketch: `hardware/ball-firmware/ball_firmware.ino`

### Test Before Sealing

1. Apply 3.3V to VCC/GND on the ISP header
2. Hold a strong magnet near the LIS3DH → verify INT1 line goes low
3. Tap the PCB sharply → read stroke count from NT3H2111 with an NFC phone
   (use NFC Tools app; page 4 byte 0 should increment to 0x01, 0x02, etc.)
4. Verify deep sleep current < 8 µA with a µCurrent meter

---

## Step 3 — Machine the Golf Ball

Tools needed: drill press or lathe, 35 mm Forstner bit or ball-end mill.

1. Secure the ball in a V-block jig
2. Mark the hemisphere you want to cavity — choose the side without the seam
3. Drill/mill a 35 mm diameter × 8 mm deep flat-bottomed cavity
4. Sand the cavity walls smooth with 220-grit
5. Clean with isopropyl alcohol; let dry 5 minutes

> **Foam practice balls** are easiest — a sharp 35 mm plug cutter removes
> a clean plug. Hard plastic/rubber balls require a drill press and patience.

---

## Step 4 — Install PCB in Ball

1. Mix 5-minute epoxy (small batch)
2. Apply a thin layer to the cavity floor and walls
3. Place PCB into cavity, **antenna coil side toward the ball surface**
   (the NFC field radiates outward through the ball material)
4. Verify the coin cell holder is accessible for removal/recharging, OR
   add a 2-pad charging contact on the ball surface connected to the LIR2032
5. Fill any gap between PCB edge and cavity wall with epoxy
6. Do NOT cover the coin cell holder with epoxy
7. Let cure 24 hours before playing

---

## Step 5 — Verify Installed Ball

1. Charge the LIR2032 (remove ball lid if using replaceable cell, or use
   charging contacts if you added them)
2. Tap ball with a putter — count should increment in NFC Tools app
3. Hold ball over an RC522 reader running `test_reader.py`:
   - Confirm UID is read
   - Confirm stroke count page is readable (non-zero after tapping)
4. Confirm count resets to 0 after the bridge reads it

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| NFC not detected | Antenna coil not tuned or too deep | Move PCB closer to ball surface; tune capacitor |
| Strokes not counting | LIS3DH threshold too high | Lower `IMPACT_THRESHOLD_G` in firmware |
| Every bounce counts | Threshold too low | Raise `IMPACT_THRESHOLD_G` (try 5–6g) |
| Count not resetting | Bridge not writing to page 4 | Check `MFRC522_Write` in rfid_bridge.py |
| Battery dies quickly | MCU not sleeping | Verify sleep mode in firmware; check INT pin isn't stuck low |

---

## Calibrating Impact Threshold

The goal is to detect a putter strike (~5–15g peak) but not:
- Ball bouncing off a wall (~2–4g)
- Ball rolling and bumping on the green (<1g)
- Ball being picked up (~1–2g)

**Calibration procedure:**

1. Flash firmware with `IMPACT_THRESHOLD_G = 3`
2. Tap ball normally with putter — confirm counts
3. Roll ball into wall firmly — confirm NO count
4. If wall bounce counts, increase threshold by 1g and reflash
5. Typical sweet spot: **4–5g** for a standard putter on turf

The LIS3DH can be set to ±2g, ±4g, ±8g, or ±16g full-scale.
For a ±8g scale (as in the firmware), 1 LSB of threshold ≈ 64 mg.
