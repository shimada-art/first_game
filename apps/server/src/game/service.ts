import { Prisma, prisma } from "@souk/db";
import { initializeGame, type GameState } from "@souk/engine";
import { MAX_PLAYERS, MIN_PLAYERS } from "@souk/shared";
import { AppError } from "../errors.js";
import type { RoomWithPlayers } from "../rooms/view.js";

export interface StartedGame {
  gameId: string;
  state: GameState;
}

export async function startGame(room: RoomWithPlayers, requestingUserId: string): Promise<StartedGame> {
  if (room.hostId !== requestingUserId) {
    throw new AppError(403, "not_room_host");
  }
  if (room.status !== "WAITING") {
    throw new AppError(409, "room_not_waiting");
  }
  if (room.players.length < MIN_PLAYERS || room.players.length > MAX_PLAYERS) {
    throw new AppError(409, "invalid_player_count");
  }

  const seat0 = room.players.find((p) => p.seat === 0);
  const state = initializeGame(
    room.players.map((p) => ({ id: p.userId, isAI: p.isBot })),
    seat0 ? { startingPlayerId: seat0.userId } : {},
  );

  const game = await prisma.$transaction(async (tx) => {
    const created = await tx.game.create({
      data: { roomId: room.id, state: state as unknown as Prisma.InputJsonValue },
    });
    await tx.room.update({ where: { id: room.id }, data: { status: "IN_PROGRESS" } });
    return created;
  });

  return { gameId: game.id, state };
}

export async function loadGameState(gameId: string): Promise<GameState> {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) throw new AppError(404, "game_not_found");
  return game.state as unknown as GameState;
}

export async function saveGameState(gameId: string, state: GameState): Promise<void> {
  await prisma.game.update({
    where: { id: gameId },
    data: {
      state: state as unknown as Prisma.InputJsonValue,
      status: state.status === "finished" ? "FINISHED" : "IN_PROGRESS",
    },
  });
}

export async function findGameIdForRoom(roomId: string): Promise<string | null> {
  const game = await prisma.game.findUnique({ where: { roomId }, select: { id: true } });
  return game?.id ?? null;
}
