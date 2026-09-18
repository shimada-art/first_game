// Constants transcribed from docs/CANONICAL-SPEC.md. Do not change a value
// here without updating the spec first — the spec is the source of truth.

export const GAME_NAME = "Souk El Kdoub";

export const RESOURCE_IDS = ["spice", "textile", "gold", "gem"] as const;
export type ResourceId = (typeof RESOURCE_IDS)[number];

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 6;

export const ROUND_COUNT = 10;
export const RECKONING_ROUND = 7;
export const FINAL_BAZAAR_ROUND = 10;

export const PRICE_MIN = 1;
export const PRICE_MAX = 10;
export const PRICE_START = 5;

export const TOTAL_COINS = 80;
export const TOTAL_RESOURCE_TOKENS_PER_TYPE = 20;

export const STARTING_COINS_PER_PLAYER = 10;
export const STARTING_RESOURCES_PER_PLAYER = 2;

export const RAID_TOKEN_CAP_STANDARD = 3;
export const RAID_TOKEN_CAP_FINAL_BAZAAR = 4;

export const WHISPER_CARDS_STANDARD = 3;
export const WHISPER_CARDS_SILVER_TONGUE = 5;

export const RECKONING_CATCH_UP_COINS = 2;

export const BASE_VERIFY_COST = 1;

export const MERCHANT_ROLE_IDS = [
  "smuggler",
  "silverTongue",
  "appraiser",
  "bodyguard",
  "broker",
  "doubleWhisper",
  "underwriter",
  "speculator",
  "locksmith",
  "fence",
  "closer",
  "opportunist",
] as const;
export type MerchantRoleId = (typeof MERCHANT_ROLE_IDS)[number];

export const MARKET_EVENT_IDS = [
  "spiceFestival",
  "caravanSeason",
  "rumorMill",
  "bankHoliday",
  "gemRush",
  "quietMarket",
  "generousTerms",
  "tightPurses",
] as const;
export type MarketEventId = (typeof MARKET_EVENT_IDS)[number];
