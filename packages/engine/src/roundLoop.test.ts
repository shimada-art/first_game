import { describe, expect, it } from "vitest";
import { initializeGame } from "./setup.js";
import { commitRaid } from "./raid.js";
import { proposeTrade } from "./trade.js";
import { submitWhisperClaim } from "./whisper.js";
import { bankTrade, isBankOpen } from "./bank.js";
import {
  advanceFromReveal,
  advanceToRaid,
  advanceToReveal,
  advanceToTrade,
  advanceToWhisper,
} from "./roundLoop.js";
import type { GameState } from "./types.js";

function players(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i}` }));
}

function commitAllRaidsZero(state: GameState): GameState {
  let next = state;
  for (const p of state.players) next = commitRaid(next, p.id, null, 0);
  return next;
}

function playRoundToReveal(state: GameState): GameState {
  let next = state;
  if (next.phase === "market") next = advanceToWhisper(next);
  if (next.phase === "whisper") next = advanceToTrade(next);
  if (next.phase === "trade") next = advanceToRaid(next);
  next = commitAllRaidsZero(next);
  return advanceToReveal(next);
}

describe("round loop, end to end", () => {
  it("plays a full 10-round game through to a finished final tally", () => {
    let state = initializeGame(players(4));
    expect(state.round).toBe(1);
    expect(state.phase).toBe("trade"); // round 1 skips Market and Whisper

    for (let i = 0; i < 20 && state.status !== "finished"; i++) {
      state = playRoundToReveal(state);
      state = advanceFromReveal(state);
    }

    expect(state.status).toBe("finished");
    expect(state.phase).toBe("gameover");
    expect(state.round).toBe(10);
    expect(state.finalTally).not.toBeNull();
    expect(state.finalTally!.winnerIds.length).toBeGreaterThan(0);
  });

  it("runs the Reckoning once, at round 7, before round 8 begins", () => {
    let state = initializeGame(players(4));
    let reckoningRound: number | null = null;

    for (let i = 0; i < 20 && state.status !== "finished"; i++) {
      state = playRoundToReveal(state);
      const before = state.reckoning;
      state = advanceFromReveal(state);
      if (!before && state.reckoning) reckoningRound = state.reckoning.round;
    }

    expect(reckoningRound).toBe(7);
  });

  it("closes the Bank for the entire Final Bazaar round and raises the raid cap to 4", () => {
    let state = initializeGame(players(4));
    for (let i = 0; i < 20 && state.round < 10; i++) {
      state = playRoundToReveal(state);
      state = advanceFromReveal(state);
    }
    expect(state.round).toBe(10);
    expect(state.currentEvent).toBeNull();
    expect(isBankOpen(state)).toBe(false);
    expect(() => bankTrade(state, state.players[0]!.id, "spice", "buy")).toThrow();

    const raided = advanceToRaid(advanceToTrade(advanceToWhisper(state)));
    expect(() => commitRaid(raided, state.players[0]!.id, state.players[1]!.id, 4)).not.toThrow();
  });

  it("blocks advancing past Whisper while a claim is still pending", () => {
    let state = initializeGame(players(4)); // round 1 starts at trade
    state = advanceFromReveal(advanceToReveal(commitAllRaidsZero(advanceToRaid(state))));
    // now round 2, phase market
    state = advanceToWhisper(state);
    state = submitWhisperClaim(state, state.players[0]!.id, state.players[1]!.id, "spice", 2);
    expect(() => advanceToTrade(state)).toThrow();
  });

  it("blocks advancing past Trade while a proposal is still pending", () => {
    let state = initializeGame(players(4));
    state = advanceFromReveal(advanceToReveal(commitAllRaidsZero(advanceToRaid(state))));
    state = advanceToTrade(advanceToWhisper(state));
    state = proposeTrade(
      state,
      state.players[0]!.id,
      state.players[1]!.id,
      { resources: { spice: 1 }, coins: 0 },
      { resources: {}, coins: 0 },
    );
    expect(() => advanceToRaid(state)).toThrow();
  });
});
