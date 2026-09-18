import type { EngineAction, GameStateView } from "@souk/engine";
import type { ResourceId } from "@souk/shared";

export type ClientMessage = { type: "action"; action: EngineAction };

export type ServerMessage =
  | { type: "state"; view: GameStateView }
  | { type: "error"; code: string; message?: string }
  | { type: "appraiserResult"; targetId: string; tokens: ResourceId[] };
