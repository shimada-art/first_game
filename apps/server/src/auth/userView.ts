import type { User } from "@souk/db";
import type { PrivateUserView } from "@souk/shared";

export type { PrivateUserView };

/**
 * The shape returned to an account's own owner (auth responses, GET/PATCH
 * /me). Never send this for any *other* player — build a separate,
 * email-less view when profiles become visible to other players (friends,
 * leaderboard, etc. in a later phase).
 */
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
