import { useMemo } from "react";
import { colors, type Expression } from "@souk/ui";

export type CharacterId =
  | "redTrickster"
  | "turquoiseWanderer"
  | "desertMerchant"
  | "shadowMerchant"
  | "goldenTrader"
  | "silverMerchant"
  | "shimada";

export interface Character {
  id: CharacterId;
  name: string;
  title: string;
  color: string;
  /** Generated portrait art, keyed by expression. Falls back to a silhouette until generated. */
  portraits: Partial<Record<Expression, string>>;
}

/**
 * Seven playable identities — six ordinary merchants plus Shimada, a rare
 * seventh. A game's seats draw six of these seven (see assignCharacters),
 * so Shimada shows up in most games but not every one, matching the
 * "mysterious, sometimes-present" character the brief calls for. Shimada
 * has no mechanical role in the engine (MerchantRoleId has no such id) —
 * this is a purely cosmetic identity, per the brief's own instruction not
 * to make him automatically stronger.
 */
export const CHARACTER_ROSTER: Character[] = [
  {
    id: "redTrickster",
    name: "The Red Trickster",
    title: "confident, sly, never quite trustworthy",
    color: colors.textile,
    portraits: {},
  },
  {
    id: "turquoiseWanderer",
    name: "The Turquoise Wanderer",
    title: "playful traveler, always mid-story",
    color: colors.gem,
    portraits: {},
  },
  {
    id: "desertMerchant",
    name: "The Desert Merchant",
    title: "warm, energetic, deal-hungry",
    color: colors.spice,
    portraits: {},
  },
  {
    id: "shadowMerchant",
    name: "The Shadow Merchant",
    title: "still, watchful, unreadable",
    color: colors.secret,
    portraits: {},
  },
  {
    id: "goldenTrader",
    name: "The Golden Trader",
    title: "charismatic, generous, calculating",
    color: colors.gold,
    portraits: {},
  },
  {
    id: "silverMerchant",
    name: "The Silver Merchant",
    title: "calm, elegant, mysterious",
    color: colors.silver,
    portraits: {},
  },
  {
    id: "shimada",
    name: "Shimada",
    title: '"The Unfilled Void"',
    color: colors.void,
    portraits: {},
  },
];

const CHARACTERS_BY_ID = new Map(CHARACTER_ROSTER.map((c) => [c.id, c]));

export function getCharacter(id: CharacterId): Character {
  const character = CHARACTERS_BY_ID.get(id);
  if (!character) throw new Error(`Unknown character id: ${id}`);
  return character;
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Deterministic, seeded PRNG (mulberry32) so a room's assignment is stable across reconnects. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Assigns `seatCount` distinct characters to seats 0..seatCount-1 for a
 * given room, seeded by the room code so the mapping is stable for the
 * whole game (and across reconnects) but varies room to room.
 */
export function assignCharacters(roomCode: string, seatCount: number): CharacterId[] {
  const rng = mulberry32(hashString(roomCode));
  const shuffled = CHARACTER_ROSTER.map((c) => c.id);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = tmp;
  }
  return shuffled.slice(0, seatCount);
}

/** Memoized wrapper so components can look up a seat's character without re-shuffling every render. */
export function useCharacterAssignment(roomCode: string, seatCount: number): CharacterId[] {
  return useMemo(() => assignCharacters(roomCode, seatCount), [roomCode, seatCount]);
}

