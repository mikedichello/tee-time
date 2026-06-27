const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");

const db = require("./database");
const { startSimulator } = require("./simulator");

const PORT = process.env.PORT || 3000;
const RFID_SECRET = process.env.RFID_BRIDGE_SECRET || "changeme";
const SIMULATE = process.env.SIMULATE === "true";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

app.use(cors());
app.use(express.json());
app.use(express.static("../client/dist"));

// ── REST routes ──────────────────────────────────────────────────────────
app.use("/api/games", require("./routes/games")(db, io));
app.use("/api/players", require("./routes/players")(db, io));
app.use("/api/scores", require("./routes/scores")(db, io));
app.use("/api/balls", require("./routes/balls")(db));

// ── WebSocket ────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log("[ws] client connected:", socket.id);

  // Send current game state on connect
  const activeGame = db.getActiveGame();
  if (activeGame) {
    socket.emit("game_state", db.getFullGameState(activeGame.id));
  }

  // Hardware RFID bridge sends this event when a ball is detected at a hole cup.
  // strokeCount is read directly from the ball's NFC memory (written by the
  // ball's onboard accelerometer MCU on each putter impact).
  socket.on("rfid_event", (data) => {
    if (data.secret !== RFID_SECRET) {
      console.warn("[ws] rfid_event rejected: wrong secret");
      return;
    }

    const { ballUid, hole, strokeCount } = data;
    console.log(`[rfid] ball ${ballUid} at hole ${hole} — ${strokeCount} stroke(s) (from ball)`);

    const game = db.getActiveGame();
    if (!game) {
      console.log("[rfid] no active game — ignoring");
      return;
    }

    const player = db.getPlayerByBallUid(ballUid);
    if (!player || player.game_id !== game.id) {
      console.log(`[rfid] unknown ball or wrong game: ${ballUid}`);
      io.emit("unknown_ball", { ballUid, hole });
      return;
    }

    // Use stroke count from the ball. Fall back to 1 if ball firmware
    // didn't record any (e.g. old passive tag used during development).
    const strokes = (typeof strokeCount === "number" && strokeCount > 0) ? strokeCount : 1;
    const score = db.setScore(game.id, player.id, hole, strokes);
    const state = db.getFullGameState(game.id);

    io.emit("ball_detected", {
      gameId: game.id,
      playerId: player.id,
      playerName: player.name,
      hole,
      strokes: score.strokes,
      ballUid,
      fromBall: true,
    });
    io.emit("game_state", state);
  });

  // Admin manual score override
  socket.on("manual_score", (data) => {
    const { gameId, playerId, hole, strokes } = data;
    db.setScore(gameId, playerId, hole, strokes);
    const state = db.getFullGameState(gameId);
    io.emit("score_updated", { gameId, playerId, hole, strokes, manual: true });
    io.emit("game_state", state);
  });

  socket.on("disconnect", () => {
    console.log("[ws] client disconnected:", socket.id);
  });
});

// ── Start ────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`Tee Time server running on http://localhost:${PORT}`);
  if (SIMULATE) startSimulator(io, db);
});
