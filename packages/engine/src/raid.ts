import { RESOURCE_IDS, type ResourceId } from "@souk/shared";
import { EngineError } from "./errors.js";
import { getPlayer, seatingOrder, updatePlayer } from "./players.js";
import type { GameState, RaidCommitment, RaidResolution } from "./types.js";

function assertRaidPhase(state: GameState): void {
  if (state.phase !== "raid") throw new EngineError("wrong_phase", "Not in the Raid phase");
}

function raidTokenCap(state: GameState): number {
  return state.round === state.config.finalBazaarRound
    ? state.config.raidTokenCapFinalBazaar
    : state.config.raidTokenCapStandard;
}

export function commitRaid(
  state: GameState,
  playerId: string,
  targetId: string | null,
  tokens: number,
  lootPreference: ResourceId[] = [],
  useSmuggler = false,
): GameState {
  assertRaidPhase(state);
  if (state.raid.commitments[playerId]) throw new EngineError("already_committed");
  if (targetId !== null) {
    if (targetId === playerId) throw new EngineError("cannot_target_self");
    getPlayer(state, targetId);
  }
  if (!Number.isInteger(tokens) || tokens < 0) throw new EngineError("invalid_token_count");
  for (const r of lootPreference) {
    if (!RESOURCE_IDS.includes(r)) throw new EngineError("invalid_resource");
  }

  const player = getPlayer(state, playerId);
  let cap = raidTokenCap(state);
  let next = state;

  if (useSmuggler) {
    if (player.role !== "smuggler") throw new EngineError("not_smuggler");
    if (player.roleUsed) throw new EngineError("role_already_used");
    cap += 1;
    next = updatePlayer(next, playerId, (p) => ({ ...p, roleUsed: true }));
  }

  if (tokens > cap) throw new EngineError("exceeds_raid_token_cap");

  const commitment: RaidCommitment = { targetId, tokens, lootPreference, usedSmuggler: useSmuggler };
  return { ...next, raid: { commitments: { ...next.raid.commitments, [playerId]: commitment } } };
}

function isMutualCancel(commitments: Record<string, RaidCommitment>, attackerId: string): boolean {
  const mine = commitments[attackerId];
  if (!mine?.targetId || mine.tokens <= 0) return false;
  const theirs = commitments[mine.targetId];
  return !!theirs && theirs.targetId === attackerId && theirs.tokens > 0;
}

/**
 * Spec §9. Every player must already have a commitment (targetId: null,
 * tokens: 0 counts) — the round loop / server auto-pass-on-timeout policy
 * is responsible for filling in anyone who didn't act before calling this.
 *
 * Bodyguard's block is unconditional per spec wording ("the raid is
 * blocked"). Underwriter's is worded as "may pay 2 coins" — implying
 * optional — but a real mid-resolution prompt per potential raid would
 * require pausing simultaneous resolution for player input; this always
 * applies it automatically when available, since declining a free-seeming
 * defense is never rational. Flagged as an implementation simplification.
 */
export function resolveRaids(state: GameState): { state: GameState; results: RaidResolution[] } {
  assertRaidPhase(state);
  const order = seatingOrder(state);
  for (const player of order) {
    if (!state.raid.commitments[player.id]) {
      throw new EngineError("missing_raid_commitments", `${player.id} has not committed a raid`);
    }
  }

  const results: RaidResolution[] = [];
  let working = state;

  for (const attacker of order) {
    const commitment = working.raid.commitments[attacker.id]!;
    const targetId = commitment.targetId;

    if (!targetId || commitment.tokens <= 0) {
      results.push({
        attackerId: attacker.id,
        targetId: targetId ?? "",
        tokensCommitted: commitment.tokens,
        outcome: "no_action",
        stolen: {},
      });
      continue;
    }

    if (isMutualCancel(working.raid.commitments, attacker.id)) {
      results.push({
        attackerId: attacker.id,
        targetId,
        tokensCommitted: commitment.tokens,
        outcome: "mutual_cancel",
        stolen: {},
      });
      continue;
    }

    const target = getPlayer(working, targetId);

    if (target.role === "bodyguard" && !target.roleUsed) {
      working = updatePlayer(working, targetId, (p) => ({ ...p, roleUsed: true }));
      results.push({
        attackerId: attacker.id,
        targetId,
        tokensCommitted: commitment.tokens,
        outcome: "blocked_bodyguard",
        stolen: {},
      });
      continue;
    }

    if (target.role === "underwriter" && !target.roleUsed && target.coins >= 2) {
      working = updatePlayer(working, targetId, (p) => ({
        ...p,
        roleUsed: true,
        coins: p.coins - 2,
      }));
      results.push({
        attackerId: attacker.id,
        targetId,
        tokensCommitted: commitment.tokens,
        outcome: "blocked_underwriter",
        stolen: {},
      });
      continue;
    }

    const attackerFresh = getPlayer(working, attacker.id);
    let stealAmount = commitment.tokens;
    if (working.currentEvent === "caravanSeason") stealAmount += 1;
    if (attackerFresh.role === "fence" && !attackerFresh.roleUsed) stealAmount += 1;

    const targetFresh = getPlayer(working, targetId);
    const preferenceOrder = [...commitment.lootPreference, ...RESOURCE_IDS].filter(
      (r, i, arr) => arr.indexOf(r) === i,
    );

    const stolen: Partial<Record<ResourceId, number>> = {};
    let remaining = stealAmount;
    for (const resource of preferenceOrder) {
      if (remaining <= 0) break;
      const available = targetFresh.resources[resource];
      const take = Math.min(available, remaining);
      if (take > 0) {
        stolen[resource] = take;
        remaining -= take;
      }
    }
    const stoleSomething = Object.keys(stolen).length > 0;

    working = updatePlayer(working, targetId, (p) => {
      const resources = { ...p.resources };
      for (const [resource, amount] of Object.entries(stolen) as [ResourceId, number][]) {
        resources[resource] -= amount;
      }
      return { ...p, resources };
    });
    working = updatePlayer(working, attacker.id, (p) => {
      const resources = { ...p.resources };
      for (const [resource, amount] of Object.entries(stolen) as [ResourceId, number][]) {
        resources[resource] += amount;
      }
      return { ...p, resources, roleUsed: p.role === "fence" && stoleSomething ? true : p.roleUsed };
    });

    results.push({
      attackerId: attacker.id,
      targetId,
      tokensCommitted: commitment.tokens,
      outcome: "success",
      stolen,
    });
  }

  return { state: working, results };
}
