import { Router } from "express";
import { isValidRoomCode, normalizeRoomCode, type AiDifficulty } from "@souk/shared";
import { asyncHandler } from "../asyncHandler.js";
import { AppError } from "../errors.js";
import { requireAuth, type AuthedRequest } from "../auth/middleware.js";
import { addBot, createRoom, getRoomByCode, joinRoom, leaveRoom, removeBot } from "./service.js";
import { toRoomView } from "./view.js";
import { startGame } from "../game/service.js";
import { mintWsTicket } from "../game/wsTickets.js";

export const roomsRouter = Router();

function paramCode(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new AppError(400, "invalid_room_code");
  }
  const code = normalizeRoomCode(raw);
  if (!isValidRoomCode(code)) {
    throw new AppError(400, "invalid_room_code");
  }
  return code;
}

roomsRouter.post(
  "/rooms",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const room = await createRoom(user.id);
    res.status(201).json({ room: toRoomView(room) });
  }),
);

roomsRouter.get(
  "/rooms/:code",
  requireAuth,
  asyncHandler(async (req, res) => {
    const code = paramCode(req.params["code"]);
    const room = await getRoomByCode(code);
    res.status(200).json({ room: toRoomView(room) });
  }),
);

roomsRouter.post(
  "/rooms/:code/join",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const code = paramCode(req.params["code"]);
    const room = await joinRoom(code, user.id);
    res.status(200).json({ room: toRoomView(room) });
  }),
);

roomsRouter.post(
  "/rooms/:code/start",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const code = paramCode(req.params["code"]);
    const room = await getRoomByCode(code);
    const { gameId } = await startGame(room, user.id);
    res.status(201).json({ gameId });
  }),
);

roomsRouter.post(
  "/rooms/:code/ws-ticket",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const code = paramCode(req.params["code"]);
    const room = await getRoomByCode(code);
    if (!room.players.some((p) => p.userId === user.id)) {
      throw new AppError(403, "not_a_room_member");
    }
    const ticket = mintWsTicket(user.id, room.id);
    res.status(201).json({ ticket });
  }),
);

const VALID_DIFFICULTIES = new Set<AiDifficulty>(["easy", "medium", "hard"]);

roomsRouter.post(
  "/rooms/:code/bots",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const code = paramCode(req.params["code"]);
    const difficulty: unknown = (req.body as { difficulty?: unknown } | undefined)?.difficulty;
    if (typeof difficulty !== "string" || !VALID_DIFFICULTIES.has(difficulty as AiDifficulty)) {
      res.status(400).json({ error: "invalid_input" });
      return;
    }
    const room = await addBot(code, user.id, difficulty as AiDifficulty);
    res.status(201).json({ room: toRoomView(room) });
  }),
);

roomsRouter.delete(
  "/rooms/:code/bots/:userId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const code = paramCode(req.params["code"]);
    const botUserId = req.params["userId"];
    if (typeof botUserId !== "string") {
      throw new AppError(400, "invalid_input");
    }
    const room = await removeBot(code, user.id, botUserId);
    res.status(200).json({ room: toRoomView(room) });
  }),
);

roomsRouter.post(
  "/rooms/:code/leave",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const code = paramCode(req.params["code"]);
    await leaveRoom(code, user.id);
    const room = await getRoomByCode(code);
    res.status(200).json({ room: toRoomView(room) });
  }),
);
