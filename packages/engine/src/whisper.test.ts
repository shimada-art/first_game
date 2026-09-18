import { describe, expect, it } from "vitest";
import { announceVerify, offerBribe, respondToBribe, submitWhisperClaim, trustClaim } from "./whisper.js";
import { makePlayer, makeTestState } from "./testHelpers.js";
import type { GameState } from "./types.js";

function baseState(overrides: Partial<GameState> = {}) {
  const players = [
    makePlayer(0, { id: "a", coins: 10, resources: { spice: 3, textile: 1, gold: 0, gem: 0 } }),
    makePlayer(1, { id: "b", coins: 10 }),
  ];
  return makeTestState({ players, phase: "whisper", ...overrides });
}

describe("submitWhisperClaim", () => {
  it("accepts a valid claim, spends a card, and opens a pending response", () => {
    const state = baseState();
    const next = submitWhisperClaim(state, "a", "b", "spice", 3);
    expect(next.players.find((p) => p.id === "a")!.whisperCardsRemaining).toBe(2);
    expect(next.whisper.pending).toEqual({
      stage: "awaitingResponse",
      claim: { claimantId: "a", targetId: "b", resource: "spice", count: 3, freeFromRumorMill: false },
    });
  });

  it("rejects targeting yourself", () => {
    expect(() => submitWhisperClaim(baseState(), "a", "a", "spice", 1)).toThrow();
  });

  it("rejects a second normal claim from the same player in the same round", () => {
    const state = submitWhisperClaim(baseState(), "a", "b", "spice", 3);
    const trusted = trustClaim(state, "b");
    expect(() => submitWhisperClaim(trusted, "a", "b", "textile", 1)).toThrow();
  });

  it("rejects a claim with no whisper cards remaining", () => {
    const state = baseState({
      players: [
        makePlayer(0, { id: "a", whisperCardsRemaining: 0 }),
        makePlayer(1, { id: "b" }),
      ],
    });
    expect(() => submitWhisperClaim(state, "a", "b", "spice", 1)).toThrow();
  });

  it("Double Whisper: grants exactly one bonus claim this round, then it's used up for the game", () => {
    const state = baseState({
      players: [
        makePlayer(0, { id: "a", role: "doubleWhisper" }),
        makePlayer(1, { id: "b" }),
        makePlayer(2, { id: "c" }),
      ],
    });
    let s = submitWhisperClaim(state, "a", "b", "spice", 3);
    s = trustClaim(s, "b");
    s = submitWhisperClaim(s, "a", "c", "textile", 1); // bonus 2nd claim, different target
    expect(s.players.find((p) => p.id === "a")!.roleUsed).toBe(true);
    s = trustClaim(s, "c");
    expect(() => submitWhisperClaim(s, "a", "b", "gold", 0)).toThrow(); // no 3rd claim
  });

  it("Rumor Mill: grants one free claim that doesn't spend a card or count against the normal cap", () => {
    const state = baseState({ currentEvent: "rumorMill" });
    let s = submitWhisperClaim(state, "a", "b", "spice", 3);
    expect(s.players.find((p) => p.id === "a")!.whisperCardsRemaining).toBe(3); // unchanged
    expect(s.whisper.pending?.claim.freeFromRumorMill).toBe(true);
    s = trustClaim(s, "b");
    const s2 = submitWhisperClaim(s, "a", "b", "textile", 1); // normal claim still available
    expect(s2.players.find((p) => p.id === "a")!.whisperCardsRemaining).toBe(2);
  });
});

describe("trust", () => {
  it("resolves without revealing anything or moving coins", () => {
    const state = submitWhisperClaim(baseState(), "a", "b", "spice", 3);
    const next = trustClaim(state, "b");
    expect(next.whisper.pending).toBeNull();
    expect(next.whisper.resolutions).toEqual([
      { claimantId: "a", targetId: "b", resource: "spice", claimedCount: 3, outcome: "trust" },
    ]);
    expect(next.players).toEqual(state.players); // no coin movement
  });

  it("only the target can trust", () => {
    const state = submitWhisperClaim(baseState(), "a", "b", "spice", 3);
    expect(() => trustClaim(state, "a")).toThrow();
  });
});

describe("verify resolution", () => {
  it("true claim: verifier pays claimant 1 (plus their own verify cost, to the bank)", () => {
    let state = submitWhisperClaim(baseState(), "a", "b", "spice", 3); // actually true: a has 3 spice
    state = announceVerify(state, "b");
    const next = offerBribe(state, "a", 0); // decline -> resolves immediately

    expect(next.whisper.resolutions[0]).toMatchObject({ outcome: "verified_true", actualCount: 3 });
    expect(next.players.find((p) => p.id === "a")!.coins).toBe(11); // +1 from verifier
    expect(next.players.find((p) => p.id === "b")!.coins).toBe(8); // -1 cost, -1 to claimant
    expect(next.bank.coins).toBe(21); // +1 verify cost
  });

  it("false claim: claimant pays verifier 1 coin", () => {
    let state = submitWhisperClaim(baseState(), "a", "b", "spice", 99); // false
    state = announceVerify(state, "b");
    const next = offerBribe(state, "a", 0);

    expect(next.whisper.resolutions[0]).toMatchObject({ outcome: "verified_false", actualCount: 3 });
    expect(next.players.find((p) => p.id === "a")!.coins).toBe(9); // -1
    expect(next.players.find((p) => p.id === "b")!.coins).toBe(10); // -1 cost +1 from claimant = net 0
  });

  it("Generous Terms: verify costs 0, overriding Locksmith's surcharge", () => {
    let state = baseState({
      currentEvent: "generousTerms",
      players: [
        makePlayer(0, { id: "a", role: "locksmith", resources: { spice: 3, textile: 0, gold: 0, gem: 0 } }),
        makePlayer(1, { id: "b", coins: 10 }),
      ],
    });
    state = submitWhisperClaim(state, "a", "b", "spice", 3);
    state = announceVerify(state, "b");
    const next = offerBribe(state, "a", 0);
    expect(next.players.find((p) => p.id === "b")!.coins).toBe(9); // 0 cost, -1 reward paid to claimant for a true claim
  });

  it("Locksmith: verify costs 2 instead of 1 when no override event is active", () => {
    let state = baseState({
      players: [
        makePlayer(0, { id: "a", role: "locksmith", resources: { spice: 3, textile: 0, gold: 0, gem: 0 } }),
        makePlayer(1, { id: "b", coins: 10 }),
      ],
    });
    state = submitWhisperClaim(state, "a", "b", "spice", 3);
    state = announceVerify(state, "b");
    const next = offerBribe(state, "a", 0);
    expect(next.players.find((p) => p.id === "b")!.coins).toBe(7); // -2 cost, -1 reward paid to claimant
  });
});

describe("bribe", () => {
  it("offering 0 skips straight to verify resolution", () => {
    let state = submitWhisperClaim(baseState(), "a", "b", "spice", 3);
    state = announceVerify(state, "b");
    const next = offerBribe(state, "a", 0);
    expect(next.whisper.pending).toBeNull();
    expect(next.whisper.resolutions).toHaveLength(1);
  });

  it("accepted bribe transfers coins and never reveals the truth", () => {
    let state = submitWhisperClaim(baseState(), "a", "b", "spice", 3);
    state = announceVerify(state, "b");
    state = offerBribe(state, "a", 4);
    const next = respondToBribe(state, "b", true);

    expect(next.players.find((p) => p.id === "a")!.coins).toBe(6);
    expect(next.players.find((p) => p.id === "b")!.coins).toBe(14);
    expect(next.whisper.resolutions[0]).toMatchObject({ outcome: "bribe_accepted" });
    expect(next.whisper.resolutions[0]!.actualCount).toBeUndefined();
  });

  it("declined bribe proceeds to verify resolution", () => {
    let state = submitWhisperClaim(baseState(), "a", "b", "spice", 3);
    state = announceVerify(state, "b");
    state = offerBribe(state, "a", 4);
    const next = respondToBribe(state, "b", false);
    expect(next.whisper.resolutions[0]).toMatchObject({ outcome: "verified_true" });
  });

  it("rejects a bribe offer the claimant can't afford", () => {
    let state = submitWhisperClaim(baseState({ players: [makePlayer(0, { id: "a", coins: 2 }), makePlayer(1, { id: "b" })] }), "a", "b", "spice", 3);
    state = announceVerify(state, "b");
    expect(() => offerBribe(state, "a", 5)).toThrow();
  });
});
