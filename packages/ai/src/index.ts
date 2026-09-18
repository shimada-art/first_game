import type { EngineAction, GameStateView, TradeBundle } from "@souk/engine";
import { RESOURCE_IDS, type AiDifficulty } from "@souk/shared";

export type { AiDifficulty };

/**
 * A bot's own memory of public events across the game — never persisted in
 * the canonical GameState (the spec's own state shape deliberately excludes
 * non-gameplay bookkeeping; §16's closing note calls that out explicitly),
 * and built only from data that was already broadcast to every player, so
 * this carries no private information a human player couldn't also have
 * remembered.
 */
export interface AiMemory {
  /** playerId -> number of times this bot has personally seen that player's Whisper claim proven false. */
  timesCaughtLying: Record<string, number>;
}

export function createAiMemory(): AiMemory {
  return { timesCaughtLying: {} };
}

/** Call once per Reveal (server-side), before the next round clears whisper.resolutions. */
export function recordReveal(memory: AiMemory, whispers: GameStateView["whisper"]["resolutions"]): void {
  for (const w of whispers) {
    if (w.outcome === "verified_false") {
      memory.timesCaughtLying[w.claimantId] = (memory.timesCaughtLying[w.claimantId] ?? 0) + 1;
    }
  }
}

function bundleValue(prices: GameStateView["prices"], bundle: TradeBundle): number {
  let total = bundle.coins;
  for (const r of RESOURCE_IDS) total += (bundle.resources[r] ?? 0) * prices[r];
  return total;
}

function pickIndex(rng: () => number, length: number): number {
  return Math.min(length - 1, Math.floor(rng() * length));
}

/**
 * The one entry point: given only this player's own privacy-safe view
 * (identical in shape to what a human client receives — never the raw
 * GameState), decide the next action for this phase, or null to do
 * nothing right now. Every branch reads exclusively from `view` (public
 * data plus this bot's own private `view.you`), so a bot structurally
 * cannot see another player's hidden resources, role, or raid
 * commitment — the same server-side privacy boundary every real
 * connection goes through (viewForPlayer), not a convention this module
 * has to uphold on its own.
 */
export function decideAction(
  view: GameStateView,
  difficulty: AiDifficulty,
  memory: AiMemory,
  rng: () => number = Math.random,
): EngineAction | null {
  switch (view.phase) {
    case "whisper":
      return decideWhisper(view, difficulty, memory, rng);
    case "trade":
      return decideTrade(view, difficulty, rng);
    case "raid":
      return decideRaid(view, difficulty, rng);
    default:
      return null;
  }
}

function decideWhisper(
  view: GameStateView,
  difficulty: AiDifficulty,
  memory: AiMemory,
  rng: () => number,
): EngineAction | null {
  const pending = view.whisper.pending;
  const youId = view.you.id;

  if (pending?.stage === "awaitingResponse" && pending.claim.targetId === youId) {
    const suspicion = memory.timesCaughtLying[pending.claim.claimantId] ?? 0;
    const verifyChance =
      difficulty === "easy" ? 0 : difficulty === "medium" ? 0.3 : suspicion > 0 ? 0.75 : 0.45;
    return { kind: rng() < verifyChance ? "WHISPER_VERIFY" : "WHISPER_TRUST" };
  }

  if (pending?.stage === "awaitingBribeOffer" && pending.claim.claimantId === youId) {
    const actual = view.you.resources[pending.claim.resource];
    const lied = actual !== pending.claim.count;
    const amount = !lied || difficulty === "easy" ? 0 : difficulty === "medium" ? 1 : 2;
    return { kind: "WHISPER_BRIBE_OFFER", amount: view.you.coins >= amount ? amount : 0 };
  }

  if (pending?.stage === "awaitingBribeResponse" && pending.claim.targetId === youId) {
    const threshold = difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3;
    return { kind: "WHISPER_BRIBE_RESPOND", accept: pending.bribeAmount >= threshold };
  }

  if (!pending && view.you.whisperCardsRemaining > 0) {
    const claimChance = difficulty === "easy" ? 0.2 : difficulty === "medium" ? 0.35 : 0.5;
    if (rng() >= claimChance) return null;

    const others = view.players.filter((p) => p.id !== youId);
    if (others.length === 0) return null;
    const target = others[pickIndex(rng, others.length)]!;
    const resource = RESOURCE_IDS[pickIndex(rng, RESOURCE_IDS.length)]!;
    const actual = view.you.resources[resource];

    const bluffChance = difficulty === "easy" ? 0 : difficulty === "medium" ? 0.3 : 0.5;
    const bluffing = rng() < bluffChance;
    const count = bluffing
      ? Math.max(0, actual + (rng() < 0.5 ? -1 : 1) * (1 + Math.floor(rng() * 2)))
      : actual;

    return { kind: "WHISPER_CLAIM", targetId: target.id, resource, count };
  }

  return null;
}

function decideTrade(view: GameStateView, difficulty: AiDifficulty, rng: () => number): EngineAction | null {
  const youId = view.you.id;

  const incoming = view.trade.proposals.find(
    (p) =>
      p.status === "pending" &&
      p.currentProposerId !== youId &&
      (p.playerAId === youId || p.playerBId === youId),
  );
  if (incoming) {
    const canAffordRequest =
      view.you.coins >= incoming.request.coins &&
      RESOURCE_IDS.every((r) => view.you.resources[r] >= (incoming.request.resources[r] ?? 0));
    if (!canAffordRequest) {
      return incoming.unrefusable ? null : { kind: "TRADE_DECLINE", proposalId: incoming.id };
    }
    const offerValue = bundleValue(view.prices, incoming.offer);
    const requestValue = bundleValue(view.prices, incoming.request);
    const margin = difficulty === "easy" ? 0.8 : difficulty === "medium" ? 1.0 : 1.15;
    if (offerValue >= requestValue * margin) {
      return { kind: "TRADE_ACCEPT", proposalId: incoming.id };
    }
    return incoming.unrefusable ? null : { kind: "TRADE_DECLINE", proposalId: incoming.id };
  }

  const bankOpen = view.currentEvent !== "bankHoliday" && view.round !== view.config.finalBazaarRound;
  if (!bankOpen) return null;

  const buyThreshold = difficulty === "hard" ? 3 : 2;
  const sellThreshold = difficulty === "hard" ? 7 : 8;

  for (const r of RESOURCE_IDS) {
    if (view.prices[r] <= buyThreshold && view.you.coins >= view.prices[r] && view.bank.resources[r] > 0 && rng() < 0.5) {
      return { kind: "BANK_TRADE", resource: r, direction: "buy" };
    }
  }
  for (const r of RESOURCE_IDS) {
    if (view.prices[r] >= sellThreshold && view.you.resources[r] > 0 && rng() < 0.5) {
      return { kind: "BANK_TRADE", resource: r, direction: "sell" };
    }
  }
  return null;
}

function decideRaid(view: GameStateView, difficulty: AiDifficulty, rng: () => number): EngineAction | null {
  if (view.raid.yourCommitment !== null) return null;

  const others = view.players.filter((p) => p.id !== view.you.id);
  if (others.length === 0) return { kind: "RAID_COMMIT", targetId: null, tokens: 0 };

  const sitOutChance = difficulty === "easy" ? 0.4 : difficulty === "medium" ? 0.25 : 0.15;
  if (rng() < sitOutChance) {
    return { kind: "RAID_COMMIT", targetId: null, tokens: 0 };
  }

  let target = others[pickIndex(rng, others.length)]!;
  if (difficulty === "hard" && view.reckoning) {
    // Public wealth snapshot from the Reckoning (spec §10, broadcast to
    // everyone) — legitimate shared information, not a privacy leak.
    let bestWealth = -Infinity;
    for (const p of others) {
      const wealth = view.reckoning.wealthByPlayer[p.id];
      if (wealth !== undefined && wealth > bestWealth) {
        bestWealth = wealth;
        target = p;
      }
    }
  }

  const cap =
    view.round === view.config.finalBazaarRound
      ? view.config.raidTokenCapFinalBazaar
      : view.config.raidTokenCapStandard;
  const maxTokens = difficulty === "easy" ? Math.min(1, cap) : difficulty === "medium" ? Math.min(2, cap) : cap;
  const tokens = Math.min(cap, 1 + Math.floor(rng() * maxTokens));

  return { kind: "RAID_COMMIT", targetId: target.id, tokens };
}
