import { describe, expect, it } from "vitest";
import { applyAction } from "./applyAction.js";
import { makePlayer, makeTestState } from "./testHelpers.js";
import type { GameState } from "./types.js";

function baseState(overrides: Partial<GameState> = {}) {
  const players = [
    makePlayer(0, { id: "a", coins: 10, resources: { spice: 3, textile: 0, gold: 0, gem: 0 } }),
    makePlayer(1, { id: "b", coins: 10, resources: { spice: 0, textile: 3, gold: 0, gem: 0 } }),
    makePlayer(2, { id: "c" }),
    makePlayer(3, { id: "d" }),
  ];
  return makeTestState({ players, startingPlayerId: "a", ...overrides });
}

describe("applyAction dispatch", () => {
  it("routes WHISPER_CLAIM to the whisper module", () => {
    const state = baseState({ phase: "whisper" });
    const { state: next } = applyAction(state, "a", { kind: "WHISPER_CLAIM", targetId: "b", resource: "spice", count: 3 });
    expect(next.whisper.pending?.claim).toMatchObject({ claimantId: "a", targetId: "b" });
  });

  it("routes BANK_TRADE to the bank module", () => {
    const state = baseState({ phase: "trade" });
    const { state: next } = applyAction(state, "a", { kind: "BANK_TRADE", resource: "spice", direction: "buy" });
    expect(next.players.find((p) => p.id === "a")!.resources.spice).toBe(4);
  });

  it("routes TRADE_PROPOSE / TRADE_ACCEPT to the trade module", () => {
    const state = baseState({ phase: "trade" });
    const { state: proposed } = applyAction(state, "a", {
      kind: "TRADE_PROPOSE",
      toPlayerId: "b",
      offer: { resources: { spice: 1 }, coins: 0 },
      request: { resources: { textile: 1 }, coins: 0 },
    });
    const proposalId = proposed.trade.proposals[0]!.id;
    const { state: accepted } = applyAction(proposed, "b", { kind: "TRADE_ACCEPT", proposalId });
    expect(accepted.players.find((p) => p.id === "a")!.resources.textile).toBe(1);
  });

  it("routes RAID_COMMIT to the raid module", () => {
    const state = baseState({ phase: "raid" });
    const { state: next } = applyAction(state, "a", { kind: "RAID_COMMIT", targetId: "b", tokens: 2 });
    expect(next.raid.commitments["a"]).toMatchObject({ targetId: "b", tokens: 2 });
  });

  it("returns a privateResult for APPRAISER_PEEK", () => {
    const state = baseState({
      phase: "trade",
      players: [
        makePlayer(0, { id: "a", role: "appraiser" }),
        makePlayer(1, { id: "b", resources: { spice: 2, textile: 0, gold: 0, gem: 0 } }),
        makePlayer(2, { id: "c" }),
        makePlayer(3, { id: "d" }),
      ],
    });
    const { privateResult } = applyAction(state, "a", { kind: "APPRAISER_PEEK", targetId: "b" });
    expect(privateResult).toEqual({ kind: "appraiserPeek", targetId: "b", tokens: ["spice", "spice"] });
  });

  it("ADVANCE_PHASE routes to the correct roundLoop transition for every phase", () => {
    let state = baseState({ phase: "market" });
    state = applyAction(state, "a", { kind: "ADVANCE_PHASE" }).state;
    expect(state.phase).toBe("whisper");
    state = applyAction(state, "a", { kind: "ADVANCE_PHASE" }).state;
    expect(state.phase).toBe("trade");
    state = applyAction(state, "a", { kind: "ADVANCE_PHASE" }).state;
    expect(state.phase).toBe("raid");
    for (const p of state.players) {
      state = applyAction(state, p.id, { kind: "RAID_COMMIT", targetId: null, tokens: 0 }).state;
    }
    state = applyAction(state, "a", { kind: "ADVANCE_PHASE" }).state;
    expect(state.phase).toBe("reveal");
    state = applyAction(state, "a", { kind: "ADVANCE_PHASE" }).state;
    expect(state.phase).toBe("market");
    expect(state.round).toBe(3); // baseState's round default is 2
  });

  it("rejects ADVANCE_PHASE once the game is over", () => {
    const state = baseState({ phase: "gameover", status: "finished" });
    expect(() => applyAction(state, "a", { kind: "ADVANCE_PHASE" })).toThrow();
  });
});
