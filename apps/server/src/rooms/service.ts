import { randomUUID } from "node:crypto";
import { Prisma, prisma, type Room } from "@souk/db";
import { generateRoomCode, MAX_PLAYERS, type AiDifficulty } from "@souk/shared";
import { AppError } from "../errors.js";
import { hashPassword } from "../auth/password.js";
import type { RoomWithPlayers } from "./view.js";

const ROOM_INCLUDE = { players: { include: { user: true } } } as const;

const CODE_GENERATION_ATTEMPTS = 5;
const SEAT_ASSIGNMENT_ATTEMPTS = 3;

function isUniqueConstraintViolation(err: unknown, target: string): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002" &&
    (err.meta?.["target"] as string[] | undefined)?.includes(target) === true
  );
}

export async function createRoom(hostUserId: string): Promise<RoomWithPlayers> {
  for (let attempt = 0; attempt < CODE_GENERATION_ATTEMPTS; attempt++) {
    const code = generateRoomCode();
    try {
      return await prisma.room.create({
        data: {
          code,
          hostId: hostUserId,
          players: { create: { userId: hostUserId, seat: 0, isHost: true } },
        },
        include: ROOM_INCLUDE,
      });
    } catch (err) {
      if (isUniqueConstraintViolation(err, "code")) {
        continue; // extremely rare collision — try another code
      }
      throw err;
    }
  }
  throw new AppError(500, "room_code_generation_failed");
}

async function findRoomOrThrow(code: string): Promise<RoomWithPlayers> {
  const room = await prisma.room.findUnique({ where: { code }, include: ROOM_INCLUDE });
  if (!room) {
    throw new AppError(404, "room_not_found");
  }
  return room;
}

function nextFreeSeat(room: RoomWithPlayers): number {
  const taken = new Set(room.players.map((p) => p.seat));
  for (let seat = 0; seat < MAX_PLAYERS; seat++) {
    if (!taken.has(seat)) return seat;
  }
  throw new AppError(409, "room_full");
}

export async function joinRoom(code: string, userId: string): Promise<RoomWithPlayers> {
  let room = await findRoomOrThrow(code);

  const existingMembership = room.players.find((p) => p.userId === userId);
  if (existingMembership) {
    return room; // idempotent rejoin
  }

  if (room.status !== "WAITING") {
    throw new AppError(409, "room_not_joinable");
  }

  for (let attempt = 0; attempt < SEAT_ASSIGNMENT_ATTEMPTS; attempt++) {
    const seat = nextFreeSeat(room);
    try {
      await prisma.roomPlayer.create({ data: { roomId: room.id, userId, seat } });
      return await findRoomOrThrow(code);
    } catch (err) {
      if (isUniqueConstraintViolation(err, "roomId_seat")) {
        room = await findRoomOrThrow(code); // seat was taken by a concurrent join — retry
        continue;
      }
      throw err;
    }
  }
  throw new AppError(409, "room_full");
}

export async function leaveRoom(code: string, userId: string): Promise<Room> {
  const room = await findRoomOrThrow(code);
  const membership = room.players.find((p) => p.userId === userId);
  if (!membership) {
    throw new AppError(403, "not_a_room_member");
  }
  if (room.status === "IN_PROGRESS") {
    throw new AppError(409, "game_in_progress");
  }

  return prisma.$transaction(async (tx) => {
    await tx.roomPlayer.delete({ where: { id: membership.id } });

    const remaining = await tx.roomPlayer.findMany({
      where: { roomId: room.id },
      orderBy: { seat: "asc" },
    });

    if (remaining.length === 0) {
      return tx.room.update({ where: { id: room.id }, data: { status: "CLOSED" } });
    }

    if (membership.isHost) {
      const newHost = remaining[0]!;
      await tx.roomPlayer.update({ where: { id: newHost.id }, data: { isHost: true } });
      return tx.room.update({ where: { id: room.id }, data: { hostId: newHost.userId } });
    }

    return tx.room.findUniqueOrThrow({ where: { id: room.id } });
  });
}

export async function getRoomByCode(code: string): Promise<RoomWithPlayers> {
  return findRoomOrThrow(code);
}

const BOT_DISPLAY_NAME: Record<AiDifficulty, string> = {
  easy: "Bot (Easy)",
  medium: "Bot (Medium)",
  hard: "Bot (Hard)",
};

/**
 * A bot seat is a real (synthetic) User + RoomPlayer row — it reuses every
 * existing join/leave/display-name/engine-player code path unchanged.
 * Nothing distinguishes it from a human seat except isBot/botDifficulty,
 * and it never gets a session (it never logs in).
 */
export async function addBot(
  code: string,
  hostUserId: string,
  difficulty: AiDifficulty,
): Promise<RoomWithPlayers> {
  const room = await findRoomOrThrow(code);
  if (room.hostId !== hostUserId) throw new AppError(403, "not_room_host");
  if (room.status !== "WAITING") throw new AppError(409, "room_not_joinable");
  if (room.players.length >= MAX_PLAYERS) throw new AppError(409, "room_full");

  const seat = nextFreeSeat(room);
  const suffix = randomUUID();
  const passwordHash = await hashPassword(randomUUID());
  const botUser = await prisma.user.create({
    data: {
      email: `bot-${suffix}@bots.internal`,
      username: `bot_${suffix}`,
      passwordHash,
      displayName: BOT_DISPLAY_NAME[difficulty],
    },
  });

  try {
    await prisma.roomPlayer.create({
      data: { roomId: room.id, userId: botUser.id, seat, isBot: true, botDifficulty: difficulty },
    });
  } catch (err) {
    await prisma.user.delete({ where: { id: botUser.id } }).catch(() => undefined);
    if (isUniqueConstraintViolation(err, "roomId_seat")) throw new AppError(409, "room_full");
    throw err;
  }

  return findRoomOrThrow(code);
}

export async function removeBot(code: string, hostUserId: string, botUserId: string): Promise<RoomWithPlayers> {
  const room = await findRoomOrThrow(code);
  if (room.hostId !== hostUserId) throw new AppError(403, "not_room_host");
  if (room.status !== "WAITING") throw new AppError(409, "room_in_progress");

  const membership = room.players.find((p) => p.userId === botUserId && p.isBot);
  if (!membership) throw new AppError(404, "bot_not_found");

  await prisma.roomPlayer.delete({ where: { id: membership.id } });
  await prisma.user.delete({ where: { id: botUserId } });

  return findRoomOrThrow(code);
}

export async function getBotDifficulties(roomId: string): Promise<Record<string, AiDifficulty>> {
  const bots = await prisma.roomPlayer.findMany({
    where: { roomId, isBot: true },
    select: { userId: true, botDifficulty: true },
  });
  const map: Record<string, AiDifficulty> = {};
  for (const b of bots) {
    if (b.botDifficulty) map[b.userId] = b.botDifficulty as AiDifficulty;
  }
  return map;
}
