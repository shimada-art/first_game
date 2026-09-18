import { EngineError } from "./errors.js";
import { computeWealth } from "./wealth.js";
import type { FinalTally, GameState } from "./types.js";

/** Spec §12: highest total wealth wins; ties share (surfaced via winnerIds.length > 1). */
export function computeFinalTally(state: GameState): FinalTally {
  if (state.round !== state.config.finalBazaarRound) {
    throw new EngineError("not_final_round");
  }

  const wealthByPlayer: Record<string, number> = {};
  for (const p of state.players) wealthByPlayer[p.id] = computeWealth(p, state.prices);

  const max = Math.max(...Object.values(wealthByPlayer));
  const winnerIds = state.players.filter((p) => wealthByPlayer[p.id] === max).map((p) => p.id);

  return { wealthByPlayer, winnerIds };
}
