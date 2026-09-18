import { useEffect, useState } from "react";
import { getRoom } from "../api/rooms.js";

/**
 * The engine's GameStateView only ever knows player ids — it has no notion
 * of display names, since those live in the DB, not the game state. The
 * room's player list (fetched once) already has them, so we build the
 * lookup here rather than teaching the engine about account data.
 */
export function usePlayerNames(code: string): Record<string, string> {
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    getRoom(code)
      .then((room) => {
        if (cancelled) return;
        const next: Record<string, string> = {};
        for (const p of room.players) next[p.userId] = p.displayName;
        setNames(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [code]);

  return names;
}

export function nameOf(names: Record<string, string>, id: string): string {
  return names[id] ?? "a merchant";
}
