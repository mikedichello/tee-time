# Bill of Materials — Tee Time Minigolf System

## Core Controller

| Qty | Component | Notes | Est. Cost |
|-----|-----------|-------|-----------|
| 1 | Raspberry Pi 4 (4GB) | Main hub, runs Python bridge + Node.js server | $55 |
| 1 | 32GB MicroSD (Class 10) | OS + application storage | $10 |
| 1 | Official Pi 4 power supply (5V/3A USB-C) | Stable power critical for SPI bus | $8 |
| 1 | Raspberry Pi case with fan | Heat management for 24/7 operation | $12 |

## RFID Readers (one per hole)

| Qty | Component | Model | Est. Cost Each |
|-----|-----------|-------|----------------|
| 18 | RFID RC522 module | MFRC522, 13.56 MHz, SPI | $2–3 |
| 1 | MCP23S17 SPI I/O expander (×2) | Enables chip-select for 16 readers on one SPI bus | $2 |
| 18 | Short RFID antenna extension cable | Optional, for flush mounting | $1–2 |

> **Why RC522?** It's the most widely supported 13.56 MHz reader for Raspberry Pi with a mature Python library. Reads NTAG215 tags in <50 ms.

## Golf Balls / Tags

| Qty | Component | Notes | Est. Cost |
|-----|-----------|-------|-----------|
| 24 | NTAG215 NFC sticker tags | 13.56 MHz, 540 bytes, ≈25 mm round, waterproof coating | $0.30–0.50 |
| 24 | Golf balls (practice/foam) | Apply NTAG215 sticker in dimple with epoxy | $0.50–2 |

> **Ball prep:** Clean a dimple with isopropyl alcohol, apply the sticker tag, cover with a thin layer of 2-part epoxy, sand flush. The tag survives normal play.

## Wiring & Connectors

| Qty | Component | Notes |
|-----|-----------|-------|
| 1 | 40-pin GPIO breakout + ribbon cable | Cleaner wiring than header jumpers |
| 1 roll | 22 AWG stranded wire (4 colors) | SPI bus: MISO/MOSI/CLK/GND |
| 18 | Female Dupont connectors (4-pin) | One per reader (VCC/GND/CS/INT) |
| 1 box | M2.5 screws & standoffs | Mounting readers in hole cups |
| 1 | Waterproof enclosure (IP65) | Houses Pi and power supplies outdoors |

## Display & Input

| Qty | Component | Notes | Est. Cost |
|-----|-----------|-------|-----------|
| 1 | 32" HDMI TV or monitor | Main scoreboard display | varies |
| 1 | 7" Raspberry Pi touchscreen | Player registration kiosk | $60 |
| 1 | USB keyboard + mouse | Admin/setup only | $15 |

## Power Distribution

| Qty | Component | Notes |
|-----|-----------|-------|
| 1 | 5V/10A DC power supply (DIN rail) | Powers Pi + all RC522 modules (each draws <50 mA) |
| 1 | Fused terminal block strip | One fuse per 4 readers |

## Total Estimated Cost

| Category | Cost |
|----------|------|
| Controller (Pi kit) | ~$85 |
| 18× RC522 readers | ~$45 |
| 24 balls + tags | ~$30 |
| Wiring & connectors | ~$30 |
| Displays | ~$60–200 |
| **Total** | **~$250–390** |

---

## Optional Upgrades

| Component | Purpose |
|-----------|---------|
| PN532 readers | More reliable detection range, USB/I2C interface |
| Industrial waterproof RFID readers | For permanent outdoor installation |
| Tablet per hole (cheap Android) | Show hole info and running score at each station |
| LED strip (WS2812B) per hole | Green flash on ball detection, fun visual feedback |
