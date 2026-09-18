import type { ResourceId } from "@souk/shared";
import { EngineError } from "./errors.js";
import { getPlayer, updatePlayer } from "./players.js";
import type { GameState } from "./types.js";

export type BankDirection = "buy" | "sell";

function buyCost(state: GameState, resource: ResourceId, playerId: string): number {
  const player = getPlayer(state, playerId);
  let cost = state.prices[resource];
  if (state.currentEvent === "tightPurses") cost += 1;
  if (player.role === "broker" && player.brokerTradesUsed < 4) cost = Math.max(1, cost - 1);
  return cost;
}

function sellGain(state: GameState, resource: ResourceId, playerId: string): number {
  const player = getPlayer(state, playerId);
  let gain = state.prices[resource];
  if (state.currentEvent === "tightPurses") gain = Math.max(0, gain - 1);
  if (player.role === "broker" && player.brokerTradesUsed < 4) gain += 1;
  return gain;
}

/** Spec §6 and §11: closed on a Bank Holiday event round, and for all of the Final Bazaar round. */
export function isBankOpen(state: GameState): boolean {
  return state.currentEvent !== "bankHoliday" && state.round !== state.config.finalBazaarRound;
}

function bumpBrokerUsage<T extends { role: string; brokerTradesUsed: number }>(player: T): T {
  return player.role === "broker"
    ? { ...player, brokerTradesUsed: Math.min(4, player.brokerTradesUsed + 1) }
    : player;
}

export function bankTrade(
  state: GameState,
  playerId: string,
  resource: ResourceId,
  direction: BankDirection,
): GameState {
  if (!isBankOpen(state)) {
    throw new EngineError("bank_closed");
  }
  const player = getPlayer(state, playerId);

  if (direction === "buy") {
    const cost = buyCost(state, resource, playerId);
    if (state.bank.resources[resource] < 1) throw new EngineError("bank_out_of_resource");
    if (player.coins < cost) throw new EngineError("insufficient_coins");

    const next: GameState = {
      ...state,
      bank: {
        resources: { ...state.bank.resources, [resource]: state.bank.resources[resource] - 1 },
        coins: state.bank.coins + cost,
      },
      lastRoundBankNet: {
        ...state.lastRoundBankNet,
        [resource]: state.lastRoundBankNet[resource] + 1,
      },
    };
    return updatePlayer(next, playerId, (p) =>
      bumpBrokerUsage({
        ...p,
        coins: p.coins - cost,
        resources: { ...p.resources, [resource]: p.resources[resource] + 1 },
      }),
    );
  }

  const gain = sellGain(state, resource, playerId);
  if (player.resources[resource] < 1) throw new EngineError("insufficient_resources");
  if (state.bank.coins < gain) throw new EngineError("bank_out_of_coins");

  const next: GameState = {
    ...state,
    bank: {
      resources: { ...state.bank.resources, [resource]: state.bank.resources[resource] + 1 },
      coins: state.bank.coins - gain,
    },
    lastRoundBankNet: {
      ...state.lastRoundBankNet,
      [resource]: state.lastRoundBankNet[resource] - 1,
    },
  };
  return updatePlayer(next, playerId, (p) =>
    bumpBrokerUsage({
      ...p,
      coins: p.coins + gain,
      resources: { ...p.resources, [resource]: p.resources[resource] - 1 },
    }),
  );
}
