import type { ResourceId } from "@souk/shared";
import type { EngineAction } from "./actions.js";
import { appraiserPeek, counterTrade, declineTrade, acceptTrade, opportunistBankTrade, playerBankTrade, proposeTrade, withdrawTrade } from "./trade.js";
import { commitRaid } from "./raid.js";
import { announceVerify, offerBribe, respondToBribe, submitWhisperClaim, trustClaim } from "./whisper.js";
import { advanceFromReveal, advanceToRaid, advanceToReveal, advanceToTrade, advanceToWhisper } from "./roundLoop.js";
import { EngineError } from "./errors.js";
import type { GameState } from "./types.js";

export interface ApplyActionResult {
  state: GameState;
  /** Only present for actions with a result that must stay private to the acting player (Appraiser's peek). */
  privateResult?: { kind: "appraiserPeek"; targetId: string; tokens: ResourceId[] };
}

/**
 * The one public entrypoint a realtime layer should call — never reach into
 * the individual phase modules directly from outside this package. Throws
 * EngineError on any invalid action; the caller decides what a rejected
 * action means for the network protocol (it never mutates state on throw).
 */
export function applyAction(state: GameState, playerId: string, action: EngineAction): ApplyActionResult {
  switch (action.kind) {
    case "WHISPER_CLAIM":
      return { state: submitWhisperClaim(state, playerId, action.targetId, action.resource, action.count) };
    case "WHISPER_TRUST":
      return { state: trustClaim(state, playerId) };
    case "WHISPER_VERIFY":
      return { state: announceVerify(state, playerId) };
    case "WHISPER_BRIBE_OFFER":
      return { state: offerBribe(state, playerId, action.amount) };
    case "WHISPER_BRIBE_RESPOND":
      return { state: respondToBribe(state, playerId, action.accept) };

    case "BANK_TRADE":
      return { state: playerBankTrade(state, playerId, action.resource, action.direction) };
    case "OPPORTUNIST_BANK_TRADE":
      return { state: opportunistBankTrade(state, playerId, action.resource, action.direction) };

    case "TRADE_PROPOSE":
      return {
        state: proposeTrade(state, playerId, action.toPlayerId, action.offer, action.request, action.useCloser ?? false),
      };
    case "TRADE_ACCEPT":
      return { state: acceptTrade(state, playerId, action.proposalId) };
    case "TRADE_DECLINE":
      return { state: declineTrade(state, playerId, action.proposalId) };
    case "TRADE_COUNTER":
      return { state: counterTrade(state, playerId, action.proposalId, action.offer, action.request) };
    case "TRADE_WITHDRAW":
      return { state: withdrawTrade(state, playerId, action.proposalId) };

    case "APPRAISER_PEEK": {
      const { state: next, targetId, tokens } = appraiserPeek(state, playerId, action.targetId);
      return { state: next, privateResult: { kind: "appraiserPeek", targetId, tokens } };
    }

    case "RAID_COMMIT":
      return {
        state: commitRaid(
          state,
          playerId,
          action.targetId,
          action.tokens,
          action.lootPreference ?? [],
          action.useSmuggler ?? false,
        ),
      };

    case "ADVANCE_PHASE":
      return { state: advancePhase(state, playerId, action) };

    default: {
      const exhaustive: never = action;
      throw new EngineError("unknown_action", `Unhandled action kind: ${JSON.stringify(exhaustive)}`);
    }
  }
}

function advancePhase(
  state: GameState,
  playerId: string,
  action: Extract<EngineAction, { kind: "ADVANCE_PHASE" }>,
): GameState {
  switch (state.phase) {
    case "market":
      return advanceToWhisper(state);
    case "whisper":
      return advanceToTrade(state);
    case "trade":
      return advanceToRaid(state);
    case "raid":
      return advanceToReveal(state);
    case "reveal": {
      const speculatorAdjustment = action.speculatorAdjustment
        ? { playerId, resource: action.speculatorAdjustment.resource, direction: action.speculatorAdjustment.direction }
        : undefined;
      return advanceFromReveal(state, speculatorAdjustment);
    }
    case "gameover":
      throw new EngineError("game_over", "The game has already ended");
  }
}
