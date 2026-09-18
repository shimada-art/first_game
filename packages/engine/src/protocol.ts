import type { ResourceId } from "@souk/shared";
import type { EngineAction } from "./actions.js";
import type { GameStateView } from "./view.js";

// WebSocket wire-protocol types for the realtime layer (apps/server's
// gateway, apps/client's game hook) — not used by the engine reducer
// itself, but defined here so both sides of the socket share one source
// of truth instead of duplicating (and risking drift on) these shapes.

export type ClientMessage = { type: "action"; action: EngineAction };

export type ServerMessage =
  | { type: "state"; view: GameStateView; phaseDeadlineAt: number | null }
  | { type: "error"; code: string; message?: string }
  | { type: "appraiserResult"; targetId: string; tokens: ResourceId[] };
