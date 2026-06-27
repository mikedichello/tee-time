import { useMemo } from "react";

function scoreClass(strokes, par) {
  if (!strokes) return "score-empty";
  const diff = strokes - par;
  if (strokes === 1) return "score-hole-in-one";
  if (diff <= -2) return "score-eagle";
  if (diff === -1) return "score-birdie";
  if (diff === 0) return "score-par";
  if (diff === 1) return "score-bogey";
  if (diff === 2) return "score-double";
  return "score-over";
}

function scoreLabel(strokes, par) {
  if (!strokes) return "—";
  const diff = strokes - par;
  if (strokes === 1) return "1!";
  return strokes;
}

function totalRelativeToPar(player, scoreMap, holes) {
  let total = 0;
  let played = 0;
  for (const h of holes) {
    const s = scoreMap[player.id]?.[h.hole];
    if (s) {
      total += s - h.par;
      played++;
    }
  }
  return { total, played };
}

export default function Scoreboard({ gameState, onNewGame }) {
  const sorted = useMemo(() => {
    if (!gameState) return [];
    const { players, scoreMap, holes } = gameState;
    return [...players].sort((a, b) => {
      const ta = totalRelativeToPar(a, scoreMap, holes).total;
      const tb = totalRelativeToPar(b, scoreMap, holes).total;
      return ta - tb;
    });
  }, [gameState]);

  if (!gameState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
        <div className="text-8xl">⛳</div>
        <h2 className="text-3xl font-bold text-white">No Active Game</h2>
        <p className="text-white/60 max-w-sm">
          Start a new game to begin tracking scores automatically with RFID ball detection.
        </p>
        <button onClick={onNewGame} className="btn-primary text-lg px-8 py-3">
          Start New Game
        </button>
      </div>
    );
  }

  const { game, scoreMap, holes } = gameState;

  return (
    <div className="p-4 max-w-full overflow-x-auto">
      {/* Game header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-white">{game.name}</h2>
          <p className="text-green-300 text-sm">
            {game.num_holes} holes ·{" "}
            <span className={game.status === "active" ? "text-green-400" : "text-gray-400"}>
              {game.status === "active" ? "In Progress" : game.status === "ended" ? "Finished" : "Setup"}
            </span>
          </p>
        </div>
        <button onClick={onNewGame} className="btn-secondary text-sm">
          + New Game
        </button>
      </div>

      {/* Leaderboard summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {sorted.map((player, rank) => {
          const { total, played } = totalRelativeToPar(player, scoreMap, holes);
          return (
            <div key={player.id} className="card p-3 text-center">
              <div className="text-2xl font-bold" style={{ color: player.color }}>
                #{rank + 1}
              </div>
              <div className="font-semibold text-white truncate">{player.name}</div>
              <div className="text-lg font-bold mt-1">
                {played === 0 ? (
                  <span className="text-white/40">—</span>
                ) : (
                  <span className={total < 0 ? "text-blue-400" : total === 0 ? "text-white" : "text-red-400"}>
                    {total > 0 ? `+${total}` : total === 0 ? "E" : total}
                  </span>
                )}
              </div>
              <div className="text-xs text-white/40">{played}/{game.num_holes} holes</div>
            </div>
          );
        })}
      </div>

      {/* Full scorecard table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="px-3 py-2 text-left text-white/60 font-medium sticky left-0 bg-white/5 min-w-[120px]">
                Player
              </th>
              {holes.map((h) => (
                <th key={h.hole} className="px-1 py-2 text-center text-white/60 font-medium min-w-[44px]">
                  <div className="text-xs">{h.hole}</div>
                  <div className="text-xs text-white/30">par {h.par}</div>
                </th>
              ))}
              <th className="px-3 py-2 text-center text-white/60 font-medium min-w-[60px]">Total</th>
              <th className="px-3 py-2 text-center text-white/60 font-medium min-w-[60px]">+/-</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((player, rank) => {
              const { total } = totalRelativeToPar(player, scoreMap, holes);
              const totalStrokes = holes.reduce((sum, h) => sum + (scoreMap[player.id]?.[h.hole] ?? 0), 0);
              return (
                <tr
                  key={player.id}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors"
                >
                  <td className="px-3 py-2 sticky left-0 bg-golf-green/80 backdrop-blur">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/40 w-4">#{rank + 1}</span>
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: player.color }}
                      />
                      <span className="font-medium text-white truncate max-w-[80px]">{player.name}</span>
                    </div>
                  </td>
                  {holes.map((h) => {
                    const s = scoreMap[player.id]?.[h.hole];
                    return (
                      <td key={h.hole} className="px-1 py-2 text-center">
                        <div className={`score-cell mx-auto ${scoreClass(s, h.par)}`}>
                          {scoreLabel(s, h.par)}
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-center font-bold text-white">
                    {totalStrokes || "—"}
                  </td>
                  <td className="px-3 py-2 text-center font-bold">
                    {totalStrokes === 0 ? (
                      <span className="text-white/40">—</span>
                    ) : (
                      <span className={total < 0 ? "text-blue-400" : total === 0 ? "text-white" : "text-red-400"}>
                        {total > 0 ? `+${total}` : total === 0 ? "E" : total}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-4 text-xs">
        {[
          { cls: "score-hole-in-one", label: "Hole-in-one" },
          { cls: "score-eagle", label: "Eagle (-2)" },
          { cls: "score-birdie", label: "Birdie (-1)" },
          { cls: "score-par", label: "Par" },
          { cls: "score-bogey", label: "Bogey (+1)" },
          { cls: "score-double", label: "Double (+2)" },
        ].map(({ cls, label }) => (
          <div key={cls} className="flex items-center gap-1">
            <div className={`score-cell w-6 h-6 text-xs ${cls}`}>#</div>
            <span className="text-white/60">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
