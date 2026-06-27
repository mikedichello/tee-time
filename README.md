# Tee Time — Automatic Minigolf Scoring System

An automatic scoring system for minigolf inspired by the NCL (Norwegian Cruise Line) Luna ship's Tee Time system. Each golf ball contains an RFID chip; readers embedded in every hole cup automatically detect when a ball drops in and record the stroke count.

## How It Works

1. Players register at a kiosk or tablet — their name is linked to a specific RFID-tagged ball
2. Each hole has an RFID reader antenna embedded beneath the cup
3. When a ball drops in the cup the reader fires, the system records the stroke count, and the scoreboard updates in real time via WebSocket
4. Manual override is available for any hole via the admin panel

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Raspberry Pi Hub                       │
│  ┌─────────────┐   ┌──────────────┐   ┌─────────────┐  │
│  │  RFID       │   │  Node.js     │   │  React      │  │
│  │  Reader     │──▶│  API +       │──▶│  Scoreboard │  │
│  │  (Python)   │   │  Socket.io   │   │  + Admin    │  │
│  └─────────────┘   └──────────────┘   └─────────────┘  │
│        ▲                  │                             │
│        │           SQLite DB                            │
└────────┼────────────────────────────────────────────────┘
         │
  ┌──────┴───────────────────────────────────┐
  │  RC522 readers at each hole (via SPI/I2C) │
  │  Hole 1 ── Hole 2 ── ... ── Hole 18      │
  └──────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|---|---|
| Ball detection | RC522 RFID modules + NTAG215 sticker tags |
| Hardware controller | Raspberry Pi 4 (Raspberry Pi OS Lite) |
| RFID bridge | Python 3 + `mfrc522` library |
| Backend | Node.js 20 + Express + Socket.io |
| Database | SQLite (via `better-sqlite3`) |
| Frontend | React 18 + Vite + Tailwind CSS |
| Real-time | Socket.io (WebSocket) |

## Quick Start

See [docs/setup-guide.md](docs/setup-guide.md) for full hardware wiring and [docs/software-setup.md](docs/software-setup.md) for software installation.

### Development (no hardware)

```bash
# Install dependencies
cd server && npm install
cd ../client && npm install

# Start in simulation mode (no RFID hardware required)
cd ../server && SIMULATE=true npm run dev

# In another terminal
cd client && npm run dev
```

Open http://localhost:5173 for the scoreboard.

## Directory Structure

```
tee-time/
├── hardware/
│   ├── scripts/
│   │   ├── rfid_bridge.py       # Main RFID reading daemon
│   │   ├── enroll_ball.py       # Enroll a new ball (read its UID)
│   │   └── test_reader.py       # Test a single RC522 reader
│   ├── wiring/
│   │   └── rc522_raspberry_pi.md
│   └── requirements.txt
├── server/
│   ├── index.js                 # Express + Socket.io entry point
│   ├── database.js              # SQLite schema + queries
│   ├── simulator.js             # Hardware simulator for dev
│   └── routes/
│       ├── games.js
│       ├── players.js
│       └── scores.js
├── client/
│   └── src/
│       ├── App.jsx
│       ├── components/
│       │   ├── Scoreboard.jsx
│       │   ├── PlayerSetup.jsx
│       │   ├── HoleView.jsx
│       │   └── AdminPanel.jsx
│       └── services/
│           └── socket.js
└── docs/
    ├── hardware-bom.md          # Bill of materials
    ├── setup-guide.md           # Hardware wiring guide
    └── software-setup.md        # Installation walkthrough
```
