import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  RESOURCE_IDS,
  STARTING_COINS_PER_PLAYER,
  STARTING_RESOURCES_PER_PLAYER,
  TOTAL_COINS,
  TOTAL_RESOURCE_TOKENS_PER_TYPE,
  type ResourceId,
} from "./constants.js";

export interface BankReserve {
  coins: number;
  resources: Record<ResourceId, number>;
}

/**
 * Canonical spec §4.3: Bank reserve = everything not dealt to players.
 */
export function bankReserveForPlayerCount(playerCount: number): BankReserve {
  if (!Number.isInteger(playerCount) || playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) {
    throw new RangeError(`playerCount must be an integer in [${MIN_PLAYERS}, ${MAX_PLAYERS}]`);
  }

  const coins = TOTAL_COINS - STARTING_COINS_PER_PLAYER * playerCount;
  const perResource = TOTAL_RESOURCE_TOKENS_PER_TYPE - STARTING_RESOURCES_PER_PLAYER * playerCount;

  const resources = Object.fromEntries(
    RESOURCE_IDS.map((id) => [id, perResource]),
  ) as Record<ResourceId, number>;

  return { coins, resources };
}
