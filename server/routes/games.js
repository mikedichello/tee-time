const express = require("express");
const router = express.Router();

module.exports = (db, io) => {
  router.get("/", (req, res) => {
    res.json(db.listGames());
  });

  router.post("/", (req, res) => {
    const { name = "Game", numHoles = 18 } = req.body;
    const game = db.createGame(name, numHoles);
    res.status(201).json(game);
  });

  router.get("/active", (req, res) => {
    const game = db.getActiveGame();
    if (!game) return res.status(404).json({ error: "No active game" });
    res.json(db.getFullGameState(game.id));
  });

  router.get("/:id", (req, res) => {
    const game = db.getGame(req.params.id);
    if (!game) return res.status(404).json({ error: "Not found" });
    res.json(db.getFullGameState(game.id));
  });

  router.patch("/:id/start", (req, res) => {
    const game = db.startGame(req.params.id);
    const state = db.getFullGameState(game.id);
    io.emit("game_started", state);
    res.json(state);
  });

  router.patch("/:id/end", (req, res) => {
    const game = db.endGame(req.params.id);
    const state = db.getFullGameState(game.id);
    io.emit("game_ended", state);
    res.json(state);
  });

  router.delete("/:id", (req, res) => {
    db.deleteGame(req.params.id);
    res.json({ ok: true });
  });

  router.get("/:id/holes", (req, res) => {
    res.json(db.getHoleConfig(req.params.id));
  });

  router.patch("/:id/holes/:hole/par", (req, res) => {
    const { par } = req.body;
    db.setHolePar(req.params.id, req.params.hole, par);
    res.json({ ok: true });
  });

  return router;
};
