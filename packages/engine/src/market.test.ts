import { describe, expect, it } from "vitest";
import { runMarketPhase } from "./market.js";
import { makePlayer, makeTestState } from "./testHelpers.js";
import type { GameState } from "./types.js";

function stateAtRound(round: number, overrides: Partial<GameState> = {}) {
  const players = [
    makePlayer(0, { id: "a" }),
    makePlayer(1, { id: "b" }),
    makePlayer(2, { id: "c" }),
    makePlayer(3, { id: "d" }),
  ];
  return makeTestState({ players, round, phase: "reveal", ...overrides });
}

describe("runMarketPhase price formula", () => {
  it("moves a resource +1 when net Bank volume was positive", () => {
    const state = stateAtRound(2, { lastRoundBankNet: { spice: 3, textile: 0, gold: 0, gem: 0 } });
    const next = runMarketPhase(state);
    expect(next.prices.spice).toBe(6);
  });

  it("moves a resource -1 when net Bank volume was negative, regardless of magnitude", () => {
    const state = stateAtRound(2, { lastRoundBankNet: { spice: -50, textile: 0, gold: 0, gem: 0 } });
    const next = runMarketPhase(state);
    expect(next.prices.spice).toBe(4);
  });

  it("leaves price unchanged when net volume is zero", () => {
    const state = stateAtRound(2);
    const next = runMarketPhase(state);
    expect(next.prices.spice).toBe(5);
  });

  it("clamps at the price floor and ceiling", () => {
    const low = stateAtRound(2, { prices: { spice: 1, textile: 5, gold: 5, gem: 5 }, lastRoundBankNet: { spice: -1, textile: 0, gold: 0, gem: 0 } });
    expect(runMarketPhase(low).prices.spice).toBe(1);

    const high = stateAtRound(2, { prices: { spice: 10, textile: 5, gold: 5, gem: 5 }, lastRoundBankNet: { spice: 1, textile: 0, gold: 0, gem: 0 } });
    expect(runMarketPhase(high).prices.spice).toBe(10);
  });

  it("resets lastRoundBankNet for the new round's accumulation", () => {
    const state = stateAtRound(2, { lastRoundBankNet: { spice: 3, textile: -2, gold: 0, gem: 0 } });
    const next = runMarketPhase(state);
    expect(next.lastRoundBankNet).toEqual({ spice: 0, textile: 0, gold: 0, gem: 0 });
  });

  it("draws one event per round from 2 to 9, none in round 10 (finalBazaarRound)", () => {
    const state = stateAtRound(2, { eventDeck: ["gemRush", "bankHoliday"] });
    let next = runMarketPhase(state);
    expect(next.currentEvent).toBe("gemRush");
    expect(next.eventDeck).toEqual(["bankHoliday"]);

    const finalRound = stateAtRound(10, { eventDeck: ["bankHoliday"] });
    next = runMarketPhase(finalRound);
    expect(next.currentEvent).toBeNull();
    expect(next.eventDeck).toEqual(["bankHoliday"]); // untouched
  });
});

describe("market events", () => {
  // The event is drawn from eventDeck by runMarketPhase itself (round < finalBazaarRound),
  // overwriting any pre-set currentEvent — so these seed eventDeck rather than currentEvent.
  it("Quiet Market freezes all four resources regardless of volume", () => {
    const state = stateAtRound(2, {
      eventDeck: ["quietMarket"],
      lastRoundBankNet: { spice: 5, textile: -5, gold: 3, gem: -3 },
    });
    const next = runMarketPhase(state);
    expect(next.prices).toEqual({ spice: 5, textile: 5, gold: 5, gem: 5 });
  });

  it("Spice Festival freezes only Spice", () => {
    const state = stateAtRound(2, {
      eventDeck: ["spiceFestival"],
      lastRoundBankNet: { spice: 5, textile: 5, gold: 0, gem: 0 },
    });
    const next = runMarketPhase(state);
    expect(next.prices.spice).toBe(5);
    expect(next.prices.textile).toBe(6);
  });

  it("Gem Rush doubles Gem's step to 2, other resources unaffected", () => {
    const state = stateAtRound(2, {
      eventDeck: ["gemRush"],
      lastRoundBankNet: { spice: 1, textile: 0, gold: 0, gem: -4 },
    });
    const next = runMarketPhase(state);
    expect(next.prices.gem).toBe(3);
    expect(next.prices.spice).toBe(6);
  });
});

describe("Speculator role", () => {
  it("moves one price by ±1 before the formula applies, and marks the role used", () => {
    const players = [
      makePlayer(0, { id: "a", role: "speculator" }),
      makePlayer(1, { id: "b" }),
      makePlayer(2, { id: "c" }),
      makePlayer(3, { id: "d" }),
    ];
    const state = makeTestState({ players, round: 2, phase: "reveal" });

    const next = runMarketPhase(state, { playerId: "a", resource: "gold", direction: 1 });
    expect(next.prices.gold).toBe(6);
    expect(next.players.find((p) => p.id === "a")!.roleUsed).toBe(true);
  });

  it("rejects a non-Speculator or an already-used Speculator", () => {
    const players = [
      makePlayer(0, { id: "a", role: "speculator", roleUsed: true }),
      makePlayer(1, { id: "b" }),
      makePlayer(2, { id: "c" }),
      makePlayer(3, { id: "d" }),
    ];
    const state = makeTestState({ players, round: 2, phase: "reveal" });
    expect(() => runMarketPhase(state, { playerId: "a", resource: "gold", direction: 1 })).toThrow();
    expect(() => runMarketPhase(state, { playerId: "b", resource: "gold", direction: 1 })).toThrow();
  });
});
