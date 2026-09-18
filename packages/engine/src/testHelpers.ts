import type { MerchantRoleId } from "@souk/shared";
import { buildConfig } from "./config.js";
import { bundleWith } from "./resources.js";
import type { GameState, PlayerState } from "./types.js";

export interface TestPlayerOverrides extends Partial<Omit<PlayerState, "id" | "seat">> {
  id: string;
}

/** Defaults to Silver Tongue — passive, no resolution-time side effects — so unrelated tests never trip a role by accident. */
export function makePlayer(seat: number, overrides: TestPlayerOverrides): PlayerState {
  return {
    id: overrides.id,
    isAI: overrides.isAI ?? false,
    seat,
    role: overrides.role ?? ("silverTongue" as MerchantRoleId),
    roleUsed: overrides.roleUsed ?? false,
    brokerTradesUsed: overrides.brokerTradesUsed ?? 0,
    resources: overrides.resources ?? bundleWith(2),
    coins: overrides.coins ?? 10,
    whisperCardsRemaining: overrides.whisperCardsRemaining ?? 3,
    connected: overrides.connected ?? true,
  };
}

export function makeTestState(
  overrides: Partial<GameState> & { players: PlayerState[] },
): GameState {
  const { players } = overrides;
  const base: GameState = {
    status: "in_progress",
    round: 2,
    phase: "market",
    players,
    bank: { resources: bundleWith(10), coins: 20 },
    prices: bundleWith(5),
    lastRoundBankNet: bundleWith(0),
    eventDeck: [],
    currentEvent: null,
    whisper: { pending: null, claimsMadeThisRound: {}, rumorMillFreeUsed: {}, resolutions: [] },
    trade: { proposals: [], nextProposalId: 1 },
    raid: { commitments: {} },
    reveal: null,
    reckoning: null,
    finalTally: null,
    startingPlayerId: players[0]!.id,
    config: buildConfig(),
  };
  return { ...base, ...overrides };
}
