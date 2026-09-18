import type { User } from "@souk/db";

/**
 * The shape returned to an account's own owner (auth responses, GET/PATCH
 * /me). Never send this for any *other* player — build a separate,
 * email-less view when profiles become visible to other players (friends,
 * leaderboard, etc. in a later phase).
 */
export interface PrivateUserView {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarKey: string | null;
  bio: string | null;
  createdAt: string;
}

export function toPrivateUserView(user: User): PrivateUserView {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatarKey: user.avatarKey,
    bio: user.bio,
    createdAt: user.createdAt.toISOString(),
  };
}
