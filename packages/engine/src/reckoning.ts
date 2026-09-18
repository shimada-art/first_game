import { EngineError } from "./errors.js";
import { updatePlayer } from "./players.js";
import { computeWealth } from "./wealth.js";
import type { GameState } from "./types.js";

/**
 * Spec §10: the lowest-wealth player gets a Bank catch-up. Ties for lowest
 * aren't addressed in the spec (unlike victory's explicit tie-break) — this
 * picks the earliest by seat order, deterministically.
 */
export function applyReckoning(state: GameState): GameState {
  if (state.round !== state.config.reckoningRound) {
    throw new EngineError("not_reckoning_round");
  }

  const wealthByPlayer: Record<string, number> = {};
  for (const p of state.players) wealthByPlayer[p.id] = computeWealth(p, state.prices);

  let lowestId = state.players[0]!.id;
  for (const p of state.players) {
    if (wealthByPlayer[p.id]! < wealthByPlayer[lowestId]!) lowestId = p.id;
  }

  const amountGiven = Math.max(0, Math.min(state.config.reckoningCatchUpCoins, state.bank.coins));

  let next = updatePlayer(state, lowestId, (p) => ({ ...p, coins: p.coins + amountGiven }));
  next = { ...next, bank: { ...next.bank, coins: next.bank.coins - amountGiven } };

  return {
    ...next,
    reckoning: { round: state.round, lowestWealthPlayerId: lowestId, amountGiven, wealthByPlayer },
  };
}
