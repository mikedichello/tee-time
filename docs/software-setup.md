# Software Setup Guide

## Step-by-Step Development Process

### Phase 1: Environment Setup

```bash
# Clone the repository
git clone https://github.com/mikedichello/tee-time.git
cd tee-time

# Install Node.js server dependencies
cd server
npm install

# Install React client dependencies
cd ../client
npm install
```

### Phase 2: Run in Simulation Mode (no hardware needed)

Set `SIMULATE=true` to enable the built-in ball-detection simulator.
It fires random RFID events every few seconds so you can develop and test
the UI without any Raspberry Pi or RC522 hardware.

```bash
# Terminal 1 — backend
cd server
SIMULATE=true npm run dev

# Terminal 2 — frontend
cd client
npm run dev
```

Open http://localhost:5173

### Phase 3: Configure for Real Hardware

Edit `server/.env`:

```env
PORT=3000
DB_PATH=./data/teetime.db
SIMULATE=false
RFID_BRIDGE_SECRET=changeme
NUM_HOLES=18
```

Edit `hardware/scripts/rfid_bridge.py` — set:
```python
SERVER_URL = "ws://localhost:3000"
SECRET     = "changeme"
```

### Phase 4: Database

The SQLite database is created automatically on first run at `server/data/teetime.db`.

To reset (wipe all games):
```bash
rm server/data/teetime.db
node server/index.js   # recreates schema
```

To view the database directly:
```bash
sqlite3 server/data/teetime.db ".tables"
sqlite3 server/data/teetime.db "SELECT * FROM games;"
```

## API Reference

### REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/games` | List all games |
| POST | `/api/games` | Create a new game |
| GET | `/api/games/:id` | Get game details + scores |
| PATCH | `/api/games/:id/end` | End/finalize a game |
| DELETE | `/api/games/:id` | Delete a game |
| GET | `/api/players` | List enrolled players for active game |
| POST | `/api/players` | Add a player to current game |
| PUT | `/api/scores/:gameId/:playerId/:hole` | Set stroke count manually |
| GET | `/api/balls` | List all enrolled RFID ball UIDs |
| POST | `/api/balls/enroll` | Enroll a new ball UID → player mapping |

### WebSocket Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `ball_detected` | Server → Client | `{ ballUid, gameId, hole, playerId }` |
| `score_updated` | Server → Client | `{ gameId, playerId, hole, strokes }` |
| `game_started` | Server → Client | `{ game }` |
| `game_ended` | Server → Client | `{ game, finalScores }` |
| `rfid_event` | Hardware → Server | `{ ballUid, hole, timestamp, secret }` |
| `manual_score` | Admin → Server | `{ gameId, playerId, hole, strokes }` |

## Development Roadmap

### Phase 1 — Core (this implementation)
- [x] RFID ball enrollment
- [x] Game creation with player setup
- [x] Real-time score tracking via WebSocket
- [x] Scoreboard display
- [x] Admin panel (manual score override)
- [x] Hardware simulator

### Phase 2 — Polish
- [ ] Hole-by-hole animations
- [ ] Printer receipt output
- [ ] QR code leaderboard sharing
- [ ] Course par configuration UI

### Phase 3 — Advanced
- [ ] Multiple simultaneous games
- [ ] Historical analytics dashboard
- [ ] Offline-first PWA
- [ ] Per-hole tablet displays (separate React views served to tablets at each hole)
