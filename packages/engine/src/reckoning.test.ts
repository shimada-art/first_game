import { describe, expect, it } from "vitest";
import { applyReckoning } from "./reckoning.js";
import { makePlayer, makeTestState } from "./testHelpers.js";
import type { GameState } from "./types.js";

function baseState(overrides: Partial<GameState> = {}) {
  const players = [
    makePlayer(0, { id: "a", coins: 20, resources: { spice: 0, textile: 0, gold: 0, gem: 0 } }),
    makePlayer(1, { id: "b", coins: 2, resources: { spice: 0, textile: 0, gold: 0, gem: 0 } }),
    makePlayer(2, { id: "c", coins: 15, resources: { spice: 0, textile: 0, gold: 0, gem: 0 } }),
    makePlayer(3, { id: "d", coins: 30, resources: { spice: 0, textile: 0, gold: 0, gem: 0 } }),
  ];
  return makeTestState({ players, round: 7, phase: "reveal", ...overrides });
}

describe("applyReckoning", () => {
  it("gives the lowest-wealth player the configured catch-up amount from the Bank", () => {
    const state = baseState();
    const next = applyReckoning(state);
    expect(next.reckoning?.lowestWealthPlayerId).toBe("b");
    expect(next.players.find((p) => p.id === "b")!.coins).toBe(4);
    expect(next.bank.coins).toBe(state.bank.coins - 2);
  });

  it("caps the payout at what's left in the Bank", () => {
    const state = baseState({ bank: { coins: 1, resources: { spice: 0, textile: 0, gold: 0, gem: 0 } } });
    const next = applyReckoning(state);
    expect(next.reckoning?.amountGiven).toBe(1);
    expect(next.bank.coins).toBe(0);
  });

  it("only runs on the configured reckoning round", () => {
    const state = baseState({ round: 3 });
    expect(() => applyReckoning(state)).toThrow();
  });
});
