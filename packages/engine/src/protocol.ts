import type { QuickReactionId, ResourceId } from "@souk/shared";
import type { EngineAction } from "./actions.js";
import type { GameStateView } from "./view.js";

// WebSocket wire-protocol types for the realtime layer (apps/server's
// gateway, apps/client's game hook) — not used by the engine reducer
// itself, but defined here so both sides of the socket share one source
// of truth instead of duplicating (and risking drift on) these shapes.
//
// "reaction" is deliberately not a GameAction: it never touches GameState,
// isn't persisted, and isn't validated by the engine — it's a transient,
// purely cosmetic relay (quick emoji/phrase reactions during Whisper/Trade),
// so the server only checks the id against the fixed QUICK_REACTION_IDS set
// before rebroadcasting it to the room.

export type ClientMessage =
  | { type: "action"; action: EngineAction }
  | { type: "reaction"; reaction: QuickReactionId };

export type ServerMessage =
  | { type: "state"; view: GameStateView; phaseDeadlineAt: number | null }
  | { type: "error"; code: string; message?: string }
  | { type: "appraiserResult"; targetId: string; tokens: ResourceId[] }
  | { type: "reaction"; playerId: string; reaction: QuickReactionId };
