import {
  BASE_VERIFY_COST,
  RAID_TOKEN_CAP_FINAL_BAZAAR,
  RAID_TOKEN_CAP_STANDARD,
  RECKONING_CATCH_UP_COINS,
  ROUND_COUNT,
} from "@souk/shared";
import type { GameConfig } from "./types.js";

export interface HouseRules {
  /** "Quick"/"Standard"/"Long" per the implementation brief — Reckoning/Final Bazaar scale proportionally. */
  roundCount?: number;
  raidTokenCapStandard?: number;
  raidTokenCapFinalBazaar?: number;
  baseVerifyCost?: number;
  reckoningCatchUpCoins?: number;
}

/**
 * Canonical spec §10 fixes the Reckoning at round 7 of a standard 10-round
 * game (round 7/10 = 70% of the way through). A non-standard round count
 * scales that same fraction, per the house-rules brief.
 */
export function reckoningRoundFor(roundCount: number): number {
  return Math.min(roundCount - 1, Math.max(1, Math.round(roundCount * 0.7)));
}

export function buildConfig(houseRules: HouseRules = {}): GameConfig {
  const roundCount = houseRules.roundCount ?? ROUND_COUNT;
  return {
    roundCount,
    reckoningRound: reckoningRoundFor(roundCount),
    finalBazaarRound: roundCount,
    raidTokenCapStandard: houseRules.raidTokenCapStandard ?? RAID_TOKEN_CAP_STANDARD,
    raidTokenCapFinalBazaar: houseRules.raidTokenCapFinalBazaar ?? RAID_TOKEN_CAP_FINAL_BAZAAR,
    baseVerifyCost: houseRules.baseVerifyCost ?? BASE_VERIFY_COST,
    reckoningCatchUpCoins: houseRules.reckoningCatchUpCoins ?? RECKONING_CATCH_UP_COINS,
  };
}
