# Bill of Materials — Tee Time Smart Ball System

## How the Ball Works

Each ball contains active electronics. When struck by a putter, an
accelerometer interrupt wakes a sleeping microcontroller which reads the
current stroke count from the NFC tag's writable memory, increments it,
and writes it back — all within ~5 ms. When the ball drops into the hole
cup, the RC522 reader reads both the ball's unique ID and the stored stroke
count directly off the ball, then resets the count to 0 for the next hole.

```
                          Inside the ball
    ┌──────────────────────────────────────────────┐
    │  Putter strike                                │
    │       │                                       │
    │       ▼                                       │
    │  LIS3DH          ── INT ──▶  ATtiny85 MCU     │
    │  accelerometer                    │            │
    │                              I2C write        │
    │                                  │            │
    │                                  ▼            │
    │  RC522 reader ── NFC ──▶  NT3H2111 NTAG I2C  │
    │  (at hole cup)             (shared memory)     │
    │                                               │
    │  Power: LIR2032 rechargeable coin cell        │
    └──────────────────────────────────────────────┘
```

---

## Core Controller (Raspberry Pi Hub)

| Qty | Component | Notes | Est. Cost |
|-----|-----------|-------|-----------|
| 1 | Raspberry Pi 4 (2GB) | Runs Python bridge + Node.js server | $45 |
| 1 | 32GB MicroSD (Class 10) | OS + app storage | $10 |
| 1 | Pi 4 USB-C power supply (5V/3A) | | $8 |
| 1 | Pi case with fan | Thermal management | $12 |

---

## RFID Readers (one per hole)

| Qty | Component | Notes | Est. Cost Each |
|-----|-----------|-------|----------------|
| 18 | RC522 RFID module (MFRC522) | 13.56 MHz SPI, reads NFC memory pages | $2–3 |
| 18 | 4-pin shielded cable, 1–2 m | VCC / GND / CS / SPI bus | $1–2 |
| 36 | M2.5 standoffs + screws | Mounting in hole cups | $0.10 |

---

## Smart Ball Electronics (per ball — build 24)

| Qty | Component | Datasheet | Est. Cost |
|-----|-----------|-----------|-----------|
| 1 | **NT3H2111W0FHK** — NTAG I2C Plus | NXP; NFC tag with I2C host interface; 1K user EEPROM accessible from both NFC and I2C simultaneously | ~$1.50 |
| 1 | **ATtiny85-20PU** — 8-pin DIP MCU | Microchip; 8 KB flash, 512B RAM, 8 MHz @ 3.3V, I2C via USI | ~$1.20 |
| 1 | **LIS3DH** — 3-axis MEMS accelerometer | STMicro; I2C/SPI, interrupt output, ±2g–±16g configurable, 2 µA sleep | ~$1.00 |
| 1 | **LIR2032** — 3.6V rechargeable Li-ion coin cell | 40 mAh; system draws <8 µA in sleep, ~4 mA during wake bursts → months of use | ~$0.80 |
| 1 | LIR2032 coin cell holder (SMD) | Keystone 3034 or equivalent | ~$0.30 |
| 1 | NFC antenna coil (13.56 MHz, 25 mm) | Tuned for NT3H2111; wound or etched on small PCB | ~$0.50 |
| 1 | Custom PCB (35 mm diameter, circular) | Fits inside standard golf ball dimple cavity | ~$1–2 (JLCPCB) |
| — | 100nF decoupling caps (×3), 4.7kΩ I2C pull-ups (×2), 1µF bulk cap | Passives | <$0.10 |

**Per-ball cost: ~$6–8 in components + ~$2–5 labor/assembly**

### Why NT3H2111 (NTAG I2C)?

The NT3H2111 is a dual-interface chip: it looks like a standard NFC Forum
Type 2 tag to the RC522 reader, but it also exposes an I2C bus to the
ATtiny85. Both interfaces access the same 1K EEPROM. This is the key to
the system — the MCU increments the count via I2C, the reader retrieves it
via NFC without the ball needing power at that moment.

### Why ATtiny85?

Tiny (8-pin DIP or SOIC), cheap, runs on 3.3V, has hardware I2C (USI),
and supports deep sleep down to 0.1 µA. Plenty of flash for the firmware.
For prototyping, substitute an Arduino Nano — the firmware compiles for both.

### Why LIS3DH?

- Configurable interrupt threshold (set to ~4g to distinguish putter strike
  from ball bouncing off a wall or rolling along the green)
- I2C interface (shares bus with NT3H2111)
- 0.5 µA sleep current with interrupt wakeup enabled
- Widely available, mature Arduino library

---

## Golf Balls

| Qty | Component | Notes | Est. Cost |
|-----|-----------|-------|-----------|
| 24 | Practice golf balls (foam or low-compression) | Drill/mill 35 mm cavity for PCB; foam balls are easiest to machine | $0.50–2 |
| 24 | 2-part slow-cure epoxy | Seal PCB in cavity, keep antenna near surface | $5 (bulk) |

### Ball Preparation Steps

See `docs/ball-assembly.md` for detailed instructions. Summary:
1. Mill a 35 mm × 8 mm circular cavity on one hemisphere
2. Place PCB in cavity with antenna coil facing outward (toward ball surface)
3. Seal with epoxy; leave LIR2032 holder accessible (or add wireless charging coil)
4. Program ATtiny85 via ISP header before sealing (or use UPDI on ATtiny416)
5. Test: press ball firmly — LED test pin should blink on each impact

---

## Charging Infrastructure

| Qty | Component | Notes |
|-----|-----------|-------|
| 1 | 24-bay LIR2032 charger (or custom inductive charging dock) | LIR2032 charges in ~2 hours at 40 mA |
| 1 | Ball storage rack with charging contacts | Optional; 6-month battery life means USB charging between games is fine |

---

## Wiring & Power

| Component | Notes |
|-----------|-------|
| 5V/3A DIN rail supply | Powers Pi + 18× RC522 |
| 22 AWG 4-conductor shielded cable | SPI bus + power to each reader |
| Star-topology fused terminal blocks | One fuse per 4 readers |
| Weatherproof conduit (if outdoor) | Route cable under course surface |

---

## Display & Input

| Qty | Component | Est. Cost |
|-----|-----------|-----------|
| 1 | 32"+ HDMI display | Main scoreboard | varies |
| 1 | 7" Raspberry Pi touchscreen | Player registration kiosk | $60 |

---

## Total Estimated Cost (18 holes, 24 balls)

| Category | Cost |
|----------|------|
| Pi hub + display | ~$125 |
| 18× RC522 readers + wiring | ~$80 |
| 24× smart balls (parts + PCBs) | ~$200–250 |
| Golf balls + machining | ~$50 |
| **Total** | **~$455–505** |

Mass production (assembled PCBs, molded balls) would bring ball cost
under $5/unit at 500+ quantity — comparable to commercial systems.
