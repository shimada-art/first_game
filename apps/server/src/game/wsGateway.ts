import type { Server as HttpServer, IncomingMessage } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { QUICK_REACTION_IDS } from "@souk/shared";
import { consumeWsTicket } from "./wsTickets.js";
import { findGameIdForRoom } from "./service.js";
import { getOrLoadSession } from "./roomSession.js";
import type { ClientMessage } from "@souk/engine";

const REACTION_COOLDOWN_MS = 400;

export function attachWsGateway(httpServer: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    if (!req.url?.startsWith("/ws")) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws, req) => {
    void handleConnection(ws, req);
  });
}

async function handleConnection(ws: WebSocket, req: IncomingMessage): Promise<void> {
  const url = new URL(req.url ?? "", "http://internal");
  const ticket = url.searchParams.get("ticket");
  const consumed = ticket ? consumeWsTicket(ticket) : null;
  if (!consumed) {
    ws.close(4001, "invalid_or_expired_ticket");
    return;
  }
  const { userId, roomId } = consumed;

  const gameId = await findGameIdForRoom(roomId);
  if (!gameId) {
    ws.close(4004, "game_not_found");
    return;
  }

  const session = await getOrLoadSession(roomId, gameId);
  if (!session.state.players.some((p) => p.id === userId)) {
    ws.close(4003, "not_a_player_in_this_game");
    return;
  }

  session.addSocket(userId, ws);
  let lastReactionAt = 0;

  ws.on("message", (raw) => {
    let message: ClientMessage;
    try {
      message = JSON.parse(raw.toString()) as ClientMessage;
    } catch {
      ws.send(JSON.stringify({ type: "error", code: "invalid_message" }));
      return;
    }

    if (message.type === "action") {
      void session.handleAction(userId, message.action);
      return;
    }

    if (message.type === "reaction") {
      if (!(QUICK_REACTION_IDS as readonly string[]).includes(message.reaction)) {
        ws.send(JSON.stringify({ type: "error", code: "invalid_message" }));
        return;
      }
      const now = Date.now();
      if (now - lastReactionAt < REACTION_COOLDOWN_MS) return;
      lastReactionAt = now;
      session.broadcastReaction(userId, message.reaction);
      return;
    }

    ws.send(JSON.stringify({ type: "error", code: "invalid_message" }));
  });

  ws.on("close", () => {
    session.removeSocket(userId, ws);
  });
}
