import {
  MARKET_EVENT_IDS,
  MAX_PLAYERS,
  MERCHANT_ROLE_IDS,
  MIN_PLAYERS,
  PRICE_START,
  STARTING_COINS_PER_PLAYER,
  STARTING_RESOURCES_PER_PLAYER,
  TOTAL_COINS,
  TOTAL_RESOURCE_TOKENS_PER_TYPE,
  WHISPER_CARDS_SILVER_TONGUE,
  WHISPER_CARDS_STANDARD,
  type MarketEventId,
  type MerchantRoleId,
} from "@souk/shared";
import { buildConfig, type HouseRules } from "./config.js";
import { bundleWith, zeroBundle } from "./resources.js";
import type { GameState, PlayerState } from "./types.js";

export interface NewPlayerInput {
  id: string;
  isAI?: boolean;
}

export interface InitializeGameOptions {
  houseRules?: HouseRules;
  /** Returns a float in [0, 1); defaults to Math.random. Inject a fixed sequence for reproducible tests. */
  rng?: () => number;
  /** Defaults to the first player in seat order. "Youngest, or random" (spec §4.5) is a UX choice made before this call. */
  startingPlayerId?: string;
}

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j] as T, arr[i] as T];
  }
  return arr;
}

/**
 * Canonical spec §4-5. Round 1 has no Market step (prices stay at the
 * setup value) and no Whisper step either — see docs/CANONICAL-SPEC.md
 * §5.2 ("Skipped entirely in round 1"), which is the more specific of two
 * conflicting lines in that document; flagged for confirmation. The game
 * therefore opens directly in Trade.
 */
export function initializeGame(
  players: NewPlayerInput[],
  options: InitializeGameOptions = {},
): GameState {
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    throw new RangeError(
      `Souk El Kdoub needs ${MIN_PLAYERS}-${MAX_PLAYERS} players, got ${players.length}`,
    );
  }
  if (new Set(players.map((p) => p.id)).size !== players.length) {
    throw new Error("Duplicate player id passed to initializeGame");
  }

  const rng = options.rng ?? Math.random;
  const config = buildConfig(options.houseRules);

  const shuffledRoles = shuffle<MerchantRoleId>(MERCHANT_ROLE_IDS, rng);
  const gamePlayers: PlayerState[] = players.map((input, seat) => {
    const role = shuffledRoles[seat]!;
    return {
      id: input.id,
      isAI: input.isAI ?? false,
      seat,
      role,
      roleUsed: false,
      brokerTradesUsed: 0,
      resources: bundleWith(STARTING_RESOURCES_PER_PLAYER),
      coins: STARTING_COINS_PER_PLAYER,
      whisperCardsRemaining:
        role === "silverTongue" ? WHISPER_CARDS_SILVER_TONGUE : WHISPER_CARDS_STANDARD,
      connected: true,
    };
  });

  const bankCoins = TOTAL_COINS - STARTING_COINS_PER_PLAYER * players.length;
  const bankPerResource =
    TOTAL_RESOURCE_TOKENS_PER_TYPE - STARTING_RESOURCES_PER_PLAYER * players.length;

  const startingPlayerId = options.startingPlayerId ?? gamePlayers[0]!.id;
  if (!gamePlayers.some((p) => p.id === startingPlayerId)) {
    throw new Error("startingPlayerId must be one of the players passed in");
  }

  return {
    status: "in_progress",
    round: 1,
    phase: "trade",
    players: gamePlayers,
    bank: { resources: bundleWith(bankPerResource), coins: bankCoins },
    prices: bundleWith(PRICE_START),
    lastRoundBankNet: zeroBundle(),
    eventDeck: shuffle<MarketEventId>(MARKET_EVENT_IDS, rng),
    currentEvent: null,
    whisper: { pending: null, claimsMadeThisRound: {}, rumorMillFreeUsed: {}, resolutions: [] },
    trade: { proposals: [], nextProposalId: 1 },
    raid: { commitments: {} },
    reveal: null,
    reckoning: null,
    finalTally: null,
    startingPlayerId,
    config,
  };
}
