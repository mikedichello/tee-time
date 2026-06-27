/**
 * simulator.js — fires fake RFID events when SIMULATE=true.
 * Increments strokes for random active players every few seconds.
 */

function startSimulator(io, db) {
  const INTERVAL_MS = 4000;

  const tick = () => {
    const game = db.getActiveGame();
    if (!game) return;

    const players = db.listPlayers(game.id);
    if (!players.length) return;

    // Pick a random player
    const player = players[Math.floor(Math.random() * players.length)];

    // Find their lowest hole with no score yet
    const scores = db.getScoresForGame(game.id);
    const playerScores = scores.filter((s) => s.player_id === player.id);
    const scoredHoles = new Set(playerScores.map((s) => s.hole));
    let targetHole = null;
    for (let h = 1; h <= game.num_holes; h++) {
      if (!scoredHoles.has(h)) {
        targetHole = h;
        break;
      }
    }
    if (!targetHole) return;

    // Simulate ball delivering its own stroke count (as active ball firmware would)
    const strokeCount = Math.floor(Math.random() * 3) + 1;
    const score = db.setScore(game.id, player.id, targetHole, strokeCount);

    const state = db.getFullGameState(game.id);
    io.emit("ball_detected", {
      gameId: game.id,
      playerId: player.id,
      playerName: player.name,
      hole: targetHole,
      strokes: strokeCount,
      fromBall: true,
      simulated: true,
    });
    io.emit("game_state", state);

    console.log(
      `[sim] ${player.name} hole ${targetHole} → ${strokeCount} stroke(s) (from ball)`
    );
  };

  const timer = setInterval(tick, INTERVAL_MS);
  console.log("[sim] Simulator active — firing events every", INTERVAL_MS, "ms");

  return () => clearInterval(timer);
}

module.exports = { startSimulator };
