import { RESOURCE_IDS, type ResourceId } from "@souk/shared";
import { EngineError } from "./errors.js";
import { getPlayer, updatePlayer } from "./players.js";
import type { GameState, PendingClaim, WhisperResolution } from "./types.js";

function assertWhisperPhase(state: GameState): void {
  if (state.phase !== "whisper") {
    throw new EngineError("wrong_phase", "Not in the Whisper phase");
  }
}

function pushResolution(state: GameState, resolution: WhisperResolution): GameState {
  return {
    ...state,
    whisper: { ...state.whisper, pending: null, resolutions: [...state.whisper.resolutions, resolution] },
  };
}

/** Spec §8: the only valid claim shape — one resource, one non-negative count, about the claimant's own current holdings. */
export function submitWhisperClaim(
  state: GameState,
  claimantId: string,
  targetId: string,
  resource: ResourceId,
  count: number,
): GameState {
  assertWhisperPhase(state);
  if (state.whisper.pending) throw new EngineError("whisper_in_progress");
  if (claimantId === targetId) throw new EngineError("cannot_target_self");
  if (!RESOURCE_IDS.includes(resource)) throw new EngineError("invalid_resource");
  if (!Number.isInteger(count) || count < 0) throw new EngineError("invalid_claim_count");

  const claimant = getPlayer(state, claimantId);
  getPlayer(state, targetId); // throws if targetId is not a real player

  const usesRumorMillFree =
    state.currentEvent === "rumorMill" && !state.whisper.rumorMillFreeUsed[claimantId];

  const claim: PendingClaim = {
    claimantId,
    targetId,
    resource,
    count,
    freeFromRumorMill: usesRumorMillFree,
  };

  if (usesRumorMillFree) {
    return {
      ...state,
      whisper: {
        ...state.whisper,
        pending: { stage: "awaitingResponse", claim },
        rumorMillFreeUsed: { ...state.whisper.rumorMillFreeUsed, [claimantId]: true },
      },
    };
  }

  const madeSoFar = state.whisper.claimsMadeThisRound[claimantId] ?? 0;
  const isDoubleWhisperBonus =
    madeSoFar === 1 && claimant.role === "doubleWhisper" && !claimant.roleUsed;

  if (madeSoFar > 0 && !isDoubleWhisperBonus) {
    throw new EngineError("no_whisper_actions_remaining");
  }
  if (claimant.whisperCardsRemaining < 1) {
    throw new EngineError("no_whisper_cards_remaining");
  }

  let next: GameState = {
    ...state,
    whisper: {
      ...state.whisper,
      pending: { stage: "awaitingResponse", claim },
      claimsMadeThisRound: { ...state.whisper.claimsMadeThisRound, [claimantId]: madeSoFar + 1 },
    },
  };
  next = updatePlayer(next, claimantId, (p) => ({
    ...p,
    whisperCardsRemaining: p.whisperCardsRemaining - 1,
    roleUsed: isDoubleWhisperBonus ? true : p.roleUsed,
  }));
  return next;
}

export function trustClaim(state: GameState, playerId: string): GameState {
  const pending = state.whisper.pending;
  if (!pending || pending.stage !== "awaitingResponse") throw new EngineError("no_pending_claim");
  if (pending.claim.targetId !== playerId) throw new EngineError("not_the_target");

  return pushResolution(state, {
    claimantId: pending.claim.claimantId,
    targetId: pending.claim.targetId,
    resource: pending.claim.resource,
    claimedCount: pending.claim.count,
    outcome: "trust",
  });
}

export function announceVerify(state: GameState, playerId: string): GameState {
  const pending = state.whisper.pending;
  if (!pending || pending.stage !== "awaitingResponse") throw new EngineError("no_pending_claim");
  if (pending.claim.targetId !== playerId) throw new EngineError("not_the_target");

  return {
    ...state,
    whisper: { ...state.whisper, pending: { stage: "awaitingBribeOffer", claim: pending.claim } },
  };
}

function verifyCost(state: GameState, claimantId: string): number {
  if (state.currentEvent === "generousTerms") return 0;
  const claimant = getPlayer(state, claimantId);
  return claimant.role === "locksmith"
    ? state.config.baseVerifyCost + 1
    : state.config.baseVerifyCost;
}

function resolveVerify(state: GameState, claim: PendingClaim): GameState {
  const cost = verifyCost(state, claim.claimantId);
  const verifier = getPlayer(state, claim.targetId);
  if (verifier.coins < cost) throw new EngineError("insufficient_coins_to_verify");

  const claimant = getPlayer(state, claim.claimantId);
  const actual = claimant.resources[claim.resource];
  const isTrue = actual === claim.count;

  let next: GameState = {
    ...state,
    bank: { ...state.bank, coins: state.bank.coins + cost },
  };
  next = updatePlayer(next, claim.targetId, (p) => ({ ...p, coins: p.coins - cost }));

  if (isTrue) {
    next = updatePlayer(next, claim.targetId, (p) => ({ ...p, coins: p.coins - 1 }));
    next = updatePlayer(next, claim.claimantId, (p) => ({ ...p, coins: p.coins + 1 }));
  } else {
    next = updatePlayer(next, claim.claimantId, (p) => ({ ...p, coins: p.coins - 1 }));
    next = updatePlayer(next, claim.targetId, (p) => ({ ...p, coins: p.coins + 1 }));
  }

  return pushResolution(next, {
    claimantId: claim.claimantId,
    targetId: claim.targetId,
    resource: claim.resource,
    claimedCount: claim.count,
    outcome: isTrue ? "verified_true" : "verified_false",
    actualCount: actual,
    verifyCost: cost,
    coinTransfer: isTrue
      ? { from: claim.targetId, to: claim.claimantId, amount: 1 }
      : { from: claim.claimantId, to: claim.targetId, amount: 1 },
  });
}

/** amount === 0 means declining outright — spec §8 step 3: "declined (or 0 offered)" both proceed straight to Verify. */
export function offerBribe(state: GameState, playerId: string, amount: number): GameState {
  const pending = state.whisper.pending;
  if (!pending || pending.stage !== "awaitingBribeOffer") throw new EngineError("no_bribe_window");
  if (pending.claim.claimantId !== playerId) throw new EngineError("not_the_claimant");
  if (!Number.isInteger(amount) || amount < 0) throw new EngineError("invalid_bribe_amount");

  const claimant = getPlayer(state, playerId);
  if (amount > claimant.coins) throw new EngineError("insufficient_coins");

  if (amount === 0) {
    return resolveVerify(state, pending.claim);
  }

  return {
    ...state,
    whisper: {
      ...state.whisper,
      pending: { stage: "awaitingBribeResponse", claim: pending.claim, bribeAmount: amount },
    },
  };
}

export function respondToBribe(state: GameState, playerId: string, accept: boolean): GameState {
  const pending = state.whisper.pending;
  if (!pending || pending.stage !== "awaitingBribeResponse") {
    throw new EngineError("no_bribe_to_respond_to");
  }
  if (pending.claim.targetId !== playerId) throw new EngineError("not_the_target");

  if (!accept) {
    return resolveVerify(state, pending.claim);
  }

  let next: GameState = updatePlayer(state, pending.claim.claimantId, (p) => ({
    ...p,
    coins: p.coins - pending.bribeAmount,
  }));
  next = updatePlayer(next, pending.claim.targetId, (p) => ({
    ...p,
    coins: p.coins + pending.bribeAmount,
  }));

  return pushResolution(next, {
    claimantId: pending.claim.claimantId,
    targetId: pending.claim.targetId,
    resource: pending.claim.resource,
    claimedCount: pending.claim.count,
    outcome: "bribe_accepted",
    coinTransfer: {
      from: pending.claim.claimantId,
      to: pending.claim.targetId,
      amount: pending.bribeAmount,
    },
  });
}
