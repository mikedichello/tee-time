import { useState } from "react";
import { useGameState } from "./hooks/useGameState";
import Scoreboard from "./components/Scoreboard";
import PlayerSetup from "./components/PlayerSetup";
import AdminPanel from "./components/AdminPanel";
import Toast from "./components/Toast";

const VIEWS = {
  SCOREBOARD: "scoreboard",
  SETUP: "setup",
  ADMIN: "admin",
};

export default function App() {
  const [view, setView] = useState(VIEWS.SCOREBOARD);
  const { connected, gameState, setGameState, toast, refreshState } = useGameState();

  const handleGameCreated = (state) => {
    setGameState(state);
    setView(VIEWS.SCOREBOARD);
  };

  return (
    <div className="min-h-screen bg-golf-green flex flex-col">
      {/* Header */}
      <header className="bg-black/30 border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">⛳</span>
          <div>
            <h1 className="text-xl font-bold tracking-wide text-white">Tee Time</h1>
            <p className="text-xs text-green-300">Automatic Minigolf Scoring</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-400" : "bg-red-400"}`} />
          <span className="text-xs text-white/60">{connected ? "Live" : "Offline"}</span>
        </div>

        <nav className="flex gap-2">
          {Object.entries(VIEWS).map(([key, v]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                view === v ? "bg-white/20 text-white" : "text-white/60 hover:text-white hover:bg-white/10"
              }`}
            >
              {key === "SCOREBOARD" ? "Scoreboard" : key === "SETUP" ? "New Game" : "Admin"}
            </button>
          ))}
        </nav>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {view === VIEWS.SCOREBOARD && (
          <Scoreboard gameState={gameState} onNewGame={() => setView(VIEWS.SETUP)} />
        )}
        {view === VIEWS.SETUP && (
          <PlayerSetup onGameCreated={handleGameCreated} />
        )}
        {view === VIEWS.ADMIN && (
          <AdminPanel gameState={gameState} onRefresh={() => refreshState(gameState?.game?.id)} />
        )}
      </main>

      {/* Toast notifications */}
      {toast && <Toast toast={toast} />}
    </div>
  );
}
