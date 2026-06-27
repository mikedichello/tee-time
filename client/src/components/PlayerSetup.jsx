import { useState, useEffect } from "react";

const PLAYER_COLORS = [
  "#ef4444", "#3b82f6", "#22c55e", "#f59e0b",
  "#a855f7", "#ec4899", "#14b8a6", "#f97316",
];

const DEFAULT_HOLES = 18;

export default function PlayerSetup({ onGameCreated }) {
  const [gameName, setGameName] = useState("Minigolf");
  const [numHoles, setNumHoles] = useState(DEFAULT_HOLES);
  const [players, setPlayers] = useState([
    { name: "", ballUid: "", color: PLAYER_COLORS[0] },
  ]);
  const [enrolledBalls, setEnrolledBalls] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/balls")
      .then((r) => r.json())
      .then(setEnrolledBalls)
      .catch(() => {});
  }, []);

  const addPlayer = () => {
    if (players.length >= 8) return;
    setPlayers([
      ...players,
      { name: "", ballUid: "", color: PLAYER_COLORS[players.length % PLAYER_COLORS.length] },
    ]);
  };

  const removePlayer = (i) => {
    setPlayers(players.filter((_, idx) => idx !== i));
  };

  const updatePlayer = (i, field, value) => {
    setPlayers(players.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const validPlayers = players.filter((p) => p.name.trim());
    if (!validPlayers.length) {
      setError("Add at least one player.");
      return;
    }

    setSaving(true);
    try {
      // 1. Create game
      const gameRes = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: gameName, numHoles }),
      });
      const game = await gameRes.json();

      // 2. Add players
      for (const p of validPlayers) {
        await fetch("/api/players", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gameId: game.id,
            name: p.name.trim(),
            ballUid: p.ballUid || null,
            color: p.color,
          }),
        });
      }

      // 3. Start game
      const startRes = await fetch(`/api/games/${game.id}/start`, { method: "PATCH" });
      const state = await startRes.json();
      onGameCreated(state);
    } catch (err) {
      setError("Failed to create game. Is the server running?");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Start New Game</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Game settings */}
        <div className="card p-5 space-y-4">
          <h3 className="text-lg font-semibold text-white">Game Settings</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/60 mb-1">Game Name</label>
              <input
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-white/50"
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                placeholder="Minigolf Game"
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1">Number of Holes</label>
              <select
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-white/50"
                value={numHoles}
                onChange={(e) => setNumHoles(Number(e.target.value))}
              >
                {[9, 12, 18].map((n) => (
                  <option key={n} value={n} className="bg-gray-800">
                    {n} holes
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Players */}
        <div className="card p-5 space-y-4">
          <h3 className="text-lg font-semibold text-white">Players</h3>

          {players.map((player, i) => (
            <div key={i} className="flex items-center gap-3">
              {/* Color dot */}
              <div
                className="w-4 h-4 rounded-full flex-shrink-0 cursor-pointer border-2 border-white/30"
                style={{ backgroundColor: player.color }}
                onClick={() => {
                  const next = PLAYER_COLORS[(PLAYER_COLORS.indexOf(player.color) + 1) % PLAYER_COLORS.length];
                  updatePlayer(i, "color", next);
                }}
                title="Click to change color"
              />

              {/* Name */}
              <input
                className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-white/50"
                placeholder={`Player ${i + 1} name`}
                value={player.name}
                onChange={(e) => updatePlayer(i, "name", e.target.value)}
                required={i === 0}
              />

              {/* Ball assignment */}
              <select
                className="bg-white/10 border border-white/20 rounded-lg px-2 py-2 text-white text-sm focus:outline-none focus:border-white/50 min-w-[120px]"
                value={player.ballUid}
                onChange={(e) => updatePlayer(i, "ballUid", e.target.value)}
              >
                <option value="" className="bg-gray-800">No ball</option>
                {enrolledBalls.map((b) => (
                  <option key={b.uid} value={b.uid} className="bg-gray-800">
                    {b.label}
                  </option>
                ))}
              </select>

              {/* Remove */}
              {players.length > 1 && (
                <button
                  type="button"
                  onClick={() => removePlayer(i)}
                  className="text-white/40 hover:text-red-400 transition-colors text-lg leading-none"
                >
                  ×
                </button>
              )}
            </div>
          ))}

          {players.length < 8 && (
            <button type="button" onClick={addPlayer} className="btn-secondary text-sm w-full">
              + Add Player
            </button>
          )}

          {enrolledBalls.length === 0 && (
            <p className="text-yellow-300/70 text-xs">
              No balls enrolled yet. Balls can be assigned after the game starts via the Admin panel,
              or enroll them using <code>hardware/scripts/enroll_ball.py</code>.
            </p>
          )}
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/30 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="btn-primary w-full py-3 text-lg disabled:opacity-50"
        >
          {saving ? "Starting…" : "Start Game ⛳"}
        </button>
      </form>
    </div>
  );
}
