import { describe, expect, it } from "vitest";
import { bankTrade, isBankOpen } from "./bank.js";
import { makePlayer, makeTestState } from "./testHelpers.js";
import type { GameState } from "./types.js";

function baseState(overrides: Partial<GameState> = {}) {
  const players = [makePlayer(0, { id: "a", coins: 10, resources: { spice: 2, textile: 2, gold: 2, gem: 2 } })];
  return makeTestState({ players, prices: { spice: 5, textile: 5, gold: 5, gem: 5 }, bank: { coins: 20, resources: { spice: 10, textile: 10, gold: 10, gem: 10 } }, ...overrides });
}

describe("bankTrade", () => {
  it("buy: player pays listed price, bank stock/coins move, lastRoundBankNet increments", () => {
    const state = baseState();
    const next = bankTrade(state, "a", "spice", "buy");
    const player = next.players[0]!;
    expect(player.coins).toBe(5);
    expect(player.resources.spice).toBe(3);
    expect(next.bank.coins).toBe(25);
    expect(next.bank.resources.spice).toBe(9);
    expect(next.lastRoundBankNet.spice).toBe(1);
  });

  it("sell: player receives listed price, lastRoundBankNet decrements", () => {
    const state = baseState();
    const next = bankTrade(state, "a", "spice", "sell");
    const player = next.players[0]!;
    expect(player.coins).toBe(15);
    expect(player.resources.spice).toBe(1);
    expect(next.lastRoundBankNet.spice).toBe(-1);
  });

  it("rejects a buy with insufficient coins", () => {
    const state = baseState({ players: [makePlayer(0, { id: "a", coins: 0 })] });
    expect(() => bankTrade(state, "a", "spice", "buy")).toThrow();
  });

  it("rejects a sell with no stock of that resource", () => {
    const state = baseState({ players: [makePlayer(0, { id: "a", resources: { spice: 0, textile: 0, gold: 0, gem: 0 } })] });
    expect(() => bankTrade(state, "a", "spice", "sell")).toThrow();
  });

  it("rejects a buy when the Bank has none of that resource", () => {
    const state = baseState({ bank: { coins: 20, resources: { spice: 0, textile: 10, gold: 10, gem: 10 } } });
    expect(() => bankTrade(state, "a", "spice", "buy")).toThrow();
  });

  it("Tight Purses: buy costs +1, sell gain -1 (floored at 0)", () => {
    const state = baseState({ currentEvent: "tightPurses", prices: { spice: 1, textile: 5, gold: 5, gem: 5 } });
    const bought = bankTrade(state, "a", "textile", "buy");
    expect(bought.players[0]!.coins).toBe(4); // 10 - (5+1)

    const sold = bankTrade(state, "a", "spice", "sell"); // price 1, tight purses -> floored at 0
    expect(sold.players[0]!.coins).toBe(10);
  });

  it("Broker: first 4 trades get a 1-coin-better rate, then reverts to normal", () => {
    let state = baseState({
      players: [makePlayer(0, { id: "a", role: "broker", coins: 100, resources: { spice: 20, textile: 20, gold: 20, gem: 20 } })],
      bank: { coins: 200, resources: { spice: 50, textile: 50, gold: 50, gem: 50 } },
    });

    for (let i = 0; i < 4; i++) {
      state = bankTrade(state, "a", "spice", "buy");
    }
    expect(state.players[0]!.coins).toBe(100 - 4 * 4); // price 5, -1 discount = 4 each
    expect(state.players[0]!.brokerTradesUsed).toBe(4);

    const fifth = bankTrade(state, "a", "spice", "buy");
    expect(fifth.players[0]!.coins).toBe(state.players[0]!.coins - 5); // full price, no discount
  });

  it("bank is closed on a Bank Holiday event", () => {
    const state = baseState({ currentEvent: "bankHoliday" });
    expect(isBankOpen(state)).toBe(false);
    expect(() => bankTrade(state, "a", "spice", "buy")).toThrow();
  });

  it("bank is closed for the entire Final Bazaar round", () => {
    const state = baseState({ round: 10, config: { ...baseState().config, finalBazaarRound: 10 } });
    expect(isBankOpen(state)).toBe(false);
  });
});
