import type { WebSocket } from "ws";
import {
  applyAction,
  EngineError,
  viewForPlayer,
  type EngineAction,
  type GamePhase,
  type GameState,
} from "@souk/engine";
import { loadGameState, saveGameState } from "./service.js";
import type { ServerMessage } from "@souk/engine";

/**
 * Never eject a player on timeout — auto-pass/auto-skip their action
 * instead (hard rule from the implementation brief). These are the
 * per-phase ceilings; the Whisper phase additionally bounds how long a
 * single pending claim can sit unanswered before it's auto-resolved.
 */
let phaseTimeoutMs: Partial<Record<GamePhase, number>> = {
  market: 20_000,
  whisper: 45_000,
  trade: 60_000,
  raid: 30_000,
};
let revealPauseMs = 4_000;

/** Test-only hook — real games use the durations above; tests inject short ones instead of waiting tens of seconds. */
export function setPhaseTimingForTesting(overrides: {
  phase?: Partial<Record<GamePhase, number>>;
  revealPauseMs?: number;
}): void {
  if (overrides.phase) phaseTimeoutMs = { ...phaseTimeoutMs, ...overrides.phase };
  if (overrides.revealPauseMs !== undefined) revealPauseMs = overrides.revealPauseMs;
}

function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export class RoomSession {
  readonly roomId: string;
  readonly gameId: string;
  state: GameState;
  private phaseDeadlineAt: number | null = null;
  private readonly sockets = new Map<string, Set<WebSocket>>();
  private timer: NodeJS.Timeout | null = null;

  constructor(roomId: string, gameId: string, state: GameState) {
    this.roomId = roomId;
    this.gameId = gameId;
    this.state = state;
    this.scheduleTimer();
  }

  static async loadOrCreate(roomId: string, gameId: string): Promise<RoomSession> {
    const state = await loadGameState(gameId);
    return new RoomSession(roomId, gameId, state);
  }

  hasSockets(): boolean {
    return this.sockets.size > 0;
  }

  addSocket(userId: string, ws: WebSocket): void {
    let set = this.sockets.get(userId);
    if (!set) {
      set = new Set();
      this.sockets.set(userId, set);
    }
    const wasConnected = set.size > 0;
    set.add(ws);

    if (!wasConnected && this.setConnected(userId, true)) {
      void this.persist();
      this.broadcastState();
    } else {
      send(ws, {
        type: "state",
        view: viewForPlayer(this.state, userId),
        phaseDeadlineAt: this.phaseDeadlineAt,
      });
    }
  }

  removeSocket(userId: string, ws: WebSocket): void {
    const set = this.sockets.get(userId);
    if (!set) return;
    set.delete(ws);
    if (set.size === 0) {
      this.sockets.delete(userId);
      if (this.setConnected(userId, false)) {
        void this.persist();
        this.broadcastState();
      }
    }
  }

  /** Returns true if the player's connected flag actually changed. */
  private setConnected(userId: string, connected: boolean): boolean {
    const player = this.state.players.find((p) => p.id === userId);
    if (!player || player.connected === connected) return false;
    this.state = {
      ...this.state,
      players: this.state.players.map((p) => (p.id === userId ? { ...p, connected } : p)),
    };
    return true;
  }

  async handleAction(userId: string, action: EngineAction): Promise<void> {
    try {
      const { state: next, privateResult } = applyAction(this.state, userId, action);
      this.state = next;
      await this.persist();
      this.scheduleTimer();
      this.broadcastState();
      if (privateResult) {
        this.sendToUser(userId, {
          type: "appraiserResult",
          targetId: privateResult.targetId,
          tokens: privateResult.tokens,
        });
      }
    } catch (err) {
      const code = err instanceof EngineError ? err.code : "internal_error";
      this.sendToUser(
        userId,
        err instanceof Error
          ? { type: "error", code, message: err.message }
          : { type: "error", code },
      );
    }
  }

  private sendToUser(userId: string, message: ServerMessage): void {
    for (const ws of this.sockets.get(userId) ?? []) send(ws, message);
  }

  broadcastState(): void {
    for (const [userId, set] of this.sockets) {
      const view = viewForPlayer(this.state, userId);
      for (const ws of set) {
        send(ws, { type: "state", view, phaseDeadlineAt: this.phaseDeadlineAt });
      }
    }
  }

  /**
   * Best-effort: persistence is a side effect the in-memory session doesn't
   * depend on to keep serving connected clients correctly, so a failure
   * here (e.g. a race with the room being deleted) is logged, never thrown
   * — every call site would otherwise need its own defensive catch.
   */
  private async persist(): Promise<void> {
    try {
      await saveGameState(this.gameId, this.state);
    } catch (err) {
      console.error(`Failed to persist game ${this.gameId}`, err);
    }
  }

  private scheduleTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.phaseDeadlineAt = null;

    if (this.state.phase === "gameover") return;

    const delay = this.state.phase === "reveal" ? revealPauseMs : phaseTimeoutMs[this.state.phase];
    if (delay === undefined) return;

    this.phaseDeadlineAt = Date.now() + delay;
    this.timer = setTimeout(() => {
      void this.autoAdvance();
    }, delay).unref();
  }

  /** Runs when a phase's clock expires — auto-passes stragglers, never ejects anyone. */
  private async autoAdvance(): Promise<void> {
    const apply = (playerId: string, action: EngineAction): void => {
      this.state = applyAction(this.state, playerId, action).state;
    };

    try {
      switch (this.state.phase) {
        case "market":
          apply(this.state.startingPlayerId, { kind: "ADVANCE_PHASE" });
          break;

        case "whisper": {
          const pending = this.state.whisper.pending;
          if (pending) {
            if (pending.stage === "awaitingResponse") {
              apply(pending.claim.targetId, { kind: "WHISPER_TRUST" });
            } else if (pending.stage === "awaitingBribeOffer") {
              apply(pending.claim.claimantId, { kind: "WHISPER_BRIBE_OFFER", amount: 0 });
            } else {
              apply(pending.claim.targetId, { kind: "WHISPER_BRIBE_RESPOND", accept: false });
            }
          }
          apply(this.state.startingPlayerId, { kind: "ADVANCE_PHASE" });
          break;
        }

        case "trade": {
          for (const proposal of this.state.trade.proposals) {
            if (proposal.status === "pending") {
              const recipient =
                proposal.currentProposerId === proposal.playerAId ? proposal.playerBId : proposal.playerAId;
              apply(recipient, { kind: "TRADE_DECLINE", proposalId: proposal.id });
            }
          }
          apply(this.state.startingPlayerId, { kind: "ADVANCE_PHASE" });
          break;
        }

        case "raid": {
          for (const player of this.state.players) {
            if (!this.state.raid.commitments[player.id]) {
              apply(player.id, { kind: "RAID_COMMIT", targetId: null, tokens: 0 });
            }
          }
          apply(this.state.startingPlayerId, { kind: "ADVANCE_PHASE" });
          break;
        }

        case "reveal":
          apply(this.state.startingPlayerId, { kind: "ADVANCE_PHASE" });
          break;

        default:
          break;
      }
    } catch (err) {
      // Auto-pass logic should never itself violate a rule; surface loudly if it does.
      console.error("autoAdvance failed", err);
    }

    await this.persist();
    this.scheduleTimer();
    this.broadcastState();
  }
}

const sessions = new Map<string, RoomSession>();
// Tracks an in-flight load per room so concurrent connectors (e.g. every
// player joining right after a game starts) await the SAME session being
// created, rather than each racing to build — and register their socket
// on — their own orphaned copy that never sees the others' broadcasts.
const loading = new Map<string, Promise<RoomSession>>();

export async function getOrLoadSession(roomId: string, gameId: string): Promise<RoomSession> {
  const existing = sessions.get(roomId);
  if (existing) return existing;

  let inFlight = loading.get(roomId);
  if (!inFlight) {
    inFlight = RoomSession.loadOrCreate(roomId, gameId).then((session) => {
      sessions.set(roomId, session);
      loading.delete(roomId);
      return session;
    });
    loading.set(roomId, inFlight);
  }
  return inFlight;
}

export function peekSession(roomId: string): RoomSession | undefined {
  return sessions.get(roomId);
}
