import { EngineError } from "./errors.js";
import type { GameState, PlayerState } from "./types.js";

export function getPlayer(state: GameState, playerId: string): PlayerState {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    throw new EngineError("player_not_found", `No player ${playerId} in this game`);
  }
  return player;
}

export function updatePlayer(
  state: GameState,
  playerId: string,
  update: (player: PlayerState) => PlayerState,
): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? update(p) : p)),
  };
}

/** Seating order for this game, starting from the game's starting player (spec §4.5, §9). */
export function seatingOrder(state: GameState): PlayerState[] {
  const startIndex = state.players.findIndex((p) => p.id === state.startingPlayerId);
  const n = state.players.length;
  return Array.from({ length: n }, (_, i) => state.players[(startIndex + i) % n]!);
}
