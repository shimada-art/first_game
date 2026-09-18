import type { WebSocket } from "ws";
import {
  applyAction,
  EngineError,
  viewForPlayer,
  type EngineAction,
  type GamePhase,
  type GameState,
} from "@souk/engine";
import { createAiMemory, decideAction, recordReveal, type AiMemory } from "@souk/ai";
import type { AiDifficulty, QuickReactionId } from "@souk/shared";
import { loadGameState, saveGameState } from "./service.js";
import { getBotDifficulties } from "../rooms/service.js";
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
let aiThinkDelayMs: [number, number] = [700, 1800];

/** Test-only hook — real games use the durations above; tests inject short ones instead of waiting tens of seconds. */
export function setPhaseTimingForTesting(overrides: {
  phase?: Partial<Record<GamePhase, number>>;
  revealPauseMs?: number;
  aiThinkDelayMs?: [number, number];
}): void {
  if (overrides.phase) phaseTimeoutMs = { ...phaseTimeoutMs, ...overrides.phase };
  if (overrides.revealPauseMs !== undefined) revealPauseMs = overrides.revealPauseMs;
  if (overrides.aiThinkDelayMs) aiThinkDelayMs = overrides.aiThinkDelayMs;
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
  private readonly botDifficulties: Record<string, AiDifficulty>;
  /**
   * One memory per room, shared by every bot in it, because what it holds
   * (who has been caught lying) is itself public reveal data every player
   * — human or AI — already saw broadcast. Not part of GameState: it's
   * non-gameplay bookkeeping the spec's own state shape (§16) deliberately
   * excludes, same category as client-local UI state.
   */
  private readonly aiMemory: AiMemory = createAiMemory();
  private aiTimer: NodeJS.Timeout | null = null;

  constructor(roomId: string, gameId: string, state: GameState, botDifficulties: Record<string, AiDifficulty>) {
    this.roomId = roomId;
    this.gameId = gameId;
    this.state = state;
    this.botDifficulties = botDifficulties;
    this.scheduleTimer();
    this.scheduleAiTurns();
  }

  static async loadOrCreate(roomId: string, gameId: string): Promise<RoomSession> {
    const [state, botDifficulties] = await Promise.all([
      loadGameState(gameId),
      getBotDifficulties(roomId),
    ]);
    return new RoomSession(roomId, gameId, state, botDifficulties);
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
    const prevPhase = this.state.phase;
    try {
      const { state: next, privateResult } = applyAction(this.state, userId, action);
      this.state = next;
      this.maybeRecordReveal(prevPhase);
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
    // Bots are never the ones we just failed to validate around — always
    // re-check afterward, success or not, so one bot's turn can't stall
    // the rest of the table.
    this.scheduleAiTurns();
  }

  private sendToUser(userId: string, message: ServerMessage): void {
    for (const ws of this.sockets.get(userId) ?? []) send(ws, message);
  }

  /** Purely cosmetic relay — never touches GameState, never persisted. */
  broadcastReaction(playerId: string, reaction: QuickReactionId): void {
    const message: ServerMessage = { type: "reaction", playerId, reaction };
    for (const set of this.sockets.values()) {
      for (const ws of set) send(ws, message);
    }
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

  /** Reveal is public to every player the instant it happens — bots learn from it exactly as a human would remember it. */
  private maybeRecordReveal(prevPhase: GamePhase): void {
    if (this.state.phase === "reveal" && prevPhase !== "reveal" && this.state.reveal) {
      recordReveal(this.aiMemory, this.state.reveal.whispers);
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

  /**
   * Looks for the first AI-controlled seat with a decision to make right
   * now and, after a short "thinking" delay, applies it through the exact
   * same handleAction path a human's WS message goes through — no
   * special-cased trust boundary for bots. Only ever one timer in flight;
   * handleAction re-invokes this once the action lands, so bots act one
   * at a time rather than all at once, and the search naturally stops
   * once nobody has anything left to decide.
   */
  private scheduleAiTurns(): void {
    if (this.aiTimer || this.state.phase === "gameover") return;

    for (const player of this.state.players) {
      if (!player.isAI) continue;
      const difficulty = this.botDifficulties[player.id] ?? "medium";
      const view = viewForPlayer(this.state, player.id);
      const action = decideAction(view, difficulty, this.aiMemory);
      if (!action) continue;

      const [min, max] = aiThinkDelayMs;
      const delay = min + Math.floor(Math.random() * Math.max(1, max - min));
      this.aiTimer = setTimeout(() => {
        this.aiTimer = null;
        void this.handleAction(player.id, action);
      }, delay).unref();
      return;
    }
  }

  /** Runs when a phase's clock expires — auto-passes stragglers, never ejects anyone. */
  private async autoAdvance(): Promise<void> {
    const prevPhase = this.state.phase;
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

    this.maybeRecordReveal(prevPhase);
    await this.persist();
    this.scheduleTimer();
    this.broadcastState();
    this.scheduleAiTurns();
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
