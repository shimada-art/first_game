import { RESOURCE_IDS, type ResourceId } from "@souk/shared";
import { bankTrade, isBankOpen, type BankDirection } from "./bank.js";
import { EngineError } from "./errors.js";
import { getPlayer, updatePlayer } from "./players.js";
import { addBundle, bundleTotal, hasAtLeast } from "./resources.js";
import type { GameState, TradeBundle, TradeProposal, TradeProposalTerms } from "./types.js";

function assertTradePhase(state: GameState): void {
  if (state.phase !== "trade") throw new EngineError("wrong_phase", "Not in the Trade phase");
}

function assertValidBundle(bundle: TradeBundle): void {
  if (!Number.isInteger(bundle.coins) || bundle.coins < 0) {
    throw new EngineError("invalid_trade_bundle");
  }
  for (const id of RESOURCE_IDS) {
    const v = bundle.resources[id];
    if (v !== undefined && (!Number.isInteger(v) || v < 0)) {
      throw new EngineError("invalid_trade_bundle");
    }
  }
}

function isOneForOne(bundle: TradeBundle): boolean {
  return bundle.coins === 0 && bundleTotal(bundle.resources) === 1;
}

function playerCanAfford(state: GameState, playerId: string, bundle: TradeBundle): boolean {
  const player = getPlayer(state, playerId);
  return player.coins >= bundle.coins && hasAtLeast(player.resources, bundle.resources);
}

function otherParty(proposal: TradeProposal): string {
  return proposal.currentProposerId === proposal.playerAId ? proposal.playerBId : proposal.playerAId;
}

function findProposal(state: GameState, id: string): TradeProposal {
  const proposal = state.trade.proposals.find((p) => p.id === id);
  if (!proposal) throw new EngineError("trade_proposal_not_found");
  return proposal;
}

function replaceProposal(state: GameState, updated: TradeProposal): GameState {
  return {
    ...state,
    trade: {
      ...state.trade,
      proposals: state.trade.proposals.map((p) => (p.id === updated.id ? updated : p)),
    },
  };
}

function hasActiveProposalBetween(state: GameState, a: string, b: string): boolean {
  return state.trade.proposals.some(
    (p) =>
      p.status === "pending" &&
      ((p.playerAId === a && p.playerBId === b) || (p.playerAId === b && p.playerBId === a)),
  );
}

export function proposeTrade(
  state: GameState,
  fromPlayerId: string,
  toPlayerId: string,
  offer: TradeBundle,
  request: TradeBundle,
  useCloser = false,
): GameState {
  assertTradePhase(state);
  if (fromPlayerId === toPlayerId) throw new EngineError("cannot_trade_with_self");
  getPlayer(state, toPlayerId);
  assertValidBundle(offer);
  assertValidBundle(request);
  if (!playerCanAfford(state, fromPlayerId, offer)) throw new EngineError("cannot_afford_offer");
  if (hasActiveProposalBetween(state, fromPlayerId, toPlayerId)) {
    throw new EngineError("trade_already_pending");
  }

  let unrefusable = false;
  let next = state;
  if (useCloser) {
    const proposer = getPlayer(state, fromPlayerId);
    if (proposer.role !== "closer") throw new EngineError("not_closer");
    if (proposer.roleUsed) throw new EngineError("role_already_used");
    if (!isOneForOne(offer) || !isOneForOne(request)) {
      throw new EngineError("closer_requires_one_for_one");
    }
    unrefusable = true;
    next = updatePlayer(next, fromPlayerId, (p) => ({ ...p, roleUsed: true }));
  }

  const terms: TradeProposalTerms = { offer, request };
  const proposal: TradeProposal = {
    id: String(next.trade.nextProposalId),
    playerAId: fromPlayerId,
    playerBId: toPlayerId,
    currentProposerId: fromPlayerId,
    offer,
    request,
    status: "pending",
    history: [terms],
    round: next.round,
    unrefusable,
  };

  return {
    ...next,
    trade: {
      proposals: [...next.trade.proposals, proposal],
      nextProposalId: next.trade.nextProposalId + 1,
    },
  };
}

function executeTransfer(
  state: GameState,
  giverId: string,
  receiverId: string,
  giverGives: TradeBundle,
  giverReceives: TradeBundle,
): GameState {
  let next = updatePlayer(state, giverId, (p) => ({
    ...p,
    coins: p.coins - giverGives.coins + giverReceives.coins,
    resources: addBundle(addBundle(p.resources, giverGives.resources, -1), giverReceives.resources, 1),
  }));
  next = updatePlayer(next, receiverId, (p) => ({
    ...p,
    coins: p.coins - giverReceives.coins + giverGives.coins,
    resources: addBundle(addBundle(p.resources, giverReceives.resources, -1), giverGives.resources, 1),
  }));
  return next;
}

export function acceptTrade(state: GameState, playerId: string, proposalId: string): GameState {
  assertTradePhase(state);
  const proposal = findProposal(state, proposalId);
  if (proposal.status !== "pending") throw new EngineError("trade_not_pending");
  if (otherParty(proposal) !== playerId) throw new EngineError("not_your_turn_to_respond");
  if (!playerCanAfford(state, proposal.currentProposerId, proposal.offer)) {
    throw new EngineError("proposer_cannot_afford_offer");
  }
  if (!playerCanAfford(state, playerId, proposal.request)) {
    throw new EngineError("cannot_afford_request");
  }

  let next = executeTransfer(state, proposal.currentProposerId, playerId, proposal.offer, proposal.request);
  next = replaceProposal(next, { ...proposal, status: "accepted" });
  return next;
}

export function declineTrade(state: GameState, playerId: string, proposalId: string): GameState {
  assertTradePhase(state);
  const proposal = findProposal(state, proposalId);
  if (proposal.status !== "pending") throw new EngineError("trade_not_pending");
  if (otherParty(proposal) !== playerId) throw new EngineError("not_your_turn_to_respond");
  if (proposal.unrefusable) throw new EngineError("trade_cannot_be_refused");

  return replaceProposal(state, { ...proposal, status: "declined" });
}

export function withdrawTrade(state: GameState, playerId: string, proposalId: string): GameState {
  assertTradePhase(state);
  const proposal = findProposal(state, proposalId);
  if (proposal.status !== "pending") throw new EngineError("trade_not_pending");
  if (proposal.currentProposerId !== playerId) throw new EngineError("not_your_proposal");

  return replaceProposal(state, { ...proposal, status: "withdrawn" });
}

export function counterTrade(
  state: GameState,
  playerId: string,
  proposalId: string,
  offer: TradeBundle,
  request: TradeBundle,
): GameState {
  assertTradePhase(state);
  const proposal = findProposal(state, proposalId);
  if (proposal.status !== "pending") throw new EngineError("trade_not_pending");
  if (otherParty(proposal) !== playerId) throw new EngineError("not_your_turn_to_respond");
  assertValidBundle(offer);
  assertValidBundle(request);
  if (!playerCanAfford(state, playerId, offer)) throw new EngineError("cannot_afford_offer");

  const terms: TradeProposalTerms = { offer, request };
  return replaceProposal(state, {
    ...proposal,
    offer,
    request,
    currentProposerId: playerId,
    history: [...proposal.history, terms],
    unrefusable: false, // a counter supersedes any Closer guarantee on the original terms
  });
}

/** Bank trade during the normal Trade step. Spec §5.3, §6. */
export function playerBankTrade(
  state: GameState,
  playerId: string,
  resource: ResourceId,
  direction: BankDirection,
): GameState {
  assertTradePhase(state);
  return bankTrade(state, playerId, resource, direction);
}

/**
 * The Opportunist role (spec §13): one Bank trade at the round's
 * just-updated price, in the window after Market resolves but before
 * Whisper begins — i.e. while `phase` is still "market".
 */
export function opportunistBankTrade(
  state: GameState,
  playerId: string,
  resource: ResourceId,
  direction: BankDirection,
): GameState {
  if (state.phase !== "market") throw new EngineError("wrong_phase", "Not in the Opportunist's window");
  const player = getPlayer(state, playerId);
  if (player.role !== "opportunist") throw new EngineError("not_opportunist");
  if (player.roleUsed) throw new EngineError("role_already_used");
  if (!isBankOpen(state)) throw new EngineError("bank_closed");

  const next = bankTrade(state, playerId, resource, direction);
  return updatePlayer(next, playerId, (p) => ({ ...p, roleUsed: true }));
}

export interface AppraiserPeekResult {
  state: GameState;
  targetId: string;
  tokens: ResourceId[];
}

/**
 * The Appraiser role (spec §13): a free, private look at up to 3 of a
 * chosen player's current resource tokens. The spec's "viewer's choice
 * which 3" can't literally mean picking specific tokens sight-unseen; this
 * implementation reveals up to 3 tokens deterministically in resource-id
 * order (spice, textile, gold, gem), which is the most defensible reading.
 */
export function appraiserPeek(state: GameState, playerId: string, targetId: string): AppraiserPeekResult {
  assertTradePhase(state);
  if (playerId === targetId) throw new EngineError("cannot_target_self");
  const player = getPlayer(state, playerId);
  const target = getPlayer(state, targetId);
  if (player.role !== "appraiser") throw new EngineError("not_appraiser");
  if (player.roleUsed) throw new EngineError("role_already_used");

  const tokens: ResourceId[] = [];
  for (const resource of RESOURCE_IDS) {
    for (let i = 0; i < target.resources[resource] && tokens.length < 3; i++) {
      tokens.push(resource);
    }
  }

  const next = updatePlayer(state, playerId, (p) => ({ ...p, roleUsed: true }));
  return { state: next, targetId, tokens };
}
