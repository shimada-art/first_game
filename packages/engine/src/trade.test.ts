import { describe, expect, it } from "vitest";
import {
  acceptTrade,
  appraiserPeek,
  counterTrade,
  declineTrade,
  opportunistBankTrade,
  proposeTrade,
  withdrawTrade,
} from "./trade.js";
import { makePlayer, makeTestState } from "./testHelpers.js";
import type { GameState } from "./types.js";

function baseState(overrides: Partial<GameState> = {}) {
  const players = [
    makePlayer(0, { id: "a", coins: 10, resources: { spice: 3, textile: 0, gold: 0, gem: 0 } }),
    makePlayer(1, { id: "b", coins: 10, resources: { spice: 0, textile: 3, gold: 0, gem: 0 } }),
  ];
  return makeTestState({ players, phase: "trade", ...overrides });
}

describe("P2P trade propose/accept", () => {
  it("executes the agreed transfer atomically on accept", () => {
    const state = baseState();
    const proposed = proposeTrade(
      state,
      "a",
      "b",
      { resources: { spice: 1 }, coins: 0 },
      { resources: { textile: 2 }, coins: 1 },
    );
    const proposalId = proposed.trade.proposals[0]!.id;
    const next = acceptTrade(proposed, "b", proposalId);

    const a = next.players.find((p) => p.id === "a")!;
    const b = next.players.find((p) => p.id === "b")!;
    expect(a.resources.spice).toBe(2);
    expect(a.resources.textile).toBe(2);
    expect(a.coins).toBe(11);
    expect(b.resources.textile).toBe(1);
    expect(b.resources.spice).toBe(1);
    expect(b.coins).toBe(9);
  });

  it("rejects proposing an offer you can't afford", () => {
    const state = baseState();
    expect(() =>
      proposeTrade(state, "a", "b", { resources: { spice: 99 }, coins: 0 }, { resources: {}, coins: 0 }),
    ).toThrow();
  });

  it("rejects a second proposal between the same pair while one is pending", () => {
    const state = baseState();
    const proposed = proposeTrade(state, "a", "b", { resources: { spice: 1 }, coins: 0 }, { resources: {}, coins: 0 });
    expect(() =>
      proposeTrade(proposed, "a", "b", { resources: { spice: 1 }, coins: 0 }, { resources: {}, coins: 0 }),
    ).toThrow();
  });

  it("only the recipient can accept, decline, or counter", () => {
    const state = baseState();
    const proposed = proposeTrade(state, "a", "b", { resources: { spice: 1 }, coins: 0 }, { resources: {}, coins: 0 });
    const id = proposed.trade.proposals[0]!.id;
    expect(() => acceptTrade(proposed, "a", id)).toThrow();
    expect(() => declineTrade(proposed, "a", id)).toThrow();
  });

  it("only the current proposer can withdraw", () => {
    const state = baseState();
    const proposed = proposeTrade(state, "a", "b", { resources: { spice: 1 }, coins: 0 }, { resources: {}, coins: 0 });
    const id = proposed.trade.proposals[0]!.id;
    expect(() => withdrawTrade(proposed, "b", id)).toThrow();
    const withdrawn = withdrawTrade(proposed, "a", id);
    expect(withdrawn.trade.proposals[0]!.status).toBe("withdrawn");
  });

  it("counter flips whose terms are live and appends to history", () => {
    const state = baseState();
    let proposal = proposeTrade(state, "a", "b", { resources: { spice: 1 }, coins: 0 }, { resources: { textile: 3 }, coins: 0 });
    const id = proposal.trade.proposals[0]!.id;
    proposal = counterTrade(proposal, "b", id, { resources: { textile: 1 }, coins: 0 }, { resources: { spice: 1 }, coins: 0 });

    const p = proposal.trade.proposals[0]!;
    expect(p.currentProposerId).toBe("b");
    expect(p.history).toHaveLength(2);

    // now it's a's turn to respond to b's counter-terms
    expect(() => counterTrade(proposal, "b", id, { resources: {}, coins: 0 }, { resources: {}, coins: 0 })).toThrow();
    const accepted = acceptTrade(proposal, "a", id);
    expect(accepted.players.find((x) => x.id === "a")!.resources.textile).toBe(1);
    expect(accepted.players.find((x) => x.id === "b")!.resources.spice).toBe(1);
  });
});

describe("Closer role", () => {
  it("makes an exactly-1-for-1 trade unrefusable until countered", () => {
    const state = baseState({
      players: [
        makePlayer(0, { id: "a", role: "closer", coins: 10, resources: { spice: 3, textile: 0, gold: 0, gem: 0 } }),
        makePlayer(1, { id: "b", coins: 10, resources: { spice: 0, textile: 3, gold: 0, gem: 0 } }),
      ],
    });
    const proposed = proposeTrade(
      state,
      "a",
      "b",
      { resources: { spice: 1 }, coins: 0 },
      { resources: { textile: 1 }, coins: 0 },
      true,
    );
    const id = proposed.trade.proposals[0]!.id;
    expect(proposed.players.find((p) => p.id === "a")!.roleUsed).toBe(true);
    expect(() => declineTrade(proposed, "b", id)).toThrow();

    const countered = counterTrade(proposed, "b", id, { resources: { textile: 2 }, coins: 0 }, { resources: { spice: 1 }, coins: 0 });
    expect(countered.trade.proposals[0]!.unrefusable).toBe(false);
  });

  it("rejects Closer on a trade that isn't exactly 1-for-1", () => {
    const state = baseState({
      players: [
        makePlayer(0, { id: "a", role: "closer", coins: 10, resources: { spice: 3, textile: 0, gold: 0, gem: 0 } }),
        makePlayer(1, { id: "b", coins: 10 }),
      ],
    });
    expect(() =>
      proposeTrade(state, "a", "b", { resources: { spice: 2 }, coins: 0 }, { resources: { textile: 1 }, coins: 0 }, true),
    ).toThrow();
  });
});

describe("Opportunist role", () => {
  it("may Bank-trade once during the Market phase window", () => {
    const state = makeTestState({
      players: [makePlayer(0, { id: "a", role: "opportunist", coins: 10 })],
      phase: "market",
    });
    const next = opportunistBankTrade(state, "a", "spice", "buy");
    expect(next.players[0]!.roleUsed).toBe(true);
    expect(() => opportunistBankTrade(next, "a", "spice", "buy")).toThrow();
  });

  it("rejects the Opportunist window outside the Market phase", () => {
    const state = makeTestState({
      players: [makePlayer(0, { id: "a", role: "opportunist", coins: 10 })],
      phase: "trade",
    });
    expect(() => opportunistBankTrade(state, "a", "spice", "buy")).toThrow();
  });
});

describe("Appraiser role", () => {
  it("reveals up to 3 tokens from the target's hand and marks the role used", () => {
    const state = baseState({
      players: [
        makePlayer(0, { id: "a", role: "appraiser" }),
        makePlayer(1, { id: "b", resources: { spice: 1, textile: 0, gold: 5, gem: 0 } }),
      ],
    });
    const { state: next, tokens } = appraiserPeek(state, "a", "b");
    expect(tokens).toEqual(["spice", "gold", "gold"]);
    expect(next.players.find((p) => p.id === "a")!.roleUsed).toBe(true);
  });
});
