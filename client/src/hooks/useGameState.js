import { useState, useEffect, useCallback } from "react";
import socket from "../services/socket";

export function useGameState() {
  const [connected, setConnected] = useState(false);
  const [gameState, setGameState] = useState(null); // { game, players, scoreMap, holes }
  const [lastEvent, setLastEvent] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("game_state", (state) => setGameState(state));

    socket.on("ball_detected", (ev) => {
      setLastEvent(ev);
      setToast({
        type: "ball",
        message: `${ev.playerName} — Hole ${ev.hole}: ${ev.strokes} stroke${ev.strokes !== 1 ? "s" : ""}`,
      });
      setTimeout(() => setToast(null), 3500);
    });

    socket.on("score_updated", (ev) => {
      setLastEvent(ev);
      if (ev.manual) {
        setToast({ type: "manual", message: `Score updated: Hole ${ev.hole}` });
        setTimeout(() => setToast(null), 2500);
      }
    });

    socket.on("game_started", (state) => {
      setGameState(state);
      setToast({ type: "info", message: `Game started!` });
      setTimeout(() => setToast(null), 2500);
    });

    socket.on("game_ended", (state) => {
      setGameState(state);
      setToast({ type: "info", message: "Game over!" });
      setTimeout(() => setToast(null), 2500);
    });

    socket.on("unknown_ball", ({ ballUid, hole }) => {
      setToast({ type: "warn", message: `Unknown ball at hole ${hole}: ${ballUid}` });
      setTimeout(() => setToast(null), 4000);
    });

    return () => socket.removeAllListeners();
  }, []);

  const refreshState = useCallback(async (gameId) => {
    if (!gameId) return;
    try {
      const res = await fetch(`/api/games/${gameId}`);
      const state = await res.json();
      setGameState(state);
    } catch {/* ignore */}
  }, []);

  return { connected, gameState, setGameState, lastEvent, toast, refreshState };
}
