import { Router } from "express";
import { isValidRoomCode, normalizeRoomCode } from "@souk/shared";
import { asyncHandler } from "../asyncHandler.js";
import { AppError } from "../errors.js";
import { requireAuth, type AuthedRequest } from "../auth/middleware.js";
import { createRoom, getRoomByCode, joinRoom, leaveRoom } from "./service.js";
import { toRoomView } from "./view.js";

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
