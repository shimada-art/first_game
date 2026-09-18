import { EngineError } from "./errors.js";
import { runMarketPhase, type SpeculatorAdjustment } from "./market.js";
import { resolveRaids } from "./raid.js";
import { applyReckoning } from "./reckoning.js";
import { computeFinalTally } from "./victory.js";
import type { GameState } from "./types.js";

export function advanceToWhisper(state: GameState): GameState {
  if (state.phase !== "market") throw new EngineError("wrong_phase", "Not in the Market phase");
  return { ...state, phase: "whisper" };
}

export function advanceToTrade(state: GameState): GameState {
  if (state.phase !== "whisper") throw new EngineError("wrong_phase", "Not in the Whisper phase");
  if (state.whisper.pending) throw new EngineError("whisper_still_in_progress");
  return { ...state, phase: "trade" };
}

export function advanceToRaid(state: GameState): GameState {
  if (state.phase !== "trade") throw new EngineError("wrong_phase", "Not in the Trade phase");
  if (state.trade.proposals.some((p) => p.status === "pending")) {
    throw new EngineError("unresolved_trade_proposals");
  }
  return { ...state, phase: "raid" };
}

/** Resolves every raid (spec §9) and folds in this round's Whisper log for the Reveal beat. */
export function advanceToReveal(state: GameState): GameState {
  if (state.phase !== "raid") throw new EngineError("wrong_phase", "Not in the Raid phase");
  const { state: resolved, results } = resolveRaids(state);
  return {
    ...resolved,
    phase: "reveal",
    reveal: { raids: results, whispers: resolved.whisper.resolutions },
  };
}

/**
 * Spec §5.5, §10-12: from Reveal, either run the Reckoning and start the
 * next round's Market, or — if this was the Final Bazaar round — compute
 * the final tally and end the game.
 */
export function advanceFromReveal(
  state: GameState,
  speculatorAdjustment?: SpeculatorAdjustment,
): GameState {
  if (state.phase !== "reveal") throw new EngineError("wrong_phase", "Not in the Reveal phase");

  let next = state;
  if (next.round === next.config.reckoningRound) {
    next = applyReckoning(next);
  }

  if (next.round === next.config.finalBazaarRound) {
    const finalTally = computeFinalTally(next);
    return { ...next, status: "finished", phase: "gameover", finalTally };
  }

  next = {
    ...next,
    round: next.round + 1,
    reveal: null,
    whisper: { pending: null, claimsMadeThisRound: {}, rumorMillFreeUsed: {}, resolutions: [] },
    trade: { proposals: [], nextProposalId: 1 },
    raid: { commitments: {} },
  };

  return runMarketPhase(next, speculatorAdjustment);
}
