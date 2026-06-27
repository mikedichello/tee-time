const express = require("express");
const router = express.Router();

module.exports = (db, io) => {
  // Manual score set (admin override)
  router.put("/:gameId/:playerId/:hole", (req, res) => {
    const { gameId, playerId, hole } = req.params;
    const { strokes } = req.body;
    if (strokes === undefined)
      return res.status(400).json({ error: "strokes required" });

    const score = db.setScore(gameId, playerId, hole, strokes);
    const state = db.getFullGameState(gameId);

    io.emit("score_updated", {
      gameId: Number(gameId),
      playerId: Number(playerId),
      hole: Number(hole),
      strokes: Number(strokes),
      manual: true,
    });
    io.emit("game_state", state);

    res.json(score);
  });

  // Get all scores for a game
  router.get("/:gameId", (req, res) => {
    res.json(db.getScoresForGame(req.params.gameId));
  });

  return router;
};
