const express = require("express");
const router = express.Router();

module.exports = (db, io) => {
  router.get("/", (req, res) => {
    const { gameId } = req.query;
    if (!gameId) return res.status(400).json({ error: "gameId required" });
    res.json(db.listPlayers(gameId));
  });

  router.post("/", (req, res) => {
    const { gameId, name, ballUid, color } = req.body;
    if (!gameId || !name)
      return res.status(400).json({ error: "gameId and name required" });
    const player = db.addPlayer(gameId, name, ballUid || null, color);
    io.emit("player_added", { player, gameId });
    res.status(201).json(player);
  });

  router.patch("/:id/ball", (req, res) => {
    const { ballUid } = req.body;
    const player = db.updatePlayerBall(req.params.id, ballUid);
    res.json(player);
  });

  router.delete("/:id", (req, res) => {
    db.deletePlayer(req.params.id);
    res.json({ ok: true });
  });

  return router;
};
