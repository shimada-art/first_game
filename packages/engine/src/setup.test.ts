import { describe, expect, it } from "vitest";
import {
  MARKET_EVENT_IDS,
  MERCHANT_ROLE_IDS,
  RESOURCE_IDS,
  WHISPER_CARDS_SILVER_TONGUE,
  WHISPER_CARDS_STANDARD,
} from "@souk/shared";
import { initializeGame } from "./setup.js";

function players(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i}` }));
}

describe("initializeGame", () => {
  it("rejects fewer than 4 or more than 6 players", () => {
    expect(() => initializeGame(players(3))).toThrow(RangeError);
    expect(() => initializeGame(players(7))).toThrow(RangeError);
  });

  it("rejects duplicate player ids", () => {
    expect(() => initializeGame([{ id: "a" }, { id: "a" }, { id: "b" }, { id: "c" }])).toThrow();
  });

  it("deals 10 coins and 2 of each resource per player, round 1, phase trade (spec §5.2 skips both Market and Whisper in round 1)", () => {
    const state = initializeGame(players(4));
    expect(state.round).toBe(1);
    expect(state.phase).toBe("trade");
    for (const p of state.players) {
      expect(p.coins).toBe(10);
      for (const r of RESOURCE_IDS) expect(p.resources[r]).toBe(2);
    }
  });

  it("matches the spec's bank reserve examples for 4 and 6 players", () => {
    const four = initializeGame(players(4));
    expect(four.bank.coins).toBe(40);
    for (const r of RESOURCE_IDS) expect(four.bank.resources[r]).toBe(12);

    const six = initializeGame(players(6));
    expect(six.bank.coins).toBe(20);
    for (const r of RESOURCE_IDS) expect(six.bank.resources[r]).toBe(8);
  });

  it("deals each of the 12 roles to at most one player", () => {
    const state = initializeGame(players(6));
    const roles = state.players.map((p) => p.role);
    expect(new Set(roles).size).toBe(roles.length);
    for (const role of roles) expect(MERCHANT_ROLE_IDS).toContain(role);
  });

  it("gives Silver Tongue 5 whisper cards and everyone else 3", () => {
    const state = initializeGame(players(6));
    for (const p of state.players) {
      expect(p.whisperCardsRemaining).toBe(
        p.role === "silverTongue" ? WHISPER_CARDS_SILVER_TONGUE : WHISPER_CARDS_STANDARD,
      );
    }
  });

  it("shuffles all 8 market events into the deck with no repeats", () => {
    const state = initializeGame(players(4));
    expect(state.eventDeck).toHaveLength(8);
    expect(new Set(state.eventDeck).size).toBe(8);
    for (const e of state.eventDeck) expect(MARKET_EVENT_IDS).toContain(e);
  });

  it("starts every price at 5", () => {
    const state = initializeGame(players(5));
    for (const r of RESOURCE_IDS) expect(state.prices[r]).toBe(5);
  });

  it("defaults the starting player to the first seat and rejects an unknown override", () => {
    const state = initializeGame(players(4));
    expect(state.startingPlayerId).toBe("p0");
    expect(() => initializeGame(players(4), { startingPlayerId: "ghost" })).toThrow();
  });
});
