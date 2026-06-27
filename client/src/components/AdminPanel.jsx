import { useState } from "react";
import socket from "../services/socket";

export default function AdminPanel({ gameState, onRefresh }) {
  const [enrollUid, setEnrollUid] = useState("");
  const [enrollLabel, setEnrollLabel] = useState("");
  const [enrollMsg, setEnrollMsg] = useState("");
  const [ballAssign, setBallAssign] = useState({});

  if (!gameState) {
    return (
      <div className="p-6 text-center text-white/60">
        No active game. Start a game from the <strong>New Game</strong> tab.
      </div>
    );
  }

  const { game, players, scoreMap, holes } = gameState;

  const setManualScore = (playerId, hole, strokes) => {
    socket.emit("manual_score", {
      gameId: game.id,
      playerId,
      hole,
      strokes: Number(strokes),
    });
  };

  const handleEnrollBall = async () => {
    if (!enrollUid || !enrollLabel) return;
    try {
      const res = await fetch("/api/balls/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: enrollUid, label: enrollLabel }),
      });
      if (!res.ok) throw new Error();
      setEnrollMsg(`Enrolled: ${enrollLabel} (${enrollUid})`);
      setEnrollUid("");
      setEnrollLabel("");
    } catch {
      setEnrollMsg("Enroll failed.");
    }
    setTimeout(() => setEnrollMsg(""), 3000);
  };

  const handleAssignBall = async (playerId) => {
    const ballUid = ballAssign[playerId];
    if (!ballUid) return;
    await fetch(`/api/players/${playerId}/ball`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ballUid }),
    });
    onRefresh();
  };

  const handleEndGame = async () => {
    if (!confirm("End this game?")) return;
    await fetch(`/api/games/${game.id}/end`, { method: "PATCH" });
    onRefresh();
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Game controls */}
      <div className="card p-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">{game.name}</h2>
          <p className="text-sm text-white/60">
            Status: <span className="text-green-400">{game.status}</span>
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={onRefresh} className="btn-secondary text-sm">
            Refresh
          </button>
          {game.status === "active" && (
            <button onClick={handleEndGame} className="btn-primary text-sm">
              End Game
            </button>
          )}
        </div>
      </div>

      {/* Ball enrollment (manual — for when no Pi is available) */}
      <div className="card p-4 space-y-3">
        <h3 className="font-semibold text-white">Enroll Ball (Manual)</h3>
        <p className="text-xs text-white/50">
          On Raspberry Pi use <code>enroll_ball.py</code>. Here you can manually enter a
          ball's RFID UID (shown by the reader) and give it a label.
        </p>
        <div className="flex gap-3">
          <input
            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/30 text-sm"
            placeholder="Ball UID (from reader)"
            value={enrollUid}
            onChange={(e) => setEnrollUid(e.target.value)}
          />
          <input
            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/30 text-sm"
            placeholder='Label (e.g. "Ball 1")'
            value={enrollLabel}
            onChange={(e) => setEnrollLabel(e.target.value)}
          />
          <button onClick={handleEnrollBall} className="btn-green text-sm">
            Enroll
          </button>
        </div>
        {enrollMsg && <p className="text-green-300 text-sm">{enrollMsg}</p>}
      </div>

      {/* Player-to-ball assignment */}
      <div className="card p-4 space-y-3">
        <h3 className="font-semibold text-white">Assign Balls to Players</h3>
        {players.map((p) => (
          <div key={p.id} className="flex items-center gap-3">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: p.color }}
            />
            <span className="text-white text-sm flex-1">{p.name}</span>
            <span className="text-white/40 text-xs font-mono">
              {p.ball_uid || "no ball"}
            </span>
            <input
              className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-white text-xs w-40"
              placeholder="Paste UID…"
              value={ballAssign[p.id] || ""}
              onChange={(e) => setBallAssign({ ...ballAssign, [p.id]: e.target.value })}
            />
            <button
              className="btn-secondary text-xs py-1"
              onClick={() => handleAssignBall(p.id)}
            >
              Assign
            </button>
          </div>
        ))}
      </div>

      {/* Manual scorecard */}
      <div className="card p-4">
        <h3 className="font-semibold text-white mb-3">Manual Score Override</h3>
        <p className="text-xs text-white/50 mb-4">
          Click any cell to set the stroke count directly. Use this if a reader misses a ball.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-2 py-1 text-left text-white/50">Player</th>
                {holes.map((h) => (
                  <th key={h.hole} className="px-1 py-1 text-center text-white/50">
                    H{h.hole}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <tr key={player.id} className="border-b border-white/5">
                  <td className="px-2 py-1">
                    <span className="flex items-center gap-1">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: player.color }}
                      />
                      {player.name}
                    </span>
                  </td>
                  {holes.map((h) => {
                    const current = scoreMap[player.id]?.[h.hole] ?? "";
                    return (
                      <td key={h.hole} className="px-0.5 py-1">
                        <input
                          type="number"
                          min="0"
                          max="20"
                          className="w-10 text-center bg-white/10 border border-white/20 rounded px-1 py-0.5 text-white text-xs"
                          defaultValue={current || ""}
                          placeholder="—"
                          onBlur={(e) => {
                            const val = e.target.value;
                            if (val !== "" && val !== String(current)) {
                              setManualScore(player.id, h.hole, val);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.target.blur();
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
