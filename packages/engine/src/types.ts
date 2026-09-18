import type { MarketEventId, MerchantRoleId, ResourceId } from "@souk/shared";

export type ResourceBundle = Record<ResourceId, number>;

export interface PlayerState {
  id: string;
  isAI: boolean;
  seat: number;
  role: MerchantRoleId;
  /** Consumed flag for every once-per-game role except Broker (needs a counter). */
  roleUsed: boolean;
  /** 0-4, only meaningful when role === "broker" (spec §13: first 4 Bank trades). */
  brokerTradesUsed: number;
  resources: ResourceBundle;
  coins: number;
  whisperCardsRemaining: number;
  connected: boolean;
}

export interface BankState {
  resources: ResourceBundle;
  coins: number;
}

export type GamePhase = "market" | "whisper" | "trade" | "raid" | "reveal" | "gameover";

export interface PendingClaim {
  claimantId: string;
  targetId: string;
  resource: ResourceId;
  count: number;
  /** True if this claim was granted free by Rumor Mill (doesn't count against the normal per-round cap or spend a card). */
  freeFromRumorMill: boolean;
}

export type PendingWhisper =
  | { stage: "awaitingResponse"; claim: PendingClaim }
  | { stage: "awaitingBribeOffer"; claim: PendingClaim }
  | { stage: "awaitingBribeResponse"; claim: PendingClaim; bribeAmount: number };

export interface WhisperResolution {
  claimantId: string;
  targetId: string;
  resource: ResourceId;
  claimedCount: number;
  outcome: "trust" | "bribe_accepted" | "verified_true" | "verified_false";
  actualCount?: number;
  verifyCost?: number;
  coinTransfer?: { from: string; to: string; amount: number };
}

export interface WhisperRoundState {
  pending: PendingWhisper | null;
  /** playerId -> count of normal (+ Double Whisper bonus) claims made this round. */
  claimsMadeThisRound: Record<string, number>;
  /** playerId -> whether they've used their Rumor Mill free claim this round. */
  rumorMillFreeUsed: Record<string, boolean>;
  resolutions: WhisperResolution[];
}

export interface RaidCommitment {
  targetId: string | null;
  tokens: number;
  /** Ordered resource preference for looting, applied at resolution subject to availability. */
  lootPreference: ResourceId[];
  usedSmuggler: boolean;
}

export interface RaidRoundState {
  commitments: Record<string, RaidCommitment>;
}

export type RaidOutcome =
  | "no_action"
  | "mutual_cancel"
  | "blocked_bodyguard"
  | "blocked_underwriter"
  | "success";

export interface RaidResolution {
  attackerId: string;
  targetId: string;
  tokensCommitted: number;
  outcome: RaidOutcome;
  stolen: Partial<ResourceBundle>;
}

export interface RevealSummary {
  raids: RaidResolution[];
  whispers: WhisperResolution[];
}

export interface ReckoningRecord {
  round: number;
  lowestWealthPlayerId: string;
  amountGiven: number;
  wealthByPlayer: Record<string, number>;
}

export interface FinalTally {
  wealthByPlayer: Record<string, number>;
  winnerIds: string[];
}

export interface TradeBundle {
  resources: Partial<ResourceBundle>;
  coins: number;
}

export type TradeProposalStatus = "pending" | "accepted" | "declined" | "withdrawn";

export interface TradeProposalTerms {
  offer: TradeBundle;
  request: TradeBundle;
}

export interface TradeProposal extends TradeProposalTerms {
  id: string;
  playerAId: string;
  playerBId: string;
  /** Whose offer/request the current `offer`/`request` fields represent — flips on every Counter. */
  currentProposerId: string;
  status: TradeProposalStatus;
  /** Every prior offer in this thread, oldest first; the current terms are the last entry. */
  history: TradeProposalTerms[];
  round: number;
  /** Closer role (spec §13): the current terms cannot be Declined while this is true. */
  unrefusable: boolean;
}

export interface TradeRoundState {
  proposals: TradeProposal[];
  nextProposalId: number;
}

export interface GameConfig {
  roundCount: number;
  reckoningRound: number;
  finalBazaarRound: number;
  raidTokenCapStandard: number;
  raidTokenCapFinalBazaar: number;
  baseVerifyCost: number;
  reckoningCatchUpCoins: number;
}

export interface GameState {
  status: "in_progress" | "finished";
  round: number;
  phase: GamePhase;
  players: PlayerState[];
  bank: BankState;
  prices: ResourceBundle;
  /** Net Bank volume (buys - sells) from the Trade phase that just completed; consumed by next round's Market step. */
  lastRoundBankNet: ResourceBundle;
  eventDeck: MarketEventId[];
  currentEvent: MarketEventId | null;
  whisper: WhisperRoundState;
  trade: TradeRoundState;
  raid: RaidRoundState;
  reveal: RevealSummary | null;
  reckoning: ReckoningRecord | null;
  finalTally: FinalTally | null;
  startingPlayerId: string;
  config: GameConfig;
}
