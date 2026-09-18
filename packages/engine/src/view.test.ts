import { describe, expect, it } from "vitest";
import { viewForPlayer } from "./view.js";
import { makePlayer, makeTestState } from "./testHelpers.js";
import { proposeTrade } from "./trade.js";
import { commitRaid } from "./raid.js";
import type { GameState } from "./types.js";

function baseState(overrides: Partial<GameState> = {}) {
  const players = [
    makePlayer(0, { id: "a", role: "smuggler", coins: 7, resources: { spice: 3, textile: 0, gold: 0, gem: 0 } }),
    makePlayer(1, { id: "b", coins: 9, resources: { spice: 0, textile: 5, gold: 0, gem: 0 } }),
    makePlayer(2, { id: "c" }),
  ];
  return makeTestState({ players, ...overrides });
}

describe("viewForPlayer", () => {
  it("shows the viewer their own resources, coins, and role", () => {
    const view = viewForPlayer(baseState(), "a");
    expect(view.you).toMatchObject({ id: "a", role: "smuggler", coins: 7, resources: { spice: 3, textile: 0, gold: 0, gem: 0 } });
  });

  it("hides every other player's resources, coins, and role", () => {
    const view = viewForPlayer(baseState(), "a");
    const bPublic = view.players.find((p) => p.id === "b")!;
    expect(bPublic).not.toHaveProperty("resources");
    expect(bPublic).not.toHaveProperty("coins");
    expect(bPublic).not.toHaveProperty("role");
  });

  it("hides the remaining event deck's contents, exposing only its size", () => {
    const view = viewForPlayer(baseState({ eventDeck: ["gemRush", "bankHoliday", "quietMarket"] }), "a");
    expect(view.eventDeckSize).toBe(3);
    expect(view).not.toHaveProperty("eventDeck");
  });

  it("only includes Trade proposals the viewer is a party to", () => {
    const state = proposeTrade(
      baseState({ phase: "trade" }),
      "b",
      "c",
      { resources: { textile: 1 }, coins: 0 },
      { resources: {}, coins: 0 },
    );
    const viewA = viewForPlayer(state, "a");
    const viewB = viewForPlayer(state, "b");
    expect(viewA.trade.proposals).toHaveLength(0);
    expect(viewB.trade.proposals).toHaveLength(1);
  });

  it("shows only that others have committed a raid, never their target or token count", () => {
    let state = baseState({ phase: "raid" });
    state = commitRaid(state, "a", "b", 2);
    state = commitRaid(state, "b", "c", 1);

    const viewA = viewForPlayer(state, "a");
    expect(viewA.raid.yourCommitment).toEqual({ targetId: "b", tokens: 2, lootPreference: [], usedSmuggler: false });
    expect(viewA.raid.committedPlayerIds.sort()).toEqual(["a", "b"]);
    expect(viewA).not.toHaveProperty("commitments");
  });
});
