import { describe, expect, it } from "vitest";
import { commitRaid, resolveRaids } from "./raid.js";
import { makePlayer, makeTestState } from "./testHelpers.js";
import type { GameState } from "./types.js";

function baseState(overrides: Partial<GameState> = {}) {
  const players = [
    makePlayer(0, { id: "a", resources: { spice: 5, textile: 5, gold: 5, gem: 5 } }),
    makePlayer(1, { id: "b", resources: { spice: 5, textile: 5, gold: 5, gem: 5 } }),
    makePlayer(2, { id: "c", resources: { spice: 5, textile: 5, gold: 5, gem: 5 } }),
    makePlayer(3, { id: "d", resources: { spice: 5, textile: 5, gold: 5, gem: 5 } }),
  ];
  return makeTestState({ players, phase: "raid", startingPlayerId: "a", ...overrides });
}

function commitAll(
  state: GameState,
  commitments: Record<string, { targetId: string | null; tokens: number; lootPreference?: string[] }>,
) {
  let next = state;
  for (const [playerId, c] of Object.entries(commitments)) {
    next = commitRaid(next, playerId, c.targetId, c.tokens, (c.lootPreference as never) ?? []);
  }
  return next;
}

describe("commitRaid", () => {
  it("rejects exceeding the round's token cap", () => {
    const state = baseState();
    expect(() => commitRaid(state, "a", "b", 4)).toThrow(); // standard cap is 3
  });

  it("allows the raised cap of 4 in the Final Bazaar round", () => {
    const state = baseState({ round: 10 });
    expect(() => commitRaid(state, "a", "b", 4)).not.toThrow();
  });

  it("rejects committing twice in the same round", () => {
    const state = commitRaid(baseState(), "a", "b", 1);
    expect(() => commitRaid(state, "a", "c", 1)).toThrow();
  });

  it("rejects targeting yourself", () => {
    expect(() => commitRaid(baseState(), "a", "a", 1)).toThrow();
  });

  it("Smuggler: +1 on top of the round's normal cap, once per game", () => {
    const state = baseState({
      players: [
        makePlayer(0, { id: "a", role: "smuggler", resources: { spice: 5, textile: 5, gold: 5, gem: 5 } }),
        makePlayer(1, { id: "b" }),
        makePlayer(2, { id: "c" }),
        makePlayer(3, { id: "d" }),
      ],
    });
    const next = commitRaid(state, "a", "b", 4, [], true); // cap 3 + 1 = 4
    expect(next.players.find((p) => p.id === "a")!.roleUsed).toBe(true);
    expect(next.raid.commitments["a"]!.tokens).toBe(4);
  });
});

describe("resolveRaids", () => {
  it("requires every player to have committed", () => {
    const state = commitRaid(baseState(), "a", "b", 1);
    expect(() => resolveRaids(state)).toThrow();
  });

  it("no_action for a 0-token or null-target commitment", () => {
    const state = commitAll(baseState(), {
      a: { targetId: null, tokens: 0 },
      b: { targetId: null, tokens: 0 },
      c: { targetId: null, tokens: 0 },
      d: { targetId: null, tokens: 0 },
    });
    const { results } = resolveRaids(state);
    expect(results.every((r) => r.outcome === "no_action")).toBe(true);
  });

  it("mutual raids fully cancel with no theft either direction", () => {
    const state = commitAll(baseState(), {
      a: { targetId: "b", tokens: 2 },
      b: { targetId: "a", tokens: 3 },
      c: { targetId: null, tokens: 0 },
      d: { targetId: null, tokens: 0 },
    });
    const { state: resolved, results } = resolveRaids(state);
    expect(results.find((r) => r.attackerId === "a")!.outcome).toBe("mutual_cancel");
    expect(results.find((r) => r.attackerId === "b")!.outcome).toBe("mutual_cancel");
    expect(resolved.players).toEqual(state.players);
  });

  it("steals the committed amount, capped by target availability, from the raider's loot preference", () => {
    const state = commitAll(baseState(), {
      a: { targetId: "b", tokens: 2, lootPreference: ["gold"] },
      b: { targetId: null, tokens: 0 },
      c: { targetId: null, tokens: 0 },
      d: { targetId: null, tokens: 0 },
    });
    const { state: resolved, results } = resolveRaids(state);
    const r = results.find((res) => res.attackerId === "a")!;
    expect(r.outcome).toBe("success");
    expect(r.stolen).toEqual({ gold: 2 });
    expect(resolved.players.find((p) => p.id === "a")!.resources.gold).toBe(7);
    expect(resolved.players.find((p) => p.id === "b")!.resources.gold).toBe(3);
  });

  it("Bodyguard blocks the first successful raid against them, then is used up", () => {
    const state = commitAll(
      baseState({
        players: [
          makePlayer(0, { id: "a", resources: { spice: 5, textile: 5, gold: 5, gem: 5 } }),
          makePlayer(1, { id: "b", role: "bodyguard", resources: { spice: 5, textile: 5, gold: 5, gem: 5 } }),
          makePlayer(2, { id: "c", resources: { spice: 5, textile: 5, gold: 5, gem: 5 } }),
          makePlayer(3, { id: "d", resources: { spice: 5, textile: 5, gold: 5, gem: 5 } }),
        ],
      }),
      { a: { targetId: "b", tokens: 2 }, b: { targetId: null, tokens: 0 }, c: { targetId: null, tokens: 0 }, d: { targetId: null, tokens: 0 } },
    );
    const { state: resolved, results } = resolveRaids(state);
    expect(results[0]).toMatchObject({ outcome: "blocked_bodyguard" });
    expect(resolved.players.find((p) => p.id === "b")!.resources).toEqual(state.players.find((p) => p.id === "b")!.resources);
    expect(resolved.players.find((p) => p.id === "b")!.roleUsed).toBe(true);
  });

  it("Underwriter pays 2 coins to cancel the raid when affordable", () => {
    const state = commitAll(
      baseState({
        players: [
          makePlayer(0, { id: "a", resources: { spice: 5, textile: 5, gold: 5, gem: 5 } }),
          makePlayer(1, { id: "b", role: "underwriter", coins: 10, resources: { spice: 5, textile: 5, gold: 5, gem: 5 } }),
          makePlayer(2, { id: "c" }),
          makePlayer(3, { id: "d" }),
        ],
      }),
      { a: { targetId: "b", tokens: 2 }, b: { targetId: null, tokens: 0 }, c: { targetId: null, tokens: 0 }, d: { targetId: null, tokens: 0 } },
    );
    const { state: resolved, results } = resolveRaids(state);
    expect(results[0]).toMatchObject({ outcome: "blocked_underwriter" });
    expect(resolved.players.find((p) => p.id === "b")!.coins).toBe(8);
  });

  it("Underwriter with insufficient coins can't block — the raid proceeds normally", () => {
    const state = commitAll(
      baseState({
        players: [
          makePlayer(0, { id: "a", resources: { spice: 5, textile: 5, gold: 5, gem: 5 } }),
          makePlayer(1, { id: "b", role: "underwriter", coins: 1, resources: { spice: 5, textile: 5, gold: 5, gem: 5 } }),
          makePlayer(2, { id: "c" }),
          makePlayer(3, { id: "d" }),
        ],
      }),
      { a: { targetId: "b", tokens: 2 }, b: { targetId: null, tokens: 0 }, c: { targetId: null, tokens: 0 }, d: { targetId: null, tokens: 0 } },
    );
    const { results } = resolveRaids(state);
    expect(results[0]!.outcome).toBe("success");
  });

  it("Caravan Season and Fence stack: +1 each on a successful steal", () => {
    const state = commitAll(
      baseState({
        currentEvent: "caravanSeason",
        players: [
          makePlayer(0, { id: "a", role: "fence", resources: { spice: 5, textile: 5, gold: 5, gem: 5 } }),
          makePlayer(1, { id: "b", resources: { spice: 5, textile: 5, gold: 5, gem: 5 } }),
          makePlayer(2, { id: "c" }),
          makePlayer(3, { id: "d" }),
        ],
      }),
      { a: { targetId: "b", tokens: 1 }, b: { targetId: null, tokens: 0 }, c: { targetId: null, tokens: 0 }, d: { targetId: null, tokens: 0 } },
    );
    const { state: resolved, results } = resolveRaids(state);
    const stolenTotal = Object.values(results[0]!.stolen).reduce((a, b) => a + (b ?? 0), 0);
    expect(stolenTotal).toBe(3); // 1 base + 1 caravan season + 1 fence
    expect(resolved.players.find((p) => p.id === "a")!.roleUsed).toBe(true);
  });

  it("multi-raider on the same target resolves in seating order, later raiders may get less", () => {
    const state = commitAll(
      baseState({
        players: [
          makePlayer(0, { id: "a", resources: { spice: 5, textile: 5, gold: 5, gem: 5 } }),
          makePlayer(1, { id: "b", resources: { spice: 2, textile: 0, gold: 0, gem: 0 } }), // target: only 2 spice total
          makePlayer(2, { id: "c", resources: { spice: 5, textile: 5, gold: 5, gem: 5 } }),
          makePlayer(3, { id: "d" }),
        ],
        startingPlayerId: "a",
      }),
      {
        a: { targetId: "b", tokens: 2, lootPreference: ["spice"] },
        c: { targetId: "b", tokens: 2, lootPreference: ["spice"] },
        b: { targetId: null, tokens: 0 },
        d: { targetId: null, tokens: 0 },
      },
    );
    const { state: resolved, results } = resolveRaids(state);
    const aResult = results.find((r) => r.attackerId === "a")!;
    const cResult = results.find((r) => r.attackerId === "c")!;
    expect(aResult.stolen.spice).toBe(2); // drains the target completely
    expect(cResult.stolen).toEqual({}); // nothing left for the later raider
    expect(resolved.players.find((p) => p.id === "b")!.resources.spice).toBe(0);
  });
});
