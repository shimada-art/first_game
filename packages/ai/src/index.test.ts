import { describe, expect, it } from "vitest";
import type { GameStateView } from "@souk/engine";
import {
  RAID_TOKEN_CAP_FINAL_BAZAAR,
  RAID_TOKEN_CAP_STANDARD,
  RECKONING_CATCH_UP_COINS,
  RECKONING_ROUND,
  FINAL_BAZAAR_ROUND,
  ROUND_COUNT,
  BASE_VERIFY_COST,
} from "@souk/shared";
import { createAiMemory, decideAction, recordReveal, type AiMemory } from "./index.js";

function bundle(n: number) {
  return { spice: n, textile: n, gold: n, gem: n };
}

function makeView(overrides: Partial<GameStateView> & { you: GameStateView["you"] }): GameStateView {
  const base: GameStateView = {
    status: "in_progress",
    round: 3,
    phase: "whisper",
    you: overrides.you,
    players: [overrides.you],
    bank: { resources: bundle(10), coins: 20 },
    prices: bundle(5),
    eventDeckSize: 0,
    currentEvent: null,
    whisper: { pending: null, resolutions: [] },
    trade: { proposals: [] },
    raid: { yourCommitment: null, committedPlayerIds: [] },
    reveal: null,
    reckoning: null,
    finalTally: null,
    startingPlayerId: overrides.you.id,
    config: {
      roundCount: ROUND_COUNT,
      reckoningRound: RECKONING_ROUND,
      finalBazaarRound: FINAL_BAZAAR_ROUND,
      raidTokenCapStandard: RAID_TOKEN_CAP_STANDARD,
      raidTokenCapFinalBazaar: RAID_TOKEN_CAP_FINAL_BAZAAR,
      baseVerifyCost: BASE_VERIFY_COST,
      reckoningCatchUpCoins: RECKONING_CATCH_UP_COINS,
    },
  };
  return { ...base, ...overrides };
}

function you(id: string, extra: Partial<GameStateView["you"]> = {}): GameStateView["you"] {
  return {
    id,
    isAI: true,
    seat: 0,
    connected: true,
    whisperCardsRemaining: 3,
    role: "silverTongue",
    roleUsed: false,
    brokerTradesUsed: 0,
    resources: bundle(2),
    coins: 10,
    ...extra,
  };
}

function opponent(id: string, seat: number) {
  return { id, isAI: false, seat, connected: true, whisperCardsRemaining: 3 };
}

const zeroRng = () => 0;
const oneRng = () => 0.999;

describe("decideAction — whisper", () => {
  it("Easy never verifies a claim against it, even at max rng", () => {
    const bot = you("bot");
    const view = makeView({
      you: bot,
      players: [bot, opponent("claimant", 1)],
      whisper: {
        pending: { stage: "awaitingResponse", claim: { claimantId: "claimant", targetId: "bot", resource: "spice", count: 9, freeFromRumorMill: false } },
        resolutions: [],
      },
    });
    const action = decideAction(view, "easy", createAiMemory(), oneRng);
    expect(action).toEqual({ kind: "WHISPER_TRUST" });
  });

  it("Hard verifies a claimant it remembers catching lying before, at a rng roll that would pass Medium's lower threshold", () => {
    const bot = you("bot");
    const view = makeView({
      you: bot,
      players: [bot, opponent("claimant", 1)],
      whisper: {
        pending: { stage: "awaitingResponse", claim: { claimantId: "claimant", targetId: "bot", resource: "spice", count: 9, freeFromRumorMill: false } },
        resolutions: [],
      },
    });
    const memory: AiMemory = { timesCaughtLying: { claimant: 2 } };
    // rng = 0.5 is below Hard's 0.75 threshold (suspicious) but above Medium's 0.3.
    const action = decideAction(view, "hard", memory, () => 0.5);
    expect(action).toEqual({ kind: "WHISPER_VERIFY" });
  });

  it("never claims a count it can't back up as truthful unless it is deliberately bluffing", () => {
    const bot = you("bot", { resources: { spice: 4, textile: 2, gold: 2, gem: 2 } });
    const view = makeView({ you: bot, players: [bot, opponent("other", 1)] });
    // Easy never bluffs (bluffChance 0) — with claimChance passed (rng < 0.2 on
    // first call) the remaining calls must still land on the true count.
    let call = 0;
    const scriptedRng = () => (call++ === 0 ? 0.01 : 0.4);
    const action = decideAction(view, "easy", createAiMemory(), scriptedRng);
    expect(action?.kind).toBe("WHISPER_CLAIM");
    if (action?.kind === "WHISPER_CLAIM") {
      expect(action.count).toBe(bot.resources[action.resource]);
    }
  });
});

describe("decideAction — trade", () => {
  it("accepts an incoming proposal that is a clear net gain", () => {
    const bot = you("bot");
    const view = makeView({
      you: bot,
      phase: "trade",
      players: [bot, opponent("other", 1)],
      trade: {
        proposals: [
          {
            id: "p1",
            playerAId: "other",
            playerBId: "bot",
            currentProposerId: "other",
            offer: { resources: { gem: 3 }, coins: 0 },
            request: { resources: { spice: 1 }, coins: 0 },
            status: "pending",
            history: [],
            round: 3,
            unrefusable: false,
          },
        ],
      },
    });
    const action = decideAction(view, "medium", createAiMemory(), zeroRng);
    expect(action).toEqual({ kind: "TRADE_ACCEPT", proposalId: "p1" });
  });

  it("declines a proposal it cannot afford rather than crashing", () => {
    const bot = you("bot", { resources: bundle(0), coins: 0 });
    const view = makeView({
      you: bot,
      phase: "trade",
      players: [bot, opponent("other", 1)],
      trade: {
        proposals: [
          {
            id: "p1",
            playerAId: "other",
            playerBId: "bot",
            currentProposerId: "other",
            offer: { resources: { gem: 1 }, coins: 0 },
            request: { resources: { spice: 5 }, coins: 0 },
            status: "pending",
            history: [],
            round: 3,
            unrefusable: false,
          },
        ],
      },
    });
    const action = decideAction(view, "medium", createAiMemory(), zeroRng);
    expect(action).toEqual({ kind: "TRADE_DECLINE", proposalId: "p1" });
  });
});

describe("decideAction — raid", () => {
  it("never targets itself and never exceeds the round's token cap", () => {
    const bot = you("bot");
    const view = makeView({
      you: bot,
      phase: "raid",
      players: [bot, opponent("a", 1), opponent("b", 2)],
    });
    for (let i = 0; i < 50; i++) {
      const rng = (() => {
        let n = i / 50;
        return () => {
          const v = n;
          n = (n + 0.37) % 1;
          return v;
        };
      })();
      const action = decideAction(view, "hard", createAiMemory(), rng);
      if (action?.kind === "RAID_COMMIT" && action.targetId) {
        expect(action.targetId).not.toBe("bot");
        expect(action.tokens).toBeLessThanOrEqual(RAID_TOKEN_CAP_STANDARD);
        expect(action.tokens).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("Hard targets the wealthiest opponent once a Reckoning snapshot is public", () => {
    const bot = you("bot");
    const view = makeView({
      you: bot,
      phase: "raid",
      players: [bot, opponent("poor", 1), opponent("rich", 2)],
      reckoning: {
        round: RECKONING_ROUND,
        lowestWealthPlayerId: "poor",
        amountGiven: RECKONING_CATCH_UP_COINS,
        wealthByPlayer: { bot: 20, poor: 5, rich: 50 },
      },
    });
    // rng below the sit-out chance boundary on the first call would sit out —
    // use a low-but-not-zero value that clears Hard's 0.15 sit-out chance.
    const action = decideAction(view, "hard", createAiMemory(), () => 0.9);
    expect(action).toEqual({ kind: "RAID_COMMIT", targetId: "rich", tokens: expect.any(Number) });
  });
});

describe("recordReveal", () => {
  it("accumulates lie counts across multiple reveals", () => {
    const memory = createAiMemory();
    recordReveal(memory, [
      { claimantId: "x", targetId: "bot", resource: "spice", claimedCount: 3, outcome: "verified_false", actualCount: 1 },
    ]);
    recordReveal(memory, [
      { claimantId: "x", targetId: "bot", resource: "gold", claimedCount: 2, outcome: "verified_false", actualCount: 0 },
      { claimantId: "y", targetId: "bot", resource: "gem", claimedCount: 1, outcome: "verified_true", actualCount: 1 },
    ]);
    expect(memory.timesCaughtLying["x"]).toBe(2);
    expect(memory.timesCaughtLying["y"]).toBeUndefined();
  });
});
