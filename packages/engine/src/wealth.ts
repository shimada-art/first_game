import { RESOURCE_IDS } from "@souk/shared";
import type { PlayerState, ResourceBundle } from "./types.js";

/** Spec §10, §12: coins + resources valued at current market prices. */
export function computeWealth(player: PlayerState, prices: ResourceBundle): number {
  return RESOURCE_IDS.reduce((sum, r) => sum + player.resources[r] * prices[r], player.coins);
}
