import type { Room, RoomPlayer, RoomStatus, User } from "@souk/db";
import { MAX_PLAYERS, MIN_PLAYERS } from "@souk/shared";

export interface RoomPlayerView {
  userId: string;
  username: string;
  displayName: string;
  avatarKey: string | null;
  seat: number;
  isHost: boolean;
}

export interface RoomView {
  code: string;
  status: RoomStatus;
  hostId: string;
  minPlayers: number;
  maxPlayers: number;
  players: RoomPlayerView[];
}

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
      })),
  };
}
