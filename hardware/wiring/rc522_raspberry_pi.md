# RC522 ↔ Raspberry Pi Wiring Reference

## Single Reader (Hole Test / Development)

```
Raspberry Pi 40-pin GPIO         RC522 Module
─────────────────────────────────────────────
Pin 1  [3.3V]  ─────────────────▶ VCC (3.3V only! NOT 5V)
Pin 6  [GND]   ─────────────────▶ GND
Pin 8  [GPIO8 / SPI0_CE0_N] ───▶ SDA (CS)
Pin 10 [GPIO9 / SPI0_MISO]  ◀── MISO
Pin 11 [GPIO11 / SPI0_SCLK] ───▶ SCK
Pin 12 [GPIO18 / unused]        (IRQ — leave disconnected)
Pin 13 [GPIO10 / SPI0_MOSI] ───▶ MOSI
Pin 22 [GPIO25] ────────────────▶ RST
```

> **WARNING:** RC522 is a 3.3V device. Connecting VCC to 5V will damage the module.

## Multi-Reader Setup (18 Holes via SPI + GPIO CS Pins)

The SPI bus (MISO/MOSI/CLK) is shared. Each reader gets its own CS pin.

The Pi only has 2 hardware CS pins (GPIO8, GPIO7). For 18 readers, we use
software-controlled GPIO pins for CS selection, cycling one at a time.

```
Shared SPI Bus (all 18 readers):
  GPIO 10 (MOSI) ─────────┬────────── ... ─── MOSI (all readers)
  GPIO 9  (MISO) ─────────┤            (wired-OR, only one active at a time)
  GPIO 11 (SCLK) ─────────┘

Individual CS pins (one per reader):
  GPIO 8  → Hole 1  CS
  GPIO 7  → Hole 2  CS
  GPIO 4  → Hole 3  CS
  GPIO 17 → Hole 4  CS
  GPIO 27 → Hole 5  CS
  GPIO 22 → Hole 6  CS
  GPIO 5  → Hole 7  CS
  GPIO 6  → Hole 8  CS
  GPIO 13 → Hole 9  CS
  GPIO 19 → Hole 10 CS
  GPIO 26 → Hole 11 CS
  GPIO 21 → Hole 12 CS
  GPIO 20 → Hole 13 CS
  GPIO 16 → Hole 14 CS
  GPIO 12 → Hole 15 CS
  GPIO 1  → Hole 16 CS  (use with care — boot pin)
  GPIO 0  → Hole 17 CS  (use with care — boot pin)
  GPIO 24 → Hole 18 CS

RST pin (shared, active low):
  GPIO 25 → RST (all readers share; reset cycles all)
```

## Cable Run Guidelines

- Max reliable SPI cable length with RC522: **~50 cm unshielded**, up to **2 m with shielded cable**
- For longer runs (holes spread across a course), use I2C-based PN532 readers instead (supports 3.3V I2C with level shifter, up to ~5 m with proper pull-ups)
- Run VCC/GND/MISO/MOSI/CLK/CS in a 6-conductor shielded cable (e.g. Cat5e pair)
- Star-topology power distribution: one 5V→3.3V regulator per 4 readers avoids voltage drop

## Reader Placement in Hole Cup

```
         ┌─────────────────────────────┐
         │         Hole Cup (top)       │
         │  ┌─────────────────────────┐│
         │  │    Flagstick hole       ││
         │  └─────────────────────────┘│
         │                             │
         │  ┌──────────────────────┐   │
         │  │    RC522 PCB         │   │
         │  │  [antenna coil area] │   │
         │  │    face UP           │   │
         │  └──────────────────────┘   │
         │         Foam gasket          │
         └─────────────────────────────┘
                     │ cable
```

The RC522 antenna coil should face upward toward the ball. Detection range is
typically 3–5 cm. The NTAG215 sticker on the ball will be read as the ball
settles at the bottom of the cup.

## Power Budget (18 readers)

| Component | Current |
|-----------|---------|
| Raspberry Pi 4 (idle) | 600 mA |
| 18× RC522 active scan | 18 × 26 mA = 468 mA |
| 7" touchscreen | 300 mA |
| **Total** | **~1.4 A @ 5V** |

A 5V/3A supply has comfortable headroom.
