// Wire-format view types shared between server (which builds them from DB
// models) and client (which consumes them). Keeping these here means the
// two sides can never silently drift apart.

export interface PrivateUserView {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarKey: string | null;
  bio: string | null;
  createdAt: string;
}

export type RoomStatus = "WAITING" | "IN_PROGRESS" | "CLOSED";

export type AiDifficulty = "easy" | "medium" | "hard";

export interface RoomPlayerView {
  userId: string;
  username: string;
  displayName: string;
  avatarKey: string | null;
  seat: number;
  isHost: boolean;
  isBot: boolean;
  botDifficulty: AiDifficulty | null;
}

export interface RoomView {
  code: string;
  status: RoomStatus;
  hostId: string;
  minPlayers: number;
  maxPlayers: number;
  players: RoomPlayerView[];
}
