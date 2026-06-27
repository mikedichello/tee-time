# Hardware Setup Guide

## Step 1 — Prepare the Raspberry Pi

```bash
# Flash Raspberry Pi OS Lite (64-bit) to SD card using Raspberry Pi Imager
# Enable SSH and set hostname to "teetime" in the Imager advanced settings

# After boot, connect via SSH:
ssh pi@teetime.local

# Update system
sudo apt update && sudo apt upgrade -y

# Enable SPI interface
sudo raspi-config nonint do_spi 0

# Reboot
sudo reboot
```

## Step 2 — Wire the RC522 Readers

Each RC522 module shares the same SPI MISO/MOSI/CLK lines but has its own
Chip Select (CS) pin. For up to 18 holes you need chip-select expansion via
MCP23S17 I/O expanders or a small GPIO multiplexer.

### Single Reader (test setup)

```
RC522 Pin  →  Raspberry Pi GPIO (BCM)
─────────────────────────────────────
SDA (CS)   →  GPIO 8  (SPI0 CE0)
SCK        →  GPIO 11 (SPI0 SCLK)
MOSI       →  GPIO 10 (SPI0 MOSI)
MISO       →  GPIO 9  (SPI0 MISO)
IRQ        →  not connected
GND        →  GND (Pin 6)
RST        →  GPIO 25
3.3V       →  3.3V (Pin 1)
```

### Full 18-Hole Setup (with MCP23S17 expander)

```
                    ┌──────────────────────────────────┐
Raspberry Pi        │ MCP23S17 #1 (holes 1–8)          │
─────────────────   │ ────────────────────────────────  │
SPI0 MOSI ─────────▶ SI (pin 11)                       │
SPI0 MISO ◀──────── SO (pin 13)                        │
SPI0 CLK  ─────────▶ SCK (pin 12)                      │
GPIO 26 CS ─────────▶ CS (pin 11)  A0=0, A1=0, A2=0   │
                    │ GPA0..GPA7 → CS pins of readers 1-8│
                    └──────────────────────────────────┘

(Repeat with MCP23S17 #2 for holes 9–16, readers 17-18 on direct GPIO pins)
```

> See `hardware/wiring/rc522_raspberry_pi.md` for full multi-reader schematics.

## Step 3 — Mount Readers in Hole Cups

1. Drill a shallow recess in the bottom of each hole cup (the part below the flagstick) sized to fit the RC522 PCB (40mm × 60mm).
2. Run 4-wire cable (VCC/GND/CS/shared SPI) through conduit along the course.
3. Apply self-adhesive foam gasket around the reader to prevent water ingress.
4. Test each reader independently with `python3 hardware/scripts/test_reader.py --hole 1`.

## Step 4 — Prepare Golf Balls

1. Pick a dimple closest to the ball's center of gravity (usually there is one near the seam).
2. Clean with isopropyl alcohol; let dry 5 minutes.
3. Apply NTAG215 sticker tag into the dimple.
4. Mix 5-minute epoxy and fill/cover the tag flush with the ball surface.
5. Label ball 1–24 with a paint pen on the opposite side.
6. After epoxy cures, run `python3 hardware/scripts/enroll_ball.py` to register each ball's UID.

## Step 5 — Install Python RFID Bridge

```bash
cd /home/pi
git clone https://github.com/mikedichello/tee-time.git
cd tee-time

# Python deps
python3 -m venv venv
source venv/bin/activate
pip install -r hardware/requirements.txt

# Test a single reader
python3 hardware/scripts/test_reader.py

# Run the bridge (connects to the Node server via WebSocket)
python3 hardware/scripts/rfid_bridge.py
```

## Step 6 — Install Node.js Server

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

cd /home/pi/tee-time/server
npm install
npm run build   # if using TypeScript; otherwise skip

# Start server
node index.js
```

## Step 7 — Autostart on Boot

```bash
# Install PM2
sudo npm install -g pm2

# Start services
pm2 start /home/pi/tee-time/server/index.js --name tee-time-server
pm2 start /home/pi/tee-time/hardware/scripts/rfid_bridge.py \
  --name rfid-bridge \
  --interpreter /home/pi/tee-time/venv/bin/python3

# Save and enable on boot
pm2 save
pm2 startup systemd -u pi --hp /home/pi
sudo systemctl enable pm2-pi
```

## Step 8 — Scoreboard Display

Connect the HDMI display to the Pi. The React app is served by the Node server.

```bash
# Install Chromium kiosk mode
sudo apt install -y chromium-browser

# Add to /etc/xdg/autostart/kiosk.desktop
[Desktop Entry]
Type=Application
Name=Scoreboard Kiosk
Exec=chromium-browser --kiosk --noerrdialogs --disable-infobars http://localhost:3000
```

Or on a separate display machine, just open `http://teetime.local:3000`.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `No module named 'mfrc522'` | Missing pip install | `pip install mfrc522` |
| RC522 not detected | SPI not enabled | `sudo raspi-config` → Interface → SPI |
| Ball not read | Wrong CS pin | Check wiring; run `test_reader.py` |
| Score not updating | Bridge not connected | Check WebSocket URL in `rfid_bridge.py` |
| Reads wrong player | Unenrolled ball | Run `enroll_ball.py` for that ball |
