import { PRICE_MAX, PRICE_MIN, RESOURCE_IDS, type ResourceId } from "@souk/shared";
import { EngineError } from "./errors.js";
import { getPlayer, updatePlayer } from "./players.js";
import { zeroBundle } from "./resources.js";
import type { GameState } from "./types.js";

export interface SpeculatorAdjustment {
  playerId: string;
  resource: ResourceId;
  direction: 1 | -1;
}

function clampPrice(value: number): number {
  return Math.min(PRICE_MAX, Math.max(PRICE_MIN, value));
}

function applySpeculator(state: GameState, adjustment?: SpeculatorAdjustment): GameState {
  if (!adjustment) return state;
  const player = getPlayer(state, adjustment.playerId);
  if (player.role !== "speculator") throw new EngineError("not_speculator");
  if (player.roleUsed) throw new EngineError("role_already_used");

  const next: GameState = {
    ...state,
    prices: {
      ...state.prices,
      [adjustment.resource]: clampPrice(
        state.prices[adjustment.resource] + adjustment.direction,
      ),
    },
  };
  return updatePlayer(next, adjustment.playerId, (p) => ({ ...p, roleUsed: true }));
}

/** Spec §7: signed step size for one resource, or 0 if this round freezes it. */
function priceDelta(state: GameState, resource: ResourceId): number {
  if (state.currentEvent === "quietMarket") return 0;
  if (resource === "spice" && state.currentEvent === "spiceFestival") return 0;

  const net = state.lastRoundBankNet[resource];
  if (net === 0) return 0;
  const magnitude = resource === "gem" && state.currentEvent === "gemRush" ? 2 : 1;
  return net > 0 ? magnitude : -magnitude;
}

/**
 * Enter the Market phase of `state.round` (the round loop increments
 * `round` before calling this). Canonical spec §5.1, §7, §14. Never called
 * for round 1 (no Market step at all).
 */
export function runMarketPhase(
  state: GameState,
  speculatorAdjustment?: SpeculatorAdjustment,
): GameState {
  const { round, config } = state;
  if (round < 2 || round > config.finalBazaarRound) {
    throw new EngineError("invalid_market_round", `Market phase does not run in round ${round}`);
  }

  let next: GameState = { ...state, phase: "market" };

  if (round < config.finalBazaarRound) {
    // Rounds 2..(finalBazaarRound-1) draw one event each, no repeats. Under
    // a non-standard (house-rule) round count the 8-event deck may run dry
    // before every eligible round has drawn — that round simply has none.
    const [drawn, ...rest] = next.eventDeck;
    next = { ...next, currentEvent: drawn ?? null, eventDeck: rest };
  } else {
    next = { ...next, currentEvent: null }; // Final Bazaar round: no event drawn
  }

  next = applySpeculator(next, speculatorAdjustment);

  const newPrices = { ...next.prices };
  for (const resource of RESOURCE_IDS) {
    newPrices[resource] = clampPrice(next.prices[resource] + priceDelta(next, resource));
  }

  return { ...next, prices: newPrices, lastRoundBankNet: zeroBundle() };
}
