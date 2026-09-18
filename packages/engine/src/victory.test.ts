import { describe, expect, it } from "vitest";
import { computeFinalTally } from "./victory.js";
import { makePlayer, makeTestState } from "./testHelpers.js";
import type { GameState } from "./types.js";

function baseState(overrides: Partial<GameState> = {}) {
  const players = [
    makePlayer(0, { id: "a", coins: 5, resources: { spice: 2, textile: 0, gold: 0, gem: 0 } }), // 5 + 2*5 = 15
    makePlayer(1, { id: "b", coins: 20, resources: { spice: 0, textile: 0, gold: 0, gem: 0 } }), // 20
  ];
  return makeTestState({ players, round: 10, phase: "reveal", prices: { spice: 5, textile: 5, gold: 5, gem: 5 }, ...overrides });
}

describe("computeFinalTally", () => {
  it("wealth is coins plus resources valued at current prices, highest wins", () => {
    const tally = computeFinalTally(baseState());
    expect(tally.wealthByPlayer).toEqual({ a: 15, b: 20 });
    expect(tally.winnerIds).toEqual(["b"]);
  });

  it("ties share the win", () => {
    const state = baseState({
      players: [
        makePlayer(0, { id: "a", coins: 20, resources: { spice: 0, textile: 0, gold: 0, gem: 0 } }),
        makePlayer(1, { id: "b", coins: 20, resources: { spice: 0, textile: 0, gold: 0, gem: 0 } }),
      ],
    });
    const tally = computeFinalTally(state);
    expect(tally.winnerIds.sort()).toEqual(["a", "b"]);
  });

  it("only runs on the Final Bazaar round", () => {
    expect(() => computeFinalTally(baseState({ round: 5 }))).toThrow();
  });
});
