import type { NextFunction, Request, Response } from "express";
import type { User } from "@souk/db";
import { asyncHandler } from "../asyncHandler.js";
import { getSessionUser } from "./session.js";

export interface AuthedRequest extends Request {
  user: User;
}

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  return header.slice("Bearer ".length).trim() || null;
}

export const requireAuth = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = bearerToken(req);
    const user = token ? await getSessionUser(token) : null;

    if (!user) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    (req as AuthedRequest).user = user;
    next();
  },
);

export function getBearerToken(req: Request): string | null {
  return bearerToken(req);
}
