import type { Room, RoomPlayer, User } from "@souk/db";
import { MAX_PLAYERS, MIN_PLAYERS, type AiDifficulty, type RoomPlayerView, type RoomView } from "@souk/shared";

export type { RoomPlayerView, RoomView };

export type RoomPlayerWithUser = RoomPlayer & { user: User };
export type RoomWithPlayers = Room & { players: RoomPlayerWithUser[] };

export function toRoomView(room: RoomWithPlayers): RoomView {
  return {
    code: room.code,
    status: room.status,
    hostId: room.hostId,
    minPlayers: MIN_PLAYERS,
    maxPlayers: MAX_PLAYERS,
    players: room.players
      .slice()
      .sort((a, b) => a.seat - b.seat)
      .map((player) => ({
        userId: player.userId,
        username: player.user.username,
        displayName: player.user.displayName,
        avatarKey: player.user.avatarKey,
        seat: player.seat,
        isHost: player.isHost,
        isBot: player.isBot,
        botDifficulty: player.isBot ? (player.botDifficulty as AiDifficulty) : null,
      })),
  };
}
