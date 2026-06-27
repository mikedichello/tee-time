const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data", "teetime.db");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS games (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL DEFAULT 'Game',
    num_holes   INTEGER NOT NULL DEFAULT 18,
    status      TEXT    NOT NULL DEFAULT 'setup',  -- setup | active | ended
    started_at  TEXT,
    ended_at    TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS players (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id    INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    name       TEXT    NOT NULL,
    ball_uid   TEXT,
    color      TEXT    DEFAULT '#3b82f6',
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS scores (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id    INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    player_id  INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    hole       INTEGER NOT NULL,
    strokes    INTEGER NOT NULL DEFAULT 0,
    recorded_at TEXT   NOT NULL DEFAULT (datetime('now')),
    UNIQUE(game_id, player_id, hole)
  );

  CREATE TABLE IF NOT EXISTS balls (
    uid        TEXT PRIMARY KEY,
    label      TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS hole_config (
    game_id    INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    hole       INTEGER NOT NULL,
    par        INTEGER NOT NULL DEFAULT 3,
    name       TEXT,
    PRIMARY KEY (game_id, hole)
  );
`);

module.exports = {
  db,

  // ── Games ──────────────────────────────────────────────────────────────
  createGame(name, numHoles = 18) {
    const stmt = db.prepare(
      "INSERT INTO games (name, num_holes) VALUES (?, ?)"
    );
    const info = stmt.run(name, numHoles);
    const game = this.getGame(info.lastInsertRowid);

    const insertHole = db.prepare(
      "INSERT INTO hole_config (game_id, hole, par) VALUES (?, ?, 3)"
    );
    const insertAll = db.transaction(() => {
      for (let h = 1; h <= numHoles; h++) insertHole.run(game.id, h);
    });
    insertAll();

    return game;
  },

  getGame(id) {
    return db.prepare("SELECT * FROM games WHERE id = ?").get(id);
  },

  getActiveGame() {
    return db.prepare("SELECT * FROM games WHERE status = 'active' LIMIT 1").get();
  },

  listGames() {
    return db.prepare("SELECT * FROM games ORDER BY created_at DESC").all();
  },

  startGame(id) {
    db.prepare(
      "UPDATE games SET status='active', started_at=datetime('now') WHERE id=?"
    ).run(id);
    return this.getGame(id);
  },

  endGame(id) {
    db.prepare(
      "UPDATE games SET status='ended', ended_at=datetime('now') WHERE id=?"
    ).run(id);
    return this.getGame(id);
  },

  deleteGame(id) {
    db.prepare("DELETE FROM games WHERE id=?").run(id);
  },

  // ── Players ────────────────────────────────────────────────────────────
  addPlayer(gameId, name, ballUid = null, color = "#3b82f6") {
    const info = db.prepare(
      "INSERT INTO players (game_id, name, ball_uid, color) VALUES (?, ?, ?, ?)"
    ).run(gameId, name, ballUid, color);
    return this.getPlayer(info.lastInsertRowid);
  },

  getPlayer(id) {
    return db.prepare("SELECT * FROM players WHERE id=?").get(id);
  },

  getPlayerByBallUid(ballUid) {
    return db.prepare("SELECT * FROM players WHERE ball_uid=?").get(ballUid);
  },

  listPlayers(gameId) {
    return db.prepare("SELECT * FROM players WHERE game_id=? ORDER BY id").all(gameId);
  },

  updatePlayerBall(playerId, ballUid) {
    db.prepare("UPDATE players SET ball_uid=? WHERE id=?").run(ballUid, playerId);
    return this.getPlayer(playerId);
  },

  deletePlayer(id) {
    db.prepare("DELETE FROM players WHERE id=?").run(id);
  },

  // ── Scores ─────────────────────────────────────────────────────────────
  setScore(gameId, playerId, hole, strokes) {
    db.prepare(`
      INSERT INTO scores (game_id, player_id, hole, strokes, recorded_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(game_id, player_id, hole) DO UPDATE SET
        strokes = excluded.strokes,
        recorded_at = excluded.recorded_at
    `).run(gameId, playerId, hole, strokes);
    return this.getScore(gameId, playerId, hole);
  },

  getScore(gameId, playerId, hole) {
    return db.prepare(
      "SELECT * FROM scores WHERE game_id=? AND player_id=? AND hole=?"
    ).get(gameId, playerId, hole);
  },

  getScoresForGame(gameId) {
    return db.prepare(
      "SELECT * FROM scores WHERE game_id=? ORDER BY player_id, hole"
    ).all(gameId);
  },

  incrementStroke(gameId, playerId, hole) {
    const existing = this.getScore(gameId, playerId, hole);
    const next = (existing?.strokes ?? 0) + 1;
    return this.setScore(gameId, playerId, hole, next);
  },

  // ── Balls ──────────────────────────────────────────────────────────────
  enrollBall(uid, label) {
    db.prepare(
      "INSERT OR REPLACE INTO balls (uid, label) VALUES (?, ?)"
    ).run(uid, label);
    return this.getBall(uid);
  },

  getBall(uid) {
    return db.prepare("SELECT * FROM balls WHERE uid=?").get(uid);
  },

  listBalls() {
    return db.prepare("SELECT * FROM balls ORDER BY label").all();
  },

  // ── Hole Config ────────────────────────────────────────────────────────
  getHoleConfig(gameId) {
    return db.prepare(
      "SELECT * FROM hole_config WHERE game_id=? ORDER BY hole"
    ).all(gameId);
  },

  setHolePar(gameId, hole, par) {
    db.prepare(
      "UPDATE hole_config SET par=? WHERE game_id=? AND hole=?"
    ).run(par, gameId, hole);
  },

  // ── Full game state for WebSocket broadcast ────────────────────────────
  getFullGameState(gameId) {
    const game = this.getGame(gameId);
    if (!game) return null;
    const players = this.listPlayers(gameId);
    const scores = this.getScoresForGame(gameId);
    const holes = this.getHoleConfig(gameId);

    const scoreMap = {};
    for (const s of scores) {
      if (!scoreMap[s.player_id]) scoreMap[s.player_id] = {};
      scoreMap[s.player_id][s.hole] = s.strokes;
    }

    return { game, players, scoreMap, holes };
  },
};
