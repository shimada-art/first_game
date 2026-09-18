import { describe, expect, it } from "vitest";
import { generateRoomCode, isValidRoomCode, normalizeRoomCode, ROOM_CODE_LENGTH } from "./roomCode.js";

describe("generateRoomCode", () => {
  it("produces a code of the expected length using only the safe alphabet", () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(ROOM_CODE_LENGTH);
    expect(isValidRoomCode(code)).toBe(true);
  });

  it("excludes visually ambiguous characters", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode();
      expect(code).not.toMatch(/[01OIL]/);
    }
  });

  it("is not obviously deterministic across calls", () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateRoomCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe("normalizeRoomCode", () => {
  it("trims and uppercases", () => {
    expect(normalizeRoomCode("  ab12cd  ")).toBe("AB12CD");
  });
});

describe("isValidRoomCode", () => {
  it("rejects the wrong length", () => {
    expect(isValidRoomCode("ABC")).toBe(false);
  });

  it("rejects ambiguous characters even at the right length", () => {
    expect(isValidRoomCode("ABC0IL")).toBe(false);
  });
});
