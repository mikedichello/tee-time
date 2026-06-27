const express = require("express");
const router = express.Router();

module.exports = (db) => {
  router.get("/", (req, res) => {
    res.json(db.listBalls());
  });

  router.post("/enroll", (req, res) => {
    const { uid, label } = req.body;
    if (!uid || !label)
      return res.status(400).json({ error: "uid and label required" });
    const ball = db.enrollBall(uid, label);
    res.status(201).json(ball);
  });

  router.get("/:uid", (req, res) => {
    const ball = db.getBall(req.params.uid);
    if (!ball) return res.status(404).json({ error: "Not found" });
    res.json(ball);
  });

  return router;
};
