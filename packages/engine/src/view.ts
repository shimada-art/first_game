import type { MarketEventId, MerchantRoleId } from "@souk/shared";
import { EngineError } from "./errors.js";
import type {
  BankState,
  FinalTally,
  GamePhase,
  GameConfig,
  GameState,
  PendingWhisper,
  RaidCommitment,
  ReckoningRecord,
  ResourceBundle,
  RevealSummary,
  TradeProposal,
  WhisperResolution,
} from "./types.js";

export interface PlayerPublicView {
  id: string;
  isAI: boolean;
  seat: number;
  connected: boolean;
  whisperCardsRemaining: number;
}

export interface PlayerPrivateView extends PlayerPublicView {
  role: MerchantRoleId;
  roleUsed: boolean;
  brokerTradesUsed: number;
  resources: ResourceBundle;
  coins: number;
}

export interface GameStateView {
  status: GameState["status"];
  round: number;
  phase: GamePhase;
  you: PlayerPrivateView;
  players: PlayerPublicView[];
  bank: BankState;
  prices: ResourceBundle;
  eventDeckSize: number;
  currentEvent: MarketEventId | null;
  whisper: { pending: PendingWhisper | null; resolutions: WhisperResolution[] };
  /** Only proposals the viewer is a party to — spec/app-guide frames Trade as a private notification, unlike Whisper's public claims. */
  trade: { proposals: TradeProposal[] };
  raid: { yourCommitment: RaidCommitment | null; committedPlayerIds: string[] };
  reveal: RevealSummary | null;
  reckoning: ReckoningRecord | null;
  finalTally: FinalTally | null;
  startingPlayerId: string;
  config: GameConfig;
}

function toPublicPlayer(p: GameState["players"][number]): PlayerPublicView {
  return {
    id: p.id,
    isAI: p.isAI,
    seat: p.seat,
    connected: p.connected,
    whisperCardsRemaining: p.whisperCardsRemaining,
  };
}

/**
 * The server-authoritative "what can this one player see" projection.
 * Never send raw GameState to a client — always go through this. Hides:
 * every other player's resources/coins/role, the remaining event deck's
 * contents, other players' raid commitments (target + tokens — only that
 * they've committed at all), and any Trade proposal the viewer isn't a
 * party to. Whisper claims (including the bribe sub-stages) stay public,
 * per the spec's own framing of Whisper as a public, non-DM action.
 */
export function viewForPlayer(state: GameState, viewerId: string): GameStateView {
  const viewer = state.players.find((p) => p.id === viewerId);
  if (!viewer) throw new EngineError("player_not_found", `No player ${viewerId} in this game`);

  const you: PlayerPrivateView = {
    ...toPublicPlayer(viewer),
    role: viewer.role,
    roleUsed: viewer.roleUsed,
    brokerTradesUsed: viewer.brokerTradesUsed,
    resources: viewer.resources,
    coins: viewer.coins,
  };

  return {
    status: state.status,
    round: state.round,
    phase: state.phase,
    you,
    players: state.players.map(toPublicPlayer),
    bank: state.bank,
    prices: state.prices,
    eventDeckSize: state.eventDeck.length,
    currentEvent: state.currentEvent,
    whisper: { pending: state.whisper.pending, resolutions: state.whisper.resolutions },
    trade: {
      proposals: state.trade.proposals.filter(
        (p) => p.playerAId === viewerId || p.playerBId === viewerId,
      ),
    },
    raid: {
      yourCommitment: state.raid.commitments[viewerId] ?? null,
      committedPlayerIds: Object.keys(state.raid.commitments),
    },
    reveal: state.reveal,
    reckoning: state.reckoning,
    finalTally: state.finalTally,
    startingPlayerId: state.startingPlayerId,
    config: state.config,
  };
}
