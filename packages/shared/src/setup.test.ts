import { describe, expect, it } from "vitest";
import { bankReserveForPlayerCount } from "./setup.js";

describe("bankReserveForPlayerCount", () => {
  it("matches the spec's 4-player example: 40 coins, 12 of each resource", () => {
    const bank = bankReserveForPlayerCount(4);
    expect(bank.coins).toBe(40);
    expect(bank.resources).toEqual({ spice: 12, textile: 12, gold: 12, gem: 12 });
  });

  it("matches the spec's 6-player example: 20 coins, 8 of each resource", () => {
    const bank = bankReserveForPlayerCount(6);
    expect(bank.coins).toBe(20);
    expect(bank.resources).toEqual({ spice: 8, textile: 8, gold: 8, gem: 8 });
  });

  it("rejects player counts outside 4-6", () => {
    expect(() => bankReserveForPlayerCount(3)).toThrow(RangeError);
    expect(() => bankReserveForPlayerCount(7)).toThrow(RangeError);
  });
});
